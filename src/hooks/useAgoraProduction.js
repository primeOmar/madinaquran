import { useState, useEffect, useRef, useCallback } from 'react';

// Agora Configuration Constants
const AGORA_CONFIG = {
  appId: process.env.NEXT_PUBLIC_AGORA_APP_ID,
  codec: 'h264',
  mode: 'rtc',
  maxRetries: 3,
  timeout: 10000,
  serverUrls: [
    'wss://webrtc2.ap.agora.io',
    'wss://webrtc2.ap.sd-rtn.com',
    'wss://webrtc2-1.ap.sd-rtn.com'
  ]
};

// Error Mapping
const AGORA_ERROR_MESSAGES = {
  'CAN_NOT_GET_GATEWAY_SERVER': {
    userMessage: 'Network connection issue. Please check your internet connection.',
    retryable: true
  },
  'DYNAMIC_USE_STATIC_KEY': {
    userMessage: 'Authentication error. Please refresh the page.',
    retryable: true
  },
  'INVALID_PARAMS': {
    userMessage: 'Configuration error. Please contact support.',
    retryable: false
  },
  'DEFAULT': {
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true
  }
};

// Agora Service Class
class AgoraProductionService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.retryCount = 0;
    this.maxRetries = AGORA_CONFIG.maxRetries;
    this.eventListeners = new Map();
  }

  async initializeClient() {
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      
      this.client = AgoraRTC.createClient({
        mode: AGORA_CONFIG.mode,
        codec: AGORA_CONFIG.codec
      });

      this.setupEventListeners();
      this.isInitialized = true;
      
      return this.client;
    } catch (error) {
      console.error('❌ Failed to initialize Agora client:', error);
      throw this.normalizeError(error);
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
  }

  async joinChannelWithRetry(channelName, token, uid = null) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.isInitialized) {
          await this.initializeClient();
        }

        console.log(`🎯 Joining "${channelName}" - attempt ${attempt}/${this.maxRetries}`);
        
        await this.client.join(
          AGORA_CONFIG.appId,
          channelName,
          token,
          uid
        );

        console.log('✅ Successfully joined channel:', channelName);
        this.retryCount = 0;
        this.emit('joined', { channelName, uid });
        return;

      } catch (error) {
        console.error(`❌ Join attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw this.normalizeError(error);
        }

        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
        this.isInitialized = false;
      }
    }
  }

  normalizeError(error) {
    const errorCode = error?.code || error?.message;
    const errorInfo = AGORA_ERROR_MESSAGES[errorCode] || AGORA_ERROR_MESSAGES.DEFAULT;
    
    return {
      originalError: error,
      code: errorCode,
      message: error?.message || 'Unknown error',
      userMessage: errorInfo.userMessage,
      retryable: errorInfo.retryable
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
  }
}

// React Hook
export const useAgoraProduction = (options = {}) => {
  const {
    onError,
    onJoined,
    onLeft,
    onConnectionStateChange,
    autoJoin = false,
    channelName: initialChannelName,
    token: initialToken
  } = options;

  const [state, setState] = useState({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    connectionState: 'DISCONNECTED'
  });

  const agoraService = useRef(null);
  const localAudioTrack = useRef(null);

  // Initialize service
  useEffect(() => {
    agoraService.current = new AgoraProductionService();

    // Event listeners
    agoraService.current.on('joined', (data) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isConnecting: false,
        connectionError: null 
      }));
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
      setState(prev => ({ ...prev, connectionState: data.current }));
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

    return () => {
      if (agoraService.current) {
        agoraService.current.destroy();
      }
      if (localAudioTrack.current) {
        localAudioTrack.current.close();
      }
    };
  }, [onError, onJoined, onLeft, onConnectionStateChange]);

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin && initialChannelName && initialToken) {
      joinChannel(initialChannelName, initialToken);
    }
  }, [autoJoin, initialChannelName, initialToken]);

  const joinChannel = useCallback(async (channelName, token, uid = null) => {
    if (!channelName || !token) {
      const error = new Error('Channel name and token are required');
      setState(prev => ({ ...prev, connectionError: error }));
      onError?.(error);
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true, connectionError: null }));

    try {
      await agoraService.current.joinChannelWithRetry(channelName, token, uid);
      
      // Initialize local audio track after successful join
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localAudioTrack.current = microphoneTrack;
        
        // Publish the track if needed
        // await agoraService.current.client.publish([microphoneTrack]);
      } catch (audioError) {
        console.warn('Could not initialize microphone:', audioError);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to join channel:', error);
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isConnected: false,
        connectionError: error 
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

    // Clean up local audio track
    if (localAudioTrack.current) {
      localAudioTrack.current.close();
      localAudioTrack.current = null;
    }

    try {
      await agoraService.current.leaveChannel();
    } catch (error) {
      console.error('Error leaving channel:', error);
      onError?.(error);
    }
  }, [onError]);

  const retryConnection = useCallback(async (channelName, token, uid = null) => {
    setState(prev => ({ ...prev, connectionError: null }));
    return await joinChannel(channelName, token, uid);
  }, [joinChannel]);

  const getLocalAudioTrack = useCallback(() => localAudioTrack.current, []);

  return {
    // State
    ...state,
    
    // Actions
    joinChannel,
    leaveChannel,
    retryConnection,
    getLocalAudioTrack,
    
    // Utility
    isInitialized: agoraService.current?.isInitialized || false
  };
};

// Error Boundary Component (for use in class components)
export class AgoraProductionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true,
      error 
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Agora Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          margin: '1rem 0'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>
              Audio Service Unavailable
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              We're having trouble connecting to the audio service. This might be due to network issues.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={this.handleRetry}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Quick Start Hook for simple usage
export const useAgoraQuickStart = (channelName, token) => {
  return useAgoraProduction({
    autoJoin: true,
    channelName,
    token,
    onError: (error) => {
      console.error('Agora QuickStart Error:', error);
    }
  });
};

export default useAgoraProduction;
