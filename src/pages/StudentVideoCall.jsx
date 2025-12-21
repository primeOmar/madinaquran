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
// PART 1: Draggable Hook
// ============================================

const useDraggable = (initialPosition = { x: 0, y: 0 }) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.no-drag')) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  }, [position]);

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.no-drag')) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  }, [position]);

  useEffect(() => {
    const handleMove = (clientX, clientY) => {
      if (!isDragging) return;
      
      const newX = clientX - dragStart.current.x;
      const newY = clientY - dragStart.current.y;
      
      const maxX = window.innerWidth - 320;
      const maxY = window.innerHeight - 240;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    
    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging]);

  return {
    position,
    isDragging,
    dragRef,
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
  // PART 2: Add Drag State
  // ============================================
  const { position, isDragging, handleMouseDown, handleTouchStart } = useDraggable({
    x: window.innerWidth - 340,
    y: window.innerHeight - 260
  });

  // ============================================
  // Initialization
  // ============================================

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

  // ============================================
  // PART 4: Updated createAndPublishLocalTracks with Anti-Flicker
  // ============================================
  const createAndPublishLocalTracks = async () => {
    try {
      console.log('🎤 Creating local audio/video tracks...');

      const deviceInfo = await detectAvailableDevices();

      let audioTrack = null;
      let videoTrack = null;

      if (deviceInfo.hasMicrophone) {
        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            encoderConfig: {
              sampleRate: 48000,
              stereo: false,
              bitrate: 48
            }
          });
        } catch (audioError) {
          console.warn('⚠️ Audio track failed:', audioError.message);
        }
      }

      if (deviceInfo.hasCamera) {
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 15,
              bitrateMin: 400,
              bitrateMax: 1000
            },
            optimizationMode: 'detail'
          });
          
          // ============================================
          // ANTI-FLICKER: Wait for DOM and use RAF
          // ============================================
          const playVideo = () => {
            const videoElement = document.getElementById('local-video-player');
            if (videoElement) {
              try {
                if (videoTrack.isPlaying) {
                  videoTrack.stop();
                }
                
                requestAnimationFrame(() => {
                  videoTrack.play(videoElement);
                  
                  videoElement.style.transform = 'scaleX(-1)';
                  videoElement.style.objectFit = 'cover';
                  videoElement.style.backfaceVisibility = 'hidden';
                  videoElement.style.WebkitBackfaceVisibility = 'hidden';
                  videoElement.style.willChange = 'transform';
                });
              } catch (playError) {
                console.error('❌ Video play error:', playError);
              }
            }
          };

          setTimeout(playVideo, 300);
          
        } catch (videoError) {
          console.warn('⚠️ Video track failed:', videoError.message);
        }
      }

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      setControls(prev => ({
        ...prev,
        hasMicrophone: !!audioTrack,
        hasCamera: !!videoTrack,
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack
      }));

      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);

      if (tracksToPublish.length > 0 && clientRef.current) {
        await clientRef.current.publish(tracksToPublish);
      }

      await updateParticipantStatus({
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack,
        devices: {
          hasMicrophone: !!audioTrack,
          hasCamera: !!videoTrack
        }
      });

    } catch (error) {
      console.error('❌ Track creation/publishing error:', error);
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

      {/* Main Content Area - Teacher-Focused Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ========== LEFT: PRIMARY TEACHER AREA ========== */}
        <div className="flex-1 relative bg-gray-950 overflow-hidden">
          {/* Teacher Video/Screen Share - PRIMARY */}
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
                      try {
                        tracks.video.play(el);
                      } catch (error) {
                        console.warn('Teacher video error:', error);
                      }
                    }
                  }}
                  className="w-full h-full bg-black"
                />
                
                {!tracks.video && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
                    <div className="text-center">
                      <div className="relative mb-6">
                        <div className="text-8xl text-yellow-500/30 mb-2">👨‍🏫</div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-ping w-32 h-32 bg-yellow-500/10 rounded-full"></div>
                        </div>
                      </div>
                      <h3 className="text-3xl font-bold text-white mb-2">Teacher's Session</h3>
                      <p className="text-gray-400 text-lg">
                        {tracks.audio ? 'Audio only' : 'Connecting...'}
                      </p>
                      {tracks.audio && (
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <div className="relative">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                          </div>
                          <span className="text-green-400 text-sm">Audio Active</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="absolute top-6 left-6 bg-gradient-to-r from-black/80 to-transparent backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">T</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Teacher</h3>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-400 text-sm">Live • Primary View</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          
          {!teacherUid && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-center max-w-md">
                <div className="relative mb-8">
                  <div className="text-9xl text-gray-700/30 mb-2">👨‍🏫</div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-ping w-48 h-48 bg-yellow-500/10 rounded-full"></div>
                  </div>
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-300 to-gray-500 bg-clip-text text-transparent mb-4">
                  Waiting for Teacher
                </h3>
                <p className="text-gray-500 text-lg mb-6">
                  The teacher will join shortly. Prepare your questions and materials.
                </p>
                <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/30 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-400">You're connected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* ========== RIGHT: STUDENTS & CONTROLS SIDEBAR ========== */}
        <div className="lg:w-96 flex flex-col border-l border-gray-800/50 bg-gradient-to-b from-gray-900/95 to-gray-950">
          
          {/* 👤 Students List Section */}
          <div className="p-4 border-b border-gray-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Users size={20} className="text-cyan-400" />
              </div>
              <div>
                <h4 className="font-bold text-white">Classmates</h4>
                <p className="text-xs text-gray-400">
                  {Array.from(remoteTracks.entries()).filter(([uid]) => {
                    const uidString = uid.toString();
                    const profile = userProfiles.get(uidString);
                    return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
                  }).length} students online
                </p>
              </div>
            </div>
            
            {/* Other Students List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
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
                    <div key={uid} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 hover:bg-gray-700/30 transition-all duration-200">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          {tracks.video ? (
                            <div 
                              ref={el => {
                                if (el && tracks.video) tracks.video.play(el);
                              }}
                              className="w-full h-full"
                            />
                          ) : (
                            <span className="text-xl">🎓</span>
                          )}
                        </div>
                        {tracks.audio && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
                            <Mic size={8} className="text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{displayName}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-cyan-400">Student</span>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-400">Online</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              
              {Array.from(remoteTracks.entries()).filter(([uid]) => {
                const uidString = uid.toString();
                const profile = userProfiles.get(uidString);
                return !(uidString === teacherUid || profile?.is_teacher || profile?.role === 'teacher');
              }).length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">No other students yet</p>
                </div>
              )}
            </div>
          </div>
          
          {/* 🎛️ Quick Actions Bar */}
          <div className="p-4 border-t border-gray-800/50">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={toggleAudio}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                  controls.audioEnabled 
                    ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30' 
                    : 'bg-gradient-to-r from-red-600/20 to-red-700/20 text-red-400 border border-red-500/30'
                }`}
              >
                {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                <span className="text-xs mt-1">{controls.audioEnabled ? 'Mute' : 'Unmute'}</span>
              </button>
              
              <button
                onClick={toggleVideo}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                  controls.videoEnabled 
                    ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30' 
                    : 'bg-gradient-to-r from-red-600/20 to-red-700/20 text-red-400 border border-red-500/30'
                }`}
              >
                {controls.videoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
                <span className="text-xs mt-1">{controls.videoEnabled ? 'Video Off' : 'Video On'}</span>
              </button>
            </div>
            
            <button 
              onClick={toggleHandRaise}
              className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-all duration-200 mb-4 ${
                controls.handRaised 
                  ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 text-yellow-400 border border-yellow-500/30 animate-pulse' 
                  : 'bg-gradient-to-r from-gray-800 to-gray-900 text-gray-300 border border-gray-700/50'
              }`}
            >
              <Hand size={18} />
              <span className="font-medium">{controls.handRaised ? 'Hand Raised' : 'Raise Hand'}</span>
            </button>
            
            {/* Session Info */}
            <div className="bg-gradient-to-r from-gray-800/30 to-gray-900/30 p-3 rounded-xl border border-gray-700/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Duration</span>
                <span className="text-white font-medium">{formatDuration(stats.duration)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Participants</span>
                <span className="text-white font-medium">{stats.participantCount}</span>
              </div>
            </div>
          </div>
          
          {/* 📱 Bottom Controls */}
          <div className="mt-auto p-4 border-t border-gray-800/50">
            <div className="flex justify-between items-center">
              <button 
                onClick={() => setShowChat(!showChat)}
                className={`p-3 rounded-xl ${showChat ? 'bg-cyan-600' : 'bg-gray-800'}`}
              >
                <MessageSquare size={20} className="text-white" />
              </button>
              
              <button 
                onClick={leaveSession}
                className="flex-1 ml-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200"
              >
                <PhoneOff size={18} />
                <span>Leave Session</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
      PART 3: Draggable Local Video PIP
      ============================================ */}
      {controls.hasCamera && (
        <div 
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '280px',
            height: '210px',
            zIndex: 1000,
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
            touchAction: 'none'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="local-video-pip"
        >
          <div className="relative w-full h-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-cyan-500/50 hover:border-cyan-500 transition-all duration-200 hover:shadow-cyan-500/20 hover:shadow-xl">
            {/* Drag Handle Indicator */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
              <div className="w-12 h-1 bg-white/30 rounded-full"></div>
            </div>

            {/* Video Element with Anti-Flicker */}
            <video
              id="local-video-player"
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
              style={{
                display: controls.videoEnabled ? 'block' : 'none',
                transform: 'scaleX(-1)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform'
              }}
            />
            
            {/* Camera Off State */}
            {!controls.videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="text-center">
                  <CameraOff className="text-gray-400 w-10 h-10 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm font-medium">Camera Off</p>
                </div>
              </div>
            )}
            
            {/* Compact Overlay Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      controls.audioEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}></div>
                    <span className="text-white text-xs font-semibold">You</span>
                  </div>
                </div>
                
                {/* Mini Status Icons */}
                <div className="flex gap-1 no-drag">
                  {!controls.audioEnabled && (
                    <div className="bg-red-500/80 p-1 rounded">
                      <MicOff size={10} className="text-white" />
                    </div>
                  )}
                  {!controls.videoEnabled && (
                    <div className="bg-red-500/80 p-1 rounded">
                      <CameraOff size={10} className="text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dragging Indicator */}
            {isDragging && (
              <div className="absolute inset-0 bg-cyan-500/10 border-2 border-cyan-500 rounded-2xl pointer-events-none"></div>
            )}
          </div>
        </div>
      )}

      {/* ============================================
      PART 5: Responsive Main Video Grid
      ============================================ */}
      <div className="flex-1 relative p-2 sm:p-4 md:p-6 overflow-hidden">
        {/* Responsive Remote Videos Grid */}
        <div className="w-full h-full">
          <div className={`grid gap-2 sm:gap-3 md:gap-4 lg:gap-6 h-full ${
            remoteTracks.size === 0 ? 'grid-cols-1' :
            remoteTracks.size === 1 ? 'grid-cols-1' :
            remoteTracks.size === 2 ? 'grid-cols-1 sm:grid-cols-2' :
            remoteTracks.size <= 4 ? 'grid-cols-1 sm:grid-cols-2' :
            remoteTracks.size <= 6 ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3' :
            'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          }`}>
            {Array.from(remoteTracks.entries()).map(([uid, tracks]) => {
              const profile = userProfiles.get(uid.toString());
              const isTeacher = profile?.is_teacher || uid === teacherUid;
              const displayName = profile?.name || profile?.display_name || 
                               (isTeacher ? 'Teacher' : `Student ${uid}`);
              
              const userIcon = isTeacher ? '👨‍🏫' : '🎓';
              const userRole = isTeacher ? 'Teacher' : 'Student';
              const borderColor = isTeacher ? 'border-yellow-500/50' : 'border-blue-500/30';
              const bgGradient = isTeacher ? 'from-gray-900 to-gray-800' : 'from-blue-900/20 to-gray-800';
              
              return (
                <div 
                  key={uid} 
                  className={`relative rounded-xl sm:rounded-2xl overflow-hidden border-2 ${borderColor} 
                             group hover:border-cyan-500/60 transition-all duration-200
                             min-h-[180px] sm:min-h-[200px] md:min-h-[240px] lg:min-h-[280px]
                             hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/10`}
                >
                  {/* Video Container with Anti-Flicker */}
                  <div 
                    ref={el => {
                      if (el && tracks.video) {
                        requestAnimationFrame(() => {
                          try {
                            tracks.video.play(el);
                            el.style.backfaceVisibility = 'hidden';
                            el.style.WebkitBackfaceVisibility = 'hidden';
                          } catch (error) {
                            console.warn('Remote video play error:', error);
                          }
                        });
                      }
                    }}
                    className="w-full h-full bg-gray-800"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden'
                    }}
                  />
                  
                  {/* No Video Placeholder */}
                  {!tracks.video && (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${bgGradient}`}>
                      <div className="text-center px-4">
                        <div className="text-3xl sm:text-4xl md:text-5xl mb-2 sm:mb-3 opacity-70">
                          {userIcon}
                        </div>
                        <p className="text-cyan-300 font-medium text-sm sm:text-base truncate max-w-full">
                          {displayName}
                        </p>
                        <div className={`px-2 py-1 rounded-full text-xs mt-2 inline-block ${
                          isTeacher ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {userRole}
                        </div>
                        <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                          {tracks.audio ? 'Audio only' : 'Connecting...'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Compact Overlay - Responsive */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-xs sm:text-sm truncate flex items-center gap-1.5">
                          <span className="truncate">{displayName}</span>
                          {isTeacher && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full text-[10px] sm:text-xs flex-shrink-0">
                              Teacher
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-xs text-cyan-300 flex items-center gap-1.5 mt-0.5">
                          <span>{userRole}</span>
                          {!tracks.video && (
                            <span className="bg-gray-700/50 px-1.5 py-0.5 rounded">No Video</span>
                          )}
                        </div>
                      </div>
                      
                      {tracks.audio && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-[10px] text-green-300 hidden sm:inline">Audio</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Empty State - Responsive */}
            {remoteTracks.size === 0 && (
              <div className="col-span-full flex items-center justify-center min-h-[300px] sm:min-h-[400px] px-4">
                <div className="text-center text-gray-400 max-w-md">
                  <div className="relative mb-4 sm:mb-6">
                    <Users className="text-cyan-400 opacity-50 mx-auto w-16 h-16 sm:w-20 sm:h-20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-ping w-12 h-12 sm:w-16 sm:h-16 bg-cyan-500/30 rounded-full"></div>
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                    Waiting for others...
                  </h3>
                  <p className="text-base sm:text-lg mb-4 sm:mb-6">
                    {teacherUid ? 'Teacher is in the session' : 'Connecting to session...'}
                  </p>
                  <div className="bg-gray-800/50 p-3 sm:p-4 rounded-xl border border-cyan-500/20">
                    <p className="text-cyan-300 text-xs sm:text-sm">
                      {teacherUid 
                        ? 'Other participants will appear when they join' 
                        : 'Your session is ready'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================
      PART 6: Responsive Controls Bar
      ============================================ */}
      <div className="bg-gray-900/90 backdrop-blur-xl border-t border-cyan-500/30 p-3 sm:p-4 md:p-6 safe-area-bottom">
        <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-6 max-w-screen-xl mx-auto">
          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            disabled={!controls.hasMicrophone}
            className={`p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl transition-all duration-200 shadow-lg ${
              controls.audioEnabled 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
                : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
            title={controls.hasMicrophone ? (controls.audioEnabled ? 'Mute' : 'Unmute') : 'No mic'}
          >
            {controls.audioEnabled ? <Mic size={20} className="sm:w-6 sm:h-6" /> : <MicOff size={20} className="sm:w-6 sm:h-6" />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            disabled={!controls.hasCamera}
            className={`p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl transition-all duration-200 shadow-lg ${
              controls.videoEnabled 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
                : 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
            title={controls.hasCamera ? (controls.videoEnabled ? 'Stop video' : 'Start video') : 'No camera'}
          >
            {controls.videoEnabled ? <Camera size={20} className="sm:w-6 sm:h-6" /> : <CameraOff size={20} className="sm:w-6 sm:h-6" />}
          </button>

          {/* Hand Raise */}
          <button
            onClick={toggleHandRaise}
            className={`p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl transition-all duration-200 shadow-lg ${
              controls.handRaised 
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white animate-pulse' 
                : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
            } active:scale-95`}
            title={controls.handRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand size={20} className="sm:w-6 sm:h-6" />
          </button>

          {/* More Options - Hidden on small screens */}
          <button className="hidden sm:flex p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200 shadow-lg active:scale-95">
            <MoreVertical size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="absolute inset-y-0 right-0 w-full md:w-96 bg-gradient-to-b from-gray-900 to-gray-950 border-l border-cyan-500/30 flex flex-col shadow-2xl">
          <div className="p-6 border-b border-cyan-500/30 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-xl text-white">Madina Chat</h3>
              <p className="text-cyan-300 text-sm">Live Class with teacher</p>
            </div>
            <button 
              onClick={() => setShowChat(false)}
              className="p-3 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all duration-200"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <MessageCircle className="mx-auto mb-4 opacity-50" size={48} />
                <p className="text-lg font-semibold">No messages yet</p>
                <p className="text-sm mt-2">Be the first to say hello!</p>
              </div>
            ) : (messages.map(msg => (
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
                        {msg.profiles?.name || 'Unknown User'}
                      </div>
                      {msg.message_type === 'system' && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                          System
                        </span>
                      )}
                      {msg.profiles?.role === 'teacher' && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs">
                          Teacher
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
            )))}
          </div>
          
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
};

export default StudentVideoCall;