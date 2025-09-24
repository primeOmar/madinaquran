import { supabase } from './supabaseClient';

export const studentApi = {
  // Get student's assigned teacher and classes
  getMyDashboard: async (studentId) => {
    try {
      // Get student info with teacher details
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          *,
          teacher:teacher_id (id, name, email, subject)
        `)
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      // Get classes assigned to the student's teacher
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', studentData.teacher_id)
        .order('scheduled_date', { ascending: true });

      if (classesError) throw classesError;

      return {
        student: studentData,
        teacher: studentData.teacher,
        classes: classesData
      };
    } catch (error) {
      console.error('Error fetching student dashboard:', error);
      throw error;
    }
  },

  // Submit assignment to teacher
  submitAssignment: async (assignmentData) => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          title: assignmentData.title,
          description: assignmentData.description,
          student_id: assignmentData.student_id,
          teacher_id: assignmentData.teacher_id,
          class_id: assignmentData.class_id,
          file_url: assignmentData.file_url,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error submitting assignment:', error);
      throw error;
    }
  },
  // Get student's assignments
  getMyAssignments: async (studentId) => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('student_id', studentId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching student assignments:', error);
      throw error;
    }
  },

  // Submit assignment
  submitAssignment: async (submissionData) => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .insert({
          ...submissionData,
          submitted_at: new Date().toISOString(),
          status: 'submitted'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error submitting assignment:', error);
      throw error;
    }
  },
};