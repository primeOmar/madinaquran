// teacherApi.js - Complete with all video functions
import { supabase } from './supabaseClient';

// ✅ YOUR AGORA APP ID
const AGORA_APP_ID = '5355da02bb0d48579214912e0d31193f';

// Agora Token Generation
export const generateAgoraToken = async (channelName, uid = 0) => {
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

    // Fallback: Token-less mode
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
    
    // Final fallback
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

// Start Video Session
export const startVideoSession = async (classId) => {
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
};

// End Video Session
export const endVideoSession = async (meetingId) => {
  try {
    console.log('🛑 Ending video session:', meetingId);
    
    // Find session by meeting_id
    const { data: session, error: findError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (findError) {
      console.error('❌ Session not found:', findError);
      throw findError;
    }

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
};

// Get Active Video Sessions
export const getActiveVideoSessions = async (classId) => {
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
};

// Notify Students
export const notifyClassEnded = async (classId, sessionData) => {
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
};

// Get Teacher Classes
export const getMyClasses = async (teacherId) => {
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
};

// Main API Object
const teachervideoApi = {
  generateAgoraToken,
  startVideoSession,
  endVideoSession,
  getActiveVideoSessions,
  notifyClassEnded,
  getMyClasses
};

// Debug: Check if all functions are properly attached
console.log('🔧 teachervideoApi loaded with functions:', Object.keys(teachervideoApi));
console.log('🔧 endVideoSession function type:', typeof teachervideoApi.endVideoSession);

export default teachervideoApi;
