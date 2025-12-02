import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from '../lib/agora/videoApi';
import './TeacherVideoCall.css';

const TeacherVideoCall = ({ classId, teacherId, onEndCall }) => {
  // State Management
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [participants, setParticipants] = useState([]);
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    screenSharing: false,
    recording: false,
    isChatOpen: false,
    isParticipantsOpen: false
  });

  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown'
  });

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Refs
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatInputRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());

  // ============================================
  // Initialization
  // ============================================

  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, teacherId]);

  const initializeSession = async () => {
    try {
      console.log('🚀 Initializing video session...');
      
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      const sessionData = await videoApi.startVideoSession(classId, teacherId);
      
      console.log('📊 Session Data:', sessionData);
      
      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to start session');
      }

      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: sessionData,
        error: null
      });

      await joinChannel(sessionData);

    } catch (error) {
      console.error('❌ Initialization error:', error);
      setSessionState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize video session'
      }));
    }
  };

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;
      
      if (!channel || !token || !appId) {
        throw new Error('Missing required session credentials');
      }
      
      console.log('🔗 Joining channel:', { channel, appId });
      
      setupAgoraEventListeners();
      
      await clientRef.current.join(appId, channel, token, uid);
      console.log('✅ Successfully joined channel');

      // Create audio track
      let audioTrack = null;
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        console.log('🎤 Audio track created');
      } catch (audioError) {
        console.warn('Could not create audio track:', audioError);
      }

      // Create video track
      let videoTrack = null;
      try {
        videoTrack = await AgoraRTC.createCameraVideoTrack();
        console.log('📹 Video track created');
        
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
      } catch (videoError) {
        console.warn('Could not create video track:', videoError);
      }

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Publish tracks
      if (audioTrack || videoTrack) {
        const tracksToPublish = [];
        if (audioTrack) tracksToPublish.push(audioTrack);
        if (videoTrack) tracksToPublish.push(videoTrack);
        
        await clientRef.current.publish(tracksToPublish);
        console.log('📤 Published tracks');
      }

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      // Start tracking
      startDurationTracking();
      
      const meetingId = sessionData.meetingId || sessionData.meeting_id;
      if (meetingId) {
        startParticipantTracking(meetingId);
      }

    } catch (error) {
      console.error('❌ Join channel error:', error);
      throw error;
    }
  };

  // ============================================
  // FIXED Button Functions
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      try {
        const newState = !controls.audioEnabled;
        await localTracks.audio.setEnabled(newState);
        setControls(prev => ({ ...prev, audioEnabled: newState }));
        console.log(`🔊 Audio ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Toggle audio error:', error);
      }
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      try {
        const newState = !controls.videoEnabled;
        await localTracks.video.setEnabled(newState);
        setControls(prev => ({ ...prev, videoEnabled: newState }));
        console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Toggle video error:', error);
      }
    } else {
      // Try to create video track if not available
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish([videoTrack]);
        
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        console.log('📹 Video enabled');
      } catch (error) {
        console.error('Cannot access camera:', error);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack();
        await clientRef.current.publish([screenTrack]);
        setControls(prev => ({ ...prev, screenSharing: true }));
        console.log('🖥️ Screen sharing started');
      } else {
        await clientRef.current.unpublish();
        setControls(prev => ({ ...prev, screenSharing: false }));
        console.log('🖥️ Screen sharing stopped');
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  const toggleRecording = () => {
    setControls(prev => ({ ...prev, recording: !prev.recording }));
    console.log(`⏺️ Recording ${!controls.recording ? 'started' : 'stopped'}`);
  };

  // FIXED LEAVE FUNCTION - Actually leaves the call
  const leaveSession = async () => {
    if (isLeaving) return;
    
    setIsLeaving(true);
    console.log('🚪 Leaving session...');
    
    try {
      // Stop local tracks
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }
      
      // Leave Agora channel
      if (clientRef.current) {
        await clientRef.current.leave();
        console.log('✅ Left Agora channel');
      }
      
      // Update backend
      if (sessionState.sessionInfo?.meetingId) {
        await videoApi.leaveVideoSession(sessionState.sessionInfo.meetingId, teacherId);
        console.log('✅ Updated backend status');
      }
      
      // Clear intervals
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
      
      // Call parent to close video call
      if (onEndCall) {
        console.log('📞 Calling onEndCall callback');
        onEndCall();
      }
      
    } catch (error) {
      console.error('❌ Leave session error:', error);
      alert('Error leaving session: ' + error.message);
    } finally {
      setIsLeaving(false);
    }
  };

  // FIXED END SESSION FUNCTION - Ends session for everyone
  const endSession = async () => {
    if (isEnding) return;
    
    if (!window.confirm('Are you sure you want to end this session for all participants?')) {
      return;
    }
    
    setIsEnding(true);
    console.log('⏹️ Ending session for all...');
    
    try {
      // Stop local tracks
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }
      
      // Leave Agora channel
      if (clientRef.current) {
        await clientRef.current.leave();
        console.log('✅ Left Agora channel');
      }
      
      // End session on backend
      if (sessionState.sessionInfo?.meetingId) {
        const result = await videoApi.endVideoSession(
          sessionState.sessionInfo.meetingId,
          teacherId
        );
        console.log('✅ Ended session on backend:', result);
      }
      
      // Clear intervals
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
      
      // Call parent to close video call
      if (onEndCall) {
        console.log('📞 Calling onEndCall callback');
        onEndCall();
      }
      
    } catch (error) {
      console.error('❌ End session error:', error);
      alert('Error ending session: ' + error.message);
    } finally {
      setIsEnding(false);
    }
  };

  // ============================================
  // Helper Functions
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    client.on('user-published', async (user, mediaType) => {
      console.log('👤 User published:', user.uid, mediaType);
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        const videoContainer = document.createElement('div');
        videoContainer.id = `remote-video-${user.uid}`;
        videoContainer.className = 'remote-video-container';
        document.querySelector('.remote-videos-grid').appendChild(videoContainer);
        user.videoTrack.play(videoContainer);
      }
      
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
      
      updateParticipantCount();
    });

    client.on('user-left', (user) => {
      console.log('👤 User left:', user.uid);
      const videoContainer = document.getElementById(`remote-video-${user.uid}`);
      if (videoContainer) {
        videoContainer.remove();
      }
      updateParticipantCount();
    });
  };

  const startDurationTracking = () => {
    const startTime = Date.now();
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    durationIntervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setStats(prev => ({ ...prev, duration: diff }));
    }, 1000);
  };

  const startParticipantTracking = (meetingId) => {
    if (participantUpdateIntervalRef.current) {
      clearInterval(participantUpdateIntervalRef.current);
    }
    
    const fetchParticipants = async () => {
      try {
        const participants = await videoApi.getSessionParticipants(meetingId);
        setParticipants(participants || []);
        setStats(prev => ({ 
          ...prev, 
          participantCount: participants.length + 1 
        }));
      } catch (error) {
        console.error('Participant tracking error:', error);
      }
    };
    
    fetchParticipants();
    participantUpdateIntervalRef.current = setInterval(fetchParticipants, 5000);
  };

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up...');
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
    
    if (localTracks.audio) {
      localTracks.audio.stop();
      localTracks.audio.close();
    }
    if (localTracks.video) {
      localTracks.video.stop();
      localTracks.video.close();
    }
    
    if (clientRef.current) {
      clientRef.current.leave();
    }
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // Render - Dark Theme UI
  // ============================================

  if (sessionState.error) {
    return (
      <div className="video-call-error">
        <div className="error-container">
          <h2>Session Error</h2>
          <p>{sessionState.error}</p>
          <button onClick={initializeSession} className="retry-button">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!sessionState.isJoined) {
    return (
      <div className="video-call-loading">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Connecting to video session...</p>
          <small>Please wait while we set up your call</small>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container dark-theme">
      {/* Header */}
      <div className="call-header">
        <div className="header-left">
          <h2>{sessionState.sessionInfo?.session?.class_title || 'Video Call'}</h2>
          <div className="call-stats">
            <span className="stat-item">
              <span className="stat-icon">⏱️</span>
              {formatDuration(stats.duration)}
            </span>
            <span className="stat-item">
              <span className="stat-icon">👥</span>
              {stats.participantCount} online
            </span>
          </div>
        </div>
        <div className="header-right">
          <div className="connection-status">
            <span className={`status-dot ${stats.connectionQuality}`}></span>
            <span className="status-text">{stats.connectionQuality} connection</span>
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="video-main-area">
        {/* Local Video */}
        <div className="local-video-container">
          <div className="video-card">
            <div className="video-header">
              <span className="video-title">
                <span className="host-badge">HOST</span> You
              </span>
              {!localTracks.video && (
                <span className="status-badge">🎤 Audio Only</span>
              )}
            </div>
            <div 
              ref={localVideoRef}
              className="video-display"
            >
              {!localTracks.video && (
                <div className="video-placeholder">
                  <div className="user-avatar">
                    <span>YOU</span>
                  </div>
                  <p>Camera is off</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Remote Videos Grid */}
        <div className="remote-videos-grid">
          {/* Remote videos will be added here dynamically */}
        </div>
      </div>

      {/* Control Bar - FIXED with working buttons */}
      <div className="control-bar">
        <div className="control-group primary-controls">
          {/* Audio Control */}
          <button 
            className={`control-button audio-control ${controls.audioEnabled ? 'active' : 'muted'}`}
            onClick={toggleAudio}
            title={controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            <span className="control-icon">
              {controls.audioEnabled ? '🎤' : '🔇'}
            </span>
            <span className="control-label">
              {controls.audioEnabled ? 'Mute' : 'Unmute'}
            </span>
          </button>

          {/* Video Control */}
          <button 
            className={`control-button video-control ${controls.videoEnabled ? 'active' : 'inactive'}`}
            onClick={toggleVideo}
            title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            <span className="control-icon">
              {controls.videoEnabled ? '📹' : '📷'}
            </span>
            <span className="control-label">
              {controls.videoEnabled ? 'Stop Video' : 'Start Video'}
            </span>
          </button>

          {/* Screen Share */}
          <button 
            className={`control-button screen-share-control ${controls.screenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title={controls.screenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <span className="control-icon">
              {controls.screenSharing ? '🖥️' : '📱'}
            </span>
            <span className="control-label">
              {controls.screenSharing ? 'Stop Share' : 'Share Screen'}
            </span>
          </button>

          {/* Recording */}
          <button 
            className={`control-button recording-control ${controls.recording ? 'active' : ''}`}
            onClick={toggleRecording}
            title={controls.recording ? 'Stop recording' : 'Start recording'}
          >
            <span className="control-icon">
              {controls.recording ? '⏺️' : '⏺️'}
            </span>
            <span className="control-label">
              {controls.recording ? 'Stop Record' : 'Record'}
            </span>
          </button>
        </div>

        <div className="control-group secondary-controls">
          {/* Chat */}
          <button 
            className={`control-button chat-control ${controls.isChatOpen ? 'active' : ''}`}
            onClick={() => setControls(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }))}
            title="Toggle chat"
          >
            <span className="control-icon">💬</span>
            <span className="control-label">Chat</span>
            {messages.length > 0 && (
              <span className="notification-badge">{messages.length}</span>
            )}
          </button>

          {/* Participants */}
          <button 
            className={`control-button participants-control ${controls.isParticipantsOpen ? 'active' : ''}`}
            onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }))}
            title="Show participants"
          >
            <span className="control-icon">👥</span>
            <span className="control-label">Participants</span>
            <span className="count-badge">{participants.length}</span>
          </button>
        </div>

        <div className="control-group action-controls">
          {/* LEAVE Button - Actually works now */}
          <button 
            className="control-button leave-button"
            onClick={leaveSession}
            disabled={isLeaving}
            title="Leave the call (others can continue)"
          >
            <span className="control-icon">🚪</span>
            <span className="control-label">
              {isLeaving ? 'Leaving...' : 'Leave'}
            </span>
          </button>

          {/* END SESSION Button - Actually works now */}
          <button 
            className="control-button end-button"
            onClick={endSession}
            disabled={isEnding}
            title="End call for everyone"
          >
            <span className="control-icon">⏹️</span>
            <span className="control-label">
              {isEnding ? 'Ending...' : 'End Session'}
            </span>
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      {controls.isChatOpen && (
        <div className="chat-panel">
          <div className="panel-header">
            <h3>Chat</h3>
            <button 
              className="close-panel"
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: false }))}
            >
              ✕
            </button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <p>No messages yet</p>
                <small>Start the conversation!</small>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="chat-message">
                  <strong>{msg.sender || 'User'}: </strong>
                  {msg.text}
                </div>
              ))
            )}
          </div>
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherVideoCall;