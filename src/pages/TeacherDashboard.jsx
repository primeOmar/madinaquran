import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from '../lib/agora/videoApi';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, Users, Clock,Settings,Share2,
  MessageCircle,User,Maximize2,Minimize2,Grid3X3,Pin,MoreVertical,Crown,Shield,Zap,
  BarChart3,Download,MessageSquare,BookOpen,Bell,LogOut,Loader2,
  Calendar,
  Play,
  Search,
  Plus,
  FileText,
  FileCheck,Move,
  Trash2,
  X,
  ChevronDown,
  Menu,
  XCircle,
  CheckCircle,
  Edit,
  Eye,
  Award,
  Rocket,
  RefreshCw,
  Brain,
  TrendingUp,
  Square,
  StopCircle,
  Maximize,
  Minimize,
  Copy,
  Phone, Wifi,
  WifiOff
} from "lucide-react";
import { useAuth } from '../components/AuthContext';
import { teacherApi } from '../lib/teacherApi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";

// Madina Design System Components
const MadinaCard = ({ children, className = "", gradient = "from-blue-900/50 to-purple-900/50", ...props }) => (
  <div
  className={`bg-gradient-to-br ${gradient} backdrop-blur-lg border border-cyan-500/20 rounded-2xl p-6 shadow-2xl ${className}`}
  {...props}
  >
  {children}
  </div>
);

const MadinaButton = ({ children, variant = "primary", className = "", ...props }) => {
  const baseClasses = "px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center";

  const variants = {
    primary: "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg",
    success: "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg",
    danger: "bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg",
    warning: "bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 text-white shadow-lg",
    ghost: "bg-white/10 hover:bg-white/20 text-white border border-white/20"
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
    {children}
    </button>
  );
};

const MadinaBadge = ({ children, variant = "info", className = "" }) => {
  const baseClasses = "px-3 py-1 rounded-full text-xs font-bold backdrop-blur-lg border";

  const variants = {
    info: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    success: "bg-green-500/20 text-green-300 border-green-500/30",
    warning: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    danger: "bg-red-500/20 text-red-300 border-red-500/30",
    live: "bg-red-500/20 text-red-300 border-red-500/30 animate-pulse"
  };

  return (
    <span className={`${baseClasses} ${variants[variant]} ${className}`}>
    {children}
    </span>
  );
};

// Enhanced Audio Recorder with Madina Design
const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingTime(0);

      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        setIsRecording(false);
        setAudioData('demo-audio-data');
        toast.success('🎙️ Madina recording complete!');
      }, 5000);
    } catch (error) {
      toast.error('🚫 Failed to start neural recording');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const clearRecording = () => {
    setAudioData(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    audioData,
    recordingTime: formatTime(recordingTime),
    startRecording,
    stopRecording,
    clearRecording,
    hasRecording: !!audioData
  };
};

// Quick Rejoin Section Component
const QuickRejoinSection = ({ recentSessions, onRejoin }) => {
  if (!recentSessions || recentSessions.length === 0) return null;


};

/**
 * Production-ready Agora RTC initialization function
 * Features: Error handling, logging, token support, and fallback mechanisms
 */
const initializeAgora = async (options = {}) => {
  const {
    channelName = `class-${Date.now()}`,
    enableAudio = true,
    enableVideo = true,
    token = null,
    uid = null
  } = options;

  try {
    console.group('🎥 Agora RTC Initialization');

    // 1. Validate Agora SDK
    if (typeof AgoraRTC === 'undefined') {
      throw new Error('Agora SDK not loaded. Check network and script tags.');
    }

    // 2. Validate App ID
    const appId = import.meta.env.VITE_AGORA_APP_ID?.trim();

    if (!appId) {
      throw new Error('Agora App ID not found in environment variables.');
    }

    if (appId.includes('your_agora_app_id') || appId.length < 10) {
      throw new Error('Invalid Agora App ID. Please check your VITE_AGORA_APP_ID environment variable.');
    }

    console.log('📋 Agora Configuration:', {
      appId: `${appId.substring(0, 8)}...`,
                channelName,
                hasToken: !!token
    });

    // 3. Network connectivity check
    if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your network.');
    }

    // 4. Initialize client with better error handling
    const client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });

    // 5. Set up connection state monitoring
    client.on('connection-state-change', (curState, prevState) => {
      console.log('🔗 Connection State:', { from: prevState, to: curState });
    });

    // 6. Join channel with timeout
    console.log('🚀 Joining channel...');

    const joinPromise = client.join(appId, channelName, token, uid);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout - check firewall/network')), 15000);
    });

    await Promise.race([joinPromise, timeoutPromise]);

    console.log('✅ Agora initialized successfully');
    console.groupEnd();

    return {
      client,
      appId: `${appId.substring(0, 8)}...`,
      channelName,
      localUid: client.uid
    };

  } catch (error) {
    console.groupEnd();

    // Enhanced error analysis
    let userMessage = 'Video service unavailable. ';

    if (error.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
      userMessage += 'Network blocked. Check firewall or try different network.';
    } else if (error.message.includes('timeout')) {
      userMessage += 'Connection timeout. Check internet stability.';
    } else if (error.message.includes('INVALID_APP_ID')) {
      userMessage += 'Invalid App ID configuration.';
    } else if (error.message.includes('network') || error.message.includes('firewall')) {
      userMessage += 'Network issue detected.';
    } else {
      userMessage += 'Please try again or contact support.';
    }

    console.error('❌ Agora Initialization Failed:', {
      error: error.message,
      code: error.code,
      suggestion: userMessage
    });

    throw new Error(userMessage);
  }
};


// Production-ready Teacher Video Call Component
const TeacherVideoCall = ({ classItem, isOpen, onClose }) => {
  // STATE
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [networkQuality, setNetworkQuality] = useState({ upload: 0, download: 0 });
  const [participants, setParticipants] = useState([]);
  const [localVideoReady, setLocalVideoReady] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);

  // REFS
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const agoraClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const remoteUsersMapRef = useRef(new Map());

  // LOGGING
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 📹 TEACHER: ${message}`, data || '');
  }, []);

  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ TEACHER ERROR: ${message}`, error);
  }, []);

  // CLEANUP
  const performCompleteCleanup = useCallback(async () => {
    debugLog('🧹 Starting cleanup...');

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const cleanupTrack = async (track, type) => {
        if (track) {
          try {
            track.stop();
            track.close();
            debugLog(`✅ ${type} track cleaned`);
          } catch (e) {
            debugError(`Error cleaning ${type}:`, e);
          }
        }
      };

      await Promise.all([
        cleanupTrack(localTracksRef.current.audio, 'audio'),
                        cleanupTrack(localTracksRef.current.video, 'video')
      ]);

      localTracksRef.current = { audio: null, video: null };

      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          debugLog('✅ Left channel');
        } catch (e) {
          debugError('Leave error:', e);
        }
        agoraClientRef.current = null;
      }

      remoteUsersMapRef.current.clear();

      if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        setCallDuration(0);
        setError('');
        setParticipants([]);
        setLocalVideoReady(false);
        setSessionInfo(null);
      }

      debugLog('✅ Cleanup complete');
    } catch (error) {
      debugError('Cleanup error:', error);
    }
  }, [debugLog, debugError]);

  // CREATE LOCAL TRACKS
  const createLocalTracks = useCallback(async () => {
    debugLog('🎤 Creating tracks...');

    try {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
        encoderConfig: { sampleRate: 48000, stereo: true }
      });

      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrateMin: 1000,
          bitrateMax: 2000
        },
        optimizationMode: 'detail'
      });

      localTracksRef.current.audio = audioTrack;
      localTracksRef.current.video = videoTrack;

      debugLog('✅ Tracks created');
      return { audio: audioTrack, video: videoTrack };
    } catch (error) {
      debugError('Track creation failed:', error);
      throw error;
    }
  }, [debugLog, debugError]);

  // PLAY LOCAL VIDEO
  const playLocalVideo = useCallback(async () => {
    if (!localVideoRef.current || !localTracksRef.current.video) {
      debugError('Cannot play: missing ref/track');
      return;
    }

    try {
      localVideoRef.current.innerHTML = '';
  await localTracksRef.current.video.play(localVideoRef.current, {
    mirror: true,
    fit: 'cover'
  });
  setLocalVideoReady(true);
  debugLog('✅ Local video playing');
    } catch (error) {
      debugError('Play error:', error);
      setLocalVideoReady(true);
    }
  }, [debugLog, debugError]);

  // REMOTE VIDEO SETUP
  const setupRemoteVideo = useCallback(async (user) => {
    debugLog(`📺 Setup remote video: ${user.uid}`);
    const container = remoteVideosContainerRef.current;
    if (!container) return;

    const existingElement = document.getElementById(`remote-video-${user.uid}`);
    if (existingElement) existingElement.remove();

    const videoElement = document.createElement('div');
    videoElement.id = `remote-video-${user.uid}`;
    videoElement.className = 'remote-video-item bg-gray-800 rounded-lg overflow-hidden relative min-h-[200px]';

    container.appendChild(videoElement);

    try {
      if (user.videoTrack) {
        await user.videoTrack.play(videoElement);
        debugLog(`✅ Remote video playing: ${user.uid}`);

        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs';
        overlay.textContent = `Student ${user.uid}`;
        videoElement.appendChild(overlay);
      }
    } catch (error) {
      debugError(`Remote video error ${user.uid}:`, error);
    }
  }, [debugLog, debugError]);

  const removeRemoteVideo = useCallback((uid) => {
    const videoElement = document.getElementById(`remote-video-${uid}`);
    if (videoElement) videoElement.remove();
  }, []);

    // REMOTE USER HANDLING
    const setupRemoteUserHandling = useCallback((client) => {
      debugLog('📡 Setting up remote handlers');

      client.on('user-published', async (user, mediaType) => {
        debugLog(`🔔 User ${user.uid} published ${mediaType}`);

        try {
          await client.subscribe(user, mediaType);
          debugLog(`✅ Subscribed to ${user.uid} ${mediaType}`);

          if (!remoteUsersMapRef.current.has(user.uid)) {
            remoteUsersMapRef.current.set(user.uid, {
              uid: user.uid,
              hasVideo: false,
              hasAudio: false,
              role: 'student'
            });
          }

          const userInfo = remoteUsersMapRef.current.get(user.uid);

          if (mediaType === 'video') {
            userInfo.hasVideo = true;
            await setupRemoteVideo(user);
          } else if (mediaType === 'audio') {
            userInfo.hasAudio = true;
            user.audioTrack.play();
            debugLog(`🔊 Playing audio from ${user.uid}`);
          }

          setParticipants(Array.from(remoteUsersMapRef.current.values()));
        } catch (error) {
          debugError(`Subscribe error ${user.uid}:`, error);
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        debugLog(`🔕 User ${user.uid} unpublished ${mediaType}`);

        if (remoteUsersMapRef.current.has(user.uid)) {
          const userInfo = remoteUsersMapRef.current.get(user.uid);
          if (mediaType === 'video') {
            userInfo.hasVideo = false;
            removeRemoteVideo(user.uid);
          } else if (mediaType === 'audio') {
            userInfo.hasAudio = false;
          }
          setParticipants(Array.from(remoteUsersMapRef.current.values()));
        }
      });

      client.on('user-left', (user) => {
        debugLog(`👋 User ${user.uid} left`);
        remoteUsersMapRef.current.delete(user.uid);
        removeRemoteVideo(user.uid);
        setParticipants(Array.from(remoteUsersMapRef.current.values()));
      });

      client.on('network-quality', (quality) => {
        setNetworkQuality({
          upload: quality.uplinkNetworkQuality,
          download: quality.downlinkNetworkQuality
        });
      });

      client.on('connection-state-change', (curState, prevState) => {
        debugLog(`🔄 Connection state: ${prevState} -> ${curState}`);
      });

      debugLog('✅ Remote handlers configured');
    }, [debugLog, debugError, setupRemoteVideo, removeRemoteVideo]);

    // JOIN CHANNEL - TEACHER SPECIFIC
    const joinChannel = useCallback(async () => {
      if (!isOpen || !classItem?.id || isConnecting || isConnected) {
        debugLog('⚠️ Cannot join - invalid state');
        return;
      }

      debugLog('🚀 TEACHER STARTING JOIN');
      setIsConnecting(true);
      setError('');

      try {
        // STEP 1: Get or create session using teacher API
        debugLog('🎯 Getting or creating session via teacher API...');
        const sessionData = await teacherApi.getOrCreateActiveSession(classItem.id);

        if (!sessionData || !sessionData.agora_credentials) {
          throw new Error('Failed to get session credentials');
        }

        const { appId, channel, token, uid } = sessionData.agora_credentials;

        debugLog('🎯 TEACHER CREDENTIALS:', {
          channel,
          uid,
          appId: appId ? '✅' : '❌',
          token: token ? '✅' : '❌'
        });

        setSessionInfo({
          meetingId: sessionData.meeting_id,
          isNewSession: sessionData.isNewSession
        });

        // STEP 2: Create tracks
        await createLocalTracks();

        // STEP 3: Play local video
        await playLocalVideo();

        // STEP 4: Initialize Agora
        debugLog('🔧 Creating Agora client...');
        const client = AgoraRTC.createClient({
          mode: 'rtc',
          codec: 'vp8'
        });
        agoraClientRef.current = client;

        // STEP 5: Setup handlers
        setupRemoteUserHandling(client);

        // STEP 6: Join channel
        debugLog(`🚪 TEACHER joining channel: ${channel}`);
        await client.join(appId, channel, token || null, uid || null);
        debugLog('✅ TEACHER joined channel');

        // STEP 7: Publish tracks
        debugLog('📤 Publishing teacher tracks...');
        const tracks = [localTracksRef.current.audio, localTracksRef.current.video].filter(Boolean);
        if (tracks.length > 0) {
          await client.publish(tracks);
          debugLog(`✅ Published ${tracks.length} teacher tracks`);
        }

        // STEP 8: Connection successful
        setIsConnected(true);
        setIsConnecting(false);

        // STEP 9: Start timer
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

        debugLog('🎉 TEACHER READY! Session active');

      } catch (error) {
        debugError('❌ TEACHER JOIN FAILED:', error);

        let errorMessage = 'Failed to start/join session';
    if (error.message?.includes('permission')) {
      errorMessage = 'Camera/microphone permission required';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network error - check your connection';
    } else if (error.message?.includes('Unauthorized')) {
      errorMessage = 'You are not authorized to start this session';
    } else {
      errorMessage = error.message || errorMessage;
    }

    setError(errorMessage);
    setIsConnecting(false);
    await performCompleteCleanup();
      }
    }, [
      isOpen,
      classItem,
      isConnecting,
      isConnected,
      createLocalTracks,
      playLocalVideo,
      setupRemoteUserHandling,
      performCompleteCleanup,
      debugLog,
      debugError
    ]);

    // END SESSION
    const endSession = useCallback(async () => {
      debugLog('🛑 Teacher ending session...');

      try {
        if (sessionInfo?.meetingId) {
          // Use teacher API to properly end the session
          await teacherApi.endVideoSession(sessionInfo.meetingId);
          debugLog('✅ Session ended via backend');
        }
      } catch (error) {
        debugError('Error ending session via backend:', error);
        // Continue with cleanup even if backend call fails
      }

      await performCompleteCleanup();
      onClose();
    }, [sessionInfo, performCompleteCleanup, onClose, debugLog, debugError]);

    // CONTROLS
    const toggleAudio = useCallback(async () => {
      if (!localTracksRef.current.audio || !isConnected) return;

      try {
        const newMutedState = !isAudioMuted;
        await localTracksRef.current.audio.setEnabled(!newMutedState);
        setIsAudioMuted(newMutedState);
        debugLog(`🎤 Audio ${newMutedState ? 'MUTED' : 'UNMUTED'}`);
      } catch (error) {
        debugError('Toggle audio failed:', error);
      }
    }, [isAudioMuted, isConnected, debugLog, debugError]);

    const toggleVideo = useCallback(async () => {
      if (!localTracksRef.current.video || !isConnected) return;

      try {
        const newVideoOffState = !isVideoOff;
        await localTracksRef.current.video.setEnabled(!newVideoOffState);
        setIsVideoOff(newVideoOffState);
        debugLog(`📹 Video ${newVideoOffState ? 'OFF' : 'ON'}`);
      } catch (error) {
        debugError('Toggle video failed:', error);
      }
    }, [isVideoOff, isConnected, debugLog, debugError]);

    // EFFECTS
    useEffect(() => {
      isMountedRef.current = true;
      debugLog('🎬 Teacher component mounted');

      return () => {
        debugLog('🎬 Teacher component unmounting');
        isMountedRef.current = false;
        performCompleteCleanup();
      };
    }, [performCompleteCleanup, debugLog]);

    useEffect(() => {
      if (isOpen && classItem?.id) {
        debugLog('🔔 Teacher dialog opened, scheduling join...');
        const timeout = setTimeout(() => {
          joinChannel();
        }, 500);
        return () => clearTimeout(timeout);
      }
    }, [isOpen, classItem, joinChannel, debugLog]);

    // RENDER HELPERS
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getNetworkIcon = (quality) => {
      if (quality <= 2) return <Wifi className="w-4 h-4 text-green-400" />;
      if (quality <= 4) return <Wifi className="w-4 h-4 text-yellow-400" />;
      return <WifiOff className="w-4 h-4 text-red-400" />;
    };

    const totalParticipants = participants.length + 1;

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-sm text-white p-4 border-b border-gray-700 flex items-center justify-between">
      <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${
        isConnected ? 'bg-green-500 animate-pulse' :
        isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
      }`} />
      <div>
      <h2 className="text-lg font-bold">{classItem?.title || 'Class Session'} - Teacher</h2>
      <div className="flex items-center gap-2 text-sm text-gray-300">
      <span>You (Teacher)</span>
      <span>•</span>
      <span>{formatTime(callDuration)}</span>
      {sessionInfo?.isNewSession && (
        <>
        <span>•</span>
        <span className="bg-green-500 px-2 py-0.5 rounded text-xs">NEW SESSION</span>
        </>
      )}
      {isConnected && (
        <>
        <span>•</span>
        {getNetworkIcon(networkQuality.upload)}
        </>
      )}
      </div>
      </div>
      </div>

      <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-gray-300">
      <Users size={16} />
      <span>{totalParticipants}</span>
      </div>
      <button
      onClick={endSession}
      className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
      <Phone size={18} />
      <span className="hidden sm:inline">End Class</span>
      </button>
      </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-600/90 text-white p-4 mx-4 mt-4 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
        <AlertCircle size={16} />
        <span className="text-sm font-medium">{error}</span>
        </div>
        <button onClick={() => setError('')} className="text-xl font-bold hover:text-gray-200">×</button>
        </div>
      )}

      {/* Main Video Area */}
      <div className="flex-1 relative p-4">
      <div ref={remoteVideosContainerRef} className="w-full h-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {participants.length === 0 && isConnected && (
        <div className="col-span-full flex items-center justify-center text-gray-400">
        <div className="text-center">
        <Users size={48} className="mx-auto mb-2 opacity-50" />
        <p>Waiting for students to join...</p>
        <p className="text-sm text-gray-500 mt-2">Share the class code with your students</p>
        </div>
        </div>
      )}
      </div>

      {/* Local Video PIP */}
      <div className="absolute bottom-4 right-4 w-48 h-36 md:w-64 md:h-48 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-white/20">
      <div ref={localVideoRef} className="w-full h-full bg-gray-800" />

      {!localVideoReady && isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
        <div className="animate-spin h-6 w-6 border-b-2 border-white rounded-full"></div>
        </div>
      )}

      {isVideoOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
        <VideoOff className="text-gray-500 w-8 h-8" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
      You (Teacher) {isConnected && '(Live)'}
      </div>

      <div className="absolute top-2 right-2 flex gap-1">
      {isAudioMuted && <div className="bg-red-500 p-1 rounded"><MicOff size={10} className="text-white" /></div>}
      {isVideoOff && <div className="bg-red-500 p-1 rounded"><VideoOff size={10} className="text-white" /></div>}
      </div>
      </div>

      {/* Connecting Overlay */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
        <div className="text-center text-white bg-gray-800/90 p-8 rounded-2xl">
        <div className="animate-spin h-16 w-16 border-b-2 border-white rounded-full mx-auto mb-4"></div>
        <h3 className="text-xl font-semibold mb-2">Starting Class Session...</h3>
        <p className="text-gray-300">Setting up camera, microphone, and classroom</p>
        </div>
        </div>
      )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800/90 border-t border-gray-700 p-4 md:p-6">
      <div className="flex items-center justify-center gap-3 md:gap-6">
      <button
      onClick={toggleAudio}
      disabled={!isConnected}
      className={`p-3 md:p-4 rounded-2xl transition-all ${
        isAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white hover:bg-gray-100 text-gray-700'
      } ${isAudioMuted ? 'text-white' : ''} disabled:opacity-50 border-2 ${
        isAudioMuted ? 'border-red-400' : 'border-gray-300'
      }`}
      >
      {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>

      <button
      onClick={toggleVideo}
      disabled={!isConnected}
      className={`p-3 md:p-4 rounded-2xl transition-all ${
        isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white hover:bg-gray-100 text-gray-700'
      } ${isVideoOff ? 'text-white' : ''} disabled:opacity-50 border-2 ${
        isVideoOff ? 'border-red-400' : 'border-gray-300'
      }`}
      >
      {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
      </button>

      <button className="p-3 md:p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white transition-colors">
      <MessageCircle size={20} />
      </button>

      <button className="p-3 md:p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white transition-colors">
      <MoreVertical size={20} />
      </button>
      </div>
      </div>
      </div>
    );
};



// Classes Tab Component
const ClassesTab = ({
  classes,
  formatDateTime,
    onStartVideoSession,
    onJoinExistingSession,
    onEndVideoSession,
    onDeleteClass,
    onRejoinSession,
    startingSession,
    endingSession,
    videoCallError,
    setVideoCallError,
    recentSessions
}) => {
  const [localDeletingClass, setLocalDeletingClass] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [joiningSession, setJoiningSession] = useState(null);
  const [showVideoLoader, setShowVideoLoader] = useState(false);

  // Define helper functions BEFORE useMemo to avoid hoisting issues
  const hasActiveSession = (classItem) => {
    return classItem.video_sessions?.some(s => s.status === 'active') ||
    classItem.video_session?.status === 'active';
  };

  const isClassLive = (classItem) => {
    const classTime = new Date(classItem.scheduled_date);
    const now = new Date();
    const timeDiff = now - classTime;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    return hoursDiff >= -0.5 && hoursDiff <= 2 && classItem.status === 'scheduled';
  };

  const canStartVideo = (classItem) => {
    const classTime = new Date(classItem.scheduled_date);
    const now = new Date();
    const timeDiff = classTime - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    return classItem.status === 'scheduled' && hoursDiff > -2 && !hasActiveSession(classItem);
  };

  const getActiveSession = (classItem) => {
    return classItem.video_sessions?.find(s => s.status === 'active') ||
    classItem.video_session;
  };

  // Enhanced session joining with animation
  const handleStartSessionWithAnimation = async (classItem) => {
    setJoiningSession(classItem.id);
    setShowVideoLoader(true);

    try {
      await onStartVideoSession(classItem);
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      // Keep loader visible for minimum time for better UX
      setTimeout(() => {
        setJoiningSession(null);
        setShowVideoLoader(false);
      }, 2000);
    }
  };

  const handleRejoinSessionWithAnimation = async (classItem) => {
    setJoiningSession(classItem.id);
    setShowVideoLoader(true);

    try {
      await handleEnhancedRejoin(classItem);
    } catch (error) {
      console.error('Failed to rejoin session:', error);
    } finally {
      setTimeout(() => {
        setJoiningSession(null);
        setShowVideoLoader(false);
      }, 2000);
    }
  };

  // Now useMemo can safely use these functions
  const { upcomingClasses, completedClasses, activeClasses } = useMemo(() => {
    const now = new Date();
    const sortedClasses = [...classes].sort((a, b) => {
      return new Date(a.scheduled_date) - new Date(b.scheduled_date);
    });

    // Active classes (currently live)
    const active = sortedClasses.filter(cls => {
      return hasActiveSession(cls) || isClassLive(cls);
    });

    // Upcoming classes
    const upcoming = sortedClasses.filter(cls => {
      const classTime = new Date(cls.scheduled_date);
      const timeDiff = classTime - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return hoursDiff > -2 && cls.status === 'scheduled' && !hasActiveSession(cls);
    });

    // Completed classes
    const completed = sortedClasses.filter(cls => {
      const classTime = new Date(cls.scheduled_date);
      const timeDiff = classTime - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return (hoursDiff <= -2 || cls.status === 'completed') && !hasActiveSession(cls);
    });

    return {
      activeClasses: active,
      upcomingClasses: upcoming,
      completedClasses: completed
    };
  }, [classes]);

  const copyClassLink = (meetingId) => {
    const link = `${window.location.origin}/join-class/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('🔗 Madina link copied to  clipboard!');
  };

  const handleDeleteClass = async (classItem) => {
    try {
      setLocalDeletingClass(classItem.id);
      await onDeleteClass(classItem.id);
    } catch (error) {
      setLocalDeletingClass(null);
    }
  };

  // Enhanced rejoin function for background sessions
  const handleEnhancedRejoin = async (classItem) => {
    try {
      const activeSession = getActiveSession(classItem);

      if (activeSession) {
        await onRejoinSession(classItem);
      } else {
        if (isClassLive(classItem)) {
          await onStartVideoSession(classItem);
        } else {
          toast.error('No active session found to rejoin');
        }
      }
    } catch (error) {
      console.error('Rejoin failed:', error);
      toast.error('Failed to rejoin session');
    }
  };

  // Check for background sessions on component mount
  useEffect(() => {
    const detectBackgroundSessions = () => {
      const backgroundSessions = classes.filter(cls =>
      hasActiveSession(cls) || isClassLive(cls)
      );
      setLiveSessions(backgroundSessions);

      if (backgroundSessions.length > 0) {
        console.log('🔄 Detected background sessions:', backgroundSessions.length);
      }
    };

    detectBackgroundSessions();

    const interval = setInterval(detectBackgroundSessions, 30000);

    return () => clearInterval(interval);
  }, [classes]);

  // Beautiful Video Loading Animation Component
  const VideoLoadingOverlay = ({ classItem, type = "starting" }) => (
    <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
    >
    <div className="text-center max-w-2xl mx-4">
    {/* Animated Logo/Icon */}
    <motion.div
    animate={{
      scale: [1, 1.1, 1],
      rotate: [0, 5, -5, 0],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }}
    className="w-32 h-32 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl"
    >
    <Video className="text-white" size={48} />
    </motion.div>

    {/* Pulsing Rings */}
    <div className="relative mb-8">
    <motion.div
    animate={{
      scale: [1, 1.5, 2],
      opacity: [0.7, 0.4, 0],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: "easeOut"
    }}
    className="absolute inset-0 border-4 border-cyan-400 rounded-full"
    />
    <motion.div
    animate={{
      scale: [1, 1.8, 2.2],
      opacity: [0.5, 0.2, 0],
    }}
    transition={{
      duration: 2.5,
      repeat: Infinity,
      ease: "easeOut",
      delay: 0.5
    }}
    className="absolute inset-0 border-4 border-blue-400 rounded-full"
    />
    </div>

    {/* Loading Text */}
    <motion.h3
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.2 }}
    className="text-3xl font-bold text-white mb-4"
    >
    {type === "starting" ? "🚀 Launching Madina Session" : "🔄 Rejoining Neural Network"}
    </motion.h3>

    <motion.p
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.4 }}
    className="text-cyan-300 text-lg mb-6"
    >
    {classItem?.title || "Madina Learning Session"}
    </motion.p>

    {/* Animated Progress */}
    <div className="bg-gray-800/50 rounded-full h-3 mx-auto max-w-md mb-6 overflow-hidden">
    <motion.div
    initial={{ width: "0%" }}
    animate={{ width: "100%" }}
    transition={{
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }}
    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
    />
    </div>

    {/* Loading Steps */}
    <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.6 }}
    className="grid grid-cols-3 gap-4 text-sm text-cyan-400"
    >
    {[
      "Initializing Neural Link...",
      "Connecting to Students...",
      "Activating AI Channels..."
    ].map((step, index) => (
      <motion.div
      key={step}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 + index * 0.3 }}
      className="flex items-center justify-center space-x-2"
      >
      <motion.div
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        delay: index * 0.5
      }}
      className="w-2 h-2 bg-cyan-400 rounded-full"
      />
      <span>{step}</span>
      </motion.div>
    ))}
    </motion.div>

    {/* Cancel Button */}
    <motion.button
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 1 }}
    onClick={() => {
      setShowVideoLoader(false);
      setJoiningSession(null);
    }}
    className="mt-8 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl transition-colors duration-200"
    >
    Cancel Connection
    </motion.button>
    </div>
    </motion.div>
  );

  // Mini loading indicator for buttons
  const LoadingButtonContent = ({ text, loadingText }) => (
    <motion.div
    initial={{ opacity: 0.6 }}
    animate={{ opacity: 1 }}
    className="flex items-center justify-center"
    >
    <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    className="mr-3"
    >
    <Loader2 size={20} />
    </motion.div>
    <span>{loadingText}</span>
    </motion.div>
  );

  // Render function to avoid complex inline JSX
  const renderLiveSessionCard = (classItem) => {
    const activeSession = getActiveSession(classItem);
    const studentCount = classItem.students_classes?.length || 0;
    const isStarting = startingSession === classItem.id;
    const isEnding = endingSession === classItem.id;
    const isJoining = joiningSession === classItem.id;
    const sessionDuration = activeSession ?
    Math.floor((new Date() - new Date(activeSession.start_time || classItem.scheduled_date)) / 60000) : 0;

    return (
      <MadinaCard key={classItem.id} gradient="from-red-900/50 to-pink-900/50" className="border-l-4 border-red-500 relative">
      {/* Loading Overlay for this specific card */}
      {isJoining && (
        <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center z-10 backdrop-blur-sm"
        >
        <div className="text-center">
        <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"
        />
        <p className="text-cyan-300 font-semibold">Connecting to Session...</p>
        </div>
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
      <div className="flex-1">
      <div className="flex items-start justify-between mb-4">
      <div>
      <h4 className="font-bold text-2xl text-white mb-2 flex items-center">
      {classItem.title}
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-3"></div>
      </h4>
      <div className="flex items-center space-x-4 mt-3">
      <MadinaBadge variant="live">
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
      🔴 LIVE NOW
      </MadinaBadge>
      {sessionDuration > 0 && (
        <span className="text-cyan-300 text-sm flex items-center">
        <Clock size={16} className="mr-1" />
        {sessionDuration}min elapsed
        </span>
      )}
      {activeSession && (
        <span className="text-green-300 text-sm flex items-center">
        <CheckCircle size={16} className="mr-1" />
        Session Active
        </span>
      )}
      </div>
      </div>
      <MadinaBadge variant="live">
      🔴 LIVE
      </MadinaBadge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      <div className="flex items-center text-cyan-200">
      <Calendar size={18} className="mr-3 text-cyan-400" />
      <div>
      <p className="text-sm font-medium">{formatDateTime(classItem.scheduled_date)}</p>
      <p className="text-xs text-cyan-300">Started</p>
      </div>
      </div>

      {classItem.duration && (
        <div className="flex items-center text-cyan-200">
        <Clock size={18} className="mr-3 text-cyan-400" />
        <div>
        <p className="text-sm font-medium">{classItem.duration} minutes</p>
        <p className="text-xs text-cyan-300">Scheduled Duration</p>
        </div>
        </div>
      )}

      <div className="flex items-center text-cyan-200">
      <Users size={18} className="mr-3 text-cyan-400" />
      <div>
      <p className="text-sm font-medium">{studentCount} learners</p>
      <p className="text-xs text-cyan-300">Connected</p>
      </div>
      </div>
      </div>

      {classItem.description && (
        <p className="text-cyan-300 text-lg mb-4">{classItem.description}</p>
      )}

      {activeSession && (
        <div className="bg-red-800/20 p-4 rounded-xl border border-red-500/30 mb-4">
        <div className="flex items-center justify-between">
        <div>
        <p className="text-red-300 text-sm font-medium">Active Video Session</p>
        <p className="text-red-400 text-xs">
        Started: {activeSession.start_time ? formatDateTime(activeSession.start_time) : 'Recently'}
        </p>
        </div>
        <div className="text-red-300 text-sm">
        Meeting ID: {activeSession.meeting_id?.substring(0, 8)}...
        </div>
        </div>
        </div>
      )}

      {classItem.course?.name && (
        <div className="inline-flex items-center bg-cyan-800/30 border border-cyan-700/30 px-4 py-2 rounded-full">
        <BookOpen size={16} className="mr-2 text-cyan-400" />
        <span className="text-cyan-300 text-sm">{classItem.course.name}</span>
        </div>
      )}
      </div>

      <div className="flex flex-col space-y-3 w-full lg:w-auto">
      <MadinaButton
      onClick={() => handleRejoinSessionWithAnimation(classItem)}
      disabled={isJoining || isStarting}
      variant="warning"
      className="min-w-[200px] relative overflow-hidden"
      >
      {isJoining ? (
        <LoadingButtonContent
        text="Rejoin Live Session"
        loadingText="Rejoining Session..."
        />
      ) : (
        <>
        <RefreshCw size={20} className="mr-3" />
        Rejoin Live Session
        </>
      )}
      </MadinaButton>

      {activeSession && (
        <>
        <MadinaButton
        onClick={() => copyClassLink(activeSession.meeting_id)}
        variant="ghost"
        >
        <Share2 size={20} className="mr-3" />
        Copy Invite Link
        </MadinaButton>

        <MadinaButton
        onClick={() => onEndVideoSession(classItem, activeSession)}
        disabled={isEnding}
        variant="danger"
        >
        {isEnding ? (
          <LoadingButtonContent
          text="End Session"
          loadingText="Ending Session..."
          />
        ) : (
          <>
          <X size={20} className="mr-3" />
          End Session
          </>
        )}
        </MadinaButton>
        </>
      )}

      {!activeSession && isClassLive(classItem) && (
        <MadinaButton
        onClick={() => handleStartSessionWithAnimation(classItem)}
        disabled={isJoining || isStarting}
        variant="success"
        >
        {isJoining ? (
          <LoadingButtonContent
          text="Start Session"
          loadingText="Starting Session..."
          />
        ) : (
          <>
          <Rocket size={20} className="mr-3" />
          Start Session
          </>
        )}
        </MadinaButton>
      )}

      <MadinaButton
      onClick={() => handleDeleteClass(classItem)}
      disabled={localDeletingClass === classItem.id}
      variant="danger"
      className="text-sm"
      >
      {localDeletingClass === classItem.id ? (
        <LoadingButtonContent
        text="Delete Session"
        loadingText="Deleting..."
        />
      ) : (
        <>
        <Trash2 size={16} className="mr-2" />
        Delete Session
        </>
      )}
      </MadinaButton>
      </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-6 pt-4 border-t border-white/10">
      <div className="flex items-center space-x-4 text-sm mb-3 md:mb-0">
      <MadinaBadge variant="live">
      LIVE SESSION
      </MadinaBadge>

      <span className="flex items-center text-green-400 text-sm">
      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
      Madina channel active
      </span>

      {activeSession && (
        <span className="text-cyan-400 text-sm">
        Last active: {formatDateTime(activeSession.updated_at || activeSession.start_time)}
        </span>
      )}
      </div>

      <div className="flex items-center space-x-2 text-cyan-300 text-sm">
      <User size={14} />
      <span>{studentCount} neural learner{studentCount !== 1 ? 's' : ''} connected</span>
      </div>
      </div>
      </MadinaCard>
    );
  };

  const renderUpcomingSessionCard = (classItem) => {
    const studentCount = classItem.students_classes?.length || 0;
    const canStart = canStartVideo(classItem);
    const isStarting = startingSession === classItem.id;
    const isDeleting = localDeletingClass === classItem.id;
    const isJoining = joiningSession === classItem.id;

    return (
      <MadinaCard key={classItem.id} gradient="from-blue-900/50 to-purple-900/50">
      {/* Loading Overlay for this specific card */}
      {isJoining && (
        <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center z-10 backdrop-blur-sm"
        >
        <div className="text-center">
        <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-3"
        />
        <p className="text-cyan-300 text-sm">Launching Session...</p>
        </div>
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
      <div className="flex-1">
      <div className="flex items-start justify-between mb-4">
      <div>
      <h4 className="font-bold text-2xl text-white mb-2">{classItem.title}</h4>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      <div className="flex items-center text-cyan-200">
      <Calendar size={18} className="mr-3 text-cyan-400" />
      <div>
      <p className="text-sm font-medium">{formatDateTime(classItem.scheduled_date)}</p>
      <p className="text-xs text-cyan-300">Temporal Coordinates</p>
      </div>
      </div>

      {classItem.duration && (
        <div className="flex items-center text-cyan-200">
        <Clock size={18} className="mr-3 text-cyan-400" />
        <div>
        <p className="text-sm font-medium">{classItem.duration} minutes</p>
        <p className="text-xs text-cyan-300">Madina Duration</p>
        </div>
        </div>
      )}

      <div className="flex items-center text-cyan-200">
      <Users size={18} className="mr-3 text-cyan-400" />
      <div>
      <p className="text-sm font-medium">{studentCount} learners</p>
      <p className="text-xs text-cyan-300">Connected</p>
      </div>
      </div>
      </div>

      {classItem.description && (
        <p className="text-cyan-300 text-lg mb-4">{classItem.description}</p>
      )}

      {classItem.course?.name && (
        <div className="inline-flex items-center bg-cyan-800/30 border border-cyan-700/30 px-4 py-2 rounded-full">
        <BookOpen size={16} className="mr-2 text-cyan-400" />
        <span className="text-cyan-300 text-sm">{classItem.course.name}</span>
        </div>
      )}
      </div>

      <div className="flex flex-col space-y-3 w-full lg:w-auto">
      {canStart && (
        <MadinaButton
        onClick={() => handleStartSessionWithAnimation(classItem)}
        disabled={isJoining || isStarting}
        variant="success"
        >
        {isJoining ? (
          <LoadingButtonContent
          text="Launch Session"
          loadingText="Madina Initiation..."
          />
        ) : (
          <>
          <Rocket size={20} className="mr-3" />
          Launch Session
          </>
        )}
        </MadinaButton>
      )}

      <MadinaButton
      onClick={() => handleDeleteClass(classItem)}
      disabled={isDeleting}
      variant="danger"
      className="text-sm"
      >
      {isDeleting ? (
        <LoadingButtonContent
        text="Delete Session"
        loadingText="Deleting..."
        />
      ) : (
        <>
        <Trash2 size={16} className="mr-2" />
        Delete Session
        </>
      )}
      </MadinaButton>
      </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-6 pt-4 border-t border-white/10">
      <div className="flex items-center space-x-4 text-sm mb-3 md:mb-0">
      <MadinaBadge variant="warning">
      SCHEDULED
      </MadinaBadge>
      </div>

      <div className="flex items-center space-x-2 text-cyan-300 text-sm">
      <User size={14} />
      <span>{studentCount} neural learner{studentCount !== 1 ? 's' : ''} enrolled</span>
      </div>
      </div>
      </MadinaCard>
    );
  };

  return (
    <div>
    {/* Full-screen Video Loading Overlay */}
    <AnimatePresence>
    {showVideoLoader && joiningSession && (
      <VideoLoadingOverlay
      classItem={classes.find(c => c.id === joiningSession)}
      type={startingSession === joiningSession ? "starting" : "rejoining"}
      />
    )}
    </AnimatePresence>

    <QuickRejoinSection
    recentSessions={recentSessions}
    onRejoin={onRejoinSession}
    />

    {/* Live Sessions Section */}
    {activeClasses.length > 0 && (
      <div className="mb-8">
      <h4 className="text-xl font-semibold text-white mb-4 flex items-center">
      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
      🔴 Live Madina Sessions
      <MadinaBadge variant="live" className="ml-3">
      {activeClasses.length} ACTIVE
      </MadinaBadge>
      </h4>
      <div className="grid gap-6">
      {activeClasses.map(renderLiveSessionCard)}
      </div>
      </div>
    )}

    {videoCallError && (
      <MadinaCard gradient="from-red-900/30 to-pink-900/30" className="mb-6">
      <div className="flex items-center justify-between">
      <div className="flex items-center">
      <XCircle size={20} className="text-red-400 mr-3" />
      <div>
      <p className="text-red-300 font-medium">Madina Link Error</p>
      <p className="text-red-400 text-sm">{videoCallError}</p>
      </div>
      </div>
      <button onClick={() => setVideoCallError(null)} className="text-red-400 hover:text-red-300 text-sm">
      Dismiss
      </button>
      </div>
      </MadinaCard>
    )}

    <div className="flex justify-between items-center mb-6">
    <div>
    <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    Madina Sessions
    </h3>
    <p className="text-cyan-300 text-sm">Manage your neural learning sessions</p>
    </div>
    <div className="text-cyan-300 text-sm">
    {activeClasses.length > 0 && `${activeClasses.length} live • `}
    {upcomingClasses.length} upcoming • {completedClasses.length} completed
    </div>
    </div>

    {upcomingClasses.length > 0 && (
      <div className="mb-8">
      <h4 className="text-xl font-semibold text-white mb-4 flex items-center">
      <Rocket className="mr-2" size={24} />
      Scheduled Madina Sessions
      </h4>
      <div className="grid gap-6">
      {upcomingClasses.map(renderUpcomingSessionCard)}
      </div>
      </div>
    )}

    {completedClasses.length > 0 && (
      <div>
      <h4 className="text-xl font-semibold text-white mb-4 flex items-center">
      <CheckCircle className="mr-2" size={24} />
      Madina Archive
      </h4>
      <div className="grid gap-4">
      {completedClasses.map((classItem) => (
        <MadinaCard key={classItem.id} gradient="from-gray-800/30 to-gray-900/30">
        <h4 className="font-bold text-white text-lg">{classItem.title}</h4>
        <p className="text-cyan-300 text-sm">{formatDateTime(classItem.scheduled_date)}</p>
        <p className="text-cyan-200 text-sm"> Learners: {classItem.students_classes?.length || 0}</p>
        <div className="mt-3">
        <MadinaBadge variant="info">Madina ARCHIVE</MadinaBadge>
        </div>
        </MadinaCard>
      ))}
      </div>
      </div>
    )}

    {classes.length === 0 && (
      <MadinaCard className="text-center py-16">
      <Video size={80} className="mx-auto text-cyan-400 mb-4 opacity-50" />
      <h3 className="text-2xl font-bold text-white mb-2">No Madina Sessions</h3>
      <p className="text-cyan-300 text-lg">Your neural learning sessions will appear here</p>
      </MadinaCard>
    )}
    </div>
  );
};

// Students Tab Component
const StudentsTab = ({ students }) => {
  return (
    <div className="space-y-6">
    <div className="flex justify-between items-center">
    <div>
    <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    Learners
    </h3>
    <p className="text-cyan-300 text-sm">Manage your Madina learners</p>
    </div>
    <div className="text-cyan-300 text-sm">
    {students.length} learners
    </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {students.map((student) => (
      <MadinaCard key={student.id} gradient="from-blue-900/30 to-purple-900/30">
      <div className="flex items-center justify-between mb-4">
      <div className="flex items-center">
      <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mr-3 shadow-lg">
      <User size={20} className="text-white" />
      </div>
      <div>
      <h4 className="font-bold text-white text-lg">{student.name}</h4>
      <p className="text-cyan-300 text-sm">{student.email}</p>
      </div>
      </div>
      <div className="flex space-x-2">
      <button
      onClick={() => toast.success(`📧 Neural message sent to ${student.name}`)}
      className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors"
      title="Send Neural Message"
      >
      <MessageCircle size={16} />
      </button>
      <button
      className="p-2 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors"
      title="View Madina Progress"
      >
      <BarChart3 size={16} />
      </button>
      </div>
      </div>

      <div className="space-y-3 text-sm mb-4">
      <div className="flex justify-between items-center">
      <span className="text-cyan-300">Madina Sessions:</span>
      <span className="text-white font-semibold">{student.classes_count || 0}</span>
      </div>
      <div className="flex justify-between items-center">
      <span className="text-cyan-300">Missions Completed:</span>
      <span className="text-white font-semibold">{student.assignments_count || 0}</span>
      </div>
      <div className="flex justify-between items-center">
      <span className="text-cyan-300">Neural Score:</span>
      <span className="text-white font-semibold">{student.average_grade || 'N/A'}</span>
      </div>
      </div>

      <div className="flex space-x-2 pt-4 border-t border-cyan-700/30">
      <MadinaButton variant="ghost" className="flex-1 text-sm py-2">
      <Eye size={16} className="mr-2" />
      Profile
      </MadinaButton>
      <MadinaButton variant="primary" className="flex-1 text-sm py-2">
      <TrendingUp size={16} className="mr-2" />
      Progress
      </MadinaButton>
      </div>
      </MadinaCard>
    ))}
    </div>

    {students.length === 0 && (
      <MadinaCard className="text-center py-16">
      <Users size={80} className="mx-auto text-cyan-400 mb-4 opacity-50" />
      <h3 className="text-2xl font-bold text-white mb-2">No Learners</h3>
      <p className="text-cyan-300 text-lg">Madina learners will appear here when they join your sessions</p>
      </MadinaCard>
    )}
    </div>
  );
};

// Assignments Tab Component
const AssignmentsTab = ({
  assignments,
  formatDateTime,
    onShowCreateAssignment,
    onDeleteAssignment,
    onReloadData,
    filters,
    onFilterChange
}) => {
  return (
    <div className="space-y-6">
    <div className="flex justify-between items-center">
    <div>
    <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    AI Missions
    </h3>
    <p className="text-cyan-300 text-sm">Create and manage Madina learning missions</p>
    </div>
    <MadinaButton
    onClick={onShowCreateAssignment}
    variant="success"
    >
    <Plus size={20} className="mr-2" />
    Create Mission
    </MadinaButton>
    </div>

    <div className="relative">
    <Search size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-cyan-400" />
    <input
    type="text"
    placeholder="Search Madina missions..."
    className="w-full pl-12 pr-4 py-4 rounded-xl bg-cyan-800/30 border border-cyan-700/30 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
    onChange={(e) => onFilterChange('search', e.target.value)}
    />
    </div>

    <div className="grid gap-6">
    {assignments.map((assignment) => (
      <MadinaCard key={assignment.id} gradient="from-green-900/30 to-emerald-900/30">
      <div className="flex justify-between items-start mb-4">
      <div className="flex-1">
      <h4 className="font-bold text-white text-2xl mb-3">{assignment.title}</h4>
      {assignment.description && (
        <p className="text-cyan-300 text-lg mb-4 leading-relaxed">{assignment.description}</p>
      )}
      </div>
      <div className="flex space-x-2 ml-4">
      <button
      onClick={async () => {
        if (window.confirm('Delete this Madina mission?')) {
          try {
            await onDeleteAssignment(assignment.id);
            toast.success('✅ Mission deleted');
            onReloadData();
          } catch (error) {
            toast.error('❌ Deletion failed');
          }
        }
      }}
      className="p-3 bg-red-600 hover:bg-red-500 rounded-xl text-white transition-colors"
      title="Delete Mission"
      >
      <Trash2 size={18} />
      </button>
      <button
      className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white transition-colors"
      title="View Submissions"
      >
      <Eye size={18} />
      </button>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div className="flex items-center text-cyan-200">
      <Calendar size={18} className="mr-3 text-cyan-400" />
      <div>
      <p className="text-sm font-medium">Due: {formatDateTime(assignment.due_date)}</p>
      <p className="text-xs text-cyan-300">Temporal Deadline</p>
      </div>
      </div>

      <div className="flex items-center text-cyan-200">
      <Award size={18} className="mr-3 text-cyan-400" />
      <div>
      <p className="text-sm font-medium">{assignment.max_score} Madina Points</p>
      <p className="text-xs text-cyan-300">Mission Value</p>
      </div>
      </div>

      <div className="flex items-center text-cyan-200">
      <Users size={18} className="mr-3 text-cyan-400" />
      <div>
      <p className="text-sm font-medium">{assignment.submissions_count || 0} submissions</p>
      <p className="text-xs text-cyan-300">Neural Responses</p>
      </div>
      </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-cyan-700/30">
      <MadinaBadge variant={assignment.status === 'active' ? 'success' : 'info'}>
      {assignment.status?.toUpperCase() || 'ACTIVE'}
      </MadinaBadge>

      <div className="flex space-x-3">
      <MadinaButton variant="ghost" className="text-sm py-2 px-4">
      <Eye size={16} className="mr-2" />
      Details
      </MadinaButton>
      <MadinaButton variant="primary" className="text-sm py-2 px-4">
      <FileCheck size={16} className="mr-2" />
      Review
      </MadinaButton>
      </div>
      </div>
      </MadinaCard>
    ))}
    </div>

    {assignments.length === 0 && (
      <MadinaCard className="text-center py-16">
      <FileText size={80} className="mx-auto text-cyan-400 mb-4 opacity-50" />
      <h3 className="text-2xl font-bold text-white mb-2">No Madina Missions</h3>
      <p className="text-cyan-300 text-lg">Create your first Assignment to challenge your learners</p>
      <MadinaButton
      onClick={onShowCreateAssignment}
      variant="success"
      className="mt-6"
      >
      <Rocket size={20} className="mr-2" />
      Launch First Mission
      </MadinaButton>
      </MadinaCard>
    )}
    </div>
  );
};

// Grading Tab Component
const GradingTab = ({
  submissions,
  pendingSubmissions,
  formatDateTime,
    onStartGrading,
    filters,
    onFilterChange
}) => {
  const displaySubmissions = filters.status === 'pending' ? pendingSubmissions : submissions;

  return (
    <div className="space-y-6">
    <div className="flex justify-between items-center">
    <div>
    <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    Madina Review
    </h3>
    <p className="text-cyan-300 text-sm">Assess and enhance neural learning</p>
    </div>
    <div className="text-cyan-300 text-sm">
    {pendingSubmissions.length} pending • {submissions.length} total
    </div>
    </div>

    <div className="flex space-x-4 mb-6">
    <MadinaButton
    onClick={() => onFilterChange('status', 'pending')}
    variant={filters.status === 'pending' ? 'warning' : 'ghost'}
    className="flex-1"
    >
    <Clock size={18} className="mr-2" />
    Pending Review ({pendingSubmissions.length})
    </MadinaButton>
    <MadinaButton
    onClick={() => onFilterChange('status', '')}
    variant={!filters.status ? 'primary' : 'ghost'}
    className="flex-1"
    >
    <FileCheck size={18} className="mr-2" />
    All Submissions ({submissions.length})
    </MadinaButton>
    </div>

    <div className="grid gap-6">
    {displaySubmissions.map((submission) => (
      <MadinaCard key={submission.id} gradient="from-orange-900/30 to-yellow-900/30">
      <div className="flex justify-between items-start mb-4">
      <div className="flex-1">
      <h4 className="font-bold text-white text-xl mb-2">
      {submission.assignment?.title || 'Madina Mission'}
      </h4>
      <p className="text-cyan-300 text-lg mb-1">
      Neural Learner: {submission.student?.name || 'Unknown'}
      </p>
      {submission.submitted_at && (
        <p className="text-cyan-400 text-sm">
        Submitted: {formatDateTime(submission.submitted_at)}
        </p>
      )}
      </div>

      <div className="flex items-center space-x-3">
      {submission.grade ? (
        <div className="flex items-center space-x-3">
        <MadinaBadge variant="success">
        {submission.grade}/{submission.assignment?.max_score || 100}
        </MadinaBadge>
        <CheckCircle size={24} className="text-green-400" />
        </div>
      ) : (
        <MadinaBadge variant="warning">
        AWAITING ASSESSMENT
        </MadinaBadge>
      )}
      </div>
      </div>

      {submission.submission_text && (
        <div className="mb-4">
        <p className="text-cyan-200 text-sm font-medium mb-3">Neural Response:</p>
        <div className="bg-cyan-800/30 p-4 rounded-xl border border-cyan-700/30 max-h-32 overflow-y-auto">
        <p className="text-white text-sm leading-relaxed">{submission.submission_text}</p>
        </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-cyan-700/30">
      <div className="flex space-x-3">
      <MadinaButton
      onClick={() => onStartGrading(submission)}
      variant="primary"
      className="text-sm py-2 px-4"
      >
      {submission.grade ? (
        <>
        <Edit size={16} className="mr-2" />
        Re-assess
        </>
      ) : (
        <>
        <FileCheck size={16} className="mr-2" />
        Madina Assess
        </>
      )}
      </MadinaButton>

      <MadinaButton variant="ghost" className="text-sm py-2 px-4">
      <Eye size={16} className="mr-2" />
      Details
      </MadinaButton>
      </div>

      {submission.graded_at && (
        <span className="text-cyan-400 text-sm">
        Assessed: {formatDateTime(submission.graded_at)}
        </span>
      )}
      </div>
      </MadinaCard>
    ))}
    </div>

    {displaySubmissions.length === 0 && (
      <MadinaCard className="text-center py-16">
      <FileCheck size={80} className="mx-auto text-cyan-400 mb-4 opacity-50" />
      <h3 className="text-2xl font-bold text-white mb-2">
      {filters.status === 'pending' ? 'All Caught Up! 🎉' : 'No Submissions Yet'}
      </h3>
      <p className="text-cyan-300 text-lg">
      {filters.status === 'pending'
        ? 'All Madina assessments are complete! Your learners are progressing excellently.'
        : 'Mission submissions will appear here as your learners complete their Madina challenges.'
      }
      </p>
      </MadinaCard>
    )}
    </div>
  );
};

// Assignment Creation Modal Component
const AssignmentCreationModal = ({
  isOpen,
  onClose,
  newAssignment,
  onAssignmentChange,
  onCreateAssignment
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
    <MadinaCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div className="flex justify-between items-center mb-6">
    <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    🚀 Create Madina Assignment
    </h3>
    <button
    onClick={onClose}
    className="p-2 text-cyan-300 hover:text-white transition-colors"
    >
    <X size={24} />
    </button>
    </div>

    <div className="space-y-6">
    <div>
    <label className="block text-sm font-medium text-cyan-200 mb-2">Mission Title *</label>
    <input
    type="text"
    value={newAssignment.title}
    onChange={(e) => onAssignmentChange('title', e.target.value)}
    className="w-full p-3 rounded-xl bg-cyan-800/30 border border-cyan-700/30 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
    placeholder="Enter Madina mission title"
    required
    />
    </div>

    <div>
    <label className="block text-sm font-medium text-cyan-200 mb-2">Mission Briefing</label>
    <textarea
    value={newAssignment.description}
    onChange={(e) => onAssignmentChange('description', e.target.value)}
    className="w-full p-3 rounded-xl bg-cyan-800/30 border border-cyan-700/30 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
    rows="3"
    placeholder="Describe the mission objectives..."
    />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
    <label className="block text-sm font-medium text-cyan-200 mb-2">Due Date *</label>
    <input
    type="datetime-local"
    value={newAssignment.due_date}
    onChange={(e) => onAssignmentChange('due_date', e.target.value)}
    className="w-full p-3 rounded-xl bg-cyan-800/30 border border-cyan-700/30 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
    required
    />
    </div>

    <div>
    <label className="block text-sm font-medium text-cyan-200 mb-2">Madina Points</label>
    <input
    type="number"
    value={newAssignment.max_score}
    onChange={(e) => onAssignmentChange('max_score', parseInt(e.target.value) || 100)}
    className="w-full p-3 rounded-xl bg-cyan-800/30 border border-cyan-700/30 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
    min="1"
    max="100"
    />
    </div>
    </div>

    <div className="flex items-center">
    <input
    type="checkbox"
    checked={newAssignment.for_all_students}
    onChange={(e) => onAssignmentChange('for_all_students', e.target.checked)}
    className="mr-3 w-4 h-4 text-cyan-600 bg-cyan-800/30 border-cyan-700/30 rounded focus:ring-cyan-500"
    />
    <span className="text-cyan-200 text-sm">Assign to all learners</span>
    </div>
    </div>

    <div className="flex justify-end space-x-3 mt-8">
    <MadinaButton
    onClick={onClose}
    variant="ghost"
    >
    Cancel
    </MadinaButton>
    <MadinaButton
    onClick={onCreateAssignment}
    disabled={!newAssignment.title || !newAssignment.due_date}
    variant="primary"
    >
    <Rocket className="mr-2" size={18} />
    Launch Mission
    </MadinaButton>
    </div>
    </MadinaCard>
    </div>
  );
};

// Grading Modal Component
const GradingModal = ({
  gradingSubmission,
  onClose,
  gradeData,
  onGradeDataChange,
  onGradeAssignment,
  isGrading,
  audioRecorder
}) => {
  if (!gradingSubmission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
    <MadinaCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div className="flex justify-between items-center mb-6">
    <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
    🧠 Madina Assessment
    </h3>
    <button
    onClick={onClose}
    className="p-2 text-cyan-300 hover:text-white transition-colors"
    >
    <X size={24} />
    </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-cyan-800/30 rounded-xl border border-cyan-700/30">
    <div>
    <p className="text-cyan-200 text-sm font-medium">Neural Learner</p>
    <p className="text-white font-semibold text-lg">{gradingSubmission.student?.name || 'Unknown Learner'}</p>
    <p className="text-cyan-300 text-xs">{gradingSubmission.student?.email}</p>
    </div>
    <div>
    <p className="text-cyan-200 text-sm font-medium">Madina Mission</p>
    <p className="text-white font-semibold text-lg">{gradingSubmission.assignment?.title}</p>
    <p className="text-cyan-300 text-xs">
    Max Madina Points: {gradingSubmission.assignment?.max_score}
    </p>
    </div>
    </div>

    {gradingSubmission.submission_text && (
      <div className="mb-6">
      <p className="text-cyan-200 text-sm font-medium mb-3 flex items-center">
      <FileText size={16} className="mr-2" />
      Neural Submission:
      </p>
      <div className="bg-cyan-800/30 p-4 rounded-xl border border-cyan-700/30 max-h-48 overflow-y-auto">
      <p className="text-white text-sm leading-relaxed">{gradingSubmission.submission_text}</p>
      </div>
      </div>
    )}

    <div className="space-y-6">
    <div>
    <label className="block text-sm font-medium text-cyan-200 mb-3">
    Madina Score * (Max: {gradingSubmission.assignment?.max_score || 100})
    </label>
    <input
    type="number"
    value={gradeData.score}
    onChange={(e) => onGradeDataChange('score', e.target.value)}
    className="w-full p-4 rounded-xl bg-cyan-800/30 border border-cyan-700/30 text-white text-lg font-semibold focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
    min="0"
    max={gradingSubmission.assignment?.max_score || 100}
    placeholder="Enter Madina score"
    required
    />
    </div>

    <div>
    <label className="block text-sm font-medium text-cyan-200 mb-3 flex items-center">
    <MessageCircle size={16} className="mr-2" />
    Neural Feedback
    </label>
    <textarea
    value={gradeData.feedback}
    onChange={(e) => onGradeDataChange('feedback', e.target.value)}
    className="w-full p-4 rounded-xl bg-cyan-800/30 border border-cyan-700/30 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
    rows="5"
    placeholder="Provide constructive neural feedback to enhance learning..."
    />
    </div>

    <div className="border-t border-cyan-700/30 pt-6">
    <label className="block text-sm font-medium text-cyan-200 mb-4 flex items-center">
    <Mic size={16} className="mr-2" />
    Madina Audio Feedback (Optional)
    </label>

    <MadinaCard gradient="from-purple-900/30 to-pink-900/30" className="p-4">
    {!gradeData.audioFeedbackData && !audioRecorder.audioData ? (
      <div className="space-y-4">
      <div className="flex items-center space-x-4">
      <MadinaButton
      onClick={audioRecorder.isRecording ? audioRecorder.stopRecording : audioRecorder.startRecording}
      variant={audioRecorder.isRecording ? "danger" : "success"}
      className="p-4 rounded-full"
      >
      {audioRecorder.isRecording ? (
        <div className="animate-pulse">
        <Square size={24} />
        </div>
      ) : (
        <Mic size={24} />
      )}
      </MadinaButton>

      <div className="flex-1">
      <div className="text-cyan-300 font-medium">
      {audioRecorder.isRecording ? `Recording Neural Feedback... ${audioRecorder.recordingTime}` : 'Initiate Neural Recording'}
      </div>
      <div className="text-cyan-400 text-sm">
      {audioRecorder.isRecording ? 'Click to complete recording' : 'Record personalized audio feedback'}
      </div>
      </div>
      </div>

      {audioRecorder.isRecording && (
        <div className="flex items-center space-x-2 text-cyan-400 text-sm">
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
        <span>Neural processing active...</span>
        </div>
      )}
      </div>
    ) : (
      <div className="space-y-4">
      <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
      <CheckCircle size={20} className="text-green-400" />
      <span className="text-green-400 font-medium">✅ Madina Audio Recorded</span>
      </div>
      <button
      onClick={() => {
        audioRecorder.clearRecording();
        onGradeDataChange('audioFeedbackData', '');
      }}
      className="text-red-400 hover:text-red-300 text-sm font-medium"
      >
      Re-record Neural Feedback
      </button>
      </div>

      <div className="bg-cyan-900/20 p-3 rounded-lg border border-cyan-700/30">
      <div className="flex items-center space-x-3">
      <button
      onClick={audioRecorder.isRecording ? audioRecorder.stopRecording : audioRecorder.startRecording}
      className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors"
      >
      {audioRecorder.isRecording ? <Square size={16} /> : <Play size={16} />}
      </button>
      <span className="text-cyan-300 text-sm">
      {audioRecorder.isRecording ? 'Recording...' : 'Preview neural recording'}
      </span>
      </div>
      </div>
      </div>
    )}
    </MadinaCard>
    </div>
    </div>

    <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-cyan-700/30">
    <MadinaButton
    onClick={onClose}
    variant="ghost"
    >
    Cancel Assessment
    </MadinaButton>
    <MadinaButton
    onClick={() => onGradeAssignment(
      gradingSubmission.id,
      parseInt(gradeData.score),
                                     gradeData.feedback,
                                     gradeData.audioFeedbackData || audioRecorder.audioData
    )}
    disabled={!gradeData.score || isNaN(parseInt(gradeData.score)) || isGrading}
    variant="primary"
    className="min-w-[200px]"
    >
    {isGrading ? (
      <>
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
      Madina Processing...
      </>
    ) : (
      <>
      <Zap size={20} className="mr-3" />
      Submit Madina Assessment
      </>
    )}
    </MadinaButton>
    </div>
    </MadinaCard>
    </div>
  );
};

// Main Dashboard Component
export default function TeacherDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // State Management
  const [activeTab, setActiveTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [loading, setLoading] = useState({
    classes: true,
    students: true,
    assignments: true
  });
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    totalClasses: 0,
    upcomingClasses: 0,
    completedClasses: 0,
    totalStudents: 0,
    totalAssignments: 0,
    pendingSubmissions: 0
  });

  // Video Call State
  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [videoCallError, setVideoCallError] = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [endingSession, setEndingSession] = useState(null);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);

  // Assignment Creation State
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    due_date: '',
    max_score: 100,
    class_id: '',
    for_all_students: true,
      selected_students: []
  });

  // Grading System State
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeData, setGradeData] = useState({
    score: '',
    feedback: '',
    audioFeedbackData: ''
  });
  const [isGrading, setIsGrading] = useState(false);

  // Audio Recorder
  const audioRecorder = useAudioRecorder();

  // Authentication Guard
  useEffect(() => {
    if (!user) {
      navigate('/teacher-login');
    }
  }, [user, navigate]);

  // Session Recovery System
  useEffect(() => {
    if (user) {
      const savedSessions = localStorage.getItem('teacherRecentSessions');
      if (savedSessions) {
        try {
          const sessions = JSON.parse(savedSessions);
          setRecentSessions(sessions);

          const sessionBackup = localStorage.getItem('teacherSessionBackup');
          if (sessionBackup) {
            const backup = JSON.parse(sessionBackup);
            const logoutTime = new Date(backup.logoutTime);
            const now = new Date();
            const timeDiff = (now - logoutTime) / (1000 * 60);

            if (timeDiff < 10 && backup.activeVideoCall) {
              console.log('🔄 Madina session recovery initiated...');
              setActiveVideoCall(backup.activeVideoCall);
              setShowVideoCallModal(true);
              toast.info('🧠 Neural session recovery complete!');
            }

            localStorage.removeItem('teacherSessionBackup');
          }
        } catch (error) {
          console.error('❌ Madina recovery failed:', error);
        }
      }
    }
  }, [user]);

  // Data Loading System
  const loadTeacherData = async () => {
    try {
      setLoading({ classes: true, students: true, assignments: true });

      const [classesData, studentsData, assignmentsData] = await Promise.all([
        teacherApi.getMyClasses(),
                                                                             teacherApi.getMyStudents(),
                                                                             teacherApi.getMyAssignments()
      ]);

      setClasses(classesData);
      setStudents(studentsData);
      setAssignments(assignmentsData);

      await loadSubmissions();

      const now = new Date();
      const upcoming = classesData.filter(cls =>
      new Date(cls.scheduled_date) > now && cls.status === 'scheduled'
      );
      const completed = classesData.filter(cls =>
      cls.status === 'completed' || (new Date(cls.scheduled_date) < now && cls.status !== 'cancelled')
      );

      setStats({
        totalClasses: classesData.length,
        upcomingClasses: upcoming.length,
        completedClasses: completed.length,
        totalStudents: studentsData.length,
        totalAssignments: assignmentsData.length,
        pendingSubmissions: pendingSubmissions.length
      });

    } catch (error) {
      toast.error('❌ Madina data stream interrupted');
    } finally {
      setLoading({ classes: false, students: false, assignments: false });
    }
  };

  const loadSubmissions = async () => {
    try {
      const submissionsData = await teacherApi.getSubmissions();
      setSubmissions(submissionsData);

      const pending = submissionsData.filter(sub =>
      !sub.grade && sub.status === 'submitted'
      );
      setPendingSubmissions(pending);
    } catch (error) {
      console.error('❌ Submission processing failed:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user]);

  // Filtering System
  const filteredClasses = useMemo(() => {
    if (!classes || classes.length === 0) return [];

    let result = [...classes];

    if (filters.status) {
      result = result.filter(cls => cls.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(cls =>
      cls.title?.toLowerCase().includes(searchLower) ||
      (cls.course?.name?.toLowerCase().includes(searchLower)) ||
      cls.status?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [classes, filters]);

  // Video Call System
  const handleStartVideoSession = async (classItem) => {
    try {
      setStartingSession(classItem.id);
      console.log('🚀 Starting video session for class:', classItem.id);

      const result = await videoApi.startVideoSession(classItem.id, user.id);
      console.log('🔍 Raw API response:', result);

      if (result.success) {
        // 🚨 CRITICAL FIX: Map API response fields correctly
        const videoCallData = {
          // Map the API response fields to what TeacherVideoCall expects
          meetingId: result.meetingId || result.meeting_id,
          channel: result.channel || result.meetingId, // Use meetingId as fallback for channel
          token: result.token,
          appId: result.appId || result.app_id || import.meta.env.VITE_AGORA_APP_ID,
          uid: result.uid || user.id,
          classId: classItem.id,
          className: classItem.title,
          isTeacher: true,
          startTime: new Date().toISOString()
        };

        console.log('🎯 Processed video call data:', videoCallData);

        // Validate we have the minimum required fields
        if (!videoCallData.channel || !videoCallData.appId) {
          console.error('❌ Missing required fields:', {
            channel: videoCallData.channel,
            appId: videoCallData.appId
          });
          throw new Error('Invalid video session configuration received from server');
        }

        setActiveVideoCall(videoCallData);
        setShowVideoCallModal(true);
        toast.success('🎥 Video session started!');

        // Add to recent sessions
        setRecentSessions(prev => {
          const filtered = prev.filter(s => s.classId !== classItem.id);
          const newSession = {
            classId: classItem.id,
            className: classItem.title,
            meetingId: videoCallData.meetingId,
            channel: videoCallData.channel,
            startTime: new Date().toISOString()
          };
          return [newSession, ...filtered].slice(0, 5);
        });

      } else {
        throw new Error(result.error || 'Failed to start video session');
      }

    } catch (error) {
      console.error('❌ Failed to start video session:', error);
      setVideoCallError(error.message);
      toast.error(error.message);
    } finally {
      setStartingSession(null);
    }
  };

  const handleRejoinSession = async (classItem) => {
    try {
      console.log('🔄 Enhanced rejoin for class:', {
        className: classItem.title,
        classId: classItem.id,
        availableSessions: classItem.video_sessions?.length || 0
      });

      // Step 1: Try to find a valid session using multiple methods
      let validSession = null;

      // Method A: Check backend for active sessions for this class
      console.log('🔍 Checking backend for active sessions...');
      const sessionSearch = await videoApi.findValidSession(classItem.id, user.id);

      if (sessionSearch.success) {
        validSession = sessionSearch;
        console.log('✅ Found valid session via backend:', {
          meetingId: validSession.meetingId,
          source: validSession.source
        });
      } else {
        // Method B: Start a completely new session
        console.log('🚀 Starting completely new session...');
        const newSession = await videoApi.startVideoSession(classItem.id, user.id);

        if (newSession.success) {
          validSession = {
            success: true,
            meetingId: newSession.meetingId,
            session: newSession.session,
            source: 'brand_new_session'
          };
          console.log('✅ Created new session:', validSession.meetingId);
        } else {
          throw new Error('Failed to create new session: ' + (newSession.error || 'Unknown error'));
        }
      }

      // Step 2: Join the valid session
      console.log('🎯 Joining session with meetingId:', validSession.meetingId);
      const joinResult = await videoApi.joinVideoSession(validSession.meetingId, user.id);

      if (!joinResult.success) {
        throw new Error(joinResult.error || 'Failed to join session');
      }

      // Step 3: Setup video call data
      const videoCallData = {
        meetingId: joinResult.meetingId,
        channel: joinResult.channel,
        token: joinResult.token,
        appId: joinResult.appId,
        uid: joinResult.uid,
        classId: classItem.id,
        className: classItem.title,
        isTeacher: true,
        startTime: new Date().toISOString()
      };

      console.log('✅ Rejoin successful! Video call data:', videoCallData);

      // Step 4: Update state and show modal
      setActiveVideoCall(videoCallData);
      setShowVideoCallModal(true);

      // Update recent sessions
      setRecentSessions(prev => {
        const filtered = prev.filter(s => s.classId !== classItem.id);
        const newSession = {
          classId: classItem.id,
          className: classItem.title,
          meetingId: joinResult.meetingId,
          channel: joinResult.channel,
          startTime: new Date().toISOString(),
                        source: validSession.source
        };
        return [newSession, ...filtered].slice(0, 5);
      });

      // Show appropriate success message
      if (validSession.source === 'new_session' || validSession.source === 'brand_new_session') {
        toast.success('🚀 Started new video session!');
      } else {
        toast.success('🔄 Successfully rejoined video session!');
      }

    } catch (error) {
      console.error('❌ Enhanced rejoin failed:', {
        error: error.message,
        class: classItem.title,
        classId: classItem.id,
        stack: error.stack
      });

      // More specific error messages
      if (error.message.includes('Active session not found') ||
        error.message.includes('Session not found') ||
        error.message.includes('404')) {
        toast.error('Session expired. Please start a new session.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Network error. Please check your connection.');
        } else {
          toast.error(`Video session error: ${error.message}`);
        }
    }
  };

  const handleJoinExistingSession = async (classItem, session) => {
    try {
      const meetingId = session?.meeting_id;

      if (!meetingId) {
        throw new Error('No meeting ID found for this session');
      }

      // ✅ USE VIDEOAPI TO GET JOIN CREDENTIALS
      const result = await videoApi.joinVideoSession(meetingId, user.id);

      if (result.success) {
        setActiveVideoCall({
          meetingId: result.meetingId,
          channel: result.channel,
          token: result.token,
          appId: result.appId,
          uid: result.uid,
          classId: classItem.id,
          className: classItem.title,
          isTeacher: true,
          startTime: new Date().toISOString()
        });

        setRecentSessions(prev => {
          const filtered = prev.filter(s => s.classId !== classItem.id);
          const newSession = {
            classId: classItem.id,
            className: classItem.title,
            meetingId: result.meetingId,
            startTime: new Date().toISOString()
          };
          return [newSession, ...filtered].slice(0, 5);
        });

        localStorage.setItem('teacherRecentSessions', JSON.stringify(recentSessions));

        setShowVideoCallModal(true);
        toast.success('🔄 Joining existing session...');

      } else {
        throw new Error(result.error || 'Failed to join session');
      }

    } catch (error) {
      console.error('❌ Madina join failed:', error);
      toast.error(error.message);
    }
  };

  const handleRejoinRecentSession = async (session) => {
    try {
      setActiveVideoCall(session);
      setShowVideoCallModal(true);
      toast.success(`🚀 Rejoining ${session.className}...`);
    } catch (error) {
      console.error('❌ Madina rejoin failed:', error);
      toast.error(error.message);
    }
  };

  const handleEndVideoSession = async (classItem, session) => {
    try {
      setEndingSession(classItem.id);
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('✅ Madina session terminated');
    } catch (error) {
      toast.error('❌ Session termination failed');
    } finally {
      setEndingSession(null);
    }
  };

  const handleDeleteClass = async (classId) => {
    try {
      await teacherApi.deleteClass(classId);
      toast.success('✅ Madina session deleted');
      loadTeacherData();
    } catch (error) {
      toast.error('❌ Deletion failed');
      throw error;
    }
  };

  const handleLeaveVideoCall = async (shouldEndSession = false) => {
    try {
      if (shouldEndSession && activeVideoCall) {
        await new Promise(resolve => setTimeout(resolve, 500));
        toast.success('✅ Madina session completed');

        setRecentSessions(prev => prev.filter(s => s.meetingId !== activeVideoCall.meetingId));
        localStorage.setItem('teacherRecentSessions', JSON.stringify(recentSessions.filter(s => s.meetingId !== activeVideoCall.meetingId)));
      } else {
        toast.info('🔄 Madina session paused - Rejoin available');
      }

      setActiveVideoCall(null);
      setVideoCallError(null);
      setShowVideoCallModal(false);
      await loadTeacherData();

    } catch (error) {
      console.error('Madina exit error:', error);
      toast.error('❌ Exit sequence failed');
    }
  };

  const cleanupInvalidSessions = async () => {
    try {
      console.log('🧹 Cleaning up invalid recent sessions...');

      const validSessions = [];

      for (const session of recentSessions) {
        try {
          // Try to get session info for each recent session
          const sessionInfo = await videoApi.getSessionInfo(session.meetingId);
          if (sessionInfo.exists && sessionInfo.session?.status === 'active') {
            validSessions.push(session);
          } else {
            console.log('🗑️ Removing invalid session:', session.meetingId);
          }
        } catch (error) {
          console.log('🗑️ Removing errored session:', session.meetingId);
        }
      }

      if (validSessions.length !== recentSessions.length) {
        setRecentSessions(validSessions);
        console.log('✅ Session cleanup completed. Kept:', validSessions.length);
      }
    } catch (error) {
      console.warn('⚠️ Session cleanup failed:', error);
    }
  };

  // Call this on component mount
  useEffect(() => {
    cleanupInvalidSessions();
  }, []);
  // Assignment System
  const handleAssignmentChange = (field, value) => {
    setNewAssignment(prev => {
      if (field === 'for_all_students') {
        return {
          ...prev,
          for_all_students: value,
            selected_students: value ? [] : prev.selected_students
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const createAssignment = async () => {
    try {
      if (!newAssignment.title.trim()) {
        toast.error('🚫 Madina assignment requires title');
        return;
      }

      if (!newAssignment.due_date) {
        toast.error('🚫 Temporal coordinates required');
        return;
      }

      const assignmentData = {
        title: newAssignment.title,
        description: newAssignment.description,
        due_date: newAssignment.due_date,
        max_score: newAssignment.max_score,
        class_id: newAssignment.class_id || null,
        for_all_students: newAssignment.for_all_students,
          student_ids: newAssignment.for_all_students ? 'all' : newAssignment.selected_students
      };

      await teacherApi.createAssignment(assignmentData);

      toast.success('🚀 Madina assignment deployed!');
      setShowCreateAssignment(false);
      setNewAssignment({
        title: '',
        description: '',
        due_date: '',
        max_score: 100,
        class_id: '',
        for_all_students: true,
          selected_students: []
      });

      await loadTeacherData();

    } catch (error) {
      toast.error(`❌ Assignment deployment failed: ${error.message}`);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await teacherApi.deleteAssignment(assignmentId);
      toast.success('✅ Mission deleted');
    } catch (error) {
      toast.error('❌ Deletion failed');
      throw error;
    }
  };

  // Grading System
  const handleGradeDataChange = (field, value) => {
    setGradeData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartGrading = (submission) => {
    setGradingSubmission(submission);
    setGradeData({
      score: submission.grade || '',
      feedback: submission.feedback || '',
      audioFeedbackData: submission.audio_feedback_url || ''
    });
  };

  const gradeAssignment = async (submissionId, score, feedback, audioFeedbackData = '') => {
    setIsGrading(true);
    try {
      if (!score || isNaN(score) || score < 0) {
        toast.error('🚫 Invalid Madina score');
        setIsGrading(false);
        return;
      }

      const numericScore = parseInt(score);

      const updatedSubmissions = submissions.map(sub =>
      sub.id === submissionId
      ? {
        ...sub,
        grade: numericScore,
        feedback,
        graded_at: new Date().toISOString()
      }
      : sub
      );

      const updatedPending = pendingSubmissions.filter(sub => sub.id !== submissionId);

      setSubmissions(updatedSubmissions);
      setPendingSubmissions(updatedPending);

      setStats(prev => ({
        ...prev,
        pendingSubmissions: updatedPending.length
      }));

      await teacherApi.gradeAssignment(submissionId, numericScore, feedback, audioFeedbackData);

      toast.success('✅ Madina grading complete!');
      setGradingSubmission(null);
      setGradeData({ score: '', feedback: '', audioFeedbackData: '' });
      audioRecorder.clearRecording();

    } catch (error) {
      toast.error(`❌ Grading failed: ${error.message}`);
    } finally {
      setIsGrading(false);
    }
  };

  // Utility Functions
  const formatDateTime = (dateString) => {
    if (!dateString) return "Temporal coordinates pending";
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleLogout = async () => {
    try {
      const currentSessionData = {
        activeVideoCall,
        recentSessions,
        logoutTime: new Date().toISOString()
      };

      localStorage.setItem('teacherSessionBackup', JSON.stringify(currentSessionData));

      await signOut();
      toast.success('🚀 Madina logout complete!');
      navigate('/teacher-login');
    } catch (error) {
      toast.error('❌ Logout sequence failed');
    }
  };

  // Stats Grid
  const statsGrid = [
    { icon: BookOpen, value: stats.totalClasses, label: 'Madina Sessions', gradient: 'from-cyan-500 to-blue-500' },
    { icon: Calendar, value: stats.upcomingClasses, label: 'Scheduled', gradient: 'from-green-500 to-emerald-500' },
    { icon: BarChart3, value: stats.completedClasses, label: 'Completed', gradient: 'from-purple-500 to-pink-500' },
    { icon: Users, value: stats.totalStudents, label: 'Learners', gradient: 'from-yellow-500 to-orange-500' },
    { icon: FileText, value: stats.totalAssignments, label: 'Missions', gradient: 'from-indigo-500 to-purple-500' },
    { icon: FileCheck, value: stats.pendingSubmissions, label: 'Pending Review', gradient: 'from-orange-500 to-red-500' }
  ];

  // Navigation Tabs
  const tabs = [
    { id: 'classes', label: 'Madina Sessions', icon: Video, description: 'Manage your classes' },
    { id: 'students', label: 'Learners', icon: Users, description: 'Student management' },
    { id: 'assignments', label: 'Assignments', icon: FileText, description: 'Create assignments' },
    { id: 'grading', label: 'Madina Review', icon: FileCheck, badge: pendingSubmissions.length, description: 'Grade submissions' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
    {/* Header */}
    <header className="bg-gradient-to-r from-gray-900/50 to-purple-900/50 backdrop-blur-xl border-b border-cyan-500/20 relative z-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-16">
    <div className="flex items-center">
    <button
    className="md:hidden text-white mr-2 p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
    >
    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
    <div className="flex items-center">
    <Brain className="h-8 w-8 text-cyan-400 mr-3" />
    <div>
    <h1 className="text-xl md:text-2xl font-bold text-white">Madina Educator</h1>
    </div>
    </div>
    </div>

    <div className="flex items-center space-x-4">
    <button className="p-2 text-cyan-200 hover:text-white rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors">
    <Bell size={20} />
    </button>

    <div className="relative group">
    <div className="flex items-center cursor-pointer p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors">
    <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mr-2 shadow-lg">
    <User size={16} className="text-white" />
    </div>
    <span className="text-white hidden md:inline font-medium">{user?.name}</span>
    <ChevronDown size={16} className="ml-1 text-cyan-200" />
    </div>

    <div className="absolute right-0 mt-2 w-56 bg-gradient-to-br from-gray-800 to-gray-900 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
    <div className="px-4 py-2 border-b border-cyan-500/20">
    <p className="text-sm font-medium text-white">{user?.name}</p>
    <p className="text-xs text-cyan-400">{user?.email}</p>
    </div>

    <button
    onClick={handleLogout}
    className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
    >
    <LogOut size={16} className="mr-2" />
    Madina Logout
    </button>
    </div>
    </div>
    </div>
    </div>
    </div>
    </header>

    {/* Main Content */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {/* Stats Grid */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
    {statsGrid.map((stat, index) => (
      <MadinaCard key={index} className="p-4 hover:scale-105 transition-transform duration-300">
      <div className="flex items-center">
      <div className={`p-3 rounded-2xl bg-gradient-to-r ${stat.gradient} shadow-lg mr-3`}>
      <stat.icon className="h-6 w-6 text-white" />
      </div>
      <div>
      <p className="text-2xl font-bold text-white">{stat.value}</p>
      <p className="text-cyan-200 text-sm">{stat.label}</p>
      </div>
      </div>
      </MadinaCard>
    ))}
    </div>

    {/* Quick Rejoin Section */}
    <QuickRejoinSection
    recentSessions={recentSessions}
    onRejoin={handleRejoinRecentSession}
    />

    {/* Mobile Navigation */}
    {mobileMenuOpen && (
      <MadinaCard className="md:hidden mb-6">
      <nav className="flex flex-col space-y-2">
      {tabs.map((tab) => (
        <button
        key={tab.id}
        onClick={() => {
          setActiveTab(tab.id);
          setMobileMenuOpen(false);
        }}
        className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
          activeTab === tab.id
          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
          : 'text-cyan-200 hover:text-white hover:bg-cyan-500/10'
        }`}
        >
        <tab.icon size={18} className="mr-3" />
        <div className="text-left">
        <div>{tab.label}</div>
        <div className="text-xs text-cyan-400">{tab.description}</div>
        </div>
        {tab.badge && tab.badge > 0 && (
          <span className="ml-auto bg-orange-500 text-white text-xs rounded-full px-2 py-1">
          {tab.badge}
          </span>
        )}
        </button>
      ))}
      </nav>
      </MadinaCard>
    )}

    {/* Desktop Navigation */}
    <div className="hidden md:block mb-6">
    <MadinaCard>
    <nav className="flex space-x-4 overflow-x-auto">
    {tabs.map((tab) => (
      <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`flex items-center px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap ${
        activeTab === tab.id
        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
        : 'text-cyan-200 hover:text-white hover:bg-cyan-500/10'
      }`}
      >
      <tab.icon size={18} className="mr-2" />
      {tab.label}
      {tab.badge && tab.badge > 0 && (
        <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-2 py-1">
        {tab.badge}
        </span>
      )}
      </button>
    ))}
    </nav>
    </MadinaCard>
    </div>

    {/* Main Content Area */}
    <MadinaCard>
    {activeTab === 'classes' && (
      <ClassesTab
      classes={filteredClasses}
      formatDateTime={formatDateTime}
      onStartVideoSession={handleStartVideoSession}
      onJoinExistingSession={handleJoinExistingSession}
      onEndVideoSession={handleEndVideoSession}
      onDeleteClass={handleDeleteClass}
      onRejoinSession={handleRejoinSession}
      startingSession={startingSession}
      endingSession={endingSession}
      videoCallError={videoCallError}
      setVideoCallError={setVideoCallError}
      recentSessions={recentSessions}
      />
    )}

    {activeTab === 'students' && (
      <StudentsTab students={students} />
    )}

    {activeTab === 'assignments' && (
      <AssignmentsTab
      assignments={assignments}
      formatDateTime={formatDateTime}
      onShowCreateAssignment={() => setShowCreateAssignment(true)}
      onDeleteAssignment={handleDeleteAssignment}
      onReloadData={loadTeacherData}
      filters={filters}
      onFilterChange={updateFilter}
      />
    )}

    {activeTab === 'grading' && (
      <GradingTab
      submissions={submissions}
      pendingSubmissions={pendingSubmissions}
      formatDateTime={formatDateTime}
      onStartGrading={handleStartGrading}
      filters={filters}
      onFilterChange={updateFilter}
      />
    )}
    </MadinaCard>
    </div>

    {/* Modals */}
    <AssignmentCreationModal
    isOpen={showCreateAssignment}
    onClose={() => setShowCreateAssignment(false)}
    newAssignment={newAssignment}
    onAssignmentChange={handleAssignmentChange}
    onCreateAssignment={createAssignment}
    />

    <GradingModal
    gradingSubmission={gradingSubmission}
    onClose={() => {
      setGradingSubmission(null);
      setGradeData({ score: '', feedback: '', audioFeedbackData: '' });
      audioRecorder.clearRecording();
    }}
    gradeData={gradeData}
    onGradeDataChange={handleGradeDataChange}
    onGradeAssignment={gradeAssignment}
    isGrading={isGrading}
    audioRecorder={audioRecorder}
    />

    {showVideoCallModal && activeVideoCall && (
      <TeacherVideoCall
      classData={activeVideoCall}
      onClose={() => {
        setShowVideoCallModal(false);
        setActiveVideoCall(null);
        setVideoCallError(null);
      }}
      onError={(error) => {
        setVideoCallError(error);
        toast.error(`Video call error: ${error}`);
      }}
      channel={activeVideoCall.channel || activeVideoCall.meetingId || `class-${activeVideoCall.classId}`}
      token={activeVideoCall.token || null}
      appId={activeVideoCall.appId || import.meta.env.VITE_AGORA_APP_ID || 'fallback-app-id'}
      uid={activeVideoCall.uid || user?.id || Date.now().toString()}
      />
    )}
    </div>
  );
}
