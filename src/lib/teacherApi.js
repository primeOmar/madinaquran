import { supabase } from './supabaseClient';

export const teacherApi = {
  // Get teacher's assigned students
  getMyStudents: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching teacher students:', error);
      throw error;
    }
  },

  // Get teacher's classes
  getMyClasses: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching teacher classes:', error);
      throw error;
    }
  },

  // Get assignments submitted to teacher
  getAssignments: async (teacherId) => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          student:student_id (name, email),
          class:class_id (title)
        `)
        .eq('teacher_id', teacherId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  }
};