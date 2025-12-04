// src/lib/agora/videoApiLoader.js
const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

// Factory function to create videoApi instance
export const createVideoApi = () => {
  return {
    getSessionInfo: async (meetingId) => {
      const response = await fetch(`${API_BASE_URL}/agora/session-info/${meetingId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    },
    
    joinVideoSession: async (meetingId, userId, role = 'student') => {
      const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          meeting_id: meetingId, 
          user_id: userId, 
          role 
        })
      });
      return response.json();
    },
    
    updateParticipantStatus: async (sessionId, userId, updates) => {
      const response = await fetch(`${API_BASE_URL}/agora/update-participant`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          session_id: sessionId, 
          user_id: userId, 
          ...updates 
        })
      });
      return response.json();
    },
    
    getSessionMessages: async (sessionId) => {
      const response = await fetch(`${API_BASE_URL}/agora/session-messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await response.json();
      return data.messages || [];
    },
    
    sendMessage: async (sessionId, userId, message, type = 'text') => {
      const response = await fetch(`${API_BASE_URL}/agora/send-message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          session_id: sessionId, 
          user_id: userId, 
          message_text: message, 
          message_type: type 
        })
      });
      return response.json();
    },
    
    // Add other methods as needed from your original videoApi.js
    getSessionByClassId: async (classId) => {
      const response = await fetch(`${API_BASE_URL}/agora/session-by-class/${classId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    },
    
    generateToken: async (meetingId, userId) => {
      const response = await fetch(`${API_BASE_URL}/agora/generate-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ meeting_id: meetingId, user_id: userId })
      });
      return response.json();
    }
  };
};

// Global instance (for debugging and fallback)
let globalVideoApi = null;

export const getVideoApi = () => {
  if (globalVideoApi) return globalVideoApi;
  
  // Try to import the module first
  try {
    // This will work if the module is properly bundled
    const module = require('./videoApi');
    globalVideoApi = module.default;
    return globalVideoApi;
  } catch (e) {
    console.log('Module import failed, using fallback API:', e.message);
    globalVideoApi = createVideoApi();
    return globalVideoApi;
  }
};

// Export the factory function as default
export default createVideoApi;