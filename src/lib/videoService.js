import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from './agora/videoApi';

let agoraEngine = null;

const videoService = {
  async startVideoSession(classId, userId) {
    try {
      // Get configuration from videoApi
      const config = await videoApi.startVideoSession(classId, userId);
      if (!config.success) throw new Error(config.error);

      // Initialize Agora engine
      if (!agoraEngine) {
        agoraEngine = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      }

      // Join channel
      await agoraEngine.join(config.appId, config.channel, null, userId);
      
      // Create and publish local tracks
      const [microphoneTrack, cameraTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
      ]);

      await agoraEngine.publish([microphoneTrack, cameraTrack]);

      return {
        success: true,
        meetingId: config.meetingId,
        localAudioTrack: microphoneTrack,
        localVideoTrack: cameraTrack,
        engine: agoraEngine
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async joinVideoSession(meetingId, userId) {
    try {
      // Get configuration from videoApi
      const config = await videoApi.joinVideoSession(meetingId, userId);
      if (!config.success) throw new Error(config.error);

      // Initialize Agora engine
      if (!agoraEngine) {
        agoraEngine = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      }

      // Join channel
      await agoraEngine.join(config.appId, config.channel, null, userId);

      return {
        success: true,
        meetingId: config.meetingId,
        engine: agoraEngine
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async leaveVideoSession() {
    try {
      if (agoraEngine) {
        await agoraEngine.leave();
        agoraEngine = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getAgoraEngine() {
    return agoraEngine;
  },

  isAgoraInitialized() {
    return !!agoraEngine;
  }
};

export default videoService;
