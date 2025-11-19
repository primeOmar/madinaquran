import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  Users,
  Wifi,
  WifiOff,
  MessageCircle,
  MoreVertical,
  AlertCircle,
  Settings,
  Hand,
  UserX,
  Monitor,
  MonitorOff
} from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { teacherVideoApi } from '../lib/teacherVideoApi';

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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);

  // REFS
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null, screen: null });
  const agoraClientRef = useRef(null);
  const screenClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const remoteUsersMapRef = useRef(new Map());

  // LOGGING
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 🎓 TEACHER: ${message}`, data || '');
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
        cleanupTrack(localTracksRef.current.video, 'video'),
        cleanupTrack(localTracksRef.current.screen, 'screen')
      ]);

      localTracksRef.current = { audio: null, video: null, screen: null };

      // Cleanup main client
      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          debugLog('✅ Left main channel');
        } catch (e) {
          debugError('Leave error:', e);
        }
        agoraClientRef.current = null;
      }

      // Cleanup screen sharing client
      if (screenClientRef.current) {
        try {
          await screenClientRef.current.leave();
          debugLog('✅ Left screen channel');
        } catch (e) {
          debugError('Screen leave error:', e);
        }
        screenClientRef.current = null;
      }

      remoteUsersMapRef.current.clear();

      if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        setCallDuration(0);
        setError('');
        setParticipants([]);
        setLocalVideoReady(false);
        setIsScreenSharing(false);
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
          bitrateMin: 1500,
          bitrateMax: 3000
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
            hasAudio: false
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

    debugLog('✅ Remote handlers configured');
  }, [debugLog, debugError, setupRemoteVideo, removeRemoteVideo]);

  // START SESSION
const startSession = useCallback(async () => {
  if (!isOpen || !classItem?.id || isConnecting || isConnected) {
    debugLog('⚠️ Cannot start session');
    return;
  }

  debugLog('🚀 STARTING TEACHER SESSION');
  setIsConnecting(true);
  setError('');

  try {
    // STEP 1: Start session via API
    debugLog('📡 Calling startTeacherSession API...');
    const sessionResult = await teacherVideoApi.startTeacherSession(classItem.id);

    if (!sessionResult.success) {
      throw new Error(sessionResult.error || 'Failed to start session');
    }

    const { meetingId, channel, agora_credentials } = sessionResult;
    const { appId, token, uid } = agora_credentials;

    debugLog('🎯 SESSION CREDENTIALS RECEIVED:', {
      meetingId,
      channel,
      appId,
      uid,
      tokenLength: token?.length
    });

    setSessionInfo(sessionResult);

    // STEP 2: Initialize Agora client FIRST
    debugLog('🔧 Initializing Agora client...');
    const client = AgoraRTC.createClient({ 
      mode: 'rtc', 
      codec: 'vp8'
    });
    agoraClientRef.current = client;

    // STEP 3: Setup connection state monitoring
    client.on('connection-state-change', (curState, prevState) => {
      debugLog(`🔗 Agora Connection State: ${prevState} → ${curState}`);
      
      if (curState === 'CONNECTED') {
        setIsConnected(true);
        setIsConnecting(false);
        setError('');
        debugLog('🎉 CONNECTED to Agora channel!');
      } else if (curState === 'CONNECTING') {
        debugLog('🔄 Connecting to Agora...');
      } else if (curState === 'DISCONNECTED' || curState === 'FAILED') {
        setIsConnected(false);
        setError(`Connection ${curState.toLowerCase()}`);
        debugError(`Connection failed: ${curState}`);
      }
    });

    // STEP 4: Setup remote user handling
    setupRemoteUserHandling(client);

    // STEP 5: Join channel FIRST (before creating tracks)
    debugLog(`🚪 Joining Agora channel: ${channel} with UID: ${uid}`);
    await client.join(appId, channel, token, uid);
    debugLog('✅ Successfully joined Agora channel');

    // STEP 6: Create and publish local tracks
    debugLog('🎤 Creating local audio/video tracks...');
    const tracks = await createLocalTracks();
    
    debugLog('📤 Publishing tracks to channel...');
    await client.publish([tracks.audio, tracks.video]);
    debugLog('✅ Tracks published successfully');

    // STEP 7: Play local video
    await playLocalVideo();

    // STEP 8: Record participation (non-blocking)
    teacherVideoApi.recordTeacherParticipation(meetingId)
      .then(result => {
        if (result.success) {
          debugLog('✅ Teacher participation recorded');
        }
      })
      .catch(err => {
        debugError('Participation recording failed:', err);
      });

    // STEP 9: Start call timer
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    debugLog('🎉 TEACHER SESSION FULLY INITIALIZED!');

  } catch (error) {
    debugError('❌ SESSION START FAILED:', error);

    let errorMessage = 'Failed to start video session';
    if (error.message?.includes('permission')) {
      errorMessage = 'Camera/microphone permission required. Please allow access and try again.';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error - please check your internet connection';
    } else if (error.message?.includes('token')) {
      errorMessage = 'Authentication error - invalid session token';
    } else if (error.message?.includes('AGORA_APP_ID')) {
      errorMessage = 'Video service not configured properly';
    } else {
      errorMessage = error.message || 'Unknown error occurred';
    }

    setError(errorMessage);
    setIsConnecting(false);
    await performCompleteCleanup();
  }
}, [
  isOpen, classItem, isConnecting, isConnected, 
  createLocalTracks, playLocalVideo, setupRemoteUserHandling, 
  performCompleteCleanup, debugLog, debugError
]);

//function to check and request permissions
const checkMediaPermissions = useCallback(async () => {
  try {
    debugLog('🔍 Checking media permissions...');
    
    // Check camera permission
    const cameraPermission = await navigator.permissions.query({ name: 'camera' });
    const microphonePermission = await navigator.permissions.query({ name: 'microphone' });
    
    debugLog('📷 Camera permission:', cameraPermission.state);
    debugLog('🎤 Microphone permission:', microphonePermission.state);

    if (cameraPermission.state === 'denied' || microphonePermission.state === 'denied') {
      setError('Camera/microphone access denied. Please enable permissions in your browser settings.');
      return false;
    }

    // Try to get media streams to trigger permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: true 
    });
    
    // Stop all tracks immediately
    stream.getTracks().forEach(track => track.stop());
    
    debugLog('✅ Media permissions granted');
    return true;
  } catch (error) {
    debugError('❌ Media permission check failed:', error);
    setError('Camera/microphone access required. Please allow permissions to continue.');
    return false;
  }
}, [debugLog, debugError]);
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

  const toggleScreenShare = useCallback(async () => {
    if (!isConnected || !agoraClientRef.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (localTracksRef.current.screen) {
          await agoraClientRef.current.unpublish([localTracksRef.current.screen]);
          localTracksRef.current.screen.stop();
          localTracksRef.current.screen.close();
          localTracksRef.current.screen = null;
        }
        setIsScreenSharing(false);
        debugLog('🖥️ Screen sharing stopped');
      } else {
        // Start screen sharing
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1'
        });

        localTracksRef.current.screen = screenTrack;
        await agoraClientRef.current.publish([screenTrack]);
        setIsScreenSharing(true);
        debugLog('🖥️ Screen sharing started');

        // Handle screen share stop
        screenTrack.on('track-ended', () => {
          toggleScreenShare();
        });
      }
    } catch (error) {
      debugError('Screen share error:', error);
      setError('Screen sharing failed');
    }
  }, [isConnected, isScreenSharing, debugLog, debugError]);

  const endSession = useCallback(async () => {
    debugLog('🛑 Ending session...');
    
    if (sessionInfo?.meetingId) {
      await teacherVideoApi.endVideoSession(sessionInfo.meetingId, Math.floor(callDuration / 60))
        .catch(error => debugError('End session API failed:', error));
    }

    await performCompleteCleanup();
    onClose();
  }, [sessionInfo, callDuration, performCompleteCleanup, onClose, debugLog, debugError]);

  // EFFECTS
  useEffect(() => {
    isMountedRef.current = true;
    debugLog('🎬 Component mounted');

    return () => {
      debugLog('🎬 Unmounting');
      isMountedRef.current = false;
      performCompleteCleanup();
    };
  }, [performCompleteCleanup, debugLog]);

  useEffect(() => {
    if (isOpen && classItem?.id) {
      debugLog('🔔 Dialog opened, scheduling start...');
      const timeout = setTimeout(() => {
        startSession();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, classItem, startSession, debugLog]);

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
            <h2 className="text-lg font-bold">{classItem?.title || 'Class Session'}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span>Teacher View</span>
              <span>•</span>
              <span>{formatTime(callDuration)}</span>
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
          <button onClick={endSession} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
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
          <button onClick={() => setError('')} className="text-xl font-bold">×</button>
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
              </div>
            </div>
          )}
        </div>

        {/* Local Video PIP */}
        <div className="absolute bottom-4 right-4 w-48 h-36 md:w-64 md:h-48 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-green-500/50">
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
            {isScreenSharing && <div className="bg-blue-500 p-1 rounded"><Monitor size={10} className="text-white" /></div>}
          </div>
        </div>

        {/* Connecting Overlay */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
            <div className="text-center text-white bg-gray-800/90 p-8 rounded-2xl">
              <div className="animate-spin h-16 w-16 border-b-2 border-white rounded-full mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold mb-2">Starting Class Session...</h3>
              <p className="text-gray-300">Setting up camera and microphone</p>
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

          <button
            onClick={toggleScreenShare}
            disabled={!isConnected}
            className={`p-3 md:p-4 rounded-2xl transition-all ${
              isScreenSharing ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-white hover:bg-gray-100 text-gray-700'
            } disabled:opacity-50 border-2 ${
              isScreenSharing ? 'border-blue-400' : 'border-gray-300'
            }`}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>

          <button className="p-3 md:p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white">
            <MessageCircle size={20} />
          </button>

          <button className="p-3 md:p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherVideoCall;
