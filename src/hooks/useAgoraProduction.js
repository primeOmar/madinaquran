import { useState, useEffect, useRef, useCallback } from 'react';

// Enhanced Agora Configuration with multiple fallback options
const AGORA_CONFIG = {
  appId: process.env.NEXT_PUBLIC_AGORA_APP_ID,
  codec: 'h264',
  mode: 'rtc',
  maxRetries: 5,
  timeout: 15000,
  
  // Multiple server endpoints for fallback
  serverUrls: [
    'wss://webrtc2.ap.agora.io',
    'wss://webrtc2.ap.sd-rtn.com',
    'wss://webrtc2-1.ap.sd-rtn.com',
    'wss://webrtc2-2.ap.sd-rtn.com',
    'wss://webrtc2-3.ap.sd-rtn.com',
    'wss://webrtc2-4.ap.sd-rtn.com'
  ],
  
  // Alternative gateway servers
  gatewayServers: [
    'https://webrtc2-ap-web-1.agora.io',
    'https://webrtc2-ap-web-2.agora.io', 
    'https://webrtc2-ap-web-3.agora.io'
  ]
};

// Enhanced Error Mapping
const AGORA_ERROR_MESSAGES = {
  'CAN_NOT_GET_GATEWAY_SERVER': {
    userMessage: 'Network connection issue. Please check your internet connection and try again.',
    retryable: true,
    fallback: true
  },
  'DYNAMIC_USE_STATIC_KEY': {
    userMessage: 'Authentication issue. Trying alternative connection method...',
    retryable: true,
    fallback: true
  },
  'INVALID_PARAMS': {
    userMessage: 'Configuration error. Please contact support.',
    retryable: false,
    fallback: false
  },
  'INVALID_TOKEN': {
    userMessage: 'Session expired. Refreshing connection...',
    retryable: true,
    fallback: true
  },
  'DEFAULT': {
    userMessage: 'Connection issue. Attempting to reconnect...',
    retryable: true,
    fallback: true
  }
};

// Enhanced Agora Service with advanced fallback strategies
class AgoraProductionService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.retryCount = 0;
    this.maxRetries = AGORA_CONFIG.maxRetries;
    this.eventListeners = new Map();
    this.currentServerIndex = 0;
    this.useTokenFallback = false;
    this.connectionAttempts = 0;
  }

  async initializeClient() {
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      
      this.client = AgoraRTC.createClient({
        mode: AGORA_CONFIG.mode,
        codec: AGORA_CONFIG.codec
      });

      // Try to set custom gateway server (if supported)
      await this.setCustomGateway();
      
      this.setupEventListeners();
      this.isInitialized = true;
      
      return this.client;
    } catch (error) {
      console.error('❌ Failed to initialize Agora client:', error);
      throw this.normalizeError(error);
    }
  }

  // Method to try different gateway servers
  async setCustomGateway() {
    if (!this.client || !AGORA_CONFIG.gatewayServers.length) return;

    try {
      const gatewayUrl = AGORA_CONFIG.gatewayServers[this.currentServerIndex];
      console.log(`🔄 Trying gateway server: ${gatewayUrl}`);
      
      // Some Agora SDK versions support custom gateway configuration
      if (this.client.setGateway) {
        this.client.setGateway(gatewayUrl);
      }
    } catch (error) {
      console.warn('Could not set custom gateway:', error);
    }
  }

  setupEventListeners() {
    if (!this.client) return;

    this.client.on('connection-state-change', (curState, prevState) => {
      console.log(`🔗 Agora connection: ${prevState} → ${curState}`);
      this.emit('connection-state-change', { current: curState, previous: prevState });
      
      if (curState === 'DISCONNECTED') {
        this.handleDisconnection();
      }
    });

    this.client.on('token-privilege-will-expire', () => {
      console.log('🕒 Token will expire soon');
      this.emit('token-will-expire');
    });

    this.client.on('token-privilege-did-expire', () => {
      console.log('❌ Token expired');
      this.emit('token-expired');
    });

    // Additional error handling
    this.client.on('exception', (event) => {
      console.warn('Agora exception:', event);
      this.emit('exception', event);
    });
  }

  async joinChannelWithRetry(channelName, token, uid = null) {
    this.connectionAttempts++;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.isInitialized) {
          await this.initializeClient();
        }

        console.log(`🎯 Joining "${channelName}" - attempt ${attempt}/${this.maxRetries}`);
        console.log(`🔧 Using ${this.useTokenFallback ? 'token fallback' : 'normal token'} mode`);
        
        // Try with token first, then fallback to null if issues persist
        const joinToken = this.useTokenFallback ? null : token;
        
        await this.client.join(
          AGORA_CONFIG.appId,
          channelName,
          joinToken,
          uid
        );

        console.log('✅ Successfully joined channel:', channelName);
        this.retryCount = 0;
        this.connectionAttempts = 0;
        this.emit('joined', { channelName, uid, usedFallback: this.useTokenFallback });
        return;

      } catch (error) {
        console.error(`❌ Join attempt ${attempt} failed:`, error);
        
        // Check if we should try token fallback
        if ((error.code === 4096 || error.message?.includes('dynamic use static key')) && 
            !this.useTokenFallback && attempt >= 2) {
          console.log('🔄 Switching to token fallback mode');
          this.useTokenFallback = true;
          this.isInitialized = false;
          continue;
        }
        
        // Try next gateway server
        if (attempt % 2 === 0 && this.currentServerIndex < AGORA_CONFIG.gatewayServers.length - 1) {
          this.currentServerIndex++;
          this.isInitialized = false;
          console.log(`🔄 Switching to gateway server ${this.currentServerIndex + 1}`);
        }
        
        if (attempt === this.maxRetries) {
          throw this.normalizeError(error);
        }

        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000;
        await this.delay(baseDelay + jitter);
        
        this.isInitialized = false;
      }
    }
  }

  normalizeError(error) {
    const errorCode = error?.code || error?.message;
    let errorInfo = AGORA_ERROR_MESSAGES[errorCode] || AGORA_ERROR_MESSAGES.DEFAULT;
    
    // Special handling for gateway errors
    if (errorCode === 4096 || error.message?.includes('dynamic use static key')) {
      errorInfo = AGORA_ERROR_MESSAGES.CAN_NOT_GET_GATEWAY_SERVER;
    }
    
    return {
      originalError: error,
      code: errorCode,
      message: error?.message || 'Unknown error',
      userMessage: errorInfo.userMessage,
      retryable: errorInfo.retryable,
      supportsFallback: errorInfo.fallback,
      connectionAttempts: this.connectionAttempts
    };
  }

  async handleDisconnection() {
    console.log('🔄 Handling disconnection...');
    
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Attempting reconnection (${this.retryCount}/${this.maxRetries})`);
      
      try {
        await this.reconnect();
        this.emit('reconnected');
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.emit('reconnection-failed', error);
      }
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('connection-lost');
    }
  }

  async reconnect() {
    if (this.client) {
      try {
        await this.client.leave();
      } catch (error) {
        console.warn('Error during leave on reconnect:', error);
      }
    }
    
    this.isInitialized = false;
    // Rotate to next gateway server
    this.currentServerIndex = (this.currentServerIndex + 1) % AGORA_CONFIG.gatewayServers.length;
    await this.initializeClient();
  }

  async leaveChannel() {
    if (this.client) {
      try {
        await this.client.leave();
        console.log('✅ Successfully left channel');
        this.emit('left');
      } catch (error) {
        console.error('Error leaving channel:', error);
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
          console.error(`Error in event listener for ${event}:`, error);
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

  // Get connection stats
  getConnectionStats() {
    return {
      retryCount: this.retryCount,
      connectionAttempts: this.connectionAttempts,
      currentGateway: AGORA_CONFIG.gatewayServers[this.currentServerIndex],
      usingTokenFallback: this.useTokenFallback,
      maxRetries: this.maxRetries
    };
  }
}

// Enhanced React Hook
export const useAgoraProduction = (options = {}) => {
  const {
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
    isFallbackMode: false,
    connectionStats: null
  });

  const agoraService = useRef(null);
  const localAudioTrack = useRef(null);
  const localVideoTrack = useRef(null);

  // Initialize service
  useEffect(() => {
    agoraService.current = new AgoraProductionService();

    // Enhanced event listeners
    agoraService.current.on('joined', (data) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isConnecting: false,
        connectionError: null,
        isFallbackMode: data.usedFallback || false,
        connectionStats: agoraService.current.getConnectionStats()
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
        connectionState: data.current,
        connectionStats: agoraService.current.getConnectionStats()
      }));
      onConnectionStateChange?.(data);
    });

    agoraService.current.on('reconnection-failed', (error) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        isConnecting: false,
        connectionError: error,
        connectionStats: agoraService.current.getConnectionStats()
      }));
      onError?.(error);
    });

    agoraService.current.on('token-will-expire', () => {
      console.log('🕒 Token will expire - implement renewal logic');
    });

    agoraService.current.on('token-expired', () => {
      setState(prev => ({ 
        ...prev, 
        isConnected: false,
        connectionError: {
          userMessage: 'Session expired. Please refresh the page.',
          retryable: true
        }
      }));
    });

    agoraService.current.on('exception', (event) => {
      console.warn('Agora exception event:', event);
    });

    return () => {
      if (agoraService.current) {
        agoraService.current.destroy();
      }
      if (localAudioTrack.current) {
        localAudioTrack.current.close();
      }
      if (localVideoTrack.current) {
        localVideoTrack.current.close();
      }
    };
  }, [onError, onJoined, onLeft, onConnectionStateChange, onFallbackMode]);

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin && initialChannelName && initialToken) {
      joinChannel(initialChannelName, initialToken);
    }
  }, [autoJoin, initialChannelName, initialToken]);

  const joinChannel = useCallback(async (channelName, token, uid = null) => {
    if (!channelName) {
      const error = new Error('Channel name is required');
      setState(prev => ({ ...prev, connectionError: error }));
      onError?.(error);
      return false;
    }

    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      connectionError: null,
      connectionStats: agoraService.current?.getConnectionStats() || null
    }));

    try {
      await agoraService.current.joinChannelWithRetry(channelName, token, uid);
      return true;
    } catch (error) {
      console.error('Failed to join channel:', error);
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isConnected: false,
        connectionError: error,
        connectionStats: agoraService.current?.getConnectionStats() || null
      }));
      onError?.(error);
      return false;
    }
  }, [onError]);

  const leaveChannel = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      isConnecting: false, 
      connectionError: null 
    }));

    // Clean up local tracks
    if (localAudioTrack.current) {
      localAudioTrack.current.close();
      localAudioTrack.current = null;
    }
    if (localVideoTrack.current) {
      localVideoTrack.current.close();
      localVideoTrack.current = null;
    }

    try {
      await agoraService.current.leaveChannel();
    } catch (error) {
      console.error('Error leaving channel:', error);
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

  const getConnectionStats = useCallback(() => {
    return agoraService.current?.getConnectionStats() || null;
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    joinChannel,
    leaveChannel,
    retryConnection,
    getConnectionStats,
    
    // Service instance (for advanced usage)
    service: agoraService.current,
    
    // Utility
    isInitialized: agoraService.current?.isInitialized || false
  };
};

// Quick Start Hook for simple usage
export const useAgoraQuickStart = (channelName, token, options = {}) => {
  return useAgoraProduction({
    autoJoin: true,
    channelName,
    token,
    onError: (error) => {
      console.error('Agora QuickStart Error:', error);
      options.onError?.(error);
    },
    onFallbackMode: (isFallback) => {
      console.log(`🔄 ${isFallback ? 'Using' : 'Disabling'} fallback mode`);
      options.onFallbackMode?.(isFallback);
    },
    ...options
  });
};

export default useAgoraProduction;
