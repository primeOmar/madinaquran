import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from '../lib/agora/videoApi';
import './TeacherVideoCall.css';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  Share2, X, 
  Circle, Square, 
  MessageCircle, Users, 
  LogOut, PhoneOff, 
  Send, MessageSquare 
} from 'lucide-react';

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
  const [initialInteraction, setInitialInteraction] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Refs
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const localContainerRef = useRef(null); // Container div for local video
  const remoteUsersRef = useRef({});
  const controlsTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

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
    
    handleMouseMove();
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Handle initial interaction for autoplay policies
  useEffect(() => {
    const onFirstInteraction = () => {
      console.log('[Agora] Initial user interaction detected');
      setInitialInteraction(true);
    };
    
    window.addEventListener('click', onFirstInteraction, { once: true });
    window.addEventListener('keydown', onFirstInteraction, { once: true });
    
    return () => {
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, []);

  // ============================================
  // Initialization - OPTIMIZED VERSION
  // ============================================

  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, teacherId]);

  const initializeSession = async () => {
    if (isConnecting) return;
    
    try {
      setIsConnecting(true);
      console.log('🚀 Initializing video session...');
      
      // DISABLE AGORA LOG UPLOAD - This is causing timeout delays
      // AgoraRTC.enableLogUpload(); // REMOVED
      // AgoraRTC.setLogLevel(1); // REMOVED - Use default level
      
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

      // Set timeout for connection
      connectionTimeoutRef.current = setTimeout(() => {
        if (!sessionState.isJoined) {
          console.warn('[Agora] Connection taking too long, attempting recovery...');
          handleConnectionTimeout();
        }
      }, 10000); // 10 second timeout

      await joinChannel(sessionData);

    } catch (error) {
      console.error('❌ Initialization error:', error);
      setSessionState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize video session'
      }));
    } finally {
      setIsConnecting(false);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    }
  };

  const handleConnectionTimeout = async () => {
    console.log('[Agora] Connection timeout, attempting recovery...');
    try {
      await cleanup();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeSession();
    } catch (error) {
      console.error('[Agora] Recovery failed:', error);
    }
  };

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;
      
      if (!channel || !token || !appId) {
        throw new Error('Missing required session credentials');
      }
      
      console.log('[Agora] Joining channel...');
      
      // Setup event listeners before joining
      setupAgoraEventListeners();
      
      // Join with timeout
      const joinPromise = clientRef.current.join(appId, channel, token, uid);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Join timeout after 8 seconds')), 8000)
      );
      
      await Promise.race([joinPromise, timeoutPromise]);
      
      console.log('✅ Successfully joined channel');

      // Create and publish tracks in parallel for faster initialization
      await Promise.all([
        createAndPublishTracks(),
        initializeParticipants(sessionData)
      ]);

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();

    } catch (error) {
      console.error('❌ Join channel error:', error);
      
      // Retry once on timeout
      if (error.message.includes('timeout')) {
        console.log('[Agora] Retrying connection...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await joinChannel(sessionData);
      } else {
        throw error;
      }
    }
  };

  const initializeParticipants = async (sessionData) => {
    const meetingId = sessionData.meetingId || sessionData.meeting_id;
    if (meetingId) {
      startParticipantTracking(meetingId);
      startChatPolling(meetingId);
    }
  };

  // OPTIMIZED: Create and publish tracks
  const createAndPublishTracks = async () => {
    try {
      console.log('[Agora] Creating local tracks...');

      // Create audio and video tracks in parallel
      const [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack().catch(error => {
          console.warn('[Agora] Could not create audio track:', error);
          return null;
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: '480p', // Lower resolution for faster initialization
          optimizationMode: 'motion'
        }).catch(error => {
          console.warn('[Agora] Could not create video track:', error);
          return null;
        })
      ]);

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Play video immediately if we have a track and container
      if (videoTrack && localContainerRef.current) {
        try {
          await videoTrack.play(localContainerRef.current);
          console.log('[Agora] ✅ Video track playing');
          
          // Apply mirror effect
          const innerVideoEl = localContainerRef.current.querySelector('video');
          if (innerVideoEl) {
            innerVideoEl.style.transform = 'scaleX(-1)';
            innerVideoEl.style.objectFit = 'cover';
          }

          videoTrack.on('track-ended', (evt) => {
            console.warn('[Agora] Video track ended:', evt);
            recreateVideoTrack();
          });

        } catch (playError) {
          console.error('[Agora] ❌ Video play error:', playError);
          // Don't throw - continue with audio only
        }
      }

      // Publish available tracks
      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);
      
      if (tracksToPublish.length > 0) {
        await clientRef.current.publish(tracksToPublish);
        console.log('[Agora] 📤 Published tracks');
      }

    } catch (error) {
      console.error('[Agora] Error creating/publishing tracks:', error);
      // Don't fail the entire session if tracks fail
    }
  };

  // Handle video playback after user interaction
  useEffect(() => {
    if (initialInteraction && localTracks.video && localContainerRef.current && !localTracks.video.isPlaying) {
      console.log('[Agora] User interacted, attempting to play video...');
      localTracks.video.play(localContainerRef.current).catch(e => {
        console.error('[Agora] Failed to play video after interaction:', e);
      });
    }
  }, [initialInteraction, localTracks.video]);

  // Handle video toggle - OPTIMIZED
  useEffect(() => {
    const track = localTracks.video;
    const container = localContainerRef.current;
    if (!track || !container) return;

    if (controls.videoEnabled) {
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      
      if (!track.isPlaying) {
        console.log('[Agora] Attempting to play video...');
        track.play(container).catch((e) => {
          console.warn('[Agora] Play on toggle failed:', e);
        });
      }
      track.setEnabled(true).catch((e) => console.warn('[Agora] setEnabled failed:', e));
    } else {
      track.setEnabled(false).catch((e) => console.warn('[Agora] setEnabled failed:', e));
      container.style.display = 'none';
    }
  }, [controls.videoEnabled, localTracks.video, initialInteraction]);

  // Handle audio toggle
  useEffect(() => {
    const track = localTracks.audio;
    if (!track) return;
    track.setEnabled(controls.audioEnabled).catch((e) => 
      console.warn('[Agora] Audio toggle failed:', e)
    );
  }, [controls.audioEnabled, localTracks.audio]);

  // Recreate video track function
  const recreateVideoTrack = async () => {
    try {
      console.log('[Agora] Recreating camera video track...');
      const newTrack = await AgoraRTC.createCameraVideoTrack();
      
      if (localTracks.video) {
        await clientRef.current.unpublish([localTracks.video]).catch(() => {});
        localTracks.video.stop();
        localTracks.video.close();
      }
      
      setLocalTracks(prev => ({ ...prev, video: newTrack }));
      
      if (localContainerRef.current) {
        await newTrack.play(localContainerRef.current);
        await clientRef.current.publish([newTrack]);
        console.log('[Agora] Recreated and published video track');
      }
    } catch (e) {
      console.error('[Agora] Failed to recreate video track:', e);
    }
  };

  // ============================================
  // Event Listeners - OPTIMIZED
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    client.on('user-published', async (user, mediaType) => {
      console.log('[Agora] User published:', user.uid, mediaType);
      
      try {
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
      } catch (error) {
        console.warn('[Agora] Failed to handle user-published:', error);
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
        console.log(`[Agora] Audio ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('[Agora] Toggle audio error:', error);
      }
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      try {
        const newState = !controls.videoEnabled;
        setControls(prev => ({ ...prev, videoEnabled: newState }));
        console.log(`[Agora] Video ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('[Agora] Toggle video error:', error);
      }
    } else {
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish([videoTrack]);
        
        if (localContainerRef.current) {
          videoTrack.play(localContainerRef.current);
        }
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        console.log('[Agora] Video enabled');
      } catch (error) {
        console.error('[Agora] Cannot access camera:', error);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '720p', // Lower resolution for faster sharing
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
        
        if (localContainerRef.current) {
          screenTrack.play(localContainerRef.current);
        }
        
        setControls(prev => ({ ...prev, screenSharing: true }));
        console.log('[Agora] Screen sharing started');
        
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
          
          if (localContainerRef.current) {
            cameraTrack.play(localContainerRef.current);
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
          
          console.log('[Agora] Screen sharing stopped, camera restored');
        } catch (cameraError) {
          console.error('[Agora] Cannot access camera:', cameraError);
          setControls(prev => ({ 
            ...prev, 
            videoEnabled: false,
            screenSharing: false 
          }));
        }
      }
    } catch (error) {
      console.error('[Agora] Screen share error:', error);
      setControls(prev => ({ ...prev, screenSharing: false }));
    }
  };

  const toggleRecording = async () => {
    try {
      const newState = !controls.recording; 
      if (newState) { 
        await videoApi.startRecording(sessionState.sessionInfo.meetingId);
        console.log('[Agora] Recording started');
      } else {
        await videoApi.stopRecording(sessionState.sessionInfo.meetingId);
        console.log('[Agora] Recording stopped');
      }
      setControls(prev => ({ ...prev, recording: newState }));
    } catch (error) {
      console.error('[Agora] Toggle recording error:', error);
    } 
  };

  const leaveSession = async () => {
    try {
      setIsLeaving(true); 
      await cleanup();
      setIsLeaving(false);
      if (onEndCall) onEndCall(false); 
    } catch (error) {
      console.error('[Agora] Leave session error:', error);
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
      console.error('[Agora] End session error:', error);
      setIsEnding(false);
    }
  };

  // ============================================
  // Chat Functions (simplified)
  // ============================================

  const sendMessage = async () => {
    const messageText = newMessage.trim();
    if (!messageText) return;
    
    const tempMessage = {
      id: Date.now().toString(),
      senderId: teacherId,
      senderName: 'Teacher',
      text: messageText,
      timestamp: new Date().toISOString(),
      isOwn: true,
      status: 'sent'
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();
    
    // Simulate student response
    simulateStudentResponse(messageText);
  };

  const simulateStudentResponse = (teacherMessage) => {
    const responses = ["Yes", "Understood", "Thank you", "Got it"];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    setTimeout(() => {
      const studentMessage = {
        id: Date.now().toString(),
        senderId: 'student',
        senderName: 'Student',
        text: randomResponse,
        timestamp: new Date().toISOString(),
        isOwn: false
      };
      
      setMessages(prev => [...prev, studentMessage]);
      scrollToBottom();
    }, 1000);
  };

  const startChatPolling = (meetingId) => {
    // Minimal polling
    const interval = setInterval(() => {}, 10000); // Poll every 10 seconds
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
        console.error('[Agora] Participant tracking error:', error);
      }
    };
    
    fetchParticipants();
    participantUpdateIntervalRef.current = setInterval(fetchParticipants, 10000); // 10 seconds
  };

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

  const cleanup = async () => {
    console.log('[Agora] Cleaning up...');
    
    // Clear intervals and timeouts
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    
    // Stop tracks
    try {
      if (localTracks.audio) {
        await clientRef.current?.unpublish([localTracks.audio]).catch(() => {});
        localTracks.audio.stop();
        localTracks.audio.close();
      }
      if (localTracks.video) {
        await clientRef.current?.unpublish([localTracks.video]).catch(() => {});
        localTracks.video.stop();
        localTracks.video.close();
      }
    } catch (e) {
      console.warn('[Agora] Cleanup warning:', e);
    }
    
    // Leave channel
    if (clientRef.current) {
      await clientRef.current.leave();
    }
    
    // Clear remote users
    Object.values(remoteUsersRef.current).forEach(userData => {
      if (userData.container) {
        userData.container.remove();
      }
    });
    remoteUsersRef.current = {};
    
    // Reset state
    setLocalTracks({ audio: null, video: null });
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
            {msg.senderName}
          </div>
        )}
        
        <div className="message-bubble">
          <div className="message-text">
            {msg.text}
          </div>
          
          <div className="message-footer">
            <span className="message-time">
              {formatTime(msg.timestamp)}
            </span>
          </div>
        </div>
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
          <p>{isConnecting ? 'Connecting to video session...' : 'Preparing session...'}</p>
          <small>This may take a moment</small>
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

      {/* Main Video Area */}
      <div className="video-main-area">
        {/* Local Video */}
        <div className="local-video-container floating-video">
          <div className="video-wrapper">
            <div
              ref={localContainerRef}
              id="local-video-container"
              className="video-container"
              style={{ display: controls.videoEnabled ? 'block' : 'none' }}
              aria-label="Local video container"
            />
            
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

      {/* Floating Controls */}
      <div className={`floating-controls ${showControls ? 'visible' : 'hidden'}`}>
        <div className="control-center">
          {/* Primary Controls - Compact Circle */}
<div className="primary-controls">
  <button 
    className={`control-orb audio-orb ${controls.audioEnabled ? 'active' : 'muted'}`}
    onClick={toggleAudio}
    title={controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
  >
    {/* CHANGE: Mic icon */}
    <span className="orb-icon">
      {controls.audioEnabled ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="2" x2="22" y1="2" y2="22"/>
          <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
          <path d="M5 10v2a7 7 0 0 0 12 5"/>
          <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      )}
    </span>
  </button>

  <button 
    className={`control-orb video-orb ${controls.videoEnabled ? 'active' : 'inactive'}`}
    onClick={toggleVideo}
    title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
  >
    {/* CHANGE: Video camera icon */}
    <span className="orb-icon">
      {controls.videoEnabled ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
          <line x1="1" x2="23" y1="1" y2="23"/>
        </svg>
      )}
    </span>
  </button>

  {/* Screen Share */}
  <button 
    className={`control-orb screen-orb ${controls.screenSharing ? 'active' : ''}`}
    onClick={toggleScreenShare}
    title={controls.screenSharing ? 'Stop sharing screen' : 'Share screen'}
  >
    {/* CHANGE: Screen share icon */}
    <span className="orb-icon">
      {controls.screenSharing ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"/>
          <path d="M8 21h8"/>
          <path d="M12 17v4"/>
          <path d="m17 8 5-5"/>
          <path d="M17 3h5v5"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"/>
          <path d="M8 21h8"/>
          <path d="M12 17v4"/>
          <path d="m22 3-5 5"/>
          <path d="m17 3 5 5"/>
        </svg>
      )}
    </span>
  </button>

  {/* Recording */}
  <button 
    className={`control-orb record-orb ${controls.recording ? 'recording' : ''}`}
    onClick={toggleRecording}
    title={controls.recording ? 'Stop recording' : 'Start recording'}
  >
    {/* CHANGE: Record icon */}
    <span className="orb-icon">
      {controls.recording ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <rect x="9" y="9" width="6" height="6"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      )}
    </span>
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
    {/* CHANGE: Message circle icon */}
    <span className="btn-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </span>
  </button>

  {/* Participants */}
  <button 
    className={`control-button participants-btn ${controls.isParticipantsOpen ? 'active' : ''}`}
    onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }))}
    title="Show participants"
  >
    {/* CHANGE: Users icon */}
    <span className="btn-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </span>
  </button>

  {/* Leave & End Buttons */}
  <div className="action-buttons">
    <button 
      className="control-button leave-btn"
      onClick={leaveSession}
      disabled={isLeaving}
      title="Leave the call (others can continue)"
    >
      {/* CHANGE: Log out icon */}
      <span className="btn-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" x2="9" y1="12" y2="12"/>
        </svg>
      </span>
      <span className="btn-text">{isLeaving ? '...' : 'Leave'}</span>
    </button>

    <button 
      className="control-button end-btn"
      onClick={endSession}
      disabled={isEnding}
      title="End call for everyone"
    >
      {/* CHANGE: Phone off icon */}
      <span className="btn-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
          <line x1="23" x2="1" y1="1" y2="23"/>
        </svg>
      </span>
      <span className="btn-text">{isEnding ? '...' : 'End'}</span>
    </button>
  </div>
</div>
        </div>
      </div>

      {/* Chat Panel */}
     {/* Minimal Chat Panel */}
{controls.isChatOpen && (
  <div className="minimal-chat-panel">
    <div className="chat-header">
      <h3>Chat ({messages.length})</h3>
      <button 
        className="close-chat"
        onClick={() => setControls(prev => ({ ...prev, isChatOpen: false }))}
      >
        {/* CHANGE: X icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" x2="6" y1="6" y2="18"/>
          <line x1="6" x2="18" y1="6" y2="18"/>
        </svg>
      </button>
    </div>
    
    <div className="chat-messages" ref={chatContainerRef}>
      {messages.length === 0 ? (
        <div className="empty-chat">
          {/* CHANGE: Message square icon */}
          <div className="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
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
      />
      <button 
        onClick={sendMessage}
        disabled={!newMessage.trim()}
        className="send-btn-mini"
      >
        {/* CHANGE: Send icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  </div>
)}
      
      {/* Autoplay Hint */}
      {!initialInteraction && (
        <div className="autoplay-hint">
          <p>Click anywhere to allow video playback</p>
        </div>
      )}
    </div>
  );
};

export default TeacherVideoCall;