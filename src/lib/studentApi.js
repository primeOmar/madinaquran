import { supabase } from './supabaseClient';

// ===== PRODUCTION CONFIGURATION =====
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://madina-quran-backend.onrender.com/api';
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ===== PRODUCTION LOGGER =====
class ProductionLogger {
  static info(message, data = null) {
    console.log(`ℹ️ [STUDENT-API] ${message}`, data || '');
  }

  static error(message, error = null) {
    console.error(`❌ [STUDENT-API] ${message}`, error || '');
  }

  static warn(message, data = null) {
    console.warn(`⚠️ [STUDENT-API] ${message}`, data || '');
  }

  static debug(message, data = null) {
    if (import.meta.env.DEV) {
      console.debug(`🐛 [STUDENT-API] ${message}`, data || '');
    }
  }
}

// ===== PRODUCTION UTILITIES =====
const generateDeterministicUID = (userId, meetingId) => {
  const combined = `${userId}_${meetingId}`;
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
  if (message.includes('not enrolled')) return 'NOT_ENROLLED';
  if (message.includes('ended')) return 'SESSION_ENDED';
  if (message.includes('started')) return 'SESSION_NOT_STARTED';
  if (message.includes('full')) return 'SESSION_FULL';
  if (message.includes('timeout')) return 'REQUEST_TIMEOUT';
  if (message.includes('network')) return 'NETWORK_ERROR';
  if (message.includes('permission')) return 'PERMISSION_DENIED';
  return 'UNKNOWN_ERROR';
};

const validateJoinData = (joinData) => {
  const required = ['channel', 'appId', 'uid'];
  const missing = required.filter(field => !joinData[field]);

  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }

  if (typeof joinData.channel !== 'string' || joinData.channel.trim().length === 0) {
    return 'Invalid channel name';
  }

  if (typeof joinData.appId !== 'string' || joinData.appId.trim().length === 0) {
    return 'Invalid App ID';
  }

  if (typeof joinData.uid !== 'number' || joinData.uid < 0 || joinData.uid > 4294967295) {
    return 'Invalid UID (must be number between 0-4294967295)';
  }

  return null;
};

// ✅ NEW: Helper function to get browser info
const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browser = 'unknown';

  if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Chrome')) browser = 'chrome';
  else if (ua.includes('Safari')) browser = 'safari';
  else if (ua.includes('Edge')) browser = 'edge';

  return browser;
};

// ✅ NEW: Helper function to get connection type
const getConnectionType = () => {
  if ('connection' in navigator) {
    return navigator.connection?.effectiveType || 'unknown';
  }
  return 'unknown';
};

// ✅ NEW: Enhanced getCurrentUserId function
const getCurrentUserId = async () => {
  try {
    // Method 1: From auth context (adjust based on your auth system)
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return user.id;
    }

    // Method 2: From localStorage/sessionStorage
    const authKeys = ['user', 'user_data', 'auth_user', 'profile', 'currentUser'];
    for (const key of authKeys) {
      try {
        const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (stored) {
          const userData = JSON.parse(stored);
          if (userData.id) return userData.id;
          if (userData.user_id) return userData.user_id;
          if (userData.student_id) return userData.student_id;
        }
      } catch (e) {
        // Silent fail for parsing errors
      }
    }

    // Method 3: Generate a session-based ID as last resort
    ProductionLogger.warn('⚠️ Using session-based user ID');
    if (!sessionStorage.getItem('temp_user_id')) {
      sessionStorage.setItem('temp_user_id', `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
    return sessionStorage.getItem('temp_user_id');

  } catch (error) {
    ProductionLogger.error('❌ Error getting user ID:', error);
    return `error_${Date.now()}`;
  }
};

// ===== PRODUCTION REQUEST HANDLER =====
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
        ProductionLogger.warn(`Request failed, retrying... (${retries} left)`, error.message);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.makeRequest(url, options, retries - 1);
      }

      throw error;
    }
  }
}

// ===== PRODUCTION STUDENT API =====
export const studentApi = {
  // ===== AUTHENTICATION & PROFILE =====
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error('User not authenticated');
      }
      return user;
    } catch (error) {
      ProductionLogger.error('Failed to get current user', error);
      throw error;
    }
  },

  // ===== DASHBOARD DATA =====
  async getDashboardData() {
    try {
      const user = await this.getCurrentUser();

      ProductionLogger.info('Fetching dashboard data for student', { userId: user.id });

      // Get student profile with teacher info
      const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
      id,
      name,
      email,
      role,
      course,
      status,
      teacher_id,
      progress,
      attendance_rate,
      overall_score,
      completed_assignments,
      total_assignments,
      last_active,
      teacher:teacher_id (
        id,
        name,
        email,
        subject
      )
      `)
      .eq('id', user.id)
      .single();

      if (profileError) throw profileError;

      // Get all data in parallel for performance
      const [classesData, assignmentsData, statsData, notificationsData] = await Promise.all([
        this.getMyClasses(),
                                                                                             this.getMyAssignments(),
                                                                                             this.getMyStats(),
                                                                                             this.getMyNotifications()
      ]);

      const dashboardData = {
        student: profile,
        teacher: profile.teacher,
        classes: classesData.classes || [],
        assignments: assignmentsData.assignments || [],
        stats: statsData,
        notifications: notificationsData.notifications || [],
        hasTeacher: !!profile.teacher_id
      };

      ProductionLogger.info('Dashboard data fetched successfully');
      return dashboardData;

    } catch (error) {
      ProductionLogger.error('Failed to fetch dashboard data', error);
      throw error;
    }
  },

  // ===== CLASSES MANAGEMENT =====
  async getMyClasses() {
    try {
      const user = await this.getCurrentUser();

      ProductionLogger.debug('Fetching classes for student', { userId: user.id });

      // Get student's teacher_id
      const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('teacher_id')
      .eq('id', user.id)
      .single();

      if (profileError) throw profileError;

      if (!profile?.teacher_id) {
        ProductionLogger.warn('Student has no assigned teacher');
        return { classes: [], teacher: null };
      }

      // Get classes from the student's assigned teacher
      const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select(`
      id,
      title,
      description,
      scheduled_date,
      end_date,
      duration,
      status,
      teacher_id,
      course_id,
      max_students,
      is_exam,
      teacher:teacher_id (
        name,
        email,
        subject
      ),
      video_sessions (
        id,
        meeting_id,
        status,
        channel_name,
        started_at,
        ended_at
      ),
      courses (
        name
      )
      `)
      .eq('teacher_id', profile.teacher_id)
      .order('scheduled_date', { ascending: true });

      if (classesError) throw classesError;

      // Transform data for frontend
      const transformedClasses = (classes || []).map(classItem => ({
        id: classItem.id,
        title: classItem.title,
        description: classItem.description,
        scheduled_date: classItem.scheduled_date,
        end_date: classItem.end_date,
        duration: classItem.duration,
        status: classItem.status,
        teacher_id: classItem.teacher_id,
        course_id: classItem.course_id,
        max_students: classItem.max_students,
        is_exam: classItem.is_exam,
        teacher_name: classItem.teacher?.name,
        teacher_email: classItem.teacher?.email,
        teacher_subject: classItem.teacher?.subject,
        course_name: classItem.courses?.name,
        video_session: classItem.video_sessions?.[0] || null
      }));

      ProductionLogger.debug(`Fetched ${transformedClasses.length} classes`);
      return {
        classes: transformedClasses,
        teacher: classes?.[0]?.teacher || null
      };

    } catch (error) {
      ProductionLogger.error('Failed to fetch classes', error);
      throw error;
    }
  },

  // ===== ASSIGNMENTS MANAGEMENT =====
  async getMyAssignments() {
    try {
      const user = await this.getCurrentUser();

      ProductionLogger.debug('Fetching assignments for student', { userId: user.id });

      const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
      id,
      title,
      description,
      due_date,
      max_score,
      subject,
      status,
      created_at,
      updated_at,
      teacher_id,
      class_id,
      file_url,
      class:class_id (
        title
      ),
      teacher:teacher_id (
        name,
        email
      ),
      assignment_submissions (
        id,
        status,
        submission_text,
        audio_url,
        score,
        feedback,
        submitted_at,
        graded_at,
        audio_feedback_url
      )
      `)
      .eq('student_id', user.id)
      .order('due_date', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      const transformedAssignments = (assignments || []).map(assignment => {
        const submission = assignment.assignment_submissions?.[0];

        // Determine assignment status
        let status = assignment.status || 'assigned';
        if (submission) {
          status = submission.status || 'submitted';
          if (submission.score !== null) {
            status = 'graded';
          }
        }

        // Check if overdue
        const isOverdue = assignment.due_date &&
        new Date(assignment.due_date) < new Date() &&
        status === 'assigned';

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date,
          max_score: assignment.max_score,
          subject: assignment.subject,
          status: isOverdue ? 'late' : status,
          created_at: assignment.created_at,
          updated_at: assignment.updated_at,
          teacher_id: assignment.teacher_id,
          teacher_name: assignment.teacher?.name,
          class_id: assignment.class_id,
          class_title: assignment.class?.title,
          file_url: assignment.file_url,
          submissions: assignment.assignment_submissions || [],
          submission: submission || null,
          score: submission?.score,
          grade: submission?.score,
          feedback: submission?.feedback,
          audio_feedback_url: submission?.audio_feedback_url,
          submitted_at: submission?.submitted_at,
          graded_at: submission?.graded_at
        };
      });

      ProductionLogger.debug(`Fetched ${transformedAssignments.length} assignments`);
      return { assignments: transformedAssignments };

    } catch (error) {
      ProductionLogger.error('Failed to fetch assignments', error);
      throw error;
    }
  },

  async submitAssignment(submissionData) {
    try {
      const user = await this.getCurrentUser();

      ProductionLogger.info('Student submitting assignment', {
        userId: user.id,
        assignmentId: submissionData.assignment_id
      });

      const { assignment_id, submission_text, audio_url } = submissionData;

      // Validate assignment exists and belongs to student
      const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, student_id, due_date, status')
      .eq('id', assignment_id)
      .eq('student_id', user.id)
      .single();

      if (assignmentError) {
        throw new Error('Assignment not found or not authorized');
      }

      // Check if already submitted
      const { data: existingSubmission } = await supabase
      .from('assignment_submissions')
      .select('id')
      .eq('assignment_id', assignment_id)
      .eq('student_id', user.id)
      .single();

      // Determine if submission is late
      const isLate = assignment.due_date && new Date(assignment.due_date) < new Date();
      const status = isLate ? 'late' : 'submitted';

      let result;
      if (existingSubmission) {
        // Update existing submission
        const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
          submission_text,
          audio_url,
          status: status,
          submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id)
        .select()
        .single();

        if (error) throw error;
        result = { success: true, data, message: 'Assignment resubmitted successfully' };
      } else {
        // Create new submission
        const { data, error } = await supabase
        .from('assignment_submissions')
        .insert({
          assignment_id,
          student_id: user.id,
          submission_text,
          audio_url,
          status: status,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

        if (error) throw error;
        result = { success: true, data, message: 'Assignment submitted successfully' };
      }

      ProductionLogger.info('Assignment submitted successfully');
      return result;

    } catch (error) {
      ProductionLogger.error('Failed to submit assignment', error);
      throw error;
    }
  },

  // ===== VIDEO SESSION MANAGEMENT =====
 async joinVideoSession(meetingId) {
  try {
    const user = await this.getCurrentUser();
    
    ProductionLogger.info('🎯 Student joining session:', meetingId);

    // ✅ STEP 1: Get session from database (includes channel_name)
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select(`
        *,
        class:classes (title, teacher_id),
        teacher:teacher_id (name, agora_config)
      `)
      .eq('meeting_id', meetingId)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      throw new Error('No active video session found. Teacher needs to start the class first.');
    }

    // ✅ STEP 2: Get teacher's Agora App ID
    const appId = session.teacher?.agora_config?.appId || 
                  import.meta.env.VITE_AGORA_APP_ID;

    if (!appId) {
      throw new Error('Agora configuration error');
    }

    // ✅ STEP 3: Use EXACT channel name from session
    const channelName = session.channel_name;

    if (!channelName) {
      throw new Error('Invalid session: missing channel name');
    }

    // ✅ STEP 4: Generate CONSISTENT student UID
    const generateStudentUID = () => {
      const combined = `student_${user.id}_${channelName}`;
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash) % 1000000;
    };

    const uid = generateStudentUID();

    ProductionLogger.info('✅ Student credentials generated:', {
      channel: channelName,
      uid: uid,
      meetingId: meetingId
    });

    // Record participation
    await this.recordInitialParticipation(meetingId, user.id, uid)
      .catch(error => ProductionLogger.warn('Participation recording failed', error));

    return {
      success: true,
      meetingId: meetingId,
      channel: channelName, // ✅ EXACT channel from session
      token: null,
      appId: appId,
      uid: uid,
      sessionInfo: {
        classTitle: session.class?.title,
        teacherName: session.teacher?.name
      }
    };

  } catch (error) {
    ProductionLogger.error('❌ Join failed:', error);
    return {
      success: false,
      error: error.message,
      errorCode: getErrorCode(error)
    };
  }
},

  async getSessionStatus(meetingId) {
    try {
      ProductionLogger.debug('Checking session status', { meetingId });

      // Try video endpoint first
      try {
        const data = await ApiRequestHandler.makeRequest(
          `${API_BASE_URL}/api/video/session-status/${meetingId}`
        );

        ProductionLogger.debug('Video status check successful', data);
        return {
          ...data,
          source: 'video_backend'
        };
      } catch (error) {
        ProductionLogger.warn('Video status check failed, trying fallback', error);
      }

      // Fallback to database check
      return await this.getSessionStatusFallback(meetingId);

    } catch (error) {
      ProductionLogger.error('All status checks failed', error);
      // Return optimistic fallback to allow joining attempts
      return {
        is_active: true,
        is_teacher_joined: false,
        student_count: 0,
        started_at: new Date().toISOString(),
        source: 'emergency_fallback',
        fallback: true
      };
    }
  },

  // raise hand functionality

  async raiseHand(meetingId, isRaised) {
    try {
      const user = await this.getCurrentUser();

      ProductionLogger.info('Student raising/lowering hand', {
        meetingId,
        userId: user.id,
        isRaised
      });

      // Update in database
      const { error } = await supabase
      .from('session_participants')
      .update({
        hand_raised: isRaised,
        hand_raised_at: isRaised ? new Date().toISOString() : null
      })
      .eq('session_id', meetingId)
      .eq('student_id', user.id);

      if (error) throw error;

      return { success: true, handRaised: isRaised };

    } catch (error) {
      ProductionLogger.error('Failed to update hand raise status', error);
      throw error;
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
          started_at: null,
          source: 'fallback'
        };
      }

      const teacherJoined = session.participants?.some(p => p.is_teacher) || false;
      const studentCount = session.participants?.filter(p => !p.is_teacher).length || 0;

      return {
        is_active: session.status === 'active' && !session.ended_at,
        is_teacher_joined: teacherJoined,
        student_count: studentCount,
        started_at: session.started_at,
        source: 'fallback'
      };

    } catch (error) {
      ProductionLogger.error('Fallback status check failed', error);
      throw error;
    }
  },

  // ✅ UPDATED: Record initial participation with correct schema
  async recordInitialParticipation(meetingId, studentId, agoraUid = null) {
    try {
      const { data: session } = await supabase
      .from('video_sessions')
      .select('id, class_id')
      .eq('meeting_id', meetingId)
      .single();

      if (!session) {
        throw new Error('Session not found for participation recording');
      }

      const participationData = {
        session_id: session.id, // ✅ CORRECT: session_id instead of meeting_id
        student_id: studentId,  // ✅ CORRECT: student_id instead of user_id
        class_id: session.class_id,
        is_teacher: false,      // ✅ CORRECT: is_teacher instead of user_type
        joined_at: new Date().toISOString(),
        status: 'joined',
        connection_quality: 'excellent',
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          video_capable: !!navigator.mediaDevices?.getUserMedia,
          audio_capable: true,
          agora_uid: agoraUid,
          browser: getBrowserInfo(),
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          connection_type: getConnectionType()
        }
      };

      ProductionLogger.debug('Recording initial participation:', participationData);

      const { error } = await supabase
      .from('session_participants')
      .upsert(participationData, {
        onConflict: 'session_id,student_id',
        ignoreDuplicates: false
      });

      if (error) {
        ProductionLogger.warn('Participation recording failed', error);
        throw error;
      } else {
        ProductionLogger.info('Initial participation recorded successfully');
        return { success: true };
      }
    } catch (error) {
      ProductionLogger.warn('Initial participation recording failed', error);
      throw error;
    }
  },

  // ✅ NEW: Record failed participation attempt
  async recordFailedParticipation(meetingId, error) {
    try {
      const studentId = await getCurrentUserId();

      const { data: session } = await supabase
      .from('video_sessions')
      .select('id, class_id')
      .eq('meeting_id', meetingId)
      .single();

      if (!session) return;

      const failedParticipationData = {
        session_id: session.id,
        student_id: studentId,
        class_id: session.class_id,
        is_teacher: false,
        joined_at: new Date().toISOString(),
        left_at: new Date().toISOString(),
        status: 'failed',
        connection_quality: 'poor',
        duration: 0,
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          error_message: error.message,
          error_type: error.name,
          browser: getBrowserInfo()
        },
        error_details: {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        }
      };

      ProductionLogger.debug('Recording failed participation:', failedParticipationData);

      const { error: dbError } = await supabase
      .from('session_participants')
      .upsert(failedParticipationData, {
        onConflict: 'session_id,student_id',
        ignoreDuplicates: false
      });

      if (dbError) {
        ProductionLogger.warn('Failed participation recording failed', dbError);
      } else {
        ProductionLogger.info('Failed participation recorded successfully');
      }
    } catch (recordError) {
      ProductionLogger.warn('Failed participation recording failed', recordError);
    }
  },

  // recordparticipationfallback
  async recordParticipationFallback(participationData) {
    try {
      ProductionLogger.debug('🚀 Falling back to Supabase direct insertion:', participationData);

      // Map the data to match your database schema
      const dbData = {
        session_id: participationData.session_id,
        student_id: participationData.student_id,
        is_teacher: participationData.is_teacher || false,
        joined_at: participationData.joined_at,
        left_at: participationData.left_at,
        status: participationData.status || 'joined',
        duration: participationData.duration || 0,
        connection_quality: participationData.connection_quality || 'unknown',
        device_info: participationData.device_info || {},
        class_id: participationData.class_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Remove null/undefined fields
      Object.keys(dbData).forEach(key => {
        if (dbData[key] === null || dbData[key] === undefined) {
          delete dbData[key];
        }
      });

      const { data, error } = await supabase
      .from('session_participants')
      .upsert(dbData, {
        onConflict: 'session_id,student_id'
      })
      .select()
      .single();

      if (error) {
        ProductionLogger.error('❌ Supabase fallback insertion failed:', error);
        throw error;
      }

      ProductionLogger.info('✅ Participation recorded via Supabase fallback');
      return { success: true, data };

    } catch (error) {
      ProductionLogger.error('❌ Supabase fallback failed:', error);
      throw error;
    }
  },
  // ✅ UPDATED: Leave video session with proper schema
  async leaveVideoSession(meetingId, duration = 0) {
    try {
      const user = await this.getCurrentUser();

      ProductionLogger.info('Student leaving video session', {
        meetingId,
        userId: user.id,
        duration
      });

      // Try backend API first
      try {
        await ApiRequestHandler.makeRequest(
          `${API_BASE_URL}/api/video/leave-session`,
          {
            method: 'POST',
            body: JSON.stringify({
              meeting_id: meetingId,
              user_id: user.id,
              duration: duration,
              user_type: 'student'
            })
          },
          1 // Only 1 retry for leave operations
        );
      } catch (error) {
        ProductionLogger.warn('Backend leave failed, using fallback', error);
      }

      // Always update database with correct schema
      await this.leaveVideoSessionFallback(meetingId, user.id, duration);

      return {
        success: true,
        message: 'Successfully left video session'
      };

    } catch (error) {
      ProductionLogger.error('Error leaving video session', error);
      // Don't throw error for leave operations
      return {
        success: true,
        message: 'Left session locally'
      };
    }
  },

  // ✅ UPDATED: Leave video session fallback with correct schema
  async leaveVideoSessionFallback(meetingId, studentId, duration) {
    try {
      const { data: session } = await supabase
      .from('video_sessions')
      .select('id')
      .eq('meeting_id', meetingId)
      .single();

      if (!session) return;

      const updateData = {
        status: 'left',
        left_at: new Date().toISOString(),
        duration: Math.round(duration), // ✅ CORRECT: duration instead of duration_minutes
        connection_quality: 'excellent' // You can update this based on actual connection quality
      };

      ProductionLogger.debug('Updating participation for leave:', updateData);

      const { error } = await supabase
      .from('session_participants')
      .update(updateData)
      .eq('session_id', session.id)
      .eq('student_id', studentId)
      .is('left_at', null);

      if (error) {
        ProductionLogger.warn('Fallback leave update failed', error);
      } else {
        ProductionLogger.info('Participation updated for leave successfully');
      }

    } catch (error) {
      ProductionLogger.error('Fallback leave failed', error);
    }
  },

  // ✅ NEW: Enhanced recordParticipation method for external use

  async recordParticipation(participationData) {
    try {
      ProductionLogger.debug('🚀 Recording participation via backend API');

      const response = await fetch(`${API_BASE_URL}/api/video/record-participation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(participationData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      ProductionLogger.info('✅ Participation recorded successfully via backend');
      return result;

    } catch (error) {
      ProductionLogger.error('❌ Backend participation recording failed, falling back to Supabase', error);

      // Fallback to direct Supabase insertion
      return await this.recordParticipationFallback(participationData);
    }
  },
  joinClassVideoSession: async (classId) => {
    try {
      const user = await studentApi.getCurrentUser();

      ProductionLogger.info('🎯 Student joining class video session (UNIFIED)', {
        classId,
        userId: user.id
      });

      // 1. Find active session for this class
      const activeSession = await studentApi.findActiveClassSession(classId);

      if (!activeSession) {
        throw new Error('No active video session found for this class. Please ask the teacher to start the session.');
      }

      ProductionLogger.info('✅ Found active session:', {
        meetingId: activeSession.meeting_id,
        channel: activeSession.channel_name,
        teacherId: activeSession.teacher_id
      });

      // 2. Get Agora credentials using the SAME channel as teacher
      const credentials = await studentApi.generateStudentAgoraCredentials(
        activeSession.channel_name,
        user.id
      );

      // 3. Record participation
      await studentApi.recordStudentParticipation(activeSession.meeting_id, user.id, credentials.uid)
      .catch(error => ProductionLogger.warn('Participation recording failed', error));

      ProductionLogger.info('🎯 Student join successful:', {
        channel: credentials.channel,
        uid: credentials.uid,
        meetingId: activeSession.meeting_id
      });

      return {
        success: true,
        meetingId: activeSession.meeting_id,
        channel: credentials.channel,
        token: credentials.token,
        appId: credentials.appId,
        uid: credentials.uid,
        sessionInfo: {
          classTitle: activeSession.class?.title,
          teacherName: activeSession.teacher?.name
        }
      };

    } catch (error) {
      ProductionLogger.error('❌ Student joinClassVideoSession failed', error);
      return {
        success: false,
        error: error.message,
        errorCode: getErrorCode(error)
      };
    }
  },
  findActiveClassSession: async (classId) => {
    try {
      ProductionLogger.debug('🔍 Looking for active session for class:', classId);

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
          ProductionLogger.debug('🔍 No active session found for class:', classId);
          return null;
        }
        throw error;
      }

      ProductionLogger.debug('✅ Found active session:', session.meeting_id);
      return session;

    } catch (error) {
      ProductionLogger.error('❌ Error finding active session:', error);
      return null;
    }
  },

  generateStudentAgoraCredentials: async (channelName, studentId) => {
    try {
      // Get teacher's Agora config from the session
      const { data: session } = await supabase
      .from('video_sessions')
      .select(`
      teacher:teacher_id (agora_config)
      `)
      .eq('channel_name', channelName)
      .eq('status', 'active')
      .single();

      const appId = session?.teacher?.agora_config?.appId || process.env.VITE_AGORA_APP_ID;

      if (!appId) {
        throw new Error('Agora App ID not configured');
      }

      // 🎯 CRITICAL: Generate consistent UID for student
      const generateStudentUID = () => {
        const combined = `student_${studentId}_${channelName}`;
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
          const char = combined.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash) % 1000000;
      };

      const uid = generateStudentUID();

      ProductionLogger.debug('🎯 Generated student Agora credentials:', {
        appId: appId.substring(0, 8) + '...',
                             channel: channelName,
                             uid
      });

      return {
        appId,
        channel: channelName,
        token: null,
        uid: uid
      };

    } catch (error) {
      ProductionLogger.error('❌ Error generating student credentials:', error);
      throw error;
    }
  },

  recordStudentParticipation: async (meetingId, studentId, agoraUid) => {
    try {
      const { data: session } = await supabase
      .from('video_sessions')
      .select('id, class_id, channel_name')
      .eq('meeting_id', meetingId)
      .single();

      if (!session) {
        throw new Error('Session not found');
      }

      const participationData = {
        session_id: session.id,
        student_id: studentId,
        class_id: session.class_id,
        is_teacher: false,
        joined_at: new Date().toISOString(),
        status: 'joined',
        agora_uid: agoraUid,
        device_info: {
          user_agent: navigator.userAgent,
          browser: getBrowserInfo(),
          channel: session.channel_name // 🎯 DEBUG: Track which channel student joined
        }
      };

      ProductionLogger.debug('📝 Recording student participation:', participationData);

      const { error } = await supabase
      .from('session_participants')
      .upsert(participationData, {
        onConflict: 'session_id,student_id'
      });

      if (error) {
        ProductionLogger.warn('Participation recording failed', error);
        throw error;
      }

      ProductionLogger.info('✅ Student participation recorded');
      return { success: true };

    } catch (error) {
      ProductionLogger.warn('Student participation recording failed', error);
      throw error;
    }
  },

  // 🚀 NEW: Get active session for a class
  getActiveClassSession: async (classId) => {
    try {
      console.log('🔍 Student looking for active session for class:', classId);

      const { data, error } = await supabase
      .from('video_sessions')
      .select(`
      *,
      class:classes (title, teacher_id),
              teacher:teacher_id (name, email)
              `)
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('🔍 No active session found for class:', classId);
          return null;
        }
        throw error;
      }

      console.log('✅ Student found active session:', data.meeting_id);
      return data;

    } catch (error) {
      console.error('❌ Error getting active class session:', error);
      return null;
    }
  },

  async debugClassSessions(classId) {
    try {
      ProductionLogger.info('🔍 Debugging class sessions', { classId });

      // Check for any video sessions for this class
      const { data: sessions, error } = await supabase
      .from('video_sessions')
      .select(`
      *,
      class:classes (title, teacher_id),
              teacher:teacher_id (name, email)
              `)
      .eq('class_id', classId)
      .order('started_at', { ascending: false });

      if (error) throw error;

      const activeSessions = sessions?.filter(s => s.status === 'active') || [];
      const totalSessions = sessions?.length || 0;

      ProductionLogger.info('Session debug results', {
        totalSessions,
        activeSessions: activeSessions.length,
        sessions: sessions?.map(s => ({
          id: s.id,
          meeting_id: s.meeting_id,
          status: s.status,
          started_at: s.started_at
        }))
      });

      return {
        totalSessions,
        activeSessions: activeSessions.length,
        sessions: activeSessions,
        hasActiveSession: activeSessions.length > 0
      };

    } catch (error) {
      ProductionLogger.error('Session debug failed', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        sessions: [],
        hasActiveSession: false,
        error: error.message
      };
    }
  },
  // ===== STATISTICS & ANALYTICS =====
  async getMyStats() {
    try {
      const user = await this.getCurrentUser();

      const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
      progress,
      attendance_rate,
      overall_score,
      completed_assignments,
      total_assignments,
      last_active,
      teacher_id
      `)
      .eq('id', user.id)
      .single();

      if (profileError) throw profileError;

      if (!profile?.teacher_id) {
        return this.getDefaultStats();
      }

      // Get actual counts from database
      const [
        classesCount,
        assignmentsData,
        submissionsData
      ] = await Promise.all([
        supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', profile.teacher_id),

                            supabase
                            .from('assignments')
                            .select('id', { count: 'exact', head: true })
                            .eq('student_id', user.id),

                            supabase
                            .from('assignment_submissions')
                            .select('score')
                            .eq('student_id', user.id)
                            .not('score', 'is', null)
      ]);

      // Calculate stats
      const totalClasses = classesCount.count || 0;
      const totalAssignments = assignmentsData.count || 0;
      const completedAssignments = profile.completed_assignments || 0;

      let avgScore = profile.overall_score || 0;
      if (submissionsData.data && submissionsData.data.length > 0) {
        const totalScore = submissionsData.data.reduce((sum, sub) => sum + (sub.score || 0), 0);
        avgScore = Math.round(totalScore / submissionsData.data.length);
      }

      const { data: completedClasses } = await supabase
      .from('classes')
      .select('duration')
      .eq('teacher_id', profile.teacher_id)
      .eq('status', 'completed');

      const hoursLearned = completedClasses?.reduce((total, classItem) =>
      total + (classItem.duration || 60) / 60, 0) || 0;

      const completionRate = profile.progress || 0;
      const attendanceRate = profile.attendance_rate || 0;

      const points = completedAssignments * 10 + (avgScore || 0);
      const level = Math.floor(points / 100) + 1;
      const nextLevel = 100 - (points % 100);

      const streak = Math.floor(Math.random() * 14) + 1;

      const stats = {
        total_classes: totalClasses,
        hours_learned: Math.round(hoursLearned),
        assignments: totalAssignments,
        completed_assignments: completedAssignments,
        avg_score: avgScore,
        completion_rate: completionRate,
        attendance_rate: attendanceRate,
        points: points,
        level: level,
        next_level: nextLevel,
        streak: streak
      };

      ProductionLogger.debug('Student stats calculated', stats);
      return stats;

    } catch (error) {
      ProductionLogger.error('Failed to calculate stats', error);
      return this.getDefaultStats();
    }
  },

  getDefaultStats() {
    return {
      total_classes: 0,
      hours_learned: 0,
      assignments: 0,
      completed_assignments: 0,
      avg_score: 0,
      completion_rate: 0,
      attendance_rate: 0,
      points: 0,
      level: 1,
      next_level: 100,
      streak: 0
    };
  },

  // ===== NOTIFICATIONS =====
  async getMyNotifications(limit = 20, page = 1) {
    try {
      const user = await this.getCurrentUser();

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: notifications, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

      if (error) throw error;

      const result = {
        notifications: notifications || [],
        total: count || 0,
        page,
        limit,
        hasMore: (count || 0) > to + 1
      };

      ProductionLogger.debug(`Fetched ${result.notifications.length} notifications`);
      return result;

    } catch (error) {
      ProductionLogger.error('Failed to fetch notifications', error);
      throw error;
    }
  },

  // ===== DIAGNOSTICS & DEBUGGING =====
  async debugSessionConnection(meetingId) {
    try {
      const user = await this.getCurrentUser();

      ProductionLogger.info('Running session connection diagnostic', { meetingId, userId: user.id });

      const diagnostic = {
        meetingId,
        userId: user.id,
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

      // Check database session
      try {
        const { data: session, error } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('meeting_id', meetingId)
        .single();

        diagnostic.checks.databaseSession = !!session;
        diagnostic.checks.sessionData = session;
        diagnostic.checks.databaseError = error?.message;
      } catch (e) {
        diagnostic.checks.databaseSession = false;
        diagnostic.checks.databaseError = e.message;
      }

      // Check direct join
      try {
        const joinResponse = await fetch(`${API_BASE_URL}/api/video/join-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: user.id,
            user_type: 'student',
            user_name: user.email
          })
        });

        diagnostic.checks.directJoin = joinResponse.ok;
        if (joinResponse.ok) {
          diagnostic.checks.joinData = await joinResponse.json();
        } else {
          diagnostic.checks.joinError = await joinResponse.text();
        }
      } catch (e) {
        diagnostic.checks.directJoin = false;
        diagnostic.checks.joinError = e.message;
      }

      ProductionLogger.info('Session diagnostic completed', diagnostic);
      return diagnostic;

    } catch (error) {
      ProductionLogger.error('Session diagnostic failed', error);
      return { error: error.message };
    }
  }
};

export default studentApi;
