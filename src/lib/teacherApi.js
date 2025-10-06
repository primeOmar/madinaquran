// teacherApi.js - WITH YOUR AGORA APP ID
import { supabase } from './supabaseClient';

// ✅ YOUR AGORA APP ID
const AGORA_APP_ID = '5355da02bb0d48579214912e0d31193f';

const generateAgoraToken = async (channelName, uid = 0) => {
  try {
    console.log('🚀 Starting Agora token generation...');
    console.log('✅ Using App ID:', AGORA_APP_ID);
    
    // Try backend first if available
    if (process.env.REACT_APP_RENDER_URL) {
      try {
        console.log('🔄 Trying backend token generation...');
        const response = await fetch(`${process.env.REACT_APP_RENDER_URL}/api/agora/generate-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, uid, role: 'publisher' })
        });

        if (response.ok) {
          const tokenData = await response.json();
          console.log('✅ Token from backend');
          return tokenData;
        }
      } catch (error) {
        console.log('⚠️ Backend unavailable, using token-less mode');
      }
    }

    // Fallback: Token-less mode (Agora allows this for development)
    console.log('🎯 Using Agora token-less mode');
    return {
      token: null,
      appId: AGORA_APP_ID,
      channelName: channelName,
      uid: uid,
      isFallback: true,
      success: true
    };

  } catch (error) {
    console.error('❌ Token generation failed:', error);
    
    // Final fallback - always return the App ID
    return {
      token: null,
      appId: AGORA_APP_ID,
      channelName: channelName,
      uid: uid,
      isFallback: true,
      success: true
    };
  }
};

const teachervideoApi = {
  generateAgoraToken: generateAgoraToken,
  
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

      if (error) throw error;

      await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

      console.log('✅ Video session started:', meetingId);
      return data;
    } catch (error) {
      console.error('❌ Error starting video session:', error);
      throw error;
    }
  },

  getMyClasses: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          video_sessions (id, meeting_id, status, created_at)
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

      await supabase
        .from('classes')
        .update({ status: 'completed' })
        .eq('id', classId);

      console.log('✅ Video session ended');
    } catch (error) {
      console.error('❌ Error ending video session:', error);
      throw error;
    }
  }
};
 endVideoSession: async (meetingId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/video-sessions/${meetingId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to end session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error ending video session:', error);
      throw error;
    }
  },

  /**
   * Get active video sessions for a class
   */
  getActiveVideoSessions: async (classId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/classes/${classId}/active-sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get active sessions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw error;
    }
  },

  /**
   * Notify students that class has ended
   */
  notifyClassEnded: async (classId, sessionData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/classes/${classId}/notify-ended`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`
        },
        body: JSON.stringify({
          session_data: sessionData,
          ended_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to notify students: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error notifying students:', error);
      throw error;
    }
  }
};

console.log('🔧 teachervideoApi loaded with Agora App ID:', AGORA_APP_ID);
export default teachervideoApi;
