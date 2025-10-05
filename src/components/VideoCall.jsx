// components/VideoCall.jsx
import { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  Video, VideoOff, Mic, MicOff, Phone, Users,
  MessageCircle, Settings, ScreenShare, Monitor,
  UserPlus, MoreVertical, Crown, Mic2, UserX,
  MessageSquare, MonitorOff, Share2, Grid3X3,
  Airplay, Cast, Zap, Satellite, Wifi, Radio
} from 'lucide-react';
import { toast } from 'react-toastify';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false }) => {
  const [client, setClient] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoQuality, setVideoQuality] = useState('720p');
  const [layout, setLayout] = useState('grid'); // grid, spotlight, speaker

  const localPlayerRef = useRef(null);
  const remotePlayersRef = useRef({});
  const screenTrackRef = useRef(null);

  // Agora configuration
  const APP_ID = process.env.REACT_APP_AGORA_APP_ID;
  const TOKEN = process.env.REACT_APP_AGORA_TOKEN; // You'll need to generate this dynamically

  useEffect(() => {
    const initAgora = async () => {
      try {
        // Initialize Agora client
        const agoraClient = AgoraRTC.createClient({ 
          mode: 'rtc', 
          codec: 'vp8' 
        });
        setClient(agoraClient);

        // Event listeners
        agoraClient.on('user-published', async (user, mediaType) => {
          await agoraClient.subscribe(user, mediaType);
          
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
        });

        agoraClient.on('user-unpublished', (user) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        agoraClient.on('user-joined', (user) => {
          setParticipants(prev => [...prev, {
            uid: user.uid,
            name: `Student ${user.uid}`,
            role: 'student',
            joinedAt: new Date()
          }]);
          toast.info('New student joined the class');
        });

        agoraClient.on('user-left', (user) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
          setParticipants(prev => prev.filter(p => p.uid !== user.uid));
          toast.info('Student left the class');
        });

        agoraClient.on('network-quality', (stats) => {
          // Handle network quality updates
          console.log('Network quality:', stats);
        });

        // Join the channel
        await agoraClient.join(
          APP_ID, 
          meetingId, 
          TOKEN, 
          user.id || Date.now()
        );

        // Create and publish local tracks
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        await agoraClient.publish([audioTrack, videoTrack]);

        // Play local video
        if (localPlayerRef.current) {
          videoTrack.play(localPlayerRef.current);
        }

      } catch (error) {
        console.error('Error initializing Agora:', error);
        toast.error('Failed to join video call');
      }
    };

    if (meetingId && user) {
      initAgora();
    }

    return () => {
      if (client) {
        client.leave();
      }
      if (localAudioTrack) {
        localAudioTrack.close();
      }
      if (localVideoTrack) {
        localVideoTrack.close();
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.close();
      }
    };
  }, [meetingId, user]);

  // Toggle audio mute
  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  // Toggle video mute
  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  // Screen sharing
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1'
        });
        
        await client.unpublish(localVideoTrack);
        await client.publish(screenTrack);
        
        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);

        screenTrack.on('track-ended', () => {
          toggleScreenShare();
        });
      } else {
        await client.unpublish(screenTrackRef.current);
        await client.publish(localVideoTrack);
        
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to share screen');
    }
  };

  // Mute specific user (teacher only)
  const muteUser = async (userId) => {
    if (!isTeacher) return;
    
    try {
      // This would typically call your backend to enforce mute
      toast.info(`Muted student ${userId}`);
    } catch (error) {
      console.error('Error muting user:', error);
    }
  };

  // Remove user from call (teacher only)
  const removeUser = async (userId) => {
    if (!isTeacher) return;
    
    try {
      // This would typically call your backend to remove user
      toast.info(`Removed student ${userId}`);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  };

  // Copy meeting link
  const copyMeetingLink = () => {
    const link = `${window.location.origin}/class/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied to clipboard!');
  };

  // Leave call
  const handleLeave = async () => {
    try {
      if (localAudioTrack) {
        localAudioTrack.close();
      }
      if (localVideoTrack) {
        localVideoTrack.close();
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.close();
      }
      if (client) {
        await client.leave();
      }
      onLeave();
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  };

  // Render video players
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

    if (layout === 'spotlight') {
      // Spotlight view - large main speaker, small others
      const mainSpeaker = allUsers[0]; // Teacher as main speaker
      const otherSpeakers = allUsers.slice(1);

      return (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-gray-900 rounded-xl mb-4 relative">
            {/* Main speaker */}
            <div 
              ref={mainSpeaker.uid === 'local' ? localPlayerRef : undefined}
              className="w-full h-full rounded-xl bg-gray-800"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
              {mainSpeaker.name} {mainSpeaker.role === 'teacher' && '👑'}
            </div>
          </div>
          
          {/* Other speakers */}
          <div className="grid grid-cols-4 gap-2 h-32">
            {otherSpeakers.map(user => (
              <div key={user.uid} className="bg-gray-800 rounded-lg relative">
                <div 
                  ref={el => {
                    if (el && user.uid !== 'local') {
                      remotePlayersRef.current[user.uid] = el;
                      user.videoTrack?.play(el);
                    }
                  }}
                  className="w-full h-full rounded-lg"
                />
                <div className="absolute bottom-1 left-1 bg-black/50 text-white px-2 py-1 rounded text-xs">
                  {user.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Grid layout (default)
    return (
      <div className={`grid gap-4 flex-1 ${
        allUsers.length <= 4 ? 'grid-cols-2' : 
        allUsers.length <= 9 ? 'grid-cols-3' : 'grid-cols-4'
      }`}>
        {allUsers.map(user => (
          <div 
            key={user.uid} 
            className={`bg-gray-800 rounded-xl relative ${
              user.uid === 'local' ? 'border-2 border-blue-500' : ''
            } ${isTeacher && user.role === 'teacher' ? 'ring-2 ring-yellow-400' : ''}`}
          >
            <div 
              ref={user.uid === 'local' ? localPlayerRef : (el => {
                if (el && user.uid !== 'local') {
                  remotePlayersRef.current[user.uid] = el;
                  user.videoTrack?.play(el);
                }
              })}
              className="w-full h-48 rounded-xl bg-gray-700"
            />
            
            {/* User info overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
              <div className="bg-black/50 text-white px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
                {user.name} 
                {user.role === 'teacher' && ' 👑'}
                {user.uid === 'local' && ' (You)'}
              </div>
              
              {isTeacher && user.role === 'student' && (
                <div className="flex space-x-1">
                  <button
                    onClick={() => muteUser(user.uid)}
                    className="bg-red-500/80 hover:bg-red-400 p-1 rounded text-white"
                    title="Mute Student"
                  >
                    <MicOff size={12} />
                  </button>
                  <button
                    onClick={() => removeUser(user.uid)}
                    className="bg-red-600/80 hover:bg-red-500 p-1 rounded text-white"
                    title="Remove Student"
                  >
                    <UserX size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Audio mute indicator */}
            {(user.uid === 'local' && isAudioMuted) || 
             (user.uid !== 'local' && !user.audioTrack) && (
              <div className="absolute top-3 right-3 bg-red-500 p-2 rounded-full">
                <MicOff size={16} className="text-white" />
              </div>
            )}

            {/* Video mute indicator */}
            {(user.uid === 'local' && isVideoMuted) || 
             (user.uid !== 'local' && !user.videoTrack) && (
              <div className="absolute top-3 left-3 bg-red-500 p-2 rounded-full">
                <VideoOff size={16} className="text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col z-50">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              client ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-sm">
              {client ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <Users size={16} />
            <span>{participants.length + 1} participants</span>
          </div>

          {isTeacher && (
            <div className="flex items-center space-x-2 text-sm text-yellow-400">
              <Crown size={16} />
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
            <span>Share Link</span>
          </button>

          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Users size={20} />
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex p-6 space-x-6">
        {/* Video Grid */}
        {renderVideoPlayers()}

        {/* Sidebar */}
        <div className="w-80 space-y-6">
          {/* Participants Panel */}
          {showParticipants && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center">
                <Users size={18} className="mr-2" />
                Participants ({participants.length + 1})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Teacher */}
                <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <Crown size={14} />
                    </div>
                    <span className="text-sm">{user.name} (You)</span>
                  </div>
                  <span className="text-xs text-yellow-400">Host</span>
                </div>

                {/* Students */}
                {participants.map(participant => (
                  <div key={participant.uid} className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <User size={14} />
                      </div>
                      <span className="text-sm">{participant.name}</span>
                    </div>
                    {isTeacher && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => muteUser(participant.uid)}
                          className="p-1 hover:bg-gray-600 rounded text-xs"
                        >
                          <MicOff size={12} />
                        </button>
                        <button
                          onClick={() => removeUser(participant.uid)}
                          className="p-1 hover:bg-red-600 rounded text-xs"
                        >
                          <UserX size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center">
                <Settings size={18} className="mr-2" />
                Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Video Quality</label>
                  <select 
                    value={videoQuality}
                    onChange={(e) => setVideoQuality(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="360p">360p - Standard</option>
                    <option value="720p">720p - HD</option>
                    <option value="1080p">1080p - Full HD</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Layout</label>
                  <div className="flex space-x-2">
                    {['grid', 'spotlight', 'speaker'].map(layoutOption => (
                      <button
                        key={layoutOption}
                        onClick={() => setLayout(layoutOption)}
                        className={`flex-1 py-2 rounded-lg text-sm ${
                          layout === layoutOption 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {layoutOption.charAt(0).toUpperCase() + layoutOption.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Network Status</span>
                  <div className="flex items-center space-x-2 text-green-400">
                    <Wifi size={16} />
                    <span className="text-sm">Excellent</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleScreenShare}
                className={`p-3 rounded-lg flex flex-col items-center space-y-1 ${
                  isScreenSharing 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {isScreenSharing ? <MonitorOff size={20} /> : <ScreenShare size={20} />}
                <span className="text-xs">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
              </button>

              <button
                onClick={copyMeetingLink}
                className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 flex flex-col items-center space-y-1 text-gray-300"
              >
                <UserPlus size={20} />
                <span className="text-xs">Invite</span>
              </button>

              <button className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 flex flex-col items-center space-y-1 text-gray-300">
                <MessageSquare size={20} />
                <span className="text-xs">Chat</span>
              </button>

              <button className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 flex flex-col items-center space-y-1 text-gray-300">
                <Radio size={20} />
                <span className="text-xs">Record</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex justify-center items-center space-x-4">
          {/* Audio Control */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-all duration-200 ${
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
            className={`p-4 rounded-full transition-all duration-200 ${
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
            className={`p-4 rounded-full transition-all duration-200 ${
              isScreenSharing 
                ? 'bg-purple-600 hover:bg-purple-500' 
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
          </button>

          {/* Leave Call */}
          <button
            onClick={handleLeave}
            className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-all duration-200"
          >
            <Phone size={24} className="transform rotate-135" />
          </button>

          {/* More Options */}
          <button className="p-4 rounded-full bg-gray-600 hover:bg-gray-500 transition-all duration-200">
            <MoreVertical size={24} />
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex justify-center items-center space-x-6 mt-4 text-sm text-gray-400">
          <div className="flex items-center space-x-2">
            <Zap size={16} />
            <span>Video Quality: {videoQuality}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Satellite size={16} />
            <span>{remoteUsers.length} students connected</span>
          </div>
          <div className="flex items-center space-x-2">
            <Airplay size={16} />
            <span>{isScreenSharing ? 'Screen Sharing' : 'Camera'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
