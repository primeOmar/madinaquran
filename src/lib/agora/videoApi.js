// lib/videoApi.js - PRODUCTION READY (FIXED VERSION)
import api from './api';

// ✅ CRITICAL: Ensure App ID is properly defined
const AGORA_APP_ID = '5c0225ce9a19445f95a2685647258468';
const BACKEND_URL = 'https://madina-quran-backend.onrender.com';

// Validate App ID format at startup
function validateAppId(appId) {
  if (!appId) {
    throw new Error('❌ CRITICAL: Agora App ID is undefined');
  }
  
  if (typeof appId !== 'string') {
    throw new Error(`❌ CRITICAL: App ID must be string, got ${typeof appId}`);
  }
  
  if (appId.length !== 32) {
    throw new Error(`❌ CRITICAL: App ID should be 32 chars, got ${appId.length}`);
  }
  
  if (!/^[a-f0-9]{32}$/i.test(appId)) {
    throw new Error('❌ CRITICAL: App ID must be 32-char hex string');
  }
  
  return true;
}

// Validate on load
try {
  validateAppId(AGORA_APP_ID);
  console.log('✅ Agora App ID validated:', '***' + AGORA_APP_ID.slice(-4));
} catch (error) {
  console.error(error.message);
  throw error; // Fail fast if App ID is invalid
}

const videoApi = {
  /**
   * Generate Agora token - tries backend first, falls back to client-only
   */
  async generateAgoraToken(meetingId, userId) {
    console.log('🎯 Token generation started:', { meetingId, userId });
    
    try {
      // Try backend first (with timeout)
      console.log('📡 Attempting backend token generation...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${BACKEND_URL}/api/agora/generate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: meetingId,
          uid: userId.toString(),
          role: 'publisher'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // ✅ CRITICAL: Debug raw response
      const responseText = await response.text();
      console.log('🔍 RAW BACKEND RESPONSE:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('📡 Parsed backend data:', data);
      } catch (parseError) {
        console.error('❌ Failed to parse backend response:', parseError);
        throw new Error('Invalid JSON response from server');
      }

      if (response.ok) {
        console.log('📡 Backend response:', {
          success: data.success,
          hasToken: !!data.token,
          hasAppId: !!data.appId,
          isFallback: data.isFallback
        });

        // ✅ CRITICAL: Always ensure appId is present - FIXED LOGIC
        if (data.success && data.token) {
          const finalAppId = data.appId || AGORA_APP_ID; // Fallback to frontend App ID
          
          try {
            validateAppId(finalAppId);
            console.log('✅ Using secure backend token with App ID:', '***' + finalAppId.slice(-4));
            return {
              appId: finalAppId,
              token: data.token,
              isFallback: false,
              mode: 'secure'
            };
          } catch (validationError) {
            console.error('❌ Backend returned invalid App ID:', validationError.message);
            // Fall through to fallback
          }
        }
      } else {
        throw new Error(`Backend returned ${response.status}: ${data?.message || 'Unknown error'}`);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⚠️ Backend timeout, using fallback');
      } else {
        console.warn('⚠️ Backend error:', error.message);
      }
    }

    // ✅ CRITICAL: Fallback MUST include appId - FIXED
    console.log('🔄 Using fallback mode with frontend App ID');
    return {
      appId: AGORA_APP_ID, // THIS WAS MISSING IN FALLBACK!
      token: null,
      isFallback: true,
      mode: 'testing'
    };
  },

  /**
   * Start a new video session
   */
  async startVideoSession(classId) {
    try {
      console.log('🚀 Starting video session for class:', classId);
      
      const response = await api.post('/api/video-sessions/start', {
        class_id: classId
      });
      
      console.log('✅ Video session started:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error starting video session:', error);
      throw new Error(error.response?.data?.message || 'Failed to start video session');
    }
  },

  /**
   * End video session
   */
  async endVideoSession(meetingId) {
    try {
      console.log('🛑 Ending video session:', meetingId);
      
      const response = await api.post('/api/video-sessions/end', { 
        meeting_id: meetingId 
      });
      
      console.log('✅ Session ended successfully');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Error ending session:', error);
      // Don't throw - allow graceful degradation
      return { success: false, error: error.message };
    }
  },

  /**
   * Notify students that class has ended
   */
  async notifyClassEnded(classId, sessionInfo) {
    try {
      console.log('📢 Notifying students class ended:', classId);
      
      await api.post('/api/classes/notify-ended', {
        class_id: classId,
        session_info: sessionInfo
      });
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error notifying students:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get active video sessions for a class
   */
  async getActiveSessions(classId) {
    try {
      const response = await api.get(`/api/video-sessions/active/${classId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }
  },

  /**
   * Validate meeting configuration before joining
   */
  async validateMeeting(meetingId, userId) {
    try {
      const tokenData = await this.generateAgoraToken(meetingId, userId);
      
      if (!tokenData.appId) {
        throw new Error('No App ID available for meeting');
      }
      
      return {
        valid: true,
        appId: tokenData.appId,
        hasToken: !!tokenData.token,
        isFallback: tokenData.isFallback
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  },

  /**
   * Health check - verify configuration
   */
  async checkHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      frontend: {
        appId: AGORA_APP_ID ? '***' + AGORA_APP_ID.slice(-4) : 'MISSING',
        appIdValid: false,
        appIdLength: AGORA_APP_ID?.length || 0
      },
      backend: {
        url: BACKEND_URL,
        status: 'checking'
      },
      tokenTest: {
        status: 'pending',
        appIdReceived: false
      }
    };

    // Check frontend App ID
    try {
      validateAppId(AGORA_APP_ID);
      health.frontend.appIdValid = true;
    } catch (error) {
      health.frontend.error = error.message;
    }

    // Check backend connectivity
    try {
      const response = await fetch(`${BACKEND_URL}/api/agora/health`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        health.backend.status = 'connected';
        health.backend.data = data;
      } else {
        health.backend.status = 'error';
        health.backend.statusCode = response.status;
      }
    } catch (error) {
      health.backend.status = 'disconnected';
      health.backend.error = error.message;
    }

    // Test token generation
    try {
      const testToken = await this.generateAgoraToken('test-meeting', 'test-user');
      health.tokenTest.status = 'success';
      health.tokenTest.appIdReceived = !!testToken.appId;
      health.tokenTest.isFallback = testToken.isFallback;
    } catch (error) {
      health.tokenTest.status = 'failed';
      health.tokenTest.error = error.message;
    }

    // Overall status
    health.status = (health.frontend.appIdValid && health.tokenTest.appIdReceived) ? 'healthy' : 'unhealthy';
    
    console.log('🏥 Health Check:', health);
    return health;
  },

  /**
   * Get the validated App ID
   */
  getAppId() {
    return AGORA_APP_ID;
  },

  /**
   * Emergency fallback for App ID issues
   */
  getEmergencyAppId() {
    return AGORA_APP_ID;
  }
};

// Export as default
export default videoApi;

// Also export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = videoApi;
}
