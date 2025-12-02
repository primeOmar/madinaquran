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
  const remoteUsersRef = useRef({});

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

      // Get session data from API
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

      // Create and publish tracks
      await createAndPublishTracks();

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

  const createAndPublishTracks = async () => {
    try {
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
        
        // Play video in the video element
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
    } catch (error) {
      console.error('Error creating/publishing tracks:', error);
    }
  };

  // ============================================
  // FIXED Event Listeners with proper video display
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    client.on('user-published', async (user, mediaType) => {
      console.log('👤 User published:', user.uid, mediaType);
      
      // Subscribe to the user
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        // Create a container for remote video
        const videoContainer = document.createElement('div');
        videoContainer.id = `remote-video-${user.uid}`;
        videoContainer.className = 'remote-video-container';
        
        // Create a video element
        const videoElement = document.createElement('video');
        videoElement.id = `video-${user.uid}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = 'remote-video-element';
        
        videoContainer.appendChild(videoElement);
        
        // Add to DOM
        const remoteVideosGrid = document.querySelector('.remote-videos-grid');
        if (remoteVideosGrid) {
          remoteVideosGrid.appendChild(videoContainer);
        }
        
        // Play the video track on the video element
        user.videoTrack.play(videoElement);
        remoteUsersRef.current[user.uid] = { container: videoContainer, videoElement };
      }
      
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
      
      updateParticipantCount();
    });

    client.on('user-unpublished', (user, mediaType) => {
      console.log('👤 User unpublished:', user.uid, mediaType);
      
      if (mediaType === 'video') {
        const userData = remoteUsersRef.current[user.uid];
        if (userData && userData.container) {
          userData.container.remove();
          delete remoteUsersRef.current[user.uid];
        }
      }
      
      updateParticipantCount();
    });

    client.on('user-left', (user) => {
      console.log('👤 User left:', user.uid);
      
      // Clean up the video container
      const userData = remoteUsersRef.current[user.uid];
      if (userData && userData.container) {
        userData.container.remove();
        delete remoteUsersRef.current[user.uid];
      }
      
      updateParticipantCount();
    });
  };

  // ============================================
  // Control Functions (unchanged)
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
        
        // Show/hide video element based on state
        if (localVideoRef.current) {
          if (newState) {
            localVideoRef.current.style.display = 'block';
          } else {
            localVideoRef.current.style.display = 'none';
          }
        }
        
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
          localVideoRef.current.style.display = 'block';
        }
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        console.log('📹 Video enabled');
      } catch (error) {
        console.error('Cannot access camera:', error);
      }
    }
  };

  // ... rest of your control functions remain the same

  // ============================================
  // Helper Functions
  // ============================================

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
          participantCount: (clientRef.current?.remoteUsers?.length || 0) + 1 
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
    
    // Clear intervals
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
    
    // Stop and close local tracks
    if (localTracks.audio) {
      localTracks.audio.stop();
      localTracks.audio.close();
    }
    if (localTracks.video) {
      localTracks.video.stop();
      localTracks.video.close();
    }
    
    // Leave channel
    if (clientRef.current) {
      clientRef.current.leave();
    }
    
    // Clear remote users
    Object.values(remoteUsersRef.current).forEach(userData => {
      if (userData.container) {
        userData.container.remove();
      }
    });
    remoteUsersRef.current = {};
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        sender: 'Teacher',
        text: newMessage,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  };

  // ============================================
  // Render
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
              {!controls.videoEnabled && (
                <span className="status-badge">🎤 Audio Only</span>
              )}
            </div>
            <div className="video-display">
              <video
                ref={localVideoRef}
                id="local-video"
                autoPlay
                playsInline
                muted
                className="video-element"
              ></video>
              
              {!controls.videoEnabled && (
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
          {/* Remote videos are added dynamically here */}
        </div>
      </div>

      {/* Control Bar */}
      <div className="control-bar">
        <div className="control-group primary-controls">
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