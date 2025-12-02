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
  const [showControls, setShowControls] = useState(true);

  // Refs
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteUsersRef = useRef({});
  const controlsTimeoutRef = useRef(null);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };
    
    handleMouseMove(); // Initial show
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // ============================================
  // Initialization (same as before)
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
      
      setupAgoraEventListeners();
      
      await clientRef.current.join(appId, channel, token, uid);
      console.log('✅ Successfully joined channel');

      await createAndPublishTracks();

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();
      
      const meetingId = sessionData.meetingId || sessionData.meeting_id;
      if (meetingId) {
        startParticipantTracking(meetingId);
        startChatPolling(meetingId);
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

      // Create video track - FIXED VERSION
      let videoTrack = null;
      try {
        videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '720p',
          optimizationMode: 'motion'
        });
        
        console.log('📹 Video track created');
        
        // Wait for video element to be available
        const waitForVideoElement = () => {
          return new Promise((resolve) => {
            const checkElement = () => {
              if (localVideoRef.current) {
                resolve(localVideoRef.current);
              } else {
                setTimeout(checkElement, 100);
              }
            };
            checkElement();
          });
        };
        
        const videoElement = await waitForVideoElement();
        console.log('🎥 Video element found:', videoElement);
        
        // Play video with error handling
        try {
          await videoTrack.play(videoElement);
          console.log('✅ Video track playing');
          
          // Force video display
          videoElement.style.display = 'block';
          videoElement.style.opacity = '1';
          videoElement.style.visibility = 'visible';
          
          // Log video element state
          console.log('Video element state:', {
            width: videoElement.offsetWidth,
            height: videoElement.offsetHeight,
            display: videoElement.style.display,
            opacity: videoElement.style.opacity
          });
          
        } catch (playError) {
          console.error('❌ Video play error:', playError);
          throw playError;
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
  // Event Listeners (same as before)
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
        
        const videoElement = document.createElement('video');
        videoElement.id = `video-${user.uid}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = 'remote-video-element';
        
        videoContainer.appendChild(videoElement);
        
        const remoteVideosGrid = document.querySelector('.remote-videos-grid');
        if (remoteVideosGrid) {
          remoteVideosGrid.appendChild(videoContainer);
        }
        
        user.videoTrack.play(videoElement);
        remoteUsersRef.current[user.uid] = { container: videoContainer, videoElement };
      }
      
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
      
      updateParticipantCount();
    });

    client.on('user-unpublished', (user, mediaType) => {
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
        
        if (localVideoRef.current) {
          localVideoRef.current.style.display = newState ? 'block' : 'none';
        }
        
        setControls(prev => ({ ...prev, videoEnabled: newState }));
        console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Toggle video error:', error);
      }
    } else {
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
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1',
          optimizationMode: 'detail'
        });
        
        if (localTracks.video) {
          await clientRef.current.unpublish([localTracks.video]);
          localTracks.video.stop();
          localTracks.video.close();
        }
        
        await clientRef.current.publish([screenTrack]);
        
        setLocalTracks(prev => ({ 
          ...prev, 
          video: screenTrack 
        }));
        
        if (localVideoRef.current) {
          screenTrack.play(localVideoRef.current);
        }
        
        setControls(prev => ({ ...prev, screenSharing: true }));
        console.log('🖥️ Screen sharing started');
        
      } else {
        const screenTrack = localTracks.video;
        
        if (screenTrack) {
          await clientRef.current.unpublish([screenTrack]);
          screenTrack.stop();
          screenTrack.close();
        }
        
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
  // Chat Functions (same as before)
  // ============================================

  const sendMessage = async () => {
    const messageText = newMessage.trim();
    if (!messageText || !sessionState.sessionInfo?.meetingId) return;
    
    try {
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
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      scrollToBottom();
      
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, status: 'sent' }
            : msg
        ));
        
        simulateStudentResponse(messageText);
      }, 500);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...msg, status: 'failed' }
          : msg
      ));
    }
  };

  const simulateStudentResponse = (teacherMessage) => {
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
    console.log('Polling chat messages...');
    const interval = setInterval(() => {}, 5000);
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
      </div>
    </div>
  );

  // ============================================
  // Render - FUTURISTIC DESIGN
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
    <div className="video-call-container futuristic-theme">
      {/* Minimal Header */}
      <div className={`call-header ${showControls ? 'visible' : 'hidden'}`}>
        <div className="header-left">
          <div className="session-info">
            <h2 className="class-title">{sessionState.sessionInfo?.session?.class_title || 'Video Class'}</h2>
            <div className="header-stats">
              <span className="stat-chip">
                <span className="stat-icon">⏱️</span>
                {formatDuration(stats.duration)}
              </span>
              <span className="stat-chip">
                <span className="stat-icon">👥</span>
                {stats.participantCount}
              </span>
              {controls.recording && (
                <span className="recording-indicator">
                  <span className="recording-dot"></span>
                  REC
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Video Area - Full Screen */}
      <div className="video-main-area">
        {/* Local Video - Centered and Compact */}
        <div className="local-video-container floating-video">
          <div className="video-wrapper">
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
              </div>
            )}
            
            {/* Video Status Overlay */}
            <div className="video-status-overlay">
              {!controls.videoEnabled && <span className="status-tag">🎤 Audio Only</span>}
              {controls.screenSharing && <span className="status-tag">🖥️ Screen Sharing</span>}
              <span className="name-tag">Host</span>
            </div>
          </div>
        </div>

        {/* Remote Videos Grid */}
        <div className="remote-videos-grid">
          {/* Remote videos are added dynamically here */}
        </div>
      </div>

      {/* Floating Control Center - Auto-hide */}
      <div className={`floating-controls ${showControls ? 'visible' : 'hidden'}`}>
        <div className="control-center">
          {/* Primary Controls - Compact Circle */}
          <div className="primary-controls">
            <button 
              className={`control-orb audio-orb ${controls.audioEnabled ? 'active' : 'muted'}`}
              onClick={toggleAudio}
              title={controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              <span className="orb-icon">
                {controls.audioEnabled ? '🎤' : '🔇'}
              </span>
              <span className="orb-tooltip">
                {controls.audioEnabled ? 'Mute' : 'Unmute'}
              </span>
            </button>

            <button 
              className={`control-orb video-orb ${controls.videoEnabled ? 'active' : 'inactive'}`}
              onClick={toggleVideo}
              title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <span className="orb-icon">
                {controls.videoEnabled ? '📹' : '📷'}
              </span>
              <span className="orb-tooltip">
                {controls.videoEnabled ? 'Stop Video' : 'Start Video'}
              </span>
            </button>

            {/* Screen Share */}
            <button 
              className={`control-orb screen-orb ${controls.screenSharing ? 'active' : ''}`}
              onClick={toggleScreenShare}
              title={controls.screenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <span className="orb-icon">
                {controls.screenSharing ? '🖥️' : '📱'}
              </span>
              <span className="orb-tooltip">
                {controls.screenSharing ? 'Stop Share' : 'Share Screen'}
              </span>
            </button>

            {/* Recording */}
            <button 
              className={`control-orb record-orb ${controls.recording ? 'recording' : ''}`}
              onClick={toggleRecording}
              title={controls.recording ? 'Stop recording' : 'Start recording'}
            >
              <span className="orb-icon">
                ⏺️
              </span>
              <span className="orb-tooltip">
                {controls.recording ? 'Stop Record' : 'Record'}
              </span>
              {controls.recording && <div className="pulse-ring"></div>}
            </button>
          </div>

          {/* Secondary Controls - Bottom Row */}
          <div className="secondary-controls">
            {/* Chat */}
            <button 
              className={`control-button chat-btn ${controls.isChatOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }))}
              title="Toggle chat"
            >
              <span className="btn-icon">💬</span>
              {messages.length > 0 && (
                <span className="message-count-badge">{messages.length}</span>
              )}
            </button>

            {/* Participants */}
            <button 
              className={`control-button participants-btn ${controls.isParticipantsOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }))}
              title="Show participants"
            >
              <span className="btn-icon">👥</span>
              <span className="participant-count">{participants.length}</span>
            </button>

            {/* Leave & End Buttons */}
            <div className="action-buttons">
              <button 
                className="control-button leave-btn"
                onClick={leaveSession}
                disabled={isLeaving}
                title="Leave the call (others can continue)"
              >
                <span className="btn-icon">🚪</span>
                <span className="btn-text">{isLeaving ? '...' : 'Leave'}</span>
              </button>

              <button 
                className="control-button end-btn"
                onClick={endSession}
                disabled={isEnding}
                title="End call for everyone"
              >
                <span className="btn-icon">⏹️</span>
                <span className="btn-text">{isEnding ? '...' : 'End'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Chat Panel */}
      {controls.isChatOpen && (
        <div className="minimal-chat-panel">
          <div className="chat-header">
            <h3>Chat ({messages.length})</h3>
            <button 
              className="close-chat"
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
              </div>
            ) : (
              messages.map(renderMessage)
            )}
          </div>
          
          <div className="chat-input-compact">
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
              className="send-btn-mini"
            >
              ↑
            </button>
          </div>
        </div>
      )}
      
      {/* Show Controls Hint */}
      {!showControls && (
        <div className="controls-hint">
          Move mouse to show controls
        </div>
      )}
    </div>
  );
};

export default TeacherVideoCall;