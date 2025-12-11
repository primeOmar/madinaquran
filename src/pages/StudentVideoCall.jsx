import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import studentvideoApi from '../lib/agora/studentvideoApi';
import './TeacherVideoCall.css'; 
import { 
  Video, 
  Clock, 
  Users, 
  MessageCircle, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  Hand, 
  MoreVertical, 
  X 
} from 'lucide-react';
const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false, // Track if camera exists
    hasMicrophone: false // Track if mic exists
  });

  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown'
  });

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);

  const clientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const messagesPollIntervalRef = useRef(null);

  // ============================================
  // Initialization - 
  // ============================================

  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [meetingId, studentId]);

const initializeSession = async () => {
  try {
    console.log('🎓 SMART STUDENT: Finding video session for class:', {
      classId,
      studentId,
      providedMeetingId: meetingId,
      timestamp: new Date().toISOString()
    });

    // ========== STEP 1: FIND THE RIGHT MEETING ID ==========
    let effectiveMeetingId = meetingId;
    
    if (!effectiveMeetingId || effectiveMeetingId === 'undefined' || effectiveMeetingId === 'null') {
      console.log('🔍 No meeting ID provided, finding active session for class:', classId);
      
      // Try to find active session for this class
      const classSession = await studentvideoApi.getSessionByClassId(classId);
      
      if (classSession.exists && classSession.isActive) {
        effectiveMeetingId = classSession.meetingId;
        console.log('✅ Found active session:', {
          meetingId: effectiveMeetingId,
          teacher: classSession.teacher_id,
          channel: classSession.channel
        });
      } else {
        // Try common meeting ID patterns
        console.log('🔄 Trying common meeting ID patterns...');
        const commonPatterns = [
          `class_${classId}`, 
          `class_${classId}_${classId}`, 
          `class_channel_${classId}`, 
        ];
        
        // Try each pattern
        for (const pattern of commonPatterns) {
          try {
            const sessionInfo = await studentvideoApi.getSessionInfo(pattern);
            if (sessionInfo.exists && sessionInfo.isActive) {
              effectiveMeetingId = pattern;
              console.log('✅ Found session with pattern:', pattern);
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!effectiveMeetingId) {
          // Fallback to generic pattern
          effectiveMeetingId = `class_${classId}`;
          console.log('⚠️ Using fallback meeting ID:', effectiveMeetingId);
        }
      }
    }

    console.log('🎯 STUDENT: Using meeting ID:', effectiveMeetingId);

    // ========== STEP 2: VALIDATE SESSION ==========
    const sessionInfo = await studentvideoApi.getSessionInfo(effectiveMeetingId);
    
    if (!sessionInfo.success) {
      console.error('❌ Failed to fetch session info:', sessionInfo.error);
      setSessionState({
        isInitialized: false,
        isJoined: false,
        error: sessionInfo.error || 'Unable to verify session status'
      });
      return;
    }
    
    if (!sessionInfo.exists || !sessionInfo.isActive) {
      console.error('❌ Session issue:', { 
        exists: sessionInfo.exists,
        isActive: sessionInfo.isActive,
        status: sessionInfo.session?.status 
      });
      
      // Try one more time with generic ID
      if (effectiveMeetingId !== `class_${classId}`) {
        console.log('🔄 Trying generic meeting ID as fallback...');
        const fallbackMeetingId = `class_${classId}`;
        const fallbackSession = await studentvideoApi.getSessionInfo(fallbackMeetingId);
        
        if (fallbackSession.exists && fallbackSession.isActive) {
          effectiveMeetingId = fallbackMeetingId;
          console.log('✅ Found session with fallback ID');
        } else {
          setSessionState({
            isInitialized: false,
            isJoined: false,
            error: 'Session not found or not active. Please wait for teacher to start the class.'
          });
          return;
        }
      } else {
        setSessionState({
          isInitialized: false,
          isJoined: false,
          error: 'Session not found or not active. Please wait for teacher to start the class.'
        });
        return;
      }
    }

    console.log('✅ Session verified:', {
      meetingId: sessionInfo.session?.meeting_id,
      status: sessionInfo.session?.status,
      startedAt: sessionInfo.session?.started_at,
      classTitle: sessionInfo.session?.class_title,
      channel: sessionInfo.session?.channel_name,
      teacherId: sessionInfo.session?.teacher_id
    });

    // ========== STEP 3: CREATE AGORA CLIENT ==========
    console.log('🛠️ Creating Agora client...');
    clientRef.current = AgoraRTC.createClient({ 
      mode: 'rtc', 
      codec: 'vp8' 
    });

    // ========== STEP 4: JOIN VIDEO SESSION ==========
    console.log('🚀 Joining video session via API...');
    
    // Use the SMART join method that handles discovery
    const sessionData = await studentvideoApi.joinClassSession(classId, studentId, 'student');

    // Debug the response
    console.log('📥 API Response:', {
      success: sessionData?.success,
      hasToken: !!sessionData?.token,
      hasChannel: !!sessionData?.channel,
      hasAppId: !!sessionData?.appId,
      error: sessionData?.error,
      data: sessionData
    });

    if (!sessionData.success) {
      console.error('❌ Failed to join session via API:', sessionData.error);
      setSessionState({
        isInitialized: false,
        isJoined: false,
        error: sessionData.error || 'Failed to join video session. Please try again.'
      });
      return;
    }

    // Validate API response
    if (!sessionData.token || !sessionData.channel || !sessionData.appId) {
      console.error('❌ Invalid API response:', {
        hasToken: !!sessionData.token,
        hasChannel: !!sessionData.channel,
        hasAppId: !!sessionData.appId,
        data: sessionData
      });
      setSessionState({
        isInitialized: false,
        isJoined: false,
        error: 'Invalid server response. Please refresh and try again.'
      });
      return;
    }

    console.log('✅ Session credentials received:', {
      channel: sessionData.channel,
      tokenLength: sessionData.token?.length,
      appId: sessionData.appId,
      uid: sessionData.uid,
      teacherId: sessionData.teacher_id,
      sessionId: sessionData.session?.id
    });

    // ========== STEP 5: UPDATE STATE AND JOIN CHANNEL ==========
    setSessionState({
      isInitialized: true,
      isJoined: false,
      sessionInfo: sessionData,
      error: null
    });

    console.log('🔗 Joining Agora channel...');
    await joinChannel(sessionData);

  } catch (error) {
    console.error('❌ Initialization error:', {
      message: error.message,
      stack: error.stack,
      classId,
      studentId,
      timestamp: new Date().toISOString()
    });
    
    let errorMessage = 'Failed to join video session. ';
    
    if (error.message.includes('permission') || error.message.includes('403')) {
      errorMessage = 'Permission denied. Please contact support.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('No active session')) {
      errorMessage = 'No active session found. Teacher needs to start the session first.';
    } else {
      errorMessage += error.message || 'Please try again.';
    }

    setSessionState(prev => ({
      ...prev,
      isInitialized: false,
      error: errorMessage
    }));
  }
};

  // ============================================
  // Join Channel -
  // ============================================

 const joinChannel = async (sessionData) => {
  try {
    const { channel, token, uid, appId } = sessionData;

    console.log('🔗 Joining Agora channel with:', {
      channel,
      uid,
      appId: appId ? '✅' : '❌',
      token: token ? '✅' : '❌',
      sessionId: sessionData.session?.id
    });

    // Setup event listeners FIRST
    setupAgoraEventListeners();

    // Join channel
    await clientRef.current.join(appId, channel, token, uid);
    console.log('✅ Successfully joined channel');

    // Create and publish local tracks
    await createAndPublishLocalTracks();

    // Mark as joined
    setSessionState(prev => ({
      ...prev,
      isJoined: true
    }));

    // Start duration tracking
    startDurationTracking();
    
    // Update participant status in database
    await updateParticipantStatus({ status: 'joined' });

    // Start message polling if session has ID
    if (sessionData.session?.id) {
      startMessagePolling(sessionData.session.id);
    }

    console.log('🎉 STUDENT: Video session fully initialized and joined');

  } catch (error) {
    console.error('❌ Join channel error:', {
      message: error.message,
      channel: sessionData.channel,
      uid: sessionData.uid,
      timestamp: new Date().toISOString()
    });
    
    // Clean up on failure
    await performCompleteCleanup();
    
    throw new Error(`Failed to join video channel: ${error.message}`);
  }
};

  // ============================================
  // Device Detection
  // ============================================

  const detectAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      console.log('🔍 Available devices:', {
        cameras: cameras.length,
        microphones: microphones.length,
        cameraNames: cameras.map(c => c.label || 'Unnamed camera'),
        microphoneNames: microphones.map(m => m.label || 'Unnamed microphone')
      });
      
      setControls(prev => ({
        ...prev,
        hasCamera: cameras.length > 0,
        hasMicrophone: microphones.length > 0
      }));
      
      return { hasCamera: cameras.length > 0, hasMicrophone: microphones.length > 0 };
      
    } catch (error) {
      console.warn('⚠️ Device enumeration failed:', error);
      return { hasCamera: false, hasMicrophone: false };
    }
  };

  // ============================================
  // Agora Event Listeners - FIXED
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    if (!client) return;

    client.on('user-published', async (user, mediaType) => {
      console.log('👤 User published:', user.uid, mediaType);
      
      try {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          setRemoteTracks(prev => {
            const updated = new Map(prev);
            const existing = updated.get(user.uid) || {};
            updated.set(user.uid, { ...existing, video: user.videoTrack });
            return updated;
          });
          
          // Auto-play the video
          setTimeout(() => {
            const videoContainer = document.getElementById(`remote-video-${user.uid}`);
            if (videoContainer && user.videoTrack) {
              try {
                user.videoTrack.play(videoContainer);
              } catch (playError) {
                console.warn('Remote video play error:', playError);
              }
            }
          }, 100);
        }

        if (mediaType === 'audio') {
          setRemoteTracks(prev => {
            const updated = new Map(prev);
            const existing = updated.get(user.uid) || {};
            updated.set(user.uid, { ...existing, audio: user.audioTrack });
            return updated;
          });
          
          // Auto-play audio
          if (user.audioTrack) {
            try {
              user.audioTrack.play();
            } catch (playError) {
              console.warn('Remote audio play error:', playError);
            }
          }
        }

        updateParticipantCount();
        
      } catch (error) {
        console.error('Subscribe error:', error);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      console.log('👤 User unpublished:', user.uid, mediaType);
      
      if (mediaType === 'video') {
        setRemoteTracks(prev => {
          const updated = new Map(prev);
          const tracks = updated.get(user.uid);
          if (tracks) {
            updated.set(user.uid, { ...tracks, video: null });
          }
          return updated;
        });
      }
      updateParticipantCount();
    });

    client.on('user-left', (user) => {
      console.log('👤 User left:', user.uid);
      
      setRemoteTracks(prev => {
        const updated = new Map(prev);
        updated.delete(user.uid);
        return updated;
      });
      updateParticipantCount();
    });

    client.on('connection-state-change', (curState, prevState, reason) => {
      console.log('🔗 Connection state:', curState, reason);
      
      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        handleDisconnection(reason);
      }
    });

    client.on('network-quality', (quality) => {
      const qualityMap = {
        0: 'unknown',
        1: 'excellent',
        2: 'good',
        3: 'poor',
        4: 'poor',
        5: 'poor',
        6: 'poor'
      };

      setStats(prev => ({
        ...prev,
        connectionQuality: qualityMap[quality.uplinkNetworkQuality] || 'unknown'
      }));
    });

    client.on('token-privilege-will-expire', async () => {
      try {
        console.log('🔄 Token will expire, renewing...');
        const newToken = await studentvideoApi.generateToken(meetingId, studentId);
        if (newToken.token) {
          await client.renewToken(newToken.token);
        }
      } catch (error) {
        console.error('Token renewal error:', error);
      }
    });

    // Listen for stream-message (for teacher controls)
    client.on('stream-message', (uid, data) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(data));
        handleTeacherCommand(message);
      } catch (error) {
        console.error('Stream message error:', error);
      }
    });
  };

  // ============================================
  // Control Functions - UPDATED
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio && controls.hasMicrophone) {
      try {
        const newState = !controls.audioEnabled;
        await localTracks.audio.setEnabled(newState);
        setControls(prev => ({ ...prev, audioEnabled: newState }));
        
        // Update in database
        updateParticipantStatus({ audioEnabled: newState });
      } catch (error) {
        console.warn('Toggle audio error:', error);
      }
    } else {
      setControls(prev => ({ ...prev, audioEnabled: false }));
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video && controls.hasCamera) {
      try {
        const newState = !controls.videoEnabled;
        await localTracks.video.setEnabled(newState);
        setControls(prev => ({ ...prev, videoEnabled: newState }));
        
        // Update in database
        updateParticipantStatus({ videoEnabled: newState });
      } catch (error) {
        console.warn('Toggle video error:', error);
      }
    } else {
      setControls(prev => ({ ...prev, videoEnabled: false }));
    }
  };

  const toggleHandRaise = () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    // Send message to notify teacher
    if (sessionState.sessionInfo?.session?.id) {
      sendMessage(
        newState ? '✋ Raised hand' : 'Lowered hand',
        'system'
      );
    }
  };

  const leaveSession = async () => {
    try {
      // Update participant status
      await updateParticipantStatus({ status: 'left' });
      
      // Cleanup
      await cleanup();
      
      // Callback
      if (onLeaveCall) {
        onLeaveCall();
      }
    } catch (error) {
      console.error('Leave session error:', error);
    }
  };

  // ============================================
  // Teacher Commands Handler
  // ============================================

  const handleTeacherCommand = (command) => {
    console.log('📨 Teacher command:', command);
    
    switch (command.type) {
      case 'mute_all':
        if (localTracks.audio && controls.audioEnabled && controls.hasMicrophone) {
          toggleAudio();
          addSystemMessage('You have been muted by the host');
        }
        break;
      
      case 'end_session':
        addSystemMessage('Session ended by host');
        setTimeout(() => {
          leaveSession();
        }, 2000);
        break;
      
      case 'message':
        addSystemMessage(command.text);
        break;
      
      default:
        console.log('Unknown command:', command);
    }
  };

  // ============================================
  // Database Updates
  // ============================================

 const updateParticipantStatus = async (updates) => {
  try {
    if (!sessionState.sessionInfo?.session?.id) {
      console.warn('⚠️ No session ID available for status update');
      return;
    }

    const statusUpdate = {
      ...updates,
      timestamp: new Date().toISOString(),
      student_id: studentId,
      session_id: sessionState.sessionInfo.session.id
    };

    console.log('📊 Updating participant status:', statusUpdate);
    
    const result = await studentvideoApi.updateParticipantStatus(
      sessionState.sessionInfo.session.id,
      studentId,
      statusUpdate
    );

    if (!result.success) {
      console.warn('⚠️ Participant status update failed:', result.error);
    }

  } catch (error) {
    console.warn('⚠️ Participant status update error:', error.message);
    // Non-critical error, don't interrupt user experience
  }
};

const createAndPublishLocalTracks = async () => {
  try {
    console.log('🎤 Creating local audio/video tracks...');
    
    // Track creation with proper error handling
    const [audioTrack, videoTrack] = await Promise.allSettled([
      AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
        encoderConfig: {
          sampleRate: 48000,
          stereo: true
        }
      }).catch(error => {
        console.warn('⚠️ Failed to create audio track:', error.message);
        return null;
      }),
      
      AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 640,
          height: 480,
          frameRate: 15,
          bitrateMin: 500,
          bitrateMax: 1000
        },
        optimizationMode: 'motion'
      }).catch(error => {
        console.warn('⚠️ Failed to create video track:', error.message);
        return null;
      })
    ]);

    const audio = audioTrack.status === 'fulfilled' ? audioTrack.value : null;
    const video = videoTrack.status === 'fulfilled' ? videoTrack.value : null;

    // Update device availability
    setControls(prev => ({
      ...prev,
      hasMicrophone: !!audio,
      hasCamera: !!video,
      audioEnabled: !!audio,
      videoEnabled: !!video
    }));

    setLocalTracks({ audio, video });

    // Publish available tracks
    const tracksToPublish = [];
    if (audio) tracksToPublish.push(audio);
    if (video) tracksToPublish.push(video);
    
    if (tracksToPublish.length > 0) {
      await clientRef.current.publish(tracksToPublish);
      console.log(`📤 Published ${tracksToPublish.length} track(s)`);
    }

    // Play local video if available
    if (video) {
      try {
        const videoElement = document.getElementById('student-local-video');
        if (videoElement) {
          await video.play(videoElement);
        }
      } catch (playError) {
        console.warn('⚠️ Could not play local video:', playError.message);
      }
    }

    // Update participant status with device info
    await updateParticipantStatus({
      audioEnabled: !!audio,
      videoEnabled: !!video,
      devices: {
        hasMicrophone: !!audio,
        hasCamera: !!video
      }
    });

  } catch (error) {
    console.error('❌ Track creation/publishing error:', error);
    // Don't fail the session - allow student to join as listener
  }
};

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

  // ============================================
  // Duration Tracking
  // ============================================

  const startDurationTracking = () => {
    const startTime = Date.now();
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    durationIntervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setStats(prev => ({ ...prev, duration: diff }));
    }, 1000);
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // Chat Functions
  // ============================================

  const startMessagePolling = (sessionId) => {
    // Initial load
    loadMessages(sessionId);

    // Poll for new messages every 3 seconds
    messagesPollIntervalRef.current = setInterval(() => {
      loadMessages(sessionId);
    }, 3000);
  };

  const loadMessages = async (sessionId) => {
    try {
      const msgs = await studentvideoApi.getSessionMessages(sessionId);
      setMessages(prev => {
        const newIds = new Set(msgs.map(m => m.id));
        const existing = prev.filter(m => !newIds.has(m.id));
        return [...existing, ...msgs].sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        );
      });
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const sendMessage = async (text = null, type = 'text') => {
    const messageText = text || newMessage.trim();
    if (!messageText || !sessionState.sessionInfo?.session?.id) return;

    try {
      const message = await studentvideoApi.sendMessage(
        sessionState.sessionInfo.session.id,
        studentId,
        messageText,
        type
      );

      setMessages(prev => [...prev, message]);
      if (!text) setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      message_text: text,
      message_type: 'system',
      created_at: new Date().toISOString(),
      profiles: { full_name: 'System' }
    }]);
  };

  // ============================================
  // Disconnection Handling
  // ============================================

  const handleDisconnection = async (reason) => {
    console.warn('Disconnected:', reason);
    
    await updateParticipantStatus({ status: 'disconnected' });

    // Attempt reconnection
    if (reason === 'NETWORK_ERROR') {
      setTimeout(() => {
        if (sessionState.sessionInfo) {
          joinChannel(sessionState.sessionInfo);
        }
      }, 3000);
    }
  };

  // ============================================
  // Cleanup
  // ============================================

  const cleanup = async () => {
    console.log('🧹 Cleaning up student session...');
    
    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }

    // Stop and close tracks
    if (localTracks.audio) {
      try {
        localTracks.audio.stop();
        localTracks.audio.close();
      } catch (error) {
        console.warn('Audio cleanup error:', error);
      }
    }
    if (localTracks.video) {
      try {
        localTracks.video.stop();
        localTracks.video.close();
      } catch (error) {
        console.warn('Video cleanup error:', error);
      }
    }

    // Leave channel
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (error) {
        console.warn('Leave channel error:', error);
      }
    }

    // Clear remote tracks
    setRemoteTracks(new Map());
    
    console.log('✅ Cleanup complete');
  };

  // ============================================
  // Render - UPDATED
  // ============================================

// ============================================
// Render - FULL SCREEN MODAL VERSION
// ============================================

if (sessionState.error) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-2xl text-white max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4 text-red-400">Cannot Join Session</h2>
        <p className="mb-6 text-gray-300">{sessionState.error}</p>
        <button 
          onClick={() => onLeaveCall && onLeaveCall()}
          className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-xl font-semibold transition-all duration-200"
        >
          Go Back to Dashboard
        </button>
      </div>
    </div>
  );
}

if (!sessionState.isJoined) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <div className="relative">
          <div className="animate-spin h-20 w-20 border-b-2 border-cyan-500 rounded-full mx-auto mb-6"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="text-cyan-400 animate-pulse" size={32} />
          </div>
        </div>
        <h3 className="text-2xl font-semibold mb-3">Joining Madina Session...</h3>
        <p className="text-gray-400">Connecting to video call with teacher</p>
        <p className="text-cyan-300 text-sm mt-4">Meeting ID: {meetingId}</p>
      </div>
    </div>
  );
}

return (
  <div className="fixed inset-0 z-50 bg-black flex flex-col">
    {/* Header Bar */}
    <div className="bg-gray-900/90 backdrop-blur-xl border-b border-cyan-500/30 text-white p-4 md:p-6 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full ${
          stats.connectionQuality === 'good' || stats.connectionQuality === 'excellent' 
            ? 'bg-green-500 animate-pulse' 
            : 'bg-yellow-500'
        }`} />
        <div>
          <h2 className="font-bold text-lg md:text-xl">Madina Quran Class</h2>
          <div className="flex items-center gap-3 text-sm text-cyan-300">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatDuration(stats.duration)}
            </span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:flex items-center gap-1">
              <Users size={14} />
              {stats.participantCount} participant{stats.participantCount !== 1 ? 's' : ''}
            </span>
            <span>•</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              stats.connectionQuality === 'good' || stats.connectionQuality === 'excellent'
                ? 'bg-green-500/20 text-green-300'
                : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              {stats.connectionQuality}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setShowChat(!showChat)}
          className={`p-3 rounded-xl transition-all duration-200 ${
            showChat 
              ? 'bg-cyan-600 text-white' 
              : 'bg-gray-800 hover:bg-gray-700 text-cyan-300'
          }`}
          title="Toggle Chat"
        >
          <MessageCircle size={20} />
        </button>
        <button 
          onClick={leaveSession}
          className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 shadow-lg"
        >
          <PhoneOff size={18} />
          <span className="hidden sm:inline">Leave Session</span>
        </button>
      </div>
    </div>

    {/* Main Video Area */}
    <div className="flex-1 relative p-4 md:p-6">
      {/* Remote Videos Grid - Full Responsive */}
      <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from(remoteTracks.entries()).map(([uid, tracks]) => (
          <div key={uid} className="relative bg-gray-900 rounded-2xl overflow-hidden border border-cyan-500/20 group hover:border-cyan-500/40 transition-all duration-300">
            {/* Video Container */}
            <div 
              ref={el => {
                if (el && tracks.video) {
                  try {
                    tracks.video.play(el);
                  } catch (error) {
                    console.warn('Remote video play error:', error);
                  }
                }
              }}
              className="w-full h-full min-h-[200px] bg-gray-800"
            />
            
            {/* Placeholder if no video */}
            {!tracks.video && (
              <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="text-center">
                  <div className="text-5xl mb-3 opacity-50">👨‍🏫</div>
                  <p className="text-cyan-300 font-medium">Teacher</p>
                  <p className="text-gray-400 text-sm mt-1">Audio only</p>
                </div>
              </div>
            )}
            
            {/* Overlay Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex justify-between items-center">
                <div className="text-white">
                  <div className="font-semibold">Teacher</div>
                  <div className="text-sm text-cyan-300">Speaking now</div>
                </div>
                {tracks.audio && (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {remoteTracks.size === 0 && (
          <div className="col-span-full flex items-center justify-center">
            <div className="text-center text-gray-400 max-w-md">
              <div className="relative mb-6">
                <Video className="text-cyan-400 opacity-50 mx-auto" size={80} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-ping w-16 h-16 bg-cyan-500/30 rounded-full"></div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Waiting for teacher...</h3>
              <p className="text-lg mb-6">Teacher will appear here when they join the session</p>
              <div className="bg-gray-800/50 p-4 rounded-xl border border-cyan-500/20">
                <p className="text-cyan-300 text-sm">Your session is ready. Teacher can join anytime.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local Video PIP (Picture-in-Picture) */}
      {controls.hasCamera && (
        <div className="absolute bottom-6 right-6 w-64 h-48 md:w-80 md:h-60 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 transition-all duration-300 hover:border-cyan-500/50 hover:scale-105">
          {/* Video Container */}
          <div 
            id="student-local-video" 
            className="w-full h-full bg-gray-900"
          />
          
          {/* Camera Off State */}
          {!controls.videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <CameraOff className="text-gray-500 w-12 h-12 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Camera Off</p>
              </div>
            </div>
          )}
          
          {/* Overlay Info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
            <div className="flex justify-between items-center">
              <div className="text-white">
                <div className="font-semibold flex items-center gap-2">
                  You
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="text-sm text-cyan-300">
                  {controls.videoEnabled ? 'Live' : 'Camera Off'}
                </div>
              </div>
              
              <div className="flex gap-1">
                {!controls.audioEnabled && (
                  <div className="bg-red-500 p-2 rounded-lg">
                    <MicOff size={14} className="text-white" />
                  </div>
                )}
                {!controls.videoEnabled && (
                  <div className="bg-red-500 p-2 rounded-lg">
                    <CameraOff size={14} className="text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Controls Bar */}
    <div className="bg-gray-900/90 backdrop-blur-xl border-t border-cyan-500/30 p-4 md:p-6">
      <div className="flex items-center justify-center gap-3 md:gap-6">
        {/* Audio Toggle */}
        <button
          onClick={toggleAudio}
          disabled={!controls.hasMicrophone}
          className={`p-4 md:p-5 rounded-2xl transition-all duration-200 shadow-lg ${
            controls.audioEnabled 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
              : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={controls.hasMicrophone ? (controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone') : 'No microphone detected'}
        >
          {controls.audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        {/* Video Toggle */}
        <button
          onClick={toggleVideo}
          disabled={!controls.hasCamera}
          className={`p-4 md:p-5 rounded-2xl transition-all duration-200 shadow-lg ${
            controls.videoEnabled 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
              : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={controls.hasCamera ? (controls.videoEnabled ? 'Turn off camera' : 'Turn on camera') : 'No camera detected'}
        >
          {controls.videoEnabled ? <Camera size={24} /> : <CameraOff size={24} />}
        </button>

        {/* Hand Raise */}
        <button
          onClick={toggleHandRaise}
          className={`p-4 md:p-5 rounded-2xl transition-all duration-200 shadow-lg ${
            controls.handRaised 
              ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white animate-pulse' 
              : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
          }`}
          title={controls.handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand size={24} />
        </button>

        {/* More Options */}
        <button className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200 shadow-lg">
          <MoreVertical size={24} />
        </button>
      </div>
    </div>

    {/* Chat Sidebar */}
    {showChat && (
      <div className="absolute inset-y-0 right-0 w-full md:w-96 bg-gradient-to-b from-gray-900 to-gray-950 border-l border-cyan-500/30 flex flex-col shadow-2xl">
        {/* Chat Header */}
        <div className="p-6 border-b border-cyan-500/30 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl text-white">Madina Chat</h3>
            <p className="text-cyan-300 text-sm">Live discussion with teacher</p>
          </div>
          <button 
            onClick={() => setShowChat(false)}
            className="p-3 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <MessageCircle className="mx-auto mb-4 opacity-50" size={48} />
              <p className="text-lg font-semibold">No messages yet</p>
              <p className="text-sm mt-2">Be the first to say hello!</p>
            </div>
          ) : (
            messages.map(msg => (
              <div 
                key={msg.id} 
                className={`p-4 rounded-2xl ${
                  msg.message_type === 'system' 
                    ? 'bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/20' 
                    : 'bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-semibold text-white">
                        {msg.profiles?.full_name || 'System'}
                      </div>
                      {msg.message_type === 'system' && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-cyan-100">{msg.message_text}</p>
                    <p className="text-cyan-400 text-xs mt-3">
                      {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Message Input */}
        <div className="p-6 border-t border-cyan-500/30">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message here..."
              className="flex-1 bg-gray-800/50 border border-cyan-500/30 rounded-2xl px-5 py-4 text-white placeholder-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent backdrop-blur-lg"
            />
            <button 
              onClick={() => sendMessage()}
              disabled={!newMessage.trim()}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-4 rounded-2xl font-semibold text-white transition-all duration-200 shadow-lg"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}

// Remote Video Component - UPDATED

const RemoteVideo = ({ uid, tracks }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (tracks.video && videoRef.current) {
      try {
        tracks.video.play(videoRef.current);
      } catch (error) {
        console.warn('Remote video play error:', error);
      }
    }

    return () => {
      if (tracks.video) {
        try {
          tracks.video.stop();
        } catch (error) {
          console.warn('Remote video stop error:', error);
        }
      }
    };
  }, [tracks.video]);

  return (
    <div className="remote-video relative bg-gray-900 rounded-2xl overflow-hidden min-h-[200px]">
      <div ref={videoRef} className="w-full h-full bg-gray-800"></div>
      {!tracks.video && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="text-4xl mb-2 opacity-50">👨‍🏫</div>
            <p className="text-cyan-300">Teacher</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1 rounded-lg text-sm">
        Teacher
      </div>
    </div>
  );
};
export default StudentVideoCall;