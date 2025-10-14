// lib/videoService.js - PRODUCTION FIXED VERSION
import AgoraRTC from 'agora-rtc-sdk-ng';

const AGORA_APP_ID = '5c0225ce9a19445f95a2685647258468';

// ✅ Global Agora engine instance
let agoraEngine = null;
let isInitialized = false;

// ✅ Rate limiting
const RATE_LIMIT = {
  maxAttempts: 3,
  attempts: new Map(),
  timeWindow: 60000, // 1 minute
};

function checkRateLimit(operation, identifier) {
  const key = `${operation}_${identifier}`;
  const now = Date.now();
  const attempt = RATE_LIMIT.attempts.get(key);
  
  if (attempt && (now - attempt.timestamp < RATE_LIMIT.timeWindow)) {
    if (attempt.count >= RATE_LIMIT.maxAttempts) {
      throw new Error(`RATE_LIMIT_EXCEEDED: Too many ${operation} attempts`);
    }
    attempt.count++;
  } else {
    RATE_LIMIT.attempts.set(key, { count: 1, timestamp: now });
  }
}

// ✅ Validate App ID
function validateAppId() {
  if (!AGORA_APP_ID || AGORA_APP_ID.length !== 32) {
    throw new Error('VIDEO_SERVICE_UNAVAILABLE: Invalid Agora configuration');
  }
  return AGORA_APP_ID;
}

// ✅ Initialize Agora Engine (Singleton)
function initializeAgoraEngine() {
  if (!agoraEngine) {
    agoraEngine = AgoraRTC.createClient({ 
      mode: "rtc", 
      codec: "vp8" 
    });
    isInitialized = true;
    console.log('✅ Agora engine initialized');
  }
  return agoraEngine;
}

// ✅ Clean channel name
function cleanChannelName(name) {
  if (!name) throw new Error('CHANNEL_NAME_REQUIRED');
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}

const videoApi = {
  /**
   * PRODUCTION: Start and join video session
   */
  async startVideoSession(classId, userId) {
    try {
      // ✅ Rate limiting
      checkRateLimit('start_session', classId);
      
      // ✅ Validate inputs
      if (!classId || !userId) {
        throw new Error('CLASS_ID_AND_USER_ID_REQUIRED');
      }

      // ✅ Validate App ID
      const appId = validateAppId();
      
      // ✅ Generate meeting ID
      const meetingId = `class_${classId}_${Date.now()}`;
      const channel = cleanChannelName(meetingId);
      
      console.log('🚀 Starting video session:', { 
        classId, 
        channel, 
        userId,
        appId: '***' + appId.slice(-4) 
      });

      // ✅ Initialize Agora engine
      const engine = initializeAgoraEngine();
      
      // ✅ JOIN THE CHANNEL with proper error handling
      try {
        await engine.join(appId, channel, null, userId);
        console.log('✅ Successfully joined Agora channel:', channel);
      } catch (joinError) {
        console.error('❌ Agora join failed:', joinError);
        throw new Error(`AGORA_JOIN_FAILED: ${joinError.message}`);
      }

      return {
        success: true,
        meetingId: meetingId,
        appId: appId,
        channel: channel,
        uid: userId.toString(),
        engine: engine
      };
      
    } catch (error) {
      console.error('❌ Video session start failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        errorType: error.message.includes('RATE_LIMIT') ? 'rate_limit' : 
                  error.message.includes('AGORA_JOIN_FAILED') ? 'agora_error' : 'validation'
      };
    }
  },

  /**
   * PRODUCTION: Join existing video session
   */
  async joinVideoSession(meetingId, userId) {
    try {
      // ✅ Rate limiting
      checkRateLimit('join_session', `${meetingId}_${userId}`);
      
      // ✅ Validate inputs
      if (!meetingId || !userId) {
        throw new Error('MEETING_ID_AND_USER_ID_REQUIRED');
      }

      // ✅ Validate App ID
      const appId = validateAppId();
      const channel = cleanChannelName(meetingId);
      
      console.log('🎯 Joining video session:', { 
        meetingId, 
        channel, 
        userId,
        appId: '***' + appId.slice(-4)
      });

      // ✅ Initialize Agora engine
      const engine = initializeAgoraEngine();
      
      // ✅ JOIN THE CHANNEL
      try {
        await engine.join(appId, channel, null, userId);
        console.log('✅ Successfully joined existing channel:', channel);
      } catch (joinError) {
        console.error('❌ Agora join failed:', joinError);
        throw new Error(`AGORA_JOIN_FAILED: ${joinError.message}`);
      }

      return {
        success: true,
        meetingId: meetingId,
        appId: appId,
        channel: channel,
        uid: userId.toString(),
        engine: engine
      };
      
    } catch (error) {
      console.error('❌ Join session failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        errorType: error.message.includes('RATE_LIMIT') ? 'rate_limit' : 'agora_error'
      };
    }
  },

  /**
   * PRODUCTION: Leave video session
   */
  async leaveVideoSession() {
    try {
      if (agoraEngine) {
        await agoraEngine.leave();
        console.log('✅ Left Agora channel');
        
        // Clean up local tracks if any
        if (this.localTracks) {
          this.localTracks.forEach(track => track.close());
          this.localTracks = [];
        }
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Leave session failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * PRODUCTION: Get Agora engine instance
   */
  getAgoraEngine() {
    return agoraEngine;
  },

  /**
   * PRODUCTION: Check if Agora is initialized
   */
  isAgoraInitialized() {
    return isInitialized;
  },

  /**
   * PRODUCTION: Health check
   */
  async checkHealth() {
    try {
      const appId = validateAppId();
      return {
        status: 'healthy',
        agoraInitialized: isInitialized,
        appId: '***' + appId.slice(-4),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};

export default videoApi;
