import AgoraRTC from 'agora-rtc-sdk-ng'

// ==================== ENHANCED CONFIGURATION ====================
class AgoraConfigManager {
  constructor() {
    this.config = this.loadConfig()
    this.validateConfig()
  }

  loadConfig() {
    const buildTimeAppId = typeof __AGORA_APP_ID__ !== 'undefined' ? __AGORA_APP_ID__ : ''
    const viteAppId = typeof import.meta !== 'undefined' ? import.meta.env.VITE_AGORA_APP_ID : ''
    const appId = buildTimeAppId || viteAppId || ''
    
    const buildTimeRegion = typeof __AGORA_REGION__ !== 'undefined' ? __AGORA_REGION__ : ''
    const viteRegion = typeof import.meta !== 'undefined' ? import.meta.env.VITE_AGORA_REGION : ''
    const region = buildTimeRegion || viteRegion || 'US'

    const useToken = typeof __AGORA_USE_TOKEN__ !== 'undefined' ? __AGORA_USE_TOKEN__ === 'true' : false
    const tokenServer = typeof __AGORA_TOKEN_SERVER__ !== 'undefined' ? __AGORA_TOKEN_SERVER__ : ''

    return {
      APP_ID: appId?.trim() || '',
      REGION: region?.trim(),
      USE_TOKEN: useToken,
      TOKEN_SERVER: tokenServer,
      TOKEN_EXPIRY: 3600,
      MAX_RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
      JOIN_TIMEOUT: 15000
    }
  }

  validateConfig() {
    const { APP_ID, USE_TOKEN, TOKEN_SERVER } = this.config
    
    if (!APP_ID) {
      console.error('❌ Agora App ID is missing')
      return false
    }

    if (APP_ID.includes('your_') || APP_ID.length < 10) {
      console.error('❌ Agora App ID is invalid')
      return false
    }

    if (USE_TOKEN && !TOKEN_SERVER) {
      console.error('❌ Token authentication enabled but no token server configured')
      return false
    }

    console.log('✅ Agora Configuration:')
    console.log('   App ID:', `${APP_ID.substring(0, 8)}...`)
    console.log('   Region:', this.config.REGION)
    console.log('   Token Auth:', USE_TOKEN ? 'ENABLED' : 'DISABLED')
    console.log('   Token Server:', TOKEN_SERVER || 'NONE')
    
    return true
  }

  getConfig() {
    return this.config
  }
}

const configManager = new AgoraConfigManager()
const AGORA_CONFIG = configManager.getConfig()

// ==================== TOKEN SERVICE ====================
class TokenService {
  constructor() {
    this.config = AGORA_CONFIG
  }

  async generateToken(channelName, userId) {
    if (!this.config.USE_TOKEN) {
      return null // No token required
    }

    try {
      const response = await fetch(`${this.config.TOKEN_SERVER}/rtc/${channelName}/1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName,
          userId: userId.toString(),
          appId: this.config.APP_ID,
          role: 'publisher' // or 'subscriber' for audience
        })
      })

      if (!response.ok) {
        throw new Error(`Token server responded with ${response.status}`)
      }

      const data = await response.json()
      return data.token
    } catch (error) {
      console.error('❌ Token generation failed:', error)
      throw new Error(`TOKEN_GENERATION_FAILED: ${error.message}`)
    }
  }

  async getTempToken(channelName, userId) {
    // For development/testing only - generates a temporary token
    // In production, always use a proper token server
    if (this.config.USE_TOKEN && !this.config.TOKEN_SERVER) {
      console.warn('⚠️ Using temporary token for development. Not for production!')
      // This would be a temporary token - in real scenario, use proper token server
      return 'temp_token_development_only'
    }
    return this.generateToken(channelName, userId)
  }
}

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
    this.tokenService = new TokenService()
  }

  // ==================== ENHANCED VALIDATION ====================
  validateEnvironment() {
    const { APP_ID, USE_TOKEN, TOKEN_SERVER } = this.config

    if (typeof AgoraRTC === 'undefined') {
      throw new Error('AGORA_SDK_UNAVAILABLE')
    }

    if (!APP_ID) {
      throw new Error('AGORA_APP_ID_MISSING')
    }

    if (APP_ID.includes('your_') || APP_ID.length < 10) {
      throw new Error('AGORA_APP_ID_INVALID')
    }

    // Enhanced token configuration validation
    if (USE_TOKEN) {
      if (!TOKEN_SERVER) {
        throw new Error('TOKEN_SERVER_MISSING: Token authentication enabled but no token server configured')
      }
      
      // Check if token server URL is valid
      try {
        new URL(TOKEN_SERVER)
      } catch (error) {
        throw new Error('TOKEN_SERVER_INVALID: Token server URL is not valid')
      }
    }

    if (!this.checkBrowserSupport()) {
      throw new Error('BROWSER_NOT_SUPPORTED')
    }

    return APP_ID
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
        code: 'AUTH_CONFIG_MISMATCH',
        message: 'Authentication configuration mismatch. Your Agora project requires token authentication but none was provided.',
        userMessage: 'Video service authentication error. Please try again.',
        recoverable: false,
        immediateAction: 'ENABLE_TOKEN_AUTH'
      },
      'dynamic use static key': {
        code: 'TOKEN_REQUIRED',
        message: 'Your Agora project is configured for token authentication. You must provide a token to join the channel.',
        userMessage: 'Video service requires authentication. Please try again.',
        recoverable: false,
        immediateAction: 'ENABLE_TOKEN_AUTH'
      },
      'INVALID_VENDOR_KEY': {
        code: 'INVALID_APP_ID',
        message: 'The provided App ID is not recognized by Agora servers.',
        userMessage: 'Video service configuration error.',
        recoverable: false
      },
      'TOKEN_GENERATION_FAILED': {
        code: 'TOKEN_ERROR',
        message: 'Failed to generate authentication token.',
        userMessage: 'Authentication service temporarily unavailable.',
        recoverable: true
      },
      'TOKEN_SERVER_MISSING': {
        code: 'CONFIG_ERROR',
        message: 'Token authentication enabled but no token server configured.',
        userMessage: 'Service configuration error.',
        recoverable: false
      }
    }

    const errorMessage = error.message || error.toString()
    let matchedError = null

    for (const [key, enhanced] of Object.entries(errorMap)) {
      if (errorMessage.includes(key) || errorMessage.toLowerCase().includes(key.toLowerCase())) {
        matchedError = { ...enhanced, originalError: errorMessage }
        break
      }
    }

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

    matchedError.diagnostics = {
      context,
      environment: typeof import.meta !== 'undefined' ? import.meta.env.MODE : 'unknown',
      appIdConfigured: !!this.config.APP_ID,
      tokenAuth: this.config.USE_TOKEN,
      tokenServer: !!this.config.TOKEN_SERVER,
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
          console.error(`Event callback error:`, callbackError)
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
            console.warn(`Audio play failed:`, err)
          )
        }

        this.state.remoteUsers.set(user.uid, userData)
        this.emitEvent('onUserPublished', { user: userData, mediaType })

      } catch (error) {
        console.error('User published error:', error)
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

      // 3. Generate token if required
      let token = null
      if (this.config.USE_TOKEN) {
        console.log('🔑 Generating token...')
        token = await this.tokenService.getTempToken(channelName, userId)
        console.log('✅ Token generated')
      } else {
        console.log('🔓 Using App ID only mode')
      }

      // 4. Initialize engine
      await this.initializeAgoraEngine()
      console.log('✅ Engine initialized')

      // 5. Join channel with token support
      await this.joinChannelWithRetry(appId, channelName, token, userId)
      console.log('✅ Channel joined')

      // 6. Create and publish local tracks
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
        usesToken: !!this.config.USE_TOKEN,
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
      if (token) {
        console.log('   Using token authentication')
      } else {
        console.log('   Using App ID only')
      }

      const joinPromise = this.state.agoraEngine.join(
        appId,
        channelName,
        token, // This can be null for App ID only mode
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
        console.warn(`Join attempt ${attempt} failed:`, error.message)
        await new Promise(resolve => setTimeout(resolve, this.config.RETRY_DELAY * attempt))
        return this.joinChannelWithRetry(appId, channelName, token, uid, attempt + 1)
      }
      
      const enhancedError = this.enhanceError(error, 'join-channel')
      
      if (enhancedError.immediateAction === 'ENABLE_TOKEN_AUTH') {
        console.error('🔴 CRITICAL: Token authentication required but not configured!')
        console.error('   Your Agora project requires token authentication.')
        console.error('   Solution: Enable VITE_AGORA_USE_TOKEN=true and configure VITE_AGORA_TOKEN_SERVER')
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
      usesToken: this.config.USE_TOKEN,
      tokenServer: this.config.TOKEN_SERVER || 'NOT_CONFIGURED',
      environment: typeof import.meta !== 'undefined' ? import.meta.env.MODE : 'unknown'
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
export { ProductionVideoService, VideoServiceState, AgoraConfigManager, TokenService }
export default videoService
