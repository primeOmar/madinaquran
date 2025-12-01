import { useState, useEffect, useRef, useCallback } from 'react';

// Agora Configuration
const AGORA_CONFIG = {
  codec: 'h264',
  mode: 'rtc',
  maxRetries: 3, // Reduced from 5
  timeout: 10000, // Reduced from 15000
  serverUrls: [
    'wss://webrtc2.ap.agora.io',
    'wss://webrtc2.ap.sd-rtn.com',
  ]
};

// Enhanced Error Mapping
const AGORA_ERROR_MESSAGES = {
  'CAN_NOT_GET_GATEWAY_SERVER': {
    userMessage: 'Network connection issue. Please check your internet.',
    retryable: true,
    fallback: true
  },
  'DYNAMIC_USE_STATIC_KEY': {
    userMessage: 'Authentication issue. Reconnecting...',
    retryable: true,
    fallback: true
  },
  'DEFAULT': {
    userMessage: 'Connection issue. Please try again.',
    retryable: true,
    fallback: true
  }
};

// SILENT Agora Service
class AgoraProductionService {
  constructor(appId) {
    this.client = null;
    this.isInitialized = false;
    this.retryCount = 0;
    this.maxRetries = AGORA_CONFIG.maxRetries;
    this.eventListeners = new Map();
    this.currentServerIndex = 0;
    this.useTokenFallback = false;
    this.connectionAttempts = 0;
    this.appId = appId;
    
    // ✅ MINIMAL LOGGING: Only log critical initialization issues
    if (!appId) {
      console.error('❌ Agora App ID is required but was not provided');
    }
  }

  async initializeClient() {
    try {
      if (!this.appId) {
        throw new Error('Agora App ID is required');
      }

      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      
      this.client = AgoraRTC.createClient({
        mode: AGORA_CONFIG.mode,
        codec: AGORA_CONFIG.codec
      });

      this.setupEventListeners();
      this.isInitialized = true;
      
      return this.client;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  setupEventListeners() {
    if (!this.client) return;

    // ✅ MINIMAL LOGGING: Only log state changes that matter
    this.client.on('connection-state-change', (curState, prevState) => {
      // Only log important transitions
      if (curState === 'DISCONNECTED' || curState === 'CONNECTED') {
        console.log(`Agora: ${prevState} → ${curState}`);
      }
      this.emit('connection-state-change', { current: curState, previous: prevState });
      
      if (curState === 'DISCONNECTED') {
        this.handleDisconnection();
      }
    });

    this.client.on('token-privilege-will-expire', () => {
      this.emit('token-will-expire');
    });

    this.client.on('token-privilege-did-expire', () => {
      this.emit('token-expired');
    });

    this.client.on('exception', (event) => {
      this.emit('exception', event);
    });
  }

  async joinChannelWithRetry(channelName, token, uid = null) {
    this.connectionAttempts++;
    
    if (!this.appId) {
      throw new Error('Cannot join channel: Agora App ID is missing');
    }
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.isInitialized) {
          await this.initializeClient();
        }

        // ✅ MINIMAL LOGGING: Only log first and last attempts
        if (attempt === 1) {
          console.log(`Joining channel: ${channelName}`);
        }

        const joinToken = this.useTokenFallback ? null : token;
        
        await this.client.join(
          this.appId,
          channelName,
          joinToken,
          uid
        );

        // ✅ SUCCESS: Log once
        console.log('✅ Joined channel successfully');
        this.retryCount = 0;
        this.connectionAttempts = 0;
        this.emit('joined', { 
          channelName, 
          uid, 
          usedFallback: this.useTokenFallback
        });
        return;

      } catch (error) {
        // ✅ MINIMAL LOGGING: Only log final failure
        if (attempt === this.maxRetries) {
          console.error(`Failed to join after ${this.maxRetries} attempts:`, error.message);
          throw this.normalizeError(error);
        }

        // Check if we should try token fallback
        if ((error.code === 4096 || error.message?.includes('dynamic use static key')) && 
            !this.useTokenFallback && attempt >= 2) {
          this.useTokenFallback = true;
          this.isInitialized = false;
          continue;
        }
        
        // Try next gateway server
        if (attempt % 2 === 0 && this.currentServerIndex < AGORA_CONFIG.serverUrls.length - 1) {
          this.currentServerIndex++;
          this.isInitialized = false;
        }
        
        // Exponential backoff
        const baseDelay = Math.pow(2, attempt) * 1000;
        await this.delay(baseDelay);
        
        this.isInitialized = false;
      }
    }
  }

  normalizeError(error) {
    const errorCode = error?.code || error?.message;
    let errorInfo = AGORA_ERROR_MESSAGES[errorCode] || AGORA_ERROR_MESSAGES.DEFAULT;
    
    if (errorCode === 4096 || error.message?.includes('dynamic use static key')) {
      errorInfo = AGORA_ERROR_MESSAGES.CAN_NOT_GET_GATEWAY_SERVER;
    }
    
    return {
      originalError: error,
      code: errorCode,
      message: error?.message || 'Unknown error',
      userMessage: errorInfo.userMessage,
      retryable: errorInfo.retryable,
      supportsFallback: errorInfo.fallback
    };
  }

  async handleDisconnection() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      
      try {
        await this.reconnect();
        this.emit('reconnected');
      } catch (error) {
        this.emit('reconnection-failed', error);
      }
    } else {
      this.emit('connection-lost');
    }
  }

  async reconnect() {
    if (this.client) {
      try {
        await this.client.leave();
      } catch (error) {
        // Silent fail
      }
    }
    
    this.isInitialized = false;
    this.currentServerIndex = (this.currentServerIndex + 1) % AGORA_CONFIG.serverUrls.length;
    await this.initializeClient();
  }

  async leaveChannel() {
    if (this.client) {
      try {
        await this.client.leave();
        this.emit('left');
      } catch (error) {
        throw this.normalizeError(error);
      }
    }
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          // Silent fail for event listener errors
        }
      });
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy() {
    if (this.client) {
      this.client.removeAllListeners();
    }
    this.eventListeners.clear();
    this.isInitialized = false;
    this.retryCount = 0;
    this.connectionAttempts = 0;
  }

  getConnectionStats() {
    return {
      retryCount: this.retryCount,
      connectionAttempts: this.connectionAttempts,
      usingTokenFallback: this.useTokenFallback,
      maxRetries: this.maxRetries
    };
  }
}

// SILENT React Hook
export const useAgoraProduction = (options = {}) => {
  const {
    appId,
    onError,
    onJoined,
    onLeft,
    onConnectionStateChange,
    onFallbackMode,
    autoJoin = false,
    channelName: initialChannelName,
    token: initialToken
  } = options;

  const [state, setState] = useState({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    connectionState: 'DISCONNECTED',
    isFallbackMode: false
  });

  const agoraService = useRef(null);

  // Initialize service
  useEffect(() => {
    agoraService.current = new AgoraProductionService(appId);

    // Event listeners with minimal logging
    agoraService.current.on('joined', (data) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isConnecting: false,
        connectionError: null,
        isFallbackMode: data.usedFallback || false
      }));
      if (data.usedFallback) {
        onFallbackMode?.(true);
      }
      onJoined?.(data);
    });

    agoraService.current.on('left', () => {
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        isConnecting: false,
        connectionError: null 
      }));
      onLeft?.();
    });

    agoraService.current.on('connection-state-change', (data) => {
      setState(prev => ({ 
        ...prev, 
        connectionState: data.current
      }));
      onConnectionStateChange?.(data);
    });

    agoraService.current.on('reconnection-failed', (error) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        isConnecting: false,
        connectionError: error
      }));
      onError?.(error);
    });

    agoraService.current.on('token-will-expire', () => {
      // Silent - implement renewal if needed
    });

    agoraService.current.on('token-expired', () => {
      setState(prev => ({ 
        ...prev, 
        isConnected: false,
        connectionError: {
          userMessage: 'Session expired. Please refresh.',
          retryable: true
        }
      }));
    });

    return () => {
      if (agoraService.current) {
        agoraService.current.destroy();
      }
    };
  }, [appId, onError, onJoined, onLeft, onConnectionStateChange, onFallbackMode]);

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin && initialChannelName && initialToken && appId) {
      joinChannel(initialChannelName, initialToken);
    }
  }, [autoJoin, initialChannelName, initialToken, appId]);

  const joinChannel = useCallback(async (channelName, token, uid = null) => {
    if (!appId) {
      const error = new Error('Cannot join channel: Agora App ID is missing');
      setState(prev => ({ ...prev, connectionError: error }));
      onError?.(error);
      return false;
    }

    if (!channelName) {
      const error = new Error('Channel name is required');
      setState(prev => ({ ...prev, connectionError: error }));
      onError?.(error);
      return false;
    }

    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      connectionError: null
    }));

    try {
      await agoraService.current.joinChannelWithRetry(channelName, token, uid);
      return true;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isConnected: false,
        connectionError: error
      }));
      onError?.(error);
      return false;
    }
  }, [appId, onError]);

  const leaveChannel = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      isConnecting: false, 
      connectionError: null 
    }));

    try {
      await agoraService.current.leaveChannel();
    } catch (error) {
      onError?.(error);
    }
  }, [onError]);

  const retryConnection = useCallback(async (channelName, token, uid = null) => {
    setState(prev => ({ 
      ...prev, 
      connectionError: null,
      isConnecting: true 
    }));
    return await joinChannel(channelName, token, uid);
  }, [joinChannel]);

  return {
    ...state,
    joinChannel,
    leaveChannel,
    retryConnection,
    service: agoraService.current,
    isInitialized: agoraService.current?.isInitialized || false
  };
};

export default useAgoraProduction;
