import AgoraRTC from 'agora-rtc-sdk-ng';

// ==================== PRODUCTION-READY CONFIGURATION ====================

class AgoraConfig {
  constructor() {
    this._config = null;
  }
  
  load() {
    if (this._config) return this._config;
    
    // Priority 1: Vite environment variables (development)
    // Priority 2: Process environment variables (Node.js/SSR)
    // Priority 3: Window global variables (production runtime)
    // Priority 4: Build-time replacements
    // Priority 5: Fallback with clear error messaging
    
    const APP_ID = this.getAppId();
    const REGION = this.getRegion();
    const ENV = this.getEnvironment();
    
    this._config = {
      APP_ID,
      REGION,
      ENV,
      TOKEN_EXPIRY: 3600,
      MAX_RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
      JOIN_TIMEOUT: 15000
    };
    
    console.log(`🎯 Agora Config Loaded - Environment: ${ENV}, App ID: ${APP_ID ? `${APP_ID.substring(0, 8)}...` : 'NOT SET'}`);
    return this._config;
  }
  
  getAppId() {
    // 1. Vite env (client-side)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGORA_APP_ID) {
      const appId = import.meta.env.VITE_AGORA_APP_ID.trim();
      if (appId && !appId.includes('your_')) return appId;
    }
    
    // 2. Process env (Node.js/SSR)
    if (typeof process !== 'undefined' && process.env?.VITE_AGORA_APP_ID) {
      const appId = process.env.VITE_AGORA_APP_ID.trim();
      if (appId && !appId.includes('your_')) return appId;
    }
    
    // 3. Global window variable (production runtime injection)
    if (typeof window !== 'undefined' && window.__AGORA_CONFIG__?.APP_ID) {
      const appId = window.__AGORA_CONFIG__.APP_ID.trim();
      if (appId && !appId.includes('your_')) return appId;
    }
    
    // 4. Build-time replacement (via Vite define)
    if (typeof __AGORA_APP_ID__ !== 'undefined' && __AGORA_APP_ID__) {
      const appId = __AGORA_APP_ID__.trim();
      if (appId && !appId.includes('your_')) return appId;
    }
    
    // 5. Return empty string with warning (will be caught in validation)
    console.warn('❌ Agora App ID not found in environment variables');
    return '';
  }
  
  getRegion() {
    // Same priority as getAppId
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGORA_REGION) {
      return import.meta.env.VITE_AGORA_REGION;
    }
    if (typeof process !== 'undefined' && process.env?.VITE_AGORA_REGION) {
      return process.env.VITE_AGORA_REGION;
    }
    if (typeof window !== 'undefined' && window.__AGORA_CONFIG__?.REGION) {
      return window.__AGORA_CONFIG__.REGION;
    }
    if (typeof __AGORA_REGION__ !== 'undefined') {
      return __AGORA_REGION__;
    }
    return undefined; // Use Agora's default region
  }
  
  getEnvironment() {
    if (typeof import.meta !== 'undefined' && import.meta.env?.MODE) {
      return import.meta.env.MODE;
    }
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
      return process.env.NODE_ENV;
    }
    return 'production';
  }
  
  getConfig() {
    return this.load();
  }
}

// Create singleton instance
const agoraConfig = new AgoraConfig();
const AGORA_CONFIG = agoraConfig.getConfig();

// Service State
class VideoServiceState {
  constructor() {
    this.agoraEngine = null;
    this.localTracks = {
      audioTrack: null,
      videoTrack: null
    };
    this.remoteUsers = new Map();
    this.currentChannel = null;
    this.isInitialized = false;
    this.retryCount = 0;
    this.eventCallbacks = {
      onUserJoined: [],
      onUserLeft: [],
      onUserPublished: [],
      onUserUnpublished: [],
      onConnectionStateChange: [],
      onError: []
    };
  }
  
  reset() {
    this.agoraEngine = null;
    this.localTracks.audioTrack = null;
    this.localTracks.videoTrack = null;
    this.remoteUsers.clear();
    this.currentChannel = null;
    this.isInitialized = false;
    this.retryCount = 0;
  }
}

class ProductionVideoService {
  constructor() {
    this.state = new VideoServiceState();
    this.isCleaningUp = false;
    this.config = AGORA_CONFIG;
  }
  
  // ==================== CORE VALIDATION ====================
  
  validateEnvironment() {
    const { APP_ID } = this.config;
    
    // Check if Agora SDK is available
    if (typeof AgoraRTC === 'undefined') {
      throw new Error('AGORA_SDK_UNAVAILABLE: Agora RTC SDK not loaded. Check network connectivity and script tags.');
    }
    
    // Validate App ID with detailed error messages
    if (!APP_ID) {
      const envHelp = this.getEnvironmentHelpText();
      throw new Error(`AGORA_APP_ID_MISSING: ${envHelp}`);
    }
    
    if (APP_ID.includes('your_') || APP_ID.length < 10) {
      throw new Error('AGORA_APP_ID_INVALID: App ID appears to be a placeholder. Please get a valid App ID from console.agora.io and configure it in your environment variables.');
    }
    
    // Check browser support
    if (!this.checkBrowserSupport()) {
      throw new Error('BROWSER_NOT_SUPPORTED: Your browser does not support WebRTC video calls. Please use Chrome, Firefox, or Safari latest versions.');
    }
    
    return APP_ID;
  }
  
  getEnvironmentHelpText() {
    const env = this.config.ENV;
    
    if (env === 'development') {
      return 'VITE_AGORA_APP_ID environment variable is not set. Please create a .env.local file in your project root with: VITE_AGORA_APP_ID=your_actual_app_id';
    }
    
    if (env === 'production') {
      return 'Agora App ID is not configured for production. Please set VITE_AGORA_APP_ID in your deployment environment or use runtime configuration.';
    }
    
    return 'Agora App ID is not configured. Please check your environment variables.';
  }
  
  checkBrowserSupport() {
    if (!AgoraRTC.checkSystemRequirements()) {
      return false;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    
    return true;
  }
  
  async testNetworkConnectivity() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://api.agora.io', {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors'
      });
      
      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      console.warn('Network connectivity test failed. Agora might still work:', error.message);
      return true; // Don't block on network test failure
    }
  }
  
  // ==================== ERROR HANDLING ====================
  
  enhanceError(error, context = '') {
    const errorMap = {
      'CAN_NOT_GET_GATEWAY_SERVER': {
        code: 'NETWORK_BLOCKED',
        message: 'Cannot connect to video servers. This may be due to network restrictions, firewall, or invalid App ID.',
        userMessage: 'Video service is temporarily unavailable. Please check your network connection and try again.',
        recoverable: true
      },
      'INVALID_APP_ID': {
        code: 'INVALID_CONFIG',
        message: 'The provided App ID is not valid or has expired.',
        userMessage: 'Video service configuration error. Please contact support.',
        recoverable: false
      },
      'DYNAMIC_USE_STATIC_KEY': {
        code: 'AUTH_ERROR',
        message: 'Authentication configuration issue with video service.',
        userMessage: 'Video service authentication failed. Please try again.',
        recoverable: true
      },
      'JOIN_TIMEOUT': {
        code: 'TIMEOUT',
        message: 'Connection to video service timed out.',
        userMessage: 'Connection timeout. Please check your internet connection and try again.',
        recoverable: true
      },
      'AGORA_SDK_UNAVAILABLE': {
        code: 'SDK_ERROR',
        message: 'Video SDK not loaded properly.',
        userMessage: 'Video service initialization failed. Please refresh the page.',
        recoverable: true
      },
      'BROWSER_NOT_SUPPORTED': {
        code: 'BROWSER_ERROR',
        message: 'Browser does not support video calls.',
        userMessage: 'Your browser does not support video calls. Please use Chrome, Firefox, or Safari.',
        recoverable: false
      },
      'AGORA_APP_ID_MISSING': {
        code: 'CONFIG_ERROR',
        message: 'Agora App ID is not configured.',
        userMessage: 'Video service is not properly configured. Please contact support.',
        recoverable: false
      }
    };
    
    const errorMessage = error.message || error.toString();
    let matchedError = null;
    
    // Find matching error
    for (const [key, enhanced] of Object.entries(errorMap)) {
      if (errorMessage.includes(key)) {
        matchedError = { ...enhanced, originalError: errorMessage };
        break;
      }
    }
    
    // Default error
    if (!matchedError) {
      matchedError = {
        code: 'UNKNOWN_ERROR',
        message: `Video service error: ${errorMessage}`,
        userMessage: 'Video call service encountered an unexpected error. Please try again.',
        recoverable: true,
        originalError: errorMessage
      };
    }
    
    // Add context and environment info
    if (context) {
      matchedError.context = context;
    }
    
    matchedError.environment = this.config.ENV;
    matchedError.appIdConfigured = !!this.config.APP_ID && !this.config.APP_ID.includes('your_');
    
    return matchedError;
  }
  
  emitEvent(eventName, data) {
    if (this.state.eventCallbacks[eventName]) {
      this.state.eventCallbacks[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (callbackError) {
          console.error(`Error in ${eventName} callback:`, callbackError);
        }
      });
    }
  }
  
  // ==================== AGORA ENGINE MANAGEMENT ====================
  
  async initializeAgoraEngine() {
    if (this.state.agoraEngine) {
      return this.state.agoraEngine;
    }
    
    try {
      this.state.agoraEngine = AgoraRTC.createClient({
        mode: "rtc",
        codec: "vp8"
      });
      
      this.setupAgoraEventListeners();
      return this.state.agoraEngine;
    } catch (error) {
      this.state.agoraEngine = null;
      throw this.enhanceError(error, 'initialize-engine');
    }
  }
  
  setupAgoraEventListeners() {
    if (!this.state.agoraEngine) return;
    
    // User published media
    this.state.agoraEngine.on("user-published", async (user, mediaType) => {
      try {
        console.log(`📹 User ${user.uid} published ${mediaType}`);
        
        await this.state.agoraEngine.subscribe(user, mediaType);
        
        const userData = this.state.remoteUsers.get(user.uid) || {
          uid: user.uid,
          joinedAt: new Date(),
                              hasVideo: false,
                              hasAudio: false
        };
        
        if (mediaType === "video") {
          userData.videoTrack = user.videoTrack;
          userData.hasVideo = true;
        }
        
        if (mediaType === "audio") {
          userData.audioTrack = user.audioTrack;
          userData.hasAudio = true;
          user.audioTrack.play().catch(err =>
          console.warn(`Could not play audio for user ${user.uid}:`, err)
          );
        }
        
        this.state.remoteUsers.set(user.uid, userData);
        this.emitEvent('onUserPublished', { user: userData, mediaType });
        
      } catch (error) {
        console.error(`Error handling user-published for ${user.uid}:`, error);
        this.emitEvent('onError', this.enhanceError(error, 'user-published'));
      }
    });
    
    // User unpublished media
    this.state.agoraEngine.on("user-unpublished", (user, mediaType) => {
      try {
        console.log(`📹 User ${user.uid} unpublished ${mediaType}`);
        
        const userData = this.state.remoteUsers.get(user.uid);
        if (userData) {
          if (mediaType === "video") {
            userData.videoTrack = null;
            userData.hasVideo = false;
          }
          if (mediaType === "audio") {
            userData.audioTrack = null;
            userData.hasAudio = false;
          }
          this.state.remoteUsers.set(user.uid, userData);
          this.emitEvent('onUserUnpublished', { user: userData, mediaType });
        }
      } catch (error) {
        console.error(`Error handling user-unpublished for ${user.uid}:`, error);
      }
    });
    
    // User joined
    this.state.agoraEngine.on("user-joined", (user) => {
      try {
        console.log(`👤 User ${user.uid} joined`);
        this.state.remoteUsers.set(user.uid, {
          uid: user.uid,
          joinedAt: new Date(),
                                   hasVideo: false,
                                   hasAudio: false
        });
        this.emitEvent('onUserJoined', { uid: user.uid });
      } catch (error) {
        console.error(`Error handling user-joined for ${user.uid}:`, error);
      }
    });
    
    // User left
    this.state.agoraEngine.on("user-left", (user) => {
      try {
        console.log(`👤 User ${user.uid} left`);
        this.state.remoteUsers.delete(user.uid);
        this.emitEvent('onUserLeft', { uid: user.uid });
      } catch (error) {
        console.error(`Error handling user-left for ${user.uid}:`, error);
      }
    });
    
    // Connection state change
    this.state.agoraEngine.on("connection-state-change", (curState, prevState) => {
      try {
        console.log(`🔗 Connection state: ${prevState} → ${curState}`);
        this.emitEvent('onConnectionStateChange', {
          previous: prevState,
          current: curState,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error handling connection-state-change:', error);
      }
    });
  }
  
  // ==================== CORE VIDEO OPERATIONS ====================
  
  async startVideoSession(classId, userId, options = {}) {
    if (this.isCleaningUp) {
      throw this.enhanceError(new Error('Service is cleaning up'), 'start-session');
    }
    
    try {
      console.group('🎥 Starting Video Session');
      
      // 1. Environment validation
      const appId = this.validateEnvironment();
      await this.testNetworkConnectivity();
      
      // 2. Generate channel name
      const channelName = options.channelName || `madina-class-${classId}-${Date.now()}`;
      
      // 3. Initialize engine
      await this.initializeAgoraEngine();
      
      // 4. Join channel with retry logic
      const joinResult = await this.joinChannelWithRetry(appId, channelName, null, userId);
      
      // 5. Create and publish local tracks
      const trackResult = await this.createAndPublishLocalTracks(options);
      
      this.state.isInitialized = true;
      this.state.currentChannel = channelName;
      
      console.log('✅ Video session started successfully');
      console.groupEnd();
      
      return {
        success: true,
        meetingId: channelName,
        channel: channelName,
        localAudioTrack: trackResult.audioTrack,
        localVideoTrack: trackResult.videoTrack,
        engine: this.state.agoraEngine,
        hasAudio: !!trackResult.audioTrack,
        hasVideo: !!trackResult.videoTrack,
        appId: `${appId.substring(0, 8)}...`,
        environment: this.config.ENV
      };
      
    } catch (error) {
      console.groupEnd();
      console.error('❌ Failed to start video session:', error);
      
      // Clean up on failure
      await this.safeCleanup();
      throw this.enhanceError(error, 'start-session');
    }
  }
  
  async joinVideoSession(meetingId, userId, mediaOptions = { audio: true, video: true }) {
    if (this.isCleaningUp) {
      throw this.enhanceError(new Error('Service is cleaning up'), 'join-session');
    }
    
    try {
      console.group('🎥 Joining Video Session');
      
      // 1. Environment validation
      const appId = this.validateEnvironment();
      await this.testNetworkConnectivity();
      
      // 2. Use provided meetingId as channel name or generate one
      const channelName = meetingId || `madina-session-${Date.now()}`;
      
      // 3. Clean up existing session if any
      if (this.state.isInitialized) {
        await this.leaveVideoSession();
      }
      
      // 4. Initialize engine
      await this.initializeAgoraEngine();
      
      // 5. Join channel with retry logic
      const joinResult = await this.joinChannelWithRetry(appId, channelName, null, userId);
      
      // 6. Create and publish local tracks based on media options
      const trackResult = await this.createAndPublishLocalTracks(mediaOptions);
      
      this.state.isInitialized = true;
      this.state.currentChannel = channelName;
      
      console.log('✅ Joined video session successfully');
      console.groupEnd();
      
      return {
        success: true,
        meetingId: channelName,
        channel: channelName,
        localAudioTrack: trackResult.audioTrack,
        localVideoTrack: trackResult.videoTrack,
        engine: this.state.agoraEngine,
        hasAudio: !!trackResult.audioTrack,
        hasVideo: !!trackResult.videoTrack,
        appId: `${appId.substring(0, 8)}...`,
        environment: this.config.ENV
      };
      
    } catch (error) {
      console.groupEnd();
      console.error('❌ Failed to join video session:', error);
      
      // Clean up on failure
      await this.safeCleanup();
      throw this.enhanceError(error, 'join-session');
    }
  }
  
  async joinChannelWithRetry(appId, channelName, token, uid, attempt = 1) {
    try {
      console.log(`🔄 Join attempt ${attempt}/${this.config.MAX_RETRY_ATTEMPTS + 1}`);
      
      const joinPromise = this.state.agoraEngine.join(
        appId,
        channelName,
        token,
        uid,
        this.config.REGION ? { region: this.config.REGION } : undefined
      );
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('JOIN_TIMEOUT')), this.config.JOIN_TIMEOUT);
      });
      
      await Promise.race([joinPromise, timeoutPromise]);
      console.log('✅ Channel joined successfully');
      return { success: true };
      
    } catch (error) {
      if (attempt <= this.config.MAX_RETRY_ATTEMPTS) {
        console.warn(`Join attempt ${attempt} failed, retrying...:`, error.message);
        await new Promise(resolve => setTimeout(resolve, this.config.RETRY_DELAY * attempt));
        return this.joinChannelWithRetry(appId, channelName, token, uid, attempt + 1);
      }
      throw error;
    }
  }
  
  async createAndPublishLocalTracks(options = {}) {
    const result = {
      audioTrack: null,
      videoTrack: null
    };
    
    try {
      // Create audio track if requested
      if (options.audio !== false) {
        try {
          result.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,     // Acoustic Echo Cancellation
            ANS: true,     // Automatic Noise Suppression
            AGC: true      // Automatic Gain Control
          });
          console.log('🎤 Audio track created successfully');
        } catch (audioError) {
          console.warn('Microphone access failed:', audioError.message);
          result.audioTrack = null;
        }
      }
      
      // Create video track if requested
      if (options.video !== false) {
        try {
          result.videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 1280,
              height: 720,
              frameRate: 30,
              bitrate: 1700
            },
            optimizationMode: 'detail'
          });
          console.log('📹 Video track created successfully');
        } catch (videoError) {
          console.warn('Camera access failed:', videoError.message);
          result.videoTrack = null;
        }
      }
      
      // Publish tracks
      const tracksToPublish = [];
      if (result.audioTrack) tracksToPublish.push(result.audioTrack);
      if (result.videoTrack) tracksToPublish.push(result.videoTrack);
      
      if (tracksToPublish.length > 0) {
        await this.state.agoraEngine.publish(tracksToPublish);
        console.log(`📤 Published ${tracksToPublish.length} track(s) successfully`);
      }
      
      // Store tracks in state
      this.state.localTracks.audioTrack = result.audioTrack;
      this.state.localTracks.videoTrack = result.videoTrack;
      
      return result;
      
    } catch (error) {
      // Clean up tracks on failure
      if (result.audioTrack) {
        result.audioTrack.close();
        result.audioTrack = null;
      }
      if (result.videoTrack) {
        result.videoTrack.close();
        result.videoTrack = null;
      }
      throw error;
    }
  }
  
  // ==================== SESSION MANAGEMENT ====================
  
  async leaveVideoSession() {
    if (this.isCleaningUp) {
      return { success: true };
    }
    
    this.isCleaningUp = true;
    
    try {
      console.group('🛑 Leaving Video Session');
      
      // Stop and close local tracks
      if (this.state.localTracks.audioTrack) {
        this.state.localTracks.audioTrack.stop();
        this.state.localTracks.audioTrack.close();
        this.state.localTracks.audioTrack = null;
      }
      
      if (this.state.localTracks.videoTrack) {
        this.state.localTracks.videoTrack.stop();
        this.state.localTracks.videoTrack.close();
        this.state.localTracks.videoTrack = null;
      }
      
      // Leave channel
      if (this.state.agoraEngine && this.state.currentChannel) {
        await this.state.agoraEngine.leave();
      }
      
      // Reset state
      this.state.reset();
      
      console.log('✅ Left video session successfully');
      console.groupEnd();
      
      return { success: true };
      
    } catch (error) {
      console.error('Error during session cleanup:', error);
      // Force reset even if cleanup fails
      this.state.reset();
      return { success: false, error: error.message };
    } finally {
      this.isCleaningUp = false;
    }
  }
  
  async safeCleanup() {
    try {
      await this.leaveVideoSession();
    } catch (error) {
      console.error('Error during safe cleanup:', error);
      this.state.reset();
    }
  }
  
  async rejoinVideoSession(meetingId, userId, mediaOptions = { audio: true, video: true }) {
    try {
      console.log('🔄 Rejoining video session');
      
      // Leave current session if exists
      if (this.state.isInitialized) {
        await this.leaveVideoSession();
      }
      
      // Join new session
      return await this.joinVideoSession(meetingId, userId, mediaOptions);
      
    } catch (error) {
      console.error('❌ Rejoin failed:', error);
      throw this.enhanceError(error, 'rejoin-session');
    }
  }
  
  // ==================== MEDIA CONTROL ====================
  
  async toggleAudio() {
    try {
      if (this.state.localTracks.audioTrack) {
        const newState = !this.state.localTracks.audioTrack.enabled;
        await this.state.localTracks.audioTrack.setEnabled(newState);
        console.log(`🎤 Audio ${newState ? 'enabled' : 'disabled'}`);
        return newState;
      }
      return false;
    } catch (error) {
      console.error('Error toggling audio:', error);
      throw this.enhanceError(error, 'toggle-audio');
    }
  }
  
  async toggleVideo() {
    try {
      if (this.state.localTracks.videoTrack) {
        const newState = !this.state.localTracks.videoTrack.enabled;
        await this.state.localTracks.videoTrack.setEnabled(newState);
        console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
        return newState;
      }
      return false;
    } catch (error) {
      console.error('Error toggling video:', error);
      throw this.enhanceError(error, 'toggle-video');
    }
  }
  
  async switchCamera() {
    try {
      if (this.state.localTracks.videoTrack) {
        const devices = await AgoraRTC.getCameras();
        if (devices.length > 1) {
          const currentDevice = this.state.localTracks.videoTrack.getTrackLabel();
          const otherDevices = devices.filter(device => device.deviceId !== currentDevice);
          
          if (otherDevices.length > 0) {
            await this.state.localTracks.videoTrack.setDevice(otherDevices[0].deviceId);
            console.log('🔄 Switched camera');
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error switching camera:', error);
      throw this.enhanceError(error, 'switch-camera');
    }
  }
  
  // ==================== QUERY METHODS ====================
  
  getRemoteUsers() {
    return Array.from(this.state.remoteUsers.values());
  }
  
  getRemoteUser(uid) {
    return this.state.remoteUsers.get(uid);
  }
  
  getLocalTracks() {
    return { ...this.state.localTracks };
  }
  
  isAudioEnabled() {
    return this.state.localTracks.audioTrack?.enabled ?? false;
  }
  
  isVideoEnabled() {
    return this.state.localTracks.videoTrack?.enabled ?? false;
  }
  
  isInitialized() {
    return this.state.isInitialized;
  }
  
  getCurrentChannel() {
    return this.state.currentChannel;
  }
  
  getConnectionStats() {
    if (this.state.agoraEngine) {
      return this.state.agoraEngine.getRTCStats();
    }
    return null;
  }
  
  getServiceStatus() {
    return {
      initialized: this.state.isInitialized,
      currentChannel: this.state.currentChannel,
      hasAudio: !!this.state.localTracks.audioTrack,
      hasVideo: !!this.state.localTracks.videoTrack,
      audioEnabled: this.isAudioEnabled(),
      videoEnabled: this.isVideoEnabled(),
      remoteUsers: this.state.remoteUsers.size,
      appId: this.config.APP_ID ? `${this.config.APP_ID.substring(0, 8)}...` : 'NOT_CONFIGURED',
      environment: this.config.ENV,
      configSource: this.getConfigSource()
    };
  }
  
  getConfigSource() {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGORA_APP_ID) {
      return 'vite-env';
    }
    if (typeof process !== 'undefined' && process.env?.VITE_AGORA_APP_ID) {
      return 'process-env';
    }
    if (typeof window !== 'undefined' && window.__AGORA_CONFIG__?.APP_ID) {
      return 'window-global';
    }
    if (typeof __AGORA_APP_ID__ !== 'undefined') {
      return 'build-time';
    }
    return 'none';
  }
  
  // ==================== EVENT MANAGEMENT ====================
  
  on(eventName, callback) {
    if (this.state.eventCallbacks[eventName]) {
      this.state.eventCallbacks[eventName].push(callback);
    }
  }
  
  off(eventName, callback) {
    if (this.state.eventCallbacks[eventName]) {
      this.state.eventCallbacks[eventName] = this.state.eventCallbacks[eventName].filter(cb => cb !== callback);
    }
  }
  
  removeAllListeners(eventName = null) {
    if (eventName) {
      this.state.eventCallbacks[eventName] = [];
    } else {
      Object.keys(this.state.eventCallbacks).forEach(key => {
        this.state.eventCallbacks[key] = [];
      });
    }
  }
  
  // ==================== DESTROY ====================
  
  async destroy() {
    console.log('🧹 Destroying video service');
    this.removeAllListeners();
    await this.safeCleanup();
  }
}

// Create and export singleton instance
const videoService = new ProductionVideoService();

// Export for testing and advanced usage
export { ProductionVideoService, VideoServiceState, AgoraConfig };
export default videoService;
