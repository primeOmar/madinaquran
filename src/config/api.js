const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://madinaquranclass.onrender.com'
  : 'http://localhost:3001';

export const API_ENDPOINTS = {
  // ==================== HEALTH & TEST ENDPOINTS ====================
  HEALTH: `${API_BASE_URL}/api/health`,
  TEST: `${API_BASE_URL}/api/test`,
  CONNECTION_TEST: `${API_BASE_URL}/api/connection-test`,
  AGORA_TOKEN: `${API_BASE_URL}/api/generate-agora-token`,

  // ==================== STUDENT ENDPOINTS ====================
  // Profile
  STUDENT_PROFILE: `${API_BASE_URL}/api/student/profile`,
  STUDENT_UPDATE_PROFILE: `${API_BASE_URL}/api/student/profile`,
  
  // Classes
  STUDENT_CLASSES: `${API_BASE_URL}/api/student/classes`,
  
  // Video Sessions
  STUDENT_VIDEO_SESSIONS: `${API_BASE_URL}/api/student/video-sessions`,
  STUDENT_JOIN_VIDEO_SESSION: `${API_BASE_URL}/api/student/video-sessions/join`,
  
  // Stats & Analytics
  STUDENT_STATS: `${API_BASE_URL}/api/student/stats`,
  STUDENT_TEACHER_CHECK: `${API_BASE_URL}/api/student/teacher-check`,
  
  // Assignments
  STUDENT_ASSIGNMENTS: `${API_BASE_URL}/api/student/assignments`,
  
  // Payments
  STUDENT_PAYMENTS: `${API_BASE_URL}/api/student/payments`,
  
  // Contact
  STUDENT_CONTACT_ADMIN: `${API_BASE_URL}/api/student/contact-admin`,

  // ==================== TEACHER ENDPOINTS ====================
  // Profile
  TEACHER_PROFILE: `${API_BASE_URL}/api/teacher/profile`,
  TEACHER_UPDATE_PROFILE: `${API_BASE_URL}/api/teacher/profile`,
  
  // Classes
  TEACHER_CLASSES: `${API_BASE_URL}/api/teacher/classes`,
  
  // Students
  TEACHER_STUDENTS: `${API_BASE_URL}/api/teacher/students`,
  
  // Assignments
  TEACHER_ASSIGNMENTS: `${API_BASE_URL}/api/teacher/assignments`,
  TEACHER_CREATE_ASSIGNMENT: `${API_BASE_URL}/api/teacher/assignments`,
  TEACHER_GRADE_ASSIGNMENT: `${API_BASE_URL}/api/teacher/assignments/:id/grade`,
  
  // Video Sessions
  TEACHER_VIDEO_SESSIONS: `${API_BASE_URL}/api/teacher/video-sessions`,
  TEACHER_START_VIDEO_SESSION: `${API_BASE_URL}/api/teacher/video-sessions`,
  TEACHER_END_VIDEO_SESSION: `${API_BASE_URL}/api/teacher/video-sessions/:id/end`,

  // ==================== ADMIN ENDPOINTS ====================
  // Authentication
  ADMIN_REGISTER: `${API_BASE_URL}/api/admin/register`,
  ADMIN_LOGIN: `${API_BASE_URL}/api/admin/login`,
  ADMIN_LOGOUT: `${API_BASE_URL}/api/admin/logout`,
  ADMIN_ACTIVATE: `${API_BASE_URL}/api/admin/activate`,
  ADMIN_PROFILE: `${API_BASE_URL}/api/admin/profile`,
  
  // Teachers Management
  ADMIN_TEACHERS: `${API_BASE_URL}/api/admin/teachers`,
  ADMIN_CREATE_TEACHER: `${API_BASE_URL}/api/admin/teachers`,
  ADMIN_RESET_TEACHER_PASSWORD: `${API_BASE_URL}/api/admin/teachers/:id/reset-password`,
  ADMIN_DELETE_TEACHER: `${API_BASE_URL}/api/admin/teachers/:id`,
  
  // Students Management
  ADMIN_STUDENTS: `${API_BASE_URL}/api/admin/students`,
  ADMIN_CREATE_STUDENT: `${API_BASE_URL}/api/admin/students`,
  ADMIN_REASSIGN_STUDENT: `${API_BASE_URL}/api/admin/students/:id/reassign`,
  ADMIN_DELETE_STUDENT: `${API_BASE_URL}/api/admin/students/:id`,
  ADMIN_STUDENTS_BY_TEACHER: `${API_BASE_URL}/api/admin/students/teacher/:teacherId`,
  
  // Classes Management
  ADMIN_CLASSES: `${API_BASE_URL}/api/admin/classes`,
  ADMIN_CREATE_CLASS: `${API_BASE_URL}/api/admin/classes`,
  ADMIN_UPDATE_CLASS: `${API_BASE_URL}/api/admin/classes/:id`,
  ADMIN_DELETE_CLASS: `${API_BASE_URL}/api/admin/classes/:id`,
  
  // Video Sessions
  ADMIN_VIDEO_SESSIONS: `${API_BASE_URL}/api/admin/video-sessions`,
  ADMIN_JOIN_VIDEO_CALL: `${API_BASE_URL}/api/admin/join-video-call`,
  ADMIN_REMOVE_FROM_VIDEO_CALL: `${API_BASE_URL}/api/admin/remove-from-video-call`,

  // ==================== ROOT LEVEL ENDPOINTS (for frontend compatibility) ====================
  // These match the endpoints your frontend is currently calling
  STATS: `${API_BASE_URL}/api/student/stats`, // Maps to student stats
  CLASSES: `${API_BASE_URL}/api/student/classes`, // Maps to student classes
  TEACHER_CHECK: `${API_BASE_URL}/api/student/teacher-check`, // Maps to student teacher check
  ASSIGNMENTS: `${API_BASE_URL}/api/student/assignments`, // Maps to student assignments
  PAYMENTS: `${API_BASE_URL}/api/student/payments`, // Maps to student payments
};

// Helper function to build URLs with parameters
export const buildUrl = (endpoint, params = {}) => {
  let url = endpoint;
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, params[key]);
  });
  return url;
};

// Helper function to get endpoints by role
export const getEndpointsByRole = (role) => {
  const roleEndpoints = {};
  
  Object.keys(API_ENDPOINTS).forEach(key => {
    if (key.startsWith(role.toUpperCase())) {
      roleEndpoints[key] = API_ENDPOINTS[key];
    }
  });
  
  return roleEndpoints;
};

// Common API configuration
export const API_CONFIG = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};

export default API_BASE_URL;
