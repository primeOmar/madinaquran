// teacherApi.js - Agora and Video Calls Only
import { supabase } from './supabaseClient';

// ✅ YOUR AGORA APP ID
const AGORA_APP_ID = '5355da02bb0d48579214912e0d31193f';

// Agora Token Generation
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

// Start Video Session
const startVideoSession = async (classId) => {
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

    console.log('✅ Video session started:', meetingId);
    return data;
  } catch (error) {
    console.error('❌ Error starting video session:', error);
    throw error;
  }
};

// End Video Session
const endVideoSession = async (meetingId) => {
  try {
    // First try to find the session by meeting_id
    const { data: session, error: findError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (findError) throw findError;

    // Update session status to ended
    const { error: updateError } = await supabase
      .from('video_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('meeting_id', meetingId);

    if (updateError) throw updateError;

    // Update class status back to scheduled if session has a class_id
    if (session.class_id) {
      await supabase
        .from('classes')
        .update({ status: 'scheduled' })
        .eq('id', session.class_id);
    }

    console.log('✅ Video session ended:', meetingId);
    return { success: true, message: 'Session ended successfully' };
  } catch (error) {
    console.error('❌ Error ending video session:', error);
    throw error;
  }
};

// Get Active Video Sessions for a Class
const getActiveVideoSessions = async (classId) => {
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

// Notify Students that Class Has Ended
const notifyClassEnded = async (classId, sessionData) => {
  try {
    // Get all students in the class
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('students_classes')
      .select('student_id')
      .eq('class_id', classId);

    if (enrollmentError) throw enrollmentError;

    // Create notifications for each student
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

    console.log(`✅ Notified ${notifications.length} students about class end`);
    return { success: true, notified_count: notifications.length };
  } catch (error) {
    console.error('❌ Error notifying students:', error);
    throw error;
  }
};

// Get Teacher Classes (needed for video sessions)
const getMyClasses = async (teacherId) => {
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

// Main API Object - Only Video & Agora Functions
const teachervideoApi = {
  // Agora Functions
  generateAgoraToken,
  
  // Video Session Functions
  startVideoSession,
  endVideoSession,
  getActiveVideoSessions,
  notifyClassEnded,
  
  // Class Functions (needed for video sessions)
  getMyClasses
};

console.log('🔧 teachervideoApi loaded with Agora App ID:', AGORA_APP_ID);
export default teachervideoApi;
