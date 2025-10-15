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

  // REAL Agora connection
  const startVideoCall = useCallback(async () => {
    if (!meetingId || !user?.id || isInCall) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 CONNECTING TO AGORA...', { meetingId, userId: user.id });

      // Your Agora App ID - REPLACE WITH YOUR ACTUAL APP ID
      const APP_ID = 'YOUR_AGORA_APP_ID'; // Get from https://console.agora.io/
      
      // Generate token - In production, get this from your backend
      const token = null; // Or your token if you have one
      
      // Generate user ID
      const uid = Math.floor(Math.random() * 100000);

      console.log('🔗 Joining Agora channel...', { APP_ID, channel: meetingId, uid });

      // Join Agora channel
      await agoraClientRef.current.join(APP_ID, meetingId, token, uid);
      
      console.log('✅ Joined Agora channel successfully');

      // Create local tracks - FIXED: No duplicate variable declarations
      console.log('🎥 Creating local audio/video tracks...');
      const microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack();
      const cameraTrack = await AgoraRTC.createCameraVideoTrack();

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

      setIsInCall(true);
      console.log('✅ Agora video call started successfully!');

    } catch (err) {
      console.error('❌ Agora connection failed:', err);
      
      let errorMessage = 'Failed to connect to video call';
      if (err.name === 'NOT_READABLE') {
        errorMessage = 'Camera/microphone is already in use';
      } else if (err.name === 'NOT_ALLOWED') {
        errorMessage = 'Camera/microphone permission denied';
      } else if (err.message?.includes('APP_ID')) {
        errorMessage = 'Please set up your Agora App ID first';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, user?.id, isInCall]);

  // Handle remote user publishing
  const handleUserPublished = useCallback(async (user, mediaType) => {
    console.log('👤 Remote user published:', user.uid, mediaType);
    
    await agoraClientRef.current.subscribe(user, mediaType);
    
    setRemoteUsers(prev => {
      const existing = prev.find(u => u.uid === user.uid);
      if (existing) {
        return prev.map(u => 
          u.uid === user.uid 
            ? { ...u, [mediaType]: user[mediaType] }
            : u
        );
      }
      return [...prev, { 
        uid: user.uid, 
        [mediaType]: user[mediaType],
        audioTrack: mediaType === 'audio' ? user.audioTrack : null,
        videoTrack: mediaType === 'video' ? user.videoTrack : null
      }];
    });

    // Play remote audio
    if (mediaType === 'audio' && user.audioTrack) {
      user.audioTrack.play();
    }
  }, []);

  const handleUserUnpublished = useCallback((user, mediaType) => {
    console.log('👤 Remote user unpublished:', user.uid, mediaType);
    setRemoteUsers(prev => 
      prev.map(u => 
        u.uid === user.uid 
          ? { ...u, [mediaType]: null }
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
    console.log('🚪 Leaving Agora call...');
    
    try {
      // Unpublish and close local tracks
      if (localTracksRef.current.length > 0) {
        localTracksRef.current.forEach(track => {
          track.close();
        });
        localTracksRef.current = [];
      }

      // Leave channel
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave();
      }

      // Reset state
      setLocalStream(null);
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
  }, [onLeave]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (localTracksRef.current[0]) { // microphone track
      await localTracksRef.current[0].setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  }, [isAudioMuted]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (localTracksRef.current[1]) { // camera track
      await localTracksRef.current[1].setEnabled(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    }
  }, [isVideoMuted]);

  // Single join effect
  useEffect(() => {
    let mounted = true;

    const initializeVideoCall = async () => {
      if (mounted && meetingId && user?.id && !isInCall) {
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
      localStream: !!localStream,
      remoteUsers: remoteUsers.length,
      isTeacher
    });
  }, [meetingId, isInCall, isLoading, error, localStream, remoteUsers.length, isTeacher]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-container video-call-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Connecting to Agora video call...</p>
          <p className="loading-subtitle">This is REAL Agora connection</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isInCall) {
    return (
      <div className="video-call-container video-call-error">
        <div className="error-message">
          <h3>Agora Connection Failed</h3>
          <p>{error}</p>
          {error.includes('APP_ID') && (
            <div className="setup-instructions">
              <h4>Setup Required:</h4>
              <ol>
                <li>Go to <a href="https://console.agora.io/" target="_blank">Agora Console</a></li>
                <li>Create a project and get your App ID</li>
                <li>Replace 'YOUR_AGORA_APP_ID' in the code</li>
              </ol>
            </div>
          )}
          <div className="error-actions">
            <button onClick={startVideoCall} className="retry-button">
              Try Again
            </button>
            <button onClick={leaveCall} className="leave-button">
              Return to Dashboard
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
          <span className="agora-badge">Agora RTC</span>
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
                  User
                </div>
              </div>
            )}
            <div className="video-overlay">
              <span className="user-name">User {user.uid}</span>
              {!user.audioTrack && <span className="mute-indicator">🔇</span>}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {!localStream && remoteUsers.length === 0 && (
          <div className="no-videos-message">
            <p>Connecting to Agora...</p>
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
          {isVideoMuted ? '📷 Off' : '📹'}
        </button>

        <button
          onClick={() => console.log('Screen share - implement using Agora')}
          className="control-button"
          title="Share screen"
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
            </span>
          </div>
          {remoteUsers.map((user) => (
            <div key={user.uid} className="participant-item">
              <span className="participant-name">
                User {user.uid}
                {!user.audioTrack && ' 🔇'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
