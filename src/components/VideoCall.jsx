import React, { useEffect, useCallback, useState, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
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

  // Production Agora App ID
  const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '5c0225ce9a19445f95a2685647258468';

  // Debug logging
  useEffect(() => {
    console.log('🔍 VIDEO CALL DEBUG STATE:', {
      isLoading,
      isInCall,
      localStream: !!localStream,
      remoteUsers: remoteUsers.length,
      error,
      isVisible
    });
  }, [isLoading, isInCall, localStream, remoteUsers, error, isVisible]);

  // Tab visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      console.log('📱 Tab visibility changed:', visible);
      setIsVisible(visible);
      
      if (visible && isInCall) {
        // Resume tracks when tab becomes visible
        resumeTracks();
      } else if (!visible && isInCall) {
        // Pause tracks when tab is hidden (optional)
        pauseTracks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isInCall]);

  // Fullscreen modal effect
  useEffect(() => {
    // Prevent body scroll
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
      leaveCall();
    };
  }, []);

  // Initialize Agora client
  useEffect(() => {
    if (!agoraClientRef.current) {
      agoraClientRef.current = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });
      
      agoraClientRef.current.on('exception', (event) => {
        console.warn('Agora exception:', event);
      });
    }

    return () => {
      leaveCall();
    };
  }, []);

  // Track management functions
  const pauseTracks = useCallback(() => {
    console.log('⏸️ Pausing tracks due to tab change');
    localTracksRef.current.forEach(track => {
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

  // Enhanced video playback with error handling
  const playVideoTrack = useCallback((track, element, uid) => {
    if (!track || !element) {
      console.warn('❌ Cannot play track: missing track or element');
      return;
    }

    try {
      console.log(`🎬 Attempting to play video for user ${uid}`);
      track.play(element, { 
        fit: 'cover',
        mirror: uid === 'local'
      }).then(() => {
        console.log(`✅ Successfully playing video for user ${uid}`);
      }).catch(playError => {
        console.error(`❌ Failed to play video for user ${uid}:`, playError);
        
        // Retry with user interaction
        const retryPlay = () => {
          track.play(element, { fit: 'cover' }).catch(e => {
            console.error(`❌ Retry failed for user ${uid}:`, e);
          });
          document.removeEventListener('click', retryPlay);
        };
        
        document.addEventListener('click', retryPlay);
      });
    } catch (error) {
      console.error(`❌ Error in playVideoTrack for user ${uid}:`, error);
    }
  }, []);

  // Generate token
  const getAgoraToken = useCallback(async (channelName, uid) => {
    try {
      const response = await fetch('https://madina-quran-backend.onrender.com/api/agora/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid, role: 'publisher' })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.token;
      }
    } catch (error) {
      console.warn('Failed to get token from backend, using null token');
    }
    return null;
  }, []);

  // Debugged video call start
  const startVideoCall = useCallback(async () => {
    if (!meetingId || !user?.id || isInCall || isJoiningRef.current) {
      console.log('⏸️ Start call prevented:', { meetingId, userId: user?.id, isInCall, isJoining: isJoiningRef.current });
      return;
    }

    setIsLoading(true);
    setError(null);
    isJoiningRef.current = true;

    try {
      console.log('🚀 STARTING VIDEO CALL DEBUG...');

      if (!AGORA_APP_ID) {
        throw new Error('Agora App ID not configured');
      }

      const channelName = `class_${meetingId}`;
      const uid = String(Math.floor(Math.random() * 100000));

      console.log('🔗 Agora setup:', { 
        appId: AGORA_APP_ID?.substring(0, 10) + '...', 
        channel: channelName, 
        uid 
      });

      const token = await getAgoraToken(channelName, uid);

      // Join channel
      console.log('🔗 Joining channel...');
      await agoraClientRef.current.join(AGORA_APP_ID, channelName, token, uid);
      console.log('✅ Joined channel successfully');

      // Create local tracks with better error handling
      console.log('🎥 Creating local tracks...');
      
      let microphoneTrack, cameraTrack;
      
      try {
        microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          encoderConfig: {
            sampleRate: 48000,
            stereo: true
          }
        });
        console.log('✅ Microphone track created');
      } catch (micError) {
        console.error('❌ Microphone error:', micError);
        throw new Error('Microphone access required. Please allow microphone permissions.');
      }

      try {
        cameraTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '720p_1',
          optimizationMode: 'motion'
        });
        console.log('✅ Camera track created');
      } catch (camError) {
        console.error('❌ Camera error:', camError);
        throw new Error('Camera access required. Please allow camera permissions.');
      }

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
      
      let errorMessage = 'Failed to start video call';
      
      if (err.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.code === 'INVALID_APP_ID') {
        errorMessage = 'Invalid app configuration. Please contact support.';
      } else if (err.name === 'NOT_ALLOWED_ERROR') {
        errorMessage = 'Camera/microphone permission denied. Please allow browser permissions.';
      } else if (err.name === 'NOT_FOUND_ERROR') {
        errorMessage = 'No camera/microphone detected.';
      } else if (err.name === 'NOT_READABLE_ERROR') {
        errorMessage = 'Camera/microphone is busy with another application.';
      } else if (err.message) {
        errorMessage = err.message;
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

      // Auto-play audio with user interaction requirement
      if (mediaType === 'audio' && user.audioTrack) {
        try {
          user.audioTrack.play();
        } catch (playError) {
          console.warn('Audio autoplay blocked:', playError);
        }
      }

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
          track.stop();
          track.close();
        } catch (err) {
          console.warn('Error cleaning up track:', err);
        }
      }
      localTracksRef.current = [];
    }
    setLocalStream(null);
  }, []);

  // Leave call
  const leaveCall = useCallback(async () => {
    if (isJoiningRef.current) {
      console.log('⏳ Call join in progress, waiting...');
      return;
    }

    console.log('🚪 Leaving video call...');
    
    try {
      // Unpublish tracks
      if (localTracksRef.current.length > 0) {
        await agoraClientRef.current?.unpublish(localTracksRef.current).catch(console.error);
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

  // Auto-join with better error handling
  useEffect(() => {
    let mounted = true;

    const initializeVideoCall = async () => {
      if (mounted && meetingId && user?.id && !isInCall && !isJoiningRef.current) {
        console.log('🔄 Auto-initializing video call...');
        await startVideoCall();
      }
    };

    // Small delay to ensure component is mounted and permissions are ready
    const timer = setTimeout(initializeVideoCall, 500);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [meetingId, user?.id, isInCall, startVideoCall]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-fullscreen video-call-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Starting video call...</p>
          <p className="loading-subtitle">Checking permissions...</p>
          <div className="debug-info">
            <p>Meeting: {meetingId}</p>
            <p>User: {user?.id}</p>
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
              <li>• Allow camera & microphone permissions</li>
              <li>• Refresh the page and try again</li>
              <li>• Check if another app is using camera</li>
              <li>• Try a different browser (Chrome recommended)</li>
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
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-fullscreen">
      {/* Header */}
      <div className="video-call-header">
        <div className="call-info">
          <h3>🔴 LIVE: {meetingId}</h3>
          <span className="participant-count">
            {remoteUsers.length + 1} participant{(remoteUsers.length + 1) !== 1 ? 's' : ''}
          </span>
          {!isVisible && <span className="tab-warning">⚠️ Tab not active</span>}
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

        {/* Debug Info */}
        {isInCall && (
          <div className="debug-panel">
            <p>Local Stream: {localStream ? '✅' : '❌'}</p>
            <p>Remote Users: {remoteUsers.length}</p>
            <p>Tab Active: {isVisible ? '✅' : '❌'}</p>
          </div>
        )}

        {/* Empty state */}
        {!localStream && remoteUsers.length === 0 && isInCall && (
          <div className="no-videos-message">
            <p>Waiting for participants to join...</p>
            <p className="subtitle">Share meeting ID: <strong>{meetingId}</strong></p>
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
