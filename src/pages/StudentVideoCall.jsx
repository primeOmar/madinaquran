import React, { useState, useEffect, useRef, useCallback, useMemo  } from 'react';
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
  MoreVertical, 
  X,
  Share2,
  ChevronUp,
  MessageSquare
} from 'lucide-react';


// ============================================
// FIXED: useDraggable Hook - No Conditional Returns
// ============================================
const useDraggable = () => {
  const [position, setPosition] = useState(() => {
    try {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobile = viewportWidth < 768;
      
      const pipWidth = isMobile ? 160 : 280;
      const pipHeight = isMobile ? 150 : 300;
      
      return {
        x: Math.max(20, viewportWidth - pipWidth - 20),
        y: Math.max(20, viewportHeight - pipHeight - 20)
      };
    } catch (error) {
      return { x: 20, y: 20 };
    }
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const getPipSize = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    return {
      width: isMobile ? 160 : 280,
      height: isMobile ? 120 : 210
    };
  }, []);

  // ✅ Move event handler definitions OUTSIDE useEffect
  const handleMouseMove = useCallback((e) => {
    e.preventDefault();
    if (!isDragging) return;
    
    let newX = e.clientX - dragStart.current.x;
    let newY = e.clientY - dragStart.current.y;
    
    const pipSize = getPipSize();
    const maxX = window.innerWidth - pipSize.width;
    const maxY = window.innerHeight - pipSize.height;
    
    newX = Math.max(10, Math.min(newX, maxX - 10));
    newY = Math.max(10, Math.min(newY, maxY - 10));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, getPipSize]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!isDragging) return;
    
    const touch = e.touches[0];
    let newX = touch.clientX - dragStart.current.x;
    let newY = touch.clientY - dragStart.current.y;
    
    const pipSize = getPipSize();
    const maxX = window.innerWidth - pipSize.width;
    const maxY = window.innerHeight - pipSize.height;
    
    newX = Math.max(10, Math.min(newX, maxX - 10));
    newY = Math.max(10, Math.min(newY, maxY - 10));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, getPipSize]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    // ✅ ALWAYS return a cleanup function (consistent hook behavior)
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleEnd);
    }

    // ✅ ALWAYS return cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleEnd]);

  return {
    position,
    isDragging,
    setPosition,
    handleMouseDown: (e) => {
      if (e.target.closest('.no-drag')) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    },
    handleTouchStart: (e) => {
      if (e.target.closest('.no-drag')) return;
      e.preventDefault();
      const touch = e.touches[0];
      setIsDragging(true);
      dragStart.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      };
    }
  };
};

const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
  // ============================================
  // State and Refs
  // ============================================
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [teacherScreenSharing, setTeacherScreenSharing] = useState(false);
  const remoteVideoRefs = useRef(new Map());
  const pipRef = useRef(null);
  
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  
  const initializationRef = useRef({
    clientCreated: false,
    listenersSet: false,
    joined: false
  });
  
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false,
    hasMicrophone: false
  });
  
  const [connectionStats, setConnectionStats] = useState({
  packetLoss: 0,
  latency: 0,
  quality: 'good'
});
  // ⚠️ CRITICAL FIX #1: Separate ref for local video container
  const localVideoRef = useRef(null);
  const localVideoTrackRef = useRef(null); // Store track reference separately
  
  const [userProfiles, setUserProfiles] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [teacherUid, setTeacherUid] = useState(null);
  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown'
  });
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const clientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const messagesPollIntervalRef = useRef(null);
  const profilePollingRef = useRef();

const [loadingProgress, setLoadingProgress] = useState({
  step: '',
  progress: 0
});
const { position, isDragging, setPosition, handleMouseDown, handleTouchStart } = useDraggable();

const [isScreenSharing, setIsScreenSharing] = useState(false);
const [screenTrack, setScreenTrack] = useState(null);

const [showParticipants, setShowParticipants] = useState(false);
const [participantsSort, setParticipantsSort] = useState('name'); // 'name', 'role', 'joinTime'
const [participantsFilter, setParticipantsFilter] = useState('all'); // 'all', 'teachers', 'students'


const teacherTracks = useMemo(() => {
  console.log('🔍 Computing teacherTracks...');
  console.log('  Teacher UID:', teacherUid, 'Type:', typeof teacherUid);
  console.log('  Remote tracks size:', remoteTracks.size);
  
  if (!teacherUid) {
    console.log('  ❌ No teacher UID');
    return null;
  }
  
  // Try ALL possible key formats (critical for matching)
  const keys = [
    teacherUid,
    String(teacherUid),
    Number(teacherUid),
    parseInt(teacherUid),
  ].filter(k => k !== null && !isNaN(k));
  
  console.log('  Trying keys:', keys);
  console.log('  Available keys in remoteTracks:', Array.from(remoteTracks.keys()));
  
  let tracks = null;
  for (const key of keys) {
    tracks = remoteTracks.get(key);
    if (tracks) {
      console.log(`  ✅ Found tracks with key: ${key} (type: ${typeof key})`);
      break;
    }
  }
  
  if (tracks) {
    console.log('  📹 Video:', !!tracks.video, tracks.video);
    console.log('  🎤 Audio:', !!tracks.audio, tracks.audio);
  } else {
    console.log('  ❌ No tracks found');
  }
  
  return tracks || null;
}, [teacherUid, remoteTracks]);

useEffect(() => {
  const playLocalVideo = async () => {
    if (!localTracks.video || !localVideoRef.current) {
      console.log('⏸️ Local video not ready:', { 
        hasTrack: !!localTracks.video, 
        hasRef: !!localVideoRef.current 
      });
      return;
    }

    if (!controls.videoEnabled) {
      console.log('⏸️ Video disabled by user');
      return;
    }

    try {
      console.log('▶️ Playing local video...');
      
      if (localVideoTrackRef.current && localVideoTrackRef.current !== localTracks.video) {
        localVideoTrackRef.current.stop();
      }

      await localTracks.video.play(localVideoRef.current);
      localVideoTrackRef.current = localTracks.video;
      
      console.log('✅ Local video playing');
    } catch (error) {
      console.error('❌ Failed to play local video:', error);
      
      setTimeout(async () => {
        try {
          if (localTracks.video && localVideoRef.current) {
            await localTracks.video.play(localVideoRef.current);
            localVideoTrackRef.current = localTracks.video;
            console.log('✅ Local video retry successful');
          }
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
        }
      }, 500);
    }
  };

  playLocalVideo();

  return () => {
    if (localVideoTrackRef.current) {
      try {
        localVideoTrackRef.current.stop();
      } catch (e) {
        console.warn('Cleanup warning:', e);
      }
    }
  };
}, [localTracks.video, controls.videoEnabled]);

useEffect(() => {
  const playRemoteVideos = async () => {
    console.log('🎬 Playing remote videos...', remoteTracks.size, 'tracks');
    
    for (const [uid, tracks] of remoteTracks.entries()) {
      // Skip teacher - handled separately in main video area
      if (teacherUid && String(uid) === String(teacherUid)) {
        console.log(`⏭️ Skipping teacher ${uid} (handled separately)`);
        continue;
      }
      
      // Get container - try multiple formats
      let container = remoteVideoRefs.current.get(uid) ||
                     remoteVideoRefs.current.get(String(uid)) ||
                     remoteVideoRefs.current.get(Number(uid));
      
      if (!container) {
        console.log(`⏸️ No container for user ${uid}`);
        continue;
      }
      
      if (!tracks.video) {
        console.log(`⏸️ No video track for user ${uid}`);
        continue;
      }
      
      try {
        // Check if already playing
        if (tracks.video.isPlaying) {
          console.log(`✅ Video ${uid} already playing`);
          continue;
        }
        
        console.log(`▶️ Playing remote video ${uid} in ${container.tagName || container.className}`);
        
        // ✅ CRITICAL FIX: Always call .play(container) for both VIDEO and DIV
        await tracks.video.play(container);
        
        console.log(`✅ Remote video ${uid} playing`);
        
      } catch (error) {
        console.error(`❌ Failed to play remote ${uid}:`, error);
        
        // Retry once after delay
        setTimeout(async () => {
          try {
            if (tracks.video && !tracks.video.isPlaying) {
              await tracks.video.play(container);
              console.log(`✅ Remote video ${uid} playing on retry`);
            }
          } catch (retryErr) {
            console.error(`❌ Retry failed for ${uid}:`, retryErr);
          }
        }, 1000);
      }
    }
  };

  playRemoteVideos();
}, [remoteTracks, teacherUid]);

// ============================================
// ENHANCED: Teacher Video Playback with Multiple Triggers
// ============================================

useEffect(() => {
  const playTeacherVideo = async () => {
    console.log('👨‍🏫 Teacher video effect triggered');
    
    if (!teacherUid) {
      console.log('  ⏸️ No teacher UID');
      return;
    }
    
    if (!teacherTracks?.video) {
      console.log('  ⏸️ No teacher video track');
      return;
    }

    // Wait for container with retries
    let attempts = 0;
    const maxAttempts = 5;
    
    const tryPlay = async () => {
      attempts++;
      
      // Try multiple container keys
      let container = remoteVideoRefs.current.get(teacherUid) || 
                     remoteVideoRefs.current.get(String(teacherUid)) ||
                     remoteVideoRefs.current.get(Number(teacherUid));
      
      if (!container) {
        console.log(`  ⏸️ Container not ready (attempt ${attempts}/${maxAttempts})`);
        
        if (attempts < maxAttempts) {
          setTimeout(tryPlay, 500);
        } else {
          console.error('  ❌ Container never became available');
        }
        return;
      }

      // Check if already playing
      if (teacherTracks.video.isPlaying) {
        console.log('  ✅ Teacher video already playing');
        return;
      }

      try {
        console.log(`  ▶️ Playing teacher video (attempt ${attempts})`);
        console.log('    Container:', container.tagName || container.className);
        console.log('    Track enabled:', teacherTracks.video.enabled);
        
        // ✅ CRITICAL: Play with container for both VIDEO and DIV elements
        await teacherTracks.video.play(container);
        
        console.log('  ✅ 🎉 Teacher video playing successfully!');
        
      } catch (error) {
        console.error(`  ❌ Play failed (attempt ${attempts}):`, error);
        
        if (attempts < maxAttempts) {
          setTimeout(tryPlay, 1000);
        }
      }
    };
    
    tryPlay();
  };

  playTeacherVideo();
}, [teacherUid, teacherTracks, teacherTracks?.video]);

// Ensure teacher video continues playing when UI state changes
useEffect(() => {
  if (teacherTracks?.video && !teacherTracks.video.isPlaying) {
    console.log('🔄 UI state changed, checking teacher video playback');
    playTeacherVideo();
  }
}, [showParticipants, showSettings]); // Re-run when panels open/close

// Enhanced participant sorting function
const getSortedParticipants = () => {
  const allParticipants = Array.from(remoteTracks.entries()).map(([uid, tracks]) => {
    const uidString = uid.toString();
    const profile = userProfiles.get(uidString);
    const isTeacher = uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher';
    
    return {
      uid: uidString,
      tracks,
      profile,
      isTeacher,
      hasAudio: !!tracks.audio,
      hasVideo: !!tracks.video,
      joinTime: Date.now(), // In real app, track actual join time
    };
  });
  
  // Filter out teacher from participants list (teacher has dedicated main video area)
  const filteredRemoteParticipants = allParticipants.filter(p => !p.isTeacher);
  
  // Add current user
  filteredRemoteParticipants.push({
    uid: String(sessionState.sessionInfo?.uid || studentId),
    tracks: localTracks,
    profile: {
      name: 'You',
      display_name: 'You',
      role: 'student',
      is_teacher: false,
    },
    isTeacher: false,
    hasAudio: controls.audioEnabled && localTracks.audio,
    hasVideo: controls.videoEnabled && localTracks.video,
    joinTime: Date.now(),
  });
  
  // Apply filter
  let filtered = filteredRemoteParticipants;
  if (participantsFilter === 'teachers') {
    filtered = filtered.filter(p => p.isTeacher);
  } else if (participantsFilter === 'students') {
    filtered = filtered.filter(p => !p.isTeacher);
  }
  
  // Apply sort
  filtered.sort((a, b) => {
    if (participantsSort === 'name') {
      return a.profile?.name?.localeCompare(b.profile?.name || '') || 0;
    } else if (participantsSort === 'role') {
      if (a.isTeacher && !b.isTeacher) return -1;
      if (!a.isTeacher && b.isTeacher) return 1;
      return 0;
    } else if (participantsSort === 'joinTime') {
      return a.joinTime - b.joinTime;
    }
    return 0;
  });
  
  return filtered;
};

// Kick participant (admin function - would need permissions)
const kickParticipant = async (uid) => {
  try {
    const response = await studentvideoApi.kickParticipant(
      sessionState.sessionInfo?.meetingId,
      uid,
      studentId
    );
    
    if (response.success) {
      sendMessage(`Removed participant: ${userProfiles.get(uid)?.name || 'User'}`, 'system');
      console.log(`✅ Kicked participant ${uid}`);
    }
  } catch (error) {
    console.error('❌ Failed to kick participant:', error);
  }
};
const [isFullscreen, setIsFullscreen] = useState(false);

const toggleFullscreen = () => {
  const element = document.documentElement;
  
  if (!document.fullscreenElement) {
    // Enter fullscreen
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) { // Firefox
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) { // Chrome, Safari, Opera
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { // IE/Edge
      element.msRequestFullscreen();
    }
    setIsFullscreen(true);
    
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    setIsFullscreen(false);
  }
};

// Listen for fullscreen changes
useEffect(() => {
  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };
  
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  
  return () => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
  };
}, []);

const [reactions, setReactions] = useState([]);
const [reactionTimeout, setReactionTimeout] = useState({});

const sendReaction = (reaction) => {
  try {
    // Send reaction via API
    if (sessionState.sessionInfo?.session?.id) {
      studentvideoApi.sendReaction(
        sessionState.sessionInfo.session.id,
        studentId,
        reaction
      ).then(() => {
        console.log(`✅ Reaction sent: ${reaction}`);
      }).catch(err => {
        console.warn('⚠️ Failed to send reaction:', err);
        // Fallback to message
        sendMessage(reaction, 'reaction');
      });
    } else {
      // Fallback to message
      sendMessage(reaction, 'reaction');
    }
    
    // Show local reaction
    const reactionId = Date.now();
    setReactions(prev => [...prev, {
      id: reactionId,
      emoji: reaction,
      userId: studentId,
      userName: 'You',
      timestamp: Date.now()
    }]);
    
    // Remove reaction after 3 seconds
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 3000);
    
    // Prevent rapid reactions (throttle)
    clearTimeout(reactionTimeout[reaction]);
    setReactionTimeout(prev => ({
      ...prev,
      [reaction]: setTimeout(() => {}, 1000) // 1 second cooldown per reaction type
    }));
    
  } catch (error) {
    console.error('❌ Reaction error:', error);
    sendMessage(reaction, 'reaction'); // Fallback
  }
};

// Common reactions
const quickReactions = [
  { emoji: '👍', label: 'Like' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🙋', label: 'Raise Hand' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '🤔', label: 'Thinking' },
  { emoji: '👀', label: 'Eyes' }
];

const [showSettings, setShowSettings] = useState(false);
const [availableDevices, setAvailableDevices] = useState({
  cameras: [],
  microphones: [],
  speakers: []
});
const [selectedDevices, setSelectedDevices] = useState({
  cameraId: '',
  microphoneId: '',
  speakerId: ''
});
const [audioSettings, setAudioSettings] = useState({
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  volume: 100
});
const [videoSettings, setVideoSettings] = useState({
  resolution: '720p',
  frameRate: 30,
  bitrate: 'auto'
});

const toggleSettings = async () => {
  if (!showSettings) {
    // When opening settings, refresh device list
    await loadAvailableDevices();
  }
  setShowSettings(prev => !prev);
};

const loadAvailableDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    const cameras = devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({
        id: device.deviceId,
        label: device.label || `Camera ${cameras.length + 1}`,
        group: device.groupId
      }));
    
    const microphones = devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        id: device.deviceId,
        label: device.label || `Microphone ${microphones.length + 1}`,
        group: device.groupId
      }));
    
    const speakers = devices
      .filter(device => device.kind === 'audiooutput')
      .map(device => ({
        id: device.deviceId,
        label: device.label || `Speaker ${speakers.length + 1}`,
        group: device.groupId
      }));
    
    setAvailableDevices({ cameras, microphones, speakers });
    
    // Get current active devices
    if (localTracks.video?.getTrackLabel) {
      const currentCamera = localTracks.video.getTrackLabel();
      setSelectedDevices(prev => ({
        ...prev,
        cameraId: cameras.find(cam => cam.label === currentCamera)?.id || ''
      }));
    }
    
  } catch (error) {
    console.error('❌ Failed to load devices:', error);
  }
};

const switchCamera = async (deviceId) => {
  try {
    if (!localTracks.video || !controls.hasCamera) return;
    
    console.log(`📷 Switching to camera: ${deviceId}`);
    
    // Close current video track
    await localTracks.video.close();
    
    // Create new video track with selected device
    const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: videoSettings.resolution === '720p' ? '720p_3' : 
                    videoSettings.resolution === '480p' ? '480p_1' : '1080p_3',
      cameraId: deviceId,
      optimizationMode: 'detail'
    });
    
    // Replace old track with new one
    if (clientRef.current) {
      // Unpublish old track
      await clientRef.current.unpublish(localTracks.video);
      
      // Update local tracks
      setLocalTracks(prev => ({ ...prev, video: newVideoTrack }));
      
      // Publish new track
      await clientRef.current.publish(newVideoTrack);
      
      // Update selected device
      setSelectedDevices(prev => ({ ...prev, cameraId: deviceId }));
      
      console.log('✅ Camera switched successfully');
      
      // Send notification
      sendMessage('Switched camera', 'system');
    }
    
  } catch (error) {
    console.error('❌ Failed to switch camera:', error);
    sendMessage('Failed to switch camera', 'system');
  }
};

const switchMicrophone = async (deviceId) => {
  try {
    if (!localTracks.audio || !controls.hasMicrophone) return;
    
    console.log(`🎤 Switching to microphone: ${deviceId}`);
    
    // Close current audio track
    await localTracks.audio.close();
    
    // Create new audio track with selected device
    const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      microphoneId: deviceId,
      AEC: audioSettings.echoCancellation,
      ANS: audioSettings.noiseSuppression,
      AGC: audioSettings.autoGainControl,
      encoderConfig: 'music_standard'
    });
    
    // Replace old track with new one
    if (clientRef.current) {
      // Unpublish old track
      await clientRef.current.unpublish(localTracks.audio);
      
      // Update local tracks
      setLocalTracks(prev => ({ ...prev, audio: newAudioTrack }));
      
      // Publish new track
      await clientRef.current.publish(newAudioTrack);
      
      // Update selected device
      setSelectedDevices(prev => ({ ...prev, microphoneId: deviceId }));
      
      console.log('✅ Microphone switched successfully');
      
      // Send notification
      sendMessage('Switched microphone', 'system');
    }
    
  } catch (error) {
    console.error('❌ Failed to switch microphone:', error);
    sendMessage('Failed to switch microphone', 'system');
  }
};

const updateAudioSettings = (setting, value) => {
  setAudioSettings(prev => ({ ...prev, [setting]: value }));
  
  // Apply settings to current audio track
  if (localTracks.audio) {
    try {
      if (setting === 'volume') {
        localTracks.audio.setVolume(value);
      } else if (setting === 'noiseSuppression') {
        localTracks.audio.setNoiseSuppression(value);
      } else if (setting === 'echoCancellation') {
        localTracks.audio.setEchoCancellation(value);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to update audio setting ${setting}:`, error);
    }
  }
};

const updateVideoSettings = (setting, value) => {
  setVideoSettings(prev => ({ ...prev, [setting]: value }));
  
  // Apply settings to current video track
  if (localTracks.video && setting === 'resolution') {
    try {
      const encoderConfig = 
        value === '720p' ? '720p_3' :
        value === '480p' ? '480p_1' :
        '1080p_3';
      
      localTracks.video.setEncoderConfiguration(encoderConfig);
      console.log(`✅ Video resolution updated to ${value}`);
    } catch (error) {
      console.warn('⚠️ Failed to update video resolution:', error);
    }
  }
};

  // ============================================
  // Window Resize Handler
  // ============================================
  useEffect(() => {
    const handleWindowResize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const isMobile = window.innerWidth < 768;
      const pipWidth = isMobile ? 160 : 280;
      const pipHeight = isMobile ? 120 : 210;
      
      setPosition(prev => ({
        x: Math.max(20, Math.min(prev.x, viewportWidth - pipWidth - 20)),
        y: Math.max(20, Math.min(prev.y, viewportHeight - pipHeight - 20))
      }));
    };
    
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [setPosition]);

  // ============================================
  // ⚠️ CRITICAL FIX #2: Dedicated Local Video Playback Effect
  // ============================================
  useEffect(() => {
    const playLocalVideo = async () => {
      // Only proceed if we have the video track and container
      if (!localTracks.video || !localVideoRef.current) {
        console.log('⏸️ Local video not ready:', { 
          hasTrack: !!localTracks.video, 
          hasRef: !!localVideoRef.current 
        });
        return;
      }

      // Skip if video is disabled
      if (!controls.videoEnabled) {
        console.log('⏸️ Video is disabled');
        return;
      }

      try {
        console.log('▶️ Playing local video track...');
        
        // Stop any existing playback first
        if (localVideoTrackRef.current && localVideoTrackRef.current !== localTracks.video) {
          try {
            localVideoTrackRef.current.stop();
          } catch (e) {
            console.warn('Failed to stop old track:', e);
          }
        }

        // Play the video track in the container
        await localTracks.video.play(localVideoRef.current);
        localVideoTrackRef.current = localTracks.video;
        
        console.log('✅ Local video playing successfully');
      } catch (error) {
        console.error('❌ Failed to play local video:', error);
        
        // Retry once after a short delay
        setTimeout(async () => {
          try {
            console.log('🔄 Retrying local video playback...');
            await localTracks.video.play(localVideoRef.current);
            localVideoTrackRef.current = localTracks.video;
            console.log('✅ Local video playing after retry');
          } catch (retryError) {
            console.error('❌ Retry failed:', retryError);
          }
        }, 500);
      }
    };

    playLocalVideo();

    // Cleanup function
    return () => {
      if (localVideoTrackRef.current && localVideoRef.current) {
        try {
          // Don't stop the track, just stop playing in this container
          localVideoTrackRef.current.stop();
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };
  }, [localTracks.video, controls.videoEnabled]);

  // ============================================
  // ⚠️ CRITICAL FIX #3: Separate Remote Video Playback Effect
  // ============================================
  useEffect(() => {
  const playRemoteVideos = async () => {
    for (const [uid, tracks] of remoteTracks.entries()) {
      // ✅ Skip teacher - handled separately
      if (teacherUid && String(uid) === teacherUid) {
        continue;
      }
      
      const container = remoteVideoRefs.current.get(String(uid));
      
      if (container && tracks.video) {
        try {
          if (tracks.video.isPlaying) {
            continue;
          }
          
          console.log(`▶️ Playing remote video ${uid}`);
          
          // ✅ Check container type
          if (container.tagName === 'VIDEO') {
            await tracks.video.play(container);
          } else {
            await tracks.video.play();
          }
          
          console.log(`✅ Remote video ${uid} playing`);
        } catch (error) {
          console.error(`❌ Failed to play remote ${uid}:`, error);
        }
      }
    }
  };

  playRemoteVideos();
}, [remoteTracks, teacherUid]);
  // ============================================
  // FIXED: Initialization - Run Once (From Second File)
  // ============================================
  useEffect(() => {
    if (initializationRef.current.joined) {
      return;
    }

    const init = async () => {
      try {
        await initializeSession();
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };

    init();

    return () => {
      if (initializationRef.current.joined) {
        cleanup();
      }
    };
  }, [meetingId, studentId]);

  
  useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && showParticipants) {
      setShowParticipants(false);
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [showParticipants]);
  // ============================================
  // FIXED: Sync Profiles with Tracks (From Second File)
  // ============================================
  useEffect(() => {
    if (remoteTracks.size > 0 && sessionState.isJoined) {
      syncProfilesWithTracks();
    }
  }, [remoteTracks, sessionState.isJoined]);

  useEffect(() => {
  const checkConnection = () => {
    // Simulate connection quality checks
    const qualities = ['good', 'fair', 'poor'];
    const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
    
    setConnectionStats(prev => ({
      ...prev,
      quality: randomQuality
    }));
    
    setStats(prev => ({
      ...prev,
      connectionQuality: randomQuality
    }));
  };
  
  const interval = setInterval(checkConnection, 15000);
  return () => clearInterval(interval);
}, []);
  // ============================================
  // FIXED: Participant Sync Interval (From Second File)
  // ============================================
  useEffect(() => {
    if (!sessionState.isJoined || !sessionState.sessionInfo?.meetingId) return;
    
    const syncInterval = setInterval(() => {
      fetchParticipants(sessionState.sessionInfo.meetingId);
    }, 15000);
    
    return () => clearInterval(syncInterval);
  }, [sessionState.isJoined, sessionState.sessionInfo?.meetingId]);

  // ============================================
  // FIXED: Helper Functions (From Second File)
  // ============================================
  const fetchParticipants = async (meetingId) => {
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
              name: participant.display_name || participant.name || 'Unknown User',
              display_name: participant.display_name || participant.name || 'Unknown User',
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
        
        setParticipants(response.participants);
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };
const toggleParticipants = () => {
  setShowParticipants(prev => !prev);
  
  // If opening participants panel, refresh participant list
  if (!showParticipants && sessionState.sessionInfo?.meetingId) {
    fetchParticipants(sessionState.sessionInfo.meetingId);
  }
};
  const syncProfilesWithTracks = () => {
    const remoteUids = Array.from(remoteTracks.keys()).map(uid => String(uid));
    const profileUids = Array.from(userProfiles.keys());
    
    const missingUids = remoteUids.filter(uid => !profileUids.includes(uid));
    
    if (missingUids.length > 0 && sessionState.sessionInfo?.meetingId) {
      fetchProfilesByUids(missingUids);
    }
  };

  const fetchProfilesByUids = async (uids) => {
    try {
      if (!sessionState.sessionInfo?.meetingId || !uids.length) return;
      
      const response = await studentvideoApi.getParticipantProfiles(
        sessionState.sessionInfo.meetingId,
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
              name: profile.name || profile.full_name || profile.display_name || 'User',
              display_name: profile.full_name || profile.name || profile.display_name || 'User',
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
      console.warn('Failed to fetch profiles by UIDs:', error);
    }
  };

  // ============================================
  // FIXED: Initialize Session with Proper Guards (From Second File)
  // ============================================

const updateProgress = (step, progress) => {
  setLoadingProgress({
    step,
    progress: Math.min(100, Math.max(0, progress)),
    showLoading: true
  });
};

// ============================================
// OPTIMIZED INITIALIZATION WITH PROGRESS TRACKING
// ============================================

const initializeSession = async () => {
  try {
    // ✅ Guard: Prevent duplicate initialization
    if (initializationRef.current.clientCreated) {
      console.log('✅ Client already created, skipping re-initialization');
      return;
    }

    console.log('🚀 Starting optimized initialization...');
    const initStart = Date.now();

    // ============================================
    // STEP 1: Initial Setup (0-20%)
    // ============================================
    setLoadingProgress({ step: 'Connecting to server...', progress: 10 });

    // Parallel device check and session lookup
    const [sessionLookup, devicesCheck] = await Promise.all([
      studentvideoApi.getSessionByClassId(classId),
      AgoraRTC.getDevices().catch(() => [])
    ]);
    
    console.log(`📊 Devices found: ${devicesCheck.length}`);
    
    if (!sessionLookup.success || !sessionLookup.exists || !sessionLookup.isActive) {
      throw new Error(sessionLookup.error || 'No active session found for this class');
    }

    const effectiveMeetingId = sessionLookup.meetingId;
    console.log(`✅ Session found: ${effectiveMeetingId}`);
    
    // ============================================
    // STEP 2: Create Agora Client (20-35%)
    // ============================================
    setLoadingProgress({ step: 'Setting up video connection...', progress: 25 });
    
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });
      initializationRef.current.clientCreated = true;
      console.log('✅ Agora client created');
    }

    // ============================================
    // STEP 3: Setup Event Listeners (35-45%)
    // ============================================
    setLoadingProgress({ step: 'Configuring connection...', progress: 35 });
    
    if (!initializationRef.current.listenersSet) {
      setupAgoraEventListeners();
      initializationRef.current.listenersSet = true;
      console.log('✅ Event listeners configured');
    }

    // ============================================
    // STEP 4: Join Session + Fetch Participants (45-70%)
    // ============================================
    setLoadingProgress({ step: 'Joining classroom...', progress: 50 });
    
    // Run in parallel for speed
    const [sessionData] = await Promise.all([
      studentvideoApi.joinVideoSession(effectiveMeetingId, studentId, 'student'),
      // Fire and forget - don't block on participants
      fetchParticipants(effectiveMeetingId).catch(err => {
        console.warn('⚠️ Participants fetch failed (non-critical):', err);
        return null;
      })
    ]);

    if (!sessionData.success || !sessionData.token) {
      throw new Error(sessionData.error || 'Failed to join session - invalid credentials');
    }

    const studentAgoraUid = sessionData.uid;
    console.log(`✅ Received Agora UID: ${studentAgoraUid}`);

    // ============================================
    // STEP 5: Update Session State (70-75%)
    // ============================================
    setLoadingProgress({ step: 'Finalizing setup...', progress: 70 });
    
    setSessionState({
      isInitialized: true,
      isJoined: false,
      sessionInfo: {
        ...sessionData,
        uid: studentAgoraUid,
        meetingId: effectiveMeetingId
      },
      error: null
    });

    console.log(`⚡ Phase 1 complete in ${Date.now() - initStart}ms`);

    // ============================================
    // STEP 6: Join Agora Channel (75-95%)
    // ============================================
    setLoadingProgress({ step: 'Starting video call...', progress: 80 });
    
    await joinChannel({
      ...sessionData,
      uid: studentAgoraUid
    });

    // ============================================
    // STEP 7: Complete! (95-100%)
    // ============================================
    setLoadingProgress({ step: 'Ready!', progress: 100 });
    
    const totalTime = Date.now() - initStart;
    console.log(`✅ 🎉 Initialization complete in ${totalTime}ms`);
    
    // Performance logging
    if (totalTime > 5000) {
      console.warn(`⚠️ Slow initialization: ${totalTime}ms (target: <5000ms)`);
    } else if (totalTime < 3000) {
      console.log(`🚀 Fast initialization: ${totalTime}ms`);
    }

  } catch (error) {
    console.error('❌ Initialization Error:', error);
    
    // Show error state
    setLoadingProgress({ 
      step: 'Connection failed', 
      progress: 0 
    });
    
    // Set error in session state
    setSessionState(prev => ({ 
      ...prev, 
      error: error.message || 'Failed to connect to classroom' 
    }));
  }
};
  // ============================================
  // FIXED: Setup Agora Event Listeners (From Second File)
  // ============================================
  const setupAgoraEventListeners = () => {
    const client = clientRef.current;
    if (!client) return;

    console.log('Setting up Agora event listeners');

    client.on('user-joined', async (user) => {
      console.log(`User joined: ${user.uid}`);
      const uid = String(user.uid);
      
      if (sessionState.sessionInfo && String(sessionState.sessionInfo.uid) === uid) {
        console.log('Skipping own user join event');
        return;
      }

      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(uid)) {
          newMap.set(uid, { audio: null, video: null });
        }
        return newMap;
      });

      updateParticipantCount();
    });

   client.on('user-published', async (user, mediaType) => {
  console.log(`User published: ${user.uid}, media: ${mediaType}`);
  
  // ✅ Detect screen share by checking track properties
  if (mediaType === 'video' && user.videoTrack) {
    const trackLabel = user.videoTrack.getTrackLabel ? user.videoTrack.getTrackLabel() : '';
    const isScreenShare = trackLabel.toLowerCase().includes('screen') || 
                         trackLabel.toLowerCase().includes('window');
    
    if (String(user.uid) === teacherUid && isScreenShare) {
      console.log('🖥️ Teacher is screen sharing');
      setTeacherScreenSharing(true);
    }
  }
try {
  console.log(`🔌 Subscribing to ${mediaType} from user ${user.uid}...`);
  const remoteTrack = await client.subscribe(user, mediaType);
  console.log(`✅ Subscribed to ${mediaType} of user ${user.uid}`);
  
  // ✅ CRITICAL: Store with multiple key formats for matching
  const uidString = String(user.uid);
  const uidNumber = Number(user.uid);
  
  // Check if this is the teacher
  const isTeacher = uidString === String(teacherUid) || 
                    uidNumber === Number(teacherUid) ||
                    user.uid === teacherUid;
  
  if (isTeacher) {
    console.log(`👨‍🏫 🎉 THIS IS THE TEACHER! UID: ${user.uid}, Media: ${mediaType}`);
  }
  
  setRemoteTracks(prev => {
    const newMap = new Map(prev);
    
    // ✅ CRITICAL: Store with ALL possible keys to ensure matching
    const keys = [user.uid, uidString, uidNumber];
    
    keys.forEach(key => {
      const existing = newMap.get(key) || { audio: null, video: null };
      
      if (mediaType === 'video') {
        existing.video = remoteTrack;
      } else if (mediaType === 'audio') {
        existing.audio = remoteTrack;
      }
      
      newMap.set(key, existing);
    });
    
    console.log(`📊 Stored tracks for keys:`, keys);
    console.log(`📈 Total remote tracks: ${newMap.size}`);
    
    return newMap;
  });
  
} catch (error) {
  console.error(`❌ Failed to subscribe to ${mediaType} of user ${user.uid}:`, error);
}
});


    client.on('user-unpublished', (user, mediaType) => {
      console.log(`User unpublished: ${user.uid}, media: ${mediaType}`);
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
      console.log(`User left: ${user.uid}`);
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

    client.on('connection-state-change', (curState, prevState) => {
      console.log(`Connection state change: ${prevState} -> ${curState}`);
      
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

  // ============================================
  // FIXED: Join Channel (From Second File)
  // ============================================
  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;

      if (!appId || appId.length !== 32) {
        throw new Error('Invalid App ID');
      }

      if (!channel) {
        throw new Error('Channel name is missing');
      }

      if (!token) {
        throw new Error('Token is missing');
      }

      console.log('Joining channel:', channel);

      if (initializationRef.current.joined) {
        console.log('Already joined channel, skipping');
        return;
      }

      const joinedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );
      
      console.log('Joined channel with UID:', joinedUid);
      initializationRef.current.joined = true;

      if (profilePollingRef.current) {
        clearInterval(profilePollingRef.current);
      }
      
      setTimeout(() => {
  profilePollingRef.current = setInterval(() => {
    if (sessionState.sessionInfo?.meetingId) {
      fetchParticipants(sessionState.sessionInfo.meetingId);
    }
  }, 10000);
}, 5000);

      // Use the improved createAndPublish
      await createLocalTracks();

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();
      
   updateParticipantStatus({ status: 'joined' }).catch(err =>
  console.warn('Status update failed:', err)
);

      // ============================================
      // CRITICAL FIX: Added back startMessagePolling call
      // ============================================
      if (sessionData.session?.id) {
        startMessagePolling(sessionData.session.id);
      }

    } catch (error) {
      console.error('Join channel error:', error);
      throw error;
    }
  };

  // ============================================
  // ⚠️ CRITICAL FIX #4: Improved Track Creation (From First File)
  // ============================================
const createLocalTracks = async () => {
  console.log('🔵 Creating local tracks - FAST VERSION');
  
  const startTime = Date.now();

  try {
    // ✅ OPTIMIZATION 7: Single attempt, fast timeout
    const [audioResult, videoResult] = await Promise.allSettled([
      // Audio track - 3 second timeout
      Promise.race([
        AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'speech_standard', // ✅ Faster than music_standard
          AEC: true,
          ANS: true,
          AGC: true
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Audio timeout')), 3000) // ✅ Reduced from 4s
        )
      ]).catch(() => null),
      
      // Video track - 3 second timeout, one attempt only
      Promise.race([
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: '480p_1', // ✅ Start with lower quality for speed
          facingMode: 'user'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Video timeout')), 3000) // ✅ Reduced from 5s
        )
      ]).catch(() => null) // ✅ Single attempt, no fallbacks
    ]);

    const audioTrack = audioResult.status === 'fulfilled' ? audioResult.value : null;
    const videoTrack = videoResult.status === 'fulfilled' ? videoResult.value : null;
    
    console.log(`📊 Tracks created in ${Date.now() - startTime}ms:`, {
      audio: !!audioTrack,
      video: !!videoTrack
    });

    // ✅ OPTIMIZATION 8: Don't fail if no tracks - allow audio-only or video-only
    // Just update state with whatever we have
    setLocalTracks({ audio: audioTrack, video: videoTrack });
    
    setControls(prev => ({
      ...prev,
      hasCamera: !!videoTrack,
      hasMicrophone: !!audioTrack,
      audioEnabled: !!audioTrack,
      videoEnabled: !!videoTrack
    }));

    const mode = audioTrack && videoTrack ? 'Audio + Video' : 
                 audioTrack ? 'Audio Only' :
                 videoTrack ? 'Video Only' : 'None';
    console.log(`📢 Mode: ${mode}`);

    // ✅ OPTIMIZATION 9: Publish in background, don't block UI
    if (clientRef.current) {
      const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
      
     if (tracksToPublish.length > 0) {
  await clientRef.current.publish(tracksToPublish);
  console.log(`✅ 🎉 TEACHER PUBLISHED ${tracksToPublish.length} track(s)!`);
  console.log(`   📹 Video: ${!!videoTrack}`);
  console.log(`   🎤 Audio: ${!!audioTrack}`);
  console.log(`   🆔 My UID: ${clientRef.current.uid}`);
} else {
  console.warn('⚠️ No tracks to publish!');
}
    }

    // ✅ OPTIMIZATION 10: Auto-play video asynchronously
    if (videoTrack && localVideoRef.current) {
      setTimeout(() => {
        videoTrack.play(localVideoRef.current).catch(() => {});
      }, 100); // Small delay for DOM to be ready
    }

    console.log(`✅ createLocalTracks completed: ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error('Track creation error:', error);
    // ✅ Don't throw - allow joining without tracks
    setLocalTracks({ audio: null, video: null });
  }
};
  // ============================================
  // Toggle Functions with Better Track Management 
  // ============================================

const toggleVideo = async () => {
  if (!localTracks.video || !controls.hasCamera) return;
  
  try {
    const newState = !controls.videoEnabled;
    
    // ✅ Use setEnabled() - does NOT destroy track
    await localTracks.video.setEnabled(newState);
    
    setControls(prev => ({ ...prev, videoEnabled: newState }));
    console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Failed to toggle video:', error);
  }
};

const toggleAudio = async () => {
  if (!localTracks.audio || !controls.hasMicrophone) return;
  
  try {
    const newState = !controls.audioEnabled;
    
    // ✅ Use setEnabled() - does NOT destroy track
    await localTracks.audio.setEnabled(newState);
    
    setControls(prev => ({ ...prev, audioEnabled: newState }));
    console.log(`🎤 Audio ${newState ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Failed to toggle audio:', error);
  }
};
  const toggleHandRaise = async () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    try {
      await updateParticipantStatus({ handRaised: newState });
      console.log(`✋ Hand ${newState ? 'raised' : 'lowered'}`);
      
      // Send message if session exists
      if (sessionState.sessionInfo?.session?.id) {
        sendMessage(
          newState ? '✋ Raised hand' : 'Lowered hand',
          'system'
        );
      }
    } catch (error) {
      console.error('Failed to toggle hand raise:', error);
    }
  };

 
  // ============================================
  // Duration Timer (From First File)
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

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // CRITICAL: Message Functions (From Second File)
  // ============================================
  const startMessagePolling = (sessionId) => {
    if (!sessionId) {
      console.warn('No session ID provided for message polling');
      return;
    }

    // Initial load
    loadMessages(sessionId);

    // Clear any existing interval
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }

    // Set up polling
    messagesPollIntervalRef.current = setInterval(() => {
      loadMessages(sessionId);
    }, 15000);
  };

  const loadMessages = async (sessionId) => {
    try {
      if (!sessionId) return;
      
      const msgs = await studentvideoApi.getSessionMessages(sessionId);
      setMessages(prev => {
        const newIds = new Set(msgs.map(m => m.id));
        const existing = prev.filter(m => !newIds.has(m.id));
        return [...existing, ...msgs].sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        );
      });
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const sendMessage = async (text = null, type = 'text') => {
    const messageText = text || newMessage.trim();
    if (!messageText || !sessionState.sessionInfo?.session?.id) return;

    try {
      const message = await studentvideoApi.sendMessage(
        sessionState.sessionInfo.session.id,
        studentId,
        messageText,
        type
      );

      setMessages(prev => [...prev, message]);
      if (!text) setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  // ============================================
  // Other Helper Functions (From Second File)
  // ============================================
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
      console.warn('Participant status update error:', error.message);
    }
  };

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

 // ============================================
// FIXED: Complete Cleanup Function with Screen Sharing
// ============================================
const cleanup = async () => {
  console.log('🧹 Starting comprehensive cleanup...');
  
  // Stop all intervals first
  if (durationIntervalRef.current) {
    clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = null;
  }
  
  if (messagesPollIntervalRef.current) {
    clearInterval(messagesPollIntervalRef.current);
    messagesPollIntervalRef.current = null;
  }
  
  if (profilePollingRef.current) {
    clearInterval(profilePollingRef.current);
    profilePollingRef.current = null;
  }

  // Clear any reaction timeouts
  Object.values(reactionTimeout).forEach(timeout => {
    if (timeout) clearTimeout(timeout);
  });

  // ============================================
  // Screen Sharing Cleanup (FIRST)
  // ============================================
  if (screenTrack) {
    try {
      console.log('🖥️ Cleaning up screen sharing track...');
      
      // Stop screen sharing first
      if (isScreenSharing) {
        console.log('📺 Stopping active screen share...');
        
        // Unpublish screen track
        if (clientRef.current) {
          try {
            await clientRef.current.unpublish(screenTrack);
            console.log('✅ Unpublished screen track');
          } catch (unpubError) {
            console.warn('⚠️ Could not unpublish screen track:', unpubError);
          }
        }
        
        // Close the screen track
        try {
          await screenTrack.close();
          console.log('✅ Closed screen track');
        } catch (closeError) {
          console.warn('⚠️ Could not close screen track:', closeError);
        }
        
        // Re-enable camera if available
        if (localTracks.video && controls.hasCamera && !controls.videoEnabled) {
          try {
            await localTracks.video.setEnabled(true);
            console.log('✅ Re-enabled camera after screen sharing');
          } catch (enableError) {
            console.warn('⚠️ Could not re-enable camera:', enableError);
          }
        }
        
        // Reset state
        setIsScreenSharing(false);
        setScreenTrack(null);
      }
      
    } catch (screenError) {
      console.error('❌ Screen sharing cleanup error:', screenError);
    }
  }

  // ============================================
  // Local Audio/Video Tracks Cleanup
  // ============================================
  try {
    console.log('🎤🎬 Cleaning up local tracks...');
    
    if (localTracks.audio) {
      try {
        // Stop playing
        if (localTracks.audio.isPlaying) {
          localTracks.audio.stop();
        }
        
        // Close track
        localTracks.audio.close();
        console.log('✅ Closed audio track');
      } catch (audioError) {
        console.warn('⚠️ Audio cleanup error:', audioError);
      }
    }
    
    if (localTracks.video) {
      try {
        // Stop playing
        if (localTracks.video.isPlaying) {
          localTracks.video.stop();
        }
        
        // Close track
        localTracks.video.close();
        console.log('✅ Closed video track');
      } catch (videoError) {
        console.warn('⚠️ Video cleanup error:', videoError);
      }
    }
    
    // Clear local tracks from state
    setLocalTracks({ audio: null, video: null });
    
  } catch (trackError) {
    console.error('❌ Local tracks cleanup error:', trackError);
  }

  // ============================================
  // Remote Tracks Cleanup
  // ============================================
  try {
    console.log('📡 Cleaning up remote tracks...');
    
    remoteTracks.forEach((tracks, uid) => {
      try {
        if (tracks.audio && tracks.audio.stop) {
          tracks.audio.stop();
        }
        if (tracks.video && tracks.video.stop) {
          tracks.video.stop();
        }
      } catch (remoteError) {
        console.warn(`⚠️ Error cleaning up remote track ${uid}:`, remoteError);
      }
    });
    
    // Clear remote tracks from state
    setRemoteTracks(new Map());
    
  } catch (remoteError) {
    console.error('❌ Remote tracks cleanup error:', remoteError);
  }

  // ============================================
  // Agora Client Cleanup
  // ============================================
  try {
    if (clientRef.current) {
      console.log('📡 Cleaning up Agora client...');
      
      // Check if we're in a channel
      const connectionState = clientRef.current.connectionState;
      console.log(`📶 Connection state before cleanup: ${connectionState}`);
      
      if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
        // Remove all event listeners first
        clientRef.current.removeAllListeners();
        
        // Leave channel with timeout protection
        try {
          const leavePromise = clientRef.current.leave();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Leave timeout')), 5000)
          );
          
          await Promise.race([leavePromise, timeoutPromise]);
          console.log('✅ Successfully left Agora channel');
        } catch (leaveError) {
          console.warn('⚠️ Could not leave channel gracefully:', leaveError);
        }
      }
      
      // Clear client reference
      clientRef.current = null;
    }
  } catch (clientError) {
    console.error('❌ Client cleanup error:', clientError);
  }

  // ============================================
  // Reset All Refs and State
  // ============================================
  console.log('🔄 Resetting all refs and state...');
  
  // Reset initialization ref
  initializationRef.current = {
    clientCreated: false,
    listenersSet: false,
    joined: false
  };

  // Clear video refs
  remoteVideoRefs.current.clear();
  
  // Reset local video track ref
  if (localVideoTrackRef.current) {
    try {
      localVideoTrackRef.current.stop();
    } catch (e) {
      // Ignore errors on already stopped track
    }
    localVideoTrackRef.current = null;
  }

  // Reset state
  setUserProfiles(new Map());
  setParticipants([]);
  setTeacherUid(null);
  setMessages([]);
  setNewMessage('');
  setShowChat(false);
  setShowParticipants(false);
  setShowSettings(false);
  setReactions([]);
  setAvailableDevices({
    cameras: [],
    microphones: [],
    speakers: []
  });
  setIsScreenSharing(false);
  setScreenTrack(null);

  // Reset controls to defaults
  setControls({
    audioEnabled: false,
    videoEnabled: false,
    handRaised: false,
    hasCamera: false,
    hasMicrophone: false
  });

  // Reset stats
  setStats({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown'
  });

  // Reset session state
  setSessionState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  console.log('✅ Complete cleanup finished');
};

// ============================================
// FIXED: Complete Leave Session Function
// ============================================
const leaveSession = async () => {
  try {
    console.log('🚪 Starting leave session process...');
    
    // Update participant status first
    if (sessionState.sessionInfo?.session?.id) {
      try {
        await updateParticipantStatus({ 
          status: 'left',
          left_at: new Date().toISOString(),
          screen_shared: isScreenSharing,
          hand_raised: controls.handRaised
        });
        console.log('✅ Participant status updated');
      } catch (statusError) {
        console.warn('⚠️ Could not update participant status:', statusError);
      }
    }

    // Stop screen sharing if active
    if (isScreenSharing) {
      console.log('🖥️ Stopping screen sharing before leaving...');
      
      try {
        // Create a dedicated stop function for leaving
        const stopScreenShareForLeave = async () => {
          if (screenTrack) {
            // Unpublish if client exists
            if (clientRef.current) {
              await clientRef.current.unpublish(screenTrack).catch(() => {});
            }
            
            // Close track
            await screenTrack.close().catch(() => {});
            
            // Re-enable camera
            if (localTracks.video && controls.hasCamera) {
              await localTracks.video.setEnabled(true).catch(() => {});
            }
          }
        };
        
        await stopScreenShareForLeave();
        console.log('✅ Screen sharing stopped');
      } catch (screenError) {
        console.warn('⚠️ Error stopping screen share on leave:', screenError);
      }
    }

    // End session on server (if meeting exists)
    if (sessionState.sessionInfo?.meetingId) {
      try {
        console.log('📡 Ending session on server...');
        await studentvideoApi.endSession(
          sessionState.sessionInfo.meetingId,
          studentId
        );
        console.log('✅ Server session ended');
      } catch (apiError) {
        console.warn('⚠️ Could not end session on server:', apiError);
        // Continue anyway - don't block cleanup
      }
    }

    // Perform comprehensive cleanup
    await cleanup();
    
    console.log('🎉 Session cleanup complete');

    // Call onLeaveCall callback if provided
    if (onLeaveCall && typeof onLeaveCall === 'function') {
      console.log('📞 Calling onLeaveCall callback');
      setTimeout(() => {
        onLeaveCall();
      }, 100); // Small delay to ensure cleanup is complete
    }

  } catch (error) {
    console.error('❌ Error in leaveSession:', error);
    
    // Try to clean up anyway
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error('❌ Emergency cleanup also failed:', cleanupError);
    }
    
    // Still call onLeaveCall if provided
    if (onLeaveCall && typeof onLeaveCall === 'function') {
      onLeaveCall();
    }
  }
};

// ============================================
// FIXED: Stop Screen Share Helper Function
// ============================================
const stopScreenShare = async (isLeaving = false) => {
  if (!screenTrack) return;
  
  try {
    console.log('🖥️ Stopping screen sharing...');
    
    // Unpublish screen track
    if (clientRef.current) {
      try {
        await clientRef.current.unpublish(screenTrack);
        console.log('✅ Unpublished screen track');
      } catch (unpubError) {
        if (!isLeaving) {
          console.warn('⚠️ Could not unpublish screen track:', unpubError);
        }
      }
    }
    
    // Close the track
    try {
      await screenTrack.close();
      console.log('✅ Closed screen track');
    } catch (closeError) {
      if (!isLeaving) {
        console.warn('⚠️ Could not close screen track:', closeError);
      }
    }
    
    // Re-enable camera if available (unless leaving)
    if (!isLeaving && localTracks.video && controls.hasCamera) {
      try {
        await localTracks.video.setEnabled(true);
        console.log('✅ Re-enabled camera');
      } catch (enableError) {
        console.warn('⚠️ Could not re-enable camera:', enableError);
      }
    }
    
    // Reset state
    if (!isLeaving) {
      setScreenTrack(null);
      setIsScreenSharing(false);
    }
    
    console.log('✅ Screen sharing stopped successfully');
    
  } catch (error) {
    console.error('❌ Error stopping screen share:', error);
    throw error;
  }
};

// ============================================
// FIXED: Toggle Screen Share with Updated Error Handling
// ============================================
const toggleScreenShare = async () => {
  try {
    if (isScreenSharing) {
      // Stop screen sharing
      await stopScreenShare(false);
      sendMessage('Stopped screen sharing', 'system');
      
    } else {
      // Start screen sharing
      console.log('🖥️ Starting screen share...');
      
      // Disable camera video temporarily
      if (localTracks.video) {
        await localTracks.video.setEnabled(false);
      }
      
      // Create screen track with comprehensive options
      const screenTrackConfig = {
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 15,
          bitrateMin: 1000,
          bitrateMax: 3000,
        },
        optimizationMode: 'detail',
        screenSourceType: 'screen' // 'screen', 'window', 'application'
      };
      
      const newScreenTrack = await AgoraRTC.createScreenVideoTrack(screenTrackConfig, 'auto');
      
      // Handle both single track and array of tracks
      const track = Array.isArray(newScreenTrack) ? newScreenTrack[0] : newScreenTrack;
      
      // Publish screen track
      if (clientRef.current) {
        await clientRef.current.publish(track);
      }
      
      // Set state and refs
      setScreenTrack(track);
      setIsScreenSharing(true);
      console.log('✅ Screen sharing started');
      
      // Send notification
      sendMessage('Started screen sharing', 'system');
      
      // Handle screen sharing stop events
      track.on('track-ended', async () => {
        console.log('🖥️ Screen sharing ended by browser/user');
        await stopScreenShare(false);
        sendMessage('Screen sharing ended', 'system');
      });
      
      track.on('track-updated', () => {
        console.log('🖥️ Screen track updated');
      });
    }
    
  } catch (error) {
    console.error('❌ Screen share error:', error);
    
    // Reset state on error
    setIsScreenSharing(false);
    setScreenTrack(null);
    
    // Re-enable camera if screen share fails
    if (localTracks.video && controls.hasCamera) {
      await localTracks.video.setEnabled(true);
    }
    
    // Show user-friendly error
    let errorMessage = 'Failed to share screen';
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Screen sharing permission denied';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No screen sharing source available';
    } else if (error.message?.includes('extension')) {
      errorMessage = 'Screen sharing extension required';
    }
    
    sendMessage(`⚠️ ${errorMessage}`, 'system');
  }
};

// ============================================
// FIXED: Component Unmount Cleanup
// ============================================
useEffect(() => {
  return () => {
    console.log('🧹 Component unmounting - starting cleanup...');
    
    // We can't use async directly in cleanup, so we create a sync wrapper
    const performCleanup = async () => {
      try {
        await cleanup();
      } catch (error) {
        console.error('❌ Unmount cleanup error:', error);
      }
    };
    
    // Fire and forget - we can't await in cleanup
    performCleanup();
  };
}, []);

  // ============================================
  // Update Stats 
  // ============================================
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      participantCount: remoteTracks.size + 1
    }));
  }, [remoteTracks]);

  // ============================================
  // Render - Error States (From Second File)
  // ============================================
  if (sessionState.error) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="bg-gray-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Cannot Join Session</h2>
          <p className="mb-6 text-gray-300">{sessionState.error}</p>
          <button 
            onClick={() => onLeaveCall && onLeaveCall()}
            className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-xl font-semibold transition-all duration-200"
          >
            Go Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

 if (!sessionState.isJoined) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin h-20 w-20 border-b-2 border-cyan-500 rounded-full mx-auto mb-6"></div>
        <h3 className="text-2xl font-semibold mb-3">Joining Session...</h3>
        <p className="text-gray-400">Connecting to video call</p>
      </div>
    </div>
  );
}

const teacherProfile = teacherUid ? userProfiles.get(teacherUid) : null;
 
  // ============================================
  // Main Render - Only show when joined
  // ============================================
  return (
    <div className="fixed inset-0 z-50 bg-black">
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
      {/* Main Video Area - Teacher's Video or Screen Share */}
   {/* Main Video Area - Teacher's Video */}
   {/* Main Video Area - Teacher's Video */}
<div className="absolute inset-0">
  <div className="relative w-full h-full bg-black">
    {/* Teacher Video */}
      <div
        ref={el => {
          if (!el) return;
          
          console.log('🎬 Teacher video container ref attached');
          
          // Store with ALL possible key formats
          const keys = [
            teacherUid,
            String(teacherUid),
            Number(teacherUid)
          ].filter(k => k !== null && k !== undefined);
          
          keys.forEach(key => {
            remoteVideoRefs.current.set(key, el);
          });
          
          console.log('  📺 Stored refs for keys:', keys);
          
          // ✅ SAFE PLAYBACK: Check everything exists before calling
          const videoTrack = teacherTracks?.video;
          
          if (videoTrack && typeof videoTrack.play === 'function') {
            // Check if already playing
            if (videoTrack.isPlaying) {
              console.log('  ✅ Already playing');
              return;
            }
            
            console.log('  ▶️ Playing immediately from ref callback');
            
            // Call play and handle the promise safely
            const playPromise = videoTrack.play(el);
            
            // ✅ CRITICAL: Check if play() returned a promise
            if (playPromise && typeof playPromise.then === 'function') {
              playPromise
                .then(() => {
                  console.log('  ✅ Playing!');
                })
                .catch(err => {
                  console.error('  ❌ Play failed:', err);
                  
                  // Retry after delay
                  setTimeout(() => {
                    const track = teacherTracks?.video;
                    if (track && typeof track.play === 'function' && !track.isPlaying) {
                      const retryPromise = track.play(el);
                      if (retryPromise && typeof retryPromise.then === 'function') {
                        retryPromise.catch(retryErr => {
                          console.error('  ❌ Retry failed:', retryErr);
                        });
                      }
                    }
                  }, 500);
                });
            } else {
              console.warn('  ⚠️ play() did not return a promise');
            }
          } else {
            console.warn('  ⚠️ Invalid video track:', {
              hasTrack: !!videoTrack,
              hasPlayMethod: videoTrack && typeof videoTrack.play === 'function'
            });
          }
        }}
        className="w-full h-full bg-black teacher-video-container"
        style={{
          width: '100%',
          height: '100%'
        }}
      />
    ) : (
      /* No Teacher Video Fallback */
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
        <div className="text-center max-w-md px-4">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4 mx-auto">
            <span className="text-6xl">👨‍🏫</span>
          </div>
          <p className="text-cyan-300 text-xl font-semibold mb-2">
            {teacherProfile?.name || 'Teacher'}
          </p>
          <p className="text-cyan-400/60 text-sm mb-4">
            {teacherTracks?.audio ? '🎤 Audio only' : '⏳ Connecting...'}
          </p>
          
          {/* Debug Panel */}
          <div className="mt-6 p-4 bg-black/50 rounded-lg text-left text-xs font-mono">
            <div className="font-bold text-cyan-300 mb-2">📊 Debug Info:</div>
            <div className="text-gray-400 space-y-1">
              <div>Teacher UID: <span className="text-white">{teacherUid || '❌ Not set'}</span></div>
              <div>Teacher UID Type: <span className="text-white">{typeof teacherUid}</span></div>
              <div>Video Track: <span className={teacherTracks?.video ? 'text-green-400' : 'text-red-400'}>
                {teacherTracks?.video ? '✅ Available' : '❌ Missing'}
              </span></div>
              <div>Audio Track: <span className={teacherTracks?.audio ? 'text-green-400' : 'text-red-400'}>
                {teacherTracks?.audio ? '✅ Available' : '❌ Missing'}
              </span></div>
              <div>Remote Tracks Total: <span className="text-white">{remoteTracks.size}</span></div>
              
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="font-bold text-yellow-300 mb-1">All Remote Users:</div>
                {remoteTracks.size === 0 ? (
                  <div className="text-red-400">No remote users connected</div>
                ) : (
                  Array.from(remoteTracks.entries()).map(([uid, tracks]) => (
                    <div key={uid} className="text-gray-400">
                      UID: {uid} (type: {typeof uid})
                      <span className={tracks.video ? 'text-green-400' : 'text-red-400'}> V:{tracks.video ? '✓' : '✗'}</span>
                      <span className={tracks.audio ? 'text-green-400' : 'text-red-400'}> A:{tracks.audio ? '✓' : '✗'}</span>
                      {String(uid) === String(teacherUid) && <span className="text-cyan-400"> ← TEACHER</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    
    {/* Screen Share Indicator */}
    {teacherScreenSharing && (
      <div className="absolute top-4 left-4 z-10 bg-black/70 text-white px-3 py-2 rounded-lg flex items-center gap-2">
        <Share2 size={16} />
        <span className="text-sm font-medium">Teacher is sharing screen</span>
      </div>
    )}
  </div>
  </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-lg p-4 lg:p-6 z-30 border-b border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm lg:text-base">Live Class</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Clock size={16} />
              <span className="text-sm lg:text-base font-mono">{formatDuration(stats.duration)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden lg:flex items-center gap-2 bg-gray-800/50 px-3 py-2 rounded-xl">
              <Users size={16} className="text-cyan-400" />
              <span className="text-white text-sm">{stats.participantCount}</span>
            </div>
            
            <button
              onClick={() => setShowChat(!showChat)}
              className="relative p-2 lg:p-3 bg-gray-800/50 hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
            >
              <MessageCircle size={18} className="text-cyan-300" />
              {messages.length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">{messages.length > 9 ? '9+' : messages.length}</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

{/* Quick Access Top Right Controls */}
<div className="absolute top-4 right-4 z-30">
  <div className="flex items-center gap-2">
    {/* Fullscreen Toggle */}
    <button 
      onClick={toggleFullscreen}
      className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-white transition-all duration-200"
      title="Fullscreen"
    >
      <ChevronUp size={18} className="transform rotate-45" />
    </button>
    
    {/* Connection Quality Indicator */}
    <div className="flex items-center gap-1.5 bg-gray-900/70 backdrop-blur-sm px-3 py-1.5 rounded-xl">
      <div className={`w-2 h-2 rounded-full ${
        stats.connectionQuality === 'good' ? 'bg-green-500 animate-pulse' :
        stats.connectionQuality === 'fair' ? 'bg-yellow-500' :
        'bg-red-500'
      }`} />
      <span className="text-white text-xs font-medium">
        {stats.connectionQuality === 'good' ? 'Good' :
         stats.connectionQuality === 'fair' ? 'Fair' : 'Poor'}
      </span>
    </div>
  </div>
</div>
    {/* Enhanced Desktop Controls - Centered Floating Bar */}
<div className="hidden lg:flex absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 border border-cyan-500/30 shadow-2xl z-30">
  <div className="flex items-center gap-2">
    {/* Audio Control */}
    <button
      onClick={toggleAudio}
      disabled={!controls.hasMicrophone}
      className={`p-3 rounded-xl transition-all duration-200 ${
        controls.audioEnabled 
          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
          : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white'
      } ${!controls.hasMicrophone ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={controls.audioEnabled ? "Mute" : "Unmute"}
    >
      {controls.audioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
    </button>
    
    {/* Video Control */}
    <button
      onClick={toggleVideo}
      disabled={!controls.hasCamera}
      className={`p-3 rounded-xl transition-all duration-200 ${
        controls.videoEnabled 
          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
          : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white'
      } ${!controls.hasCamera ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={controls.videoEnabled ? "Turn off camera" : "Turn on camera"}
    >
      {controls.videoEnabled ? <Camera size={22} /> : <CameraOff size={22} />}
    </button>
    
    {/* Screen Share */}
    <button
      onClick={toggleScreenShare}
      className="p-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200"
      title="Share screen"
    >
      <Share2 size={22} />
    </button>
    
    {/* Hand Raise */}
    <button 
      onClick={toggleHandRaise}
      className={`p-3 rounded-xl transition-all duration-200 ${
        controls.handRaised 
          ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white animate-pulse' 
          : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
      }`}
      title={controls.handRaised ? "Lower hand" : "Raise hand"}
    >
      <Hand size={22} />
    </button>
    
    {/* Participants Toggle */}
<button 
  onClick={toggleParticipants}
  className={`p-3 rounded-xl transition-all duration-200 ${
    showParticipants 
      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
      : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
  }`}
  title="Participants"
>
  <Users size={22} />
  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
    {stats.participantCount}
  </span>
</button>
    
    {/* Settings/More */}
    <button 
      onClick={toggleSettings}
      className="p-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200"
      title="Settings"
    >
      <MoreVertical size={22} />
    </button>
    
    {/* End Call Button - Prominent */}
    <button 
      onClick={leaveSession}
      className="p-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg shadow-red-500/30 transition-all duration-200 ml-2"
      title="Leave call"
    >
      <PhoneOff size={22} />
    </button>
  </div>
</div>


     {/* Enhanced Mobile Controls */}
<div className="lg:hidden absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent backdrop-blur-lg p-4 border-t border-cyan-500/30 z-30">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {/* Audio */}
      <button
        onClick={toggleAudio}
        disabled={!controls.hasMicrophone}
        className={`p-3 rounded-xl ${
          controls.audioEnabled 
            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
            : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
        }`}
      >
        {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>
      
      {/* Video */}
      <button
        onClick={toggleVideo}
        disabled={!controls.hasCamera}
        className={`p-3 rounded-xl ${
          controls.videoEnabled 
            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
            : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
        }`}
      >
        {controls.videoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
      </button>
      
      {/* Hand Raise */}
      <button 
        onClick={toggleHandRaise}
        className={`p-3 rounded-xl ${
          controls.handRaised 
            ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white animate-pulse' 
            : 'bg-gradient-to-r from-gray-700 to-gray-800 text-white'
        }`}
      >
        <Hand size={20} />
      </button>
      
      {/* Participants */}
      <button 
        onClick={toggleParticipants}
        className="p-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 text-white relative"
      >
        <Users size={20} />
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {stats.participantCount}
        </span>
      </button>
    </div>
    
    {/* End Call - Mobile */}
    <button 
      onClick={leaveSession}
      className="p-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white"
    >
      <PhoneOff size={20} />
    </button>
  </div>
  
  {/* Mobile Quick Reactions Row */}
  <div className="flex items-center justify-center gap-2 mt-3">
    <button 
      onClick={() => sendReaction('👍')}
      className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
    >
      👍
    </button>
    <button 
      onClick={() => sendReaction('👏')}
      className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
    >
      👏
    </button>
    <button 
      onClick={() => sendReaction('🎉')}
      className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
    >
      🎉
    </button>
    <button 
      onClick={() => sendReaction('🙋')}
      className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
    >
      🙋
    </button>
  </div>
</div>

      {/* Chat Sidebar */}
           {showChat && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50">
 <div className="p-4 border-b border-cyan-500/20 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white">Chat</h3>
              <p className="text-cyan-300 text-xs">Live Class</p>
            </div>
            <button 
              onClick={() => setShowChat(false)}
              className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <MessageCircle className="mx-auto mb-4 opacity-50" size={48} />
                <p className="text-lg font-semibold">No messages yet</p>
                <p className="text-sm mt-2">Be the first to say hello!</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="p-3 rounded-xl bg-gray-800/50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold text-white text-sm">
                          {msg.profiles?.name || msg.profiles?.full_name || 'Unknown User'}
                        </div>
                        {msg.message_type === 'system' && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-cyan-100 text-sm">{msg.message_text}</p>
                      <p className="text-cyan-400 text-xs mt-2">
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 border-t border-cyan-500/20">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-800/50 border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm"
              />
              <button 
                onClick={() => sendMessage()}
                disabled={!newMessage.trim()}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl font-semibold text-white transition-all duration-200 text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

     

{/* Participants Overlay for All Screen Sizes */}
{showParticipants && (
  <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 overflow-hidden flex flex-col">
    {/* Header */}
    <div className="p-4 lg:p-6 border-b border-cyan-500/30 bg-gradient-to-b from-black/80 to-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-xl">
            <Users size={24} className="text-cyan-300" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white">Participants</h2>
            <p className="text-cyan-300 text-sm">
              {Array.from(remoteTracks.entries()).filter(([uid]) => {
                const uidString = uid.toString();
                const profile = userProfiles.get(uidString);
                return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
              }).length + 1} online • {stats.participantCount} total
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter buttons - Desktop only */}
          <div className="hidden lg:flex items-center gap-2 bg-gray-800/50 rounded-xl p-1">
            <button
              onClick={() => setParticipantsFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                participantsFilter === 'all' 
                  ? 'bg-cyan-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setParticipantsFilter('teachers')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                participantsFilter === 'teachers' 
                  ? 'bg-cyan-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Teachers
            </button>
            <button
              onClick={() => setParticipantsFilter('students')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                participantsFilter === 'students' 
                  ? 'bg-cyan-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Students
            </button>
          </div>
          
          {/* Sort dropdown - Mobile */}
          <div className="lg:hidden">
            <select
              value={participantsSort}
              onChange={(e) => setParticipantsSort(e.target.value)}
              className="bg-gray-800/50 border border-cyan-500/30 rounded-xl px-3 py-2 text-white text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="role">Sort by Role</option>
              <option value="joinTime">Sort by Join Time</option>
            </select>
          </div>
          
          {/* Close button */}
          <button 
            onClick={() => setShowParticipants(false)}
            className="p-2 lg:p-3 bg-gray-800/50 hover:bg-red-500/20 rounded-xl text-cyan-300 hover:text-white transition-all duration-200 ml-2"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>

    {/* Participants Grid */}
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      {getSortedParticipants().length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center py-12">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-800/50 to-cyan-500/10 flex items-center justify-center mb-6">
            <Users size={48} className="text-cyan-500/50" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Participants</h3>
          <p className="text-cyan-300/60 text-sm max-w-md">
            Participants will appear here when they join the session
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {getSortedParticipants().map((participant, index) => {
            const isCurrentUser = participant.uid === String(sessionState.sessionInfo?.uid || studentId);
            const isTeacher = participant.isTeacher;
            const displayName = participant.profile?.name || 
                              participant.profile?.display_name || 
                              (isCurrentUser ? 'You' : 'Participant');
            
            return (
              <div
                key={participant.uid}
                className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300"
              >
                {/* Video/Avatar Container */}
                <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-950">
{/* Participant Video Container */}
{participant.tracks.video && participant.hasVideo ? (
  <div 
    ref={el => {
      if (!el) return;
      
      // Store with multiple key formats
      const keys = [
        participant.uid,
        String(participant.uid),
        Number(participant.uid)
      ].filter(k => k !== null && k !== undefined);
      
      keys.forEach(key => {
        remoteVideoRefs.current.set(key, el);
      });
      
      console.log(`👤 Stored video ref for participant ${participant.uid}`);
      
      // ✅ SAFE PLAYBACK
      const videoTrack = participant.tracks?.video;
      
      if (videoTrack && typeof videoTrack.play === 'function' && !videoTrack.isPlaying) {
        const playPromise = videoTrack.play(el);
        
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => console.log(`✅ Participant ${participant.uid} video playing`))
            .catch(err => {
              console.error(`❌ Participant ${participant.uid} play failed:`, err);
            });
        }
      }
    }}
    className="w-full h-full bg-black relative overflow-hidden"
    style={{ width: '100%', height: '100%' }}
  >
    {/* Ensure video element fills container properly */}
    <style jsx>{`
      div > video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border-radius: 0 !important;
      }
    `}</style>
  </div>
) : (
  /* Fallback Avatar */
  <div className="w-full h-full flex items-center justify-center">
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
      <span className="text-3xl">
        {isTeacher ? '👨‍🏫' : isCurrentUser ? '👤' : '🎓'}
      </span>
    </div>
  </div>
)}
                  
                  {/* Status Overlay */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      participant.hasAudio ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    {isCurrentUser && (
                      <span className="bg-cyan-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        YOU
                      </span>
                    )}
                    {isTeacher && (
                      <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        TEACHER
                      </span>
                    )}
                  </div>
                  
                  {/* Video/Audio Status */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                    {!participant.hasVideo && (
                      <div className="bg-black/70 backdrop-blur-sm p-1.5 rounded-lg">
                        <CameraOff size={14} className="text-gray-300" />
                      </div>
                    )}
                    {!participant.hasAudio && (
                      <div className="bg-black/70 backdrop-blur-sm p-1.5 rounded-lg">
                        <MicOff size={14} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Participant Info */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white truncate text-sm lg:text-base">
                      {displayName}
                    </h4>
                    {participant.handRaised && (
                      <Hand size={16} className="text-yellow-400 animate-pulse" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isTeacher 
                          ? 'bg-purple-500/20 text-purple-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {isTeacher ? 'Teacher' : 'Student'}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {participant.hasVideo ? 'Video On' : 'Video Off'}
                      </span>
                    </div>
                    
                    {/* Admin actions - only for teachers/own user */}
                    {!isCurrentUser && isTeacher && (
                      <button
                        onClick={() => kickParticipant(participant.uid)}
                        className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 hover:bg-red-500/10 rounded-lg"
                        title="Remove participant"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* Footer Controls */}
    <div className="p-4 lg:p-6 border-t border-cyan-500/30 bg-gradient-to-t from-black/80 to-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm">
              {getSortedParticipants().filter(p => p.hasAudio).length} speaking
            </span>
          </div>
          <div className="hidden lg:block text-cyan-300 text-sm">
            Press <kbd className="px-2 py-1 bg-gray-800/50 rounded-lg text-xs">ESC</kbd> to close
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Copy participant list */}
          <button
            onClick={() => {
              const participantNames = getSortedParticipants()
                .map(p => p.profile?.name || 'Participant')
                .join(', ');
              navigator.clipboard.writeText(participantNames);
              sendMessage('Copied participant list', 'system');
            }}
            className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-white text-sm transition-all"
          >
            Copy List
          </button>
          
          {/* Refresh button */}
          <button
            onClick={() => fetchParticipants(sessionState.sessionInfo?.meetingId)}
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl text-cyan-300 text-sm transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Settings Panel */}
{showSettings && (
  <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50">
    <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden">
      <div className="p-6 border-b border-cyan-500/20">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Settings</h3>
          <button 
            onClick={() => setShowSettings(false)}
            className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <div className="p-6 space-y-4">
        <div className="space-y-3">
          <h4 className="font-semibold text-white">Audio Settings</h4>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-300 text-sm">Microphone: {controls.hasMicrophone ? 'Available' : 'Not available'}</p>
            <p className="text-gray-300 text-sm mt-1">Status: {controls.audioEnabled ? 'On' : 'Off'}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-semibold text-white">Video Settings</h4>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-300 text-sm">Camera: {controls.hasCamera ? 'Available' : 'Not available'}</p>
            <p className="text-gray-300 text-sm mt-1">Status: {controls.videoEnabled ? 'On' : 'Off'}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-semibold text-white">Connection</h4>
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
            <p className="text-gray-300 text-sm">Quality: {stats.connectionQuality}</p>
            <p className="text-gray-300 text-sm">Participants: {stats.participantCount}</p>
            <p className="text-gray-300 text-sm">Duration: {formatDuration(stats.duration)}</p>
          </div>
        </div>
        
        <button 
          onClick={leaveSession}
          className="w-full mt-6 p-4 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-semibold transition-all duration-200"
        >
          Leave Call
        </button>
      </div>
    </div>
  </div>
)}

{/* ⚠️ CRITICAL FIX #5: PIP with Better Rendering - ENLARGED */}
{(controls.hasCamera || controls.hasMicrophone) && (
  <div 
    ref={pipRef}
    style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: '340px', 
      height: '255px', 
      zIndex: 99999,
      cursor: isDragging ? 'grabbing' : 'grab',
      transition: isDragging ? 'none' : 'all 0.2s ease',
      touchAction: 'none',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(6, 182, 212, 0.3)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}
    onMouseDown={handleMouseDown}
    onTouchStart={handleTouchStart}
    className={`local-video-pip ${isDragging ? 'local-video-pip-dragging' : ''}`}
  >
    <div className="relative w-full h-full bg-black">
      {/* Video Container - Full Size with Better Styling */}
      <div className="w-full h-full relative">
        {/* Local Video Display */}
        <div 
          ref={localVideoRef}
          className="w-full h-full bg-black"
          style={{ 
            transform: 'scaleX(-1)', // Mirror for self-view
            borderRadius: '10px',
            overflow: 'hidden'
          }}
        />
        
        {/* Placeholder when video is off */}
        {(!controls.videoEnabled || !localTracks.video) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
            <div className="text-center p-4">
              <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <CameraOff className="text-gray-400 w-8 h-8" />
              </div>
              <p className="text-gray-400 text-sm font-medium">Camera Off</p>
              <p className="text-gray-500 text-xs mt-1">Tap to enable</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Status Indicator - Bottom Left */}
      <div className="absolute bottom-3 left-3 z-10">
        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/10 shadow-lg">
          <div className={`w-3 h-3 rounded-full ${
            controls.audioEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`} />
          <span className="text-white text-xs font-bold tracking-wider">YOU</span>
          {controls.videoEnabled && (
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1" />
          )}
        </div>
      </div>
      
      {/* Drag Handle - Top Center */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 no-drag">
        <div className="w-12 h-1.5 bg-white/30 rounded-full"></div>
      </div>
    </div>
    
    {/* Optional: Add a subtle glow effect when video is active */}
    {controls.videoEnabled && localTracks.video && (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 border border-cyan-500/20 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)]"></div>
      </div>
    )}
  </div>
)}
    </div>
    </div>
  );
};

export default StudentVideoCall;