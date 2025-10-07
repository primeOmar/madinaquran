// components/VideoCall.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, Users,
  MessageCircle, Settings, ScreenShare, Monitor,
  UserPlus, MoreVertical, Crown, Mic2, UserX,
  MessageSquare, MonitorOff, Share2, Grid3X3,
  Airplay, Cast, Zap, Satellite, Wifi, Radio,
  X, Maximize2, Minimize2, Volume2, VolumeX, User
} from 'lucide-react';
import { toast } from 'react-toastify';

// ✅ Import the production-ready Agora hook
import useAgoraProduction from '../hooks/useAgoraProduction';

// ✅ Import video API
import videoApi from '../lib/videoApi';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
  // State management
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoQuality, setVideoQuality] = useState('720p');
  const [layout, setLayout] = useState('grid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [agoraConfig, setAgoraConfig] = useState(null);

  // Refs
  const localPlayerRef = useRef(null);
  const remotePlayersRef = useRef({});
  const screenTrackRef = useRef(null);
  const containerRef = useRef(null);

  // ✅ Use the production-ready Agora hook with proper appId handling
  const {
    isConnected,
    isConnecting,
    connectionError,
    joinChannel,
    leaveChannel,
    retryConnection,
    service
  } = useAgoraProduction({
    appId: agoraConfig?.appId, // ✅ Pass appId directly to hook
    onError: (error) => {
      console.error('Agora connection error:', error);
      setError(error.userMessage || error.message);
      toast.error(`Connection error: ${error.userMessage}`);
    },
    onJoined: (data) => {
      console.log('✅ Successfully joined channel:', data);
      setIsLoading(false);
      initializeLocalTracks();
      toast.success('Connected to video call!');
    },
    onLeft: () => {
      console.log('🔚 Left channel');
      handleCleanup();
      onLeave();
    },
    onConnectionStateChange: (state) => {
      console.log('Connection state:', state);
    }
  });

  // ✅ Initialize Agora connection
  useEffect(() => {
    const initVideoCall = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🚀 Starting Agora initialization...');

        // ✅ Validate required props
        if (!meetingId || !user?.id) {
          throw new Error('Meeting ID and User ID are required');
        }

        // ✅ GET TOKEN WITH PROPER ERROR HANDLING
        console.log('🔐 Requesting Agora token...');
        const tokenData = await videoApi.generateAgoraToken(meetingId, user.id);
        console.log('✅ Token data received:', tokenData);

        // ✅ CRITICAL: Validate appId exists and is not empty
        const appId = tokenData.appId;
        if (!appId) {
          console.error('❌ Agora App ID is missing:', tokenData);
          throw new Error('Agora App ID is required but was not provided. Please check your server configuration.');
        }

        if (appId === '""' || appId === "''" || appId.trim() === '') {
          console.error('❌ Agora App ID is empty string:', tokenData);
          throw new Error('Agora App ID is empty. Please check your environment variables.');
        }

        console.log('🔧 Using App ID:', appId);
        console.log('🔑 Token available:', !!tokenData.token);
        console.log('🎯 Channel:', meetingId);
        console.log('👤 User ID:', user.id);

        // Store Agora configuration
        setAgoraConfig({
          appId,
          token: tokenData.token,
          channel: meetingId,
          uid: user.id
        });

        // Check if we're in fallback mode
        if (tokenData.isFallback) {
          setIsFallbackMode(true);
          console.log('⚠️ Using fallback/development mode');
        }

      } catch (error) {
        console.error('❌ Error initializing video call:', error);
        const errorMsg = error.message || 'Failed to join video call';
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
      }
    };

    if (meetingId && user) {
      initVideoCall();
    }

    return () => {
      handleCleanup();
    };
  }, [meetingId, user]);

  // ✅ Join channel when Agora config is ready
  useEffect(() => {
    const joinAgoraChannel = async () => {
      if (!agoraConfig) return;

      try {
        console.log('🔗 Joining Agora channel with config:', {
          appId: agoraConfig.appId ? '***' + agoraConfig.appId.slice(-4) : 'undefined',
          channel: agoraConfig.channel,
          uid: agoraConfig.uid
        });

        const success = await joinChannel(
          agoraConfig.channel,
          agoraConfig.token,
          agoraConfig.uid
        );
        
        if (!success) {
          throw new Error('Failed to join channel - joinChannel returned false');
        }

        console.log('✅ Channel join initiated successfully');

      } catch (error) {
        console.error('❌ Error joining Agora channel:', error);
        setError(error.message);
        toast.error(`Failed to join: ${error.message}`);
        setIsLoading(false);
      }
    };

    joinAgoraChannel();
  }, [agoraConfig, joinChannel]);

  // ✅ Setup Agora event listeners
  const setupAgoraEvents = useCallback(() => {
    if (!service?.client) {
      console.log('⏳ Agora client not ready yet, waiting...');
      return;
    }

    console.log('🎧 Setting up Agora event listeners');

    const handleUserPublished = async (user, mediaType) => {
      try {
        console.log('📹 User published:', user.uid, mediaType);
        await service.client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          setRemoteUsers(prev => {
            const exists = prev.find(u => u.uid === user.uid);
            if (!exists) return [...prev, user];
            return prev;
          });
        }

        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      } catch (subscribeError) {
        console.error('Subscribe error:', subscribeError);
      }
    };

    const handleUserUnpublished = (user) => {
      console.log('📹 User unpublished:', user.uid);
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    };

    const handleUserJoined = (user) => {
      console.log('👤 User joined:', user.uid);
      const newParticipant = {
        uid: user.uid,
        name: `Student ${user.uid}`,
        role: 'student',
        joinedAt: new Date()
      };
      setParticipants(prev => [...prev, newParticipant]);
      toast.info('New student joined the class');
    };

    const handleUserLeft = (user) => {
      console.log('👤 User left:', user.uid);
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      setParticipants(prev => prev.filter(p => p.uid !== user.uid));
      toast.info('Student left the class');
    };

    // Add event listeners
    service.client.on('user-published', handleUserPublished);
    service.client.on('user-unpublished', handleUserUnpublished);
    service.client.on('user-joined', handleUserJoined);
    service.client.on('user-left', handleUserLeft);
    service.client.on('connection-state-change', (state) => {
      console.log('🔗 Connection state changed:', state);
    });

    // Return cleanup function
    return () => {
      if (service?.client) {
        service.client.off('user-published', handleUserPublished);
        service.client.off('user-unpublished', handleUserUnpublished);
        service.client.off('user-joined', handleUserJoined);
        service.client.off('user-left', handleUserLeft);
      }
    };
  }, [service]);

  // ✅ Setup events when service is available
  useEffect(() => {
    if (service?.client) {
      const cleanup = setupAgoraEvents();
      return cleanup;
    }
  }, [service, setupAgoraEvents]);

  // ✅ Initialize local media tracks
  const initializeLocalTracks = async () => {
    try {
      console.log('🎬 Initializing local media tracks...');
      
      // Dynamic import for code splitting
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      
      // Check permissions first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (permissionError) {
        throw new Error('Camera/microphone access denied. Please check your permissions.');
      }

      // Create audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      setLocalAudioTrack(audioTrack);
      
      // Create video track
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      setLocalVideoTrack(videoTrack);
      
      // Play local video
      if (localPlayerRef.current) {
        videoTrack.play(localPlayerRef.current);
      }

      // Publish tracks if client is available and connected
      if (service?.client && isConnected) {
        console.log('📤 Publishing local tracks...');
        await service.client.publish([audioTrack, videoTrack]);
        console.log('✅ Local tracks published successfully');
      }
      
    } catch (error) {
      console.error('Failed to initialize media tracks:', error);
      toast.error('Could not access camera/microphone');
    }
  };

  // ✅ Cleanup function
  const handleCleanup = useCallback(() => {
    console.log('🧹 Cleaning up video call resources...');
    
    // Close local tracks
    if (localAudioTrack) {
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }
    if (localVideoTrack) {
      localVideoTrack.close();
      setLocalVideoTrack(null);
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.close();
      screenTrackRef.current = null;
    }

    // Clear remote players
    remotePlayersRef.current = {};
  }, [localAudioTrack, localVideoTrack]);

  // ✅ Debug component state
  useEffect(() => {
    console.log('🔍 VideoCall State:', {
      isLoading,
      isConnected,
      isConnecting,
      error,
      agoraConfig: agoraConfig ? {
        appId: agoraConfig.appId ? '***' + agoraConfig.appId.slice(-4) : 'undefined',
        channel: agoraConfig.channel,
        hasToken: !!agoraConfig.token
      } : 'null',
      remoteUsers: remoteUsers.length,
      participants: participants.length
    });
  }, [isLoading, isConnected, isConnecting, error, agoraConfig, remoteUsers, participants]);

  // Rest of the component functions remain the same...
  const handleEndSession = async () => {
    if (!isTeacher) return;
    
    try {
      const confirmEnd = window.confirm(
        'Are you sure you want to end this class session? All students will be disconnected.'
      );
      
      if (!confirmEnd) return;

      await videoApi.endVideoSession(meetingId);
      
      if (onSessionEnded) {
        onSessionEnded();
      }
      
      await handleLeave();
      
      toast.success('Class session ended successfully!');
      
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session. Please try again.');
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
      toast.info(isAudioMuted ? 'Microphone on' : 'Microphone muted');
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
      toast.info(isVideoMuted ? 'Video on' : 'Video off');
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1'
        });
        
        await service.client.unpublish(localVideoTrack);
        await service.client.publish(screenTrack);
        
        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);
        toast.success('Screen sharing started');

        screenTrack.on('track-ended', () => {
          toggleScreenShare();
        });
      } else {
        await service.client.unpublish(screenTrackRef.current);
        await service.client.publish(localVideoTrack);
        
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        setIsScreenSharing(false);
        toast.info('Screen sharing stopped');
      }
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to share screen');
    }
  };

  const muteUser = async (userId) => {
    if (!isTeacher) return;
    toast.info(`Muted student ${userId}`);
  };

  const removeUser = async (userId) => {
    if (!isTeacher) return;
    toast.info(`Removed student ${userId}`);
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/join-class/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Class link copied to clipboard!');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleLeave = async () => {
    try {
      handleCleanup();
      await leaveChannel();
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  };

  const handleRetryConnection = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      const tokenData = await videoApi.generateAgoraToken(meetingId, user.id);
      const success = await retryConnection(meetingId, tokenData.token, user.id);
      
      if (success) {
        toast.success('Reconnected successfully!');
      }
    } catch (error) {
      console.error('Retry failed:', error);
      setError(error.message);
    }
  };

  // Render video players based on layout
  const renderVideoPlayers = () => {
    const allUsers = [
      { 
        uid: 'local', 
        videoTrack: localVideoTrack, 
        audioTrack: localAudioTrack,
        name: `${user.name} (You)`,
        role: isTeacher ? 'teacher' : 'student'
      },
      ...remoteUsers
    ];

    // ... (render logic remains the same as before)
    if (layout === 'spotlight') {
      // ... spotlight layout
    }

    // Grid layout (default)
    return (
      <div className={`grid gap-4 flex-1 ${
        allUsers.length <= 4 ? 'grid-cols-2' : 
        allUsers.length <= 9 ? 'grid-cols-3' : 'grid-cols-4'
      } auto-rows-fr`}>
        {allUsers.map(user => (
          <div 
            key={user.uid} 
            className={`bg-gray-800 rounded-xl relative min-h-[200px] ${
              user.uid === 'local' ? 'ring-2 ring-blue-500' : ''
            } ${isTeacher && user.role === 'teacher' ? 'ring-2 ring-yellow-400' : ''}`}
          >
            <div 
              ref={user.uid === 'local' ? localPlayerRef : (el => {
                if (el && user.uid !== 'local') {
                  remotePlayersRef.current[user.uid] = el;
                  user.videoTrack?.play(el);
                }
              })}
              className="w-full h-full rounded-xl bg-gray-700"
            />
            
            {/* Fallback when video is off */}
            {(!user.videoTrack || (user.uid === 'local' && isVideoMuted)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700 rounded-xl">
                <div className="text-center">
                  <User size={32} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-300 text-sm">{user.name}</p>
                </div>
              </div>
            )}
            
            {/* User info overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
              <div className="bg-black/70 text-white px-3 py-1 rounded-lg text-sm backdrop-blur-sm flex items-center space-x-2">
                <span>{user.name}</span>
                {user.role === 'teacher' && <Crown size={14} className="text-yellow-400" />}
                {user.uid === 'local' && <span className="text-blue-300">(You)</span>}
                {isFallbackMode && <span className="text-yellow-400 text-xs">🚧</span>}
              </div>
            </div>

            {/* Audio mute indicator */}
            {(user.uid === 'local' && isAudioMuted) && (
              <div className="absolute top-3 right-3 bg-red-500 p-2 rounded-full">
                <MicOff size={16} className="text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-white text-xl mb-2">Joining Class Session...</h3>
          <p className="text-gray-400">Setting up your video and audio</p>
          {isConnecting && (
            <p className="text-blue-400 text-sm mt-2">Connecting to Agora service...</p>
          )}
          {agoraConfig && (
            <div className="mt-4 p-3 bg-gray-800 rounded-lg text-left max-w-md mx-auto">
              <p className="text-sm text-gray-300">Debug Info:</p>
              <p className="text-xs text-gray-400">App ID: {agoraConfig.appId ? '✓ Configured' : '✗ Missing'}</p>
              <p className="text-xs text-gray-400">Channel: {agoraConfig.channel}</p>
              <p className="text-xs text-gray-400">User: {agoraConfig.uid}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error || connectionError) {
    const displayError = error || connectionError?.userMessage || connectionError?.message;
    
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center max-w-md">
          <div className="bg-red-500/20 border border-red-500/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <VideoOff size={32} className="text-red-400" />
          </div>
          <h3 className="text-white text-xl mb-2">Connection Failed</h3>
          <p className="text-gray-400 mb-4">{displayError}</p>
          {agoraConfig && (
            <div className="mb-4 p-3 bg-gray-800 rounded-lg text-left">
              <p className="text-sm text-gray-300 mb-2">Configuration:</p>
              <p className="text-xs text-gray-400">App ID: {agoraConfig.appId ? '***' + agoraConfig.appId.slice(-4) : 'Missing'}</p>
              <p className="text-xs text-gray-400">Channel: {agoraConfig.channel}</p>
              <p className="text-xs text-gray-400">Token: {agoraConfig.token ? 'Present' : 'Missing'}</p>
            </div>
          )}
          <div className="flex space-x-3 justify-center">
            <button
              onClick={handleRetryConnection}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg text-white transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onLeave}
              className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg text-white transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ... (rest of the JSX remains the same)
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-gray-900 text-white flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800/90 backdrop-blur-lg border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            }`} />
            <span className={`text-sm ${
              isConnected ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
            {isFallbackMode && (
              <span className="text-yellow-400 text-xs bg-yellow-500/20 px-2 py-1 rounded">
                Development Mode
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <Users size={16} />
            <span>{participants.length + 1} participants</span>
          </div>

          {isTeacher && (
            <div className="flex items-center space-x-2 text-sm text-yellow-400 bg-yellow-400/20 px-3 py-1 rounded-full">
              <Crown size={14} />
              <span>Host</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={copyMeetingLink}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors"
          >
            <Share2 size={16} />
            <span>Invite Students</span>
          </button>

          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`p-2 rounded-lg transition-colors ${
              showParticipants ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <Users size={20} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-300"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex p-6 space-x-6 overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 flex flex-col">
          {renderVideoPlayers()}
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800/90 backdrop-blur-lg border-t border-gray-700 p-4">
        <div className="flex justify-center items-center space-x-4 mb-4">
          {/* Audio Control */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-all duration-200 transform hover:scale-105 ${
              isAudioMuted 
                ? 'bg-red-600 hover:bg-red-500' 
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Video Control */}
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all duration-200 transform hover:scale-105 ${
              isVideoMuted 
                ? 'bg-red-600 hover:bg-red-500' 
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full transition-all duration-200 transform hover:scale-105 ${
              isScreenSharing 
                ? 'bg-purple-600 hover:bg-purple-500' 
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            {isScreenSharing ? <MonitorOff size={24} /> : <ScreenShare size={24} />}
          </button>

          {/* End Session Button - Only for teachers */}
          {isTeacher && (
            <button
              onClick={handleEndSession}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
              title="End Class Session"
            >
              <X size={24} />
              <span className="text-sm">End Class</span>
            </button>
          )}

          {/* Leave Call Button */}
          <button
            onClick={handleLeave}
            className="p-4 rounded-full bg-gray-600 hover:bg-gray-500 transition-all duration-200 transform hover:scale-105"
          >
            <Phone size={24} className="transform rotate-135" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
