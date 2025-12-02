// ============================================
// TeacherVideoCall Component - UPDATED UI
// Complete video call interface with database integration
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  // Refs
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatInputRef = useRef(null);

  // ============================================
  // Initialization (SAME AS BEFORE)
  // ============================================

  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [classId, teacherId]);

  const initializeSession = async () => {
    try {
      // Create Agora client
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      // Create video session in database
      const sessionData = await videoApi.startVideoSession(classId, teacherId);

      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: sessionData,
        error: null
      });

      // Join Agora channel
      await joinChannel(sessionData);

    } catch (error) {
      console.error('Initialization error:', error);
      setSessionState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize video session'
      }));
    }
  };

const joinChannel = async (sessionData) => {
  try {
    // Validate session data
    if (!sessionData) {
      throw new Error('No session data provided');
    }
    
    const { channel, token, uid, appId } = sessionData;
    
    // Validate required fields
    if (!channel || !token || !appId) {
      throw new Error('Missing required session credentials');
    }
    
    console.log('Joining channel with:', { channel, appId, uid });
    
    // Setup event listeners
    setupAgoraEventListeners();
    
    // Join channel with timeout
    const joinPromise = clientRef.current.join(appId, channel, token, uid);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Join timeout after 10s')), 10000)
    );
    
    await Promise.race([joinPromise, timeoutPromise]);

    // Try to create tracks with fallback for no camera
    let audioTrack = null;
    let videoTrack = null;
    
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "music_standard"
      });
    } catch (audioError) {
      console.warn('Could not create audio track:', audioError);
    }

    try {
      videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "720p_2",
        optimizationMode: "detail"
      });
      
      // Play local video if we have it
      videoTrack.play('local-video-container');
    } catch (videoError) {
      console.warn('Could not create video track:', videoError);
      setupLocalVideoPlaceholder();
    }

    setLocalTracks({ audio: audioTrack, video: videoTrack });

    // Publish only available tracks
    const tracksToPublish = [];
    if (audioTrack) tracksToPublish.push(audioTrack);
    if (videoTrack) tracksToPublish.push(videoTrack);
    
    if (tracksToPublish.length > 0) {
      await clientRef.current.publish(tracksToPublish);
    } else {
      console.warn('No tracks to publish - continuing with audio-only UI');
    }

    setSessionState(prev => ({
      ...prev,
      isJoined: true
    }));

    // Start tracking session duration
    startDurationTracking(sessionData.session?.start_time);

    // Start participant updates
    const meetingId = sessionData.meetingId || sessionData.meeting_id || sessionData.session?.meeting_id;
    if (meetingId) {
      startParticipantTracking(meetingId);
    } else {
      console.error('❌ No meetingId found in session data:', sessionData);
    }

    // Load chat messages
    if (sessionData.session?.id) {
      loadMessages(sessionData.session.id);
    }

  } catch (error) {
    console.error('Join channel error:', error);
    throw new Error(`Failed to join video channel: ${error.message}`);
  }
};

const setupLocalVideoPlaceholder = () => {
  const localVideoContainer = document.getElementById('local-video-container');
  if (localVideoContainer) {
    localVideoContainer.innerHTML = `
      <div class="video-placeholder">
        <div class="avatar-placeholder">
          <span class="avatar-initials">${getUserInitials()}</span>
        </div>
        <div class="placeholder-text">
          <span class="camera-icon">📷</span>
          <p>Camera not available</p>
          <small>Audio only mode</small>
        </div>
      </div>
    `;
  }
};

const getUserInitials = () => {
  const userName = "You";
  return userName.charAt(0).toUpperCase();
};

  // ============================================
  // Agora Event Listeners (SAME AS BEFORE)
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    // User joined
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        setRemoteTracks(prev => {
          const updated = new Map(prev);
          updated.set(user.uid, { ...updated.get(user.uid), video: user.videoTrack });
          return updated;
        });
      }

      if (mediaType === 'audio') {
        setRemoteTracks(prev => {
          const updated = new Map(prev);
          updated.set(user.uid, { ...updated.get(user.uid), audio: user.audioTrack });
          return updated;
        });
        user.audioTrack?.play();
      }

      updateParticipantCount();
    });

    // User left
    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') {
        setRemoteTracks(prev => {
          const updated = new Map(prev);
          const tracks = updated.get(user.uid);
          if (tracks) {
            updated.set(user.uid, { ...tracks, video: null });
          }
          return updated;
        });
      }
      updateParticipantCount();
    });

    client.on('user-left', (user) => {
      setRemoteTracks(prev => {
        const updated = new Map(prev);
        updated.delete(user.uid);
        return updated;
      });
      updateParticipantCount();
    });

    // Connection state changes
    client.on('connection-state-change', (curState, prevState, reason) => {
      console.log('Connection state:', curState, 'Previous:', prevState, 'Reason:', reason);
      
      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        handleDisconnection(reason);
      }
    });

    // Network quality
  client.on('network-quality', (quality) => {
  try {
    const qualityMap = {
      0: 'unknown', 1: 'excellent', 2: 'good', 
      3: 'poor', 4: 'poor', 5: 'poor', 6: 'poor'
    };
    
    const uplinkQuality = quality?.uplinkNetworkQuality ?? 0;
    const qualityText = qualityMap[uplinkQuality] || 'unknown';
    
    setStats(prev => ({
      ...prev,
      connectionQuality: qualityText
    }));

  } catch (error) {
    console.warn('Network quality error:', error);
    setStats(prev => ({
      ...prev,
      connectionQuality: 'unknown'
    }));
  }
});

    // Token privilege will expire
    client.on('token-privilege-will-expire', async () => {
      try {
        const newToken = await videoApi.generateToken(
          sessionState.sessionInfo.meetingId,
          teacherId
        );
        await client.renewToken(newToken.token);
      } catch (error) {
        console.error('Token renewal error:', error);
      }
    });
  };

  // ============================================
  // Control Functions - UPDATED
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      updateParticipantInDatabase({ audioEnabled: newState });
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      updateParticipantInDatabase({ videoEnabled: newState });
    } else {
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: "720p_2",
          optimizationMode: "detail"
        });
        
        await clientRef.current.publish([videoTrack]);
        videoTrack.play('local-video-container');
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        updateParticipantInDatabase({ videoEnabled: true });
        
        const container = document.getElementById('local-video-container');
        container.innerHTML = '';
        
      } catch (error) {
        console.warn('Still cannot access camera:', error);
        alert('Camera is not available. You are in audio-only mode.');
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        // Start screen sharing
        screenClientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p_1",
          optimizationMode: "detail"
        });

        await screenClientRef.current.join(
          sessionState.sessionInfo.appId,
          sessionState.sessionInfo.channel,
          null,
          `${sessionState.sessionInfo.uid}_screen`
        );

        await screenClientRef.current.publish([screenTrack]);

        setControls(prev => ({ ...prev, screenSharing: true }));
        updateParticipantInDatabase({ screenSharing: true });

        // Handle screen share end
        screenTrack.on('track-ended', () => {
          stopScreenShare();
        });

      } else {
        await stopScreenShare();
      }
    } catch (error) {
      console.error('Screen share error:', error);
      alert('Failed to share screen: ' + error.message);
    }
  };

  const stopScreenShare = async () => {
    if (screenClientRef.current) {
      screenClientRef.current.leave();
      screenClientRef.current = null;
      setControls(prev => ({ ...prev, screenSharing: false }));
      updateParticipantInDatabase({ screenSharing: false });
    }
  };

  const toggleRecording = async () => {
    try {
      if (!controls.recording) {
        await videoApi.startRecording(
          sessionState.sessionInfo.session.id,
          teacherId
        );
        setControls(prev => ({ ...prev, recording: true }));
        addSystemMessage('Recording started');
      } else {
        // Stop recording would be handled by backend
        setControls(prev => ({ ...prev, recording: false }));
        addSystemMessage('Recording stopped');
      }
    } catch (error) {
      console.error('Recording error:', error);
      alert('Failed to toggle recording: ' + error.message);
    }
  };

  const toggleChat = () => {
    setControls(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }));
  };

  const toggleParticipants = () => {
    setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }));
  };

  const leaveSession = async () => {
    if (window.confirm('Are you sure you want to leave this session? You can rejoin later.')) {
      try {
        await videoApi.leaveVideoSession(
          sessionState.sessionInfo.meetingId,
          teacherId
        );
        cleanup();
        if (onEndCall) {
          onEndCall();
        }
      } catch (error) {
        console.error('Leave session error:', error);
        alert('Failed to leave session: ' + error.message);
      }
    }
  };

  const endSession = async () => {
    if (window.confirm('Are you sure you want to end this session for all participants?')) {
      try {
        await videoApi.endVideoSession(
          sessionState.sessionInfo.meetingId,
          teacherId
        );
        cleanup();
        if (onEndCall) {
          onEndCall();
        }
      } catch (error) {
        console.error('End session error:', error);
        alert('Failed to end session: ' + error.message);
      }
    }
  };

  // ============================================
  // Database Updates (SAME AS BEFORE)
  // ============================================

  const updateParticipantInDatabase = async (updates) => {
    try {
      if (sessionState.sessionInfo) {
        await videoApi.updateParticipantStatus(
          sessionState.sessionInfo.session.id,
          teacherId,
          updates
        );
      }
    } catch (error) {
      console.error('Update participant error:', error);
    }
  };

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

  const startParticipantTracking = (meetingId) => {
    if (participantUpdateIntervalRef.current) {
      clearInterval(participantUpdateIntervalRef.current);
    }
    
    const fetchParticipants = async () => {
      try {
        const participants = await videoApi.getSessionParticipants(meetingId);
        setParticipants(participants || []);
        updateParticipantCount();
      } catch (error) {
        console.error('Participant tracking error:', error);
      }
    };
    
    fetchParticipants();
    participantUpdateIntervalRef.current = setInterval(fetchParticipants, 5000);
  };

  // ============================================
  // Duration Tracking (SAME AS BEFORE)
  // ============================================

  const startDurationTracking = (startTime) => {
    if (!startTime) {
      startTime = new Date().toISOString();
    }
    
    const start = new Date(startTime);
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    durationIntervalRef.current = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now - start) / 1000);
      setStats(prev => ({ ...prev, duration: diff }));
    }, 1000);
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return "00:00:00";
    }
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // Chat Functions (UPDATED)
  // ============================================

  const loadMessages = async (sessionId) => {
    try {
      if (!sessionId) {
        console.warn('No session ID provided for loading messages');
        return;
      }
      
      if (!videoApi.getSessionMessages) {
        const mockMessages = [
          {
            id: 1,
            message_text: "Welcome to the video session!",
            message_type: "system",
            created_at: new Date().toISOString(),
            profiles: { full_name: 'System' }
          }
        ];
        setMessages(mockMessages);
        return;
      }
      
      const msgs = await videoApi.getSessionMessages(sessionId);
      setMessages(msgs?.reverse() || []);
    } catch (error) {
      console.error('Load messages error:', error);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionState.sessionInfo) return;

    try {
      const message = await videoApi.sendMessage(
        sessionState.sessionInfo.session.id,
        teacherId,
        newMessage.trim()
      );

      setMessages(prev => [...prev, message]);
      setNewMessage('');
      
      // Focus back on input
      if (chatInputRef.current) {
        chatInputRef.current.focus();
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      message_text: text,
      message_type: 'system',
      created_at: new Date().toISOString(),
      profiles: { full_name: 'System' }
    }]);
  };

  // ============================================
  // Disconnection Handling (SAME AS BEFORE)
  // ============================================

  const handleDisconnection = async (reason) => {
    console.warn('Disconnected:', reason);
    
    await updateParticipantInDatabase({ 
      status: 'disconnected'
    });

    if (reason === 'NETWORK_ERROR') {
      setTimeout(() => {
        if (sessionState.sessionInfo) {
          joinChannel(sessionState.sessionInfo);
        }
      }, 3000);
    }
  };

  // ============================================
  // Cleanup (UPDATED)
  // ============================================

  const cleanup = async () => {
    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (participantUpdateIntervalRef.current) {
      clearInterval(participantUpdateIntervalRef.current);
    }

    // Stop local tracks
    if (localTracks.audio) {
      localTracks.audio.stop();
      localTracks.audio.close();
    }
    if (localTracks.video) {
      localTracks.video.stop();
      localTracks.video.close();
    }

    // Stop screen share
    await stopScreenShare();

    // Leave channel
    if (clientRef.current) {
      await clientRef.current.leave();
    }

    // Update database
    if (sessionState.sessionInfo) {
      await updateParticipantInDatabase({ status: 'left' });
    }
  };

  // ============================================
  // RENDER - UPDATED WORLD-CLASS UI
  // ============================================

  if (sessionState.error) {
    return (
      <div className="video-error">
        <h2>Error</h2>
        <p>{sessionState.error}</p>
        <button onClick={initializeSession}>Retry</button>
      </div>
    );
  }

  if (!sessionState.isJoined) {
    return (
      <div className="video-loading">
        <div className="spinner"></div>
        <p>Initializing video session...</p>
      </div>
    );
  }

  return (
    <div className="teacher-video-call">
      {/* Header */}
      <div className="video-header">
        <div className="session-info">
          <div className="session-title">
            <h2>{sessionState.sessionInfo?.session?.class_title || 'Video Session'}</h2>
            <div className="session-badges">
              <span className="duration-badge">
                <i className="time-icon">⏱️</i>
                {formatDuration(stats.duration)}
              </span>
              <span className={`quality-badge quality-${stats.connectionQuality}`}>
                <i className="network-icon">📶</i>
                {stats.connectionQuality}
              </span>
              <span className="participant-badge">
                <i className="user-icon">👥</i>
                {stats.participantCount}
              </span>
              {controls.recording && (
                <span className="recording-badge">
                  <i className="record-icon">🔴</i>
                  Recording
                </span>
              )}
            </div>
          </div>
          <div className="header-actions">
            <button className="header-btn" onClick={toggleChat}>
              <i>{controls.isChatOpen ? '💬' : '💭'}</i>
              Chat
            </button>
            <button className="header-btn" onClick={toggleParticipants}>
              <i>{controls.isParticipantsOpen ? '👥' : '👤'}</i>
              Participants ({participants.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="video-content">
        {/* Video Grid */}
        <div className="video-grid">
          {/* Local Video */}
          <div className="local-video-card">
            <div className="video-card-header">
              <span className="video-title">You (Host)</span>
              <div className="video-status">
                {!localTracks.video && <span className="status-badge audio-only">🎤 Audio Only</span>}
                {controls.screenSharing && <span className="status-badge sharing">🖥️ Sharing</span>}
              </div>
            </div>
            <div id="local-video-container" className="video-container">
              {/* Video will be rendered here or placeholder */}
            </div>
          </div>

          {/* Remote Videos */}
          {Array.from(remoteTracks.entries()).map(([uid, tracks]) => (
            <RemoteVideo key={uid} uid={uid} tracks={tracks} />
          ))}
        </div>

        {/* Chat Panel - Collapsible */}
        {controls.isChatOpen && (
          <div className="chat-panel">
            <div className="panel-header">
              <h3>Chat Messages</h3>
              <button className="panel-close" onClick={toggleChat}>✕</button>
            </div>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <p>No messages yet</p>
                  <small>Start the conversation!</small>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`chat-message ${msg.message_type}`}>
                    <div className="message-header">
                      <strong>{msg.profiles?.full_name || 'System'}</strong>
                      <small>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <div className="message-content">
                      {msg.message_text}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="chat-input-area">
              <input
                ref={chatInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message here..."
                className="chat-input"
              />
              <button onClick={sendMessage} className="send-btn" disabled={!newMessage.trim()}>
                <i>➤</i>
              </button>
            </div>
          </div>
        )}

        {/* Participants Panel - Collapsible */}
        {controls.isParticipantsOpen && (
          <div className="participants-panel">
            <div className="panel-header">
              <h3>Participants ({participants.length})</h3>
              <button className="panel-close" onClick={toggleParticipants}>✕</button>
            </div>
            <div className="participants-list">
              {participants.length === 0 ? (
                <div className="empty-participants">
                  <p>No participants yet</p>
                  <small>Waiting for others to join...</small>
                </div>
              ) : (
                <>
                  <div className="participant-item host">
                    <div className="participant-avatar">
                      <span className="avatar-initials">H</span>
                    </div>
                    <div className="participant-info">
                      <strong>You (Host)</strong>
                      <div className="participant-status">
                        <span className={`audio-status ${controls.audioEnabled ? 'on' : 'off'}`}>
                          {controls.audioEnabled ? '🎤' : '🔇'}
                        </span>
                        <span className={`video-status ${controls.videoEnabled ? 'on' : 'off'}`}>
                          {controls.videoEnabled ? '📹' : '📴'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {participants.map(p => (
                    <div key={p.id} className="participant-item">
                      <div className="participant-avatar">
                        <span className="avatar-initials">
                          {p.profiles?.full_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="participant-info">
                        <strong>{p.profiles?.full_name || `User ${p.user_id?.slice(0, 4)}`}</strong>
                        <div className="participant-status">
                          <span className={`status ${p.status}`}>{p.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar - World Class Design */}
      <div className="control-bar">
        <div className="control-group">
          <button 
            className={`control-btn ${controls.audioEnabled ? 'active' : 'inactive'}`}
            onClick={toggleAudio}
            title={controls.audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            <i className="control-icon">
              {controls.audioEnabled ? '🎤' : '🔇'}
            </i>
            <span className="control-label">{controls.audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>

          <button 
            className={`control-btn ${controls.videoEnabled ? 'active' : 'inactive'}`}
            onClick={toggleVideo}
            title={controls.videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            disabled={!localTracks.video}
          >
            <i className="control-icon">
              {controls.videoEnabled ? '📹' : '📷'}
            </i>
            <span className="control-label">
              {localTracks.video 
                ? (controls.videoEnabled ? 'Stop Video' : 'Start Video')
                : 'No Camera'
              }
            </span>
          </button>

          <button 
            className={`control-btn ${controls.screenSharing ? 'active sharing' : ''}`}
            onClick={toggleScreenShare}
            title={controls.screenSharing ? 'Stop Screen Sharing' : 'Start Screen Sharing'}
          >
            <i className="control-icon">
              {controls.screenSharing ? '🖥️' : '📱'}
            </i>
            <span className="control-label">
              {controls.screenSharing ? 'Stop Share' : 'Share Screen'}
            </span>
          </button>

          <button 
            className={`control-btn ${controls.recording ? 'active recording' : ''}`}
            onClick={toggleRecording}
            title={controls.recording ? 'Stop Recording' : 'Start Recording'}
          >
            <i className="control-icon">
              {controls.recording ? '⏺️' : '⏺️'}
            </i>
            <span className="control-label">
              {controls.recording ? 'Stop Record' : 'Record'}
            </span>
          </button>
        </div>

        <div className="control-group">
          <button 
            className="control-btn chat-toggle"
            onClick={toggleChat}
            title={controls.isChatOpen ? 'Hide Chat' : 'Show Chat'}
          >
            <i className="control-icon">
              {controls.isChatOpen ? '💬' : '💭'}
            </i>
            <span className="control-label">Chat</span>
            {messages.length > 0 && (
              <span className="notification-badge">{messages.length}</span>
            )}
          </button>

          <button 
            className="control-btn participants-toggle"
            onClick={toggleParticipants}
            title={controls.isParticipantsOpen ? 'Hide Participants' : 'Show Participants'}
          >
            <i className="control-icon">
              {controls.isParticipantsOpen ? '👥' : '👤'}
            </i>
            <span className="control-label">Participants</span>
            {participants.length > 0 && (
              <span className="count-badge">{participants.length}</span>
            )}
          </button>
        </div>

        <div className="control-group">
          <button 
            className="control-btn leave-btn"
            onClick={leaveSession}
            title="Leave Session (Can rejoin later)"
          >
            <i className="control-icon">🚪</i>
            <span className="control-label">Leave</span>
          </button>

          <button 
            className="control-btn end-btn"
            onClick={endSession}
            title="End Session for Everyone"
          >
            <i className="control-icon">⏹️</i>
            <span className="control-label">End Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Remote Video Component - Enhanced
const RemoteVideo = ({ uid, tracks }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (tracks.video && videoRef.current) {
      tracks.video.play(videoRef.current);
    }

    return () => {
      if (tracks.video) {
        tracks.video.stop();
      }
    };
  }, [tracks.video]);

  return (
    <div className="remote-video-card">
      <div className="video-card-header">
        <span className="video-title">User {uid}</span>
        <div className="video-status">
          {!tracks.video && <span className="status-badge audio-only">🎤</span>}
          {tracks.audio && <span className="status-badge audio-on">🎤</span>}
        </div>
      </div>
      {tracks.video ? (
        <div ref={videoRef} className="video-container"></div>
      ) : (
        <div className="video-placeholder">
          <div className="avatar-placeholder large">
            <span className="avatar-initials">U{uid.toString().charAt(0)}</span>
          </div>
          <div className="placeholder-text">
            <span className="audio-icon">🎤</span>
            <small>Audio only</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherVideoCall;