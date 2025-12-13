// ============================================
// COMPLETE FIXED TeacherVideoCall.js
// With correct function declaration order
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './TeacherVideoCall.css';
import videoApi from '../lib/agora/videoApi';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  Share2, X, 
  Circle, Square, 
  MessageCircle, Users, 
  LogOut, PhoneOff, 
  Send, MessageSquare 
} from 'lucide-react';

const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

const TeacherVideoCall = ({ classId, teacherId, onEndCall }) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [sessionState, setSessionState] = useState({
    isInitialized: false,
    isJoined: false,
    sessionInfo: null,
    error: null
  });

  const [participants, setParticipants] = useState([]);
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  
  // ✅ ADD THIS: Remote users state
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

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [initialInteraction, setInitialInteraction] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // ============================================
  // REFS
  // ============================================
  
  const clientRef = useRef(null);
  const screenClientRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantUpdateIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteUsersRef = useRef(new Map());
  const controlsTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const videoApiRef = useRef(videoApi);

  // ============================================
  // HELPER FUNCTIONS (Declare first!)
  // ============================================

  const updateParticipantCount = () => {
    const remoteUserCount = clientRef.current?.remoteUsers?.length || 0;
    const totalCount = remoteUserCount + 1;
    
    console.log('👥 TEACHER: Participant count:', {
      remote: remoteUserCount,
      total: totalCount,
      remoteUIDs: clientRef.current?.remoteUsers?.map(u => u.uid)
    });
    
    setStats(prev => ({
      ...prev,
      participantCount: totalCount
    }));
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }, 100);
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

  // ============================================
  // AGORA EVENT LISTENERS (Declare before use!)
  // ============================================

  const setupAgoraEventListeners = () => {
    const client = clientRef.current;

    if (!client) {
      console.error('❌ Client not initialized');
      return;
    }

    console.log('👂 TEACHER: Setting up event listeners...');

    // User Published
    client.on('user-published', async (user, mediaType) => {
      console.log('👤 TEACHER: User published:', {
        uid: user.uid,
        mediaType,
        timestamp: new Date().toISOString()
      });
      
      try {
        await client.subscribe(user, mediaType);
        console.log('✅ TEACHER: Subscribed to user:', user.uid, mediaType);
        
        if (mediaType === 'video') {
          setRemoteUsers(prev => {
            const updated = new Map(prev);
            const existing = updated.get(user.uid) || { uid: user.uid };
            existing.videoTrack = user.videoTrack;
            updated.set(user.uid, existing);
            console.log('📊 Remote users count:', updated.size);
            return updated;
          });
          
          setTimeout(() => {
            const videoElement = document.getElementById(`remote-${user.uid}`);
            if (videoElement && user.videoTrack) {
              console.log('▶️ Playing video for:', user.uid);
              user.videoTrack.play(videoElement);
            }
          }, 100);
        }
        
        if (mediaType === 'audio') {
          setRemoteUsers(prev => {
            const updated = new Map(prev);
            const existing = updated.get(user.uid) || { uid: user.uid };
            existing.audioTrack = user.audioTrack;
            updated.set(user.uid, existing);
            return updated;
          });
          
          if (user.audioTrack) {
            user.audioTrack.play();
            console.log('🔊 Playing audio for:', user.uid);
          }
        }
        
        updateParticipantCount();
        
      } catch (error) {
        console.error('❌ Subscribe error:', error);
      }
    });

    // User Unpublished
    client.on('user-unpublished', (user, mediaType) => {
      console.log('👤 TEACHER: User unpublished:', user.uid, mediaType);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => {
          const updated = new Map(prev);
          const existing = updated.get(user.uid);
          if (existing) {
            existing.videoTrack = null;
            updated.set(user.uid, existing);
          }
          return updated;
        });
      }
      
      updateParticipantCount();
    });

    // User Left
    client.on('user-left', (user) => {
      console.log('👤 TEACHER: User left:', user.uid);
      
      setRemoteUsers(prev => {
        const updated = new Map(prev);
        updated.delete(user.uid);
        console.log('📊 Remaining users:', updated.size);
        return updated;
      });
      
      updateParticipantCount();
    });

    // Connection State
    client.on('connection-state-change', (curState, prevState, reason) => {
      console.log('🔗 Connection state:', curState, reason);
    });

    // Network Quality
    client.on('network-quality', (quality) => {
      const qualityMap = {
        0: 'unknown', 1: 'excellent', 2: 'good', 
        3: 'poor', 4: 'poor', 5: 'poor', 6: 'poor'
      };

      setStats(prev => ({
        ...prev,
        connectionQuality: qualityMap[quality.uplinkNetworkQuality] || 'unknown'
      }));
    });

    console.log('✅ TEACHER: Event listeners configured');
  };

  // ============================================
  // TRACK FUNCTIONS
  // ============================================

  const createAndPublishTracks = async () => {
    try {
      console.log('🎥 TEACHER: Creating tracks...');

      let audioTrack = null;
      let videoTrack = null;
      
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        console.log('✅ Audio track created');
      } catch (audioError) {
        console.warn('⚠️ Audio track failed:', audioError);
      }
      
      try {
        videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '480p',
          optimizationMode: 'motion'
        });
        console.log('✅ Video track created');
      } catch (videoError) {
        console.warn('⚠️ Video track failed:', videoError);
      }

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);
      
      if (tracksToPublish.length > 0) {
        await clientRef.current.publish(tracksToPublish);
        console.log(`✅ Published ${tracksToPublish.length} track(s)`);
      }

      if (videoTrack && localVideoRef.current) {
        try {
          await videoTrack.play(localVideoRef.current);
          if (localVideoRef.current) {
            localVideoRef.current.style.transform = 'scaleX(-1)';
          }
        } catch (playError) {
          console.warn('⚠️ Video play error');
        }
      }

    } catch (error) {
      console.error('❌ Track creation error:', error);
    }
  };

  // ============================================
  // CHANNEL JOIN
  // ============================================

  const joinChannel = async (sessionData) => {
    try {
      const { channel, token, uid, appId } = sessionData;
      
      console.log('🔗 TEACHER: Joining channel:', {
        channel,
        uid,
        appId: appId?.substring(0, 8) + '...',
        tokenLength: token?.length
      });

      if (!token || token === 'demo_token' || token === 'null') {
        throw new Error('Invalid token');
      }

      const joinedUid = await clientRef.current.join(
        appId,
        channel,
        token,
        uid || null
      );
      
      console.log('✅ TEACHER: Joined channel:', {
        channel,
        assignedUid: joinedUid
      });
      
      await createAndPublishTracks();

      setSessionState(prev => ({
        ...prev,
        isJoined: true
      }));

      startDurationTracking();
      setupAgoraEventListeners();

    } catch (error) {
      console.error('❌ Join error:', error);
      throw error;
    }
  };

  // ============================================
  // INITIALIZATION
  // ============================================

  const initializeSession = async () => {
    if (isConnecting) return;
    
    try {
      setIsConnecting(true);
      console.log('🚀 TEACHER: Starting session');
      
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      const sessionData = await videoApi.startVideoSession(classId, teacherId);
      
      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to start session');
      }

      console.log('✅ Session data received:', {
        meetingId: sessionData.meetingId,
        channel: sessionData.channel,
        hasToken: !!sessionData.token
      });

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
        error: error.message
      }));
    } finally {
      setIsConnecting(false);
    }
  };

  // ============================================
  // CLEANUP
  // ============================================

  const cleanup = async () => {
    console.log('🧹 TEACHER: Cleaning up...');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    if (participantUpdateIntervalRef.current) {
      clearInterval(participantUpdateIntervalRef.current);
    }
    
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
    
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (e) {}
    }
    
    setLocalTracks({ audio: null, video: null });
    setRemoteUsers(new Map());
    setSessionState({
      isInitialized: false,
      isJoined: false,
      sessionInfo: null,
      error: null
    });
  };

  // ============================================
  // CONTROL FUNCTIONS
  // ============================================

  const toggleAudio = async () => {
    if (localTracks.audio) {
      try {
        const newState = !controls.audioEnabled;
        await localTracks.audio.setEnabled(newState);
        setControls(prev => ({ ...prev, audioEnabled: newState }));
      } catch (error) {
        console.error('Toggle audio error:', error);
      }
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      try {
        const newState = !controls.videoEnabled;
        setControls(prev => ({ ...prev, videoEnabled: newState }));
      } catch (error) {
        console.error('Toggle video error:', error);
      }
    }
  };

  const toggleScreenShare = async () => {
    // Screen share logic here
  };

  const toggleRecording = async () => {
    // Recording logic here
  };

  const leaveSession = async () => {
    try {
      setIsLeaving(true);
      await cleanup();
      setIsLeaving(false);
      if (onEndCall) onEndCall(false);
    } catch (error) {
      console.error('Leave error:', error);
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
      console.error('End error:', error);
      setIsEnding(false);
    }
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
  };

  // ============================================
  // USE EFFECTS (After all functions declared!)
  // ============================================

  useEffect(() => {
    initializeSession();
    return () => {
      cleanup();
    };
  }, [classId, teacherId]);

  useEffect(() => {
    const track = localTracks.video;
    if (!track) return;
    
    if (controls.videoEnabled) {
      track.setEnabled(true);
    } else {
      track.setEnabled(false);
    }
  }, [controls.videoEnabled, localTracks.video]);

  useEffect(() => {
    const track = localTracks.audio;
    if (!track) return;
    track.setEnabled(controls.audioEnabled);
  }, [controls.audioEnabled, localTracks.audio]);

  // Monitor remote users
  useEffect(() => {
    console.log('👥 TEACHER: Remote users updated:', {
      count: remoteUsers.size,
      uids: Array.from(remoteUsers.keys())
    });
  }, [remoteUsers]);

  // ============================================
  // RENDER
  // ============================================

  const renderMessage = (msg) => (
    <div 
      key={msg.id} 
      className={`message-wrapper ${msg.isOwn ? 'own-message' : 'other-message'}`}
    >
      <div className="message-content">
        {!msg.isOwn && (
          <div className="message-sender">{msg.senderName}</div>
        )}
        <div className="message-bubble">
          <div className="message-text">{msg.text}</div>
          <div className="message-footer">
            <span className="message-time">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  );

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
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container futuristic-theme">
      {/* Header */}
      <div className={`call-header ${showControls ? 'visible' : 'hidden'}`}>
        <div className="header-left">
          <div className="session-info">
            <h2>{sessionState.sessionInfo?.session?.class_title || 'Video Class'}</h2>
            <div className="header-stats">
              <span className="stat-chip">⏱️ {formatDuration(stats.duration)}</span>
              <span className="stat-chip">👥 {stats.participantCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="video-main-area">
        {/* Local Video */}
        <div className="local-video-container floating-video">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: controls.videoEnabled ? 'block' : 'none',
              transform: 'scaleX(-1)'
            }}
          />
          {!controls.videoEnabled && (
            <div className="video-placeholder">
              <div className="user-avatar">YOU</div>
            </div>
          )}
        </div>

        {/* Remote Videos Grid */}
        <div className="remote-videos-grid">
          {Array.from(remoteUsers.entries()).map(([uid, user]) => (
            <div key={uid} className="remote-video-item">
              <div 
                id={`remote-${uid}`}
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#1a1a2e'
                }}
              />
              {!user.videoTrack && (
                <div className="video-placeholder">
                  <div className="user-avatar">🎓</div>
                  <p>Student {uid}</p>
                </div>
              )}
              <div className="video-status-overlay">
                <span>Student {uid}</span>
              </div>
            </div>
          ))}
          
          {remoteUsers.size === 0 && (
            <div className="empty-state">
              <h3>Waiting for students...</h3>
              <p>Students will appear here when they join</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={`floating-controls ${showControls ? 'visible' : 'hidden'}`}>
        <div className="control-center">
          <div className="primary-controls">
            <button 
              className={`control-orb ${controls.audioEnabled ? 'active' : 'muted'}`}
              onClick={toggleAudio}
            >
              {controls.audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button 
              className={`control-orb ${controls.videoEnabled ? 'active' : 'inactive'}`}
              onClick={toggleVideo}
            >
              {controls.videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>

          <div className="secondary-controls">
            <button className="control-button leave-btn" onClick={leaveSession}>
              <LogOut size={18} />
              <span>Leave</span>
            </button>

            <button className="control-button end-btn" onClick={endSession}>
              <PhoneOff size={18} />
              <span>End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherVideoCall;