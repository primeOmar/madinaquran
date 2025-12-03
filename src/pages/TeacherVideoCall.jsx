import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from '../lib/agora/videoApi';
import './TeacherVideoCall.css';

const TeacherVideoCall = ({ classId, teacherId, onEndCall }) => {
  // State Management
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

  // Refs - KEY FIX: Use container ref instead of video element ref
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const localContainerRef = useRef(null); // Container div for local video
  const remoteUsersRef = useRef({});
  const controlsTimeoutRef = useRef(null);

  // Auto-hide controls
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
    
    handleMouseMove(); // Initial show
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Handle initial interaction for autoplay policies
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
  // Initialization
  // ============================================

  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [classId, teacherId]);

  const initializeSession = async () => {
    try {
      console.log('🚀 Initializing video session...');
      
      // Enable Agora logging for debugging
      AgoraRTC.enableLogUpload();
      AgoraRTC.setLogLevel(1);
      
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      const sessionData = await videoApi.startVideoSession(classId, teacherId);
      
      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to start session');
      }

      setSessionState({
        isInitialized: true,
        isJoined: false,
        sessionInfo: sessionData,
        error: null
      });

      await joinChannel(sessionData);

    } catch (error) {
      console.error('❌ Initialization error:', error);
      setSessionState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize video session'
      }));
    }
  };

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;
      
      if (!channel || !token || !appId) {
        throw new Error('Missing required session credentials');
      }
      
      setupAgoraEventListeners();
      
      await clientRef.current.join(appId, channel, token, uid);
      console.log('✅ Successfully joined channel');

      await createAndPublishTracks();

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();
      
      const meetingId = sessionData.meetingId || sessionData.meeting_id;
      if (meetingId) {
        startParticipantTracking(meetingId);
        startChatPolling(meetingId);
      }

    } catch (error) {
      console.error('❌ Join channel error:', error);
      throw error;
    }
  };

  // KEY FIX: Updated createAndPublishTracks using container approach
  const createAndPublishTracks = async () => {
    try {
      // Wait for container to be available
      if (!localContainerRef.current) {
        console.log('[Agora] Waiting for local video container...');
        await new Promise((resolve) => {
          const checkContainer = () => {
            if (localContainerRef.current) {
              resolve();
            } else {
              setTimeout(checkContainer, 100);
            }
          };
          checkContainer();
        });
      }

      console.log('[Agora] Creating local tracks...');

      // Create audio track
      let audioTrack = null;
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        console.log('[Agora] Audio track created');
      } catch (audioError) {
        console.warn('[Agora] Could not create audio track:', audioError);
      }

      // Create video track - FIXED APPROACH
      let videoTrack = null;
      try {
        videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '720p',
          optimizationMode: 'motion'
        });
        
        console.log('[Agora] Video track created:', {
          enabled: videoTrack.isEnabled(),
          isPlaying: videoTrack.isPlaying,
          hasMediaStreamTrack: !!videoTrack.getMediaStreamTrack(),
        });

        // Get camera devices for debugging
        const cameras = await AgoraRTC.getCameras();
        console.log('[Agora] Available cameras:', cameras.map(d => `${d.label || 'Unlabeled'} (${d.deviceId.substring(0, 8)}...)`));

        // Play video into container div
        if (localContainerRef.current) {
          // Ensure container is visible and sized
          localContainerRef.current.style.display = 'block';
          localContainerRef.current.style.width = '100%';
          localContainerRef.current.style.height = '100%';
          localContainerRef.current.style.visibility = 'visible';
          localContainerRef.current.style.opacity = '1';

          console.log('[Agora] Playing local video into container...');
          
          try {
            await videoTrack.play(localContainerRef.current);
            console.log('[Agora] ✅ Video track playing successfully');
            
            // Apply mirror effect for self-view
            const innerVideoEl = localContainerRef.current.querySelector('video');
            if (innerVideoEl) {
              innerVideoEl.style.transform = 'scaleX(-1)';
              innerVideoEl.style.objectFit = 'cover';
              console.log('[Agora] Applied mirror effect to video element');
            }

            // Add track event listeners
            videoTrack.on('track-ended', (evt) => {
              console.warn('[Agora] Video track ended:', evt);
              recreateVideoTrack();
            });

          } catch (playError) {
            console.error('[Agora] ❌ Video play error:', playError);
            
            // Retry after a delay if autoplay policy might be blocking
            if (!initialInteraction) {
              console.log('[Agora] Waiting for user interaction to play video...');
              return; // Will be handled by interaction effect
            }
            
            throw playError;
          }
        }
        
      } catch (videoError) {
        console.warn('[Agora] Could not create video track:', videoError);
        
        // Try alternative approach if main method fails
        if (!initialInteraction) {
          console.log('[Agora] Video may need user interaction. Waiting...');
        }
      }

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Publish tracks
      if (audioTrack || videoTrack) {
        const tracksToPublish = [];
        if (audioTrack) tracksToPublish.push(audioTrack);
        if (videoTrack) tracksToPublish.push(videoTrack);
        
        await clientRef.current.publish(tracksToPublish);
        console.log('[Agora] 📤 Published tracks');
      }

      // Setup device change listeners
      AgoraRTC.onCameraChanged(async (changedDevice) => {
        console.log('[Agora] Camera changed:', changedDevice);
        if (changedDevice.state === 'ACTIVE' && localTracks.video) {
          try {
            await localTracks.video.setDevice(changedDevice.device.deviceId);
            console.log('[Agora] Switched to active camera device');
          } catch (e) {
            console.warn('[Agora] Failed to set active camera device:', e);
            await recreateVideoTrack();
          }
        } else {
          await recreateVideoTrack();
        }
      });

    } catch (error) {
      console.error('[Agora] Error creating/publishing tracks:', error);
    }
  };

  // Handle video playback after user interaction
  useEffect(() => {
    if (initialInteraction && localTracks.video && localContainerRef.current && !localTracks.video.isPlaying) {
      console.log('[Agora] User interacted, attempting to play video...');
      localTracks.video.play(localContainerRef.current).catch(e => {
        console.error('[Agora] Failed to play video after interaction:', e);
      });
    }
  }, [initialInteraction, localTracks.video]);

  // Handle video toggle with container approach
  useEffect(() => {
    const track = localTracks.video;
    const container = localContainerRef.current;
    if (!track || !container) return;

    if (controls.videoEnabled) {
      // Ensure container visible and play if not already
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      
      if (!track.isPlaying) {
        console.log('[Agora] Re-playing local video due to toggle...');
        track.play(container).catch((e) => {
          console.warn('[Agora] Play on toggle failed:', e);
          if (!initialInteraction) {
            console.log('[Agora] Waiting for user interaction...');
          }
        });
      }
      track.setEnabled(true).catch((e) => console.warn('[Agora] setEnabled(true) failed:', e));
    } else {
      // Pause visually but keep track alive
      track.setEnabled(false).catch((e) => console.warn('[Agora] setEnabled(false) failed:', e));
      container.style.display = 'none';
    }
  }, [controls.videoEnabled, localTracks.video, initialInteraction]);

  // Handle audio toggle
  useEffect(() => {
    const track = localTracks.audio;
    if (!track) return;
    if (controls.audioEnabled) {
      track.setEnabled(true).catch((e) => console.warn('[Agora] Audio enable failed:', e));
    } else {
      track.setEnabled(false).catch((e) => console.warn('[Agora] Audio disable failed:', e));
    }
  }, [controls.audioEnabled, localTracks.audio]);

  // Recreate video track function
  const recreateVideoTrack = async () => {
    try {
      console.log('[Agora] Recreating camera video track...');
      const newTrack = await AgoraRTC.createCameraVideoTrack();
      
      // Replace published track
      if (localTracks.video) {
        await clientRef.current.unpublish([localTracks.video]).catch(() => {});
        localTracks.video.stop();
        localTracks.video.close();
      }
      
      // Update state
      setLocalTracks(prev => ({ ...prev, video: newTrack }));
      
      // Play in container
      if (localContainerRef.current) {
        await newTrack.play(localContainerRef.current);
        
        // Apply mirror effect
        const innerVideoEl = localContainerRef.current.querySelector('video');
        if (innerVideoEl) {
          innerVideoEl.style.transform = 'scaleX(-1)';
          innerVideoEl.style.objectFit = 'cover';
        }
        
        await clientRef.current.publish([newTrack]);
        console.log('[Agora] Recreated and published camera video track');
      }
    } catch (e) {
      console.error('[Agora] Failed to recreate video track:', e);
    }
  };

  // ============================================
  // Event Listeners
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    client.on('user-published', async (user, mediaType) => {
      console.log('[Agora] User published:', user.uid, mediaType);
      
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
  // Control Functions (updated for container approach)
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      try {
        const newState = !controls.audioEnabled;
        await localTracks.audio.setEnabled(newState);
        setControls(prev => ({ ...prev, audioEnabled: newState }));
        console.log(`[Agora] Audio ${newState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('[Agora] Toggle audio error:', error);
      }
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      try {
        const newState = !controls.videoEnabled;
        setControls(prev => ({ ...prev, videoEnabled: newState }));
        console.log(`[Agora] Video ${newState ? 'enabled' : 'disabled'}`);
        
        // The actual toggle is handled by the useEffect above
      } catch (error) {
        console.error('[Agora] Toggle video error:', error);
      }
    } else {
      // Try to create video track if not available
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish([videoTrack]);
        
        // Play in container
        if (localContainerRef.current) {
          videoTrack.play(localContainerRef.current);
          
          // Apply mirror effect
          const innerVideoEl = localContainerRef.current.querySelector('video');
          if (innerVideoEl) {
            innerVideoEl.style.transform = 'scaleX(-1)';
            innerVideoEl.style.objectFit = 'cover';
          }
        }
        
        setLocalTracks(prev => ({ ...prev, video: videoTrack }));
        setControls(prev => ({ ...prev, videoEnabled: true }));
        console.log('[Agora] Video enabled');
      } catch (error) {
        console.error('[Agora] Cannot access camera:', error);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!controls.screenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1',
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
        
        if (localContainerRef.current) {
          screenTrack.play(localContainerRef.current);
        }
        
        setControls(prev => ({ ...prev, screenSharing: true }));
        console.log('[Agora] Screen sharing started');
        
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
          
          if (localContainerRef.current) {
            cameraTrack.play(localContainerRef.current);
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
          
          console.log('[Agora] Screen sharing stopped, camera restored');
        } catch (cameraError) {
          console.error('[Agora] Cannot access camera:', cameraError);
          setControls(prev => ({ 
            ...prev, 
            videoEnabled: false,
            screenSharing: false 
          }));
        }
      }
    } catch (error) {
      console.error('[Agora] Screen share error:', error);
      setControls(prev => ({ ...prev, screenSharing: false }));
    }
  };

  const toggleRecording = async () => {
    try {
      const newState = !controls.recording; 
      if (newState) { 
        await videoApi.startRecording(sessionState.sessionInfo.meetingId);
        console.log('[Agora] Recording started');
      } else {
        await videoApi.stopRecording(sessionState.sessionInfo.meetingId);
        console.log('[Agora] Recording stopped');
      }
      setControls(prev => ({ ...prev, recording: newState }));
    } catch (error) {
      console.error('[Agora] Toggle recording error:', error);
    } 
  };

  const leaveSession = async () => {
    try {
      setIsLeaving(true); 
      await cleanup();
      setIsLeaving(false);
      if (onEndCall) onEndCall(false); 
    } catch (error) {
      console.error('[Agora] Leave session error:', error);
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
      console.error('[Agora] End session error:', error);
      setIsEnding(false);
    }
  };

  // ============================================
  // Chat Functions
  // ============================================

  const sendMessage = async () => {
    const messageText = newMessage.trim();
    if (!messageText || !sessionState.sessionInfo?.meetingId) return;
    
    try {
      const tempMessage = {
        id: Date.now().toString(),
        meetingId: sessionState.sessionInfo.meetingId,
        senderId: teacherId,
        senderName: 'Teacher',
        text: messageText,
        timestamp: new Date().toISOString(),
        isOwn: true,
        status: 'sending'
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      scrollToBottom();
      
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, status: 'sent' }
            : msg
        ));
        
        simulateStudentResponse(messageText);
      }, 500);
      
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...msg, status: 'failed' }
          : msg
      ));
    }
  };

  const simulateStudentResponse = (teacherMessage) => {
    const responses = {
      greeting: ["Hello Teacher!", "Hi!", "Good morning!", "Ready to learn!"],
      question: ["Yes, I understand", "Could you explain more?", "I have a question about that"],
      generic: ["Thank you", "Got it", "Understood", "Interesting!"]
    };
    
    const lowerMessage = teacherMessage.toLowerCase();
    let responseType = 'generic';
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      responseType = 'greeting';
    } else if (lowerMessage.includes('?') || lowerMessage.includes('understand')) {
      responseType = 'question';
    }
    
    const randomResponse = responses[responseType][
      Math.floor(Math.random() * responses[responseType].length)
    ];
    
    setTimeout(() => {
      const studentMessage = {
        id: Date.now().toString(),
        meetingId: sessionState.sessionInfo.meetingId,
        senderId: 'student_' + Math.floor(Math.random() * 1000),
        senderName: 'Student',
        text: randomResponse,
        timestamp: new Date().toISOString(),
        isOwn: false
      };
      
      setMessages(prev => [...prev, studentMessage]);
      scrollToBottom();
    }, 1000 + Math.random() * 2000);
  };

  const startChatPolling = (meetingId) => {
    console.log('[Chat] Polling chat messages...');
    const interval = setInterval(() => {}, 5000);
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

  const getSenderName = (message) => {
    if (message.isOwn) return 'You';
    return message.senderName || 'Student';
  };

  // ============================================
  // Helper Functions
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

  const startParticipantTracking = (meetingId) => {
    if (participantUpdateIntervalRef.current) {
      clearInterval(participantUpdateIntervalRef.current);
    }
    
    const fetchParticipants = async () => {
      try {
        const participants = await videoApi.getSessionParticipants(meetingId);
        setParticipants(participants || []);
        setStats(prev => ({ 
          ...prev, 
          participantCount: (clientRef.current?.remoteUsers?.length || 0) + 1 
        }));
      } catch (error) {
        console.error('[Agora] Participant tracking error:', error);
      }
    };
    
    fetchParticipants();
    participantUpdateIntervalRef.current = setInterval(fetchParticipants, 5000);
  };

  const updateParticipantCount = () => {
    const remoteUsers = clientRef.current?.remoteUsers || [];
    setStats(prev => ({
      ...prev,
      participantCount: remoteUsers.length + 1
    }));
  };

  const cleanup = async () => {
    console.log('[Agora] Cleaning up...');
    
    // Clear intervals
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (participantUpdateIntervalRef.current) clearInterval(participantUpdateIntervalRef.current);
    
    // Stop and close local tracks
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
      console.warn('[Agora] Cleanup warning:', e);
    }
    
    // Leave channel
    if (clientRef.current) {
      await clientRef.current.leave();
    }
    
    // Clear remote users
    Object.values(remoteUsersRef.current).forEach(userData => {
      if (userData.container) {
        userData.container.remove();
      }
    });
    remoteUsersRef.current = {};
    
    // Reset state
    setLocalTracks({ audio: null, video: null });
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render chat message
  const renderMessage = (msg) => (
    <div 
      key={msg.id} 
      className={`message-wrapper ${msg.isOwn ? 'own-message' : 'other-message'}`}
    >
      <div className="message-content">
        {!msg.isOwn && (
          <div className="message-sender">
            {getSenderName(msg)}
          </div>
        )}
        
        <div className={`message-bubble ${msg.status === 'failed' ? 'failed' : ''}`}>
          <div className="message-text">
            {msg.text}
          </div>
          
          <div className="message-footer">
            <span className="message-time">
              {formatTime(msg.timestamp)}
            </span>
            
            {msg.isOwn && (
              <span className="message-status">
                {msg.status === 'sending' && '🔄'}
                {msg.status === 'sent' && '✓'}
                {msg.status === 'failed' && '✗'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // Render - Updated for container approach
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
          <p>Connecting to video session...</p>
          <small>Please wait while we set up your call</small>
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

      {/* Main Video Area - Full Screen */}
      <div className="video-main-area">
        {/* Local Video - Updated for container approach */}
        <div className="local-video-container floating-video">
          <div className="video-wrapper">
            {/* KEY FIX: Use container div instead of video element */}
            <div
              ref={localContainerRef}
              id="local-video-container"
              className="video-container"
              style={{ display: controls.videoEnabled ? 'block' : 'none' }}
              aria-label="Local video container"
            />
            
            {!controls.videoEnabled && (
              <div className="video-placeholder">
                <div className="user-avatar">
                  <span>YOU</span>
                </div>
              </div>
            )}
            
            {/* Video Status Overlay */}
            <div className="video-status-overlay">
              {!controls.videoEnabled && <span className="status-tag">🎤 Audio Only</span>}
              {controls.screenSharing && <span className="status-tag">🖥️ Screen Sharing</span>}
              <span className="name-tag">Host</span>
            </div>
          </div>
        </div>

        {/* Remote Videos Grid */}
        <div className="remote-videos-grid">
          {/* Remote videos are added dynamically here */}
        </div>
      </div>

      {/* Floating Control Center - Auto-hide */}
      <div className={`floating-controls ${showControls ? 'visible' : 'hidden'}`}>
        <div className="control-center">
          {/* Primary Controls - Compact Circle */}
          <div className="primary-controls">
            <button 
              className={`control-orb audio-orb ${controls.audioEnabled ? 'active' : 'muted'}`}
              onClick={toggleAudio}
              title={controls.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              <span className="orb-icon">
                {controls.audioEnabled ? '🎤' : '🔇'}
              </span>
              <span className="orb-tooltip">
                {controls.audioEnabled ? 'Mute' : 'Unmute'}
              </span>
            </button>

            <button 
              className={`control-orb video-orb ${controls.videoEnabled ? 'active' : 'inactive'}`}
              onClick={toggleVideo}
              title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <span className="orb-icon">
                {controls.videoEnabled ? '📹' : '📷'}
              </span>
              <span className="orb-tooltip">
                {controls.videoEnabled ? 'Stop Video' : 'Start Video'}
              </span>
            </button>

            {/* Screen Share */}
            <button 
              className={`control-orb screen-orb ${controls.screenSharing ? 'active' : ''}`}
              onClick={toggleScreenShare}
              title={controls.screenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <span className="orb-icon">
                {controls.screenSharing ? '🖥️' : '📱'}
              </span>
              <span className="orb-tooltip">
                {controls.screenSharing ? 'Stop Share' : 'Share Screen'}
              </span>
            </button>

            {/* Recording */}
            <button 
              className={`control-orb record-orb ${controls.recording ? 'recording' : ''}`}
              onClick={toggleRecording}
              title={controls.recording ? 'Stop recording' : 'Start recording'}
            >
              <span className="orb-icon">
                ⏺️
              </span>
              <span className="orb-tooltip">
                {controls.recording ? 'Stop Record' : 'Record'}
              </span>
              {controls.recording && <div className="pulse-ring"></div>}
            </button>
          </div>

          {/* Secondary Controls - Bottom Row */}
          <div className="secondary-controls">
            {/* Chat */}
            <button 
              className={`control-button chat-btn ${controls.isChatOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: !prev.isChatOpen }))}
              title="Toggle chat"
            >
              <span className="btn-icon">💬</span>
              {messages.length > 0 && (
                <span className="message-count-badge">{messages.length}</span>
              )}
            </button>

            {/* Participants */}
            <button 
              className={`control-button participants-btn ${controls.isParticipantsOpen ? 'active' : ''}`}
              onClick={() => setControls(prev => ({ ...prev, isParticipantsOpen: !prev.isParticipantsOpen }))}
              title="Show participants"
            >
              <span className="btn-icon">👥</span>
              <span className="participant-count">{participants.length}</span>
            </button>

            {/* Leave & End Buttons */}
            <div className="action-buttons">
              <button 
                className="control-button leave-btn"
                onClick={leaveSession}
                disabled={isLeaving}
                title="Leave the call (others can continue)"
              >
                <span className="btn-icon">🚪</span>
                <span className="btn-text">{isLeaving ? '...' : 'Leave'}</span>
              </button>

              <button 
                className="control-button end-btn"
                onClick={endSession}
                disabled={isEnding}
                title="End call for everyone"
              >
                <span className="btn-icon">⏹️</span>
                <span className="btn-text">{isEnding ? '...' : 'End'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Chat Panel */}
      {controls.isChatOpen && (
        <div className="minimal-chat-panel">
          <div className="chat-header">
            <h3>Chat ({messages.length})</h3>
            <button 
              className="close-chat"
              onClick={() => setControls(prev => ({ ...prev, isChatOpen: false }))}
            >
              ✕
            </button>
          </div>
          
          <div className="chat-messages" ref={chatContainerRef}>
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="empty-icon">💭</div>
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
              maxLength={500}
            />
            <button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="send-btn-mini"
            >
              ↑
            </button>
          </div>
        </div>
      )}
      
      {/* Autoplay Hint */}
      {!initialInteraction && (
        <div className="autoplay-hint">
          <p>Click anywhere to allow video playback (browser autoplay policy).</p>
        </div>
      )}
      
      {/* Show Controls Hint */}
      {!showControls && !initialInteraction && (
        <div className="controls-hint">
          Move mouse to show controls
        </div>
      )}
      
      {/* Debug Info (optional, can be removed in production) */}
      <div className="debug-info">
        <small>Video: {controls.videoEnabled ? 'ON' : 'OFF'} | Audio: {controls.audioEnabled ? 'ON' : 'OFF'} | Joined: {sessionState.isJoined ? 'Yes' : 'No'}</small>
      </div>
    </div>
  );
};

export default TeacherVideoCall;