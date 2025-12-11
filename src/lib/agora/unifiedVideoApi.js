// lib/agora/unifiedVideoApi.js
const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

const unifiedVideoApi = {
  /**
   * Start or join a video session based on role
   */
  async startOrJoinSession(classId, userId, role = 'teacher') {
    console.log('🚀 START/JOIN SESSION:', { classId, userId, role });
    
    try {
      if (role === 'teacher') {
        // Teacher starts session
        return await this.startTeacherSession(classId, userId);
      } else {
        // Student joins existing session
        return await this.joinStudentSession(classId, userId);
      }
    } catch (error) {
      console.error('❌ Start/Join error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Teacher: Start video session
   */
  async startTeacherSession(classId, userId) {
    try {
      console.log('👨‍🏫 TEACHER: Starting session for class:', classId);
      
      const response = await fetch(`${API_BASE_URL}/agora/start-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          class_id: classId,
          user_id: userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      console.log('✅ TEACHER: Session started:', {
        meetingId: data.meetingId,
        channel: data.channel,
        teacherId: data.session?.teacher_id
      });

      return {
        success: true,
        meetingId: data.meetingId,
        channel: data.channel,
        token: data.token,
        appId: data.appId,
        uid: data.uid,
        session: data.session,
        role: 'teacher'
      };

    } catch (error) {
      console.error('❌ TEACHER: Start session failed:', error);
      throw error;
    }
  },

  /**
   * Student: Join teacher's session
   */
  async joinStudentSession(classId, studentId) {
    try {
      console.log('🎓 STUDENT: Joining class session:', classId);
      
      // UNIFIED MEETING ID: class_{classId}
      const meetingId = `class_${classId}`;
      
      console.log('🔍 Using unified meeting ID:', meetingId);

      // Check if session exists
      const sessionInfo = await this.getSessionInfo(meetingId);
      
      if (!sessionInfo.exists || !sessionInfo.isActive) {
        throw new Error('No active session found. Please wait for teacher to start the class.');
      }

      // Join the session
      const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          meeting_id: meetingId,
          user_id: studentId,
          user_type: 'student'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join session');
      }

      console.log('✅ STUDENT: Joined session:', {
        meetingId: data.meetingId,
        channel: data.channel,
        teacherPresent: data.session?.teacher_joined
      });

      return {
        success: true,
        meetingId: data.meetingId,
        channel: data.channel,
        token: data.token,
        appId: data.appId,
        uid: data.uid,
        session: data.session,
        role: 'student',
        teacher_id: data.session?.teacher_id
      };

    } catch (error) {
      console.error('❌ STUDENT: Join session failed:', error);
      throw error;
    }
  },

  /**
   * Get session info
   */
  async getSessionInfo(meetingId) {
    try {
      const response = await fetch(`${API_BASE_URL}/agora/session-info/${meetingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          exists: false,
          isActive: false,
          error: data.error
        };
      }

      return {
        success: true,
        session: data.session,
        exists: !!data.session,
        isActive: data.session?.status === 'active'
      };

    } catch (error) {
      console.error('❌ Get session info failed:', error);
      return {
        success: false,
        exists: false,
        isActive: false,
        error: error.message
      };
    }
  },

  /**
   * Get session by class ID
   */
  async getSessionByClassId(classId) {
    try {
      // UNIFIED: Always use class_{classId} as meeting ID
      const meetingId = `class_${classId}`;
      
      const sessionInfo = await this.getSessionInfo(meetingId);
      
      if (sessionInfo.exists) {
        return {
          success: true,
          meetingId: meetingId,
          session: sessionInfo.session,
          exists: true,
          isActive: sessionInfo.isActive
        };
      }

      return {
        success: false,
        exists: false,
        isActive: false,
        error: 'No active session for this class'
      };

    } catch (error) {
      console.error('❌ Get session by class failed:', error);
      return {
        success: false,
        error: error.message,
        exists: false,
        isActive: false
      };
    }
  },

  /**
   * Get session participants
   */
  async getSessionParticipants(meetingId) {
    try {
      const response = await fetch(`${API_BASE_URL}/agora/session-participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ meeting_id: meetingId })
      });

      const data = await response.json();
      return data.participants || [];

    } catch (error) {
      console.error('❌ Get participants failed:', error);
      return [];
    }
  },

  /**
   * End session (teacher only)
   */
  async endVideoSession(meetingId, userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/agora/end-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          meeting_id: meetingId,
          user_id: userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to end session');
      }

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ End session failed:', error);
      throw error;
    }
  },

   /**
   * Update participant status with role - ENHANCED
   */
  async updateParticipantStatus(sessionId, userId, updates) {
    try {
      console.log('📡 API: Updating participant status:', {
        sessionId,
        userId,
        updates,
        timestamp: new Date().toISOString()
      });

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

      const data = await response.json();

      if (!response.ok) {
        console.warn('⚠️ API: updateParticipantStatus failed:', data.error);
        return { success: false, error: data.error };
      }

      console.log('✅ API: Participant status updated successfully');
      return { success: true, data };

    } catch (error) {
      console.error('❌ API: updateParticipantStatus failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send message with role info - ENHANCED
   */
  async sendMessage(sessionId, userId, message, role = 'student') {
    try {
      console.log('💬 API: Sending message:', {
        sessionId,
        userId,
        role,
        messageLength: message.length,
        timestamp: new Date().toISOString()
      });

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
          message_type: 'text',
          role: role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn('⚠️ API: sendMessage failed:', data.error);
        // Return a mock message so UI doesn't break
        return {
          id: Date.now(),
          message_text: message,
          message_type: 'text',
          role: role,
          created_at: new Date().toISOString(),
          user_id: userId
        };
      }

      console.log('✅ API: Message sent successfully:', {
        messageId: data.message?.id,
        role: role
      });

      return data.message || {
        id: Date.now(),
        message_text: message,
        role: role,
        created_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ API: sendMessage failed:', error);
      return {
        id: Date.now(),
        message_text: message,
        message_type: 'text',
        role: role,
        created_at: new Date().toISOString(),
        user_id: userId,
        is_mock: true
      };
    }
  },

  /**
   * Get active sessions with class info - ENHANCED
   */
  async getActiveSessions() {
    try {
      console.log('📡 API: Getting active sessions');

      const response = await fetch(`${API_BASE_URL}/agora/active-sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get active sessions');
      }

      const sessions = data.sessions || [];
      
      console.log('✅ API: Retrieved active sessions:', {
        count: sessions.length,
        sessions: sessions.map(s => ({
          id: s.id,
          meeting_id: s.meeting_id,
          class_id: s.class_id,
          class_title: s.class_title,
          status: s.status,
          teacher_name: s.teacher_name,
          participant_count: s.participant_count,
          started_at: s.started_at
        }))
      });

      return {
        success: true,
        sessions
      };

    } catch (error) {
      console.error('❌ API: getActiveSessions failed:', error);
      return {
        success: false,
        error: error.message,
        sessions: []
      };
    }
  },

  /**
   * Leave session with role info
   */
  async leaveVideoSession(meetingId, userId, role = 'student') {
    try {
      console.log('🚪 API: Leaving video session:', { meetingId, userId, role });

      const response = await fetch(`${API_BASE_URL}/agora/leave-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          meeting_id: meetingId,
          user_id: userId,
          role: role
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ API: Left video session successfully:', { userId, role });
      } else {
        console.warn('⚠️ API: Leave session returned non-200:', response.status);
      }

      return { success: true };

    } catch (error) {
      console.warn('⚠️ API: leaveVideoSession failed:', error);
      return { success: true };
    }
  },

  /**
   * End session (teacher only)
   */
  async endVideoSession(meetingId, userId) {
    try {
      console.log('🛑 TEACHER API: Ending video session:', { meetingId, userId });

      const response = await fetch(`${API_BASE_URL}/agora/end-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          meeting_id: meetingId,
          user_id: userId,
          role: 'teacher'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ TEACHER API Error ending session:', data);
        throw new Error(data.error || `Failed to end session: ${response.status}`);
      }

      console.log('✅ TEACHER API: Video session ended successfully');

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ TEACHER API: endVideoSession failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

// Validate session exists
async validateSession(meetingId, studentId) {
  try {
    // Reuse existing method
    return await this.getSessionInfo(meetingId);
  } catch (error) {
    return { success: false, error: error.message };
  }
},

// Get session messages
async getSessionMessages(sessionId) {
  try {
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
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
},

// Start recording
async startRecording(meetingId) {
  try {
    const response = await fetch(`${API_BASE_URL}/agora/start-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ 
        session_id: meetingId, 
        user_id: localStorage.getItem('userId') 
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Start recording error:', error);
    return { success: false, error: error.message };
  }
},

// Stop recording  
async stopRecording(meetingId) {
  try {
    const response = await fetch(`${API_BASE_URL}/agora/stop-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ 
        session_id: meetingId, 
        user_id: localStorage.getItem('userId') 
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Stop recording error:', error);
    return { success: false, error: error.message };
  }
},

  /**
   * Quick test to verify API connectivity
   */
  async testConnection() {
    try {
      console.log('🧪 API: Testing connection...');
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      console.log('✅ API: Connection test successful:', data);
      return { success: true, data };
    } catch (error) {
      console.error('❌ API: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
};
export default unifiedVideoApi;