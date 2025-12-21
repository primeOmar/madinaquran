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
  GripHorizontal,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Grid3x3,
  User,
  ChevronLeft,
  ChevronRight,
  Settings
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
  isFullscreen
}) => {
  const containerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const getContainerStyle = () => {
    const baseStyle = {
      position: 'absolute',
      width: '160px',
      height: '120px',
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
      touchAction: 'none'
    };

    // Responsive sizing
    if (window.innerWidth < 640) { // Mobile
      baseStyle.width = '140px';
      baseStyle.height = '105px';
    } else if (window.innerWidth < 1024) { // Tablet
      baseStyle.width = '150px';
      baseStyle.height = '112px';
    }

    return {
      ...baseStyle,
      left: `${position.x}px`,
      top: `${position.y}px`
    };
  };

  const getVideoStyle = () => ({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    display: controls.videoEnabled ? 'block' : 'none'
  });

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
      <video
        ref={el => {
          if (el && localTracks.video) {
            try {
              localTracks.video.stop();
              localTracks.video.play(el);
            } catch (error) {
              console.warn('Local video playback error:', error);
            }
          }
        }}
        autoPlay
        playsInline
        muted
        style={getVideoStyle()}
      />

      {/* Video Off State */}
      {!controls.videoEnabled && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
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
const RemoteVideoPlayer = React.memo(({ uid, tracks, profile, isTeacher, compact = false }) => {
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
      className={`remote-video-player ${compact ? 'compact' : ''} ${isTeacher ? 'teacher-video' : ''}`}
      style={{ 
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: isTeacher ? '#1a1a2e' : '#0f172a',
        borderRadius: '12px',
        overflow: 'hidden',
        aspectRatio: '16/9',
        border: isTeacher ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)'
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
// MAIN STUDENT VIDEO CALL COMPONENT
// ============================================
const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
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
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  const [userProfiles, setUserProfiles] = useState(new Map());
  const [teacherUid, setTeacherUid] = useState(null);

  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false,
    hasMicrophone: false
  });

  const [uiState, setUiState] = useState({
    layoutMode: 'auto',
    isChatOpen: false,
    showControls: true,
    isFullscreen: false,
    activeSpeakerId: null,
    pagination: {
      page: 0,
      pageSize: 8
    }
  });

  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'good'
  });

  const [chat, setChat] = useState({
    messages: [],
    newMessage: ''
  });

  const [loading, setLoading] = useState({
    isConnecting: false,
    isLeaving: false
  });

  // ============================================
  // DRAGGABLE STATE & REFS
  // ============================================
  const [localVideoState, setLocalVideoState] = useState({
    position: { x: 20, y: 20 },
    isDragging: false,
    dragStart: { x: 0, y: 0 }
  });

  const clientRef = useRef(null);
  const mainContainerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const profilePollingRef = useRef(null);
  const messagesPollIntervalRef = useRef(null);

  // ============================================
  // RESPONSIVE CALCULATIONS
  // ============================================
  const calculateGridConfig = useCallback(() => {
    const remoteCount = remoteTracks.size;
    const screenWidth = window.innerWidth;
    
    if (screenWidth < 640) { // Mobile
      return {
        maxVisible: 4,
        gridCols: 1,
        compactView: true,
        showLocalVideoOverlay: true
      };
    } else if (screenWidth < 768) { // Small tablet
      return {
        maxVisible: 6,
        gridCols: 2,
        compactView: true,
        showLocalVideoOverlay: true
      };
    } else if (screenWidth < 1024) { // Tablet
      return {
        maxVisible: 8,
        gridCols: 2,
        compactView: false,
        showLocalVideoOverlay: true
      };
    } else { // Desktop
      return {
        maxVisible: uiState.layoutMode === 'auto' ? 9 : 12,
        gridCols: uiState.layoutMode === 'auto' ? 3 : 4,
        compactView: false,
        showLocalVideoOverlay: true
      };
    }
  }, [remoteTracks.size, uiState.layoutMode]);

  const getVisibleUsers = useMemo(() => {
    const config = calculateGridConfig();
    const usersArray = Array.from(remoteTracks.entries()).map(([uid, tracks]) => ({
      uid,
      tracks,
      profile: userProfiles.get(uid),
      isTeacher: uid === teacherUid
    }));
    
    // Always show teacher first
    const sortedUsers = usersArray.sort((a, b) => {
      if (a.isTeacher && !b.isTeacher) return -1;
      if (!a.isTeacher && b.isTeacher) return 1;
      return 0;
    });
    
    const startIdx = uiState.pagination.page * config.maxVisible;
    const endIdx = startIdx + config.maxVisible;
    
    return {
      users: sortedUsers.slice(startIdx, endIdx),
      totalPages: Math.ceil(sortedUsers.length / config.maxVisible),
      config
    };
  }, [remoteTracks, userProfiles, teacherUid, uiState.pagination, calculateGridConfig]);

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
      // Adjust local video position to stay within bounds on resize
      const maxX = window.innerWidth - 160;
      const maxY = window.innerHeight - 120;
      
      setLocalVideoState(prev => ({
        ...prev,
        position: {
          x: Math.min(prev.position.x, maxX),
          y: Math.min(prev.position.y, maxY)
        }
      }));
    };
    
    // Start with controls visible
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
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, studentId, meetingId]);

  useEffect(() => {
    if (remoteTracks.size > 0 && sessionState.isJoined) {
      syncProfilesWithTracks();
    }
  }, [remoteTracks, sessionState.isJoined]);

  // ============================================
  // DRAGGABLE LOCAL VIDEO FUNCTIONS
  // ============================================
  const handleLocalVideoDragStart = (e) => {
    e.preventDefault();
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    setLocalVideoState(prev => ({
      ...prev,
      isDragging: true,
      dragStart: {
        x: clientX - prev.position.x,
        y: clientY - prev.position.y
      }
    }));

    // Add global event listeners for drag
    const handleGlobalMove = (moveEvent) => {
      if (!localVideoState.isDragging) return;
      
      const moveClientX = moveEvent.type.includes('mouse') 
        ? moveEvent.clientX 
        : moveEvent.touches[0].clientX;
      const moveClientY = moveEvent.type.includes('mouse') 
        ? moveEvent.clientY 
        : moveEvent.touches[0].clientY;

      const maxX = window.innerWidth - 160;
      const maxY = window.innerHeight - 120;

      const newX = Math.max(0, Math.min(moveClientX - localVideoState.dragStart.x, maxX));
      const newY = Math.max(0, Math.min(moveClientY - localVideoState.dragStart.y, maxY));

      setLocalVideoState(prev => ({
        ...prev,
        position: { x: newX, y: newY }
      }));
    };

    const handleGlobalEnd = () => {
      setLocalVideoState(prev => ({ ...prev, isDragging: false }));
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalEnd);
    };

    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchmove', handleGlobalMove);
    document.addEventListener('touchend', handleGlobalEnd);
  };

  const handleLocalVideoDragEnd = () => {
    setLocalVideoState(prev => ({ ...prev, isDragging: false }));
  };

  // ============================================
  // CORE FUNCTIONS
  // ============================================
  const initializeSession = async () => {
    try {
      setLoading(prev => ({ ...prev, isConnecting: true }));
      console.log('🎓 STUDENT: Starting initialization', { classId, meetingId });

      const sessionLookup = await studentvideoApi.getSessionByClassId(classId);
      
      if (!sessionLookup.success || !sessionLookup.exists || !sessionLookup.isActive) {
        throw new Error(sessionLookup.error || 'No active session found. Waiting for teacher...');
      }

      const effectiveMeetingId = sessionLookup.meetingId;
      
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Setup event listeners
      setupAgoraEventListeners(effectiveMeetingId);

      const sessionData = await studentvideoApi.joinVideoSession(
        effectiveMeetingId,
        studentId,
        'student'
      );

      if (!sessionData.success || !sessionData.token) {
        throw new Error(sessionData.error || 'Failed to join session');
      }

      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: {
          ...sessionData,
          meetingId: effectiveMeetingId
        },
        error: null
      });

      await joinChannel({
        ...sessionData,
        uid: sessionData.uid
      });

      setLoading(prev => ({ ...prev, isConnecting: false }));

    } catch (error) {
      console.error('❌ Init Error:', error);
      setSessionState(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to connect' 
      }));
      setLoading(prev => ({ ...prev, isConnecting: false }));
    }
  };

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;

      console.log('🔗 STUDENT: Joining channel', {
        channel,
        uid
      });

      // Join with exact parameters
      const joinedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );

      console.log('✅ STUDENT: Successfully joined channel:', joinedUid);
      
      // Create and publish local tracks
      await createAndPublishLocalTracks();

      // Mark as joined
      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      // Start duration tracking
      startDurationTracking();
      
      // Update participant status
      await updateParticipantStatus({ status: 'joined' });

      // Start profile polling
      startProfilePolling();

      // Start message polling
      if (sessionData.session?.id) {
        startMessagePolling(sessionData.session.id);
      }

      console.log('🎉 STUDENT: Fully joined and ready');

    } catch (error) {
      console.error('❌ STUDENT Join channel error:', error);
      throw error;
    }
  };

  const createAndPublishLocalTracks = async () => {
    try {
      console.log('🎤 Creating local audio/video tracks...');

      // Detect available devices
      const deviceInfo = await detectAvailableDevices();

      let audioTrack = null;
      let videoTrack = null;

      // Only create audio if microphone exists
      if (deviceInfo.hasMicrophone) {
        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            encoderConfig: {
              sampleRate: 48000,
              stereo: false,
              bitrate: 48
            }
          });
          console.log('✅ Audio track created');
        } catch (audioError) {
          console.warn('⚠️ Audio track failed:', audioError.message);
        }
      }

      // Only create video if camera exists
      if (deviceInfo.hasCamera) {
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 15,
              bitrateMin: 400,
              bitrateMax: 1000
            },
            optimizationMode: 'detail'
          });
          console.log('✅ Video track created');
        } catch (videoError) {
          console.warn('⚠️ Video track failed:', videoError.message);
        }
      }

      // Store tracks locally
      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Update control state
      setControls(prev => ({
        ...prev,
        hasMicrophone: !!audioTrack,
        hasCamera: !!videoTrack,
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack
      }));

      // Publish available tracks
      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);

      if (tracksToPublish.length > 0 && clientRef.current) {
        await clientRef.current.publish(tracksToPublish);
        console.log(`📤 Published ${tracksToPublish.length} track(s) to channel`);
      }

      // Update participant status
      await updateParticipantStatus({
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack,
        devices: {
          hasMicrophone: !!audioTrack,
          hasCamera: !!videoTrack
        }
      });

    } catch (error) {
      console.error('❌ Track creation/publishing error:', error);
    }
  };

  const detectAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
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

  const setupAgoraEventListeners = (meetingId) => {
    const client = clientRef.current;
    if (!client) return;

    client.on('user-joined', async (user) => {
      const uid = String(user.uid);
      console.log('👤 USER JOINED:', { uid });
      
      // Initialize tracks map entry
      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(uid)) {
          newMap.set(uid, { audio: null, video: null });
        }
        return newMap;
      });
      
      // Fetch profile for this user
      if (meetingId) {
        await fetchProfilesByUids([uid], meetingId);
      }
      
      updateParticipantCount();
    });

    client.on('user-published', async (user, mediaType) => {
      const uid = String(user.uid);
      console.log('📡 USER PUBLISHED:', { uid, mediaType });
      
      try {
        await client.subscribe(user, mediaType);
        
        setRemoteTracks(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(uid) || { audio: null, video: null };
          
          if (mediaType === 'video') {
            existing.video = user.videoTrack;
          } else if (mediaType === 'audio') {
            existing.audio = user.audioTrack;
            user.audioTrack?.play();
          }
          
          newMap.set(uid, existing);
          return newMap;
        });
        
      } catch (error) {
        console.error('❌ Subscribe error:', error);
      }
      
      updateParticipantCount();
    });

    client.on('user-unpublished', (user, mediaType) => {
      const uid = String(user.uid);
      
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

    client.on('user-left', (user) => {
      const uid = String(user.uid);
      
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
      
      setUserProfiles(prev => {
        const updated = new Map(prev);
        updated.delete(uid);
        return updated;
      });
      
      updateParticipantCount();
    });

    client.on('connection-state-change', (curState) => {
      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        setSessionState(prev => ({
          ...prev,
          error: 'Connection lost. Trying to reconnect...'
        }));
      } else if (curState === 'CONNECTED') {
        setSessionState(prev => ({
          ...prev,
          error: null
        }));
      }
    });
  };

  const fetchProfilesByUids = async (uids, meetingId) => {
    try {
      if (!meetingId || !uids.length) return;
      
      const response = await studentvideoApi.getParticipantProfiles(
        meetingId,
        uids.map(uid => parseInt(uid, 10)).filter(uid => !isNaN(uid))
      );
      
      if (response.success && response.profiles) {
        setUserProfiles(prev => {
          const updated = new Map(prev);
          response.profiles.forEach(profile => {
            const uidString = String(profile.agora_uid);
            const isTeacher = profile.role === 'teacher' || profile.is_teacher;
            
            updated.set(uidString, {
              id: profile.user_id,
              agora_uid: profile.agora_uid,
              name: profile.name || profile.display_name || 'User',
              display_name: profile.display_name || profile.name || 'User',
              role: profile.role || (isTeacher ? 'teacher' : 'student'),
              is_teacher: isTeacher,
              avatar_url: profile.avatar_url
            });
            
            if (isTeacher) {
              setTeacherUid(uidString);
            }
          });
          return updated;
        });
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch profiles by UIDs:', error);
    }
  };

  const syncProfilesWithTracks = () => {
    const remoteUids = Array.from(remoteTracks.keys()).map(uid => String(uid));
    const profileUids = Array.from(userProfiles.keys());
    
    const missingUids = remoteUids.filter(uid => !profileUids.includes(uid));
    
    if (missingUids.length > 0 && sessionState.sessionInfo?.meetingId) {
      fetchProfilesByUids(missingUids, sessionState.sessionInfo.meetingId);
    }
  };

  const startProfilePolling = () => {
    if (profilePollingRef.current) {
      clearInterval(profilePollingRef.current);
    }
    
    profilePollingRef.current = setInterval(() => {
      if (sessionState.sessionInfo?.meetingId) {
        fetchAllProfiles(sessionState.sessionInfo.meetingId);
      }
    }, 15000); // Poll every 15 seconds
  };

  const fetchAllProfiles = async (meetingId) => {
    try {
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
      }
    } catch (error) {
      console.error('❌ Failed to fetch participants:', error);
    }
  };

  // ============================================
  // CONTROL FUNCTIONS
  // ============================================
  const toggleAudio = async () => {
    if (!localTracks.audio || !controls.hasMicrophone) {
      console.warn('⚠️ No audio track available');
      setControls(prev => ({ ...prev, audioEnabled: false }));
      return;
    }

    try {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      await updateParticipantStatus({ audioEnabled: newState });
    } catch (error) {
      console.error('❌ Toggle audio error:', error);
    }
  };

  const toggleVideo = async () => {
    if (!localTracks.video || !controls.hasCamera) {
      console.warn('⚠️ No video track available');
      setControls(prev => ({ ...prev, videoEnabled: false }));
      return;
    }

    try {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      await updateParticipantStatus({ videoEnabled: newState });
    } catch (error) {
      console.error('❌ Toggle video error:', error);
    }
  };

  const toggleHandRaise = async () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    if (sessionState.sessionInfo?.session?.id) {
      await studentvideoApi.sendMessage(
        sessionState.sessionInfo.session.id,
        studentId,
        newState ? '✋ Raised hand' : 'Lowered hand',
        'system'
      );
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

  // ============================================
  // CHAT FUNCTIONS
  // ============================================
  const startMessagePolling = (sessionId) => {
    loadMessages(sessionId);

    messagesPollIntervalRef.current = setInterval(() => {
      loadMessages(sessionId);
    }, 3000);
  };

  const loadMessages = async (sessionId) => {
    try {
      const messages = await studentvideoApi.getSessionMessages(sessionId);
      setChat(prev => ({
        ...prev,
        messages: messages.sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        )
      }));
      
      // Scroll to bottom
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const sendMessage = async () => {
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
      
      // Reload messages
      loadMessages(sessionState.sessionInfo.session.id);
    } catch (error) {
      console.error('Send message error:', error);
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

  const updateParticipantStatus = async (updates) => {
    try {
      if (!sessionState.sessionInfo?.session?.id) return;

      const statusUpdate = {
        ...updates,
        timestamp: new Date().toISOString(),
        student_id: studentId,
        session_id: sessionState.sessionInfo.session.id
      };

      await studentvideoApi.updateParticipantStatus(
        sessionState.sessionInfo.session.id,
        studentId,
        statusUpdate
      );

    } catch (error) {
      console.warn('⚠️ Participant status update error:', error.message);
    }
  };

  const leaveSession = async () => {
    try {
      setLoading(prev => ({ ...prev, isLeaving: true }));
      await updateParticipantStatus({ status: 'left' });
      await cleanup();
      setLoading(prev => ({ ...prev, isLeaving: false }));
      if (onLeaveCall) onLeaveCall();
    } catch (error) {
      console.error('Leave session error:', error);
      setLoading(prev => ({ ...prev, isLeaving: false }));
    }
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

  // ============================================
  // CLEANUP
  // ============================================
  const cleanup = async () => {
    console.log('🧹 Cleaning up student session...');
    
    // Clear intervals
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (messagesPollIntervalRef.current) clearInterval(messagesPollIntervalRef.current);
    if (profilePollingRef.current) clearInterval(profilePollingRef.current);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

    // Stop and close local tracks
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
          <button onClick={onLeaveCall} className="leave-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!sessionState.isJoined || loading.isConnecting) {
    return (
      <div className="video-call-loading">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{loading.isConnecting ? 'Connecting to class...' : 'Preparing session...'}</p>
        </div>
      </div>
    );
  }

  const { users: visibleUsers, totalPages, config } = getVisibleUsers;
  const currentPage = uiState.pagination.page;

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
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Layout Controls */}
        {totalPages > 1 && (
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
          </div>
        )}
        
        {/* Remote Videos Grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${config.gridCols}, 1fr)`,
          gap: '16px',
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
                border: uiState.activeSpeakerId === uid 
                  ? '2px solid #4f46e5' 
                  : isTeacher 
                    ? '2px solid #f59e0b' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                minHeight: config.compactView ? '120px' : '160px'
              }}
            >
              <RemoteVideoPlayer 
                uid={uid}
                tracks={tracks}
                profile={profile}
                isTeacher={isTeacher}
                compact={config.compactView}
              />
            </div>
          ))}
          
          {/* Empty State - Waiting for teacher */}
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
                👨‍🏫
              </div>
              <h3 style={{ color: 'white', marginBottom: '8px' }}>
                Waiting for teacher to start class...
              </h3>
              <p style={{ textAlign: 'center', maxWidth: '400px' }}>
                Your teacher will join the session shortly. Make sure your audio and video are working.
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Draggable Local Video Overlay */}
      {config.showLocalVideoOverlay && localTracks.video && (
        <DraggableLocalVideo
          localTracks={localTracks}
          controls={controls}
          isDragging={localVideoState.isDragging}
          position={localVideoState.position}
          onDragStart={handleLocalVideoDragStart}
          onDragEnd={handleLocalVideoDragEnd}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={uiState.isFullscreen}
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
          gap: '16px',
          alignItems: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          zIndex: 100,
          transition: 'opacity 0.3s'
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
            fontSize: '20px'
          }}
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
            fontSize: '20px'
          }}
        >
          {controls.videoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
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
            animation: controls.handRaised ? 'pulse 1.5s infinite' : 'none'
          }}
        >
          ✋
        </button>
        
        <div style={{ width: '1px', height: '30px', background: 'rgba(255, 255, 255, 0.1)' }} />
        
        <button 
          onClick={() => setUiState(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }))}
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
            fontSize: '20px'
          }}
        >
          <MessageCircle size={20} />
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
            cursor: 'pointer',
            fontSize: '20px',
            opacity: loading.isLeaving ? 0.7 : 1
          }}
        >
          <PhoneOff size={20} />
        </button>
      </div>
      
      {/* Chat Panel */}
      {uiState.isChatOpen && (
        <div style={{
          position: 'absolute',
          bottom: '120px',
          right: '20px',
          width: window.innerWidth < 640 ? 'calc(100vw - 40px)' : '300px',
          height: '400px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
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
                    textAlign: msg.sender_id === studentId ? 'right' : 'left'
                  }}
                >
                  {msg.sender_id !== studentId && (
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                      {msg.profiles?.display_name || 'User'}
                    </div>
                  )}
                  <div style={{
                    display: 'inline-block',
                    background: msg.sender_id === studentId 
                      ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' 
                      : '#1e293b',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    maxWidth: '80%',
                    wordBreak: 'break-word'
                  }}>
                    {msg.message_text}
                  </div>
                  <div style={{ 
                    color: '#64748b', 
                    fontSize: '11px', 
                    marginTop: '4px',
                    textAlign: msg.sender_id === studentId ? 'right' : 'left'
                  }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { 
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
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: chat.newMessage.trim() ? 1 : 0.5
              }}
            >
              <MessageSquare size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentVideoCall;