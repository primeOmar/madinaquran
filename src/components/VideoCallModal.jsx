import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  Phone, 
  PhoneOff, 
  Users, 
  MessageCircle,
  ScreenShare,
  StopCircle,
  Settings,
  Maximize,
  Minimize,
  Copy,
  User,
  Shield,
  Monitor
} from "lucide-react";
import { MadinaButton } from './MadinaDesignSystem';
import { toast } from 'react-toastify';

const VideoCallModal = ({ 
  meetingId, 
  onLeave, 
  onEnd, 
  isTeacher, 
  userName = 'Teacher',
  className = '' 
}) => {
  // State management
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);
  const [callDuration, setCallDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [videoQuality, setVideoQuality] = useState('720p');
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Refs
  const clientRef = useRef(null);
  const localPlayerRef = useRef(null);
  const screenTrackRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const remoteVideoContainerRef = useRef(null);

  // Agora configuration
  const APP_ID = process.env.REACT_APP_AGORA_APP_ID || 'your_app_id_here';
  
  useEffect(() => {
    initializeAgora();
    startCallTimer();
    
    return () => {
      cleanup();
    };
  }, [meetingId]);

  const initializeAgora = async () => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');
      
      // Initialize Agora client
      const client = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });
      clientRef.current = client;

      // Set up event listeners
      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', handleUserUnpublished);
      client.on('user-joined', handleUserJoined);
      client.on('user-left', handleUserLeft);
      client.on('connection-state-change', handleConnectionStateChange);

      // Join the channel
      // In production, you should use tokens from your backend
      const token = null; // For testing - replace with dynamic token in production
      const uid = await client.join(APP_ID, meetingId, token, null);
      
      console.log('✅ Joined channel successfully with UID:', uid);
      setConnectionStatus('connected');
      setIsConnecting(false);

      // Create and publish local tracks
      await createLocalTracks(client);

    } catch (error) {
      console.error('❌ Failed to initialize Agora:', error);
      setConnectionStatus('failed');
      setIsConnecting(false);
      toast.error('Failed to connect to video session');
    }
  };

  const createLocalTracks = async (client) => {
    try {
      // Create audio and video tracks with quality settings
      const [microphoneTrack, cameraTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack({
          AEC: true, // Acoustic Echo Cancellation
          ANS: true, // Audio Noise Suppression
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: getVideoEncoderConfig(videoQuality),
          optimizationMode: 'detail'
        })
      ]);

      setLocalAudioTrack(microphoneTrack);
      setLocalVideoTrack(cameraTrack);

      // Publish tracks to channel
      await client.publish([microphoneTrack, cameraTrack]);
      console.log('✅ Local tracks published successfully');

      // Play local video
      if (localPlayerRef.current) {
        cameraTrack.play(localPlayerRef.current);
        localPlayerRef.current.classList.add('rounded-lg', 'shadow-2xl');
      }

    } catch (error) {
      console.error('❌ Failed to create local tracks:', error);
      toast.error('Could not access camera/microphone. Please check permissions.');
    }
  };

  const getVideoEncoderConfig = (quality) => {
    const configs = {
      '360p': { resolution: { width: 640, height: 360 }, frameRate: 15, bitrate: 600 },
      '480p': { resolution: { width: 640, height: 480 }, frameRate: 15, bitrate: 800 },
      '720p': { resolution: { width: 1280, height: 720 }, frameRate: 30, bitrate: 1200 },
      '1080p': { resolution: { width: 1920, height: 1080 }, frameRate: 30, bitrate: 2000 }
    };
    return configs[quality] || configs['720p'];
  };

  const handleUserPublished = async (user, mediaType) => {
    try {
      await clientRef.current.subscribe(user, mediaType);
      console.log(`✅ Subscribed to ${mediaType} from user ${user.uid}`);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => {
          const userExists = prev.find(u => u.uid === user.uid);
          if (!userExists) {
            return [...prev, user];
          }
          return prev.map(u => u.uid === user.uid ? user : u);
        });
      }

      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }

      updateParticipantsCount();

    } catch (error) {
      console.error('❌ Failed to subscribe:', error);
    }
  };

  const handleUserUnpublished = (user, mediaType) => {
    if (mediaType === 'video') {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    }
    updateParticipantsCount();
  };

  const handleUserJoined = (user) => {
    console.log('🎉 User joined:', user.uid);
    toast.info('A student joined the session');
    updateParticipantsCount();
  };

  const handleUserLeft = (user) => {
    console.log('👋 User left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    updateParticipantsCount();
  };

  const handleConnectionStateChange = (curState, prevState) => {
    console.log(`Connection state changed: ${prevState} -> ${curState}`);
    setConnectionStatus(curState);
    
    if (curState === 'DISCONNECTED') {
      toast.error('Connection lost. Attempting to reconnect...');
    } else if (curState === 'CONNECTED') {
      toast.success('Connection restored');
    }
  };

  const updateParticipantsCount = () => {
    setParticipantsCount(remoteUsers.length + 1); // +1 for local user
  };

  // Control functions
  const toggleAudio = async () => {
    try {
      if (localAudioTrack) {
        await localAudioTrack.setEnabled(!isMuted);
        setIsMuted(!isMuted);
        toast.info(!isMuted ? 'Microphone muted' : 'Microphone unmuted');
      }
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      if (localVideoTrack) {
        await localVideoTrack.setEnabled(!isVideoOff);
        setIsVideoOff(!isVideoOff);
        toast.info(!isVideoOff ? 'Video turned off' : 'Video turned on');
      }
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_2',
          optimizationMode: 'detail'
        });

        await clientRef.current.unpublish(localVideoTrack);
        await clientRef.current.publish(screenTrack);
        
        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);
        
        // Play screen share in local player
        if (localPlayerRef.current) {
          screenTrack.play(localPlayerRef.current);
        }

        toast.success('Screen sharing started');
        
      } else {
        // Stop screen sharing
        await clientRef.current.unpublish(screenTrackRef.current);
        await clientRef.current.publish(localVideoTrack);
        
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        setIsScreenSharing(false);
        
        // Switch back to camera
        if (localPlayerRef.current && localVideoTrack) {
          localVideoTrack.play(localPlayerRef.current);
        }

        toast.info('Screen sharing stopped');
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
      toast.error('Screen sharing failed. Please check permissions.');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/join/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied to clipboard!');
  };

  const startCallTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const cleanup = async () => {
    try {
      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Stop screen sharing if active
      if (screenTrackRef.current) {
        await clientRef.current?.unpublish(screenTrackRef.current);
        screenTrackRef.current.close();
      }

      // Stop and close local tracks
      localAudioTrack?.close();
      localVideoTrack?.close();

      // Leave the channel
      await clientRef.current?.leave();

      // Reset states
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      setRemoteUsers([]);
      setIsScreenSharing(false);

      console.log('✅ Cleanup completed');

    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  };

  const handleLeaveCall = async () => {
    await cleanup();
    onLeave?.();
  };

  const handleEndCall = async () => {
    await cleanup();
    onEnd?.();
  };

  // Render functions
  const renderLocalVideo = () => (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden border-2 border-cyan-500 shadow-2xl">
      <div 
        ref={localPlayerRef} 
        className="w-full h-48 md:h-64 bg-gray-900"
      ></div>
      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
        <User size={14} />
        <span>{userName} (You)</span>
        {isVideoOff && <VideoOff size={14} className="text-red-400" />}
        {isMuted && <MicOff size={14} className="text-red-400" />}
        {isScreenSharing && <Monitor size={14} className="text-green-400" />}
      </div>
    </div>
  );

  const renderRemoteVideo = (user) => (
    <div key={user.uid} className="relative bg-gray-800 rounded-xl overflow-hidden border-2 border-purple-500 shadow-xl">
      <div 
        ref={el => {
          if (el && user.videoTrack) {
            user.videoTrack.play(el);
          }
        }}
        className="w-full h-48 md:h-64 bg-gray-900"
      ></div>
      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
        Student {user.uid}
      </div>
    </div>
  );

  const renderConnectionStatus = () => {
    const statusConfig = {
      connecting: { text: 'Connecting...', color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
      connected: { text: 'Connected', color: 'text-green-400', bg: 'bg-green-400/20' },
      reconnecting: { text: 'Reconnecting...', color: 'text-orange-400', bg: 'bg-orange-400/20' },
      failed: { text: 'Connection Failed', color: 'text-red-400', bg: 'bg-red-400/20' },
      disconnected: { text: 'Disconnected', color: 'text-red-400', bg: 'bg-red-400/20' }
    };

    const status = statusConfig[connectionStatus] || statusConfig.connecting;

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full ${status.bg} ${status.color} text-sm font-medium`}>
        <div className={`w-2 h-2 rounded-full ${status.color.replace('text', 'bg')} mr-2 animate-pulse`}></div>
        {status.text}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800/80 border-b border-cyan-500/20">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Video className="text-cyan-400" size={24} />
            <h3 className="text-white text-xl font-bold">Madina Video Session</h3>
          </div>
          {renderConnectionStatus()}
          <div className="text-cyan-300 text-sm">
            {formatDuration(callDuration)}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={copyMeetingLink}
            className="flex items-center space-x-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-sm"
          >
            <Copy size={16} />
            <span>Copy Link</span>
          </button>
          
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm"
          >
            <Users size={16} />
            <span>{participantsCount}</span>
          </button>

          {isTeacher && (
            <MadinaButton
              onClick={handleEndCall}
              variant="danger"
              className="text-sm"
            >
              <PhoneOff size={16} className="mr-2" />
              End Session
            </MadinaButton>
          )}
          
          <MadinaButton
            onClick={handleLeaveCall}
            variant="ghost"
            className="text-sm"
          >
            <Phone size={16} className="mr-2" />
            Leave
          </MadinaButton>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Grid */}
        <div className="flex-1 p-4 overflow-auto">
          {isConnecting ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                <h4 className="text-2xl font-bold mb-2">Connecting to Madina Session</h4>
                <p className="text-cyan-300">Meeting ID: {meetingId}</p>
                <p className="text-cyan-200 mt-2">Please wait while we connect you...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
              {/* Local Video */}
              {renderLocalVideo()}

              {/* Remote Users */}
              {remoteUsers.map(renderRemoteVideo)}

              {/* Empty States */}
              {remoteUsers.length === 0 && (
                <div className="col-span-full flex items-center justify-center text-cyan-300">
                  <div className="text-center">
                    <Users size={64} className="mx-auto mb-4 opacity-50" />
                    <h4 className="text-2xl font-bold mb-2">Waiting for Students</h4>
                    <p className="text-lg">Share the meeting link with students to get started</p>
                    <p className="text-sm mt-2 text-cyan-400">
                      {participantsCount === 1 ? 'You are the only one here' : `${participantsCount} participants`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="w-80 bg-gray-800 border-l border-cyan-500/20">
            <div className="p-4 border-b border-cyan-500/20">
              <h4 className="text-white font-semibold flex items-center">
                <Users size={18} className="mr-2" />
                Participants ({participantsCount})
              </h4>
            </div>
            <div className="p-4 space-y-3">
              {/* Local User */}
              <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                  <span className="text-white font-medium">{userName} (You)</span>
                </div>
                <div className="flex space-x-1">
                  {isMuted && <MicOff size={14} className="text-red-400" />}
                  {isVideoOff && <VideoOff size={14} className="text-red-400" />}
                  {isScreenSharing && <Monitor size={14} className="text-green-400" />}
                </div>
              </div>

              {/* Remote Users */}
              {remoteUsers.map(user => (
                <div key={user.uid} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                    <span className="text-white">Student {user.uid}</span>
                  </div>
                  <Shield size={14} className="text-green-400" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-800/80 border-t border-cyan-500/20">
        <div className="flex justify-center items-center space-x-4 max-w-4xl mx-auto">
          {/* Audio Control */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
              isMuted 
                ? 'bg-red-600 hover:bg-red-500' 
                : 'bg-cyan-600 hover:bg-cyan-500'
            } text-white shadow-lg`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Video Control */}
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
              isVideoOff 
                ? 'bg-red-600 hover:bg-red-500' 
                : 'bg-cyan-600 hover:bg-cyan-500'
            } text-white shadow-lg`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
              isScreenSharing 
                ? 'bg-green-600 hover:bg-green-500' 
                : 'bg-cyan-600 hover:bg-cyan-500'
            } text-white shadow-lg`}
          >
            {isScreenSharing ? <StopCircle size={24} /> : <ScreenShare size={24} />}
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-4 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg transition-all duration-300 transform hover:scale-110"
          >
            <Settings size={24} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-4 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg transition-all duration-300 transform hover:scale-110"
          >
            {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
          </button>

          {/* End Call */}
          {isTeacher && (
            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all duration-300 transform hover:scale-110"
            >
              <PhoneOff size={24} />
            </button>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-cyan-500/30 rounded-xl p-4 shadow-2xl">
            <h5 className="text-white font-semibold mb-3">Video Settings</h5>
            <div className="space-y-3">
              <div>
                <label className="text-cyan-200 text-sm mb-2 block">Video Quality</label>
                <select 
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value)}
                  className="w-full bg-gray-700 border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
                >
                  <option value="360p">360p - Basic</option>
                  <option value="480p">480p - Standard</option>
                  <option value="720p">720p - HD</option>
                  <option value="1080p">1080p - Full HD</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;
