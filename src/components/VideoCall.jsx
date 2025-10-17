import React, { useEffect, useCallback, useState, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded, isOpen = true }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const agoraClientRef = useRef(null);
  const localTracksRef = useRef([]);
  const isJoiningRef = useRef(false);
  const videoElementsRef = useRef(new Map());
  const isMountedRef = useRef(true);

  // Production Agora App ID
  const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '5c0225ce9a19445f95a2685647258468';

  // Debug: Log when component mounts/unmounts
  useEffect(() => {
    console.log('🎬 VideoCall Component MOUNTED', { isOpen, meetingId });
    isMountedRef.current = true;

    return () => {
      console.log('🎬 VideoCall Component UNMOUNTING - This should not happen during call!');
      isMountedRef.current = false;
    };
  }, []);

  // Fix 1: Prevent component unmounting when modal should be open
  useEffect(() => {
    if (!isOpen) {
      console.log('🚫 Modal closed, leaving call');
      leaveCall();
    }
  }, [isOpen]);

  // Fix 2: Enhanced tab visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      console.log('📱 Tab visibility changed:', visible);
      setIsVisible(visible);
      
      if (visible && isInCall) {
        // Resume when tab becomes active
        resumeTracks();
      }
      // Don't pause tracks when tab becomes inactive - this causes disconnection
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInCall]);

  // Fix 3: Enhanced fullscreen modal with proper cleanup
  useEffect(() => {
    console.log('🔄 Setting up fullscreen modal');
    
    // Store original styles
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    
    // Apply fullscreen styles
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';

    // Prevent accidental closure
    const handleBeforeUnload = (e) => {
      if (isInCall) {
        e.preventDefault();
        e.returnValue = 'You are in an active video call. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('🧹 Cleaning up fullscreen modal');
      // Restore original styles
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInCall]);

  // Initialize Agora client
  useEffect(() => {
    if (!agoraClientRef.current) {
      console.log('🎯 Initializing Agora client');
      agoraClientRef.current = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });
      
      agoraClientRef.current.on('exception', (event) => {
        console.warn('Agora exception:', event);
      });

      // Network quality monitoring
      agoraClientRef.current.on('network-quality', (quality) => {
        console.log('📊 Network quality:', quality);
      });
    }

    return () => {
      // Only cleanup if component is truly unmounting
      if (!isMountedRef.current) {
        leaveCall();
      }
    };
  }, []);

  // Track management
  const pauseTracks = useCallback(() => {
    console.log('⏸️ Pausing tracks');
    localTracksRef.current.forEach((track, index) => {
      if (track && track.setEnabled) {
        track.setEnabled(false);
      }
    });
  }, []);

  const resumeTracks = useCallback(async () => {
    console.log('▶️ Resuming tracks');
    if (localTracksRef.current[0]) {
      await localTracksRef.current[0].setEnabled(!isAudioMuted);
    }
    if (localTracksRef.current[1]) {
      await localTracksRef.current[1].setEnabled(!isVideoMuted);
    }
  }, [isAudioMuted, isVideoMuted]);

  // Enhanced video playback
  const playVideoTrack = useCallback((track, element, uid) => {
    if (!track || !element) {
      console.warn('❌ Cannot play track: missing track or element');
      return;
    }

    try {
      console.log(`🎬 Attempting to play video for user ${uid}`);
      
      // Clear previous content
      element.innerHTML = '';
      
      track.play(element, { 
        fit: 'cover',
        mirror: uid === 'local'
      }).then(() => {
        console.log(`✅ Successfully playing video for user ${uid}`);
      }).catch(playError => {
        console.error(`❌ Failed to play video for user ${uid}:`, playError);
        
        // Show user-friendly error in the video element
        element.innerHTML = `
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;color:white;flex-direction:column;">
            <div>⚠️ Video Playback Error</div>
            <div style="font-size:12px;margin-top:10px;">Click to retry</div>
          </div>
        `;
        
        const retryPlay = () => {
          console.log('🔄 Retrying video playback after user interaction');
          track.play(element, { fit: 'cover' }).catch(e => {
            console.error(`❌ Retry failed for user ${uid}:`, e);
          });
          element.removeEventListener('click', retryPlay);
        };
        
        element.addEventListener('click', retryPlay);
      });
    } catch (error) {
      console.error(`❌ Error in playVideoTrack for user ${uid}:`, error);
    }
  }, []);

  // Generate token
  const getAgoraToken = useCallback(async (channelName, uid) => {
    try {
      console.log('🔐 Fetching Agora token...');
      const response = await fetch('https://madina-quran-backend.onrender.com/api/agora/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid, role: 'publisher' })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Token received');
        return data.token;
      } else {
        console.warn('❌ Token fetch failed, using null token');
      }
    } catch (error) {
      console.warn('❌ Token fetch error, using null token:', error);
    }
    return null;
  }, []);

  // Debugged video call start
  const startVideoCall = useCallback(async () => {
    if (!isMountedRef.current) {
      console.log('⏸️ Component not mounted, skipping call start');
      return;
    }

    if (!meetingId || !user?.id || isInCall || isJoiningRef.current) {
      console.log('⏸️ Start call prevented:', { 
        meetingId, 
        userId: user?.id, 
        isInCall, 
        isJoining: isJoiningRef.current,
        mounted: isMountedRef.current
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    isJoiningRef.current = true;

    try {
      console.log('🚀 STARTING VIDEO CALL...');

      if (!AGORA_APP_ID) {
        throw new Error('Agora App ID not configured');
      }

      const channelName = `class_${meetingId}`;
      const uid = String(Math.floor(Math.random() * 100000));

      console.log('🔗 Agora setup:', { 
        channel: channelName, 
        uid 
      });

      const token = await getAgoraToken(channelName, uid);

      // Join channel with timeout
      console.log('🔗 Joining channel...');
      await Promise.race([
        agoraClientRef.current.join(AGORA_APP_ID, channelName, token, uid),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Join timeout after 10s')), 10000)
        )
      ]);
      console.log('✅ Joined channel successfully');

      // Create local tracks
      console.log('🎥 Creating local tracks...');
      
      const [microphoneTrack, cameraTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
        }).catch(err => {
          console.error('❌ Microphone error:', err);
          throw new Error('Microphone access required. Please allow microphone permissions and refresh the page.');
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: '720p_1',
          optimizationMode: 'motion'
        }).catch(err => {
          console.error('❌ Camera error:', err);
          throw new Error('Camera access required. Please allow camera permissions and refresh the page.');
        })
      ]);

      localTracksRef.current = [microphoneTrack, cameraTrack];

      // Publish tracks
      console.log('📤 Publishing tracks...');
      await agoraClientRef.current.publish(localTracksRef.current);
      console.log('✅ Tracks published');

      // Set up local stream
      const localStream = {
        audioTrack: microphoneTrack,
        videoTrack: cameraTrack,
        uid: 'local'
      };
      setLocalStream(localStream);

      // Set up remote user handlers
      agoraClientRef.current.on('user-published', handleUserPublished);
      agoraClientRef.current.on('user-unpublished', handleUserUnpublished);
      agoraClientRef.current.on('user-joined', handleUserJoined);
      agoraClientRef.current.on('user-left', handleUserLeft);

      setIsInCall(true);
      console.log('🎉 Video call started successfully!');

    } catch (err) {
      console.error('❌ Video call start failed:', err);
      
      let errorMessage = 'Failed to start video call. Please refresh and try again.';
      
      if (err.message.includes('timeout')) {
        errorMessage = 'Connection timeout. Please check your internet connection.';
      } else if (err.message.includes('permission') || err.name === 'NOT_ALLOWED_ERROR') {
        errorMessage = 'Camera/microphone permission denied. Please allow permissions and refresh.';
      } else if (err.message.includes('Microphone access') || err.message.includes('Camera access')) {
        errorMessage = err.message;
      } else if (err.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      setError(errorMessage);
      await cleanupTracks();
      
    } finally {
      setIsLoading(false);
      isJoiningRef.current = false;
    }
  }, [meetingId, user?.id, isInCall, AGORA_APP_ID, getAgoraToken]);

  // Enhanced remote user handling
  const handleUserPublished = useCallback(async (user, mediaType) => {
    console.log('👤 User published:', user.uid, mediaType);
    
    try {
      await agoraClientRef.current.subscribe(user, mediaType);
      console.log(`✅ Subscribed to ${mediaType} for user ${user.uid}`);

      setRemoteUsers(prev => {
        const existing = prev.find(u => u.uid === user.uid);
        if (existing) {
          return prev.map(u => 
            u.uid === user.uid 
              ? { 
                  ...u, 
                  [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: user[mediaType],
                  hasAudio: mediaType === 'audio' ? true : u.hasAudio,
                  hasVideo: mediaType === 'video' ? true : u.hasVideo
                }
              : u
          );
        }
        return [...prev, { 
          uid: user.uid,
          audioTrack: mediaType === 'audio' ? user.audioTrack : null,
          videoTrack: mediaType === 'video' ? user.videoTrack : null,
          hasAudio: mediaType === 'audio',
          hasVideo: mediaType === 'video'
        }];
      });

    } catch (err) {
      console.error('Error subscribing to user:', err);
    }
  }, []);

  const handleUserUnpublished = useCallback((user, mediaType) => {
    console.log('👤 User unpublished:', user.uid, mediaType);
    setRemoteUsers(prev => 
      prev.map(u => 
        u.uid === user.uid 
          ? { 
              ...u, 
              [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: null,
              hasAudio: mediaType === 'audio' ? false : u.hasAudio,
              hasVideo: mediaType === 'video' ? false : u.hasVideo
            }
          : u
      )
    );
  }, []);

  const handleUserJoined = useCallback((user) => {
    console.log('👤 User joined:', user.uid);
  }, []);

  const handleUserLeft = useCallback((user) => {
    console.log('👤 User left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  }, []);

  // Cleanup tracks
  const cleanupTracks = useCallback(async () => {
    console.log('🧹 Cleaning up tracks...');
    
    if (localTracksRef.current.length > 0) {
      for (const track of localTracksRef.current) {
        try {
          if (track.stop) track.stop();
          if (track.close) track.close();
        } catch (err) {
          console.warn('Error cleaning up track:', err);
        }
      }
      localTracksRef.current = [];
    }
    setLocalStream(null);
  }, []);

  // Leave call - FIXED to prevent automatic disconnection
  const leaveCall = useCallback(async () => {
    if (isJoiningRef.current) {
      console.log('⏳ Call join in progress, waiting...');
      return;
    }

    console.log('🚪 Leaving video call...');
    
    try {
      // Unpublish tracks
      if (localTracksRef.current.length > 0 && agoraClientRef.current) {
        await agoraClientRef.current.unpublish(localTracksRef.current).catch(console.error);
      }

      // Leave channel
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave().catch(console.error);
      }

      // Cleanup
      await cleanupTracks();

      // Reset state
      setRemoteUsers([]);
      setIsInCall(false);
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      setError(null);
      
      console.log('✅ Left video call successfully');
      
      if (onLeave) {
        onLeave();
      }
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  }, [onLeave, cleanupTracks]);

  // Control functions
  const toggleAudio = useCallback(async () => {
    if (localTracksRef.current[0]) {
      try {
        const newState = !isAudioMuted;
        await localTracksRef.current[0].setEnabled(newState);
        setIsAudioMuted(newState);
        console.log(newState ? '🔇 Audio muted' : '🎤 Audio unmuted');
      } catch (err) {
        console.error('Error toggling audio:', err);
      }
    }
  }, [isAudioMuted]);

  const toggleVideo = useCallback(async () => {
    if (localTracksRef.current[1]) {
      try {
        const newState = !isVideoMuted;
        await localTracksRef.current[1].setEnabled(newState);
        setIsVideoMuted(newState);
        console.log(newState ? '📷 Video disabled' : '📹 Video enabled');
      } catch (err) {
        console.error('Error toggling video:', err);
      }
    }
  }, [isVideoMuted]);

  // Auto-join with better mounting check
  useEffect(() => {
    let mounted = true;

    const initializeVideoCall = async () => {
      if (mounted && meetingId && user?.id && !isInCall && !isJoiningRef.current && isMountedRef.current) {
        console.log('🔄 Auto-initializing video call...');
        await startVideoCall();
      }
    };

    const timer = setTimeout(initializeVideoCall, 1000);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [meetingId, user?.id, isInCall, startVideoCall]);

  // Don't render if modal is not open
  if (!isOpen) {
    return null;
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-fullscreen video-call-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Starting video call...</p>
          <p className="loading-subtitle">Meeting: {meetingId}</p>
          <div className="debug-info">
            <p>User: {user?.id}</p>
            <p>Tab Active: {isVisible ? '✅' : '❌'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isInCall) {
    return (
      <div className="video-call-fullscreen video-call-error">
        <div className="error-message">
          <h3>Unable to Start Video Call</h3>
          <p>{error}</p>
          
          <div className="error-solutions">
            <h4>Quick Solutions:</h4>
            <ul>
              <li>• Refresh the page and allow permissions when prompted</li>
              <li>• Check if camera/microphone are being used by another app</li>
              <li>• Ensure stable internet connection</li>
              <li>• Try using Google Chrome browser</li>
            </ul>
          </div>

          <div className="error-actions">
            <button onClick={startVideoCall} className="retry-button">
              🔄 Try Again
            </button>
            <button onClick={leaveCall} className="leave-button">
              🏠 Leave
            </button>
          </div>

          <div className="debug-info" style={{marginTop: '20px', fontSize: '12px', opacity: '0.7'}}>
            <p>Meeting: {meetingId} | User: {user?.id} | Tab: {isVisible ? 'Active' : 'Background'}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalParticipants = remoteUsers.length + 1;

  return (
    <div className="video-call-fullscreen">
      {/* Header with connection status */}
      <div className="video-call-header">
        <div className="call-info">
          <h3>🔴 LIVE: {meetingId}</h3>
          <span className="participant-count">
            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
          </span>
          {!isVisible && <span className="tab-warning">⚠️ Tab in background</span>}
          <span className="quality-badge">HD Quality</span>
        </div>
        
        <div className="call-controls-top">
          {isTeacher && <span className="teacher-badge">👨‍🏫 Teacher</span>}
          <span className="connection-status">
            {isVisible ? '🟢 Connected' : '🟡 Background'}
          </span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="video-grid">
        {/* Local Video */}
        {localStream?.videoTrack && (
          <div className="video-tile local-video">
            <div 
              ref={el => {
                if (el) {
                  videoElementsRef.current.set('local', el);
                  playVideoTrack(localStream.videoTrack, el, 'local');
                }
              }}
              className="video-element"
              style={{ width: '100%', height: '100%', background: '#000' }}
            />
            <div className="video-overlay">
              <span className="user-name">You {isTeacher ? '(Teacher)' : ''}</span>
              <div className="status-indicators">
                {isAudioMuted && <span className="status-indicator muted">🔇</span>}
                {isVideoMuted && <span className="status-indicator video-off">📷</span>}
              </div>
            </div>
          </div>
        )}

        {/* Remote Users */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="video-tile remote-video">
            {user.videoTrack ? (
              <div 
                ref={el => {
                  if (el) {
                    videoElementsRef.current.set(user.uid, el);
                    playVideoTrack(user.videoTrack, el, user.uid);
                  }
                }}
                className="video-element"
                style={{ width: '100%', height: '100%', background: '#000' }}
              />
            ) : (
              <div className="video-placeholder">
                <div className="avatar">
                  <span>User {user.uid}</span>
                </div>
                <p>Camera Off</p>
              </div>
            )}
            <div className="video-overlay">
              <span className="user-name">User {user.uid}</span>
              <div className="status-indicators">
                {!user.hasAudio && <span className="status-indicator muted">🔇</span>}
                {!user.hasVideo && <span className="status-indicator video-off">📷</span>}
              </div>
            </div>
          </div>
        ))}

        {/* Debug Info - Only show in development */}
        {process.env.NODE_ENV === 'development' && isInCall && (
          <div className="debug-panel">
            <p>Local: {localStream ? '✅' : '❌'}</p>
            <p>Remote: {remoteUsers.length}</p>
            <p>Tab: {isVisible ? '✅' : '❌'}</p>
            <p>Audio: {isAudioMuted ? '🔇' : '🎤'}</p>
            <p>Video: {isVideoMuted ? '📷' : '📹'}</p>
          </div>
        )}

        {/* Empty state */}
        {isInCall && localStream && remoteUsers.length === 0 && (
          <div className="no-videos-message">
            <p>Waiting for other participants to join...</p>
            <p className="subtitle">Share this meeting ID: <strong>{meetingId}</strong></p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button
          onClick={toggleAudio}
          className={`control-button ${isAudioMuted ? 'muted' : ''}`}
          title={isAudioMuted ? 'Unmute' : 'Mute'}
        >
          {isAudioMuted ? '🔇' : '🎤'}
        </button>

        <button
          onClick={toggleVideo}
          className={`control-button ${isVideoMuted ? 'video-off' : ''}`}
          title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoMuted ? '📷 Off' : '📹 On'}
        </button>

        <button
          onClick={leaveCall}
          className="control-button leave-button"
          title="Leave call"
        >
          📞 Leave
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
