import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  X,
  Share2,
  ChevronUp,
  MessageSquare
} from 'lucide-react';

// ============================================
// FIXED: useDraggable Hook - Correct Implementation
// ============================================
const useDraggable = () => {
  const [position, setPosition] = useState(() => {
    try {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobile = viewportWidth < 768;
      
      const pipWidth = isMobile ? 160 : 280;
      const pipHeight = isMobile ? 150 : 300;
      
      return {
        x: Math.max(20, viewportWidth - pipWidth - 20),
        y: Math.max(20, viewportHeight - pipHeight - 20)
      };
    } catch (error) {
      return { x: 20, y: 20 };
    }
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ isDragging: false });

  const getPipSize = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    return {
      width: isMobile ? 160 : 280,
      height: isMobile ? 120 : 210
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return;
    
    let newX = e.clientX - dragStart.current.x;
    let newY = e.clientY - dragStart.current.y;
    
    const pipSize = getPipSize();
    const maxX = window.innerWidth - pipSize.width;
    const maxY = window.innerHeight - pipSize.height;
    
    newX = Math.max(10, Math.min(newX, maxX - 10));
    newY = Math.max(10, Math.min(newY, maxY - 10));
    
    setPosition({ x: newX, y: newY });
  }, [getPipSize]);

  const handleTouchMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return;
    
    const touch = e.touches[0];
    let newX = touch.clientX - dragStart.current.x;
    let newY = touch.clientY - dragStart.current.y;
    
    const pipSize = getPipSize();
    const maxX = window.innerWidth - pipSize.width;
    const maxY = window.innerHeight - pipSize.height;
    
    newX = Math.max(10, Math.min(newX, maxX - 10));
    newY = Math.max(10, Math.min(newY, maxY - 10));
    
    setPosition({ x: newX, y: newY });
  }, [getPipSize]);

  const handleEnd = useCallback(() => {
    dragRef.current.isDragging = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    dragRef.current.isDragging = isDragging;
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleEnd]);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.no-drag')) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current.isDragging = true;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [position.x, position.y]);

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.no-drag')) return;
    e.preventDefault();
    const touch = e.touches[0];
    dragRef.current.isDragging = true;
    setIsDragging(true);
    dragStart.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  }, [position.x, position.y]);

  return {
    position,
    isDragging,
    setPosition,
    handleMouseDown,
    handleTouchStart
  };
};

// ============================================
// MAIN COMPONENT - FIXED VERSION
// ============================================
const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
  // ============================================
  // State Declarations (All at top level)
  // ============================================
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [loadingProgress, setLoadingProgress] = useState({
    step: 'Initializing...',
    progress: 0,
    showLoading: true
  });

  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false,
    hasMicrophone: false
  });

  const [connectionStats, setConnectionStats] = useState({
    packetLoss: 0,
    latency: 0,
    quality: 'good'
  });

  const [userProfiles, setUserProfiles] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [teacherUid, setTeacherUid] = useState(null);
  const [stats, setStats] = useState({
    participantCount: 0,
    duration: 0,
    connectionQuality: 'unknown'
  });

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [teacherScreenSharing, setTeacherScreenSharing] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenTrack, setScreenTrack] = useState(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantsSort, setParticipantsSort] = useState('name');
  const [participantsFilter, setParticipantsFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [reactionTimeout, setReactionTimeout] = useState({});
  const [availableDevices, setAvailableDevices] = useState({
    cameras: [],
    microphones: [],
    speakers: []
  });
  const [selectedDevices, setSelectedDevices] = useState({
    cameraId: '',
    microphoneId: '',
    speakerId: ''
  });
  const [audioSettings, setAudioSettings] = useState({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    volume: 100
  });
  const [videoSettings, setVideoSettings] = useState({
    resolution: '720p',
    frameRate: 30,
    bitrate: 'auto'
  });

  // ============================================
  // Refs Declarations (All at top level)
  // ============================================
  const remoteVideoRefs = useRef(new Map());
  const pipRef = useRef(null);
  const localVideoRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const clientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const messagesPollIntervalRef = useRef(null);
  const profilePollingRef = useRef(null);
  const initializationRef = useRef({
    clientCreated: false,
    listenersSet: false,
    joined: false,
    isInitializing: false
  });
  const isMountedRef = useRef(true);
  const reactionTimeoutRef = useRef({});

  // ============================================
  // Custom Hook Calls (Must be at top level)
  // ============================================
  const { position, isDragging, setPosition, handleMouseDown, handleTouchStart } = useDraggable();

  // ============================================
  // Memoized Values
  // ============================================
  const teacherTracks = useMemo(() => {
    if (!teacherUid) return null;
    return remoteTracks.get(Number(teacherUid)) || null;
  }, [teacherUid, remoteTracks]);

  const teacherProfile = useMemo(() => {
    if (!teacherUid) return null;
    return userProfiles.get(teacherUid);
  }, [teacherUid, userProfiles]);

  // ============================================
  // Helper Functions (All useCallback wrapped)
  // ============================================
  const formatDuration = useCallback((seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const updateProgress = useCallback((step, progress) => {
    if (!isMountedRef.current) return;
    setLoadingProgress({
      step,
      progress: Math.min(100, Math.max(0, progress)),
      showLoading: true
    });
  }, []);

  const updateParticipantCount = useCallback(() => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  }, []);

  // ============================================
  // API Functions
  // ============================================
  const fetchParticipants = useCallback(async (meetingId) => {
    try {
      const response = await studentvideoApi.getSessionParticipants(meetingId);
      
      if (response.success && response.participants) {
        const newProfiles = new Map();
        let teacherUidFound = null;
        
        response.participants.forEach(participant => {
          if (participant.agora_uid) {
            const uidString = String(participant.agora_uid);
            const isTeacher = participant.role === 'teacher' || participant.is_teacher;
            
            newProfiles.set(uidString, {
              id: participant.user_id,
              agora_uid: participant.agora_uid,
              name: participant.display_name || participant.name || 'Unknown User',
              display_name: participant.display_name || participant.name || 'Unknown User',
              role: isTeacher ? 'teacher' : 'student',
              is_teacher: isTeacher,
              avatar_url: participant.avatar_url
            });
            
            if (isTeacher) {
              teacherUidFound = uidString;
            }
          }
        });
        
        setUserProfiles(newProfiles);
        if (teacherUidFound) {
          setTeacherUid(teacherUidFound);
        }
        
        setParticipants(response.participants);
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  }, []);

  const syncProfilesWithTracks = useCallback(() => {
    const remoteUids = Array.from(remoteTracks.keys()).map(uid => String(uid));
    const profileUids = Array.from(userProfiles.keys());
    
    const missingUids = remoteUids.filter(uid => !profileUids.includes(uid));
    
    if (missingUids.length > 0 && sessionState.sessionInfo?.meetingId) {
      fetchProfilesByUids(missingUids);
    }
  }, [remoteTracks, userProfiles, sessionState.sessionInfo?.meetingId]);

  const fetchProfilesByUids = useCallback(async (uids) => {
    try {
      if (!sessionState.sessionInfo?.meetingId || !uids.length) return;
      
      const response = await studentvideoApi.getParticipantProfiles(
        sessionState.sessionInfo.meetingId,
        uids.map(uid => parseInt(uid, 10)).filter(uid => !isNaN(uid))
      );
      
      if (response.success && response.profiles) {
        setUserProfiles(prev => {
          const updated = new Map(prev);
          response.profiles.forEach(profile => {
            const uidString = String(profile.agora_uid);
            const isTeacher = profile.role === 'teacher' || profile.is_teacher;
            
            updated.set(uidString, {
              id: profile.user_id,
              agora_uid: profile.agora_uid,
              name: profile.name || profile.full_name || profile.display_name || 'User',
              display_name: profile.full_name || profile.name || profile.display_name || 'User',
              role: profile.role || (isTeacher ? 'teacher' : 'student'),
              is_teacher: isTeacher,
              avatar_url: profile.avatar_url
            });
            
            if (isTeacher) {
              setTeacherUid(uidString);
            }
          });
          return updated;
        });
      }
    } catch (error) {
      console.warn('Failed to fetch profiles by UIDs:', error);
    }
  }, [sessionState.sessionInfo?.meetingId]);

  const updateParticipantStatus = useCallback(async (updates) => {
    try {
      if (!sessionState.sessionInfo?.session?.id) return;

      const statusUpdate = {
        ...updates,
        timestamp: new Date().toISOString(),
        student_id: studentId,
        session_id: sessionState.sessionInfo.session.id
      };
      
      await studentvideoApi.updateParticipantStatus(
        sessionState.sessionInfo.session.id,
        studentId,
        statusUpdate
      );

    } catch (error) {
      console.warn('Participant status update error:', error.message);
    }
  }, [sessionState.sessionInfo?.session?.id, studentId]);

  // ============================================
  // Agora Event Listeners Setup
  // ============================================
  const setupAgoraEventListeners = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;

    console.log('Setting up Agora event listeners');

    client.on('user-joined', async (user) => {
      console.log(`User joined: ${user.uid}`);
      const uid = String(user.uid);
      
      if (sessionState.sessionInfo && String(sessionState.sessionInfo.uid) === uid) {
        console.log('Skipping own user join event');
        return;
      }

      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(uid)) {
          newMap.set(uid, { audio: null, video: null });
        }
        return newMap;
      });

      updateParticipantCount();
    });

    client.on('user-published', async (user, mediaType) => {
      console.log(`User published: ${user.uid}, media: ${mediaType}`);
      
      if (mediaType === 'video' && user.videoTrack) {
        const trackLabel = user.videoTrack.getTrackLabel ? user.videoTrack.getTrackLabel() : '';
        const isScreenShare = trackLabel.toLowerCase().includes('screen') || 
                             trackLabel.toLowerCase().includes('window');
        
        if (String(user.uid) === teacherUid && isScreenShare) {
          console.log('🖥️ Teacher is screen sharing');
          setTeacherScreenSharing(true);
        }
      }
      
      try {
        const remoteTrack = await client.subscribe(user, mediaType);
        console.log(`✅ Subscribed to ${mediaType} of user ${user.uid}`);
        
        const uid = String(user.uid);
        
        setRemoteTracks(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(uid) || { audio: null, video: null };
          
          if (mediaType === 'video') {
            existing.video = remoteTrack;
          } else if (mediaType === 'audio') {
            existing.audio = remoteTrack;
          }
          
          newMap.set(uid, existing);
          return newMap;
        });
        
      } catch (error) {
        console.error(`❌ Failed to subscribe to ${mediaType} of user ${user.uid}:`, error);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      console.log(`User unpublished: ${user.uid}, media: ${mediaType}`);
      const uid = String(user.uid);
      
      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(uid);
        
        if (existing) {
          if (mediaType === 'video') {
            existing.video?.stop();
            existing.video = null;
          } else if (mediaType === 'audio') {
            existing.audio?.stop();
            existing.audio = null;
          }
          
          newMap.set(uid, existing);
        }
        
        return newMap;
      });
    });

    client.on('user-left', (user) => {
      console.log(`User left: ${user.uid}`);
      const uid = String(user.uid);
      
      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        const tracks = newMap.get(uid);
        
        if (tracks) {
          tracks.audio?.stop();
          tracks.video?.stop();
        }
        
        newMap.delete(uid);
        return newMap;
      });
      
      setUserProfiles(prev => {
        const updated = new Map(prev);
        updated.delete(uid);
        return updated;
      });
      
      updateParticipantCount();
    });

    client.on('connection-state-change', (curState, prevState) => {
      console.log(`Connection state change: ${prevState} -> ${curState}`);
      
      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        setSessionState(prev => ({
          ...prev,
          error: 'Connection lost. Trying to reconnect...'
        }));
      } else if (curState === 'CONNECTED') {
        setSessionState(prev => ({
          ...prev,
          error: null
        }));
      }
    });
  }, [teacherUid, updateParticipantCount, sessionState.sessionInfo]);

  // ============================================
  // Track Management Functions
  // ============================================
  const createLocalTracks = useCallback(async () => {
    console.log('🔵 Creating local tracks - FAST VERSION');
    
    const startTime = Date.now();

    try {
      const [audioResult, videoResult] = await Promise.allSettled([
        Promise.race([
          AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'speech_standard',
            AEC: true,
            ANS: true,
            AGC: true
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Audio timeout')), 3000)
          )
        ]).catch(() => null),
        
        Promise.race([
          AgoraRTC.createCameraVideoTrack({
            encoderConfig: '480p_1',
            facingMode: 'user'
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Video timeout')), 3000)
          )
        ]).catch(() => null)
      ]);

      const audioTrack = audioResult.status === 'fulfilled' ? audioResult.value : null;
      const videoTrack = videoResult.status === 'fulfilled' ? videoResult.value : null;
      
      console.log(`📊 Tracks created in ${Date.now() - startTime}ms:`, {
        audio: !!audioTrack,
        video: !!videoTrack
      });

      setLocalTracks({ audio: audioTrack, video: videoTrack });
      
      setControls(prev => ({
        ...prev,
        hasCamera: !!videoTrack,
        hasMicrophone: !!audioTrack,
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack
      }));

      const mode = audioTrack && videoTrack ? 'Audio + Video' : 
                   audioTrack ? 'Audio Only' :
                   videoTrack ? 'Video Only' : 'None';
      console.log(`📢 Mode: ${mode}`);

      if (clientRef.current) {
        const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
        
        if (tracksToPublish.length > 0) {
          clientRef.current.publish(tracksToPublish)
            .then(() => console.log(`✅ Published in ${Date.now() - startTime}ms`))
            .catch(err => console.warn('Publish failed (will retry):', err));
        }
      }

      if (videoTrack && localVideoRef.current) {
        setTimeout(() => {
          videoTrack.play(localVideoRef.current).catch(() => {});
        }, 100);
      }

      console.log(`✅ createLocalTracks completed: ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('Track creation error:', error);
      setLocalTracks({ audio: null, video: null });
    }
  }, []);

  // ============================================
  // Session Initialization
  // ============================================
  const initializeSession = useCallback(async () => {
    try {
      if (initializationRef.current.clientCreated) {
        console.log('Client already created, skipping initialization');
        return;
      }

      console.log('⚡ Starting FAST initialization...');
      const initStart = Date.now();

      updateProgress('Checking session availability...', 10);

      const [sessionLookup, devicesCheck] = await Promise.all([
        studentvideoApi.getSessionByClassId(classId),
        AgoraRTC.getDevices().catch(() => [])
      ]);
      
      if (!sessionLookup.success || !sessionLookup.exists || !sessionLookup.isActive) {
        throw new Error(sessionLookup.error || 'No active session found');
      }

      const effectiveMeetingId = sessionLookup.meetingId;
      
      updateProgress('Setting up video client...', 30);
      
      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ 
          mode: 'rtc', 
          codec: 'vp8' 
        });
        initializationRef.current.clientCreated = true;
        console.log('✅ Client created');
      }

      updateProgress('Configuring connection...', 40);
      
      if (!initializationRef.current.listenersSet) {
        setupAgoraEventListeners();
        initializationRef.current.listenersSet = true;
        console.log('✅ Listeners set');
      }

      updateProgress('Connecting to classroom...', 50);
      
      const [sessionData] = await Promise.all([
        studentvideoApi.joinVideoSession(effectiveMeetingId, studentId, 'student'),
        fetchParticipants(effectiveMeetingId).catch(err => 
          console.warn('Participants fetch failed (non-critical):', err)
        )
      ]);

      if (!sessionData.success || !sessionData.token) {
        throw new Error(sessionData.error || 'Failed to join session');
      }

      const studentAgoraUid = sessionData.uid;

      updateProgress('Finalizing connection...', 70);
      
      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: {
          ...sessionData,
          uid: studentAgoraUid,
          meetingId: effectiveMeetingId
        },
        error: null
      });

      console.log(`⚡ Init phase 1 complete: ${Date.now() - initStart}ms`);

      updateProgress('Starting video call...', 85);
      
      await joinChannel({
        ...sessionData,
        uid: studentAgoraUid
      });

      updateProgress('Ready!', 100);
      
      console.log(`✅ Total init time: ${Date.now() - initStart}ms`);

      setTimeout(() => {
        setLoadingProgress(prev => ({ ...prev, showLoading: false }));
      }, 1000);

    } catch (error) {
      console.error('Init Error:', error);
      
      updateProgress('Connection failed', 0);
      
      setTimeout(() => {
        setLoadingProgress(prev => ({ ...prev, showLoading: false }));
      }, 2000);
      
      setSessionState(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to connect' 
      }));
    }
  }, [classId, studentId, updateProgress, setupAgoraEventListeners, fetchParticipants]);

  // ============================================
  // Join Channel
  // ============================================
  const joinChannel = useCallback(async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;

      if (!appId || appId.length !== 32) {
        throw new Error('Invalid App ID');
      }

      if (!channel) {
        throw new Error('Channel name is missing');
      }

      if (!token) {
        throw new Error('Token is missing');
      }

      console.log('Joining channel:', channel);

      if (initializationRef.current.joined) {
        console.log('Already joined channel, skipping');
        return;
      }

      const joinedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );
      
      console.log('Joined channel with UID:', joinedUid);
      initializationRef.current.joined = true;

      if (profilePollingRef.current) {
        clearInterval(profilePollingRef.current);
      }
      
      setTimeout(() => {
        profilePollingRef.current = setInterval(() => {
          if (sessionState.sessionInfo?.meetingId) {
            fetchParticipants(sessionState.sessionInfo.meetingId);
          }
        }, 10000);
      }, 5000);

      await createLocalTracks();

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();
      
      updateParticipantStatus({ status: 'joined' }).catch(err =>
        console.warn('Status update failed:', err)
      );

      if (sessionData.session?.id) {
        startMessagePolling(sessionData.session.id);
      }

    } catch (error) {
      console.error('Join channel error:', error);
      throw error;
    }
  }, [sessionState.sessionInfo?.meetingId, fetchParticipants, createLocalTracks, updateParticipantStatus]);

  // ============================================
  // Control Functions
  // ============================================
  const toggleVideo = useCallback(async () => {
    if (!localTracks.video || !controls.hasCamera) return;
    
    try {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  }, [localTracks.video, controls.hasCamera, controls.videoEnabled]);

  const toggleAudio = useCallback(async () => {
    if (!localTracks.audio || !controls.hasMicrophone) return;
    
    try {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      console.log(`🎤 Audio ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  }, [localTracks.audio, controls.hasMicrophone, controls.audioEnabled]);

  const toggleHandRaise = useCallback(async () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    try {
      await updateParticipantStatus({ handRaised: newState });
      console.log(`✋ Hand ${newState ? 'raised' : 'lowered'}`);
      
      if (sessionState.sessionInfo?.session?.id) {
        sendMessage(
          newState ? '✋ Raised hand' : 'Lowered hand',
          'system'
        );
      }
    } catch (error) {
      console.error('Failed to toggle hand raise:', error);
    }
  }, [controls.handRaised, sessionState.sessionInfo?.session?.id, updateParticipantStatus]);

  // ============================================
  // Message Functions
  // ============================================
  const startMessagePolling = useCallback((sessionId) => {
    if (!sessionId) {
      console.warn('No session ID provided for message polling');
      return;
    }

    loadMessages(sessionId);

    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }

    messagesPollIntervalRef.current = setInterval(() => {
      loadMessages(sessionId);
    }, 15000);
  }, []);

  const loadMessages = useCallback(async (sessionId) => {
    try {
      if (!sessionId) return;
      
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
  }, []);

  const sendMessage = useCallback(async (text = null, type = 'text') => {
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
  }, [newMessage, sessionState.sessionInfo?.session?.id, studentId]);

  // ============================================
  // Screen Sharing Functions
  // ============================================
  const stopScreenShare = useCallback(async (isLeaving = false) => {
    if (!screenTrack) return;
    
    try {
      console.log('🖥️ Stopping screen sharing...');
      
      if (clientRef.current) {
        try {
          await clientRef.current.unpublish(screenTrack);
          console.log('✅ Unpublished screen track');
        } catch (unpubError) {
          if (!isLeaving) {
            console.warn('⚠️ Could not unpublish screen track:', unpubError);
          }
        }
      }
      
      try {
        await screenTrack.close();
        console.log('✅ Closed screen track');
      } catch (closeError) {
        if (!isLeaving) {
          console.warn('⚠️ Could not close screen track:', closeError);
        }
      }
      
      if (!isLeaving && localTracks.video && controls.hasCamera) {
        try {
          await localTracks.video.setEnabled(true);
          console.log('✅ Re-enabled camera');
        } catch (enableError) {
          console.warn('⚠️ Could not re-enable camera:', enableError);
        }
      }
      
      if (!isLeaving) {
        setScreenTrack(null);
        setIsScreenSharing(false);
      }
      
      console.log('✅ Screen sharing stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping screen share:', error);
      throw error;
    }
  }, [screenTrack, localTracks.video, controls.hasCamera]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare(false);
        sendMessage('Stopped screen sharing', 'system');
      } else {
        console.log('🖥️ Starting screen share...');
        
        if (localTracks.video) {
          await localTracks.video.setEnabled(false);
        }
        
        const screenTrackConfig = {
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 15,
            bitrateMin: 1000,
            bitrateMax: 3000,
          },
          optimizationMode: 'detail',
          screenSourceType: 'screen'
        };
        
        const newScreenTrack = await AgoraRTC.createScreenVideoTrack(screenTrackConfig, 'auto');
        const track = Array.isArray(newScreenTrack) ? newScreenTrack[0] : newScreenTrack;
        
        if (clientRef.current) {
          await clientRef.current.publish(track);
        }
        
        setScreenTrack(track);
        setIsScreenSharing(true);
        console.log('✅ Screen sharing started');
        
        sendMessage('Started screen sharing', 'system');
        
        track.on('track-ended', async () => {
          console.log('🖥️ Screen sharing ended by browser/user');
          await stopScreenShare(false);
          sendMessage('Screen sharing ended', 'system');
        });
      }
    } catch (error) {
      console.error('❌ Screen share error:', error);
      
      setIsScreenSharing(false);
      setScreenTrack(null);
      
      if (localTracks.video && controls.hasCamera) {
        await localTracks.video.setEnabled(true);
      }
      
      let errorMessage = 'Failed to share screen';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Screen sharing permission denied';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No screen sharing source available';
      } else if (error.message?.includes('extension')) {
        errorMessage = 'Screen sharing extension required';
      }
      
      sendMessage(`⚠️ ${errorMessage}`, 'system');
    }
  }, [isScreenSharing, screenTrack, localTracks.video, controls.hasCamera, stopScreenShare, sendMessage]);

  // ============================================
  // Duration Tracking
  // ============================================
  const startDurationTracking = useCallback(() => {
    const startTime = Date.now();
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    durationIntervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setStats(prev => ({ ...prev, duration: diff }));
    }, 1000);
  }, []);

  // ============================================
  // Cleanup Functions
  // ============================================
  const cleanup = useCallback(async () => {
    console.log('🧹 Starting comprehensive cleanup...');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
      messagesPollIntervalRef.current = null;
    }
    
    if (profilePollingRef.current) {
      clearInterval(profilePollingRef.current);
      profilePollingRef.current = null;
    }

    Object.values(reactionTimeoutRef.current).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });

    if (screenTrack) {
      try {
        console.log('🖥️ Cleaning up screen sharing track...');
        
        if (isScreenSharing) {
          console.log('📺 Stopping active screen share...');
          
          if (clientRef.current) {
            try {
              await clientRef.current.unpublish(screenTrack);
              console.log('✅ Unpublished screen track');
            } catch (unpubError) {
              console.warn('⚠️ Could not unpublish screen track:', unpubError);
            }
          }
          
          try {
            await screenTrack.close();
            console.log('✅ Closed screen track');
          } catch (closeError) {
            console.warn('⚠️ Could not close screen track:', closeError);
          }
          
          if (localTracks.video && controls.hasCamera && !controls.videoEnabled) {
            try {
              await localTracks.video.setEnabled(true);
              console.log('✅ Re-enabled camera after screen sharing');
            } catch (enableError) {
              console.warn('⚠️ Could not re-enable camera:', enableError);
            }
          }
          
          setIsScreenSharing(false);
          setScreenTrack(null);
        }
      } catch (screenError) {
        console.error('❌ Screen sharing cleanup error:', screenError);
      }
    }

    try {
      console.log('🎤🎬 Cleaning up local tracks...');
      
      if (localTracks.audio) {
        try {
          if (localTracks.audio.isPlaying) {
            localTracks.audio.stop();
          }
          localTracks.audio.close();
          console.log('✅ Closed audio track');
        } catch (audioError) {
          console.warn('⚠️ Audio cleanup error:', audioError);
        }
      }
      
      if (localTracks.video) {
        try {
          if (localTracks.video.isPlaying) {
            localTracks.video.stop();
          }
          localTracks.video.close();
          console.log('✅ Closed video track');
        } catch (videoError) {
          console.warn('⚠️ Video cleanup error:', videoError);
        }
      }
      
      setLocalTracks({ audio: null, video: null });
    } catch (trackError) {
      console.error('❌ Local tracks cleanup error:', trackError);
    }

    try {
      console.log('📡 Cleaning up remote tracks...');
      
      remoteTracks.forEach((tracks, uid) => {
        try {
          if (tracks.audio && tracks.audio.stop) {
            tracks.audio.stop();
          }
          if (tracks.video && tracks.video.stop) {
            tracks.video.stop();
          }
        } catch (remoteError) {
          console.warn(`⚠️ Error cleaning up remote track ${uid}:`, remoteError);
        }
      });
      
      setRemoteTracks(new Map());
    } catch (remoteError) {
      console.error('❌ Remote tracks cleanup error:', remoteError);
    }

    try {
      if (clientRef.current) {
        console.log('📡 Cleaning up Agora client...');
        
        const connectionState = clientRef.current.connectionState;
        console.log(`📶 Connection state before cleanup: ${connectionState}`);
        
        if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
          clientRef.current.removeAllListeners();
          
          try {
            const leavePromise = clientRef.current.leave();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Leave timeout')), 5000)
            );
            
            await Promise.race([leavePromise, timeoutPromise]);
            console.log('✅ Successfully left Agora channel');
          } catch (leaveError) {
            console.warn('⚠️ Could not leave channel gracefully:', leaveError);
          }
        }
        
        clientRef.current = null;
      }
    } catch (clientError) {
      console.error('❌ Client cleanup error:', clientError);
    }

    console.log('🔄 Resetting all refs and state...');
    
    initializationRef.current = {
      clientCreated: false,
      listenersSet: false,
      joined: false
    };

    remoteVideoRefs.current.clear();
    
    if (localVideoTrackRef.current) {
      try {
        localVideoTrackRef.current.stop();
      } catch (e) {}
      localVideoTrackRef.current = null;
    }

    setUserProfiles(new Map());
    setParticipants([]);
    setTeacherUid(null);
    setMessages([]);
    setNewMessage('');
    setShowChat(false);
    setShowParticipants(false);
    setShowSettings(false);
    setReactions([]);
    setAvailableDevices({
      cameras: [],
      microphones: [],
      speakers: []
    });
    setIsScreenSharing(false);
    setScreenTrack(null);

    setControls({
      audioEnabled: false,
      videoEnabled: false,
      handRaised: false,
      hasCamera: false,
      hasMicrophone: false
    });

    setStats({
      participantCount: 0,
      duration: 0,
      connectionQuality: 'unknown'
    });

    setSessionState({
      isInitialized: false,
      isJoined: false,
      sessionInfo: null,
      error: null
    });

    console.log('✅ Complete cleanup finished');
  }, [screenTrack, isScreenSharing, localTracks, remoteTracks, controls.hasCamera, controls.videoEnabled]);

  const leaveSession = useCallback(async () => {
    try {
      console.log('🚪 Starting leave session process...');
      
      if (sessionState.sessionInfo?.session?.id) {
        try {
          await updateParticipantStatus({ 
            status: 'left',
            left_at: new Date().toISOString(),
            screen_shared: isScreenSharing,
            hand_raised: controls.handRaised
          });
          console.log('✅ Participant status updated');
        } catch (statusError) {
          console.warn('⚠️ Could not update participant status:', statusError);
        }
      }

      if (isScreenSharing) {
        console.log('🖥️ Stopping screen sharing before leaving...');
        
        try {
          if (screenTrack) {
            if (clientRef.current) {
              await clientRef.current.unpublish(screenTrack).catch(() => {});
            }
            
            await screenTrack.close().catch(() => {});
            
            if (localTracks.video && controls.hasCamera) {
              await localTracks.video.setEnabled(true).catch(() => {});
            }
          }
          console.log('✅ Screen sharing stopped');
        } catch (screenError) {
          console.warn('⚠️ Error stopping screen share on leave:', screenError);
        }
      }

      if (sessionState.sessionInfo?.meetingId) {
        try {
          console.log('📡 Ending session on server...');
          await studentvideoApi.endSession(
            sessionState.sessionInfo.meetingId,
            studentId
          );
          console.log('✅ Server session ended');
        } catch (apiError) {
          console.warn('⚠️ Could not end session on server:', apiError);
        }
      }

      await cleanup();
      
      console.log('🎉 Session cleanup complete');

      if (onLeaveCall && typeof onLeaveCall === 'function') {
        console.log('📞 Calling onLeaveCall callback');
        setTimeout(() => {
          onLeaveCall();
        }, 100);
      }

    } catch (error) {
      console.error('❌ Error in leaveSession:', error);
      
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error('❌ Emergency cleanup also failed:', cleanupError);
      }
      
      if (onLeaveCall && typeof onLeaveCall === 'function') {
        onLeaveCall();
      }
    }
  }, [sessionState.sessionInfo, isScreenSharing, controls.handRaised, screenTrack, localTracks.video, controls.hasCamera, studentId, cleanup, onLeaveCall, updateParticipantStatus]);

  // ============================================
  // Device Management Functions
  // ============================================
  const toggleSettings = useCallback(async () => {
    if (!showSettings) {
      await loadAvailableDevices();
    }
    setShowSettings(prev => !prev);
  }, [showSettings]);

  const loadAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Camera ${cameras.length + 1}`,
          group: device.groupId
        }));
      
      const microphones = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Microphone ${microphones.length + 1}`,
          group: device.groupId
        }));
      
      const speakers = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Speaker ${speakers.length + 1}`,
          group: device.groupId
        }));
      
      setAvailableDevices({ cameras, microphones, speakers });
      
      if (localTracks.video?.getTrackLabel) {
        const currentCamera = localTracks.video.getTrackLabel();
        setSelectedDevices(prev => ({
          ...prev,
          cameraId: cameras.find(cam => cam.label === currentCamera)?.id || ''
        }));
      }
      
    } catch (error) {
      console.error('❌ Failed to load devices:', error);
    }
  }, [localTracks.video]);

  const switchCamera = useCallback(async (deviceId) => {
    try {
      if (!localTracks.video || !controls.hasCamera) return;
      
      console.log(`📷 Switching to camera: ${deviceId}`);
      
      await localTracks.video.close();
      
      const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: videoSettings.resolution === '720p' ? '720p_3' : 
                      videoSettings.resolution === '480p' ? '480p_1' : '1080p_3',
        cameraId: deviceId,
        optimizationMode: 'detail'
      });
      
      if (clientRef.current) {
        await clientRef.current.unpublish(localTracks.video);
        
        setLocalTracks(prev => ({ ...prev, video: newVideoTrack }));
        
        await clientRef.current.publish(newVideoTrack);
        
        setSelectedDevices(prev => ({ ...prev, cameraId: deviceId }));
        
        console.log('✅ Camera switched successfully');
        sendMessage('Switched camera', 'system');
      }
      
    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
      sendMessage('Failed to switch camera', 'system');
    }
  }, [localTracks.video, controls.hasCamera, videoSettings.resolution, sendMessage]);

  const switchMicrophone = useCallback(async (deviceId) => {
    try {
      if (!localTracks.audio || !controls.hasMicrophone) return;
      
      console.log(`🎤 Switching to microphone: ${deviceId}`);
      
      await localTracks.audio.close();
      
      const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: deviceId,
        AEC: audioSettings.echoCancellation,
        ANS: audioSettings.noiseSuppression,
        AGC: audioSettings.autoGainControl,
        encoderConfig: 'music_standard'
      });
      
      if (clientRef.current) {
        await clientRef.current.unpublish(localTracks.audio);
        
        setLocalTracks(prev => ({ ...prev, audio: newAudioTrack }));
        
        await clientRef.current.publish(newAudioTrack);
        
        setSelectedDevices(prev => ({ ...prev, microphoneId: deviceId }));
        
        console.log('✅ Microphone switched successfully');
        sendMessage('Switched microphone', 'system');
      }
      
    } catch (error) {
      console.error('❌ Failed to switch microphone:', error);
      sendMessage('Failed to switch microphone', 'system');
    }
  }, [localTracks.audio, controls.hasMicrophone, audioSettings, sendMessage]);

  const updateAudioSettings = useCallback((setting, value) => {
    setAudioSettings(prev => ({ ...prev, [setting]: value }));
    
    if (localTracks.audio) {
      try {
        if (setting === 'volume') {
          localTracks.audio.setVolume(value);
        } else if (setting === 'noiseSuppression') {
          localTracks.audio.setNoiseSuppression(value);
        } else if (setting === 'echoCancellation') {
          localTracks.audio.setEchoCancellation(value);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to update audio setting ${setting}:`, error);
      }
    }
  }, [localTracks.audio]);

  const updateVideoSettings = useCallback((setting, value) => {
    setVideoSettings(prev => ({ ...prev, [setting]: value }));
    
    if (localTracks.video && setting === 'resolution') {
      try {
        const encoderConfig = 
          value === '720p' ? '720p_3' :
          value === '480p' ? '480p_1' :
          '1080p_3';
        
        localTracks.video.setEncoderConfiguration(encoderConfig);
        console.log(`✅ Video resolution updated to ${value}`);
      } catch (error) {
        console.warn('⚠️ Failed to update video resolution:', error);
      }
    }
  }, [localTracks.video]);

  // ============================================
  // Reaction Functions
  // ============================================
  const sendReaction = useCallback((reaction) => {
    try {
      if (sessionState.sessionInfo?.session?.id) {
        studentvideoApi.sendReaction(
          sessionState.sessionInfo.session.id,
          studentId,
          reaction
        ).then(() => {
          console.log(`✅ Reaction sent: ${reaction}`);
        }).catch(err => {
          console.warn('⚠️ Failed to send reaction:', err);
          sendMessage(reaction, 'reaction');
        });
      } else {
        sendMessage(reaction, 'reaction');
      }
      
      const reactionId = Date.now();
      setReactions(prev => [...prev, {
        id: reactionId,
        emoji: reaction,
        userId: studentId,
        userName: 'You',
        timestamp: Date.now()
      }]);
      
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reactionId));
      }, 3000);
      
      clearTimeout(reactionTimeout[reaction]);
      setReactionTimeout(prev => ({
        ...prev,
        [reaction]: setTimeout(() => {}, 1000)
      }));
      
    } catch (error) {
      console.error('❌ Reaction error:', error);
      sendMessage(reaction, 'reaction');
    }
  }, [sessionState.sessionInfo?.session?.id, studentId, sendMessage, reactionTimeout]);

  // ============================================
  // Participant Functions
  // ============================================
  const getSortedParticipants = useCallback(() => {
    const allParticipants = Array.from(remoteTracks.entries()).map(([uid, tracks]) => {
      const uidString = uid.toString();
      const profile = userProfiles.get(uidString);
      const isTeacher = uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher';
      
      return {
        uid: uidString,
        tracks,
        profile,
        isTeacher,
        hasAudio: !!tracks.audio,
        hasVideo: !!tracks.video,
        joinTime: Date.now(),
      };
    });
    
    allParticipants.push({
      uid: String(sessionState.sessionInfo?.uid || studentId),
      tracks: localTracks,
      profile: {
        name: 'You',
        display_name: 'You',
        role: 'student',
        is_teacher: false,
      },
      isTeacher: false,
      hasAudio: controls.audioEnabled && localTracks.audio,
      hasVideo: controls.videoEnabled && localTracks.video,
      joinTime: Date.now(),
    });
    
    let filtered = allParticipants;
    if (participantsFilter === 'teachers') {
      filtered = filtered.filter(p => p.isTeacher);
    } else if (participantsFilter === 'students') {
      filtered = filtered.filter(p => !p.isTeacher);
    }
    
    filtered.sort((a, b) => {
      if (participantsSort === 'name') {
        return a.profile?.name?.localeCompare(b.profile?.name || '') || 0;
      } else if (participantsSort === 'role') {
        if (a.isTeacher && !b.isTeacher) return -1;
        if (!a.isTeacher && b.isTeacher) return 1;
        return 0;
      } else if (participantsSort === 'joinTime') {
        return a.joinTime - b.joinTime;
      }
      return 0;
    });
    
    return filtered;
  }, [remoteTracks, userProfiles, teacherUid, sessionState.sessionInfo?.uid, studentId, localTracks, controls.audioEnabled, controls.videoEnabled, participantsFilter, participantsSort]);

  const kickParticipant = useCallback(async (uid) => {
    try {
      const response = await studentvideoApi.kickParticipant(
        sessionState.sessionInfo?.meetingId,
        uid,
        studentId
      );
      
      if (response.success) {
        sendMessage(`Removed participant: ${userProfiles.get(uid)?.name || 'User'}`, 'system');
        console.log(`✅ Kicked participant ${uid}`);
      }
    } catch (error) {
      console.error('❌ Failed to kick participant:', error);
    }
  }, [sessionState.sessionInfo?.meetingId, studentId, sendMessage, userProfiles]);

  const toggleParticipants = useCallback(() => {
    setShowParticipants(prev => !prev);
    
    if (!showParticipants && sessionState.sessionInfo?.meetingId) {
      fetchParticipants(sessionState.sessionInfo.meetingId);
    }
  }, [showParticipants, sessionState.sessionInfo?.meetingId, fetchParticipants]);

  // ============================================
  // UI Helper Functions
  // ============================================
  const toggleFullscreen = useCallback(() => {
    const element = document.documentElement;
    
    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, []);

  const quickReactions = [
    { emoji: '👍', label: 'Like' },
    { emoji: '👏', label: 'Clap' },
    { emoji: '🎉', label: 'Celebrate' },
    { emoji: '🙋', label: 'Raise Hand' },
    { emoji: '❤️', label: 'Heart' },
    { emoji: '😂', label: 'Laugh' },
    { emoji: '🤔', label: 'Thinking' },
    { emoji: '👀', label: 'Eyes' }
  ];

  // ============================================
  // Effects (All at top level, no conditional hooks)
  // ============================================
  useEffect(() => {
    if (initializationRef.current.joined) {
      return;
    }

    const init = async () => {
      try {
        await initializeSession();
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };

    init();

    return () => {
      if (initializationRef.current.joined) {
        cleanup();
      }
    };
  }, [meetingId, studentId, initializeSession, cleanup]);

  useEffect(() => {
    if (remoteTracks.size > 0 && sessionState.isJoined) {
      syncProfilesWithTracks();
    }
  }, [remoteTracks, sessionState.isJoined, syncProfilesWithTracks]);

  useEffect(() => {
    if (!sessionState.isJoined || !sessionState.sessionInfo?.meetingId) return;
    
    const syncInterval = setInterval(() => {
      fetchParticipants(sessionState.sessionInfo.meetingId);
    }, 15000);
    
    return () => clearInterval(syncInterval);
  }, [sessionState.isJoined, sessionState.sessionInfo?.meetingId, fetchParticipants]);

  useEffect(() => {
    const handleWindowResize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const isMobile = window.innerWidth < 768;
      const pipWidth = isMobile ? 160 : 280;
      const pipHeight = isMobile ? 120 : 210;
      
      setPosition(prev => ({
        x: Math.max(20, Math.min(prev.x, viewportWidth - pipWidth - 20)),
        y: Math.max(20, Math.min(prev.y, viewportHeight - pipHeight - 20))
      }));
    };
    
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [setPosition]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showParticipants) {
        setShowParticipants(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showParticipants]);

  useEffect(() => {
    const checkConnection = () => {
      const qualities = ['good', 'fair', 'poor'];
      const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
      
      setConnectionStats(prev => ({
        ...prev,
        quality: randomQuality
      }));
      
      setStats(prev => ({
        ...prev,
        connectionQuality: randomQuality
      }));
    };
    
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const playLocalVideo = async () => {
      if (!localTracks.video || !localVideoRef.current) {
        console.log('⏸️ Local video not ready:', { 
          hasTrack: !!localTracks.video, 
          hasRef: !!localVideoRef.current 
        });
        return;
      }

      if (!controls.videoEnabled) {
        console.log('⏸️ Video disabled by user');
        return;
      }

      try {
        console.log('▶️ Playing local video...');
        
        if (localVideoTrackRef.current && localVideoTrackRef.current !== localTracks.video) {
          localVideoTrackRef.current.stop();
        }

        await localTracks.video.play(localVideoRef.current);
        localVideoTrackRef.current = localTracks.video;
        
        console.log('✅ Local video playing');
      } catch (error) {
        console.error('❌ Failed to play local video:', error);
        
        setTimeout(async () => {
          try {
            if (localTracks.video && localVideoRef.current) {
              await localTracks.video.play(localVideoRef.current);
              localVideoTrackRef.current = localTracks.video;
              console.log('✅ Local video retry successful');
            }
          } catch (retryError) {
            console.error('❌ Retry failed:', retryError);
          }
        }, 500);
      }
    };

    playLocalVideo();

    return () => {
      if (localVideoTrackRef.current) {
        try {
          localVideoTrackRef.current.stop();
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };
  }, [localTracks.video, controls.videoEnabled]);

  useEffect(() => {
    const playRemoteVideos = async () => {
      for (const [uid, tracks] of remoteTracks.entries()) {
        const container = remoteVideoRefs.current.get(String(uid));
        
        if (container && tracks.video) {
          try {
            if (tracks.video.isPlaying) {
              continue;
            }
            
            console.log(`▶️ Playing remote video ${uid}`);
            await tracks.video.play(container);
            console.log(`✅ Remote video ${uid} playing`);
          } catch (error) {
            console.error(`❌ Failed to play remote ${uid}:`, error);
            
            setTimeout(async () => {
              try {
                if (container && tracks.video && !tracks.video.isPlaying) {
                  await tracks.video.play(container);
                }
              } catch (e) {
                console.error(`❌ Retry failed for ${uid}:`, e);
              }
            }, 300);
          }
        }
      }
    };

    playRemoteVideos();
  }, [remoteTracks]);

  useEffect(() => {
    const playTeacherVideo = async () => {
      if (!teacherUid || !teacherTracks?.video) {
        console.log('⏸️ Teacher video not available');
        return;
      }

      const container = remoteVideoRefs.current.get(teacherUid);
      if (!container) {
        console.log('⏸️ Teacher video container not ready');
        return;
      }

      try {
        if (teacherTracks.video.isPlaying) {
          return;
        }

        console.log(`▶️ Playing teacher video for UID: ${teacherUid}`);
        
        if (container.tagName === 'VIDEO') {
          await teacherTracks.video.play(container);
          console.log('✅ Teacher video playing');
        } else {
          await teacherTracks.video.play();
          console.log('✅ Teacher video playing (fallback)');
        }
      } catch (error) {
        console.error('❌ Failed to play teacher video:', error);
        
        setTimeout(async () => {
          try {
            if (teacherTracks.video && !teacherTracks.video.isPlaying) {
              if (container.tagName === 'VIDEO') {
                await teacherTracks.video.play(container);
              } else {
                await teacherTracks.video.play();
              }
            }
          } catch (retryError) {
            console.error('❌ Teacher video retry failed:', retryError);
          }
        }, 1000);
      }
    };

    playTeacherVideo();
  }, [teacherUid, teacherTracks?.video]);

  useEffect(() => {
    setStats(prev => ({
      ...prev,
      participantCount: remoteTracks.size + 1
    }));
  }, [remoteTracks]);

  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - starting cleanup...');
      cleanup();
    };
  }, [cleanup]);

  // ============================================
  // Render - Error States
  // ============================================
  if (sessionState.error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="bg-gray-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
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
          <div className="animate-spin h-20 w-20 border-b-2 border-cyan-500 rounded-full mx-auto mb-6"></div>
          <h3 className="text-2xl font-semibold mb-3">Joining Session...</h3>
          <p className="text-gray-400">Connecting to video call</p>
        </div>
      </div>
    );
  }

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        {/* Main Video Area - Teacher's Video or Screen Share */}
        <div className="absolute inset-0">
          <div className="relative w-full h-full bg-black">
            <video
              ref={el => {
                if (el && teacherTracks?.video) {
                  remoteVideoRefs.current.set(teacherUid, el);
                }
              }}
              className="w-full h-full object-contain bg-black"
              autoPlay
              playsInline
              style={{
                display: teacherTracks?.video ? 'block' : 'none',
                backgroundColor: '#000'
              }}
            />
            
            {!teacherTracks?.video && (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4 mx-auto">
                    <span className="text-6xl">👨‍🏫</span>
                  </div>
                  <p className="text-cyan-300 text-xl font-semibold">
                    {teacherProfile?.name || 'Teacher'}
                  </p>
                  <p className="text-cyan-400/60 text-sm mt-2">
                    {teacherTracks?.audio ? 'Audio only' : 'Connecting...'}
                  </p>
                </div>
              </div>
            )}
            
            {teacherScreenSharing && (
              <div className="absolute top-4 left-4 z-10 bg-black/70 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                <Share2 size={16} />
                <span className="text-sm font-medium">Teacher is sharing screen</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-lg p-4 lg:p-6 z-30 border-b border-cyan-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white font-semibold text-sm lg:text-base">Live Class</span>
              </div>
              <div className="flex items-center gap-2 text-cyan-300">
                <Clock size={16} />
                <span className="text-sm lg:text-base font-mono">{formatDuration(stats.duration)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="hidden lg:flex items-center gap-2 bg-gray-800/50 px-3 py-2 rounded-xl">
                <Users size={16} className="text-cyan-400" />
                <span className="text-white text-sm">{stats.participantCount}</span>
              </div>
              
              <button
                onClick={() => setShowChat(!showChat)}
                className="relative p-2 lg:p-3 bg-gray-800/50 hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
              >
                <MessageCircle size={18} className="text-cyan-300" />
                {messages.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">{messages.length > 9 ? '9+' : messages.length}</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Access Top Right Controls */}
        <div className="absolute top-4 right-4 z-30">
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleFullscreen}
              className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-white transition-all duration-200"
              title="Fullscreen"
            >
              <ChevronUp size={18} className="transform rotate-45" />
            </button>
            
            <div className="flex items-center gap-1.5 bg-gray-900/70 backdrop-blur-sm px-3 py-1.5 rounded-xl">
              <div className={`w-2 h-2 rounded-full ${
                stats.connectionQuality === 'good' ? 'bg-green-500 animate-pulse' :
                stats.connectionQuality === 'fair' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <span className="text-white text-xs font-medium">
                {stats.connectionQuality === 'good' ? 'Good' :
                 stats.connectionQuality === 'fair' ? 'Fair' : 'Poor'}
              </span>
            </div>
          </div>
        </div>

        {/* Enhanced Desktop Controls - Centered Floating Bar */}
        <div className="hidden lg:flex absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 border border-cyan-500/30 shadow-2xl z-30">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAudio}
              disabled={!controls.hasMicrophone}
              className={`p-3 rounded-xl transition-all duration-200 ${
                controls.audioEnabled 
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
                  : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white'
              } ${!controls.hasMicrophone ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={controls.audioEnabled ? "Mute" : "Unmute"}
            >
              {controls.audioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            
            <button
              onClick={toggleVideo}
              disabled={!controls.hasCamera}
              className={`p-3 rounded-xl transition-all duration-200 ${
                controls.videoEnabled 
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
                  : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white'
              } ${!controls.hasCamera ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={controls.videoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {controls.videoEnabled ? <Camera size={22} /> : <CameraOff size={22} />}
            </button>
            
            <button
              onClick={toggleScreenShare}
              className="p-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200"
              title="Share screen"
            >
              <Share2 size={22} />
            </button>
            
            <button 
              onClick={toggleHandRaise}
              className={`p-3 rounded-xl transition-all duration-200 ${
                controls.handRaised 
                  ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white animate-pulse' 
                  : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
              }`}
              title={controls.handRaised ? "Lower hand" : "Raise hand"}
            >
              <Hand size={22} />
            </button>
            
            <button 
              onClick={toggleParticipants}
              className={`p-3 rounded-xl transition-all duration-200 ${
                showParticipants 
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
                  : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
              }`}
              title="Participants"
            >
              <Users size={22} />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {stats.participantCount}
              </span>
            </button>
            
            <button 
              onClick={toggleSettings}
              className="p-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200"
              title="Settings"
            >
              <MoreVertical size={22} />
            </button>
            
            <button 
              onClick={leaveSession}
              className="p-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg shadow-red-500/30 transition-all duration-200 ml-2"
              title="Leave call"
            >
              <PhoneOff size={22} />
            </button>
          </div>
        </div>

        {/* Enhanced Mobile Controls */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent backdrop-blur-lg p-4 border-t border-cyan-500/30 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAudio}
                disabled={!controls.hasMicrophone}
                className={`p-3 rounded-xl ${
                  controls.audioEnabled 
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
                    : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
                }`}
              >
                {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              <button
                onClick={toggleVideo}
                disabled={!controls.hasCamera}
                className={`p-3 rounded-xl ${
                  controls.videoEnabled 
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
                    : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
                }`}
              >
                {controls.videoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
              </button>
              
              <button 
                onClick={toggleHandRaise}
                className={`p-3 rounded-xl ${
                  controls.handRaised 
                    ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white animate-pulse' 
                    : 'bg-gradient-to-r from-gray-700 to-gray-800 text-white'
                }`}
              >
                <Hand size={20} />
              </button>
              
              <button 
                onClick={toggleParticipants}
                className="p-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 text-white relative"
              >
                <Users size={20} />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {stats.participantCount}
                </span>
              </button>
            </div>
            
            <button 
              onClick={leaveSession}
              className="p-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white"
            >
              <PhoneOff size={20} />
            </button>
          </div>
          
          {/* Mobile Quick Reactions Row */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <button 
              onClick={() => sendReaction('👍')}
              className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
            >
              👍
            </button>
            <button 
              onClick={() => sendReaction('👏')}
              className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
            >
              👏
            </button>
            <button 
              onClick={() => sendReaction('🎉')}
              className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
            >
              🎉
            </button>
            <button 
              onClick={() => sendReaction('🙋')}
              className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-all duration-200"
            >
              🙋
            </button>
          </div>
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50">
            <div className="w-full h-full max-w-2xl bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col">
              <div className="p-4 border-b border-cyan-500/20 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white">Chat</h3>
                  <p className="text-cyan-300 text-xs">Live Class</p>
                </div>
                <button 
                  onClick={() => setShowChat(false)}
                  className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <MessageCircle className="mx-auto mb-4 opacity-50" size={48} />
                    <p className="text-lg font-semibold">No messages yet</p>
                    <p className="text-sm mt-2">Be the first to say hello!</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="p-3 rounded-xl bg-gray-800/50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold text-white text-sm">
                              {msg.profiles?.name || msg.profiles?.full_name || 'Unknown User'}
                            </div>
                            {msg.message_type === 'system' && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                                System
                              </span>
                            )}
                          </div>
                          <p className="text-cyan-100 text-sm">{msg.message_text}</p>
                          <p className="text-cyan-400 text-xs mt-2">
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t border-cyan-500/20">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-800/50 border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm"
                  />
                  <button 
                    onClick={() => sendMessage()}
                    disabled={!newMessage.trim()}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl font-semibold text-white transition-all duration-200 text-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Participants Overlay for All Screen Sizes */}
        {showParticipants && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 lg:p-6 border-b border-cyan-500/30 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-xl">
                    <Users size={24} className="text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold text-white">Participants</h2>
                    <p className="text-cyan-300 text-sm">
                      {Array.from(remoteTracks.entries()).filter(([uid]) => {
                        const uidString = uid.toString();
                        const profile = userProfiles.get(uidString);
                        return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
                      }).length + 1} online • {stats.participantCount} total
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Filter buttons - Desktop only */}
                  <div className="hidden lg:flex items-center gap-2 bg-gray-800/50 rounded-xl p-1">
                    <button
                      onClick={() => setParticipantsFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        participantsFilter === 'all' 
                          ? 'bg-cyan-600 text-white' 
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setParticipantsFilter('teachers')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        participantsFilter === 'teachers' 
                          ? 'bg-cyan-600 text-white' 
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Teachers
                    </button>
                    <button
                      onClick={() => setParticipantsFilter('students')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        participantsFilter === 'students' 
                          ? 'bg-cyan-600 text-white' 
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Students
                    </button>
                  </div>
                  
                  {/* Sort dropdown - Mobile */}
                  <div className="lg:hidden">
                    <select
                      value={participantsSort}
                      onChange={(e) => setParticipantsSort(e.target.value)}
                      className="bg-gray-800/50 border border-cyan-500/30 rounded-xl px-3 py-2 text-white text-sm"
                    >
                      <option value="name">Sort by Name</option>
                      <option value="role">Sort by Role</option>
                      <option value="joinTime">Sort by Join Time</option>
                    </select>
                  </div>
                  
                  {/* Close button */}
                  <button 
                    onClick={() => setShowParticipants(false)}
                    className="p-2 lg:p-3 bg-gray-800/50 hover:bg-red-500/20 rounded-xl text-cyan-300 hover:text-white transition-all duration-200 ml-2"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Participants Grid */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              {getSortedParticipants().length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-800/50 to-cyan-500/10 flex items-center justify-center mb-6">
                    <Users size={48} className="text-cyan-500/50" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Participants</h3>
                  <p className="text-cyan-300/60 text-sm max-w-md">
                    Participants will appear here when they join the session
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getSortedParticipants().map((participant, index) => {
                    const isCurrentUser = participant.uid === String(sessionState.sessionInfo?.uid || studentId);
                    const isTeacher = participant.isTeacher;
                    const displayName = participant.profile?.name || 
                                      participant.profile?.display_name || 
                                      (isCurrentUser ? 'You' : 'Participant');
                    
                    return (
                      <div
                        key={participant.uid}
                        className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300"
                      >
                        {/* Video/Avatar Container */}
                        <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-950">
                          {participant.tracks.video && participant.hasVideo ? (
                            <div 
                              ref={el => {
                                if (el && participant.tracks.video && participant.hasVideo) {
                                  remoteVideoRefs.current.set(participant.uid, el);
                                }
                              }}
                              className="participant-video-container w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                                <span className="text-3xl">
                                  {isTeacher ? '👨‍🏫' : isCurrentUser ? '👤' : '🎓'}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Status Overlay */}
                          <div className="absolute top-3 left-3 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              participant.hasAudio ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                            }`} />
                            {isCurrentUser && (
                              <span className="bg-cyan-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                YOU
                              </span>
                            )}
                            {isTeacher && (
                              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                TEACHER
                              </span>
                            )}
                          </div>
                          
                          {/* Video/Audio Status */}
                          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                            {!participant.hasVideo && (
                              <div className="bg-black/70 backdrop-blur-sm p-1.5 rounded-lg">
                                <CameraOff size={14} className="text-gray-300" />
                              </div>
                            )}
                            {!participant.hasAudio && (
                              <div className="bg-black/70 backdrop-blur-sm p-1.5 rounded-lg">
                                <MicOff size={14} className="text-gray-300" />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Participant Info */}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-white truncate text-sm lg:text-base">
                              {displayName}
                            </h4>
                            {participant.handRaised && (
                              <Hand size={16} className="text-yellow-400 animate-pulse" />
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                isTeacher 
                                  ? 'bg-purple-500/20 text-purple-300' 
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {isTeacher ? 'Teacher' : 'Student'}
                              </span>
                              <span className="text-gray-400 text-xs">
                                {participant.hasVideo ? 'Video On' : 'Video Off'}
                              </span>
                            </div>
                            
                            {/* Admin actions - only for teachers/own user */}
                            {!isCurrentUser && isTeacher && (
                              <button
                                onClick={() => kickParticipant(participant.uid)}
                                className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 hover:bg-red-500/10 rounded-lg"
                                title="Remove participant"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Controls */}
            <div className="p-4 lg:p-6 border-t border-cyan-500/30 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400 text-sm">
                      {getSortedParticipants().filter(p => p.hasAudio).length} speaking
                    </span>
                  </div>
                  <div className="hidden lg:block text-cyan-300 text-sm">
                    Press <kbd className="px-2 py-1 bg-gray-800/50 rounded-lg text-xs">ESC</kbd> to close
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Copy participant list */}
                  <button
                    onClick={() => {
                      const participantNames = getSortedParticipants()
                        .map(p => p.profile?.name || 'Participant')
                        .join(', ');
                      navigator.clipboard.writeText(participantNames);
                      sendMessage('Copied participant list', 'system');
                    }}
                    className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-white text-sm transition-all"
                  >
                    Copy List
                  </button>
                  
                  {/* Refresh button */}
                  <button
                    onClick={() => fetchParticipants(sessionState.sessionInfo?.meetingId)}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl text-cyan-300 text-sm transition-all"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50">
            <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-cyan-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Settings</h3>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-white">Audio Settings</h4>
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-gray-300 text-sm">Microphone: {controls.hasMicrophone ? 'Available' : 'Not available'}</p>
                    <p className="text-gray-300 text-sm mt-1">Status: {controls.audioEnabled ? 'On' : 'Off'}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-white">Video Settings</h4>
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-gray-300 text-sm">Camera: {controls.hasCamera ? 'Available' : 'Not available'}</p>
                    <p className="text-gray-300 text-sm mt-1">Status: {controls.videoEnabled ? 'On' : 'Off'}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-white">Connection</h4>
                  <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
                    <p className="text-gray-300 text-sm">Quality: {stats.connectionQuality}</p>
                    <p className="text-gray-300 text-sm">Participants: {stats.participantCount}</p>
                    <p className="text-gray-300 text-sm">Duration: {formatDuration(stats.duration)}</p>
                  </div>
                </div>
                
                <button 
                  onClick={leaveSession}
                  className="w-full mt-6 p-4 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-semibold transition-all duration-200"
                >
                  Leave Call
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIP Window */}
        {(controls.hasCamera || controls.hasMicrophone) && (
          <div 
            ref={pipRef}
            style={{
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: '340px', 
              height: '255px', 
              zIndex: 99999,
              cursor: isDragging ? 'grabbing' : 'grab',
              transition: isDragging ? 'none' : 'all 0.2s ease',
              touchAction: 'none',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(6, 182, 212, 0.3)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`local-video-pip ${isDragging ? 'local-video-pip-dragging' : ''}`}
          >
            <div className="relative w-full h-full bg-black">
              {/* Video Container - Full Size with Better Styling */}
              <div className="w-full h-full relative">
                {/* Local Video Display */}
                <div 
                  ref={localVideoRef}
                  className="w-full h-full bg-black"
                  style={{ 
                    transform: 'scaleX(-1)',
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}
                />
                
                {/* Placeholder when video is off */}
                {(!controls.videoEnabled || !localTracks.video) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
                    <div className="text-center p-4">
                      <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CameraOff className="text-gray-400 w-8 h-8" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Camera Off</p>
                      <p className="text-gray-500 text-xs mt-1">Tap to enable</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Status Indicator - Bottom Left */}
              <div className="absolute bottom-3 left-3 z-10">
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/10 shadow-lg">
                  <div className={`w-3 h-3 rounded-full ${
                    controls.audioEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className="text-white text-xs font-bold tracking-wider">YOU</span>
                  {controls.videoEnabled && (
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1" />
                  )}
                </div>
              </div>
              
              {/* Drag Handle - Top Center */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 no-drag">
                <div className="w-12 h-1.5 bg-white/30 rounded-full"></div>
              </div>
            </div>
            
            {/* Optional: Add a subtle glow effect when video is active */}
            {controls.videoEnabled && localTracks.video && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border border-cyan-500/20 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)]"></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentVideoCall;