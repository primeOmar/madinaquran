import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, Users, Monitor } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const TeacherVideoCall = ({ classItem, isOpen, onClose }) => {
  // Minimal state
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');

  // Refs
  const localVideoRef = useRef(null);
  const timerRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const agoraClientRef = useRef(null);

  // API Base URL
  const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

  // Debug logging
  const log = useCallback((message, data) => {
    console.log(`🎯 ${message}`, data || '');
  }, []);

  // Cleanup function
  const cleanup = useCallback(async () => {
    log('Cleaning up...');
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Stop and cleanup tracks
    if (localTracksRef.current.audio) {
      localTracksRef.current.audio.stop();
      localTracksRef.current.audio.close();
    }
    if (localTracksRef.current.video) {
      localTracksRef.current.video.stop();
      localTracksRef.current.video.close();
    }
    
    // Leave Agora channel
    if (agoraClientRef.current) {
      await agoraClientRef.current.leave();
    }
    
    setIsConnected(false);
    setCallDuration(0);
  }, [log]);

  // Start session - Minimal and robust
  const startSession = useCallback(async () => {
    if (!isOpen || !classItem?.id) return;

    try {
      setError('');
      log('Starting session...');

      // 1. Get media permissions first
      log('Requesting media permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      stream.getTracks().forEach(track => track.stop());
      log('Permissions granted');

      // 2. Call backend to join session
      log('Calling backend API...');
      const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: `class_${classItem.id}_${Date.now()}`,
          user_id: 'teacher-user-id', // You'll need to get this from auth
          user_type: 'teacher',
          user_name: 'Teacher'
        })
      });

      if (!response.ok) throw new Error('API call failed');
      
      const sessionData = await response.json();
      log('Backend response:', sessionData);

      if (!sessionData.success) throw new Error(sessionData.error);

      const { channel, token, appId, uid } = sessionData;

      // 3. Create Agora client and join
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      agoraClientRef.current = client;

      // 4. Create and publish local tracks
      log('Creating local tracks...');
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      
      localTracksRef.current.audio = audioTrack;
      localTracksRef.current.video = videoTrack;

      // 5. Play local video
      if (localVideoRef.current) {
        await videoTrack.play(localVideoRef.current);
        log('Local video playing');
      }

      // 6. Join channel and publish tracks
      log('Joining Agora channel...');
      await client.join(appId, channel, token, uid);
      await client.publish([audioTrack, videoTrack]);
      
      log('Connected to Agora!');
      setIsConnected(true);

      // 7. Start call timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // 8. Handle remote users
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        log(`User ${user.uid} joined`);
        
        if (mediaType === 'video' && user.videoTrack) {
          // Create and play remote video element
          const remoteVideoContainer = document.getElementById('remote-videos');
          if (remoteVideoContainer) {
            const videoElement = document.createElement('div');
            videoElement.id = `remote-${user.uid}`;
            videoElement.className = 'remote-video';
            remoteVideoContainer.appendChild(videoElement);
            user.videoTrack.play(videoElement);
          }
        }
      });

    } catch (error) {
      log('Session failed:', error);
      setError(error.message);
      await cleanup();
    }
  }, [isOpen, classItem, cleanup, log]);

  // Control functions
  const toggleAudio = useCallback(async () => {
    if (localTracksRef.current.audio) {
      await localTracksRef.current.audio.setEnabled(isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  }, [isAudioMuted]);

  const toggleVideo = useCallback(async () => {
    if (localTracksRef.current.video) {
      await localTracksRef.current.video.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  }, [isVideoOff]);

  const endCall = useCallback(async () => {
    await cleanup();
    onClose();
  }, [cleanup, onClose]);

  // Effects
  useEffect(() => {
    if (isOpen) {
      startSession();
    }

    return () => {
      cleanup();
    };
  }, [isOpen, startSession, cleanup]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <h2 className="text-lg font-bold">{classItem?.title || 'Class Session'}</h2>
            <div className="text-sm text-gray-300">
              {isConnected ? `Live • ${formatTime(callDuration)}` : 'Connecting...'}
            </div>
          </div>
        </div>
        
        <button 
          onClick={endCall}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Phone size={18} />
          End Class
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-600 text-white p-4 mx-4 mt-4 rounded-lg flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-xl">×</button>
        </div>
      )}

      {/* Video Area */}
      <div className="flex-1 relative p-4">
        {/* Remote Videos */}
        <div id="remote-videos" className="w-full h-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Remote videos will be inserted here automatically */}
        </div>

        {/* Local Video PIP */}
        <div className="absolute bottom-4 right-4 w-64 h-48 bg-black rounded-xl overflow-hidden border-2 border-green-500">
          <div ref={localVideoRef} className="w-full h-full bg-gray-800" />
          
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="text-gray-500 w-8 h-8" />
            </div>
          )}

          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            You (Teacher)
          </div>

          <div className="absolute top-2 right-2 flex gap-1">
            {isAudioMuted && <div className="bg-red-500 p-1 rounded"><MicOff size={12} /></div>}
            {isVideoOff && <div className="bg-red-500 p-1 rounded"><VideoOff size={12} /></div>}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-6">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={toggleAudio}
            disabled={!isConnected}
            className={`p-4 rounded-2xl transition-all ${
              isAudioMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } disabled:opacity-50`}
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          <button
            onClick={toggleVideo}
            disabled={!isConnected}
            className={`p-4 rounded-2xl transition-all ${
              isVideoOff 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } disabled:opacity-50`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          <button className="p-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white">
            <Monitor size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherVideoCall;
