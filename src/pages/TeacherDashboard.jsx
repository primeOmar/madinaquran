import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, Users, Wifi, WifiOff,
  Monitor, MonitorOff, MessageCircle, Settings, Maximize2, Minimize2
} from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from '../lib/agora/videoApi';

const TeacherVideoCall = ({ classItem, isOpen, onClose, onSessionUpdate }) => {
  // State
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [networkQuality, setNetworkQuality] = useState({ upload: 0, download: 0 });
  const [participants, setParticipants] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localVideoReady, setLocalVideoReady] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({ 
    audio: null, 
    video: null, 
    screen: null 
  });
  const agoraClientRef = useRef(null);
  const screenClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const remoteUsersMapRef = useRef(new Map());

  // Debug logging
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 🎓 TEACHER_VIDEO: ${message}`, data || '');
  }, []);

  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ TEACHER_VIDEO_ERROR: ${message}`, error);
  }, []);

  // Complete cleanup function
  const performCompleteCleanup = useCallback(async () => {
    debugLog('Starting complete cleanup...');

    try {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop and cleanup all tracks
      const cleanupTrack = async (track, type) => {
        if (track) {
          try {
            track.stop();
            track.close();
            debugLog(`Cleaned ${type} track`);
          } catch (e) {
            debugError(`Error cleaning ${type} track:`, e);
          }
        }
      };

      await Promise.all([
        cleanupTrack(localTracksRef.current.audio, 'audio'),
        cleanupTrack(localTracksRef.current.video, 'video'),
        cleanupTrack(localTracksRef.current.screen, 'screen')
      ]);

      localTracksRef.current = { audio: null, video: null, screen: null };

      // Leave main Agora client
      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          debugLog('Left main Agora channel');
        } catch (e) {
          debugError('Error leaving main channel:', e);
        }
        agoraClientRef.current = null;
      }

      // Leave screen sharing client
      if (screenClientRef.current) {
        try {
          await screenClientRef.current.leave();
          debugLog('Left screen sharing channel');
        } catch (e) {
          debugError('Error leaving screen channel:', e);
        }
        screenClientRef.current = null;
      }

      // Clear remote users
      remoteUsersMapRef.current.clear();

      // Reset state if component is still mounted
      if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        setCallDuration(0);
        setError('');
        setParticipants([]);
        setLocalVideoReady(false);
        setIsScreenSharing(false);
      }

      debugLog('Cleanup completed successfully');
    } catch (error) {
      debugError('Error during cleanup:', error);
    }
  }, [debugLog, debugError]);

  // Create local audio/video tracks
  const createLocalTracks = useCallback(async () => {
    debugLog('Creating local audio/video tracks...');

    try {
      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      stream.getTracks().forEach(track => track.stop());

      // Create optimized audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,  // Acoustic Echo Cancellation
        ANS: true,  // Automatic Noise Suppression
        AGC: true,  // Automatic Gain Control
        encoderConfig: {
          sampleRate: 48000,
          stereo: true,
          bitrate: 128
        }
      });

      // Create optimized video track
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrateMin: 1500,
          bitrateMax: 3000
        },
        optimizationMode: 'detail',
        cameraId: await AgoraRTC.getCameras().then(cameras => cameras[0]?.deviceId)
      });

      localTracksRef.current.audio = audioTrack;
      localTracksRef.current.video = videoTrack;

      debugLog('Local tracks created successfully');
      return { audio: audioTrack, video: videoTrack };
    } catch (error) {
      debugError('Failed to create local tracks:', error);
      throw error;
    }
  }, [debugLog, debugError]);

  // Play local video in PIP
  const playLocalVideo = useCallback(async () => {
    if (!localVideoRef.current || !localTracksRef.current.video) {
      debugError('Cannot play local video: missing ref or track');
      return;
    }

    try {
      // Clear any existing video
      localVideoRef.current.innerHTML = '';
      
      // Play the video track
      await localTracksRef.current.video.play(localVideoRef.current, {
        mirror: true,
        fit: 'cover'
      });
      
      setLocalVideoReady(true);
      debugLog('Local video playing in PIP');
    } catch (error) {
      debugError('Error playing local video:', error);
      setLocalVideoReady(true); // Still mark as ready to show UI
    }
  }, [debugLog, debugError]);

  // Setup remote video element
  const setupRemoteVideo = useCallback(async (user) => {
    debugLog(`Setting up remote video for user ${user.uid}`);
    
    const container = remoteVideosContainerRef.current;
    if (!container) return;

    // Remove existing video element if any
    const existingElement = document.getElementById(`remote-video-${user.uid}`);
    if (existingElement) existingElement.remove();

    // Create new video container
    const videoElement = document.createElement('div');
    videoElement.id = `remote-video-${user.uid}`;
    videoElement.className = 'remote-video-item bg-gray-800 rounded-lg overflow-hidden relative min-h-[200px]';

    container.appendChild(videoElement);

    try {
      if (user.videoTrack) {
        await user.videoTrack.play(videoElement);
        debugLog(`Remote video playing for user ${user.uid}`);

        // Add user info overlay
        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs';
        overlay.textContent = `Student ${user.uid}`;
        videoElement.appendChild(overlay);
      }
    } catch (error) {
      debugError(`Error setting up remote video for ${user.uid}:`, error);
    }
  }, [debugLog, debugError]);

  // Remove remote video element
  const removeRemoteVideo = useCallback((uid) => {
    const videoElement = document.getElementById(`remote-video-${uid}`);
    if (videoElement) videoElement.remove();
  }, []);

  // Setup remote user event handlers
  const setupRemoteUserHandling = useCallback((client) => {
    debugLog('Setting up remote user event handlers');

    // User published media (joined with audio/video)
    client.on('user-published', async (user, mediaType) => {
      debugLog(`User ${user.uid} published ${mediaType}`);

      try {
        await client.subscribe(user, mediaType);
        debugLog(`Subscribed to ${user.uid} ${mediaType}`);

        // Add to remote users map
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
          debugLog(`Playing audio from ${user.uid}`);
        }

        // Update participants list
        setParticipants(Array.from(remoteUsersMapRef.current.values()));
      } catch (error) {
        debugError(`Error subscribing to ${user.uid}:`, error);
      }
    });

    // User unpublished media (stopped audio/video)
    client.on('user-unpublished', (user, mediaType) => {
      debugLog(`User ${user.uid} unpublished ${mediaType}`);

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

    // User left the channel
    client.on('user-left', (user) => {
      debugLog(`User ${user.uid} left the channel`);
      remoteUsersMapRef.current.delete(user.uid);
      removeRemoteVideo(user.uid);
      setParticipants(Array.from(remoteUsersMapRef.current.values()));
    });

    // Network quality monitoring
    client.on('network-quality', (quality) => {
      setNetworkQuality({
        upload: quality.uplinkNetworkQuality,
        download: quality.downlinkNetworkQuality
      });
    });

    // Connection state changes
    client.on('connection-state-change', (curState, prevState) => {
      debugLog(`Connection state: ${prevState} -> ${curState}`);
      
      if (curState === 'CONNECTED') {
        setIsConnected(true);
        setIsConnecting(false);
        setError('');
      } else if (curState === 'DISCONNECTED' || curState === 'FAILED') {
        setIsConnected(false);
        setError(`Connection ${curState.toLowerCase()}`);
      }
    });

    debugLog('Remote user handlers configured');
  }, [debugLog, debugError, setupRemoteVideo, removeRemoteVideo]);

  // Start video session
  const startSession = useCallback(async () => {
    if (!isOpen || !classItem || isConnecting || isConnected) {
      debugLog('Cannot start session - invalid state');
      return;
    }

    debugLog('🚀 Starting teacher video session');
    setIsConnecting(true);
    setError('');

    try {
      // Step 1: Get session credentials from backend
      debugLog('Getting session credentials from backend...');
      const sessionResult = await videoApi.startVideoSession(classItem.id, classItem.teacher_id);

      if (!sessionResult.success) {
        throw new Error(sessionResult.error || 'Failed to get session credentials');
      }

      const { meetingId, channel, token, appId, uid } = sessionResult;

      debugLog('Session credentials received:', {
        meetingId,
        channel,
        appId,
        uid,
        tokenLength: token?.length
      });

      // Step 2: Create local tracks
      await createLocalTracks();

      // Step 3: Play local video preview
      await playLocalVideo();

      // Step 4: Initialize Agora client
      debugLog('Initializing Agora client...');
      const client = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8'
      });
      agoraClientRef.current = client;

      // Step 5: Setup event handlers
      setupRemoteUserHandling(client);

      // Step 6: Join channel
      debugLog(`Joining channel: ${channel} with UID: ${uid}`);
      await client.join(appId, channel, token, uid);
      debugLog('Successfully joined Agora channel');

      // Step 7: Publish tracks
      debugLog('Publishing audio/video tracks...');
      const tracks = [localTracksRef.current.audio, localTracksRef.current.video].filter(Boolean);
      if (tracks.length > 0) {
        await client.publish(tracks);
        debugLog(`Published ${tracks.length} tracks successfully`);
      }

      // Step 8: Update connection state
      setIsConnected(true);
      setIsConnecting(false);

      // Step 9: Start call timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      debugLog('🎉 Teacher video session fully active!');

      // Notify parent of session start
      if (onSessionUpdate) {
        onSessionUpdate({ 
          type: 'session_started', 
          meetingId, 
          channel,
          duration: callDuration 
        });
      }

    } catch (error) {
      debugError('Failed to start video session:', error);
      
      let errorMessage = 'Failed to start video session';
      if (error.message?.includes('permission')) {
        errorMessage = 'Camera/microphone permission required. Please allow access.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message?.includes('token')) {
        errorMessage = 'Authentication error. Please try again.';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }

      setError(errorMessage);
      setIsConnecting(false);
      await performCompleteCleanup();
    }
  }, [
    isOpen, classItem, isConnecting, isConnected, callDuration,
    createLocalTracks, playLocalVideo, setupRemoteUserHandling,
    performCompleteCleanup, onSessionUpdate, debugLog, debugError
  ]);

  // Control functions
  const toggleAudio = useCallback(async () => {
    if (!localTracksRef.current.audio || !isConnected) return;

    try {
      const newMutedState = !isAudioMuted;
      await localTracksRef.current.audio.setEnabled(!newMutedState);
      setIsAudioMuted(newMutedState);
      debugLog(`Audio ${newMutedState ? 'muted' : 'unmuted'}`);
    } catch (error) {
      debugError('Error toggling audio:', error);
    }
  }, [isAudioMuted, isConnected, debugLog, debugError]);

  const toggleVideo = useCallback(async () => {
    if (!localTracksRef.current.video || !isConnected) return;

    try {
      const newVideoOffState = !isVideoOff;
      await localTracksRef.current.video.setEnabled(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
      debugLog(`Video ${newVideoOffState ? 'disabled' : 'enabled'}`);
    } catch (error) {
      debugError('Error toggling video:', error);
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
        debugLog('Screen sharing stopped');
      } else {
        // Start screen sharing
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1',
          optimizationMode: 'detail'
        });

        localTracksRef.current.screen = screenTrack;
        await agoraClientRef.current.publish([screenTrack]);
        setIsScreenSharing(true);
        debugLog('Screen sharing started');

        // Handle screen share stop (user pressed ESC or stop in browser)
        screenTrack.on('track-ended', () => {
          toggleScreenShare();
        });
      }
    } catch (error) {
      debugError('Screen share error:', error);
      setError('Screen sharing failed. Please check permissions.');
    }
  }, [isConnected, isScreenSharing, debugLog, debugError]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  }, []);

  const endSession = useCallback(async () => {
    debugLog('Ending video session...');

    try {
      // Notify parent component
      if (onSessionUpdate) {
        onSessionUpdate({ 
          type: 'session_ended', 
          duration: callDuration,
          meetingId: classItem?.meetingId 
        });
      }

      // End session in backend
      if (classItem?.meetingId) {
        await videoApi.endVideoSession(classItem.meetingId, classItem.teacher_id)
          .catch(err => debugError('Error ending session in backend:', err));
      }

      await performCompleteCleanup();
      onClose();
      
      debugLog('Video session ended successfully');
    } catch (error) {
      debugError('Error ending session:', error);
      // Still attempt to cleanup and close
      await performCompleteCleanup();
      onClose();
    }
  }, [classItem, callDuration, performCompleteCleanup, onClose, onSessionUpdate, debugLog, debugError]);

  // Effects
  useEffect(() => {
    isMountedRef.current = true;
    debugLog('Component mounted');

    return () => {
      debugLog('Component unmounting');
      isMountedRef.current = false;
      performCompleteCleanup();
    };
  }, [performCompleteCleanup, debugLog]);

  useEffect(() => {
    if (isOpen && classItem) {
      debugLog('Modal opened, starting session...');
      const timeout = setTimeout(() => {
        startSession();
      }, 1000); // Small delay for better UX

      return () => clearTimeout(timeout);
    }
  }, [isOpen, classItem, startSession, debugLog]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Utility functions
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

  const totalParticipants = participants.length + 1; // +1 for teacher

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
          <button 
            onClick={toggleFullscreen}
            className="p-2 text-gray-300 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button 
            onClick={endSession}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Phone size={18} />
            <span className="hidden sm:inline">End Class</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-600/90 text-white p-4 mx-4 mt-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button 
            onClick={() => setError('')}
            className="text-xl font-bold hover:text-red-200 transition-colors"
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
          {/* Empty state when no students */}
          {participants.length === 0 && isConnected && (
            <div className="col-span-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-lg">Waiting for students to join...</p>
                <p className="text-sm mt-2">Share the class link with your students</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video PIP */}
        <div className="absolute bottom-4 right-4 w-64 h-48 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-green-500/50">
          <div ref={localVideoRef} className="w-full h-full bg-gray-800" />
          
          {/* Loading overlay */}
          {!localVideoReady && isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="animate-spin h-6 w-6 border-b-2 border-white rounded-full"></div>
            </div>
          )}

          {/* Video off overlay */}
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="text-gray-500 w-8 h-8" />
            </div>
          )}

          {/* Teacher label */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            You (Teacher) {isConnected && '• Live'}
          </div>

          {/* Status indicators */}
          <div className="absolute top-2 right-2 flex gap-1">
            {isAudioMuted && (
              <div className="bg-red-500 p-1 rounded" title="Microphone muted">
                <MicOff size={10} className="text-white" />
              </div>
            )}
            {isVideoOff && (
              <div className="bg-red-500 p-1 rounded" title="Camera off">
                <VideoOff size={10} className="text-white" />
              </div>
            )}
            {isScreenSharing && (
              <div className="bg-blue-500 p-1 rounded" title="Screen sharing">
                <Monitor size={10} className="text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Connecting Overlay */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
            <div className="text-center text-white bg-gray-800/90 p-8 rounded-2xl">
              <div className="animate-spin h-16 w-16 border-b-2 border-white rounded-full mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold mb-2">Starting Class Session...</h3>
              <p className="text-gray-300">Setting up camera, microphone, and video connection</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-800/90 border-t border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-center gap-3 md:gap-6">
          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            disabled={!isConnected}
            className={`p-3 md:p-4 rounded-2xl transition-all ${
              isAudioMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
              isAudioMuted ? 'border-red-400' : 'border-gray-300'
            }`}
            title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            disabled={!isConnected}
            className={`p-3 md:p-4 rounded-2xl transition-all ${
              isVideoOff 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
              isVideoOff ? 'border-red-400' : 'border-gray-300'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            disabled={!isConnected}
            className={`p-3 md:p-4 rounded-2xl transition-all ${
              isScreenSharing 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
              isScreenSharing ? 'border-blue-400' : 'border-gray-300'
            }`}
            title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>

          {/* Chat (Placeholder) */}
          <button 
            disabled={!isConnected}
            className="p-3 md:p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Open chat"
          >
            <MessageCircle size={20} />
          </button>

          {/* Settings (Placeholder) */}
          <button 
            disabled={!isConnected}
            className="p-3 md:p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherVideoCall;
