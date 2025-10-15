import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, Users, ScreenShare, MonitorOff, X, Crown, User, Share2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useVideoCall } from '../hooks/useVideoCall';
import videoApi from '../lib/agora/videoApi';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
  // Use the production video call hook
  const { 
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

  // Refs
  const localPlayerRef = useRef(null);
  const remotePlayersRef = useRef({});

  // Initialize and join video call
  useEffect(() => {
    const joinVideoCall = async () => {
      if (meetingId && user?.id) {
        console.log('🚀 Starting video call:', { meetingId, userId: user.id });
        
        const result = isTeacher 
          ? await joinCall(meetingId, user.id) // Teachers use the same joinCall
          : await joinCall(meetingId, user.id);
        
        if (!result.success) {
          if (result.error?.includes('RATE_LIMIT')) {
            toast.error('Too many attempts. Please wait a minute.');
          } else if (result.error?.includes('AGORA_JOIN_FAILED')) {
            toast.error('Unable to connect to video service. Please try again.');
          }
        } else {
          console.log('✅ Successfully joined call:', result.meetingId);
          toast.success('Connected to video call!');
        }
      }
    };

    joinVideoCall();
  }, [meetingId, user, joinCall, isTeacher]);

  // Setup participants tracking
  useEffect(() => {
    if (remoteUsers.length > 0) {
      const newParticipants = remoteUsers.map(user => ({
        uid: user.uid,
        name: user.name || `User ${user.uid}`,
        role: 'student',
        joinedAt: new Date()
      }));
      
      setParticipants(newParticipants);
    } else {
      setParticipants([]);
    }
  }, [remoteUsers]);

  // Play local video when track is available
  useEffect(() => {
    if (localVideoTrack && localPlayerRef.current && !isVideoMuted) {
      try {
        localVideoTrack.play(localPlayerRef.current);
      } catch (err) {
        console.error('Error playing local video:', err);
      }
    }
  }, [localVideoTrack, isVideoMuted]);

  // Play remote videos when tracks are available
  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.videoTrack && remotePlayersRef.current[user.uid]) {
        try {
          user.videoTrack.play(remotePlayersRef.current[user.uid]);
        } catch (err) {
          console.error('Error playing remote video:', err);
        }
      }
    });
  }, [remoteUsers]);

  const handleEndSession = async () => {
    if (!isTeacher) return;
    
    try {
      const confirmEnd = window.confirm('End this class session? All students will be disconnected.');
      if (!confirmEnd) return;

      // End session on backend
      await videoApi.endVideoSession(meetingId);
      
      // Leave the call
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

  // Render video players
  const renderVideoPlayers = () => {
    const allUsers = [
      { 
        uid: 'local', 
        videoTrack: localVideoTrack, 
        audioTrack: localAudioTrack,
        name: `${user?.name || 'You'} (You)`,
        role: isTeacher ? 'teacher' : 'student'
      },
      ...remoteUsers
    ];

    return (
      <div className={`grid gap-4 flex-1 p-4 ${
        allUsers.length === 1 ? 'grid-cols-1' :
        allUsers.length <= 4 ? 'grid-cols-2' : 
        allUsers.length <= 9 ? 'grid-cols-3' : 'grid-cols-4'
      } auto-rows-fr`}>
        {allUsers.map(remoteUser => (
          <div 
            key={remoteUser.uid} 
            className={`bg-gray-800 rounded-xl relative overflow-hidden ${
              allUsers.length === 1 ? 'min-h-[600px]' : 'min-h-[200px]'
            } ${
              remoteUser.uid === 'local' ? 'ring-2 ring-blue-500' : ''
            } ${isTeacher && remoteUser.role === 'teacher' ? 'ring-2 ring-yellow-400' : ''}`}
          >
            <div 
              ref={remoteUser.uid === 'local' ? localPlayerRef : (el => {
                if (el && remoteUser.uid !== 'local') {
                  remotePlayersRef.current[remoteUser.uid] = el;
                }
              })}
              className="w-full h-full rounded-xl bg-gray-700"
            />
            
            {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full transition ${
              isScreenSharing ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff size={24} /> : <ScreenShare size={24} />}
          </button>

          {/* End Session - Teachers only */}
          {isTeacher && (
            <button
              onClick={handleEndSession}
              className="px-5 py-4 rounded-full bg-red-600 hover:bg-red-500 flex items-center space-x-2 font-medium transition"
              title="End class for everyone"
            >
              <X size={24} />
              <span>End Class</span>
            </button>
          )}

          {/* Leave Call */}
          <button
            onClick={handleLeave}
            className="p-4 rounded-full bg-gray-600 hover:bg-gray-500 transition"
            title="Leave call"
          >
            <Phone size={24} className="transform rotate-135" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;/* Fallback when video is off */}
            {(!remoteUser.videoTrack || (remoteUser.uid === 'local' && isVideoMuted)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-3">
                    <User size={40} className="text-white" />
                  </div>
                  <p className="text-white font-semibold text-lg">{remoteUser.name}</p>
                </div>
              </div>
            )}
            
            {/* User info overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
              <div className="bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm flex items-center space-x-2">
                <span className="font-medium">{remoteUser.name}</span>
                {remoteUser.role === 'teacher' && <Crown size={14} className="text-yellow-400" />}
              </div>
            </div>

            {/* Audio mute indicator */}
            {(remoteUser.uid === 'local' && isAudioMuted) && (
              <div className="absolute top-3 right-3 bg-red-500 p-2 rounded-full shadow-lg">
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
          <h3 className="text-white text-xl mb-2">Joining Class...</h3>
          <p className="text-gray-400">Setting up your video and audio</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const displayError = error.includes('RATE_LIMIT') 
      ? 'Too many attempts. Please wait a minute before trying again.'
      : error.includes('AGORA_JOIN_FAILED')
      ? 'Unable to connect to video service. Please try again.'
      : error;

    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          <div className="bg-red-500/20 border border-red-500/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <VideoOff size={32} className="text-red-400" />
          </div>
          <h3 className="text-white text-xl mb-2">Connection Failed</h3>
          <p className="text-gray-400 mb-6">{displayError}</p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={handleRetryConnection}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg text-white font-medium"
            >
              Try Again
            </button>
            <button
              onClick={onLeave}
              className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg text-white font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main video call UI
  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col z-50">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-gray-800/90 backdrop-blur-lg border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isInCall ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className={`font-medium ${isInCall ? 'text-green-400' : 'text-yellow-400'}`}>
              {isInCall ? 'Live' : 'Connecting...'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <Users size={16} />
            <span>{participants.length + 1} participant{participants.length !== 0 ? 's' : ''}</span>
          </div>

          {isTeacher && (
            <div className="flex items-center space-x-2 text-sm text-yellow-400 bg-yellow-400/20 px-3 py-1.5 rounded-full">
              <Crown size={14} />
              <span className="font-medium">Host</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={copyMeetingLink}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition"
          >
            <Share2 size={16} />
            <span>Invite</span>
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 overflow-auto">
        {renderVideoPlayers()}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800/90 backdrop-blur-lg border-t border-gray-700 px-6 py-4">
        <div className="flex justify-center items-center space-x-4">
          {/* Audio Control */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition ${
              isAudioMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Video Control */}
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition ${
              isVideoMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
            title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          {
