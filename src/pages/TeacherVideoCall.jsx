import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  Mic, MicOff, Video, VideoOff, Phone, Users, Clock,
  Settings, Share2, MessageCircle, User, Wifi, WifiOff,
  AlertCircle, Loader2, XCircle, CheckCircle, Copy
} from "lucide-react";
import { toast } from 'react-toastify';
import { motion } from "framer-motion";
import { teacherApi } from '../lib/teacherApi';

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

// Enhanced Teacher Video Call Component
const TeacherVideoCall = ({
  classItem,
  isOpen,
  onClose,
  onSessionUpdate
}) => {
  // State Management
  const [sessionState, setSessionState] = useState({
    isConnected: false,
    isConnecting: false,
    isAudioMuted: false,
    isVideoOff: false,
    callDuration: 0,
    participants: [],
    networkQuality: { upload: 0, download: 0 },
    error: null,
    sessionInfo: null,
    localVideoReady: false,
    meetingId: null,
    channel: null
  });

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({
    audio: null,
    video: null
  });
  const agoraClientRef = useRef(null);
  const remoteUsersMapRef = useRef(new Map());
  const isMountedRef = useRef(true);

  // Debug logging
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 🎥 TEACHER_VIDEO: ${message}`, data || '');
  }, []);

  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ TEACHER_VIDEO_ERROR: ${message}`, error);
  }, []);

  // Add debug useEffect inside the component
  useEffect(() => {
    console.log('🔍 TeacherVideoCall Debug:', {
      isOpen,
      classItem: classItem ? {
        id: classItem.id,
        title: classItem.title,
        classId: classItem.classId
      } : null,
      sessionState: {
        isConnecting: sessionState.isConnecting,
        isConnected: sessionState.isConnected,
        error: sessionState.error
      }
    });
  }, [isOpen, classItem, sessionState]);

  // Test the API call separately
  const testTeacherApi = async () => {
    try {
      console.log('🧪 Testing teacher API...');
      const result = await teacherApi.getOrCreateActiveSession(classItem.id);
      console.log('✅ Teacher API result:', result);
      return result;
    } catch (error) {
      console.error('❌ Teacher API error:', error);
      throw error;
    }
  };

  // Test media permissions
  const testMediaPermissions = async () => {
    try {
      debugLog('🎯 Testing camera and microphone permissions...');

      // Test camera
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      debugLog('✅ Camera permission granted');
      cameraStream.getTracks().forEach(track => track.stop());

      // Test microphone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      debugLog('✅ Microphone permission granted');
      micStream.getTracks().forEach(track => track.stop());

    } catch (error) {
      debugError('❌ Media permission error:', error);
      setSessionState(prev => ({
        ...prev,
        error: `Media permission denied: ${error.message}. Please allow camera and microphone access.`
      }));
      throw error;
    }
  };

  // Helper functions for track creation with retry
  const createLocalTracksWithRetry = async (retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        debugLog(`🎤 Creating local tracks (attempt ${attempt}/${retries})...`);

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
          encoderConfig: {
            sampleRate: 48000,
            stereo: true,
            bitrate: 128
          }
        });

        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrateMin: 1000,
            bitrateMax: 3000
          },
          optimizationMode: 'detail',
          mirror: true
        });

        localTracksRef.current.audio = audioTrack;
        localTracksRef.current.video = videoTrack;

        debugLog('✅ Local tracks created successfully');
        return { audio: audioTrack, video: videoTrack };

      } catch (error) {
        debugError(`❌ Track creation failed (attempt ${attempt})`, error);

        if (attempt === retries) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  };

  const joinChannelWithTimeout = async (client, appId, channel, token, uid, timeout = 15000) => {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout - please check your network connection'));
      }, timeout);

      try {
        await client.join(appId, channel, token, uid);
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  };

  // Enhanced initializeSession function in TeacherVideoCall
  const initializeSession = useCallback(async () => {
    if (!isOpen || !classItem?.id || sessionState.isConnecting || sessionState.isConnected) {
      return;
    }

    debugLog('🚀 Starting teacher video session', {
      classId: classItem.id,
      className: classItem.title
    });

    setSessionState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }));

    try {
      // Step 1: Test media permissions
      debugLog('🎯 Testing media permissions...');
      await testMediaPermissions();

      // Step 2: Get session credentials from teacher API
      debugLog('🔗 Getting session from teacher API...');
      const sessionData = await teacherApi.getOrCreateActiveSession(classItem.id);
      
      if (!sessionData || !sessionData.agora_credentials) {
        throw new Error('Failed to get session credentials');
      }

      const { appId, channel, token, uid } = sessionData.agora_credentials;

      debugLog('✅ Session credentials received', {
        channel,
        uid,
        hasAppId: !!appId,
        hasToken: !!token
      });

      // Step 3: Validate configuration
      if (!appId || appId.includes('your_agora_app_id')) {
        throw new Error('Invalid Agora App ID configuration');
      }

      // Step 4: Initialize Agora client
      debugLog('🔧 Initializing Agora client...');
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      agoraClientRef.current = client;

      // Step 5: Setup event handlers
      setupAgoraEventHandlers(client);

      // Step 6: Create local tracks
      debugLog('🎤 Creating local tracks...');
      const tracks = await createLocalTracksWithRetry();

      // Step 7: Join channel
      debugLog(`🚪 Joining channel: ${channel}`);
      await joinChannelWithTimeout(client, appId, channel, token, uid);

      // Step 8: Publish tracks
      debugLog('📤 Publishing tracks...');
      if (tracks.audio && tracks.video) {
        await client.publish([tracks.audio, tracks.video]);
        debugLog('✅ Published audio and video tracks');
      }

      // Step 9: Play local video
      await playLocalVideo();

      // Step 10: Update state
      setSessionState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        sessionInfo: {
          meetingId: sessionData.meeting_id,
          isNewSession: sessionData.isNewSession,
          startTime: new Date().toISOString(),
          channel: channel
        },
        meetingId: sessionData.meeting_id,
        channel: channel
      }));

      // Step 11: Start timer
      timerRef.current = setInterval(() => {
        setSessionState(prev => ({
          ...prev,
          callDuration: prev.callDuration + 1
        }));
      }, 1000);

      debugLog('🎉 Teacher video session started successfully');
      toast.success(sessionData.isNewSession ? '🎉 Class session started!' : '🔄 Rejoined existing session!');

    } catch (error) {
      debugError('❌ Session initialization failed', error);
      
      let userMessage = 'Failed to start video session. ';
      if (error.message.includes('permission')) {
        userMessage = 'Camera/microphone permission required. Please allow access.';
      } else if (error.message.includes('network')) {
        userMessage = 'Network connection issue. Please check your internet.';
      } else {
        userMessage += error.message || 'Please check your connection.';
      }

      setSessionState(prev => ({
        ...prev,
        isConnecting: false,
        error: userMessage
      }));

      toast.error(userMessage);
      await performCleanup();
    }
  }, [isOpen, classItem, sessionState.isConnecting, sessionState.isConnected]);

  // Agora Event Handlers
  const setupAgoraEventHandlers = useCallback((client) => {
    debugLog('📡 Setting up Agora event handlers');

    // User published (student joined with media)
    client.on('user-published', async (user, mediaType) => {
      debugLog(`🔔 Student ${user.uid} published ${mediaType}`);

      try {
        await client.subscribe(user, mediaType);
        debugLog(`✅ Subscribed to student ${user.uid} ${mediaType}`);

        if (!remoteUsersMapRef.current.has(user.uid)) {
          remoteUsersMapRef.current.set(user.uid, {
            uid: user.uid,
            hasVideo: false,
            hasAudio: false,
            role: 'student',
            joinedAt: new Date().toISOString()
          });
        }

        const userInfo = remoteUsersMapRef.current.get(user.uid);

        if (mediaType === 'video') {
          userInfo.hasVideo = true;
          await setupRemoteVideo(user);
        } else if (mediaType === 'audio') {
          userInfo.hasAudio = true;
          if (user.audioTrack) {
            user.audioTrack.play();
            debugLog(`🔊 Playing audio from student ${user.uid}`);
          }
        }

        updateParticipantsList();

        // Notify parent component
        if (onSessionUpdate) {
          onSessionUpdate({
            type: 'student_joined',
            classId: classItem?.id,
            studentUid: user.uid,
            totalParticipants: remoteUsersMapRef.current.size + 1
          });
        }

      } catch (error) {
        debugError(`Subscribe error for student ${user.uid}`, error);
      }
    });

    // User unpublished (student stopped sharing media)
    client.on('user-unpublished', (user, mediaType) => {
      debugLog(`🔕 Student ${user.uid} unpublished ${mediaType}`);

      if (remoteUsersMapRef.current.has(user.uid)) {
        const userInfo = remoteUsersMapRef.current.get(user.uid);
        if (mediaType === 'video') {
          userInfo.hasVideo = false;
          removeRemoteVideo(user.uid);
        } else if (mediaType === 'audio') {
          userInfo.hasAudio = false;
        }
        updateParticipantsList();
      }
    });

    // User left (student disconnected)
    client.on('user-left', (user) => {
      debugLog(`👋 Student ${user.uid} left the session`);
      remoteUsersMapRef.current.delete(user.uid);
      removeRemoteVideo(user.uid);
      updateParticipantsList();

      // Notify parent component
      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'student_left',
          classId: classItem?.id,
          studentUid: user.uid,
          totalParticipants: remoteUsersMapRef.current.size + 1
        });
      }
    });

    // Network quality monitoring
    client.on('network-quality', (quality) => {
      setSessionState(prev => ({
        ...prev,
        networkQuality: {
          upload: quality.uplinkNetworkQuality,
          download: quality.downlinkNetworkQuality
        }
      }));
    });

    // Connection state changes
    client.on('connection-state-change', (curState, prevState) => {
      debugLog(`🔄 Connection state changed: ${prevState} → ${curState}`);

      if (curState === 'DISCONNECTED' || curState === 'FAILED') {
        setSessionState(prev => ({
          ...prev,
          error: `Connection lost: ${curState}. Attempting to reconnect...`
        }));
      }
    });

  }, [classItem?.id, debugLog, debugError, onSessionUpdate]);

  // Local Track Management
  const playLocalVideo = useCallback(async () => {
    if (!localVideoRef.current || !localTracksRef.current.video) {
      debugError('Cannot play local video: missing ref or track');
      return;
    }

    try {
      // Clear any existing content
      localVideoRef.current.innerHTML = '';

      // Play the video track
      await localTracksRef.current.video.play(localVideoRef.current, {
        mirror: true,
        fit: 'cover'
      });

      setSessionState(prev => ({ ...prev, localVideoReady: true }));
      debugLog('✅ Local video playing');

    } catch (error) {
      debugError('Failed to play local video', error);
      setSessionState(prev => ({ ...prev, localVideoReady: true }));
    }
  }, [debugLog, debugError]);

  // Remote Video Management
  const setupRemoteVideo = useCallback(async (user) => {
    const container = remoteVideosContainerRef.current;
    if (!container) return;

    const videoId = `remote-video-${user.uid}`;

    // Remove existing video element if any
    const existingElement = document.getElementById(videoId);
    if (existingElement) existingElement.remove();

    // Create new video container
    const videoElement = document.createElement('div');
    videoElement.id = videoId;
    videoElement.className = 'remote-video-item bg-gray-800 rounded-xl overflow-hidden relative min-h-[200px] shadow-lg';

    container.appendChild(videoElement);

    try {
      if (user.videoTrack) {
        await user.videoTrack.play(videoElement);
        debugLog(`✅ Remote video playing for student ${user.uid}`);

        // Add student info overlay
        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-3 left-3 bg-black/70 text-white px-3 py-2 rounded-lg text-sm backdrop-blur-sm';
        overlay.textContent = `Student ${user.uid}`;
        videoElement.appendChild(overlay);
      }
    } catch (error) {
      debugError(`Remote video playback error for student ${user.uid}`, error);
    }
  }, [debugLog, debugError]);

  const removeRemoteVideo = useCallback((uid) => {
    const videoElement = document.getElementById(`remote-video-${uid}`);
    if (videoElement) videoElement.remove();
  }, []);

  const updateParticipantsList = useCallback(() => {
    const participants = Array.from(remoteUsersMapRef.current.values());
    setSessionState(prev => ({ ...prev, participants }));
  }, []);

  // Media Control Functions
  const toggleAudio = useCallback(async () => {
    if (!localTracksRef.current.audio || !sessionState.isConnected) return;

    try {
      const newMutedState = !sessionState.isAudioMuted;
      await localTracksRef.current.audio.setEnabled(!newMutedState);

      setSessionState(prev => ({
        ...prev,
        isAudioMuted: newMutedState
      }));

      debugLog(`🎤 Audio ${newMutedState ? 'muted' : 'unmuted'}`);
      toast.info(newMutedState ? '🔇 Microphone muted' : '🎤 Microphone on');

    } catch (error) {
      debugError('Toggle audio failed', error);
      toast.error('Failed to toggle microphone');
    }
  }, [sessionState.isAudioMuted, sessionState.isConnected, debugLog, debugError]);

  const toggleVideo = useCallback(async () => {
    if (!localTracksRef.current.video || !sessionState.isConnected) return;

    try {
      const newVideoOffState = !sessionState.isVideoOff;
      await localTracksRef.current.video.setEnabled(!newVideoOffState);

      setSessionState(prev => ({
        ...prev,
        isVideoOff: newVideoOffState
      }));

      debugLog(`📹 Video ${newVideoOffState ? 'off' : 'on'}`);
      toast.info(newVideoOffState ? '📹 Camera off' : '📹 Camera on');

    } catch (error) {
      debugError('Toggle video failed', error);
      toast.error('Failed to toggle camera');
    }
  }, [sessionState.isVideoOff, sessionState.isConnected, debugLog, debugError]);

  // Session Control Functions
  const endSession = useCallback(async () => {
    debugLog('🛑 Ending teacher video session...');

    try {
      // Notify parent component
      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'session_ending',
          classId: classItem?.id,
          meetingId: sessionState.sessionInfo?.meetingId
        });
      }

      // End session via backend if we have session info
      if (sessionState.sessionInfo?.meetingId) {
        debugLog('📡 Notifying backend about session end...');
        await teacherApi.endVideoSession(sessionState.sessionInfo.meetingId);
      }

      await performCleanup();

      setSessionState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        callDuration: 0
      }));

      debugLog('✅ Session ended successfully');
      toast.success('✅ Class session ended');

      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'session_ended',
          classId: classItem?.id
        });
      }

      if (onClose) {
        onClose();
      }

    } catch (error) {
      debugError('Error ending session', error);
      toast.error('Error ending session, but local connection closed');

      // Still perform local cleanup even if backend call fails
      await performCleanup();
      if (onClose) {
        onClose();
      }
    }
  }, [classItem?.id, sessionState.sessionInfo, onClose, onSessionUpdate, debugLog, debugError]);

  // Cleanup Function
  const performCleanup = useCallback(async () => {
    debugLog('🧹 Performing cleanup...');

    try {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop and cleanup local tracks
      const cleanupTrack = async (track, type) => {
        if (track) {
          try {
            track.stop();
            track.close();
            debugLog(`✅ ${type} track cleaned`);
          } catch (e) {
            debugError(`Error cleaning ${type} track`, e);
          }
        }
      };

      await Promise.all([
        cleanupTrack(localTracksRef.current.audio, 'audio'),
        cleanupTrack(localTracksRef.current.video, 'video')
      ]);

      localTracksRef.current = { audio: null, video: null };

      // Leave Agora channel
      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          debugLog('✅ Left Agora channel');
        } catch (e) {
          debugError('Error leaving Agora channel', e);
        }
        agoraClientRef.current = null;
      }

      // Clear remote users
      remoteUsersMapRef.current.clear();

      // Clear video elements
      if (remoteVideosContainerRef.current) {
        remoteVideosContainerRef.current.innerHTML = '';
      }

      debugLog('✅ Cleanup completed');

    } catch (error) {
      debugError('Cleanup error', error);
    }
  }, [debugLog, debugError]);

  // Utility Functions
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getNetworkQualityIcon = (quality) => {
    if (quality <= 2) return <Wifi className="w-4 h-4 text-green-400" />;
    if (quality <= 4) return <Wifi className="w-4 h-4 text-yellow-400" />;
    return <WifiOff className="w-4 h-4 text-red-400" />;
  };

  const getConnectionStatus = () => {
    if (sessionState.isConnected) return { text: 'Connected', color: 'text-green-400', bg: 'bg-green-500' };
    if (sessionState.isConnecting) return { text: 'Connecting...', color: 'text-yellow-400', bg: 'bg-yellow-500' };
    return { text: 'Disconnected', color: 'text-red-400', bg: 'bg-red-500' };
  };

  // Copy class link for students
  const copyClassLink = useCallback(() => {
    if (sessionState.meetingId) {
      const link = `${window.location.origin}/join-class/${sessionState.meetingId}`;
      navigator.clipboard.writeText(link);
      toast.success('🔗 Class link copied to clipboard! Students can use this to join.');
    } else {
      toast.error('No active session to share');
    }
  }, [sessionState.meetingId]);

  // Effects
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen && classItem) {
      const timer = setTimeout(() => {
        initializeSession();
      }, 1000); // Small delay for better UX

      return () => clearTimeout(timer);
    }
  }, [isOpen, classItem, initializeSession]);

  // Don't render if not open
  if (!isOpen) return null;

  const connectionStatus = getConnectionStatus();
  const totalParticipants = sessionState.participants.length + 1; // +1 for teacher

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-sm text-white p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connectionStatus.bg} animate-pulse`} />
          <div>
            <h2 className="text-lg font-bold">{classItem?.title || 'Class Session'} - Teacher</h2>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className={connectionStatus.color}>{connectionStatus.text}</span>
              <span>•</span>
              <span>{formatTime(sessionState.callDuration)}</span>
              <span>•</span>
              <span>You (Teacher)</span>
              {sessionState.sessionInfo?.isNewSession && (
                <>
                  <span>•</span>
                  <span className="bg-green-500 px-2 py-0.5 rounded text-xs">NEW SESSION</span>
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
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
            disabled={sessionState.isConnecting}
          >
            <Phone size={18} />
            <span className="hidden sm:inline">End Class</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {sessionState.error && (
        <div className="bg-red-600/90 text-white p-4 mx-4 mt-4 rounded-xl flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">{sessionState.error}</span>
          </div>
          <button
            onClick={() => setSessionState(prev => ({ ...prev, error: null }))}
            className="text-xl font-bold hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Video Area */}
      <div className="flex-1 relative p-4">
        {/* Remote Videos Grid */}
        <div
          ref={remoteVideosContainerRef}
          className="w-full h-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {/* Empty State */}
          {sessionState.participants.length === 0 && sessionState.isConnected && (
            <div className="col-span-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Users size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Waiting for students to join...</p>
                <p className="text-gray-500">Share the class link with your students</p>
                {sessionState.meetingId && (
                  <MadinaButton
                    onClick={copyClassLink}
                    variant="primary"
                    className="mt-4"
                  >
                    <Copy size={16} className="mr-2" />
                    Copy Student Join Link
                  </MadinaButton>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local Video - Picture in Picture */}
        <div className="absolute bottom-6 right-6 w-64 h-48 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 transition-all duration-300 hover:border-cyan-400/50">
          <div
            ref={localVideoRef}
            className="w-full h-full bg-gray-800 flex items-center justify-center"
          />

          {/* Video Off State */}
          {sessionState.isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="text-gray-500 w-12 h-12" />
            </div>
          )}

          {/* Loading State */}
          {!sessionState.localVideoReady && sessionState.isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="animate-spin h-8 w-8 border-b-2 border-cyan-400 rounded-full"></div>
            </div>
          )}

          {/* Local Video Overlay */}
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm">
            You (Teacher) {sessionState.isConnected && '(Live)'}
          </div>

          {/* Status Icons */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            {sessionState.isAudioMuted && (
              <div className="bg-red-500 p-1.5 rounded-lg shadow-lg">
                <MicOff size={12} className="text-white" />
              </div>
            )}
            {sessionState.isVideoOff && (
              <div className="bg-red-500 p-1.5 rounded-lg shadow-lg">
                <VideoOff size={12} className="text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Connecting Overlay */}
        {sessionState.isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center text-white bg-gray-800/90 p-8 rounded-2xl shadow-2xl border border-cyan-500/20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full mx-auto mb-6"
              />
              <h3 className="text-2xl font-semibold mb-3 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Starting Class Session
              </h3>
              <p className="text-gray-300 mb-2">Setting up your classroom...</p>
              <div className="flex justify-center gap-1 mt-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                />
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-6">
        <div className="flex items-center justify-center gap-4 md:gap-8">
          {/* Audio Control */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleAudio}
            disabled={!sessionState.isConnected}
            className={`p-4 rounded-2xl transition-all duration-200 ${
              sessionState.isAudioMuted
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } ${!sessionState.isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
          >
            {sessionState.isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </motion.button>

          {/* Video Control */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVideo}
            disabled={!sessionState.isConnected}
            className={`p-4 rounded-2xl transition-all duration-200 ${
              sessionState.isVideoOff
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } ${!sessionState.isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
          >
            {sessionState.isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </motion.button>

          {/* Share Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg"
            onClick={copyClassLink}
            disabled={!sessionState.isConnected}
          >
            <Share2 size={24} />
          </motion.button>

          {/* Chat Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-lg"
          >
            <MessageCircle size={24} />
          </motion.button>

          {/* Settings Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white transition-colors shadow-lg"
          >
            <Settings size={24} />
          </motion.button>
        </div>

        {/* Network Status */}
        <div className="flex justify-center items-center gap-4 mt-4 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            {getNetworkQualityIcon(sessionState.networkQuality.upload)}
            <span>Upload: {sessionState.networkQuality.upload}/6</span>
          </div>
          <div className="flex items-center gap-2">
            {getNetworkQualityIcon(sessionState.networkQuality.download)}
            <span>Download: {sessionState.networkQuality.download}/6</span>
          </div>
        </div>

        {/* Session Info */}
        {sessionState.meetingId && (
          <div className="flex justify-center items-center gap-4 mt-4 text-sm text-cyan-300">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} />
              <span>Meeting ID: {sessionState.meetingId.substring(0, 8)}...</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>Channel: {sessionState.channel?.substring(0, 12)}...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherVideoCall;
