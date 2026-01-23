import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './TeacherVideoCall.css';
import videoApi from '../lib/agora/videoApi';
import {
  Mic, MicOff,
  Video, VideoOff,
  Share2, X,
  Circle,
  MessageCircle, Users,
  LogOut, PhoneOff,
  Send, MessageSquare,
  Maximize2, Minimize2,
  ChevronLeft, ChevronRight,
  Volume2, VolumeX
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// ────────────────────────────────────────────────────────────────
// Platform detection helper
// ────────────────────────────────────────────────────────────────
const AgoraScreenShare = registerPlugin('AgoraScreenShare');
const isNative = Capacitor.isNativePlatform();
const isAndroid = Capacitor.getPlatform() === 'android';
const isWeb = Capacitor.getPlatform() === 'web';

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
const requestNativePermissions = async () => {
  // Use the isNative constant defined at the top of your file
  if (isNative) {
    try {
      console.log("🔍 [Native] Checking hardware permissions...");

      // 1. WEBVIEW WARM-UP
      // This triggers the browser-layer permission within the Android WebView.
      // We wrap it in a short timeout so it doesn't hang the thread.
      const canAccess = await Promise.race([
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(() => true)
          .catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 2000))
      ]);

      if (canAccess) {
        console.log("✅ [Native] Hardware already accessible via WebView");
        return { success: true };
      }

      // 2. NATIVE BRIDGE FALLBACK
      // If the WebView doesn't have it, we try to call the Capacitor Bridge.
      // We check if 'Permissions' exists to avoid the "reading requestPermissions of undefined" error.
      if (Capacitor.Permissions && typeof Capacitor.Permissions.requestPermissions === 'function') {
        const result = await Capacitor.Permissions.requestPermissions({ 
          permissions: ['camera', 'microphone'] 
        });
        
        const granted = result.camera === 'granted' && result.microphone === 'granted';
        console.log(granted ? "✅ [Native] Permissions granted via Bridge" : "❌ [Native] Permissions denied via Bridge");
        
        return { 
          success: granted, 
          error: granted ? null : "Camera or Microphone permission was denied." 
        };
      }

      // 3. SAFE CONTINUATION
      // If the bridge is missing, we return success: true anyway.
      // Why? Because Agora's SDK will attempt its own prompt. 
      // This prevents your UI from getting stuck in "Preparing Session".
      console.warn("⚠️ [Native] Capacitor Permissions plugin not found, proceeding to Agora init.");
      return { success: true };

    } catch (e) {
      console.error("⚠️ [Native] Permission flow error:", e);
      // Return success true so the app tries to load Agora anyway
      return { success: true }; 
    }
  }

  // Web Platform
  return { success: true };
};
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

const [isScreenSharing, setIsScreenSharing] = useState(false);
const [screenTrack, setScreenTrack] = useState(null);
const screenStreamRef = useRef(null);
const originalCameraRef = useRef(null);
const screenShareCleanupRef = useRef(null);

// ============================================
// SCREEN SHARE UTILITIES
// ============================================

// Screen share quality settings
const [screenShareQuality, setScreenShareQuality] = useState('auto');

// Screen share permission state
const [screenSharePermission, setScreenSharePermission] = useState({
  state: 'prompt',
  checked: false
});

// 1. Screen Share Permission Check
const checkScreenSharePermission = async () => {
  try {
    // Test screen share capability
    if (navigator.permissions && navigator.permissions.query) {
      try {
        // Chrome/Edge/Firefox support display-capture
        const result = await navigator.permissions.query({ 
          name: 'display-capture' 
        });
        setScreenSharePermission({ state: result.state, checked: true });
        return result.state;
      } catch (permissionError) {
        // Safari or older browsers
        console.log('Display-capture permission not supported:', permissionError);
      }
    }
    
    // Fallback: Check if getDisplayMedia exists
    const hasGetDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    setScreenSharePermission({ 
      state: hasGetDisplayMedia ? 'prompt' : 'denied', 
      checked: true 
    });
    
    return hasGetDisplayMedia ? 'prompt' : 'denied';
    
  } catch (error) {
    console.error('Permission check error:', error);
    setScreenSharePermission({ state: 'unknown', checked: true });
    return 'unknown';
  }
};

// 2. Screen Share with Quality Settings
const startScreenShareWithQuality = async (quality = 'auto') => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Use native plugin - Ensure the plugin name matches your registration
      const result = await AgoraScreenShare.startScreenShare(); 
      return { type: 'native', success: true }; 
    } catch (error) {
      console.error("Native Screen Share Error:", error);
      throw error;
    }
  } else {
    // Use web API
    const configs = {
      low: { width: 1280, height: 720, frameRate: 15 },
      medium: { width: 1920, height: 1080, frameRate: 24 },
      high: { width: 2560, height: 1440, frameRate: 30 },
      auto: { width: 1920, height: 1080, frameRate: 24 }
    };
    
    const selectedConfig = configs[quality];
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: selectedConfig.width },
        height: { ideal: selectedConfig.height },
        frameRate: { ideal: selectedConfig.frameRate }
      },
      audio: false
    });
    return screenStream;
  }
};
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
  const localTracksRef = useRef({ audioTrack: null, videoTrack: null });
  const chatContainerRef = useRef(null);
  const mainContainerRef = useRef(null);
  const participantsPanelRef = useRef(null);
  const screenSharePending = useRef(false);
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
  // Check screen share support AND permissions
  const checkScreenShareSupport = async () => {
    console.log('🔍 Checking screen share capabilities...');
    
    // 1. Check permission state
    const permissionState = await checkScreenSharePermission();
    console.log('Screen share permission state:', permissionState);
    
    // 2. Check browser support
    const hasGetDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const isChrome = /Chrome/i.test(navigator.userAgent);
    const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // 3. Determine capabilities
    const canScreenShare = hasGetDisplayMedia && 
      (permissionState === 'granted' || permissionState === 'prompt');
    
    // iOS specific: Only Safari 15+ supports screen sharing
    const iosVersion = isIOS ? (navigator.userAgent.match(/OS (\d+)_/) || [])[1] : null;
    const iosCanShare = isIOS && isSafari && iosVersion >= 15;
    
    setMobileScreenShare(prev => ({
      ...prev,
      isAvailable: canScreenShare || iosCanShare,
      permissionGranted: permissionState === 'granted',
      supportedBrowser: isChrome ? 'Chrome' : 
                       isSafari ? 'Safari' : 
                       isIOS ? 'iOS' : 'Other',
      iosVersion: iosVersion
    }));
    
    console.log('Screen share capabilities:', {
      canScreenShare,
      permissionState,
      browser: isChrome ? 'Chrome' : isSafari ? 'Safari' : 'Other',
      isIOS,
      iosVersion
    });
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
    setSessionState(prev => ({ ...prev, error: null }));

    // ────────────────────────────────────────────────────────────────
    // STEP 1: SAFE PERMISSION GUARD
    // ────────────────────────────────────────────────────────────────
    // We use a try/catch specifically here so a permission error 
    // doesn't kill the whole session setup
    try {
      const permissionResult = await requestNativePermissions();
      // Handle both return types (boolean or object with .success)
      const isAllowed = typeof permissionResult === 'boolean' ? permissionResult : permissionResult.success;
      
      if (!isAllowed) {
        throw new Error("Camera/Mic permissions denied by user.");
      }
    } catch (permError) {
      console.warn("⚠️ Permission check failed/skipped:", permError);
      // On Web, we continue. On Android, if we don't have perms, 
      // Agora will throw a descriptive error later in the flow.
    }

    // ✅ Get or initialize session info
    let sessionData = sessionState.sessionInfo;
    
    // ────────────────────────────────────────────────────────────────
    // STEP 2: CLIENT INITIALIZATION
    // ────────────────────────────────────────────────────────────────
    if (!sessionData || !sessionData.token) {
      console.log('🆕 Starting NEW session...');
      
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: isNative ? 'h264' : 'vp8'  
      });
      
      sessionData = await videoApi.startVideoSession(classId, teacherId);
      
      if (!sessionData.success) throw new Error(sessionData.error || 'Failed to start session');
      if (!sessionData.token || sessionData.token === 'demo_token') throw new Error('Invalid token');

      setSessionState(prev => ({
        ...prev,
        isInitialized: true,
        isJoined: false,
        sessionInfo: sessionData
      }));
    } else {
      console.log('🔄 REJOINING existing session...');
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: isNative ? 'h264' : 'vp8'
      });
    }
    
    // ────────────────────────────────────────────────────────────────
    // STEP 3: JOIN CHANNEL (The Actual Connection)
    // ────────────────────────────────────────────────────────────────
    // We pass sessionData directly to ensure we have the latest tokens
    await joinChannel(sessionData);
    
  } catch (error) {
    console.error('❌ Initialization error:', error);
    setSessionState(prev => ({ 
      ...prev, 
      error: error.message || "Failed to connect to video server" 
    }));
  } finally {
    // ⚡ ALWAYS RELEASE THE LOADING STATE
    // This is the most important line to prevent the "stuck" screen
    setLoading(prev => ({ ...prev, isConnecting: false }));
  }
};

const joinChannel = async (sessionData) => {
  try {
    const { channel, token, uid, appId } = sessionData;
    
    // 1. GUARD: Permissions
    const permissionResult = await requestNativePermissions();
    const hasPermission = typeof permissionResult === 'boolean' ? permissionResult : permissionResult.success;
    
    if (!hasPermission) {
      throw new Error("Permissions denied. Cannot access camera or microphone.");
    }

    // 2. STABILITY: Ensure any existing tracks are destroyed before joining
    // This prevents "Track already exists" errors on Android rejoining
    if (localTracksRef.current.videoTrack) {
      localTracksRef.current.videoTrack.stop();
      localTracksRef.current.videoTrack.close();
    }
    if (localTracksRef.current.audioTrack) {
      localTracksRef.current.audioTrack.stop();
      localTracksRef.current.audioTrack.close();
    }

    console.log('🔗 Joining channel...', { channel, uid });
    
    // 3. Join channel with UID casting (Production Safe)
    const assignedUid = await clientRef.current.join(
      appId,
      channel,
      token,
      Number(uid) || uid // Agora accepts Number or String, but Number is safer for many backends
    );
    
    // 4. Create and publish tracks with localized error handling
    try {
      await createAndPublishTracks();
    } catch (trackError) {
      console.warn("⚠️ Media tracks failed, trying audio-only fallback:", trackError);
      // Optional: Logic to try audio-only if video fails
    }
    
    // 5. Update state and setup listeners
    setSessionState(prev => ({ 
      ...prev, 
      isJoined: true,
      error: null // Clear any previous errors
    }));

    setupAgoraEventListeners();
    startDurationTracking();
    
    // 6. Force sync for late-joiners
    setTimeout(async () => {
      if (clientRef.current) {
        await forceResubscribeToAllUsers();
      }
    }, 2000);
    
    return assignedUid;

  } catch (error) {
    console.error('❌ Join channel error:', error);
    // On Android, specific error codes are helpful for the teacher to see
    const friendlyError = error.message?.includes('AGORA_REDUNDANT_JOIN') 
      ? "Already in a call. Please wait..." 
      : error.message;
      
    setSessionState(prev => ({ ...prev, error: friendlyError }));
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
    console.log('🎥 Initializing media hardware...');
    
    // 1. CLEANUP: Prevent hardware lock on Android
    // If tracks already exist, we must unpublish and close them first
    if (localTracksRef.current.audioTrack || localTracksRef.current.videoTrack) {
      console.log('🧹 Cleaning up existing tracks before re-init...');
      const oldTracks = [];
      if (localTracksRef.current.audioTrack) oldTracks.push(localTracksRef.current.audioTrack);
      if (localTracksRef.current.videoTrack) oldTracks.push(localTracksRef.current.videoTrack);
      
      try {
        await clientRef.current.unpublish(oldTracks);
        oldTracks.forEach(t => { t.stop(); t.close(); });
      } catch (e) { console.warn("Cleanup warning:", e); }
    }

    let audioTrack = null;
    let videoTrack = null;
    
    // Detect mobile for optimized constraints
    const isMobileDevice = isNative || /Android|iPhone|iPad/i.test(navigator.userAgent);

    // 2. AUDIO INITIALIZATION
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: isMobileDevice ? 'speech_standard' : 'music_standard',
        AEC: true, ANS: true, AGC: true 
      });
    } catch (err) {
      console.error('❌ Audio Init Failed:', err);
    }

    // 3. VIDEO INITIALIZATION (Mobile Optimized)
    try {
      videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: isMobileDevice ? {
          width: 640,
          height: 480,
          frameRate: 15,
          bitrateMax: 600
        } : '720p_3',
        optimizationMode: 'motion' // 'motion' is better for teachers moving/gesturing
      });
    } catch (err) {
      console.error('❌ Video Init Failed:', err);
      showCameraWarning(err);
    }

    // 4. PERSIST TO REFS (Immediate access for other functions)
    localTracksRef.current = { audioTrack, videoTrack };
    
    // 5. UPDATE STATE (For UI rendering)
    setLocalTracks({ audio: audioTrack, video: videoTrack });

    // 6. RENDER LOCAL PREVIEW
    if (videoTrack && localVideoRef.current) {
      // Small delay for Android Webview to mount the DOM element
      if (isMobileDevice) await new Promise(r => setTimeout(r, 300));
      await videoTrack.play(localVideoRef.current);
      localVideoRef.current.style.transform = 'scaleX(-1)'; // Mirror for teacher
    }

    // 7. PUBLISH TO CHANNEL
    const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
    if (tracksToPublish.length > 0) {
      await clientRef.current.publish(tracksToPublish);
      console.log('✅ Tracks successfully published to channel');
    }

    // 8. SYNC UI CONTROLS
    setControls(prev => ({
      ...prev,
      audioEnabled: !!audioTrack,
      videoEnabled: !!videoTrack
    }));

  } catch (error) {
    console.error('❌ Critical error in media pipeline:', error);
    setSessionState(prev => ({
      ...prev,
      error: `Hardware Error: ${error.message}. Please refresh.`
    }));
  }
}, [showCameraWarning]); // Remove tracks from dependency to avoid infinite loops
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
  
// Helper function to check screen sharing support
const checkScreenShareSupport = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isChrome = /chrome|chromium/i.test(userAgent);
  const isEdge = /edg/i.test(userAgent);
  const isFirefox = /firefox/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/chrome|chromium|edg/i.test(userAgent);
  
  // Check for getDisplayMedia API
  const hasGetDisplayMedia = () => {
    // Standard API
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      return true;
    }
    // Legacy API (Chrome 72-74)
    if (navigator.getDisplayMedia) {
      return true;
    }
    // Safari specific
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const constraints = { video: { mediaSource: 'screen' } };
      return navigator.mediaDevices.getUserMedia.toString().includes('getDisplayMedia') ||
             navigator.mediaDevices.getUserMedia.toString().includes('screen');
    }
    return false;
  };
  
  if (!hasGetDisplayMedia()) {
    return {
      supported: false,
      message: 'Browser does not have getDisplayMedia API',
      browser: isChrome ? 'Chrome' : isSafari ? 'Safari' : isFirefox ? 'Firefox' : isEdge ? 'Edge' : 'Unknown'
    };
  }
  
  // Check HTTPS
  if (!window.isSecureContext && location.protocol !== 'https:' && location.hostname !== 'localhost') {
    return {
      supported: false,
      message: 'Screen sharing requires HTTPS or localhost',
      requiresHTTPS: true
    };
  }
  
  return { supported: true };
};

// Helper function for stop screen sharing
const stopScreenShareAndRestoreCamera = async () => {
  try {
    const screenTrack = localTracks.video;
    
    if (screenTrack) {
      await clientRef.current.unpublish([screenTrack]);
      screenTrack.stop();
      console.log('✅ Screen track stopped');
    }
    
    // Restore camera
    const cameraTrack = await AgoraRTC.createCameraVideoTrack();
    await clientRef.current.publish([cameraTrack]);
    
    if (localVideoRef.current) {
      await cameraTrack.play(localVideoRef.current);
      localVideoRef.current.style.transform = 'scaleX(-1)';
      localVideoRef.current.style.objectFit = 'cover';
    }
    
    setLocalTracks(prev => ({ ...prev, video: cameraTrack }));
    setControls(prev => ({ 
      ...prev, 
      screenSharing: false,
      videoEnabled: true 
    }));
    
  } catch (error) {
    console.error('❌ Error restoring camera:', error);
    // Force refresh camera
    try {
      const newCamera = await AgoraRTC.createCameraVideoTrack();
      await clientRef.current.publish([newCamera]);
      setLocalTracks(prev => ({ ...prev, video: newCamera }));
    } catch (e) {
      console.error('Failed to create new camera:', e);
    }
  }
};


// ────────────────────────────────────────────────────────────────
// SCREEN SHARE - Production Ready for Web & Android
// ────────────────────────────────────────────────────────────────
const toggleScreenShare = useCallback(async () => {
  if (screenSharePending.current) return; // Block if already in progress

  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';

  try {
    // 1. STOP LOGIC
    if (controls.screenSharing) {
      screenSharePending.current = true;
      setLoading(prev => ({ ...prev, isScreenSharing: true }));
      
      if (isAndroid) {
        await AgoraScreenShare.stopScreenShare();
      } else if (localTracks.screenTrack) {
        localTracks.screenTrack.stop();
        localTracks.screenTrack.close();
        await clientRef.current.unpublish(localTracks.screenTrack);
      }

      // Restore Camera
      const cameraTrack = await AgoraRTC.createCameraVideoTrack();
      await clientRef.current.publish(cameraTrack);
      setLocalTracks(prev => ({ ...prev, video: cameraTrack, screenTrack: null }));
      if (localVideoRef.current) cameraTrack.play(localVideoRef.current);

      setControls(prev => ({ ...prev, screenSharing: false, videoEnabled: true }));
      screenSharePending.current = false;
      setLoading(prev => ({ ...prev, isScreenSharing: false }));
      return;
    }

    // 2. START LOGIC
    const { appId, channel, token, uid } = sessionState.sessionInfo || {};
    if (!appId || !channel) throw new Error('Session not initialized');

    screenSharePending.current = true; // LOCK
    setLoading(prev => ({ ...prev, isScreenSharing: true }));

    // STEP A: Complete Shutdown of Camera (Crucial for Android logs you sent)
    if (localTracks.video) {
      await clientRef.current.unpublish(localTracks.video);
      localTracks.video.stop();
      localTracks.video.close(); 
      setLocalTracks(prev => ({ ...prev, video: null }));
    }

    // STEP B: The Stability Delay (Clears hardware buffers)
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (isAndroid) {
      // STEP C: Native Plugin Call
      await AgoraScreenShare.startScreenShare({
        appId: appId,
        token: token,
        channelId: channel,
        uid: Number(uid) + 10000 
      });
      
      setControls(prev => ({ ...prev, screenSharing: true, videoEnabled: false }));
    } else {
      // Web Implementation
      const screenTrack = await AgoraRTC.createScreenVideoTrack({ 
        optimizationMode: 'detail',
        encoderConfig: '1080p_1' 
      }, 'disable');

      await clientRef.current.publish(screenTrack);
      screenTrack.on('track-ended', () => toggleScreenShare());
      setLocalTracks(prev => ({ ...prev, screenTrack }));
      setControls(prev => ({ ...prev, screenSharing: true, videoEnabled: false }));
    }

  } catch (error) {
    console.error('❌ Screen share error:', error);
    // Auto-recovery of camera
    try {
        const recoverCam = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish(recoverCam);
        setLocalTracks(prev => ({ ...prev, video: recoverCam }));
    } catch (e) { console.error("Recovery failed", e); }
    setControls(prev => ({ ...prev, screenSharing: false }));
  } finally {
    screenSharePending.current = false; // UNLOCK
    setLoading(prev => ({ ...prev, isScreenSharing: false }));
  }
}, [controls.screenSharing, localTracks, sessionState.sessionInfo]);useEffect(() => {
  return () => {
    if (screenShareCleanupRef.current) {
      screenShareCleanupRef.current();
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };
}, []);

// Optional: Add a debug function to help users
const debugScreenShare = () => {
  console.log('🔍 Screen Share Debug Info:');
  console.log('- User Agent:', navigator.userAgent);
  console.log('- Chrome Version:', /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] || 'Not Chrome');
  console.log('- Is Secure Context:', window.isSecureContext);
  console.log('- Protocol:', location.protocol);
  console.log('- Has getDisplayMedia:', !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia));
  console.log('- Has navigator.getDisplayMedia:', !!navigator.getDisplayMedia);
  console.log('- AgoraRTC version:', AgoraRTC.VERSION);
  
  alert(`Debug Info:\n\nBrowser: ${navigator.userAgent}\nSecure: ${window.isSecureContext}\nHTTPS: ${location.protocol === 'https:'}\ngetDisplayMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)}`);
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
  console.log('🧹 Starting session cleanup...');

  // 1. Clear intervals immediately
  if (durationIntervalRef.current) {
    clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = null;
  }

  
  const tracks = localTracksRef.current;
  const tracksToCleanup = [tracks.audioTrack, tracks.videoTrack].filter(Boolean);

  if (tracksToCleanup.length > 0) {
    try {
      // Unpublish first if client still exists
      if (clientRef.current && clientRef.current.connectionState !== 'DISCONNECTED') {
        await clientRef.current.unpublish(tracksToCleanup);
      }
    } catch (err) {
      console.warn('⚠️ Unpublish during cleanup failed (normal if already disconnected)', err);
    } finally {
      // ALWAYS stop and close hardware, regardless of unpublish success
      tracksToCleanup.forEach(track => {
        track.stop(); // Stops the blue/green light on Android/Web
        track.close(); // Releases hardware for other apps
      });
      // Clear the ref
      localTracksRef.current = { audioTrack: null, videoTrack: null };
    }
  }

  // 3. Leave the channel
  if (clientRef.current) {
    try {
      // Remove all event listeners to prevent memory leaks
      clientRef.current.removeAllListeners();
      await clientRef.current.leave();
      console.log('✅ Left Agora channel');
    } catch (err) {
      console.warn('Leave channel error:', err);
    }
  }

  // 4. Update UI State
  setLocalTracks({ audio: null, video: null });
  setRemoteUsers(new Map());
  
  // Preserve sessionInfo for the "Rejoin" feature
  setSessionState(prev => ({
    ...prev,
    isJoined: false,
    isInitialized: false,
    error: null
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
<button 
  onClick={async () => {
    const state = await checkScreenSharePermission();
    alert(`Screen share permission: ${state}`);
  }}
  style={{
    position: 'absolute',
    bottom: '200px',
    right: '20px',
    background: '#6b7280',
    color: 'white',
    padding: '4px 8px',
    fontSize: '11px',
    borderRadius: '4px'
  }}
>
  Test Permissions
</button>
      
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
          right: '240px', 
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