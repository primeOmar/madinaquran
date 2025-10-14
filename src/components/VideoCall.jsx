import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, Users, ScreenShare, MonitorOff, X, Crown, User, Share2 } from 'lucide-react';
import { toast } from 'react-toastify';

// ✅ PRODUCTION: Import the production-ready video service
import { useVideoCall } from '../hooks/useVideoCall';
import videoApi from '../lib/agora/videoApi';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
  // ✅ PRODUCTION: Use the production video call hook
  const { 
    startCall, 
    joinCall, 
    leaveCall, 
    isLoading, 
    error, 
    isInCall,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    isAudioMuted,
    isVideoMuted,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    isScreenSharing
  } = useVideoCall();

  // Local state for UI
  const [participants, setParticipants] = useState([]);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  // Refs
  const localPlayerRef = useRef(null);
  const remotePlayersRef = useRef({});

  // ✅ PRODUCTION: Initialize and join video call
  useEffect(() => {
    const joinVideoCall = async () => {
      if (meetingId && user?.id) {
        console.log('🚀 Starting video call:', { meetingId, user: user.name });
        
        const result = await joinCall(meetingId, user.id);
        
        if (!result.success) {
          // Error is already handled by the hook, but we can add specific handling here
          if (result.error.includes('RATE_LIMIT')) {
            toast.error('Too many attempts. Please wait a minute.');
          } else if (result.error.includes('AGORA_JOIN_FAILED')) {
            toast.error('Unable to connect to video service. Please try again.');
          }
        } else {
          console.log('✅ Successfully joined call:', result.meetingId);
          toast.success('Connected to video call!');
        }
      }
    };

    joinVideoCall();
  }, [meetingId, user, joinCall]);

  // ✅ PRODUCTION: Setup participants tracking
  useEffect(() => {
    if (remoteUsers.length > 0) {
      const newParticipants = remoteUsers.map(user => ({
        uid: user.uid,
        name: `Student ${user.uid}`,
        role: 'student',
        joinedAt: new Date()
      }));
      
      setParticipants(newParticipants);
    }
  }, [remoteUsers]);

  // ✅ PRODUCTION: Play local video when track is available
  useEffect(() => {
    if (localVideoTrack && localPlayerRef.current) {
      localVideoTrack.play(localPlayerRef.current);
    }
  }, [localVideoTrack]);

  // ✅ PRODUCTION: Play remote videos when tracks are available
  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.videoTrack && remotePlayersRef.current[user.uid]) {
        user.videoTrack.play(remotePlayersRef.current[user.uid]);
      }
    });
  }, [remoteUsers]);

  const handleEndSession = async () => {
    if (!isTeacher) return;
    
    try {
      const confirmEnd = window.confirm('End this class session? All students will be disconnected.');
      if (!confirmEnd) return;

      await videoApi.endVideoSession(meetingId);
      await leaveCall();
      
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
    await leaveCall();
    onLeave?.();
  };

  const handleRetryConnection = async () => {
    if (meetingId && user?.id) {
      const result = await joinCall(meetingId, user.id);
      
      if (result.success) {
        toast.success('Reconnected!');
      }
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
        </div>
      </div>
    );
  }

  // ✅ PRODUCTION: Error state
  if (error) {
    const displayError = error.includes('RATE_LIMIT') 
      ? 'Too many attempts. Please wait a minute before trying again.'
      : error.includes('AGORA_JOIN_FAILED')
      ? 'Unable to connect to video service. Please try again.'
      : error;

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
            <div className={`w-3 h-3 rounded-full ${isInCall ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className={isInCall ? 'text-green-400' : 'text-yellow-400'}>
              {isInCall ? 'Live' : isLoading ? 'Connecting...' : 'Disconnected'}
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
