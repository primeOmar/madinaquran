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

const useDraggable = (initialPosition = { x: 0, y: 0 }) => {
  const [position, setPosition] = useState(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < 768;
    
    const pipWidth = isMobile ? 160 : 280;
    const pipHeight = isMobile ? 120 : 210;
    
    return {
      x: Math.max(20, Math.min(viewportWidth - pipWidth - 20, viewportWidth - pipWidth - 20)),
      y: Math.max(20, Math.min(viewportHeight - pipHeight - 20, viewportHeight - pipHeight - 20))
    };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);

  const getPipSize = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    return {
      width: isMobile ? 160 : 280,
      height: isMobile ? 120 : 210
    };
  }, []);

  const handleStart = useCallback((clientX, clientY) => {
    setIsDragging(true);
    dragStart.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  }, [position]);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.no-drag')) return;
    e.preventDefault();
    e.stopPropagation();
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.no-drag')) return;
    
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapRef.current;
    if (tapLength < 300 && tapLength > 0) {
      e.preventDefault();
      return;
    }
    lastTapRef.current = currentTime;
    
    const touch = e.touches[0];
    e.preventDefault();
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart]);

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
    
    const handleEnd = () => {
      setIsDragging(false);
      const snapThreshold = 20;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pipSize = getPipSize();
      
      setPosition(prev => {
        let { x, y } = prev;
        
        if (x > viewportWidth - pipSize.width - snapThreshold) {
          x = viewportWidth - pipSize.width - 20;
        }
        if (x < snapThreshold) {
          x = 20;
        }
        if (y > viewportHeight - pipSize.height - snapThreshold) {
          y = viewportHeight - pipSize.height - 20;
        }
        if (y < snapThreshold) {
          y = 20;
        }
        
        return { x, y };
      });
    };

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
    handleMouseDown,
    handleTouchStart
  };
};

const StudentVideoCall = ({ classId, studentId, meetingId, onLeaveCall }) => {
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
  const profilePollingRef = useRef();
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

// ============================================
// PART 2: Add Drag State - FIXED VERSION
// ============================================
const { position, isDragging, handleMouseDown, handleTouchStart } = useDraggable({
  x: window.innerWidth - 340,
  y: window.innerHeight - 260
});

  // ============================================
  // Initialization
  // ============================================

  // Add this useEffect to your component, near the other useEffects
useEffect(() => {
  const handleWindowResize = () => {
    // Keep PIP within viewport bounds on resize
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const pipWidth = window.innerWidth < 768 ? 160 : 280;
    const pipHeight = window.innerWidth < 768 ? 120 : 210;
    
    setPosition(prev => ({
      x: Math.max(20, Math.min(prev.x, viewportWidth - pipWidth - 20)),
      y: Math.max(20, Math.min(prev.y, viewportHeight - pipHeight - 20))
    }));
  };
  
  window.addEventListener('resize', handleWindowResize);
  
  return () => {
    window.removeEventListener('resize', handleWindowResize);
  };
}, []);

  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [meetingId, studentId]);

  useEffect(() => {
    if (remoteTracks.size > 0 && sessionState.isJoined) {
      syncProfilesWithTracks();
    }
  }, [remoteTracks, sessionState.isJoined]);

  useEffect(() => {
    if (!sessionState.isJoined) return;
    
    const syncInterval = setInterval(() => {
      if (sessionState.sessionInfo?.meetingId) {
        fetchParticipants(sessionState.sessionInfo.meetingId);
      }
    }, 15000);
    
    return () => clearInterval(syncInterval);
  }, [sessionState.isJoined, sessionState.sessionInfo?.meetingId]);

  useEffect(() => {
  remoteTracks.forEach((tracks, uid) => {
    const container = remoteVideoRefs.current.get(String(uid));
    if (container && tracks.video && !tracks.video.isPlaying) {
      tracks.video.play(container).catch(err => 
        console.warn(`Failed to play video for ${uid}:`, err)
      );
    }
  });
}, [remoteTracks]);
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
        
        return newProfiles;
      } else {
        return new Map();
      }
    } catch (error) {
      console.error('❌ Failed to fetch participants:', error);
      return new Map();
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
      console.warn('⚠️ Failed to fetch profiles by UIDs:', error);
    }
  };

  const initializeSession = async () => {
    try {
      const sessionLookup = await studentvideoApi.getSessionByClassId(classId);
      
      if (!sessionLookup.success || !sessionLookup.exists || !sessionLookup.isActive) {
        throw new Error(sessionLookup.error || 'No active session found. Waiting for teacher...');
      }

      const effectiveMeetingId = sessionLookup.meetingId;
      
      await fetchParticipants(effectiveMeetingId);
      
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      clientRef.current.on('user-joined', async (remoteUser) => {
        const remoteUid = String(remoteUser.uid);

        try {
          const response = await studentvideoApi.getSessionParticipants(effectiveMeetingId);
          
          if (response.success && response.participants) {
            const newUser = response.participants.find(p => String(p.agora_uid) === remoteUid);
            
            if (newUser) {
              const isTeacher = newUser.role === 'teacher' || newUser.is_teacher;
              
              setUserProfiles(prev => {
                const updated = new Map(prev);
                updated.set(remoteUid, {
                  id: newUser.user_id,
                  agora_uid: newUser.agora_uid,
                  name: newUser.display_name || newUser.name || 'Unknown User',
                  display_name: newUser.display_name || newUser.name || 'Unknown User',
                  role: isTeacher ? 'teacher' : 'student',
                  is_teacher: isTeacher,
                  avatar_url: newUser.avatar_url
                });
                
                return updated;
              });
              
              if (isTeacher) {
                setTeacherUid(remoteUid);
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch profile for joined user:', error);
        }

        setRemoteTracks(prev => {
          const updated = new Map(prev);
          updated.set(remoteUid, { audio: null, video: null });
          return updated;
        });

        setStats(prev => ({
          ...prev,
          participantCount: clientRef.current.remoteUsers.length + 1
        }));
      });

      clientRef.current.on('user-published', async (remoteUser, mediaType) => {
        const remoteUid = String(remoteUser.uid);

        try {
          await clientRef.current.subscribe(remoteUser, mediaType);

          setRemoteTracks(prev => {
            const updated = new Map(prev);
            const existing = updated.get(remoteUid) || { audio: null, video: null };
            
            if (mediaType === 'audio') {
              existing.audio = remoteUser.audioTrack;
              remoteUser.audioTrack?.play();
            } else if (mediaType === 'video') {
              existing.video = remoteUser.videoTrack;
            }
            
            updated.set(remoteUid, existing);
            return updated;
          });
        } catch (error) {
          console.error('❌ Subscribe error:', error);
        }
      });

      clientRef.current.on('user-unpublished', (remoteUser, mediaType) => {
        const remoteUid = String(remoteUser.uid);

        setRemoteTracks(prev => {
          const updated = new Map(prev);
          const existing = updated.get(remoteUid);
          
          if (existing) {
            if (mediaType === 'audio') {
              existing.audio?.stop();
              existing.audio = null;
            } else if (mediaType === 'video') {
              existing.video?.stop();
              existing.video = null;
            }
            updated.set(remoteUid, existing);
          }
          
          return updated;
        });
      });

      clientRef.current.on('user-left', (remoteUser) => {
        const remoteUid = String(remoteUser.uid);

        setRemoteTracks(prev => {
          const updated = new Map(prev);
          const tracks = updated.get(remoteUid);
          
          if (tracks) {
            tracks.audio?.stop();
            tracks.video?.stop();
          }
          
          updated.delete(remoteUid);
          return updated;
        });

        setUserProfiles(prev => {
          const updated = new Map(prev);
          updated.delete(remoteUid);
          return updated;
        });

        setStats(prev => ({
          ...prev,
          participantCount: clientRef.current.remoteUsers.length + 1
        }));
      });

      clientRef.current.on('connection-state-change', (curState, prevState) => {
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

      setTimeout(() => {
        fetchParticipants(effectiveMeetingId);
      }, 2000);

    } catch (error) {
      console.error('❌ Init Error:', error);
      setSessionState(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to connect' 
      }));
    }
  };

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;

      if (!appId || appId.length !== 32) {
        throw new Error(`Invalid App ID: ${appId?.length || 0} chars, expected 32`);
      }

      if (!channel) {
        throw new Error('Channel name is missing');
      }

      if (!token || token.length < 100) {
        throw new Error(`Invalid token: ${token?.length || 0} chars, expected 100+`);
      }

      setupAgoraEventListeners();

      const joinedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );
      
      if (sessionState.sessionInfo?.meetingId) {
        fetchParticipants();
        
        if (profilePollingRef.current) {
          clearInterval(profilePollingRef.current);
        }
        
        profilePollingRef.current = setInterval(() => {
          if (sessionState.sessionInfo?.meetingId) {
            fetchParticipants();
          }
        }, 10000);
      }

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
      console.error('❌ STUDENT Join channel error:', error);
      
      if (error.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        if (error.message?.includes('invalid token')) {
          throw new Error(
            'Token authentication failed. This usually means:\n' +
            '1. Token expired\n' +
            '2. Token/channel mismatch\n' +
            '3. Wrong App Certificate\n\n' +
            'Please refresh and try again.'
          );
        } else {
          throw new Error('Cannot connect to video servers. Check your internet connection.');
        }
      } else if (error.code === 'INVALID_TOKEN') {
        throw new Error('Session token is invalid. Please refresh and try again.');
      }
      
      throw error;
    }
  };

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
      console.warn('⚠️ Device enumeration failed:', error);
      return { hasCamera: false, hasMicrophone: false };
    }
  };

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;
    if (!client) return;

    client.on('user-joined', async (user) => {
      const uid = String(user.uid);
      
      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(uid)) {
          newMap.set(uid, { audio: null, video: null });
        }
        return newMap;
      });
      
      if (sessionState.sessionInfo?.meetingId) {
        try {
          const response = await studentvideoApi.getSessionParticipants(sessionState.sessionInfo.meetingId);
          
          if (response.success && response.participants) {
            const newUser = response.participants.find(p => String(p.agora_uid) === uid);
            
            if (newUser) {
              const isTeacher = newUser.role === 'teacher' || newUser.is_teacher;
              
              setUserProfiles(prev => {
                const updated = new Map(prev);
                updated.set(uid, {
                  id: newUser.user_id,
                  agora_uid: newUser.agora_uid,
                  name: newUser.display_name || newUser.name || 'Unknown User',
                  display_name: newUser.display_name || newUser.name || 'Unknown User',
                  role: isTeacher ? 'teacher' : 'student',
                  is_teacher: isTeacher,
                  avatar_url: newUser.avatar_url
                });
                
                return updated;
              });
              
              if (isTeacher) {
                setTeacherUid(uid);
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch profile for joined user:', error);
        }
      }
      
      updateParticipantCount();
    });

    client.on('user-published', async (user, mediaType) => {
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
        console.error('❌ Subscribe error:', error);
      }
      
      updateParticipantCount();
    });

    client.on('user-unpublished', (user, mediaType) => {
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
      
      updateParticipantCount();
    });

    client.on('user-left', (user) => {
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
        
        if (sessionState.sessionInfo?.meetingId) {
          setTimeout(() => {
            fetchParticipants(sessionState.sessionInfo.meetingId);
          }, 1000);
        }
      }
    });
  };

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
      console.error('❌ Toggle audio error:', error);
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
      console.error('❌ Toggle video error:', error);
    }
  };

  const toggleHandRaise = () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    if (sessionState.sessionInfo?.session?.id) {
      sendMessage(
        newState ? '✋ Raised hand' : 'Lowered hand',
        'system'
      );
    }
  };

  const leaveSession = async () => {
    try {
      await updateParticipantStatus({ status: 'left' });
      
      await cleanup();
      
      if (onLeaveCall) {
        onLeaveCall();
      }
    } catch (error) {
      console.error('Leave session error:', error);
    }
  };

  const handleTeacherCommand = (command) => {
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

  const updateParticipantStatus = async (updates) => {
    try {
      if (!sessionState.sessionInfo?.session?.id) {
        return;
      }

      const statusUpdate = {
        ...updates,
        timestamp: new Date().toISOString(),
        student_id: studentId,
        session_id: sessionState.sessionInfo.session.id
      };
      
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
    }
  };

// Updated Track Creation Logic
const createAndPublishLocalTracks = async () => {
  try {
    const deviceInfo = await detectAvailableDevices();
    let audioTrack = null;
    let videoTrack = null;

    if (deviceInfo.hasMicrophone) {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, ANS: true, AGC: true // Professional audio processing
      });
    }

    if (deviceInfo.hasCamera) {
      videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "480p_1", // Use standard profiles for better stability
        optimizationMode: 'detail'
      });
    }

    // Update state
    setLocalTracks({ audio: audioTrack, video: videoTrack });

    // ATTACH VIDEO IMMEDIATELY
    if (videoTrack && localVideoRef.current) {
      await videoTrack.play(localVideoRef.current);
    }

    if (clientRef.current) {
      const tracks = [audioTrack, videoTrack].filter(t => t !== null);
      await clientRef.current.publish(tracks);
    }

    // Update controls state...
  } catch (error) {
    console.error('❌ Track initialization failed:', error);
  }
};

// Use this Effect to ensure video stays playing even after re-renders
useEffect(() => {
  if (localTracks.video && localVideoRef.current && controls.videoEnabled) {
    if (!localTracks.video.isPlaying) {
      localTracks.video.play(localVideoRef.current);
    }
  }
}, [localTracks.video, controls.videoEnabled]);

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

  const startMessagePolling = (sessionId) => {
    loadMessages(sessionId);

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

  const handleDisconnection = async (reason) => {
    console.warn('Disconnected:', reason);
    
    await updateParticipantStatus({ status: 'disconnected' });

    if (reason === 'NETWORK_ERROR') {
      setTimeout(() => {
        if (sessionState.sessionInfo) {
          joinChannel(sessionState.sessionInfo);
        }
      }, 3000);
    }
  };

  const cleanup = async () => {
    console.log('🧹 Cleaning up student session...');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }
    if (profilePollingRef.current) {
      clearInterval(profilePollingRef.current);
    }

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

    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (error) {
        console.warn('Leave channel error:', error);
      }
    }

    setRemoteTracks(new Map());
  };

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


// ============================================
// WORLD-CLASS RESPONSIVE LAYOUT
// ============================================

return (
  <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
    {/* Header - Fixed Top */}
    <div className="bg-gray-900/95 backdrop-blur-lg border-b border-cyan-500/20 text-white p-3 sm:p-4 md:p-5 flex justify-between items-center shrink-0 safe-area-top">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${
          stats.connectionQuality === 'good' || stats.connectionQuality === 'excellent'
            ? 'bg-green-500 animate-pulse' 
            : 'bg-yellow-500'
        }`} />
        <div className="min-w-0">
          <h2 className="font-bold text-sm sm:text-base md:text-lg truncate">Madina Quran Class</h2>
          <div className="flex items-center gap-2 text-xs text-cyan-300">
            <span className="flex items-center gap-1">
              <Clock size={10} className="sm:w-3 sm:h-3" />
              {formatDuration(stats.duration)}
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:flex items-center gap-1">
              <Users size={10} className="sm:w-3 sm:h-3" />
              {stats.participantCount}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setShowChat(!showChat)}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            showChat 
              ? 'bg-cyan-600 text-white' 
              : 'bg-gray-800 hover:bg-gray-700 text-cyan-300'
          }`}
          title="Toggle Chat"
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

    {/* Main Content - Responsive Grid */}
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      {/* Primary Video Area - Teacher */}
      <div className="flex-1 relative bg-gray-950 min-h-[40vh] md:min-h-0">
        {Array.from(remoteTracks.entries())
          .filter(([uid]) => {
            const uidString = uid.toString();
            const profile = userProfiles.get(uidString);
            return uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher';
          })
          .map(([uid, tracks]) => (
            <div key={uid} className="absolute inset-0 bg-black">
              {/* Optimized Video Container */}
              <div 
                ref={el => {
                  if (el && tracks.video) {
                    requestAnimationFrame(() => {
                      try {
                        if (!tracks.video.isPlaying) {
                          tracks.video.play(el);
                        }
                        el.style.objectFit = 'cover';
                        el.style.transform = 'translateZ(0)';
                      } catch (error) {
                        console.warn('Teacher video error:', error);
                      }
                    });
                  }
                }}
                className="w-full h-full bg-black"
              />
              
              {/* Teacher Overlay - Responsive */}
              {!tracks.video && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
                  <div className="text-center p-4">
                    <div className="text-6xl sm:text-8xl text-yellow-500/30 mb-4">👨‍🏫</div>
                    <h3 className="text-xl sm:text-3xl font-bold text-white mb-2">Teacher's Session</h3>
                    <p className="text-gray-400 text-sm sm:text-lg mb-4">
                      {tracks.audio ? 'Audio only' : 'Connecting...'}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Floating Teacher Badge */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
                <div className="flex items-center gap-3 bg-black/70 backdrop-blur-md rounded-2xl p-3 border border-yellow-500/30">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm sm:text-base">T</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm sm:text-base">Teacher</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-xs sm:text-sm">Live</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        
        {/* No Teacher State */}
        {!teacherUid && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
              <div className="relative mb-6">
                <div className="text-8xl text-yellow-500/20">👨‍🏫</div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-ping w-32 h-32 bg-yellow-500/10 rounded-full"></div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Waiting for Teacher</h3>
              <p className="text-gray-400 text-base mb-6">
                The teacher will join shortly. Prepare your questions.
              </p>
              <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/30 p-4 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400">You're connected and ready</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* ============================================
        PART 5: Students Grid for Large Screens
        ============================================ */}
        <div className="hidden lg:block absolute bottom-4 right-4 left-4">
  <div className={`grid gap-3 ${
    remoteTracks.size <= 2 ? 'grid-cols-2' : 'grid-cols-4'
  }`}>
    {Array.from(remoteTracks.entries())
      .filter(([uid]) => {
        const uidStr = String(uid);
        const profile = userProfiles.get(uidStr);
        return !(uidStr === teacherUid || profile?.is_teacher);
      })
      .map(([uid, tracks]) => {
        const uidStr = String(uid);
        return (
          <div key={uidStr} className="aspect-video rounded-xl overflow-hidden bg-gray-800 relative">
            {/* The stable container managed by Ref */}
            <div 
              ref={el => {
                if (el) remoteVideoRefs.current.set(uidStr, el);
                else remoteVideoRefs.current.delete(uidStr);
              }}
              className="w-full h-full"
            />
            
            {!tracks.video && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <span className="text-3xl">🎓</span>
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
              <span className="text-white text-xs truncate">
                {userProfiles.get(uidStr)?.name || 'Student'}
              </span>
            </div>
          </div>
        );
      })}
  </div>
</div>
      </div>
      
      {/* Sidebar - Collapsible on Mobile */}
      <div className="lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-800/30 bg-gray-900/80 backdrop-blur-lg">
        {/* Students Section */}
        <div className="p-3 sm:p-4 border-b border-gray-800/30">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} className="text-cyan-400" />
            <h4 className="font-bold text-white text-sm sm:text-base">Classmates</h4>
            <span className="ml-auto text-xs text-gray-400">
              {Array.from(remoteTracks.entries()).filter(([uid]) => {
                const uidString = uid.toString();
                const profile = userProfiles.get(uidString);
                return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
              }).length} online
            </span>
          </div>
          
          {/* Students List - Mobile Friendly */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {Array.from(remoteTracks.entries())
              .filter(([uid]) => {
                const uidString = uid.toString();
                const profile = userProfiles.get(uidString);
                return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
              })
              .map(([uid, tracks]) => {
                const uidString = uid.toString();
                const profile = userProfiles.get(uidString);
                const displayName = profile?.name || profile?.display_name || 'Student';
                
                return (
                  <div key={uid} className="flex items-center gap-2 p-2 rounded-xl bg-gray-800/30 hover:bg-gray-700/30 transition-all duration-200 active:scale-[0.98]">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                        {tracks.video ? (
                          <div 
                            ref={el => {
                              if (el && tracks.video) {
                                requestAnimationFrame(() => {
                                  tracks.video.play(el);
                                });
                              }
                            }}
                            className="w-full h-full"
                          />
                        ) : (
                          <span className="text-lg">🎓</span>
                        )}
                      </div>
                      {tracks.audio && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-gray-900"></div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">{displayName}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-cyan-400">Student</span>
                        {!tracks.video && (
                          <span className="text-xs text-gray-500">• No video</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            
            {/* Empty State */}
            {Array.from(remoteTracks.entries()).filter(([uid]) => {
              const uidString = uid.toString();
              const profile = userProfiles.get(uidString);
              return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
            }).length === 0 && (
              <div className="text-center py-3">
                <p className="text-gray-500 text-sm">No other students yet</p>
              </div>
            )}
          </div>
        </div>
             </div>
    </div>
    
    {/* ============================================
    PART 6: Mobile Controls Bar (Hidden on Desktop)
    ============================================ */}
    <div className="lg:hidden bg-gray-900/95 backdrop-blur-lg border-t border-cyan-500/20 p-3 safe-area-bottom">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAudio}
            disabled={!controls.hasMicrophone}
            className={`p-3 rounded-xl transition-all duration-200 active:scale-95 ${
              controls.audioEnabled 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
                : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          
          <button
            onClick={toggleVideo}
            disabled={!controls.hasCamera}
            className={`p-3 rounded-xl transition-all duration-200 active:scale-95 ${
              controls.videoEnabled 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white' 
                : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {controls.videoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
          </button>
          
          <button 
            onClick={toggleHandRaise}
            className={`p-3 rounded-xl transition-all duration-200 active:scale-95 ${
              controls.handRaised 
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white animate-pulse' 
                : 'bg-gradient-to-r from-gray-700 to-gray-800 text-white'
            }`}
          >
            <Hand size={20} />
          </button>
        </div>
        
        <button className="p-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 text-white transition-all duration-200 active:scale-95">
          <MoreVertical size={20} />
        </button>
      </div>
    </div>
    
    {/* Chat Sidebar */}
    {showChat && (
      <div className="absolute inset-0 lg:inset-y-0 lg:left-auto lg:right-0 lg:w-96 bg-gradient-to-b from-gray-900 to-gray-950 border-l border-cyan-500/20 flex flex-col shadow-2xl">
        {/* Chat Header */}
        <div className="p-4 border-b border-cyan-500/20 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white">Chat</h3>
            <p className="text-cyan-300 text-xs">Live Class</p>
          </div>
          <button 
            onClick={() => setShowChat(false)}
            className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all duration-200 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Messages */}
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
                        {msg.profiles?.name || 'Unknown User'}
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
        
        {/* Message Input */}
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
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl font-semibold text-white transition-all duration-200 active:scale-95 text-sm"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    )}
    
{/* ============================================
  Production-Ready Draggable Local Video PIP
============================================ */}
{(controls.hasCamera || controls.hasMicrophone) && (
  <div 
    ref={pipRef}
    style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: 'clamp(160px, 18vw, 280px)',
      height: 'auto',
      aspectRatio: '16/9',
      zIndex: 99999,
      cursor: isDragging ? 'grabbing' : 'grab',
      transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      touchAction: 'none',
      filter: isDragging ? 'brightness(1.1)' : 'none',
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      boxShadow: isDragging 
        ? '0 25px 50px -12px rgba(0, 255, 255, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.8)' 
        : '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(59, 130, 246, 0.5)',
    }}
    onMouseDown={handleMouseDown}
    onTouchStart={handleTouchStart}
    className={`local-video-pip ${isDragging ? 'local-video-pip-dragging' : ''}`}
    data-testid="local-video-pip"
  >
    {/* ... rest of PIP content remains the same ... */}
  </div>
)}
  </div>
);
};

export default StudentVideoCall;