import { supabase } from './supabaseClient';

// Helper function to get auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

export const teachervideoApi = {
  // Start a new video session for a class
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

      // Update class status to active
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

  // End a video session
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

      // Update class status to completed
      await supabase
        .from('classes')
        .update({ status: 'completed' })
        .eq('id', classId);

    } catch (error) {
      console.error('Error ending video session:', error);
      throw error;
    }
  },

  // Get active video sessions for a teacher
  getActiveSessions: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (
            id,
            title,
            teacher_id
          )
        `)
        .eq('status', 'active')
        .eq('class.teacher_id', teacherId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      throw error;
    }
  },

  // Generate Agora token (call your backend API)
  generateAgoraToken: async (channelName, uid = 0) => {
    try {
      // This calls your Render backend endpoint
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          channelName,
          uid,
          role: 'publisher' // teacher is publisher
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate token: ${response.statusText}`);
      }

      const tokenData = await response.json();
      return tokenData;
    } catch (error) {
      console.error('Error generating Agora token:', error);
      throw error;
    }
  },

  // Get teacher's classes (needed for video sessions)
  getMyClasses: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          students_classes (
            student_id,
            students (
              id,
              name,
              email
            )
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
      console.error('Error fetching teacher classes:', error);
      throw error;
    }
  }
};
