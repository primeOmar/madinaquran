import React, { useEffect, useCallback, useState } from 'react';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Simple mock API call that doesn't require backend
  const mockStartVideoSession = useCallback(async (classId, userId) => {
    console.log('🎯 MOCK: Starting video session with:', { classId, userId });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock Agora config
    return {
      success: true,
      appId: 'mock-app-id', // This would be your actual Agora App ID
      channel: classId,
      token: 'mock-token', // In real app, get from backend
      uid: Math.floor(Math.random() * 100000),
      meetingId: classId
    };
  }, []);

  const mockJoinVideoSession = useCallback(async (meetingId, userId) => {
    console.log('🎯 MOCK: Joining video session with:', { meetingId, userId });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock Agora config
    return {
      success: true,
      appId: 'mock-app-id',
      channel: meetingId,
      token: 'mock-token',
      uid: Math.floor(Math.random() * 100000),
      meetingId: meetingId
    };
  }, []);

  // Start video call without backend dependency
  const startVideoCall = useCallback(async () => {
    if (!meetingId || !user?.id || isInCall) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 Starting video call...', { meetingId, userId: user.id });

      // Get user media first (camera and microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setLocalStream(stream);
      setIsInCall(true);
      
      console.log('✅ Video call started successfully');
      
      // Simulate other participants joining (for demo purposes)
      setTimeout(() => {
        setRemoteStreams(prev => [...prev, 
          { id: 'remote-1', name: 'Student 1' },
          { id: 'remote-2', name: 'Student 2' }
        ]);
      }, 3000);

    } catch (err) {
      console.error('❌ Failed to start video call:', err);
      
      let errorMessage = 'Failed to start video call';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone permission denied';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is already in use';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, user?.id, isInCall]);

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

  // Handle leave call
  const handleLeaveCall = useCallback(async () => {
    console.log('🚪 Leaving video call...');
    
    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Reset state
    setLocalStream(null);
    setRemoteStreams([]);
    setIsInCall(false);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setError(null);
    
    if (onLeave) {
      onLeave();
    }
  }, [localStream, onLeave]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  }, [localStream, isAudioMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(!isVideoMuted);
    }
  }, [localStream, isVideoMuted]);

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
      hasLocalStream: !!localStream,
      remoteStreamsCount: remoteStreams.length,
      isTeacher
    });
  }, [meetingId, user?.id, isInCall, isLoading, error, localStream, remoteStreams.length, isTeacher]);

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
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={startVideoCall} className="retry-button">
              Try Again
            </button>
            <button onClick={handleLeaveCall} className="leave-button">
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
          <h3>Meeting: {meetingId}</h3>
          <span className="participant-count">
            {remoteStreams.length + 1} participant{(remoteStreams.length + 1) !== 1 ? 's' : ''}
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
              {isAudioMuted && <span className="mute-indicator">🔇</span>}
              {isVideoMuted && <span className="video-off-indicator">📷 Off</span>}
            </div>
          </div>
        )}

        {/* Remote Videos (mock for demo) */}
        {remoteStreams.map((stream) => (
          <div key={stream.id} className="video-tile remote-video">
            <div className="video-placeholder">
              <div className="avatar">
                {stream.name.charAt(0)}
              </div>
              <p>{stream.name}</p>
            </div>
            <div className="video-overlay">
              <span className="user-name">{stream.name}</span>
            </div>
          </div>
        ))}

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
          onClick={() => console.log('Screen share not implemented in demo')}
          className="control-button"
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
        <h4>Participants ({remoteStreams.length + 1})</h4>
        <div className="participants-list">
          {/* Local user */}
          <div className="participant-item local-user">
            <span className="participant-name">
              You {isTeacher ? '(Teacher)' : ''}
              {isAudioMuted && ' 🔇'}
            </span>
          </div>
          
          {/* Remote users */}
          {remoteStreams.map((stream) => (
            <div key={stream.id} className="participant-item">
              <span className="participant-name">
                {stream.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
