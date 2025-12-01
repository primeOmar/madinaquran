// API Configuration for Madina Quran School
// Uses Vite environment variables with fallbacks

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.NODE_ENV === 'production' 
    ? 'https://madina-quran-backend.onrender.com'
    : 'http://localhost:3001');

export const API_ENDPOINTS = {
  // ==================== HEALTH & SYSTEM ====================
  HEALTH: `${API_BASE_URL}/api/health`,
  TEST: `${API_BASE_URL}/api/test`,
  CONNECTION_TEST: `${API_BASE_URL}/api/connection-test`,
  AGORA_TOKEN: `${API_BASE_URL}/api/generate-agora-token`,

  // ==================== AUTHENTICATION ====================
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  ACTIVATE: `${API_BASE_URL}/api/auth/activate`,

  // ==================== STUDENT ENDPOINTS ====================
  STUDENT: {
    PROFILE: `${API_BASE_URL}/api/student/profile`,
    UPDATE_PROFILE: `${API_BASE_URL}/api/student/profile`,
    CLASSES: `${API_BASE_URL}/api/student/classes`,
    ASSIGNMENTS: `${API_BASE_URL}/api/student/assignments`,
    PAYMENTS: `${API_BASE_URL}/api/student/payments`,
    STATS: `${API_BASE_URL}/api/student/stats`,
    TEACHER_CHECK: `${API_BASE_URL}/api/student/teacher-check`,
    VIDEO_SESSIONS: `${API_BASE_URL}/api/student/video-sessions`,
    JOIN_VIDEO_SESSION: `${API_BASE_URL}/api/student/video-sessions/join`,
    CONTACT_ADMIN: `${API_BASE_URL}/api/student/contact-admin`
  },

  // ==================== TEACHER ENDPOINTS ====================
  TEACHER: {
    PROFILE: `${API_BASE_URL}/api/teacher/profile`,
    UPDATE_PROFILE: `${API_BASE_URL}/api/teacher/profile`,
    CLASSES: `${API_BASE_URL}/api/teacher/classes`,
    STUDENTS: `${API_BASE_URL}/api/teacher/students`,
    ASSIGNMENTS: `${API_BASE_URL}/api/teacher/assignments`,
    CREATE_ASSIGNMENT: `${API_BASE_URL}/api/teacher/assignments`,
    GRADE_ASSIGNMENT: `${API_BASE_URL}/api/teacher/assignments/:id/grade`,
    VIDEO_SESSIONS: `${API_BASE_URL}/api/teacher/video-sessions`,
    START_VIDEO_SESSION: `${API_BASE_URL}/api/teacher/video-sessions`,
    END_VIDEO_SESSION: `${API_BASE_URL}/api/teacher/video-sessions/:id/end`
  },

  // ==================== ADMIN ENDPOINTS ====================
  ADMIN: {
    PROFILE: `${API_BASE_URL}/api/admin/profile`,
    LOGIN: `${API_BASE_URL}/api/admin/login`,
    LOGOUT: `${API_BASE_URL}/api/admin/logout`,
    REGISTER: `${API_BASE_URL}/api/admin/register`,
    ACTIVATE: `${API_BASE_URL}/api/admin/activate`,
    
    // Teachers Management
    TEACHERS: `${API_BASE_URL}/api/admin/teachers`,
    CREATE_TEACHER: `${API_BASE_URL}/api/admin/teachers`,
    RESET_TEACHER_PASSWORD: `${API_BASE_URL}/api/admin/teachers/:id/reset-password`,
    DELETE_TEACHER: `${API_BASE_URL}/api/admin/teachers/:id`,
    
    // Students Management
    STUDENTS: `${API_BASE_URL}/api/admin/students`,
    CREATE_STUDENT: `${API_BASE_URL}/api/admin/students`,
    REASSIGN_STUDENT: `${API_BASE_URL}/api/admin/students/:id/reassign`,
    DELETE_STUDENT: `${API_BASE_URL}/api/admin/students/:id`,
    STUDENTS_BY_TEACHER: `${API_BASE_URL}/api/admin/students/teacher/:teacherId`,
    
    // Classes Management
    CLASSES: `${API_BASE_URL}/api/admin/classes`,
    CREATE_CLASS: `${API_BASE_URL}/api/admin/classes`,
    UPDATE_CLASS: `${API_BASE_URL}/api/admin/classes/:id`,
    DELETE_CLASS: `${API_BASE_URL}/api/admin/classes/:id`,
    
    // Video Sessions
    VIDEO_SESSIONS: `${API_BASE_URL}/api/admin/video-sessions`,
    JOIN_VIDEO_CALL: `${API_BASE_URL}/api/admin/join-video-call`,
    REMOVE_FROM_VIDEO_CALL: `${API_BASE_URL}/api/admin/remove-from-video-call`
  },

  // ==================== LEGACY/COMPATIBILITY ENDPOINTS ====================
  // These provide backward compatibility for existing frontend calls
  STATS: `${API_BASE_URL}/api/student/stats`,
  CLASSES: `${API_BASE_URL}/api/student/classes`,
  TEACHER_CHECK: `${API_BASE_URL}/api/student/teacher-check`,
  ASSIGNMENTS: `${API_BASE_URL}/api/student/assignments`,
  PAYMENTS: `${API_BASE_URL}/api/student/payments`
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Build URL with dynamic parameters
 * @param {string} endpoint - The endpoint template with :param placeholders
 * @param {Object} params - Object containing parameter values
 * @returns {string} - URL with parameters replaced
 * 
 * @example
 * buildUrl(API_ENDPOINTS.TEACHER.GRADE_ASSIGNMENT, { id: '123' })
 * // Returns: "https://api.example.com/api/teacher/assignments/123/grade"
 */
export const buildUrl = (endpoint, params = {}) => {
  let url = endpoint;
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, encodeURIComponent(params[key]));
  });
  return url;
};

/**
 * Get all endpoints for a specific role
 * @param {string} role - The role (student, teacher, admin)
 * @returns {Object} - Object containing all endpoints for that role
 */
export const getEndpointsByRole = (role) => {
  const normalizedRole = role.toUpperCase();
  return API_ENDPOINTS[normalizedRole] || {};
};

/**
 * Check if API is configured for production
 * @returns {boolean}
 */
export const isProduction = () => {
  return import.meta.env.NODE_ENV === 'production';
};

/**
 * Get the current API base URL
 * @returns {string}
 */
export const getApiBaseUrl = () => {
  return API_BASE_URL;
};

// ==================== API CONFIGURATION ====================
export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  headers: {
    'Content-Type': 'application/json'
  }
};

// ==================== ENVIRONMENT INFO ====================
export const ENV_INFO = {
  NODE_ENV: import.meta.env.NODE_ENV,
  API_URL: import.meta.env.VITE_API_URL,
  APP_NAME: import.meta.env.VITE_APP_NAME,
  BASE_URL: API_BASE_URL,
  IS_PRODUCTION: isProduction(),
  IS_DEVELOPMENT: !isProduction()
};

// Default export for backward compatibility
export default API_BASE_URL;

