const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://madinaquranclass.onrender.com'
  : 'http://localhost:3001';

export const API_ENDPOINTS = {
  // Health & Test
  HEALTH: `${API_BASE_URL}/api/health`,
  TEST: `${API_BASE_URL}/api/test`,
  CONNECTION_TEST: `${API_BASE_URL}/api/connection-test`,


  STATS: `${API_BASE_URL}/stats`,           
  CLASSES: `${API_BASE_URL}/classes`,      
  TEACHER_CHECK: `${API_BASE_URL}/teacher-check`, 
  ASSIGNMENTS: `${API_BASE_URL}/assignments`, 
  PAYMENTS: `${API_BASE_URL}/payments`,     
  
 
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_TEACHERS: `${API_BASE_URL}/api/admin/teachers`,
  ADMIN_STUDENTS: `${API_BASE_URL}/api/admin/students`,
  
  // Teacher endpoints
  TEACHER_CLASSES: `${API_BASE_URL}/api/teacher/classes`,
  TEACHER_SESSIONS: `${API_BASE_URL}/api/teacher/sessions`,
  
  // Student endpoints (keep these for future use)
  STUDENT_CLASSES: `${API_BASE_URL}/api/student/classes`,
  STUDENT_PROFILE: `${API_BASE_URL}/api/student/profile`,
  
  // Agora token
  AGORA_TOKEN: `${API_BASE_URL}/api/generate-agora-token`,
};

export default API_BASE_URL;
