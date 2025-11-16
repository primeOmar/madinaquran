import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  Mic, MicOff, Video, VideoOff, Phone, Users,
  Settings, Share2, MessageCircle, Wifi, WifiOff,
  AlertCircle, CheckCircle, Copy
} from "lucide-react";
import { toast } from 'react-toastify';
import { motion } from "framer-motion";
import { videoApi } from '../lib/videoApi';

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

  // 🎯 PRODUCTION LOGGER
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 🎯 TEACHER: ${message}`, data || '');
  }, []);

  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ TEACHER ERROR: ${message}`, error);
  }, []);

  // 🧹 CLEANUP FUNCTION
  const performCleanup = useCallback(async () => {
    debugLog('Starting cleanup...');

    try {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Cleanup tracks
      const cleanupTrack = async (track, type) => {
        if (track) {
          try {
            track.stop();
            track.close();
            debugLog(`Cleaned ${type} track`);
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

      // Leave Agora channel
      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          debugLog('Left Agora channel');
        } catch (e) {
          debugError('Leave error:', e);
        }
        agoraClientRef.current = null;
      }

      // Clear remote users
      remoteUsersMapRef.current.clear();

      // Clear DOM elements
      if (remoteVideosContainerRef.current) {
        remoteVideosContainerRef.current.innerHTML = '';
      }

      if (localVideoRef.current) {
        localVideoRef.current.innerHTML = '';
      }

      // Reset state if component is still mounted
      if (isMountedRef.current) {
        setSessionState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          callDuration: 0,
          error: null,
          participants: [],
          localVideoReady: false
        }));
      }

      debugLog('Cleanup complete');
    } catch (error) {
      debugError('Cleanup error:', error);
    }
  }, [debugLog, debugError]);

  // 🎤 CREATE LOCAL TRACKS
  const createLocalTracks = async () => {
    try {
      debugLog('Creating local tracks...');

      let audioTrack = null;
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
      } catch (audioError) {
        debugLog('Audio track creation failed, continuing without audio');
      }

      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 640,
          height: 480,
          frameRate: 24,
          bitrateMin: 500,
          bitrateMax: 1000
        },
        optimizationMode: 'motion',
        mirror: true
      });

      localTracksRef.current.audio = audioTrack;
      localTracksRef.current.video = videoTrack;

      debugLog('Local tracks created successfully');
      return { audio: audioTrack, video: videoTrack };
    } catch (error) {
      debugError('Track creation failed:', error);
      throw error;
    }
  };

  // 📹 PLAY LOCAL VIDEO
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
      setSessionState(prev => ({ ...prev, localVideoReady: true }));
      debugLog('Local video playing');
    } catch (error) {
      debugError('Local video play error:', error);
      setSessionState(prev => ({ ...prev, localVideoReady: true }));
    }
  }, [debugLog, debugError]);

  // 🎯 SETUP AGORA EVENT HANDLERS
  const setupAgoraEventHandlers = useCallback((client) => {
    debugLog('Setting up Agora event handlers');

    // Connection state changes
    client.on('connection-state-change', (curState) => {
      debugLog(`Connection state: ${curState}`);
      
      if (curState === 'CONNECTED') {
        setSessionState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isConnecting: false,
          error: null 
        }));
        debugLog('✅ Connected to Agora channel');
      } else if (curState === 'DISCONNECTED' || curState === 'FAILED') {
        setSessionState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isConnecting: false,
          error: 'Connection lost. Please check your internet connection.' 
        }));
        debugError('❌ Disconnected from Agora channel');
      } else if (curState === 'CONNECTING') {
        setSessionState(prev => ({ ...prev, isConnecting: true }));
      }
    });

    // User published (student joined with media)
    client.on('user-published', async (user, mediaType) => {
      debugLog(`Student ${user.uid} published ${mediaType}`);

      try {
        await client.subscribe(user, mediaType);
        debugLog(`Subscribed to student ${user.uid} ${mediaType}`);

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
          }
        }

        updateParticipantsList();

        if (onSessionUpdate) {
          onSessionUpdate({
            type: 'student_joined',
            classId: classItem?.id,
            studentUid: user.uid,
            totalParticipants: remoteUsersMapRef.current.size + 1
          });
        }
      } catch (error) {
        debugError(`Subscribe error for student ${user.uid}:`, error);
      }
    });

    // User unpublished
    client.on('user-unpublished', (user, mediaType) => {
      debugLog(`Student ${user.uid} unpublished ${mediaType}`);

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

    // User left
    client.on('user-left', (user) => {
      debugLog(`Student ${user.uid} left`);
      remoteUsersMapRef.current.delete(user.uid);
      removeRemoteVideo(user.uid);
      updateParticipantsList();

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

    debugLog('Agora event handlers setup complete');
  }, [classItem?.id, onSessionUpdate, debugLog, debugError]);

  // 📺 REMOTE VIDEO MANAGEMENT
  const setupRemoteVideo = useCallback(async (user) => {
    const container = remoteVideosContainerRef.current;
    if (!container) return;

    const videoId = `remote-video-${user.uid}`;
    const existingElement = document.getElementById(videoId);
    if (existingElement) existingElement.remove();

    const videoElement = document.createElement('div');
    videoElement.id = videoId;
    videoElement.className = 'remote-video-item bg-gray-800 rounded-xl overflow-hidden relative min-h-[200px] shadow-lg';

    container.appendChild(videoElement);

    try {
      if (user.videoTrack) {
        await user.videoTrack.play(videoElement);

        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-3 left-3 bg-black/70 text-white px-3 py-2 rounded-lg text-sm backdrop-blur-sm';
        overlay.textContent = `Student ${user.uid}`;
        videoElement.appendChild(overlay);
        
        debugLog(`Remote video playing for student ${user.uid}`);
      }
    } catch (error) {
      debugError(`Remote video playback error for student ${user.uid}:`, error);
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

  // 🚀 INITIALIZE SESSION
  const initializeSession = useCallback(async () => {
    if (!isOpen || !classItem?.id || sessionState.isConnecting || sessionState.isConnected) {
      return;
    }

    debugLog('Starting session initialization...');
    setSessionState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }));

    try {
      // Test media permissions
      await testMediaPermissions();

      // Start teacher session via videoApi
      debugLog('Calling videoApi.startTeacherSession...');
      const sessionData = await videoApi.startTeacherSession(classItem.id);
      
      if (!sessionData || !sessionData.success || !sessionData.agora_credentials) {
        throw new Error(sessionData.error || 'Failed to start teacher session');
      }

      const { appId, channel, token, uid } = sessionData.agora_credentials;

      if (!appId || appId.includes('your_agora_app_id')) {
        throw new Error('Invalid Agora App ID configuration');
      }

      debugLog('Credentials received:', {
        appId: appId.substring(0, 8) + '...',
        channel,
        uid,
        hasToken: !!token
      });

      // Create and setup local tracks
      const tracks = await createLocalTracks();
      await playLocalVideo();

      // Initialize Agora client
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      agoraClientRef.current = client;

      // Setup event handlers
      setupAgoraEventHandlers(client);
      
      // Join the channel
      debugLog(`Joining channel: ${channel}`);
      await client.join(appId, channel, token, uid);
      debugLog('✅ Successfully joined channel');

      // Publish tracks
      const tracksToPublish = [tracks.audio, tracks.video].filter(Boolean);
      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        debugLog(`Published ${tracksToPublish.length} tracks`);
      }

      // Set client role as host
      await client.setClientRole('host');

      // Update session state
      setSessionState(prev => ({
        ...prev,
        sessionInfo: {
          meetingId: sessionData.meetingId,
          isNewSession: sessionData.isNewSession,
          startTime: new Date().toISOString(),
          channel: channel
        },
        meetingId: sessionData.meetingId,
        channel: channel,
        isConnected: true,
        isConnecting: false
      }));

      // Start call duration timer
      timerRef.current = setInterval(() => {
        setSessionState(prev => ({
          ...prev,
          callDuration: prev.callDuration + 1
        }));
      }, 1000);

      toast.success(sessionData.isNewSession ? '🎉 Class session started!' : '🔄 Rejoined existing session!');
      debugLog('Session initialization complete');

    } catch (error) {
      debugError('Session initialization failed:', error);
      
      let userMessage = 'Failed to start video session. ';
      if (error.message.includes('permission')) {
        userMessage = 'Camera/microphone permission required. Please allow access and refresh.';
      } else if (error.message.includes('network')) {
        userMessage = 'Network connection issue. Please check your internet.';
      } else if (error.message.includes('App ID')) {
        userMessage = 'Configuration error. Please contact support.';
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
  }, [isOpen, classItem, sessionState.isConnecting, sessionState.isConnected, setupAgoraEventHandlers, performCleanup, debugLog, debugError]);

  // 🎤 MEDIA CONTROL FUNCTIONS
  const toggleAudio = useCallback(async () => {
    if (!localTracksRef.current.audio || !sessionState.isConnected) return;

    try {
      const newMutedState = !sessionState.isAudioMuted;
      await localTracksRef.current.audio.setEnabled(!newMutedState);

      setSessionState(prev => ({
        ...prev,
        isAudioMuted: newMutedState
      }));

      toast.info(newMutedState ? '🔇 Microphone muted' : '🎤 Microphone on');
      debugLog(`Audio ${newMutedState ? 'muted' : 'unmuted'}`);
    } catch (error) {
      debugError('Toggle audio failed:', error);
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

      toast.info(newVideoOffState ? '📹 Camera off' : '📹 Camera on');
      debugLog(`Video ${newVideoOffState ? 'off' : 'on'}`);
    } catch (error) {
      debugError('Toggle video failed:', error);
      toast.error('Failed to toggle camera');
    }
  }, [sessionState.isVideoOff, sessionState.isConnected, debugLog, debugError]);

  // 🛑 END SESSION
  const endSession = useCallback(async () => {
    try {
      debugLog('Ending session...');

      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'session_ending',
          classId: classItem?.id,
          meetingId: sessionState.sessionInfo?.meetingId
        });
      }

      // End session via videoApi
      if (sessionState.sessionInfo?.meetingId) {
        try {
          const endResult = await videoApi.endVideoSession(sessionState.sessionInfo.meetingId);
          if (!endResult.success) {
            debugLog('Backend session end warning:', endResult.error);
          }
        } catch (apiError) {
          debugError('Backend session end failed:', apiError);
        }
      }

      await performCleanup();

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

      debugLog('Session ended successfully');
    } catch (error) {
      debugError('Error ending session:', error);
      toast.error('Error ending session');
      await performCleanup();
      if (onClose) onClose();
    }
  }, [classItem?.id, sessionState.sessionInfo, onClose, onSessionUpdate, performCleanup, debugLog, debugError]);

  // 🧪 TEST MEDIA PERMISSIONS
  const testMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      stream.getTracks().forEach(track => track.stop());
      debugLog('Media permissions granted');
    } catch (error) {
      let errorMessage = 'Camera/microphone access required. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone permissions in your browser.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera/microphone is busy with another application.';
      } else {
        errorMessage += error.message;
      }
      
      setSessionState(prev => ({ ...prev, error: errorMessage }));
      debugError('Media permissions failed:', error);
      throw error;
    }
  };

  // 🔗 COPY CLASS LINK
  const copyClassLink = useCallback(() => {
    if (sessionState.meetingId) {
      const link = `${window.location.origin}/join-class/${sessionState.meetingId}`;
      navigator.clipboard.writeText(link);
      toast.success('🔗 Class link copied to clipboard! Students can use this to join.');
      debugLog('Class link copied:', link);
    } else {
      toast.error('No active session to share');
    }
  }, [sessionState.meetingId, debugLog]);

  // ⚡ UTILITY FUNCTIONS
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

  // 📡 HEALTH CHECK
  const checkSessionHealth = useCallback(async () => {
    if (!sessionState.meetingId) return;
    
    try {
      const health = await videoApi.checkSessionHealth(sessionState.meetingId);
      if (health && !health.healthy) {
        debugLog('Session health check failed:', health);
      }
    } catch (error) {
      debugError('Health check failed:', error);
    }
  }, [sessionState.meetingId, debugLog, debugError]);

  // ⚡ EFFECTS
  useEffect(() => {
    isMountedRef.current = true;
    debugLog('Component mounted');

    return () => {
      debugLog('Component unmounting');
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [debugLog]);

  useEffect(() => {
    if (isOpen && classItem) {
      debugLog('Dialog opened, scheduling join...');
      const timeout = setTimeout(() => {
        initializeSession();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, classItem, initializeSession, debugLog]);

  // Health check effect
  useEffect(() => {
    let healthInterval;
    if (sessionState.isConnected && sessionState.meetingId) {
      healthInterval = setInterval(checkSessionHealth, 30000);
    }
    return () => {
      if (healthInterval) clearInterval(healthInterval);
    };
  }, [sessionState.isConnected, sessionState.meetingId, checkSessionHealth]);

  // Don't render if not open
  if (!isOpen) return null;

  const connectionStatus = getConnectionStatus();
  const totalParticipants = sessionState.participants.length + 1;

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
                  <button
                    onClick={copyClassLink}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                  >
                    <Copy size={16} />
                    Copy Student Join Link
                  </button>
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
