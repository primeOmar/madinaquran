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

  // Refs - ADDED localVideoRef
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const localVideoRef = useRef(null); // ADDED: Direct reference to video element
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

  // UPDATED: Create and publish tracks with proper video element handling
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
          encoderConfig: '480p',
          optimizationMode: 'motion'
        }).catch(error => {
          console.warn('[Agora] Could not create video track:', error);
          return null;
        })
      ]);

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Play video immediately if we have a track and video element
      if (videoTrack && localVideoRef.current) {
        setTimeout(() => {
          playLocalVideo(videoTrack);
        }, 100); // Small delay to ensure DOM is ready
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

  // NEW: Helper function to play local video
  const playLocalVideo = async (track) => {
    if (!track || !localVideoRef.current) return;
    
    try {
      await track.play(localVideoRef.current);
      console.log('[Agora] ✅ Video track playing successfully');
      
      // Apply mirror effect and styling
      if (localVideoRef.current) {
        localVideoRef.current.style.transform = 'scaleX(-1)';
        localVideoRef.current.style.objectFit = 'cover';
        localVideoRef.current.style.width = '100%';
        localVideoRef.current.style.height = '100%';
        localVideoRef.current.style.borderRadius = '8px';
      }
    } catch (playError) {
      console.error('[Agora] ❌ Video play error:', playError);
      // Retry with user interaction
      if (playError.name === 'NotAllowedError') {
        console.log('[Agora] Waiting for user interaction...');
      }
    }
  };

  // UPDATED: Handle video toggle with proper state management
  useEffect(() => {
    const track = localTracks.video;
    const videoElement = localVideoRef.current;

    if (!track || !videoElement) return;

    if (controls.videoEnabled) {
      // Enable video track
      track.setEnabled(true).catch(e => 
        console.warn('[Agora] Video enable failed:', e)
      );
      
      // Play if not already playing
      if (!track.isPlaying) {
        setTimeout(() => {
          playLocalVideo(track);
        }, 50);
      }
    } else {
      // Disable video track
      track.setEnabled(false).catch(e => 
        console.warn('[Agora] Video disable failed:', e)
      );
    }
  }, [controls.videoEnabled, localTracks.video]);

  // UPDATED: Handle video playback after user interaction
  useEffect(() => {
    if (initialInteraction && localTracks.video && !localTracks.video.isPlaying) {
      console.log('[Agora] User interacted, playing video...');
      playLocalVideo(localTracks.video);
    }
  }, [initialInteraction, localTracks.video]);

  // Handle audio toggle
  useEffect(() => {
    const track = localTracks.audio;
    if (!track) return;
    track.setEnabled(controls.audioEnabled).catch((e) => 
      console.warn('[Agora] Audio toggle failed:', e)
    );
  }, [controls.audioEnabled, localTracks.audio]);

  // UPDATED: Recreate video track function
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
      
      if (localVideoRef.current) {
        await newTrack.play(localVideoRef.current);
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
        
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        console.log('[Agora] Video enabled');
      } catch (error) {
        console.error('[Agora] Cannot access camera:', error);
      }
    }
  };

  // UPDATED: toggleScreenShare to use localVideoRef
  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '720p',
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
  // Render - UPDATED Local Video Section
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
        {/* Local Video - UPDATED SECTION */}
        <div className="local-video-container floating-video">
          <div className="video-wrapper">
            {/* Video Container - Always rendered */}
            <div className="video-container" style={{
              display: 'block',
              position: 'relative',
              width: '100%',
              height: '100%',
              backgroundColor: controls.videoEnabled ? 'transparent' : '#1a1a2e',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Video Element - Always present */}
              <video
                ref={localVideoRef}
                id="local-video"
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: controls.videoEnabled ? 'block' : 'none',
                  transform: 'scaleX(-1)', // Mirror effect
                  borderRadius: '8px'
                }}
              />
              
              {/* Placeholder when video is disabled */}
              {!controls.videoEnabled && (
                <div className="video-placeholder" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1a1a2e',
                  borderRadius: '8px'
                }}>
                  <div className="user-avatar" style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>
                    <span>YOU</span>
                  </div>
                </div>
              )}
              
              {/* Status Overlay */}
              <div className="video-status-overlay" style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                right: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!controls.videoEnabled && (
                    <span className="status-tag" style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <VideoOff size={12} />
                      Camera Off
                    </span>
                  )}
                  {controls.screenSharing && (
                    <span className="status-tag" style={{
                      background: 'rgba(59, 130, 246, 0.8)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Share2 size={12} />
                      Screen Sharing
                    </span>
                  )}
                </div>
                <span className="name-tag" style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  Host (You)
                </span>
              </div>
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
              <span className="orb-icon">
                {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </span>
            </button>

            <button 
              className={`control-orb video-orb ${controls.videoEnabled ? 'active' : 'inactive'}`}
              onClick={toggleVideo}
              title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <span className="orb-icon">
                {controls.videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </span>
            </button>

            {/* Screen Share */}
            <button 
              className={`control-orb screen-orb ${controls.screenSharing ? 'active' : ''}`}
              onClick={toggleScreenShare}
              title={controls.screenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <span className="orb-icon">
                <Share2 size={20} />
              </span>
            </button>

            {/* Recording */}
            <button 
              className={`control-orb record-orb ${controls.recording ? 'recording' : ''}`}
              onClick={toggleRecording}
              title={controls.recording ? 'Stop recording' : 'Start recording'}
            >
              <span className="orb-icon">
                {controls.recording ? (
                  <Circle size={20} fill="currentColor" />
                ) : (
                  <Circle size={20} />
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
              <span className="btn-icon">
                <MessageCircle size={18} />
              </span>
            </button>

            {/* Participants */}
            <button 
              className={`control-button participants-btn ${controls.isParticipantsOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }))}
              title="Show participants"
            >
              <span className="btn-icon">
                <Users size={18} />
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
                <span className="btn-icon">
                  <LogOut size={18} />
                </span>
                <span className="btn-text">{isLeaving ? '...' : 'Leave'}</span>
              </button>

              <button 
                className="control-button end-btn"
                onClick={endSession}
                disabled={isEnding}
                title="End call for everyone"
              >
                <span className="btn-icon">
                  <PhoneOff size={18} />
                </span>
                <span className="btn-text">{isEnding ? '...' : 'End'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {controls.isChatOpen && (
        <div className="minimal-chat-panel">
          <div className="chat-header">
            <h3>Chat ({messages.length})</h3>
            <button 
              className="close-chat"
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: false }))}
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="chat-messages" ref={chatContainerRef}>
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="empty-icon">
                  <MessageSquare size={48} />
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
              <Send size={18} />
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