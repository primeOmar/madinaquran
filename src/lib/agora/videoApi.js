import { supabase } from '../supabaseClient';

const AGORA_APP_ID = '5355da02bb0d48579214912e0d31193f';

// Simple object with all functions directly defined
const videoApi = {
    generateAgoraToken: async (channelName, uid = 0) => {
    try {
      console.log('🚀 Generating Agora token for channel:', channelName);
      
      // ALWAYS return the App ID, even if token generation fails
      const baseResponse = {
        appId: AGORA_APP_ID, // This is the critical fix
        channelName: channelName,
        uid: uid,
        success: true
      };

      // Try backend token generation
      if (process.env.REACT_APP_RENDER_URL) {
        try {
          console.log('🔄 Trying backend token generation...');
          const response = await fetch(`${process.env.REACT_APP_RENDER_URL}/api/agora/generate-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              channelName, 
              uid, 
              role: 'publisher',
              appId: AGORA_APP_ID 
            })
          });

          if (response.ok) {
            const tokenData = await response.json();
            console.log('✅ Token from backend');
            return { ...baseResponse, ...tokenData };
          }
        } catch (error) {
          console.log('⚠️ Backend unavailable, using fallback');
        }
      }

      // Fallback: Token-less mode
      console.log('🎯 Using Agora token-less mode');
      return {
        ...baseResponse,
        token: null,
        isFallback: true
      };

    } catch (error) {
      console.error('❌ Token generation failed:', error);
      
      // CRITICAL: Always return appId even on error
      return {
        appId: AGORA_APP_ID,
        channelName: channelName,
        uid: uid,
        token: null,
        isFallback: true,
        success: true
      };
    }
  },  startVideoSession: async (classId) => {
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

  endVideoSession: async (meetingId) => {
    try {
      console.log('🛑 Ending video session:', meetingId);
      
      // Find session by meeting_id
      const { data: session, error: findError } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('meeting_id', meetingId)
        .single();

      if (findError) throw findError;

      // Update session status
      const { error: updateError } = await supabase
        .from('video_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('meeting_id', meetingId);

      if (updateError) throw updateError;

      // Update class status
      if (session.class_id) {
        await supabase
          .from('classes')
          .update({ status: 'scheduled' })
          .eq('id', session.class_id);
      }

      console.log('✅ Video session ended successfully');
      return { success: true, message: 'Session ended successfully' };
    } catch (error) {
      console.error('❌ Error ending video session:', error);
      throw error;
    }
  },

  getActiveVideoSessions: async (classId) => {
    try {
      const { data, error } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error getting active sessions:', error);
      throw error;
    }
  },

  notifyClassEnded: async (classId, sessionData) => {
    try {
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('students_classes')
        .select('student_id')
        .eq('class_id', classId);

      if (enrollmentError) throw enrollmentError;

      const notifications = enrollments.map(enrollment => ({
        student_id: enrollment.student_id,
        title: 'Class Session Ended',
        message: `The class session has ended. Duration: ${sessionData.duration} minutes.`,
        type: 'info',
        data: sessionData,
        created_at: new Date().toISOString()
      }));

      if (notifications.length > 0) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notificationError) throw notificationError;
      }

      console.log(`✅ Notified ${notifications.length} students`);
      return { success: true, notified_count: notifications.length };
    } catch (error) {
      console.error('❌ Error notifying students:', error);
      throw error;
    }
  },

  getMyClasses: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          video_sessions (*)
        `)
        .eq('teacher_id', teacherId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error fetching teacher classes:', error);
      throw error;
    }
  }
};

// Debug log
console.log('🎯 videoApi loaded with functions:', Object.keys(videoApi));
console.log('🎯 endVideoSession type:', typeof videoApi.endVideoSession);

export default videoApi;
