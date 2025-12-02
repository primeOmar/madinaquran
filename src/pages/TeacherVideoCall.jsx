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
  const localVideoContainerRef = useRef(null);

  // ============================================
  // Initialization
  // ============================================

  useEffect(() => {
    initializeSession();
    return cleanup;
  }, [classId, teacherId]);

  const initializeSession = async () => {
    try {
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
      
      if (!channel || !token || !appId) {
        throw new Error('Missing required session credentials');
      }
      
      setupAgoraEventListeners();
      
      await clientRef.current.join(appId, channel, token, uid);

      // Create tracks
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
        
        if (localVideoContainerRef.current) {
          videoTrack.play(localVideoContainerRef.current);
        }
      } catch (videoError) {
        console.warn('Could not create video track:', videoError);
      }

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Publish available tracks
      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);
      
      if (tracksToPublish.length > 0) {
        await clientRef.current.publish(tracksToPublish);
      }

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      // Start tracking
      startDurationTracking(sessionData.session?.start_time || new Date().toISOString());
      
      const meetingId = sessionData.meetingId || sessionData.meeting_id || sessionData.session?.meeting_id;
      if (meetingId) {
        startParticipantTracking(meetingId);
      }

      if (sessionData.session?.id) {
        loadMessages(sessionData.session.id);
      }

    } catch (error) {
      console.error('Join channel error:', error);
      throw new Error(`Failed to join video channel: ${error.message}`);
    }
  };

  // ============================================
  // Control Functions - FIXED
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
    } else {
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: "720p_2",
          optimizationMode: "detail"
        });
        
        await clientRef.current.publish([videoTrack]);
        if (localVideoContainerRef.current) {
          videoTrack.play(localVideoContainerRef.current);
        }
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        
      } catch (error) {
        console.warn('Still cannot access camera:', error);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p_1",
          optimizationMode: "detail"
        });

        // Stop camera video when screen sharing
        if (localTracks.video) {
          await localTracks.video.setEnabled(false);
        }

        await clientRef.current.publish([screenTrack]);

        setControls(prev => ({ ...prev, screenSharing: true }));

        screenTrack.on('track-ended', () => {
          stopScreenShare();
        });

      } else {
        await stopScreenShare();
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  const stopScreenShare = async () => {
    setControls(prev => ({ ...prev, screenSharing: false }));
    
    // Re-enable camera video
    if (localTracks.video) {
      await localTracks.video.setEnabled(true);
    }
  };

  // FIXED LEAVE SESSION FUNCTION
  const leaveSession = async () => {
    if (isLeaving) return;
    
    setIsLeaving(true);
    try {
      // Leave Agora channel
      if (clientRef.current) {
        await clientRef.current.leave();
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
      
      // Call API to update participant status
      if (sessionState.sessionInfo?.meetingId) {
        await videoApi.leaveVideoSession(
          sessionState.sessionInfo.meetingId,
          teacherId
        );
      }
      
      // Clear intervals
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
      
      // Call parent callback to exit video call
      if (onEndCall) {
        onEndCall();
      }
      
    } catch (error) {
      console.error('Leave session error:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  // FIXED END SESSION FUNCTION
  const endSession = async () => {
    if (isEnding) return;
    
    if (!window.confirm('Are you sure you want to end this session for all participants?')) {
      return;
    }
    
    setIsEnding(true);
    try {
      // End session on backend
      if (sessionState.sessionInfo?.meetingId) {
        await videoApi.endVideoSession(
          sessionState.sessionInfo.meetingId,
          teacherId
        );
      }
      
      // Leave Agora channel
      if (clientRef.current) {
        await clientRef.current.leave();
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
      
      // Clear intervals
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
      
      // Call parent callback
      if (onEndCall) {
        onEndCall();
      }
      
    } catch (error) {
      console.error('End session error:', error);
      alert('Failed to end session: ' + error.message);
    } finally {
      setIsEnding(false);
    }
  };

  // ============================================
  // Participant Tracking
  // ============================================

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

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

  // ============================================
  // Chat Functions
  // ============================================

  const loadMessages = async (sessionId) => {
    try {
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
      
      if (chatInputRef.current) {
        chatInputRef.current.focus();
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  // ============================================
  // Cleanup
  // ============================================

  const cleanup = () => {
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

  // ============================================
  // Agora Event Listeners
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        setRemoteTracks(prev => new Map(prev).set(user.uid, { 
          ...prev.get(user.uid), 
          video: user.videoTrack 
        }));
      }

      if (mediaType === 'audio') {
        setRemoteTracks(prev => new Map(prev).set(user.uid, { 
          ...prev.get(user.uid), 
          audio: user.audioTrack 
        }));
        user.audioTrack?.play();
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
  };

  // ============================================
  // Duration and Formatting
  // ============================================

  const startDurationTracking = (startTime) => {
    const start = new Date(startTime);
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    durationIntervalRef.current = setInterval(() => {
      const diff = Math.floor((new Date() - start) / 1000);
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
  // RENDER - Updated Dark Theme
  // ============================================

  if (sessionState.error) {
    return (
      <div className="video-error">
        <div className="error-content">
          <h2>Session Error</h2>
          <p>{sessionState.error}</p>
          <button onClick={initializeSession} className="retry-btn">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!sessionState.isJoined) {
    return (
      <div className="video-loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Initializing video session...</p>
          <small>This may take a few moments</small>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-video-call dark-theme">
      {/* Header */}
      <div className="video-header">
        <div className="header-content">
          <div className="session-info">
            <h2>{sessionState.sessionInfo?.session?.class_title || 'Video Session'}</h2>
            <div className="session-stats">
              <span className="stat-item">
                <i className="stat-icon">⏱️</i>
                {formatDuration(stats.duration)}
              </span>
              <span className="stat-item">
                <i className="stat-icon">👥</i>
                {stats.participantCount} online
              </span>
              <span className={`stat-item quality-${stats.connectionQuality}`}>
                <i className="stat-icon">📶</i>
                {stats.connectionQuality}
              </span>
            </div>
          </div>
          
          <div className="header-controls">
            <button 
              className={`header-btn ${controls.isChatOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }))}
            >
              <i className="btn-icon">💬</i>
              Chat
            </button>
            <button 
              className={`header-btn ${controls.isParticipantsOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }))}
            >
              <i className="btn-icon">👥</i>
              Participants
              <span className="badge">{participants.length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="video-main">
        {/* Video Grid */}
        <div className="video-grid">
          {/* Local Video */}
          <div className="video-card local-card">
            <div className="card-header">
              <span className="user-name">You (Host)</span>
              <div className="status-indicators">
                {!controls.audioEnabled && <span className="status-badge muted">🔇</span>}
                {!controls.videoEnabled && <span className="status-badge">📷</span>}
                {controls.screenSharing && <span className="status-badge sharing">🖥️</span>}
              </div>
            </div>
            <div className="video-container" ref={localVideoContainerRef}>
              {!localTracks.video && (
                <div className="video-placeholder">
                  <div className="avatar-large">
                    <span>YOU</span>
                  </div>
                  <div className="placeholder-text">
                    <p>Camera is off</p>
                    <small>Click camera button to enable</small>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Remote Videos */}
          {Array.from(remoteTracks.entries()).map(([uid, tracks]) => (
            <div key={uid} className="video-card remote-card">
              <div className="card-header">
                <span className="user-name">Student {uid}</span>
                <div className="status-indicators">
                  {!tracks.audio && <span className="status-badge muted">🔇</span>}
                </div>
              </div>
              {tracks.video ? (
                <div className="video-container remote-video">
                  {/* Video will be rendered here */}
                </div>
              ) : (
                <div className="video-placeholder">
                  <div className="avatar-large">
                    <span>S{uid.toString().charAt(0)}</span>
                  </div>
                  <div className="placeholder-text">
                    <p>Camera is off</p>
                  </div>
                </div>
              )}
            </div>
          ))}
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
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet</p>
                  <small>Start a conversation!</small>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="message">
                    <div className="message-header">
                      <strong>{msg.profiles?.full_name || 'System'}</strong>
                      <small>{new Date(msg.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}</small>
                    </div>
                    <div className="message-body">{msg.message_text}</div>
                  </div>
                ))
              )}
            </div>
            <div className="message-input">
              <input
                ref={chatInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
              />
              <button 
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="send-btn"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Participants Panel */}
        {controls.isParticipantsOpen && (
          <div className="participants-panel">
            <div className="panel-header">
              <h3>Participants ({participants.length + 1})</h3>
              <button 
                className="close-panel"
                onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: false }))}
              >
                ✕
              </button>
            </div>
            <div className="participants-list">
              {/* Host */}
              <div className="participant-item host">
                <div className="participant-avatar">
                  <span>H</span>
                </div>
                <div className="participant-info">
                  <strong>You (Host)</strong>
                  <div className="participant-status">
                    <span className={`audio-status ${controls.audioEnabled ? 'on' : 'off'}`}>
                      {controls.audioEnabled ? '🎤' : '🔇'}
                    </span>
                    <span className={`video-status ${controls.videoEnabled ? 'on' : 'off'}`}>
                      {controls.videoEnabled ? '📹' : '📷'}
                    </span>
                    {controls.screenSharing && <span className="screen-share">🖥️</span>}
                  </div>
                </div>
              </div>

              {/* Other Participants */}
              {participants.map(p => (
                <div key={p.id} className="participant-item">
                  <div className="participant-avatar">
                    <span>{p.profiles?.full_name?.charAt(0) || 'U'}</span>
                  </div>
                  <div className="participant-info">
                    <strong>{p.profiles?.full_name || `User ${p.user_id?.slice(0, 4)}`}</strong>
                    <div className="participant-status">
                      <span className={`status ${p.status || 'online'}`}>
                        {p.status || 'online'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar - Fixed with Dark Theme */}
      <div className="control-bar">
        <div className="control-group">
          <button 
            className={`control-btn ${controls.audioEnabled ? 'active' : 'inactive'}`}
            onClick={toggleAudio}
            title={controls.audioEnabled ? 'Mute' : 'Unmute'}
          >
            <i className="btn-icon">
              {controls.audioEnabled ? '🎤' : '🔇'}
            </i>
            <span>{controls.audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>

          <button 
            className={`control-btn ${controls.videoEnabled ? 'active' : 'inactive'}`}
            onClick={toggleVideo}
            title={controls.videoEnabled ? 'Stop Video' : 'Start Video'}
          >
            <i className="btn-icon">
              {controls.videoEnabled ? '📹' : '📷'}
            </i>
            <span>{controls.videoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>

          <button 
            className={`control-btn ${controls.screenSharing ? 'active sharing' : ''}`}
            onClick={toggleScreenShare}
            title={controls.screenSharing ? 'Stop Sharing' : 'Share Screen'}
          >
            <i className="btn-icon">
              {controls.screenSharing ? '🖥️' : '📱'}
            </i>
            <span>{controls.screenSharing ? 'Stop Share' : 'Share Screen'}</span>
          </button>

          <button 
            className={`control-btn ${controls.recording ? 'active recording' : ''}`}
            onClick={() => setControls(prev => ({ ...prev, recording: !prev.recording }))}
            title={controls.recording ? 'Stop Recording' : 'Start Recording'}
          >
            <i className="btn-icon">
              {controls.recording ? '⏺️' : '⏺️'}
            </i>
            <span>{controls.recording ? 'Stop Record' : 'Record'}</span>
          </button>
        </div>

        <div className="control-group action-buttons">
          <button 
            className="control-btn leave-btn"
            onClick={leaveSession}
            disabled={isLeaving}
            title="Leave Session (Others can continue)"
          >
            <i className="btn-icon">🚪</i>
            <span>{isLeaving ? 'Leaving...' : 'Leave'}</span>
          </button>

          <button 
            className="control-btn end-btn"
            onClick={endSession}
            disabled={isEnding}
            title="End Session for Everyone"
          >
            <i className="btn-icon">⏹️</i>
            <span>{isEnding ? 'Ending...' : 'End Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherVideoCall;