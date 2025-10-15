// hooks/useVideoCall.js - PRODUCTION READY
import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoApi from '../lib/agora/videoApi';

export const useVideoCall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const agoraEngineRef = useRef(null);
  const screenTrackRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  // Initialize Agora client
  useEffect(() => {
    if (!agoraEngineRef.current) {
      agoraEngineRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      
      // Setup event listeners
      agoraEngineRef.current.on("user-published", handleUserPublished);
      agoraEngineRef.current.on("user-unpublished", handleUserUnpublished);
      agoraEngineRef.current.on("user-left", handleUserLeft);
    }

    return () => {
      // Cleanup on unmount
      if (agoraEngineRef.current) {
        agoraEngineRef.current.removeAllListeners();
      }
      cleanupTracks();
    };
  }, []);

  // Handle remote user publishing
  const handleUserPublished = useCallback(async (user, mediaType) => {
    try {
      await agoraEngineRef.current.subscribe(user, mediaType);
      
      setRemoteUsers(prev => {
        const existingUser = prev.find(u => u.uid === user.uid);
        if (existingUser) {
          return prev.map(u => 
            u.uid === user.uid 
              ? { ...u, [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: user[mediaType === 'audio' ? 'audioTrack' : 'videoTrack'] }
              : u
          );
        }
        return [...prev, {
          uid: user.uid,
          audioTrack: mediaType === 'audio' ? user.audioTrack : null,
          videoTrack: mediaType === 'video' ? user.videoTrack : null,
          name: `User ${user.uid}`
        }];
      });

      // Auto-play audio
      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play();
      }
    } catch (err) {
      console.error('Error subscribing to user:', err);
    }
  }, []);

  // Handle remote user unpublishing
  const handleUserUnpublished = useCallback((user, mediaType) => {
    setRemoteUsers(prev => 
      prev.map(u => 
        u.uid === user.uid 
          ? { ...u, [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: null }
          : u
      )
    );
  }, []);

  // Handle remote user leaving
  const handleUserLeft = useCallback((user) => {
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  }, []);

  // Cleanup tracks
  const cleanupTracks = useCallback(() => {
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
  }, [localAudioTrack, localVideoTrack]);

  // Start call (for teachers)
  const startCall = async (classId, userId) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🚀 Starting video session:', { classId, userId });

      // Get Agora configuration from backend
      const config = await videoApi.startVideoSession(classId, userId);
      
      if (!config.success) {
        throw new Error(config.error || 'Failed to start video session');
      }

      console.log('✅ Got config:', config);

      // Join Agora channel
      await agoraEngineRef.current.join(
        config.appId,
        config.channel,
        config.token,
        userId
      );

      console.log('✅ Joined Agora channel');

      // Create local tracks
      const [microphoneTrack, cameraTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
      ]);

      console.log('✅ Created local tracks');

      setLocalAudioTrack(microphoneTrack);
      setLocalVideoTrack(cameraTrack);

      // Publish tracks
      await agoraEngineRef.current.publish([microphoneTrack, cameraTrack]);

      console.log('✅ Published local tracks');

      setIsInCall(true);

      return {
        success: true,
        meetingId: config.meetingId,
        channel: config.channel
      };

    } catch (err) {
      console.error('❌ Video session start failed:', err);
      const errorMessage = err.message || 'Failed to start video session';
      setError(errorMessage);
      
      // Cleanup on error
      cleanupTracks();
      if (agoraEngineRef.current) {
        await agoraEngineRef.current.leave().catch(() => {});
      }

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Join call (for students)
  const joinCall = async (meetingId, userId) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🚀 Joining video session:', { meetingId, userId });

      // Get Agora configuration from backend
      const config = await videoApi.joinVideoSession(meetingId, userId);
      
      if (!config.success) {
        throw new Error(config.error || 'Failed to join video session');
      }

      console.log('✅ Got config:', config);

      // Join Agora channel
      await agoraEngineRef.current.join(
        config.appId,
        config.channel,
        config.token,
        userId
      );

      console.log('✅ Joined Agora channel');

      // Create local tracks
      const [microphoneTrack, cameraTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
      ]);

      console.log('✅ Created local tracks');

      setLocalAudioTrack(microphoneTrack);
      setLocalVideoTrack(cameraTrack);

      // Publish tracks
      await agoraEngineRef.current.publish([microphoneTrack, cameraTrack]);

      console.log('✅ Published local tracks');

      setIsInCall(true);

      return {
        success: true,
        meetingId: config.meetingId || meetingId,
        channel: config.channel
      };

    } catch (err) {
      console.error('❌ Video session join failed:', err);
      const errorMessage = err.message || 'Failed to join video session';
      setError(errorMessage);
      
      // Cleanup on error
      cleanupTracks();
      if (agoraEngineRef.current) {
        await agoraEngineRef.current.leave().catch(() => {});
      }

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Leave call
  const leaveCall = async () => {
    try {
      setIsLoading(true);

      // Unpublish tracks
      if (localAudioTrack || localVideoTrack) {
        await agoraEngineRef.current.unpublish([localAudioTrack, localVideoTrack].filter(Boolean));
      }

      // Leave channel
      await agoraEngineRef.current.leave();

      // Cleanup
      cleanupTracks();
      setRemoteUsers([]);
      setIsInCall(false);
      setError(null);
      setIsScreenSharing(false);

      // Notify backend
      await videoApi.leaveVideoSession().catch(err => 
        console.warn('Failed to notify backend of leave:', err)
      );

      return { success: true };
    } catch (err) {
      console.error('Error leaving call:', err);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!localAudioTrack) return;

    try {
      await localAudioTrack.setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    } catch (err) {
      console.error('Error toggling audio:', err);
    }
  }, [localAudioTrack, isAudioMuted]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localVideoTrack) return;

    try {
      await localVideoTrack.setEnabled(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    } catch (err) {
      console.error('Error toggling video:', err);
    }
  }, [localVideoTrack, isVideoMuted]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenTrackRef.current) {
          await agoraEngineRef.current.unpublish(screenTrackRef.current);
          screenTrackRef.current.close();
          screenTrackRef.current = null;
        }

        // Restore original video
        if (originalVideoTrackRef.current) {
          await agoraEngineRef.current.publish(originalVideoTrackRef.current);
          setLocalVideoTrack(originalVideoTrackRef.current);
          originalVideoTrackRef.current = null;
        }

        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenTrack = await AgoraRTC.createScreenVideoTrack();
        
        // Save original video track
        originalVideoTrackRef.current = localVideoTrack;

        // Unpublish video and publish screen
        if (localVideoTrack) {
          await agoraEngineRef.current.unpublish(localVideoTrack);
        }
        await agoraEngineRef.current.publish(screenTrack);

        screenTrackRef.current = screenTrack;
        setLocalVideoTrack(screenTrack);
        setIsScreenSharing(true);

        // Handle screen share stop
        screenTrack.on('track-ended', () => {
          toggleScreenShare();
        });
      }
    } catch (err) {
      console.error('Error toggling screen share:', err);
      setIsScreenSharing(false);
    }
  }, [isScreenSharing, localVideoTrack]);

  return {
    startCall,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    isLoading,
    error,
    isInCall,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing
  };
};
