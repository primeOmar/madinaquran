// ============================================
// TeacherVideoCall Component
// Complete video call interface with database integration
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from './services/videoApi';
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
    recording: false
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
      const { channel, token, uid, appId } = sessionData;

      // Setup event listeners
      setupAgoraEventListeners();

      // Join channel
      await clientRef.current.join(appId, channel, token, uid);

      // Create and publish local tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { 
          encoderConfig: "music_standard" 
        },
        { 
          encoderConfig: "720p_2",
          optimizationMode: "detail"
        }
      );

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Publish tracks
      await clientRef.current.publish([audioTrack, videoTrack]);

      // Play local video
      videoTrack.play('local-video-container');

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      // Start tracking session duration
      startDurationTracking(sessionData.session.start_time);

      // Start participant updates
      startParticipantTracking(sessionData.session.id);

      // Load chat messages
      loadMessages(sessionData.session.id);

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

      // Update participant count
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
      if (sessionState.sessionInfo) {
        updateParticipantInDatabase({
          connectionQuality: qualityMap[quality.uplinkNetworkQuality]
        });
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
  // Control Functions
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));

      // Update database
      updateParticipantInDatabase({ audioEnabled: newState });
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));

      // Update database
      updateParticipantInDatabase({ videoEnabled: newState });
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

  const endSession = async () => {
    if (!window.confirm('Are you sure you want to end this session for all participants?')) {
      return;
    }

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
  };

  // ============================================
  // Database Updates
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
      participantCount: remoteUsers.length + 1 // +1 for local user
    }));
  };

  const startParticipantTracking = (sessionId) => {
    participantUpdateIntervalRef.current = setInterval(async () => {
      try {
        const participants = await videoApi.getSessionParticipants(
          sessionState.sessionInfo.meetingId
        );
        setParticipants(participants);
      } catch (error) {
        console.error('Participant tracking error:', error);
      }
    }, 5000); // Update every 5 seconds
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

  const loadMessages = async (sessionId) => {
    try {
      const msgs = await videoApi.getSessionMessages(sessionId);
      setMessages(msgs.reverse()); // Show oldest first
    } catch (error) {
      console.error('Load messages error:', error);
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
    
    // Update participant status
    await updateParticipantInDatabase({ 
      status: 'disconnected'
    });

    // Attempt reconnection for certain reasons
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
  // Render
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
          <h2>{sessionState.sessionInfo?.session?.class_title}</h2>
          <span className="duration">{formatDuration(stats.duration)}</span>
          <span className={`quality quality-${stats.connectionQuality}`}>
            {stats.connectionQuality}
          </span>
          <span className="participant-count">
            {stats.participantCount} participant{stats.participantCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="video-main">
        {/* Local Video */}
        <div className="local-video">
          <div id="local-video-container" className="video-container"></div>
          <div className="video-label">You (Host)</div>
        </div>

        {/* Remote Videos */}
        <div className="remote-videos">
          {Array.from(remoteTracks.entries()).map(([uid, tracks]) => (
            <RemoteVideo key={uid} uid={uid} tracks={tracks} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button 
          className={`control-btn ${!controls.audioEnabled ? 'disabled' : ''}`}
          onClick={toggleAudio}
          title={controls.audioEnabled ? 'Mute' : 'Unmute'}
        >
          🎤 {controls.audioEnabled ? 'Mute' : 'Unmute'}
        </button>

        <button 
          className={`control-btn ${!controls.videoEnabled ? 'disabled' : ''}`}
          onClick={toggleVideo}
          title={controls.videoEnabled ? 'Stop Video' : 'Start Video'}
        >
          📹 {controls.videoEnabled ? 'Stop Video' : 'Start Video'}
        </button>

        <button 
          className={`control-btn ${controls.screenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          title="Share Screen"
        >
          🖥️ {controls.screenSharing ? 'Stop Sharing' : 'Share Screen'}
        </button>

        <button 
          className={`control-btn ${controls.recording ? 'recording' : ''}`}
          onClick={toggleRecording}
          title="Record Session"
        >
          ⏺️ {controls.recording ? 'Stop Recording' : 'Record'}
        </button>

        <button 
          className="control-btn end-call"
          onClick={endSession}
          title="End Session"
        >
          📞 End Session
        </button>
      </div>

      {/* Chat Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>Chat</h3>
          <span>{messages.length} messages</span>
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
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>

      {/* Participants List */}
      <div className="participants-list">
        <h3>Participants ({participants.length})</h3>
        {participants.map(p => (
          <div key={p.id} className="participant-item">
            <span>{p.profiles?.full_name}</span>
            <span className={`status ${p.status}`}>{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Remote Video Component
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
    <div className="remote-video">
      <div ref={videoRef} className="video-container"></div>
      <div className="video-label">User {uid}</div>
    </div>
  );
};

export default TeacherVideoCall;
