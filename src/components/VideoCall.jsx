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

  // Initialize Agora client
  useEffect(() => {
    if (!agoraClientRef.current) {
      agoraClientRef.current = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });
    }

    return () => {
      leaveCall();
    };
  }, []);

  // SIMPLE Agora connection - NO BACKEND REQUIRED
  const startVideoCall = useCallback(async () => {
    if (!meetingId || !user?.id || isInCall || isJoiningRef.current) return;

    setIsLoading(true);
    setError(null);
    isJoiningRef.current = true;

    try {
      console.log('🚀 STARTING SIMPLE VIDEO CALL...', { meetingId, userId: user.id });

      // Your Agora App ID
      const APP_ID = '5c0225ce9a19445f95a2685647258468';
      
      if (!APP_ID) {
        throw new Error('Agora App ID not configured');
      }

      // Generate a simple UID
      const uid = Math.floor(Math.random() * 100000);
      
      // Use the meetingId as channel name (ensure it's valid)
      const channelName = meetingId.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 64);

      console.log('🔗 Joining Agora channel...', { 
        appId: APP_ID, 
        channel: channelName, 
        uid 
      });

      // Join Agora channel with null token (works for testing)
      await agoraClientRef.current.join(APP_ID, channelName, null, uid);
      
      console.log('✅ Joined Agora channel successfully');

      // Create local tracks
      console.log('🎥 Creating local audio/video tracks...');
      const microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack().catch(err => {
        console.error('Failed to create microphone track:', err);
        throw new Error('Microphone access denied. Please allow microphone permissions.');
      });
      
      const cameraTrack = await AgoraRTC.createCameraVideoTrack().catch(err => {
        console.error('Failed to create camera track:', err);
        throw new Error('Camera access denied. Please allow camera permissions.');
      });

      localTracksRef.current = [microphoneTrack, cameraTrack];

      // Publish tracks to channel
      console.log('📤 Publishing tracks to channel...');
      await agoraClientRef.current.publish(localTracksRef.current);

      // Set up local video element
      const localStream = {
        audioTrack: microphoneTrack,
        videoTrack: cameraTrack
      };
      setLocalStream(localStream);

      // Set up event listeners for remote users
      agoraClientRef.current.on('user-published', handleUserPublished);
      agoraClientRef.current.on('user-unpublished', handleUserUnpublished);
      agoraClientRef.current.on('user-left', handleUserLeft);
      agoraClientRef.current.on('connection-state-change', (state) => {
        console.log('🔗 Agora connection state:', state);
      });

      setIsInCall(true);
      console.log('✅ Agora video call started successfully!');

    } catch (err) {
      console.error('❌ Agora connection failed:', err);
      
      let errorMessage = err.message || 'Failed to connect to video call';
      
      // Handle specific error cases
      if (err.name === 'NOT_READABLE' || err.message.includes('in use')) {
        errorMessage = 'Camera/microphone is already in use by another application';
      } else if (err.name === 'NOT_ALLOWED' || err.message.includes('permission')) {
        errorMessage = 'Camera/microphone permission denied. Please allow permissions in your browser.';
      } else if (err.message.includes('token') || err.message.includes('Token')) {
        errorMessage = 'Authentication failed. Please try again.';
      }
      
      setError(errorMessage);
      
      // Cleanup on error
      await cleanupTracks();
      
    } finally {
      setIsLoading(false);
      isJoiningRef.current = false;
    }
  }, [meetingId, user?.id, isInCall]);

  // Cleanup tracks only
  const cleanupTracks = useCallback(async () => {
    if (localTracksRef.current.length > 0) {
      localTracksRef.current.forEach(track => {
        track.stop();
        track.close();
      });
      localTracksRef.current = [];
    }
    setLocalStream(null);
  }, []);

  // Handle remote user publishing
  const handleUserPublished = useCallback(async (user, mediaType) => {
    try {
      console.log('👤 Remote user published:', user.uid, mediaType);
      
      await agoraClientRef.current.subscribe(user, mediaType);
      
      setRemoteUsers(prev => {
        const existing = prev.find(u => u.uid === user.uid);
        if (existing) {
          return prev.map(u => 
            u.uid === user.uid 
              ? { 
                  ...u, 
                  [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: user[mediaType === 'audio' ? 'audioTrack' : 'videoTrack'],
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

      // Play remote audio
      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play().catch(err => 
          console.warn('Could not auto-play remote audio:', err)
        );
      }
    } catch (err) {
      console.error('Error subscribing to remote user:', err);
    }
  }, []);

  const handleUserUnpublished = useCallback((user, mediaType) => {
    console.log('👤 Remote user unpublished:', user.uid, mediaType);
    
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
    console.log('👤 Remote user left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  }, []);

  // Leave call properly
  const leaveCall = useCallback(async () => {
    if (isJoiningRef.current) {
      console.log('⏳ Call join in progress, waiting...');
      return;
    }

    console.log('🚪 Leaving Agora call...');
    
    try {
      // Unpublish tracks first
      if (localTracksRef.current.length > 0) {
        await agoraClientRef.current?.unpublish(localTracksRef.current).catch(console.error);
      }

      // Leave channel
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave().catch(console.error);
      }

      // Cleanup tracks
      await cleanupTracks();

      // Reset state
      setRemoteUsers([]);
      setIsInCall(false);
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      setError(null);
      
      console.log('✅ Left Agora call successfully');
      
      if (onLeave) {
        onLeave();
      }
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  }, [onLeave, cleanupTracks]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (localTracksRef.current[0]) {
      try {
        await localTracksRef.current[0].setEnabled(!isAudioMuted);
        setIsAudioMuted(!isAudioMuted);
        console.log(isAudioMuted ? '🎤 Audio unmuted' : '🔇 Audio muted');
      } catch (err) {
        console.error('Error toggling audio:', err);
      }
    }
  }, [isAudioMuted]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (localTracksRef.current[1]) {
      try {
        await localTracksRef.current[1].setEnabled(!isVideoMuted);
        setIsVideoMuted(!isVideoMuted);
        console.log(isVideoMuted ? '📹 Video enabled' : '📷 Video disabled');
      } catch (err) {
        console.error('Error toggling video:', err);
      }
    }
  }, [isVideoMuted]);

  // Single join effect
  useEffect(() => {
    let mounted = true;

    const initializeVideoCall = async () => {
      if (mounted && meetingId && user?.id && !isInCall && !isJoiningRef.current) {
        await startVideoCall();
      }
    };

    initializeVideoCall();

    return () => {
      mounted = false;
    };
  }, [meetingId, user?.id, isInCall, startVideoCall]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Agora VideoCall State:', {
      meetingId,
      isInCall,
      isLoading,
      error,
      hasLocalStream: !!localStream,
      remoteUsers: remoteUsers.length,
      isTeacher,
      connectionState: agoraClientRef.current?.connectionState
    });
  }, [meetingId, isInCall, isLoading, error, localStream, remoteUsers.length, isTeacher]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-container video-call-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Starting video call...</p>
          <p className="loading-subtitle">No backend required - Direct Agora connection</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isInCall) {
    return (
      <div className="video-call-container video-call-error">
        <div className="error-message">
          <h3>Unable to start video call</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={startVideoCall} className="retry-button">
              Try Again
            </button>
            <button onClick={leaveCall} className="leave-button">
              Return to Dashboard
            </button>
          </div>
          {error.includes('permission') && (
            <div className="permission-help">
              <p><strong>Permission Help:</strong></p>
              <ul>
                <li>Check browser permissions for camera and microphone</li>
                <li>Ensure no other app is using your camera/microphone</li>
                <li>Refresh the page and try again</li>
              </ul>
            </div>
          )}
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
          <span className="agora-badge">Direct Agora Connection</span>
        </div>
        
        {isTeacher && (
          <div className="teacher-badge">
            👨‍🏫 Teacher
          </div>
        )}
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
              {isAudioMuted && <span className="mute-indicator">🔇</span>}
              {isVideoMuted && <span className="video-off-indicator">📷 Off</span>}
            </div>
          </div>
        )}

        {/* Remote Videos - REAL Agora users */}
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
                  User {user.uid}
                </div>
              </div>
            )}
            <div className="video-overlay">
              <span className="user-name">User {user.uid}</span>
              {!user.hasAudio && <span className="mute-indicator">🔇</span>}
              {!user.hasVideo && <span className="video-off-indicator">📷 Off</span>}
            </div>
          </div>
        ))}

        {/* Empty state when connecting */}
        {!localStream && remoteUsers.length === 0 && isInCall && (
          <div className="no-videos-message">
            <p>Waiting for participants to join...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button
          onClick={toggleAudio}
          className={`control-button ${isAudioMuted ? 'muted' : ''}`}
          title={isAudioMuted ? 'Unmute' : 'Mute'}
          disabled={!localStream}
        >
          {isAudioMuted ? '🔇' : '🎤'}
        </button>

        <button
          onClick={toggleVideo}
          className={`control-button ${isVideoMuted ? 'video-off' : ''}`}
          title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
          disabled={!localStream}
        >
          {isVideoMuted ? '📷 Off' : '📹'}
        </button>

        <button
          onClick={() => console.log('Screen share - implement using Agora')}
          className="control-button"
          title="Share screen"
          disabled={!localStream}
        >
          🖥️
        </button>

        <button
          onClick={leaveCall}
          className="control-button leave-button"
          title="Leave call"
        >
          📞 Leave
        </button>
      </div>

      {/* Participants List */}
      <div className="participants-sidebar">
        <h4>Participants ({remoteUsers.length + 1})</h4>
        <div className="participants-list">
          <div className="participant-item local-user">
            <span className="participant-name">
              You {isTeacher ? '(Teacher)' : ''}
              {isAudioMuted && ' 🔇'}
              {isVideoMuted && ' 📷'}
            </span>
          </div>
          {remoteUsers.map((user) => (
            <div key={user.uid} className="participant-item">
              <span className="participant-name">
                User {user.uid}
                {!user.hasAudio && ' 🔇'}
                {!user.hasVideo && ' 📷'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
