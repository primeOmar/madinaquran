
import { supabase } from './supabaseClient';

// Production Agora token generation with multiple fallbacks
const generateAgoraToken = async (channelName, uid = 0) => {
  const AGORA_APP_ID = process.env.REACT_APP_AGORA_APP_ID;
  
  // Fallback token data for production
  const fallbackTokenData = {
    token: null, // Agora allows token-less mode in development
    appId: AGORA_APP_ID,
    channelName: channelName,
    uid: uid,
    isFallback: true,
    success: true
  };

  // If no App ID, return fallback immediately
  if (!AGORA_APP_ID) {
    console.warn('⚠️ AGORA_APP_ID not configured, using fallback mode');
    return fallbackTokenData;
  }

  try {
    console.log('🔄 Generating Agora token for channel:', channelName);

    // Method 1: Try Render backend with timeout
    if (process.env.REACT_APP_RENDER_URL) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(`${process.env.REACT_APP_RENDER_URL}/api/agora/generate-token`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            channelName,
            uid,
            role: 'publisher'
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const tokenData = await response.json();
          console.log('✅ Token received from backend');
          return { ...tokenData, source: 'backend' };
        } else {
          console.warn('⚠️ Backend returned error status:', response.status);
        }
      } catch (backendError) {
        console.warn('⚠️ Backend unavailable:', backendError.message);
      }
    }

    // Method 2: Token-less mode (Agora allows this for limited usage)
    console.log('🎯 Using Agora token-less mode');
    return fallbackTokenData;

  } catch (error) {
    console.error('❌ Token generation failed:', error);
    return fallbackTokenData;
  }
};

// Production API object
const teachervideoApi = {
  // Start video session
  startVideoSession: async (classId) => {
    try {
      const meetingId = `class_${classId}_${Date.now()}`;
      
      const { data, error } = await supabase
        .from('video_sessions')
        .insert([
          {
            class_id: classId,
            meeting_id: meetingId,
            status: 'active',
            started_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Database error starting session:', error);
        throw error;
      }

      // Update class status
      await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

      console.log('✅ Video session started:', meetingId);
      return data;

    } catch (error) {
      console.error('❌ Error starting video session:', error);
      throw new Error(`Failed to start video session: ${error.message}`);
    }
  },

  // Generate Agora token - PRODUCTION VERSION
  generateAgoraToken: generateAgoraToken,

  // Get teacher's classes
  getMyClasses: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          students_classes (
            student_id,
            students (id, name, email)
          ),
          video_sessions (
            id,
            meeting_id,
            status,
            created_at
          )
        `)
        .eq('teacher_id', teacherId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error fetching teacher classes:', error);
      throw error;
    }
  },

  // End video session
  endVideoSession: async (sessionId, classId) => {
    try {
      const { error } = await supabase
        .from('video_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Update class status
      await supabase
        .from('classes')
        .update({ status: 'completed' })
        .eq('id', classId);

      console.log('✅ Video session ended:', sessionId);
    } catch (error) {
      console.error('❌ Error ending video session:', error);
      throw error;
    }
  },

  // Health check
  checkVideoHealth: async () => {
    try {
      if (!process.env.REACT_APP_RENDER_URL) {
        return { status: 'development', videoEnabled: true };
      }

      const response = await fetch(`${process.env.REACT_APP_RENDER_URL}/api/agora/health`);
      if (response.ok) {
        return await response.json();
      }
      return { status: 'backend_unavailable' };
    } catch (error) {
      return { status: 'unavailable', error: error.message };
    }
  }
};

// Add debug information
console.log('🔧 teachervideoApi loaded successfully');
console.log('🔧 generateAgoraToken function:', typeof teachervideoApi.generateAgoraToken);

export default teachervideoApi;
