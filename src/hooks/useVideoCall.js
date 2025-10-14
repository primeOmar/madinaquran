// hooks/useVideoCall.js - PRODUCTION HOOK
import { useState, useEffect, useRef } from 'react';
import videoApi from '../lib/Agora/videoApi';

export const useVideoCall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const localTracks = useRef([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localTracks.current.length > 0) {
        localTracks.current.forEach(track => track.close());
        localTracks.current = [];
      }
    };
  }, []);

  const startCall = async (classId, userId) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await videoApi.startVideoSession(classId, userId);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Setup local video and audio tracks
      try {
        const [microphoneTrack, cameraTrack] = await Promise.all([
          AgoraRTC.createMicrophoneAudioTrack(),
          AgoraRTC.createCameraVideoTrack()
        ]);

        localTracks.current = [microphoneTrack, cameraTrack];
        
        // Publish tracks to channel
        await videoApi.getAgoraEngine().publish(localTracks.current);
        
        setIsInCall(true);
        return result;
      } catch (trackError) {
        await videoApi.leaveVideoSession();
        throw new Error(`MEDIA_SETUP_FAILED: ${trackError.message}`);
      }
      
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const joinCall = async (meetingId, userId) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await videoApi.joinVideoSession(meetingId, userId);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      setIsInCall(true);
      return result;
      
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const leaveCall = async () => {
    try {
      setIsLoading(true);
      await videoApi.leaveVideoSession();
      setIsInCall(false);
      setError(null);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    startCall,
    joinCall,
    leaveCall,
    isLoading,
    error,
    isInCall,
    isAgoraInitialized: videoApi.isAgoraInitialized()
  };
};
