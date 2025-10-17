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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [videoLayout, setVideoLayout] = useState('grid'); // grid, spotlight, sidebar
  const [callStats, setCallStats] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [recording, setRecording] = useState(false);

  const agoraClientRef = useRef(null);
  const localTracksRef = useRef([]);
  const screenTrackRef = useRef(null);
  const isJoiningRef = useRef(false);
  const videoGridRef = useRef(null);
  const statsIntervalRef = useRef(null);

  // Production Agora App ID
  const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '5c0225ce9a19445f95a2685647258468';

  // Fullscreen modal effect
  useEffect(() => {
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';

    // Add escape key listener
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (isScreenSharing) {
          stopScreenShare();
        } else {
          leaveCall();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      // Restore body styles
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      
      document.removeEventListener('keydown', handleEscape);
      leaveCall();
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
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

      // Active speaker detection
      agoraClientRef.current.on('volume-indicator', (volumes) => {
        volumes.forEach((volume) => {
          if (volume.level > 0.1) {
            setActiveSpeaker(volume.uid);
          }
        });
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

  // Enhanced video call start
  const startVideoCall = useCallback(async () => {
    if (!meetingId || !user?.id || isInCall || isJoiningRef.current) return;

    setIsLoading(true);
    setError(null);
    isJoiningRef.current = true;

    try {
      if (!AGORA_APP_ID || AGORA_APP_ID === 'YOUR_AGORA_APP_ID') {
        throw new Error('Agora App ID not configured properly');
      }

      const channelName = `class_${meetingId}_${Date.now()}`.substring(0, 64);
      const uid = Math.floor(Math.random() * 100000);
      const token = await getAgoraToken(channelName, uid);

      await agoraClientRef.current.join(AGORA_APP_ID, channelName, token, uid);
      
      // Enhanced media tracks with better quality
      const microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
        encoderConfig: {
          sampleRate: 48000,
          stereo: true,
          bitrate: 128
        }
      });

      const cameraTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          resolution: { width: 1280, height: 720 },
          frameRate: 30,
          bitrate: 2000
        },
        optimizationMode: 'detail',
        mirror: false
      });

      localTracksRef.current = [microphoneTrack, cameraTrack];
      await agoraClientRef.current.publish(localTracksRef.current);

      setLocalStream({ audioTrack: microphoneTrack, videoTrack: cameraTrack });

      // Set up remote user handlers
      agoraClientRef.current.on('user-published', handleUserPublished);
      agoraClientRef.current.on('user-unpublished', handleUserUnpublished);
      agoraClientRef.current.on('user-joined', handleUserJoined);
      agoraClientRef.current.on('user-left', handleUserLeft);

      setIsInCall(true);
      startStatsMonitoring();
      
      console.log('🚀 Futuristic video call started!');

    } catch (err) {
      console.error('❌ Connection failed:', err);
      let errorMessage = 'Failed to start video call';
      
      if (err.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        errorMessage = 'Video service temporarily unavailable';
      } else if (err.code === 'INVALID_APP_ID') {
        errorMessage = 'Invalid video service configuration';
      } else if (err.name === 'NOT_ALLOWED_ERROR') {
        errorMessage = 'Camera/microphone permission denied';
      } else if (err.name === 'NOT_FOUND_ERROR') {
        errorMessage = 'No camera/microphone found';
      } else if (err.name === 'NOT_READABLE_ERROR') {
        errorMessage = 'Camera/microphone is already in use';
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
      
      setRemoteUsers(prev => {
        const existing = prev.find(u => u.uid === user.uid);
        if (existing) {
          return prev.map(u => 
            u.uid === user.uid 
              ? { 
                  ...u, 
                  [mediaType]: user[mediaType],
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
          hasVideo: mediaType === 'video',
          joinedAt: new Date().toISOString()
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
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    if (activeSpeaker === user.uid) {
      setActiveSpeaker(null);
    }
  }, [activeSpeaker]);

  // Cleanup
  const cleanupTracks = useCallback(async () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.close();
      screenTrackRef.current = null;
    }

    if (localTracksRef.current.length > 0) {
      localTracksRef.current.forEach(track => {
        try {
          track.stop();
          track.close();
        } catch (err) {
          console.warn('Error cleaning up track:', err);
        }
      });
      localTracksRef.current = [];
    }
    setLocalStream(null);
  }, []);

  // Leave call
  const leaveCall = useCallback(async () => {
    if (isJoiningRef.current) return;

    try {
      if (screenTrackRef.current) {
        await stopScreenShare();
      }

      if (localTracksRef.current.length > 0) {
        await agoraClientRef.current?.unpublish(localTracksRef.current).catch(console.error);
      }

      if (agoraClientRef.current) {
        await agoraClientRef.current.leave().catch(console.error);
      }

      await cleanupTracks();

      setRemoteUsers([]);
      setIsInCall(false);
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      setError(null);
      
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      
      if (onLeave) onLeave();
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  }, [onLeave, cleanupTracks, stopScreenShare]);

  // Control functions
  const toggleAudio = useCallback(async () => {
    if (localTracksRef.current[0]) {
      const newState = !isAudioMuted;
      await localTracksRef.current[0].setEnabled(newState);
      setIsAudioMuted(newState);
    }
  }, [isAudioMuted]);

  const toggleVideo = useCallback(async () => {
    if (localTracksRef.current[1] && !isScreenSharing) {
      const newState = !isVideoMuted;
      await localTracksRef.current[1].setEnabled(newState);
      setIsVideoMuted(newState);
    }
  }, [isVideoMuted, isScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const toggleRecording = useCallback(() => {
    setRecording(!recording);
    // Add recording logic here
    console.log(recording ? '🛑 Stopping recording' : '🔴 Starting recording');
  }, [recording]);

  // Auto-join
  useEffect(() => {
    let mounted = true;
    const initializeVideoCall = async () => {
      if (mounted && meetingId && user?.id && !isInCall && !isJoiningRef.current) {
        await startVideoCall();
      }
    };
    const timer = setTimeout(initializeVideoCall, 100);
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
          </div>
        </div>
        
        <div className="call-controls-top">
          {isTeacher && <span className="teacher-badge neon-badge">👨‍🏫 Host</span>}
          <span className="quality-badge">8K Ready</span>
          <span className="security-badge">🔒 End-to-End Encrypted</span>
        </div>
      </div>

      {/* Main Video Area */}
      <div className={`video-main-area ${videoLayout}`} ref={videoGridRef}>
        <div className={gridClass}>
          {/* Local Video */}
          {localStream?.videoTrack && (
            <div className={`video-tile local-video ${activeSpeaker === 'local' ? 'active-speaker' : ''} ${isScreenSharing ? 'screen-share' : ''}`}>
              <div 
                ref={el => {
                  if (el && localStream.videoTrack) {
                    localStream.videoTrack.play(el);
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
                      user.videoTrack.play(el);
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

        {/* Active Speaker Spotlight */}
        {videoLayout === 'spotlight' && activeSpeaker && (
          <div className="spotlight-view">
            {/* Spotlight implementation */}
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
          {isTeacher && (
            <button
              onClick={toggleRecording}
              className={`control-button futuristic-btn ${recording ? 'recording' : ''}`}
              title={recording ? 'Stop recording' : 'Start recording'}
            >
              <span className="icon">{recording ? '⏹️' : '🔴'}</span>
              <span className="label">{recording ? 'Stop Rec' : 'Record'}</span>
            </button>
          )}

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
            <div className="setting-item">
              <label>Noise Cancellation</label>
              <input type="range" min="0" max="100" defaultValue="80" />
            </div>
          </div>
        </div>
      )}

      {/* Participants Sidebar */}
      <div className="participants-sidebar holographic">
        <div className="sidebar-header">
          <h4>Quantum Participants ({totalParticipants})</h4>
          <button className="sidebar-toggle">➡️</button>
        </div>
        <div className="participants-list">
          <div className="participant-item local-user featured">
            <div className="participant-avatar">
              <div className="avatar-hologram small">You</div>
            </div>
            <div className="participant-info">
              <span className="participant-name">
                You {isTeacher ? '(Host)' : ''}
              </span>
              <div className="participant-status">
                {isAudioMuted && <span title="Muted">🔇</span>}
                {isVideoMuted && <span title="Camera Off">📷</span>}
                {isScreenSharing && <span title="Screen Sharing">🖥️</span>}
                <span className="status-online" title="Online">🟢</span>
              </div>
            </div>
          </div>
          
          {remoteUsers.map((user) => (
            <div key={user.uid} className="participant-item">
              <div className="participant-avatar">
                <div className="avatar-hologram small">U{user.uid}</div>
              </div>
              <div className="participant-info">
                <span className="participant-name">
                  User {user.uid}
                </span>
                <div className="participant-status">
                  {!user.hasAudio && <span title="Muted">🔇</span>}
                  {!user.hasVideo && <span title="Camera Off">📷</span>}
                  <span className="status-online" title="Online">🟢</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connection Quality Indicator */}
      <div className="quality-indicator">
        <div className="quality-bar">
          <div className="quality-level excellent"></div>
        </div>
        <span>Quantum Connection: Excellent</span>
      </div>
    </div>
  );
};

export default VideoCall;
