
const config = {
  agoraAppId: '5c0225ce9a19445f95a2685647258468'
};

const videoApi = {
  async generateAgoraToken(meetingId, userId) {
    console.log('🎯 Using Agora App ID:', '***' + config.agoraAppId.slice(-4));
    
    return {
      token: null, // Testing mode - no token
      appId: config.agoraAppId,
      isFallback: true
    };
  },

  async endVideoSession(meetingId) {
    return { success: true };
  },

  async checkVideoHealth() {
    return {
      agora: {
        configured: true,
        appId: '***8468'
      },
      status: 'healthy'
    };
  }
};

export default videoApi;
