// components/VideoCall.js
import { useVideoCall } from '../hooks/useVideoCall'; // Adjust path based on your structure

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
  const { 
    startCall,
    joinCall, 
    leaveCall, 
    isLoading, 
    error, 
    isInCall,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    toggleScreenShare
  } = useVideoCall();

  // Single join effect with proper cleanup
  useEffect(() => {
    let mounted = true;

    const joinVideoCall = async () => {
      if (mounted && meetingId && user?.id && !isInCall) {
        console.log('🎬 Initializing video call...');
        
        try {
          // Use startCall for teachers, joinCall for students
          const result = isTeacher 
            ? await startCall(meetingId, user.id)
            : await joinCall(meetingId, user.id);
          
          if (mounted) {
            if (result.success) {
              console.log('✅ Video call initialized successfully');
            } else {
              console.error('❌ Video call initialization failed:', result.error);
            }
          }
        } catch (err) {
          console.error('❌ Video call error:', err);
        }
      }
    };

    joinVideoCall();

    return () => {
      mounted = false;
    };
  }, [meetingId, user?.id, isInCall, joinCall, startCall, isTeacher]);

  // Handle session end for teachers
  useEffect(() => {
    if (isTeacher && onSessionEnded && remoteUsers.length === 0 && isInCall) {
      console.log('👨‍🏫 Teacher ending session - no participants left');
      onSessionEnded();
    }
  }, [remoteUsers.length, isTeacher, isInCall, onSessionEnded]);

  // Handle leave call
  const handleLeaveCall = async () => {
    console.log('🚪 Leaving video call...');
    await leaveCall();
    
    if (onLeave) {
      onLeave();
    }
  };

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('Video call error:', error);
    }
  }, [error]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 VideoCall Debug State:', {
      meetingId,
      userId: user?.id,
      isInCall,
      isLoading,
      error,
      hasLocalVideo: !!localVideoTrack,
      hasLocalAudio: !!localAudioTrack,
      remoteUsersCount: remoteUsers.length,
      isTeacher
    });
  }, [meetingId, user?.id, isInCall, isLoading, error, localVideoTrack, localAudioTrack, remoteUsers.length, isTeacher]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-container video-call-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>{isTeacher ? 'Starting video call...' : 'Joining video call...'}</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isInCall) {
    return (
      <div className="video-call-container video-call-error">
        <div className="error-message">
          <h3>Unable to {isTeacher ? 'start' : 'join'} video call</h3>
          <p>{error.message || 'An unexpected error occurred'}</p>
          <button onClick={handleLeaveCall} className="leave-button">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container">
      {/* Header */}
      <div className="video-call-header">
        <div className="call-info">
          <h3>Meeting: {meetingId}</h3>
          <span className="participant-count">
            {remoteUsers.length + 1} participant{(remoteUsers.length + 1) !== 1 ? 's' : ''}
          </span>
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
        {localVideoTrack && (
          <div className="video-tile local-video">
            <video
              ref={video => {
                if (video && localVideoTrack) {
                  localVideoTrack.play(video);
                }
              }}
              autoPlay
              muted
              playsInline
            />
            <div className="video-overlay">
              <span className="user-name">You {isTeacher ? '(Teacher)' : ''}</span>
              {isAudioMuted && <span className="mute-indicator">🔇</span>}
              {isVideoMuted && <span className="video-off-indicator">📷 Off</span>}
            </div>
          </div>
        )}

        {/* Remote Videos */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="video-tile remote-video">
            {user.videoTrack && (
              <video
                ref={video => {
                  if (video && user.videoTrack) {
                    user.videoTrack.play(video);
                  }
                }}
                autoPlay
                playsInline
              />
            )}
            <div className="video-overlay">
              <span className="user-name">{user.name || `User ${user.uid}`}</span>
              {!user.hasAudio && <span className="mute-indicator">🔇</span>}
              {!user.hasVideo && <span className="video-off-indicator">📷 Off</span>}
            </div>
          </div>
        ))}

        {/* Screen Share */}
        {isScreenSharing && (
          <div className="video-tile screen-share">
            <div className="screen-share-indicator">
              <p>Screen sharing active</p>
            </div>
          </div>
        )}

        {/* Empty state when no videos */}
        {!localVideoTrack && remoteUsers.length === 0 && (
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
          onClick={toggleScreenShare}
          className={`control-button ${isScreenSharing ? 'sharing' : ''}`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          🖥️
        </button>

        <button
          onClick={handleLeaveCall}
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
          {/* Local user */}
          <div className="participant-item local-user">
            <span className="participant-name">
              You {isTeacher ? '(Teacher)' : ''}
              {isAudioMuted && ' 🔇'}
            </span>
          </div>
          
          {/* Remote users */}
          {remoteUsers.map((user) => (
            <div key={user.uid} className="participant-item">
              <span className="participant-name">
                {user.name || `User ${user.uid}`}
                {!user.hasAudio && ' 🔇'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
