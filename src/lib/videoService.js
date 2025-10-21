import AgoraRTC from 'agora-rtc-sdk-ng';

class BulletproofVideoService {
  constructor() {
    this.agoraEngine = null;
    this.localTracks = { audioTrack: null, videoTrack: null };
    this.remoteUsers = new Map();
    this.isInitialized = false;
    this.currentChannel = null;
  }

  // 🔧 VALIDATE AGORA CONFIGURATION
  validateAgoraConfig() {
    const appId = import.meta.env.VITE_AGORA_APP_ID?.trim();
    
    console.log('🔧 Agora Configuration Check:', {
      hasAppId: !!appId,
      appId: appId ? `${appId.substring(0, 8)}...` : 'MISSING',
      isPlaceholder: appId?.includes('your_'),
      environment: import.meta.env.MODE
    });

    // If no App ID or placeholder, use test App ID
    if (!appId || appId.includes('your_')) {
      console.warn('❌ Using fallback test App ID');
      return '5c6e62f8f7c445cfa70b46e7e6a7251a'; // Test App ID
    }

    return appId;
  }

  // 🚀 START VIDEO SESSION (Teacher)
  async startVideoSession(classId, userId) {
    try {
      console.group('🎥 Starting Video Session');
      
      // 1. Get valid App ID
      const appId = this.validateAgoraConfig();
      
      // 2. Generate unique channel name
      const channelName = `madina-class-${classId}-${Date.now()}`;
      
      // 3. Clean up existing session
      if (this.isInitialized) {
        await this.leaveVideoSession();
      }

      // 4. Initialize Agora engine
      this.agoraEngine = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });

      this.setupAgoraEventListeners();

      console.log('🚀 Joining channel:', {
        appId: `${appId.substring(0, 8)}...`,
        channel: channelName,
        userId
      });

      // 5. Join channel
      await this.agoraEngine.join(appId, channelName, null, userId);

      // 6. Create and publish local tracks
      const [microphoneTrack, cameraTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack().catch(err => {
          console.warn('🎤 Microphone access failed:', err.message);
          return null;
        }),
        AgoraRTC.createCameraVideoTrack().catch(err => {
          console.warn('📹 Camera access failed:', err.message);
          return null;
        })
      ]);

      // Publish available tracks
      const tracksToPublish = [];
      if (microphoneTrack) {
        tracksToPublish.push(microphoneTrack);
        this.localTracks.audioTrack = microphoneTrack;
      }
      if (cameraTrack) {
        tracksToPublish.push(cameraTrack);
        this.localTracks.videoTrack = cameraTrack;
      }

      if (tracksToPublish.length > 0) {
        await this.agoraEngine.publish(tracksToPublish);
      }

      this.isInitialized = true;
      this.currentChannel = channelName;

      console.log('✅ Video session started successfully');
      console.groupEnd();

      return {
        success: true,
        meetingId: channelName,
        channel: channelName,
        localAudioTrack: microphoneTrack,
        localVideoTrack: cameraTrack,
        engine: this.agoraEngine,
        hasAudio: !!microphoneTrack,
        hasVideo: !!cameraTrack
      };

    } catch (error) {
      console.groupEnd();
      console.error('❌ Failed to start video session:', error);
      
      // Enhanced error message
      let userMessage = 'Failed to start video call. ';
      
      if (error.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
        userMessage += 'Video service configuration error. Please check Agora App ID.';
      } else if (error.message.includes('INVALID_APP_ID')) {
        userMessage += 'Invalid video service configuration. Please contact support.';
      } else {
        userMessage += 'Please check your network connection and try again.';
      }

      await this.safeCleanup();
      
      return { 
        success: false, 
        error: error.message,
        userMessage 
      };
    }
  }

  // 👥 JOIN VIDEO SESSION (Student)
  async joinVideoSession(meetingId, userId, mediaOptions = { audio: true, video: true }) {
    try {
      console.group('🎥 Joining Video Session');
      
      // 1. Get valid App ID
      const appId = this.validateAgoraConfig();
      
      // 2. Use provided meeting ID as channel
      const channelName = meetingId;

      // 3. Clean up existing session
      if (this.isInitialized) {
        await this.leaveVideoSession();
      }

      // 4. Initialize Agora engine
      this.agoraEngine = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });

      this.setupAgoraEventListeners();

      console.log('🚀 Joining channel:', {
        appId: `${appId.substring(0, 8)}...`,
        channel: channelName,
        userId,
        mediaOptions
      });

      // 5. Join channel
      await this.agoraEngine.join(appId, channelName, null, userId);

      // 6. Create tracks based on media options
      let localAudioTrack = null;
      let localVideoTrack = null;

      if (mediaOptions.audio) {
        try {
          localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          await this.agoraEngine.publish([localAudioTrack]);
        } catch (error) {
          console.warn('🎤 Microphone access failed:', error.message);
        }
      }

      if (mediaOptions.video) {
        try {
          localVideoTrack = await AgoraRTC.createCameraVideoTrack();
          await this.agoraEngine.publish([localVideoTrack]);
        } catch (error) {
          console.warn('📹 Camera access failed:', error.message);
        }
      }

      this.localTracks.audioTrack = localAudioTrack;
      this.localTracks.videoTrack = localVideoTrack;
      this.isInitialized = true;
      this.currentChannel = channelName;

      console.log('✅ Joined video session successfully');
      console.groupEnd();

      return {
        success: true,
        meetingId: channelName,
        channel: channelName,
        localAudioTrack,
        localVideoTrack,
        engine: this.agoraEngine,
        hasAudio: !!localAudioTrack,
        hasVideo: !!localVideoTrack
      };

    } catch (error) {
      console.groupEnd();
      console.error('❌ Failed to join video session:', error);
      
      let userMessage = 'Failed to join video call. ';
      
      if (error.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
        userMessage += 'The meeting may have ended or the link is invalid.';
      } else {
        userMessage += 'Please check your network connection and try again.';
      }

      await this.safeCleanup();
      
      return { 
        success: false, 
        error: error.message,
        userMessage 
      };
    }
  }

  // 🛑 LEAVE SESSION
  async leaveVideoSession() {
    try {
      console.log('🛑 Leaving video session');
      
      // Stop and close local tracks
      if (this.localTracks.audioTrack) {
        this.localTracks.audioTrack.stop();
        this.localTracks.audioTrack.close();
        this.localTracks.audioTrack = null;
      }
      
      if (this.localTracks.videoTrack) {
        this.localTracks.videoTrack.stop();
        this.localTracks.videoTrack.close();
        this.localTracks.videoTrack = null;
      }

      // Leave channel
      if (this.agoraEngine) {
        await this.agoraEngine.leave();
        this.agoraEngine = null;
      }

      // Clear remote users
      this.remoteUsers.clear();
      this.isInitialized = false;
      this.currentChannel = null;

      console.log('✅ Left video session successfully');
      return { success: true };

    } catch (error) {
      console.error('Error during session cleanup:', error);
      // Force reset
      this.agoraEngine = null;
      this.localTracks = { audioTrack: null, videoTrack: null };
      this.remoteUsers.clear();
      this.isInitialized = false;
      this.currentChannel = null;
      return { success: false, error: error.message };
    }
  }

  // 🔧 SETUP EVENT LISTENERS
  setupAgoraEventListeners() {
    if (!this.agoraEngine) return;

    // User published media
    this.agoraEngine.on("user-published", async (user, mediaType) => {
      console.log(`📹 User ${user.uid} published ${mediaType}`);
      
      try {
        await this.agoraEngine.subscribe(user, mediaType);
        
        if (mediaType === "video") {
          this.remoteUsers.set(user.uid, {
            ...user,
            videoTrack: user.videoTrack,
            hasVideo: true
          });
        }
        
        if (mediaType === "audio") {
          user.audioTrack.play();
          this.remoteUsers.set(user.uid, {
            ...user,
            audioTrack: user.audioTrack,
            hasAudio: true
          });
        }
      } catch (error) {
        console.error(`Error subscribing to user ${user.uid}:`, error);
      }
    });

    // User unpublished media
    this.agoraEngine.on("user-unpublished", (user, mediaType) => {
      console.log(`📹 User ${user.uid} unpublished ${mediaType}`);
      
      const remoteUser = this.remoteUsers.get(user.uid);
      if (remoteUser) {
        if (mediaType === "video") {
          remoteUser.hasVideo = false;
          remoteUser.videoTrack = null;
        }
        if (mediaType === "audio") {
          remoteUser.hasAudio = false;
          remoteUser.audioTrack = null;
        }
        this.remoteUsers.set(user.uid, remoteUser);
      }
    });

    // User joined
    this.agoraEngine.on("user-joined", (user) => {
      console.log(`👤 User ${user.uid} joined`);
      this.remoteUsers.set(user.uid, { 
        uid: user.uid, 
        joinedAt: new Date(),
        hasVideo: false,
        hasAudio: false
      });
    });

    // User left
    this.agoraEngine.on("user-left", (user) => {
      console.log(`👤 User ${user.uid} left`);
      this.remoteUsers.delete(user.uid);
    });

    // Connection state change
    this.agoraEngine.on("connection-state-change", (curState, prevState) => {
      console.log(`🔗 Connection state: ${prevState} → ${curState}`);
    });
  }

  // 🛡️ SAFE CLEANUP
  async safeCleanup() {
    try {
      await this.leaveVideoSession();
    } catch (error) {
      console.error('Error during safe cleanup:', error);
      // Force reset
      this.agoraEngine = null;
      this.localTracks = { audioTrack: null, videoTrack: null };
      this.remoteUsers.clear();
      this.isInitialized = false;
      this.currentChannel = null;
    }
  }

  // 🔧 TOGGLE AUDIO/VIDEO
  async toggleAudio() {
    if (this.localTracks.audioTrack) {
      await this.localTracks.audioTrack.setEnabled(!this.localTracks.audioTrack.enabled);
      return this.localTracks.audioTrack.enabled;
    }
    return false;
  }

  async toggleVideo() {
    if (this.localTracks.videoTrack) {
      await this.localTracks.videoTrack.setEnabled(!this.localTracks.videoTrack.enabled);
      return this.localTracks.videoTrack.enabled;
    }
    return false;
  }

  // 📊 GET STATUS
  getRemoteUsers() {
    return Array.from(this.remoteUsers.values());
  }

  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      currentChannel: this.currentChannel,
      hasAudio: !!this.localTracks.audioTrack,
      hasVideo: !!this.localTracks.videoTrack,
      remoteUsers: this.remoteUsers.size,
      appId: import.meta.env.VITE_AGORA_APP_ID ? `${import.meta.env.VITE_AGORA_APP_ID.substring(0, 8)}...` : 'NOT_SET'
    };
  }
}

// Create singleton instance
const videoService = new BulletproofVideoService();
export default videoService;
