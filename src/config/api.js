const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://madina-quran-backend.onrender.com'
  : 'http://localhost:3001'; // local backend

export const API_ENDPOINTS = {
  // Health & Test
  HEALTH: `${API_BASE_URL}/api/health`,

  
  // Admin endpoints
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_TEACHERS: `${API_BASE_URL}/api/admin/teachers`,
  ADMIN_STUDENTS: `${API_BASE_URL}/api/admin/students`,
  
  // Teacher endpoints
  TEACHER_CLASSES: `${API_BASE_URL}/api/teacher/classes`,
  TEACHER_SESSIONS: `${API_BASE_URL}/api/teacher/sessions`,
  
  // Student endpoints  
  STUDENT_CLASSES: `${API_BASE_URL}/api/student/classes`,
  STUDENT_PROFILE: `${API_BASE_URL}/api/student/profile`,
  
  // Agora token
  AGORA_TOKEN: `${API_BASE_URL}/api/generate-agora-token`,
};

export default API_BASE_URL;
