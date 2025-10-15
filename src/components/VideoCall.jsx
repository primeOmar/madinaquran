const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
  const { 
    joinCall, 
    leaveCall, 
    isLoading, 
    error, 
    isInCall,
    participants,
    localStream,
    remoteStreams,
    screenShareStream,
    isMuted,
    isVideoOff,
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
        const result = await joinCall(meetingId, user.id);
        
        if (mounted) {
          if (result.success) {
            console.log('✅ Video call initialized successfully');
          } else {
            console.error('❌ Video call initialization failed:', result.error);
          }
        }
      }
    };

    joinVideoCall();

    return () => {
      mounted = false;
    };
  }, [meetingId, user?.id, isInCall, joinCall]);

  // Handle session end for teachers
  useEffect(() => {
    if (isTeacher && onSessionEnded && participants.length === 0 && isInCall) {
      console.log('👨‍🏫 Teacher ending session - no participants left');
      onSessionEnded();
    }
  }, [participants.length, isTeacher, isInCall, onSessionEnded]);

  // Handle leave call
  const handleLeaveCall = async () => {
    console.log('🚪 Leaving video call...');
    await leaveCall();
    
    // Clean up local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (onLeave) {
      onLeave();
    }
  };

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('Video call error:', error);
      // You could show a toast notification here
    }
  }, [error]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="video-call-container video-call-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Joining video call...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isInCall) {
    return (
      <div className="video-call-container video-call-error">
        <div className="error-message">
          <h3>Unable to join video call</h3>
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
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
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
        {localStream && (
          <div className="video-tile local-video">
            <video
              ref={video => {
                if (video) video.srcObject = localStream;
              }}
              autoPlay
              muted
              playsInline
            />
            <div className="video-overlay">
              <span className="user-name">You {isTeacher ? '(Teacher)' : ''}</span>
              {isMuted && <span className="mute-indicator">🔇</span>}
            </div>
          </div>
        )}

        {/* Remote Videos */}
        {remoteStreams.map((stream, index) => (
          <div key={stream.id || index} className="video-tile remote-video">
            <video
              ref={video => {
                if (video) video.srcObject = stream;
              }}
              autoPlay
              playsInline
            />
            <div className="video-overlay">
              <span className="user-name">Participant {index + 1}</span>
            </div>
          </div>
        ))}

        {/* Screen Share */}
        {screenShareStream && (
          <div className="video-tile screen-share">
            <video
              ref={video => {
                if (video) video.srcObject = screenShareStream;
              }}
              autoPlay
              playsInline
            />
            <div className="video-overlay">
              <span className="user-name">Screen Share</span>
            </div>
          </div>
        )}

        {/* Empty state when no videos */}
        {!localStream && remoteStreams.length === 0 && (
          <div className="no-videos-message">
            <p>Waiting for participants to join...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button
          onClick={toggleAudio}
          className={`control-button ${isMuted ? 'muted' : ''}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          onClick={toggleVideo}
          className={`control-button ${isVideoOff ? 'video-off' : ''}`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? '📷 Off' : '📹'}
        </button>

        <button
          onClick={toggleScreenShare}
          className="control-button share-button"
          title="Share screen"
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
        <h4>Participants ({participants.length})</h4>
        <div className="participants-list">
          {participants.map((participant, index) => (
            <div key={participant.id || index} className="participant-item">
              <span className="participant-name">
                {participant.name || `Participant ${index + 1}`}
                {participant.isTeacher && ' 👨‍🏫'}
              </span>
              {participant.isTalking && <span className="talking-indicator">🎤</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
