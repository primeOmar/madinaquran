import api from './api';


const config = {

  backendUrl: 'https://madina-quran-backend.onrender.com',

  agoraAppId: '5355da02bb0d48579214912e0d31193f' 
};

console.log('🔧 Video API Config:', {
  backendUrl: config.backendUrl,
  hasAppId: !!config.agoraAppId,
  environment: process.env.NODE_ENV
});

const videoApi = {
  async generateAgoraToken(meetingId, userId) {
    try {
      console.log('🔐 Requesting token for:', { meetingId, userId });
      
      // Use the hardcoded backend URL
      const endpoint = `${config.backendUrl}/api/agora/generate-token`;
      console.log('🌐 Calling backend endpoint:', endpoint);

      const response = await api.post(endpoint, {
        channelName: meetingId,
        uid: userId.toString(),
        role: 'publisher'
      });

      console.log('✅ Backend response received:', {
        success: response.data.success,
        hasToken: !!response.data.token,
        hasAppId: !!response.data.appId,
        appId: response.data.appId ? '***' + response.data.appId.slice(-4) : 'MISSING'
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to generate token');
      }

      if (!response.data.appId) {
        console.error('❌ Backend returned empty appId');
        throw new Error('Agora App ID not provided by server');
      }

      return {
        token: response.data.token,
        appId: response.data.appId,
        isFallback: response.data.isFallback || false
      };

    } catch (error) {
      console.error('❌ Token generation failed:', error.message);
      
      // Always fallback to our hardcoded Agora App ID
      console.log('🔄 Falling back to configured Agora App ID');
      
      if (!config.agoraAppId || config.agoraAppId === 'your_actual_agora_app_id_here') {
        console.error('❌ CRITICAL: No Agora App ID configured!');
        throw new Error('Agora service not configured. Please contact support.');
      }
      
      return {
        token: null,
        appId: config.agoraAppId,
        isFallback: true,
        error: error.message
      };
    }
  },

  async endVideoSession(meetingId) {
    try {
      const endpoint = `${config.backendUrl}/api/agora/end-session`;
      const response = await api.post(endpoint, { meetingId });
      return response.data;
    } catch (error) {
      console.error('Error ending video session:', error);
      throw error;
    }
  },

  // Health check
  async checkVideoHealth() {
    try {
      const endpoint = `${config.backendUrl}/api/agora/health`;
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Video health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  },

  // Test backend connection
  async testBackendConnection() {
    try {
      const response = await api.get(`${config.backendUrl}/api/health`);
      return {
        connected: true,
        data: response.data
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
};

// Test connection on import in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  videoApi.testBackendConnection().then(result => {
    console.log('🔗 Backend Connection Test:', result);
  });
}

export default videoApi;
