// supabaseClient.js
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

// ============================================================================
// STORAGE & BUCKET CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Configure storage bucket for audio submissions with proper CORS settings
 */
export const configureAudioBucket = async () => {
  try {
    if (!supabaseAdmin) {
      console.warn('Admin client not available - using regular client for bucket configuration');
      // Try with regular client (might work if user has sufficient permissions)
      const client = supabase;
      
      const { data, error } = await client.storage.updateBucket('assignment-audio', {
        public: false, // Keep private for security
        fileSizeLimit: 52428800, // 50MB in bytes
        allowedMimeTypes: ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/*']
      });

      if (error) {
        console.warn('Bucket configuration failed:', error.message);
        return { success: false, error: error.message };
      }

      console.log('✅ Audio bucket configured successfully with regular client');
      return { success: true, data };
    }

    // Use admin client for configuration
    const { data, error } = await supabaseAdmin.storage.updateBucket('assignment-audio', {
      public: false, // Keep private for security
      fileSizeLimit: 52428800, // 50MB in bytes
      allowedMimeTypes: ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/*']
    });

    if (error) {
      console.error('❌ Bucket configuration failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Audio bucket configured successfully with admin client');
    return { success: true, data };
  } catch (error) {
    console.error('💥 Error configuring audio bucket:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a signed URL for secure audio file access (for private buckets)
 */
export const getSecureAudioUrl = async (filePath, expiresIn = 3600) => {
  try {
    const { data, error } = await supabase.storage
      .from('assignment-audio')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('❌ Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('💥 Error generating secure audio URL:', error);
    return null;
  }
};

/**
 * Upload audio file to storage with progress tracking
 */
export const uploadAudioFile = async (file, bucketName = 'assignment-audio', onProgress = null) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log('📤 Uploading audio file:', { name: file.name, size: file.size, path: filePath });

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        // Note: Progress tracking might not be available in all Supabase versions
      });

    if (error) {
      console.error('❌ Audio upload failed:', error);
      throw error;
    }

    console.log('✅ Audio uploaded successfully:', data);

    // Get public URL (if bucket is public) or signed URL (if private)
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      path: filePath,
      fullPath: data.path,
      publicUrl: urlData.publicUrl,
      signedUrl: await getSecureAudioUrl(filePath)
    };
  } catch (error) {
    console.error('💥 Audio upload error:', error);
    throw error;
  }
};

/**
 * Check if storage bucket exists and is accessible
 */
export const checkStorageBucket = async (bucketName = 'assignment-audio') => {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);
    
    if (error) {
      console.warn(`Bucket "${bucketName}" check failed:`, error.message);
      return { exists: false, error: error.message };
    }

    console.log(`✅ Bucket "${bucketName}" is accessible:`, data);
    return { exists: true, data };
  } catch (error) {
    console.error(`💥 Error checking bucket "${bucketName}":`, error);
    return { exists: false, error: error.message };
  }
};

/**
 * Initialize storage configuration - call this when app starts
 */
export const initializeStorage = async () => {
  try {
    console.log('🔄 Initializing storage configuration...');
    
    // Check if bucket exists
    const bucketCheck = await checkStorageBucket('assignment-audio');
    
    if (!bucketCheck.exists) {
      console.log('📦 Audio bucket not found, attempting configuration...');
      const configResult = await configureAudioBucket();
      
      if (!configResult.success) {
        console.warn('⚠️ Bucket configuration may need admin privileges');
      }
    } else {
      console.log('✅ Audio bucket is ready');
    }

    return { success: true, bucketCheck };
  } catch (error) {
    console.error('💥 Storage initialization failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete audio file from storage
 */
export const deleteAudioFile = async (filePath, bucketName = 'assignment-audio') => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('❌ Error deleting audio file:', error);
      throw error;
    }

    console.log('✅ Audio file deleted successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('💥 Error deleting audio file:', error);
    throw error;
  }
};

// ============================================================================
// NOTIFICATION API FUNCTIONS
// ============================================================================

// Enhanced notification functions
export const notificationApi = {
  // Send notification when grading assignment
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
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('🔔 [NOTIFICATION] Inserting notification:', notificationData);

      const { data: notification, error: insertError } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select()
        .single();

      if (insertError) {
        console.error('🔔 [NOTIFICATION] Insert failed:', insertError);
        throw insertError;
      }

      console.log('🔔 [NOTIFICATION] Notification created successfully:', notification);
      return notification;

    } catch (error) {
      console.error('🔔 [NOTIFICATION] Error sending grading notification:', error);
      throw error;
    }
  },

  // Get notifications for current user (student)
  getMyNotifications: async (limit = 20, page = 1) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

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
  markAsRead: async (notificationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', user.id) // Ensure user can only mark their own notifications as read
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
  markAllAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

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

  // Get unread notification count
  getUnreadCount: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

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

  // Debug function to test notification system
  debugNotificationSystem: async () => {
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
        user_id: testStudent.id,
        title: '🧪 Test Notification',
        message: 'This is a test notification from the debug system.',
        type: 'info',
        data: {
          test: true,
          debug_time: new Date().toISOString(),
          student_name: testStudent.name
        }
      };

      console.log('🧪 [DEBUG] Inserting test notification:', testNotification);

      const { data: notification, error: insertError } = await supabase
        .from('notifications')
        .insert([testNotification])
        .select()
        .single();

      if (insertError) {
        console.error('🧪 [DEBUG] Insert failed:', insertError);
        return { success: false, error: insertError.message };
      }

      console.log('🧪 [DEBUG] Test notification created:', notification);

      // Verify we can retrieve it
      const { data: retrieved, error: retrieveError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notification.id)
        .single();

      if (retrieveError) {
        console.error('🧪 [DEBUG] Retrieve failed:', retrieveError);
        return { success: false, error: retrieveError.message };
      }

      console.log('🧪 [DEBUG] Notification retrieved:', retrieved);

      // Clean up test notification
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notification.id);

      console.log('🧪 [DEBUG] Test completed successfully');
      return { 
        success: true, 
        data: {
          inserted: notification,
          retrieved: retrieved
        }
      };

    } catch (error) {
      console.error('🧪 [DEBUG] Test failed:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// API REQUEST HELPER FUNCTIONS
// ============================================================================

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

// ============================================================================
// ADMIN API FUNCTIONS
// ============================================================================

// Admin API functions
export const adminApi = {
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

  // Reset password
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

  // Resend credentials
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

// Export everything as default for backward compatibility
export default {
  supabase,
  supabaseAdmin,
  makeApiRequest,
  checkServerHealth,
  getAuthToken,
  adminApi,
  notificationApi,
  // Storage functions
  configureAudioBucket,
  getSecureAudioUrl,
  uploadAudioFile,
  checkStorageBucket,
  initializeStorage,
  deleteAudioFile
};
