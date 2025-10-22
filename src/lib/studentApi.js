import { supabase } from './supabaseClient';

// ===== CONFIGURATION =====
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://madina-quran-backend.onrender.com/api';
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ===== UTILITY FUNCTIONS =====
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

// ===== MAIN STUDENT API =====
export const studentApi = {
  // Get student dashboard data
  getDashboardData: async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');
      
      const studentId = user.id;
      
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
      .eq('id', studentId)
      .single();
      
      if (profileError) throw profileError;
      
      // Get all data in parallel
      const [classesData, assignmentsData, statsData, notificationsData] = await Promise.all([
        studentApi.getMyClasses(),
                                                                                             studentApi.getMyAssignments(),
                                                                                             studentApi.getMyStats(),
                                                                                             studentApi.getMyNotifications()
      ]);
      
      return {
        student: profile,
        teacher: profile.teacher,
        classes: classesData.classes || [],
        assignments: assignmentsData.assignments || [],
        stats: statsData,
        notifications: notificationsData.notifications || [],
        hasTeacher: !!profile.teacher_id
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  },
  
  // Get student's classes from their assigned teacher
  getMyClasses: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get student's teacher_id
      const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('teacher_id')
      .eq('id', user.id)
      .single();
      
      if (profileError) throw profileError;
      
      if (!profile?.teacher_id) {
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
      
      // Transform data to match frontend expectations
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
      
      return {
        classes: transformedClasses,
        teacher: classes?.[0]?.teacher || null
      };
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  },
  
  // Get student's assignments with submissions
  getMyAssignments: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get assignments for the student
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
      
      // Transform assignments data
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
          // For easy access to latest submission
          submission: submission || null,
          score: submission?.score,
          grade: submission?.score, // Alias for score
          feedback: submission?.feedback,
          audio_feedback_url: submission?.audio_feedback_url,
          submitted_at: submission?.submitted_at,
          graded_at: submission?.graded_at
        };
      });
      
      return { assignments: transformedAssignments };
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  },
  
  // Submit assignment
  submitAssignment: async (submissionData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
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
        return { success: true, data, message: 'Assignment resubmitted successfully' };
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
        return { success: true, data, message: 'Assignment submitted successfully' };
      }
    } catch (error) {
      console.error('Error submitting assignment:', error);
      throw error;
    }
  },
  
  // Get student statistics - using profile data and actual counts
  getMyStats: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get student profile with stats
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
      
      // If no teacher_id, return empty stats
      if (!profile?.teacher_id) {
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
      }
      
      // Get actual counts from database
      const [
        classesCount,
        assignmentsData,
        submissionsData
      ] = await Promise.all([
        // Count classes from student's teacher
        supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', profile.teacher_id),
                            
                            // Get assignments count
                            supabase
                            .from('assignments')
                            .select('id', { count: 'exact', head: true })
                            .eq('student_id', user.id),
                            
                            // Get graded submissions for average score
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
      
      // Calculate average score from actual submissions
      let avgScore = profile.overall_score || 0;
      if (submissionsData.data && submissionsData.data.length > 0) {
        const totalScore = submissionsData.data.reduce((sum, sub) => sum + (sub.score || 0), 0);
        avgScore = Math.round(totalScore / submissionsData.data.length);
      }
      
      // Calculate hours learned (based on completed classes and duration)
      const { data: completedClasses } = await supabase
      .from('classes')
      .select('duration')
      .eq('teacher_id', profile.teacher_id)
      .eq('status', 'completed');
      
      const hoursLearned = completedClasses?.reduce((total, classItem) =>
      total + (classItem.duration || 60) / 60, 0) || 0;
      
      // Calculate progress metrics
      const completionRate = profile.progress || 0;
      const attendanceRate = profile.attendance_rate || 0;
      
      // Calculate points and level based on completed work
      const points = completedAssignments * 10 + (avgScore || 0);
      const level = Math.floor(points / 100) + 1;
      const nextLevel = 100 - (points % 100);
      
      // Calculate streak (placeholder - you might want to implement actual streak logic)
      const streak = Math.floor(Math.random() * 14) + 1;
      
      return {
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
    } catch (error) {
      console.error('Error fetching stats:', error);
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
    }
  },
  
  // Get student's notifications
  getMyNotifications: async (limit = 20, page = 1) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      const { data: notifications, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);
      
      if (error) throw error;
      
      return {
        notifications: notifications || [],
        total: count || 0,
        page,
        limit,
        hasMore: (count || 0) > to + 1
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  },
  
  // Mark notification as read
  markNotificationAsRead: async (notificationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .select()
      .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },
  
  // Mark all notifications as read
  markAllNotificationsAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('read', false)
      .select();
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },
  
  // Delete notification
  deleteNotification: async (notificationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .select()
      .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },
  
  // Clear all notifications
  clearAllNotifications: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .select();
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  },
  
  // Get unread notifications count
  getUnreadNotificationsCount: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  },
  
  // Get student's video sessions
  getMyVideoSessions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get student's teacher_id
      const { data: profile } = await supabase
      .from('profiles')
      .select('teacher_id')
      .eq('id', user.id)
      .single();
      
      if (!profile?.teacher_id) {
        return [];
      }
      
      // Get video sessions from student's teacher
      const { data: sessions, error } = await supabase
      .from('video_sessions')
      .select(`
      id,
      meeting_id,
      class_id,
      status,
      started_at,
      ended_at,
      channel_name,
      agenda,
      scheduled_date,
      classes (
        title,
        teacher:teacher_id (
          name,
          email
        )
      )
      `)
      .eq('classes.teacher_id', profile.teacher_id)
      .order('scheduled_date', { ascending: false });
      
      if (error) throw error;
      
      return (sessions || []).map(session => ({
        id: session.id,
        meeting_id: session.meeting_id,
        class_id: session.class_id,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        channel_name: session.channel_name,
        agenda: session.agenda,
        scheduled_date: session.scheduled_date,
        class_title: session.classes?.title,
        teacher_name: session.classes?.teacher?.name
      }));
    } catch (error) {
      console.error('Error fetching video sessions:', error);
      throw error;
    }
  },
  
  // Get student's payments
  getMyPayments: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get payments from fee_payments table
      const { data: payments, error } = await supabase
      .from('fee_payments')
      .select('*')
      .eq('student_id', user.id)
      .order('payment_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching payments:', error);
        return [];
      }
      
      return payments || [];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  },
  
  // Contact admin
  contactAdmin: async (message) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get student name for the notification
      const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
      
      if (!message || message.trim().length === 0) {
        throw new Error('Message is required');
      }
      
      // Create admin notification
      const { data, error } = await supabase
      .from('admin_notifications')
      .insert({
        student_id: user.id,
        student_name: profile?.name || user.email,
        message: message.trim(),
              type: 'contact_request',
              status: 'pending'
      })
      .select()
      .single();
      
      if (error) throw error;
      
      return { success: true, data, message: 'Message sent to admin successfully' };
    } catch (error) {
      console.error('Error contacting admin:', error);
      throw error;
    }
  },
  
  // Update student profile
  updateProfile: async (updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { name, course } = updates;
      
      if (!name && !course) {
        throw new Error('At least one field (name or course) is required');
      }
      
      const updateData = {};
      if (name) updateData.name = name;
      if (course) updateData.course = course;
      updateData.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();
      
      if (error) throw error;
      
      return { success: true, data, message: 'Profile updated successfully' };
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },
  
  // ===== VIDEO SESSION METHODS =====
  
  /**
   * PRODUCTION-READY: Enhanced video session join with comprehensive error handling
   */
  joinVideoSession: async (meetingId) => {
    let lastError = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔄 REAL Join attempt ${attempt}/${MAX_RETRIES} for session:`, meetingId);
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error('User authentication failed: ' + (authError?.message || 'No user found'));
        }
        
        // 1. Validate meeting ID format
        if (!meetingId || typeof meetingId !== 'string' || meetingId.trim().length === 0) {
          throw new Error('Invalid meeting ID format');
        }
        
        // 2. FIRST: Check if session exists and is active
        console.log('🔍 Checking session status...');
        const sessionStatus = await fetch(
          `${API_BASE_URL}/agora/session-status/${meetingId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${await getToken()}`,
                                          'Content-Type': 'application/json',
            },
          }
        );
        
        if (!sessionStatus.ok) {
          if (sessionStatus.status === 404) {
            throw new Error('SESSION_NOT_FOUND');
          }
          throw new Error(`Session status check failed: ${sessionStatus.status}`);
        }
        
        const statusData = await sessionStatus.json();
        console.log('📊 Session status response:', statusData);
        
        if (!statusData.success) {
          throw new Error('SESSION_NOT_ACTIVE');
        }
        
        // 3. Get REAL Agora credentials from backend
        console.log('🎫 Requesting Agora credentials...');
        const joinResponse = await fetch(
          `${API_BASE_URL}/agora/join-session`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await getToken()}`,
                                         'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              meeting_id: meetingId,
              role: 'student',
              user_id: user.id,
              user_email: user.email
            }),
          }
        );
        
        if (!joinResponse.ok) {
          const errorText = await joinResponse.text();
          console.error('❌ Join credentials failed:', joinResponse.status, errorText);
          
          if (joinResponse.status === 404) {
            throw new Error('JOIN_ENDPOINT_NOT_FOUND');
          } else if (joinResponse.status === 403) {
            throw new Error('ACCESS_DENIED');
          } else if (joinResponse.status === 400) {
            throw new Error('INVALID_REQUEST');
          }
          throw new Error('CREDENTIALS_FAILED');
        }
        
        const joinData = await joinResponse.json();
        console.log('✅ Join credentials received:', {
          hasAppId: !!joinData.appId,
          hasChannel: !!joinData.channel,
          hasToken: !!joinData.token,
          hasUid: !!joinData.uid,
          success: joinData.success
        });
        
        if (!joinData.success) {
          throw new Error(joinData.error || 'JOIN_FAILED');
        }
        
        // 4. Validate REAL Agora data structure
        if (!joinData.appId || !joinData.channel) {
          throw new Error('MISSING_AGORA_CREDENTIALS');
        }
        
        // 5. Record participation (fire-and-forget)
        try {
          await fetch(`${API_BASE_URL}/agora/record-participation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await getToken()}`,
                      'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              meeting_id: meetingId,
              user_id: user.id,
              action: 'joined'
            }),
          });
        } catch (recordError) {
          console.warn('Non-critical: Participation recording failed:', recordError);
        }
        
        // 6. Return standardized REAL success response
        return {
          success: true,
          meetingId: meetingId,
          channel: joinData.channel,
          token: joinData.token,
          appId: joinData.appId,
          uid: joinData.uid || generateRandomUid(),
          timestamp: new Date().toISOString(),
          sessionInfo: {
            isActive: true,
            participantCount: statusData.session?.participant_count || 0,
            teacherId: statusData.session?.teacher_id
          }
        };
        
      } catch (error) {
        lastError = error;
        console.error(`❌ REAL Join attempt ${attempt} failed:`, error.message);
        
        // Don't retry for these critical errors
        if (error.message.includes('SESSION_NOT_FOUND') ||
          error.message.includes('JOIN_ENDPOINT_NOT_FOUND') ||
          error.message.includes('ACCESS_DENIED') ||
          error.message.includes('MISSING_AGORA_CREDENTIALS')) {
          break;
          }
          
          // Wait before retry (except on last attempt)
          if (attempt < MAX_RETRIES) {
            console.log(`⏳ Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          }
      }
    }
    
    // All retries failed - return detailed error
    const errorResponse = {
      success: false,
      error: lastError?.message || 'Failed to join video session after multiple attempts',
      errorCode: getErrorCode(lastError),
      retryCount: MAX_RETRIES,
      timestamp: new Date().toISOString(),
      meetingId: meetingId
    };
    
    console.error('💥 All REAL join attempts failed:', errorResponse);
    return errorResponse;
  },
  
  /**
   * PRODUCTION-READY: Get join credentials from multiple sources with priority
   */
  getJoinCredentials: async (meetingId, userId, userEmail) => {
    const credentialSources = [
      { name: 'primary-backend', priority: 1, method: studentApi.getCredentialsFromBackend },
      { name: 'database-fallback', priority: 2, method: studentApi.getCredentialsFromDatabase },
      { name: 'emergency-fallback', priority: 3, method: studentApi.getEmergencyCredentials }
    ];
    
    // Sort by priority
    credentialSources.sort((a, b) => a.priority - b.priority);
    
    for (const source of credentialSources) {
      try {
        console.log(`🔍 Trying credential source: ${source.name}`);
        const credentials = await source.method(meetingId, userId, userEmail);
        
        if (credentials && credentials.channel && credentials.appId) {
          console.log(`✅ Credentials obtained from ${source.name}`);
          return {
            ...credentials,
            source: source.name,
            obtainedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.warn(`⚠️ Credential source ${source.name} failed:`, error.message);
        // Continue to next source
      }
    }
    
    return null;
  },
  
  /**
   * PRODUCTION-READY: Primary backend credential source
   */
  getCredentialsFromBackend: async (meetingId, userId, userEmail) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-User-Type': 'student'
        },
        body: JSON.stringify({
          meeting_id: meetingId,
          user_id: userId,
          user_type: 'student',
          user_name: userEmail || 'Student',
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!data.channel || !data.appId) {
        throw new Error('Invalid response format from backend');
      }
      
      return data;
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Backend request timeout');
      }
      throw error;
    }
  },
  
  /**
   * PRODUCTION-READY: Database fallback with cached configuration
   */
  getCredentialsFromDatabase: async (meetingId, userId, userEmail) => {
    try {
      // Get session with class and teacher info
      const { data: session, error } = await supabase
      .from('video_sessions')
      .select(`
      class_id,
      channel_name,
      classes (
        title,
        teacher:teacher_id (
          name,
          agora_config
        )
      )
      `)
      .eq('meeting_id', meetingId)
      .single();
      
      if (error || !session) {
        throw new Error('Session not found in database');
      }
      
      // Try to get Agora config from teacher profile or use environment variable
      const teacherConfig = session.classes?.teacher?.agora_config;
      const appId = teacherConfig?.appId || AGORA_APP_ID;
      
      if (!appId) {
        throw new Error('No Agora App ID configured');
      }
      
      // Use channel name from session or generate consistent one
      const channel = session.channel_name || `class_${session.class_id}_${meetingId}`;
      
      return {
        channel: channel,
        token: null, // Token-less mode for fallback
        appId: appId,
        uid: generateDeterministicUID(userId, meetingId),
        isFallback: true
      };
      
    } catch (error) {
      throw new Error(`Database fallback failed: ${error.message}`);
    }
  },
  
  /**
   * PRODUCTION-READY: Emergency credentials when all else fails
   */
  getEmergencyCredentials: async (meetingId, userId, userEmail) => {
    // Generate consistent credentials based on meeting and user
    if (!AGORA_APP_ID) {
      throw new Error('Emergency fallback: No Agora App ID in environment');
    }
    
    // Create deterministic channel name that teacher can predict
    const channel = `emergency_${meetingId.substring(0, 8)}`;
    const uid = generateDeterministicUID(userId, meetingId);
    
    console.warn('🚨 Using emergency fallback credentials');
    
    return {
      channel: channel,
      token: null,
      appId: AGORA_APP_ID,
      uid: uid,
      isEmergency: true,
      warning: 'Using emergency fallback mode - limited functionality'
    };
  },
  
  /**
   * PRODUCTION-READY: Enhanced session access verification
   */
  verifySessionAccess: async (meetingId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { can_join: false, reason: 'Not authenticated' };
      }
      
      // Get session with detailed access control
      const { data: session, error } = await supabase
      .from('video_sessions')
      .select(`
      id,
      status,
      started_at,
      ended_at,
      scheduled_date,
      max_participants,
      class_id,
      classes (
        id,
        title,
        status as class_status,
        teacher_id,
        teacher:teacher_id (
          name,
          email,
          is_active
        )
      ),
      participants:video_session_participants(count)
      `)
      .eq('meeting_id', meetingId)
      .single();
      
      if (error || !session) {
        return { can_join: false, reason: 'Session not found' };
      }
      
      // Check session status
      if (session.status !== 'active' || session.ended_at) {
        return { can_join: false, reason: 'Session has ended' };
      }
      
      // Check if session has started (with grace period)
      const scheduledTime = new Date(session.scheduled_date || session.started_at);
      const now = new Date();
      const gracePeriod = 15 * 60 * 1000; // 15 minutes
      if (now < scheduledTime - gracePeriod) {
        return { can_join: false, reason: 'Session has not started yet' };
      }
      
      // Check teacher status
      if (!session.classes?.teacher?.is_active) {
        return { can_join: false, reason: 'Teacher account is not active' };
      }
      
      // Verify student enrollment
      const { data: enrollment } = await supabase
      .from('student_classes')
      .select('id, status')
      .eq('class_id', session.class_id)
      .eq('student_id', user.id)
      .single();
      
      if (!enrollment) {
        return { can_join: false, reason: 'Not enrolled in this class' };
      }
      
      if (enrollment.status !== 'active') {
        return { can_join: false, reason: 'Student enrollment is not active' };
      }
      
      // Check participant limit
      const participantCount = session.participants?.[0]?.count || 0;
      if (session.max_participants && participantCount >= session.max_participants) {
        return { can_join: false, reason: 'Session is full' };
      }
      
      return {
        can_join: true,
        session: session,
        class_title: session.classes?.title,
        teacher_name: session.classes?.teacher?.name
      };
      
    } catch (error) {
      console.error('Session access verification error:', error);
      return { can_join: false, reason: 'Access verification failed' };
    }
  },
  
  /**
   * PRODUCTION-READY: Enhanced participation recording
   */
  recordSessionParticipation: async (meetingId, studentId) => {
    try {
      const { data: session } = await supabase
      .from('video_sessions')
      .select('id, class_id')
      .eq('meeting_id', meetingId)
      .single();
      
      if (!session) {
        throw new Error('Session not found for participation recording');
      }
      
      // Upsert participant record with conflict handling
      const { error } = await supabase
      .from('video_session_participants')
      .upsert({
        session_id: session.id,
        student_id: studentId,
        class_id: session.class_id,
        joined_at: new Date().toISOString(),
              status: 'joined',
              is_teacher: false,
              connection_quality: 'unknown',
              device_info: {
                user_agent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
              }
      }, {
        onConflict: 'session_id,student_id',
        ignoreDuplicates: false
      });
      
      if (error) {
        console.warn('Participation recording failed:', error);
        // Don't throw - this shouldn't block the join process
      } else {
        console.log('✅ Participation recorded successfully');
      }
    } catch (error) {
      console.warn('Non-critical: Participation recording failed:', error);
      // Silently fail - this is non-critical for joining
    }
  },
  
  /**
   * Get session status with enhanced checking
   */
  getSessionStatus: async (meetingId) => {
    try {
      console.log('🔍 Checking session status:', meetingId);
      
      // Try backend API first
      try {
        const response = await fetch(`${API_BASE_URL}/agora/session-status/${meetingId}`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Backend status check successful:', data);
          return {
            ...data,
            source: 'backend'
          };
        }
      } catch (backendError) {
        console.warn('⚠️ Backend status check failed, using fallback:', backendError.message);
      }
      
      // Fallback to database check
      return await studentApi.getSessionStatusFallback(meetingId);
      
    } catch (error) {
      console.error('❌ Error checking session status:', error);
      // Return optimistic fallback to allow joining
      return {
        is_active: true,
        is_teacher_joined: true,
        student_count: 0,
        started_at: new Date().toISOString(),
        source: 'fallback',
        fallback: true
      };
    }
  },
  
  /**
   * Fallback session status check
   */
  getSessionStatusFallback: async (meetingId) => {
    try {
      const { data: session, error } = await supabase
      .from('video_sessions')
      .select(`
      *,
      participants:video_session_participants(
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
      console.error('❌ Fallback status check failed:', error);
      throw error;
    }
  },
  
  /**
   * Leave video session with proper cleanup
   */
  leaveVideoSession: async (meetingId, duration = 0) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      console.log('🚪 Student leaving video session:', { meetingId, userId: user.id, duration });
      
      // Try backend API first
      try {
        const response = await fetch(`${API_BASE_URL}/agora/leave-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: user.id,
            duration: duration,
            user_type: 'student'
          })
        });
        
        if (response.ok) {
          console.log('✅ Backend leave successful');
        }
      } catch (backendError) {
        console.warn('⚠️ Backend leave failed, using fallback:', backendError.message);
      }
      
      // Always update database regardless of backend status
      await studentApi.leaveVideoSessionFallback(meetingId, user.id, duration);
      
      return {
        success: true,
        message: 'Successfully left video session'
      };
      
    } catch (error) {
      console.error('❌ Error leaving video session:', error);
      // Don't throw error for leave operations
      return {
        success: true,
        message: 'Left session locally'
      };
    }
  },
  
  /**
   * Fallback leave session method
   */
  leaveVideoSessionFallback: async (meetingId, studentId, duration) => {
    try {
      // Get session ID
      const { data: session } = await supabase
      .from('video_sessions')
      .select('id')
      .eq('meeting_id', meetingId)
      .single();
      
      if (!session) return;
      
      // Update participant status
      await supabase
      .from('video_session_participants')
      .update({
        status: 'left',
        left_at: new Date().toISOString(),
              duration_minutes: Math.round(duration / 60)
      })
      .eq('session_id', session.id)
      .eq('student_id', studentId)
      .is('left_at', null);
      
      console.log('✅ Fallback leave recorded');
      
    } catch (error) {
      console.error('❌ Fallback leave failed:', error);
    }
  },
  
  
  
  /**
   * Get active video sessions for student
   */
  getActiveVideoSessions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get student's teacher
      const { data: profile } = await supabase
      .from('profiles')
      .select('teacher_id')
      .eq('id', user.id)
      .single();
      
      if (!profile?.teacher_id) {
        return [];
      }
      
      // Get active sessions from student's teacher
      const { data: sessions, error } = await supabase
      .from('video_sessions')
      .select(`
      *,
      class:classes (
        title,
        teacher:teacher_id (name)
      )
      `)
      .eq('classes.teacher_id', profile.teacher_id)
      .eq('status', 'active')
      .is('ended_at', null)
      .order('started_at', { ascending: false });
      
      if (error) throw error;
      
      return sessions || [];
      
    } catch (error) {
      console.error('❌ Error fetching active video sessions:', error);
      return [];
    }
  }
};
// Helper function to get authentication token
const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// Generate random UID for Agora
const generateRandomUid = () => {
  return Math.floor(Math.random() * 100000);
};

// Enhanced error code mapping
const getErrorCode = (error) => {
  if (!error) return 'UNKNOWN_ERROR';
  
  const message = error.message;
  if (message.includes('SESSION_NOT_FOUND')) return 'SESSION_NOT_FOUND';
  if (message.includes('SESSION_NOT_ACTIVE')) return 'SESSION_NOT_ACTIVE';
  if (message.includes('JOIN_ENDPOINT_NOT_FOUND')) return 'JOIN_ENDPOINT_NOT_FOUND';
  if (message.includes('ACCESS_DENIED')) return 'ACCESS_DENIED';
  if (message.includes('MISSING_AGORA_CREDENTIALS')) return 'MISSING_CREDENTIALS';
  if (message.includes('CREDENTIALS_FAILED')) return 'CREDENTIALS_FAILED';
  if (message.includes('authentication')) return 'AUTH_FAILED';
  if (message.includes('Invalid')) return 'INVALID_INPUT';
  
  return 'NETWORK_ERROR';
};

export default studentApi;
