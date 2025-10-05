// teacherApi.js - Fixed with proper backend calls
import { supabase } from './supabaseClient';

const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

const teacherApi = {
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

      if (error) throw error;

      await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

      return data;
    } catch (error) {
      console.error('Error starting video session:', error);
      throw error;
    }
  },

  // Generate Agora token - CALLS YOUR BACKEND
  generateAgoraToken: async (channelName, uid = 0) => {
    try {
      console.log('Calling backend for Agora token...');
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName,
          uid,
          role: 'publisher'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('Token received from backend');
      return tokenData;
      
    } catch (error) {
      console.error('Error calling token backend:', error);
      
      // Fallback for development
      return {
        token: null, // Temporary token-less mode
        appId: process.env.REACT_APP_AGORA_APP_ID,
        channelName: channelName,
        uid: uid
      };
    }
  },

  // Get classes
  getMyClasses: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
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
      console.error('Error fetching teacher classes:', error);
      throw error;
    }
  }
};

export default teacherApi;
