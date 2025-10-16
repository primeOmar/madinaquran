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

  const agoraClientRef = useRef(null);
  const localTracksRef = useRef([]);
  const isJoiningRef = useRef(false);

  // Production Agora App ID - Get from environment variables
  const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '5c0225ce9a19445f95a2685647258468';

  // Initialize Agora client
  useEffect(() => {
    if (!agoraClientRef.current) {
      agoraClientRef.current = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });
      
      // Set better error handling
      agoraClientRef.current.on('exception', (event) => {
        console.warn('Agora exception:', event);
      });
    }

    return () => {
      leaveCall();
    };
  }, []);

  // Generate token from backend or use temp token
  const getAgoraToken = useCallback(async (channelName, uid) => {
    try {
      // Try to get token from your backend
      const response = await fetch('https://madina-quran-backend.onrender.com/api/agora/generate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName,
          uid,
          role: 'publisher'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.token;
      }
    } catch (error) {
      console.warn('Failed to get token from backend, using null token');
    }
    
    // Return null for testing (Agora allows this in low-security environments)
    return null;
  }, []);

  // Production Agora connection
  const startVideoCall = useCallback(async () => {
    if (!meetingId || !user?.id || isInCall || isJoiningRef.current) return;

    setIsLoading(true);
    setError(null);
    isJoiningRef.current = true;

    try {
      console.log('🚀 STARTING PRODUCTION VIDEO CALL...', { meetingId, userId: user.id });

      // Validate App ID
      if (!AGORA_APP_ID || AGORA_APP_ID === 'YOUR_AGORA_APP_ID') {
        throw new Error('Agora App ID not configured properly');
      }

      // Generate unique channel name
      const channelName = `class_${meetingId}_${Date.now()}`.substring(0, 64);
      const uid = Math.floor(Math.random() * 100000);

      console.log('🔗 Production Agora setup:', { 
        appId: AGORA_APP_ID?.substring(0, 10) + '...', 
        channel: channelName, 
        uid 
      });

      // Get token
      const token = await getAgoraToken(channelName, uid);

      // Join channel with proper error handling
      console.log('🔗 Joining Agora channel...');
      await agoraClientRef.current.join(AGORA_APP_ID, channelName, token, uid);
      
      console.log('✅ Joined Agora channel successfully');

      // Create and publish local tracks
      console.log('🎥 Setting up local media...');
      
      const microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, // Acoustic Echo Cancellation
        ANS: true  // Automatic Noise Suppression
      }).catch(err => {
        console.error('Microphone error:', err);
        throw new Error('Microphone access required for video calls');
      });

      const cameraTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: '720p_1', // HD quality
        optimizationMode: 'motion' // Better for video calls
      }).catch(err => {
        console.error('Camera error:', err);
        throw new Error('Camera access required for video calls');
      });

      localTracksRef.current = [microphoneTrack, cameraTrack];

      // Publish tracks
      console.log('📤 Publishing tracks...');
      await agoraClientRef.current.publish(localTracksRef.current);

      // Set up local video
      const localStream = {
        audioTrack: microphoneTrack,
        videoTrack: cameraTrack
      };
      setLocalStream(localStream);

      // Set up remote user handlers
      agoraClientRef.current.on('user-published', handleUserPublished);
      agoraClientRef.current.on('user-unpublished', handleUserUnpublished);
      agoraClientRef.current.on('user-joined', handleUserJoined);
      agoraClientRef.current.on('user-left', handleUserLeft);

      setIsInCall(true);
      console.log('✅ Production video call started successfully!');

    } catch (err) {
      console.error('❌ Production Agora connection failed:', err);
      
      let errorMessage = 'Failed to start video call';
      
      if (err.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        errorMessage = 'Video service temporarily unavailable. Please check your Agora App ID configuration.';
      } else if (err.code === 'INVALID_APP_ID') {
        errorMessage = 'Invalid video service configuration. Please contact support.';
      } else if (err.name === 'NOT_ALLOWED_ERROR') {
        errorMessage = 'Camera/microphone permission denied. Please allow browser permissions.';
      } else if (err.name === 'NOT_FOUND_ERROR') {
        errorMessage = 'No camera/microphone found. Please check your device.';
      } else if (err.name === 'NOT_READABLE_ERROR') {
        errorMessage = 'Camera/microphone is already in use by another application.';
      }
      
      setError(errorMessage);
      
      // Cleanup on error
      await cleanupTracks();
      
    } finally {
      setIsLoading(false);
      isJoiningRef.current = false;
    }
  }, [meetingId, user?.id, isInCall, AGORA_APP_ID, getAgoraToken]);

  // Enhanced remote user handling
  const handleUserPublished = useCallback(async (user, mediaType) => {
    try {
      console.log('👤 User published:', user.uid, mediaType);
      
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

      // Play remote audio with error handling
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

  const handleUserJoined = useCallback((user) => {
    console.log('👤 User joined:', user.uid);
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

  const handleUserLeft = useCallback((user) => {
    console.log('👤 User left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  }, []);

  // Cleanup tracks
  const cleanupTracks = useCallback(async () => {
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

  // Toggle audio with better feedback
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

  // Toggle video with better feedback
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

  // Auto-join effect
  useEffect(() => {
    let mounted = true;

    const initializeVideoCall = async () => {
      if (mounted && meetingId && user?.id && !isInCall && !isJoiningRef.current) {
        await startVideoCall();
      }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(initializeVideoCall, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [meetingId, user?.id, isInCall, startVideoCall]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-container video-call-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Starting world-class video call...</p>
          <p className="loading-subtitle">Powered by Agora RTC</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isInCall) {
    return (
      <div className="video-call-container video-call-error">
        <div className="error-message">
          <h3>Unable to Start Video Call</h3>
          <p>{error}</p>
          
          <div className="error-solutions">
            <h4>Quick Solutions:</h4>
            <ul>
              <li>• Refresh the page and try again</li>
              <li>• Check camera/microphone permissions</li>
              <li>• Ensure stable internet connection</li>
              <li>• Try a different browser</li>
            </ul>
          </div>

          <div className="error-actions">
            <button onClick={startVideoCall} className="retry-button">
              🔄 Try Again
            </button>
            <button onClick={leaveCall} className="leave-button">
              🏠 Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container">
      {/* Header */}
      <div className="video-call-header">
        <div className="call-info">
          <h3>🔴 LIVE: {meetingId}</h3>
          <span className="participant-count">
            {remoteUsers.length + 1} participant{(remoteUsers.length + 1) !== 1 ? 's' : ''}
          </span>
          <span className="quality-badge">HD Quality</span>
        </div>
        
        <div className="call-controls-top">
          {isTeacher && <span className="teacher-badge">👨‍🏫 Teacher</span>}
          <span className="connection-status">🟢 Connected</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="video-grid">
        {/* Local Video */}
        {localStream?.videoTrack && (
          <div className="video-tile local-video">
            <div 
              ref={el => {
                if (el && localStream.videoTrack) {
                  localStream.videoTrack.play(el);
                }
              }}
              style={{ width: '100%', height: '100%' }}
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
                  if (el && user.videoTrack) {
                    user.videoTrack.play(el);
                  }
                }}
                style={{ width: '100%', height: '100%' }}
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

        {/* Empty state */}
        {!localStream && remoteUsers.length === 0 && isInCall && (
          <div className="no-videos-message">
            <p>Waiting for participants to join...</p>
            <p className="subtitle">Share this meeting ID with others: <strong>{meetingId}</strong></p>
          </div>
        )}
      </div>

      {/* Enhanced Controls */}
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

      {/* Participants Sidebar */}
      <div className="participants-sidebar">
        <h4>Participants ({remoteUsers.length + 1})</h4>
        <div className="participants-list">
          <div className="participant-item local-user">
            <span className="participant-name">
              You {isTeacher ? '(Teacher)' : ''}
            </span>
            <div className="participant-status">
              {isAudioMuted && <span>🔇</span>}
              {isVideoMuted && <span>📷</span>}
              <span className="status-online">🟢</span>
            </div>
          </div>
          
          {remoteUsers.map((user) => (
            <div key={user.uid} className="participant-item">
              <span className="participant-name">
                User {user.uid}
              </span>
              <div className="participant-status">
                {!user.hasAudio && <span>🔇</span>}
                {!user.hasVideo && <span>📷</span>}
                <span className="status-online">🟢</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
