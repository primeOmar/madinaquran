import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  Mic, MicOff, Video, VideoOff, Phone, Users, Clock,
  Settings, Share2, MessageCircle, User, Wifi, WifiOff,
  AlertCircle, Loader2, XCircle, CheckCircle, Copy
} from "lucide-react";
import { toast } from 'react-toastify';
import { motion } from "framer-motion";
import { teacherApi } from '../lib/teacherApi';
// Add this comprehensive debug useEffect at the top of your TeacherVideoCall component
useEffect(() => {
  console.log('🔍 TEACHER VIDEO CALL STATE:', {
    isOpen,
    classItem: classItem ? { id: classItem.id, title: classItem.title } : null,
    sessionState: {
      isConnecting: sessionState.isConnecting,
      isConnected: sessionState.isConnected,
      connectionState: sessionState.connectionState,
      localVideoReady: sessionState.localVideoReady,
      error: sessionState.error
    },
    tracks: {
      audio: !!localTracksRef.current.audio,
      video: !!localTracksRef.current.video
    },
    client: !!agoraClientRef.current
  });
}, [isOpen, classItem, sessionState]);

// Enhanced initializeSession function with step-by-step debugging
const initializeSession = useCallback(async () => {
  if (!isOpen || !classItem?.id) {
    debugLog('❌ Cannot initialize: missing isOpen or classItem');
    return;
  }
  
  if (sessionState.isConnecting || sessionState.isConnected) {
    debugLog('⚠️ Already connecting or connected, skipping');
    return;
  }

  debugLog('🚀 STARTING TEACHER SESSION INITIALIZATION');
  
  setSessionState(prev => ({
    ...prev,
    isConnecting: true,
    error: null
  }));

  try {
    // STEP 1: Test media permissions
    debugLog('🎯 STEP 1: Testing media permissions...');
    await testMediaPermissions();
    debugLog('✅ Media permissions granted');

    // STEP 2: Get session credentials
    debugLog('🔗 STEP 2: Getting session credentials...');
    const sessionData = await teacherApi.getOrCreateActiveSession(classItem.id);
    console.log('📋 SESSION DATA FROM API:', sessionData);
    
    if (!sessionData || !sessionData.agora_credentials) {
      throw new Error('No session credentials received from API');
    }

    const { appId, channel, token, uid } = sessionData.agora_credentials;
    debugLog('✅ Credentials received', { channel, uid, hasAppId: !!appId, hasToken: !!token });

    // Validate App ID
    if (!appId || appId.includes('your_agora_app_id')) {
      throw new Error(`Invalid App ID: ${appId}`);
    }

    // STEP 3: Create local tracks
    debugLog('🎤 STEP 3: Creating local tracks...');
    const tracks = await createLocalTracks();
    debugLog('✅ Local tracks created', { 
      hasAudio: !!tracks.audio, 
      hasVideo: !!tracks.video 
    });

    // STEP 4: Play local video immediately
    debugLog('📹 STEP 4: Playing local video...');
    await playLocalVideo();
    debugLog('✅ Local video playing');

    // STEP 5: Initialize Agora client
    debugLog('🔧 STEP 5: Initializing Agora client...');
    const client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });
    agoraClientRef.current = client;
    debugLog('✅ Agora client created');

    // STEP 6: Setup event handlers
    debugLog('📡 STEP 6: Setting up event handlers...');
    setupAgoraEventHandlers(client);
    debugLog('✅ Event handlers configured');

    // STEP 7: Join channel
    debugLog(`🚪 STEP 7: Joining channel: ${channel}`);
    console.log('🎯 JOINING WITH:', { appId, channel, token, uid });
    
    await client.join(appId, channel, token, uid);
    debugLog('✅ Successfully joined channel');

    // STEP 8: Publish tracks
    debugLog('📤 STEP 8: Publishing tracks...');
    const tracksToPublish = [tracks.audio, tracks.video].filter(Boolean);
    console.log('📤 PUBLISHING TRACKS:', tracksToPublish);
    
    if (tracksToPublish.length > 0) {
      await client.publish(tracksToPublish);
      debugLog(`✅ Published ${tracksToPublish.length} tracks`);
    } else {
      debugLog('⚠️ No tracks to publish');
    }

    // STEP 9: Update connection state
    debugLog('✅ STEP 9: Session initialization complete');
    setSessionState(prev => ({
      ...prev,
      isConnected: true,
      isConnecting: false,
      sessionInfo: {
        meetingId: sessionData.meeting_id,
        isNewSession: sessionData.isNewSession,
        startTime: new Date().toISOString(),
        channel: channel
      },
      meetingId: sessionData.meeting_id,
      channel: channel
    }));

    // STEP 10: Start timer
    timerRef.current = setInterval(() => {
      setSessionState(prev => ({
        ...prev,
        callDuration: prev.callDuration + 1
      }));
    }, 1000);

    debugLog('🎉 TEACHER SESSION FULLY INITIALIZED');
    toast.success(sessionData.isNewSession ? '🎉 Class session started!' : '🔄 Rejoined existing session!');

  } catch (error) {
    console.error('❌ TEACHER SESSION INITIALIZATION FAILED:', error);
    debugError('Session initialization failed', error);
    
    let userMessage = 'Failed to start video session. ';
    if (error.message.includes('permission')) {
      userMessage = 'Camera/microphone permission required. Please allow access and refresh.';
    } else if (error.message.includes('network')) {
      userMessage = 'Network connection issue. Please check your internet.';
    } else if (error.message.includes('App ID') || error.message.includes('Invalid')) {
      userMessage = 'Configuration error. Please check Agora App ID settings.';
    } else if (error.message.includes('token')) {
      userMessage = 'Authentication error. Please try again.';
    } else {
      userMessage += error.message || 'Unknown error occurred.';
    }

    setSessionState(prev => ({
      ...prev,
      isConnecting: false,
      error: userMessage
    }));

    toast.error(userMessage);
    
    // Perform cleanup on failure
    await performCleanup();
  }
}, [isOpen, classItem, sessionState.isConnecting, sessionState.isConnected, setupAgoraEventHandlers]);

// Enhanced Agora event handlers with better connection state tracking
const setupAgoraEventHandlers = useCallback((client) => {
  debugLog('📡 Setting up Agora event handlers');

  // Connection state changes - ENHANCED
  client.on('connection-state-change', (curState, prevState) => {
    console.log('🔄 AGORA CONNECTION STATE CHANGE:', { prevState, curState });
    debugLog(`Connection state: ${prevState} → ${curState}`);

    setSessionState(prev => ({
      ...prev,
      connectionState: curState
    }));

    switch (curState) {
      case 'CONNECTED':
        debugLog('✅ Successfully connected to Agora channel');
        setSessionState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isConnecting: false,
          error: null 
        }));
        break;
        
      case 'CONNECTING':
        debugLog('🔄 Connecting to Agora channel...');
        setSessionState(prev => ({ ...prev, isConnecting: true }));
        break;
        
      case 'DISCONNECTED':
        debugLog('❌ Disconnected from Agora channel');
        setSessionState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isConnecting: false,
          error: 'Disconnected from session. Please try rejoining.' 
        }));
        break;
        
      case 'FAILED':
        debugLog('❌ Connection failed');
        setSessionState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isConnecting: false,
          error: 'Connection failed. Please check your internet and try again.' 
        }));
        break;
        
      default:
        debugLog(`ℹ️ Connection state: ${curState}`);
    }
  });

  // User published (student joined with media)
  client.on('user-published', async (user, mediaType) => {
    console.log('🔔 USER PUBLISHED:', { uid: user.uid, mediaType });
    debugLog(`Student ${user.uid} published ${mediaType}`);

    try {
      await client.subscribe(user, mediaType);
      debugLog(`✅ Subscribed to student ${user.uid} ${mediaType}`);

      if (!remoteUsersMapRef.current.has(user.uid)) {
        remoteUsersMapRef.current.set(user.uid, {
          uid: user.uid,
          hasVideo: false,
          hasAudio: false,
          role: 'student',
          joinedAt: new Date().toISOString()
        });
      }

      const userInfo = remoteUsersMapRef.current.get(user.uid);

      if (mediaType === 'video') {
        userInfo.hasVideo = true;
        await setupRemoteVideo(user);
      } else if (mediaType === 'audio') {
        userInfo.hasAudio = true;
        if (user.audioTrack) {
          user.audioTrack.play();
          debugLog(`🔊 Playing audio from student ${user.uid}`);
        }
      }

      updateParticipantsList();

      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'student_joined',
          classId: classItem?.id,
          studentUid: user.uid,
          totalParticipants: remoteUsersMapRef.current.size + 1
        });
      }

    } catch (error) {
      debugError(`Subscribe error for student ${user.uid}`, error);
    }
  });

  // Network quality monitoring
  client.on('network-quality', (quality) => {
    setSessionState(prev => ({
      ...prev,
      networkQuality: {
        upload: quality.uplinkNetworkQuality,
        download: quality.downlinkNetworkQuality
      }
    }));
  });

  // Stream type changed
  client.on('stream-type-changed', (evt) => {
    debugLog(`📊 Stream type changed: ${evt.uid} -> ${evt.streamType}`);
  });

  debugLog('✅ All Agora event handlers configured');
}, [classItem?.id, debugLog, debugError, onSessionUpdate]);

// Add this test function to check what's happening
const testConnection = async () => {
  console.log('🧪 RUNNING CONNECTION TEST');
  
  try {
    // Test 1: Check if component is properly mounted
    console.log('✅ Component mounted:', isMountedRef.current);
    
    // Test 2: Check if we have classItem
    console.log('✅ Class item:', classItem ? { id: classItem.id, title: classItem.title } : 'MISSING');
    
    // Test 3: Test media permissions directly
    console.log('🎯 Testing media permissions directly...');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log('✅ Media permissions work:', {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    stream.getTracks().forEach(track => track.stop());
    
    // Test 4: Test API call
    console.log('🔗 Testing API call...');
    const sessionData = await teacherApi.getOrCreateActiveSession(classItem.id);
    console.log('✅ API response:', sessionData);
    
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
};

// Call the test function when component mounts
useEffect(() => {
  if (isOpen && classItem) {
    testConnection();
  }
}, [isOpen, classItem]);

// Enhanced Teacher Video Call Component
const TeacherVideoCall = ({
  classItem,
  isOpen,
  onClose,
  onSessionUpdate
}) => {
  // State Management
  const [sessionState, setSessionState] = useState({
    isConnected: false,
    isConnecting: false,
    isAudioMuted: false,
    isVideoOff: false,
    callDuration: 0,
    participants: [],
    networkQuality: { upload: 0, download: 0 },
    error: null,
    sessionInfo: null,
    localVideoReady: false,
    meetingId: null,
    channel: null,
    connectionState: 'DISCONNECTED'
  });

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideosContainerRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({
    audio: null,
    video: null
  });
  const agoraClientRef = useRef(null);
  const remoteUsersMapRef = useRef(new Map());
  const isMountedRef = useRef(true);

  // Debug logging
  const debugLog = useCallback((message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] 🎥 TEACHER_VIDEO: ${message}`, data || '');
  }, []);

  const debugError = useCallback((message, error) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] ❌ TEACHER_VIDEO_ERROR: ${message}`, error);
  }, []);

  // Enhanced media device detection
  useEffect(() => {
    const checkMediaDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        const mics = devices.filter(device => device.kind === 'audioinput');
        
        debugLog('Media devices detected', {
          cameras: cameras.length,
          mics: mics.length,
          cameraLabels: cameras.map(c => c.label),
          micLabels: mics.map(m => m.label)
        });
      } catch (error) {
        debugError('Error detecting media devices', error);
      }
    };

    if (isOpen) {
      checkMediaDevices();
    }
  }, [isOpen, debugLog, debugError]);

  // Test media permissions - SIMPLIFIED
  const testMediaPermissions = async () => {
    try {
      debugLog('🎯 Testing media permissions...');
      
      // Test both camera and microphone together (more realistic)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      debugLog('✅ Media permissions granted', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      debugError('❌ Media permission error:', error);
      let errorMessage = 'Camera/microphone access required. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone permissions in your browser.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera/microphone is busy with another application.';
      } else {
        errorMessage += error.message;
      }
      
      setSessionState(prev => ({
        ...prev,
        error: errorMessage
      }));
      throw error;
    }
  };

  // SIMPLIFIED track creation
  const createLocalTracks = async () => {
    try {
      debugLog('🎤 Creating local tracks...');

      // Create audio track with fallback
      let audioTrack = null;
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
        debugLog('✅ Audio track created');
      } catch (audioError) {
        debugError('Audio track creation failed, continuing without audio', audioError);
        // Continue without audio
      }

      // Create video track (essential)
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 640,
          height: 480, // Lower resolution for better compatibility
          frameRate: 24,
          bitrateMin: 500,
          bitrateMax: 1000
        },
        optimizationMode: 'motion',
        mirror: true
      });
      debugLog('✅ Video track created');

      localTracksRef.current.audio = audioTrack;
      localTracksRef.current.video = videoTrack;

      return { audio: audioTrack, video: videoTrack };

    } catch (error) {
      debugError('Track creation failed:', error);
      throw error;
    }
  };

  // Enhanced Agora Event Handlers - SIMILAR TO STUDENT COMPONENT
  const setupAgoraEventHandlers = useCallback((client) => {
    debugLog('📡 Setting up Agora event handlers');

    // User published (student joined with media)
    client.on('user-published', async (user, mediaType) => {
      debugLog(`🔔 Student ${user.uid} published ${mediaType}`);

      try {
        await client.subscribe(user, mediaType);
        debugLog(`✅ Subscribed to student ${user.uid} ${mediaType}`);

        if (!remoteUsersMapRef.current.has(user.uid)) {
          remoteUsersMapRef.current.set(user.uid, {
            uid: user.uid,
            hasVideo: false,
            hasAudio: false,
            role: 'student',
            joinedAt: new Date().toISOString()
          });
        }

        const userInfo = remoteUsersMapRef.current.get(user.uid);

        if (mediaType === 'video') {
          userInfo.hasVideo = true;
          await setupRemoteVideo(user);
        } else if (mediaType === 'audio') {
          userInfo.hasAudio = true;
          if (user.audioTrack) {
            user.audioTrack.play();
            debugLog(`🔊 Playing audio from student ${user.uid}`);
          }
        }

        updateParticipantsList();

        // Notify parent component
        if (onSessionUpdate) {
          onSessionUpdate({
            type: 'student_joined',
            classId: classItem?.id,
            studentUid: user.uid,
            totalParticipants: remoteUsersMapRef.current.size + 1
          });
        }

      } catch (error) {
        debugError(`Subscribe error for student ${user.uid}`, error);
      }
    });

    // User unpublished (student stopped sharing media)
    client.on('user-unpublished', (user, mediaType) => {
      debugLog(`🔕 Student ${user.uid} unpublished ${mediaType}`);

      if (remoteUsersMapRef.current.has(user.uid)) {
        const userInfo = remoteUsersMapRef.current.get(user.uid);
        if (mediaType === 'video') {
          userInfo.hasVideo = false;
          removeRemoteVideo(user.uid);
        } else if (mediaType === 'audio') {
          userInfo.hasAudio = false;
        }
        updateParticipantsList();
      }
    });

    // User left (student disconnected)
    client.on('user-left', (user) => {
      debugLog(`👋 Student ${user.uid} left the session`);
      remoteUsersMapRef.current.delete(user.uid);
      removeRemoteVideo(user.uid);
      updateParticipantsList();

      // Notify parent component
      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'student_left',
          classId: classItem?.id,
          studentUid: user.uid,
          totalParticipants: remoteUsersMapRef.current.size + 1
        });
      }
    });

    // Network quality monitoring
    client.on('network-quality', (quality) => {
      setSessionState(prev => ({
        ...prev,
        networkQuality: {
          upload: quality.uplinkNetworkQuality,
          download: quality.downlinkNetworkQuality
        }
      }));
    });

    // Connection state changes - ENHANCED
    client.on('connection-state-change', (curState, prevState) => {
      debugLog(`🔄 Connection state changed: ${prevState} → ${curState}`);
      
      setSessionState(prev => ({
        ...prev,
        connectionState: curState
      }));

      if (curState === 'CONNECTED') {
        debugLog('✅ Successfully connected to Agora channel');
        setSessionState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
      } else if (curState === 'DISCONNECTED' || curState === 'FAILED') {
        debugError('❌ Connection lost or failed', { curState, prevState });
        setSessionState(prev => ({
          ...prev,
          error: `Connection issue: ${curState}. Please check your internet connection.`,
          isConnected: false,
          isConnecting: false
        }));
      } else if (curState === 'CONNECTING') {
        setSessionState(prev => ({ ...prev, isConnecting: true }));
      }
    });

    // Stream fallback for quality adaptation
    client.on('stream-fallback', (evt) => {
      debugLog(`📊 Stream fallback: ${evt.isFallback ? 'fallback' : 'recovery'}`);
    });

  }, [classItem?.id, debugLog, debugError, onSessionUpdate]);

  // Local Track Management
  const playLocalVideo = useCallback(async () => {
    if (!localVideoRef.current || !localTracksRef.current.video) {
      debugError('Cannot play local video: missing ref or track');
      return;
    }

    try {
      // Clear any existing content
      localVideoRef.current.innerHTML = '';

      // Play the video track
      await localTracksRef.current.video.play(localVideoRef.current, {
        mirror: true,
        fit: 'cover'
      });

      setSessionState(prev => ({ ...prev, localVideoReady: true }));
      debugLog('✅ Local video playing');

    } catch (error) {
      debugError('Failed to play local video', error);
      setSessionState(prev => ({ ...prev, localVideoReady: true }));
    }
  }, [debugLog, debugError]);

  // Remote Video Management - SIMILAR TO STUDENT COMPONENT
  const setupRemoteVideo = useCallback(async (user) => {
    const container = remoteVideosContainerRef.current;
    if (!container) return;

    const videoId = `remote-video-${user.uid}`;

    // Remove existing video element if any
    const existingElement = document.getElementById(videoId);
    if (existingElement) existingElement.remove();

    // Create new video container
    const videoElement = document.createElement('div');
    videoElement.id = videoId;
    videoElement.className = 'remote-video-item bg-gray-800 rounded-xl overflow-hidden relative min-h-[200px] shadow-lg';

    container.appendChild(videoElement);

    try {
      if (user.videoTrack) {
        await user.videoTrack.play(videoElement);
        debugLog(`✅ Remote video playing for student ${user.uid}`);

        // Add student info overlay
        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-3 left-3 bg-black/70 text-white px-3 py-2 rounded-lg text-sm backdrop-blur-sm';
        overlay.textContent = user.uid === 1 ? 'Teacher' : `Student ${user.uid}`;
        videoElement.appendChild(overlay);
      }
    } catch (error) {
      debugError(`Remote video playback error for student ${user.uid}`, error);
    }
  }, [debugLog, debugError]);

  const removeRemoteVideo = useCallback((uid) => {
    const videoElement = document.getElementById(`remote-video-${uid}`);
    if (videoElement) videoElement.remove();
  }, []);

  const updateParticipantsList = useCallback(() => {
    const participants = Array.from(remoteUsersMapRef.current.values());
    setSessionState(prev => ({ ...prev, participants }));
    debugLog('Participants updated', { count: participants.length, participants });
  }, [debugLog]);

  // ENHANCED initializeSession - SIMPLIFIED LIKE STUDENT COMPONENT
  const initializeSession = useCallback(async () => {
    if (!isOpen || !classItem?.id || sessionState.isConnecting || sessionState.isConnected) {
      debugLog('Skipping session initialization - invalid state');
      return;
    }

    debugLog('🚀 Starting teacher video session', {
      classId: classItem.id,
      className: classItem.title
    });

    setSessionState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }));

    try {
      // Step 1: Test media permissions
      debugLog('🎯 Testing media permissions...');
      await testMediaPermissions();

      // Step 2: Get session credentials from teacher API
      debugLog('🔗 Getting session from teacher API...');
      const sessionData = await teacherApi.getOrCreateActiveSession(classItem.id);
      
      if (!sessionData || !sessionData.agora_credentials) {
        throw new Error('Failed to get session credentials');
      }

      const { appId, channel, token, uid } = sessionData.agora_credentials;

      debugLog('✅ Session credentials received', {
        channel,
        uid,
        hasAppId: !!appId,
        hasToken: !!token
      });

      // Step 3: Validate configuration
      if (!appId || appId.includes('your_agora_app_id')) {
        throw new Error('Invalid Agora App ID configuration');
      }

      // Step 4: Create local tracks FIRST
      debugLog('🎤 Creating local tracks...');
      const tracks = await createLocalTracks();

      // Step 5: Play local video BEFORE joining channel
      await playLocalVideo();

      // Step 6: Initialize Agora client
      debugLog('🔧 Initializing Agora client...');
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      agoraClientRef.current = client;

      // Step 7: Setup event handlers
      setupAgoraEventHandlers(client);

      // Step 8: Join channel
      debugLog(`🚪 Joining channel: ${channel}`);
      await client.join(appId, channel, token, uid);
      debugLog('✅ Joined channel successfully');

      // Step 9: Publish tracks
      debugLog('📤 Publishing tracks...');
      const tracksToPublish = [tracks.audio, tracks.video].filter(Boolean);
      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        debugLog(`✅ Published ${tracksToPublish.length} tracks`);
      }

      // Step 10: Update state - connection will be confirmed by connection-state-change event
      setSessionState(prev => ({
        ...prev,
        sessionInfo: {
          meetingId: sessionData.meeting_id,
          isNewSession: sessionData.isNewSession,
          startTime: new Date().toISOString(),
          channel: channel
        },
        meetingId: sessionData.meeting_id,
        channel: channel
      }));

      // Step 11: Start timer
      timerRef.current = setInterval(() => {
        setSessionState(prev => ({
          ...prev,
          callDuration: prev.callDuration + 1
        }));
      }, 1000);

      debugLog('🎉 Teacher video session initialization complete');
      toast.success(sessionData.isNewSession ? '🎉 Class session started!' : '🔄 Rejoined existing session!');

    } catch (error) {
      debugError('❌ Session initialization failed', error);
      
      let userMessage = 'Failed to start video session. ';
      if (error.message.includes('permission')) {
        userMessage = 'Camera/microphone permission required. Please allow access and refresh.';
      } else if (error.message.includes('network')) {
        userMessage = 'Network connection issue. Please check your internet.';
      } else if (error.message.includes('App ID')) {
        userMessage = 'Configuration error. Please contact support.';
      } else {
        userMessage += error.message || 'Please check your connection.';
      }

      setSessionState(prev => ({
        ...prev,
        isConnecting: false,
        error: userMessage
      }));

      toast.error(userMessage);
      await performCleanup();
    }
  }, [isOpen, classItem, sessionState.isConnecting, sessionState.isConnected, setupAgoraEventHandlers]);

  // Media Control Functions
  const toggleAudio = useCallback(async () => {
    if (!localTracksRef.current.audio || !sessionState.isConnected) return;

    try {
      const newMutedState = !sessionState.isAudioMuted;
      await localTracksRef.current.audio.setEnabled(!newMutedState);

      setSessionState(prev => ({
        ...prev,
        isAudioMuted: newMutedState
      }));

      debugLog(`🎤 Audio ${newMutedState ? 'muted' : 'unmuted'}`);
      toast.info(newMutedState ? '🔇 Microphone muted' : '🎤 Microphone on');

    } catch (error) {
      debugError('Toggle audio failed', error);
      toast.error('Failed to toggle microphone');
    }
  }, [sessionState.isAudioMuted, sessionState.isConnected, debugLog, debugError]);

  const toggleVideo = useCallback(async () => {
    if (!localTracksRef.current.video || !sessionState.isConnected) return;

    try {
      const newVideoOffState = !sessionState.isVideoOff;
      await localTracksRef.current.video.setEnabled(!newVideoOffState);

      setSessionState(prev => ({
        ...prev,
        isVideoOff: newVideoOffState
      }));

      debugLog(`📹 Video ${newVideoOffState ? 'off' : 'on'}`);
      toast.info(newVideoOffState ? '📹 Camera off' : '📹 Camera on');

    } catch (error) {
      debugError('Toggle video failed', error);
      toast.error('Failed to toggle camera');
    }
  }, [sessionState.isVideoOff, sessionState.isConnected, debugLog, debugError]);

  // Session Control Functions
  const endSession = useCallback(async () => {
    debugLog('🛑 Ending teacher video session...');

    try {
      // Notify parent component
      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'session_ending',
          classId: classItem?.id,
          meetingId: sessionState.sessionInfo?.meetingId
        });
      }

      // End session via backend if we have session info
      if (sessionState.sessionInfo?.meetingId) {
        debugLog('📡 Notifying backend about session end...');
        try {
          await teacherApi.endVideoSession(sessionState.sessionInfo.meetingId);
        } catch (apiError) {
          debugError('Backend session end failed (non-critical)', apiError);
        }
      }

      await performCleanup();

      setSessionState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        callDuration: 0
      }));

      debugLog('✅ Session ended successfully');
      toast.success('✅ Class session ended');

      if (onSessionUpdate) {
        onSessionUpdate({
          type: 'session_ended',
          classId: classItem?.id
        });
      }

      if (onClose) {
        onClose();
      }

    } catch (error) {
      debugError('Error ending session', error);
      toast.error('Error ending session, but local connection closed');

      // Still perform local cleanup even if backend call fails
      await performCleanup();
      if (onClose) {
        onClose();
      }
    }
  }, [classItem?.id, sessionState.sessionInfo, onClose, onSessionUpdate, debugLog, debugError]);

  // Cleanup Function - SIMILAR TO STUDENT COMPONENT
  const performCleanup = useCallback(async () => {
    debugLog('🧹 Performing cleanup...');

    try {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop and cleanup local tracks
      const cleanupTrack = async (track, type) => {
        if (track) {
          try {
            track.stop();
            track.close();
            debugLog(`✅ ${type} track cleaned`);
          } catch (e) {
            debugError(`Error cleaning ${type} track`, e);
          }
        }
      };

      await Promise.all([
        cleanupTrack(localTracksRef.current.audio, 'audio'),
        cleanupTrack(localTracksRef.current.video, 'video')
      ]);

      localTracksRef.current = { audio: null, video: null };

      // Leave Agora channel
      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          debugLog('✅ Left Agora channel');
        } catch (e) {
          debugError('Error leaving Agora channel', e);
        }
        agoraClientRef.current = null;
      }

      // Clear remote users
      remoteUsersMapRef.current.clear();

      // Clear video elements
      if (remoteVideosContainerRef.current) {
        remoteVideosContainerRef.current.innerHTML = '';
      }

      if (localVideoRef.current) {
        localVideoRef.current.innerHTML = '';
      }

      debugLog('✅ Cleanup completed');

    } catch (error) {
      debugError('Cleanup error', error);
    }
  }, [debugLog, debugError]);

  // Utility Functions
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getNetworkQualityIcon = (quality) => {
    if (quality <= 2) return <Wifi className="w-4 h-4 text-green-400" />;
    if (quality <= 4) return <Wifi className="w-4 h-4 text-yellow-400" />;
    return <WifiOff className="w-4 h-4 text-red-400" />;
  };

  const getConnectionStatus = () => {
    if (sessionState.isConnected) return { text: 'Connected', color: 'text-green-400', bg: 'bg-green-500' };
    if (sessionState.isConnecting) return { text: 'Connecting...', color: 'text-yellow-400', bg: 'bg-yellow-500' };
    return { text: 'Disconnected', color: 'text-red-400', bg: 'bg-red-500' };
  };

  // Copy class link for students
  const copyClassLink = useCallback(() => {
    if (sessionState.meetingId) {
      const link = `${window.location.origin}/join-class/${sessionState.meetingId}`;
      navigator.clipboard.writeText(link);
      toast.success('🔗 Class link copied to clipboard! Students can use this to join.');
    } else {
      toast.error('No active session to share');
    }
  }, [sessionState.meetingId]);

  // Effects
  useEffect(() => {
    isMountedRef.current = true;
    debugLog('🎬 Teacher component mounted');

    return () => {
      debugLog('🎬 Teacher component unmounting');
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [debugLog]);

  useEffect(() => {
    if (isOpen && classItem) {
      debugLog('🔔 Teacher dialog opened, scheduling session start...');
      const timer = setTimeout(() => {
        initializeSession();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, classItem, initializeSession, debugLog]);

  // Don't render if not open
  if (!isOpen) return null;

  const connectionStatus = getConnectionStatus();
  const totalParticipants = sessionState.participants.length + 1; // +1 for teacher

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-sm text-white p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connectionStatus.bg} animate-pulse`} />
          <div>
            <h2 className="text-lg font-bold">{classItem?.title || 'Class Session'} - Teacher</h2>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className={connectionStatus.color}>{connectionStatus.text}</span>
              <span>•</span>
              <span>{formatTime(sessionState.callDuration)}</span>
              <span>•</span>
              <span>You (Teacher)</span>
              {sessionState.sessionInfo?.isNewSession && (
                <>
                  <span>•</span>
                  <span className="bg-green-500 px-2 py-0.5 rounded text-xs">NEW SESSION</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Users size={16} />
            <span>{totalParticipants}</span>
          </div>
          <button
            onClick={endSession}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
            disabled={sessionState.isConnecting}
          >
            <Phone size={18} />
            <span className="hidden sm:inline">End Class</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {sessionState.error && (
        <div className="bg-red-600/90 text-white p-4 mx-4 mt-4 rounded-xl flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">{sessionState.error}</span>
          </div>
          <button
            onClick={() => setSessionState(prev => ({ ...prev, error: null }))}
            className="text-xl font-bold hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-blue-900/80 text-white p-2 text-xs">
          <div>Connection: {sessionState.connectionState}</div>
          <div>Local Video: {sessionState.localVideoReady ? '✅' : '❌'}</div>
          <div>Audio Track: {localTracksRef.current.audio ? '✅' : '❌'}</div>
          <div>Video Track: {localTracksRef.current.video ? '✅' : '❌'}</div>
          <div>Participants: {sessionState.participants.length}</div>
        </div>
      )}

      {/* Main Video Area */}
      <div className="flex-1 relative p-4">
        {/* Remote Videos Grid */}
        <div
          ref={remoteVideosContainerRef}
          className="w-full h-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {/* Empty State */}
          {sessionState.participants.length === 0 && sessionState.isConnected && (
            <div className="col-span-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Users size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Waiting for students to join...</p>
                <p className="text-gray-500">Share the class link with your students</p>
                {sessionState.meetingId && (
                  <button
                    onClick={copyClassLink}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                  >
                    <Copy size={16} />
                    Copy Student Join Link
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local Video - Picture in Picture */}
        <div className="absolute bottom-6 right-6 w-64 h-48 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 transition-all duration-300 hover:border-cyan-400/50">
          <div
            ref={localVideoRef}
            className="w-full h-full bg-gray-800 flex items-center justify-center"
          />

          {/* Video Off State */}
          {sessionState.isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="text-gray-500 w-12 h-12" />
            </div>
          )}

          {/* Loading State */}
          {!sessionState.localVideoReady && sessionState.isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="animate-spin h-8 w-8 border-b-2 border-cyan-400 rounded-full"></div>
            </div>
          )}

          {/* Local Video Overlay */}
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm">
            You (Teacher) {sessionState.isConnected && '(Live)'}
          </div>

          {/* Status Icons */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            {sessionState.isAudioMuted && (
              <div className="bg-red-500 p-1.5 rounded-lg shadow-lg">
                <MicOff size={12} className="text-white" />
              </div>
            )}
            {sessionState.isVideoOff && (
              <div className="bg-red-500 p-1.5 rounded-lg shadow-lg">
                <VideoOff size={12} className="text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Connecting Overlay */}
        {sessionState.isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center text-white bg-gray-800/90 p-8 rounded-2xl shadow-2xl border border-cyan-500/20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full mx-auto mb-6"
              />
              <h3 className="text-2xl font-semibold mb-3 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Starting Class Session
              </h3>
              <p className="text-gray-300 mb-2">Setting up your classroom...</p>
              <div className="flex justify-center gap-1 mt-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                />
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-6">
        <div className="flex items-center justify-center gap-4 md:gap-8">
          {/* Audio Control */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleAudio}
            disabled={!sessionState.isConnected}
            className={`p-4 rounded-2xl transition-all duration-200 ${
              sessionState.isAudioMuted
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } ${!sessionState.isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
          >
            {sessionState.isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </motion.button>

          {/* Video Control */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVideo}
            disabled={!sessionState.isConnected}
            className={`p-4 rounded-2xl transition-all duration-200 ${
              sessionState.isVideoOff
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } ${!sessionState.isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
          >
            {sessionState.isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </motion.button>

          {/* Share Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg"
            onClick={copyClassLink}
            disabled={!sessionState.isConnected}
          >
            <Share2 size={24} />
          </motion.button>

          {/* Chat Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-lg"
          >
            <MessageCircle size={24} />
          </motion.button>

          {/* Settings Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-gray-600 hover:bg-gray-500 text-white transition-colors shadow-lg"
          >
            <Settings size={24} />
          </motion.button>
        </div>

        {/* Network Status */}
        <div className="flex justify-center items-center gap-4 mt-4 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            {getNetworkQualityIcon(sessionState.networkQuality.upload)}
            <span>Upload: {sessionState.networkQuality.upload}/6</span>
          </div>
          <div className="flex items-center gap-2">
            {getNetworkQualityIcon(sessionState.networkQuality.download)}
            <span>Download: {sessionState.networkQuality.download}/6</span>
          </div>
        </div>

        {/* Session Info */}
        {sessionState.meetingId && (
          <div className="flex justify-center items-center gap-4 mt-4 text-sm text-cyan-300">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} />
              <span>Meeting ID: {sessionState.meetingId.substring(0, 8)}...</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>Channel: {sessionState.channel?.substring(0, 12)}...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherVideoCall;
