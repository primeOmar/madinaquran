// src/pages/TeacherVideoCall.js - UPDATED WITH SAFE LOADING
import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './TeacherVideoCall.css';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  Share2, X, 
  Circle, Square, 
  MessageCircle, Users, 
  LogOut, PhoneOff, 
  Send, MessageSquare 
} from 'lucide-react';

// ============================================
// VIDEO API LOADER - SAME AS STUDENT
// ============================================

const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

// Create a direct video API instance (fallback if import fails)
const createDirectVideoApi = () => {
  console.log('🔄 Creating direct video API instance');
  
  const api = {
    // TEACHER-SPECIFIC METHODS
    startVideoSession: async (classId, userId) => {
      console.log('📡 TEACHER API: Starting video session for', { classId, userId });
      try {
        const response = await fetch(`${API_BASE_URL}/agora/start-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            class_id: classId,
            user_id: userId,
            role: 'teacher'
          })
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('❌ TEACHER API Error Response:', {
            status: response.status,
            data
          });
          throw new Error(data.error || `Failed to start video session: ${response.status}`);
        }

        if (!data.meeting_id || !data.channel || !data.token || !data.app_id) {
          throw new Error('Invalid response from server: missing required fields');
        }

        console.log('✅ TEACHER API: Video session started successfully');
        
        return {
          success: true,
          meetingId: data.meeting_id,
          channel: data.channel,
          token: data.token,
          appId: data.app_id,
          uid: data.uid || userId,
          session: data.session,
          class_title: data.class_title,
          role: 'teacher'
        };
      } catch (error) {
        console.error('❌ TEACHER API: startVideoSession failed:', error);
        return {
          success: false,
          error: error.message || 'Failed to start video session'
        };
      }
    },

    smartTeacherJoin: async (classId, teacherId) => {
      try {
        console.log('👨‍🏫 DIRECT API: SMART TEACHER JOIN:', { classId, teacherId });
        
        // First, try to find existing session for this class
        const sessionInfo = await api.getSessionByClassId(classId);
        
        console.log('📊 Session check result:', {
          exists: sessionInfo.exists,
          isActive: sessionInfo.isActive,
          meetingId: sessionInfo.meetingId,
          teacherId: sessionInfo.session?.teacher_id
        });

        if (sessionInfo.exists && sessionInfo.isActive) {
          // Found existing session
          console.log('✅ Found existing active session');
          
          if (sessionInfo.session?.teacher_id === teacherId) {
            // This teacher owns the session - join it
            console.log('👑 Teacher owns this session, joining...');
            return await api.joinVideoSession(sessionInfo.meetingId, teacherId, 'teacher');
          } else {
            // Different teacher owns it - create new
            console.log('⚠️ Different teacher owns this session, starting new...');
            return await api.startVideoSession(classId, teacherId);
          }
        }
        
        // No active session found, create new one
        console.log('🆕 No active session found, creating new...');
        return await api.startVideoSession(classId, teacherId);
        
      } catch (error) {
        console.error('❌ SMART TEACHER JOIN failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    getSessionByClassId: async (classId) => {
      console.log('🔍 DIRECT API: Getting session by class ID:', { classId });

      try {
        const response = await fetch(`${API_BASE_URL}/agora/session-by-class/${classId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        const data = await response.json();

        console.log('📊 DIRECT API: Session by class response:', {
          status: response.status,
          hasSession: !!data.session,
          sessionStatus: data.session?.status
        });

        if (!response.ok || !data.session) {
          return {
            success: false,
            exists: false,
            isActive: false,
            error: data.error || 'No active session for this class'
          };
        }

        const sessionExists = !!data.session;
        const isActive = data.session?.status === 'active';

        return {
          success: true,
          session: data.session,
          exists: sessionExists,
          isActive,
          meetingId: data.session?.meeting_id,
          channel: data.session?.channel_name,
          appId: data.session?.app_id,
          teacher_id: data.session?.teacher_id
        };

      } catch (error) {
        console.error('❌ DIRECT API: getSessionByClassId failed:', error);
        return {
          success: false,
          error: error.message,
          exists: false,
          isActive: false
        };
      }
    },

    joinVideoSession: async (meetingId, userId, role = 'student') => {
      console.log('🎓 DIRECT API: Joining video session:', { meetingId, userId, role });

      try {
        const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            meeting_id: meetingId.toString(),
            user_id: userId,
            role: role
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to join session: ${response.status}`);
        }

        return {
          success: true,
          meetingId: data.meeting_id || meetingId,
          channel: data.channel,
          token: data.token,
          appId: data.appId,
          uid: data.uid,
          session: data.session,
          role: role
        };

      } catch (error) {
        console.error('❌ DIRECT API: joinVideoSession failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },
    // SHARED METHODS (same as student)
    getSessionInfo: async (meetingId) => {
      console.log('📡 API: getSessionInfo for', meetingId);
      try {
        const response = await fetch(`${API_BASE_URL}/agora/session-info/${meetingId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        
        if (!response.ok) {
          return {
            success: false,
            error: data.error || 'Session not found',
            exists: false,
            isActive: false
          };
        }

        const sessionExists = !!data.session;
        const isActive = data.session?.status === 'active';
        
        return {
          success: true,
          session: data.session,
          exists: sessionExists,
          isActive,
          channel: data.session?.channel_name,
          appId: data.session?.app_id
        };
      } catch (error) {
        console.error('❌ API: getSessionInfo failed:', error);
        return {
          success: false,
          error: error.message,
          exists: false,
          isActive: false
        };
      }
    },

    getSessionParticipants: async (meetingId) => {
      console.log('👥 API: Getting session participants for', meetingId);
      try {
        const response = await fetch(`${API_BASE_URL}/agora/session-participants`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ meeting_id: meetingId })
        });
        
        const data = await response.json();
        return data.participants || [];
      } catch (error) {
        console.error('❌ API: getSessionParticipants failed:', error);
        return [];
      }
    },

    updateParticipantStatus: async (sessionId, userId, updates) => {
      console.log('📡 API: Updating participant status', { sessionId, userId, updates });
      try {
        const response = await fetch(`${API_BASE_URL}/agora/update-participant`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            session_id: sessionId,
            user_id: userId,
            ...updates
          })
        });

        const data = await response.json();
        return { success: response.ok, data };
      } catch (error) {
        console.error('❌ API: updateParticipantStatus failed:', error);
        return { success: false, error: error.message };
      }
    },

    sendMessage: async (sessionId, userId, message, type = 'text') => {
      console.log('💬 API: sendMessage', { sessionId, userId, message, type });
      try {
        const response = await fetch(`${API_BASE_URL}/agora/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            session_id: sessionId,
            user_id: userId,
            message_text: message,
            message_type: type
          })
        });
        const data = await response.json();
        return data.message || {
          id: Date.now(),
          message_text: message,
          message_type: type,
          created_at: new Date().toISOString(),
          user_id: userId
        };
      } catch (error) {
        console.error('❌ API: sendMessage failed:', error);
        return {
          id: Date.now(),
          message_text: message,
          message_type: type,
          created_at: new Date().toISOString(),
          user_id: userId,
          is_mock: true
        };
      }
    },

    startRecording: async (meetingId) => {
      console.log('🔴 API: startRecording for', meetingId);
      try {
        const response = await fetch(`${API_BASE_URL}/agora/start-recording`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ 
            session_id: meetingId, 
            user_id: localStorage.getItem('userId') 
          })
        });
        return await response.json();
      } catch (error) {
        console.error('❌ API: startRecording failed:', error);
        return { success: false, error: error.message };
      }
    },

    stopRecording: async (meetingId) => {
      console.log('⏹️ API: stopRecording for', meetingId);
      try {
        const response = await fetch(`${API_BASE_URL}/agora/stop-recording`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ 
            session_id: meetingId, 
            user_id: localStorage.getItem('userId') 
          })
        });
        return await response.json();
      } catch (error) {
        console.error('❌ API: stopRecording failed:', error);
        return { success: false, error: error.message };
      }
    },

    endVideoSession: async (meetingId, userId) => {
      console.log('🛑 TEACHER API: Ending video session', { meetingId, userId });
      try {
        const response = await fetch(`${API_BASE_URL}/agora/end-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: userId,
            role: 'teacher'
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to end session: ${response.status}`);
        }

        return {
          success: true,
          data
        };
      } catch (error) {
        console.error('❌ TEACHER API: endVideoSession failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    generateToken: async (meetingId, userId) => {
      console.log('🔄 API: generateToken', { meetingId, userId });
      try {
        const response = await fetch(`${API_BASE_URL}/agora/generate-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ meeting_id: meetingId, user_id: userId })
        });
        return await response.json();
      } catch (error) {
        console.error('❌ API: generateToken failed:', error);
        return { token: null, error: error.message };
      }
    }
  };
};

// Try to load the module, fallback to direct API
let videoApi = null;

try {
  // First try to import the module
  const module = require('../lib/agora/videoApi');
  videoApi = module.default;
  console.log('✅ TEACHER: Loaded videoApi from module');
} catch (importError) {
  console.log('⚠️ TEACHER: Module import failed, using direct API:', importError.message);
  videoApi = createDirectVideoApi();
}

// If still undefined, create a fallback
if (!videoApi) {
  console.log('⚠️ TEACHER: videoApi still undefined, creating fallback');
  videoApi = createDirectVideoApi();
}

// ============================================
// MAIN TEACHER VIDEO CALL COMPONENT
// ============================================

const TeacherVideoCall = ({ classId, teacherId, onEndCall }) => {
  // State Management (UNCHANGED)
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [participants, setParticipants] = useState([]);
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    screenSharing: false,
    recording: false,
    isChatOpen: false,
    isParticipantsOpen: false
  });

  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown'
  });

  // Enhanced chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [initialInteraction, setInitialInteraction] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Refs
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteUsersRef = useRef({});
  const controlsTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const videoApiRef = useRef(videoApi); // Store videoApi in ref

  // ============================================
  // USE EFFECTS (UNCHANGED)
  // ============================================

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };
    
    handleMouseMove();
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const onFirstInteraction = () => {
      console.log('[Agora] Initial user interaction detected');
      setInitialInteraction(true);
    };
    
    window.addEventListener('click', onFirstInteraction, { once: true });
    window.addEventListener('keydown', onFirstInteraction, { once: true });
    
    return () => {
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, []);

  // ============================================
  // INITIALIZATION (UPDATED TO USE videoApiRef.current)
  // ============================================

  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, teacherId]);

const initializeSession = async () => {
  if (isConnecting) return;
  
  try {
    setIsConnecting(true);
    console.log('🚀 TEACHER: Finding or joining video session for class:', classId);
    
    clientRef.current = AgoraRTC.createClient({ 
      mode: 'rtc', 
      codec: 'vp8' 
    });

    // ========== SIMPLE LOGIC ==========
    // First, try to find existing session for this class
    console.log('🔍 Checking for existing session...');
    const sessionInfo = await videoApiRef.current.getSessionByClassId(classId);
    
    console.log('📊 Session check result:', {
      exists: sessionInfo.exists,
      isActive: sessionInfo.isActive,
      meetingId: sessionInfo.meetingId,
      teacherId: sessionInfo.session?.teacher_id,
      currentTeacherId: teacherId
    });

    let sessionData;
    
    if (sessionInfo.exists && sessionInfo.isActive) {
      // Found existing session
      console.log('✅ Found existing active session');
      
      if (sessionInfo.session?.teacher_id === teacherId) {
        // This teacher owns the session - join it
        console.log('👑 Teacher owns this session, joining...');
        sessionData = await videoApiRef.current.joinVideoSession(
          sessionInfo.meetingId, 
          teacherId, 
          'teacher'
        );
      } else {
        // Different teacher owns it - create new
        console.log('⚠️ Different teacher owns this session, starting new...');
        sessionData = await videoApiRef.current.startVideoSession(classId, teacherId);
      }
    } else {
      // No active session found, create new one
      console.log('🆕 No active session found, creating new...');
      sessionData = await videoApiRef.current.startVideoSession(classId, teacherId);
    }

    if (!sessionData.success) {
      // Handle 429 errors specifically
      if (sessionData.error.includes('Too many requests')) {
        console.log('⏳ Rate limited, waiting 5 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Retry once
        const retryData = await videoApiRef.current.startVideoSession(classId, teacherId);
        if (!retryData.success) {
          throw new Error(retryData.error);
        }
        sessionData = retryData;
      } else {
        throw new Error(sessionData.error);
      }
    }

    console.log('🎯 Teacher session result:', {
      success: sessionData.success,
      meetingId: sessionData.meetingId,
      role: sessionData.role,
      exists: sessionInfo.exists
    });

    setSessionState({
      isInitialized: true,
      isJoined: false,
      sessionInfo: sessionData,
      error: null
    });

    await joinChannel(sessionData);

  } catch (error) {
    console.error('❌ TEACHER Initialization error:', error);
    
    // Handle rate limiting specifically
    if (error.message.includes('Too many requests') || 
        error.message.includes('429')) {
      console.log('⏳ Rate limited, retrying in 5 seconds...');
      setTimeout(() => {
        initializeSession();
      }, 5000);
    } else {
      setSessionState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize video session'
      }));
    }
  } finally {
    setIsConnecting(false);
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
  }
};

  const handleConnectionTimeout = async () => {
    console.log('[Agora] Connection timeout, attempting recovery...');
    try {
      await cleanup();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeSession();
    } catch (error) {
      console.error('[Agora] Recovery failed:', error);
    }
  };

  const joinChannel = async (sessionData) => {
  try {
    const { channel, token, uid, appId } = sessionData;
    
    console.log('🔗 TEACHER: Joining channel with details:', {
      channel,
      tokenLength: token?.length,
      uid,
      appId,
      isTeacher: sessionData.role === 'teacher',
      meetingId: sessionData.meetingId,
      teacherId: sessionData.teacher_id || teacherId
    });

    if (!channel || !token || !appId) {
      console.error('❌ Missing session credentials:', { channel, token, appId });
      throw new Error('Missing required session credentials');
    }
    
    console.log('[Agora] TEACHER: Joining channel...');
    
    setupAgoraEventListeners();
    
    const joinPromise = clientRef.current.join(appId, channel, token, uid);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Join timeout after 8 seconds')), 8000)
    );
    
    await Promise.race([joinPromise, timeoutPromise]);
    
    console.log('✅ TEACHER: Successfully joined channel', channel);
    
    // Get participants AFTER joining
    if (sessionData.meetingId) {
      await initializeParticipants(sessionData);
    }

    await createAndPublishTracks();

    setSessionState(prev => ({
      ...prev,
      isJoined: true
    }));

    startDurationTracking();

  } catch (error) {
    console.error('❌ TEACHER Join channel error:', error);
    
    if (error.message.includes('timeout')) {
      console.log('[Agora] Retrying connection...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await joinChannel(sessionData);
    } else {
      throw error;
    }
  }
};

 const initializeParticipants = async (sessionData) => {
  const meetingId = sessionData.meetingId || sessionData.meeting_id;
  if (meetingId) {
    console.log('👥 TEACHER: Initializing participants for meeting:', meetingId);
    
    // Immediate check for existing participants
    try {
      const participants = await videoApiRef.current.getSessionParticipants(meetingId);
      console.log('📊 Existing participants found:', participants);
      
      if (participants.length > 0) {
        setParticipants(participants);
        
        // Check if any students are already in the session
        const studentsInSession = participants.filter(p => p.role === 'student');
        console.log(`🎓 ${studentsInSession.length} students already in session`);
        
        if (studentsInSession.length > 0) {
          // Show notification
          console.log('📢 Students waiting for teacher:', 
            studentsInSession.map(s => s.profile?.name || s.user_id));
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch initial participants:', error);
    }
    
    startParticipantTracking(meetingId);
    startChatPolling(meetingId);
  }
};

  // ============================================
  // TRACK FUNCTIONS (UNCHANGED)
  // ============================================

  const createAndPublishTracks = async () => {
    try {
      console.log('[Agora] TEACHER: Creating local tracks...');

      const [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack().catch(error => {
          console.warn('[Agora] Could not create audio track:', error);
          return null;
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: '480p',
          optimizationMode: 'motion'
        }).catch(error => {
          console.warn('[Agora] Could not create video track:', error);
          return null;
        })
      ]);

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      if (videoTrack && localVideoRef.current) {
        setTimeout(() => {
          playLocalVideo(videoTrack);
        }, 100);
      }

      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);
      
      if (tracksToPublish.length > 0) {
        await clientRef.current.publish(tracksToPublish);
        console.log('[Agora] TEACHER: 📤 Published tracks');
      }

    } catch (error) {
      console.error('[Agora] TEACHER: Error creating/publishing tracks:', error);
    }
  };

  const playLocalVideo = async (track) => {
    if (!track || !localVideoRef.current) return;
    
    try {
      await track.play(localVideoRef.current);
      console.log('[Agora] TEACHER: ✅ Video track playing successfully');
      
      if (localVideoRef.current) {
        localVideoRef.current.style.transform = 'scaleX(-1)';
        localVideoRef.current.style.objectFit = 'cover';
        localVideoRef.current.style.width = '100%';
        localVideoRef.current.style.height = '100%';
        localVideoRef.current.style.borderRadius = '8px';
      }
    } catch (playError) {
      console.error('[Agora] TEACHER: ❌ Video play error:', playError);
      if (playError.name === 'NotAllowedError') {
        console.log('[Agora] TEACHER: Waiting for user interaction...');
      }
    }
  };

  // ============================================
  // USE EFFECTS FOR TRACKS (UNCHANGED)
  // ============================================

  useEffect(() => {
    const track = localTracks.video;
    const videoElement = localVideoRef.current;

    if (!track || !videoElement) return;

    if (controls.videoEnabled) {
      track.setEnabled(true).catch(e => 
        console.warn('[Agora] Video enable failed:', e)
      );
      
      if (!track.isPlaying) {
        setTimeout(() => {
          playLocalVideo(track);
        }, 50);
      }
    } else {
      track.setEnabled(false).catch(e => 
        console.warn('[Agora] Video disable failed:', e)
      );
    }
  }, [controls.videoEnabled, localTracks.video]);

  useEffect(() => {
    if (initialInteraction && localTracks.video && !localTracks.video.isPlaying) {
      console.log('[Agora] User interacted, playing video...');
      playLocalVideo(localTracks.video);
    }
  }, [initialInteraction, localTracks.video]);

  useEffect(() => {
    const track = localTracks.audio;
    if (!track) return;
    track.setEnabled(controls.audioEnabled).catch((e) => 
      console.warn('[Agora] Audio toggle failed:', e)
    );
  }, [controls.audioEnabled, localTracks.audio]);

  // ============================================
  // CONTROL FUNCTIONS (UPDATED TO USE videoApiRef.current)
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      try {
        const newState = !controls.audioEnabled;
        await localTracks.audio.setEnabled(newState);
        setControls(prev => ({ ...prev, audioEnabled: newState }));
        console.log(`[Agora] TEACHER: Audio ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('[Agora] TEACHER: Toggle audio error:', error);
      }
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      try {
        const newState = !controls.videoEnabled;
        setControls(prev => ({ ...prev, videoEnabled: newState }));
        console.log(`[Agora] TEACHER: Video ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('[Agora] TEACHER: Toggle video error:', error);
      }
    } else {
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish([videoTrack]);
        
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        console.log('[Agora] TEACHER: Video enabled');
      } catch (error) {
        console.error('[Agora] TEACHER: Cannot access camera:', error);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '720p',
          optimizationMode: 'detail'
        });
        
        if (localTracks.video) {
          await clientRef.current.unpublish([localTracks.video]);
          localTracks.video.stop();
          localTracks.video.close();
        }
        
        await clientRef.current.publish([screenTrack]);
        
        setLocalTracks(prev => ({ 
          ...prev, 
          video: screenTrack 
        }));
        
        if (localVideoRef.current) {
          screenTrack.play(localVideoRef.current);
        }
        
        setControls(prev => ({ ...prev, screenSharing: true }));
        console.log('[Agora] TEACHER: Screen sharing started');
        
      } else {
        const screenTrack = localTracks.video;
        
        if (screenTrack) {
          await clientRef.current.unpublish([screenTrack]);
          screenTrack.stop();
          screenTrack.close();
        }
        
        try {
          const cameraTrack = await AgoraRTC.createCameraVideoTrack();
          await clientRef.current.publish([cameraTrack]);
          
          if (localVideoRef.current) {
            cameraTrack.play(localVideoRef.current);
          }
          
          setLocalTracks(prev => ({ 
            ...prev, 
            video: cameraTrack 
          }));
          
          setControls(prev => ({ 
            ...prev, 
            videoEnabled: true,
            screenSharing: false 
          }));
          
          console.log('[Agora] TEACHER: Screen sharing stopped, camera restored');
        } catch (cameraError) {
          console.error('[Agora] TEACHER: Cannot access camera:', cameraError);
          setControls(prev => ({ 
            ...prev, 
            videoEnabled: false,
            screenSharing: false 
          }));
        }
      }
    } catch (error) {
      console.error('[Agora] TEACHER: Screen share error:', error);
      setControls(prev => ({ ...prev, screenSharing: false }));
    }
  };

  const toggleRecording = async () => {
    try {
      const newState = !controls.recording; 
      if (newState) { 
        // USE videoApiRef.current
        await videoApiRef.current.startRecording(sessionState.sessionInfo.meetingId);
        console.log('[Agora] TEACHER: Recording started');
      } else {
        // USE videoApiRef.current
        await videoApiRef.current.stopRecording(sessionState.sessionInfo.meetingId);
        console.log('[Agora] TEACHER: Recording stopped');
      }
      setControls(prev => ({ ...prev, recording: newState }));
    } catch (error) {
      console.error('[Agora] TEACHER: Toggle recording error:', error);
    } 
  };

  const leaveSession = async () => {
    try {
      setIsLeaving(true); 
      await cleanup();
      setIsLeaving(false);
      if (onEndCall) onEndCall(false); 
    } catch (error) {
      console.error('[Agora] TEACHER: Leave session error:', error);
      setIsLeaving(false);
    }
  };

  const endSession = async () => {  
    try {
      setIsEnding(true); 
      // USE videoApiRef.current
      await videoApiRef.current.endVideoSession(sessionState.sessionInfo.meetingId);
      await cleanup();
      setIsEnding(false);
      if (onEndCall) onEndCall(true); 
    } catch (error) {
      console.error('[Agora] TEACHER: End session error:', error);
      setIsEnding(false);
    }
  };

  // ============================================
  // HELPER FUNCTIONS (UPDATED TO USE videoApiRef.current)
  // ============================================

  const startParticipantTracking = (meetingId) => {
    if (participantUpdateIntervalRef.current) {
      clearInterval(participantUpdateIntervalRef.current);
    }
    
    const fetchParticipants = async () => {
      try {
        // USE videoApiRef.current
        const participants = await videoApiRef.current.getSessionParticipants(meetingId);
        setParticipants(participants || []);
        setStats(prev => ({ 
          ...prev, 
          participantCount: (clientRef.current?.remoteUsers?.length || 0) + 1 
        }));
      } catch (error) {
        console.error('[Agora] TEACHER: Participant tracking error:', error);
      }
    };
    
    fetchParticipants();
    participantUpdateIntervalRef.current = setInterval(fetchParticipants, 10000);
  };

  const sendMessage = async () => {
    const messageText = newMessage.trim();
    if (!messageText) return;
    
    const tempMessage = {
      id: Date.now().toString(),
      senderId: teacherId,
      senderName: 'Teacher',
      text: messageText,
      timestamp: new Date().toISOString(),
      isOwn: true,
      status: 'sent'
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();
    
    simulateStudentResponse(messageText);
  };

  const simulateStudentResponse = (teacherMessage) => {
    const responses = ["Yes", "Understood", "Thank you", "Got it"];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    setTimeout(() => {
      const studentMessage = {
        id: Date.now().toString(),
        senderId: 'student',
        senderName: 'Student',
        text: randomResponse,
        timestamp: new Date().toISOString(),
        isOwn: false
      };
      
      setMessages(prev => [...prev, studentMessage]);
      scrollToBottom();
    }, 1000);
  };

  const startChatPolling = (meetingId) => {
    const interval = setInterval(() => {}, 10000);
    return () => clearInterval(interval);
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }, 100);
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

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

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

  const cleanup = async () => {
    console.log('[Agora] TEACHER: Cleaning up...');
    
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    
    try {
      if (localTracks.audio) {
        await clientRef.current?.unpublish([localTracks.audio]).catch(() => {});
        localTracks.audio.stop();
        localTracks.audio.close();
      }
      if (localTracks.video) {
        await clientRef.current?.unpublish([localTracks.video]).catch(() => {});
        localTracks.video.stop();
        localTracks.video.close();
      }
    } catch (e) {
      console.warn('[Agora] TEACHER: Cleanup warning:', e);
    }
    
    if (clientRef.current) {
      await clientRef.current.leave();
    }
    
    Object.values(remoteUsersRef.current).forEach(userData => {
      if (userData.container) {
        userData.container.remove();
      }
    });
    remoteUsersRef.current = {};
    
    setLocalTracks({ audio: null, video: null });
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // EVENT LISTENERS (UNCHANGED)
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    client.on('user-published', async (user, mediaType) => {
      console.log('[Agora] TEACHER: User published:', user.uid, mediaType);
      
      try {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          const videoContainer = document.createElement('div');
          videoContainer.id = `remote-video-${user.uid}`;
          videoContainer.className = 'remote-video-container';
          
          const videoElement = document.createElement('video');
          videoElement.id = `video-${user.uid}`;
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.className = 'remote-video-element';
          
          videoContainer.appendChild(videoElement);
          
          const remoteVideosGrid = document.querySelector('.remote-videos-grid');
          if (remoteVideosGrid) {
            remoteVideosGrid.appendChild(videoContainer);
          }
          
          user.videoTrack.play(videoElement);
          remoteUsersRef.current[user.uid] = { container: videoContainer, videoElement };
        }
        
        if (mediaType === 'audio') {
          user.audioTrack.play();
        }
      } catch (error) {
        console.warn('[Agora] TEACHER: Failed to handle user-published:', error);
      }
      
      updateParticipantCount();
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') {
        const userData = remoteUsersRef.current[user.uid];
        if (userData && userData.container) {
          userData.container.remove();
          delete remoteUsersRef.current[user.uid];
        }
      }
      updateParticipantCount();
    });

    client.on('user-left', (user) => {
      const userData = remoteUsersRef.current[user.uid];
      if (userData && userData.container) {
        userData.container.remove();
        delete remoteUsersRef.current[user.uid];
      }
      updateParticipantCount();
    });
  };

  // ============================================
  // RENDER FUNCTIONS (UNCHANGED)
  // ============================================

  const renderMessage = (msg) => (
    <div 
      key={msg.id} 
      className={`message-wrapper ${msg.isOwn ? 'own-message' : 'other-message'}`}
    >
      <div className="message-content">
        {!msg.isOwn && (
          <div className="message-sender">
            {msg.senderName}
          </div>
        )}
        
        <div className="message-bubble">
          <div className="message-text">
            {msg.text}
          </div>
          
          <div className="message-footer">
            <span className="message-time">
              {formatTime(msg.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER COMPONENT (UNCHANGED)
  // ============================================

  if (sessionState.error) {
    return (
      <div className="video-call-error">
        <div className="error-container">
          <h2>Session Error</h2>
          <p>{sessionState.error}</p>
          <button onClick={initializeSession} className="retry-button">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!sessionState.isJoined) {
    return (
      <div className="video-call-loading">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{isConnecting ? 'Connecting to video session...' : 'Preparing session...'}</p>
          <small>This may take a moment</small>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container futuristic-theme">
      {/* Minimal Header */}
      <div className={`call-header ${showControls ? 'visible' : 'hidden'}`}>
        <div className="header-left">
          <div className="session-info">
            <h2 className="class-title">{sessionState.sessionInfo?.session?.class_title || 'Video Class'}</h2>
            <div className="header-stats">
              <span className="stat-chip">
                <span className="stat-icon">⏱️</span>
                {formatDuration(stats.duration)}
              </span>
              <span className="stat-chip">
                <span className="stat-icon">👥</span>
                {stats.participantCount}
              </span>
              {controls.recording && (
                <span className="recording-indicator">
                  <span className="recording-dot"></span>
                  REC
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="video-main-area">
        {/* Local Video */}
        <div className="local-video-container floating-video">
          <div className="video-wrapper">
            <div className="video-container" style={{
              display: 'block',
              position: 'relative',
              width: '100%',
              height: '100%',
              backgroundColor: controls.videoEnabled ? 'transparent' : '#1a1a2e',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <video
                ref={localVideoRef}
                id="local-video"
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: controls.videoEnabled ? 'block' : 'none',
                  transform: 'scaleX(-1)',
                  borderRadius: '8px'
                }}
              />
              
              {!controls.videoEnabled && (
                <div className="video-placeholder" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1a1a2e',
                  borderRadius: '8px'
                }}>
                  <div className="user-avatar" style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>
                    <span>YOU</span>
                  </div>
                </div>
              )}
              
              <div className="video-status-overlay" style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                right: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!controls.videoEnabled && (
                    <span className="status-tag" style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <VideoOff size={12} />
                      Camera Off
                    </span>
                  )}
                  {controls.screenSharing && (
                    <span className="status-tag" style={{
                      background: 'rgba(59, 130, 246, 0.8)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Share2 size={12} />
                      Screen Sharing
                    </span>
                  )}
                </div>
                <span className="name-tag" style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  Host (You)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Remote Videos Grid */}
        <div className="remote-videos-grid">
          {/* Remote videos are added dynamically here */}
        </div>
      </div>

      {/* Floating Controls */}
      <div className={`floating-controls ${showControls ? 'visible' : 'hidden'}`}>
        <div className="control-center">
          <div className="primary-controls">
            <button 
              className={`control-orb audio-orb ${controls.audioEnabled ? 'active' : 'muted'}`}
              onClick={toggleAudio}
              title={controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              <span className="orb-icon">
                {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </span>
            </button>

            <button 
              className={`control-orb video-orb ${controls.videoEnabled ? 'active' : 'inactive'}`}
              onClick={toggleVideo}
              title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <span className="orb-icon">
                {controls.videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </span>
            </button>

            <button 
              className={`control-orb screen-orb ${controls.screenSharing ? 'active' : ''}`}
              onClick={toggleScreenShare}
              title={controls.screenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <span className="orb-icon">
                <Share2 size={20} />
              </span>
            </button>

            <button 
              className={`control-orb record-orb ${controls.recording ? 'recording' : ''}`}
              onClick={toggleRecording}
              title={controls.recording ? 'Stop recording' : 'Start recording'}
            >
              <span className="orb-icon">
                {controls.recording ? (
                  <Circle size={20} fill="currentColor" />
                ) : (
                  <Circle size={20} />
                )}
              </span>
            </button>
          </div>

          <div className="secondary-controls">
            <button 
              className={`control-button chat-btn ${controls.isChatOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }))}
              title="Toggle chat"
            >
              <span className="btn-icon">
                <MessageCircle size={18} />
              </span>
            </button>

            <button 
              className={`control-button participants-btn ${controls.isParticipantsOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }))}
              title="Show participants"
            >
              <span className="btn-icon">
                <Users size={18} />
              </span>
            </button>

            <div className="action-buttons">
              <button 
                className="control-button leave-btn"
                onClick={leaveSession}
                disabled={isLeaving}
                title="Leave the call (others can continue)"
              >
                <span className="btn-icon">
                  <LogOut size={18} />
                </span>
                <span className="btn-text">{isLeaving ? '...' : 'Leave'}</span>
              </button>

              <button 
                className="control-button end-btn"
                onClick={endSession}
                disabled={isEnding}
                title="End call for everyone"
              >
                <span className="btn-icon">
                  <PhoneOff size={18} />
                </span>
                <span className="btn-text">{isEnding ? '...' : 'End'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {controls.isChatOpen && (
        <div className="minimal-chat-panel">
          <div className="chat-header">
            <h3>Chat ({messages.length})</h3>
            <button 
              className="close-chat"
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: false }))}
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="chat-messages" ref={chatContainerRef}>
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="empty-icon">
                  <MessageSquare size={48} />
                </div>
                <p>No messages yet</p>
              </div>
            ) : (
              messages.map(renderMessage)
            )}
          </div>
          
          <div className="chat-input-compact">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="send-btn-mini"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
      
      {/* Autoplay Hint */}
      {!initialInteraction && (
        <div className="autoplay-hint">
          <p>Click anywhere to allow video playback</p>
        </div>
      )}
    </div>
  );
};

export default TeacherVideoCall;