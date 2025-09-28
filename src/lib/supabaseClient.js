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
                  'https://madina-quran-backend.onrender.com';

// API request helper
export const makeApiRequest = async (endpoint, options = {}) => {
  try {
    console.log(`🔗 [API] Starting request to: ${endpoint}`);
    
    // Get the current session with better error handling
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('🔐 [API] Session check:', {
      hasSession: !!session,
      hasUser: session?.user?.id,
      userEmail: session?.user?.email,
      sessionError: sessionError?.message
    });

    if (sessionError) {
      console.error('❌ [API] Session error:', sessionError);
      throw new Error('Authentication failed. Please login again.');
    }
    
    if (!session) {
      console.error('❌ [API] No active session found');
      throw new Error('User not authenticated. Please login again.');
    }
    
    if (!session.access_token) {
      console.error('❌ [API] No access token in session');
      throw new Error('Authentication token missing. Please login again.');
    }
    
    console.log('✅ [API] Session found for:', session.user.email);
    console.log('🔑 [API] Token preview:', `${session.access_token.substring(0, 20)}...`);
    
    const API_BASE = 'https://madina-quran-backend.onrender.com';
    const fullUrl = `${API_BASE}${endpoint}`;
    
    console.log(`🌐 [API] Full URL: ${fullUrl}`);
    
    // Prepare headers with authorization - KEEP existing header merging
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options.headers, // Preserve any custom headers
    };

    console.log('📋 [API] Request headers:', {
      hasAuthHeader: !!headers.Authorization,
      authHeaderLength: headers.Authorization?.length,
      contentType: headers['Content-Type'],
      customHeaders: Object.keys(headers).filter(key => !['Content-Type', 'Authorization'].includes(key))
    });

    // Prepare request options - PRESERVE all existing functionality
    const requestOptions = {
      method: options.method || 'GET',
      headers: headers,
      // Preserve all other options like credentials, mode, cache, etc.
      ...Object.fromEntries(
        Object.entries(options).filter(([key]) => 
          !['headers', 'body', 'method'].includes(key)
        )
      )
    };
    
    // FIX: Handle body properly - always stringify if it's an object, but preserve strings
    if (options.body !== undefined && options.body !== null) {
      if (typeof options.body === 'string') {
        // If it's already a string, use it as-is (for FormData, URLSearchParams, etc.)
        requestOptions.body = options.body;
        console.log('📦 [API] Body is already string, using as-is. Length:', options.body.length);
      } else {
        // If it's an object, array, or other type, stringify it
        requestOptions.body = JSON.stringify(options.body);
        console.log('📦 [API] Body stringified to JSON. Length:', requestOptions.body.length);
      }
    } else {
      delete requestOptions.body;
      console.log('📦 [API] No request body');
    }

    console.log('🚀 [API] Making fetch request with options:', {
      method: requestOptions.method,
      hasBody: !!requestOptions.body,
      bodyType: requestOptions.body ? typeof requestOptions.body : 'none',
      preservedOptions: Object.keys(requestOptions).filter(key => !['method', 'headers', 'body'].includes(key))
    });

    const response = await fetch(fullUrl, requestOptions);
    
    console.log(`📊 [API] Response received:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      ok: response.ok
    });

    // Handle authentication errors - KEEP existing refresh logic
    if (response.status === 401) {
      console.error('❌ [API] 401 Unauthorized - Invalid token');
      
      // Try to refresh the session first
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ [API] Session refresh failed:', refreshError);
        await supabase.auth.signOut();
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
      }
      
      console.log('🔄 [API] Session refreshed, retrying request...');
      // Retry the request with new token
      return makeApiRequest(endpoint, options);
    }

    // Handle other error statuses - KEEP existing error handling
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      try {
        const errorText = await response.text();
        console.error(`❌ [API] Error response body:`, errorText);
        
        if (errorText) {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorText;
        }
      } catch (parseError) {
        console.error('❌ [API] Error parsing error response:', parseError);
        // Use default error message if parsing fails
      }
      
      throw new Error(errorMessage);
    }

    // Parse successful response - KEEP existing response handling
    let responseData;
    try {
      const responseText = await response.text();
      console.log('✅ [API] Raw response received, length:', responseText.length);
      
      if (responseText) {
        responseData = JSON.parse(responseText);
        console.log('✅ [API] Response parsed successfully');
      } else {
        responseData = { success: true }; // Default success for empty responses
        console.log('✅ [API] Empty response, using default success');
      }
    } catch (parseError) {
      console.error('❌ [API] Error parsing success response:', parseError);
      throw new Error('Invalid response from server');
    }

    console.log('🎉 [API] Request successful:', {
      success: responseData.success,
      hasMessage: !!responseData.message,
      hasData: !!responseData.data
    });
    return responseData;

  } catch (error) {
    console.error(`💥 [API] Request failed for ${endpoint}:`, error);
    
    // Handle network errors - KEEP existing network error handling
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('🌐 [API] Network error - check internet connection');
      throw new Error('Network error. Please check your internet connection.');
    }
    
    // Handle JSON parsing errors specifically
    if (error.message.includes('JSON') || error.message.includes('parse')) {
      console.error('📄 [API] JSON parsing error - possible server response issue');
      throw new Error('Server response format error. Please try again.');
    }
    
    // Re-throw the error with proper context - KEEP existing error propagation
    throw new Error(error.message || `API request failed: ${endpoint}`);
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
//reset pass
resetTeacherPassword: async (teacherId) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const response = await fetch(`${apiBaseUrl}/api/admin/teachers/${teacherId}/reset-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to reset teacher password');
    }

    return await response.json();
  } catch (error) {
    console.error('Error resetting teacher password:', error);
    throw error;
  }
},
  
  removeTeacher: (teacherId) => makeApiRequest(`/api/admin/teachers/${teacherId}`, {
    method: 'DELETE'
  }),
//resend credentials
  getTeacherCredentials: async (teacherId) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const response = await fetch(`${apiBaseUrl}/api/admin/teachers/${teacherId}/credentials`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch teacher credentials');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching teacher credentials:', error);
    throw error;
  }
},
 
  
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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    console.log('Supabase session token:', token);
    
    if (!token) {
      throw new Error('No active session. Please log in again.');
    }

    // FIX: Add /api/admin to the path
    const response = await fetch(`${apiBaseUrl}/api/admin/classes`, {
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

// getClasses function

getClasses: async (filters = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const params = new URLSearchParams(filters);
    const response = await fetch(`${apiBaseUrl}/api/admin/classes?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch classes: ${response.status}`);
    }

    const result = await response.json();
    
    // Return the classes array from the paginated response
    return result.classes || [];
    
  } catch (error) {
    console.error('Error fetching classes:', error);
    throw error;
  }
},

  updateClass: async (id, updates) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const response = await fetch(`${apiBaseUrl}/api/admin/classes/${id}`, { // ← Add /api/admin
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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const response = await fetch(`${apiBaseUrl}/api/admin/classes/${id}`, { // ← Add /api/admin
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

  getAssignmentsWithSubmissions: async () => {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        *,
        class:classes(title),
        assignment_submissions(
          *,
          student:profiles(name, email)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return assignments;
  },

getPendingSubmissions: async () => {
    const { data: submissions, error } = await supabase
      .from('assignment_submissions')
      .select(`
        *,
        assignment:assignments(title, max_score, due_date),
        student:profiles(name, email)
      `)
      .eq('status', 'submitted')
      .is('grade', null)
      .order('submitted_at', { ascending: true });

    if (error) throw error;
    return submissions;
  },

  // Grade assignment
  gradeAssignment: async (submissionId, score, feedback) => {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .update({
        grade: score,
        feedback: feedback,
        graded_at: new Date().toISOString(),
        status: 'graded'
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update student progress after grading
  updateStudentProgress: async (studentId) => {
    // Calculate average grade and update student profile
    const { data: submissions, error } = await supabase
      .from('assignment_submissions')
      .select('grade, assignment:assignments(max_score)')
      .eq('student_id', studentId)
      .not('grade', 'is', null);

    if (error) throw error;

    if (submissions.length > 0) {
      const averageGrade = submissions.reduce((sum, sub) => {
        const percentage = (sub.grade / sub.assignment.max_score) * 100;
        return sum + percentage;
      }, 0) / submissions.length;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          overall_score: Math.round(averageGrade),
          last_active: new Date().toISOString()
        })
        .eq('id', studentId);

      if (updateError) throw updateError;
    }
  }
};
export {adminApi};
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
