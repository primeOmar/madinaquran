// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import AgoraRTC from 'agora-rtc-sdk-ng';
import studentApi from '../lib/studentApi';
import {
  FileText,
  CreditCard,
  ClipboardList,
  BookOpen,
  Signal,
  Clock,
  User,
  Users,
  Calendar,
  VideoOff,
  Layout,
  Award,
  RefreshCw,
  BarChart3,
  Download,
  Upload,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Mail,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Loader2,
  TrendingUp,
  Video,
  MessageCircle,
  ShieldCheck,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Crown,
  Zap,
  Rocket,
  Sparkles,
  Target,
  Star,
  Gem,
  Hand,
  Maximize2,
  Minimize2
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

// === AI-POWERED UTILITY FUNCTIONS ===
const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Microphone access required for audio submissions');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setAudioUrl('');
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    recordingTime: formatTime(recordingTime),
    startRecording,
    stopRecording,
    clearRecording,
    hasRecording: !!audioBlob
  };
};

const uploadAudioToSupabase = async (audioBlob, fileName) => {
  try {
    const audioFile = new File([audioBlob], fileName, {
      type: 'audio/webm',
      lastModified: Date.now()
    });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }

    const { data, error } = await supabase.storage
    .from('assignment-audio')
    .upload(fileName, audioFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'audio/webm'
    });

    if (error) throw error;

    const { data: urlData } = supabase.storage
    .from('assignment-audio')
    .getPublicUrl(fileName);

    return {
      storagePath: data.path,
      publicUrl: urlData.publicUrl
    };

  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// StudentVideoCall Component
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import studentApi from '../lib/studentApi';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Users, AlertCircle, Loader2, Hand,
  Maximize2, Minimize2
} from 'lucide-react';

const StudentVideoCall = ({ classItem, isOpen, onClose }) => {
  // ============================================================================
  // LAYOUT SYSTEM
  // ============================================================================

  const getOptimalLayout = useCallback(() => {
    const remoteUsersArray = Array.from(remoteUsers.values());
    const teacher = remoteUsersArray.find(u => u.isTeacher);
    const screenShare = remoteUsersArray.find(u => u.isScreenShare);
    const students = remoteUsersArray.filter(u => !u.isTeacher && !u.isScreenShare);

    if (screenShare) {
      return {
        type: 'screenshare',
        mainVideo: screenShare,
        sidebarVideos: [teacher, ...students].filter(Boolean)
      };
    }

    if (isPinned) {
      const pinnedUser = remoteUsersArray.find(u => u.uid === isPinned);
      if (pinnedUser) {
        return {
          type: 'pinned',
          mainVideo: pinnedUser,
          sidebarVideos: remoteUsersArray.filter(u => u.uid !== isPinned)
        };
      }
    }

    if (teacher) {
      return {
        type: 'spotlight',
        mainVideo: teacher,
        sidebarVideos: students
      };
    }

    return {
      type: 'grid',
      allVideos: remoteUsersArray
    };
  }, [remoteUsers, isPinned]);

  const renderVideoLayout = useCallback(() => {
    const layout = getOptimalLayout();

    if (layout.type === 'grid') {
      const allVideos = [{ type: 'local' }, ...layout.allVideos];

      const getGridClasses = () => {
        const count = allVideos.length;
        if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
        if (count <= 4) return 'grid-cols-2';
        if (count <= 6) return 'grid-cols-2 sm:grid-cols-3';
        return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
      };

      return (
        <div className={`h-full grid ${getGridClasses()} gap-3 p-3 overflow-y-auto`}>
        {allVideos.map((item) => (
          <div key={item.type === 'local' ? 'local' : item.uid} className="aspect-video">
          {item.type === 'local' ? (
            <LocalVideoPlayer />
          ) : (
            <RemoteVideoPlayer user={item} />
          )}
          </div>
        ))}
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col lg:flex-row gap-3 p-3">
      <div className="flex-1 min-h-0 relative">
      <RemoteVideoPlayer user={layout.mainVideo} />

      {layout.type === 'screenshare' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-orange-600/90 text-white px-4 py-2 rounded-lg text-sm font-semibold backdrop-blur-sm z-10 flex items-center gap-2">
        <Maximize2 size={16} />
        <span>Presentation Mode</span>
        </div>
      )}
      </div>

      <div className="lg:w-64 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto">
      <div className="w-48 h-36 lg:w-full lg:h-48 flex-shrink-0">
      <LocalVideoPlayer />
      </div>

      {layout.sidebarVideos.map(user => (
        <div key={user.uid} className="w-48 h-36 lg:w-full lg:h-48 flex-shrink-0 relative group">
        <RemoteVideoPlayer user={user} />

        {!user.isScreenShare && (
          <button
          onClick={() => setIsPinned(isPinned === user.uid ? null : user.uid)}
          className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"
          title={isPinned === user.uid ? 'Unpin' : 'Pin to main'}
          >
          {isPinned === user.uid ? (
            <Minimize2 size={14} className="text-white" />
          ) : (
            <Maximize2 size={14} className="text-white" />
          )}
          </button>
        )}
        </div>
      ))}
      </div>
      </div>
    );
  }, [getOptimalLayout, isPinned]);

  // ============================================================================
  // CONTROL ACTIONS
  // ============================================================================

  const toggleAudio = useCallback(async () => {
    if (!localTracksRef.current.audio) {
      setError('Microphone not available');
      return;
    }

    try {
      const newState = !isAudioMuted;
      await localTracksRef.current.audio.setEnabled(newState);
      setIsAudioMuted(!newState);
      debugLog(`🎤 Audio ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      debugError('Toggle audio error:', error);
      setError('Failed to toggle microphone');
    }
  }, [isAudioMuted, debugLog, debugError]);

  const toggleVideo = useCallback(async () => {
    if (!localTracksRef.current.video) {
      setError('Camera not available');
      return;
    }

    try {
      const newVideoState = !isVideoOff;

      await localTracksRef.current.video.setEnabled(!newVideoState);
      setIsVideoOff(newVideoState);

      debugLog(`📹 Video ${newVideoState ? 'disabled' : 'enabled'}`);

      if (!newVideoState && !localVideoReady) {
        await setupLocalVideo(localTracksRef.current.video);
      }

    } catch (error) {
      debugError('Toggle video error:', error);
      setError('Failed to toggle camera');
    }
  }, [isVideoOff, localVideoReady, setupLocalVideo, debugLog, debugError]);

  const raiseHand = useCallback(async () => {
    try {
      const newState = !isHandRaised;
      setIsHandRaised(newState);
      debugLog(`✋ Hand ${newState ? 'raised' : 'lowered'}`);

      if (classItem?.video_session?.meeting_id) {
        await studentApi.raiseHand(classItem.video_session.meeting_id, newState);
      }
    } catch (error) {
      debugError('Raise hand error:', error);
    }
  }, [isHandRaised, classItem, debugLog, debugError]);

  const leaveCall = useCallback(async () => {
    debugLog('🚪 Leaving call...');
    await performCompleteCleanup();
    onClose();
  }, [performCompleteCleanup, onClose, debugLog]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const updateParticipantsList = useCallback(() => {
    const remoteUsersArray = Array.from(remoteUsers.values());
    const newParticipants = [
      ...remoteUsersArray
      .filter(u => u.isTeacher)
      .map(u => ({
        name: classItem?.teacher_name || 'Teacher',
        role: 'teacher',
        uid: u.uid
      })),
      { name: 'You', role: 'student', uid: 'local' },
      ...remoteUsersArray
      .filter(u => !u.isTeacher && !u.isScreenShare)
      .map(u => ({
        name: `Student ${u.uid}`,
        role: 'student',
        uid: u.uid
      }))
    ];

    setParticipants(newParticipants);
  }, [remoteUsers, classItem]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getConnectionColor = useCallback(() => {
    switch(connectionQuality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-green-400';
    }
  }, [connectionQuality]);

  const getQualityBadge = useMemo(() => {
    return (
      <div className={`text-xs font-mono px-2 py-1 rounded-full ${getConnectionColor()} bg-black/30 flex items-center gap-1`}>
      <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
      <span className="hidden sm:inline">{connectionQuality.toUpperCase()}</span>
      <span className="hidden md:inline text-gray-400">• {currentQualityProfile}</span>
      </div>
    );
  }, [connectionQuality, currentQualityProfile, getConnectionColor]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (isOpen && classItem?.video_session?.meeting_id) {
      debugLog('🎯 Modal opened with meeting ID:', classItem.video_session.meeting_id);

      joinAttemptRef.current = 0;

      const initTimeout = setTimeout(() => {
        initializeRealCall();
      }, 100);

      return () => clearTimeout(initTimeout);
    } else if (isOpen && !classItem?.video_session?.meeting_id) {
      debugError('No meeting ID found in classItem:', classItem);
      setError('No video session available for this class.');
    }
  }, [isOpen, classItem, initializeRealCall, debugLog, debugError]);

  useEffect(() => {
    updateParticipantsList();
  }, [remoteUsers, updateParticipantsList]);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      debugLog('🔚 Tab closing, cleaning up...');
      if (hasJoinedRef.current && agoraClient) {
        try {
          await agoraClient.leave();
        } catch (e) {
          debugError('Cleanup on unload failed:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [agoraClient, debugLog, debugError]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  if (!AgoraRTC || typeof AgoraRTC.createClient !== 'function') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
      <div className="text-center text-white p-8 max-w-md">
      <AlertCircle className="text-red-400 w-16 h-16 mx-auto mb-4" />
      <h2 className="text-2xl font-bold mb-4">Video System Error</h2>
      <p className="text-gray-300 mb-6">
      Agora SDK not loaded properly. Please refresh the page to continue.
      </p>
      <button
      onClick={() => window.location.reload()}
      className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-medium transition-colors"
      >
      Refresh Page
      </button>
      </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex flex-col">
    {/* Header */}
    <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-cyan-900 text-white p-3 sm:p-4 border-b border-cyan-500/30 shadow-xl flex-shrink-0">
    <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0 flex-1">
    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
      isConnected ? 'bg-green-500 animate-pulse' :
      isConnecting ? 'bg-yellow-500 animate-pulse' :
      'bg-red-500'
    }`} />

    <div className="min-w-0 flex-1">
    <h2 className="text-base sm:text-lg font-bold truncate">
    {classItem?.title || 'Video Session'}
    </h2>
    <p className="text-xs sm:text-sm text-cyan-200 truncate">
    {classItem?.teacher_name || 'Teacher'} • {formatTime(callDuration)}
    {isConnecting && ` • Attempt ${joinAttemptRef.current}/3`}
    </p>
    </div>
    </div>

    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
    <div className="bg-cyan-700/50 px-2 sm:px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1 sm:gap-2">
    <Users size={14} />
    <span>{participants.length}</span>
    </div>

    <div className="hidden sm:block">
    {getQualityBadge}
    </div>

    <button
    onClick={leaveCall}
    className="bg-red-600 hover:bg-red-700 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
    >
    <PhoneOff size={16} />
    <span className="hidden sm:inline">Leave</span>
    </button>
    </div>
    </div>
    </div>

    {/* Error Display */}
    {error && (
      <div className="bg-red-600/90 text-white p-3 mx-3 sm:mx-4 mt-3 sm:mt-4 rounded-lg flex items-center justify-between backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2">
      <AlertCircle size={20} />
      <span className="text-sm">{error}</span>
      </div>
      <button
      onClick={() => setError('')}
      className="text-white hover:text-red-200 text-xl font-bold ml-2"
      >
      ×
      </button>
      </div>
    )}

    {/* Main Video Area */}
    <div className="flex-1 min-h-0">
    {isConnecting ? (
      <div className="flex items-center justify-center h-full">
      <div className="text-center text-white p-4">
      <Loader2 className="animate-spin mx-auto text-cyan-400 w-12 sm:w-16 h-12 sm:h-16 mb-4" />
      <p className="text-lg sm:text-xl font-bold">Joining Session</p>
      <p className="text-sm sm:text-base text-gray-300 mt-2">
      Connecting to {classItem?.title || 'video session'}...
      <br />
      <span className="text-cyan-300">Attempt {joinAttemptRef.current} of 3</span>
      </p>
      </div>
      </div>
    ) : isConnected ? (
      renderVideoLayout()
    ) : (
      <div className="flex items-center justify-center h-full">
      <div className="text-center text-white p-4">
      <AlertCircle className="text-red-400 w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-4" />
      <p className="text-lg sm:text-xl font-bold mb-2">Connection Failed</p>
      <p className="text-sm sm:text-base text-gray-300 mb-6">
      Unable to connect to the video session after {joinAttemptRef.current} attempts
      </p>
      <button
      onClick={initializeRealCall}
      className="bg-cyan-600 hover:bg-cyan-700 px-6 py-3 rounded-lg font-medium transition-colors"
      >
      Retry Connection
      </button>
      </div>
      </div>
    )}
    </div>

    {/* Control Bar */}
    {isConnected && (
      <div className="bg-gray-900/95 border-t border-cyan-500/20 p-3 sm:p-4 backdrop-blur-xl flex-shrink-0">
      <div className="flex items-center justify-center gap-3 sm:gap-4">
      <button
      onClick={toggleAudio}
      className={`p-3 sm:p-4 rounded-xl transition-all duration-200 ${
        isAudioMuted
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-green-600 hover:bg-green-700'
      }`}
      title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
      {isAudioMuted ? (
        <MicOff size={20} className="text-white" />
      ) : (
        <Mic size={20} className="text-white" />
      )}
      </button>

      <button
      onClick={toggleVideo}
      className={`p-3 sm:p-4 rounded-xl transition-all duration-200 ${
        isVideoOff
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-green-600 hover:bg-green-700'
      }`}
      title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
      >
      {isVideoOff ? (
        <VideoOff size={20} className="text-white" />
      ) : (
        <Video size={20} className="text-white" />
      )}
      </button>

      <button
      onClick={raiseHand}
      className={`p-3 sm:p-4 rounded-xl transition-all duration-200 ${
        isHandRaised
        ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse'
        : 'bg-gray-700 hover:bg-gray-600'
      }`}
      title={isHandRaised ? 'Lower hand' : 'Raise hand'}
      >
      <Hand size={20} className="text-white" />
      </button>
      </div>

      <div className="mt-3 text-center text-gray-400 text-xs sm:text-sm">
      {isAudioMuted && isVideoOff && (
        <p>💡 Your camera preview is visible to you only. Click buttons above to share with others.</p>
      )}
      {!isAudioMuted && isVideoOff && (
        <p>🎤 Others can hear you • 📹 Your camera is off for others</p>
      )}
      {isAudioMuted && !isVideoOff && (
        <p>📹 Others can see you • 🔇 Your microphone is muted</p>
      )}
      {!isAudioMuted && !isVideoOff && (
        <p>✅ Others can see and hear you</p>
      )}
      </div>
      </div>
    )}
    </div>
  );
};

export default StudentVideoCall;// STATE MANAGEMENT
// ============================================================================
const [remoteUsers, setRemoteUsers] = useState(new Map());
const [isAudioMuted, setIsAudioMuted] = useState(true);
const [isVideoOff, setIsVideoOff] = useState(true);
const [isConnected, setIsConnected] = useState(false);
const [isConnecting, setIsConnecting] = useState(false);
const [callDuration, setCallDuration] = useState(0);
const [participants, setParticipants] = useState([]);
const [connectionQuality, setConnectionQuality] = useState('excellent');
const [agoraClient, setAgoraClient] = useState(null);
const [error, setError] = useState('');
const [isScreenSharing, setIsScreenSharing] = useState(false);
const [teacherUid, setTeacherUid] = useState(null);
const [isHandRaised, setIsHandRaised] = useState(false);
const [isPinned, setIsPinned] = useState(null);
const [localVideoReady, setLocalVideoReady] = useState(false);
const [networkStats, setNetworkStats] = useState({ uplink: 0, downlink: 0 });
const [currentQualityProfile, setCurrentQualityProfile] = useState('720p');

// ============================================================================
// REFS
// ============================================================================
const localVideoRef = useRef(null);
const timerRef = useRef(null);
const localTracksRef = useRef({ audio: null, video: null });
const joinAttemptRef = useRef(0);
const screenShareUidRef = useRef(null);
const teacherUidRef = useRef(null);
const videoElementsRef = useRef(new Map());
const isMountedRef = useRef(true);
const isInitializingRef = useRef(false);
const hasJoinedRef = useRef(false);
const currentUidRef = useRef(null);
const retryTimeoutRef = useRef(null);
const qualityCheckIntervalRef = useRef(null);

// ============================================================================
// QUALITY PROFILES
// ============================================================================
const QUALITY_PROFILES = {
  '720p': { width: 1280, height: 720, frameRate: 30, bitrateMin: 600, bitrateMax: 1200 },
  '480p': { width: 640, height: 480, frameRate: 30, bitrateMin: 400, bitrateMax: 800 },
  '360p': { width: 640, height: 360, frameRate: 24, bitrateMin: 300, bitrateMax: 600 },
  '240p': { width: 320, height: 240, frameRate: 15, bitrateMin: 150, bitrateMax: 300 }
};

// ============================================================================
// DEBUG LOGGING
// ============================================================================
const debugLog = useCallback((message, data = null) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${message}`, data || '');
}, []);

const debugError = useCallback((message, error) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.error(`[${timestamp}] ❌ ${message}`, error);
}, []);

// ============================================================================
// ADAPTIVE QUALITY MANAGEMENT
// ============================================================================
const adjustQualityBasedOnNetwork = useCallback(async (quality) => {
  if (!localTracksRef.current.video || !isConnected) return;

  let targetProfile = '720p';

  if (quality === 0 || quality === 1) {
    targetProfile = '720p';
  } else if (quality === 2) {
    targetProfile = '480p';
  } else if (quality === 3) {
    targetProfile = '360p';
  } else {
    targetProfile = '240p';
  }

  if (targetProfile === currentQualityProfile) return;

  try {
    const profile = QUALITY_PROFILES[targetProfile];
    await localTracksRef.current.video.setEncoderConfiguration({
      width: profile.width,
      height: profile.height,
      frameRate: profile.frameRate,
      bitrateMin: profile.bitrateMin,
      bitrateMax: profile.bitrateMax
    });

    setCurrentQualityProfile(targetProfile);
    debugLog(`📊 Quality adjusted to ${targetProfile}`);
  } catch (error) {
    debugError('Quality adjustment failed:', error);
  }
}, [isConnected, currentQualityProfile, debugLog, debugError]);

// ============================================================================
// LIFECYCLE MANAGEMENT
// ============================================================================
useEffect(() => {
  isMountedRef.current = true;
  debugLog('🔄 Component mounted');

  return () => {
    debugLog('🧹 Component unmounting...');
    isMountedRef.current = false;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }

    performCompleteCleanup();
  };
}, []);

// ============================================================================
// CORE VIDEO SETUP FUNCTIONS
// ============================================================================

const setupLocalVideo = useCallback(async (videoTrack) => {
  if (!isMountedRef.current) {
    debugLog('🚫 Component not mounted, skipping local video setup');
    return;
  }

  try {
    debugLog('🎬 Setting up local video preview...');
    setLocalVideoReady(false);

    if (!videoTrack) {
      throw new Error('No video track available');
    }

    // Wait for container to be available with retry logic
    let container = localVideoRef.current;
    let retries = 0;
    const maxRetries = 10;

    while (!container && retries < maxRetries && isMountedRef.current) {
      debugLog(`⏳ Waiting for video container... (attempt ${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 100));
      container = localVideoRef.current;
      retries++;
    }

    if (!container) {
      throw new Error('Video container not found after waiting');
    }

    debugLog('✅ Video container found, setting up video element...');

    container.innerHTML = '';

    const videoElement = document.createElement('video');
    videoElement.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000;
    transform: scaleX(-1);
    `;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;

    container.appendChild(videoElement);

    await videoTrack.play(videoElement);
    debugLog('✅ Local video playing successfully');

    if (isMountedRef.current) {
      setLocalVideoReady(true);
    }

  } catch (error) {
    debugError('Failed to setup local video:', error);
    if (isMountedRef.current) {
      setError(`Video preview failed: ${error.message}`);
      setLocalVideoReady(false);
    }
  }
}, [debugLog, debugError]);

const createLocalTracks = useCallback(async () => {
  debugLog('🎤 Creating local media tracks...');

  try {
    let audioTrack = null;
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true
      });
      localTracksRef.current.audio = audioTrack;
      debugLog('✅ Audio track created');
    } catch (audioError) {
      debugError('Could not create audio track:', audioError);
      setError('Microphone access denied. You can still join with video only.');
    }

    let videoTrack = null;
    try {
      videoTrack = await AgoraRTC.createCameraVideoTrack({
        optimizationMode: 'motion',
        encoderConfig: QUALITY_PROFILES['720p']
      });
      localTracksRef.current.video = videoTrack;
      debugLog('✅ Video track created');

      await setupLocalVideo(videoTrack);
    } catch (videoError) {
      debugError('Could not create video track:', videoError);
      const errorMsg = videoError.message.includes('NotAllowedError') ||
      videoError.message.includes('permission')
      ? 'Camera access denied. Please allow camera permissions.'
      : 'Camera not available. Please check your camera connection.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    return { audioTrack, videoTrack };
  } catch (error) {
    debugError('Failed to create local tracks:', error);
    throw error;
  }
}, [setupLocalVideo, debugLog, debugError]);

const publishLocalTracks = useCallback(async (client) => {
  try {
    const tracksToPublish = [];

    if (localTracksRef.current.audio) {
      tracksToPublish.push(localTracksRef.current.audio);
    }

    if (localTracksRef.current.video) {
      tracksToPublish.push(localTracksRef.current.video);
    }

    if (tracksToPublish.length > 0) {
      debugLog('📡 Publishing tracks to channel...', {
        audio: !!localTracksRef.current.audio,
        video: !!localTracksRef.current.video
      });

      await client.publish(tracksToPublish);
      debugLog('✅ Local tracks published to channel');

      if (localTracksRef.current.audio) {
        await localTracksRef.current.audio.setEnabled(false);
        debugLog('🔇 Audio muted after publishing');
      }

      if (localTracksRef.current.video) {
        await localTracksRef.current.video.setEnabled(false);
        debugLog('📹 Video disabled after publishing');
      }

      debugLog('📡 Tracks published but disabled - ready for student to enable');
    } else {
      debugLog('⚠️ No tracks available to publish');
    }
  } catch (error) {
    debugError('Failed to publish tracks:', error);
    setError('Failed to share media. Please try reconnecting.');
    throw error;
  }
}, [debugLog, debugError]);

// ============================================================================
// REMOTE USER HANDLING
// ============================================================================

const detectTeacher = useCallback((uid) => {
  if (classItem?.video_session?.teacher_uid === uid) return true;
  if (uid === teacherUidRef.current) return true;
  if (uid === 1 && !teacherUidRef.current) return true;
  return false;
}, [classItem]);

const setupAgoraEventListeners = useCallback((client) => {
  debugLog('🔧 Setting up Agora event listeners');

  const handleUserPublished = async (user, mediaType) => {
    debugLog(`📡 User ${user.uid} published ${mediaType}`);

    try {
      await client.subscribe(user, mediaType);
      debugLog(`✅ Subscribed to user ${user.uid} ${mediaType}`);

      if (mediaType === 'video') {
        const isTeacher = detectTeacher(user.uid);
        const isScreen = user.uid.toString().includes('screen');

        if (isTeacher) {
          setTeacherUid(user.uid);
          teacherUidRef.current = user.uid;
          debugLog('👨‍🏫 Teacher video received');
        }

        if (isScreen) {
          setIsScreenSharing(true);
          screenShareUidRef.current = user.uid;
          debugLog('🖥️ Screen share received');
        }

        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(user.uid);

          newMap.set(user.uid, {
            ...existing,
            uid: user.uid,
            videoTrack: user.videoTrack,
            audioTrack: existing?.audioTrack || user.audioTrack,
            hasVideo: true,
            hasAudio: existing?.hasAudio || !!user.audioTrack,
            isTeacher,
            isScreenShare: isScreen,
            joinedAt: existing?.joinedAt || new Date()
          });

          return newMap;
        });

      } else if (mediaType === 'audio') {
        if (user.audioTrack) {
          user.audioTrack.play();
          debugLog(`🔊 Playing audio from user ${user.uid}`);
        }

        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(user.uid);

          if (existing) {
            newMap.set(user.uid, {
              ...existing,
              audioTrack: user.audioTrack,
              hasAudio: true
            });
          } else {
            newMap.set(user.uid, {
              uid: user.uid,
              videoTrack: null,
              audioTrack: user.audioTrack,
              hasVideo: false,
              hasAudio: true,
              isTeacher: detectTeacher(user.uid),
                       isScreenShare: false,
                       joinedAt: new Date()
            });
          }

          return newMap;
        });
      }

    } catch (error) {
      debugError(`Error subscribing to user ${user.uid}:`, error);
    }
  };

  const handleUserUnpublished = (user, mediaType) => {
    debugLog(`📡 User ${user.uid} unpublished ${mediaType}`);

    setRemoteUsers(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(user.uid);

      if (existing) {
        if (mediaType === 'video') {
          newMap.set(user.uid, { ...existing, videoTrack: null, hasVideo: false });
        } else if (mediaType === 'audio') {
          newMap.set(user.uid, { ...existing, audioTrack: null, hasAudio: false });
        }
      }

      return newMap;
    });
  };

  const handleUserLeft = (user) => {
    debugLog(`👋 User ${user.uid} left`);

    setRemoteUsers(prev => {
      const newMap = new Map(prev);
      const leavingUser = newMap.get(user.uid);

      if (leavingUser?.isTeacher) {
        setTeacherUid(null);
        teacherUidRef.current = null;
      }

      if (leavingUser?.isScreenShare) {
        setIsScreenSharing(false);
        screenShareUidRef.current = null;
      }

      newMap.delete(user.uid);
      return newMap;
    });

    const videoElement = videoElementsRef.current.get(user.uid);
    if (videoElement) {
      videoElement.remove();
      videoElementsRef.current.delete(user.uid);
    }
  };

  const handleConnectionStateChange = (curState, prevState) => {
    debugLog(`🔗 Connection state: ${prevState} → ${curState}`);

    if (curState === 'CONNECTED') {
      setError('');
    } else if (curState === 'DISCONNECTED') {
      setError('Connection lost. Attempting to reconnect...');
    }
  };

  const handleNetworkQuality = (stats) => {
    const quality = Math.min(stats.uplinkNetworkQuality, stats.downlinkNetworkQuality);
    const qualityMap = {
      0: 'excellent', 1: 'excellent', 2: 'good',
      3: 'fair', 4: 'poor', 5: 'poor', 6: 'poor'
    };
    setConnectionQuality(qualityMap[quality] || 'excellent');

    adjustQualityBasedOnNetwork(quality);

    setNetworkStats({
      uplink: stats.uplinkNetworkQuality,
      downlink: stats.downlinkNetworkQuality
    });
  };

  client.on('user-published', handleUserPublished);
  client.on('user-unpublished', handleUserUnpublished);
  client.on('user-left', handleUserLeft);
  client.on('connection-state-change', handleConnectionStateChange);
  client.on('network-quality', handleNetworkQuality);

  return () => {
    debugLog('🧹 Cleaning up Agora event listeners');
    client.off('user-published', handleUserPublished);
    client.off('user-unpublished', handleUserUnpublished);
    client.off('user-left', handleUserLeft);
    client.off('connection-state-change', handleConnectionStateChange);
    client.off('network-quality', handleNetworkQuality);
  };
}, [detectTeacher, debugLog, debugError, adjustQualityBasedOnNetwork]);

// ============================================================================
// CALL INITIALIZATION
// ============================================================================

const performCompleteCleanup = useCallback(async () => {
  debugLog('🧹 Performing complete cleanup...');

  try {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }

    if (localTracksRef.current.audio) {
      try {
        localTracksRef.current.audio.stop();
        localTracksRef.current.audio.close();
      } catch (e) {
        debugError('Audio cleanup warning:', e);
      }
      localTracksRef.current.audio = null;
    }

    if (localTracksRef.current.video) {
      try {
        localTracksRef.current.video.stop();
        localTracksRef.current.video.close();
      } catch (e) {
        debugError('Video cleanup warning:', e);
      }
      localTracksRef.current.video = null;
    }

    videoElementsRef.current.forEach(element => {
      try {
        element.remove();
      } catch (e) {
        debugError('Element removal warning:', e);
      }
    });
    videoElementsRef.current.clear();

    if (agoraClient) {
      try {
        await agoraClient.leave();
        debugLog('✅ Left Agora channel');
      } catch (e) {
        debugError('Leave channel warning:', e);
      }
    }

    hasJoinedRef.current = false;
    currentUidRef.current = null;
    isInitializingRef.current = false;

    if (isMountedRef.current) {
      setIsConnected(false);
      setIsConnecting(false);
      setCallDuration(0);
      setRemoteUsers(new Map());
      setAgoraClient(null);
      setTeacherUid(null);
      setIsScreenSharing(false);
      setIsHandRaised(false);
      setLocalVideoReady(false);
      setIsPinned(null);
      setError('');
    }

    debugLog('✅ Cleanup complete');
  } catch (error) {
    debugError('Cleanup error:', error);
  }
}, [agoraClient, debugLog, debugError]);

const initializeRealCall = useCallback(async () => {
  if (isInitializingRef.current || hasJoinedRef.current) {
    debugLog('⏳ Already initializing or joined, skipping...');
    return;
  }

  if (joinAttemptRef.current >= 3) {
    setError('Too many connection attempts. Please refresh and try again.');
    return;
  }

  if (!AgoraRTC || typeof AgoraRTC.createClient !== 'function') {
    setError('Agora SDK not loaded. Please refresh the page.');
    debugError('AgoraRTC not available:', AgoraRTC);
    return;
  }

  if (agoraClient) {
    debugLog('🧹 Cleaning up previous session...');
    await performCompleteCleanup();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  isInitializingRef.current = true;
  joinAttemptRef.current++;
  setIsConnecting(true);
  setError('');

  debugLog(`🚀 Join attempt ${joinAttemptRef.current} starting...`);

  try {
    const meetingId = classItem?.video_session?.meeting_id;
    if (!meetingId) {
      throw new Error('No meeting ID found for this class');
    }

    debugLog('📋 Getting join credentials for meeting:', meetingId);

    let joinResult;
    try {
      joinResult = await studentApi.joinVideoSession(meetingId);
      debugLog('📋 Join API response:', joinResult);

      if (!joinResult.success || !joinResult.channel || !joinResult.appId) {
        throw new Error(joinResult.error || 'Invalid join credentials received');
      }

      currentUidRef.current = joinResult.uid;

    } catch (apiError) {
      debugError('API error:', apiError);
      throw new Error(`Failed to connect to session: ${apiError.message}`);
    }

    debugLog('🔧 Creating new Agora client...');
    const client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });
    setAgoraClient(client);

    const cleanupListeners = setupAgoraEventListeners(client);

    debugLog('🔐 Joining channel:', {
      appId: joinResult.appId,
      channel: joinResult.channel,
      uid: joinResult.uid
    });

    try {
      await client.join(
        joinResult.appId,
        joinResult.channel,
        joinResult.token || null,
        joinResult.uid || null
      );

      hasJoinedRef.current = true;
      debugLog(`✅ Successfully joined channel with UID:`, joinResult.uid);

    } catch (joinError) {
      debugError('Join error:', joinError);

      if (joinError.code === 'UID_CONFLICT') {
        throw new Error('You are already in this session. Please close other tabs.');
      } else if (joinError.code === 'INVALID_PARAMS') {
        throw new Error('Invalid session credentials. Please try again.');
      } else {
        throw new Error(`Failed to join: ${joinError.message}`);
      }
    }

    if (!isMountedRef.current) {
      debugLog('🚫 Component not mounted after join, aborting...');
      await performCompleteCleanup();
      return;
    }

    // Wait a bit for DOM to be fully ready before creating tracks
    debugLog('⏳ Waiting for DOM to be ready...');
    await new Promise(resolve => setTimeout(resolve, 300));

    debugLog('🎬 Creating local tracks...');
    await createLocalTracks();

    if (!isMountedRef.current) {
      await performCompleteCleanup();
      return;
    }

    debugLog('📡 Publishing local tracks...');
    await publishLocalTracks(client);

    if (!isMountedRef.current) {
      await performCompleteCleanup();
      return;
    }

    setIsConnected(true);
    setIsConnecting(false);

    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    debugLog('🎉 Video call initialized successfully');

    return () => {
      cleanupListeners();
    };

  } catch (error) {
    debugError(`Join attempt ${joinAttemptRef.current} failed:`, error);

    await performCompleteCleanup();

    if (isMountedRef.current) {
      setError(error.message || 'Failed to initialize video call');
      setIsConnecting(false);
      setIsConnected(false);
    }

    if (!error.message.includes('already in this session') &&
      (error.message.includes('timeout') || error.message.includes('network'))) {
      if (joinAttemptRef.current < 3) {
        const retryDelay = 2000 * joinAttemptRef.current;
        debugLog(`🔄 Scheduling retry in ${retryDelay}ms...`);

        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && isOpen && !hasJoinedRef.current) {
            initializeRealCall();
          }
        }, retryDelay);
      }
      }
  } finally {
    isInitializingRef.current = false;
  }
}, [classItem, isOpen, agoraClient, createLocalTracks, publishLocalTracks, setupAgoraEventListeners, performCompleteCleanup, debugLog, debugError]);

// ============================================================================
// VIDEO PLAYER COMPONENTS
// ============================================================================

const LocalVideoPlayer = React.memo(() => {
  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-black border-2 border-purple-500">
    <div ref={localVideoRef} className="w-full h-full bg-black" />

    <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded-lg text-xs backdrop-blur-sm z-10">
    💜 You {isVideoOff && '(Camera Off)'}
    </div>

    {isHandRaised && (
      <div className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 rounded-lg text-xs font-bold animate-bounce z-10">
      ✋ Hand Raised
      </div>
    )}

    <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
    {isAudioMuted && (
      <div className="bg-red-500/90 p-1 rounded">
      <MicOff size={14} className="text-white" />
      </div>
    )}
    {isVideoOff && (
      <div className="bg-red-500/90 p-1 rounded">
      <VideoOff size={14} className="text-white" />
      </div>
    )}
    </div>

    {!localVideoReady && localTracksRef.current.video && (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black z-5">
      <Loader2 className="text-purple-500 w-8 h-8 animate-spin mb-2" />
      <span className="text-purple-300 text-sm">Starting camera...</span>
      </div>
    )}

    {!localTracksRef.current.video && (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black z-5">
      <VideoOff className="text-purple-400 w-12 h-12 mb-2" />
      <span className="text-purple-300 text-sm">No Camera</span>
      </div>
    )}
    </div>
  );
});

const RemoteVideoPlayer = React.memo(({ user }) => {
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !user.videoTrack) {
      setIsPlaying(false);
      return;
    }

    const playVideo = async () => {
      try {
        const videoElement = document.createElement('video');
        videoElement.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: #000;
        `;
        videoElement.autoplay = true;
        videoElement.playsInline = true;

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(videoElement);

        videoElementsRef.current.set(user.uid, videoElement);

        await user.videoTrack.play(videoElement);
        setIsPlaying(true);
        debugLog(`✅ Remote video playing for user ${user.uid}`);
      } catch (error) {
        debugError(`Remote video play error for ${user.uid}:`, error);
        setIsPlaying(false);
      }
    };

    playVideo();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      videoElementsRef.current.delete(user.uid);
    };
  }, [user.uid, user.videoTrack]);

  const getUserLabel = () => {
    if (user.isScreenShare) return '🖥️ Screen Share';
    if (user.isTeacher) return `👨‍🏫 ${classItem?.teacher_name || 'Teacher'}`;
    return `👤 Student ${user.uid}`;
  };

  const getBorderColor = () => {
    if (user.isScreenShare) return 'border-orange-500';
    if (user.isTeacher) return 'border-yellow-500';
    return 'border-green-500';
  };

  return (
    <div className={`relative w-full h-full rounded-xl overflow-hidden bg-gray-900 border-2 ${getBorderColor()}`}>
    <div ref={containerRef} className="w-full h-full bg-black" />

    <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded-lg text-xs backdrop-blur-sm z-10">
    {getUserLabel()}
    </div>

    <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
    {!user.hasAudio && (
      <div className="bg-red-500/90 p-1 rounded">
      <MicOff size={14} className="text-white" />
      </div>
    )}
    {!user.hasVideo && (
      <div className="bg-red-500/90 p-1 rounded">
      <VideoOff size={14} className="text-white" />
      </div>
    )}
    </div>

    {!user.hasVideo && (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black z-5">
      <VideoOff className="text-gray-500 w-12 h-12 mb-2" />
      <span className="text-gray-400 text-sm">Camera Off</span>
      </div>
    )}

    {user.hasVideo && !isPlaying && (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black z-5">
      <Loader2 className="text-gray-400 w-6 h-6 animate-spin" />
      </div>
    )}
    </div>
  );
});

// ============================================================================

// === CLASS MANAGEMENT ===
const sortClasses = (classes) => {
  if (!Array.isArray(classes)) return [];

  const now = new Date();
  return classes.sort((a, b) => {
    const classAStart = new Date(a.scheduled_date);
    const classAEnd = a.end_date ? new Date(a.end_date) : new Date(classAStart.getTime() + (2 * 60 * 60 * 1000));
    const classBStart = new Date(b.scheduled_date);
    const classBEnd = b.end_date ? new Date(b.end_date) : new Date(classBStart.getTime() + (2 * 60 * 60 * 1000));

    // AI Priority: Active video sessions first
    const hasActiveVideoSessionA = a.video_session?.status === 'active' && !a.video_session.ended_at;
    const hasActiveVideoSessionB = b.video_session?.status === 'active' && !b.video_session.ended_at;

    if (hasActiveVideoSessionA && !hasActiveVideoSessionB) return -1;
    if (hasActiveVideoSessionB && !hasActiveVideoSessionA) return 1;

    if (hasActiveVideoSessionA && hasActiveVideoSessionB) {
      return new Date(b.video_session.started_at) - new Date(a.video_session.started_at);
    }

    // Schedule-based sorting
    const isALiveBySchedule = now >= classAStart && now <= classAEnd;
    const isBLiveBySchedule = now >= classBStart && now <= classBEnd;
    const isAUpcoming = classAStart > now;
    const isBUpcoming = classBStart > now;

    if (isALiveBySchedule && !isBLiveBySchedule) return -1;
    if (isBLiveBySchedule && !isALiveBySchedule) return 1;
    if (isAUpcoming && !isBUpcoming) return -1;
    if (isBUpcoming && !isAUpcoming) return 1;

    return classAStart - classBStart;
  });
};

const getTimeUntilClass = (classItem) => {
  const now = new Date();
  const classTime = new Date(classItem.scheduled_date);
  const classEnd = classItem.end_date ? new Date(classItem.end_date) : new Date(classTime.getTime() + (2 * 60 * 60 * 1000));

  const hasActiveVideoSession = classItem.video_session?.status === 'active' && !classItem.video_session.ended_at;

  if (hasActiveVideoSession) {
    const timeLeft = classEnd - now;
    const minsLeft = Math.floor(timeLeft / (1000 * 60));
    return { status: 'live', text: `Madina Live - ${minsLeft}m remaining` };
  }

  const isLiveBySchedule = now >= classTime && now <= classEnd;
  const isCompleted = classEnd < now;
  const isUpcoming = classTime > now;

  if (isLiveBySchedule) {
    const timeLeft = classEnd - now;
    const minsLeft = Math.floor(timeLeft / (1000 * 60));
    return { status: 'live', text: `Live Session - ${minsLeft}m left` };
  } else if (isCompleted) {
    return { status: 'completed', text: 'AI Review Available' };
  } else {
    const diffMs = classTime - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return { status: 'upcoming', text: `Starts in ${diffMins}m` };
    if (diffHours < 24) return { status: 'upcoming', text: `Starts in ${diffHours}h` };
    return { status: 'upcoming', text: `Starts in ${diffDays}d` };
  }
};

// === COMPONENTS ===
const AudioPlayer = ({ audioUrl, onDelete }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnd = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnd);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnd);
    };
  }, []);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-2xl border border-cyan-500/20 backdrop-blur-lg">
    <audio ref={audioRef} src={audioUrl} preload="metadata" />

    <button
    onClick={togglePlay}
    className="p-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-full transition-all duration-200 shadow-lg"
    >
    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
    </button>

    <div className="flex-1">
    <div className="text-sm text-cyan-300 font-medium">AI Recording</div>
    <div className="flex items-center space-x-3 mt-2">
    <span className="text-xs text-cyan-400 font-mono">{formatTime(currentTime)}</span>
    <div className="flex-1 bg-cyan-800/30 rounded-full h-2">
    <div
    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-200"
    style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
    />
    </div>
    <span className="text-xs text-cyan-400 font-mono">{formatTime(duration)}</span>
    </div>
    </div>

    <button
    onClick={onDelete}
    className="p-2 text-red-300 hover:text-red-200 transition-all duration-200 hover:scale-110"
    >
    <Trash2 size={18} />
    </button>
    </div>
  );
};

const AssignmentSubmissionModal = ({ assignment, isOpen, onClose, onSubmit }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const {
    isRecording,
    audioBlob,
    audioUrl,
    recordingTime,
    startRecording,
    stopRecording,
    clearRecording,
    hasRecording
  } = useAudioRecorder();

  const handleSubmit = async () => {
    if (!hasRecording && !submissionText.trim()) {
      toast.error('Audio recording or text comments required');
      return;
    }

    setSubmitting(true);
    try {
      let audioUrl = null;
      if (audioBlob) {
        const fileName = `assignment-${assignment.id}-${Date.now()}.webm`;
        const uploadResult = await uploadAudioToSupabase(audioBlob, fileName);
        audioUrl = uploadResult.publicUrl;
      }

      await onSubmit({
        assignment_id: assignment.id,
        submission_text: submissionText,
        audio_url: audioUrl
      });

      onClose();
    } catch (error) {
      toast.error(`Submission failed: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
    <motion.div
    initial={{ opacity: 0, scale: 0.9, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9, y: 20 }}
    className="bg-gradient-to-br from-gray-900 to-gray-800 border border-cyan-500/30 rounded-3xl p-8 w-full max-w-2xl mx-4 shadow-2xl"
    >
    <div className="flex justify-between items-center mb-8">
    <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    Madina Submission
    </h3>
    <button onClick={onClose} className="text-cyan-300 hover:text-white transition-all duration-200 p-2 hover:bg-cyan-500/20 rounded-lg">
    <X size={24} />
    </button>
    </div>

    <div className="space-y-6">
    <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 p-6 rounded-2xl border border-cyan-500/20">
    <h4 className="font-bold text-cyan-300 mb-3">Mission Details</h4>
    <p className="text-cyan-100 text-sm">{assignment.description}</p>
    <div className="mt-3 text-xs text-cyan-400 flex items-center space-x-4">
    <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
    <span>•</span>
    <span>{assignment.max_score} Madina Points</span>
    </div>
    </div>

    <div>
    <h4 className="font-bold text-cyan-300 mb-4 flex items-center">
    <Mic className="mr-2" size={20} />
    Neural Recording
    </h4>

    <div className="space-y-4">
    {!hasRecording ? (
      <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-2xl border border-cyan-500/20">
      <button
      onClick={isRecording ? stopRecording : startRecording}
      className={`p-4 rounded-full transition-all duration-200 shadow-lg ${
        isRecording
        ? 'bg-gradient-to-r from-red-600 to-pink-600 animate-pulse'
        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
      }`}
      >
      {isRecording ? <Square size={24} /> : <Mic size={24} />}
      </button>

      <div className="flex-1">
      <div className="text-cyan-300 font-medium">
      {isRecording ? `Recording... ${recordingTime}` : 'Initiate Recording'}
      </div>
      <div className="text-cyan-400 text-sm">
      {isRecording ? 'AI processing audio quality...' : 'Click to start neural capture'}
      </div>
      </div>
      </div>
    ) : (
      <AudioPlayer audioUrl={audioUrl} onDelete={clearRecording} />
    )}
    </div>
    </div>

    <div>
    <h4 className="font-bold text-cyan-300 mb-4">Madina Notes</h4>
    <textarea
    value={submissionText}
    onChange={(e) => setSubmissionText(e.target.value)}
    placeholder="Add AI-enhanced notes or observations..."
    rows="4"
    className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 text-white placeholder-cyan-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 backdrop-blur-lg"
    />
    </div>

    <div className="bg-gradient-to-r from-blue-900/30 to-green-900/30 p-4 rounded-2xl border border-blue-500/20">
    <div className="flex items-start space-x-3">
    <Sparkles size={20} className="text-blue-300 mt-1 flex-shrink-0" />
    <div className="text-sm text-blue-200">
    <strong>AI Insight:</strong> Your submission will be analyzed by our Madina learning AI
    for personalized feedback and improvement suggestions.
      </div>
      </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6">
      <button
      onClick={onClose}
      className="px-8 py-3 rounded-2xl bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 border border-gray-600 transition-all duration-200 shadow-lg"
      >
      Cancel
      </button>
      <button
      onClick={handleSubmit}
      disabled={submitting || (!hasRecording && !submissionText.trim())}
      className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all duration-200 shadow-lg"
      >
      {submitting ? (
        <>
        <Loader2 className="animate-spin mr-3" size={20} />
        Madina Upload...
        </>
      ) : (
        <>
        <Rocket className="mr-3" size={20} />
        Launch Submission
        </>
      )}
      </button>
      </div>
      </div>
      </motion.div>
      </div>
  );
};

const AssignmentItem = ({ assignment, onSubmitAssignment, formatDate }) => {
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  const isSubmitted = assignment.submissions?.[0]?.status === "submitted" ||
  assignment.submissions?.[0]?.status === "graded";
  const isGraded = assignment.submissions?.[0]?.status === "graded";
  const dueDate = new Date(assignment.due_date);
  const isOverdue = dueDate < new Date() && !isSubmitted;
  const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="group"
    >
    <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl backdrop-blur-lg">
    <div className="flex justify-between items-start">
    <div className="flex-1">
    <div className="flex items-center justify-between">
    <h4 className="font-bold text-xl flex items-center">
    <FileText className="mr-3" size={24} />
    <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    {assignment.title}
    </span>
    </h4>
    <div className={`px-4 py-2 rounded-full text-sm font-bold backdrop-blur-lg ${
      isGraded
      ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white"
      : isSubmitted
      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
      : isOverdue
      ? "bg-gradient-to-r from-red-600 to-pink-600 text-white"
      : "bg-gradient-to-r from-yellow-600 to-orange-600 text-white"
    }`}>
    {isGraded
      ? `AI Graded: ${assignment.submissions?.[0]?.score}/${assignment.max_score}`
      : isSubmitted
      ? "Madina Review"
      : isOverdue
      ? "Priority Mission"
      : daysUntilDue <= 3 ? `${daysUntilDue}d remaining` : "Active Mission"
    }
    </div>
    </div>

    <div className="flex flex-wrap items-center mt-4 text-sm text-cyan-200">
    <span className="flex items-center mr-6 mb-3">
    <BookOpen size={16} className="mr-2" />
    {assignment.subject || assignment.class?.title}
    </span>
    <span className="flex items-center mr-6 mb-3">
    <Calendar size={16} className="mr-2" />
    Due: {formatDate(assignment.due_date)}
    </span>
    <span className="flex items-center mr-6 mb-3">
    <Award size={16} className="mr-2" />
    {assignment.max_score} Madina Points
    </span>
    </div>

    {assignment.description && (
      <p className="text-cyan-300 text-sm mt-3">{assignment.description}</p>
    )}

    {isOverdue && (
      <div className="mt-3 flex items-center text-red-300 text-sm">
      <AlertCircle size={16} className="mr-2" />
      AI Priority: {Math.abs(daysUntilDue)} days overdue
      </div>
    )}
    </div>
    </div>

    <div className="mt-6 flex flex-wrap gap-3">
    <button className="text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-3 px-5 rounded-xl flex items-center transition-all duration-200 shadow-lg">
    <Download className="mr-2" size={16} />
    Madina Materials
    </button>

    {!isGraded && (
      <button
      onClick={() => setShowSubmissionModal(true)}
      className={`text-sm py-3 px-5 rounded-xl flex items-center transition-all duration-200 shadow-lg ${
        isOverdue
        ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500'
        : 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-500 hover:to-green-500'
      }`}
      >
      <Mic className="mr-2" size={16} />
      {isSubmitted ? 'Neural Resubmit' : 'Madina Submit'}
      </button>
    )}

    {isGraded && assignment.submissions?.[0]?.feedback && (
      <button className="text-sm bg-gradient-to-r from-green-600 to-pink-600 hover:from-green-500 hover:to-pink-500 py-3 px-5 rounded-xl flex items-center transition-all duration-200 shadow-lg">
      <MessageCircle className="mr-2" size={16} />
      AI Feedback
      </button>
    )}
    </div>
    </div>

    <AssignmentSubmissionModal
    assignment={assignment}
    isOpen={showSubmissionModal}
    onClose={() => setShowSubmissionModal(false)}
    onSubmit={onSubmitAssignment}
    />
    </motion.div>
  );
};

const ClassItem = ({ classItem, formatDate, formatTime, getTimeUntilClass, onJoinClass }) => {
  const timeInfo = getTimeUntilClass(classItem);
  const isClassLive = timeInfo.status === 'live';
  const isClassCompleted = timeInfo.status === 'completed';
  const hasActiveVideoSession = classItem.video_session?.status === 'active' && !classItem.video_session.ended_at;

  const handleJoinClass = async () => {
    if (isClassLive) await onJoinClass(classItem);
  };

    return (
      <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
      >
      <div className={`p-6 rounded-2xl border-2 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl backdrop-blur-lg ${
        isClassCompleted
        ? 'bg-gradient-to-br from-gray-800/30 to-gray-900/30 border-green-500/20'
        : isClassLive
        ? 'bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-cyan-500/50 animate-pulse'
        : 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-cyan-500/20'
      }`}>
      <div className="flex justify-between items-start">
      <div className="flex-1">
      <div className="flex items-center justify-between">
      <h4 className="font-bold text-xl flex items-center">
      <Video className="mr-3" size={24} />
      <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
      {classItem.title}
      </span>
      {isClassCompleted && (
        <CheckCircle size={20} className="text-green-400 ml-3" />
      )}
      {isClassLive && (
        <div className="flex items-center ml-3">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-ping mr-2"></div>
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        {hasActiveVideoSession && (
          <span className="text-xs text-red-300 ml-2 font-mono">Madina_ACTIVE</span>
        )}
        </div>
      )}
      </h4>
      <span className={`px-4 py-2 rounded-full text-sm font-bold backdrop-blur-lg ${
        isClassCompleted
        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
        : isClassLive
        ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white animate-pulse'
        : 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
      }`}>
      {isClassCompleted ? 'AI Reviewed' :
        isClassLive ? 'Madina Live' :
        'Scheduled'}
        </span>
        </div>

        <div className="flex flex-wrap items-center mt-4 text-sm text-cyan-200">
        <span className="flex items-center mr-6 mb-3">
        <Clock size={16} className="mr-2" />
        {formatTime(classItem.scheduled_date)} - {formatTime(classItem.end_date || new Date(new Date(classItem.scheduled_date).getTime() + (2 * 60 * 60 * 1000)))}
        </span>
        <span className="flex items-center mr-6 mb-3">
        <User size={16} className="mr-2" />
        {classItem.teacher_name || 'AI Instructor'}
        {isClassLive && (
          <div className="w-2 h-2 bg-green-500 rounded-full ml-2 animate-pulse"></div>
        )}
        </span>
        <span className="flex items-center mr-6 mb-3">
        <Calendar size={16} className="mr-2" />
        {formatDate(classItem.scheduled_date)}
        </span>
        </div>

        <div className={`mt-3 text-sm font-medium ${
          isClassLive ? 'text-red-300' : 'text-cyan-300'
        }`}>
        {timeInfo.text}
        {hasActiveVideoSession && (
          <span className="ml-2 text-green-300 font-mono">• TEACHER_ACTIVE</span>
        )}
        </div>

        {classItem.video_session && (
          <div className="mt-3 text-xs text-cyan-400 flex items-center">
          <ShieldCheck size={14} className="mr-2" />
          <span className="font-mono">ID: {classItem.video_session.meeting_id}</span>
          {classItem.video_session.status === 'active' && (
            <span className="ml-3 text-red-400 font-mono">• Madina_ACTIVE</span>
          )}
          </div>
        )}
        </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
        {isClassLive && (
          <button
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-3 px-6 rounded-xl flex items-center transition-all duration-200 shadow-lg"
          onClick={handleJoinClass}
          >
          <Rocket size={18} className="mr-2"/>
          Join Madina Session
          </button>
        )}

        {!isClassLive && !isClassCompleted && (
          <button className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-500 hover:to-green-500 py-3 px-6 rounded-xl flex items-center transition-all duration-200 shadow-lg">
          <Calendar size={18} className="mr-2"/>
          Schedule Reminder
          </button>
        )}

        {isClassCompleted && classItem.video_session && (
          <button className="bg-gradient-to-r from-green-600 to-pink-600 hover:from-green-500 hover:to-pink-500 py-3 px-6 rounded-xl flex items-center transition-all duration-200 shadow-lg">
          <Download size={18} className="mr-2"/>
          AI Recording
          </button>
        )}

        <button className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 py-3 px-6 rounded-xl flex items-center transition-all duration-200 shadow-lg">
        <MessageCircle size={18} className="mr-2"/>
        Madina Details
        </button>
        </div>
        </div>
        </motion.div>
    );
};

// === AI NOTIFICATIONS SYSTEM ===
const NotificationsDropdown = ({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onMarkAllAsRead,
  onClearAll,
  onDeleteNotification
}) => {
  const formatNotificationTime = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffMs = now - notificationTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return notificationTime.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-3 w-96 bg-gradient-to-br from-gray-800 to-gray-900 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl z-50">
    <div className="p-6 border-b border-cyan-500/20">
    <div className="flex items-center justify-between">
    <h3 className="font-bold text-xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    AI Notifications
    </h3>
    <div className="flex space-x-3">
    <button
    onClick={onMarkAllAsRead}
    className="text-sm text-cyan-300 hover:text-cyan-200 transition-all duration-200"
    >
    Mark all
    </button>
    <button
    onClick={onClearAll}
    className="text-sm text-red-300 hover:text-red-200 transition-all duration-200"
    >
    Clear all
    </button>
    </div>
    </div>
    </div>

    <div className="max-h-96 overflow-y-auto">
    {notifications.length === 0 ? (
      <div className="p-8 text-center text-cyan-300">
      <Bell size={48} className="mx-auto mb-4 opacity-50" />
      <p className="text-lg font-semibold">No notifications</p>
      <p className="text-cyan-400 text-sm mt-2">AI will notify you of important updates</p>
      </div>
    ) : (
      notifications.map((notification) => (
        <div
        key={notification.id}
        onClick={() => onNotificationClick(notification)}
        className={`p-5 border-b border-cyan-500/10 cursor-pointer transition-all duration-200 hover:bg-cyan-500/10 ${
          !notification.read ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10' : ''
        }`}
        >
        <div className="flex justify-between items-start">
        <div className="flex-1">
        <p className="text-white font-semibold text-sm">
        {notification.title || 'AI Notification'}
        </p>
        <p className="text-cyan-300 text-sm mt-2">
        {notification.message || 'Madina update available'}
        </p>
        <p className="text-cyan-400 text-xs mt-3 font-mono">
        {formatNotificationTime(notification.created_at)}
        </p>
        </div>
        <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteNotification(notification.id);
        }}
        className="text-red-300 hover:text-red-200 transition-all duration-200 p-2 hover:bg-red-500/20 rounded-lg"
        >
        <Trash2 size={16} />
        </button>
        </div>
        </div>
      ))
    )}
    </div>
    </div>
  );
};

// === MAIN DASHBOARD COMPONENT ===
export default function Dashboard() {
  const navigate = useNavigate();

  // State Management
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState([
    { label: "Madina Sessions", value: "0", icon: Video, change: "+0", color: "from-cyan-500 to-blue-500" },
    { label: "Learning Hours", value: "0", icon: Clock, change: "+0", color: "from-green-500 to-pink-500" },
    { label: "Active Missions", value: "0", icon: FileText, change: "+0", color: "from-green-500 to-emerald-500" },
    { label: "Madina Score", value: "0%", icon: BarChart3, change: "+0%", color: "from-yellow-500 to-orange-500" },
  ]);
  const [studentName, setStudentName] = useState("Madina Learner");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("classes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedClassForCall, setSelectedClassForCall] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [progressStats, setProgressStats] = useState({
    completionRate: 0,
    streak: 0,
    level: 1,
    points: 0,
    nextLevel: 100
  });

  // Data Fetching
  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const dashboardData = await studentApi.getDashboardData();

      setStudentName(dashboardData.student.name);
      setClasses(sortClasses(dashboardData.classes));
      setAssignments(dashboardData.assignments);
      setNotifications(dashboardData.notifications);

      const statsArray = [
        {
          label: "Madina Sessions",
          value: dashboardData.stats.total_classes?.toString() || "0",
          icon: Video,
          change: "+0",
          color: "from-cyan-500 to-blue-500"
        },
        {
          label: "Learning Hours",
          value: dashboardData.stats.hours_learned?.toString() || "0",
          icon: Clock,
          change: "+0",
          color: "from-green-500 to-pink-500"
        },
        {
          label: "Assignments",
          value: dashboardData.stats.assignments?.toString() || "0",
          icon: FileText,
          change: "+0",
          color: "from-green-500 to-emerald-500"
        },
        {
          label: "Madina Score",
          value: `${dashboardData.stats.avg_score || "0"}%`,
          icon: BarChart3,
          change: "+0%",
          color: "from-yellow-500 to-orange-500"
        },
      ];

      setStats(statsArray);
      setProgressStats({
        completionRate: dashboardData.stats.completion_rate || 0,
        streak: dashboardData.stats.streak || 0,
        level: dashboardData.stats.level || 1,
        points: dashboardData.stats.points || 0,
        nextLevel: dashboardData.stats.next_level || 100
      });

    } catch (error) {
      console.error('Madina data fetch failed:', error);
      toast.error('AI system temporarily offline');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async (classItem) => {
    const hasActiveVideoSession = classItem.video_session?.status === 'active' && !classItem.video_session.ended_at;

    if (!hasActiveVideoSession) {
      toast.error('Madina session not active');
      return;
    }

    if (!classItem.video_session?.meeting_id) {
      toast.error('Session ID missing');
      return;
    }

    setSelectedClassForCall(classItem);
    setShowVideoCall(true);
    toast.success('Initiating Madina connection...');
  };

  const handleSubmitAssignment = async (submissionData) => {
    try {
      await studentApi.submitAssignment(submissionData);
      toast.success('Mission accomplished! AI reviewing submission...');
      const assignmentsData = await studentApi.getMyAssignments();
      setAssignments(assignmentsData.assignments || []);
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      console.log('🎓 Student logout initiated...');

      // Emergency video call cleanup
      if (showVideoCall) {
        try {
          // Force leave any active call
          // Note: agoraClient would need to be accessible here or passed as prop
        } catch (e) {
          console.warn('Video cleanup warning:', e);
        }
      }

      // Clear all application data
      localStorage.clear();
      sessionStorage.clear();

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Navigate to login
      toast.success('🎓 Successfully logged out');
      navigate('/login');

    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation even if error
      localStorage.clear();
      navigate('/login');
    }
  };

  // Effects
  useEffect(() => {
    fetchStudentData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };

      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-violet-900 flex items-center justify-center">
      <div className="text-center">
      <div className="relative">
      <Loader2 className="animate-spin mx-auto text-cyan-400" size={64} />
      <Sparkles className="absolute inset-0 text-green-400 animate-pulse" size={64} />
      </div>
      <p className="text-cyan-200 mt-6 text-xl font-bold">Initializing Madina Dashboard</p>
      <p className="text-green-300 mt-2">Optimizing your learning matrix</p>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-violet-900 flex">
    {/* Madina Video Call */}
    {showVideoCall && selectedClassForCall && (
      <StudentVideoCall
      classItem={selectedClassForCall}
      isOpen={showVideoCall}
      onClose={() => {
        setShowVideoCall(false);
        setSelectedClassForCall(null);
      }}
      />
    )}

    {/* Neural Sidebar */}
    <div className={`
      fixed inset-y-0 left-0 z-40 w-80 bg-gradient-to-b from-gray-900/95 to-green-900/95 backdrop-blur-xl transform transition-transform duration-300 ease-in-out border-r border-cyan-500/20
      ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      md:translate-x-0 md:relative
      `}>
      <div className="flex flex-col h-full">
      {/* Madina Header */}
      <div className="p-8 border-b border-cyan-500/20">
      <div className="flex items-center space-x-3 mb-4">
      <Gem className="text-cyan-400" size={32} />
      <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
      Madina Quran Classes
      </h1>
      </div>
      </div>
      </div>

      {/* Neural Navigation */}
      <nav className="flex-1 p-6 space-y-2">
      {[
        { id: "classes", label: "Madina Sessions", icon: Video, color: "from-cyan-500 to-blue-500" },
        { id: "assignments", label: "Assignments", icon: FileText, color: "from-green-500 to-emerald-500" },
        { id: "exams", label: "Exams", icon: ClipboardList, color: "from-green-500 to-pink-500" },
        { id: "payments", label: "Madina Transactions", icon: CreditCard, color: "from-yellow-500 to-orange-500" },
        { id: "progress", label: "Analytics", icon: TrendingUp, color: "from-red-500 to-pink-500" },
      ].map((item) => (
        <button
        key={item.id}
        onClick={() => {
          setActiveSection(item.id);
          if (isMobile) setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center px-6 py-4 rounded-2xl transition-all duration-200 group ${
          activeSection === item.id
          ? "bg-gradient-to-r shadow-lg shadow-cyan-500/25"
          : "hover:bg-cyan-500/10 text-cyan-200"
        } ${activeSection === item.id ? item.color : ''}`}
        >
        <item.icon className="mr-4" size={24} />
        <span className={`font-semibold ${
          activeSection === item.id ? 'text-white' : 'group-hover:text-white'
        }`}>
        {item.label}
        </span>
        </button>
      ))}
      </nav>

      {/* Madina Profile */}
      <div className="p-6 border-t border-cyan-500/20">
      <div className="flex items-center space-x-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
      <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
      <User size={24} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
      <p className="text-white font-bold text-sm truncate">{studentName}</p>
      <p className="text-cyan-300 text-xs truncate">Madina Learner</p>
      </div>
      </div>
      </div>
      </div>
      </div>

      {/* Main Madina Interface */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-0">
      {/* Neural Header */}
      <header className="bg-gradient-to-r from-gray-900/50 to-green-900/50 backdrop-blur-xl border-b border-cyan-500/20 sticky top-0 z-30">
      <div className="px-8 py-6">
      <div className="flex items-center justify-between">
      <div className="flex items-center space-x-6">
      <button
      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      className="md:hidden p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all duration-200"
      >
      {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent capitalize">
      {activeSection === 'classes' && 'Madina Sessions'}
      {activeSection === 'assignments' && 'AI Missions'}
      {activeSection === 'exams' && 'Neural Assessments'}
      {activeSection === 'payments' && 'Madina Transactions'}
      {activeSection === 'progress' && 'AI Analytics'}
      </h2>
      </div>

      <div className="flex items-center space-x-4">
      {/* AI Notifications */}
      <div className="relative">
      <button
      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
      className="relative p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all duration-200"
      >
      <Bell size={20} />
      {notifications.filter(n => !n.read).length > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center shadow-lg">
        {notifications.filter(n => !n.read).length}
        </span>
      )}
      </button>
      <NotificationsDropdown
      isOpen={isNotificationsOpen}
      onClose={() => setIsNotificationsOpen(false)}
      notifications={notifications}
      onNotificationClick={() => {}}
      onMarkAllAsRead={() => {}}
      onClearAll={() => {}}
      onDeleteNotification={() => {}}
      />
      </div>

      {/* Madina User Menu */}
      <div className="relative">
      <button
      onClick={() => setUserMenuOpen(!userMenuOpen)}
      className="flex items-center space-x-3 p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all duration-200"
      >
      <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
      <User size={20} className="text-white" />
      </div>
      <ChevronDown size={16} className="text-cyan-300" />
      </button>

      {userMenuOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-gradient-to-br from-gray-800 to-gray-900 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl z-50">
        <div className="p-2">
        <button className="w-full flex items-center px-4 py-3 text-sm text-cyan-200 hover:bg-cyan-500/10 rounded-xl transition-all duration-200">
        <Settings className="mr-3" size={18} />
        Madina Settings
        </button>
        <button
        onClick={handleLogout}
        className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
        <LogOut size={16} className="mr-2" />
        Madina Logout
        </button>
        </div>
        </div>
      )}
      </div>
      </div>
      </div>
      </div>
      </header>

      {/* Madina Main Content */}
      <main className="flex-1 p-8 overflow-auto">
      {/* AI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <motion.div
        key={stat.label}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg border border-cyan-500/20 rounded-2xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-2xl"
        >
        <div className="flex items-center justify-between">
        <div>
        <p className="text-cyan-300 text-sm font-semibold mb-2">{stat.label}</p>
        <p className="text-white text-2xl font-bold mb-1">{stat.value}</p>
        <p className="text-cyan-400 text-xs">{stat.change} this week</p>
        </div>
        <div className={`p-4 rounded-2xl bg-gradient-to-r ${stat.color} shadow-lg`}>
        <stat.icon className="text-white" size={24} />
        </div>
        </div>
        </motion.div>
      ))}
      </div>

      {/* Madina Progress Matrix */}
      <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.4 }}
      className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg border border-cyan-500/20 rounded-2xl p-8 mb-8"
      >
      <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
      <TrendingUp className="mr-3" size={28} />
      <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
      Madina Progress Matrix
      </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {[
        { label: "Completion", value: `${progressStats.completionRate}%`, icon: Target },
        { label: "Madina Streak", value: `${progressStats.streak} days`, icon: Zap },
        { label: "Neural Level", value: `Level ${progressStats.level}`, icon: Star },
        { label: "Experience", value: `${progressStats.points} XP`, icon: Gem },
      ].map((item, index) => (
        <div key={index} className="text-center p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20">
        <item.icon className="mx-auto text-cyan-400 mb-3" size={32} />
        <div className="text-2xl font-bold text-white mb-2">{item.value}</div>
        <div className="text-cyan-300 text-sm">{item.label}</div>
        </div>
      ))}
      </div>
      </motion.div>

      {/* Madina Content Sections */}
      <AnimatePresence mode="wait">
      {activeSection === 'classes' && (
        <motion.section
        key="classes"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8"
        >
        {/* Madina Sessions Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center space-x-4">
        <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
        Madina Sessions
        </h3>
        {(() => {
          const liveClasses = classes.filter(classItem =>
          getTimeUntilClass(classItem).status === 'live'
          );
          if (liveClasses.length > 0) {
            return (
              <div className="flex items-center space-x-3 bg-gradient-to-r from-red-600 to-pink-600 px-6 py-3 rounded-2xl shadow-lg animate-pulse">
              <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
              <span className="text-white font-bold text-sm">
              {liveClasses.length} LIVE SESSION{liveClasses.length > 1 ? 'S' : ''}
              </span>
              </div>
            );
          }
          return null;
        })()}
        </div>

        <button
        onClick={fetchStudentData}
        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-3 px-6 rounded-2xl flex items-center transition-all duration-200 shadow-lg"
        >
        <RefreshCw className="mr-3" size={20} />
        Madina Refresh
        </button>
        </div>

        {/* Madina Sessions Content */}
        {classes.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-2xl border border-cyan-500/20 backdrop-blur-lg">
          <Video className="mx-auto text-cyan-400 mb-6" size={80} />
          <h4 className="text-white text-2xl font-bold mb-4">No Madina Sessions</h4>
          <p className="text-cyan-300 text-lg">Your AI-optimized learning sessions will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
          {/* Live Sessions */}
          {(() => {
            const liveClasses = classes.filter(classItem =>
            getTimeUntilClass(classItem).status === 'live'
            );
            if (liveClasses.length > 0) {
              return (
                <div className="space-y-4">
                <div className="flex items-center space-x-4">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                <h4 className="text-xl font-bold text-white bg-gradient-to-r from-red-600 to-pink-600 px-6 py-3 rounded-2xl">
                🔴 Madina LIVE ({liveClasses.length})
                </h4>
                </div>
                <div className="grid gap-6">
                {liveClasses.map((classItem) => (
                  <ClassItem
                  key={classItem.id}
                  classItem={classItem}
                  formatDate={(date) => new Date(date).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                  })}
                  formatTime={(date) => new Date(date).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                  })}
                  getTimeUntilClass={getTimeUntilClass}
                  onJoinClass={handleJoinClass}
                  />
                ))}
                </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Upcoming Sessions */}
          {(() => {
            const upcomingClasses = classes.filter(classItem => {
              const timeInfo = getTimeUntilClass(classItem);
              return timeInfo.status === 'upcoming' || timeInfo.status === 'starting';
            });
            if (upcomingClasses.length > 0) {
              return (
                <div className="space-y-4">
                <h4 className="text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 rounded-2xl">
                ⏰ Madina SCHEDULED ({upcomingClasses.length})
                </h4>
                <div className="grid gap-4">
                {upcomingClasses.map((classItem) => (
                  <ClassItem
                  key={classItem.id}
                  classItem={classItem}
                  formatDate={(date) => new Date(date).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                  })}
                  formatTime={(date) => new Date(date).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                  })}
                  getTimeUntilClass={getTimeUntilClass}
                  onJoinClass={handleJoinClass}
                  />
                ))}
                </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Completed Sessions */}
          {(() => {
            const completedClasses = classes.filter(classItem =>
            getTimeUntilClass(classItem).status === 'completed'
            );
            if (completedClasses.length > 0) {
              return (
                <div className="space-y-4">
                <h4 className="text-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 rounded-2xl">
                ✅ Madina ARCHIVE ({completedClasses.length})
                </h4>
                <div className="grid gap-4">
                {completedClasses.map((classItem) => (
                  <ClassItem
                  key={classItem.id}
                  classItem={classItem}
                  formatDate={(date) => new Date(date).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                  })}
                  formatTime={(date) => new Date(date).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                  })}
                  getTimeUntilClass={getTimeUntilClass}
                  onJoinClass={handleJoinClass}
                  />
                ))}
                </div>
                </div>
              );
            }
            return null;
          })()}
          </div>
        )}
        </motion.section>
      )}

      {activeSection === 'assignments' && (
        <motion.section
        key="assignments"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8"
        >
        <div className="flex justify-between items-center">
        <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
        AI Missions
        </h3>
        <div className="flex space-x-4">
        <select className="bg-gradient-to-r from-gray-800 to-gray-700 border border-cyan-500/30 rounded-2xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent backdrop-blur-lg">
        <option>All Missions</option>
        <option>Active</option>
        <option>Completed</option>
        <option>Graded</option>
        </select>
        <button
        onClick={fetchStudentData}
        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-3 px-6 rounded-2xl flex items-center transition-all duration-200 shadow-lg"
        >
        <RefreshCw className="mr-3" size={20} />
        Refresh
        </button>
        </div>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-2xl border border-cyan-500/20 backdrop-blur-lg">
          <FileText className="mx-auto text-cyan-400 mb-6" size={80} />
          <h4 className="text-white text-2xl font-bold mb-4">No Active Assignments</h4>
          <p className="text-cyan-300 text-lg">Your Assignments will appear here</p>
          </div>
        ) : (
          <div className="grid gap-6">
          {assignments.map((assignment) => (
            <AssignmentItem
            key={assignment.id}
            assignment={assignment}
            onSubmitAssignment={handleSubmitAssignment}
            formatDate={(date) => new Date(date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric'
            })}
            />
          ))}
          </div>
        )}
        </motion.section>
      )}

      {/* Add other sections similarly with Madina styling */}
      </AnimatePresence>
      </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && isMobile && (
        <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
        onClick={() => setIsSidebarOpen(false)}
        />
      )}
      </div>
  );
}
