// src/pages/TeacherVideoCall.js - WORLD-CLASS CLASSROOM VERSION
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './TeacherVideoCall.css';
import videoApi from '../lib/agora/videoApi';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  Share2, X, 
  Circle, Square, 
  MessageCircle, Users, 
  LogOut, PhoneOff, 
  Send, MessageSquare,
  Grid3x3,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  User,
  Volume2,
  VolumeX
} from 'lucide-react';

// ============================================
// COMPONENTS
// ============================================

const RemoteVideoPlayer = React.memo(({ user, compact = false }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !user.videoTrack) return;

    const playVideo = () => {
      try {
        if (user.videoTrack.isPlaying) {
          user.videoTrack.stop();
        }
        user.videoTrack.play(videoRef.current);
      } catch (error) {
        console.warn(`Video play error for user ${user.uid}:`, error);
      }
    };

    playVideo();

    return () => {
      if (user.videoTrack?.isPlaying) {
        user.videoTrack.stop();
      }
    };
  }, [user.videoTrack, user.uid]);

  return (
    <div 
      ref={containerRef}
      className={`remote-video-player ${compact ? 'compact' : ''}`}
      style={{ 
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#1a1a2e',
        borderRadius: '8px',
        overflow: 'hidden',
        aspectRatio: compact ? '16/9' : 'auto'
      }}
    >
      <div ref={videoRef} style={{ width: '100%', height: '100%' }} />
      
      {!user.videoTrack && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e'
        }}>
          <div style={{
            width: compact ? '40px' : '60px',
            height: compact ? '40px' : '60px',
            borderRadius: '50%',
            backgroundColor: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: compact ? '8px' : '12px',
            fontSize: compact ? '16px' : '24px'
          }}>
            🎓
          </div>
          <p style={{ 
            fontSize: compact ? '12px' : '14px', 
            fontWeight: '500',
            color: '#a5b4fc',
            textAlign: 'center'
          }}>
            Student {user.uid}
          </p>
        </div>
      )}
      
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        right: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          maxWidth: '70%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          Student {user.uid}
        </span>
        
        {user.audioTrack && (
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            animation: 'pulse 2s infinite'
          }} />
        )}
      </div>
    </div>
  );
});

RemoteVideoPlayer.displayName = 'RemoteVideoPlayer';

// ============================================
// MAIN TEACHER VIDEO CALL COMPONENT
// ============================================

const TeacherVideoCall = ({ classId, teacherId, onEndCall }) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteUsers, setRemoteUsers] = useState(new Map());
  
  const [uiState, setUiState] = useState({
    // Layout modes: 'auto', 'grid', 'speaker', 'gallery'
    layoutMode: 'auto',
    isParticipantsPanelOpen: false,
    isChatOpen: false,
    showControls: true,
    isFullscreen: false,
    activeSpeakerId: null,
    pagination: {
      page: 0,
      pageSize: 8
    }
  });

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

  const [chat, setChat] = useState({
    messages: [],
    newMessage: ''
  });

  const [loading, setLoading] = useState({
    isConnecting: false,
    isLeaving: false,
    isEnding: false
  });

  // ============================================
  // REFS
  // ============================================
  
  const clientRef = useRef(null);
  const localVideoRef = useRef(null);
  const chatContainerRef = useRef(null);
  const mainContainerRef = useRef(null);
  const participantsPanelRef = useRef(null);
  
  const controlsTimeoutRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const videoApiRef = useRef(videoApi);
  
  // ============================================
  // RESPONSIVE CALCULATIONS
  // ============================================
  
  const calculateGridConfig = useCallback(() => {
    const remoteCount = remoteUsers.size;
    const screenWidth = window.innerWidth;
    
    if (screenWidth < 640) { // Mobile
      return {
        maxVisible: 4,
        gridCols: 2,
        compactView: true
      };
    } else if (screenWidth < 1024) { // Tablet
      return {
        maxVisible: 6,
        gridCols: 3,
        compactView: false
      };
    } else { // Desktop
      return {
        maxVisible: uiState.layoutMode === 'auto' ? 8 : 12,
        gridCols: uiState.layoutMode === 'auto' ? 4 : 6,
        compactView: false
      };
    }
  }, [remoteUsers.size, uiState.layoutMode]);

  const getVisibleUsers = useMemo(() => {
    const config = calculateGridConfig();
    const usersArray = Array.from(remoteUsers.values());
    const startIdx = uiState.pagination.page * config.maxVisible;
    const endIdx = startIdx + config.maxVisible;
    
    return {
      users: usersArray.slice(startIdx, endIdx),
      totalPages: Math.ceil(usersArray.length / config.maxVisible),
      config
    };
  }, [remoteUsers, uiState.pagination, calculateGridConfig]);

  // ============================================
  // EFFECTS
  // ============================================
  
  useEffect(() => {
    const handleMouseMove = () => {
      setUiState(prev => ({ ...prev, showControls: true }));
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        setUiState(prev => ({ ...prev, showControls: false }));
      }, 3000);
    };
    
    const handleResize = () => {
      // Recalculate layout on resize
      setUiState(prev => ({ ...prev }));
    };
    
    handleMouseMove();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (!videoApiRef.current) {
      setSessionState(prev => ({
        ...prev,
        error: 'Video API not initialized'
      }));
      return;
    }
    
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, teacherId]);
  
  useEffect(() => {
    // Auto-close panels on mobile when too many users
    if (window.innerWidth < 768 && remoteUsers.size > 4) {
      setUiState(prev => ({ 
        ...prev, 
        isParticipantsPanelOpen: false,
        isChatOpen: false 
      }));
    }
  }, [remoteUsers.size]);

  // ============================================
  // CORE FUNCTIONS
  // ============================================
  
  const initializeSession = async () => {
    if (loading.isConnecting) return;
    
    try {
      setLoading(prev => ({ ...prev, isConnecting: true }));
      
      // Create Agora client
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });
      
      // Get session data
      const sessionData = await videoApi.startVideoSession(classId, teacherId);
      
      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to start session');
      }
      
      // Validate
      if (!sessionData.token || sessionData.token === 'demo_token') {
        throw new Error('Invalid token');
      }
      if (!sessionData.appId || !sessionData.channel) {
        throw new Error('Missing session data');
      }
      
      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: sessionData,
        error: null
      });
      
      // Join channel
      await joinChannel(sessionData);
      
    } catch (error) {
      console.error('Initialization error:', error);
      setSessionState(prev => ({ ...prev, error: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, isConnecting: false }));
    }
  };
  
  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;
      
      const assignedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );
      
      console.log('✅ Teacher joined channel:', { channel, assignedUid });
      
      // Create and publish tracks
      await createAndPublishTracks();
      
      setSessionState(prev => ({ ...prev, isJoined: true }));
      
      // Start tracking and listeners
      startDurationTracking();
      setupAgoraEventListeners();
      
    } catch (error) {
      console.error('Join channel error:', error);
      throw error;
    }
  };
  
  const createAndPublishTracks = async () => {
    try {
      const [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack().catch(() => null),
        AgoraRTC.createCameraVideoTrack().catch(() => null)
      ]);
      
      setLocalTracks({ audio: audioTrack, video: videoTrack });
      
      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);
      
      if (tracksToPublish.length > 0) {
        await clientRef.current.publish(tracksToPublish);
      }
      
      // Play local video
      if (videoTrack && localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
        localVideoRef.current.style.transform = 'scaleX(-1)';
      }
      
    } catch (error) {
      console.error('Error creating tracks:', error);
    }
  };
  
const leaveSession = async () => {
  try {
    setLoading(prev => ({ ...prev, isLeaving: true }));
    await cleanup();
    setLoading(prev => ({ ...prev, isLeaving: false }));
    if (onEndCall) onEndCall(false);
  } catch (error) {
    console.error('Leave session error:', error);
    setLoading(prev => ({ ...prev, isLeaving: false }));
  }
};

const endSession = async () => {
  try {
    setLoading(prev => ({ ...prev, isEnding: true }));
    if (sessionState.sessionInfo?.meetingId) {
      await videoApi.endVideoSession(sessionState.sessionInfo.meetingId);
    }
    await cleanup();
    setLoading(prev => ({ ...prev, isEnding: false }));
    if (onEndCall) onEndCall(true);
  } catch (error) {
    console.error('End session error:', error);
    setLoading(prev => ({ ...prev, isEnding: false }));
  }
};

const toggleRecording = async () => {
  try {
    const newState = !controls.recording;
    if (newState) {
      await videoApi.startRecording(sessionState.sessionInfo.meetingId);
    } else {
      await videoApi.stopRecording(sessionState.sessionInfo.meetingId);
    }
    setControls(prev => ({ ...prev, recording: newState }));
  } catch (error) {
    console.error('Toggle recording error:', error);
  }
};


  const setupAgoraEventListeners = () => {
    const client = clientRef.current;
    if (!client) return;
    
    client.on('user-published', async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        
        setRemoteUsers(prev => {
          const updated = new Map(prev);
          const existing = updated.get(user.uid) || { uid: user.uid };
          
          if (mediaType === 'video') existing.videoTrack = user.videoTrack;
          if (mediaType === 'audio') existing.audioTrack = user.audioTrack;
          
          updated.set(user.uid, existing);
          return updated;
        });
        
        // Auto-play audio
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play().catch(() => {});
        }
        
        updateParticipantCount();
        
        // Set as active speaker if first user
        if (remoteUsers.size === 0) {
          setUiState(prev => ({ ...prev, activeSpeakerId: user.uid }));
        }
        
      } catch (error) {
        console.error('Subscribe error:', error);
      }
    });
    
    client.on('user-unpublished', (user, mediaType) => {
      setRemoteUsers(prev => {
        const updated = new Map(prev);
        const existing = updated.get(user.uid);
        if (!existing) return prev;
        
        if (mediaType === 'video' && existing.videoTrack) {
          existing.videoTrack.stop();
          existing.videoTrack = null;
        }
        if (mediaType === 'audio') {
          existing.audioTrack = null;
        }
        
        updated.set(user.uid, existing);
        return updated;
      });
    });
    
    client.on('user-left', (user) => {
      setRemoteUsers(prev => {
        const updated = new Map(prev);
        const userData = updated.get(user.uid);
        if (userData?.videoTrack) {
          userData.videoTrack.stop();
        }
        updated.delete(user.uid);
        return updated;
      });
      
      updateParticipantCount();
    });
    
    client.on('network-quality', (quality) => {
      const qualityLevels = ['unknown', 'excellent', 'good', 'poor'];
      const level = Math.min(3, Math.max(0, quality.uplinkNetworkQuality || 0));
      setStats(prev => ({ ...prev, connectionQuality: qualityLevels[level] }));
    });
  };
  
  const updateParticipantCount = () => {
    const remoteCount = clientRef.current?.remoteUsers?.length || 0;
    setStats(prev => ({ ...prev, participantCount: remoteCount + 1 }));
  };
  
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

  // ============================================
  // UI CONTROLS
  // ============================================
  
  const toggleAudio = async () => {
    if (localTracks.audio) {
      try {
        const newState = !controls.audioEnabled;
        await localTracks.audio.setEnabled(newState);
        setControls(prev => ({ ...prev, audioEnabled: newState }));
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
        setControls(prev => ({ ...prev, videoEnabled: newState }));
      } catch (error) {
        console.error('Toggle video error:', error);
      }
    }
  };
  
  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack();
        
        if (localTracks.video) {
          await clientRef.current.unpublish([localTracks.video]);
          localTracks.video.stop();
          localTracks.video.close();
        }
        
        await clientRef.current.publish([screenTrack]);
        setLocalTracks(prev => ({ ...prev, video: screenTrack }));
        setControls(prev => ({ ...prev, screenSharing: true }));
        
      } else {
        const screenTrack = localTracks.video;
        
        if (screenTrack) {
          await clientRef.current.unpublish([screenTrack]);
          screenTrack.stop();
          screenTrack.close();
        }
        
        const cameraTrack = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish([cameraTrack]);
        
        if (localVideoRef.current) {
          cameraTrack.play(localVideoRef.current);
        }
        
        setLocalTracks(prev => ({ ...prev, video: cameraTrack }));
        setControls(prev => ({ ...prev, screenSharing: false, videoEnabled: true }));
      }
    } catch (error) {
      console.error('Screen share error:', error);
      setControls(prev => ({ ...prev, screenSharing: false }));
    }
  };
  
  const toggleFullscreen = () => {
    const container = mainContainerRef.current;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setUiState(prev => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setUiState(prev => ({ ...prev, isFullscreen: false }));
    }
  };
  
  const changeLayout = (layout) => {
    setUiState(prev => ({ ...prev, layoutMode: layout }));
  };
  
  const navigatePage = (direction) => {
    setUiState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        page: Math.max(0, Math.min(
          getVisibleUsers.totalPages - 1,
          prev.pagination.page + direction
        ))
      }
    }));
  };
  
  const sendMessage = () => {
    const message = chat.newMessage.trim();
    if (!message) return;
    
    const newMsg = {
      id: Date.now().toString(),
      senderId: teacherId,
      senderName: 'Teacher',
      text: message,
      timestamp: new Date().toISOString(),
      isOwn: true
    };
    
    setChat(prev => ({
      ...prev,
      messages: [...prev.messages, newMsg],
      newMessage: ''
    }));
    
    // Scroll to bottom
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // ============================================
  // CLEANUP
  // ============================================
  
  const cleanup = async () => {
    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Unpublish and cleanup local tracks
    if (localTracks.audio) {
      await clientRef.current?.unpublish([localTracks.audio]);
      localTracks.audio.stop();
      localTracks.audio.close();
    }
    
    if (localTracks.video) {
      await clientRef.current?.unpublish([localTracks.video]);
      localTracks.video.stop();
      localTracks.video.close();
    }
    
    // Leave channel
    if (clientRef.current) {
      await clientRef.current.leave();
    }
    
    // Reset state
    setLocalTracks({ audio: null, video: null });
    setSessionState({
      isInitialized: false,
      isJoined: false,
      sessionInfo: null,
      error: null
    });
  };

  // ============================================
  // RENDER
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
          <p>{loading.isConnecting ? 'Connecting...' : 'Preparing session...'}</p>
        </div>
      </div>
    );
  }
  
  const { users: visibleUsers, totalPages, config } = getVisibleUsers;
  const currentPage = uiState.pagination.page;

  return (
    <div 
      ref={mainContainerRef}
      className="video-call-container classroom-theme"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0f172a',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div className={`call-header ${uiState.showControls ? 'visible' : 'hidden'}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.95), transparent)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          transition: 'opacity 0.3s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            padding: '8px 12px', 
            background: 'rgba(79, 70, 229, 0.2)',
            borderRadius: '8px',
            border: '1px solid rgba(79, 70, 229, 0.3)'
          }}>
            <span style={{ color: '#a5b4fc', fontSize: '14px' }}>
              🎓 {sessionState.sessionInfo?.session?.class_title || 'Classroom'}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ 
              padding: '4px 8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⏱️ {formatDuration(stats.duration)}
            </span>
            
            <span style={{ 
              padding: '4px 8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              👥 {stats.participantCount}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {controls.recording && (
            <span style={{
              padding: '4px 12px',
              background: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '16px',
              color: '#f87171',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                background: '#ef4444',
                animation: 'pulse 1.5s infinite'
              }} />
              REC
            </span>
          )}
          
          <button 
            onClick={toggleFullscreen}
            style={{
              padding: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {uiState.isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: '20px',
        right: '20px',
        bottom: '100px',
        display: 'flex',
        gap: '20px'
      }}>
        {/* Main Students Grid */}
        <div style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Layout Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => changeLayout('auto')}
                style={{
                  padding: '6px 12px',
                  background: uiState.layoutMode === 'auto' ? '#4f46e5' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Auto
              </button>
              <button 
                onClick={() => changeLayout('grid')}
                style={{
                  padding: '6px 12px',
                  background: uiState.layoutMode === 'grid' ? '#4f46e5' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <Grid3x3 size={14} />
              </button>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => navigatePage(-1)}
                  disabled={currentPage === 0}
                  style={{
                    padding: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    color: currentPage === 0 ? '#64748b' : 'white',
                    cursor: currentPage === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                  {currentPage + 1} / {totalPages}
                </span>
                
                <button 
                  onClick={() => navigatePage(1)}
                  disabled={currentPage === totalPages - 1}
                  style={{
                    padding: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    color: currentPage === totalPages - 1 ? '#64748b' : 'white',
                    cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          
          {/* Students Grid */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${config.gridCols}, 1fr)`,
            gap: '16px',
            overflowY: 'auto',
            padding: '4px'
          }}>
            {visibleUsers.map(user => (
              <div 
                key={user.uid}
                style={{
                  position: 'relative',
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: uiState.activeSpeakerId === user.uid 
                    ? '2px solid #4f46e5' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  minHeight: config.compactView ? '120px' : '160px'
                }}
              >
                <RemoteVideoPlayer user={user} compact={config.compactView} />
              </div>
            ))}
            
            {/* Empty State */}
            {visibleUsers.length === 0 && (
              <div style={{
                gridColumn: `1 / span ${config.gridCols}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
                  👥
                </div>
                <h3 style={{ color: 'white', marginBottom: '8px' }}>
                  Waiting for students...
                </h3>
                <p style={{ textAlign: 'center', maxWidth: '400px' }}>
                  Students will appear here when they join your session
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Side Panel (Participants/Chat) */}
        <div style={{ 
          width: uiState.isParticipantsPanelOpen ? '350px' : '0',
          transition: 'width 0.3s',
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {uiState.isParticipantsPanelOpen && (
            <div style={{ 
              width: '350px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Participants Header */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ color: 'white', fontSize: '16px', margin: 0 }}>
                  Participants ({stats.participantCount})
                </h3>
                <button 
                  onClick={() => setUiState(prev => ({ ...prev, isParticipantsPanelOpen: false }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Participants List */}
              <div ref={participantsPanelRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px'
                }}
              >
                {/* Teacher */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(79, 70, 229, 0.1)',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '14px'
                  }}>
                    T
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: '500' }}>Teacher (You)</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>Host</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {controls.audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    {controls.videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                  </div>
                </div>
                
                {/* Students */}
                {Array.from(remoteUsers.values()).map(user => (
                  <div 
                    key={user.uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a5b4fc',
                      fontSize: '14px'
                    }}>
                      S
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: '500' }}>
                        Student {user.uid}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                        {user.videoTrack ? 'Video' : 'Audio only'}
                      </div>
                    </div>
                    <div>
                      {user.audioTrack ? (
                        <Volume2 size={16} color="#22c55e" />
                      ) : (
                        <VolumeX size={16} color="#64748b" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Local Video (PIP) */}
      <div style={{
        position: 'absolute',
        bottom: '120px',
        right: '20px',
        width: '200px',
        height: '150px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '2px solid rgba(79, 70, 229, 0.5)',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
        zIndex: 50,
        transition: 'transform 0.3s'
      }}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            display: controls.videoEnabled ? 'block' : 'none'
          }}
        />
        
        {!controls.videoEnabled && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#1a1a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px'
            }}>
              YOU
            </div>
          </div>
        )}
        
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          right: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            You
          </span>
          
          {controls.screenSharing && (
            <span style={{
              background: 'rgba(59, 130, 246, 0.8)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Share2 size={10} />
              Screen
            </span>
          )}
        </div>
      </div>
      
      {/* Main Controls */}
      {/* Futuristic Floating Controls */}
<div className={`floating-controls ${uiState.showControls ? 'visible' : 'hidden'}`}>
  <div className="control-center">
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

      <button 
        className={`control-orb screen-orb ${controls.screenSharing ? 'active' : ''}`}
        onClick={toggleScreenShare}
        title={controls.screenSharing ? 'Stop sharing screen' : 'Share screen'}
      >
        <span className="orb-icon">
          <Share2 size={20} />
        </span>
      </button>

     {/* <button 
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
      </button> */}
    </div>

    <div className="secondary-controls">
      <button 
        className={`control-button chat-btn ${uiState.isChatOpen ? 'active' : ''}`}
        onClick={() => setUiState(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }))}
        title="Toggle chat"
      >
        <span className="btn-icon">
          <MessageCircle size={18} />
        </span>
      </button>

      <button 
        className={`control-button participants-btn ${uiState.isParticipantsPanelOpen ? 'active' : ''}`}
        onClick={() => setUiState(prev => ({ ...prev, isParticipantsPanelOpen: !prev.isParticipantsPanelOpen }))}
        title="Show participants"
      >
        <span className="btn-icon">
          <Users size={18} />
        </span>
      </button>

      <div className="action-buttons">
        <button 
          className="control-button leave-btn"
          onClick={leaveSession}
          disabled={loading.isLeaving}
          title="Leave the call (others can continue)"
        >
          <span className="btn-icon">
            <LogOut size={18} />
          </span>
          <span className="btn-text">{loading.isLeaving ? '...' : 'Leave'}</span>
        </button>

        <button 
          className="control-button end-btn"
          onClick={endSession}
          disabled={loading.isEnding}
          title="End call for everyone"
        >
          <span className="btn-icon">
            <PhoneOff size={18} />
          </span>
          <span className="btn-text">{loading.isEnding ? '...' : 'End'}</span>
        </button>
      </div>
    </div>
  </div>
</div>
      
      {/* Chat Panel */}
      {uiState.isChatOpen && (
        <div style={{
          position: 'absolute',
          bottom: '120px',
          right: '240px', // Avoid overlapping with local video
          width: '300px',
          height: '400px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 60
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ color: 'white', fontSize: '16px', margin: 0 }}>
              Chat ({chat.messages.length})
            </h3>
            <button 
              onClick={() => setUiState(prev => ({ ...prev, isChatOpen: false }))}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
          
          <div ref={chatContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}
          >
            {chat.messages.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                color: '#64748b'
              }}>
                <MessageSquare size={48} />
                <p style={{ marginTop: '12px' }}>No messages yet</p>
              </div>
            ) : (
              chat.messages.map(msg => (
                <div 
                  key={msg.id}
                  style={{
                    marginBottom: '12px',
                    textAlign: msg.isOwn ? 'right' : 'left'
                  }}
                >
                  {!msg.isOwn && (
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                      {msg.senderName}
                    </div>
                  )}
                  <div style={{
                    display: 'inline-block',
                    background: msg.isOwn ? '#4f46e5' : '#1e293b',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    maxWidth: '80%',
                    wordBreak: 'break-word'
                  }}>
                    {msg.text}
                  </div>
                  <div style={{ 
                    color: '#64748b', 
                    fontSize: '11px', 
                    marginTop: '4px',
                    textAlign: msg.isOwn ? 'right' : 'left'
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{
            padding: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            gap: '8px'
          }}>
            <input
              type="text"
              value={chat.newMessage}
              onChange={(e) => setChat(prev => ({ ...prev, newMessage: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '20px',
                padding: '10px 16px',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button 
              onClick={sendMessage}
              disabled={!chat.newMessage.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#4f46e5',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: chat.newMessage.trim() ? 1 : 0.5
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function
const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default TeacherVideoCall;