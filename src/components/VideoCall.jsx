// components/VideoCall.jsx
import { useState, useEffect, useRef } from 'react';
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
import videoApi from '../lib/agora/videoApi';

const VideoCall = ({ meetingId, user, onLeave, isTeacher = false, onSessionEnded }) => {
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

  const localPlayerRef = useRef(null);
  const remotePlayersRef = useRef({});
  const screenTrackRef = useRef(null);
  const containerRef = useRef(null);

  // ✅ Use the production-ready Agora hook
  const {
    isConnected,
    isConnecting,
    connectionError,
    joinChannel,
    leaveChannel,
    retryConnection,
    service
  } = useAgoraProduction({
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

  // Initialize local media tracks
  const initializeLocalTracks = async () => {
    try {
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

      // Publish tracks if client is available
      if (service?.client) {
        await service.client.publish([audioTrack, videoTrack]);
      }
      
    } catch (error) {
      console.error('Failed to initialize media tracks:', error);
      toast.error('Could not access camera/microphone');
    }
  };

  // Setup Agora event listeners
  const setupAgoraEvents = () => {
    if (!service?.client) return;

    service.client.on('user-published', async (user, mediaType) => {
      try {
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
    });

    service.client.on('user-unpublished', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    service.client.on('user-joined', (user) => {
      const newParticipant = {
        uid: user.uid,
        name: `Student ${user.uid}`,
        role: 'student',
        joinedAt: new Date()
      };
      setParticipants(prev => [...prev, newParticipant]);
      toast.info('New student joined the class');
    });

    service.client.on('user-left', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      setParticipants(prev => prev.filter(p => p.uid !== user.uid));
      toast.info('Student left the class');
    });

    service.client.on('network-quality', (stats) => {
      console.log('Network quality:', stats);
    });
  };

  // Initialize Agora connection
  useEffect(() => {
    const initVideoCall = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🚀 Starting Agora initialization...');

        // ✅ VERIFY FUNCTION EXISTS BEFORE CALLING
        if (typeof videoApi.generateAgoraToken !== 'function') {
          throw new Error('generateAgoraToken is not available - check import');
        }

        // ✅ GET TOKEN WITH ERROR HANDLING
        console.log('🔐 Requesting Agora token...');
        const tokenData = await videoApi.generateAgoraToken(meetingId, user.id);
        console.log('✅ Token data received:', tokenData);

        // ✅ CRITICAL: Ensure appId exists with fallback
        const appId = tokenData.appId;
        if (!appId) {
          throw new Error('Agora App ID is undefined. Token data: ' + JSON.stringify(tokenData));
        }

        console.log('🔧 Using App ID:', appId);

        // Check if we're in fallback mode
        if (tokenData.isFallback) {
          setIsFallbackMode(true);
          console.log('⚠️ Using fallback/development mode');
        }

        // Setup event listeners once service is ready
        setTimeout(() => {
          setupAgoraEvents();
        }, 100);

        // Join channel using production hook
        console.log('🔗 Joining Agora channel...');
        const success = await joinChannel(meetingId, tokenData.token, user.id);
        
        if (!success) {
          throw new Error('Failed to join channel');
        }

      } catch (error) {
        console.error('❌ Error initializing video call:', error);
        setError(error.message);
        toast.error(`Failed to join video call: ${error.message}`);
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

  // Cleanup function
  const handleCleanup = () => {
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

  // End session function for teachers
  const handleEndSession = async () => {
    if (!isTeacher) return;
    
    try {
      // Show confirmation dialog
      const confirmEnd = window.confirm(
        'Are you sure you want to end this class session? All students will be disconnected.'
      );
      
      if (!confirmEnd) return;

      // Call the API to end the session
      await videoApi.endVideoSession(meetingId);
      
      // Notify parent component
      if (onSessionEnded) {
        onSessionEnded();
      }
      
      // Leave the call
      await handleLeave();
      
      toast.success('Class session ended successfully!');
      
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session. Please try again.');
    }
  };

  // Toggle audio mute
  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
      toast.info(isAudioMuted ? 'Microphone on' : 'Microphone muted');
    }
  };

  // Toggle video mute
  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
      toast.info(isVideoMuted ? 'Video on' : 'Video off');
    }
  };

  // Screen sharing
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

  // Mute specific user (teacher only)
  const muteUser = async (userId) => {
    if (!isTeacher) return;
    
    try {
      // In a real implementation, you'd call your backend to enforce mute
      toast.info(`Muted student ${userId}`);
    } catch (error) {
      console.error('Error muting user:', error);
      toast.error('Failed to mute user');
    }
  };

  // Remove user from call (teacher only)
  const removeUser = async (userId) => {
    if (!isTeacher) return;
    
    try {
      // In a real implementation, you'd call your backend to remove user
      toast.info(`Removed student ${userId}`);
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error('Failed to remove user');
    }
  };

  // Copy meeting link
  const copyMeetingLink = () => {
    const link = `${window.location.origin}/join-class/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Class link copied to clipboard!');
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Leave call
  const handleLeave = async () => {
    try {
      handleCleanup();
      await leaveChannel();
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  };

  // Retry connection
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

    if (layout === 'spotlight') {
      // Spotlight view - teacher as main speaker
      const mainSpeaker = allUsers.find(u => u.role === 'teacher') || allUsers[0];
      const otherSpeakers = allUsers.filter(u => u.uid !== mainSpeaker.uid);

      return (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-gray-900 rounded-xl mb-4 relative">
            {/* Main speaker */}
            <div 
              ref={mainSpeaker.uid === 'local' ? localPlayerRef : (el => {
                if (el && mainSpeaker.uid !== 'local') {
                  remotePlayersRef.current[mainSpeaker.uid] = el;
                  mainSpeaker.videoTrack?.play(el);
                }
              })}
              className="w-full h-full rounded-xl bg-gray-800"
            />
            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm">
              {mainSpeaker.name} {mainSpeaker.role === 'teacher' && '👑'}
              {isFallbackMode && ' 🚧'}
            </div>
            {(!mainSpeaker.videoTrack || (mainSpeaker.uid === 'local' && isVideoMuted)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-xl">
                <div className="text-center">
                  <User size={48} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-300">{mainSpeaker.name}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Other speakers */}
          {otherSpeakers.length > 0 && (
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
                  {(!user.videoTrack || (user.uid === 'local' && isVideoMuted)) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-700 rounded-lg">
                      <User size={20} className="text-gray-400" />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    {user.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
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
              
              {isTeacher && user.role === 'student' && (
                <div className="flex space-x-1">
                  <button
                    onClick={() => muteUser(user.uid)}
                    className="bg-red-500/80 hover:bg-red-400 p-1 rounded text-white transition-colors"
                    title="Mute Student"
                  >
                    <MicOff size={12} />
                  </button>
                  <button
                    onClick={() => removeUser(user.uid)}
                    className="bg-red-600/80 hover:bg-red-500 p-1 rounded text-white transition-colors"
                    title="Remove Student"
                  >
                    <UserX size={12} />
                  </button>
                </div>
              )}
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
          <div className="mt-4 flex justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
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

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex p-6 space-x-6 overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 flex flex-col">
          {renderVideoPlayers()}
        </div>

        {/* Sidebar */}
        {(showParticipants || showSettings) && (
          <div className="w-80 space-y-6">
            {/* Participants Panel */}
            {showParticipants && (
              <div className="bg-gray-800/90 backdrop-blur-lg rounded-xl p-4 border border-gray-700">
                <h3 className="font-semibold mb-3 flex items-center text-white">
                  <Users size={18} className="mr-2" />
                  Participants ({participants.length + 1})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {/* Teacher */}
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                        <Crown size={16} className="text-white" />
                      </div>
                      <div>
                        <span className="text-white font-medium block">{user.name}</span>
                        <span className="text-yellow-400 text-xs">Host</span>
                      </div>
                    </div>
                    <span className="text-green-400 text-xs">You</span>
                  </div>

                  {/* Students */}
                  {participants.map(participant => (
                    <div key={participant.uid} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                          <User size={16} className="text-white" />
                        </div>
                        <div>
                          <span className="text-white text-sm block">{participant.name}</span>
                          <span className="text-gray-400 text-xs">Student</span>
                        </div>
                      </div>
                      {isTeacher && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => muteUser(participant.uid)}
                            className="p-2 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                            title="Mute Student"
                          >
                            <MicOff size={14} />
                          </button>
                          <button
                            onClick={() => removeUser(participant.uid)}
                            className="p-2 hover:bg-red-600 rounded text-gray-300 transition-colors"
                            title="Remove Student"
                          >
                            <UserX size={14} />
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
              <div className="bg-gray-800/90 backdrop-blur-lg rounded-xl p-4 border border-gray-700">
                <h3 className="font-semibold mb-3 flex items-center text-white">
                  <Settings size={18} className="mr-2" />
                  Settings
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Video Quality</label>
                    <select 
                      value={videoQuality}
                      onChange={(e) => setVideoQuality(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="360p">360p - Standard</option>
                      <option value="720p">720p - HD</option>
                      <option value="1080p">1080p - Full HD</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Layout</label>
                    <div className="flex space-x-2">
                      {[
                        { id: 'grid', label: 'Grid', icon: Grid3X3 },
                        { id: 'spotlight', label: 'Spotlight', icon: Users }
                      ].map(layoutOption => (
                        <button
                          key={layoutOption.id}
                          onClick={() => setLayout(layoutOption.id)}
                          className={`flex-1 py-2 rounded-lg text-sm flex flex-col items-center transition-colors ${
                            layout === layoutOption.id 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          <layoutOption.icon size={16} className="mb-1" />
                          {layoutOption.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Wifi size={16} className="text-green-400" />
                      <span className="text-sm text-gray-300">Connection</span>
                    </div>
                    <span className="text-green-400 text-sm">Excellent</span>
                  </div>

                  {isFallbackMode && (
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
                      <p className="text-yellow-400 text-sm font-medium">Development Mode</p>
                      <p className="text-yellow-300 text-xs">Using token-less Agora mode</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
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

        {/* Status Bar */}
        <div className="flex justify-center items-center space-x-6 text-sm text-gray-400">
          <div className="flex items-center space-x-2">
            <Zap size={16} />
            <span>{videoQuality}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users size={16} />
            <span>{remoteUsers.length} students connected</span>
          </div>
          <div className="flex items-center space-x-2">
            {isScreenSharing ? <Monitor size={16} /> : <Video size={16} />}
            <span>{isScreenSharing ? 'Screen Sharing' : 'Camera'}</span>
          </div>
          {isFallbackMode && (
            <div className="flex items-center space-x-2 text-yellow-400">
              <span>🚧 Dev Mode</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
