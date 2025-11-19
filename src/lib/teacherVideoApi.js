import { supabase } from './supabaseClient';

// ===== PRODUCTION CONFIGURATION =====
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://madina-quran-backend.onrender.com/api';
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;
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

  static warn(message, data = null) {
    console.warn(`⚠️ [TEACHER-VIDEO-API] ${message}`, data || '');
  }

  static debug(message, data = null) {
    if (import.meta.env.DEV) {
      console.debug(`🐛 [TEACHER-VIDEO-API] ${message}`, data || '');
    }
  }
}

// ===== UTILITY FUNCTIONS =====
const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browser = 'unknown';

  if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Chrome')) browser = 'chrome';
  else if (ua.includes('Safari')) browser = 'safari';
  else if (ua.includes('Edge')) browser = 'edge';

  return browser;
};

const getConnectionType = () => {
  if ('connection' in navigator) {
    return navigator.connection?.effectiveType || 'unknown';
  }
  return 'unknown';
};

const generateSecureUID = (userId, channelName, userType) => {
  const combined = `${userType}_${userId}_${channelName}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 1000000;
};

const getErrorCode = (error) => {
  const message = error?.message || '';
  if (message.includes('authentication')) return 'AUTH_FAILED';
  if (message.includes('not found')) return 'SESSION_NOT_FOUND';
  if (message.includes('already active')) return 'SESSION_ALREADY_ACTIVE';
  if (message.includes('ended')) return 'SESSION_ENDED';
  if (message.includes('permission')) return 'PERMISSION_DENIED';
  if (message.includes('network')) return 'NETWORK_ERROR';
  if (message.includes('timeout')) return 'REQUEST_TIMEOUT';
  return 'UNKNOWN_ERROR';
};

const validateSessionData = (sessionData) => {
  const required = ['channel', 'appId', 'uid'];
  const missing = required.filter(field => !sessionData.agora_credentials?.[field]);

  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }

  return null;
};

// ===== API REQUEST HANDLER =====
class ApiRequestHandler {
  static async makeRequest(url, options = {}, retries = MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
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

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (retries > 0 && !error.message.includes('auth') && !error.message.includes('invalid')) {
        TeacherVideoLogger.warn(`Request failed, retrying... (${retries} left)`, error.message);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.makeRequest(url, options, retries - 1);
      }

      throw error;
    }
  }
}

// ===== TEACHER VIDEO API =====
export const teacherVideoApi = {
  // ===== AUTHENTICATION =====
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

  // ===== START SESSION =====
  async startTeacherSession(classId) {
    try {
      const teacher = await this.getCurrentTeacher();

      TeacherVideoLogger.info('🎓 Starting teacher session for class:', classId);

      // Use the correct endpoint from your backend logs
      const response = await this.makeRequest(
        `${API_BASE_URL}/agora/join-session`, 
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

      if (!response.success) {
        throw new Error(response.error || 'Failed to join session');
      }

      TeacherVideoLogger.info('✅ Teacher session started successfully:', response);

      return {
        success: true,
        meetingId: response.meeting_id,
        channel: response.channel,
        agora_credentials: {
          appId: response.appId || response.app_id,
          token: response.token,
          uid: response.agora_uid || response.uid,
          channel: response.channel
        },
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

async joinTeacherSession(meetingId) {
    try {
      const teacher = await this.getCurrentTeacher();

      TeacherVideoLogger.info('🎓 Teacher joining session:', meetingId);

      const response = await this.makeRequest(
        `${API_BASE_URL}/agora/join-session`,
        {
          method: 'POST',
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: teacher.id,
            user_type: 'teacher',
            user_name: 'Teacher'
          })
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to join session');
      }

      return {
        success: true,
        meetingId: response.meeting_id,
        channel: response.channel,
        agora_credentials: {
          appId: response.appId || response.app_id,
          token: response.token,
          uid: response.agora_uid || response.uid,
          channel: response.channel
        },
        sessionInfo: response
      };

    } catch (error) {
      TeacherVideoLogger.error('❌ Join session failed:', error);
      throw error;
    }
  },


  // ===== FALLBACK SESSION CREATION =====
  async startTeacherSessionFallback(classId) {
    try {
      const teacher = await this.getCurrentTeacher();

      TeacherVideoLogger.debug('🔄 Creating session via database fallback');

      // Create session directly in database
      const timestamp = Date.now();
      const meetingId = `class_${classId}_${timestamp}`;
      const channelName = `channel_${classId}_${timestamp}`;

      const { data: session, error: createError } = await supabase
        .from('video_sessions')
        .insert([{
          class_id: classId,
          teacher_id: teacher.id,
          meeting_id: meetingId,
          channel_name: channelName,
          status: 'active',
          started_at: new Date().toISOString(),
          scheduled_date: new Date().toISOString()
        }])
        .select(`
          *,
          class:classes (title),
          teacher:teacher_id (name, agora_config)
        `)
        .single();

      if (createError) throw createError;

      // Generate credentials
      const credentials = await this.generateTeacherAgoraCredentials(
        session.channel_name,
        teacher.id
      );

      // Update class status
      await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

      TeacherVideoLogger.info('✅ Fallback session created:', meetingId);

      return {
        success: true,
        meetingId: session.meeting_id,
        channel: session.channel_name,
        isNewSession: true,
        agora_credentials: credentials,
        sessionInfo: {
          classId: classId,
          teacherId: teacher.id,
          startTime: session.started_at
        }
      };

    } catch (error) {
      TeacherVideoLogger.error('❌ Fallback creation failed:', error);
      throw error;
    }
  },

  // ===== FIND ACTIVE SESSION =====
  async findActiveClassSession(classId) {
    try {
      TeacherVideoLogger.debug('🔍 Looking for active session for class:', classId);

      const { data: session, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title, teacher_id),
          teacher:teacher_id (name, email, agora_config)
        `)
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          TeacherVideoLogger.debug('🔍 No active session found');
          return null;
        }
        throw error;
      }

      TeacherVideoLogger.debug('✅ Found active session:', session.meeting_id);
      return session;

    } catch (error) {
      TeacherVideoLogger.error('❌ Error finding active session:', error);
      return null;
    }
  },

  // ===== GENERATE AGORA CREDENTIALS =====
  async generateTeacherAgoraCredentials(channelName, teacherId) {
    try {
      TeacherVideoLogger.debug('🔑 Generating teacher Agora credentials');

      // Get teacher's Agora config
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('agora_config')
        .eq('id', teacherId)
        .single();

      const appId = teacherProfile?.agora_config?.appId || 
                    import.meta.env.VITE_AGORA_APP_ID;

      if (!appId) {
        throw new Error('Agora App ID not configured');
      }

      // Generate consistent teacher UID
      const uid = generateSecureUID(teacherId, channelName, 'teacher');

      // Try to get token from backend
      let token = null;
      try {
        const tokenResponse = await ApiRequestHandler.makeRequest(
          `${API_BASE_URL}/api/video/generate-token`,
          {
            method: 'POST',
            body: JSON.stringify({
              channelName,
              userId: teacherId,
              role: 'publisher'
            })
          },
          1 // Only 1 retry for token generation
        );

        if (tokenResponse.success) {
          token = tokenResponse.token;
        }
      } catch (error) {
        TeacherVideoLogger.warn('Backend token generation failed, using null token', error);
      }

      const credentials = {
        appId: appId,
        channel: channelName,
        token: token,
        uid: uid,
        role: 'publisher'
      };

      TeacherVideoLogger.debug('✅ Teacher credentials generated:', {
        channel: credentials.channel,
        uid: credentials.uid,
        hasToken: !!credentials.token
      });

      return credentials;

    } catch (error) {
      TeacherVideoLogger.error('❌ Credentials generation failed:', error);
      throw error;
    }
  },

  // ===== RECORD TEACHER PARTICIPATION =====
 async recordTeacherParticipation(meetingId) {
    try {
      const teacher = await this.getCurrentTeacher();

      const response = await this.makeRequest(
        `${API_BASE_URL}/video/record-participation`,
        {
          method: 'POST',
          body: JSON.stringify({
            session_id: meetingId, // You might need to get actual session ID
            student_id: teacher.id,
            is_teacher: true,
            status: 'joined'
          })
        }
      );

      return response;
    } catch (error) {
      TeacherVideoLogger.warn('Participation recording failed', error);
      // Don't throw error for this non-critical operation
      return { success: false };
    }
  },

  // ===== END SESSION =====
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



  // ===== END SESSION FALLBACK =====
  async endVideoSessionFallback(meetingId, teacherId, durationMinutes) {
    try {
      TeacherVideoLogger.debug('🔄 Ending session via database fallback');

      // Update session status
      const { data: session, error: sessionError } = await supabase
        .from('video_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('meeting_id', meetingId)
        .select('id, class_id')
        .single();

      if (sessionError) {
        TeacherVideoLogger.warn('Session update failed', sessionError);
      }

      // Update teacher participation
      if (session) {
        await supabase
          .from('session_participants')
          .update({
            status: 'left',
            left_at: new Date().toISOString(),
            duration: durationMinutes * 60
          })
          .eq('session_id', session.id)
          .eq('student_id', teacherId)
          .is('left_at', null);

        // Update class status
        await supabase
          .from('classes')
          .update({ status: 'completed' })
          .eq('id', session.class_id);
      }

      TeacherVideoLogger.info('✅ Fallback end successful');

    } catch (error) {
      TeacherVideoLogger.error('Fallback end failed', error);
    }
  },

  // ===== GET SESSION STATUS =====
  async getSessionStatus(meetingId) {
    try {
      TeacherVideoLogger.debug('🔍 Checking session status:', meetingId);

      // Try backend first
      try {
        const data = await ApiRequestHandler.makeRequest(
          `${API_BASE_URL}/api/video/session-status/${meetingId}`,
          {},
          1
        );

        TeacherVideoLogger.debug('✅ Backend status check successful');
        return {
          ...data,
          source: 'backend'
        };
      } catch (error) {
        TeacherVideoLogger.warn('Backend status check failed, trying fallback', error);
      }

      // Fallback to database
      return await this.getSessionStatusFallback(meetingId);

    } catch (error) {
      TeacherVideoLogger.error('All status checks failed', error);
      return {
        is_active: false,
        is_teacher_joined: false,
        student_count: 0,
        source: 'error'
      };
    }
  },

  async getSessionStatusFallback(meetingId) {
    try {
      const { data: session, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          participants:session_participants(
            id,
            student_id,
            joined_at,
            is_teacher
          )
        `)
        .eq('meeting_id', meetingId)
        .single();

      if (error || !session) {
        return {
          is_active: false,
          is_teacher_joined: false,
          student_count: 0,
          source: 'fallback'
        };
      }

      const teacherJoined = session.participants?.some(p => p.is_teacher) || false;
      const studentCount = session.participants?.filter(p => !p.is_teacher).length || 0;

      return {
        is_active: session.status === 'active',
        is_teacher_joined: teacherJoined,
        student_count: studentCount,
        started_at: session.started_at,
        source: 'fallback'
      };

    } catch (error) {
      TeacherVideoLogger.error('Fallback status check failed', error);
      throw error;
    }
  },

  // ===== GET ACTIVE SESSIONS =====
  async getActiveSessions() {
    try {
      const teacher = await this.getCurrentTeacher();

      const { data: sessions, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title),
          participants:session_participants (
            id,
            student_id,
            is_teacher
          )
        `)
        .eq('teacher_id', teacher.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false });

      if (error) throw error;

      const sessionsWithCounts = (sessions || []).map(session => ({
        ...session,
        participant_count: session.participants?.filter(p => !p.is_teacher).length || 0
      }));

      return sessionsWithCounts;

    } catch (error) {
      TeacherVideoLogger.error('Failed to get active sessions', error);
      return [];
    }
  },

  async makeRequest(url, options = {}, retries = MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
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

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (retries > 0 && !error.message.includes('auth') && !error.message.includes('invalid')) {
        TeacherVideoLogger.warn(`Request failed, retrying... (${retries} left)`, error.message);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.makeRequest(url, options, retries - 1);
      }

      throw error;
    }
  },


  // ===== DIAGNOSTICS =====
  async debugSessionConnection(classId) {
    try {
      const teacher = await this.getCurrentTeacher();

      TeacherVideoLogger.info('🔧 Running diagnostics for class:', classId);

      const diagnostic = {
        classId,
        teacherId: teacher.id,
        timestamp: new Date().toISOString(),
        environment: {
          apiBaseUrl: API_BASE_URL,
          agoraAppId: !!AGORA_APP_ID,
          nodeEnv: import.meta.env.MODE
        },
        checks: {}
      };

      // Check backend health
      try {
        const healthResponse = await fetch(`${API_BASE_URL}/video/health`);
        diagnostic.checks.backendHealth = healthResponse.ok;
        if (healthResponse.ok) {
          diagnostic.checks.backendData = await healthResponse.json();
        }
      } catch (e) {
        diagnostic.checks.backendHealth = false;
        diagnostic.checks.backendError = e.message;
      }

      // Check for active session
      const activeSession = await this.findActiveClassSession(classId);
      diagnostic.checks.hasActiveSession = !!activeSession;
      diagnostic.checks.sessionData = activeSession;

      // Check Agora config
      const { data: profile } = await supabase
        .from('profiles')
        .select('agora_config')
        .eq('id', teacher.id)
        .single();

      diagnostic.checks.hasAgoraConfig = !!profile?.agora_config?.appId;

      TeacherVideoLogger.info('✅ Diagnostics complete', diagnostic);
      return diagnostic;

    } catch (error) {
      TeacherVideoLogger.error('Diagnostics failed', error);
      return { error: error.message };
    }
  }
};

export default teacherVideoApi;
