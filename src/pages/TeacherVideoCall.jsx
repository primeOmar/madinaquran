// src/pages/TeacherVideoCall.js - FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './TeacherVideoCall.css';
import videoApi from '../lib/agora/videoApi'
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
// MAIN TEACHER VIDEO CALL COMPONENT
// ============================================
const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

const RemoteVideoPlayer = ({ user }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !user.videoTrack) return;

    const playVideo = async () => {
      try {
        // Stop any existing track first to prevent conflicts
        if (user.videoTrack.isPlaying) {
          user.videoTrack.stop();
        }
        // Play the video track on the DOM element
        await user.videoTrack.play(videoRef.current);
        console.log(`✅ RemoteVideoPlayer: Playing video for user ${user.uid}`);
      } catch (playError) {
        console.warn(`⚠️ Could not play video for user ${user.uid}:`, playError);
      }
    };

    playVideo();

    // Cleanup function
    return () => {
      if (user.videoTrack && user.videoTrack.isPlaying) {
        console.log(`🧹 RemoteVideoPlayer: Cleaning up video for user ${user.uid}`);
        user.videoTrack.stop();
      }
    };
  }, [user.videoTrack, user.uid]); // Re-run if the track or UID changes

  return (
    <div 
      ref={containerRef}
      className="remote-video-player"
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        backgroundColor: '#1a1a2e',
        borderRadius: '8px', 
        overflow: 'hidden' 
      }}
    >
      {/* Video Element */}
      <div
        ref={videoRef}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Fallback UI when no video track */}
      {!user.videoTrack && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#a5b4fc'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            fontSize: '24px'
          }}>
            🎓
          </div>
          <p style={{ fontSize: '14px', fontWeight: '500' }}>Student {user.uid}</p>
          <p style={{ fontSize: '12px', marginTop: '4px', color: '#64748b' }}>
            {user.audioTrack ? 'Audio only' : 'No media'}
          </p>
        </div>
      )}
      
      {/* Overlay with user info */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        Student {user.uid}
      </div>
    </div>
  );
};

const TeacherVideoCall = ({ classId, teacherId, onEndCall }) => {
  // Debug logging
  console.log('🔧 TEACHER: Component rendering with:', {
    classId,
    teacherId,
    videoApiAvailable: !!videoApi,
    hasMethods: videoApi ? Object.keys(videoApi).length : 0
  });


  // State Management
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });
  const [participants, setParticipants] = useState([]);
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteUsers, setRemoteUsers] = useState(new Map());
  
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

  // Refs - Initialize with the already loaded videoApi
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteUsersRef = useRef({});
  const controlsTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const videoApiRef = useRef(videoApi); 
  const isMounted = useRef(true);

  // ============================================
  // USE EFFECTS
  // ============================================
  useEffect(() => {
  console.log('👥 TEACHER: Remote users state updated:', {
    count: remoteUsers.size,
    uids: Array.from(remoteUsers.keys()),
    details: Array.from(remoteUsers.entries()).map(([uid, user]) => ({
      uid,
      hasVideo: !!user.videoTrack,
      hasAudio: !!user.audioTrack
    }))
  });
}, [remoteUsers]);

useEffect(() => {
    isMounted.current = true;

    // Check if videoApi is ready
    if (!videoApiRef.current) {
      setSessionState(prev => ({ ...prev, error: 'Video API not initialized.' }));
      return;
    }

    initializeSession();
    
    // cleanup
    return () => {
      isMounted.current = false;
      cleanup();
    };
  }, [classId, teacherId]);

useEffect(() => {
  if (clientRef.current && sessionState.isJoined) {
    const interval = setInterval(() => {
      const remoteUsersList = clientRef.current.remoteUsers || [];
      console.log('🔍 TEACHER: Agora client state check:', {
        remoteUsersCount: remoteUsersList.length,
        remoteUIDs: remoteUsersList.map(u => u.uid),
        localUID: clientRef.current.uid,
        channelName: clientRef.current.channelName
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }
}, [sessionState.isJoined]);



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

  useEffect(() => {
    // Check if videoApiRef is initialized
    if (!videoApiRef.current) {
      console.error('❌ TEACHER: videoApiRef is not initialized!');
      setSessionState(prev => ({
        ...prev,
        error: 'Video API not initialized. Please refresh the page.'
      }));
      return;
    }

    console.log('✅ TEACHER: Initializing session with videoApiRef:', {
      hasGetSessionByClassId: !!videoApiRef.current.getSessionByClassId,
      methods: Object.keys(videoApiRef.current)
    });

    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, teacherId]);

  // ============================================
  // INITIALIZATION - FIXED
  // ============================================

const initializeSession = async () => {
    // Prevent double-call or call if already connecting
    if (isConnecting || sessionState.isJoined) return;
    
    try {
      setIsConnecting(true);
      console.log('🚀 TEACHER: Starting session initialization...');
      
      // Step A: Create Client
      // IMPORTANT: Create client immediately to ensure it exists
      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      }

      // Step B: Call Backend (With Timeout Warning)
      console.log('🔄 Requesting session from backend...');
      
      // Show "Waking up server" message if it takes > 3 seconds (Common on Render)
      const slowServerTimeout = setTimeout(() => {
        if (isMounted.current) {
          setSessionState(prev => ({ 
            ...prev, 
            error: "Connecting to server... (This might take a minute if the server is waking up)" 
          }));
        }
      }, 3000);

      const sessionData = await videoApi.startVideoSession(classId, teacherId);
      clearTimeout(slowServerTimeout);

      if (!isMounted.current) return; // Stop if user left

      // Clear the "Waking up" message if it was shown
      setSessionState(prev => ({ ...prev, error: null }));

      if (!sessionData.success) throw new Error(sessionData.error || 'Failed to start session');

      // Step C: Validate Data
      if (!sessionData.token || !sessionData.appId || !sessionData.channel) {
        throw new Error('Invalid session data received from server');
      }

      // Step D: Update State
      setSessionState(prev => ({
        ...prev,
        isInitialized: true,
        sessionInfo: sessionData
      }));

      // Step E: Join Agora
      await joinChannel(sessionData);

    } catch (error) {
      console.error('❌ TEACHER Initialization error:', error);
      if (isMounted.current) {
        setSessionState(prev => ({
          ...prev,
          error: `Connection Failed: ${error.message}`
        }));
      }
    } finally {
      if (isMounted.current) {
        setIsConnecting(false);
      }
    }
  };
const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;
      
      if (!clientRef.current) return;

      console.log('🔗 Joining Agora Channel...');

      // Join Channel
      const assignedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );
      
      if (!isMounted.current) {
        await clientRef.current.leave();
        return;
      }

      console.log('✅ Joined Channel as:', assignedUid);
      
      // Create Tracks (With Timeout for Permissions)
      await createAndPublishTracks();

      if (isMounted.current) {
        setSessionState(prev => ({ ...prev, isJoined: true }));
        startDurationTracking();
        setupAgoraEventListeners();
      }

    } catch (error) {
      console.error('❌ Join Error:', error);
      throw new Error(error.message || 'Failed to join video channel');
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
  // TRACK FUNCTIONS
  // ============================================

 const createAndPublishTracks = async () => {
  try {
    console.log('🎥 TEACHER: Creating local tracks...');

    // Create tracks with error handling
    let audioTrack = null;
    let videoTrack = null;
    
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'music_standard',
      });
      console.log('✅ Audio track created');
    } catch (audioError) {
      console.warn('⚠️ Could not create audio track:', audioError);
    }
    
    try {
      videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: '480p_1',
        optimizationMode: 'motion'
      });
      console.log('✅ Video track created');
    } catch (videoError) {
      console.warn('⚠️ Could not create video track:', videoError);
    }

    // Update state
    setLocalTracks({ audio: audioTrack, video: videoTrack });

    // Publish tracks to channel
    const tracksToPublish = [];
    if (audioTrack) tracksToPublish.push(audioTrack);
    if (videoTrack) tracksToPublish.push(videoTrack);
    
    if (tracksToPublish.length > 0) {
      console.log(`📤 Publishing ${tracksToPublish.length} track(s)...`);
      await clientRef.current.publish(tracksToPublish);
      console.log('✅ Tracks published successfully');
    } else {
      console.warn('⚠️ No tracks to publish');
    }

    // Play video locally
    if (videoTrack && localVideoRef.current) {
      try {
        await videoTrack.play(localVideoRef.current);
        if (localVideoRef.current) {
          localVideoRef.current.style.transform = 'scaleX(-1)';
        }
        console.log('✅ Local video playing');
      } catch (playError) {
        console.warn('⚠️ Video playback requires user interaction');
      }
    }

  } catch (error) {
    console.error('❌ TEACHER: Error creating/publishing tracks:', error);
    // Don't throw - partial success is OK
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
  // USE EFFECTS FOR TRACKS
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
  // CONTROL FUNCTIONS
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
        await videoApi.startRecording(sessionState.sessionInfo.meetingId);
        console.log('[Agora] TEACHER: Recording started');
      } else {
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
      await videoApi.endVideoSession(sessionState.sessionInfo.meetingId);
      await cleanup();
      setIsEnding(false);
      if (onEndCall) onEndCall(true); 
    } catch (error) {
      console.error('[Agora] TEACHER: End session error:', error);
      setIsEnding(false);
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const startParticipantTracking = (meetingId) => {
    if (participantUpdateIntervalRef.current) {
      clearInterval(participantUpdateIntervalRef.current);
    }
    
    const fetchParticipants = async () => {
      try {
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
  const remoteUserCount = clientRef.current?.remoteUsers?.length || 0;
  const totalCount = remoteUserCount + 1; // +1 for teacher
  
  console.log('👥 TEACHER: Participant count update:', {
    remote: remoteUserCount,
    total: totalCount,
    remoteUIDs: clientRef.current?.remoteUsers?.map(u => u.uid)
  });
  
  setStats(prev => ({
    ...prev,
    participantCount: totalCount
  }));
};

  const cleanup = async () => {
  console.log('🧹 TEACHER: Cleaning up session...');
  
  // Clear intervals
  if (durationIntervalRef.current) {
    clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = null;
  }
  
  if (participantUpdateIntervalRef.current) {
    clearInterval(participantUpdateIntervalRef.current);
    participantUpdateIntervalRef.current = null;
  }
  
  // Stop and cleanup local tracks
  if (localTracks.audio) {
    try {
      await clientRef.current?.unpublish([localTracks.audio]);
      localTracks.audio.stop();
      localTracks.audio.close();
    } catch (e) {}
  }
  
  if (localTracks.video) {
    try {
      await clientRef.current?.unpublish([localTracks.video]);
      localTracks.video.stop();
      localTracks.video.close();
    } catch (e) {}
  }
  
  // Leave the channel
  if (clientRef.current) {
    try {
      await clientRef.current.leave();
    } catch (e) {}
  }
  
  // Clear state
  setLocalTracks({ audio: null, video: null });
  setSessionState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });
};

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // EVENT LISTENERS
  // ============================================
const setupAgoraEventListeners = () => {
  const client = clientRef.current;
  if (!client) {
    console.error('❌ Client not initialized for event listeners');
    return;
  }

  console.log('👂 Setting up Agora event listeners...');

  // 1. USER PUBLISHED (Student Joins & Publishes Media)
  client.on('user-published', async (remoteUser, mediaType) => {
    console.log('👤 TEACHER: User published - Attempting subscription:', {
      uid: remoteUser.uid,
      mediaType,
      hasVideo: !!remoteUser.videoTrack,
      hasAudio: !!remoteUser.audioTrack
    });

    try {
      // Subscribe to the remote user's media
      await client.subscribe(remoteUser, mediaType);
      console.log(`✅ TEACHER: Successfully subscribed to user ${remoteUser.uid} for ${mediaType}`);

      // Update React state using a functional update to ensure consistency
      setRemoteUsers(prev => {
        const updated = new Map(prev);
        const existingUser = updated.get(remoteUser.uid) || { uid: remoteUser.uid };

        if (mediaType === 'video') {
          existingUser.videoTrack = remoteUser.videoTrack;
          console.log(`📹 TEACHER: Video track added for user ${remoteUser.uid}`);
        }
        if (mediaType === 'audio') {
          existingUser.audioTrack = remoteUser.audioTrack;
          console.log(`🎤 TEACHER: Audio track added for user ${remoteUser.uid}`);
        }

        updated.set(remoteUser.uid, existingUser);
        return updated;
      });

      // Play audio track immediately if it exists
      if (mediaType === 'audio' && remoteUser.audioTrack) {
        try {
          remoteUser.audioTrack.play();
        } catch (audioError) {
          console.warn(`⚠️ Could not play audio for ${remoteUser.uid}:`, audioError);
        }
      }

      updateParticipantCount();
      
    } catch (subscribeError) {
      console.error(`❌ TEACHER: Failed to subscribe to user ${remoteUser.uid}:`, subscribeError);
    }
  });

  // 2. USER UNPUBLISHED (Student Stops Sending a Media Track)
  client.on('user-unpublished', (remoteUser, mediaType) => {
    console.log('👤 TEACHER: User unpublished:', { uid: remoteUser.uid, mediaType });

    setRemoteUsers(prev => {
      const updated = new Map(prev);
      const existingUser = updated.get(remoteUser.uid);
      
      if (existingUser) {
        if (mediaType === 'video') {
          // Properly clean up the video track before removing
          if (existingUser.videoTrack) {
            existingUser.videoTrack.stop();
          }
          existingUser.videoTrack = null;
        }
        if (mediaType === 'audio') {
          existingUser.audioTrack = null;
        }
        updated.set(remoteUser.uid, existingUser);
      }
      
      return updated;
    });
  });

  // 3. USER LEFT (Student Leaves the Channel Entirely)
  client.on('user-left', (remoteUser) => {
    console.log('👤 TEACHER: User left channel:', remoteUser.uid);
    
    setRemoteUsers(prev => {
      const updated = new Map(prev);
      // Clean up tracks before deleting the user
      const userToRemove = updated.get(remoteUser.uid);
      if (userToRemove?.videoTrack) {
        userToRemove.videoTrack.stop();
      }
      updated.delete(remoteUser.uid);
      console.log(`📊 TEACHER: Removed user ${remoteUser.uid}. Remaining: ${updated.size}`);
      return updated;
    });
    
    updateParticipantCount();
  });

  // (Keep your existing 'connection-state-change' and 'network-quality' handlers)
  client.on('connection-state-change', (curState, prevState, reason) => {
    console.log('🔗 TEACHER: Connection state:', { current: curState, previous: prevState, reason });
  });

  client.on('network-quality', (quality) => {
    const qualityMap = { 0: 'unknown', 1: 'excellent', 2: 'good', 3: 'poor', 4: 'poor', 5: 'poor', 6: 'poor' };
    setStats(prev => ({
      ...prev,
      connectionQuality: qualityMap[quality.uplinkNetworkQuality] || 'unknown'
    }));
  });

  console.log('✅ TEACHER: Event listeners configured');
};


  // ============================================
  // RENDER FUNCTIONS
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
  // RENDER COMPONENT
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
<div className="remote-videos-grid" style={{
  position: 'absolute',
  top: '80px',
  left: '20px',
  right: '20px',
  bottom: '120px',
  display: 'grid',
  gridTemplateColumns: remoteUsers.size === 0 ? '1fr' : 
                       remoteUsers.size === 1 ? '1fr' : 
                       remoteUsers.size === 2 ? 'repeat(2, 1fr)' :
                       'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '16px',
  padding: '20px',
  overflowY: 'auto'
}}>
  {/* Render each remote user using the fixed component */}
  {Array.from(remoteUsers.values()).map((user) => (
    <div 
      key={user.uid}
      className="remote-video-item"
      style={{
        position: 'relative',
        backgroundColor: '#1a1a2e',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '2px solid rgba(79, 70, 229, 0.3)',
        minHeight: '200px'
      }}
    >
      <RemoteVideoPlayer user={user} />
    </div>
  ))}
  
  {/* Empty state when no students have joined */}
  {remoteUsers.size === 0 && (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#64748b',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{ fontSize: '64px', marginBottom: '24px', opacity: 0.5 }}>
        👥
      </div>
      <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '12px' }}>
        Waiting for students to join...
      </h3>
      <p style={{ fontSize: '16px', maxWidth: '500px', lineHeight: '1.5' }}>
        Students will appear here automatically when they join your session. 
        Make sure you've shared the correct class code or link with them.
      </p>
      <div style={{
        marginTop: '32px',
        padding: '16px 24px',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderRadius: '12px',
        border: '1px dashed rgba(79, 70, 229, 0.4)',
        maxWidth: '400px'
      }}>
        <p style={{ color: '#a5b4fc', fontSize: '14px', marginBottom: '8px' }}>
          <strong>Debug Info:</strong>
        </p>
        <p style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace' }}>
          Channel: {sessionState.sessionInfo?.channel || 'N/A'}<br/>
          Teacher UID: {clientRef.current?.uid || 'Not joined'}<br/>
          Connection: {sessionState.isJoined ? 'Active' : 'Inactive'}
        </p>
      </div>
    </div>
  )}
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