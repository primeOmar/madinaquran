import { useState, useEffect, useRef, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, Users, ScreenShare, MonitorOff, X, Crown, User, Share2 } from 'lucide-react';
import { toast } from 'react-toastify';

// ✅ Import the production-ready Agora hook
import useAgoraProduction from '../hooks/useAgoraProduction';
import videoApi from '../lib/agora/videoApi';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
  // State management - SIMPLIFIED
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  // Refs
  const localPlayerRef = useRef(null);
  const remotePlayersRef = useRef({});
  const screenTrackRef = useRef(null);

  // ✅ PRODUCTION: Use the production-ready Agora hook with SIMPLIFIED config
  const {
    isConnected,
    isConnecting,
    connectionError,
    joinChannel,
    leaveChannel,
    retryConnection,
    service
  } = useAgoraProduction({
    // ✅ Pass essential config only
    autoJoin: false, // We'll join manually
    onError: (error) => {
      console.error('Agora connection error:', error);
      setError(error.userMessage || 'Connection failed');
      setIsLoading(false);
    },
    onJoined: (data) => {
      console.log('✅ Successfully joined channel');
      setIsLoading(false);
      initializeLocalTracks();
      toast.success('Connected to video call!');
    },
    onLeft: () => {
      console.log('🔚 Left channel');
      handleCleanup();
      onLeave?.();
    }
  });

  // ✅ PRODUCTION: Initialize and join channel - SIMPLIFIED
  useEffect(() => {
    const initAndJoin = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🚀 Starting video call:', { meetingId, user: user?.name });

        // ✅ Get token data
        const tokenData = await videoApi.generateAgoraToken(meetingId, user?.id);
        
        if (!tokenData.appId) {
          throw new Error('No App ID available for video call');
        }

        console.log('✅ Got Agora config:', {
          appId: tokenData.appId ? '***' + tokenData.appId.slice(-4) : 'missing',
          channel: meetingId,
          hasToken: !!tokenData.token
        });

        if (tokenData.isFallback) {
          setIsFallbackMode(true);
        }

        // ✅ Join channel immediately
        const success = await joinChannel(
          meetingId,
          tokenData.token,
          user?.id?.toString()
        );

        if (!success) {
          throw new Error('Failed to join channel');
        }

      } catch (error) {
        console.error('❌ Video call initialization failed:', error);
        setError(error.message);
        setIsLoading(false);
        toast.error('Failed to start video call');
      }
    };

    if (meetingId && user) {
      initAndJoin();
    }

    return () => {
      handleCleanup();
    };
  }, [meetingId, user, joinChannel]);

  // ✅ PRODUCTION: Initialize local media tracks
  const initializeLocalTracks = async () => {
    try {
      console.log('🎬 Initializing local media tracks...');
      
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      
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

      // Publish tracks
      if (service?.client && isConnected) {
        await service.client.publish([audioTrack, videoTrack]);
        console.log('✅ Local tracks published');
      }
      
    } catch (error) {
      console.error('Failed to initialize media:', error);
      toast.error('Could not access camera/microphone');
    }
  };

  // ✅ PRODUCTION: Setup Agora event listeners
  useEffect(() => {
    if (!service?.client) return;

    console.log('🎧 Setting up Agora event listeners');

    const handleUserPublished = async (user, mediaType) => {
      try {
        await service.client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          setRemoteUsers(prev => {
            const exists = prev.find(u => u.uid === user.uid);
            return exists ? prev : [...prev, user];
          });
        }

        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      } catch (error) {
        console.error('Subscribe error:', error);
      }
    };

    const handleUserUnpublished = (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    };

    const handleUserJoined = (user) => {
      const newParticipant = {
        uid: user.uid,
        name: `Student ${user.uid}`,
        role: 'student',
        joinedAt: new Date()
      };
      setParticipants(prev => [...prev, newParticipant]);
      toast.info('New student joined');
    };

    const handleUserLeft = (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      setParticipants(prev => prev.filter(p => p.uid !== user.uid));
      toast.info('Student left');
    };

    // Add event listeners
    service.client.on('user-published', handleUserPublished);
    service.client.on('user-unpublished', handleUserUnpublished);
    service.client.on('user-joined', handleUserJoined);
    service.client.on('user-left', handleUserLeft);

    // Cleanup
    return () => {
      if (service?.client) {
        service.client.off('user-published', handleUserPublished);
        service.client.off('user-unpublished', handleUserUnpublished);
        service.client.off('user-joined', handleUserJoined);
        service.client.off('user-left', handleUserLeft);
      }
    };
  }, [service, isConnected]);

  // ✅ PRODUCTION: Cleanup function
  const handleCleanup = useCallback(() => {
    console.log('🧹 Cleaning up resources...');
    
    // Close local tracks
    [localAudioTrack, localVideoTrack, screenTrackRef.current].forEach(track => {
      if (track) {
        track.close();
      }
    });

    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    screenTrackRef.current = null;
    remotePlayersRef.current = {};
  }, [localAudioTrack, localVideoTrack]);

  // ✅ PRODUCTION: Control functions
  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const screenTrack = await AgoraRTC.createScreenVideoTrack();
        
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

  const handleEndSession = async () => {
    if (!isTeacher) return;
    
    try {
      const confirmEnd = window.confirm('End this class session? All students will be disconnected.');
      if (!confirmEnd) return;

      await videoApi.endVideoSession(meetingId);
      await handleLeave();
      
      if (onSessionEnded) {
        onSessionEnded();
      }
      
      toast.success('Class session ended!');
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
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
        toast.success('Reconnected!');
      }
    } catch (error) {
      console.error('Retry failed:', error);
      setError(error.message);
    }
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/join-class/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Class link copied!');
  };

  // ✅ PRODUCTION: Render video players
  const renderVideoPlayers = () => {
    const allUsers = [
      { 
        uid: 'local', 
        videoTrack: localVideoTrack, 
        audioTrack: localAudioTrack,
        name: `${user?.name} (You)`,
        role: isTeacher ? 'teacher' : 'student'
      },
      ...remoteUsers
    ];

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

  // ✅ PRODUCTION: Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-white text-xl mb-2">Joining Class...</h3>
          <p className="text-gray-400">Setting up your video and audio</p>
          {isConnecting && (
            <p className="text-blue-400 text-sm mt-2">Connecting...</p>
          )}
        </div>
      </div>
    );
  }

  // ✅ PRODUCTION: Error state
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
          <div className="flex space-x-3 justify-center">
            <button
              onClick={handleRetryConnection}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg text-white"
            >
              Try Again
            </button>
            <button
              onClick={onLeave}
              className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg text-white"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ PRODUCTION: Main video call UI
  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col z-50">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800/90 backdrop-blur-lg border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
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
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg"
          >
            <Share2 size={16} />
            <span>Invite</span>
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-6">
        {renderVideoPlayers()}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800/90 backdrop-blur-lg border-t border-gray-700 p-4">
        <div className="flex justify-center items-center space-x-4">
          {/* Audio Control */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${
              isAudioMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Video Control */}
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${
              isVideoMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full ${
              isScreenSharing ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            {isScreenSharing ? <MonitorOff size={24} /> : <ScreenShare size={24} />}
          </button>

          {/* End Session - Teachers only */}
          {isTeacher && (
            <button
              onClick={handleEndSession}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 flex items-center space-x-2"
            >
              <X size={24} />
              <span>End Class</span>
            </button>
          )}

          {/* Leave Call */}
          <button
            onClick={handleLeave}
            className="p-4 rounded-full bg-gray-600 hover:bg-gray-500"
          >
            <Phone size={24} className="transform rotate-135" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
