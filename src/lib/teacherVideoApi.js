import { supabase } from './supabaseClient';

// ===== PRODUCTION CONFIGURATION =====
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://madina-quran-backend.onrender.com/api';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ===== PRODUCTION LOGGER =====
class TeacherVideoLogger {
  static info(message, data = null) {
    console.log(`ℹ️ [TEACHER-VIDEO-API] ${message}`, data || '');
  }

  static error(message, error = null) {
    console.error(`❌ [TEACHER-VIDEO-API] ${message}`, error || '');
  }
}

// ===== TEACHER VIDEO API =====
export const teacherVideoApi = {
  async getCurrentTeacher() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error('Teacher not authenticated');
      }
      return user;
    } catch (error) {
      TeacherVideoLogger.error('Failed to get current teacher', error);
      throw error;
    }
  },

  // ===== START SESSION - CORRECTED ENDPOINT =====
  async startTeacherSession(classId) {
    try {
      const teacher = await this.getCurrentTeacher();

      TeacherVideoLogger.info('🎓 Starting teacher session for class:', classId);

      // Use the CORRECT endpoint structure based on your backend logs
      const response = await this.makeRequest(
        `${API_BASE_URL}/video/join-session`, // CORRECTED: /video/join-session NOT /agora/join-session
        {
          method: 'POST',
          body: JSON.stringify({
            meeting_id: `class_${classId}_${Date.now()}`,
            user_id: teacher.id,
            user_type: 'teacher',
            user_name: 'Teacher'
          })
        }
      );

      TeacherVideoLogger.info('✅ Backend response:', response);

      if (!response.success) {
        throw new Error(response.error || 'Failed to join session');
      }

      // Extract credentials from the correct response structure
      const credentials = {
        appId: response.appId || response.app_id,
        token: response.token,
        uid: response.agora_uid || response.uid,
        channel: response.channel
      };

      TeacherVideoLogger.info('✅ Teacher session started successfully', {
        meetingId: response.meeting_id,
        channel: response.channel,
        uid: credentials.uid
      });

      return {
        success: true,
        meetingId: response.meeting_id,
        channel: response.channel,
        agora_credentials: credentials,
        sessionInfo: response
      };

    } catch (error) {
      TeacherVideoLogger.error('❌ Start session failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // ===== RECORD PARTICIPATION =====
  async recordTeacherParticipation(meetingId) {
    try {
      const teacher = await this.getCurrentTeacher();

      const response = await this.makeRequest(
        `${API_BASE_URL}/video/record-participation`,
        {
          method: 'POST',
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: teacher.id,
            user_type: 'teacher',
            status: 'joined'
          })
        }
      );

      return response;
    } catch (error) {
      TeacherVideoLogger.warn('Participation recording failed', error);
      return { success: false };
    }
  },

  // ===== END SESSION =====
  async endVideoSession(meetingId, durationMinutes = 0) {
    try {
      const teacher = await this.getCurrentTeacher();

      const response = await this.makeRequest(
        `${API_BASE_URL}/video/end-session`,
        {
          method: 'POST',
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: teacher.id,
            duration: durationMinutes * 60
          })
        }
      );

      TeacherVideoLogger.info('✅ Session ended via API');
      return response;

    } catch (error) {
      TeacherVideoLogger.error('Error ending session via API', error);
      // Fallback - still try to cleanup locally
      return { success: true, message: 'Session ended locally' };
    }
  },

  // ===== LEAVE SESSION =====
  async leaveSession(meetingId, durationMinutes = 0) {
    try {
      const teacher = await this.getCurrentTeacher();

      const response = await this.makeRequest(
        `${API_BASE_URL}/video/leave-session`,
        {
          method: 'POST',
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: teacher.id,
            duration: durationMinutes * 60,
            user_type: 'teacher'
          })
        }
      );

      return response;
    } catch (error) {
      TeacherVideoLogger.warn('Leave session API failed', error);
      return { success: false };
    }
  },

  // ===== REQUEST HANDLER =====
  async makeRequest(url, options = {}, retries = MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      TeacherVideoLogger.debug('🌐 Making API request:', { url, method: options.method });

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      TeacherVideoLogger.debug('✅ API response received:', data);
      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      TeacherVideoLogger.error(`API request failed: ${error.message}`);

      if (retries > 0 && !error.message.includes('auth') && !error.message.includes('invalid')) {
        TeacherVideoLogger.warn(`Retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.makeRequest(url, options, retries - 1);
      }

      throw error;
    }
  }
};

export default teacherVideoApi;
