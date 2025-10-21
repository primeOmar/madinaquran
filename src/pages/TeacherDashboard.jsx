const VideoCallModal = ({
  class: classData,
  onClose,
  onError,
  channel,
  token,
  appId,
  uid
}) => {
  const [agoraClient, setAgoraClient] = useState(null);
  const [localTracks, setLocalTracks] = useState({});
  const [remoteUsers, setRemoteUsers] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());

  // Debug props
  useEffect(() => {
    console.log('🔍 VideoCallModal Props:', {
      channel,
      token: token ? `${token.substring(0, 20)}...` : 'MISSING',
      appId: appId ? `${appId.substring(0, 8)}...` : 'Using env',
      uid,
      hasChannel: !!channel,
      hasToken: !!token
    });
  }, [channel, token, appId, uid]);

  // Initialize Agora with backend credentials
  const initializeAgoraWithBackend = async () => {
    try {
      console.log('🎥 Initializing Agora...');

      // Validate Agora SDK
      if (typeof AgoraRTC === 'undefined') {
        throw new Error('Agora SDK not loaded');
      }

      // Validate credentials
      if (!channel) {
        throw new Error('No channel provided');
      }

      const finalAppId = appId || import.meta.env.VITE_AGORA_APP_ID;
      if (!finalAppId || finalAppId.includes('your_')) {
        throw new Error('Invalid Agora App ID');
      }

      // Create client
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });

      // Set up event listeners
      setupAgoraEventListeners(client);

      // Join channel
      console.log('🚀 Joining channel...');
      await client.join(finalAppId, channel, token, uid);

      console.log('✅ Successfully joined channel');
      return client;

    } catch (error) {
      console.error('❌ Agora initialization failed:', error);
      throw new Error(`Failed to join video session: ${error.message}`);
    }
  };

  // Set up Agora event listeners
  const setupAgoraEventListeners = (client) => {
    // User published media
    client.on('user-published', async (user, mediaType) => {
      try {
        console.log(`📹 User ${user.uid} published ${mediaType}`);
        await client.subscribe(user, mediaType);

        if (mediaType === 'video') {
          setRemoteUsers(prev => {
            const newMap = new Map(prev);
            const userData = newMap.get(user.uid) || {
              uid: user.uid,
              hasVideo: false,
              hasAudio: false,
              videoTrack: null,
              audioTrack: null
            };
            userData.videoTrack = user.videoTrack;
            userData.hasVideo = true;
            newMap.set(user.uid, userData);
            return newMap;
          });

          // Play video with retry mechanism
          const playRemoteVideo = () => {
            const videoElement = remoteVideoRefs.current.get(user.uid);
            if (videoElement && user.videoTrack) {
              user.videoTrack.play(videoElement);
              console.log(`✅ Playing remote video for user ${user.uid}`);
            } else {
              setTimeout(playRemoteVideo, 100);
            }
          };
          playRemoteVideo();
        }

        if (mediaType === 'audio') {
          setRemoteUsers(prev => {
            const newMap = new Map(prev);
            const userData = newMap.get(user.uid) || {
              uid: user.uid,
              hasVideo: false,
              hasAudio: false,
              videoTrack: null,
              audioTrack: null
            };
            userData.audioTrack = user.audioTrack;
            userData.hasAudio = true;
            newMap.set(user.uid, userData);
            return newMap;
          });

          // Play audio
          user.audioTrack.play();
        }
      } catch (error) {
        console.error(`Error handling user-published:`, error);
      }
    });

    // User unpublished media
    client.on('user-unpublished', (user, mediaType) => {
      console.log(`📹 User ${user.uid} unpublished ${mediaType}`);

      setRemoteUsers(prev => {
        const newMap = new Map(prev);
        const userData = newMap.get(user.uid);
        if (userData) {
          if (mediaType === 'video') {
            userData.videoTrack = null;
            userData.hasVideo = false;
          }
          if (mediaType === 'audio') {
            userData.audioTrack = null;
            userData.hasAudio = false;
          }
          newMap.set(user.uid, userData);
        }
        return newMap;
      });
    });

    // User joined
    client.on('user-joined', (user) => {
      console.log(`👤 User ${user.uid} joined`);
      setRemoteUsers(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(user.uid)) {
          newMap.set(user.uid, {
            uid: user.uid,
            hasVideo: false,
            hasAudio: false,
            videoTrack: null,
            audioTrack: null
          });
        }
        return newMap;
      });
    });

    // User left
    client.on('user-left', (user) => {
      console.log(`👤 User ${user.uid} left`);
      setRemoteUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(user.uid);
        remoteVideoRefs.current.delete(user.uid);
        return newMap;
      });
    });

    // Connection state change
    client.on('connection-state-change', (curState, prevState) => {
      console.log(`🔗 Connection state: ${prevState} → ${curState}`);
    });
  };

  // Create and publish local tracks - SIMPLIFIED VERSION
  const createAndPublishLocalTracks = async (client) => {
    try {
      console.log('🎤 Creating local tracks...');

      let microphoneTrack = null;
      let cameraTrack = null;

      // Create microphone track
      try {
        microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
        console.log('✅ Microphone track created');
      } catch (audioError) {
        console.warn('❌ Microphone access failed:', audioError.message);
        toast.warn('Microphone access denied. You will be audio-only.');
      }

      // Create camera track
      try {
        cameraTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrate: 1700
          },
          optimizationMode: 'detail'
        });
        console.log('✅ Camera track created');
      } catch (videoError) {
        console.warn('❌ Camera access failed:', videoError.message);
        toast.warn('Camera access denied. You will be audio-only.');
      }

      // If both tracks failed, throw error
      if (!microphoneTrack && !cameraTrack) {
        throw new Error('Camera and microphone access denied. Please check permissions.');
      }

      // Publish available tracks
      const tracksToPublish = [];
      if (microphoneTrack) tracksToPublish.push(microphoneTrack);
      if (cameraTrack) tracksToPublish.push(cameraTrack);

      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        console.log('✅ Published local tracks');
      }

      return { microphoneTrack, cameraTrack };

    } catch (error) {
      console.error('❌ Failed to create local tracks:', error);

      if (error.name === 'NOT_READABLE_ERROR' || error.name === 'PERMISSION_DENIED') {
        throw new Error('Camera or microphone access denied. Please check browser permissions.');
      }

      if (error.message.includes('NotFoundError')) {
        throw new Error('Camera or microphone not found. Please check your device connections.');
      }

      throw error;
    }
  };

  // CRITICAL FIX: Handle local video playback after component renders
  useEffect(() => {
    const playLocalVideo = () => {
      if (localTracks.cameraTrack && localVideoRef.current) {
        console.log('🎬 Playing local video on available ref');
        try {
          localTracks.cameraTrack.play(localVideoRef.current);
          console.log('✅ Local video playback initiated');
          
          // Force play to handle any autoplay restrictions
          localVideoRef.current.play().catch(e => {
            console.log('⚠️ Auto-play warning (normal for some browsers):', e.message);
          });
        } catch (playError) {
          console.error('❌ Failed to play local video:', playError);
        }
      }
    };

    // Try to play immediately
    playLocalVideo();

    // Set up interval to retry until successful
    const retryInterval = setInterval(playLocalVideo, 500);

    // Clear interval after 5 seconds to avoid infinite retries
    setTimeout(() => {
      clearInterval(retryInterval);
      console.log('🛑 Stopped video playback retries');
    }, 5000);

    return () => clearInterval(retryInterval);
  }, [localTracks.cameraTrack]); // Re-run when camera track changes

  // Monitor ref availability
  useEffect(() => {
    console.log('🔍 Video ref state:', {
      hasVideoRef: !!localVideoRef.current,
      videoRef: localVideoRef.current
    });
  }, [localTracks.cameraTrack, isLoading]);

  // Toggle audio
  const toggleAudio = async () => {
    const audioTrack = localTracks.microphoneTrack;
    if (audioTrack) {
      try {
        await audioTrack.setEnabled(!isAudioEnabled);
        setIsAudioEnabled(!isAudioEnabled);
        console.log(`🎤 Audio ${!isAudioEnabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Error toggling audio:', error);
      }
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    const videoTrack = localTracks.cameraTrack;
    if (videoTrack) {
      try {
        await videoTrack.setEnabled(!isVideoEnabled);
        setIsVideoEnabled(!isVideoEnabled);
        console.log(`📹 Video ${!isVideoEnabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  };

  // Screen sharing
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen share
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 15,
            bitrate: 1500
          }
        });

        // Unpublish camera track and publish screen track
        if (localTracks.cameraTrack) {
          await agoraClient.unpublish(localTracks.cameraTrack);
        }

        await agoraClient.publish(screenTrack);
        setIsScreenSharing(true);
        console.log('🖥️ Screen sharing started');

      } else {
        // Stop screen share and re-publish camera
        if (localTracks.cameraTrack) {
          await agoraClient.publish(localTracks.cameraTrack);
        }

        setIsScreenSharing(false);
        console.log('🖥️ Screen sharing stopped');
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      if (error.name === 'NOT_READABLE_ERROR') {
        toast.error('Screen sharing not supported or permission denied');
      }
    }
  };

  // Leave call cleanup
  const leaveCall = async () => {
    try {
      console.log('🛑 Leaving video call...');

      // Close local tracks
      if (localTracks.microphoneTrack) {
        localTracks.microphoneTrack.close();
      }
      if (localTracks.cameraTrack) {
        localTracks.cameraTrack.close();
      }

      // Leave channel
      if (agoraClient) {
        await agoraClient.leave();
      }

      console.log('✅ Video call cleanup complete');
    } catch (error) {
      console.error('Error during call cleanup:', error);
    } finally {
      setAgoraClient(null);
      setLocalTracks({});
      setRemoteUsers(new Map());
      onClose();
    }
  };

  // Main initialization effect
  useEffect(() => {
    const initVideoCall = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🚀 Starting video call initialization...');

        // Step 1: Initialize Agora client
        const client = await initializeAgoraWithBackend();
        setAgoraClient(client);

        // Step 2: Create and publish local tracks
        const tracks = await createAndPublishLocalTracks(client);
        setLocalTracks(tracks);

        setIsLoading(false);
        console.log('🎉 Video call initialized successfully');

      } catch (err) {
        console.error('❌ Video call initialization failed:', err);
        setError(err.message);
        setIsLoading(false);
        onError?.(err.message);
      }
    };

    initVideoCall();

    return () => {
      // Cleanup on unmount
      if (agoraClient || localTracks.microphoneTrack || localTracks.cameraTrack) {
        leaveCall();
      }
    };
  }, [channel, token, appId, uid]);

  // Error display
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
        <div className="bg-gradient-to-br from-red-900/50 to-pink-900/50 backdrop-blur-lg border border-red-500/20 rounded-2xl p-6 shadow-2xl max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="text-red-400" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Video Call Error</h2>
            <div className="text-red-200 mb-6">
              <p className="mb-4">{error}</p>
              <div className="text-left bg-red-900/30 p-4 rounded-xl">
                <h4 className="font-semibold text-red-300 mb-2">Possible Solutions:</h4>
                <ul className="text-sm space-y-1 text-red-200">
                  <li>• Check camera and microphone permissions</li>
                  <li>• Verify your internet connection</li>
                  <li>• Try rejoining the session</li>
                  <li>• Contact support if issue persists</li>
                </ul>
              </div>
            </div>
            <button
              onClick={leaveCall}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-gray-900/80 to-purple-900/80 backdrop-blur-lg border-b border-cyan-500/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <h2 className="text-xl font-bold text-white">
              {classData?.title || 'Madina Video Session'}
            </h2>
            <span className="text-cyan-300 text-sm">
              {Array.from(remoteUsers.values()).filter(user => user.hasVideo || user.hasAudio).length} participants
            </span>
          </div>
          <button
            onClick={leaveCall}
            className="p-2 text-cyan-300 hover:text-white transition-colors rounded-lg hover:bg-red-500/20"
            title="Leave Call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Main Video Content */}
      <div className="pt-20 pb-32 h-full flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
              <p className="text-cyan-300 text-lg">Initializing Madina video session...</p>
              <p className="text-cyan-400 text-sm">Connecting to neural network</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-4">
            {/* Debug Info */}
            <div className="absolute top-16 left-4 bg-black/50 text-white p-2 rounded text-xs z-20">
              <div>Local Camera: {localTracks.cameraTrack ? '✅' : '❌'}</div>
              <div>Local Audio: {localTracks.microphoneTrack ? '✅' : '❌'}</div>
              <div>Remote Users: {Array.from(remoteUsers.values()).length}</div>
              <div>Video Ref: {localVideoRef.current ? '✅' : '❌'}</div>
            </div>

            {/* Remote Videos Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
              {/* Local Video - ENHANCED WITH BETTER VIDEO HANDLING */}
              {localTracks.cameraTrack ? (
                <div className="relative bg-gray-800 rounded-2xl overflow-hidden border-2 border-cyan-500/50">
                  <video
                    ref={localVideoRef}
                    className="w-full h-48 md:h-64 object-cover bg-black"
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: 'scaleX(-1)' }}
                    onLoadedData={(e) => {
                      console.log('✅ Local video data loaded', {
                        width: e.target.videoWidth,
                        height: e.target.videoHeight
                      });
                    }}
                    onCanPlay={(e) => {
                      console.log('🎬 Local video can play');
                      e.target.play().catch(e => console.log('Auto-play note:', e.message));
                    }}
                    onPlay={() => console.log('▶️ Local video started playing')}
                    onError={(e) => console.error('❌ Local video error:', e.target.error)}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                    You {!isVideoEnabled && '🔴'} {!isAudioEnabled && '🔇'}
                  </div>
                  <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    📹 Local
                  </div>
                </div>
              ) : (
                // Camera not available fallback
                <div className="relative bg-gray-800 rounded-2xl overflow-hidden border-2 border-cyan-500/50 flex items-center justify-center">
                  <div className="text-center text-cyan-300">
                    <VideoOff size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Camera not available</p>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                    You {!isAudioEnabled && '🔇'}
                  </div>
                </div>
              )}

              {/* Remote Videos */}
              {Array.from(remoteUsers.values())
                .filter(user => user.hasVideo)
                .map((user) => (
                  <div key={user.uid} className="relative bg-gray-800 rounded-2xl overflow-hidden border-2 border-green-500/50">
                    <video
                      ref={ref => {
                        if (ref) {
                          remoteVideoRefs.current.set(user.uid, ref);
                          if (user.videoTrack) {
                            user.videoTrack.play(ref);
                          }
                        }
                      }}
                      className="w-full h-48 md:h-64 object-cover bg-black"
                      autoPlay
                      playsInline
                      onLoadedData={() => console.log(`✅ Remote video ${user.uid} loaded`)}
                    />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                      Student {user.uid} {!user.hasAudio && '🔇'}
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                      👤 Remote
                    </div>
                  </div>
                ))}
            </div>

            {/* No participants message */}
            {Array.from(remoteUsers.values()).filter(user => user.hasVideo).length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-cyan-300">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Waiting for learners to join...</p>
                  <p className="text-sm">Share the session link with your students</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {!isLoading && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/90 to-transparent p-6">
          <div className="flex justify-center space-x-4">
            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 ${
                isAudioEnabled
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
              title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              disabled={!localTracks.cameraTrack}
              className={`p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 ${
                isVideoEnabled
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              } ${!localTracks.cameraTrack ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={localTracks.cameraTrack ? (isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera') : 'Camera not available'}
            >
              {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            {/* Screen Share */}
            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 ${
                isScreenSharing
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
              title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            >
              <Monitor size={24} />
            </button>

            {/* End Call */}
            <button
              onClick={leaveCall}
              className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl transition-all duration-300 transform hover:scale-110"
              title="End Call"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
