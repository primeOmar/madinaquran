import React, { useState, useRef, useCallback, useEffect } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { 
  Crown, 
  Share2, 
  Users, 
  PhoneOff, 
  AlertCircle, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  Move, 
  User,
  Wifi,
  WifiOff
} from 'lucide-react';

const TeacherVideoCall = ({ classData, onClose, onError, channel, token, appId, uid }) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [networkQuality, setNetworkQuality] = useState({ upload: 0, download: 0 });
  const [participants, setParticipants] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [localVideoReady, setLocalVideoReady] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [pinnedUser, setPinnedUser] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Draggable video state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  // ============================================================================
  // REFS
  // ============================================================================
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null, screen: null });
  const agoraClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const joinAttemptRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const videoContainerRef = useRef(null);
  const remoteUsersMapRef = useRef(new Map());

  // ============================================================================
  // LOGGING
  // ============================================================================
  const debugLog = useCallback((message, data = null) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      console.log(`[${timestamp}] 👨‍🏫 TeacherVideoCall: ${message}`, data || '');
    }
  }, []);

  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ TeacherVideoCall Error: ${message}`, error);
  }, []);

  // ============================================================================
  // TRACK READINESS CHECKER
  // ============================================================================
  const isTrackReady = useCallback((track) => {
    return track && typeof track.setEnabled === 'function';
  }, []);

  // ============================================================================
  // CLEANUP
  // ============================================================================
  const performCompleteCleanup = useCallback(async () => {
    debugLog('🧹 Starting teacher cleanup...');

    try {
      if (joinAttemptRef.current) {
        clearTimeout(joinAttemptRef.current);
        joinAttemptRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const cleanupTrack = async (track, type) => {
        if (track) {
          try {
            if (track.stop) track.stop();
            if (track.close) track.close();
            debugLog(`✅ ${type} track cleaned up`);
          } catch (e) {
            debugError(`Error cleaning up ${type} track:`, e);
          }
        }
      };

      await Promise.all([
        cleanupTrack(localTracksRef.current.audio, 'audio'),
        cleanupTrack(localTracksRef.current.video, 'video'),
        cleanupTrack(localTracksRef.current.screen, 'screen')
      ]);

      localTracksRef.current.audio = null;
      localTracksRef.current.video = null;
      localTracksRef.current.screen = null;

      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          debugLog('✅ Left Agora channel');
        } catch (e) {
          debugError('Error leaving channel:', e);
        }
        agoraClientRef.current = null;
      }

      if (localVideoRef.current) {
        try {
          localVideoRef.current.innerHTML = '';
        } catch (e) {
          debugError('Error cleaning local video:', e);
        }
      }

      if (remoteVideosContainerRef.current) {
        try {
          remoteVideosContainerRef.current.innerHTML = '';
        } catch (e) {
          debugError('Error cleaning remote videos:', e);
        }
      }

      remoteUsersMapRef.current.clear();

      if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        setCallDuration(0);
        setError('');
        setParticipants([]);
        setActiveSpeaker(null);
        setLocalVideoReady(false);
        setPinnedUser(null);
        setIsScreenSharing(false);
      }

      debugLog('✅ Teacher cleanup complete');
    } catch (error) {
      debugError('Teacher cleanup error:', error);
    }
  }, [debugLog, debugError]);

  // ============================================================================
  // REMOTE VIDEO MANAGEMENT
  // ============================================================================
  const setupRemoteVideo = useCallback(async (user) => {
    debugLog(`📺 Setting up remote video for student ${user.uid}`);
    const container = remoteVideosContainerRef.current;
    if (!container) {
      debugError('Remote video container not found');
      return;
    }

    const existingElement = document.getElementById(`remote-video-${user.uid}`);
    if (existingElement) {
      existingElement.remove();
    }

    const videoElement = document.createElement('div');
    videoElement.id = `remote-video-${user.uid}`;
    videoElement.className = 'remote-video-item relative bg-gray-800 rounded-xl overflow-hidden min-h-[200px] cursor-pointer transition-all duration-300';
    videoElement.innerHTML = `
      <div class="absolute inset-0 bg-gray-800 flex items-center justify-center">
        <div class="text-center text-gray-400">
          <div class="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
            <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11z"/>
            </svg>
          </div>
          <p class="text-sm">Student ${user.uid}</p>
          <p class="text-xs mt-1">Connecting...</p>
        </div>
      </div>
    `;

    videoElement.addEventListener('click', () => {
      setPinnedUser(pinnedUser === user.uid ? null : user.uid);
    });

    container.appendChild(videoElement);

    try {
      if (user.videoTrack) {
        videoElement.innerHTML = '';
        await user.videoTrack.play(videoElement);
        debugLog(`✅ Remote video playing for student ${user.uid}`);

        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs';
        overlay.textContent = `Student ${user.uid}`;
        videoElement.appendChild(overlay);

        if (pinnedUser === user.uid) {
          const pinIndicator = document.createElement('div');
          pinIndicator.className = 'absolute top-2 right-2 bg-yellow-500 text-white p-1 rounded';
          pinIndicator.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>';
          videoElement.appendChild(pinIndicator);
        }
      }
    } catch (error) {
      debugError(`Remote video play error for student ${user.uid}:`, error);
      videoElement.innerHTML = `
        <div class="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <div class="text-center text-gray-400">
            <div class="w-12 h-12 mx-auto mb-2">
              <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11z"/>
              </svg>
            </div>
            <p class="text-sm">Student ${user.uid}</p>
            <p class="text-xs mt-1">Video unavailable</p>
          </div>
        </div>
      `;
    }
  }, [debugLog, debugError, pinnedUser]);

  const removeRemoteVideo = useCallback((uid) => {
    debugLog(`🗑️ Removing remote video for student ${uid}`);
    try {
      const videoElement = document.getElementById(`remote-video-${uid}`);
      if (videoElement && videoElement.parentNode) {
        videoElement.remove();
      } else if (videoElement) {
        videoElement.innerHTML = '';
      }
    } catch (error) {
      debugError(`Error removing remote video for ${uid}:`, error);
    }
  }, [debugLog, debugError]);

  // ============================================================================
  // TRACK CREATION
  // ============================================================================
  const createLocalTracks = useCallback(async () => {
    debugLog('🎤 Creating teacher local tracks...');

    try {
      // Create audio track
      debugLog('Creating audio track...');
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        encoderConfig: {
          sampleRate: 48000,
          stereo: true,
        }
      }).catch(error => {
        debugError('Audio track creation failed:', error);
        throw new Error('MICROPHONE_PERMISSION_DENIED');
      });

      localTracksRef.current.audio = audioTrack;
      debugLog(`✅ Audio track created - initially ENABLED for publishing`);

      // Create video track with fallback strategy
      debugLog('Creating video track...');
      let videoTrack;

      try {
        videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrateMin: 1000,
            bitrateMax: 2000,
          },
          optimizationMode: 'detail',
        });
        debugLog('✅ HD video track created');
      } catch (hdError) {
        debugError('HD camera failed, trying standard:', hdError);

        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 24,
            }
          });
          debugLog('✅ Standard video track created');
        } catch (fallbackError) {
          debugError('All camera attempts failed:', fallbackError);
          throw new Error('CAMERA_PERMISSION_DENIED');
        }
      }

      localTracksRef.current.video = videoTrack;
      debugLog(`✅ Video track created - initially ENABLED for publishing`);

      // Play local video
      if (localVideoRef.current && videoTrack) {
        debugLog('🎥 Playing local video...');
        localVideoRef.current.innerHTML = '';

        try {
          await videoTrack.play(localVideoRef.current, {
            mirror: true,
            fit: 'cover'
          });

          debugLog('✅ Local video play() called');

          const handleVideoReady = () => {
            if (isMountedRef.current) {
              setLocalVideoReady(true);
              debugLog('✅ Local video ready and playing');
            }
          };

          if (videoTrack.isPlaying) {
            handleVideoReady();
          } else {
            videoTrack.once('first-frame-decoded', handleVideoReady);

            setTimeout(() => {
              if (!localVideoReady && isMountedRef.current) {
                debugLog('⚠️ Timeout - setting ready anyway');
                setLocalVideoReady(true);
              }
            }, 3000);
          }
        } catch (playError) {
          debugError('Error playing local video:', playError);
          setLocalVideoReady(true);
        }
      } else {
        debugError('Cannot play local video: missing ref or track', {
          hasRef: !!localVideoRef.current,
          hasTrack: !!videoTrack
        });
      }

      debugLog('✅ Teacher local tracks created successfully');
      return { audio: audioTrack, video: videoTrack };

    } catch (error) {
      debugError('Teacher track creation failed:', error);

      if (error.message === 'MICROPHONE_PERMISSION_DENIED') {
        setError('Microphone permission required. Please allow microphone access.');
      } else if (error.message === 'CAMERA_PERMISSION_DENIED') {
        setError('Camera permission required. Please allow camera access.');
      } else {
        setError(error.message || 'Failed to access camera and microphone. Please check permissions.');
      }

      throw error;
    }
  }, [debugLog, debugError, localVideoReady]);

  // ============================================================================
  // PARTICIPANT MANAGEMENT
  // ============================================================================
  const updateParticipants = useCallback((users) => {
    debugLog(`👥 Updating teacher participants: ${users.length} users`);
    setParticipants(users.map(user => ({
      uid: user.uid,
      hasVideo: user.hasVideo || false,
      hasAudio: user.hasAudio || false,
      isLocal: false,
      isSpeaking: user.isSpeaking || false
    })));
  }, [debugLog]);

  // ============================================================================
  // REMOTE USER HANDLING
  // ============================================================================
  const setupRemoteUserHandling = useCallback((client) => {
    debugLog('📡 Setting up teacher remote user handlers');
    const remoteUsers = remoteUsersMapRef.current;

    client.on('user-published', async (user, mediaType) => {
      debugLog(`🔔 Student ${user.uid} published ${mediaType}`);

      try {
        await client.subscribe(user, mediaType);
        debugLog(`✅ Teacher subscribed to student ${user.uid} ${mediaType}`);

        if (!remoteUsers.has(user.uid)) {
          remoteUsers.set(user.uid, {
            uid: user.uid,
            hasVideo: false,
            hasAudio: false,
            isSpeaking: false
          });
        }

        const userData = remoteUsers.get(user.uid);

        if (mediaType === 'video') {
          userData.hasVideo = true;
          userData.videoTrack = user.videoTrack;
          await setupRemoteVideo(user);
        } else if (mediaType === 'audio') {
          userData.hasAudio = true;
          userData.audioTrack = user.audioTrack;
          if (user.audioTrack) {
            user.audioTrack.play().catch(e => debugError(`Audio play error:`, e));
          }
        }

        updateParticipants(Array.from(remoteUsers.values()));

      } catch (error) {
        debugError(`Teacher subscribe error for student ${user.uid}:`, error);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      debugLog(`🔕 Student ${user.uid} unpublished ${mediaType}`);

      if (mediaType === 'video') {
        removeRemoteVideo(user.uid);
        if (remoteUsers.has(user.uid)) {
          remoteUsers.get(user.uid).hasVideo = false;
        }
      } else if (mediaType === 'audio') {
        if (remoteUsers.has(user.uid)) {
          remoteUsers.get(user.uid).hasAudio = false;
        }
      }

      updateParticipants(Array.from(remoteUsers.values()));
    });

    client.on('user-left', (user) => {
      debugLog(`👋 Student ${user.uid} left`);
      remoteUsers.delete(user.uid);
      removeRemoteVideo(user.uid);
      updateParticipants(Array.from(remoteUsers.values()));
      if (pinnedUser === user.uid) {
        setPinnedUser(null);
      }
    });

    client.on('volume-indicator', (indicators) => {
      let hasActiveSpeaker = false;
      indicators.forEach(indicator => {
        if (remoteUsers.has(indicator.uid)) {
          const userData = remoteUsers.get(indicator.uid);
          const isSpeaking = indicator.volume > 20;
          userData.isSpeaking = isSpeaking;

          if (isSpeaking && !hasActiveSpeaker) {
            setActiveSpeaker(indicator.uid);
            hasActiveSpeaker = true;
          }
        }
      });
      if (!hasActiveSpeaker) {
        setActiveSpeaker(null);
      }
      updateParticipants(Array.from(remoteUsers.values()));
    });

    client.on('network-quality', (quality) => {
      setNetworkQuality({
        upload: quality.uplinkNetworkQuality,
        download: quality.downlinkNetworkQuality
      });
    });

    client.on('exception', (event) => {
      debugError('Agora exception:', event);
    });

    debugLog('✅ Teacher remote user handlers configured');
  }, [debugLog, debugError, setupRemoteVideo, removeRemoteVideo, updateParticipants, pinnedUser]);

  // ============================================================================
  // JOIN CHANNEL
  // ============================================================================
  const joinChannel = useCallback(async () => {
    if (!channel || !appId) {
      debugLog('⚠️ Teacher cannot join: missing channel or appId');
      return;
    }

    if (isConnecting || isConnected || agoraClientRef.current) {
      debugLog('⚠️ Teacher already connecting, connected, or client exists');
      return;
    }

    setIsConnecting(true);
    setError('');
    debugLog('🚀 Teacher starting to join channel...');

    try {
      debugLog('🔑 Teacher credentials:', {
        appId: appId?.substring(0, 8) + '...',
        channel: channel,
        hasToken: !!token,
        uid: uid
      });

      if (!appId || appId.includes('undefined') || !channel) {
        throw new Error('Invalid teacher credentials: missing appId or channel');
      }

      debugLog('🔧 Creating Agora client...');
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8',
      });
      agoraClientRef.current = client;

      debugLog('🎥 Creating local tracks...');
      await createLocalTracks();

      await new Promise(resolve => setTimeout(resolve, 300));

      debugLog('🔗 Teacher joining Agora channel...');
      const joinPromise = client.join(appId, channel, token || null, uid || null);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Join timeout after 15 seconds')), 15000)
      );

      const actualUid = await Promise.race([joinPromise, timeoutPromise]);
      debugLog(`✅ Teacher joined channel with UID: ${actualUid}`);

      const tracksToPublish = [];
      if (localTracksRef.current.audio) {
        tracksToPublish.push(localTracksRef.current.audio);
      }
      if (localTracksRef.current.video) {
        tracksToPublish.push(localTracksRef.current.video);
      }

      if (tracksToPublish.length > 0) {
        debugLog(`📤 Teacher publishing ${tracksToPublish.length} tracks...`);
        await client.publish(tracksToPublish);
        debugLog('✅ Teacher tracks published');
      }

      if (localTracksRef.current.audio) {
        await localTracksRef.current.audio.setEnabled(!isAudioMuted);
        debugLog(`🎤 Teacher audio ${isAudioMuted ? 'MUTED' : 'UNMUTED'} after publishing`);
      }
      if (localTracksRef.current.video) {
        await localTracksRef.current.video.setEnabled(!isVideoOff);
        debugLog(`📹 Teacher video ${isVideoOff ? 'OFF' : 'ON'} after publishing`);
      }

      setupRemoteUserHandling(client);

      setIsConnected(true);
      setIsConnecting(false);

      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      debugLog('🎉 Teacher successfully joined and ready!');

    } catch (error) {
      debugError('❌ Teacher join channel failed:', error);

      let userMessage = 'Failed to join video session. ';
      
      if (error.message.includes('TRACK_IS_DISABLED')) {
        userMessage += 'Media tracks failed to initialize. Please refresh and try again.';
      } else if (error.message.includes('UID_CONFLICT')) {
        userMessage += 'Already connected from another device/tab. Please close other sessions.';
      } else if (error.message.includes('permission') || error.message.includes('PERMISSION')) {
        userMessage += 'Camera/microphone permission denied. Please check browser settings.';
      } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        userMessage += 'Connection timeout. Please check your internet connection.';
      } else if (error.message.includes('INVALID_APP_ID')) {
        userMessage += 'Invalid App ID configuration.';
      } else {
        userMessage += error.message || 'Please try again.';
      }

      setError(userMessage);
      setIsConnecting(false);
      await performCompleteCleanup();
    }
  }, [
    channel,
    appId,
    token,
    uid,
    isConnecting,
    isConnected,
    isAudioMuted,
    isVideoOff,
    createLocalTracks,
    setupRemoteUserHandling,
    performCompleteCleanup,
    debugLog,
    debugError
  ]);

  // ============================================================================
  // CONTROLS
  // ============================================================================
  const toggleAudio = useCallback(async () => {
    if (!isTrackReady(localTracksRef.current.audio)) {
      debugError('Toggle audio failed: Audio track not ready');
      setError('Audio system not ready. Please wait...');
      return;
    }

    try {
      const newMutedState = !isAudioMuted;
      setIsAudioMuted(newMutedState);
      await localTracksRef.current.audio.setEnabled(!newMutedState);
      debugLog(`🎤 Teacher audio ${newMutedState ? 'MUTED' : 'UNMUTED'}`);
    } catch (error) {
      setIsAudioMuted(!isAudioMuted);
      debugError('Toggle audio failed:', error);
      setError('Failed to toggle microphone');
    }
  }, [isAudioMuted, debugLog, debugError, isTrackReady]);

  const toggleVideo = useCallback(async () => {
    if (!isTrackReady(localTracksRef.current.video)) {
      debugError('Toggle video failed: Video track not ready');
      setError('Video system not ready. Please wait...');
      return;
    }

    try {
      const newVideoOffState = !isVideoOff;
      setIsVideoOff(newVideoOffState);
      await localTracksRef.current.video.setEnabled(!newVideoOffState);
      debugLog(`📹 Teacher video ${newVideoOffState ? 'OFF' : 'ON'}`);
    } catch (error) {
      setIsVideoOff(!isVideoOff);
      debugError('Toggle video failed:', error);
      setError('Failed to toggle camera');
    }
  }, [isVideoOff, debugLog, debugError, isTrackReady]);

  const toggleScreenShare = useCallback(async () => {
    if (!agoraClientRef.current) return;

    try {
      if (!localTracksRef.current.screen) {
        debugLog('🖥️ Starting screen share...');
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 15,
            bitrate: 1500
          },
          optimizationMode: 'detail'
        }, 'auto');

        if (localTracksRef.current.video) {
          await agoraClientRef.current.unpublish(localTracksRef.current.video);
        }

        await agoraClientRef.current.publish(screenTrack);

        screenTrack.on('track-ended', () => {
          debugLog('🖥️ Screen share ended by browser');
          toggleScreenShare();
        });

        localTracksRef.current.screen = screenTrack;
        setIsScreenSharing(true);
        debugLog('✅ Screen sharing started');

      } else {
        debugLog('🖥️ Stopping screen share...');

        if (localTracksRef.current.screen) {
          await agoraClientRef.current.unpublish(localTracksRef.current.screen);
          localTracksRef.current.screen.close();
          localTracksRef.current.screen = null;
        }

        if (localTracksRef.current.video) {
          await agoraClientRef.current.publish(localTracksRef.current.video);
        }

        setIsScreenSharing(false);
        debugLog('✅ Screen sharing stopped');
      }
    } catch (error) {
      debugError('Teacher screen share error:', error);
      if (error.message?.includes('Permission denied')) {
        setError('Please grant screen sharing permissions to share your screen.');
      } else {
        setError('Failed to start screen sharing');
      }
    }
  }, [debugLog, debugError]);

  const leaveCall = useCallback(async () => {
    if (window.confirm('Are you sure you want to end the class session for all students?')) {
      debugLog('📞 Teacher leaving call...');
      await performCompleteCleanup();
      onClose();
    }
  }, [performCompleteCleanup, onClose, debugLog]);

  const copySessionLink = useCallback(() => {
    if (channel) {
      const link = `${window.location.origin}/join/${channel}`;
      navigator.clipboard.writeText(link);

      const button = document.querySelector('[title="Copy Session Link"]');
      if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<span class="text-green-400">✓ Copied!</span>';
        setTimeout(() => {
          button.innerHTML = originalHTML;
        }, 2000);
      }

      debugLog('📋 Session link copied to clipboard');
    }
  }, [channel, debugLog]);

  // ============================================================================
  // DRAG FUNCTIONALITY
  // ============================================================================
  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    dragStartPos.current = {
      x: clientX - dragPosition.x,
      y: clientY - dragPosition.y
    };
  }, [dragPosition]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;

    e.preventDefault();
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragStartPos.current.x;
    const newY = clientY - dragStartPos.current.y;

    setDragPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const container = videoContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const parentWidth = window.innerWidth;
    const parentHeight = window.innerHeight;

    let finalX = dragPosition.x;
    let finalY = dragPosition.y;

    const margin = 16;
    if (finalX < parentWidth / 2) {
      finalX = margin;
    } else {
      finalX = parentWidth - rect.width - margin;
    }

    finalY = Math.max(80, Math.min(finalY, parentHeight - rect.height - 100));

    setDragPosition({ x: finalX, y: finalY });
  }, [isDragging, dragPosition]);

  // ============================================================================
  // EFFECTS
  // ============================================================================
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
    if (channel && appId) {
      debugLog('🔔 Teacher credentials available, scheduling join...');
      joinAttemptRef.current = setTimeout(() => {
        joinChannel();
      }, 100);

      return () => {
        if (joinAttemptRef.current) {
          clearTimeout(joinAttemptRef.current);
        }
      };
    }
  }, [channel, appId, joinChannel, debugLog]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ============================================================================
  // RENDER
  // ============================================================================
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getNetworkQualityIcon = (quality) => {
    if (quality >= 0 && quality <= 2) return <Wifi className="w-4 h-4 text-green-400" />;
    if (quality <= 4) return <Wifi className="w-4 h-4 text-yellow-400" />;
    return <WifiOff className="w-4 h-4 text-red-400" />;
  };

  const totalParticipants = participants.length + 1;

  if (!channel || !appId) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Initializing Video Call...</h3>
          <p className="text-gray-400">Setting up your classroom session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-900/90 to-blue-900/90 backdrop-blur-sm text-white p-4 border-b border-cyan-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' :
            isConnecting ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`} />
          <div className="flex items-center gap-2">
            <Crown className="text-yellow-400" size={20} />
            <div>
              <h2 className="text-lg font-bold truncate max-w-[200px] lg:max-w-md">
                {classData?.className || classData?.title || 'Teacher Session'}
              </h2>
              <div className="flex items-center gap-2 text-sm text-cyan-200">
                <span>👨‍🏫 You (Teacher)</span>
                <span>•</span>
                <span>{formatTime(callDuration)}</span>
                {isConnected && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      {getNetworkQualityIcon(networkQuality.upload)}
                      <span className="text-xs">
                        {networkQuality.upload <= 2 ? 'Good' : networkQuality.upload <= 4 ? 'Fair' : 'Poor'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={copySessionLink}
            className="p-2 text-cyan-200 hover:text-white hover:bg-cyan-500/20 transition-all rounded-lg"
            title="Copy Session Link"
          >
            <Share2 size={20} />
          </button>

          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="p-2 text-cyan-200 hover:text-white hover:bg-cyan-500/20 transition-all rounded-lg relative"
            title="Participants"
          >
            <Users size={20} />
            {participants.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                {participants.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 text-sm text-cyan-200">
            <Users size={16} />
            <span>{totalParticipants}</span>
          </div>

          <button
            onClick={leaveCall}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 active:scale-95"
          >
            <PhoneOff size={18} />
            <span className="hidden sm:inline">End Class</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-600/90 backdrop-blur-sm text-white p-4 mx-4 mt-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1 rounded-full">
              <AlertCircle size={16} />
            </div>
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="text-white hover:text-red-200 text-xl font-bold ml-2 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        <div className="flex-1 relative p-4">
          {/* Remote Videos Grid */}
          <div
            ref={remoteVideosContainerRef}
            className="w-full h-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {participants.length === 0 && isConnected && (
              <div className="col-span-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Users size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Waiting for students to join...</p>
                  <p className="text-sm text-gray-500 mt-1">Students will appear here when they join</p>
                </div>
              </div>
            )}
          </div>

          {/* Teacher Local Video - Draggable Picture in Picture */}
          <div
            ref={videoContainerRef}
            className={`absolute w-64 h-48 lg:w-80 lg:h-60 bg-black rounded-xl overflow-hidden shadow-2xl border-2 ${
              isDragging ? 'border-yellow-400' : 'border-yellow-500'
            } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} transition-all duration-300`}
            style={{
              left: dragPosition.x,
              top: dragPosition.y,
              bottom: 'auto',
              right: 'auto',
              transition: isDragging ? 'none' : 'all 0.3s ease',
              zIndex: 40,
            }}
          >
            {/* Drag Handle */}
            <div
              className="absolute top-2 left-2 bg-black/70 p-2 rounded cursor-grab active:cursor-grabbing hover:bg-black/90 transition-colors z-10"
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <Move size={16} className="text-white" />
            </div>

            <div ref={localVideoRef} className="w-full h-full bg-gray-800" />

            {/* Loading State */}
            {!localVideoReady && !isVideoOff && isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-white text-xs">Starting camera...</p>
                </div>
              </div>
            )}

            {/* Video Off State */}
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <VideoOff className="text-gray-500 w-12 h-12" />
              </div>
            )}

            {/* Teacher Label */}
            <div className="absolute bottom-2 left-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              <Crown size={12} />
              <span>You (Teacher)</span>
            </div>

            {/* Status Indicators */}
            <div className="absolute top-2 right-2 flex gap-1">
              {isAudioMuted && (
                <div className="bg-red-500 p-1 rounded">
                  <MicOff size={12} className="text-white" />
                </div>
              )}
              {isVideoOff && (
                <div className="bg-red-500 p-1 rounded">
                  <VideoOff size={12} className="text-white" />
                </div>
              )}
              {isScreenSharing && (
                <div className="bg-green-500 p-1 rounded">
                  <Monitor size={12} className="text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Connection Status Overlay */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">Starting Class Session...</h3>
                <p className="text-gray-300">Setting up your camera and microphone</p>
              </div>
            </div>
          )}
        </div>

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="w-80 bg-gray-800/90 backdrop-blur-sm border-l border-cyan-700 p-4 overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Users className="mr-2" size={20} />
              Class Participants ({totalParticipants})
            </h3>

            {/* Teacher Card */}
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center">
                    <Crown size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">You (Teacher)</p>
                    <p className="text-yellow-300 text-xs">Host</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!isVideoOff ? (
                    <Video size={16} className="text-green-400" />
                  ) : (
                    <VideoOff size={16} className="text-red-400" />
                  )}
                  {!isAudioMuted ? (
                    <Mic size={16} className="text-green-400" />
                  ) : (
                    <MicOff size={16} className="text-red-400" />
                  )}
                  {isScreenSharing && (
                    <Monitor size={16} className="text-green-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Students List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-cyan-300 mb-2">Students ({participants.length})</h4>
              {participants.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No students joined yet</p>
                </div>
              ) : (
                participants.map(student => (
                  <div
                    key={student.uid}
                    className={`p-3 rounded-lg border transition-all ${
                      student.uid === activeSpeaker
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'bg-gray-700/50 border-gray-600/30'
                    } ${pinnedUser === student.uid ? 'ring-2 ring-yellow-400' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                          <User size={16} className="text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">Student {student.uid}</p>
                          <p className="text-cyan-300 text-xs">
                            {student.isSpeaking ? 'Speaking' : student.hasVideo ? 'Video On' : 'Joined'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {student.hasVideo && <Video size={14} className="text-green-400" />}
                        {student.hasAudio ? (
                          <Mic size={14} className="text-green-400" />
                        ) : (
                          <MicOff size={14} className="text-red-400" />
                        )}
                        {student.isSpeaking && (
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        )}
                        <button
                          onClick={() => setPinnedUser(pinnedUser === student.uid ? null : student.uid)}
                          className="p-1 rounded hover:bg-gray-600 transition-colors"
                          title={pinnedUser === student.uid ? 'Unpin' : 'Pin student'}
                        >
                          <svg className={`w-4 h-4 ${pinnedUser === student.uid ? 'text-yellow-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-6">
        <div className="flex items-center justify-center gap-4 lg:gap-6">
          {/* Audio Control */}
          <button
            onClick={toggleAudio}
            disabled={!isConnected}
            className={`
              relative p-4 rounded-2xl transition-all duration-200 transform hover:scale-110 active:scale-95
              shadow-lg border-2 disabled:opacity-50 disabled:cursor-not-allowed
              ${isAudioMuted
                ? 'bg-red-500 hover:bg-red-600 border-red-400 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400 text-white'
              }
            `}
            title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Video Control */}
          <button
            onClick={toggleVideo}
            disabled={!isConnected}
            className={`
              relative p-4 rounded-2xl transition-all duration-200 transform hover:scale-110 active:scale-95
              shadow-lg border-2 disabled:opacity-50 disabled:cursor-not-allowed
              ${isVideoOff
                ? 'bg-red-500 hover:bg-red-600 border-red-400 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400 text-white'
              }
            `}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            disabled={!isConnected}
            className={`
              relative p-4 rounded-2xl transition-all duration-200 transform hover:scale-110 active:scale-95
              shadow-lg border-2 disabled:opacity-50 disabled:cursor-not-allowed
              ${isScreenSharing
                ? 'bg-green-500 hover:bg-green-600 border-green-400 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400 text-white'
              }
            `}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <Monitor size={24} />
          </button>

          {/* End Call */}
          <button
            onClick={leaveCall}
            className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg border-2 border-red-400 font-semibold"
            title="End class for all students"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherVideoCall;
