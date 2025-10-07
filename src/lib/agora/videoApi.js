// lib/videoApi.js - PRODUCTION READY
import api from '../api';

// Get API base URL - works in both development and production
const getApiBaseUrl = () => {
  // In browser environment (client-side)
  if (typeof window !== 'undefined') {
    // Use relative path for same-domain deployment, or full URL for separate backend
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  }
  // Server-side (if using Next.js API routes)
  return '';
};

const videoApi = {
  async generateAgoraToken(meetingId, userId) {
    try {
      console.log('🔐 Requesting token for:', { meetingId, userId });
      
      const apiBaseUrl = getApiBaseUrl();
      const endpoint = `${apiBaseUrl}/api/agora/generate-token`;
      
      console.log('🌐 Calling endpoint:', endpoint);

      const response = await api.post(endpoint, {
        channelName: meetingId,
        uid: userId.toString(),
        role: 'publisher'
      });

      console.log('✅ Token response:', {
        success: response.data.success,
        hasToken: !!response.data.token,
        hasAppId: !!response.data.appId,
        appId: response.data.appId ? '***' + response.data.appId.slice(-4) : 'MISSING',
        isFallback: response.data.isFallback
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
      console.error('❌ Token generation failed:', error);
      
      // Detailed error logging
      if (error.response) {
        // Server responded with error status
        console.error('🚨 Server error:', {
          status: error.response.status,
          data: error.response.data,
          url: error.response.config?.url
        });
      } else if (error.request) {
        // No response received
        console.error('🚨 No response from server:', error.request);
      } else {
        // Other errors
        console.error('🚨 Request setup error:', error.message);
      }
      
      // Fallback to frontend appId if available
      const fallbackAppId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      
      return {
        token: null,
        appId: fallbackAppId,
        isFallback: true,
        error: error.message
      };
    }
  },

  async endVideoSession(meetingId) {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await api.post(`${apiBaseUrl}/api/agora/end-session`, {
        meetingId
      });
      return response.data;
    } catch (error) {
      console.error('Error ending video session:', error);
      throw error;
    }
  },

  // Health check
  async checkVideoHealth() {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await api.get(`${apiBaseUrl}/api/agora/health`);
      return response.data;
    } catch (error) {
      console.error('Video health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
};

export default videoApi;
