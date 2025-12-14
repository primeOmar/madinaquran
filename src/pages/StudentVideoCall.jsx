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
  const profilePollingRef = useRef();
  const [controls, setControls] = useState({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
    hasCamera: false, // Track if camera exists
    hasMicrophone: false // Track if mic exists
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
  // Initialization - 
  // ============================================

  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [meetingId, studentId]);

useEffect(() => {
  // Sync profiles whenever remoteTracks change
  if (remoteTracks.size > 0 && sessionState.isJoined) {
    console.log('🔄 Triggering profile sync due to remoteTracks change');
    syncProfilesWithTracks();
  }
}, [remoteTracks, sessionState.isJoined]);

// Also sync periodically
useEffect(() => {
  if (!sessionState.isJoined) return;
  
  const syncInterval = setInterval(() => {
    if (sessionState.sessionInfo?.meetingId) {
      fetchParticipants(sessionState.sessionInfo.meetingId);
    }
  }, 15000); // Sync every 15 seconds
  
  return () => clearInterval(syncInterval);
}, [sessionState.isJoined, sessionState.sessionInfo?.meetingId]);
// Enhanced fetchParticipants function
const fetchParticipants = async (meetingId) => {
  try {
    console.log('🔄 Fetching participants for meeting:', meetingId);
    
    const response = await studentvideoApi.getSessionParticipants(meetingId);
    
    if (response.success && response.participants) {
      console.log('📊 Participants data received:', response.participants);
      
      // Create a properly formatted profile map
      const newProfiles = new Map();
      let teacherUidFound = null;
      
      response.participants.forEach(participant => {
        if (participant.agora_uid) {
          const uidString = String(participant.agora_uid);
          const isTeacher = participant.role === 'teacher' || participant.is_teacher;
          
          // Store profile with all necessary data
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
            console.log('👨‍🏫 Teacher identified:', { 
              uid: teacherUidFound, 
              name: participant.name 
            });
          }
        }
      });
      
      // Update state with new profiles
      setUserProfiles(newProfiles);
      if (teacherUidFound) {
        setTeacherUid(teacherUidFound);
      }
      
      console.log('✅ Updated user profiles:', {
        count: newProfiles.size,
        teacherUid: teacherUidFound,
        allUids: Array.from(newProfiles.keys()),
        profiles: Array.from(newProfiles.entries()).map(([uid, profile]) => ({
          uid,
          name: profile.name,
          role: profile.role
        }))
      });
      
      // Also update participants list for UI
      setParticipants(response.participants);
      
      return newProfiles;
    } else {
      console.warn('⚠️ No participants data in response');
      return new Map();
    }
  } catch (error) {
    console.error('❌ Failed to fetch participants:', error);
    return new Map();
  }
};

// Add this function to sync profiles with remote tracks
const syncProfilesWithTracks = () => {
  // Get all Agora UIDs from remote tracks
  const remoteUids = Array.from(remoteTracks.keys()).map(uid => String(uid));
  
  // Get all UIDs from userProfiles
  const profileUids = Array.from(userProfiles.keys());
  
  console.log('🔄 Syncing profiles with tracks:', {
    remoteUids,
    profileUids,
    matches: remoteUids.filter(uid => profileUids.includes(uid)).length
  });
  
  // If we have remote users without profiles, fetch their profiles
  const missingUids = remoteUids.filter(uid => !profileUids.includes(uid));
  
  if (missingUids.length > 0 && sessionState.sessionInfo?.meetingId) {
    console.log('📥 Missing profiles for UIDs:', missingUids);
    fetchProfilesByUids(missingUids);
  }
};

// Update fetchProfilesByUids to handle the new data structure
const fetchProfilesByUids = async (uids) => {
  try {
    if (!sessionState.sessionInfo?.meetingId || !uids.length) return;
    
    console.log('📥 Fetching profiles for UIDs:', uids);
    
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
      
      console.log('✅ Updated profiles from UIDs fetch');
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch profiles by UIDs:', error);
  }
};


// ==================== initializeSession ====================


const initializeSession = async () => {
  try {
    console.log('🎓 STUDENT: Starting initialization', { classId, meetingId });

    // 1. Get Session Info
    const sessionLookup = await studentvideoApi.getSessionByClassId(classId);
    
    if (!sessionLookup.success || !sessionLookup.exists || !sessionLookup.isActive) {
      throw new Error(sessionLookup.error || 'No active session found. Waiting for teacher...');
    }

    const effectiveMeetingId = sessionLookup.meetingId;
    
    console.log('📥 Loading initial profiles for meeting:', effectiveMeetingId);
    
    // 2. Load initial profiles BEFORE joining channel
    await fetchParticipants(effectiveMeetingId);
    
    // 3. Create Client
    clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    // ========== SETUP EVENT HANDLERS BEFORE JOINING ==========
    
    // User Joined - Fetch profile immediately
    clientRef.current.on('user-joined', async (remoteUser) => {
      const remoteUid = String(remoteUser.uid);
      console.log('👤 REMOTE USER JOINED:', {
        uid: remoteUid,
        hasAudio: remoteUser.hasAudio,
        hasVideo: remoteUser.hasVideo
      });

      // Immediately fetch this user's profile
      try {
        const response = await studentvideoApi.getSessionParticipants(effectiveMeetingId);
        
        if (response.success && response.participants) {
          const newUser = response.participants.find(p => String(p.agora_uid) === remoteUid);
          
          if (newUser) {
            const isTeacher = newUser.role === 'teacher' || newUser.is_teacher;
            
            // Update profiles map
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
              
              console.log('✅ Added profile for user:', {
                uid: remoteUid,
                name: newUser.name,
                role: isTeacher ? 'teacher' : 'student'
              });
              
              return updated;
            });
            
            // Update teacher UID if this is the teacher
            if (isTeacher) {
              setTeacherUid(remoteUid);
              console.log('👨‍🏫 Teacher joined with UID:', remoteUid);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch profile for joined user:', error);
      }

      // Initialize tracks map for this user
      setRemoteTracks(prev => {
        const updated = new Map(prev);
        updated.set(remoteUid, { audio: null, video: null });
        return updated;
      });

      // Update participant count
      setStats(prev => ({
        ...prev,
        participantCount: clientRef.current.remoteUsers.length + 1
      }));
    });

    // User Published - Subscribe to tracks
    clientRef.current.on('user-published', async (remoteUser, mediaType) => {
      const remoteUid = String(remoteUser.uid);
      console.log('📡 USER PUBLISHED:', { uid: remoteUid, mediaType });

      try {
        await clientRef.current.subscribe(remoteUser, mediaType);
        console.log('✅ Subscribed to:', { uid: remoteUid, mediaType });

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

    // User Unpublished - Remove tracks
    clientRef.current.on('user-unpublished', (remoteUser, mediaType) => {
      const remoteUid = String(remoteUser.uid);
      console.log('📴 USER UNPUBLISHED:', { uid: remoteUid, mediaType });

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

    // User Left - Clean up
    clientRef.current.on('user-left', (remoteUser) => {
      const remoteUid = String(remoteUser.uid);
      console.log('👋 USER LEFT:', remoteUid);

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

      // Remove from profiles
      setUserProfiles(prev => {
        const updated = new Map(prev);
        updated.delete(remoteUid);
        return updated;
      });

      // Update participant count
      setStats(prev => ({
        ...prev,
        participantCount: clientRef.current.remoteUsers.length + 1
      }));
    });

    // Connection State Changed
    clientRef.current.on('connection-state-change', (curState, prevState) => {
      console.log('🔌 Connection state:', { from: prevState, to: curState });
      
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

    // 4. Join via API
    const sessionData = await studentvideoApi.joinVideoSession(
      effectiveMeetingId,
      studentId,
      'student'
    );

    if (!sessionData.success || !sessionData.token) {
      throw new Error(sessionData.error || 'Failed to join session');
    }

    // Store the Agora UID from join response
    const studentAgoraUid = sessionData.uid;
    console.log('🎓 Student assigned Agora UID:', studentAgoraUid);

    setSessionState({
      isInitialized: true,
      isJoined: false,
      sessionInfo: {
        ...sessionData,
        uid: studentAgoraUid,
        meetingId: effectiveMeetingId // Store for later use
      },
      error: null
    });

    // 5. Join Channel
    await joinChannel({
      ...sessionData,
      uid: studentAgoraUid
    });

    // 6. Fetch participants again after joining (to get any users who joined while we were connecting)
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

  // ============================================
  // Join Channel -
  // ============================================
const joinChannel = async (sessionData) => {
  try {
    const { channel, token, uid, appId } = sessionData;

    console.log('🔗 STUDENT: Joining channel with exact params:', {
      appId: appId?.substring(0, 8) + '...',
      appIdLength: appId?.length,
      channel,
      channelLength: channel?.length,
      uid,
      uidType: typeof uid,
      token: token?.substring(0, 30) + '...',
      tokenLength: token?.length
    });

    // Validate all params
    if (!appId || appId.length !== 32) {
      throw new Error(`Invalid App ID: ${appId?.length || 0} chars, expected 32`);
    }

    if (!channel) {
      throw new Error('Channel name is missing');
    }

    if (!token || token.length < 100) {
      throw new Error(`Invalid token: ${token?.length || 0} chars, expected 100+`);
    }

    // Setup event listeners FIRST
    setupAgoraEventListeners();

    console.log('📞 Calling client.join()...');

    // Join with exact parameters (don't modify uid!)
    const joinedUid = await clientRef.current.join(
      appId,
      channel,
      token,
      uid || null
    );

    console.log('✅ STUDENT: Successfully joined channel:', {
      channel,
      requestedUid: uid,
      assignedUid: joinedUid,
      match: uid === joinedUid || uid === null
    });
    
    // Start profile polling (using the ref from top level)
    if (sessionState.sessionInfo?.meetingId) {
      fetchParticipants(); // Initial fetch
      
      // Clear any existing interval first
      if (profilePollingRef.current) {
        clearInterval(profilePollingRef.current);
      }
      
      profilePollingRef.current = setInterval(() => {
        if (sessionState.sessionInfo?.meetingId) {
          fetchParticipants();
        }
      }, 10000); // Poll every 10 seconds
    }

    // Create and publish local tracks
    await createAndPublishLocalTracks();

    // Mark as joined
    setSessionState(prev => ({
      ...prev,
      isJoined: true
    }));

    // Start duration tracking
    startDurationTracking();
    
    // Update participant status
    await updateParticipantStatus({ status: 'joined' });

    // Start message polling
    if (sessionData.session?.id) {
      startMessagePolling(sessionData.session.id);
    }

    console.log('🎉 STUDENT: Fully joined and ready');

  } catch (error) {
    console.error('❌ STUDENT Join channel error:', {
      message: error.message,
      code: error.code,
      channel: sessionData.channel,
      uid: sessionData.uid
    });
    
    // Enhanced error handling
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

const fetchProfiles = async (meetingId) => {
  const result = await studentvideoApi.getParticipantProfiles(meetingId);
  
  if (result.success) {
    const profileMap = new Map();
    let teacherUidFound = null;
    
    result.participants.forEach(p => {
      // Ensure the key is a string to match Agora's user.uid type
      const uidString = String(p.agoraUid); 
      profileMap.set(uidString, p);
      if (p.role === 'teacher') {
        teacherUidFound = uidString;
      }
    });
    
    setUserProfiles(profileMap);
    setTeacherUid(teacherUidFound);
    // Update participant count based on the actual profile list
    setStats(prev => ({ ...prev, participantCount: profileMap.size }));
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

  console.log('🎧 Setting up Agora event listeners');

  // ============================================
  // USER JOINED - Initialize track entry
  // ============================================
  client.on('user-joined', async (user) => {
    const uid = String(user.uid); // Convert to string for consistency
    console.log('👤 USER JOINED:', { uid, hasAudio: user.hasAudio, hasVideo: user.hasVideo });
    
    // Initialize tracks map entry for this user (prevents duplicates)
    setRemoteTracks(prev => {
      const newMap = new Map(prev);
      // Only initialize if not already present
      if (!newMap.has(uid)) {
        newMap.set(uid, { audio: null, video: null });
        console.log('✅ Initialized track entry for:', uid);
      }
      return newMap;
    });
    
    // Fetch profile for this user immediately
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
              
              console.log('✅ Profile loaded for:', { uid, name: newUser.name, role: isTeacher ? 'teacher' : 'student' });
              return updated;
            });
            
            if (isTeacher) {
              setTeacherUid(uid);
              console.log('👨‍🏫 Teacher joined with UID:', uid);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch profile for joined user:', error);
      }
    }
    
    updateParticipantCount();
  });

  // ============================================
  // USER PUBLISHED - Update existing track entry
  // ============================================
  client.on('user-published', async (user, mediaType) => {
    const uid = String(user.uid); // Convert to string for consistency
    console.log('📡 USER PUBLISHED:', { uid, mediaType });
    
    try {
      // Subscribe to the media
      await client.subscribe(user, mediaType);
      console.log('✅ Subscribed to:', { uid, mediaType });
      
      // Update the EXISTING track entry (don't create new one)
      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(uid) || { audio: null, video: null };
        
        if (mediaType === 'video') {
          existing.video = user.videoTrack;
          console.log('🎥 Video track added for:', uid);
        } else if (mediaType === 'audio') {
          existing.audio = user.audioTrack;
          user.audioTrack?.play();
          console.log('🔊 Audio track added for:', uid);
        }
        
        // Set the updated tracks for this user
        newMap.set(uid, existing);
        return newMap;
      });
      
    } catch (error) {
      console.error('❌ Subscribe error:', { uid, mediaType, error });
    }
    
    updateParticipantCount();
  });

  // ============================================
  // USER UNPUBLISHED - Clear track but keep entry
  // ============================================
  client.on('user-unpublished', (user, mediaType) => {
    const uid = String(user.uid);
    console.log('📴 USER UNPUBLISHED:', { uid, mediaType });
    
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
        
        // Keep the entry but with null track
        newMap.set(uid, existing);
      }
      
      return newMap;
    });
    
    updateParticipantCount();
  });

  // ============================================
  // USER LEFT - Remove completely
  // ============================================
  client.on('user-left', (user) => {
    const uid = String(user.uid);
    console.log('👋 USER LEFT:', uid);
    
    // Stop and remove all tracks for this user
    setRemoteTracks(prev => {
      const newMap = new Map(prev);
      const tracks = newMap.get(uid);
      
      if (tracks) {
        tracks.audio?.stop();
        tracks.video?.stop();
      }
      
      // Delete the entry completely
      newMap.delete(uid);
      console.log('🗑️ Removed tracks for:', uid);
      return newMap;
    });
    
    // Remove profile
    setUserProfiles(prev => {
      const updated = new Map(prev);
      updated.delete(uid);
      console.log('🗑️ Removed profile for:', uid);
      return updated;
    });
    
    updateParticipantCount();
  });

  // ============================================
  // CONNECTION STATE CHANGES
  // ============================================
  client.on('connection-state-change', (curState, prevState) => {
    console.log('🔌 Connection state changed:', { from: prevState, to: curState });
    
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
      
      // Re-fetch profiles after reconnecting
      if (sessionState.sessionInfo?.meetingId) {
        setTimeout(() => {
          fetchParticipants(sessionState.sessionInfo.meetingId);
        }, 1000);
      }
    }
  });

  console.log('✅ Event listeners setup complete');
};
  // ============================================
  // Control Functions - UPDATED
  // ============================================

const toggleAudio = async () => {
  if (!localTracks.audio || !controls.hasMicrophone) {
    console.warn('⚠️ No audio track available');
    setControls(prev => ({ ...prev, audioEnabled: false }));
    return;
  }

  try {
    const newState = !controls.audioEnabled;
    
    // ✅ DON'T stop/close the track, just enable/disable it
    await localTracks.audio.setEnabled(newState);
    
    setControls(prev => ({ ...prev, audioEnabled: newState }));
    
    console.log(`🎤 Audio ${newState ? 'enabled' : 'disabled'}`);
    
    // Update in database
    await updateParticipantStatus({ audioEnabled: newState });
    
  } catch (error) {
    console.error('❌ Toggle audio error:', error);
  }
};

const toggleVideo = async () => {
  if (!localTracks.video || !controls.hasCamera) {
    console.warn('⚠️ No video track available');
    setControls(prev => ({ ...prev, videoEnabled: false }));
    return;
  }

  try {
    const newState = !controls.videoEnabled;
    
    // ✅ DON'T stop/close the track, just enable/disable it
    await localTracks.video.setEnabled(newState);
    
    setControls(prev => ({ ...prev, videoEnabled: newState }));
    
    console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
    
    // Update in database
    await updateParticipantStatus({ videoEnabled: newState });
    
  } catch (error) {
    console.error('❌ Toggle video error:', error);
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
    
    // Cleanup (includes clearing profilePollingRef)
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

    // Detect available devices first
    const deviceInfo = await detectAvailableDevices();

    // 1. Create tracks with better error handling
    let audioTrack = null;
    let videoTrack = null;

    // Only create audio if microphone exists
    if (deviceInfo.hasMicrophone) {
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true, // Acoustic Echo Cancellation
          ANS: true, // Automatic Noise Suppression
          encoderConfig: {
            sampleRate: 48000,
            stereo: false,
            bitrate: 48
          }
        });
        console.log('✅ Audio track created');
      } catch (audioError) {
        console.warn('⚠️ Audio track failed:', audioError.message);
      }
    }

    // Only create video if camera exists
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
          optimizationMode: 'detail' // Changed from 'motion' for stability
        });
        console.log('✅ Video track created');
      } catch (videoError) {
        console.warn('⚠️ Video track failed:', videoError.message);
      }
    }

    // 2. Store tracks locally FIRST (before publishing)
    setLocalTracks({ audio: audioTrack, video: videoTrack });

    // 3. Update control state
    setControls(prev => ({
      ...prev,
      hasMicrophone: !!audioTrack,
      hasCamera: !!videoTrack,
      audioEnabled: !!audioTrack,
      videoEnabled: !!videoTrack
    }));

    // 4. Publish available tracks to other users
    const tracksToPublish = [];
    if (audioTrack) tracksToPublish.push(audioTrack);
    if (videoTrack) tracksToPublish.push(videoTrack);

    if (tracksToPublish.length > 0 && clientRef.current) {
      await clientRef.current.publish(tracksToPublish);
      console.log(`📤 Published ${tracksToPublish.length} track(s) to channel`);
    }

    // 5. Update participant status
    await updateParticipantStatus({
      audioEnabled: !!audioTrack,
      videoEnabled: !!videoTrack,
      devices: {
        hasMicrophone: !!audioTrack,
        hasCamera: !!videoTrack
      }
    });

    console.log('✅ Local tracks created and published successfully');

  } catch (error) {
    console.error('❌ Track creation/publishing error:', error);
    // Don't throw - allow user to continue without media
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
  if (profilePollingRef.current) {
    clearInterval(profilePollingRef.current);
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



  {/* Main Content Area */}
  <div className="flex-1 p-4 overflow-y-auto">
    
   
  <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
      
      {/* Local Video (Student's own video) */}
{localTracks.video && (
<div className="relative rounded-2xl overflow-hidden border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 group">
  <div className="relative w-full h-full min-h-[300px] bg-gradient-to-br from-gray-900 via-cyan-900/10 to-gray-900">
    <video
      ref={(el) => {
        if (el && localTracks.video) {
          try {
            localTracks.video.stop();
            localTracks.video.play(el);
          } catch (error) {
            console.warn('Local video play error:', error);
          }
        }
      }}
      className="w-full h-full object-cover"
      style={{ transform: 'scaleX(-1)' }}
      autoPlay
      playsInline
      muted
    />
    
    {/* Video quality indicators */}
    <div className="absolute top-3 right-3 flex gap-2">
      <div className="px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-white">HD</span>
        </div>
      </div>
    </div>
  </div>

  {/* Local user info overlay */}
  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <span className="text-white font-bold">S</span>
        </div>
        <div>
          <div className="font-bold text-white text-lg">You</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-cyan-300">Student</span>
            <span className="px-2 py-0.5 bg-cyan-500/30 text-cyan-300 rounded-full text-xs border border-cyan-500/50">
              Local
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${controls.audioEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {controls.audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </div>
        <div className={`p-2 rounded-full ${controls.videoEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {controls.videoEnabled ? <Camera size={18} /> : <CameraOff size={18} />}
        </div>
      </div>
    </div>
  </div>

  {/* Connection status */}
  <div className="absolute top-3 left-3 flex items-center gap-2">
    <div className="px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs text-white">Live</span>
      </div>
    </div>
  </div>
</div>
)}

{/* Show placeholder if no local video */}
{!localTracks.video && (
  <div className="relative rounded-2xl overflow-hidden border-2 border-gray-700/50 group">
    <div className="relative w-full h-full min-h-[200px] bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-3 opacity-70">📹</div>
        <p className="text-gray-400 font-medium">Your Camera</p>
        <div className="px-2 py-1 rounded-full text-xs mt-2 inline-block bg-gray-700/50 text-gray-400">
          {controls.hasCamera ? 'Camera Off' : 'No Camera Detected'}
        </div>
        <p className="text-gray-500 text-sm mt-2">
          {controls.hasCamera ? 'Click camera button to turn on' : 'Connect a camera to join with video'}
        </p>
      </div>
    </div>

    {/* Overlay Info */}
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
      <div className="flex justify-between items-center">
        <div className="text-white">
          <div className="font-semibold flex items-center gap-2">
            You (Student)
            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">
              Local
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {controls.audioEnabled && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-300">Mic</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
      {/* Remote Users */}
{Array.from(remoteTracks.entries()).map(([uid, tracks]) => {
  const uidString = uid.toString(); 
  const profile = userProfiles.get(uidString);
  const isTeacher = profile?.role === 'teacher' || uidString === teacherUid;
  const isLocalUser = uidString === sessionState.sessionInfo?.uid?.toString();
  
  const displayName = profile?.name || 
                      profile?.display_name || 
                      (isTeacher ? 'Teacher' : `Student`);
  
  const userRole = isTeacher ? 'Teacher' : 'Student';
  const borderColor = isTeacher ? 'border-yellow-500/60' : 'border-blue-500/40';
  const bgGradient = isTeacher 
    ? 'from-yellow-900/10 via-gray-900 to-yellow-900/10' 
    : 'from-blue-900/10 via-gray-900 to-blue-900/10';
  const roleColor = isTeacher ? 'text-yellow-400' : 'text-blue-400';
  const badgeColor = isTeacher ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-blue-500/20 border-blue-500/40';
  
  return (
    <div 
      key={uid} 
      className={`relative rounded-2xl overflow-hidden border-2 ${borderColor} shadow-xl shadow-${isTeacher ? 'yellow' : 'blue'}-500/10 group transition-all duration-300 hover:scale-[1.02]`}
    >
      {/* Video Container */}
      <div 
        ref={el => {
          if (el && tracks.video) {
            try {
              tracks.video.play(el);
            } catch (error) {
              console.warn(`Remote video play error for ${uid}:`, error);
            }
          }
        }}
        className="w-full h-full min-h-[300px] bg-gray-900 relative"
      />
      
      {/* Placeholder if no video */}
      {!tracks.video && (
        <div className={`absolute inset-0 w-full h-full min-h-[300px] flex items-center justify-center bg-gradient-to-br ${bgGradient}`}>
          <div className="text-center">
            <div className={`text-6xl mb-4 opacity-80 ${isTeacher ? 'text-yellow-400' : 'text-blue-400'}`}>
              {isTeacher ? '👨‍🏫' : '🎓'}
            </div>
            <p className={`text-xl font-bold mb-2 ${isTeacher ? 'text-yellow-300' : 'text-blue-300'}`}>
              {displayName}
            </p>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${badgeColor} ${roleColor} border`}>
              {userRole}
            </div>
            <p className="text-gray-400 text-sm mt-3">
              {tracks.audio ? 'Audio only' : 'Connecting...'}
            </p>
          </div>
        </div>
      )}
      
      {/* User info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${isTeacher ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'} flex items-center justify-center`}>
              <span className="text-white font-bold">
                {isTeacher ? 'T' : 'S'}
              </span>
            </div>
            <div>
              <div className={`font-bold text-lg ${isTeacher ? 'text-yellow-300' : 'text-white'}`}>
                {displayName}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isTeacher ? 'text-yellow-400' : 'text-cyan-400'}`}>
                  {userRole}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${badgeColor} ${roleColor}`}>
                  Remote
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {tracks.audio && (
              <div className="flex items-center gap-1 bg-black/60 p-2 rounded-lg backdrop-blur-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-300">Audio</span>
              </div>
            )}
            {isLocalUser && (
              <div className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs border border-cyan-500/30">
                You
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Status indicators */}
      <div className="absolute top-3 right-3 flex gap-2">
        {tracks.video && (
          <div className="px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-white">Video</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Teacher badge */}
      {isTeacher && (
        <div className="absolute top-3 left-3 px-3 py-1 bg-gradient-to-r from-yellow-600/80 to-orange-600/80 rounded-full backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white">TEACHER</span>
            <span className="text-yellow-300">⭐</span>
          </div>
        </div>
      )}
    </div>
  );
})}
      
     {/* Empty State - Teacher-style */}
{remoteTracks.size === 0 && (
  <div className="col-span-full flex items-center justify-center min-h-[500px]">
    <div className="text-center max-w-2xl">
      <div className="relative mb-8">
        <div className="relative mx-auto w-32 h-32">
          <Users className="text-cyan-400 opacity-30 mx-auto" size={128} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-ping w-24 h-24 bg-cyan-500/20 rounded-full"></div>
          </div>
        </div>
      </div>
      <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
        Classroom Ready
      </h3>
      <p className="text-lg text-gray-300 mb-6 max-w-md mx-auto">
        {teacherUid 
          ? 'Teacher is online. Other students will join soon.' 
          : 'Your session is active. Waiting for teacher to join...'}
      </p>
      
      <div className="bg-gradient-to-r from-gray-900/50 to-cyan-900/20 p-6 rounded-2xl border border-cyan-500/30 backdrop-blur-sm max-w-lg mx-auto">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-400">You're connected</span>
          </div>
          <div className="h-4 w-px bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
            <span className="text-sm text-cyan-400">Audio ready</span>
          </div>
        </div>
        <p className="text-cyan-300 text-sm">
          {teacherUid 
            ? 'Share your screen and engage with the teacher.' 
            : 'Prepare your questions and materials for the session.'}
        </p>
      </div>
    </div>
  </div>
)}
    </div>
  

  </div>


{/* Controls Bar - Teacher-style */}
<div className="bg-gray-900/95 backdrop-blur-xl border-t border-cyan-500/30 p-4 md:p-6">
  <div className="flex flex-col md:flex-row items-center justify-between max-w-6xl mx-auto gap-4">
    {/* Left side - Connection status */}
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
        </div>
        <span className="text-sm text-green-400 font-medium">Connected</span>
      </div>
      <div className="hidden md:block h-4 w-px bg-gray-700"></div>
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-cyan-400" />
        <span className="text-sm text-cyan-300">{formatDuration(stats.duration)}</span>
      </div>
      <div className="hidden md:block h-4 w-px bg-gray-700"></div>
      <div className="flex items-center gap-2">
        <Users size={16} className="text-cyan-400" />
        <span className="text-sm text-cyan-300">{stats.participantCount} online</span>
      </div>
    </div>
    
    {/* Center - Main controls */}
    <div className="flex items-center gap-3 md:gap-6">
      <button
        onClick={toggleAudio}
        disabled={!controls.hasMicrophone}
        className={`relative p-4 md:p-5 rounded-2xl transition-all duration-200 shadow-xl ${
          controls.audioEnabled 
            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-500/30' 
            : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-red-500/30'
        } disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
        title={controls.hasMicrophone ? (controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone') : 'No microphone detected'}
      >
        {controls.audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
        {controls.hasMicrophone && (
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${controls.audioEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
        )}
      </button>

      <button
        onClick={toggleVideo}
        disabled={!controls.hasCamera}
        className={`relative p-4 md:p-5 rounded-2xl transition-all duration-200 shadow-xl ${
          controls.videoEnabled 
            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-500/30' 
            : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-red-500/30'
        } disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
        title={controls.hasCamera ? (controls.videoEnabled ? 'Turn off camera' : 'Turn on camera') : 'No camera detected'}
      >
        {controls.videoEnabled ? <Camera size={24} /> : <CameraOff size={24} />}
        {controls.hasCamera && (
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${controls.videoEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
        )}
      </button>

      <button
        onClick={toggleHandRaise}
        className={`relative p-4 md:p-5 rounded-2xl transition-all duration-200 shadow-xl hover:scale-105 active:scale-95 ${
          controls.handRaised 
            ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-yellow-500/30 animate-pulse' 
            : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
        }`}
        title={controls.handRaised ? 'Lower hand' : 'Raise hand'}
      >
        <Hand size={24} />
        {controls.handRaised && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-ping"></div>
        )}
      </button>

      <button className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200 shadow-xl hover:scale-105 active:scale-95">
        <MoreVertical size={24} />
      </button>
    </div>
    
    {/* Right side - Leave button */}
    <button 
      onClick={leaveSession}
      className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 px-6 py-3 rounded-2xl font-semibold flex items-center gap-3 transition-all duration-200 shadow-xl hover:scale-105 active:scale-95"
    >
      <PhoneOff size={20} />
      <span>Leave Session</span>
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

const RemoteVideo = ({ uid, tracks, userProfiles, teacherUid }) => {
  const vidRef = useRef(null);

  // Get profile from map
  const profile = userProfiles.get(String(uid));
  const isTeacher = String(uid) === String(teacherUid) || profile?.is_teacher || profile?.role === 'teacher';
  
  // Determine display name with better fallbacks
  let displayName;
  if (isTeacher) {
    displayName = 'Teacher';
  } else if (profile?.display_name) {
    displayName = profile.display_name;
  } else if (profile?.name) {
    displayName = profile.name;
  } else {
    // Clean fallback - just show "Student" without long UID
    displayName = 'Student';
  }
  
  const roleLabel = isTeacher ? '(Host)' : '';
  const roleIcon = isTeacher ? '👨‍🏫' : '👤';

  console.log('🎥 Rendering RemoteVideo:', {
    uid: String(uid),
    profile,
    isTeacher,
    displayName,
    hasVideo: !!tracks.video,
    hasAudio: !!tracks.audio
  });

  useEffect(() => {
    if (tracks.video && vidRef.current) {
      try {
        tracks.video.play(vidRef.current);
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
    <div className="relative bg-gray-900 rounded-2xl overflow-hidden border border-cyan-500/20 w-full h-64 md:h-80">
      <div ref={vidRef} className="w-full h-full bg-gray-800" />
      
      {/* Placeholder if video is off */}
      {!tracks.video && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-400">
          <div className={`text-6xl mb-3 ${isTeacher ? 'text-yellow-400' : 'text-cyan-400'}`}>
            {roleIcon}
          </div>
          <p className={`text-lg font-semibold ${isTeacher ? 'text-yellow-300' : 'text-white'}`}>
            {displayName} {roleLabel}
          </p>
          <p className="text-sm text-gray-500 mt-1">Camera off</p>
        </div>
      )}

      {/* Display Name and Role Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${
              isTeacher ? 'text-yellow-300 font-bold' : 'text-white'
            }`}>
              {displayName} {roleLabel}
            </span>
            {isTeacher && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                Host
              </span>
            )}
          </div>
          {tracks.audio && (
            <div className="flex items-center gap-1 text-green-400">
              <Mic size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default StudentVideoCall;