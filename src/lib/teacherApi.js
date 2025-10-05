// teacherApi.js - With fallback and timeout handling
import { supabase } from './supabaseClient';

const teacherApi = {
  // Start video session (on Render)
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

      // Update class status
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

  // Smart token generation with multiple fallbacks
  generateAgoraToken: async (channelName, uid = 0) => {
    const timeout = 8000; // 8 second timeout
    
    try {
      console.log('🔄 Getting token from Render backend...');

      // Try Render backend first (primary)
      const renderPromise = fetch(`${process.env.REACT_APP_RENDER_URL}/api/agora/generate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName,
          uid,
          role: 'publisher'
        })
      });

      // Race between fetch and timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      );

      const response = await Promise.race([renderPromise, timeoutPromise]);
      
      if (!response.ok) {
        throw new Error(`Render backend error: ${response.status}`);
      }

      const tokenData = await response.json();
      
      if (tokenData.success) {
        console.log('✅ Token from Render backend');
        return tokenData;
      } else {
        throw new Error('Render backend returned error');
      }

    } catch (error) {
      console.log('⚠️ Render backend failed, using development mode:', error.message);
      
      // Fallback: Development mode (no token)
      return {
        success: true,
        token: null, // Token-less mode for development
        appId: process.env.REACT_APP_AGORA_APP_ID,
        channelName: channelName,
        uid: uid,
        isFallback: true
      };
    }
  },

  // Get classes (from Render/Supabase)
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
  },

  // Check video service health
  checkVideoHealth: async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_RENDER_URL}/api/agora/health`, {
        timeout: 5000
      });
      return await response.json();
    } catch (error) {
      return { status: 'unavailable', error: error.message };
    }
  }
};

export default teacherApi;
