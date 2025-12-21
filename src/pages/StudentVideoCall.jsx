import React, { useState, useEffect, useRef, useCallback } from 'react';
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
// FIXED: useDraggable Hook with Proper Error Handling
// ============================================
const useDraggable = () => {
  const [position, setPosition] = useState(() => {
    try {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobile = viewportWidth < 768;
      
      const pipWidth = isMobile ? 160 : 280;
      const pipHeight = isMobile ? 120 : 210;
      
      return {
        x: Math.max(20, viewportWidth - pipWidth - 20),
        y: Math.max(20, viewportHeight - pipHeight - 20)
      };
    } catch (error) {
      console.error('Error initializing PIP position:', error);
      return { x: 20, y: 20 };
    }
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const getPipSize = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    return {
      width: isMobile ? 160 : 280,
      height: isMobile ? 120 : 210
    };
  }, []);

  const handleMouseDown = (e) => {
    if (e.target.closest('.no-drag')) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleTouchStart = (e) => {
    if (e.target.closest('.no-drag')) return;
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMove = (clientX, clientY) => {
      if (!isDragging) return;
      
      let newX = clientX - dragStart.current.x;
      let newY = clientY - dragStart.current.y;
      
      const pipSize = getPipSize();
      const maxX = window.innerWidth - pipSize.width;
      const maxY = window.innerHeight - pipSize.height;
      
      newX = Math.max(10, Math.min(newX, maxX - 10));
      newY = Math.max(10, Math.min(newY, maxY - 10));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseMove = (e) => {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };
    
    const handleTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    
    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('touchcancel', handleEnd);
      };
    }
  }, [isDragging, getPipSize]);

  return {
    position,
    isDragging,
    setPosition,
    handleMouseDown,
    handleTouchStart
  };
};

const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
  // ============================================
  // FIXED: State and Refs
  // ============================================
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const remoteVideoRefs = useRef(new Map());
  const pipRef = useRef(null);
  
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  
  // FIXED: Added initialization flags to prevent multiple setups
  const initializationRef = useRef({
    clientCreated: false,
    listenersSet: false,
    joined: false
  });
  
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false,
    hasMicrophone: false
  });
  
  const localVideoRef = useRef(null);
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

  const clientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const messagesPollIntervalRef = useRef(null);
  const profilePollingRef = useRef();

  // ============================================
  // FIXED: Drag State
  // ============================================
  const { position, isDragging, setPosition, handleMouseDown, handleTouchStart } = useDraggable();

  // ============================================
  // FIXED: Window Resize Handler
  // ============================================
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

  // ============================================
  // FIXED: Video Playback with Error Handling
  // ============================================
  useEffect(() => {
    const playVideos = () => {
      try {
        remoteTracks.forEach((tracks, uid) => {
          const container = remoteVideoRefs.current.get(String(uid));
          // FIXED: Added null checks and optional chaining
          if (container && tracks?.video && typeof tracks.video.play === 'function' && !tracks.video.isPlaying) {
            // FIXED: Safely call play with error handling
            const playPromise = tracks.video.play(container);
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(err => {
                console.warn(`Failed to play video for ${uid}:`, err);
                // Don't throw, just log
              });
            }
          }
        });
      } catch (error) {
        console.error('Error playing remote videos:', error);
        // Don't crash the app on video playback errors
      }
    };
    
    playVideos();
  }, [remoteTracks]);

  // ============================================
  // FIXED: Initialization - Run Once
  // ============================================
  useEffect(() => {
    // Prevent multiple initializations
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

    // Cleanup only on unmount
    return () => {
      if (initializationRef.current.joined) {
        cleanup();
      }
    };
  }, [meetingId, studentId]);

  // ============================================
  // FIXED: Sync Profiles with Tracks
  // ============================================
  useEffect(() => {
    if (remoteTracks.size > 0 && sessionState.isJoined) {
      syncProfilesWithTracks();
    }
  }, [remoteTracks, sessionState.isJoined]);

  // ============================================
  // FIXED: Participant Sync Interval
  // ============================================
  useEffect(() => {
    if (!sessionState.isJoined || !sessionState.sessionInfo?.meetingId) return;
    
    const syncInterval = setInterval(() => {
      fetchParticipants(sessionState.sessionInfo.meetingId);
    }, 15000);
    
    return () => clearInterval(syncInterval);
  }, [sessionState.isJoined, sessionState.sessionInfo?.meetingId]);

  // ============================================
  // FIXED: Helper Functions
  // ============================================
  const fetchParticipants = async (meetingId) => {
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
  };

  const syncProfilesWithTracks = () => {
    const remoteUids = Array.from(remoteTracks.keys()).map(uid => String(uid));
    const profileUids = Array.from(userProfiles.keys());
    
    const missingUids = remoteUids.filter(uid => !profileUids.includes(uid));
    
    if (missingUids.length > 0 && sessionState.sessionInfo?.meetingId) {
      fetchProfilesByUids(missingUids);
    }
  };

  const fetchProfilesByUids = async (uids) => {
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
  };

  // ============================================
  // FIXED: Initialize Session with Proper Guards
  // ============================================
  const initializeSession = async () => {
    try {
      // Prevent re-initialization
      if (initializationRef.current.clientCreated) {
        console.log('Client already created, skipping initialization');
        return;
      }

      const sessionLookup = await studentvideoApi.getSessionByClassId(classId);
      
      if (!sessionLookup.success || !sessionLookup.exists || !sessionLookup.isActive) {
        throw new Error(sessionLookup.error || 'No active session found');
      }

      const effectiveMeetingId = sessionLookup.meetingId;
      
      await fetchParticipants(effectiveMeetingId);
      
      // Create client only once
      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        initializationRef.current.clientCreated = true;
      }

      // Set up event listeners only once
      if (!initializationRef.current.listenersSet) {
        setupAgoraEventListeners();
        initializationRef.current.listenersSet = true;
      }

      const sessionData = await studentvideoApi.joinVideoSession(
        effectiveMeetingId,
        studentId,
        'student'
      );

      if (!sessionData.success || !sessionData.token) {
        throw new Error(sessionData.error || 'Failed to join session');
      }

      const studentAgoraUid = sessionData.uid;

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

      await joinChannel({
        ...sessionData,
        uid: studentAgoraUid
      });

      // Delay participant fetch to ensure we're connected
      setTimeout(() => {
        fetchParticipants(effectiveMeetingId);
      }, 2000);

    } catch (error) {
      console.error('Init Error:', error);
      setSessionState(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to connect' 
      }));
    }
  };

  // ============================================
  // FIXED: Setup Agora Event Listeners
  // ============================================
  const setupAgoraEventListeners = () => {
    const client = clientRef.current;
    if (!client) return;

    console.log('Setting up Agora event listeners');

    client.on('user-joined', async (user) => {
      console.log(`User joined: ${user.uid}`);
      const uid = String(user.uid);
      
      // Skip if this is the current user
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
      const uid = String(user.uid);
      
      try {
        await client.subscribe(user, mediaType);
        
        setRemoteTracks(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(uid) || { audio: null, video: null };
          
          if (mediaType === 'video') {
            existing.video = user.videoTrack;
          } else if (mediaType === 'audio') {
            existing.audio = user.audioTrack;
            user.audioTrack?.play();
          }
          
          newMap.set(uid, existing);
          return newMap;
        });
        
      } catch (error) {
        console.error('Subscribe error:', error);
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
  };

  // ============================================
  // FIXED: Join Channel
  // ============================================
  const joinChannel = async (sessionData) => {
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

      // Check if already joined
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

      // Start profile polling
      if (profilePollingRef.current) {
        clearInterval(profilePollingRef.current);
      }
      
      profilePollingRef.current = setInterval(() => {
        if (sessionState.sessionInfo?.meetingId) {
          fetchParticipants(sessionState.sessionInfo.meetingId);
        }
      }, 10000);

      await createAndPublishLocalTracks();

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();
      
      await updateParticipantStatus({ status: 'joined' });

      if (sessionData.session?.id) {
        startMessagePolling(sessionData.session.id);
      }

    } catch (error) {
      console.error('Join channel error:', error);
      throw error;
    }
  };

  // ============================================
  // FIXED: Create and Publish Local Tracks
  // ============================================
  const createAndPublishLocalTracks = async () => {
    try {
      const deviceInfo = await detectAvailableDevices();
      let audioTrack = null;
      let videoTrack = null;

      if (deviceInfo.hasMicrophone) {
        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true, ANS: true, AGC: true
          });
        } catch (error) {
          console.warn('Failed to create audio track:', error);
        }
      }

      if (deviceInfo.hasCamera) {
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: "480p_1",
            optimizationMode: 'detail'
          });
        } catch (error) {
          console.warn('Failed to create video track:', error);
        }
      }

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      if (videoTrack && localVideoRef.current) {
        try {
          await videoTrack.play(localVideoRef.current);
        } catch (error) {
          console.warn('Failed to play local video:', error);
        }
      }

      if (clientRef.current) {
        const tracks = [audioTrack, videoTrack].filter(t => t !== null);
        if (tracks.length > 0) {
          try {
            await clientRef.current.publish(tracks);
          } catch (error) {
            console.error('Failed to publish tracks:', error);
          }
        }
      }

    } catch (error) {
      console.error('Track initialization failed:', error);
    }
  };

  // ============================================
  // FIXED: Detect Available Devices
  // ============================================
  const detectAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      setControls(prev => ({
        ...prev,
        hasCamera: cameras.length > 0,
        hasMicrophone: microphones.length > 0
      }));
      
      return { hasCamera: cameras.length > 0, hasMicrophone: microphones.length > 0 };
      
    } catch (error) {
      console.warn('Device enumeration failed:', error);
      return { hasCamera: false, hasMicrophone: false };
    }
  };

  // ============================================
  // Other Helper Functions (unchanged but included for completeness)
  // ============================================
  const toggleAudio = async () => {
    if (!localTracks.audio || !controls.hasMicrophone) {
      setControls(prev => ({ ...prev, audioEnabled: false }));
      return;
    }

    try {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      await updateParticipantStatus({ audioEnabled: newState });
    } catch (error) {
      console.error('Toggle audio error:', error);
    }
  };

  const toggleVideo = async () => {
    if (!localTracks.video || !controls.hasCamera) {
      setControls(prev => ({ ...prev, videoEnabled: false }));
      return;
    }

    try {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      await updateParticipantStatus({ videoEnabled: newState });
    } catch (error) {
      console.error('Toggle video error:', error);
    }
  };

  const updateParticipantStatus = async (updates) => {
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
  };

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
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

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // FIXED: Cleanup Function
  // ============================================
  const cleanup = async () => {
    console.log('Cleaning up student session...');
    
    // Clear intervals
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (messagesPollIntervalRef.current) clearInterval(messagesPollIntervalRef.current);
    if (profilePollingRef.current) clearInterval(profilePollingRef.current);

    // Stop and close local tracks
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

    // Reset refs
    initializationRef.current = {
      clientCreated: false,
      listenersSet: false,
      joined: false
    };

    setRemoteTracks(new Map());
    setUserProfiles(new Map());
  };

  // ============================================
  // FIXED: Leave Session
  // ============================================
  const leaveSession = async () => {
    try {
      await updateParticipantStatus({ status: 'left' });
      await cleanup();
      if (onLeaveCall) onLeaveCall();
    } catch (error) {
      console.error('Leave session error:', error);
    }
  };

  // ============================================
  // Render - Error States
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
          <div className="animate-spin h-20 w-20 border-b-2 border-cyan-500 rounded-full mx-auto mb-6"></div>
          <h3 className="text-2xl font-semibold mb-3">Joining Session...</h3>
          <p className="text-gray-400">Connecting to video call</p>
        </div>
      </div>
    );
  }

  // ============================================
  // Main Render - Only show when joined
  // ============================================
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900/95 backdrop-blur-lg border-b border-cyan-500/20 text-white p-3 sm:p-4 md:p-5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <div>
            <h2 className="font-bold text-sm sm:text-base md:text-lg truncate">Class Session</h2>
            <div className="flex items-center gap-2 text-xs text-cyan-300">
              <Clock size={10} className="sm:w-3 sm:h-3" />
              {formatDuration(stats.duration)}
              <Users size={10} className="sm:w-3 sm:h-3 ml-2" />
              {stats.participantCount}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowChat(!showChat)}
            className={`p-2.5 rounded-xl transition-all duration-200 ${
              showChat ? 'bg-cyan-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-cyan-300'
            }`}
          >
            <MessageCircle size={16} className="sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={leaveSession}
            className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 shadow-lg text-sm"
          >
            <PhoneOff size={16} />
            <span className="hidden xs:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Teacher Video Area */}
        <div className="flex-1 relative bg-gray-950">
          {Array.from(remoteTracks.entries())
            .filter(([uid]) => {
              const uidString = uid.toString();
              const profile = userProfiles.get(uidString);
              return uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher';
            })
            .map(([uid, tracks]) => (
              <div key={uid} className="absolute inset-0 bg-black">
                <div 
                  ref={el => {
                    if (el && tracks.video) {
                      requestAnimationFrame(() => {
                        if (!tracks.video.isPlaying) {
                          tracks.video.play(el);
                        }
                      });
                    }
                  }}
                  className="w-full h-full bg-black"
                />
                
                {!tracks.video && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-8xl text-yellow-500/30 mb-4">👨‍🏫</div>
                  </div>
                )}
              </div>
            ))}
          
          {!teacherUid && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-8xl text-yellow-500/20">👨‍🏫</div>
                <h3 className="text-2xl font-bold text-white mb-3">Waiting for Teacher</h3>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-800/30 bg-gray-900/80">
          <div className="p-4 border-b border-gray-800/30">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-cyan-400" />
              <h4 className="font-bold text-white">Classmates</h4>
              <span className="ml-auto text-sm text-gray-400">
                {Array.from(remoteTracks.entries()).filter(([uid]) => {
                  const uidString = uid.toString();
                  const profile = userProfiles.get(uidString);
                  return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
                }).length} online
              </span>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Array.from(remoteTracks.entries())
                .filter(([uid]) => {
                  const uidString = uid.toString();
                  const profile = userProfiles.get(uidString);
                  return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
                })
                .map(([uid, tracks]) => {
                  const uidString = uid.toString();
                  const profile = userProfiles.get(uidString);
                  const displayName = profile?.name || 'Student';
                  
                  return (
                    <div key={uid} className="flex items-center gap-2 p-2 rounded-xl bg-gray-800/30">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          {tracks.video ? (
                            <div 
                              ref={el => {
                                if (el && tracks.video) {
                                  tracks.video.play(el);
                                }
                              }}
                              className="w-full h-full"
                            />
                          ) : (
                            <span className="text-lg">🎓</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">{displayName}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="lg:hidden bg-gray-900/95 border-t border-cyan-500/20 p-3">
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
          </div>
        </div>
      </div>

      {/* PIP - Fixed with proper error handling */}
      {(controls.hasCamera || controls.hasMicrophone) && (
        <div 
          ref={pipRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '280px',
            height: '157.5px',
            zIndex: 99999,
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'all 0.2s ease',
            touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`local-video-pip ${isDragging ? 'local-video-pip-dragging' : ''}`}
        >
          <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden border-2 border-cyan-500/70">
            <div className="w-full h-full bg-black relative">
              <div 
                ref={localVideoRef}
                className="w-full h-full"
                style={{ 
                  transform: 'scaleX(-1)',
                  opacity: controls.videoEnabled ? 1 : 0
                }}
              />
              
              {(!controls.videoEnabled || !localTracks.video) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <CameraOff className="text-gray-400 w-8 h-8" />
                </div>
              )}
            </div>
            
            <div className="absolute bottom-2 left-2">
              <div className="flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded-lg">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  controls.audioEnabled ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-white text-[10px] font-bold">YOU</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentVideoCall;