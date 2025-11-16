import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import CryptoJS from 'crypto-js';
import { supabase } from './supabaseClient';

const API_BASE_URL = 'https://madina-quran-backend.onrender.com';

export const videoApi = {
  // 🎯 MAIN TEACHER SESSION MANAGEMENT
  startTeacherSession: async (classId) => {
    try {
      console.log('🎯 [VIDEO] Starting teacher session for class:', classId);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Teacher not authenticated');

      // Step 1: Get or create session
      const sessionData = await videoApi.getOrCreateTeacherSession(classId, user.id);
      
      // Step 2: Generate Agora credentials
      const credentials = await videoApi.generateAgoraCredentials(
        sessionData.channel_name, 
        user.id, 
        'publisher'
      );

      // Step 3: Validate credentials
      const validation = videoApi.validateAgoraCredentials(credentials);
      if (!validation.valid) {
        throw new Error(`Invalid credentials: ${validation.issues.join(', ')}`);
      }

      console.log('✅ [VIDEO] Teacher session started successfully:', {
        meetingId: sessionData.meeting_id,
        channel: sessionData.channel_name,
        hasToken: !!credentials.token
      });

      return {
        success: true,
        meetingId: sessionData.meeting_id,
        channel: sessionData.channel_name,
        isNewSession: sessionData.isNewSession,
        agora_credentials: credentials,
        sessionInfo: {
          classId: classId,
          teacherId: user.id,
          startTime: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ [VIDEO] Failed to start teacher session:', error);
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
      console.log('🎯 [VIDEO] Student joining session:', meetingId);

      // Step 1: Get session details
      const session = await videoApi.getSessionDetails(meetingId);
      
      if (!session || session.status !== 'active') {
        throw new Error('No active session found. Teacher needs to start the class first.');
      }

      // Step 2: Generate student credentials
      const credentials = await videoApi.generateAgoraCredentials(
        session.channel_name,
        studentId,
        'subscriber'
      );

      // Step 3: Record student participation
      await videoApi.recordStudentParticipation(meetingId, studentId, credentials.uid);

      console.log('✅ [VIDEO] Student session join ready:', {
        meetingId: meetingId,
        channel: session.channel_name,
        studentId: studentId
      });

      return {
        success: true,
        meetingId: meetingId,
        channel: session.channel_name,
        agora_credentials: credentials,
        sessionInfo: {
          classTitle: session.class?.title,
          teacherName: session.teacher?.name,
          isActive: session.status === 'active'
        }
      };

    } catch (error) {
      console.error('❌ [VIDEO] Student join failed:', error);
      return {
        success: false,
        error: error.message,
        errorCode: videoApi.getErrorCode(error)
      };
    }
  },

  // 🎯 SESSION MANAGEMENT
  getOrCreateTeacherSession: async (classId, teacherId) => {
    try {
      console.log('🔍 [VIDEO] Looking for active session for class:', classId);

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
        console.log('🔄 [VIDEO] Found existing session:', existingSession.meeting_id);
        return {
          ...existingSession,
          isNewSession: false
        };
      }

      // Create new session
      console.log('🆕 [VIDEO] Creating new session for class:', classId);
      
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

      console.log('✅ [VIDEO] New session created:', meetingId);
      return {
        ...newSession,
        isNewSession: true
      };

    } catch (error) {
      console.error('❌ [VIDEO] Session creation failed:', error);
      throw error;
    }
  },

  // 🎯 AGORA CREDENTIALS GENERATION
  generateAgoraCredentials: async (channelName, userId, role = 'publisher') => {
    try {
      console.log('🔑 [AGORA] Generating credentials for:', {
        channel: channelName,
        userId: userId,
        role: role
      });

      // Get user's Agora configuration
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('agora_config, name')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.warn('⚠️ [AGORA] Profile not found, using env config');
      }

      const appId = userProfile?.agora_config?.appId || 
                    import.meta.env.VITE_AGORA_APP_ID;

      const appCertificate = userProfile?.agora_config?.certificate || 
                            import.meta.env.VITE_AGORA_CERTIFICATE;

      // Validate configuration
      if (!appId || !appCertificate) {
        throw new Error('Agora App ID or Certificate not configured');
      }

      // Generate secure UID
      const uid = videoApi.generateSecureUID(userId, channelName, role);

      // Generate token
      const token = videoApi.generateAgoraToken({
        appId,
        appCertificate,
        channelName,
        uid,
        role
      });

      const credentials = {
        appId: appId.trim(),
        channel: channelName.trim(),
        token: token,
        uid: uid,
        role: role,
        generatedAt: new Date().toISOString()
      };

      console.log('✅ [AGORA] Credentials generated:', {
        channel: credentials.channel,
        uid: credentials.uid,
        hasToken: !!credentials.token,
        role: credentials.role
      });

      return credentials;

    } catch (error) {
      console.error('❌ [AGORA] Credentials generation failed:', error);
      
      // Fallback to backend token generation
      try {
        console.log('🔄 [AGORA] Trying backend token generation...');
        return await videoApi.generateBackendToken(channelName, userId, role);
      } catch (fallbackError) {
        console.error('❌ [AGORA] All token generation methods failed');
        throw new Error('Unable to generate video call credentials');
      }
    }
  },

  // 🔒 AGORA TOKEN GENERATION
  generateAgoraToken: ({ appId, appCertificate, channelName, uid, role }) => {
    try {
      const expirationTimeInSeconds = 3600; // 1 hour
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

      console.log('🔧 [AGORA] Building token:', {
        channel: channelName,
        uid: uid,
        role: agoraRole
      });

      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        agoraRole,
        privilegeExpiredTs
      );

      if (!token) {
        throw new Error('Token generation returned null');
      }

      return token;

    } catch (error) {
      console.error('❌ [AGORA] Token generation failed:', error);
      throw error;
    }
  },

  // 🌐 BACKEND TOKEN FALLBACK
  generateBackendToken: async (channelName, userId, role) => {
    try {
      console.log('🌐 [AGORA] Requesting token from backend...');

      const response = await fetch(`${API_BASE_URL}/api/video/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName,
          userId,
          role,
          timestamp: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.token) {
        throw new Error(result.error || 'Backend token generation failed');
      }

      return {
        appId: result.appId || import.meta.env.VITE_AGORA_APP_ID,
        channel: channelName,
        token: result.token,
        uid: result.uid || videoApi.generateSecureUID(userId, channelName, role),
        role: role
      };

    } catch (error) {
      console.error('❌ [AGORA] Backend token failed:', error);
      throw error;
    }
  },

  // 🔐 SECURE UID GENERATION
  generateSecureUID: (userId, channelName, userType) => {
    try {
      const seed = `${userType}_${userId}_${channelName}_${Date.now()}`;
      const hash = CryptoJS.SHA256(seed).toString();
      const numericUID = parseInt(hash.substring(0, 8), 16) % 1000000;
      return Math.max(1, Math.min(numericUID, 4294967295));
    } catch (error) {
      // Fallback UID generation
      let hash = 0;
      const str = `fallback_${userId}_${channelName}`;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash) % 1000000;
    }
  },

  // 📊 SESSION HEALTH CHECK
  checkSessionHealth: async (meetingId) => {
    try {
      console.log('🔍 [VIDEO] Checking session health:', meetingId);

      const { data: session, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title),
          participants:session_participants (user_id, joined_at)
        `)
        .eq('meeting_id', meetingId)
        .single();

      if (error || !session) {
        return {
          healthy: false,
          error: 'Session not found',
          participants: 0
        };
      }

      const isHealthy = session.status === 'active' && 
                       new Date(session.started_at) > new Date(Date.now() - 24 * 60 * 60 * 1000); // Within 24 hours

      return {
        healthy: isHealthy,
        session: {
          status: session.status,
          startedAt: session.started_at,
          channel: session.channel_name
        },
        participants: session.participants?.length || 0,
        totalParticipants: session.participants?.length || 0
      };

    } catch (error) {
      console.error('❌ [VIDEO] Health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        participants: 0
      };
    }
  },

  // 🛑 END SESSION
  endVideoSession: async (meetingId) => {
    try {
      console.log('🛑 [VIDEO] Ending session:', meetingId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update session status in database
      const { error: updateError } = await supabase
        .from('video_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('meeting_id', meetingId);

      if (updateError) {
        console.warn('⚠️ [VIDEO] Session update warning:', updateError);
      }

      // Update class status
      await supabase
        .from('classes')
        .update({ status: 'completed' })
        .eq('id', (
          await supabase
            .from('video_sessions')
            .select('class_id')
            .eq('meeting_id', meetingId)
            .single()
        ).data?.class_id);

      console.log('✅ [VIDEO] Session ended successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ [VIDEO] Session end failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 📝 RECORD STUDENT PARTICIPATION
  recordStudentParticipation: async (meetingId, studentId, agoraUid) => {
    try {
      const { error } = await supabase
        .from('session_participants')
        .insert([{
          meeting_id: meetingId,
          user_id: studentId,
          agora_uid: agoraUid,
          joined_at: new Date().toISOString(),
          role: 'student'
        }]);

      if (error) {
        console.warn('⚠️ [VIDEO] Participation recording failed:', error);
      } else {
        console.log('✅ [VIDEO] Student participation recorded:', { studentId, agoraUid });
      }
    } catch (error) {
      console.warn('⚠️ [VIDEO] Participation recording error:', error);
    }
  },

  // 🔍 GET SESSION DETAILS
  getSessionDetails: async (meetingId) => {
    try {
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
      console.error('❌ [VIDEO] Session details fetch failed:', error);
      throw new Error('Session not found or inaccessible');
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
    if (error.message.includes('not authenticated')) return 'AUTH_REQUIRED';
    if (error.message.includes('not found')) return 'SESSION_NOT_FOUND';
    if (error.message.includes('App ID')) return 'AGORA_CONFIG_ERROR';
    if (error.message.includes('network') || error.message.includes('connection')) return 'NETWORK_ERROR';
    if (error.message.includes('permission')) return 'PERMISSION_DENIED';
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
      console.error('❌ [VIDEO] Active sessions fetch failed:', error);
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
      console.error('❌ [VIDEO] Participants fetch failed:', error);
      return [];
    }
  },

  // 🎯 QUICK CONNECTION TEST
  testConnection: async () => {
    try {
      const testChannel = 'test_channel';
      const testUserId = 'test_user';
      
      const credentials = await videoApi.generateAgoraCredentials(
        testChannel, 
        testUserId, 
        'publisher'
      );

      const validation = videoApi.validateAgoraCredentials(credentials);
      
      return {
        success: validation.valid,
        credentials: validation.valid ? credentials : null,
        issues: validation.issues,
        backend: API_BASE_URL,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};

export default videoApi;
