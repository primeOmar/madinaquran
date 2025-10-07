// lib/videoApi.js - REACT + EXPRESS PRODUCTION READY
import api from './api';

const BACKEND_URL = 'https://madina-quran-backend.onrender.com'; 
const AGORA_APP_ID = '5355da02bb0d48579214912e0d31193f';

const videoApi = {
  async generateAgoraToken(meetingId, userId) {
    try {
      console.log('🔐 Requesting token for:', { meetingId, userId });
      
      const apiBaseUrl = getApiBaseUrl();
      // Use relative path in production, full URL in development
      const endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/agora/generate-token`
        : '/api/agora/generate-token';
      
      console.log('🌐 Calling endpoint:', endpoint);
      console.log('�️ Environment:', process.env.NODE_ENV);
      console.log('🔧 API Base URL:', apiBaseUrl);

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
      const fallbackAppId = process.env.REACT_APP_AGORA_APP_ID;
      console.log('🔄 Using fallback App ID:', !!fallbackAppId);
      
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
      const endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/agora/end-session`
        : '/api/agora/end-session';
      
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
      const apiBaseUrl = getApiBaseUrl();
      const endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/agora/health`
        : '/api/agora/health';
      
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Video health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  },

  // Test connection
  async testConnection() {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/health`
        : '/api/health';
      
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
  }
};

export default videoApi;
