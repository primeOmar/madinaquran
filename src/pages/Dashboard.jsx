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
  ChevronDown,Move,
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
  Phone,
  Crown,
  Zap,
  Rocket,
  Sparkles,
  Target,
  Star,
  Gem,
  Hand,
  Maximize2,
  Minimize2,Wifi, WifiOff,  MoreVertical,
  ScreenShare,
  Monitor
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

// ============================================================================
// STUDENT VIDEO CALL COMPONENT
// ============================================================================
const StudentVideoCall = ({ classItem, isOpen, onClose }) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false); // Changed to false - start with video ON
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [networkQuality, setNetworkQuality] = useState({ upload: 0, download: 0 });
  const [participants, setParticipants] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [localVideoReady, setLocalVideoReady] = useState(false);
  
  // Draggable video state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  
  // ============================================================================
  // REFS
  // ============================================================================
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const agoraClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const joinAttemptRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const videoContainerRef = useRef(null);
  
  // ============================================================================
  // LOGGING
  // ============================================================================
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 📹 VideoCall: ${message}`, data || '');
  }, []);
  
  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ VideoCall Error: ${message}`, error);
  }, []);
  
  // ============================================================================
  // CLEANUP
  // ============================================================================
  const performCompleteCleanup = useCallback(async () => {
    debugLog('🧹 Starting cleanup...');
    
    try {
      if (joinAttemptRef.current) {
        clearTimeout(joinAttemptRef.current);
        joinAttemptRef.current = null;
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      const cleanupTrack = async (track, type) => {
        if (track) {
          try {
            track.stop();
            track.close();
            debugLog(`✅ ${type} track cleaned up`);
          } catch (e) {
            debugError(`Error cleaning up ${type} track:`, e);
          }
        }
      };
      
      await Promise.all([
        cleanupTrack(localTracksRef.current.audio, 'audio'),
                        cleanupTrack(localTracksRef.current.video, 'video')
      ]);
      
      localTracksRef.current.audio = null;
      localTracksRef.current.video = null;
      
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
        localVideoRef.current.innerHTML = '';
      }
      if (remoteVideosContainerRef.current) {
        remoteVideosContainerRef.current.innerHTML = '';
      }
      
      if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        setCallDuration(0);
        setError('');
        setParticipants([]);
        setActiveSpeaker(null);
        setLocalVideoReady(false);
      }
      
      debugLog('✅ Cleanup complete');
    } catch (error) {
      debugError('Cleanup error:', error);
    }
  }, [debugLog, debugError]);
  
  // ============================================================================
  // REMOTE VIDEO MANAGEMENT
  // ============================================================================
  const setupRemoteVideo = useCallback(async (user) => {
    debugLog(`📺 Setting up remote video for user ${user.uid}`);
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
    videoElement.className = 'remote-video-item';
  videoElement.innerHTML = `
  <div class="absolute inset-0 bg-gray-800 flex items-center justify-center">
  <div class="text-center text-gray-400">
  <div class="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
  <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
  </div>
  <p class="text-sm">Loading video...</p>
  </div>
  </div>
  `;
  
  container.appendChild(videoElement);
  
  try {
    if (user.videoTrack) {
      videoElement.innerHTML = '';
      await user.videoTrack.play(videoElement);
      debugLog(`✅ Remote video playing for user ${user.uid}`);
      
      const overlay = document.createElement('div');
      overlay.className = 'absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs';
      overlay.textContent = `User ${user.uid}`;
      videoElement.appendChild(overlay);
    }
  } catch (error) {
    debugError(`Remote video play error for user ${user.uid}:`, error);
    videoElement.innerHTML = `
    <div class="absolute inset-0 bg-gray-800 flex items-center justify-center">
    <div class="text-center text-gray-400">
    <div class="w-12 h-12 mx-auto mb-2">
    <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
    </div>
    <p class="text-sm">Video unavailable</p>
    </div>
    </div>
    `;
  }
  }, [debugLog, debugError]);
  
  const removeRemoteVideo = useCallback((uid) => {
    debugLog(`🗑️ Removing remote video for user ${uid}`);
    const videoElement = document.getElementById(`remote-video-${uid}`);
    if (videoElement) {
      videoElement.remove();
    }
  }, [debugLog]);
  
  // ============================================================================
  // TRACK MANAGEMENT - FIXED LOCAL VIDEO
  // ============================================================================
  const createLocalTracks = useCallback(async () => {
    debugLog('🎤 Creating local tracks...');
    
    try {
      // Create audio track
      debugLog('Creating audio track...');
      const audioTrack = await window.AgoraRTC.createMicrophoneAudioTrack({
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
      debugLog('✅ Audio track created');
      
      // Create video track
      debugLog('Creating video track...');
      const videoTrack = await window.AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 640,
          height: 480,
          frameRate: 24,
          bitrateMin: 600,
          bitrateMax: 1000,
        },
        optimizationMode: 'motion',
      }).catch(async (error) => {
        debugError('Camera creation failed, trying basic settings:', error);
        return window.AgoraRTC.createCameraVideoTrack().catch(fallbackError => {
          debugError('All camera attempts failed:', fallbackError);
          throw new Error('CAMERA_PERMISSION_DENIED');
        });
      });
      
      localTracksRef.current.video = videoTrack;
      debugLog('✅ Video track created', { trackId: videoTrack.getTrackId() });
      
      // CRITICAL: Play local video immediately with proper error handling
      if (localVideoRef.current && videoTrack) {
        debugLog('🎥 Attempting to play local video...');
        
        // Clear any existing content
        localVideoRef.current.innerHTML = '';
  
  try {
    // Play the video track with mirror effect
    await videoTrack.play(localVideoRef.current, {
      mirror: true,
      fit: 'cover'
    });
    
    debugLog('✅ Local video play() called successfully');
    
    // Set ready state immediately if already playing
    if (videoTrack.isPlaying) {
      debugLog('✅ Video track is already playing');
      setLocalVideoReady(true);
    } else {
      // Otherwise wait for first frame
      debugLog('⏳ Waiting for first frame...');
      const handleFirstFrame = () => {
        debugLog('✅ First frame decoded - local video ready');
        setLocalVideoReady(true);
        videoTrack.off('first-frame-decoded', handleFirstFrame);
      };
      videoTrack.on('first-frame-decoded', handleFirstFrame);
      
      // Fallback timeout
      setTimeout(() => {
        if (!localVideoReady) {
          debugLog('⚠️ Timeout waiting for first frame, setting ready anyway');
          setLocalVideoReady(true);
        }
      }, 2000);
    }
  } catch (playError) {
    debugError('Error playing local video:', playError);
    // Still set ready to remove loading state
    setLocalVideoReady(true);
  }
      } else {
        debugError('Cannot play local video: missing ref or track', {
          hasRef: !!localVideoRef.current,
          hasTrack: !!videoTrack
        });
      }
      
      debugLog('✅ Local tracks created successfully');
      return { audio: audioTrack, video: videoTrack };
      
    } catch (error) {
      debugError('Track creation failed:', error);
      
      if (error.message === 'MICROPHONE_PERMISSION_DENIED') {
        setError('Microphone permission required. Please allow microphone access.');
      } else if (error.message === 'CAMERA_PERMISSION_DENIED') {
        setError('Camera permission required. Please allow camera access.');
      } else {
        setError('Failed to access camera and microphone. Please check permissions.');
      }
      
      throw error;
    }
  }, [debugLog, debugError, localVideoReady]);
  
  // ============================================================================
  // PARTICIPANT MANAGEMENT
  // ============================================================================
  const updateParticipants = useCallback((users) => {
    debugLog(`👥 Updating participants: ${users.length} users`);
    setParticipants(users.map(user => ({
      uid: user.uid,
      hasVideo: user.hasVideo || false,
      hasAudio: user.hasAudio || false,
      isLocal: false
    })));
  }, [debugLog]);
  
  // ============================================================================
  // REMOTE USER HANDLING
  // ============================================================================
  const setupRemoteUserHandling = useCallback((client) => {
    debugLog('📡 Setting up remote user handlers');
    const remoteUsers = new Map();
    
    client.on('user-published', async (user, mediaType) => {
      debugLog(`🔔 User ${user.uid} published ${mediaType}`);
      
      try {
        await client.subscribe(user, mediaType);
        debugLog(`✅ Subscribed to user ${user.uid} ${mediaType}`);
        
        if (!remoteUsers.has(user.uid)) {
          remoteUsers.set(user.uid, { uid: user.uid, hasVideo: false, hasAudio: false });
        }
        
        if (mediaType === 'video') {
          remoteUsers.get(user.uid).hasVideo = true;
          await setupRemoteVideo(user);
        } else if (mediaType === 'audio') {
          remoteUsers.get(user.uid).hasAudio = true;
          user.audioTrack.play();
          debugLog(`🔊 Playing audio from user ${user.uid}`);
        }
        
        updateParticipants(Array.from(remoteUsers.values()));
        
      } catch (error) {
        debugError(`Subscribe error for user ${user.uid}:`, error);
      }
    });
    
    client.on('user-unpublished', (user, mediaType) => {
      debugLog(`🔕 User ${user.uid} unpublished ${mediaType}`);
      
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
      debugLog(`👋 User ${user.uid} left`);
      remoteUsers.delete(user.uid);
      removeRemoteVideo(user.uid);
      updateParticipants(Array.from(remoteUsers.values()));
    });
    
    client.on('volume-indicator', (indicators) => {
      const speaker = indicators.find(ind => ind.volume > 50);
      if (speaker) {
        setActiveSpeaker(speaker.uid);
      }
    });
    
    debugLog('✅ Remote user handlers configured');
  }, [debugLog, debugError, setupRemoteVideo, removeRemoteVideo, updateParticipants]);
  
  // ============================================================================
  // JOIN CHANNEL
  // ============================================================================
  const joinChannel = useCallback(async () => {
    if (!isOpen || !classItem?.video_session?.meeting_id) {
      debugLog('⚠️ Cannot join: missing meeting ID or not open');
      return;
    }
    
    if (isConnecting || isConnected) {
      debugLog('⚠️ Already connecting or connected');
      return;
    }
    
    setIsConnecting(true);
    setError('');
    debugLog('🚀 Starting to join channel...');
    
    try {
      const meetingId = classItem.video_session.meeting_id;
      debugLog(`📞 Meeting ID: ${meetingId}`);
      
      // Check if AgoraRTC is available
      if (typeof window.AgoraRTC === 'undefined') {
        throw new Error('Agora SDK not loaded. Please refresh the page.');
      }
      
      // Get join credentials (mock for demo)
      debugLog('🔑 Getting join credentials...');
      const joinResult = {
        success: true,
        appId: 'demo-app-id',
        channel: `class-${meetingId}`,
        token: null,
        uid: Math.floor(Math.random() * 100000)
      };
      
      debugLog('✅ Got join credentials', {
        appId: joinResult.appId?.substring(0, 8) + '...',
               channel: joinResult.channel,
               hasToken: !!joinResult.token
      });
      
      // Create Agora client
      debugLog('🔧 Creating Agora client...');
      const client = window.AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8',
      });
      agoraClientRef.current = client;
      
      // Setup network monitoring
      client.on('network-quality', (quality) => {
        setNetworkQuality({
          upload: quality.uplinkNetworkQuality,
          download: quality.downlinkNetworkQuality
        });
      });
      
      // Setup error handling
      client.on('exception', (event) => {
        debugError('Agora exception:', event);
      });
      
      // Create local tracks FIRST
      debugLog('🎥 Creating local tracks...');
      await createLocalTracks();
      
      // Small delay to ensure tracks are ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Join channel
      debugLog('🔗 Joining Agora channel...');
      const uid = await client.join(
        joinResult.appId,
        joinResult.channel,
        joinResult.token || null,
        joinResult.uid || null
      );
      
      debugLog(`✅ Joined channel with UID: ${uid}`);
      
      // Publish tracks
      const tracksToPublish = [];
      if (localTracksRef.current.audio) {
        tracksToPublish.push(localTracksRef.current.audio);
      }
      if (localTracksRef.current.video) {
        tracksToPublish.push(localTracksRef.current.video);
      }
      
      if (tracksToPublish.length > 0) {
        debugLog(`📤 Publishing ${tracksToPublish.length} tracks...`);
        await client.publish(tracksToPublish);
        debugLog('✅ Tracks published');
      }
      
      // Set track states based on initial mute settings
      if (localTracksRef.current.audio) {
        await localTracksRef.current.audio.setEnabled(!isAudioMuted);
        debugLog(`🎤 Audio enabled: ${!isAudioMuted}`);
      }
      if (localTracksRef.current.video) {
        await localTracksRef.current.video.setEnabled(!isVideoOff);
        debugLog(`📹 Video enabled: ${!isVideoOff}`);
      }
      
      // Setup remote user handling
      setupRemoteUserHandling(client);
      
      // Update connection state
      setIsConnected(true);
      setIsConnecting(false);
      
      // Start call timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
      debugLog('🎉 Successfully joined and ready!');
      
    } catch (error) {
      debugError('❌ Join channel failed:', error);
      
      if (error.message.includes('permission') || error.message.includes('PERMISSION')) {
        setError('Camera/microphone permission denied. Please check browser settings.');
      } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        setError('Connection timeout. Please check your internet connection.');
      } else {
        setError(error.message || 'Failed to join video session');
      }
      
      setIsConnecting(false);
      await performCompleteCleanup();
    }
  }, [
    isOpen,
    classItem,
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
    if (!localTracksRef.current.audio) {
      debugError('Toggle audio failed: No audio track available');
      return;
    }
    
    try {
      const newMutedState = !isAudioMuted;
      await localTracksRef.current.audio.setEnabled(!newMutedState);
      setIsAudioMuted(newMutedState);
      debugLog(`🎤 Audio ${newMutedState ? 'MUTED' : 'UNMUTED'}`);
    } catch (error) {
      debugError('Toggle audio failed:', error);
      setError('Failed to toggle microphone');
    }
  }, [isAudioMuted, debugLog, debugError]);
  
  const toggleVideo = useCallback(async () => {
    if (!localTracksRef.current.video) {
      debugError('Toggle video failed: No video track available');
      return;
    }
    
    try {
      const newVideoOffState = !isVideoOff;
      await localTracksRef.current.video.setEnabled(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
      debugLog(`📹 Video ${newVideoOffState ? 'OFF' : 'ON'}`);
    } catch (error) {
      debugError('Toggle video failed:', error);
      setError('Failed to toggle camera');
    }
  }, [isVideoOff, debugLog, debugError]);
  
  const leaveCall = useCallback(async () => {
    debugLog('📞 Leaving call...');
    await performCompleteCleanup();
    onClose();
  }, [performCompleteCleanup, onClose, debugLog]);
  
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
    
    if (finalX < parentWidth / 2) {
      finalX = 16;
    } else {
      finalX = parentWidth - rect.width - 16;
    }
    
    finalY = Math.max(80, Math.min(finalY, parentHeight - rect.height - 100));
    
    setDragPosition({ x: finalX, y: finalY });
  }, [isDragging, dragPosition]);
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    isMountedRef.current = true;
    debugLog('🎬 Component mounted');
    
    return () => {
      debugLog('🎬 Component unmounting');
      isMountedRef.current = false;
      performCompleteCleanup();
    };
  }, [performCompleteCleanup, debugLog]);
  
  useEffect(() => {
    if (isOpen && classItem?.video_session?.meeting_id) {
      debugLog('🔔 Dialog opened, scheduling join...');
      joinAttemptRef.current = setTimeout(() => {
        joinChannel();
      }, 100);
      
      return () => {
        if (joinAttemptRef.current) {
          clearTimeout(joinAttemptRef.current);
        }
      };
    }
  }, [isOpen, classItem, joinChannel, debugLog]);
  
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
  if (!isOpen) return null;
  
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
  
  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
    {/* Header */}
    <div className="bg-gray-800/90 backdrop-blur-sm text-white p-4 border-b border-gray-700 flex items-center justify-between">
    <div className="flex items-center gap-3">
    <div className={`w-3 h-3 rounded-full ${
      isConnected ? 'bg-green-500 animate-pulse' :
      isConnecting ? 'bg-yellow-500 animate-pulse' :
      'bg-red-500'
    }`} />
    <div>
    <h2 className="text-lg font-bold truncate max-w-[200px] lg:max-w-md">
    {classItem?.title || 'Class Session'}
    </h2>
    <div className="flex items-center gap-2 text-sm text-gray-300">
    <span>{classItem?.teacher_name || 'Teacher'}</span>
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
    
    <div className="flex items-center gap-4">
    <div className="flex items-center gap-2 text-sm text-gray-300">
    <Users size={16} />
    <span>{totalParticipants}</span>
    </div>
    
    <button
    onClick={leaveCall}
    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 active:scale-95"
    >
    <Phone size={18} />
    <span className="hidden sm:inline">Leave</span>
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
    
    {/* Main Video Area */}
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
      <p>Waiting for other participants...</p>
      <p className="text-sm text-gray-500 mt-1">Teacher and other students will appear here</p>
      </div>
      </div>
    )}
    </div>
    
    {/* Local Video - Draggable Picture in Picture */}
    <div
    ref={videoContainerRef}
    className={`absolute w-64 h-48 lg:w-80 lg:h-60 bg-black rounded-xl overflow-hidden shadow-2xl border-2 ${
      isDragging ? 'border-blue-400' : 'border-white/20'
    } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    style={{
      left: dragPosition.x || 'auto',
      top: dragPosition.y || 'auto',
      bottom: dragPosition.x === 0 && dragPosition.y === 0 ? '16px' : 'auto',
      right: dragPosition.x === 0 && dragPosition.y === 0 ? '16px' : 'auto',
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
    
    {/* User Label */}
    <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
    You {isConnected && '(Live)'}
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
    </div>
    </div>
    
    {/* Connection Status Overlay */}
    {isConnecting && (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
      <div className="text-center text-white">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
      <h3 className="text-lg font-semibold mb-2">Joining Class...</h3>
      <p className="text-gray-300">Setting up your camera and microphone</p>
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
        : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700'
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
          : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700'
        }
        `}
        title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
        {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>
        
        {/* Additional Controls */}
        <button
        className="p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg border-2 border-gray-500"
        title="Chat"
        >
        <MessageCircle size={24} />
        </button>
        
        <button
        className="p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg border-2 border-gray-500"
        title="Share screen"
        >
        <ScreenShare size={24} />
        </button>
        
        <button
        className="p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg border-2 border-gray-500"
        title="More options"
        >
        <MoreVertical size={24} />
        </button>
        </div>
        </div>
        
        {/* Responsive Styles */}
        <style jsx>{`
          .remote-video-item {
            position: relative;
            background: #1f2937;
            border-radius: 1rem;
            overflow: hidden;
            min-height: 200px;
          }
          
          .remote-video-item video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          @media (max-width: 768px) {
            .remote-video-item {
              min-height: 150px;
            }
          }
          
          @media (max-width: 640px) {
            .remote-video-item {
              min-height: 120px;
            }
          }
          `}</style>
          </div>
  );
};


// ============================================================================
// END OF STUDENTVIDEOCALL COMPONENT
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
