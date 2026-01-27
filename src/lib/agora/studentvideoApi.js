// lib/agora/videoApi.js - UPDATED FOR TEACHER-STUDENT SYNC
const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

const studentvideoApi = {
  /**
   * Start a video session (for teachers)
   * Creates new session and returns meeting ID for students to join
   */
async startVideoSession(classId, userId) {
    try {
      console.log('📡 TEACHER API: Starting video session', { classId, userId });

      const response = await fetch(`${API_BASE_URL}/agora/start-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          class_id: classId,
          user_id: userId,
          role: 'teacher'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start session');

      return {
        success: true,
        ...data,
        uid: data.uid || userId,
        role: 'teacher'
      };
    } catch (error) {
      console.error('❌ TEACHER API Error:', error);
      return { success: false, error: error.message };
    }
  },


/**
 * Smart student join - finds and joins the correct session
 */
async smartStudentJoin(classId, studentId) {
    try {
      const sessionInfo = await this.getSessionByClassId(classId);
      
      if (sessionInfo.exists && sessionInfo.isActive) {
        return await this.joinVideoSession(sessionInfo.meetingId, studentId, 'student');
      }
      
      throw new Error('Class has not started yet. Please wait for the teacher.');
    } catch (error) {
      console.error('❌ Smart Join Error:', error);
      throw error;
    }
  },

  /**
 * Join a video session (for students) - BYPASS ALL PERMISSION CHECKS
 * Allows any student to join any session for testing
 */
async joinVideoSession(meetingId, userId, userType = 'student', isScreenShare = false) {
    try {
      console.log('🎓 API: Joining session:', { meetingId, userId, userType, isScreenShare });

      const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          meeting_id: meetingId,
          user_id: userId,
          user_type: userType,
          is_screen_share: isScreenShare // CRITICAL for Screen Sharing sync
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to join');

      return {
        success: true,
        ...data,
        role: userType
      };
    } catch (error) {
      console.error('❌ API Join Error:', error);
      return { success: false, error: error.message };
    }
  },

/**
 * Generate Agora credentials - Helper function
 */
async generateAgoraCredentials(channelName, userId, isScreenShare = false) {
    try {
      const response = await fetch(`${API_BASE_URL}/agora/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          channel_name: channelName,
          user_id: userId,
          role: 'student',
          is_screen_share: isScreenShare
        })
      });

      if (response.ok) {
        return await response.json(); // Returns { token, uid, appId }
      }
    } catch (error) {
      console.log('⚠️ Token generation failed:', error.message);
    }

    // PRODUCTION FALLBACK: Never use Math.random() anymore. Use the ID math.
    const baseUid = Number(userId);
    return {
      token: null,
      appId: 'YOUR_APP_ID',
      uid: isScreenShare ? baseUid + 10000 : baseUid
    };
  },

  /**
   * Get session info without joining - UPDATED
   */
  async getSessionInfo(meetingId) {
    try {
      console.log('🔍 API: Getting session info for:', {
        meetingId,
        endpoint: `${API_BASE_URL}/agora/session-info/${meetingId}`
      });

      const response = await fetch(`${API_BASE_URL}/agora/session-info/${meetingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      console.log('📊 API: Session info response:', {
        status: response.status,
        ok: response.ok,
        hasSession: !!data.session,
        sessionStatus: data.session?.status,
        meetingIdMatch: data.session?.meeting_id === meetingId
      });

      if (!response.ok) {
        console.warn('⚠️ API: getSessionInfo failed:', {
          status: response.status,
          error: data.error
        });
        return {
          success: false,
          error: data.error || 'Session not found',
          exists: false,
          isActive: false
        };
      }

      if (!data.session) {
        return {
          success: true,
          exists: false,
          isActive: false,
          error: 'Session data missing from response'
        };
      }

      const sessionExists = !!data.session;
      const isActive = data.session?.status === 'active';

      console.log('✅ API: Session info retrieved:', {
        exists: sessionExists,
        isActive,
        status: data.session?.status,
        meetingId: data.session?.meeting_id,
        channel: data.session?.channel_name,
        startedAt: data.session?.started_at
      });

      return {
        success: true,
        session: data.session,
        exists: sessionExists,
        isActive,
        channel: data.session?.channel_name,
        appId: data.session?.app_id
      };

    } catch (error) {
      console.error('❌ API: getSessionInfo failed:', {
        error: error.message,
        meetingId,
        endpoint: `${API_BASE_URL}/agora/session-info/${meetingId}`
      });
      return {
        success: false,
        error: error.message,
        exists: false,
        isActive: false
      };
    }
  },


  /**
   * Validate if student can join session - NEW METHOD
   */
  async validateStudentJoin(classId, studentId) {
    try {
      console.log('🔐 API: Validating student join:', { classId, studentId });

      // Step 1: Get active session for this class
      const sessionInfo = await this.getSessionByClassId(classId);

      if (!sessionInfo.exists || !sessionInfo.isActive) {
        return {
          success: false,
          canJoin: false,
          error: 'No active session for this class',
          code: 'NO_ACTIVE_SESSION'
        };
      }

      // Step 2: Check if student is enrolled in this class
      const response = await fetch(`${API_BASE_URL}/agora/validate-student-join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          class_id: classId,
          student_id: studentId,
          meeting_id: sessionInfo.meetingId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          canJoin: false,
          error: data.error || 'Validation failed',
          code: data.code || 'VALIDATION_FAILED'
        };
      }

      console.log('✅ API: Student validated successfully:', {
        canJoin: true,
        meetingId: sessionInfo.meetingId,
        sessionStatus: sessionInfo.session?.status
      });

      return {
        success: true,
        canJoin: true,
        meetingId: sessionInfo.meetingId,
        session: sessionInfo.session,
        channel: sessionInfo.channel,
        appId: sessionInfo.appId
      };

    } catch (error) {
      console.error('❌ API: validateStudentJoin failed:', error);
      return {
        success: false,
        canJoin: false,
        error: error.message,
        code: 'VALIDATION_ERROR'
      };
    }
  },

  /**
   * Unified join function - SMART METHOD
   * Automatically determines if user is teacher or student
   */
  async joinClassSession(classId, userId, userRole = 'student') {
  try {
    console.log('🚀 SMART JOIN: User attempting to join class:', {
      classId,
      userId,
      userRole,
      timestamp: new Date().toISOString()
    });

    if (userRole === 'teacher') {
      // Teacher starts new session or joins existing one
      console.log('👨‍🏫 SMART JOIN: Teacher flow');
      return await this.startVideoSession(classId, userId);
    } else {
      // Student uses SMART student join
      console.log('🎓 SMART JOIN: Student flow - using smart join');
      return await this.smartStudentJoin(classId, userId);
    }

  } catch (error) {
    console.error('❌ SMART JOIN: joinClassSession failed:', error);
    return {
      success: false,
      error: error.message,
      userRole
    };
  }
},

/**
 * Get session by class ID - SINGLE VERSION (FIXED)
 */
async getSessionByClassId(classId) {
    try {
      const response = await fetch(`${API_BASE_URL}/agora/session-by-class/${classId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (!response.ok) return { success: false, exists: false, isActive: false };

      return {
        success: true,
        exists: data.exists,
        isActive: data.isActive,
        meetingId: data.meetingId || data.session?.meeting_id,
        channel: data.channel || data.session?.channel_name,
        appId: data.session?.app_id
      };
    } catch (error) {
      return { success: false, exists: false, isActive: false };
    }
  },

/**
 * Get all participants in a session with their full profile data
 */
async getSessionParticipants(meetingId) {
  try {
    console.log('📡 API: Fetching session participants for:', meetingId);
    
    const response = await fetch(`${API_BASE_URL}/agora/participants/${meetingId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API: Failed to fetch participants:', data);
      throw new Error(data.error || 'Failed to fetch participants');
    }

    console.log('✅ API: Participants received:', {
      count: data.participants?.length || 0,
      participants: data.participants
    });

    return {
      success: true,
      participants: data.participants || []
    };

  } catch (error) {
    console.error('❌ API: getSessionParticipants failed:', error);
    return {
      success: false,
      error: error.message,
      participants: []
    };
  }
},

/**
 * Get participant profiles by their Agora UIDs (fallback method)
 */
async getParticipantProfiles(meetingId, agoraUids) {
  try {
    console.log('📡 API: Fetching profiles by Agora UIDs:', { meetingId, agoraUids });
    
    // This uses the main participants endpoint which now returns full profiles
    const response = await this.getSessionParticipants(meetingId);
    
    if (response.success && response.participants) {
      // Filter to only requested UIDs if provided
      const filteredProfiles = agoraUids && agoraUids.length > 0
        ? response.participants.filter(p => 
            agoraUids.includes(parseInt(p.agora_uid, 10))
          )
        : response.participants;
      
      return {
        success: true,
        profiles: filteredProfiles
      };
    }
    
    return {
      success: false,
      profiles: []
    };

  } catch (error) {
    console.error('❌ API: getParticipantProfiles failed:', error);
    return {
      success: false,
      error: error.message,
      profiles: []
    };
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
   * Fetches the name and role of all participants in the meeting.
   */
  async getParticipantProfiles(meetingId) {
    try {
      console.log('📡 API: Fetching participant profiles for meeting:', meetingId);
      
      const response = await fetch(`${API_BASE_URL}/agora/participants/${meetingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          // Pass the local user ID to the backend if needed for security/local user identification
          'x-user-id': localStorage.getItem('userId') 
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to fetch participants: ${response.status}`);
      }

      return { success: true, participants: data.participants };

    } catch (error) {
      console.error('❌ Failed to fetch participant profiles:', error);
      return { success: false, participants: [], error: error.message };
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

export default studentvideoApi;