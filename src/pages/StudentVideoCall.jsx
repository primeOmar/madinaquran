// src/pages/StudentVideoCall.js - PRODUCTION READY VERSION
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import studentvideoApi from '../lib/agora/studentvideoApi';
import './TeacherVideoCall.css';
import { 
  Video, 
  Clock, 
  Users, 
  MessageCircle, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  Hand, 
  X,
  MessageSquare,
  AlertCircle,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  User,
  Share2,
  Volume2,
  VolumeX,
  Loader2
} from 'lucide-react';

// ============================================
// DRAGGABLE LOCAL VIDEO COMPONENT
// ============================================
const DraggableLocalVideo = React.memo(({ 
  localTracks, 
  controls,
  isDragging,
  position,
  onDragStart,
  onDragEnd,
  onToggleAudio,
  onToggleVideo,
  onToggleFullscreen,
  isFullscreen,
  videoEnabled
}) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && localTracks.video && videoEnabled) {
      try {
        localTracks.video.stop();
        localTracks.video.play(videoRef.current);
        videoRef.current.style.transform = 'scaleX(-1)';
      } catch (error) {
        console.warn('Local video playback error:', error);
      }
    }
  }, [localTracks.video, videoEnabled]);

  const getContainerStyle = () => {
    const isMobile = window.innerWidth < 768;
    
    return {
      position: 'absolute',
      width: isMobile ? '140px' : '160px',
      height: isMobile ? '105px' : '120px',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '2px solid #4f46e5',
      backgroundColor: '#0f172a',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
      cursor: isDragging ? 'grabbing' : 'grab',
      zIndex: 1000,
      transition: isDragging ? 'none' : 'all 0.2s ease',
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      opacity: isHovered ? 1 : 0.9,
      touchAction: 'none',
      left: `${position.x}px`,
      top: `${position.y}px`,
      display: 'flex',
      flexDirection: 'column'
    };
  };

  return (
    <div
      ref={containerRef}
      style={getContainerStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={onDragStart}
      onMouseUp={onDragEnd}
      onTouchStart={(e) => {
        e.preventDefault();
        onDragStart(e);
      }}
      onTouchEnd={onDragEnd}
      className="draggable-local-video"
    >
      {/* Drag Handle */}
      <div 
        style={{
          position: 'absolute',
          top: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '30px',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '2px',
          cursor: 'grab',
          display: isHovered ? 'block' : 'none'
        }}
      />

      {/* Video Element */}
      {videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            YOU
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
        padding: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: isHovered ? 1 : 0.7,
        transition: 'opacity 0.2s'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleAudio();
            }}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: controls.audioEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: 'none',
              color: controls.audioEnabled ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            {controls.audioEnabled ? <Mic size={12} /> : <MicOff size={12} />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVideo();
            }}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: controls.videoEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: 'none',
              color: controls.videoEnabled ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            {controls.videoEnabled ? <Camera size={12} /> : <CameraOff size={12} />}
          </button>
        </div>

        <span style={{
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: '500'
        }}>
          You
        </span>
      </div>

      {/* Fullscreen Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFullscreen();
        }}
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          background: 'rgba(0, 0, 0, 0.5)',
          border: 'none',
          color: 'white',
          display: isHovered ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '8px'
        }}
      >
        {isFullscreen ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
      </button>
    </div>
  );
});

DraggableLocalVideo.displayName = 'DraggableLocalVideo';

// ============================================
// REMOTE VIDEO PLAYER COMPONENT
// ============================================
const RemoteVideoPlayer = React.memo(({ uid, tracks, profile, isTeacher, compact = false, active = false }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !tracks.video) return;

    const playVideo = () => {
      try {
        if (tracks.video.isPlaying) {
          tracks.video.stop();
        }
        tracks.video.play(videoRef.current);
      } catch (error) {
        console.warn(`Video play error for user ${uid}:`, error);
      }
    };

    playVideo();

    return () => {
      if (tracks.video?.isPlaying) {
        tracks.video.stop();
      }
    };
  }, [tracks.video, uid]);

  const getDisplayName = () => {
    if (isTeacher) return 'Teacher';
    if (profile?.display_name) return profile.display_name;
    if (profile?.name) return profile.name;
    return `Student ${uid}`;
  };

  return (
    <div 
      ref={containerRef}
      className={`remote-video-player ${compact ? 'compact' : ''} ${isTeacher ? 'teacher-video' : ''} ${active ? 'active-speaker' : ''}`}
      style={{ 
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: isTeacher ? '#1a1a2e' : '#0f172a',
        borderRadius: '12px',
        overflow: 'hidden',
        aspectRatio: '16/9',
        border: active ? '2px solid #4f46e5' : 
                isTeacher ? '2px solid #f59e0b' : 
                '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'border-color 0.3s ease'
      }}
    >
      <div ref={videoRef} style={{ width: '100%', height: '100%' }} />
      
      {!tracks.video && (
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
          backgroundColor: isTeacher ? '#1a1a2e' : '#0f172a'
        }}>
          <div style={{
            width: compact ? '40px' : '60px',
            height: compact ? '40px' : '60px',
            borderRadius: '50%',
            background: isTeacher 
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
              : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: compact ? '8px' : '12px',
            fontSize: compact ? '16px' : '24px',
            color: 'white'
          }}>
            {isTeacher ? '👨‍🏫' : '🎓'}
          </div>
          <p style={{ 
            fontSize: compact ? '12px' : '14px', 
            fontWeight: '500',
            color: isTeacher ? '#fbbf24' : '#a5b4fc',
            textAlign: 'center'
          }}>
            {getDisplayName()}
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
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          maxWidth: '70%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isTeacher && (
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              backgroundColor: '#f59e0b',
              animation: 'pulse 1.5s infinite'
            }} />
          )}
          {getDisplayName()}
          {isTeacher && ' (Host)'}
        </span>
        
        {tracks.audio ? (
          <Volume2 size={14} color="#22c55e" />
        ) : (
          <VolumeX size={14} color="#64748b" />
        )}
      </div>
    </div>
  );
});

RemoteVideoPlayer.displayName = 'RemoteVideoPlayer';

// ============================================
// MAIN STUDENT VIDEO CALL COMPONENT - PRODUCTION READY
// ============================================
const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null,
    retryCount: 0
  });

  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  const [userProfiles, setUserProfiles] = useState(new Map());
  const [teacherUid, setTeacherUid] = useState(null);

  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false,
    hasMicrophone: false,
    isScreenSharing: false,
    isFullscreen: false
  });

  const [uiState, setUiState] = useState({
    layoutMode: 'auto',
    isChatOpen: false,
    isParticipantsPanelOpen: false,
    showControls: true,
    showDebugPanel: process.env.NODE_ENV === 'development',
    activeSpeakerId: null,
    pagination: {
      page: 0,
      pageSize: 9
    },
    localVideoPosition: { x: 20, y: 20 },
    isLocalVideoDragging: false,
    dragStart: { x: 0, y: 0 }
  });

  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown',
    bandwidth: { upload: 0, download: 0 },
    packetLoss: 0
  });

  const [chat, setChat] = useState({
    messages: [],
    newMessage: '',
    unreadCount: 0
  });

  const [loading, setLoading] = useState({
    isConnecting: false,
    isLeaving: false,
    isReconnecting: false
  });

  // ============================================
  // REFS
  // ============================================
  const clientRef = useRef(null);
  const mainContainerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const participantsPanelRef = useRef(null);
  
  const controlsTimeoutRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const profilePollingRef = useRef(null);
  const messagesPollIntervalRef = useRef(null);
  const networkStatsIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // ============================================
  // DEBUG LOGGING
  // ============================================
  const logDebug = useCallback((message, data = null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 STUDENT DEBUG [${new Date().toISOString().split('T')[1].split('.')[0]}] ${message}`, data || '');
    }
  }, []);

  const logError = useCallback((message, error) => {
    console.error(`❌ STUDENT ERROR: ${message}`, error);
    setSessionState(prev => ({
      ...prev,
      error: error?.message || message
    }));
  }, []);

  // ============================================
  // RESPONSIVE CALCULATIONS
  // ============================================
  const calculateGridConfig = useCallback(() => {
    const remoteCount = remoteTracks.size;
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    
    if (isMobile) {
      return {
        maxVisible: 4,
        gridCols: 2,
        compactView: true,
        showLocalVideoOverlay: true,
        videoHeight: '120px'
      };
    } else if (isTablet) {
      return {
        maxVisible: 6,
        gridCols: 3,
        compactView: true,
        showLocalVideoOverlay: true,
        videoHeight: '140px'
      };
    } else {
      return {
        maxVisible: uiState.layoutMode === 'auto' ? 9 : 12,
        gridCols: uiState.layoutMode === 'auto' ? 3 : 4,
        compactView: false,
        showLocalVideoOverlay: true,
        videoHeight: '160px'
      };
    }
  }, [remoteTracks.size, uiState.layoutMode]);

  const getVisibleUsers = useMemo(() => {
    const config = calculateGridConfig();
    const usersArray = Array.from(remoteTracks.entries()).map(([uid, tracks]) => ({
      uid,
      tracks,
      profile: userProfiles.get(String(uid)),
      isTeacher: String(uid) === String(teacherUid)
    }));
    
    // Sort: Teacher first, then active speaker, then others
    const sortedUsers = usersArray.sort((a, b) => {
      if (a.isTeacher && !b.isTeacher) return -1;
      if (!a.isTeacher && b.isTeacher) return 1;
      if (String(a.uid) === uiState.activeSpeakerId && String(b.uid) !== uiState.activeSpeakerId) return -1;
      if (String(a.uid) !== uiState.activeSpeakerId && String(b.uid) === uiState.activeSpeakerId) return 1;
      return 0;
    });
    
    const startIdx = uiState.pagination.page * config.maxVisible;
    const endIdx = startIdx + config.maxVisible;
    
    return {
      users: sortedUsers.slice(startIdx, endIdx),
      totalPages: Math.ceil(sortedUsers.length / config.maxVisible),
      config
    };
  }, [remoteTracks, userProfiles, teacherUid, uiState.pagination, uiState.activeSpeakerId, calculateGridConfig]);

  // ============================================
  // DRAGGABLE LOCAL VIDEO HANDLERS
  // ============================================
  const handleLocalVideoDragStart = useCallback((e) => {
    e.preventDefault();
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    setUiState(prev => ({
      ...prev,
      isLocalVideoDragging: true,
      dragStart: {
        x: clientX - prev.localVideoPosition.x,
        y: clientY - prev.localVideoPosition.y
      }
    }));

    const handleGlobalMove = (moveEvent) => {
      setUiState(prev => {
        if (!prev.isLocalVideoDragging) return prev;
        
        const moveClientX = moveEvent.type.includes('mouse') 
          ? moveEvent.clientX 
          : moveEvent.touches[0].clientX;
        const moveClientY = moveEvent.type.includes('mouse') 
          ? moveEvent.clientY 
          : moveEvent.touches[0].clientY;

        const maxX = window.innerWidth - 160;
        const maxY = window.innerHeight - 120;

        const newX = Math.max(0, Math.min(moveClientX - prev.dragStart.x, maxX));
        const newY = Math.max(0, Math.min(moveClientY - prev.dragStart.y, maxY));

        return {
          ...prev,
          localVideoPosition: { x: newX, y: newY }
        };
      });
    };

    const handleGlobalEnd = () => {
      setUiState(prev => ({ ...prev, isLocalVideoDragging: false }));
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalEnd);
    };

    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchmove', handleGlobalMove);
    document.addEventListener('touchend', handleGlobalEnd);
  }, []);

  const handleLocalVideoDragEnd = useCallback(() => {
    setUiState(prev => ({ ...prev, isLocalVideoDragging: false }));
  }, []);

  // ============================================
  // INITIALIZATION & CONNECTION
  // ============================================
  const initializeSession = async () => {
    try {
      setLoading(prev => ({ ...prev, isConnecting: true }));
      logDebug('Initializing student session', { classId, studentId, meetingId });

      // Get session info first
      const sessionLookup = await studentvideoApi.getSessionByClassId(classId);
      
      if (!sessionLookup.success || !sessionLookup.exists || !sessionLookup.isActive) {
        throw new Error(sessionLookup.error || 'No active session found. Please wait for teacher.');
      }

      const effectiveMeetingId = sessionLookup.meetingId;
      
      // Create Agora client
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8',
        role: 'audience'
      });

      // Setup event listeners BEFORE joining
      setupAgoraEventListeners(effectiveMeetingId);

      // Join session via API
      const sessionData = await studentvideoApi.joinVideoSession(
        effectiveMeetingId,
        studentId,
        'student'
      );

      if (!sessionData.success || !sessionData.token) {
        throw new Error(sessionData.error || 'Failed to join session');
      }

      logDebug('Session data received', {
        channel: sessionData.channel,
        hasToken: !!sessionData.token,
        hasAppId: !!sessionData.appId
      });

      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: {
          ...sessionData,
          meetingId: effectiveMeetingId
        },
        error: null,
        retryCount: 0
      });

      // Join Agora channel
      await joinAgoraChannel(sessionData);

      // Start profile polling
      startProfilePolling(effectiveMeetingId);

    } catch (error) {
      logError('Initialization failed', error);
      
      // Retry logic
      if (sessionState.retryCount < 3) {
        setTimeout(() => {
          setSessionState(prev => ({
            ...prev,
            retryCount: prev.retryCount + 1
          }));
          initializeSession();
        }, 3000);
      }
    } finally {
      setLoading(prev => ({ ...prev, isConnecting: false }));
    }
  };

  const joinAgoraChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;

      logDebug('Joining Agora channel', {
        channel,
        uid,
        appIdLength: appId?.length,
        tokenLength: token?.length
      });

      // Join channel with specified UID
      const assignedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );

      logDebug('Channel joined successfully', { assignedUid });

      // Create and publish local tracks
      await createAndPublishLocalTracks();

      // Mark as joined
      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      // Start tracking
      startDurationTracking();
      startNetworkMonitoring();

      // Update participant status in backend
      await updateParticipantStatus({ status: 'joined' });

      logDebug('Student fully connected and ready');

    } catch (error) {
      logError('Failed to join Agora channel', error);
      
      // Enhanced error handling
      if (error.code === 'INVALID_TOKEN') {
        throw new Error('Session token has expired. Please refresh and try again.');
      } else if (error.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        throw new Error('Unable to connect to video servers. Please check your internet connection.');
      } else if (error.code === 'DYNAMIC_KEY_TIMEOUT') {
        throw new Error('Connection timeout. Please try again.');
      }
      
      throw error;
    }
  };

  // ============================================
  // AGORA EVENT LISTENERS
  // ============================================
  const setupAgoraEventListeners = (meetingId) => {
    const client = clientRef.current;
    if (!client) return;

    logDebug('Setting up Agora event listeners');

    // User Published - Subscribe to tracks
    client.on('user-published', async (user, mediaType) => {
      const uid = String(user.uid);
      logDebug('User published media', { uid, mediaType });

      try {
        await client.subscribe(user, mediaType);
        logDebug('Subscribed to user media', { uid, mediaType });

        setRemoteTracks(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(uid) || { audio: null, video: null };
          
          if (mediaType === 'video') {
            existing.video = user.videoTrack;
            logDebug('Video track added', { uid });
          } else if (mediaType === 'audio') {
            existing.audio = user.audioTrack;
            // Auto-play audio
            user.audioTrack?.play().catch(e => 
              logDebug('Audio play failed', { uid, error: e.message })
            );
            logDebug('Audio track added', { uid });
          }
          
          newMap.set(uid, existing);
          return newMap;
        });

        // Update participant count
        updateParticipantCount();

        // Set as active speaker if teacher
        const profile = userProfiles.get(uid);
        if (profile?.is_teacher) {
          setUiState(prev => ({ ...prev, activeSpeakerId: uid }));
          setTeacherUid(uid);
        }

      } catch (error) {
        logError('Subscribe error', error);
      }
    });

    // User Unpublished
    client.on('user-unpublished', (user, mediaType) => {
      const uid = String(user.uid);
      logDebug('User unpublished media', { uid, mediaType });

      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(uid);
        
        if (existing) {
          if (mediaType === 'video') {
            existing.video?.stop();
            existing.video = null;
          } else if (mediaType === 'audio') {
            existing.audio?.stop();
            existing.audio = null;
          }
          newMap.set(uid, existing);
        }
        
        return newMap;
      });
    });

    // User Left
    client.on('user-left', (user) => {
      const uid = String(user.uid);
      logDebug('User left', uid);

      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        const tracks = newMap.get(uid);
        
        if (tracks) {
          tracks.audio?.stop();
          tracks.video?.stop();
        }
        
        newMap.delete(uid);
        return newMap;
      });

      // Remove from profiles
      setUserProfiles(prev => {
        const updated = new Map(prev);
        updated.delete(uid);
        return updated;
      });

      // Clear active speaker if this user was speaking
      if (uiState.activeSpeakerId === uid) {
        setUiState(prev => ({ ...prev, activeSpeakerId: null }));
      }

      updateParticipantCount();
    });

    // Connection State Changes
    client.on('connection-state-change', (curState, prevState) => {
      logDebug('Connection state changed', { from: prevState, to: curState });
      
      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        setLoading(prev => ({ ...prev, isReconnecting: true }));
        
        // Attempt reconnection
        reconnectTimeoutRef.current = setTimeout(() => {
          if (sessionState.sessionInfo) {
            joinAgoraChannel(sessionState.sessionInfo).catch(() => {
              logDebug('Reconnection attempt failed');
            });
          }
        }, 3000);
        
      } else if (curState === 'CONNECTED') {
        setLoading(prev => ({ ...prev, isReconnecting: false }));
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      }
    });

    // Network Quality
    client.on('network-quality', (stats) => {
      const uplink = stats.uplinkNetworkQuality || 0;
      const downlink = stats.downlinkNetworkQuality || 0;
      
      let quality = 'unknown';
      if (uplink >= 4 && downlink >= 4) quality = 'excellent';
      else if (uplink >= 2 && downlink >= 2) quality = 'good';
      else if (uplink >= 1 && downlink >= 1) quality = 'poor';
      else quality = 'bad';
      
      setStats(prev => ({
        ...prev,
        connectionQuality: quality,
        packetLoss: stats.uplinkPacketLossRate || 0
      }));
    });

    // Stream Fallback
    client.on('stream-fallback', (user, isFallbackOrRecover) => {
      logDebug('Stream fallback/recover', { uid: user.uid, isFallbackOrRecover });
    });

    // Stream Type Changed
    client.on('stream-type-changed', (user, streamType) => {
      logDebug('Stream type changed', { uid: user.uid, streamType });
    });

    // Token Privilege Will Expire
    client.on('token-privilege-will-expire', () => {
      logDebug('Token will expire soon');
      // Refresh token logic here
    });

    // Token Privilege Did Expire
    client.on('token-privilege-did-expire', () => {
      logDebug('Token expired');
      setSessionState(prev => ({
        ...prev,
        error: 'Session token expired. Please refresh the page.'
      }));
    });
  };

  // ============================================
  // LOCAL TRACKS MANAGEMENT
  // ============================================
  const createAndPublishLocalTracks = async () => {
    try {
      logDebug('Creating local audio/video tracks');

      // Check device permissions first
      await checkDevicePermissions();

      let audioTrack = null;
      let videoTrack = null;

      // Create audio track with optimization
      if (controls.hasMicrophone) {
        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true, // Acoustic Echo Cancellation
            ANS: true, // Automatic Noise Suppression
            AGC: true, // Automatic Gain Control
            encoderConfig: {
              sampleRate: 48000,
              stereo: false,
              bitrate: 64
            }
          });
          logDebug('Microphone audio track created');
        } catch (error) {
          logDebug('Microphone access failed', error.message);
          setControls(prev => ({ ...prev, hasMicrophone: false }));
        }
      }

      // Create video track with optimization
      if (controls.hasCamera) {
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 15, max: 30 },
              bitrateMin: 400,
              bitrateMax: 1000
            },
            optimizationMode: 'detail',
            mirror: true
          });
          logDebug('Camera video track created');
        } catch (error) {
          logDebug('Camera access failed', error.message);
          setControls(prev => ({ ...prev, hasCamera: false }));
        }
      }

      // Store tracks locally
      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Update control state
      setControls(prev => ({
        ...prev,
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack
      }));

      // Publish tracks to channel
      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);

      if (tracksToPublish.length > 0 && clientRef.current) {
        await clientRef.current.publish(tracksToPublish);
        logDebug(`Published ${tracksToPublish.length} local tracks`);
      }

      // Update backend status
      await updateParticipantStatus({
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack,
        devices: {
          hasMicrophone: !!audioTrack,
          hasCamera: !!videoTrack
        }
      });

    } catch (error) {
      logError('Failed to create/publish local tracks', error);
    }
  };

  const checkDevicePermissions = async () => {
    try {
      // Check microphone
      const micPermission = await navigator.permissions.query({ name: 'microphone' });
      setControls(prev => ({ ...prev, hasMicrophone: micPermission.state === 'granted' }));

      // Check camera
      const cameraPermission = await navigator.permissions.query({ name: 'camera' });
      setControls(prev => ({ ...prev, hasCamera: cameraPermission.state === 'granted' }));

      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(d => d.kind === 'audioinput' && d.deviceId);
      const hasCamera = devices.some(d => d.kind === 'videoinput' && d.deviceId);
      
      setControls(prev => ({
        ...prev,
        hasMicrophone: prev.hasMicrophone && hasMic,
        hasCamera: prev.hasCamera && hasCamera
      }));

    } catch (error) {
      logDebug('Device permission check failed', error.message);
      // Fallback: assume devices exist
      setControls(prev => ({
        ...prev,
        hasMicrophone: true,
        hasCamera: true
      }));
    }
  };

  // ============================================
  // CONTROL FUNCTIONS
  // ============================================
  const toggleAudio = async () => {
    if (!localTracks.audio) {
      logDebug('No audio track available to toggle');
      return;
    }

    try {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      
      await updateParticipantStatus({ audioEnabled: newState });
      logDebug(`Audio ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logError('Toggle audio failed', error);
    }
  };

  const toggleVideo = async () => {
    if (!localTracks.video) {
      logDebug('No video track available to toggle');
      return;
    }

    try {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      
      await updateParticipantStatus({ videoEnabled: newState });
      logDebug(`Video ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logError('Toggle video failed', error);
    }
  };

  const toggleHandRaise = async () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    if (sessionState.sessionInfo?.session?.id) {
      try {
        await studentvideoApi.sendMessage(
          sessionState.sessionInfo.session.id,
          studentId,
          newState ? '✋ Student raised hand' : 'Hand lowered',
          'system'
        );
        logDebug(`Hand ${newState ? 'raised' : 'lowered'}`);
      } catch (error) {
        logError('Failed to send hand raise message', error);
      }
    }
  };

  const toggleFullscreen = () => {
    const container = mainContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(error => {
        logDebug('Failed to enter fullscreen', error);
      });
      setControls(prev => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setControls(prev => ({ ...prev, isFullscreen: false }));
    }
  };

  const toggleScreenShare = async () => {
    if (controls.isScreenSharing) {
      // Stop screen share
      try {
        const screenTrack = localTracks.video;
        if (screenTrack) {
          await clientRef.current.unpublish([screenTrack]);
          screenTrack.stop();
          screenTrack.close();
        }

        // Switch back to camera
        const cameraTrack = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish([cameraTrack]);
        
        setLocalTracks(prev => ({ ...prev, video: cameraTrack }));
        setControls(prev => ({ 
          ...prev, 
          isScreenSharing: false,
          videoEnabled: true 
        }));
        
        logDebug('Switched back to camera');
      } catch (error) {
        logError('Failed to stop screen share', error);
      }
    } else {
      // Start screen share
      try {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 15,
            bitrateMin: 800,
            bitrateMax: 2000
          }
        }, 'auto');

        // Unpublish camera track
        if (localTracks.video) {
          await clientRef.current.unpublish([localTracks.video]);
          localTracks.video.stop();
          localTracks.video.close();
        }

        // Publish screen track
        await clientRef.current.publish([screenTrack]);
        
        setLocalTracks(prev => ({ ...prev, video: screenTrack }));
        setControls(prev => ({ 
          ...prev, 
          isScreenSharing: true,
          videoEnabled: true 
        }));
        
        logDebug('Started screen sharing');
      } catch (error) {
        logError('Failed to start screen share', error);
        setControls(prev => ({ ...prev, isScreenSharing: false }));
      }
    }
  };

  // ============================================
  // PROFILE & PARTICIPANT MANAGEMENT
  // ============================================
  const startProfilePolling = (meetingId) => {
    // Initial fetch
    fetchParticipants(meetingId);

    // Set up polling interval
    if (profilePollingRef.current) {
      clearInterval(profilePollingRef.current);
    }

    profilePollingRef.current = setInterval(() => {
      if (meetingId && sessionState.isJoined) {
        fetchParticipants(meetingId);
      }
    }, 10000); // Poll every 10 seconds
  };

  const fetchParticipants = async (meetingId) => {
    try {
      logDebug('Fetching participants', meetingId);
      
      const response = await studentvideoApi.getSessionParticipants(meetingId);
      
      if (response.success && response.participants) {
        const newProfiles = new Map();
        let teacherUidFound = null;
        
        response.participants.forEach(participant => {
          if (participant.agora_uid) {
            const uidString = String(participant.agora_uid);
            const isTeacher = participant.role === 'teacher' || participant.is_teacher;
            
            newProfiles.set(uidString, {
              id: participant.user_id,
              agora_uid: participant.agora_uid,
              name: participant.display_name || participant.name || 'User',
              display_name: participant.display_name || participant.name || 'User',
              role: isTeacher ? 'teacher' : 'student',
              is_teacher: isTeacher,
              avatar_url: participant.avatar_url
            });
            
            if (isTeacher) {
              teacherUidFound = uidString;
            }
          }
        });
        
        setUserProfiles(newProfiles);
        if (teacherUidFound) {
          setTeacherUid(teacherUidFound);
        }
        
        logDebug('Participants updated', { 
          count: newProfiles.size,
          teacherUid: teacherUidFound 
        });
      }
    } catch (error) {
      logDebug('Failed to fetch participants', error.message);
      // Don't throw - this is a non-critical background task
    }
  };

  const updateParticipantStatus = async (updates) => {
    try {
      if (!sessionState.sessionInfo?.meetingId) return;

      const statusUpdate = {
        ...updates,
        timestamp: new Date().toISOString(),
        student_id: studentId,
        meeting_id: sessionState.sessionInfo.meetingId
      };

      await studentvideoApi.updateParticipantStatus(
        sessionState.sessionInfo.meetingId,
        studentId,
        statusUpdate
      );

    } catch (error) {
      logDebug('Failed to update participant status', error.message);
    }
  };

  // ============================================
  // CHAT FUNCTIONS
  // ============================================
  const startChatPolling = (sessionId) => {
    if (!sessionId) return;

    // Initial load
    loadChatMessages(sessionId);

    // Set up polling
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }

    messagesPollIntervalRef.current = setInterval(() => {
      if (sessionId && sessionState.isJoined) {
        loadChatMessages(sessionId);
      }
    }, 3000); // Poll every 3 seconds
  };

  const loadChatMessages = async (sessionId) => {
    try {
      const messages = await studentvideoApi.getSessionMessages(sessionId);
      
      if (messages && Array.isArray(messages)) {
        setChat(prev => {
          const newIds = new Set(messages.map(m => m.id));
          const existing = prev.messages.filter(m => !newIds.has(m.id));
          const allMessages = [...existing, ...messages].sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
          
          // Calculate unread count
          const unreadCount = uiState.isChatOpen ? 0 : 
            Math.max(0, messages.length - prev.messages.length);
          
          return {
            ...prev,
            messages: allMessages,
            unreadCount: prev.unreadCount + unreadCount
          };
        });

        // Auto-scroll to bottom
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      logDebug('Failed to load chat messages', error.message);
    }
  };

  const sendChatMessage = async () => {
    const message = chat.newMessage.trim();
    if (!message || !sessionState.sessionInfo?.session?.id) return;

    try {
      await studentvideoApi.sendMessage(
        sessionState.sessionInfo.session.id,
        studentId,
        message,
        'text'
      );
      
      setChat(prev => ({
        ...prev,
        newMessage: ''
      }));

      // Reload messages to show the new one
      loadChatMessages(sessionState.sessionInfo.session.id);

    } catch (error) {
      logError('Failed to send chat message', error);
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
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

  const startNetworkMonitoring = () => {
    if (networkStatsIntervalRef.current) {
      clearInterval(networkStatsIntervalRef.current);
    }
    
    networkStatsIntervalRef.current = setInterval(() => {
      if (clientRef.current) {
        const stats = clientRef.current.getRTCStats();
        setStats(prev => ({
          ...prev,
          bandwidth: {
            upload: stats.TxBitrate || 0,
            download: stats.RxBitrate || 0
          }
        }));
      }
    }, 5000); // Update every 5 seconds
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // ============================================
  // CLEANUP FUNCTION
  // ============================================
  const cleanup = async () => {
    logDebug('Starting cleanup procedure');
    
    // Clear all intervals and timeouts
    const clearRefs = [
      controlsTimeoutRef,
      durationIntervalRef,
      profilePollingRef,
      messagesPollIntervalRef,
      networkStatsIntervalRef,
      reconnectTimeoutRef
    ];
    
    clearRefs.forEach(ref => {
      if (ref.current) {
        clearInterval(ref.current);
        clearTimeout(ref.current);
        ref.current = null;
      }
    });

    // Stop and close local tracks
    if (localTracks.audio) {
      try {
        localTracks.audio.stop();
        localTracks.audio.close();
      } catch (error) {
        logDebug('Error closing audio track', error.message);
      }
    }
    
    if (localTracks.video) {
      try {
        localTracks.video.stop();
        localTracks.video.close();
      } catch (error) {
        logDebug('Error closing video track', error.message);
      }
    }

    // Leave Agora channel
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
        logDebug('Left Agora channel');
      } catch (error) {
        logDebug('Error leaving channel', error.message);
      }
    }

    // Clear remote tracks
    setRemoteTracks(new Map());
    setUserProfiles(new Map());
    
    // Update participant status to left
    if (sessionState.sessionInfo?.meetingId) {
      try {
        await updateParticipantStatus({ status: 'left' });
      } catch (error) {
        logDebug('Failed to update left status', error.message);
      }
    }

    logDebug('Cleanup completed');
  };

  const leaveSession = async () => {
    try {
      setLoading(prev => ({ ...prev, isLeaving: true }));
      
      await cleanup();
      
      if (onLeaveCall) {
        onLeaveCall();
      }
    } catch (error) {
      logError('Error leaving session', error);
    } finally {
      setLoading(prev => ({ ...prev, isLeaving: false }));
    }
  };

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, studentId, meetingId]);

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
      // Adjust local video position on resize
      const maxX = window.innerWidth - 160;
      const maxY = window.innerHeight - 120;
      
      setUiState(prev => ({
        ...prev,
        localVideoPosition: {
          x: Math.min(prev.localVideoPosition.x, maxX),
          y: Math.min(prev.localVideoPosition.y, maxY)
        }
      }));
    };
    
    // Initial show controls
    handleMouseMove();
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Auto-open chat on new messages when chat is closed
    if (chat.unreadCount > 0 && !uiState.isChatOpen) {
      // Optionally show notification
    }
  }, [chat.unreadCount, uiState.isChatOpen]);

  useEffect(() => {
    // Start chat polling when session is joined
    if (sessionState.isJoined && sessionState.sessionInfo?.session?.id) {
      startChatPolling(sessionState.sessionInfo.session.id);
    }
  }, [sessionState.isJoined, sessionState.sessionInfo?.session?.id]);

  // ============================================
  // RENDER
  // ============================================
  if (sessionState.error) {
    return (
      <div className="video-call-error">
        <div className="error-container">
          <AlertCircle size={48} color="#ef4444" />
          <h2>Connection Error</h2>
          <p>{sessionState.error}</p>
          <div className="error-actions">
            <button 
              onClick={initializeSession} 
              className="retry-button"
              disabled={loading.isConnecting}
            >
              {loading.isConnecting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Retrying...
                </>
              ) : 'Retry Connection'}
            </button>
            <button onClick={onLeaveCall} className="leave-button">
              Go Back
            </button>
          </div>
          {uiState.showDebugPanel && (
            <div className="debug-info">
              <h4>Debug Information:</h4>
              <pre>{JSON.stringify({
                meetingId,
                classId,
                studentId,
                retryCount: sessionState.retryCount,
                error: sessionState.error
              }, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!sessionState.isJoined || loading.isConnecting) {
    return (
      <div className="video-call-loading">
        <div className="loading-container">
          <div className="spinner"></div>
          <h3>Joining Classroom...</h3>
          <p>Connecting to teacher's session</p>
          {loading.isReconnecting && (
            <p className="reconnecting">Reconnecting...</p>
          )}
          {uiState.showDebugPanel && (
            <div className="debug-info">
              <p>Meeting ID: {meetingId || classId}</p>
              <p>Student ID: {studentId}</p>
              <p>Status: {uiState.debugInfo.connectionStatus}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { users: visibleUsers, totalPages, config } = getVisibleUsers;
  const currentPage = uiState.pagination.page;
  const isMobile = window.innerWidth < 768;

  return (
    <div 
      ref={mainContainerRef}
      className="student-video-call-container classroom-theme"
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
              🎓 Student View
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
            
            <span style={{ 
              padding: '4px 8px',
              background: stats.connectionQuality === 'good' || stats.connectionQuality === 'excellent' 
                ? 'rgba(34, 197, 94, 0.2)' 
                : 'rgba(245, 158, 11, 0.2)',
              borderRadius: '4px',
              color: stats.connectionQuality === 'good' || stats.connectionQuality === 'excellent' 
                ? '#22c55e' 
                : '#f59e0b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {stats.connectionQuality === 'good' || stats.connectionQuality === 'excellent' ? 
                <Wifi size={12} /> : <WifiOff size={12} />}
              {stats.connectionQuality}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {controls.handRaised && (
            <span style={{
              padding: '4px 12px',
              background: 'rgba(245, 158, 11, 0.2)',
              borderRadius: '16px',
              color: '#f59e0b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              animation: 'pulse 1.5s infinite'
            }}>
              ✋ Hand Raised
            </span>
          )}
          
          {controls.isScreenSharing && (
            <span style={{
              padding: '4px 12px',
              background: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '16px',
              color: '#3b82f6',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Share2 size={12} />
              Sharing Screen
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
            {controls.isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: isMobile ? '10px' : '20px',
        right: isMobile ? '10px' : '20px',
        bottom: '100px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'hidden'
      }}>
        {/* Layout Controls */}
        {!isMobile && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            zIndex: 10
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
        )}
        
        {/* Remote Videos Grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${config.gridCols}, 1fr)`,
          gap: isMobile ? '8px' : '16px',
          overflowY: 'auto',
          padding: '4px',
          position: 'relative'
        }}>
          {visibleUsers.map(({ uid, tracks, profile, isTeacher }) => (
            <div 
              key={uid}
              style={{
                position: 'relative',
                backgroundColor: '#1e293b',
                borderRadius: '12px',
                overflow: 'hidden',
                border: isTeacher 
                  ? '2px solid #f59e0b' 
                  : uid === uiState.activeSpeakerId 
                    ? '2px solid #4f46e5' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                minHeight: config.videoHeight,
                transition: 'all 0.3s ease'
              }}
            >
              <RemoteVideoPlayer 
                uid={uid}
                tracks={tracks}
                profile={profile}
                isTeacher={isTeacher}
                compact={config.compactView}
                active={uid === uiState.activeSpeakerId}
              />
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
              color: '#64748b',
              textAlign: 'center',
              padding: '20px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>
                👨‍🏫
              </div>
              <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '24px' }}>
                Waiting for teacher to start class...
              </h3>
              <p style={{ maxWidth: '400px', lineHeight: '1.5' }}>
                Your teacher will join the session shortly. Make sure your audio and video are working properly.
              </p>
              <div style={{ 
                marginTop: '24px',
                padding: '12px 24px',
                background: 'rgba(79, 70, 229, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(79, 70, 229, 0.2)'
              }}>
                <p style={{ color: '#a5b4fc', fontSize: '14px' }}>
                  <strong>Status:</strong> Connected • {stats.participantCount} participant{stats.participantCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Draggable Local Video Overlay */}
      {config.showLocalVideoOverlay && localTracks.video && (
        <DraggableLocalVideo
          localTracks={localTracks}
          controls={controls}
          isDragging={uiState.isLocalVideoDragging}
          position={uiState.localVideoPosition}
          onDragStart={handleLocalVideoDragStart}
          onDragEnd={handleLocalVideoDragEnd}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={controls.isFullscreen}
          videoEnabled={controls.videoEnabled}
        />
      )}
      
      {/* Main Controls Bar */}
      <div className={`floating-controls ${uiState.showControls ? 'visible' : 'hidden'}`}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '12px 24px',
          display: 'flex',
          gap: isMobile ? '8px' : '16px',
          alignItems: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          zIndex: 100,
          transition: 'all 0.3s ease',
          width: isMobile ? '90%' : 'auto',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          justifyContent: 'center'
        }}
      >
        <button 
          onClick={toggleAudio}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: controls.audioEnabled 
              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px',
            transition: 'all 0.2s'
          }}
          title={controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        
        <button 
          onClick={toggleVideo}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: controls.videoEnabled 
              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px',
            transition: 'all 0.2s'
          }}
          title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {controls.videoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
        </button>
        
        <button 
          onClick={toggleScreenShare}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: controls.isScreenSharing
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: controls.isScreenSharing ? 'white' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px',
            transition: 'all 0.2s'
          }}
          title={controls.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          <Share2 size={20} />
        </button>
        
        <button 
          onClick={toggleHandRaise}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: controls.handRaised 
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
              : 'rgba(255, 255, 255, 0.1)',
            border: controls.handRaised ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
            color: controls.handRaised ? 'white' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px',
            transition: 'all 0.2s',
            animation: controls.handRaised ? 'pulse 1.5s infinite' : 'none'
          }}
          title={controls.handRaised ? 'Lower hand' : 'Raise hand'}
        >
          ✋
        </button>
        
        <div style={{ 
          width: '1px', 
          height: '30px', 
          background: 'rgba(255, 255, 255, 0.1)',
          display: isMobile ? 'none' : 'block'
        }} />
        
        <button 
          onClick={() => {
            setUiState(prev => ({ 
              ...prev, 
              isChatOpen: !prev.isChatOpen,
              unreadCount: 0 
            }));
            setChat(prev => ({ ...prev, unreadCount: 0 }));
          }}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: uiState.isChatOpen 
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px',
            transition: 'all 0.2s',
            position: 'relative'
          }}
          title="Toggle chat"
        >
          <MessageCircle size={20} />
          {chat.unreadCount > 0 && !uiState.isChatOpen && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: 'white',
              fontSize: '10px',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}>
              {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
            </span>
          )}
        </button>
        
        <button 
          onClick={leaveSession}
          disabled={loading.isLeaving}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading.isLeaving ? 'not-allowed' : 'pointer',
            fontSize: '20px',
            transition: 'all 0.2s',
            opacity: loading.isLeaving ? 0.7 : 1
          }}
          title="Leave session"
        >
          {loading.isLeaving ? (
            <Loader2 size={20} className="spin" />
          ) : (
            <PhoneOff size={20} />
          )}
        </button>
      </div>
      
      {/* Chat Panel */}
      {uiState.isChatOpen && (
        <div style={{
          position: 'absolute',
          bottom: '120px',
          right: isMobile ? '10px' : '20px',
          width: isMobile ? 'calc(100vw - 20px)' : '300px',
          height: '400px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.5)'
          }}>
            <h3 style={{ color: 'white', fontSize: '16px', margin: 0 }}>
              Class Chat ({chat.messages.length})
            </h3>
            <button 
              onClick={() => setUiState(prev => ({ ...prev, isChatOpen: false }))}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
          
          <div 
            ref={chatContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {chat.messages.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                color: '#64748b',
                textAlign: 'center',
                padding: '20px'
              }}>
                <MessageSquare size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No messages yet</p>
                <p style={{ fontSize: '14px' }}>Be the first to say hello!</p>
              </div>
            ) : (
              chat.messages.map(msg => {
                const isOwnMessage = msg.sender_id === studentId;
                const isSystemMessage = msg.message_type === 'system';
                const profile = userProfiles.get(String(msg.sender_id));
                
                return (
                  <div 
                    key={msg.id}
                    style={{
                      marginBottom: '8px',
                      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                      maxWidth: '85%'
                    }}
                  >
                    {!isOwnMessage && !isSystemMessage && (
                      <div style={{ 
                        color: '#94a3b8', 
                        fontSize: '12px', 
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {profile?.is_teacher && (
                          <span style={{
                            padding: '1px 4px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            borderRadius: '4px',
                            color: '#f59e0b',
                            fontSize: '10px'
                          }}>
                            Teacher
                          </span>
                        )}
                        {profile?.name || 'Unknown User'}
                      </div>
                    )}
                    
                    <div style={{
                      display: 'inline-block',
                      background: isSystemMessage 
                        ? 'rgba(59, 130, 246, 0.2)'
                        : isOwnMessage
                          ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                          : 'rgba(30, 41, 59, 0.8)',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      wordBreak: 'break-word',
                      border: isSystemMessage ? '1px solid rgba(59, 130, 246, 0.3)' : 'none'
                    }}>
                      <div style={{ fontSize: '14px' }}>
                        {msg.message_text}
                      </div>
                      <div style={{ 
                        color: isSystemMessage ? '#93c5fd' : 
                               isOwnMessage ? '#c7d2fe' : '#64748b', 
                        fontSize: '11px', 
                        marginTop: '4px',
                        textAlign: 'right'
                      }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div style={{
            padding: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(30, 41, 59, 0.5)'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chat.newMessage}
                onChange={(e) => setChat(prev => ({ ...prev, newMessage: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '10px 16px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button 
                onClick={sendChatMessage}
                disabled={!chat.newMessage.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: chat.newMessage.trim() 
                    ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'white',
                  cursor: chat.newMessage.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <MessageSquare size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Debug Panel (Development Only) */}
      {uiState.showDebugPanel && process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '70px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.85)',
          borderRadius: '12px',
          padding: '16px',
          color: 'white',
          fontSize: '12px',
          maxWidth: '300px',
          zIndex: 1000,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '14px' }}>
            Debug Information
          </h4>
          <div style={{ display: 'grid', gap: '5px', marginBottom: '10px' }}>
            <div><strong>Status:</strong> {sessionState.isJoined ? 'Connected' : 'Disconnected'}</div>
            <div><strong>Remote Users:</strong> {remoteTracks.size}</div>
            <div><strong>Teacher UID:</strong> {teacherUid || 'Not found'}</div>
            <div><strong>Profiles Loaded:</strong> {userProfiles.size}</div>
            <div><strong>Local Video:</strong> {localTracks.video ? 'Active' : 'Inactive'}</div>
            <div><strong>Local Audio:</strong> {localTracks.audio ? 'Active' : 'Inactive'}</div>
            <div><strong>Connection Quality:</strong> {stats.connectionQuality}</div>
            <div><strong>Bandwidth:</strong> {Math.round(stats.bandwidth.upload)}kbps↑ / {Math.round(stats.bandwidth.download)}kbps↓</div>
          </div>
          <button 
            onClick={() => fetchParticipants(sessionState.sessionInfo?.meetingId)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#4f46e5',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              marginBottom: '8px'
            }}
          >
            Refresh Profiles
          </button>
          <button 
            onClick={() => setUiState(prev => ({ ...prev, showDebugPanel: false }))}
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Hide Debug
          </button>
          {sessionState.error && (
            <div style={{
              marginTop: '10px',
              padding: '8px',
              background: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '11px',
              wordBreak: 'break-all'
            }}>
              <strong>Error:</strong> {sessionState.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentVideoCall;