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
  // State and Refs
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
  
  // ⚠️ CRITICAL FIX #1: Separate ref for local video container
  const localVideoRef = useRef(null);
  const localVideoTrackRef = useRef(null); // Store track reference separately
  
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

// At the top of your component, adjust the useDraggable initial position:
const { position, isDragging, setPosition, handleMouseDown, handleTouchStart } = useDraggable({
  x: window.innerWidth - 300, 
  y: window.innerHeight - 200
});
  // ============================================
  // Window Resize Handler
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
  // ⚠️ CRITICAL FIX #2: Dedicated Local Video Playback Effect
  // ============================================
  useEffect(() => {
    const playLocalVideo = async () => {
      // Only proceed if we have the video track and container
      if (!localTracks.video || !localVideoRef.current) {
        console.log('⏸️ Local video not ready:', { 
          hasTrack: !!localTracks.video, 
          hasRef: !!localVideoRef.current 
        });
        return;
      }

      // Skip if video is disabled
      if (!controls.videoEnabled) {
        console.log('⏸️ Video is disabled');
        return;
      }

      try {
        console.log('▶️ Playing local video track...');
        
        // Stop any existing playback first
        if (localVideoTrackRef.current && localVideoTrackRef.current !== localTracks.video) {
          try {
            localVideoTrackRef.current.stop();
          } catch (e) {
            console.warn('Failed to stop old track:', e);
          }
        }

        // Play the video track in the container
        await localTracks.video.play(localVideoRef.current);
        localVideoTrackRef.current = localTracks.video;
        
        console.log('✅ Local video playing successfully');
      } catch (error) {
        console.error('❌ Failed to play local video:', error);
        
        // Retry once after a short delay
        setTimeout(async () => {
          try {
            console.log('🔄 Retrying local video playback...');
            await localTracks.video.play(localVideoRef.current);
            localVideoTrackRef.current = localTracks.video;
            console.log('✅ Local video playing after retry');
          } catch (retryError) {
            console.error('❌ Retry failed:', retryError);
          }
        }, 500);
      }
    };

    playLocalVideo();

    // Cleanup function
    return () => {
      if (localVideoTrackRef.current && localVideoRef.current) {
        try {
          // Don't stop the track, just stop playing in this container
          localVideoTrackRef.current.stop();
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };
  }, [localTracks.video, controls.videoEnabled]);

  // ============================================
  // ⚠️ CRITICAL FIX #3: Separate Remote Video Playback Effect
  // ============================================
  useEffect(() => {
    const playRemoteVideos = async () => {
      for (const [uid, tracks] of remoteTracks.entries()) {
        const container = remoteVideoRefs.current.get(String(uid));
        
        if (container && tracks.video) {
          try {
            // Check if already playing
            if (tracks.video.isPlaying) {
              console.log(`✅ Remote video ${uid} already playing`);
              continue;
            }
            
            console.log(`▶️ Playing remote video for user ${uid}...`);
            await tracks.video.play(container);
            console.log(`✅ Remote video ${uid} playing successfully`);
          } catch (error) {
            console.error(`❌ Failed to play remote video ${uid}:`, error);
            
            // Retry once
            setTimeout(async () => {
              try {
                if (container && tracks.video) {
                  await tracks.video.play(container);
                  console.log(`✅ Remote video ${uid} playing after retry`);
                }
              } catch (retryError) {
                console.error(`❌ Retry failed for ${uid}:`, retryError);
              }
            }, 300);
          }
        }
      }
    };

    playRemoteVideos();
  }, [remoteTracks]);

  // ============================================
  // FIXED: Initialization - Run Once (From Second File)
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
  }, [meetingId, studentId]);

  // ============================================
  // FIXED: Sync Profiles with Tracks (From Second File)
  // ============================================
  useEffect(() => {
    if (remoteTracks.size > 0 && sessionState.isJoined) {
      syncProfilesWithTracks();
    }
  }, [remoteTracks, sessionState.isJoined]);

  // ============================================
  // FIXED: Participant Sync Interval (From Second File)
  // ============================================
  useEffect(() => {
    if (!sessionState.isJoined || !sessionState.sessionInfo?.meetingId) return;
    
    const syncInterval = setInterval(() => {
      fetchParticipants(sessionState.sessionInfo.meetingId);
    }, 15000);
    
    return () => clearInterval(syncInterval);
  }, [sessionState.isJoined, sessionState.sessionInfo?.meetingId]);

  // ============================================
  // FIXED: Helper Functions (From Second File)
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
  // FIXED: Initialize Session with Proper Guards (From Second File)
  // ============================================
  const initializeSession = async () => {
    try {
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
      
      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        initializationRef.current.clientCreated = true;
      }

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
  // FIXED: Setup Agora Event Listeners (From Second File)
  // ============================================
  const setupAgoraEventListeners = () => {
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
  // FIXED: Join Channel (From Second File)
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
      
      profilePollingRef.current = setInterval(() => {
        if (sessionState.sessionInfo?.meetingId) {
          fetchParticipants(sessionState.sessionInfo.meetingId);
        }
      }, 10000);

      // Use the improved createAndPublishTracks from first file
      await createAndPublishTracks();

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();
      
      await updateParticipantStatus({ status: 'joined' });

      // ============================================
      // CRITICAL FIX: Added back startMessagePolling call
      // ============================================
      if (sessionData.session?.id) {
        startMessagePolling(sessionData.session.id);
      }

    } catch (error) {
      console.error('Join channel error:', error);
      throw error;
    }
  };

  // ============================================
  // ⚠️ CRITICAL FIX #4: Improved Track Creation (From First File)
  // ============================================
  const createAndPublishTracks = async () => {
    try {
      console.log('🔵 Creating local tracks...');
      
      // Check device availability first
      const devices = await AgoraRTC.getDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      const hasMicrophone = devices.some(d => d.kind === 'audioinput');
      
      console.log('📱 Devices available:', { hasCamera, hasMicrophone });

      let audioTrack = null;
      let videoTrack = null;

      // Create audio track if microphone available
      if (hasMicrophone) {
        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'music_standard',
          });
          console.log('✅ Audio track created');
        } catch (error) {
          console.error('❌ Failed to create audio track:', error);
        }
      }

      // Create video track if camera available
      if (hasCamera) {
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: '720p_3',
            optimizationMode: 'detail'
          });
          console.log('✅ Video track created');
          
          // ⚠️ IMPORTANT: Don't play the track here immediately
          // Let the useEffect handle playback after state updates
          
        } catch (error) {
          console.error('❌ Failed to create video track:', error);
        }
      }

      // Update state with new tracks
      setLocalTracks({ audio: audioTrack, video: videoTrack });
      setControls(prev => ({
        ...prev,
        hasCamera,
        hasMicrophone,
        audioEnabled: !!audioTrack,
        videoEnabled: !!videoTrack
      }));

      // Publish tracks
      const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
      if (tracksToPublish.length > 0 && clientRef.current) {
        await clientRef.current.publish(tracksToPublish);
        console.log('✅ Published tracks:', tracksToPublish.map(t => t.trackMediaType));
      }

    } catch (error) {
      console.error('❌ Failed to create/publish tracks:', error);
      throw error;
    }
  };

  // ============================================
  // Toggle Functions with Better Track Management (From First File)
  // ============================================
  const toggleAudio = async () => {
    if (!localTracks.audio || !controls.hasMicrophone) return;
    
    try {
      const newState = !controls.audioEnabled;
      await localTracks.audio.setEnabled(newState);
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      console.log(`🎤 Audio ${newState ? 'enabled' : 'disabled'}`);
      
      await updateParticipantStatus({ audioEnabled: newState });
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  const toggleVideo = async () => {
    if (!localTracks.video || !controls.hasCamera) return;
    
    try {
      const newState = !controls.videoEnabled;
      await localTracks.video.setEnabled(newState);
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
      
      await updateParticipantStatus({ videoEnabled: newState });
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const toggleHandRaise = async () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    try {
      await updateParticipantStatus({ handRaised: newState });
      console.log(`✋ Hand ${newState ? 'raised' : 'lowered'}`);
      
      // Send message if session exists
      if (sessionState.sessionInfo?.session?.id) {
        sendMessage(
          newState ? '✋ Raised hand' : 'Lowered hand',
          'system'
        );
      }
    } catch (error) {
      console.error('Failed to toggle hand raise:', error);
    }
  };

  // ============================================
  // Duration Timer (From First File)
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
  // CRITICAL: Message Functions (From Second File)
  // ============================================
  const startMessagePolling = (sessionId) => {
    if (!sessionId) {
      console.warn('No session ID provided for message polling');
      return;
    }

    // Initial load
    loadMessages(sessionId);

    // Clear any existing interval
    if (messagesPollIntervalRef.current) {
      clearInterval(messagesPollIntervalRef.current);
    }

    // Set up polling
    messagesPollIntervalRef.current = setInterval(() => {
      loadMessages(sessionId);
    }, 3000);
  };

  const loadMessages = async (sessionId) => {
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

  // ============================================
  // Other Helper Functions (From Second File)
  // ============================================
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

  // ============================================
  // FIXED: Cleanup Function with message polling cleanup (From Second File)
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
  // FIXED: Leave Session (From Second File)
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
  // Update Stats (From First File)
  // ============================================
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      participantCount: remoteTracks.size + 1
    }));
  }, [remoteTracks]);

  // ============================================
  // Render - Error States (From Second File)
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

  // Get teacher's remote tracks
  const teacherTracks = teacherUid ? remoteTracks.get(Number(teacherUid)) : null;
  const teacherProfile = teacherUid ? userProfiles.get(teacherUid) : null;

  // ============================================
  // Main Render - Only show when joined
  // ============================================
  return (
    <div className="fixed inset-0 z-50 bg-black">
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
      {/* Main Video Area - Teacher's Video */}
      <div className="absolute inset-0">
        <div className="relative w-full h-full bg-black">
          {teacherTracks?.video ? (
            <div 
              ref={el => {
                if (el && teacherTracks.video) {
                  remoteVideoRefs.current.set(teacherUid, el);
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4 mx-auto">
                  <span className="text-6xl">👨‍🏫</span>
                </div>
                <p className="text-cyan-300 text-xl font-semibold">
                  {teacherProfile?.name || 'Teacher'}
                </p>
                <p className="text-cyan-400/60 text-sm mt-2">Camera is off</p>
              </div>
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent pointer-events-none" />
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

      {/* Bottom Control Bar - Desktop */}
      <div className="hidden lg:flex absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 border border-cyan-500/30 shadow-2xl z-30">
        <div className="flex items-center justify-center gap-4 w-full">
          <button
            onClick={toggleAudio}
            disabled={!controls.hasMicrophone}
            className={`p-4 rounded-xl transition-all duration-200 ${
              controls.audioEnabled 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/50' 
                : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg shadow-red-500/50'
            } ${!controls.hasMicrophone ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {controls.audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          
          <button
            onClick={toggleVideo}
            disabled={!controls.hasCamera}
            className={`p-4 rounded-xl transition-all duration-200 ${
              controls.videoEnabled 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/50' 
                : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg shadow-red-500/50'
            } ${!controls.hasCamera ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {controls.videoEnabled ? <Camera size={24} /> : <CameraOff size={24} />}
          </button>
          
          <button 
            onClick={toggleHandRaise}
            className={`p-4 rounded-xl transition-all duration-200 ${
              controls.handRaised 
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white animate-pulse shadow-lg shadow-yellow-500/50' 
                : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
            }`}
          >
            <Hand size={24} />
          </button>
          
          <button 
            onClick={leaveSession}
            className="p-4 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg shadow-red-500/50 transition-all duration-200"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Participants Panel - Desktop */}
      <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-xl border-l border-cyan-500/30 shadow-2xl overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white text-lg">Class Members</h3>
              <span className="text-cyan-300 text-sm font-semibold">
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

      {/* Mobile Controls with Hand Raise Button */}
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
          </div>
          
          <button 
            onClick={leaveSession}
            className="p-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
           {showChat && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50">
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
      )}

      {/* ⚠️ CRITICAL FIX #5: Improved PIP with Better Rendering (From First File) */}
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
          <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden border-2 border-cyan-500/70 shadow-2xl">
            {/* Video Container */}
            <div className="w-full h-full bg-black relative">
              {/* ⚠️ CRITICAL: This is where the local video plays */}
              <div 
                ref={localVideoRef}
                className="w-full h-full"
                style={{ 
                  transform: 'scaleX(-1)', // Mirror effect
                  opacity: (controls.videoEnabled && localTracks.video) ? 1 : 0,
                  backgroundColor: '#000'
                }}
              />
              
              {/* Placeholder when video is off */}
              {(!controls.videoEnabled || !localTracks.video) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
                  <div className="text-center">
                    <CameraOff className="text-gray-400 w-12 h-12 mx-auto mb-2" />
                    <p className="text-gray-400 text-xs">Camera Off</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Status Indicator */}
            <div className="absolute bottom-2 left-2 z-10">
              <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  controls.audioEnabled ? 'bg-green-500' : 'bg-red-500'
                } ${controls.audioEnabled ? 'animate-pulse' : ''}`} />
                <span className="text-white text-[10px] font-bold tracking-wider">YOU</span>
              </div>
            </div>
            
            {/* Video Quality Indicator */}
            {controls.videoEnabled && localTracks.video && (
              <div className="absolute top-2 right-2 z-10">
                <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10">
                  <span className="text-green-400 text-[9px] font-semibold">HD</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default StudentVideoCall;