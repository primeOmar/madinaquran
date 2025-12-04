import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import studentvideoApi from '../lib/agora/studentvideoApi.js';
import './TeacherVideoCall.css'; 

const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false, // Track if camera exists
    hasMicrophone: false // Track if mic exists
  });

  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown'
  });

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);

  const clientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const messagesPollIntervalRef = useRef(null);

  // ============================================
  // Initialization - FIXED
  // ============================================

  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [meetingId, studentId]);

  const initializeSession = async () => {
    try {
      console.log('🎓 STUDENT: Starting initialization...');
      
      // First, check if session exists
      const sessionInfo = await studentvideoApi.getSessionInfo(meetingId);
      
      if (!sessionInfo.exists || !sessionInfo.isActive) {
        setSessionState({
          isInitialized: false,
          isJoined: false,
          error: 'Session not found or inactive'
        });
        return;
      }

      // Create Agora client
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      // Join the session via API
      const sessionData = await studentvideoApi.joinVideoSession(
        meetingId, 
        studentId, 
        'student'
      );

      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: sessionData,
        error: null
      });

      // Join Agora channel
      await joinChannel(sessionData);

    } catch (error) {
      console.error('❌ Initialization error:', error);
      setSessionState(prev => ({
        ...prev,
        error: error.message || 'Failed to join video session'
      }));
    }
  };

  // ============================================
  // Join Channel - COMPLETELY REWRITTEN
  // ============================================

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;

      console.log('🎓 STUDENT: Joining channel...', {
        channel,
        uid,
        hasAppId: !!appId,
        hasToken: !!token
      });

      // Setup event listeners FIRST
      setupAgoraEventListeners();

      // Join channel
      await clientRef.current.join(appId, channel, token, uid);

      // ========== GRACEFUL TRACK CREATION ==========
      try {
        // First, detect available devices
        await detectAvailableDevices();
        
        // Create microphone track (WITH FALLBACK)
        let audioTrack = null;
        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true,
            encoderConfig: {
              sampleRate: 48000,
              stereo: true
            }
          });
          setControls(prev => ({ ...prev, hasMicrophone: true }));
          console.log('✅ Microphone track created');
        } catch (audioError) {
          console.warn('⚠️ Could not create microphone track:', audioError.message);
          setControls(prev => ({ ...prev, hasMicrophone: false, audioEnabled: false }));
          // Student can join without microphone
        }

        // Create camera track (WITH FALLBACK)
        let videoTrack = null;
        try {
          // Try lower resolution first for better compatibility
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 15,
              bitrateMin: 500,
              bitrateMax: 1000
            },
            optimizationMode: 'motion'
          });
          setControls(prev => ({ ...prev, hasCamera: true, videoEnabled: true }));
          console.log('✅ Camera track created');
        } catch (videoError) {
          console.warn('⚠️ Could not create camera track:', videoError.message);
          setControls(prev => ({ ...prev, hasCamera: false, videoEnabled: false }));
          // Student can join without camera
          
          // Optionally create a placeholder track
          videoTrack = null;
        }

        // Set tracks
        setLocalTracks({ audio: audioTrack, video: videoTrack });

        // Publish available tracks
        const tracksToPublish = [];
        if (audioTrack) tracksToPublish.push(audioTrack);
        if (videoTrack) tracksToPublish.push(videoTrack);
        
        if (tracksToPublish.length > 0) {
          await clientRef.current.publish(tracksToPublish);
          console.log(`📤 Published ${tracksToPublish.length} track(s)`);
        } else {
          console.log('ℹ️ No tracks to publish - student will be audio/video only listener');
        }

        // Play video if available
        if (videoTrack) {
          try {
            const videoElement = document.getElementById('student-local-video');
            if (videoElement) {
              videoTrack.play(videoElement);
            }
          } catch (playError) {
            console.warn('⚠️ Could not play local video:', playError.message);
          }
        }

      } catch (trackError) {
        console.error('❌ Track creation error:', trackError);
        // Don't fail the join - allow student to join as listener only
      }

      // Mark as joined
      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      // Start tracking
      startDurationTracking();
      
      // Start message polling if session has ID
      if (sessionData.session?.id) {
        startMessagePolling(sessionData.session.id);
      }

      // Add join message
      addSystemMessage('You joined the session');

      console.log('✅ STUDENT: Successfully joined channel!');

    } catch (error) {
      console.error('❌ Join channel error:', error);
      
      // More specific error messages
      let errorMessage = error.message;
      if (error.message.includes('DEVICE_NOT_FOUND')) {
        errorMessage = 'Cannot access camera/microphone. Please check permissions. You can still join as listener.';
      }
      
      throw new Error('Failed to join video channel: ' + errorMessage);
    }
  };

  // ============================================
  // Device Detection
  // ============================================

  const detectAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      console.log('🔍 Available devices:', {
        cameras: cameras.length,
        microphones: microphones.length,
        cameraNames: cameras.map(c => c.label || 'Unnamed camera'),
        microphoneNames: microphones.map(m => m.label || 'Unnamed microphone')
      });
      
      setControls(prev => ({
        ...prev,
        hasCamera: cameras.length > 0,
        hasMicrophone: microphones.length > 0
      }));
      
      return { hasCamera: cameras.length > 0, hasMicrophone: microphones.length > 0 };
      
    } catch (error) {
      console.warn('⚠️ Device enumeration failed:', error);
      return { hasCamera: false, hasMicrophone: false };
    }
  };

  // ============================================
  // Agora Event Listeners - FIXED
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    if (!client) return;

    client.on('user-published', async (user, mediaType) => {
      console.log('👤 User published:', user.uid, mediaType);
      
      try {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          setRemoteTracks(prev => {
            const updated = new Map(prev);
            const existing = updated.get(user.uid) || {};
            updated.set(user.uid, { ...existing, video: user.videoTrack });
            return updated;
          });
          
          // Auto-play the video
          setTimeout(() => {
            const videoContainer = document.getElementById(`remote-video-${user.uid}`);
            if (videoContainer && user.videoTrack) {
              try {
                user.videoTrack.play(videoContainer);
              } catch (playError) {
                console.warn('Remote video play error:', playError);
              }
            }
          }, 100);
        }

        if (mediaType === 'audio') {
          setRemoteTracks(prev => {
            const updated = new Map(prev);
            const existing = updated.get(user.uid) || {};
            updated.set(user.uid, { ...existing, audio: user.audioTrack });
            return updated;
          });
          
          // Auto-play audio
          if (user.audioTrack) {
            try {
              user.audioTrack.play();
            } catch (playError) {
              console.warn('Remote audio play error:', playError);
            }
          }
        }

        updateParticipantCount();
        
      } catch (error) {
        console.error('Subscribe error:', error);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      console.log('👤 User unpublished:', user.uid, mediaType);
      
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
      console.log('👤 User left:', user.uid);
      
      setRemoteTracks(prev => {
        const updated = new Map(prev);
        updated.delete(user.uid);
        return updated;
      });
      updateParticipantCount();
    });

    client.on('connection-state-change', (curState, prevState, reason) => {
      console.log('🔗 Connection state:', curState, reason);
      
      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        handleDisconnection(reason);
      }
    });

    client.on('network-quality', (quality) => {
      const qualityMap = {
        0: 'unknown',
        1: 'excellent',
        2: 'good',
        3: 'poor',
        4: 'poor',
        5: 'poor',
        6: 'poor'
      };

      setStats(prev => ({
        ...prev,
        connectionQuality: qualityMap[quality.uplinkNetworkQuality] || 'unknown'
      }));
    });

    client.on('token-privilege-will-expire', async () => {
      try {
        console.log('🔄 Token will expire, renewing...');
        const newToken = await studentvideoApi.generateToken(meetingId, studentId);
        if (newToken.token) {
          await client.renewToken(newToken.token);
        }
      } catch (error) {
        console.error('Token renewal error:', error);
      }
    });

    // Listen for stream-message (for teacher controls)
    client.on('stream-message', (uid, data) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(data));
        handleTeacherCommand(message);
      } catch (error) {
        console.error('Stream message error:', error);
      }
    });
  };

  // ============================================
  // Control Functions - UPDATED
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio && controls.hasMicrophone) {
      try {
        const newState = !controls.audioEnabled;
        await localTracks.audio.setEnabled(newState);
        setControls(prev => ({ ...prev, audioEnabled: newState }));
        
        // Update in database
        updateParticipantStatus({ audioEnabled: newState });
      } catch (error) {
        console.warn('Toggle audio error:', error);
      }
    } else {
      setControls(prev => ({ ...prev, audioEnabled: false }));
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video && controls.hasCamera) {
      try {
        const newState = !controls.videoEnabled;
        await localTracks.video.setEnabled(newState);
        setControls(prev => ({ ...prev, videoEnabled: newState }));
        
        // Update in database
        updateParticipantStatus({ videoEnabled: newState });
      } catch (error) {
        console.warn('Toggle video error:', error);
      }
    } else {
      setControls(prev => ({ ...prev, videoEnabled: false }));
    }
  };

  const toggleHandRaise = () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    // Send message to notify teacher
    if (sessionState.sessionInfo?.session?.id) {
      sendMessage(
        newState ? '✋ Raised hand' : 'Lowered hand',
        'system'
      );
    }
  };

  const leaveSession = async () => {
    try {
      // Update participant status
      await updateParticipantStatus({ status: 'left' });
      
      // Cleanup
      await cleanup();
      
      // Callback
      if (onLeaveCall) {
        onLeaveCall();
      }
    } catch (error) {
      console.error('Leave session error:', error);
    }
  };

  // ============================================
  // Teacher Commands Handler
  // ============================================

  const handleTeacherCommand = (command) => {
    console.log('📨 Teacher command:', command);
    
    switch (command.type) {
      case 'mute_all':
        if (localTracks.audio && controls.audioEnabled && controls.hasMicrophone) {
          toggleAudio();
          addSystemMessage('You have been muted by the host');
        }
        break;
      
      case 'end_session':
        addSystemMessage('Session ended by host');
        setTimeout(() => {
          leaveSession();
        }, 2000);
        break;
      
      case 'message':
        addSystemMessage(command.text);
        break;
      
      default:
        console.log('Unknown command:', command);
    }
  };

  // ============================================
  // Database Updates
  // ============================================

  const updateParticipantStatus = async (updates) => {
    try {
      if (sessionState.sessionInfo?.session?.id) {
        await studentvideoApi.updateParticipantStatus(
          sessionState.sessionInfo.session.id,
          studentId,
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

  // ============================================
  // Duration Tracking
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

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // Chat Functions
  // ============================================

  const startMessagePolling = (sessionId) => {
    // Initial load
    loadMessages(sessionId);

    // Poll for new messages every 3 seconds
    messagesPollIntervalRef.current = setInterval(() => {
      loadMessages(sessionId);
    }, 3000);
  };

  const loadMessages = async (sessionId) => {
    try {
      const msgs = await studentvideoApi.getSessionMessages(sessionId);
      setMessages(prev => {
        const newIds = new Set(msgs.map(m => m.id));
        const existing = prev.filter(m => !newIds.has(m.id));
        return [...existing, ...msgs].sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        );
      });
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const sendMessage = async (text = null, type = 'text') => {
    const messageText = text || newMessage.trim();
    if (!messageText || !sessionState.sessionInfo?.session?.id) return;

    try {
      const message = await studentvideoApi.sendMessage(
        sessionState.sessionInfo.session.id,
        studentId,
        messageText,
        type
      );

      setMessages(prev => [...prev, message]);
      if (!text) setNewMessage('');
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
  // Disconnection Handling
  // ============================================

  const handleDisconnection = async (reason) => {
    console.warn('Disconnected:', reason);
    
    await updateParticipantStatus({ status: 'disconnected' });

    // Attempt reconnection
    if (reason === 'NETWORK_ERROR') {
      setTimeout(() => {
        if (sessionState.sessionInfo) {
          joinChannel(sessionState.sessionInfo);
        }
      }, 3000);
    }
  };

  // ============================================
  // Cleanup
  // ============================================

  const cleanup = async () => {
    console.log('🧹 Cleaning up student session...');
    
    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }

    // Stop and close tracks
    if (localTracks.audio) {
      try {
        localTracks.audio.stop();
        localTracks.audio.close();
      } catch (error) {
        console.warn('Audio cleanup error:', error);
      }
    }
    if (localTracks.video) {
      try {
        localTracks.video.stop();
        localTracks.video.close();
      } catch (error) {
        console.warn('Video cleanup error:', error);
      }
    }

    // Leave channel
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (error) {
        console.warn('Leave channel error:', error);
      }
    }

    // Clear remote tracks
    setRemoteTracks(new Map());
    
    console.log('✅ Cleanup complete');
  };

  // ============================================
  // Render - UPDATED
  // ============================================

  if (sessionState.error) {
    return (
      <div className="video-error">
        <h2>Cannot Join Session</h2>
        <p>{sessionState.error}</p>
        <button onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
  }

  if (!sessionState.isJoined) {
    return (
      <div className="video-loading">
        <div className="spinner"></div>
        <p>Joining session...</p>
        <small>Checking device permissions...</small>
      </div>
    );
  }

  return (
    <div className="student-video-call">
      {/* Header */}
      <div className="video-header">
        <div className="session-info">
          <h2>{sessionState.sessionInfo?.session?.class_title || 'Class Session'}</h2>
          <span className="duration">{formatDuration(stats.duration)}</span>
          <span className={`quality quality-${stats.connectionQuality}`}>
            {stats.connectionQuality}
          </span>
          <span className="participant-count">
            {stats.participantCount} participant{stats.participantCount !== 1 ? 's' : ''}
          </span>
        </div>
        <button 
          className="control-btn"
          onClick={() => setShowChat(!showChat)}
        >
          💬 Chat {showChat && '(Hide)'}
        </button>
      </div>

      {/* Main Video Area */}
      <div className="video-main">
        {/* Teacher/Remote Videos (Main View) */}
        <div className="remote-videos" style={{ gridColumn: '1 / -1' }}>
          {Array.from(remoteTracks.entries()).map(([uid, tracks]) => (
            <RemoteVideo key={uid} uid={uid} tracks={tracks} />
          ))}
          
          {remoteTracks.size === 0 && (
            <div className="waiting-message">
              <h3>Waiting for teacher...</h3>
              <p>Teacher will appear here when they start video</p>
            </div>
          )}
        </div>

        {/* Local Video (Small Preview) - Only if camera exists */}
        {controls.hasCamera && localTracks.video && (
          <div className="local-video" style={{ 
            position: 'fixed',
            bottom: '120px',
            right: showChat ? '340px' : '20px',
            width: '200px',
            height: '150px',
            zIndex: 100
          }}>
            <div id="student-local-video" className="video-container"></div>
            <div className="video-label">
              You {!controls.videoEnabled && '(Camera Off)'}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button 
          className={`control-btn ${!controls.audioEnabled ? 'disabled' : ''}`}
          onClick={toggleAudio}
          disabled={!controls.hasMicrophone}
          title={!controls.hasMicrophone ? 'No microphone detected' : controls.audioEnabled ? 'Mute' : 'Unmute'}
        >
          🎤 {controls.hasMicrophone ? (controls.audioEnabled ? 'Mute' : 'Unmute') : 'No Mic'}
        </button>

        <button 
          className={`control-btn ${!controls.videoEnabled ? 'disabled' : ''}`}
          onClick={toggleVideo}
          disabled={!controls.hasCamera}
          title={!controls.hasCamera ? 'No camera detected' : controls.videoEnabled ? 'Stop Video' : 'Start Video'}
        >
          📹 {controls.hasCamera ? (controls.videoEnabled ? 'Stop Video' : 'Start Video') : 'No Cam'}
        </button>

        <button 
          className={`control-btn ${controls.handRaised ? 'active' : ''}`}
          onClick={toggleHandRaise}
        >
          ✋ {controls.handRaised ? 'Lower Hand' : 'Raise Hand'}
        </button>

        <button 
          className="control-btn end-call"
          onClick={leaveSession}
        >
          📞 Leave Session
        </button>
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="chat-sidebar">
          <div className="chat-header">
            <h3>Chat</h3>
            <button onClick={() => setShowChat(false)}>✕</button>
          </div>
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet</p>
                <small>Be the first to say hello!</small>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.message_type}`}>
                  <strong>{msg.profiles?.full_name || 'Unknown'}:</strong>
                  <span>{msg.message_text}</span>
                  <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
                </div>
              ))
            )}
          </div>

          <div className="chat-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
            />
            <button onClick={() => sendMessage()}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Remote Video Component - UPDATED
const RemoteVideo = ({ uid, tracks }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (tracks.video && videoRef.current) {
      try {
        tracks.video.play(videoRef.current);
      } catch (error) {
        console.warn('Remote video play error:', error);
      }
    }

    return () => {
      if (tracks.video) {
        try {
          tracks.video.stop();
        } catch (error) {
          console.warn('Remote video stop error:', error);
        }
      }
    };
  }, [tracks.video]);

  return (
    <div className="remote-video">
      <div ref={videoRef} className="video-container"></div>
      <div className="video-label">Teacher</div>
    </div>
  );
};

export default StudentVideoCall;