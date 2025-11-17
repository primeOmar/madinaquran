import { supabase } from './supabaseClient';

const API_BASE_URL = 'https://madina-quran-backend.onrender.com';

// 🎯 PRODUCTION LOGGER
class VideoLogger {
  static info(message, data = null) {
    console.log(`🎯 [TEACHER-VIDEO] ${message}`, data || '');
  }

  static error(message, error = null) {
    console.error(`❌ [TEACHER-VIDEO] ${message}`, error || '');
  }

  static warn(message, data = null) {
    console.warn(`⚠️ [TEACHER-VIDEO] ${message}`, data || '');
  }

  static debug(message, data = null) {
    if (import.meta.env.DEV) {
      console.debug(`🐛 [TEACHER-VIDEO] ${message}`, data || '');
    }
  }
}

export const videoApi = {
  // 🎯 MAIN TEACHER SESSION MANAGEMENT
  startTeacherSession: async (classId) => {
    try {
      VideoLogger.info('Starting teacher session for class:', classId);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Teacher not authenticated');

      // Use backend API for session creation and token generation
      const sessionResponse = await fetch(`${API_BASE_URL}/api/video/start-teacher-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId,
          teacherId: user.id
        })
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        throw new Error(`Backend error: ${sessionResponse.status} - ${errorText}`);
      }

      const sessionData = await sessionResponse.json();

      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to start session via backend');
      }

      VideoLogger.info('Teacher session started via backend:', {
        meetingId: sessionData.meetingId,
        channel: sessionData.channel,
        hasToken: !!sessionData.token
      });

      return {
        success: true,
        meetingId: sessionData.meetingId,
        channel: sessionData.channel,
        isNewSession: sessionData.isNewSession,
        agora_credentials: {
          appId: sessionData.appId,
          channel: sessionData.channel,
          token: sessionData.token,
          uid: sessionData.uid
        },
        sessionInfo: {
          classId: classId,
          teacherId: user.id,
          startTime: new Date().toISOString()
        }
      };

    } catch (error) {
      VideoLogger.error('Failed to start teacher session:', error);
      return {
        success: false,
        error: error.message,
        errorCode: videoApi.getErrorCode(error)
      };
    }
  },

  // 🎯 STUDENT SESSION JOINING
  joinStudentSession: async (meetingId, studentId) => {
    try {
      VideoLogger.info('Student joining session:', meetingId);

      const joinResponse = await fetch(`${API_BASE_URL}/api/video/join-student-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          studentId
        })
      });

      if (!joinResponse.ok) {
        const errorText = await joinResponse.text();
        throw new Error(`Backend error: ${joinResponse.status} - ${errorText}`);
      }

      const joinData = await joinResponse.json();

      if (!joinData.success) {
        throw new Error(joinData.error || 'Failed to join session via backend');
      }

      VideoLogger.info('Student session join ready via backend:', {
        meetingId: meetingId,
        channel: joinData.channel,
        studentId: studentId
      });

      return {
        success: true,
        meetingId: meetingId,
        channel: joinData.channel,
        agora_credentials: {
          appId: joinData.appId,
          channel: joinData.channel,
          token: joinData.token,
          uid: joinData.uid
        },
        sessionInfo: {
          classTitle: joinData.classTitle,
          teacherName: joinData.teacherName,
          isActive: joinData.isActive
        }
      };

    } catch (error) {
      VideoLogger.error('Student join failed:', error);
      return {
        success: false,
        error: error.message,
        errorCode: videoApi.getErrorCode(error)
      };
    }
  },

  // 🎯 DIRECT SESSION JOIN (Alternative method)
  joinVideoSession: async (meetingId, userId) => {
    try {
      VideoLogger.info('User joining session directly:', { meetingId, userId });

      const joinResponse = await fetch(`${API_BASE_URL}/api/video/join-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          userId,
          userType: userId.startsWith('teacher_') ? 'teacher' : 'student'
        })
      });

      if (!joinResponse.ok) {
        const errorText = await joinResponse.text();
        throw new Error(`Backend error: ${joinResponse.status} - ${errorText}`);
      }

      const joinData = await joinResponse.json();

      if (!joinData.success) {
        throw new Error(joinData.error || 'Failed to join session');
      }

      VideoLogger.info('User joined session successfully:', {
        meetingId: meetingId,
        channel: joinData.channel,
        userId: userId
      });

      return {
        success: true,
        meetingId: meetingId,
        channel: joinData.channel,
        agora_credentials: {
          appId: joinData.appId,
          channel: joinData.channel,
          token: joinData.token,
          uid: joinData.uid
        },
        sessionInfo: {
          classTitle: joinData.classTitle,
          teacherName: joinData.teacherName,
          isActive: joinData.isActive
        }
      };

    } catch (error) {
      VideoLogger.error('Direct join failed:', error);
      return {
        success: false,
        error: error.message,
        errorCode: videoApi.getErrorCode(error)
      };
    }
  },

  // 🛑 END SESSION
  endVideoSession: async (meetingId) => {
    try {
      VideoLogger.info('Ending session:', meetingId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const endResponse = await fetch(`${API_BASE_URL}/api/video/end-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          userId: user.id
        })
      });

      if (!endResponse.ok) {
        const errorText = await endResponse.text();
        throw new Error(`Backend error: ${endResponse.status} - ${errorText}`);
      }

      const endData = await endResponse.json();

      VideoLogger.info('Session ended via backend');
      return { success: true };

    } catch (error) {
      VideoLogger.error('Session end failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 📊 SESSION HEALTH CHECK
  checkSessionHealth: async (meetingId) => {
    try {
      VideoLogger.debug('Checking session health:', meetingId);

      const healthResponse = await fetch(`${API_BASE_URL}/api/video/session-health/${meetingId}`);

      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }

      const healthData = await healthResponse.json();

      return {
        healthy: healthData.healthy,
        session: healthData.session,
        participants: healthData.participants || 0,
        totalParticipants: healthData.totalParticipants || 0,
        isTeacherJoined: healthData.isTeacherJoined || false
      };

    } catch (error) {
      VideoLogger.error('Health check failed:', error);
      
      // Fallback to database check if backend is down
      try {
        return await videoApi.getSessionHealthFallback(meetingId);
      } catch (fallbackError) {
        VideoLogger.error('Health check fallback also failed:', fallbackError);
        return {
          healthy: false,
          error: error.message,
          participants: 0,
          totalParticipants: 0,
          isTeacherJoined: false
        };
      }
    }
  },

  // 🗄️ SESSION HEALTH FALLBACK
  getSessionHealthFallback: async (meetingId) => {
    try {
      VideoLogger.debug('Using fallback health check for:', meetingId);

      const { data: session, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title),
          participants:session_participants (user_id, joined_at, is_teacher)
        `)
        .eq('meeting_id', meetingId)
        .single();

      if (error || !session) {
        return {
          healthy: false,
          error: 'Session not found',
          participants: 0,
          totalParticipants: 0,
          isTeacherJoined: false
        };
      }

      const isHealthy = session.status === 'active';
      const participants = session.participants?.length || 0;
      const isTeacherJoined = session.participants?.some(p => p.is_teacher) || false;

      return {
        healthy: isHealthy,
        session: {
          status: session.status,
          startedAt: session.started_at,
          channel: session.channel_name
        },
        participants: participants,
        totalParticipants: participants,
        isTeacherJoined: isTeacherJoined
      };

    } catch (error) {
      throw new Error(`Fallback health check failed: ${error.message}`);
    }
  },

  // 🔍 GET SESSION DETAILS
  getSessionDetails: async (meetingId) => {
    try {
      VideoLogger.debug('Getting session details:', meetingId);

      const { data: session, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title, teacher_id),
          teacher:profiles!video_sessions_teacher_id_fkey (name, email, agora_config)
        `)
        .eq('meeting_id', meetingId)
        .single();

      if (error) throw error;
      return session;

    } catch (error) {
      VideoLogger.error('Session details fetch failed:', error);
      throw new Error('Session not found or inaccessible');
    }
  },

  // 📝 RECORD PARTICIPATION
  recordParticipation: async (meetingId, userId, userType = 'student') => {
    try {
      VideoLogger.debug('Recording participation:', { meetingId, userId, userType });

      const participationResponse = await fetch(`${API_BASE_URL}/api/video/record-participation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          userId,
          userType,
          joinedAt: new Date().toISOString()
        })
      });

      if (!participationResponse.ok) {
        VideoLogger.warn('Participation recording failed via backend');
        // Don't throw error for participation recording - it's non-critical
        return { success: false, warning: 'Participation recording failed' };
      }

      const result = await participationResponse.json();
      VideoLogger.debug('Participation recorded successfully');
      return { success: true, data: result };

    } catch (error) {
      VideoLogger.warn('Participation recording failed:', error);
      // Don't throw error for participation recording
      return { success: false, warning: error.message };
    }
  },

  // 🧪 VALIDATE CREDENTIALS
  validateAgoraCredentials: (credentials) => {
    const issues = [];

    if (!credentials) {
      return { valid: false, issues: ['Credentials object is null'] };
    }

    if (!credentials.appId || credentials.appId.length < 8) {
      issues.push('Invalid App ID');
    }

    if (!credentials.channel || credentials.channel.length < 3) {
      issues.push('Invalid channel name');
    }

    if (!credentials.token || credentials.token.length < 10) {
      issues.push('Invalid token');
    }

    if (!credentials.uid || credentials.uid < 1 || credentials.uid > 4294967295) {
      issues.push('Invalid UID');
    }

    return {
      valid: issues.length === 0,
      issues,
      credentials: issues.length === 0 ? credentials : null
    };
  },

  // 🚨 ERROR CODE MAPPING
  getErrorCode: (error) => {
    const message = error?.message || '';
    
    if (message.includes('not authenticated')) return 'AUTH_REQUIRED';
    if (message.includes('not found')) return 'SESSION_NOT_FOUND';
    if (message.includes('App ID') || message.includes('configuration')) return 'AGORA_CONFIG_ERROR';
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) return 'NETWORK_ERROR';
    if (message.includes('permission')) return 'PERMISSION_DENIED';
    if (message.includes('camera') || message.includes('microphone')) return 'MEDIA_PERMISSION_ERROR';
    if (message.includes('timeout')) return 'REQUEST_TIMEOUT';
    if (message.includes('backend') || message.includes('server')) return 'BACKEND_ERROR';
    
    return 'UNKNOWN_ERROR';
  },

  // 🔧 UTILITY: GET ACTIVE SESSIONS
  getActiveSessions: async () => {
    try {
      const { data: sessions, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title),
          teacher:profiles!video_sessions_teacher_id_fkey (name)
        `)
        .eq('status', 'active')
        .order('started_at', { ascending: false });

      if (error) throw error;
      return sessions || [];

    } catch (error) {
      VideoLogger.error('Active sessions fetch failed:', error);
      return [];
    }
  },

  // 🔧 UTILITY: GET SESSION PARTICIPANTS
  getSessionParticipants: async (meetingId) => {
    try {
      const { data: participants, error } = await supabase
        .from('session_participants')
        .select(`
          *,
          user:profiles (name, email)
        `)
        .eq('meeting_id', meetingId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      return participants || [];

    } catch (error) {
      VideoLogger.error('Participants fetch failed:', error);
      return [];
    }
  },

  // 🎯 QUICK CONNECTION TEST
  testConnection: async () => {
    try {
      VideoLogger.info('Testing connection to backend...');

      const testResponse = await fetch(`${API_BASE_URL}/api/video/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      const backendHealthy = testResponse.ok;
      const agoraConfigured = !!import.meta.env.VITE_AGORA_APP_ID;
      const supabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL;

      const testResults = {
        success: backendHealthy && agoraConfigured && supabaseConfigured,
        backend: {
          healthy: backendHealthy,
          url: API_BASE_URL,
          status: testResponse.status
        },
        agora: {
          configured: agoraConfigured,
          hasAppId: !!import.meta.env.VITE_AGORA_APP_ID
        },
        supabase: {
          configured: supabaseConfigured,
          hasUrl: !!import.meta.env.VITE_SUPABASE_URL
        },
        timestamp: new Date().toISOString()
      };

      VideoLogger.info('Connection test results:', testResults);
      return testResults;

    } catch (error) {
      VideoLogger.error('Connection test failed:', error);
      return {
        success: false,
        error: error.message,
        backend: { healthy: false, error: error.message },
        agora: { configured: !!import.meta.env.VITE_AGORA_APP_ID },
        supabase: { configured: !!import.meta.env.VITE_SUPABASE_URL },
        timestamp: new Date().toISOString()
      };
    }
  },

  // 🔄 GET OR CREATE SESSION (Internal fallback)
  getOrCreateSession: async (classId, teacherId) => {
    try {
      VideoLogger.debug('Getting or creating session internally:', { classId, teacherId });

      // Check for existing active session
      const { data: existingSession, error: sessionError } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title, teacher_id),
          teacher:profiles!video_sessions_teacher_id_fkey (name, agora_config)
        `)
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      // Return existing session if found
      if (existingSession && !sessionError) {
        VideoLogger.debug('Found existing session:', existingSession.meeting_id);
        return {
          ...existingSession,
          isNewSession: false
        };
      }

      // Create new session
      VideoLogger.debug('Creating new session internally for class:', classId);
      
      const timestamp = Date.now();
      const meetingId = `class_${classId}_${timestamp}`;
      const channelName = `channel_${classId}_${timestamp}`;

      const { data: newSession, error: createError } = await supabase
        .from('video_sessions')
        .insert([{
          class_id: classId,
          teacher_id: teacherId,
          meeting_id: meetingId,
          channel_name: channelName,
          status: 'active',
          started_at: new Date().toISOString(),
          scheduled_date: new Date().toISOString()
        }])
        .select(`
          *,
          class:classes (title, teacher_id),
          teacher:profiles!video_sessions_teacher_id_fkey (name, agora_config)
        `)
        .single();

      if (createError) throw createError;

      // Update class status
      await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

      VideoLogger.info('New session created internally:', meetingId);
      return {
        ...newSession,
        isNewSession: true
      };

    } catch (error) {
      VideoLogger.error('Internal session creation failed:', error);
      throw error;
    }
  },

  // 🔐 SIMPLE UID GENERATION (Client-side only)
  generateSimpleUID: (userId, channelName, userType = 'user') => {
    try {
      // Simple deterministic UID generation for client-side
      let hash = 0;
      const str = `${userType}_${userId}_${channelName}`;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const uid = Math.abs(hash) % 1000000;
      VideoLogger.debug('Generated simple UID:', { userId, channelName, uid });
      return uid;
    } catch (error) {
      // Fallback: random UID
      const fallbackUid = Math.floor(Math.random() * 1000000) + 1;
      VideoLogger.warn('Using fallback random UID:', fallbackUid);
      return fallbackUid;
    }
  },

  // 📱 GET USER DEVICE INFO
  getUserDeviceInfo: () => {
    if (typeof window === 'undefined') {
      return { browser: 'server', userAgent: 'server' };
    }

    const ua = navigator.userAgent;
    let browser = 'unknown';
    
    if (ua.includes('Firefox')) browser = 'firefox';
    else if (ua.includes('Chrome')) browser = 'chrome';
    else if (ua.includes('Safari')) browser = 'safari';
    else if (ua.includes('Edge')) browser = 'edge';

    return {
      browser,
      userAgent: ua,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      connectionType: navigator.connection?.effectiveType || 'unknown'
    };
  }
};

export default videoApi;
