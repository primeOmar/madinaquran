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

  // Enhanced chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Refs
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
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
        startChatPolling(meetingId); // Start chat polling
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
        
        // FIXED: Play video in the video element - ensure element exists
        if (localVideoRef.current) {
          console.log('🎥 Playing video on local video element');
          videoTrack.play(localVideoRef.current);
          localVideoRef.current.style.display = 'block';
        } else {
          console.error('❌ localVideoRef.current is null');
          // Create a video element if it doesn't exist
          const videoElement = document.getElementById('local-video');
          if (videoElement) {
            videoTrack.play(videoElement);
            videoElement.style.display = 'block';
          }
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
  // Control Functions 
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
          localVideoRef.current.style.display = newState ? 'block' : 'none';
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

  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        // Start screen sharing
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1',
          optimizationMode: 'detail'
        });
        
        // Stop and unpublish camera video track
        if (localTracks.video) {
          await clientRef.current.unpublish([localTracks.video]);
          localTracks.video.stop();
          localTracks.video.close();
        }
        
        // Publish screen track
        await clientRef.current.publish([screenTrack]);
        
        // Update local tracks
        setLocalTracks(prev => ({ 
          ...prev, 
          video: screenTrack 
        }));
        
        // Play screen track in local video element
        if (localVideoRef.current) {
          screenTrack.play(localVideoRef.current);
        }
        
        setControls(prev => ({ ...prev, screenSharing: true }));
        console.log('🖥️ Screen sharing started');
        
      } else {
        // Stop screen sharing and restore camera
        const screenTrack = localTracks.video;
        
        if (screenTrack) {
          await clientRef.current.unpublish([screenTrack]);
          screenTrack.stop();
          screenTrack.close();
        }
        
        // Create and publish camera video track
        try {
          const cameraTrack = await AgoraRTC.createCameraVideoTrack();
          await clientRef.current.publish([cameraTrack]);
          
          if (localVideoRef.current) {
            cameraTrack.play(localVideoRef.current);
          }
          
          setLocalTracks(prev => ({ 
            ...prev, 
            video: cameraTrack 
          }));
          
          setControls(prev => ({ 
            ...prev, 
            videoEnabled: true,
            screenSharing: false 
          }));
          
          console.log('🖥️ Screen sharing stopped, camera restored');
        } catch (cameraError) {
          console.error('Cannot access camera:', cameraError);
          setControls(prev => ({ 
            ...prev, 
            videoEnabled: false,
            screenSharing: false 
          }));
        }
      }
    } catch (error) {
      console.error('Screen share error:', error);
      
      if (error.code === 'PERMISSION_DENIED') {
        alert('Screen sharing permission was denied. Please allow screen sharing in your browser.');
      } else if (error.message.includes('canceled')) {
        console.log('Screen sharing was canceled by user');
      }
      
      setControls(prev => ({ ...prev, screenSharing: false }));
    }
  };

  const toggleRecording = async () => {
    try {
      const newState = !controls.recording; 
      if (newState) { 
        await videoApi.startRecording(sessionState.sessionInfo.meetingId);
        console.log('⏺️ Recording started');
      } else {
        await videoApi.stopRecording(sessionState.sessionInfo.meetingId);
        console.log('⏹️ Recording stopped');
      }
      setControls(prev => ({ ...prev, recording: newState }));
    } catch (error) {
      console.error('Toggle recording error:', error);
    } 
  };

  const leaveSession = async () => {
    try {
      setIsLeaving(true); 
      await cleanup();
      setIsLeaving(false);
      if (onEndCall) onEndCall(false); 
    } catch (error) {
      console.error('Leave session error:', error);
      setIsLeaving(false);
    }
  };

  const endSession = async () => {  
    try {
      setIsEnding(true); 
      await videoApi.endVideoSession(sessionState.sessionInfo.meetingId);
      await cleanup();
      setIsEnding(false);
      if (onEndCall) onEndCall(true); 
    } catch (error) {
      console.error('End session error:', error);
      setIsEnding(false);
    }
  };

  // ============================================
  // ENHANCED CHAT FUNCTIONS
  // ============================================

  const sendMessage = async () => {
    const messageText = newMessage.trim();
    if (!messageText || !sessionState.sessionInfo?.meetingId) return;
    
    try {
      // Create temporary message (optimistic update)
      const tempMessage = {
        id: Date.now().toString(),
        meetingId: sessionState.sessionInfo.meetingId,
        senderId: teacherId,
        senderName: 'Teacher',
        text: messageText,
        timestamp: new Date().toISOString(),
        isOwn: true,
        status: 'sending'
      };
      
      // Add to UI immediately
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      // Scroll to bottom
      scrollToBottom();
      
      // Send to backend (simulated - replace with actual API)
      setTimeout(() => {
        // Simulate successful send
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, status: 'sent' }
            : msg
        ));
        
        // Simulate student responses
        simulateStudentResponse(messageText);
      }, 500);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Mark as failed
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...msg, status: 'failed' }
          : msg
      ));
    }
  };

  const simulateStudentResponse = (teacherMessage) => {
    // Simple AI responses based on teacher's message
    const responses = {
      greeting: ["Hello Teacher!", "Hi!", "Good morning!", "Ready to learn!"],
      question: ["Yes, I understand", "Could you explain more?", "I have a question about that"],
      generic: ["Thank you", "Got it", "Understood", "Interesting!"]
    };
    
    const lowerMessage = teacherMessage.toLowerCase();
    let responseType = 'generic';
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      responseType = 'greeting';
    } else if (lowerMessage.includes('?') || lowerMessage.includes('understand')) {
      responseType = 'question';
    }
    
    const randomResponse = responses[responseType][
      Math.floor(Math.random() * responses[responseType].length)
    ];
    
    // Add student response after a delay
    setTimeout(() => {
      const studentMessage = {
        id: Date.now().toString(),
        meetingId: sessionState.sessionInfo.meetingId,
        senderId: 'student_' + Math.floor(Math.random() * 1000),
        senderName: 'Student',
        text: randomResponse,
        timestamp: new Date().toISOString(),
        isOwn: false
      };
      
      setMessages(prev => [...prev, studentMessage]);
      scrollToBottom();
    }, 1000 + Math.random() * 2000);
  };

  const startChatPolling = (meetingId) => {
    // Simulate fetching messages from server
    const fetchMessages = async () => {
      try {
        // In real app, fetch from API
        // const response = await fetch(`/api/chat/messages/${meetingId}`);
        // const data = await response.json();
        
        // For demo, we'll just maintain local state
        console.log('Polling chat messages...');
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    
    // Poll every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }, 100);
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const getSenderName = (message) => {
    if (message.isOwn) return 'You';
    return message.senderName || 'Student';
  };

  const retryMessage = async (messageId) => {
    const failedMessage = messages.find(m => m.id === messageId);
    if (!failedMessage) return;
    
    setNewMessage(failedMessage.text);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    
    const input = document.querySelector('.chat-input-area input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

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

  // Render chat message
  const renderMessage = (msg) => (
    <div 
      key={msg.id} 
      className={`message-wrapper ${msg.isOwn ? 'own-message' : 'other-message'}`}
    >
      <div className="message-content">
        {!msg.isOwn && (
          <div className="message-sender">
            {getSenderName(msg)}
          </div>
        )}
        
        <div className={`message-bubble ${msg.status === 'failed' ? 'failed' : ''}`}>
          <div className="message-text">
            {msg.text}
          </div>
          
          <div className="message-footer">
            <span className="message-time">
              {formatTime(msg.timestamp)}
            </span>
            
            {msg.isOwn && (
              <span className="message-status">
                {msg.status === 'sending' && '🔄'}
                {msg.status === 'sent' && '✓'}
                {msg.status === 'failed' && '✗'}
              </span>
            )}
          </div>
        </div>
        
        {msg.status === 'failed' && msg.isOwn && (
          <button 
            className="retry-button"
            onClick={() => retryMessage(msg.id)}
            title="Retry sending"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );

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
        {/* Local Video - FIXED */}
        <div className="local-video-container">
          <div className="video-card">
            <div className="video-header">
              <span className="video-title">
                <span className="host-badge">HOST</span> You
              </span>
              {!controls.videoEnabled && (
                <span className="status-badge">🎤 Audio Only</span>
              )}
              {controls.screenSharing && (
                <span className="screen-share-indicator">🖥️ Sharing Screen</span>
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
                style={{ display: controls.videoEnabled ? 'block' : 'none' }}
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
          {/* LEAVE Button */}
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

          {/* END SESSION Button */}
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

      {/* ENHANCED Chat Panel */}
      {controls.isChatOpen && (
        <div className="chat-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="chat-icon">💬</span>
              <h3>Chat</h3>
              {messages.length > 0 && (
                <span className="message-count">
                  {messages.length}
                </span>
              )}
            </div>
            <button 
              className="close-panel"
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: false }))}
            >
              ✕
            </button>
          </div>
          
          <div className="chat-messages" ref={chatContainerRef}>
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="empty-icon">💭</div>
                <p>No messages yet</p>
                <small>Start a conversation with your students</small>
              </div>
            ) : (
              messages.map(renderMessage)
            )}
          </div>
          
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              maxLength={500}
            />
            <button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="send-button"
              title="Send message"
            >
              <span className="send-icon">↑</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherVideoCall;