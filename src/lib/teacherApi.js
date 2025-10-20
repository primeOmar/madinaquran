// teacherApi.js
import { supabase } from './supabaseClient'; // Adjust import path as needed

export const teacherApi = {
  // Get teacher's classes with related data
  getMyClasses: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          course:course_id (*),
          video_sessions (*),
          assignments (*)
        `)
        .eq('teacher_id', user.id)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  },

  // Get teacher's students
  getMyStudents: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get students assigned to this teacher through profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          status,
          progress,
          attendance_rate,
          overall_score,
          completed_assignments,
          total_assignments,
          last_active,
          created_at
        `)
        .eq('teacher_id', user.id)
        .eq('role', 'student')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
  },

  // Get teacher's assignments with submissions and student info
  getMyAssignments: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get assignments created by this teacher
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          class:classes (title),
          student:student_id (name, email)
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      if (!assignments || assignments.length === 0) {
        return [];
      }

      // Get submissions for these assignments
      const assignmentIds = assignments.map(a => a.id);
      const { data: submissions, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds);

      if (submissionsError) throw submissionsError;

      // Combine assignments with their submissions
      const assignmentsWithSubmissions = assignments.map(assignment => {
        const assignmentSubmissions = submissions?.filter(sub => sub.assignment_id === assignment.id) || [];
        
        return {
          ...assignment,
          submissions: assignmentSubmissions,
          submitted_count: assignmentSubmissions.length,
          graded_count: assignmentSubmissions.filter(s => s.grade !== null).length,
          pending_count: assignmentSubmissions.filter(s => s.grade === null).length
        };
      });

      return assignmentsWithSubmissions;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  },

  // Get pending submissions for grading
  getPendingSubmissions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:profiles!assignment_submissions_student_id_fkey (
            name, 
            email
          ),
          assignment:assignments!assignment_submissions_assignment_id_fkey (
            title, 
            max_score, 
            due_date,
            class:classes (title),
            teacher_id
          )
        `)
        .is('grade', null)
        .eq('assignment.teacher_id', user.id)
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pending submissions:', error);
      throw error;
    }
  },

  // Get assignments with detailed submissions
  getAssignmentsWithSubmissions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          class:classes (title),
          student:student_id (name, email),
          submissions:assignment_submissions (
            *,
            student:profiles!assignment_submissions_student_id_fkey (name, email)
          )
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching assignments with submissions:', error);
      throw error;
    }
  },

  // Get graded submissions history
  getGradedSubmissions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: submissions, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:profiles!assignment_submissions_student_id_fkey (
            id,
            name,
            email,
            overall_score
          ),
          assignment:assignments!assignment_submissions_assignment_id_fkey (
            id,
            title,
            description,
            max_score,
            due_date,
            teacher_id
          )
        `)
        .not('grade', 'is', null)
        .eq('assignment.teacher_id', user.id)
        .order('graded_at', { ascending: false });

      if (error) throw error;
      return submissions || [];
    } catch (error) {
      console.error('Error fetching graded submissions:', error);
      throw error;
    }
  },

  // Grade assignment submission
  gradeAssignment: async (submissionId, score, feedback, audioFeedbackUrl = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // First, verify the submission exists and belongs to this teacher's assignment
      const { data: submission, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select(`
          assignment:assignments!assignment_submissions_assignment_id_fkey (
            teacher_id
          )
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError) throw submissionError;

      if (!submission || submission.assignment.teacher_id !== user.id) {
        throw new Error('Submission not found or unauthorized');
      }

      // Update the submission with grade and feedback
      const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
          grade: score,
          feedback: feedback,
          audio_feedback_url: audioFeedbackUrl,
          graded_at: new Date().toISOString(),
          graded_by: user.id,
          status: 'graded'
        })
        .eq('id', submissionId)
        .select(`
          *,
          student:student_id (name, email),
          assignment:assignment_id (title, max_score)
        `)
        .single();

      if (error) throw error;

      // Update student progress
      await teacherApi.updateStudentProgress(data.student_id);

      // Send notification to student
      await teacherApi.sendGradingNotification(submissionId, score, feedback, !!audioFeedbackUrl);

      return data;
    } catch (error) {
      console.error('Error grading assignment:', error);
      throw error;
    }
  },

  // Get submission details for grading
  getSubmissionDetails: async (submissionId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:student_id (name, email),
          assignment:assignment_id (
            title, 
            max_score, 
            due_date,
            description,
            class:classes (title),
            teacher_id
          )
        `)
        .eq('id', submissionId)
        .single();

      if (error) throw error;

      // Verify this teacher owns the assignment
      if (data.assignment.teacher_id !== user.id) {
        throw new Error('Unauthorized to access this submission');
      }

      return data;
    } catch (error) {
      console.error('Error fetching submission details:', error);
      throw error;
    }
  },

  // Update student progress after grading
  updateStudentProgress: async (studentId) => {
    try {
      // Get all graded submissions for this student
      const { data: submissions, error } = await supabase
        .from('assignment_submissions')
        .select(`
          grade,
          assignment:assignments (max_score)
        `)
        .eq('student_id', studentId)
        .not('grade', 'is', null);

      if (error) throw error;

      if (submissions && submissions.length > 0) {
        // Calculate average score
        const totalScore = submissions.reduce((sum, sub) => {
          const percentage = (sub.grade / sub.assignment.max_score) * 100;
          return sum + percentage;
        }, 0);
        
        const averageGrade = totalScore / submissions.length;

        // Update student profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            overall_score: Math.round(averageGrade),
            completed_assignments: submissions.length,
            last_active: new Date().toISOString()
          })
          .eq('id', studentId);

        if (updateError) throw updateError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating student progress:', error);
      throw error;
    }
  },

  // Create a new assignment
  createAssignment: async (assignmentData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignments')
        .insert([{
          ...assignmentData,
          teacher_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select(`
          *,
          class:classes (title),
          student:student_id (name, email)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  },

  // Update an assignment
  updateAssignment: async (assignmentId, updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Verify the assignment belongs to this teacher
      const { data: assignment, error: verifyError } = await supabase
        .from('assignments')
        .select('teacher_id')
        .eq('id', assignmentId)
        .single();

      if (verifyError) throw verifyError;

      if (assignment.teacher_id !== user.id) {
        throw new Error('Unauthorized to update this assignment');
      }

      const { data, error } = await supabase
        .from('assignments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating assignment:', error);
      throw error;
    }
  },

  // Delete an assignment
  deleteAssignment: async (assignmentId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Verify the assignment belongs to this teacher
      const { data: assignment, error: verifyError } = await supabase
        .from('assignments')
        .select('teacher_id')
        .eq('id', assignmentId)
        .single();

      if (verifyError) throw verifyError;

      if (assignment.teacher_id !== user.id) {
        throw new Error('Unauthorized to delete this assignment');
      }

      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting assignment:', error);
      throw error;
    }
  },

  async getSubmissions() {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          assignment:assignments (*),
          student:profiles (name, email)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  }
},
  // Start a video session for a class
  startVideoSession: async (classId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Verify the class belongs to this teacher
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('teacher_id')
        .eq('id', classId)
        .single();

      if (classError) throw classError;

      if (classData.teacher_id !== user.id) {
        throw new Error('Unauthorized to start video session for this class');
      }

      // Generate a unique meeting ID
      const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await supabase
        .from('video_sessions')
        .insert([{
          class_id: classId,
          teacher_id: user.id,
          meeting_id: meetingId,
          status: 'active',
          started_at: new Date().toISOString(),
          scheduled_date: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Update class status to active
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

  // End a video session
  endVideoSession: async (sessionId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('video_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('teacher_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error ending video session:', error);
      throw error;
    }
  },

  // Get teacher's video sessions
  getMyVideoSessions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title)
        `)
        .eq('teacher_id', user.id)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching video sessions:', error);
      throw error;
    }
  },

  // Get teacher dashboard statistics
  getDashboardStats: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get counts in parallel
      const [
        { count: classesCount },
        { count: studentsCount },
        { count: assignmentsCount },
        { data: pendingSubmissions }
      ] = await Promise.all([
        supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id)
          .eq('status', 'active'),
        
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id)
          .eq('role', 'student')
          .eq('status', 'active'),
        
        supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id),
        
        supabase
          .from('assignment_submissions')
          .select(`
            *,
            assignment:assignments!assignment_submissions_assignment_id_fkey (teacher_id)
          `)
          .is('grade', null)
          .eq('assignment.teacher_id', user.id)
      ]);

      return {
        classes: classesCount || 0,
        students: studentsCount || 0,
        assignments: assignmentsCount || 0,
        pending_grading: pendingSubmissions?.length || 0
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  // Send notification to student
  sendNotification: async (studentId, notificationData) => {
    try {
      console.log('🔔 [NOTIFICATION] Starting sendNotification:', {
        studentId,
        notificationData
      });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Teacher not authenticated');
      }

      // Validate inputs
      if (!studentId) {
        console.error('🔔 [NOTIFICATION] Missing studentId');
        throw new Error('Student ID is required');
      }

      if (!notificationData?.title || !notificationData?.message) {
        console.error('🔔 [NOTIFICATION] Missing title or message');
        throw new Error('Notification title and message are required');
      }

      // Verify student exists in profiles table
      console.log('🔔 [NOTIFICATION] Looking for student in profiles table with id:', studentId);
      
      const { data: studentProfile, error: studentError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', studentId)
        .single();

      console.log('🔔 [NOTIFICATION] Student verification result:', {
        studentExists: !!studentProfile,
        studentError: studentError?.message,
        studentName: studentProfile?.name,
        studentEmail: studentProfile?.email
      });

      if (studentError) {
        console.error('🔔 [NOTIFICATION] Student query error:', studentError);
        
        // If student not found, check if it's because the ID doesn't exist in profiles
        if (studentError.code === 'PGRST116') {
          throw new Error(`Student with ID ${studentId} not found in profiles table`);
        }
        throw studentError;
      }

      if (!studentProfile) {
        throw new Error(`Student profile not found for ID: ${studentId}`);
      }

      const notificationPayload = {
        user_id: studentId,
        title: notificationData.title.trim(),
        message: notificationData.message.trim(),
        type: notificationData.type || 'info',
        data: notificationData.data || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('🔔 [NOTIFICATION] Inserting notification:', notificationPayload);

      const { data, error } = await supabase
        .from('notifications')
        .insert([notificationPayload])
        .select()
        .single();

      if (error) {
        console.error('🔔 [NOTIFICATION] Supabase insert error:', error);
        throw error;
      }
      
      console.log('🔔 [NOTIFICATION] Insert successful:', data);
      return data;
    } catch (error) {
      console.error('🔔 [NOTIFICATION] Overall error:', error);
      throw error;
    }
  },

  // Send grading notification specifically
  sendGradingNotification: async (submissionId, score, feedback, hasAudioFeedback = false) => {
    try {
      console.log('🔔 [NOTIFICATION] Starting grading notification for submission:', submissionId);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Teacher not authenticated');
      }

      // Get submission details with assignment and student info
      const { data: submission, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          assignment:assignments(
            title,
            max_score,
            description
          ),
          student:profiles!assignment_submissions_student_id_fkey(
            id,
            name,
            email
          )
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError || !submission) {
        console.error('🔔 [NOTIFICATION] Submission not found:', submissionError);
        throw new Error('Submission not found');
      }

      console.log('🔔 [NOTIFICATION] Submission details:', {
        submissionId: submission.id,
        studentId: submission.student_id,
        student: submission.student,
        assignment: submission.assignment
      });

      // Verify student exists
      if (!submission.student || !submission.student.id) {
        throw new Error('Student profile not found for this submission');
      }

      const studentId = submission.student.id;
      const assignmentTitle = submission.assignment?.title || 'Assignment';
      const maxScore = submission.assignment?.max_score || 100;
      const percentage = Math.round((score / maxScore) * 100);
      
      let gradeEmoji = '📊';
      if (percentage >= 90) gradeEmoji = '🎉';
      else if (percentage >= 80) gradeEmoji = '👍';
      else if (percentage >= 70) gradeEmoji = '📝';
      else gradeEmoji = '💪';

      const notificationData = {
        user_id: studentId,
        title: `${gradeEmoji} Assignment Graded: ${assignmentTitle}`,
        message: `Your assignment "${assignmentTitle}" has been graded. You scored ${score}/${maxScore} (${percentage}%).${feedback ? ' Teacher provided feedback.' : ''}${hasAudioFeedback ? ' Includes audio feedback.' : ''}`,
        type: 'success',
        data: {
          submission_id: submissionId,
          assignment_title: assignmentTitle,
          score: score,
          max_score: maxScore,
          percentage: percentage,
          has_feedback: !!feedback,
          has_audio_feedback: hasAudioFeedback,
          graded_at: new Date().toISOString(),
          action_url: `/assignments/${submissionId}`,
          assignment_id: submission.assignment_id
        }
      };

      console.log('🔔 [NOTIFICATION] Sending grading notification:', notificationData);

      // Use the sendNotification function
      const result = await teacherApi.sendNotification(studentId, notificationData);
      console.log('🔔 [NOTIFICATION] Grading notification sent successfully:', result);
      return result;

    } catch (error) {
      console.error('🔔 [NOTIFICATION] Error sending grading notification:', error);
      throw error;
    }
  },

  // Debug function to test notification system
  testNotificationSystem: async () => {
    try {
      console.log('🧪 [DEBUG] Testing notification system...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🧪 [DEBUG] Current user:', user);

      // Get a test student
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'student')
        .limit(1);

      if (studentsError || !students || students.length === 0) {
        console.error('🧪 [DEBUG] No students found');
        return { success: false, error: 'No students found' };
      }

      const testStudent = students[0];
      console.log('🧪 [DEBUG] Test student:', testStudent);

      // Test notification insertion
      const testNotification = {
        title: '🧪 Test Notification',
        message: 'This is a test notification from the debug system.',
        type: 'info',
        data: {
          test: true,
          debug_time: new Date().toISOString(),
          student_name: testStudent.name
        }
      };

      console.log('🧪 [DEBUG] Testing with notification:', testNotification);

      const result = await teacherApi.sendNotification(testStudent.id, testNotification);
      
      console.log('🧪 [DEBUG] Test notification created:', result);

      // Clean up test notification
      await supabase
        .from('notifications')
        .delete()
        .eq('id', result.id);

      console.log('🧪 [DEBUG] Test completed successfully');
      return { 
        success: true, 
        data: result
      };

    } catch (error) {
      console.error('🧪 [DEBUG] Test failed:', error);
      return { success: false, error: error.message };
    }
  }
};

export default teacherApi;
