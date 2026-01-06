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
// RESPONSIVE REMOTE VIDEO PLAYER
// ============================================

const RemoteVideoPlayer = React.memo(({ user, isCompact = false, gridConfig }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [hasError, setHasError] = useState(false);

  // Play video when track is available

useEffect(() => {
  if (!videoRef.current || !user.videoTrack || hasError) return;

  const playVideo = async () => {
    try {
      // Stop if already playing
      if (user.videoTrack.isPlaying) {
        user.videoTrack.stop();
      }
      
      // ✅ MOBILE FIX: Play without options first
      try {
        await user.videoTrack.play(videoRef.current);
      } catch (firstError) {
        // ✅ Retry with explicit mobile-friendly config
        await user.videoTrack.play(videoRef.current, {
          fit: 'cover', // Changed from 'contain' for mobile
          mirror: false
        });
      }
      
      console.log(`✅ Video playing for user ${user.uid}`);
      setHasError(false);
    } catch (error) {
      console.error(`❌ Video play error for user ${user.uid}:`, error);
      
      // ✅ Try one more time after delay (mobile browser issue)
      setTimeout(async () => {
        try {
          await user.videoTrack.play(videoRef.current);
          console.log(`✅ Video playing on retry for user ${user.uid}`);
          setHasError(false);
        } catch (retryError) {
          console.error(`❌ Retry failed for user ${user.uid}:`, retryError);
          setHasError(true);
        }
      }, 1000);
    }
  };

  playVideo();

  return () => {
    if (user.videoTrack?.isPlaying) {
      try {
        user.videoTrack.stop();
      } catch (err) {
        console.warn('Error stopping video:', err);
      }
    }
  };
}, [user.videoTrack, user.uid]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current && user.videoTrack) {
        // Force video to recalculate dimensions
        user.videoTrack.setPlayerConfiguration?.({
          fit: 'contain'
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [user.videoTrack]);

  const getResponsiveStyles = () => {
    const screenWidth = window.innerWidth;
    
    if (screenWidth < 640) { // Mobile
      return {
        container: {
          minHeight: '120px',
          aspectRatio: '16/9'
        },
        avatarSize: '40px',
        fontSize: '12px'
      };
    } else if (screenWidth < 1024) { // Tablet
      return {
        container: {
          minHeight: '160px',
          aspectRatio: gridConfig?.compactView ? '16/9' : '4/3'
        },
        avatarSize: '48px',
        fontSize: '13px'
      };
    } else { // Desktop
      return {
        container: {
          minHeight: isCompact ? '140px' : '180px',
          aspectRatio: isCompact ? '16/9' : '4/3'
        },
        avatarSize: '56px',
        fontSize: '14px'
      };
    }
  };

  const styles = getResponsiveStyles();

  return (
    <div 
      ref={containerRef}
      className="remote-video-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a2e',
        borderRadius: '12px',
        overflow: 'hidden',
        ...styles.container,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        border: user.audioTrack ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      {/* Video Element */}
     <div 
  ref={videoRef} 
  style={{ 
    width: '100%', 
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000', 
    // ✅ MOBILE FIX: Ensure proper rendering
    WebkitTransform: 'translateZ(0)', 
    transform: 'translateZ(0)'
  }} 
/>
      
      {/* Fallback UI when no video */}
      {(!user.videoTrack || hasError) && (
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
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        }}>
          <div style={{
            width: styles.avatarSize,
            height: styles.avatarSize,
            borderRadius: '50%',
            background: user.audioTrack 
              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
              : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px',
            fontSize: '20px',
            color: 'white',
            boxShadow: user.audioTrack ? '0 0 15px rgba(34, 197, 94, 0.3)' : 'none'
          }}>
            {user.audioTrack ? '🎧' : '👤'}
          </div>
          <p style={{ 
            fontSize: styles.fontSize, 
            fontWeight: '500',
            color: user.audioTrack ? '#a5b4fc' : '#94a3b8',
            textAlign: 'center',
            margin: '4px 0'
          }}>
            Student {user.uid}
          </p>
          <p style={{ 
            fontSize: '11px', 
            color: '#64748b',
            textAlign: 'center'
          }}>
            {user.audioTrack ? 'Audio only' : 'Connecting...'}
          </p>
        </div>
      )}
      
      {/* Bottom Info Bar */}
      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '3px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '500',
          maxWidth: '70%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          Student {user.uid}
        </span>
        
        {/* Audio Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {user.audioTrack && (
            <>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                animation: 'pulse 2s infinite'
              }} />
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                animation: 'pulse 2s infinite 0.5s'
              }} />
              <span style={{
                width: '2px',
                height: '2px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                animation: 'pulse 2s infinite 1s'
              }} />
            </>
          )}
        </div>
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
    error: null,
     cameraWarning: null
  });

  const [mobileScreenShare, setMobileScreenShare] = useState({
  isAvailable: false,
  isActive: false,
  permissionGranted: false,
  isRequesting: false
});

  const [participantSync, setParticipantSync] = useState({
  lastSync: 0,
  syncing: false
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
    audioOnlyMode: false,
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

  // ✅ MOBILE DETECTION
const isMobile = useMemo(() => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}, []);

// ✅ MOBILE-SPECIFIC EFFECT: Handle screen wake lock
useEffect(() => {
  if (!isMobile || !sessionState.isJoined) return;
  
  let wakeLock = null;
  
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('✅ Screen wake lock active');
      }
    } catch (err) {
      console.warn('Wake lock failed:', err);
    }
  };
  
  requestWakeLock();
  
  // Re-request on visibility change
  const handleVisibilityChange = () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (wakeLock !== null) {
      wakeLock.release();
    }
  };
}, [isMobile, sessionState.isJoined]);
  
  // ============================================
  // RESPONSIVE CALCULATIONS
  // ============================================
  


const calculateGridConfig = useCallback(() => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const remoteCount = remoteUsers.size;
  
  // Mobile phones
  if (screenWidth < 640) {
    return {
      maxVisible: 4,
      gridCols: remoteCount === 1 ? 1 : 2, // Single user gets full width
      compactView: true,
      gridGap: '8px'
    };
  } 
  // Tablets
  else if (screenWidth < 1024) {
    const cols = remoteCount <= 2 ? 2 : 3;
    return {
      maxVisible: 6,
      gridCols: cols,
      compactView: false,
      gridGap: '12px'
    };
  } 
  // Desktop
  else {
    // Dynamic columns based on participant count
    let gridCols;
    if (remoteCount <= 1) gridCols = 1;
    else if (remoteCount <= 4) gridCols = 2;
    else if (remoteCount <= 9) gridCols = 3;
    else gridCols = 4;
    
    return {
      maxVisible: uiState.layoutMode === 'grid' ? 12 : 9,
      gridCols,
      compactView: false,
      gridGap: '16px'
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
  // Check if screen sharing is available on this device/browser
  const checkScreenShareSupport = async () => {
    if (!isMobile) return;
    
    try {
      // Different mobile browsers have different APIs
      const hasGetDisplayMedia = 
        navigator.mediaDevices && 
        'getDisplayMedia' in navigator.mediaDevices;
      
      const hasUserMedia =
        navigator.mediaDevices &&
        'getUserMedia' in navigator.mediaDevices;
      
      // iOS Safari workaround
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = /Chrome/.test(navigator.userAgent);
      
      setMobileScreenShare(prev => ({
        ...prev,
        isAvailable: hasGetDisplayMedia || (isIOS && isChrome),
        supportedBrowser: isChrome ? 'Chrome' : 
                         isIOS ? 'Safari' : 
                         'Unknown'
      }));
    } catch (error) {
      console.warn('Screen share check failed:', error);
    }
  };
  
  checkScreenShareSupport();
}, [isMobile]);


useEffect(() => {
  if (!sessionState.isJoined || !sessionState.sessionInfo?.meetingId) return;
  
  const syncParticipants = async () => {
    const now = Date.now();
    if (now - participantSync.lastSync < 10000 || participantSync.syncing) return; 
    
    try {
      setParticipantSync(prev => ({ ...prev, syncing: true }));
      
      // Get current participants from backend
      const response = await videoApi.getSessionParticipants(
        sessionState.sessionInfo.meetingId
      );
      
      if (response.success && response.participants) {
        // Get student participants (excluding teacher)
        const studentParticipants = response.participants.filter(p => 
          p.user_id !== teacherId && p.role === 'student'
        );
        
        console.log('🔄 Synced participants from backend:', {
          total: response.participants.length,
          students: studentParticipants.length,
          studentsList: studentParticipants.map(p => p.user_id)
        });
        
        // Note: Participants will appear automatically when they publish tracks
        // This just ensures we know who should be there
      }
      
      setParticipantSync(prev => ({ 
        ...prev, 
        lastSync: now,
        syncing: false 
      }));
      
    } catch (error) {
      console.warn('Participant sync failed:', error);
      setParticipantSync(prev => ({ ...prev, syncing: false }));
    }
  };
  
  // Initial sync
  syncParticipants();
  
  // Sync every 30 seconds
  const interval = setInterval(syncParticipants, 30000);
  
  return () => clearInterval(interval);
}, [sessionState.isJoined, sessionState.sessionInfo?.meetingId, teacherId]);
  
// Call this periodically
useEffect(() => {
  if (sessionState.isJoined) {
    const interval = setInterval(optimizeVideoQuality, 10000);
    return () => clearInterval(interval);
  }
}, [sessionState.isJoined, localTracks.video]);


// ✅ Check camera/mic permissions early (non-blocking)
useEffect(() => {
  const checkPermissions = async () => {
    try {
      // Try to get both video and audio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Stop immediately
      stream.getTracks().forEach(track => track.stop());
      
      console.log('✅ Camera and mic permissions granted');
    } catch (error) {
      console.warn('⚠️ Permission check failed:', error);
      
      // ✅ Try audio-only as fallback
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: true 
        });
        audioStream.getTracks().forEach(track => track.stop());
        console.log('✅ Microphone permission granted (camera unavailable)');
      } catch (audioError) {
        console.error('❌ No media permissions available:', audioError);
        // Only show error if BOTH fail
        if (audioError.name === 'NotAllowedError') {
          setSessionState(prev => ({
            ...prev,
            error: 'Microphone permission denied. Please allow microphone access to join the call.'
          }));
        }
      }
    }
  };
  
  checkPermissions();
}, []);

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
  
  // ✅ Watch for local video track changes and play it
useEffect(() => {
  const playLocalVideo = async () => {
    if (localTracks.video && localVideoRef.current) {
      try {
        // Stop any existing playback first
        if (localTracks.video.isPlaying) {
          localTracks.video.stop();
        }
        
        // Play the video track
        await localTracks.video.play(localVideoRef.current);
        localVideoRef.current.style.transform = 'scaleX(-1)';
        console.log('✅ Local video played in useEffect');
      } catch (error) {
        console.error('❌ Failed to play local video in useEffect:', error);
      }
    }
  };
  
  playLocalVideo();
}, [localTracks.video]);

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
    
    // ✅ Check if we already have session info (rejoining case)
    let sessionData = sessionState.sessionInfo;
    
    if (!sessionData || !sessionData.token) {
      console.log('🆕 Starting NEW session...');
      
      // Create new Agora client
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: isMobile ? 'h264' : 'vp8'  
      });
      
      // Get fresh session data from backend
      sessionData = await videoApi.startVideoSession(classId, teacherId);
      
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
    } else {
      console.log('🔄 REJOINING existing session...');
      
      // ✅ Create a NEW client for rejoin
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: isMobile ? 'h264' : 'vp8'
      });
      
      setSessionState(prev => ({
        ...prev,
        isInitialized: true,
        isJoined: false,
        error: null
      }));
    }
    
    // Join channel (works for both new and rejoin)
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
    
    console.log('🔗 Joining channel...', { channel, uid });
    
    // ✅ Join channel FIRST
    const assignedUid = await clientRef.current.join(
      appId,
      channel,
      token,
      uid || null
    );
    
    console.log('✅ Teacher joined channel:', { 
      channel, 
      assignedUid,
      isRejoin: !!sessionState.sessionInfo,
      timestamp: new Date().toISOString()
    });
    
    // ✅ Create and publish tracks SECOND (this publishes to the channel you just joined)
    await createAndPublishTracks();
    
    // ✅ Update state THIRD
    setSessionState(prev => ({ ...prev, isJoined: true }));
    
    // ✅ Setup event listeners FOURTH
    setupAgoraEventListeners();
    
    // ✅ Start tracking FIFTH
    startDurationTracking();
    
    // ✅ Resubscribe to existing users LAST (after 2 seconds)
    setTimeout(async () => {
      await forceResubscribeToAllUsers();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Join channel error:', error);
    throw error;
  }
};

const forceResubscribeToAllUsers = async () => {
  try {
    console.log('🔄 Force resubscribing to all users in channel...');
    
    const client = clientRef.current;
    if (!client) {
      console.warn('⚠️ No client available for resubscribe');
      return;
    }
    
    // Get ALL remote users currently in the channel
    const remoteUsersList = client.remoteUsers || [];
    console.log(`👥 Found ${remoteUsersList.length} remote users in channel`);
    
    if (remoteUsersList.length === 0) {
      console.log('ℹ️ No remote users to subscribe to yet');
      return;
    }
    
    // Subscribe to each user's tracks
    for (const user of remoteUsersList) {
      console.log(`🔌 Processing user ${user.uid}:`, {
        hasAudio: user.hasAudio,
        hasVideo: user.hasVideo
      });
      
      try {
        // Subscribe to audio if published
        if (user.hasAudio && !user.audioTrack) {
          await client.subscribe(user, 'audio');
          console.log(`✅ Subscribed to AUDIO from user ${user.uid}`);
          
          // Auto-play audio
          if (user.audioTrack) {
            user.audioTrack.play().catch(err => 
              console.warn(`Audio play error for ${user.uid}:`, err)
            );
          }
        }
        
        // Subscribe to video if published
        if (user.hasVideo && !user.videoTrack) {
          await client.subscribe(user, 'video');
          console.log(`✅ Subscribed to VIDEO from user ${user.uid}`);
        }
        
        // ✅ Add user to remoteUsers Map
        setRemoteUsers(prev => {
          const updated = new Map(prev);
          updated.set(user.uid, {
            uid: user.uid,
            videoTrack: user.videoTrack,
            audioTrack: user.audioTrack
          });
          return updated;
        });
        
      } catch (error) {
        console.error(`❌ Failed to subscribe to user ${user.uid}:`, error);
      }
    }
    
    // Force UI refresh after 500ms
    setTimeout(() => {
      setRemoteUsers(prev => new Map(prev));
      updateParticipantCount();
      console.log('✅ Force resubscribe complete. Remote users count:', remoteUsersList.length);
    }, 500);
    
  } catch (error) {
    console.error('❌ Force resubscribe error:', error);
  }
};

const syncExistingParticipants = async () => {
  if (!sessionState.sessionInfo?.meetingId || !teacherId) return;
  
  try {
    console.log('🔄 Syncing existing participants...');
    const response = await videoApi.syncParticipants(
      sessionState.sessionInfo.meetingId, 
      teacherId
    );
    
    if (response.success && response.participants_synced > 0) {
      console.log('✅ Synced existing participants:', {
        count: response.participants_synced,
        participants: response.participants.map(p => p.user_id)
      });
      
      // Force a UI refresh to show synced participants
      setTimeout(() => {
        setRemoteUsers(prev => new Map(prev));
      }, 1000);
    }
  } catch (error) {
    console.warn('⚠️ Participant sync failed (non-critical):', error);
  }
};

// Callafter successful join
useEffect(() => {
  if (sessionState.isJoined && sessionState.sessionInfo?.meetingId) {
    // Wait 3 seconds for Agora connection to stabilize
    const timeout = setTimeout(() => {
      syncExistingParticipants();
    }, 3000);
    
    return () => clearTimeout(timeout);
  }
}, [sessionState.isJoined]);
 
// ✅ MOBILE FIX: Touch to activate video playback
useEffect(() => {
  if (!isMobile) return;
  
  const handleTouch = () => {
    // Force play all remote videos on touch (mobile autoplay fix)
    remoteUsers.forEach((user) => {
      if (user.videoTrack && !user.videoTrack.isPlaying) {
        user.videoTrack.play().catch(err => 
          console.warn('Touch play failed:', err)
        );
      }
    });
    
    // Force play local video
    if (localTracks.video && !localTracks.video.isPlaying && localVideoRef.current) {
      localTracks.video.play(localVideoRef.current).catch(err =>
        console.warn('Local touch play failed:', err)
      );
    }
  };
  
  document.addEventListener('touchstart', handleTouch, { once: true });
  
  return () => {
    document.removeEventListener('touchstart', handleTouch);
  };
}, [isMobile, remoteUsers, localTracks.video]); 

const optimizeVideoQuality = () => {
  if (!clientRef.current) return;
  
  // Get network quality
  const quality = clientRef.current.getNetworkQuality();
  
  // Adjust video quality based on network
  if (localTracks.video) {
    let encoderConfig;
    
    if (quality.uplinkNetworkQuality >= 4) { // Excellent
      encoderConfig = '1080p_3'; // High quality
    } else if (quality.uplinkNetworkQuality >= 2) { // Good
      encoderConfig = '720p_3'; // Medium quality
    } else { // Poor
      encoderConfig = '480p_3'; // Low quality
    }
    
    try {
      localTracks.video.setEncoderConfiguration(encoderConfig);
      console.log(`🎥 Video quality set to: ${encoderConfig}`);
    } catch (error) {
      console.warn('Cannot adjust video quality:', error);
    }
  }
};
const showCameraWarning = (error) => {
  let message = 'Joining with audio only.';
  
  if (error.code === 'PERMISSION_DENIED') {
    message = 'Camera access denied. You can still teach with audio only. Enable camera in browser settings to share video.';
  } else if (error.code === 'DEVICE_NOT_FOUND') {
    message = 'No camera detected. You can still teach with audio only.';
  } else {
    message = 'Camera unavailable. You can still teach with audio only.';
  }
  
  // ✅ Store warning in state to show in UI
  setSessionState(prev => ({
    ...prev,
    cameraWarning: message
  }));
  
  // ✅ Auto-dismiss after 10 seconds
  setTimeout(() => {
    setSessionState(prev => ({
      ...prev,
      cameraWarning: null
    }));
  }, 10000);
};

const createAndPublishTracks = useCallback(async () => {
  try {
    console.log('🎥 Creating audio/video tracks...');
    
    let audioTrack = null;
    let videoTrack = null;
    let hasCameraError = false;
    
    // ✅ MOBILE FIX: Add constraints for mobile compatibility
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Create audio track
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: isMobile ? 'speech_standard' : 'music_standard',
        AEC: true, // ✅ Echo cancellation for mobile
        ANS: true, // ✅ Noise suppression for mobile
        AGC: true  // ✅ Auto gain control for mobile
      });
      console.log('✅ Audio track created');
    } catch (audioError) {
      console.error('❌ Failed to create audio track:', audioError);
    }
    
    // Create video track with mobile-optimized settings
    try {
      const videoConfig = isMobile 
        ? {
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 15, // ✅ Lower frame rate for mobile
              bitrateMax: 600, // ✅ Lower bitrate for mobile
              bitrateMin: 300
            },
            optimizationMode: 'detail' // ✅ Better for mobile
          }
        : {
            encoderConfig: '720p_3'
          };
      
      videoTrack = await AgoraRTC.createCameraVideoTrack(videoConfig);
      console.log('✅ Video track created');
    } catch (videoError) {
      console.error('❌ Failed to create video track:', videoError);
      hasCameraError = true;
      showCameraWarning(videoError);
    }
    
    // Update state with tracks
    setLocalTracks({ audio: audioTrack, video: videoTrack });
    
    // ✅ MOBILE FIX: Wait a bit before playing on mobile
    if (isMobile) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Play local video
    if (videoTrack && localVideoRef.current) {
      try {
        await videoTrack.play(localVideoRef.current);
        localVideoRef.current.style.transform = 'scaleX(-1)';
        console.log('✅ Local video playing');
      } catch (playError) {
        console.error('❌ Failed to play local video:', playError);
        
        // ✅ Retry for mobile
        if (isMobile) {
          setTimeout(async () => {
            try {
              await videoTrack.play(localVideoRef.current);
              localVideoRef.current.style.transform = 'scaleX(-1)';
              console.log('✅ Local video playing on retry');
            } catch (retryError) {
              console.error('❌ Retry failed:', retryError);
            }
          }, 1000);
        }
      }
    }
    
    // Publish tracks
    const tracksToPublish = [];
    if (audioTrack) tracksToPublish.push(audioTrack);
    if (videoTrack) tracksToPublish.push(videoTrack);
    
    if (tracksToPublish.length > 0) {
      await clientRef.current.publish(tracksToPublish);
      console.log(`✅ Published ${tracksToPublish.length} track(s)`);
    }
    
    // Update controls
    setControls(prev => ({
      ...prev,
      audioEnabled: !!audioTrack,
      videoEnabled: !!videoTrack
    }));
    
    if (hasCameraError) {
      setUiState(prev => ({ ...prev, audioOnlyMode: true }));
    }
    
  } catch (error) {
    console.error('❌ Error in createAndPublishTracks:', error);
    if (!localTracks.audio && !localTracks.video) {
      setSessionState(prev => ({
        ...prev,
        error: `Failed to initialize media: ${error.message}`
      }));
    }
  }
}, [localTracks.audio, localTracks.video, showCameraWarning]);
  
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
const resubscribeToAllUsers = async () => {
  try {
    console.log('🔄 Attempting to resubscribe to all users...');
    
    const client = clientRef.current;
    if (!client) return;
    
    const remoteUsersList = client.remoteUsers || [];
    console.log('👥 Found remote users in client:', remoteUsersList.length);
    
    for (const user of remoteUsersList) {
      try {
        // Subscribe to audio if available
        if (user.hasAudio) {
          await client.subscribe(user, 'audio');
          console.log('✅ Resubscribed to audio for user:', user.uid);
        }
        
        // Subscribe to video if available
        if (user.hasVideo) {
          await client.subscribe(user, 'video');
          console.log('✅ Resubscribed to video for user:', user.uid);
        }
      } catch (error) {
        console.warn(`⚠️ Could not resubscribe to user ${user.uid}:`, error);
      }
    }
    
    // Force UI update
    setTimeout(() => {
      setRemoteUsers(prev => {
        const updated = new Map(prev);
        console.log('🔄 Forcing UI refresh for remote users');
        return new Map(updated); // Create new Map to trigger re-render
      });
    }, 1000);
    
  } catch (error) {
    console.error('Resubscribe error:', error);
  }
};

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;
    if (!client) return;
    
   client.on('user-published', async (user, mediaType) => {
  try {
    console.log(`📢 User ${user.uid} published ${mediaType}`);
    
    // Subscribe to the media
    await client.subscribe(user, mediaType);
    console.log(`✅ Subscribed to ${mediaType} from user ${user.uid}`);
    
    // Update remote users map
    setRemoteUsers(prev => {
      const updated = new Map(prev);
      const existing = updated.get(user.uid) || { uid: user.uid };
      
      if (mediaType === 'video') {
        existing.videoTrack = user.videoTrack;
      }
      if (mediaType === 'audio') {
        existing.audioTrack = user.audioTrack;
      }
      
      updated.set(user.uid, existing);
      console.log(`📊 Remote users updated. Total: ${updated.size}`);
      return updated;
    });
    
    // Auto-play audio
    if (mediaType === 'audio' && user.audioTrack) {
      user.audioTrack.play().catch(err => 
        console.warn(`Audio play error for ${user.uid}:`, err)
      );
    }
    
    updateParticipantCount();
    
    // Set as active speaker if first user
    if (remoteUsers.size === 0) {
      setUiState(prev => ({ ...prev, activeSpeakerId: user.uid }));
    }
    
  } catch (error) {
    console.error(`❌ Subscribe error for user ${user.uid}:`, error);
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
  // ✅ Check if we even have a video track
  if (!localTracks.video) {
    console.warn('⚠️ No video track available');
    // Try to create one
    try {
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: '720p_3',
      });
      
      // Publish new track
      await clientRef.current.publish([videoTrack]);
      
      // Play locally
      if (localVideoRef.current) {
        await videoTrack.play(localVideoRef.current);
        localVideoRef.current.style.transform = 'scaleX(-1)';
      }
      
      setLocalTracks(prev => ({ ...prev, video: videoTrack }));
      setControls(prev => ({ ...prev, videoEnabled: true }));
      setUiState(prev => ({ ...prev, audioOnlyMode: false }));
      
      console.log('✅ Camera enabled successfully');
    } catch (error) {
      console.error('❌ Cannot enable camera:', error);
      alert('Camera not available. Please check your device and permissions.');
    }
    return;
  }
  
  try {
    const newState = !controls.videoEnabled;
    await localTracks.video.setEnabled(newState);
    
    // Ensure video is playing when enabled
    if (newState && localVideoRef.current) {
      if (!localTracks.video.isPlaying) {
        await localTracks.video.play(localVideoRef.current);
      }
    }
    
    setControls(prev => ({ ...prev, videoEnabled: newState }));
    console.log(`✅ Video ${newState ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('❌ Toggle video error:', error);
  }
};
  
// Helper function must be defined BEFORE toggleScreenShare
const stopScreenShareAndRestoreCamera = async () => {
  try {
    const screenTrack = localTracks.video;
    
    // Unpublish screen track
    if (screenTrack) {
      await clientRef.current.unpublish([screenTrack]);
      screenTrack.stop();
      console.log('✅ Screen track stopped');
    }
    
    // Restore camera track
    const cameraTrack = await AgoraRTC.createCameraVideoTrack();
    await clientRef.current.publish([cameraTrack]);
    
    // Play camera locally
    if (localVideoRef.current) {
      await cameraTrack.play(localVideoRef.current);
      localVideoRef.current.style.transform = 'scaleX(-1)'; // Mirror camera
    }
    
    // Update state
    setLocalTracks(prev => ({ ...prev, video: cameraTrack }));
    setControls(prev => ({ 
      ...prev, 
      screenSharing: false,
      videoEnabled: true 
    }));
    
  } catch (error) {
    console.error('❌ Error restoring camera:', error);
    // Fallback: try to re-join or refresh connection
    alert('Error switching back to camera. Please refresh the page if issues persist.');
  }
};

const toggleScreenShare = async () => {
  // Device detection
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isAndroidChrome = /Android.*Chrome\//i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
  
  // Platform-specific handling
  if (isIOS && isSafari) {
    alert('iOS Safari: Please use "Share" button in Safari menu (not supported programmatically)');
    return;
  }
  
  if (isAndroidChrome) {
    // Check Chrome version (screen sharing requires Chrome 81+)
    const chromeVersion = userAgent.match(/Chrome\/(\d+)/);
    if (chromeVersion && parseInt(chromeVersion[1]) < 81) {
      alert('Android Chrome 81+ required for screen sharing. Please update your browser.');
      return;
    }
    
    // Check if extension might be needed
    const hasExtension = await checkForScreenShareExtension();
    if (!hasExtension) {
      if (confirm('For better screen sharing on Android, install the Agora extension? (Recommended)')) {
        window.open('https://chrome.google.com/webstore/detail/agora-web-extension/minllpmhdgpndnkomcoccfekfegnlikg', '_blank');
      }
    }
  }
  
  try {
    if (!controls.screenSharing) {
      // ========== START SCREEN SHARING ==========
      console.log('🖥️ Starting screen share...');
      
      let screenTrack;
      try {
        const screenConfig = {
          encoderConfig: isMobile ? '720p_1' : '1080p_1', // Lower for mobile
          optimizationMode: 'detail',
          // Platform-specific configurations
          screenSourceType: ['screen', 'window', 'browser'],
        };
        
        // Add extension for desktop Chrome (optional)
        if (!isMobile && userAgent.includes('Chrome')) {
          screenConfig.extensionId = 'minllpmhdgpndnkomcoccfekfegnlikg';
        }
        
        // For Safari, use different API
        if (isSafari) {
          delete screenConfig.extensionId;
          delete screenConfig.screenSourceType;
        }
        
        screenTrack = await AgoraRTC.createScreenVideoTrack(screenConfig);
      } catch (screenError) {
        console.error('❌ Screen share creation failed:', screenError);
        
        // Handle specific error cases
        if (screenError.code === 'PERMISSION_DENIED' || 
            screenError.message?.includes('cancel') ||
            screenError.message?.includes('permission')) {
          console.log('ℹ️ Screen share cancelled or permission denied');
          
          if (isMobile) {
            alert('Please allow screen sharing permission in browser settings');
          }
          return;
        }
        
        if (screenError.name === 'NotSupportedError' || 
            screenError.message?.includes('not supported')) {
          const errorMsg = isMobile 
            ? 'Screen sharing not supported on this device. Try Chrome on Android or Safari on iOS.'
            : 'Your browser does not support screen sharing. Try Chrome, Firefox, or Edge.';
          alert(errorMsg);
          return;
        }
        
        alert('Screen sharing failed. Please try again.');
        return;
      }
      
      // Store original camera track
      const originalCameraTrack = localTracks.video;
      
      // Unpublish camera if it exists
      if (originalCameraTrack) {
        try {
          await clientRef.current.unpublish([originalCameraTrack]);
          originalCameraTrack.stop();
          console.log('✅ Camera unpublished');
        } catch (err) {
          console.warn('⚠️ Error unpublishing camera:', err);
        }
      }
      
      // Publish screen track with retry logic
      try {
        await clientRef.current.publish([screenTrack]);
        console.log('✅ Screen track published');
      } catch (publishError) {
        console.error('❌ Failed to publish screen:', publishError);
        
        // Restore camera on publish failure
        if (originalCameraTrack) {
          await clientRef.current.publish([originalCameraTrack]);
          setLocalTracks(prev => ({ ...prev, video: originalCameraTrack }));
        }
        
        alert('Failed to share screen. Please try again.');
        return;
      }
      
      // ✅ CRITICAL: Play screen track locally so teacher can see it
      if (localVideoRef.current) {
        try {
          await screenTrack.play(localVideoRef.current);
          // Don't mirror screen share
          localVideoRef.current.style.transform = 'scaleX(1)';
          localVideoRef.current.style.objectFit = 'contain'; // Better for screen content
          console.log('✅ Screen track playing locally');
        } catch (playError) {
          console.warn('⚠️ Could not play screen locally:', playError);
        }
      }
      
      // Update state
      setLocalTracks(prev => ({ ...prev, video: screenTrack }));
      setControls(prev => ({ 
        ...prev, 
        screenSharing: true,
        videoEnabled: false // Camera is off during screen share
      }));
      
      // ✅ CRITICAL: Listen for when user stops sharing via browser UI
      screenTrack.on('track-ended', async () => {
        console.log('🛑 Screen share ended by user (browser button)');
        await stopScreenShareAndRestoreCamera();
      });
      
      // Additional cleanup on component unmount
      const cleanup = () => {
        if (screenTrack) {
          screenTrack.close();
        }
      };
      
      // Store cleanup reference
      screenShareCleanupRef.current = cleanup;
      
      console.log('✅ Screen sharing started successfully');
      
    } else {
      // ========== STOP SCREEN SHARING ==========
      await stopScreenShareAndRestoreCamera();
    }
    
  } catch (error) {
    console.error('❌ Screen share error:', error);
    setControls(prev => ({ ...prev, screenSharing: false }));
    
    // User-friendly error messages
    const errorMsg = isMobile 
      ? 'Screen sharing error. Please ensure you have the latest browser version.'
      : 'Screen sharing encountered an error. Please try again.';
    
    alert(errorMsg);
  }
};

// Helper function to check for extension (simplified)
const checkForScreenShareExtension = async () => {
  return new Promise((resolve) => {
    // This is a simplified check - implement based on your needs
    setTimeout(() => resolve(false), 100);
  });
};

// Add this ref in your component
const screenShareCleanupRef = useRef(null);

// Cleanup on component unmount
useEffect(() => {
  return () => {
    if (screenShareCleanupRef.current) {
      screenShareCleanupRef.current();
    }
  };
}, []);

  
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
    try {
      await clientRef.current?.unpublish([localTracks.audio]);
      localTracks.audio.stop();
      localTracks.audio.close();
    } catch (err) {
      console.warn('Audio cleanup error:', err);
    }
  }
  
  if (localTracks.video) {
    try {
      await clientRef.current?.unpublish([localTracks.video]);
      localTracks.video.stop();
      localTracks.video.close();
    } catch (err) {
      console.warn('Video cleanup error:', err);
    }
  }
  
  // Leave channel
  if (clientRef.current) {
    try {
      await clientRef.current.leave();
    } catch (err) {
      console.warn('Leave channel error:', err);
    }
  }
  
  // Reset state BUT PRESERVE sessionInfo for rejoin
  setLocalTracks({ audio: null, video: null });
  setRemoteUsers(new Map()); // ✅ Clear remote users
  
  // ✅ DON'T reset sessionInfo - keep it for rejoin
  setSessionState(prev => ({
    ...prev,
    isJoined: false,
    isInitialized: false
    // Keep sessionInfo!
  }));
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

{/*  Responsive Students Grid */}
<div style={{
  flex: 1,
  display: 'grid',
  gridTemplateColumns: `repeat(${config.gridCols}, 1fr)`,
  gridAutoRows: 'minmax(140px, 1fr)', // Better row sizing
  gap: '12px',
  overflowY: 'auto',
  padding: '8px',
  alignContent: 'start'
}}>
  {visibleUsers.map(user => (
    <div 
      key={user.uid}
      className="student-video-container"
      style={{
        position: 'relative',
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        overflow: 'hidden',
        border: uiState.activeSpeakerId === user.uid 
          ? '2px solid #4f46e5' 
          : '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'all 0.2s ease',
        // Responsive constraints
        minHeight: config.compactView ? '120px' : '160px',
        maxHeight: config.compactView ? '200px' : '240px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <RemoteVideoPlayer 
        user={user} 
        isCompact={config.compactView}
        gridConfig={config}
      />
    </div>
  ))}
  
  {/* Empty State with better responsiveness */}
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
      <div style={{ 
        fontSize: window.innerWidth < 768 ? '56px' : '72px',
        marginBottom: '16px', 
        opacity: 0.5,
        animation: 'pulse 3s infinite'
      }}>
        👥
      </div>
      <h3 style={{ 
        color: 'white', 
        marginBottom: '8px',
        fontSize: window.innerWidth < 768 ? '18px' : '24px'
      }}>
        Waiting for students to join...
      </h3>
      <p style={{ 
        textAlign: 'center', 
        maxWidth: window.innerWidth < 768 ? '300px' : '500px',
        fontSize: window.innerWidth < 768 ? '14px' : '16px',
        lineHeight: '1.5',
        color: '#94a3b8'
      }}>
        Share the meeting link with your students. They will appear here automatically when they join.
      </p>
      <div style={{
        marginTop: '20px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        padding: '12px 20px',
        background: 'rgba(79, 70, 229, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(79, 70, 229, 0.3)'
      }}>
        <span style={{ color: '#a5b4fc', fontSize: '14px' }}>
          📋 Meeting ID: <strong>{sessionState.sessionInfo?.meetingId || 'Loading...'}</strong>
        </span>
      </div>
    </div>
  )}
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
     {/* Local Video (Teacher) - Bottom Right */}
<div style={{
  position: 'absolute',
  bottom: '100px',
  right: '20px',
  width: '240px',
  height: '180px',
  background: '#1a1a2e',
  borderRadius: '12px',
  overflow: 'hidden',
  border: '2px solid rgba(79, 70, 229, 0.5)',
  zIndex: 50,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  transition: 'transform 0.3s'
}}>
  {/* ✅ Show video if available */}

{localTracks.video && (
  <video
    ref={(el) => {
      localVideoRef.current = el;
      if (el && localTracks.video && !localTracks.video.isPlaying) {
        // ✅ MOBILE FIX: Play immediately when ref is attached
        const playMobileVideo = async () => {
          try {
            await localTracks.video.play(el);
            el.style.transform = 'scaleX(-1)';
            console.log('✅ Local video playing from ref callback');
          } catch (err) {
            console.error('❌ Local video play error:', err);
            // ✅ Retry after delay for mobile
            setTimeout(async () => {
              try {
                await localTracks.video.play(el);
                el.style.transform = 'scaleX(-1)';
              } catch (retryErr) {
                console.error('❌ Local video retry failed:', retryErr);
              }
            }, 500);
          }
        };
        playMobileVideo();
      }
    }}
    autoPlay
    playsInline
    muted
    webkit-playsinline="true" // ✅ iOS specific
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: 'scaleX(-1)',
      display: controls.videoEnabled ? 'block' : 'none',
      backgroundColor: '#000',
      // ✅ MOBILE FIX: Hardware acceleration
      WebkitTransform: 'translateZ(0) scaleX(-1)',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden'
    }}
  />
)}
  
  {/* ✅ Show audio-only indicator when no camera */}
  {(!localTracks.video || !controls.videoEnabled) && (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: controls.audioEnabled 
          ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
          : '#374151',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        boxShadow: controls.audioEnabled 
          ? '0 0 20px rgba(79, 70, 229, 0.5)' 
          : 'none'
      }}>
        {controls.audioEnabled ? '🎤' : '🔇'}
      </div>
      <span style={{ 
        color: 'white', 
        fontSize: '14px',
        fontWeight: '500'
      }}>
        {!localTracks.video ? 'Audio Only' : 'Camera Off'}
      </span>
      {!localTracks.video && (
        <span style={{ 
          color: '#94a3b8', 
          fontSize: '11px',
          textAlign: 'center',
          padding: '0 12px'
        }}>
          No camera detected
        </span>
      )}
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
      You {!localTracks.video && '(Audio)'}
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
  title={
    !localTracks.video 
      ? 'Camera not available' 
      : controls.videoEnabled 
        ? 'Turn off camera' 
        : 'Turn on camera'
  }
  disabled={!localTracks.video && !navigator.mediaDevices} // ✅ Disable if no camera possible
>
  <span className="orb-icon">
    {controls.videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
  </span>
  {/* ✅ Show indicator if no camera at all */}
  {!localTracks.video && (
    <span style={{
      position: 'absolute',
      top: '-4px',
      right: '-4px',
      width: '12px',
      height: '12px',
      background: '#f59e0b',
      borderRadius: '50%',
      border: '2px solid #0f172a'
    }} />
  )}
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