// hooks/useVideoCall.js - FIXED VERSION
import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  // Refs for proper state management
  const agoraEngineRef = useRef(null);
  const screenTrackRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const isJoiningRef = useRef(false);
  const isLeavingRef = useRef(false);
  const joinPromiseRef = useRef(null);

  // Initialize Agora client
  useEffect(() => {
    if (!agoraEngineRef.current) {
      agoraEngineRef.current = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });
      
      // Setup event listeners
      agoraEngineRef.current.on("user-published", handleUserPublished);
      agoraEngineRef.current.on("user-unpublished", handleUserUnpublished);
      agoraEngineRef.current.on("user-left", handleUserLeft);
      agoraEngineRef.current.on("connection-state-change", (state) => {
        console.log('🔗 Agora connection state:', state);
      });
    }

    return () => {
      // Cleanup on unmount
      cleanup();
    };
  }, []);

  // Handle remote user publishing
  const handleUserPublished = useCallback(async (user, mediaType) => {
    try {
      console.log('👤 User published:', { uid: user.uid, mediaType });
      
      await agoraEngineRef.current.subscribe(user, mediaType);
      
      setRemoteUsers(prev => {
        const existingUser = prev.find(u => u.uid === user.uid);
        if (existingUser) {
          return prev.map(u => 
            u.uid === user.uid 
              ? { 
                  ...u, 
                  [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: user[mediaType === 'audio' ? 'audioTrack' : 'videoTrack'],
                  hasAudio: mediaType === 'audio' ? true : u.hasAudio,
                  hasVideo: mediaType === 'video' ? true : u.hasVideo
                }
              : u
          );
        }
        return [...prev, {
          uid: user.uid,
          audioTrack: mediaType === 'audio' ? user.audioTrack : null,
          videoTrack: mediaType === 'video' ? user.videoTrack : null,
          hasAudio: mediaType === 'audio',
          hasVideo: mediaType === 'video',
          name: `User ${user.uid}`
        }];
      });

      // Auto-play audio
      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play().catch(err => 
          console.warn('Could not auto-play audio:', err)
        );
      }
    } catch (err) {
      console.error('Error subscribing to user:', err);
    }
  }, []);

  // Handle remote user unpublishing
  const handleUserUnpublished = useCallback((user, mediaType) => {
    console.log('👤 User unpublished:', { uid: user.uid, mediaType });
    
    setRemoteUsers(prev => 
      prev.map(u => 
        u.uid === user.uid 
          ? { 
              ...u, 
              [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: null,
              hasAudio: mediaType === 'audio' ? false : u.hasAudio,
              hasVideo: mediaType === 'video' ? false : u.hasVideo
            }
          : u
      )
    );
  }, []);

  // Handle remote user leaving
  const handleUserLeft = useCallback((user) => {
    console.log('👤 User left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  }, []);

  // Cleanup tracks
  const cleanupTracks = useCallback(() => {
    console.log('🧹 Cleaning up tracks...');
    
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
    if (originalVideoTrackRef.current) {
      originalVideoTrackRef.current.close();
      originalVideoTrackRef.current = null;
    }
  }, [localAudioTrack, localVideoTrack]);

  // Complete cleanup
  const cleanup = useCallback(async () => {
    console.log('🧹 Complete cleanup...');
    
    try {
      // Stop screen share first
      if (isScreenSharing && screenTrackRef.current) {
        await agoraEngineRef.current?.unpublish(screenTrackRef.current).catch(() => {});
      }
      
      // Unpublish local tracks
      if (localAudioTrack || localVideoTrack) {
        await agoraEngineRef.current?.unpublish([localAudioTrack, localVideoTrack].filter(Boolean)).catch(() => {});
      }
      
      // Leave channel
      if (agoraEngineRef.current && agoraEngineRef.current.connectionState !== 'DISCONNECTED') {
        await agoraEngineRef.current.leave().catch(() => {});
      }
      
      // Cleanup tracks
      cleanupTracks();
      
      // Reset state
      setRemoteUsers([]);
      setIsInCall(false);
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      setIsScreenSharing(false);
      setError(null);
      
      isJoiningRef.current = false;
      isLeavingRef.current = false;
      joinPromiseRef.current = null;
      
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
  }, [localAudioTrack, localVideoTrack, isScreenSharing, cleanupTracks]);

  // Check if already connected
  const isAlreadyConnected = useCallback(() => {
    return agoraEngineRef.current && 
           agoraEngineRef.current.connectionState === 'CONNECTED';
  }, []);

  // Check if currently connecting
  const isCurrentlyConnecting = useCallback(() => {
    return isJoiningRef.current || 
           (agoraEngineRef.current && 
            agoraEngineRef.current.connectionState === 'CONNECTING');
  }, []);

  // Start call (for teachers)
  const startCall = async (classId, userId) => {
    // Prevent multiple simultaneous calls
    if (isCurrentlyConnecting()) {
      console.log('⏳ Start call already in progress, returning existing promise');
      return joinPromiseRef.current;
    }

    if (isAlreadyConnected()) {
      console.log('✅ Already connected to call');
      return { success: true };
    }

    setIsLoading(true);
    setError(null);
    isJoiningRef.current = true;

    const joinPromise = (async () => {
      try {
        console.log('🚀 START CALL: Starting video session:', { classId, userId });

        // Get Agora configuration from backend
        const config = await videoApi.startVideoSession(classId, userId);
        
        if (!config.success) {
          throw new Error(config.error || 'Failed to start video session');
        }

        console.log('✅ START CALL: Got config:', {
          channel: config.channel,
          uid: config.uid,
          meetingId: config.meetingId
        });

        // Join Agora channel
        console.log('🔗 START CALL: Joining Agora channel...');
        const agoraUid = await agoraEngineRef.current.join(
          config.appId,
          config.channel,
          config.token,
          config.uid
        );

        console.log('✅ START CALL: Joined Agora channel, UID:', agoraUid);

        // Create local tracks
        console.log('🎥 START CALL: Creating local tracks...');
        const [microphoneTrack, cameraTrack] = await Promise.all([
          AgoraRTC.createMicrophoneAudioTrack().catch(err => {
            console.error('Failed to create microphone track:', err);
            throw new Error('Microphone access denied. Please allow microphone permissions.');
          }),
          AgoraRTC.createCameraVideoTrack().catch(err => {
            console.error('Failed to create camera track:', err);
            throw new Error('Camera access denied. Please allow camera permissions.');
          })
        ]);

        setLocalAudioTrack(microphoneTrack);
        setLocalVideoTrack(cameraTrack);

        // Publish tracks
        console.log('📤 START CALL: Publishing local tracks...');
        await agoraEngineRef.current.publish([microphoneTrack, cameraTrack]);

        console.log('✅ START CALL: Published local tracks');
        setIsInCall(true);

        return {
          success: true,
          meetingId: config.meetingId,
          channel: config.channel,
          uid: agoraUid
        };

      } catch (err) {
        console.error('❌ START CALL: Video session start failed:', err);
        const errorMessage = err.message || 'Failed to start video session';
        setError(errorMessage);
        
        // Cleanup on error
        await cleanup();
        
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
        isJoiningRef.current = false;
        joinPromiseRef.current = null;
      }
    })();

    joinPromiseRef.current = joinPromise;
    return joinPromise;
  };

  // Join call (for students)
  const joinCall = async (meetingId, userId) => {
    // Prevent multiple simultaneous joins
    if (isCurrentlyConnecting()) {
      console.log('⏳ Join already in progress, returning existing promise');
      return joinPromiseRef.current;
    }

    if (isAlreadyConnected()) {
      console.log('✅ Already connected to call');
      return { success: true };
    }

    setIsLoading(true);
    setError(null);
    isJoiningRef.current = true;

    const joinPromise = (async () => {
      try {
        console.log('🚀 JOIN CALL: Joining video session:', { meetingId, userId });

        // Get Agora configuration from backend
        const config = await videoApi.joinVideoSession(meetingId, userId);
        
        if (!config.success) {
          throw new Error(config.error || 'Failed to join video session');
        }

        console.log('✅ JOIN CALL: Got config:', {
          channel: config.channel,
          uid: config.uid,
          meetingId: config.meetingId
        });

        // Join Agora channel
        console.log('🔗 JOIN CALL: Joining Agora channel...');
        const agoraUid = await agoraEngineRef.current.join(
          config.appId,
          config.channel,
          config.token,
          config.uid
        );

        console.log('✅ JOIN CALL: Joined Agora channel, UID:', agoraUid);

        // Create local tracks
        console.log('🎥 JOIN CALL: Creating local tracks...');
        const [microphoneTrack, cameraTrack] = await Promise.all([
          AgoraRTC.createMicrophoneAudioTrack().catch(err => {
            console.error('Failed to create microphone track:', err);
            throw new Error('Microphone access denied. Please allow microphone permissions.');
          }),
          AgoraRTC.createCameraVideoTrack().catch(err => {
            console.error('Failed to create camera track:', err);
            throw new Error('Camera access denied. Please allow camera permissions.');
          })
        ]);

        setLocalAudioTrack(microphoneTrack);
        setLocalVideoTrack(cameraTrack);

        // Publish tracks
        console.log('📤 JOIN CALL: Publishing local tracks...');
        await agoraEngineRef.current.publish([microphoneTrack, cameraTrack]);

        console.log('✅ JOIN CALL: Published local tracks');
        setIsInCall(true);

        return {
          success: true,
          meetingId: config.meetingId || meetingId,
          channel: config.channel,
          uid: agoraUid
        };

      } catch (err) {
        console.error('❌ JOIN CALL: Video session join failed:', err);
        const errorMessage = err.message || 'Failed to join video session';
        setError(errorMessage);
        
        // Cleanup on error
        await cleanup();
        
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
        isJoiningRef.current = false;
        joinPromiseRef.current = null;
      }
    })();

    joinPromiseRef.current = joinPromise;
    return joinPromise;
  };

  // Leave call
  const leaveCall = async () => {
    // Prevent multiple simultaneous leaves
    if (isLeavingRef.current) {
      console.log('⏳ Leave already in progress');
      return { success: true };
    }

    isLeavingRef.current = true;
    setIsLoading(true);

    try {
      console.log('🚪 LEAVE CALL: Leaving call...');

      await cleanup();

      console.log('✅ LEAVE CALL: Successfully left call');
      return { success: true };
    } catch (err) {
      console.error('❌ LEAVE CALL: Error leaving call:', err);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
      isLeavingRef.current = false;
    }
  };

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!localAudioTrack) return;

    try {
      await localAudioTrack.setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
      console.log(isAudioMuted ? '🔇 Audio muted' : '🎤 Audio unmuted');
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
      console.log(isVideoMuted ? '📹 Video disabled' : '📹 Video enabled');
    } catch (err) {
      console.error('Error toggling video:', err);
    }
  }, [localVideoTrack, isVideoMuted]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        console.log('🖥️ Stopping screen share...');
        
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
        console.log('✅ Screen share stopped');
      } else {
        // Start screen sharing
        console.log('🖥️ Starting screen share...');
        
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p_1",
          optimizationMode: "detail"
        });
        
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
          console.log('🖥️ Screen share ended by browser');
          toggleScreenShare();
        });

        console.log('✅ Screen share started');
      }
    } catch (err) {
      console.error('Error toggling screen share:', err);
      setIsScreenSharing(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Screen share permission denied');
      } else if (err.name === 'NotFoundError') {
        setError('No screen share source available');
      } else {
        setError('Failed to start screen share');
      }
    }
  }, [isScreenSharing, localVideoTrack]);

  return {
    // State
    isLoading,
    error,
    isInCall,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    
    // Actions
    startCall,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    
    // Utility functions (for debugging)
    getConnectionState: () => agoraEngineRef.current?.connectionState,
    isConnecting: isCurrentlyConnecting
  };
};
