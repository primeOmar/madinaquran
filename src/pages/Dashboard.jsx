// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AgoraRTC from 'agora-rtc-sdk-ng';
import studentApi  from '../lib/studentApi';
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
  Layout,
  Award,
  RefreshCw,
  BarChart3,
  Download,
  Upload,
  Bell,
  Settings,
  LogOut,
  Menu,Hand,
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
  Gem
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { toast } from 'react-toastify';

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

      mediaRecorderRef.current.start(1000); // Collect data every second
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

// components/StudentVideoCall.jsx
const StudentVideoCall = ({ classItem, isOpen, onClose }) => {
  // State declarations
  const [localStream, setLocalStream] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('excellent');
  const [agoraClient, setAgoraClient] = useState(null);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [sessionStatus, setSessionStatus] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [layoutMode, setLayoutMode] = useState('grid');
  const [teacherUid, setTeacherUid] = useState(null);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({
    audio: null,
    video: null,
    screen: null
  });
  const joinAttemptRef = useRef(0);
  const remoteVideoElementsRef = useRef(new Map());
  const screenShareUidRef = useRef(null);
  const teacherUidRef = useRef(null);

  // Enhanced session status check
  const checkSessionStatus = async (meetingId) => {
    try {
      console.log('🔍 Checking session status for:', meetingId);
      const status = await studentApi.getSessionStatus(meetingId);
      console.log('📊 Session status response:', status);
      setSessionStatus(status);

      if (status.is_active === false) {
        throw new Error(`Session not active: ${status.error || 'No active session found'}`);
      }

      if (!status.is_teacher_joined) {
        console.log('⚠️ Teacher not joined yet, but proceeding with join...');
      }

      return status;
    } catch (error) {
      console.error('❌ Session status check failed:', error);
      throw error;
    }
  };

  // World-class video call initialization
  const initializeRealCall = async () => {
    if (joinAttemptRef.current >= 3) {
      setError('Too many connection attempts. Please refresh and try again.');
      return;
    }

    joinAttemptRef.current++;

    try {
      setIsConnecting(true);
      setError('');
      console.log(`🎯 Join attempt ${joinAttemptRef.current}:`, classItem);

      const meetingId = classItem.video_session?.meeting_id;
      if (!meetingId) {
        throw new Error('No meeting ID found for this class');
      }

      // Enhanced status check with fallback
      let statusCheck;
      try {
        statusCheck = await checkSessionStatus(meetingId);
      } catch (statusError) {
        console.warn('Status check failed, but proceeding with join attempt...', statusError);
        statusCheck = { is_active: true, is_teacher_joined: false };
      }

      // Get join credentials
      console.log('🔄 Getting join credentials...');
      const joinResult = await studentApi.joinVideoSession(meetingId);

      if (!joinResult.success) {
        throw new Error(joinResult.error || 'Failed to get join credentials');
      }

      console.log('🔑 Join credentials received:', {
        channel: joinResult.channel,
        hasToken: !!joinResult.token,
        uid: joinResult.uid,
        appId: joinResult.appId?.substring(0, 10) + '...'
      });

      // Validate credentials
      if (!joinResult.channel || !joinResult.appId) {
        throw new Error('Invalid join credentials: missing channel or appId');
      }

      // Create Agora client with optimized settings
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      setAgoraClient(client);

      // Setup enhanced event listeners
      setupAgoraEventListeners(client);

      // Join channel with timeout
      console.log('🚀 Joining Agora channel:', joinResult.channel);

      // Add join timeout
      const joinPromise = client.join(
        joinResult.appId,
        joinResult.channel,
        joinResult.token || null,
        joinResult.uid || null
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Join timeout after 15 seconds')), 15000);
      });

      const joinedUid = await Promise.race([joinPromise, timeoutPromise]);

      console.log('✅ Successfully joined channel with UID:', joinedUid);

      // Create and publish local tracks
      await createAndPublishLocalTracks(client);

      // ✅ NEW: Record initial participation after successful connection
      await recordInitialParticipation(meetingId, joinedUid);

      setIsConnected(true);
      setIsConnecting(false);
      startTimer();

      console.log('🎉 World-class video connection established');

    } catch (error) {
      console.error(`❌ Join attempt ${joinAttemptRef.current} failed:`, error);
      setError(error.message);
      setIsConnecting(false);
      setIsConnected(false);

      // Record failed participation attempt
      await recordFailedParticipation(error);

      // Smart auto-retry for network errors
      if (error.message.includes('timeout') || error.message.includes('network') || error.message.includes('JOIN')) {
        setTimeout(() => {
          if (isOpen && joinAttemptRef.current < 3) {
            console.log('🔄 Auto-retrying connection...');
            initializeRealCall();
          }
        }, 2000);
      }
    }
  };

  // ✅ NEW: Record initial participation when successfully joined
  const recordInitialParticipation = async (meetingId, agoraUid) => {
    try {
      const userId = await getCurrentUserId();

      const initialParticipationData = {
        session_id: meetingId,
        student_id: userId,
        is_teacher: false,
        joined_at: new Date().toISOString(),
        status: 'joined',
        connection_quality: 'excellent',
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          video_capable: !!navigator.mediaDevices?.getUserMedia,
          audio_capable: true,
          agora_uid: agoraUid,
          browser: getBrowserInfo(),
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          connection_type: getConnectionType()
        },
        class_id: classItem.id,
        // Additional useful fields
        participant_metadata: {
          agora_uid: agoraUid,
          channel: classItem.video_session?.meeting_id,
          join_attempt: joinAttemptRef.current
        }
      };

      console.log('📝 Recording initial participation:', initialParticipationData);

      const result = await studentApi.recordParticipation(initialParticipationData);
      console.log('✅ Initial participation recorded:', result);

      return result;
    } catch (error) {
      console.warn('⚠️ Could not record initial participation (non-critical):', error);
      // Don't throw error - participation recording shouldn't block the call
    }
  };

  // ✅ NEW: Record failed participation attempt
  const recordFailedParticipation = async (error) => {
    try {
      const userId = await getCurrentUserId();
      const meetingId = classItem.video_session?.meeting_id;

      const failedParticipationData = {
        session_id: meetingId,
        student_id: userId,
        is_teacher: false,
        joined_at: new Date().toISOString(),
        left_at: new Date().toISOString(),
        status: 'failed',
        connection_quality: 'poor',
        duration: 0,
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          error_message: error.message,
          error_type: error.name,
          join_attempt: joinAttemptRef.current
        },
        class_id: classItem.id,
        error_details: {
          message: error.message,
          code: error.code,
          join_attempt: joinAttemptRef.current,
          timestamp: new Date().toISOString()
        }
      };

      console.log('📝 Recording failed participation:', failedParticipationData);

      await studentApi.recordParticipation(failedParticipationData);
      console.log('✅ Failed participation recorded');
    } catch (recordError) {
      console.warn('⚠️ Could not record failed participation:', recordError);
    }
  };

  // ✅ NEW: Helper function to get browser info
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'unknown';

    if (ua.includes('Firefox')) browser = 'firefox';
    else if (ua.includes('Chrome')) browser = 'chrome';
    else if (ua.includes('Safari')) browser = 'safari';
    else if (ua.includes('Edge')) browser = 'edge';

    return browser;
  };

  // ✅ NEW: Helper function to get connection type
  const getConnectionType = () => {
    if ('connection' in navigator) {
      return navigator.connection?.effectiveType || 'unknown';
    }
    return 'unknown';
  };

  // ✅ NEW: Enhanced getCurrentUserId function
  const getCurrentUserId = async () => {
    try {
      // Method 1: From auth context (adjust based on your auth system)
      if (typeof useAuth !== 'undefined') {
        const auth = useAuth();
        if (auth?.user?.id) return auth.user.id;
        if (auth?.user?.user_id) return auth.user.user_id;
      }

      // Method 2: From localStorage/sessionStorage
      const authKeys = ['user', 'user_data', 'auth_user', 'profile', 'currentUser'];
      for (const key of authKeys) {
        try {
          const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (stored) {
            const userData = JSON.parse(stored);
            if (userData.id) return userData.id;
            if (userData.user_id) return userData.user_id;
            if (userData.student_id) return userData.student_id;
          }
        } catch (e) {
          // Silent fail for parsing errors
        }
      }

      // Method 3: From the join session response (if available)
      if (classItem?.video_session?.meeting_id) {
        try {
          const joinResult = await studentApi.joinVideoSession(classItem.video_session.meeting_id);
          if (joinResult.user_id) return joinResult.user_id;
          if (joinResult.student_id) return joinResult.student_id;
        } catch (error) {
          console.warn('Could not get user ID from join session:', error);
        }
      }

      // Method 4: Generate a session-based ID as last resort
      console.warn('⚠️ Using session-based user ID');
      if (!sessionStorage.getItem('temp_user_id')) {
        sessionStorage.setItem('temp_user_id', `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      }
      return sessionStorage.getItem('temp_user_id');

    } catch (error) {
      console.error('❌ Error getting user ID:', error);
      return `error_${Date.now()}`;
    }
  };


  // Enhanced Agora event listeners with fixed screen share detection
  const setupAgoraEventListeners = (client) => {
    console.log('🔊 Setting up enhanced Agora event listeners...');

    // User published - when someone shares media
    client.on('user-published', async (user, mediaType) => {
      console.log('🎯 USER-PUBLISHED - UID:', user.uid, 'Media:', mediaType, 'User:', user);

      try {
        // Subscribe to the user's stream
        await client.subscribe(user, mediaType);
        console.log('✅ Successfully subscribed to user:', user.uid);

        if (mediaType === 'video') {
          const track = user.videoTrack;

          // FIXED: Alternative screen share detection without getTrackLabel
          const isScreenShare = await detectScreenShare(user, track);

          // Enhanced teacher detection logic
          const isTeacher = detectTeacher(user.uid);
          if (isTeacher) {
            setTeacherUid(user.uid);
            teacherUidRef.current = user.uid;
            console.log('👨‍🏫 Teacher identified with UID:', user.uid);
          }

          // Update remote users state
          setRemoteUsers(prev => {
            const newMap = new Map(prev);
            newMap.set(user.uid, {
              uid: user.uid,
              videoTrack: track,
              audioTrack: user.audioTrack,
              hasVideo: true,
              hasAudio: !!user.audioTrack,
              isTeacher: isTeacher,
              isScreenShare: isScreenShare,
              isSpeaking: false,
              joinedAt: new Date()
            });
            return newMap;
          });

          // Auto-detect screen share and update layout
          if (isScreenShare) {
            screenShareUidRef.current = user.uid;
            setActiveSpeaker(user.uid);
            setIsScreenSharing(true);
            setLayoutMode('screenShare');
            console.log('🖥️ Screen share detected from UID:', user.uid);
          }

        } else if (mediaType === 'audio') {
          // Play remote audio
          user.audioTrack.play().catch(e =>
          console.log('Audio play error (non-critical):', e)
          );

          // Monitor audio levels for active speaker detection
          user.audioTrack.on('volume-change', (volume) => {
            if (volume > 0.1) {
              setActiveSpeaker(user.uid);
            }
          });
        }

        updateParticipantsList();

      } catch (error) {
        console.error('❌ Error in user-published handler:', error);
      }
    });

    // User joined the channel
    client.on('user-joined', (user) => {
      console.log('👤 USER-JOINED - UID:', user.uid);
      updateParticipantsList();
    });

    // User left the channel
    client.on('user-left', (user) => {
      console.log('👤 USER-LEFT - UID:', user.uid);

      setRemoteUsers(prev => {
        const newMap = new Map(prev);
        const leavingUser = newMap.get(user.uid);

        // Handle screen sharer leaving
        if (leavingUser?.isScreenShare) {
          screenShareUidRef.current = null;
          setIsScreenSharing(false);
          setActiveSpeaker(null);
          setLayoutMode('grid');
          console.log('🖥️ Screen sharer left the call');
        }

        // Handle teacher leaving
        if (leavingUser?.isTeacher) {
          setTeacherUid(null);
          teacherUidRef.current = null;
          console.log('👨‍🏫 Teacher left the call');
        }

        newMap.delete(user.uid);
        return newMap;
      });

      // Clean up video elements
      cleanupRemoteVideoElement(user.uid);
      updateParticipantsList();
    });

    // Connection state changes
    client.on('connection-state-change', (curState, prevState) => {
      console.log('🔗 CONNECTION STATE:', prevState, '→', curState);

      if (curState === 'CONNECTED') {
        console.log('🎉 Fully connected to channel:', client.channelName);
        setError('');
      } else if (curState === 'DISCONNECTED') {
        setError('Disconnected from video channel. Attempting to reconnect...');
      } else if (curState === 'RECONNECTING') {
        console.log('🔄 Reconnecting to channel...');
      }
    });

    // Network quality monitoring
    client.on('network-quality', (stats) => {
      const { uplinkNetworkQuality, downlinkNetworkQuality } = stats;
      const quality = Math.min(uplinkNetworkQuality, downlinkNetworkQuality);

      const qualityMap = {
        0: 'excellent',
        1: 'good',
        2: 'fair',
        3: 'poor',
        4: 'poor',
        5: 'poor',
        6: 'poor'
      };

      setConnectionQuality(qualityMap[quality] || 'excellent');
    });

    // User info updated
    client.on('user-info-updated', (uid, msg) => {
      console.log('📝 User info updated:', uid, msg);
    });
  };

  // FIXED: Alternative screen share detection without getTrackLabel
  const detectScreenShare = async (user, track) => {
    try {
      // Strategy 1: Check if we already have a screen share UID
      if (user.uid === screenShareUidRef.current) {
        return true;
      }

      // Strategy 2: Use backend metadata if available
      if (classItem?.video_session?.screen_share_uid === user.uid) {
        return true;
      }

      // Strategy 3: Check if this is the first video stream from teacher (common pattern)
      if (user.uid === teacherUidRef.current && remoteUsers.size === 0) {
        console.log('🖥️ First video from teacher - might be screen share');
        // You could add additional heuristics here
      }

      // Strategy 4: Default to false - screen share detection is challenging without getTrackLabel
      // In production, you might want to implement a signaling mechanism with your backend
      return false;
    } catch (error) {
      console.warn('⚠️ Screen share detection error:', error);
      return false;
    }
  };

  // FIXED: Teacher detection without track label
  const detectTeacher = (uid) => {
    // Strategy 1: Use backend-provided teacher UID if available
    if (classItem?.video_session?.teacher_uid === uid) {
      return true;
    }

    // Strategy 2: First user to join after student is likely teacher
    if (remoteUsers.size === 0 && !teacherUidRef.current) {
      return true;
    }

    // Strategy 3: Maintain consistency if we already identified teacher
    if (uid === teacherUidRef.current) {
      return true;
    }

    // Strategy 4: Use UID 1 as fallback (common Agora pattern for first user)
    if (uid === 1 && !teacherUidRef.current) {
      return true;
    }

    return false;
  };

  // Create and publish local tracks with fallbacks
  const createAndPublishLocalTracks = async (client) => {
    try {
      console.log('🎤 Creating enhanced local tracks...');

      // Create audio track with fallback
      let microphoneTrack;
      try {
        microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true, // Acoustic Echo Cancellation
          ANS: true, // Audio Noise Suppression
        });
        localTracksRef.current.audio = microphoneTrack;
        console.log('✅ Microphone track created');
      } catch (audioError) {
        console.warn('⚠️ Could not create microphone track:', audioError);
        setError('Microphone access required for full participation');
      }

      // Create video track with fallback
      let cameraTrack;
      try {
        cameraTrack = await AgoraRTC.createCameraVideoTrack({
          optimizationMode: 'motion', // Optimize for motion
          encoderConfig: '720p_1', // 720p resolution
        });
        localTracksRef.current.video = cameraTrack;
        console.log('✅ Camera track created');

        // Play local video immediately
        if (localVideoRef.current) {
          cameraTrack.play(localVideoRef.current);
          setLocalStream(cameraTrack);
        }
      } catch (videoError) {
        console.warn('⚠️ Could not create camera track:', videoError);
        setError('Camera access required for video participation');
      }

      // Publish available tracks
      const tracksToPublish = [];
      if (microphoneTrack) tracksToPublish.push(microphoneTrack);
      if (cameraTrack) tracksToPublish.push(cameraTrack);

      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        console.log('✅ Local tracks published successfully');
      } else {
        console.warn('⚠️ No local tracks to publish');
      }

    } catch (error) {
      console.error('❌ Failed to create local tracks:', error);

      // Provide user-friendly error messages
      if (error.name === 'NOT_READABLE_ERROR') {
        setError('Camera/microphone is being used by another application');
      } else if (error.name === 'PERMISSION_DENIED') {
        setError('Camera/microphone permissions required. Please check your browser settings.');
      } else {
        setError('Failed to access camera/microphone. Please check your devices.');
      }
    }
  };

  // Clean up remote video element
  const cleanupRemoteVideoElement = (uid) => {
    const videoElement = remoteVideoElementsRef.current.get(uid);
    if (videoElement) {
      videoElement.remove();
      remoteVideoElementsRef.current.delete(uid);
    }
  };

  // Enhanced remote video rendering
  const renderRemoteVideos = () => {
    const remoteUsersArray = Array.from(remoteUsers.values());

    if (remoteUsersArray.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
        <div className="text-center">
        <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">Waiting for participants to join...</p>
        <p className="text-gray-500 text-sm mt-2">
        The teacher and other students will appear here when they join
        </p>
        </div>
        </div>
      );
    }

    return remoteUsersArray.map((user) => (
      <RemoteVideoPlayer
      key={user.uid}
      user={user}
      isActiveSpeaker={activeSpeaker === user.uid}
      layoutMode={layoutMode}
      />
    ));
  };

  // Remote Video Player Component
  const RemoteVideoPlayer = ({ user, isActiveSpeaker, layoutMode }) => {
    const videoContainerRef = useRef(null);

    useEffect(() => {
      if (!user.videoTrack || !videoContainerRef.current) {
        return;
      }

      let videoElement = remoteVideoElementsRef.current.get(user.uid);

      try {
        if (!videoElement) {
          // Create new video element
          videoElement = document.createElement('video');
          videoElement.id = `remote-video-element-${user.uid}`;
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.muted = false;
          videoElement.className = 'w-full h-full object-cover bg-black rounded-xl';

          remoteVideoElementsRef.current.set(user.uid, videoElement);
        }

        // Clear container and add video element
        videoContainerRef.current.innerHTML = '';
        videoContainerRef.current.appendChild(videoElement);

        // Play the video track with error handling
        if (user.videoTrack && typeof user.videoTrack.play === 'function') {
          const playPromise = user.videoTrack.play(videoElement);

          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn(`Video play error for user ${user.uid}:`, error);
            });
          }
        } else {
          console.warn(`Video track not available for user ${user.uid} or play method missing`);
        }
      } catch (error) {
        console.error(`Error setting up video for user ${user.uid}:`, error);
      }

      return () => {
        // Cleanup on unmount
        if (videoElement && user.videoTrack) {
          try {
            user.videoTrack.stop();
          } catch (e) {
            console.warn(`Error stopping video track for user ${user.uid}:`, e);
          }
        }
      };
    }, [user.uid, user.videoTrack]);

    const getContainerClasses = () => {
      const baseClasses = "relative rounded-2xl overflow-hidden border-2 transition-all duration-300 min-h-[200px] bg-black";

      if (user.isScreenShare) {
        return `${baseClasses} border-orange-500/70 bg-gradient-to-br from-orange-900/30 to-red-900/30 shadow-lg`;
      } else if (user.isTeacher) {
        return `${baseClasses} border-yellow-500/70 bg-gradient-to-br from-yellow-900/20 to-amber-900/20 ${
          isActiveSpeaker ? 'ring-2 ring-yellow-400 scale-105' : ''
        }`;
      } else {
        return `${baseClasses} border-green-500/50 bg-gradient-to-br from-green-900/20 to-emerald-900/20 ${
          isActiveSpeaker ? 'ring-2 ring-green-400 scale-105' : ''
        }`;
      }
    };

    const getUserInfo = () => {
      if (user.isScreenShare) {
        return { icon: '🖥️', name: 'SCREEN SHARE', color: 'text-orange-300' };
      } else if (user.isTeacher) {
        return { icon: '👨‍🏫', name: classItem.teacher_name || 'TEACHER', color: 'text-yellow-300' };
      } else {
        return { icon: '👤', name: `Student ${user.uid}`, color: 'text-green-300' };
      }
    };

    const userInfo = getUserInfo();

    return (
      <div className={getContainerClasses()}>
      <div
      ref={videoContainerRef}
      className="w-full h-full bg-black rounded-xl"
      />

      {/* User info overlay */}
      <div className={`absolute top-3 left-3 text-white px-3 py-2 rounded-lg backdrop-blur-lg border text-sm ${
        user.isScreenShare
        ? 'bg-black/80 border-orange-500/30'
        : user.isTeacher
        ? 'bg-black/80 border-yellow-500/30'
        : 'bg-black/80 border-green-500/30'
      }`}>
      <div className="flex items-center space-x-2">
      <span>{userInfo.icon}</span>
      <span className={`${userInfo.color} font-medium`}>
      {userInfo.name}
      </span>
      {isActiveSpeaker && (
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      )}
      {!user.hasVideo && (
        <CameraOff size={14} className="text-red-400" />
      )}
      </div>
      </div>

      {/* Audio indicator */}
      {user.hasAudio && (
        <div className="absolute top-3 right-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      )}

      {/* No video overlay */}
      {!user.hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl">
        <div className="text-center">
        <CameraOff className="text-gray-500 w-12 h-12 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">Camera off</p>
        </div>
        </div>
      )}
      </div>
    );
  };

  // Update participants list
  const updateParticipantsList = () => {
    const remoteUsersArray = Array.from(remoteUsers.values());

    const participantsList = [
      // Teacher (if present)
      ...remoteUsersArray
      .filter(user => user.isTeacher)
      .map(user => ({
        name: classItem.teacher_name || 'Teacher',
        role: 'teacher',
        isOnline: true,
        hasVideo: user.hasVideo,
        hasAudio: user.hasAudio,
        uid: user.uid,
        isSpeaking: activeSpeaker === user.uid
      })),

      // Local user (You)
      {
        name: 'You',
        role: 'student',
        isOnline: true,
        hasVideo: !isVideoOff,
        hasAudio: !isAudioMuted,
        uid: 'local',
        isSpeaking: false
      },

      // Other students
      ...remoteUsersArray
      .filter(user => !user.isTeacher && !user.isScreenShare)
      .map(user => ({
        name: `Student ${user.uid}`,
        role: 'student',
        isOnline: true,
        hasVideo: user.hasVideo,
        hasAudio: user.hasAudio,
        uid: user.uid,
        isSpeaking: activeSpeaker === user.uid
      }))
    ];

    setParticipants(participantsList);
  };

  // Toggle audio with enhanced feedback
  const toggleAudio = async () => {
    if (localTracksRef.current.audio) {
      try {
        await localTracksRef.current.audio.setEnabled(isAudioMuted);
        setIsAudioMuted(!isAudioMuted);
        console.log(`🎤 Audio ${!isAudioMuted ? 'enabled' : 'disabled'}`);
        updateParticipantsList();
      } catch (error) {
        console.error('Error toggling audio:', error);
        setError('Failed to toggle microphone');
      }
    }
  };

  // Toggle video with enhanced feedback
  const toggleVideo = async () => {
    if (localTracksRef.current.video) {
      try {
        await localTracksRef.current.video.setEnabled(isVideoOff);
        setIsVideoOff(!isVideoOff);
        console.log(`📹 Video ${!isVideoOff ? 'enabled' : 'disabled'}`);
        updateParticipantsList();
      } catch (error) {
        console.error('Error toggling video:', error);
        setError('Failed to toggle camera');
      }
    }
  };

  // Raise hand function
  const raiseHand = async () => {
    try {
      setIsHandRaised(!isHandRaised);
      console.log(`🤝 Hand ${isHandRaised ? 'lowered' : 'raised'}`);

      // Send raise hand signal to teacher
      if (classItem?.video_session?.meeting_id) {
        await studentApi.raiseHand(classItem.video_session.meeting_id, !isHandRaised);
      }
    } catch (error) {
      console.error('Error raising hand:', error);
    }
  };

  // Toggle layout mode
  const toggleLayout = () => {
    const modes = ['grid', 'speaker', 'screenShare'];
    const currentIndex = modes.indexOf(layoutMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setLayoutMode(modes[nextIndex]);
  };

  // Enhanced leave call with proper cleanup
  // Enhanced participation recording with correct schema mapping
  const leaveCall = async () => {
    try {
      console.log('🛑 Student leaving world-class video call...');

      // Stop timer first
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Stop and close all local tracks
      Object.values(localTracksRef.current).forEach(track => {
        if (track) {
          try {
            track.stop();
            track.close();
          } catch (error) {
            console.warn('Error closing track:', error);
          }
        }
      });

      // Leave Agora channel
      if (agoraClient) {
        await agoraClient.leave();
      }

      // FIXED: Correct participation recording with proper schema mapping
      if (classItem?.video_session?.meeting_id) {
        try {
          const userId = await getCurrentUserId();

          // CORRECTED: Use the proper column names from your schema
          const participationData = {
            session_id: classItem.video_session.meeting_id, // Map meeting_id → session_id
            student_id: userId, // Map user_id → student_id
            is_teacher: false, // Map user_type → is_teacher
            duration: callDuration,
            left_at: new Date().toISOString(),
            connection_quality: connectionQuality,
            device_info: {
              user_agent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            class_id: classItem.id, // Add class_id if available
            status: 'left' // Update status when leaving
          };

          console.log('📝 Recording participation with corrected schema:', participationData);

          const recordResult = await studentApi.recordParticipation(participationData);

          console.log('✅ Participation recorded successfully:', recordResult);

        } catch (recordError) {
          console.error('❌ Failed to record participation:', recordError);

          // Don't prevent call from ending even if recording fails
          if (recordError.response) {
            console.error('📊 Error response details:', recordError.response.data);
          }
        }
      }

      console.log('✅ World-class call cleanup complete');

    } catch (error) {
      console.error('Error during call cleanup:', error);
    } finally {
      // Reset all state
      setIsConnected(false);
      setCallDuration(0);
      setLocalStream(null);
      setRemoteUsers(new Map());
      setAgoraClient(null);
      setTeacherUid(null);
      setIsScreenSharing(false);
      setActiveSpeaker(null);
      setIsHandRaised(false);
      joinAttemptRef.current = 0;

      // Clean up all remote video elements
      remoteVideoElementsRef.current.forEach((element, uid) => {
        element.remove();
      });
      remoteVideoElementsRef.current.clear();

      screenShareUidRef.current = null;
      teacherUidRef.current = null;

      onClose();
    }
  };

  // Cleanup function
  const cleanupCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallDuration(0);
    setIsConnected(false);
    setRemoteUsers(new Map());
    joinAttemptRef.current = 0;

    // Clean up video elements
    remoteVideoElementsRef.current.forEach(element => element.remove());
    remoteVideoElementsRef.current.clear();

    if (agoraClient) {
      agoraClient.leave().catch(console.error);
    }
  };

  // Retry connection
  const retryConnection = () => {
    joinAttemptRef.current = 0;
    setError('');
    initializeRealCall();
  };

  // Start timer
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get connection quality color
  const getConnectionColor = () => {
    switch(connectionQuality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-green-400';
    }
  };

  // Get grid layout classes
  const getGridLayoutClasses = () => {
    const totalParticipants = 1 + remoteUsers.size; // local + remote

    if (layoutMode === 'screenShare') {
      return 'grid grid-cols-1 gap-4';
    } else if (layoutMode === 'speaker') {
      return 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4';
    } else {
      // Adaptive grid based on participant count
      if (totalParticipants <= 2) {
        return 'grid grid-cols-1 md:grid-cols-2 gap-4';
      } else if (totalParticipants <= 4) {
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4';
      } else {
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
      }
    }
  };

  // Enhanced debug function
  const debugConnection = async () => {
    const debugData = {
      layoutMode,
      activeSpeaker,
      remoteUsers: Array.from(remoteUsers.entries()),
      screenSharing: isScreenSharing,
      teacherUid,
      connectionQuality,
      participants: participants.length,
      callDuration,
      isConnected,
      isConnecting,
      screenShareUid: screenShareUidRef.current,
      teacherUidRef: teacherUidRef.current
    };

    console.log('🐛 DEBUG CONNECTION STATE:', debugData);

    let debugText = `WORLD-CLASS VIDEO DEBUG:\n`;
    debugText += `Layout: ${layoutMode}\n`;
    debugText += `Active Speaker: ${activeSpeaker}\n`;
    debugText += `Remote Users: ${remoteUsers.size}\n`;
    debugText += `Teacher UID: ${teacherUid}\n`;
    debugText += `Screen Sharing: ${isScreenSharing}\n`;
    debugText += `Connection: ${connectionQuality}\n`;
    debugText += `Participants: ${participants.length}\n`;
    debugText += `Duration: ${formatTime(callDuration)}\n`;
    debugText += `Screen Share UID: ${screenShareUidRef.current}\n`;
    debugText += `Teacher UID Ref: ${teacherUidRef.current}\n`;

    setDebugInfo(debugText);
  };

  // Auto-detect screen sharing and adjust layout
  useEffect(() => {
    if (isScreenSharing && layoutMode !== 'screenShare') {
      setLayoutMode('screenShare');
    } else if (!isScreenSharing && layoutMode === 'screenShare') {
      setLayoutMode('grid');
    }
  }, [isScreenSharing, layoutMode]);

  // Initialize call when component opens
  useEffect(() => {
    if (isOpen && classItem?.video_session?.meeting_id) {
      initializeRealCall();
    }

    return () => cleanupCall();
  }, [isOpen, classItem]);

  // Update participants when remote users change
  useEffect(() => {
    updateParticipantsList();
  }, [remoteUsers, isAudioMuted, isVideoOff, activeSpeaker]);

  // Responsive control button component
  const ControlButton = ({ icon: Icon, label, onClick, variant = 'primary', isActive = false }) => {
    const baseClasses = "flex items-center justify-center transition-all duration-200 backdrop-blur-lg rounded-xl p-3 sm:p-4";

    const variantClasses = {
      primary: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white',
      danger: 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white',
      success: `bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white ${
        isActive ? 'ring-2 ring-green-400' : ''
      }`,
      warning: 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white',
      secondary: 'bg-gray-600 hover:bg-gray-500 text-white'
    };

    return (
      <button
      onClick={onClick}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        flex-col space-y-1
        sm:flex-row sm:space-y-0 sm:space-x-2
        `}
        title={label}
        >
        {typeof Icon === 'string' ? (
          <span className="text-lg">{Icon}</span>
        ) : (
          <Icon size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
        )}
        <span className="text-white text-xs font-bold hidden sm:block md:text-sm">
        {label}
        </span>
        </button>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex flex-col">
    {/* Enhanced Header */}
    <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-cyan-900 text-white p-3 sm:p-4 border-b border-cyan-500/30 shadow-lg">
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
    <div className="flex items-center space-x-3">
    {/* Connection Status */}
    <div className="flex items-center space-x-2">
    <div className={`w-3 h-3 rounded-full ${
      isConnected ? 'bg-green-500 animate-pulse' :
      isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
    }`}></div>
    <span className="text-xs sm:text-sm font-mono">
    {isConnected ? 'CONNECTED' : isConnecting ? 'CONNECTING...' : 'DISCONNECTED'}
    </span>
    </div>

    <div className="h-4 w-px bg-cyan-500/50 hidden sm:block"></div>

    {/* Class Info */}
    <div className="flex-1 min-w-0">
    <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent truncate">
    {classItem.title}
    </h2>
    <p className="text-cyan-200 text-xs sm:text-sm truncate">
    {classItem.teacher_name} • {formatTime(callDuration)} •
    <span className={`ml-1 sm:ml-2 ${getConnectionColor()}`}>
    {connectionQuality.toUpperCase()}
    </span>
    </p>
    </div>
    </div>

    {/* Header Controls */}
    <div className="flex items-center justify-between sm:justify-end space-x-2">
    {/* Layout Toggle */}
    <button
    onClick={toggleLayout}
    className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg transition-all duration-200"
    title="Change Layout"
    >
    <Layout className="w-4 h-4 sm:w-5 sm:h-5" />
    </button>

    {/* Participants Count */}
    <div className="bg-cyan-700/50 px-3 py-1 rounded-full text-xs font-mono flex items-center space-x-1">
    <Users size={12} />
    <span>{participants.length}</span>
    </div>

    {/* Leave Button */}
    <button
    onClick={leaveCall}
    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 px-3 py-2 rounded-lg flex items-center transition-all duration-200 shadow-lg text-sm"
    >
    <PhoneOff size={16} className="mr-1 sm:mr-2" />
    <span className="hidden sm:inline">Leave</span>
    </button>
    </div>
    </div>
    </div>

    {/* Error Display */}
    {error && (
      <div className="bg-red-600 text-white p-3 mx-4 mt-4 rounded-lg flex justify-between items-center animate-pulse">
      <div className="flex-1 text-sm">
      <span>{error}</span>
      </div>
      <button onClick={() => setError('')} className="text-white text-lg hover:text-red-200">
      ×
      </button>
      </div>
    )}

    {/* Main Video Area - World Class Design */}
    <div className="flex-1 bg-gradient-to-br from-gray-900 to-black relative p-4 sm:p-6">
    {isConnecting ? (
      <div className="flex items-center justify-center h-full">
      <div className="text-center">
      <Loader2 className="animate-spin mx-auto text-cyan-400 w-16 h-16 sm:w-20 sm:h-20" />
      <p className="text-white mt-6 text-xl sm:text-2xl font-bold">
      Joining World-Class Video Session
      </p>
      <p className="text-gray-400 mt-2 text-sm sm:text-base">
      Connecting to {classItem.title} with {classItem.teacher_name}
      </p>
      </div>
      </div>
    ) : isConnected ? (
      <div className="h-full flex flex-col">
      {/* Video Grid Container */}
      <div className={`video-grid-container flex-1 w-full h-full ${getGridLayoutClasses()}`}>
      {/* Local Video - Always Visible */}
      <div className="remote-video-container relative rounded-2xl overflow-hidden border-2 border-purple-500/70 bg-gradient-to-br from-purple-900/30 to-pink-900/30 shadow-lg min-h-[200px]">
      <video
      ref={localVideoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-full object-cover bg-black rounded-xl"
      />
      <div className="absolute top-3 left-3 bg-black/80 text-white px-3 py-2 rounded-lg backdrop-blur-lg border border-purple-500/30 text-sm">
      <div className="flex items-center space-x-2">
      <span className="text-purple-300 font-medium">YOU</span>
      {isVideoOff && <CameraOff size={14} className="text-red-400" />}
      {isAudioMuted && <MicOff size={14} className="text-red-400" />}
      {isHandRaised && <span className="text-yellow-400">✋</span>}
      </div>
      </div>

      {/* Video Off Overlay */}
      {isVideoOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl">
        <div className="text-center">
        <CameraOff className="text-purple-500 w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2" />
        <p className="text-purple-300 text-sm">Camera is off</p>
        </div>
        </div>
      )}
      </div>

      {/* Remote Videos - Dynamically Rendered */}
      {renderRemoteVideos()}
      </div>

      {/* Layout Indicator */}
      <div className="flex justify-center mt-4">
      <div className="bg-black/50 px-4 py-2 rounded-full border border-cyan-500/30 backdrop-blur-lg">
      <span className="text-cyan-300 text-sm font-mono flex items-center space-x-2">
      <Signal size={14} className={getConnectionColor()} />
      <span>{layoutMode.toUpperCase()} MODE • {connectionQuality.toUpperCase()} QUALITY</span>
      </span>
      </div>
      </div>
      </div>
    ) : (
      <div className="flex items-center justify-center h-full">
      <div className="text-center">
      <div className="text-red-400 text-6xl mb-4">❌</div>
      <p className="text-white text-xl font-bold mb-2">Connection Failed</p>
      <p className="text-gray-400 mb-6">Unable to connect to the video session</p>
      <button
      onClick={retryConnection}
      className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-6 py-3 rounded-lg text-white font-medium text-base transition-all duration-200"
      >
      Retry Connection
      </button>
      </div>
      </div>
    )}
    </div>

    {/* Enhanced Control Bar - World Class Design */}
    {isConnected && (
      <div className="bg-gradient-to-r from-gray-800/90 to-gray-900/90 border-t border-cyan-500/20 p-4 backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
      {/* Left Side - Timer for mobile */}
      <div className="flex justify-center sm:hidden">
      <div className="bg-black/50 px-4 py-2 rounded-2xl border border-cyan-500/30">
      <span className="text-cyan-300 font-mono text-sm flex items-center space-x-2">
      <Clock size={14} />
      <span>{formatTime(callDuration)}</span>
      </span>
      </div>
      </div>

      {/* Center - Control Buttons */}
      <div className="flex justify-center space-x-2 sm:space-x-4">
      <ControlButton
      icon={isAudioMuted ? MicOff : Mic}
      label={isAudioMuted ? 'UNMUTE' : 'MUTE'}
      onClick={toggleAudio}
      variant={isAudioMuted ? 'danger' : 'success'}
      isActive={!isAudioMuted}
      />

      <ControlButton
      icon={isVideoOff ? CameraOff : Camera}
      label={isVideoOff ? 'CAM ON' : 'CAM OFF'}
      onClick={toggleVideo}
      variant={isVideoOff ? 'danger' : 'success'}
      isActive={!isVideoOff}
      />

      <ControlButton
      icon={Layout}
      label="LAYOUT"
      onClick={toggleLayout}
      variant="warning"
      />

      <ControlButton
      icon={isHandRaised ? Hand : Hand}
      label={isHandRaised ? 'LOWER HAND' : 'RAISE HAND'}
      onClick={raiseHand}
      variant={isHandRaised ? 'warning' : 'secondary'}
      isActive={isHandRaised}
      />

      <ControlButton
      icon={PhoneOff}
      label="LEAVE"
      onClick={leaveCall}
      variant="danger"
      />
      </div>

      {/* Right Side - Timer and debug for desktop */}
      <div className="hidden sm:flex items-center space-x-4">
      <div className="bg-black/50 px-4 py-2 rounded-2xl border border-cyan-500/30">
      <span className="text-cyan-300 font-mono text-sm flex items-center space-x-2">
      <Clock size={14} />
      <span>{formatTime(callDuration)}</span>
      </span>
      </div>

      {/* Debug button - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <button
        onClick={debugConnection}
        className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-xs text-white"
        >
        Debug
        </button>
      )}
      </div>
      </div>
      </div>
    )}

    {/* Debug Info Display */}
    {debugInfo && (
      <div className="fixed bottom-20 left-4 bg-black/80 text-green-400 p-4 rounded-lg font-mono text-xs max-w-md max-h-48 overflow-auto">
      <pre>{debugInfo}</pre>
      <button
      onClick={() => setDebugInfo('')}
      className="absolute top-2 right-2 text-white hover:text-green-300"
      >
      ×
      </button>
      </div>
    )}
    </div>
  );
};








// ===  CLASS MANAGEMENT ===
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

// === Madina COMPONENTS ===
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

    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-4 rounded-2xl border border-blue-500/20">
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
        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
      }`}
      >
      <Mic className="mr-2" size={16} />
      {isSubmitted ? 'Neural Resubmit' : 'Madina Submit'}
      </button>
    )}

    {isGraded && assignment.submissions?.[0]?.feedback && (
      <button className="text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3 px-5 rounded-xl flex items-center transition-all duration-200 shadow-lg">
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
          <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 px-6 rounded-xl flex items-center transition-all duration-200 shadow-lg">
          <Calendar size={18} className="mr-2"/>
          Schedule Reminder
          </button>
        )}

        {isClassCompleted && classItem.video_session && (
          <button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3 px-6 rounded-xl flex items-center transition-all duration-200 shadow-lg">
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

const handleLogout = async () => {
  try {
    console.log('🎓 Student logout initiated...');

    // 1. Emergency video call cleanup
    if (showVideoCall) {
      try {
        // Force leave any active call
        if (agoraClient) {
          await agoraClient.leave().catch(console.warn);
        }
        // Stop all media tracks
        Object.values(localTracksRef.current).forEach(track => {
          if (track) {
            track.stop().catch(console.warn);
            track.close().catch(console.warn);
          }
        });
      } catch (e) {
        console.warn('Video cleanup warning:', e);
      }
    }

    // 2. Clear all application data
    localStorage.clear();
    sessionStorage.clear();

    // 3. Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // 4. Navigate to login
    toast.success('🎓 Successfully logged out');
    navigate('/login');

  } catch (error) {
    console.error('Logout error:', error);
    // Force navigation even if error
    localStorage.clear();
    navigate('/login');
  }
};
// === Madina DASHBOARD COMPONENT ===
export default function Dashboard() {
  // Madina State Management
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState([
    { label: "Madina Sessions", value: "0", icon: Video, change: "+0", color: "from-cyan-500 to-blue-500" },
    { label: "Learning Hours", value: "0", icon: Clock, change: "+0", color: "from-purple-500 to-pink-500" },
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

  // Madina Data Fetching
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
          color: "from-purple-500 to-pink-500"
        },
        {
          label: "Assignements",
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

  // Madina Effects
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
      <div className="text-center">
      <div className="relative">
      <Loader2 className="animate-spin mx-auto text-cyan-400" size={64} />
      <Sparkles className="absolute inset-0 text-purple-400 animate-pulse" size={64} />
      </div>
      <p className="text-cyan-200 mt-6 text-xl font-bold">Initializing Madina Dashboard</p>
      <p className="text-purple-300 mt-2">Optimizing your learning matrix</p>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex">
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
      fixed inset-y-0 left-0 z-40 w-80 bg-gradient-to-b from-gray-900/95 to-purple-900/95 backdrop-blur-xl transform transition-transform duration-300 ease-in-out border-r border-cyan-500/20
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
        { id: "exams", label: "Exams", icon: ClipboardList, color: "from-purple-500 to-pink-500" },
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
      <header className="bg-gradient-to-r from-gray-900/50 to-purple-900/50 backdrop-blur-xl border-b border-cyan-500/20 sticky top-0 z-30">
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
