import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  Mic, MicOff, Video, VideoOff, Phone, Users,
  Settings, Share2, MessageCircle, Wifi, WifiOff,
  AlertCircle, CheckCircle, Copy, RefreshCw
} from "lucide-react";
import { toast } from 'react-toastify';
import { motion } from "framer-motion";
import { videoApi } from '../lib/videoApi';
import { supabase } from '../lib/supabaseClient'; // Add missing import

const TeacherVideoCall = ({
  classItem,
  isOpen,
  onClose,
  onSessionUpdate
}) => {
  // STATE - Simplified like student dashboard
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [networkQuality, setNetworkQuality] = useState({ upload: 0, download: 0 });
  const [participants, setParticipants] = useState([]);
  const [localVideoReady, setLocalVideoReady] = useState(false);
  const [meetingId, setMeetingId] = useState(null);
  const [channel, setChannel] = useState(null);

  // REFS
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const agoraClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const remoteUsersMapRef = useRef(new Map());

  // 🎯 PRODUCTION LOGGER
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 👨‍🏫 TEACHER: ${message}`, data || '');
  }, []);

  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ TEACHER ERROR: ${message}`, error);
  }, []);

  // 🧹 COMPLETE CLEANUP
  const performCompleteCleanup = useCallback(async () => {
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
        setIsConnected(false);
        setIsConnecting(false);
        setCallDuration(0);
        setError('');
        setParticipants([]);
        setLocalVideoReady(false);
        setMeetingId(null);
        setChannel(null);
      }

      debugLog('Cleanup complete');
    } catch (error) {
      debugError('Cleanup error:', error);
    }
  }, [debugLog, debugError]);

  // 🎤 CREATE LOCAL TRACKS
  const createLocalTracks = useCallback(async () => {
    debugLog('Creating local tracks...');

    try {
      let audioTrack = null;
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
          encoderConfig: { sampleRate: 48000, stereo: true }
        });
      } catch (audioError) {
        debugLog('Audio track creation failed, continuing without audio');
      }

      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrateMin: 1000,
          bitrateMax: 2000
        },
        optimizationMode: 'detail',
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
  }, [debugLog, debugError]);

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
      setLocalVideoReady(true);
      debugLog('Local video playing');
    } catch (error) {
      debugError('Local video play error:', error);
      setLocalVideoReady(true);
    }
  }, [debugLog, debugError]);

  // 📺 REMOTE VIDEO SETUP
  const setupRemoteVideo = useCallback(async (user) => {
    debugLog(`Setting up remote video for student ${user.uid}`);
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
        debugLog(`Remote video playing for student ${user.uid}`);

        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-3 left-3 bg-black/70 text-white px-3 py-2 rounded-lg text-sm backdrop-blur-sm';
        overlay.textContent = `Student ${user.uid}`;
        videoElement.appendChild(overlay);
      }
    } catch (error) {
      debugError(`Remote video playback error for student ${user.uid}:`, error);
    }
  }, [debugLog, debugError]);

  const removeRemoteVideo = useCallback((uid) => {
    const videoElement = document.getElementById(`remote-video-${uid}`);
    if (videoElement) videoElement.remove();
  }, []);

  // 👥 REMOTE USER HANDLING
  const setupRemoteUserHandling = useCallback((client) => {
    debugLog('Setting up remote user handlers');

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

        setParticipants(Array.from(remoteUsersMapRef.current.values()));

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
        setParticipants(Array.from(remoteUsersMapRef.current.values()));
      }
    });

    // User left
    client.on('user-left', (user) => {
      debugLog(`Student ${user.uid} left`);
      remoteUsersMapRef.current.delete(user.uid);
      removeRemoteVideo(user.uid);
      setParticipants(Array.from(remoteUsersMapRef.current.values()));

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
      setNetworkQuality({
        upload: quality.uplinkNetworkQuality,
        download: quality.downlinkNetworkQuality
      });
    });

    // Connection state changes
    client.on('connection-state-change', (curState, prevState, reason) => {
      debugLog(`Connection state: ${curState}, Reason: ${reason}`);
      
      if (curState === 'CONNECTED') {
        setIsConnected(true);
        setIsConnecting(false);
        setError('');
        debugLog('✅ Connected to Agora channel');
      } else if (curState === 'DISCONNECTED' || curState === 'FAILED') {
        setIsConnected(false);
        setIsConnecting(false);
        setError(reason || 'Connection lost');
        debugError('Disconnected from Agora channel:', reason);
      } else if (curState === 'CONNECTING') {
        setIsConnecting(true);
      }
    });

    debugLog('Remote user handlers setup complete');
  }, [classItem?.id, onSessionUpdate, debugLog, debugError, setupRemoteVideo, removeRemoteVideo]);

  // 🚀 START SESSION - FIXED VERSION (Like Student Dashboard)
  const startSession = useCallback(async () => {
    if (!isOpen || !classItem?.id || isConnecting || isConnected) {
      debugLog('Cannot start session - invalid state');
      return;
    }

    debugLog('🚀 STARTING TEACHER SESSION');
    setIsConnecting(true);
    setError('');

    try {
      // STEP 1: Start teacher session via videoApi
      debugLog('Calling videoApi.startTeacherSession...');
      const sessionData = await videoApi.startTeacherSession(classItem.id);
      
      if (!sessionData || !sessionData.success || !sessionData.agora_credentials) {
        throw new Error(sessionData?.error || 'Failed to start teacher session');
      }

      const { appId, channel, token, uid } = sessionData.agora_credentials;

      // Validate credentials
      if (!appId || !channel || !token) {
        throw new Error('Invalid Agora credentials received');
      }

      debugLog('Credentials received:', {
        appId: appId.substring(0, 8) + '...',
        channel,
        uid,
        hasToken: !!token,
        meetingId: sessionData.meetingId
      });

      // STEP 2: Create local tracks
      await createLocalTracks();

      // STEP 3: Play local video
      await playLocalVideo();

      // STEP 4: Initialize Agora client
      debugLog('Creating Agora client...');
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      agoraClientRef.current = client;

      // STEP 5: Setup event handlers
      setupRemoteUserHandling(client);

      // STEP 6: Join channel with timeout
      debugLog(`Joining channel: ${channel}`);
      const JOIN_TIMEOUT = 15000;
      
      const joinPromise = client.join(appId, channel, token, uid);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 15s')), JOIN_TIMEOUT);
      });

      await Promise.race([joinPromise, timeoutPromise]);
      debugLog('✅ Successfully joined channel');

      // STEP 7: Publish tracks
      const tracksToPublish = [localTracksRef.current.audio, localTracksRef.current.video].filter(Boolean);
      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        debugLog(`Published ${tracksToPublish.length} tracks`);
      }

      // STEP 8: Set client role as host
      await client.setClientRole('host');

      // STEP 9: Update state
      setMeetingId(sessionData.meetingId);
      setChannel(channel);
      setIsConnected(true);
      setIsConnecting(false);

      // STEP 10: Start call timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      toast.success(sessionData.isNewSession ? '🎉 Class session started!' : '🔄 Rejoined existing session!');
      debugLog('🎉 TEACHER SESSION READY!');

    } catch (error) {
      debugError('Session start failed:', error);
      
      let userMessage = 'Failed to start video session. ';
      if (error.message.includes('permission')) {
        userMessage = 'Camera/microphone permission required. Please allow access and refresh.';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        userMessage = 'Network connection issue. Please check your internet.';
      } else if (error.message.includes('App ID') || error.message.includes('credentials')) {
        userMessage = 'Video configuration error. Please contact support.';
      } else {
        userMessage += error.message || 'Please check your connection.';
      }

      setError(userMessage);
      setIsConnecting(false);
      toast.error(userMessage);
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

  // 🎤 MEDIA CONTROLS
  const toggleAudio = useCallback(async () => {
    if (!localTracksRef.current.audio || !isConnected) return;

    try {
      const newMutedState = !isAudioMuted;
      await localTracksRef.current.audio.setEnabled(!newMutedState);
      setIsAudioMuted(newMutedState);
      debugLog(`Audio ${newMutedState ? 'muted' : 'unmuted'}`);
    } catch (error) {
      debugError('Toggle audio failed:', error);
      toast.error('Failed to toggle microphone');
    }
  }, [isAudioMuted, isConnected, debugLog, debugError]);

  const toggleVideo = useCallback(async () => {
    if (!localTracksRef.current.video || !isConnected) return;

    try {
      const newVideoOffState = !isVideoOff;
      await localTracksRef.current.video.setEnabled(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
      debugLog(`Video ${newVideoOffState ? 'off' : 'on'}`);
    } catch (error) {
      debugError('Toggle video failed:', error);
      toast.error('Failed to toggle camera');
    }
  }, [isVideoOff, isConnected, debugLog, debugError]);

  // 🛑 END SESSION
  const endSession = useCallback(async () => {
    try {
      debugLog('Ending session...');

      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'session_ending',
          classId: classItem?.id,
          meetingId: meetingId
        });
      }

      // End session via videoApi
      if (meetingId) {
        try {
          const endResult = await videoApi.endVideoSession(meetingId);
          if (!endResult.success) {
            debugLog('Backend session end warning:', endResult.error);
          }
        } catch (apiError) {
          debugError('Backend session end failed:', apiError);
        }
      }

      await performCompleteCleanup();
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
      await performCompleteCleanup();
      if (onClose) onClose();
    }
  }, [classItem?.id, meetingId, onClose, onSessionUpdate, performCompleteCleanup, debugLog, debugError]);

  // 🔗 COPY CLASS LINK
  const copyClassLink = useCallback(() => {
    if (meetingId) {
      const link = `${window.location.origin}/join-class/${meetingId}`;
      navigator.clipboard.writeText(link);
      toast.success('🔗 Class link copied to clipboard! Students can use this to join.');
      debugLog('Class link copied:', link);
    } else {
      toast.error('No active session to share');
    }
  }, [meetingId, debugLog]);

  // 🔄 RECONNECT SESSION
  const reconnectSession = useCallback(async () => {
    debugLog('Attempting to reconnect...');
    setError('');
    await startSession();
  }, [startSession, debugLog]);

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

  // 📡 EFFECTS
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
      debugLog('Dialog opened, scheduling session start...');
      const timeout = setTimeout(() => {
        startSession();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, classItem, startSession, debugLog]);

  // Don't render if not open
  if (!isOpen) return null;

  const totalParticipants = participants.length + 1;

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
              <span>{isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
              <span>•</span>
              <span>{formatTime(callDuration)}</span>
              <span>•</span>
              <span>You (Teacher)</span>
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
            disabled={isConnecting}
          >
            <Phone size={18} />
            <span className="hidden sm:inline">End Class</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-600/90 text-white p-4 mx-4 mt-4 rounded-xl flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isConnected && (
              <button
                onClick={reconnectSession}
                className="bg-white text-red-600 px-3 py-1 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            )}
            <button
              onClick={() => setError('')}
              className="text-xl font-bold hover:text-gray-200 transition-colors ml-2"
            >
              ×
            </button>
          </div>
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
          {participants.length === 0 && isConnected && (
            <div className="col-span-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Users size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Waiting for students to join...</p>
                <p className="text-gray-500">Share the class link with your students</p>
                {meetingId && (
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
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="text-gray-500 w-12 h-12" />
            </div>
          )}

          {/* Loading State */}
          {!localVideoReady && isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="animate-spin h-8 w-8 border-b-2 border-cyan-400 rounded-full"></div>
            </div>
          )}

          {/* Local Video Overlay */}
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm">
            You (Teacher) {isConnected && '(Live)'}
          </div>

          {/* Status Icons */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            {isAudioMuted && (
              <div className="bg-red-500 p-1.5 rounded-lg shadow-lg">
                <MicOff size={12} className="text-white" />
              </div>
            )}
            {isVideoOff && (
              <div className="bg-red-500 p-1.5 rounded-lg shadow-lg">
                <VideoOff size={12} className="text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Connecting Overlay */}
        {isConnecting && (
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
            disabled={!isConnected}
            className={`p-4 rounded-2xl transition-all duration-200 ${
              isAudioMuted
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </motion.button>

          {/* Video Control */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVideo}
            disabled={!isConnected}
            className={`p-4 rounded-2xl transition-all duration-200 ${
              isVideoOff
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </motion.button>

          {/* Share Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg"
            onClick={copyClassLink}
            disabled={!isConnected}
          >
            <Share2 size={24} />
          </motion.button>

          {/* Reconnect Button */}
          {!isConnected && !isConnecting && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={reconnectSession}
              className="p-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white transition-colors shadow-lg"
            >
              <RefreshCw size={24} />
            </motion.button>
          )}

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
            {getNetworkQualityIcon(networkQuality.upload)}
            <span>Upload: {networkQuality.upload}/6</span>
          </div>
          <div className="flex items-center gap-2">
            {getNetworkQualityIcon(networkQuality.download)}
            <span>Download: {networkQuality.download}/6</span>
          </div>
        </div>

        {/* Session Info */}
        {meetingId && (
          <div className="flex justify-center items-center gap-4 mt-4 text-sm text-cyan-300">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} />
              <span>Meeting ID: {meetingId.substring(0, 8)}...</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>Channel: {channel?.substring(0, 12)}...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherVideoCall;
