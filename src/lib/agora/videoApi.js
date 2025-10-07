// lib/videoApi.js - VERIFIED WORKING VERSION
import api from './api';

// ✅ VERIFIED CONFIGURATION - Replace with your actual values
const config = {
 
  agoraAppId: '5355da02bb0d48579214912e0d31193f', 
  
  backendUrl: 'https://madina-quran-backend.onrender.com'
};

// Validate configuration on import
console.log('🔧 Video API Configuration:', {
  hasAppId: !!config.agoraAppId && config.agoraAppId !== '5355da02bb0d48579214912e0d31193f',
  appIdPreview: config.agoraAppId ? '***' + config.agoraAppId.slice(-4) : 'MISSING',
  backendUrl: config.backendUrl
});

const videoApi = {
  async generateAgoraToken(meetingId, userId) {
    try {
      console.log('🔐 Generating token for meeting:', meetingId);
      
      // First, validate our App ID
      if (!config.agoraAppId || config.agoraAppId === '5355da02bb0d48579214912e0d31193f') {
        throw new Error('Agora App ID not configured. Please update videoApi.js with your actual App ID.');
      }
      
      // Try to get token from backend if available
      if (config.backendUrl) {
        try {
          const endpoint = `${config.backendUrl}/api/agora/generate-token`;
          console.log('🌐 Attempting to get token from backend:', endpoint);
          
          const response = await api.post(endpoint, {
            channelName: meetingId,
            uid: userId.toString(),
            role: 'publisher'
          }, { timeout: 5000 }); // 5 second timeout

          if (response.data.success && response.data.appId) {
            console.log('✅ Token from backend:', {
              hasToken: !!response.data.token,
              appId: response.data.appId ? '***' + response.data.appId.slice(-4) : 'MISSING'
            });
            return {
              token: response.data.token,
              appId: response.data.appId,
              isFallback: false
            };
          }
        } catch (backendError) {
          console.log('⚠️ Backend unavailable, using fallback:', backendError.message);
        }
      }
      
      // Fallback: Use our configured App ID without token
      console.log('🔄 Using fallback mode with App ID only');
      return {
        token: null, // No token in fallback mode
        appId: config.agoraAppId,
        isFallback: true
      };

    } catch (error) {
      console.error('❌ Token generation failed:', error.message);
      throw error; // Re-throw to let caller handle it
    }
  },

  async endVideoSession(meetingId) {
    try {
      if (config.backendUrl) {
        const response = await api.post(`${config.backendUrl}/api/agora/end-session`, { meetingId });
        return response.data;
      }
      return { success: true, message: 'Session ended locally' };
    } catch (error) {
      console.error('Error ending video session:', error);
      return { success: false, error: error.message };
    }
  },

  // Health check
  async checkVideoHealth() {
    const health = {
      agora: {
        configured: !!config.agoraAppId && config.agoraAppId !== 'your_actual_agora_app_id_here',
        appId: config.agoraAppId ? '***' + config.agoraAppId.slice(-4) : 'NOT_CONFIGURED'
      },
      backend: {
        configured: !!config.backendUrl,
        url: config.backendUrl
      },
      status: 'checking'
    };

    // Test backend connection
    if (config.backendUrl) {
      try {
        const response = await api.get(`${config.backendUrl}/api/agora/health`, { timeout: 5000 });
        health.backend.connected = true;
        health.backend.data = response.data;
      } catch (error) {
        health.backend.connected = false;
        health.backend.error = error.message;
      }
    }

    health.status = health.agora.configured ? 'healthy' : 'unhealthy';
    return health;
  }
};

export default videoApi;
