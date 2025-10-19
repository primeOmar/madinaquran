import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from './agora/videoApi';

let agoraEngine = null;
let localTracks = {
  audioTrack: null,
  videoTrack: null
};
let remoteUsers = new Map();
let eventCallbacks = {
  onUserJoined: null,
  onUserLeft: null,
  onUserPublished: null,
  onUserUnpublished: null
};

const videoService = {
  // 🔧 TEACHER: Start video session (existing)
  async startVideoSession(classId, userId) {
    try {
      // Get configuration from videoApi
      const config = await videoApi.startVideoSession(classId, userId);
      if (!config.success) throw new Error(config.error);

      // Initialize Agora engine
      if (!agoraEngine) {
        agoraEngine = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        this.setupAgoraEventListeners();
      }

      // Join channel
      await agoraEngine.join(config.appId, config.channel, config.token, userId);
      
      // Create and publish local tracks
      const [microphoneTrack, cameraTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
      ]);

      await agoraEngine.publish([microphoneTrack, cameraTrack]);

      // Store local tracks
      localTracks.audioTrack = microphoneTrack;
      localTracks.videoTrack = cameraTrack;

      return {
        success: true,
        meetingId: config.meetingId,
        localAudioTrack: microphoneTrack,
        localVideoTrack: cameraTrack,
        engine: agoraEngine,
        channel: config.channel
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // 🔧 STUDENT: Join video session (enhanced)
  async joinVideoSession(meetingId, userId) {
    try {
      // Get configuration from videoApi
      const config = await videoApi.joinVideoSession(meetingId, userId);
      if (!config.success) throw new Error(config.error);

      // Initialize Agora engine
      if (!agoraEngine) {
        agoraEngine = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        this.setupAgoraEventListeners();
      }

      // Join channel
      await agoraEngine.join(config.appId, config.channel, config.token, userId);

      // 🔧 NEW: Create local tracks for student (optional - student can choose to enable)
      let localAudioTrack = null;
      let localVideoTrack = null;

      try {
        // Try to get microphone access
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await agoraEngine.publish([localAudioTrack]);
      } catch (audioError) {
        console.warn('Microphone access denied or unavailable:', audioError);
      }

      try {
        // Try to get camera access  
        localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await agoraEngine.publish([localVideoTrack]);
      } catch (videoError) {
        console.warn('Camera access denied or unavailable:', videoError);
      }

      // Store local tracks
      localTracks.audioTrack = localAudioTrack;
      localTracks.videoTrack = localVideoTrack;

      return {
        success: true,
        meetingId: config.meetingId,
        engine: agoraEngine,
        channel: config.channel,
        localAudioTrack,
        localVideoTrack,
        hasAudio: !!localAudioTrack,
        hasVideo: !!localVideoTrack
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // 🔧 NEW: Join session with media options
  async joinVideoSessionWithMedia(meetingId, userId, mediaOptions = { audio: true, video: true }) {
    try {
      const config = await videoApi.joinVideoSession(meetingId, userId);
      if (!config.success) throw new Error(config.error);

      if (!agoraEngine) {
        agoraEngine = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        this.setupAgoraEventListeners();
      }

      await agoraEngine.join(config.appId, config.channel, config.token, userId);

      // Create tracks based on media options
      let localAudioTrack = null;
      let localVideoTrack = null;

      if (mediaOptions.audio) {
        try {
          localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          await agoraEngine.publish([localAudioTrack]);
        } catch (error) {
          console.warn('Failed to create audio track:', error);
        }
      }

      if (mediaOptions.video) {
        try {
          localVideoTrack = await AgoraRTC.createCameraVideoTrack();
          await agoraEngine.publish([localVideoTrack]);
        } catch (error) {
          console.warn('Failed to create video track:', error);
        }
      }

      localTracks.audioTrack = localAudioTrack;
      localTracks.videoTrack = localVideoTrack;

      return {
        success: true,
        meetingId: config.meetingId,
        engine: agoraEngine,
        localAudioTrack,
        localVideoTrack,
        hasAudio: !!localAudioTrack,
        hasVideo: !!localVideoTrack
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // 🔧 Enhanced leave session
  async leaveVideoSession() {
    try {
      // Stop and close local tracks
      if (localTracks.audioTrack) {
        localTracks.audioTrack.stop();
        localTracks.audioTrack.close();
      }
      if (localTracks.videoTrack) {
        localTracks.videoTrack.stop();
        localTracks.videoTrack.close();
      }

      // Leave channel
      if (agoraEngine) {
        await agoraEngine.leave();
        agoraEngine = null;
      }

      // Clear local tracks
      localTracks.audioTrack = null;
      localTracks.videoTrack = null;
      
      // Clear remote users
      remoteUsers.clear();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // 🔧 NEW: Setup Agora event listeners
  setupAgoraEventListeners() {
    if (!agoraEngine) return;

    // User published (joined with media)
    agoraEngine.on("user-published", async (user, mediaType) => {
      console.log("User published:", user.uid, mediaType);
      
      // Subscribe to the remote user
      await agoraEngine.subscribe(user, mediaType);
      
      if (mediaType === "video") {
        // Store remote user video track
        remoteUsers.set(user.uid, {
          ...user,
          videoTrack: user.videoTrack,
          hasVideo: true
        });
        
        // Trigger callback
        if (eventCallbacks.onUserPublished) {
          eventCallbacks.onUserPublished(user, 'video');
        }
      }
      
      if (mediaType === "audio") {
        // Play remote audio
        user.audioTrack.play();
        remoteUsers.set(user.uid, {
          ...user,
          audioTrack: user.audioTrack,
          hasAudio: true
        });
        
        if (eventCallbacks.onUserPublished) {
          eventCallbacks.onUserPublished(user, 'audio');
        }
      }
    });

    // User unpublished (stopped media)
    agoraEngine.on("user-unpublished", (user, mediaType) => {
      console.log("User unpublished:", user.uid, mediaType);
      
      const remoteUser = remoteUsers.get(user.uid);
      if (remoteUser) {
        if (mediaType === "video") {
          remoteUser.hasVideo = false;
          remoteUser.videoTrack = null;
        }
        if (mediaType === "audio") {
          remoteUser.hasAudio = false;
          remoteUser.audioTrack = null;
        }
        
        remoteUsers.set(user.uid, remoteUser);
        
        if (eventCallbacks.onUserUnpublished) {
          eventCallbacks.onUserUnpublished(user, mediaType);
        }
      }
    });

    // User joined
    agoraEngine.on("user-joined", (user) => {
      console.log("User joined:", user.uid);
      remoteUsers.set(user.uid, { uid: user.uid, joinedAt: new Date() });
      
      if (eventCallbacks.onUserJoined) {
        eventCallbacks.onUserJoined(user);
      }
    });

    // User left
    agoraEngine.on("user-left", (user) => {
      console.log("User left:", user.uid);
      remoteUsers.delete(user.uid);
      
      if (eventCallbacks.onUserLeft) {
        eventCallbacks.onUserLeft(user);
      }
    });

    // Connection state change
    agoraEngine.on("connection-state-change", (curState, prevState) => {
      console.log("Connection state:", prevState, "->", curState);
    });
  },

  // 🔧 NEW: Toggle local audio
  async toggleAudio() {
    if (localTracks.audioTrack) {
      await localTracks.audioTrack.setEnabled(!localTracks.audioTrack.enabled);
      return localTracks.audioTrack.enabled;
    }
    return false;
  },

  // 🔧 NEW: Toggle local video
  async toggleVideo() {
    if (localTracks.videoTrack) {
      await localTracks.videoTrack.setEnabled(!localTracks.videoTrack.enabled);
      return localTracks.videoTrack.enabled;
    }
    return false;
  },

  // 🔧 NEW: Get remote users
  getRemoteUsers() {
    return Array.from(remoteUsers.values());
  },

  // 🔧 NEW: Get specific remote user
  getRemoteUser(uid) {
    return remoteUsers.get(uid);
  },

  // 🔧 NEW: Check if user is teacher (first user in channel)
  isTeacher(uid) {
    const users = this.getRemoteUsers();
    if (users.length === 0) return false;
    
    // Assuming teacher is the first user to join
    const sortedUsers = users.sort((a, b) => a.joinedAt - b.joinedAt);
    return sortedUsers[0]?.uid === uid;
  },

  // 🔧 NEW: Event subscription methods
  onUserJoined(callback) {
    eventCallbacks.onUserJoined = callback;
  },

  onUserLeft(callback) {
    eventCallbacks.onUserLeft = callback;
  },

  onUserPublished(callback) {
    eventCallbacks.onUserPublished = callback;
  },

  onUserUnpublished(callback) {
    eventCallbacks.onUserUnpublished = callback;
  },

  // 🔧 NEW: Get connection stats
  async getConnectionStats() {
    if (agoraEngine) {
      return await agoraEngine.getRTCStats();
    }
    return null;
  },

  // 🔧 NEW: Get local tracks
  getLocalTracks() {
    return localTracks;
  },

  // 🔧 NEW: Check if audio is enabled
  isAudioEnabled() {
    return localTracks.audioTrack?.enabled ?? false;
  },

  // 🔧 NEW: Check if video is enabled
  isVideoEnabled() {
    return localTracks.videoTrack?.enabled ?? false;
  },

  // Existing methods
  getAgoraEngine() {
    return agoraEngine;
  },

  isAgoraInitialized() {
    return !!agoraEngine;
  }
};

export default videoService;
