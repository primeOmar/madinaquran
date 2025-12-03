// ============================================
// StudentVideoCall Component
// Student interface for joining video sessions
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from '../lib/agora/videoApi';
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
    handRaised: false
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
  // Initialization
  // ============================================

  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [meetingId, studentId]);

  const initializeSession = async () => {
    try {
      // First, validate the session and check permissions
      const sessionInfo = await videoApi.getSessionInfo(meetingId);
if (!sessionInfo.exists || !sessionInfo.isActive) {
  setSessionState({
    isInitialized: false,
    isJoined: false,
    error: 'Session not found or inactive'
  });
  return;
}

      if (!validation.valid) {
        setSessionState({
          isInitialized: false,
          isJoined: false,
          sessionInfo: null,
          error: validation.reason || 'Cannot join session'
        });
        return;
      }

      // Create Agora client
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      // Join the session via API
      const sessionData = await videoApi.joinVideoSession(
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
      console.error('Initialization error:', error);
      setSessionState(prev => ({
        ...prev,
        error: error.message || 'Failed to join video session'
      }));
    }
  };

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;

      // Setup event listeners
      setupAgoraEventListeners();

      // Join channel
      await clientRef.current.join(appId, channel, token, uid);

      // Create and publish local tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { encoderConfig: "music_standard" },
        { 
          encoderConfig: "480p_1",
          optimizationMode: "motion"
        }
      );

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Check if student has permission to publish
      if (sessionData.participant.permissions.includes('publish')) {
        await clientRef.current.publish([audioTrack, videoTrack]);
      }

      // Play local video
      videoTrack.play('student-local-video');

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      // Start tracking
      startDurationTracking(sessionData.session.start_time);
      startMessagePolling(sessionData.session.id);

      // Add join message
      addSystemMessage('You joined the session');

    } catch (error) {
      console.error('Join channel error:', error);
      throw new Error('Failed to join video channel: ' + error.message);
    }
  };

  // ============================================
  // Agora Event Listeners
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

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

    client.on('connection-state-change', (curState, prevState, reason) => {
      console.log('Connection state:', curState);
      
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

      // Update in database
      updateParticipantStatus({ 
        connectionQuality: qualityMap[quality.uplinkNetworkQuality] 
      });
    });

    client.on('token-privilege-will-expire', async () => {
      try {
        const newToken = await videoApi.generateToken(meetingId, studentId);
        await client.renewToken(newToken.token);
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
  // Control Functions
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      
      updateParticipantStatus({ audioEnabled: newState });
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      
      updateParticipantStatus({ videoEnabled: newState });
    }
  };

  const toggleHandRaise = () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    // Send message to notify teacher
    if (sessionState.sessionInfo) {
      sendMessage(
        newState ? '✋ Raised hand' : 'Lowered hand',
        'system'
      );
    }
  };

  const leaveSession = async () => {
    try {
      await updateParticipantStatus({ status: 'left' });
      cleanup();
      
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
    switch (command.type) {
      case 'mute_all':
        if (localTracks.audio && controls.audioEnabled) {
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
      if (sessionState.sessionInfo) {
        await videoApi.updateParticipantStatus(
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

  const startDurationTracking = (startTime) => {
    const start = new Date(startTime);
    
    durationIntervalRef.current = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now - start) / 1000);
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
      const msgs = await videoApi.getSessionMessages(sessionId);
      setMessages(msgs.reverse());
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const sendMessage = async (text = null, type = 'text') => {
    const messageText = text || newMessage.trim();
    if (!messageText || !sessionState.sessionInfo) return;

    try {
      const message = await videoApi.sendMessage(
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
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }

    if (localTracks.audio) {
      localTracks.audio.stop();
      localTracks.audio.close();
    }
    if (localTracks.video) {
      localTracks.video.stop();
      localTracks.video.close();
    }

    if (clientRef.current) {
      await clientRef.current.leave();
    }
  };

  // ============================================
  // Render
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
      </div>
    );
  }

  return (
    <div className="student-video-call">
      {/* Header */}
      <div className="video-header">
        <div className="session-info">
          <h2>{sessionState.sessionInfo?.session?.class_title}</h2>
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
            <RemoteVideo key={uid} uid={uid} tracks={tracks} isMain={true} />
          ))}
          
          {remoteTracks.size === 0 && (
            <div className="waiting-message">
              <h3>Waiting for teacher to start video...</h3>
            </div>
          )}
        </div>

        {/* Local Video (Small Preview) */}
        <div className="local-video" style={{ 
          position: 'fixed',
          bottom: '120px',
          right: showChat ? '340px' : '20px',
          width: '200px',
          height: '150px',
          zIndex: 100
        }}>
          <div id="student-local-video" className="video-container"></div>
          <div className="video-label">You</div>
        </div>
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button 
          className={`control-btn ${!controls.audioEnabled ? 'disabled' : ''}`}
          onClick={toggleAudio}
        >
          🎤 {controls.audioEnabled ? 'Mute' : 'Unmute'}
        </button>

        <button 
          className={`control-btn ${!controls.videoEnabled ? 'disabled' : ''}`}
          onClick={toggleVideo}
        >
          📹 {controls.videoEnabled ? 'Stop Video' : 'Start Video'}
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
            {messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.message_type}`}>
                <strong>{msg.profiles?.full_name || 'Unknown'}:</strong>
                <span>{msg.message_text}</span>
                <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
              </div>
            ))}
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

// Remote Video Component
const RemoteVideo = ({ uid, tracks, isMain }) => {
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
    <div className={`remote-video ${isMain ? 'main-video' : ''}`}>
      <div ref={videoRef} className="video-container"></div>
      <div className="video-label">Teacher</div>
    </div>
  );
};

export default StudentVideoCall;
