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

      if (profileError || !profile?.teacher_id) {
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
        teacher_name: classItem.teacher?.name,
        teacher_email: classItem.teacher?.email,
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
          class:class_id (
            title
          ),
          assignment_submissions (
            id,
            status,
            submission_text,
            audio_url,
            score,
            feedback,
            submitted_at,
            graded_at
          )
        `)
        .eq('student_id', user.id)
        .order('due_date', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      // Transform assignments data
      const transformedAssignments = (assignments || []).map(assignment => {
        const submission = assignment.assignment_submissions?.[0];
        
        // Determine assignment status
        let status = 'assigned';
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
          class_id: assignment.class_id,
          class_title: assignment.class?.title,
          submissions: assignment.assignment_submissions || [],
          // For easy access to latest submission
          submission: submission || null,
          score: submission?.score,
          feedback: submission?.feedback,
          submitted_at: submission?.submitted_at
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

      if (existingSubmission) {
        // Update existing submission
        const { data, error } = await supabase
          .from('assignment_submissions')
          .update({
            submission_text,
            audio_url,
            status: 'submitted',
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
            status: 'submitted',
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

  // Get student statistics
  getMyStats: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get total classes count
      const { count: totalClasses, error: classesError } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', 
          (await supabase.from('profiles').select('teacher_id').eq('id', user.id).single()).data?.teacher_id
        );

      // Get assignments data
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, due_date, assignment_submissions(id, score, submitted_at)')
        .eq('student_id', user.id);

      // Calculate stats
      const totalAssignments = assignments?.length || 0;
      const completedAssignments = assignments?.filter(a => 
        a.assignment_submissions?.some(s => s.submitted_at)
      ).length || 0;

      // Calculate average score
      let avgScore = 0;
      const allSubmissions = assignments?.flatMap(a => a.assignment_submissions || []);
      const gradedSubmissions = allSubmissions?.filter(s => s.score !== null);
      
      if (gradedSubmissions && gradedSubmissions.length > 0) {
        const totalScore = gradedSubmissions.reduce((sum, sub) => sum + (sub.score || 0), 0);
        avgScore = Math.round(totalScore / gradedSubmissions.length);
      }

      // Calculate hours learned (simplified - based on completed classes)
      const hoursLearned = (totalClasses || 0) * 1; // Assuming 1 hour per class

      // Calculate progress metrics
      const completionRate = totalAssignments > 0 
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

      // Calculate points and level (simplified)
      const points = completedAssignments * 10 + (avgScore || 0);
      const level = Math.floor(points / 100) + 1;
      const nextLevel = 100 - (points % 100);

      return {
        total_classes: totalClasses || 0,
        hours_learned: hoursLearned,
        assignments: totalAssignments,
        completed_assignments: completedAssignments,
        avg_score: avgScore,
        completion_rate: completionRate,
        points: points,
        level: level,
        next_level: nextLevel,
        streak: Math.floor(Math.random() * 14) + 1 // Placeholder for streak
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
        .eq('status', 'active')
        .single();

      if (sessionError || !session) {
        throw new Error('Video session not found or not active');
      }

      // Verify student has access to this class through their teacher
      const { data: profile } = await supabase
        .from('profiles')
        .select('teacher_id')
        .eq('id', user.id)
        .single();

      if (!profile || profile.teacher_id !== session.classes?.teacher_id) {
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
          classes (
            title,
            teacher:teacher_id (
              name,
              email
            )
          )
        `)
        .eq('classes.teacher_id', profile.teacher_id)
        .order('started_at', { ascending: false });

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

      // Try different payment table names
      const tableNames = ['fee_payments', 'payments', 'student_payments'];
      
      for (const tableName of tableNames) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('student_id', user.id)
            .order('payment_date', { ascending: false });

          if (!error) {
            return data || [];
          }
        } catch (error) {
          // Continue to next table name
          continue;
        }
      }

      return [];
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

      if (!message || message.trim().length === 0) {
        throw new Error('Message is required');
      }

      // Create admin notification
      const { data, error } = await supabase
        .from('admin_notifications')
        .insert({
          student_id: user.id,
          student_name: user.user_metadata?.full_name || user.email,
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
  }
};

export default studentApi;
