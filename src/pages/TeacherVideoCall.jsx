// ============================================
// TeacherVideoCall Component
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

    // ============== ADD THIS CRITICAL PART ==============
    // Try to create tracks with fallback for no camera
    let audioTrack = null;
    let videoTrack = null;
    
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "music_standard"
      });
    } catch (audioError) {
      console.warn('Could not create audio track:', audioError);
      // Don't fail if no audio
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
      // Set up placeholder for local video
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
    if (sessionData.session?.id) {
      startParticipantTracking(sessionData.session.id);
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

// Add this helper function
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

// Helper to get user initials
const getUserInitials = () => {
  // You can get this from your user context
  const userName = "You"; // Replace with actual user name
  return userName.charAt(0).toUpperCase();
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
    updateParticipantInDatabase({ videoEnabled: newState });
  } else {
    // Try to enable camera if it wasn't available initially
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
      
      // Remove placeholder
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

const startParticipantTracking = useCallback((sessionId) => {
  // Clear any existing interval first
  if (participantUpdateIntervalRef.current) {
    clearInterval(participantUpdateIntervalRef.current);
  }
  
  console.log('🔍 Starting participant tracking with:', {
    sessionId,
    currentMeetingId: sessionState.sessionInfo?.meetingId,
    sessionInfoExists: !!sessionState.sessionInfo
  });

  // Create a stable reference to the meetingId that doesn't depend on stale state
  let meetingIdToUse = null;
  
  const getMeetingId = () => {
    // First, try to get from the argument (passed from joinChannel)
    if (sessionId && typeof sessionId === 'string') {
      // Check if it looks like a meetingId (not a numeric database ID)
      if (sessionId.includes('-') || sessionId.length > 10) {
        return sessionId;
      }
    }
    
    // Try from current state
    if (sessionState.sessionInfo?.meetingId) {
      return sessionState.sessionInfo.meetingId;
    }
    
    // Try from session object
    if (sessionState.sessionInfo?.session?.meeting_id) {
      return sessionState.sessionInfo.session.meeting_id;
    }
    
    return null;
  };

  meetingIdToUse = getMeetingId();

  if (!meetingIdToUse) {
    console.warn('⚠️ No meetingId available yet, will retry in 2 seconds');
    
    // Retry after state settles
    const retryTimeout = setTimeout(() => {
      const retryMeetingId = getMeetingId();
      if (retryMeetingId) {
        console.log('✅ Found meetingId on retry:', retryMeetingId);
        startParticipantTracking(retryMeetingId);
      } else {
        console.error('❌ Still no meetingId after retry');
      }
    }, 2000);

    // Store timeout reference for cleanup
    participantUpdateIntervalRef.current = {
      type: 'timeout',
      id: retryTimeout
    };
    
    return;
  }

  console.log('✅ Starting participant tracking with meetingId:', meetingIdToUse);

  // Store meetingId in a ref so the interval callback has access to it
  const meetingIdRef = useRef(meetingIdToUse);
  meetingIdRef.current = meetingIdToUse;

  // Start the interval
  const intervalId = setInterval(async () => {
    try {
      console.log('📊 Fetching participants for meeting:', meetingIdRef.current);
      
      const participants = await videoApi.getSessionParticipants(meetingIdRef.current);
      
      console.log('📊 Participants received:', {
        count: participants?.length || 0
      });
      
      setParticipants(participants || []);
      
      // Update participant count from Agora
      updateParticipantCount();
      
    } catch (error) {
      console.error('❌ Participant tracking error:', error);
      // Don't stop tracking on error, just log
    }
  }, 5000);

  // Store the interval ID for cleanup
  participantUpdateIntervalRef.current = {
    type: 'interval',
    id: intervalId
  };

  // Initial fetch
  setTimeout(() => {
    videoApi.getSessionParticipants(meetingIdRef.current)
      .then(participants => {
        setParticipants(participants || []);
        updateParticipantCount();
      })
      .catch(console.error);
  }, 1000);

}, [sessionState.sessionInfo]); 

  // ============================================
  // Duration Tracking
  // ============================================

 const startDurationTracking = (startTime) => {
  // Validate startTime
  if (!startTime) {
    // Use current time as fallback
    startTime = new Date().toISOString();
  }
  
  const start = new Date(startTime);
  
  // Clear any existing interval
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
  // Add null/undefined check
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return "00:00:00";
  }
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

  // ============================================
  // Chat Functions
  // ============================================

  const [loading, setLoading] = useState({
  messages: false,
  participants: false,
  tracks: false
});

const loadMessages = async (sessionId) => {
  try {
    // Check if sessionId exists
    if (!sessionId) {
      console.warn('No session ID provided for loading messages');
      return;
    }
    
    // Check if videoApi has getSessionMessages function
    if (!videoApi.getSessionMessages || typeof videoApi.getSessionMessages !== 'function') {
      console.warn('getSessionMessages function not available in videoApi');
      
      // Mock data for development
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
    setMessages(msgs?.reverse() || []); // Safely handle null response
  } catch (error) {
    console.error('Load messages error:', error);
    // Set empty array on error
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
  // Clear intervals and timeouts
  if (participantUpdateIntervalRef.current) {
    if (participantUpdateIntervalRef.current.type === 'interval') {
      clearInterval(participantUpdateIntervalRef.current.id);
    } else if (participantUpdateIntervalRef.current.type === 'timeout') {
      clearTimeout(participantUpdateIntervalRef.current.id);
    }
    participantUpdateIntervalRef.current = null;
  }

  // Stop local tracks if they exist
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
  <div id="local-video-container" className="video-container">
    {/* Video will be rendered here or placeholder */}
  </div>
  <div className="video-label">
    You (Host)
    {!localTracks.video && (
      <span className="audio-only-badge">🎤 Audio Only</span>
    )}
  </div>
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
  {/* Audio control - always show */}
  <button 
    className={`control-btn ${!controls.audioEnabled ? 'disabled' : ''}`}
    onClick={toggleAudio}
    disabled={!localTracks.audio}
    title={controls.audioEnabled ? 'Mute' : 'Unmute'}
  >
    🎤 {controls.audioEnabled ? 'Mute' : 'Unmute'}
  </button>

  {/* Video control - conditionally show */}
  {localTracks.video ? (
    <button 
      className={`control-btn ${!controls.videoEnabled ? 'disabled' : ''}`}
      onClick={toggleVideo}
      title={controls.videoEnabled ? 'Stop Video' : 'Start Video'}
    >
      📹 {controls.videoEnabled ? 'Stop Video' : 'Start Video'}
    </button>
  ) : (
    <button 
      className="control-btn disabled"
      onClick={() => {
        alert('Camera not available. Please connect a camera to enable video.');
      }}
      title="Camera Not Available"
    >
      📷 No Camera
    </button>
  )}

  {/* Other controls remain the same */}
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
      {tracks.video ? (
        <div ref={videoRef} className="video-container"></div>
      ) : (
        <div className="video-placeholder">
          <div className="avatar-placeholder">
            <span className="avatar-initials">U{uid.toString().charAt(0)}</span>
          </div>
          <div className="placeholder-text">
            <span className="audio-icon">🎤</span>
            <small>Audio only</small>
          </div>
        </div>
      )}
      <div className="video-label">
        User {uid}
        {!tracks.video && (
          <span className="audio-only-badge">🎤</span>
        )}
      </div>
    </div>
  );
};

export default TeacherVideoCall;
