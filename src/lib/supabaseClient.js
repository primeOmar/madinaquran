import { createClient } from '@supabase/supabase-js'

const supabaseUrl = window._env_?.REACT_APP_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = window._env_?.REACT_APP_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = window._env_?.REACT_APP_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Create admin client (only if service key is available)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Some features may not work properly.');
}

// API base URL - make sure this is defined
const apiBaseUrl = window._env_?.REACT_APP_API_BASE_URL || 
                  import.meta.env?.VITE_API_BASE_URL || 
                  process.env.REACT_APP_API_BASE_URL || 
                  'http://localhost:3001';

// API request helper
export const makeApiRequest = async (endpoint, options = {}) => {
  try {
    // Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('No authentication token available. Please log in again.');
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    
    // User-friendly error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Cannot connect to the server. Please make sure the backend is running on port 3001.');
    }
    
    throw error;
  }
};

// Health check function
export const checkServerHealth = async () => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server health check failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Server health check failed:', error);
    throw new Error('Server is unavailable. Please make sure the backend is running on port 3001.');
  }
};

// Admin API functions
const adminApi = {
  // Student management
  getStudents: () => makeApiRequest('/api/admin/students'),
  
  addStudent: (studentData) => makeApiRequest('/api/admin/students', {
    method: 'POST',
    body: JSON.stringify(studentData)
  }),
  
  removeStudent: (studentId) => makeApiRequest(`/api/admin/students/${studentId}`, {
    method: 'DELETE'
  }),
  
  getUnassignedStudents: () => makeApiRequest('/api/admin/students/unassigned'),
  
  assignStudentToTeacher: (studentId, teacherId) => 
    makeApiRequest(`/api/admin/students/${studentId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId })
    }),
  
  bulkAssignStudents: (assignments) => 
    makeApiRequest('/api/admin/students/bulk-assign', {
      method: 'POST',
      body: JSON.stringify({ assignments })
    }),
  
  unassignStudent: (studentId) => 
    makeApiRequest(`/api/admin/students/${studentId}/unassign`, {
      method: 'POST'
    }),

  // Teacher management
  getTeachers: () => makeApiRequest('/api/admin/teachers'),
  
  getAvailableTeachers: () => makeApiRequest('/api/admin/teachers/available'),
  
addTeacher: async (teacherData) => {
  try {
    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Not authenticated');
    }   
    const response = await fetch(`${apiBaseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(teacherData)
    });

    // Handle empty responses
    const responseText = await response.text();
    
    if (!responseText) {
      throw new Error('Server returned empty response');
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Server returned invalid JSON response');
    }
    
    if (!response.ok) {
      throw new Error(result.error || `Server error: ${response.status}`);
    }

    return result;
  } catch (error) {
    console.error('Teacher creation error:', error);
    throw error;
  }
},

  removeTeacher: (teacherId) => makeApiRequest(`/api/admin/teachers/${teacherId}`, {
    method: 'DELETE'
  }),

  // Class management
  getClasses: () => makeApiRequest('/api/admin/classes'),
  
getVideoSessions: () => makeApiRequest('/api/admin/video-sessions'),
  joinVideoCall: (meetingId) => makeApiRequest('/api/admin/join-video-call', {
    method: 'POST',
    body: JSON.stringify({ meetingId })
  }),
  
  removeFromVideoCall: (meetingId, participantId) => 
    makeApiRequest('/api/admin/remove-from-video-call', {
      method: 'POST',
      body: JSON.stringify({ meetingId, participantId })
    }),

  // Fees management
  feesManagement: {
    getStudentsWithFees: () => makeApiRequest('/api/admin/fees/students'),
    
    getFeeStatistics: () => makeApiRequest('/api/admin/fees/statistics'),
    
    confirmPayment: (paymentId, paymentMethod) => 
      makeApiRequest('/api/admin/fees/confirm-payment', {
        method: 'POST',
        body: JSON.stringify({ paymentId, paymentMethod })
      }),
    
    rejectPayment: (paymentId, reason) => 
      makeApiRequest('/api/admin/fees/reject-payment', {
        method: 'POST',
        body: JSON.stringify({ paymentId, reason })
      })
  },
// Class management methods
scheduleClass: async (classData) => {
  try {
    // Use Supabase's getSession() - RECOMMENDED
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    console.log('Supabase session token:', token);
    
    if (!token) {
      throw new Error('No active session. Please log in again.');
    }

    const response = await fetch(`${apiBaseUrl}/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(classData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to schedule class');
    }

    return await response.json();
  } catch (error) {
    console.error('Error scheduling class:', error);
    throw error;
  }
},

// supabaseClient.js - Fix getClasses function
getClasses: async (filters = {}) => {
  try {
    // Use proper Supabase auth instead of localStorage
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const params = new URLSearchParams(filters);
    const response = await fetch(`${apiBaseUrl}/classes?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      // More detailed error information
      console.error('HTTP Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      throw new Error(`Failed to fetch classes: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching classes:', error);
    throw error;
  }
},

  updateClass: async (id, updates) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/classes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update class');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating class:', error);
      throw error;
    }
  },

  deleteClass: async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/classes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete class');
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  },
  // Other admin functions
  getStats: () => makeApiRequest('/api/admin/stats'),
  
  getAdminActions: (page = 1, limit = 50) => 
    makeApiRequest(`/api/admin/actions?page=${page}&limit=${limit}`),
  
  getStudentsByTeacher: (teacherId) => 
    makeApiRequest(`/api/admin/students/teacher/${teacherId}`)
};

// Get auth token
export const getAuthToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

//teacherapi functions
export const teacherApi = {
 getMyClasses: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          course:course_id (*),
          students_classes (*),
          video_sessions (*)
        `)
        .eq('teacher_id', user.id)
        .order('scheduled_date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching classes:', error)
      throw error
    }
  },

  // Get teacher's students
getMyStudents: async () => {
  try {
    console.log('🔄 Fetching students from API...');
    const token = await getAuthToken();
    console.log('🔑 Using token:', token ? 'Present' : 'Missing');
    
    const response = await fetch(`${apiBaseUrl}/api/teacher/students`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📊 API Response status:', response.status);
    
    // First, check what content type we're getting
    const contentType = response.headers.get('content-type');
    console.log('📄 Content-Type:', contentType);
    
    if (!response.ok) {
      // Get the response text to see what's actually being returned
      const responseText = await response.text();
      console.error('❌ Server error response:', responseText.substring(0, 200));
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Check if we're getting JSON
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('✅ Students fetched:', data.length);
      return data;
    } else {
      // We're getting HTML instead of JSON
      const responseText = await response.text();
      console.error('❌ Got HTML instead of JSON:', responseText.substring(0, 200));
      throw new Error('Server returned HTML instead of JSON. Check API endpoint.');
    }
    
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    throw error;
  }
},
  // Get teacher's assignments
  getMyAssignments: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          description,
          due_date,
          max_score,
          class_id,
          created_at,
          classes (title),
          assignment_submissions (
            id,
            student_id,
            submitted_at,
            score,
            feedback,
            status,
            students:student_id (name)
          )
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform data with submission counts
      const transformed = data.map(assignment => {
        const submissions = assignment.assignment_submissions || []
        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date,
          max_score: assignment.max_score,
          class_id: assignment.class_id,
          class_title: assignment.classes?.title,
          created_at: assignment.created_at,
          submissions: submissions.map(sub => ({
            id: sub.id,
            student_id: sub.student_id,
            student_name: sub.students?.name,
            submitted_at: sub.submitted_at,
            score: sub.score,
            feedback: sub.feedback,
            status: sub.status
          })),
          submitted_count: submissions.length,
          graded_count: submissions.filter(s => s.score !== null).length,
          pending_count: submissions.filter(s => s.score === null).length
        }
      })

      return transformed
    } catch (error) {
      console.error('Error fetching assignments:', error)
      throw error
    }
  },

  // Start a video session
  startVideoSession: async (classId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Generate a unique meeting ID
      const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const { data, error } = await supabase
        .from('video_sessions')
        .insert([{
          class_id: classId,
          teacher_id: user.id,
          meeting_id: meetingId,
          status: 'active',
          started_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      
      // Update class status to active
      await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId)

      return data
    } catch (error) {
      console.error('Error starting video session:', error)
      throw error
    }
  },

  // Create a new assignment
createAssignment: async (assignmentData) => {
  try {
    // Get fresh session (handles token refresh)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/teacher/assignments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(assignmentData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create assignment');
    }

    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Failed to create assignment');
  }
},
// Replace all instances of supabase.auth.session() with the new method
getMyAssignments: async (filters = {}) => {
  const { status, student_id, class_id, page = 1, limit = 50 } = filters;
  
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  let url = `/api/teacher/assignments?page=${page}&limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (student_id) url += `&student_id=${student_id}`;
  if (class_id) url += `&class_id=${class_id}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch assignments');
  }
  
  return response.json();
},

gradeAssignment: async (submissionId, score, feedback) => {
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(`/api/teacher/assignments/${submissionId}/grade`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ score, feedback })
  });
  
  if (!response.ok) {
    throw new Error('Failed to grade assignment');
  }
  
  return response.json();
},

  // Grade an assignment submission
gradeAssignment: async (submissionId, score, feedback) => {
  const response = await fetch(`/api/teacher/assignments/${submissionId}/grade`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabase.auth.session().access_token}`
    },
    body: JSON.stringify({ score, feedback })
  });
  
  if (!response.ok) {
    throw new Error('Failed to grade assignment');
  }
  
  return response.json();
}
};

// Export adminApi as a named export
export {adminApi }; 

// Export everything as default for backward compatibility
export default {
  supabase,
  supabaseAdmin,
  makeApiRequest,
  checkServerHealth,
  getAuthToken,
  adminApi,
  teacherApi
};
