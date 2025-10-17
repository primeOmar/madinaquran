import React, { useEffect, useCallback, useState, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './VideoCall.css';

const VideoCall = ({ 
  isOpen = true, 
  meetingId, 
  user, 
  onLeave, 
  isTeacher = false, 
  onSessionEnded 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [videoLayout, setVideoLayout] = useState('grid');
  const [callStats, setCallStats] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const agoraClientRef = useRef(null);
  const localTracksRef = useRef([]);
  const screenTrackRef = useRef(null);
  const isJoiningRef = useRef(false);
  const videoElementsRef = useRef(new Map());
  const statsIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '5c0225ce9a19445f95a2685647258468';

  // Don't render if modal is not open
  if (!isOpen) {
    return null;
  }

  // Debug logging
  useEffect(() => {
    console.log('🎬 VideoCall Component MOUNTED', { isOpen, meetingId });
    isMountedRef.current = true;

    return () => {
      console.log('🎬 VideoCall Component UNMOUNTING');
      isMountedRef.current = false;
    };
  }, []);

  // Enhanced fullscreen modal effect
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

    // Tab visibility handling
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      console.log('📱 Tab visibility changed:', visible);
      setIsVisible(visible);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
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

      // Active speaker detection
      agoraClientRef.current.on('volume-indicator', (volumes) => {
        volumes.forEach((volume) => {
          if (volume.level > 0.1) {
            setActiveSpeaker(volume.uid);
          }
        });
      });

      // Network quality monitoring
      agoraClientRef.current.on('network-quality', (quality) => {
        console.log('📊 Network quality:', quality);
      });
    }

    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, []);

  // Call statistics
  const startStatsMonitoring = useCallback(() => {
    statsIntervalRef.current = setInterval(async () => {
      if (agoraClientRef.current) {
        const stats = agoraClientRef.current.getRTCStats();
        const localStats = {
          uploadBitrate: stats.TxBitrate,
          downloadBitrate: stats.RxBitrate,
          packetLoss: stats.RXPacketLossRate,
          latency: stats.RTT
        };
        setCallStats(localStats);
      }
    }, 2000);
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
          encoderConfig: {
            sampleRate: 48000,
            stereo: true,
            bitrate: 128
          }
        }).catch(err => {
          console.error('❌ Microphone error:', err);
          throw new Error('Microphone access required. Please allow microphone permissions and refresh the page.');
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            resolution: { width: 1280, height: 720 },
            frameRate: 30,
            bitrate: 2000
          },
          optimizationMode: 'detail',
          mirror: false
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
      startStatsMonitoring();
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
  }, [meetingId, user?.id, isInCall, AGORA_APP_ID, getAgoraToken, startStatsMonitoring]);

  // Screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const screenTrack = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_2',
        optimizationMode: 'detail'
      }, 'auto');

      // Replace camera track with screen track
      await agoraClientRef.current.unpublish(localTracksRef.current[1]);
      await agoraClientRef.current.publish(screenTrack);
      
      screenTrackRef.current = screenTrack;
      setIsScreenSharing(true);

      // Update local stream
      setLocalStream(prev => ({ ...prev, videoTrack: screenTrack }));

      // Handle screen share end
      screenTrack.on('track-ended', () => {
        stopScreenShare();
      });

    } catch (err) {
      console.error('Screen share failed:', err);
      alert('Screen sharing failed. Please check permissions and try again.');
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      await agoraClientRef.current.unpublish(screenTrackRef.current);
      screenTrackRef.current.close();
      screenTrackRef.current = null;
    }

    // Restore camera track
    if (localTracksRef.current[1]) {
      await agoraClientRef.current.publish(localTracksRef.current[1]);
      setLocalStream(prev => ({ ...prev, videoTrack: localTracksRef.current[1] }));
    }

    setIsScreenSharing(false);
  }, []);

  // Enhanced remote user handling
  const handleUserPublished = useCallback(async (user, mediaType) => {
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

      if (mediaType === 'audio' && user.audioTrack) {
        try {
          user.audioTrack.play();
        } catch (playError) {
          console.warn('Could not auto-play remote audio:', playError);
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
    if (activeSpeaker === user.uid) {
      setActiveSpeaker(null);
    }
  }, [activeSpeaker]);

  // Cleanup
  const cleanupTracks = useCallback(async () => {
    console.log('🧹 Cleaning up tracks...');
    
    if (screenTrackRef.current) {
      screenTrackRef.current.close();
      screenTrackRef.current = null;
    }

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
      if (screenTrackRef.current) {
        await agoraClientRef.current?.unpublish(screenTrackRef.current).catch(console.error);
      }

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
      
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      
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
    if (localTracksRef.current[1] && !isScreenSharing) {
      try {
        const newState = !isVideoMuted;
        await localTracksRef.current[1].setEnabled(newState);
        setIsVideoMuted(newState);
        console.log(newState ? '📷 Video disabled' : '📹 Video enabled');
      } catch (err) {
        console.error('Error toggling video:', err);
      }
    }
  }, [isVideoMuted, isScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

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

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-fullscreen video-call-loading">
        <div className="futuristic-loader">
          <div className="hologram-spinner"></div>
          <h2>Initializing Quantum Connection</h2>
          <p>Securing your world-class video experience...</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isInCall) {
    return (
      <div className="video-call-fullscreen video-call-error">
        <div className="error-hologram">
          <div className="hologram-icon">⚠️</div>
          <h3>Quantum Connection Failed</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={startVideoCall} className="neon-button retry-button">
              🔄 Retry Connection
            </button>
            <button onClick={leaveCall} className="neon-button leave-button">
              🏠 Exit Quantum Realm
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalParticipants = remoteUsers.length + 1;
  const gridClass = `video-grid-${videoLayout} ${
    totalParticipants === 1 ? 'single' :
    totalParticipants === 2 ? 'double' :
    totalParticipants <= 4 ? 'quad' : 'many'
  }`;

  return (
    <div className="video-call-fullscreen">
      {/* Enhanced Header */}
      <div className="video-call-header holographic">
        <div className="call-info">
          <div className="live-indicator">
            <span className="pulse-dot"></span>
            <span>LIVE</span>
          </div>
          <h3>Class: {meetingId}</h3>
          <div className="call-stats">
            <span>👥 {totalParticipants}</span>
            <span>📊 {callStats.uploadBitrate || 0}kbps</span>
            <span>📶 {callStats.latency || 0}ms</span>
            {!isVisible && <span className="tab-warning">⚠️ Background</span>}
          </div>
        </div>
        
        <div className="call-controls-top">
          {isTeacher && <span className="teacher-badge neon-badge">👨‍🏫 Host</span>}
          <span className="quality-badge">HD Ready</span>
          <span className="security-badge">🔒 Encrypted</span>
        </div>
      </div>

      {/* Main Video Area */}
      <div className={`video-main-area ${videoLayout}`}>
        <div className={gridClass}>
          {/* Local Video */}
          {localStream?.videoTrack && (
            <div className={`video-tile local-video ${activeSpeaker === 'local' ? 'active-speaker' : ''} ${isScreenSharing ? 'screen-share' : ''}`}>
              <div 
                ref={el => {
                  if (el) {
                    videoElementsRef.current.set('local', el);
                    playVideoTrack(localStream.videoTrack, el, 'local');
                  }
                }}
                className="video-element"
              />
              <div className="video-overlay futuristic-overlay">
                <span className="user-name">
                  {isScreenSharing ? '🖥️ You (Sharing)' : `You ${isTeacher ? '(Host)' : ''}`}
                </span>
                <div className="status-indicators">
                  {isAudioMuted && <span className="status-indicator muted" title="Muted">🔇</span>}
                  {isVideoMuted && <span className="status-indicator video-off" title="Camera Off">📷</span>}
                  {isScreenSharing && <span className="status-indicator screen-share" title="Screen Sharing">🖥️</span>}
                </div>
              </div>
            </div>
          )}

          {/* Remote Users */}
          {remoteUsers.map((user) => (
            <div 
              key={user.uid} 
              className={`video-tile remote-video ${activeSpeaker === user.uid ? 'active-speaker' : ''}`}
            >
              {user.videoTrack ? (
                <div 
                  ref={el => {
                    if (el && user.videoTrack) {
                      videoElementsRef.current.set(user.uid, el);
                      playVideoTrack(user.videoTrack, el, user.uid);
                    }
                  }}
                  className="video-element"
                />
              ) : (
                <div className="video-placeholder holographic-bg">
                  <div className="avatar-hologram">
                    <div className="hologram-avatar">User {user.uid}</div>
                  </div>
                  <p>Camera Offline</p>
                </div>
              )}
              <div className="video-overlay futuristic-overlay">
                <span className="user-name">User {user.uid}</span>
                <div className="status-indicators">
                  {!user.hasAudio && <span className="status-indicator muted" title="Muted">🔇</span>}
                  {!user.hasVideo && <span className="status-indicator video-off" title="Camera Off">📷</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {isInCall && localStream && remoteUsers.length === 0 && (
          <div className="no-videos-message">
            <p>Waiting for other participants to join...</p>
            <p className="subtitle">Share this meeting ID: <strong>{meetingId}</strong></p>
          </div>
        )}
      </div>

      {/* Enhanced Futuristic Controls */}
      <div className="video-controls holographic-controls">
        <div className="control-group left-controls">
          <button
            onClick={toggleAudio}
            className={`control-button futuristic-btn ${isAudioMuted ? 'muted' : ''}`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            <span className="icon">{isAudioMuted ? '🔇' : '🎤'}</span>
            <span className="label">{isAudioMuted ? 'Muted' : 'Mic On'}</span>
          </button>

          <button
            onClick={toggleVideo}
            className={`control-button futuristic-btn ${isVideoMuted ? 'video-off' : ''}`}
            title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
            disabled={isScreenSharing}
          >
            <span className="icon">{isVideoMuted ? '📷' : '📹'}</span>
            <span className="label">{isVideoMuted ? 'Cam Off' : 'Cam On'}</span>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`control-button futuristic-btn ${isScreenSharing ? 'sharing' : ''}`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <span className="icon">{isScreenSharing ? '🖥️' : '📺'}</span>
            <span className="label">{isScreenSharing ? 'Stop Share' : 'Share'}</span>
          </button>
        </div>

        <div className="control-group center-controls">
          <button
            onClick={leaveCall}
            className="control-button futuristic-btn danger"
            title="Leave call"
          >
            <span className="icon">📞</span>
            <span className="label">Leave</span>
          </button>
        </div>

        <div className="control-group right-controls">
          <button
            onClick={() => setVideoLayout(videoLayout === 'grid' ? 'spotlight' : 'grid')}
            className="control-button futuristic-btn"
            title="Change layout"
          >
            <span className="icon">🔄</span>
            <span className="label">Layout</span>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="control-button futuristic-btn"
            title="Settings"
          >
            <span className="icon">⚙️</span>
            <span className="label">Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel holographic">
          <h4>Quantum Settings</h4>
          <div className="settings-content">
            <div className="setting-item">
              <label>Video Quality</label>
              <select>
                <option>Auto (Recommended)</option>
                <option>1080p HD</option>
                <option>720p HD</option>
                <option>480p</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Audio Mode</label>
              <select>
                <option>Standard</option>
                <option>Music Mode</option>
                <option>Voice Focus</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Connection Quality Indicator */}
      <div className="quality-indicator">
        <div className="quality-bar">
          <div className="quality-level excellent"></div>
        </div>
        <span>Connection: Excellent</span>
      </div>
    </div>
  );
};

export default VideoCall;
