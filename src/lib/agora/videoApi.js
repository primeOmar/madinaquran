// lib/videoApi.js - DEBUG FOCUSED
import api from './api';

// Configuration with detailed debugging
const config = {
  // Your Agora App ID - let's verify this is correct
  agoraAppId: '5c0225ce9a19445f95a2685647258468',
  backendUrl: 'https://madina-quran-backend.onrender.com'
};

console.log('🔍 DEBUG: Video API Configuration Analysis', {
  appId: config.agoraAppId,
  appIdLength: config.agoraAppId?.length,
  appIdType: typeof config.agoraAppId,
  appIdValid: config.agoraAppId && config.agoraAppId.length > 10,
  backendUrl: config.backendUrl
});

// Test the App ID format
function validateAgoraAppId(appId) {
  console.log('🔍 Validating Agora App ID:', {
    input: appId,
    length: appId?.length,
    isString: typeof appId === 'string',
    hasSpaces: appId?.includes(' '),
    hasQuotes: appId?.includes('"') || appId?.includes("'"),
    startsWithNumber: /^\d/.test(appId),
    isValidFormat: /^[a-f0-9]{32}$/i.test(appId)
  });

  if (!appId) {
    throw new Error('App ID is empty');
  }
  
  if (typeof appId !== 'string') {
    throw new Error('App ID is not a string');
  }
  
  if (appId.length !== 32) {
    throw new Error(`App ID should be 32 characters, got ${appId.length}`);
  }
  
  if (!/^[a-f0-9]{32}$/i.test(appId)) {
    throw new Error('App ID should be 32-character hexadecimal string');
  }
  
  return true;
}

const videoApi = {
  async generateAgoraToken(meetingId, userId) {
    try {
      console.log('🎯 DEBUG: Starting token generation', {
        meetingId,
        userId,
        appId: config.agoraAppId ? '***' + config.agoraAppId.slice(-4) : 'MISSING'
      });

      // Validate App ID thoroughly
      try {
        validateAgoraAppId(config.agoraAppId);
        console.log('✅ App ID validation passed');
      } catch (validationError) {
        console.error('❌ App ID validation failed:', validationError.message);
        throw new Error(`Invalid Agora App ID: ${validationError.message}`);
      }

      // Test backend connection
      let backendToken = null;
      if (config.backendUrl) {
        try {
          console.log('🌐 Testing backend connection...');
          const response = await api.post(
            `${config.backendUrl}/api/agora/generate-token`,
            {
              channelName: meetingId,
              uid: userId.toString(),
              role: 'publisher'
            },
            { timeout: 5000 }
          );

          console.log('📡 Backend response:', {
            status: response.status,
            success: response.data?.success,
            hasToken: !!response.data?.token,
            hasAppId: !!response.data?.appId
          });

          if (response.data?.success && response.data?.appId) {
            backendToken = {
              token: response.data.token,
              appId: response.data.appId,
              isFallback: false
            };
          }
        } catch (backendError) {
          console.log('⚠️ Backend test failed:', backendError.message);
        }
      }

      // Use backend token or fallback
      const tokenData = backendToken || {
        token: null,
        appId: config.agoraAppId,
        isFallback: true
      };

      console.log('🎯 FINAL Token Data:', {
        mode: tokenData.isFallback ? 'Testing Mode' : 'Secure Mode',
        appId: tokenData.appId ? '***' + tokenData.appId.slice(-4) : 'MISSING',
        appIdLength: tokenData.appId?.length,
        hasToken: !!tokenData.token
      });

      return tokenData;

    } catch (error) {
      console.error('💥 CRITICAL: Token generation failed:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  },

  async endVideoSession(meetingId) {
    return { success: true };
  },

  // Comprehensive health check
  async checkVideoHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      agora: {
        appId: config.agoraAppId ? '***' + config.agoraAppId.slice(-4) : 'MISSING',
        appIdLength: config.agoraAppId?.length,
        validation: 'pending'
      },
      backend: {
        url: config.backendUrl,
        status: 'pending'
      },
      status: 'checking'
    };

    // Test Agora App ID
    try {
      validateAgoraAppId(config.agoraAppId);
      health.agora.validation = 'valid';
    } catch (error) {
      health.agora.validation = `invalid: ${error.message}`;
      health.status = 'unhealthy';
    }

    // Test backend
    if (config.backendUrl) {
      try {
        const response = await api.get(`${config.backendUrl}/api/agora/health`, { timeout: 5000 });
        health.backend.status = 'connected';
        health.backend.data = response.data;
      } catch (error) {
        health.backend.status = `disconnected: ${error.message}`;
      }
    }

    if (health.agora.validation === 'valid') {
      health.status = 'healthy';
    }

    console.log('🏥 Comprehensive Health Check:', health);
    return health;
  },

  // Test Agora SDK directly
  async testAgoraSDK() {
    try {
      console.log('🧪 Testing Agora SDK directly...');
      
      // Dynamically import Agora SDK
      const AgoraRTC = await import('agora-rtc-sdk-ng');
      console.log('✅ Agora SDK loaded successfully');

      // Create client with App ID
      const client = AgoraRTC.default.createClient({ 
        mode: 'rtc', 
        codec: 'h264' 
      });
      console.log('✅ Agora client created');

      // Test if we can initialize with App ID
      console.log('🔧 Testing App ID:', config.agoraAppId ? '***' + config.agoraAppId.slice(-4) : 'MISSING');
      
      // This will throw if App ID is invalid
      await client.join(
        config.agoraAppId,
        'test-channel',
        null, // token
        'test-user'
      );

      return { success: true, message: 'Agora SDK test passed' };
    } catch (error) {
      console.error('❌ Agora SDK test failed:', error);
      return { 
        success: false, 
        error: error.message,
        details: 'This indicates your App ID is invalid or there are network issues'
      };
    }
  }
};

export default videoApi;
