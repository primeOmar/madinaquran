// src/lib/studentApi.js
import { supabase } from './supabaseClient';

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

      // Verify user is a student
      if (profile.role !== 'student') {
        throw new Error('User is not a student');
      }

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
        .eq('role', 'student')
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

      // Verify user is a student
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'student') {
        throw new Error('User is not a student');
      }

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

      // Verify user is a student
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'student') {
        throw new Error('User is not a student');
      }

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
        .eq('role', 'student')
        .single();

      if (profileError) throw profileError;

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

  // Join video session
  joinVideoSession: async (meetingId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Verify user is a student
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, teacher_id')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'student') {
        throw new Error('User is not a student');
      }

      // Get video session details
      const { data: session, error: sessionError } = await supabase
        .from('video_sessions')
        .select(`
          id,
          meeting_id,
          class_id,
          status,
          channel_name,
          classes (
            id,
            teacher_id
          )
        `)
        .eq('meeting_id', meetingId)
        .in('status', ['scheduled', 'active'])
        .single();

      if (sessionError || !session) {
        throw new Error('Video session not found or not active');
      }

      // Verify student has access to this class through their teacher
      if (!profile.teacher_id || profile.teacher_id !== session.classes?.teacher_id) {
        throw new Error('Not authorized to join this session');
      }

      // Generate student token (in real implementation, this would be from your video provider)
      const studentToken = `student-${meetingId}-${user.id}-${Date.now()}`;

      return {
        meeting_id: session.meeting_id,
        student_token: studentToken,
        channel_name: session.channel_name,
        class_id: session.class_id,
        message: 'Joined video session successfully'
      };
    } catch (error) {
      console.error('Error joining video session:', error);
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
        .eq('role', 'student')
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

      // Verify user is a student
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'student') {
        throw new Error('User is not a student');
      }

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

      // Verify user is a student
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'student') {
        throw new Error('User is not a student');
      }

      if (!message || message.trim().length === 0) {
        throw new Error('Message is required');
      }

      // Create admin notification
      const { data, error } = await supabase
        .from('admin_notifications')
        .insert({
          student_id: user.id,
          student_name: profile.name || user.email,
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

      // Verify user is a student
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (currentProfile?.role !== 'student') {
        throw new Error('User is not a student');
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

  // Get student's teacher information
  getMyTeacher: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          teacher_id,
          teacher:teacher_id (
            id,
            name,
            email,
            subject,
            created_at
          )
        `)
        .eq('id', user.id)
        .eq('role', 'student')
        .single();

      if (error) throw error;

      return profile?.teacher || null;
    } catch (error) {
      console.error('Error fetching teacher:', error);
      throw error;
    }
  }
};

export default studentApi;
