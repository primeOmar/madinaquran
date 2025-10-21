import AgoraRTC from 'agora-rtc-sdk-ng'

// ==================== ENHANCED CONFIGURATION ====================
class AgoraConfigManager {
  constructor() {
    this.config = this.loadConfig()
    this.validateConfig()
  }

  loadConfig() {
    // Priority 1: Build-time replacement (most reliable for production)
    // Priority 2: Vite environment variables
    // Priority 3: Global window variable
    
    const buildTimeAppId = typeof __AGORA_APP_ID__ !== 'undefined' ? __AGORA_APP_ID__ : ''
    const viteAppId = typeof import.meta !== 'undefined' ? import.meta.env.VITE_AGORA_APP_ID : ''
    const globalAppId = typeof window !== 'undefined' && window.__AGORA_CONFIG__ ? window.__AGORA_CONFIG__.APP_ID : ''
    
    const appId = buildTimeAppId || viteAppId || globalAppId || ''
    
    const buildTimeRegion = typeof __AGORA_REGION__ !== 'undefined' ? __AGORA_REGION__ : ''
    const viteRegion = typeof import.meta !== 'undefined' ? import.meta.env.VITE_AGORA_REGION : ''
    const globalRegion = typeof window !== 'undefined' && window.__AGORA_CONFIG__ ? window.__AGORA_CONFIG__.REGION : ''
    
    const region = buildTimeRegion || viteRegion || globalRegion || 'US'

    return {
      APP_ID: appId?.trim() || '',
      REGION: region?.trim(),
      TOKEN_EXPIRY: 3600,
      MAX_RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
      JOIN_TIMEOUT: 15000
    }
  }

  validateConfig() {
    const { APP_ID } = this.config
    
    if (!APP_ID) {
      console.error('❌ Agora App ID is completely missing')
      console.log('Configuration sources checked:')
      console.log('- Build-time (__AGORA_APP_ID__):', typeof __AGORA_APP_ID__ !== 'undefined' ? 'EXISTS' : 'MISSING')
      console.log('- Vite Env (import.meta.env.VITE_AGORA_APP_ID):', typeof import.meta !== 'undefined' && import.meta.env.VITE_AGORA_APP_ID ? 'EXISTS' : 'MISSING')
      console.log('- Window Global (window.__AGORA_CONFIG__):', typeof window !== 'undefined' && window.__AGORA_CONFIG__ ? 'EXISTS' : 'MISSING')
      return false
    }

    if (APP_ID.includes('your_') || APP_ID.length < 10) {
      console.error('❌ Agora App ID appears to be a placeholder or invalid')
      console.log('App ID value:', APP_ID)
      return false
    }

    console.log('✅ Agora Configuration Validated')
    console.log('App ID:', `${APP_ID.substring(0, 8)}...${APP_ID.substring(APP_ID.length - 4)}`)
    console.log('Region:', this.config.REGION)
    console.log('Source:', this.getConfigSource())
    
    return true
  }

  getConfigSource() {
    if (typeof __AGORA_APP_ID__ !== 'undefined') return 'build-time'
    if (typeof import.meta !== 'undefined' && import.meta.env.VITE_AGORA_APP_ID) return 'vite-env'
    if (typeof window !== 'undefined' && window.__AGORA_CONFIG__) return 'window-global'
    return 'unknown'
  }

  getConfig() {
    return this.config
  }
}

// Initialize configuration
const configManager = new AgoraConfigManager()
const AGORA_CONFIG = configManager.getConfig()

// ==================== VIDEO SERVICE ====================
class VideoServiceState {
  constructor() {
    this.agoraEngine = null
    this.localTracks = {
      audioTrack: null,
      videoTrack: null
    }
    this.remoteUsers = new Map()
    this.currentChannel = null
    this.isInitialized = false
    this.retryCount = 0
    this.eventCallbacks = {
      onUserJoined: [],
      onUserLeft: [],
      onUserPublished: [],
      onUserUnpublished: [],
      onConnectionStateChange: [],
      onError: []
    }
  }

  reset() {
    this.agoraEngine = null
    this.localTracks.audioTrack = null
    this.localTracks.videoTrack = null
    this.remoteUsers.clear()
    this.currentChannel = null
    this.isInitialized = false
    this.retryCount = 0
  }
}

class ProductionVideoService {
  constructor() {
    this.state = new VideoServiceState()
    this.isCleaningUp = false
    this.config = AGORA_CONFIG
  }

  // ==================== ENHANCED VALIDATION ====================
  validateEnvironment() {
    const { APP_ID } = this.config

    // Check Agora SDK
    if (typeof AgoraRTC === 'undefined') {
      throw new Error('AGORA_SDK_UNAVAILABLE: Agora RTC SDK not loaded properly')
    }

    // Enhanced App ID validation
    if (!APP_ID) {
      const helpText = this.getEnvironmentHelpText()
      throw new Error(`AGORA_APP_ID_MISSING: ${helpText}`)
    }

    if (APP_ID.includes('your_') || APP_ID.length < 10) {
      throw new Error('AGORA_APP_ID_INVALID: App ID is either a placeholder or too short. Must be a valid 32-character Agora App ID.')
    }

    // Check for common App ID format issues
    if (APP_ID.includes(' ')) {
      throw new Error('AGORA_APP_ID_INVALID: App ID contains spaces. Please remove any spaces from your App ID.')
    }

    if (APP_ID.includes('#')) {
      throw new Error('AGORA_APP_ID_INVALID: App ID contains invalid characters. App ID should be a hex string without special characters.')
    }

    // Browser support
    if (!this.checkBrowserSupport()) {
      throw new Error('BROWSER_NOT_SUPPORTED: WebRTC not supported in this browser')
    }

    return APP_ID
  }

  getEnvironmentHelpText() {
    const source = configManager.getConfigSource()
    
    switch(source) {
      case 'build-time':
        return 'App ID was not provided at build time. Check your VITE_AGORA_APP_ID in .env.production file.'
      case 'vite-env':
        return 'VITE_AGORA_APP_ID environment variable is not set. Create a .env.production file with your App ID.'
      case 'window-global':
        return 'Window global configuration is missing. Check your runtime configuration script.'
      default:
        return 'Agora App ID is not configured through any available method.'
    }
  }

  checkBrowserSupport() {
    return AgoraRTC.checkSystemRequirements() && 
           navigator.mediaDevices && 
           navigator.mediaDevices.getUserMedia
  }

  // ==================== ENHANCED ERROR HANDLING ====================
  enhanceError(error, context = '') {
    const errorMap = {
      'CAN_NOT_GET_GATEWAY_SERVER': {
        code: 'INVALID_APP_ID',
        message: 'Cannot connect to Agora servers. The App ID is invalid, expired, or does not exist.',
        userMessage: 'Video service configuration error. Please check your App ID configuration.',
        recoverable: false,
        immediateAction: 'CHECK_APP_ID'
      },
      'INVALID_VENDOR_KEY': {
        code: 'INVALID_APP_ID',
        message: 'The provided App ID is not recognized by Agora servers.',
        userMessage: 'Invalid video service configuration. Please verify your App ID.',
        recoverable: false,
        immediateAction: 'CHECK_APP_ID'
      },
      'INVALID_APP_ID': {
        code: 'INVALID_APP_ID',
        message: 'App ID format is incorrect or missing.',
        userMessage: 'Video service is not properly configured. Please contact support.',
        recoverable: false,
        immediateAction: 'CHECK_APP_ID'
      },
      'JOIN_TIMEOUT': {
        code: 'NETWORK_ERROR',
        message: 'Connection to video service timed out.',
        userMessage: 'Connection timeout. Please check your internet connection.',
        recoverable: true,
        immediateAction: 'RETRY'
      }
    }

    const errorMessage = error.message || error.toString()
    let matchedError = null

    // Enhanced error matching
    for (const [key, enhanced] of Object.entries(errorMap)) {
      if (errorMessage.includes(key) || errorMessage.toLowerCase().includes(key.toLowerCase())) {
        matchedError = { ...enhanced, originalError: errorMessage }
        break
      }
    }

    // Default error with enhanced diagnostics
    if (!matchedError) {
      matchedError = {
        code: 'UNKNOWN_ERROR',
        message: `Video service error: ${errorMessage}`,
        userMessage: 'Video service encountered an unexpected error.',
        recoverable: true,
        immediateAction: 'RETRY',
        originalError: errorMessage
      }
    }

    // Add diagnostic information
    matchedError.diagnostics = {
      context,
      environment: typeof import.meta !== 'undefined' ? import.meta.env.MODE : 'unknown',
      appIdConfigured: !!this.config.APP_ID && !this.config.APP_ID.includes('your_'),
      appIdLength: this.config.APP_ID?.length || 0,
      configSource: configManager.getConfigSource(),
      timestamp: new Date().toISOString()
    }

    return matchedError
  }

  emitEvent(eventName, data) {
    if (this.state.eventCallbacks[eventName]) {
      this.state.eventCallbacks[eventName].forEach(callback => {
        try {
          callback(data)
        } catch (callbackError) {
          console.error(`Event callback error (${eventName}):`, callbackError)
        }
      })
    }
  }

  // ==================== AGORA ENGINE MANAGEMENT ====================
  async initializeAgoraEngine() {
    if (this.state.agoraEngine) {
      return this.state.agoraEngine
    }

    try {
      this.state.agoraEngine = AgoraRTC.createClient({
        mode: "rtc",
        codec: "vp8"
      })

      this.setupAgoraEventListeners()
      return this.state.agoraEngine
    } catch (error) {
      this.state.agoraEngine = null
      throw this.enhanceError(error, 'initialize-engine')
    }
  }

  setupAgoraEventListeners() {
    if (!this.state.agoraEngine) return

    this.state.agoraEngine.on("user-published", async (user, mediaType) => {
      try {
        await this.state.agoraEngine.subscribe(user, mediaType)

        const userData = this.state.remoteUsers.get(user.uid) || {
          uid: user.uid,
          joinedAt: new Date(),
          hasVideo: false,
          hasAudio: false
        }

        if (mediaType === "video") {
          userData.videoTrack = user.videoTrack
          userData.hasVideo = true
        }

        if (mediaType === "audio") {
          userData.audioTrack = user.audioTrack
          userData.hasAudio = true
          user.audioTrack.play().catch(err => 
            console.warn(`Audio play failed for user ${user.uid}:`, err)
          )
        }

        this.state.remoteUsers.set(user.uid, userData)
        this.emitEvent('onUserPublished', { user: userData, mediaType })

      } catch (error) {
        console.error(`User published error (${user.uid}):`, error)
        this.emitEvent('onError', this.enhanceError(error, 'user-published'))
      }
    })

    this.state.agoraEngine.on("user-unpublished", (user, mediaType) => {
      const userData = this.state.remoteUsers.get(user.uid)
      if (userData) {
        if (mediaType === "video") {
          userData.videoTrack = null
          userData.hasVideo = false
        }
        if (mediaType === "audio") {
          userData.audioTrack = null
          userData.hasAudio = false
        }
        this.state.remoteUsers.set(user.uid, userData)
        this.emitEvent('onUserUnpublished', { user: userData, mediaType })
      }
    })

    this.state.agoraEngine.on("user-joined", (user) => {
      this.state.remoteUsers.set(user.uid, {
        uid: user.uid,
        joinedAt: new Date(),
        hasVideo: false,
        hasAudio: false
      })
      this.emitEvent('onUserJoined', { uid: user.uid })
    })

    this.state.agoraEngine.on("user-left", (user) => {
      this.state.remoteUsers.delete(user.uid)
      this.emitEvent('onUserLeft', { uid: user.uid })
    })

    this.state.agoraEngine.on("connection-state-change", (curState, prevState) => {
      this.emitEvent('onConnectionStateChange', {
        previous: prevState,
        current: curState,
        timestamp: new Date().toISOString()
      })
    })
  }

  // ==================== CORE VIDEO OPERATIONS ====================
  async startVideoSession(classId, userId, options = {}) {
    if (this.isCleaningUp) {
      throw this.enhanceError(new Error('Service is cleaning up'), 'start-session')
    }

    try {
      console.group('🚀 Starting Video Session')

      // 1. Enhanced environment validation
      const appId = this.validateEnvironment()
      console.log('✅ Environment validated')

      // 2. Generate channel name
      const channelName = options.channelName || `class-${classId}-${Date.now()}`
      console.log('📞 Channel:', channelName)

      // 3. Initialize engine
      await this.initializeAgoraEngine()
      console.log('✅ Engine initialized')

      // 4. Join channel with enhanced retry logic
      await this.joinChannelWithRetry(appId, channelName, null, userId)
      console.log('✅ Channel joined')

      // 5. Create and publish local tracks
      const trackResult = await this.createAndPublishLocalTracks(options)
      console.log('✅ Local tracks published')

      this.state.isInitialized = true
      this.state.currentChannel = channelName

      console.groupEnd()

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
        environment: typeof import.meta !== 'undefined' ? import.meta.env.MODE : 'unknown'
      }

    } catch (error) {
      console.groupEnd()
      console.error('💥 Failed to start video session:', error)

      await this.safeCleanup()
      throw this.enhanceError(error, 'start-session')
    }
  }

  async joinChannelWithRetry(appId, channelName, token, uid, attempt = 1) {
    try {
      console.log(`🔄 Join attempt ${attempt}/${this.config.MAX_RETRY_ATTEMPTS + 1}`)

      const joinPromise = this.state.agoraEngine.join(
        appId,
        channelName,
        token,
        uid,
        this.config.REGION ? { region: this.config.REGION } : undefined
      )

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('JOIN_TIMEOUT')), this.config.JOIN_TIMEOUT)
      })

      await Promise.race([joinPromise, timeoutPromise])
      console.log('✅ Channel joined successfully')
      return { success: true }

    } catch (error) {
      if (attempt <= this.config.MAX_RETRY_ATTEMPTS) {
        console.warn(`Join attempt ${attempt} failed, retrying...:`, error.message)
        await new Promise(resolve => setTimeout(resolve, this.config.RETRY_DELAY * attempt))
        return this.joinChannelWithRetry(appId, channelName, token, uid, attempt + 1)
      }
      
      // Enhanced error for join failures
      const enhancedError = this.enhanceError(error, 'join-channel')
      if (enhancedError.immediateAction === 'CHECK_APP_ID') {
        console.error('🔴 CRITICAL: App ID validation failed. Please check:')
        console.error('   1. App ID exists in Agora Console')
        console.error('   2. App ID is correct (32-character hex)')
        console.error('   3. No typos or extra characters')
        console.error('   4. App ID matches the region')
      }
      
      throw enhancedError
    }
  }

  async createAndPublishLocalTracks(options = {}) {
    const result = { audioTrack: null, videoTrack: null }

    try {
      if (options.audio !== false) {
        try {
          result.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true
          })
        } catch (audioError) {
          console.warn('Microphone access failed:', audioError.message)
        }
      }

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
          })
        } catch (videoError) {
          console.warn('Camera access failed:', videoError.message)
        }
      }

      const tracksToPublish = []
      if (result.audioTrack) tracksToPublish.push(result.audioTrack)
      if (result.videoTrack) tracksToPublish.push(result.videoTrack)

      if (tracksToPublish.length > 0) {
        await this.state.agoraEngine.publish(tracksToPublish)
      }

      this.state.localTracks.audioTrack = result.audioTrack
      this.state.localTracks.videoTrack = result.videoTrack

      return result

    } catch (error) {
      if (result.audioTrack) {
        result.audioTrack.close()
        result.audioTrack = null
      }
      if (result.videoTrack) {
        result.videoTrack.close()
        result.videoTrack = null
      }
      throw error
    }
  }

  // ==================== SESSION MANAGEMENT ====================
  async leaveVideoSession() {
    if (this.isCleaningUp) return { success: true }

    this.isCleaningUp = true

    try {
      console.group('🛑 Leaving Video Session')

      if (this.state.localTracks.audioTrack) {
        this.state.localTracks.audioTrack.stop()
        this.state.localTracks.audioTrack.close()
        this.state.localTracks.audioTrack = null
      }

      if (this.state.localTracks.videoTrack) {
        this.state.localTracks.videoTrack.stop()
        this.state.localTracks.videoTrack.close()
        this.state.localTracks.videoTrack = null
      }

      if (this.state.agoraEngine && this.state.currentChannel) {
        await this.state.agoraEngine.leave()
      }

      this.state.reset()

      console.log('✅ Left video session successfully')
      console.groupEnd()

      return { success: true }

    } catch (error) {
      console.error('Error during session cleanup:', error)
      this.state.reset()
      return { success: false, error: error.message }
    } finally {
      this.isCleaningUp = false
    }
  }

  async safeCleanup() {
    try {
      await this.leaveVideoSession()
    } catch (error) {
      console.error('Safe cleanup error:', error)
      this.state.reset()
    }
  }

  // ==================== QUERY METHODS ====================
  getRemoteUsers() {
    return Array.from(this.state.remoteUsers.values())
  }

  getServiceStatus() {
    return {
      initialized: this.state.isInitialized,
      currentChannel: this.state.currentChannel,
      hasAudio: !!this.state.localTracks.audioTrack,
      hasVideo: !!this.state.localTracks.videoTrack,
      audioEnabled: this.state.localTracks.audioTrack?.enabled ?? false,
      videoEnabled: this.state.localTracks.videoTrack?.enabled ?? false,
      remoteUsers: this.state.remoteUsers.size,
      appId: this.config.APP_ID ? `${this.config.APP_ID.substring(0, 8)}...` : 'NOT_CONFIGURED',
      environment: typeof import.meta !== 'undefined' ? import.meta.env.MODE : 'unknown',
      configSource: configManager.getConfigSource()
    }
  }

  // ==================== EVENT MANAGEMENT ====================
  on(eventName, callback) {
    if (this.state.eventCallbacks[eventName]) {
      this.state.eventCallbacks[eventName].push(callback)
    }
  }

  off(eventName, callback) {
    if (this.state.eventCallbacks[eventName]) {
      this.state.eventCallbacks[eventName] = this.state.eventCallbacks[eventName].filter(cb => cb !== callback)
    }
  }

  removeAllListeners(eventName = null) {
    if (eventName) {
      this.state.eventCallbacks[eventName] = []
    } else {
      Object.keys(this.state.eventCallbacks).forEach(key => {
        this.state.eventCallbacks[key] = []
      })
    }
  }

  async destroy() {
    console.log('🧹 Destroying video service')
    this.removeAllListeners()
    await this.safeCleanup()
  }
}

// Create and export singleton instance
const videoService = new ProductionVideoService()

// Export for testing and advanced usage
export { ProductionVideoService, VideoServiceState, AgoraConfigManager }
export default videoService
