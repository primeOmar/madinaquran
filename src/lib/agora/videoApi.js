// lib/agora/videoApi.js - UPDATED WITH BETTER DEBUGGING

const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

const videoApi = {
  /**
   * Start a video session (for teachers)
   */
  async startVideoSession(classId, userId) {
    try {
      console.log('📡 API: Starting video session via /agora/start-session', {
        classId,
        userId
      });

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
        console.error('❌ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        throw new Error(data.error || `Failed to start video session: ${response.status}`);
      }

      console.log('✅ API: Video session started successfully:', {
        meetingId: data.meeting_id,
        channel: data.channel,
        hasToken: !!data.token,
        appId: data.app_id
      });

      return {
        success: true,
        meetingId: data.meeting_id || data.meetingId,
        channel: data.channel,
        token: data.token,
        appId: data.app_id || data.appId,
        uid: data.uid || userId,
        session: data.session,
        class_title: data.class_title
      };

    } catch (error) {
      console.error('❌ API: startVideoSession failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to start video session'
      };
    }
  },

  /**
   * Join a video session (for students and teachers) - UPDATED
   */
  async joinVideoSession(meetingId, userId) {
    try {
      console.log('🔍 FRONTEND: Attempting to join session:', {
        meetingId,
        userId,
        meetingIdType: typeof meetingId,
        meetingIdLength: meetingId?.length
      });

      // Validate meeting ID
      if (!meetingId || meetingId === 'undefined' || meetingId === 'null') {
        throw new Error('Invalid meeting ID: ' + meetingId);
      }

      const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          meeting_id: meetingId.toString(), // Ensure it's a string
                             user_id: userId
        })
      });

      const data = await response.json();

      console.log('🔍 FRONTEND: Join response details:', {
        status: response.status,
        ok: response.ok,
        data: data,
        hasError: data.error,
        hasSession: !!data.session
      });

      if (!response.ok) {
        // More specific error handling
        let errorMessage = data.error || 'Failed to join video session';

        if (response.status === 404) {
          errorMessage = 'Session not found. It may have ended or the meeting ID is incorrect.';
        } else if (response.status === 400) {
          errorMessage = 'Invalid request. Please check the meeting ID.';
        } else if (response.status === 403) {
          errorMessage = 'Access denied to this session.';
        }

        throw new Error(errorMessage);
      }

      // Validate response data
      if (!data.token || !data.channel) {
        throw new Error('Invalid response: missing token or channel');
      }

      console.log('✅ FRONTEND: Join successful, received:', {
        meetingId: data.meeting_id,
        channel: data.channel,
        tokenLength: data.token?.length,
        uid: data.uid,
        appId: data.appId
      });

      return {
        success: true,
        meetingId: data.meeting_id,
        channel: data.channel,
        token: data.token,
        appId: data.appId,
        uid: data.uid,
        session: data.session
      };

    } catch (error) {
      console.error('❌ FRONTEND: joinVideoSession failed:', {
        error: error.message,
        meetingId,
        userId,
        stack: error.stack
      });
      throw error;
    }
  },

  /**
   * Get session info without joining
   */
  async getSessionInfo(meetingId) {
    try {
      console.log('🔍 API: Getting session info for:', meetingId);

      const response = await fetch(`${API_BASE_URL}/agora/session-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          meeting_id: meetingId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn('⚠️ API: getSessionInfo failed:', data.error);
        return {
          success: false,
          error: data.error,
          exists: false
        };
      }

      console.log('✅ API: Session info retrieved:', {
        exists: true,
        status: data.session?.status,
        meetingId: data.session?.meeting_id
      });

      return {
        success: true,
        session: data.session,
        exists: true
      };

    } catch (error) {
      console.error('❌ API: getSessionInfo failed:', error);
      return {
        success: false,
        error: error.message,
        exists: false
      };
    }
  },

  /**
   * Check if session exists and get valid meeting ID
   */
  async findValidSession(classId, userId) {
    try {
      console.log('🔍 API: Finding valid session for class:', { classId, userId });
      
      // Method 1: Get active sessions and find matching class
      const activeSessions = await this.getActiveSessions();
      if (activeSessions.success) {
        const classSession = activeSessions.sessions.find(s => s.class_id === classId);
        if (classSession) {
          console.log('✅ Found valid session via active sessions:', classSession.meeting_id);
          return {
            success: true,
            meetingId: classSession.meeting_id,
            session: classSession,
            source: 'active_sessions'
          };
        }
      }
      
      // Method 2: Try to start a new session if no active one found
      console.log('🔄 No active session found, starting new session...');
      const newSession = await this.startVideoSession(classId, userId);
      
      if (newSession.success) {
        return {
          success: true,
          meetingId: newSession.meetingId,
          session: newSession.session,
          source: 'new_session'
        };
      }
      
      throw new Error('Could not find or create a valid session');
      
    } catch (error) {
      console.error('❌ API: findValidSession failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  /**
   * Leave a video session
   */
  async leaveVideoSession(meetingId, userId) {
    try {
      console.log('📡 API: Leaving video session:', { meetingId, userId });

      const response = await fetch(`${API_BASE_URL}/agora/leave-session`, {
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

      if (response.ok) {
        const data = await response.json();
        console.log('✅ API: Left video session successfully');
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
   * End a video session (teacher only)
   */
  async endVideoSession(meetingId, userId) {
    try {
      console.log('📡 API: Ending video session:', { meetingId, userId });

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
        console.error('❌ API Error ending session:', data);
        throw new Error(data.error || `Failed to end session: ${response.status}`);
      }

      console.log('✅ API: Video session ended successfully');

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ API: endVideoSession failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },


/**
 * Get chat messages for a session
 */
async getSessionMessages(sessionId) {
  try {
    console.log('📡 API: Getting session messages for:', sessionId);

    const response = await fetch(`${API_BASE_URL}/agora/session-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('⚠️ API: getSessionMessages failed:', data.error);
      return []; // Return empty array instead of throwing
    }

    console.log('✅ API: Retrieved session messages:', {
      count: data.messages?.length || 0
    });

    return data.messages || [];

  } catch (error) {
    console.error('❌ API: getSessionMessages failed:', error);
    return []; // Always return array, never throw
  }
},

/**
 * Get participants for a session
 */
async getSessionParticipants(meetingId) {
  try {
    console.log('📡 API: Getting session participants for:', meetingId);

    const response = await fetch(`${API_BASE_URL}/agora/session-participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        meeting_id: meetingId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('⚠️ API: getSessionParticipants failed:', data.error);
      return []; // Return empty array instead of throwing
    }

    console.log('✅ API: Retrieved session participants:', {
      count: data.participants?.length || 0
    });

    return data.participants || [];

  } catch (error) {
    console.error('❌ API: getSessionParticipants failed:', error);
    return []; // Always return array, never throw
  }
},

/**
 * Send a chat message
 */
async sendMessage(sessionId, userId, message) {
  try {
    console.log('📡 API: Sending message:', {
      sessionId,
      userId,
      messageLength: message.length
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
        message_type: 'text'
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
        created_at: new Date().toISOString(),
        user_id: userId
      };
    }

    console.log('✅ API: Message sent successfully:', {
      messageId: data.message?.id
    });

    return data.message || {
      id: Date.now(),
      message_text: message,
      created_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ API: sendMessage failed:', error);
    // Return mock message on error
    return {
      id: Date.now(),
      message_text: message,
      message_type: 'text',
      created_at: new Date().toISOString(),
      user_id: userId,
      is_mock: true
    };
  }
},

/**
 * Update participant status
 */
async updateParticipantStatus(sessionId, userId, updates) {
  try {
    console.log('📡 API: Updating participant status:', {
      sessionId,
      userId,
      updates
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
    return { success: true };

  } catch (error) {
    console.error('❌ API: updateParticipantStatus failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Start recording a session
 */
async startRecording(sessionId, userId) {
  try {
    console.log('📡 API: Starting recording for session:', sessionId);

    const response = await fetch(`${API_BASE_URL}/agora/start-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('⚠️ API: startRecording failed:', data.error);
      return { success: false, error: data.error };
    }

    console.log('✅ API: Recording started successfully');
    return { success: true };

  } catch (error) {
    console.error('❌ API: startRecording failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Generate a new token (for token renewal)
 */
async generateToken(meetingId, userId) {
  try {
    console.log('📡 API: Generating token for:', { meetingId, userId });

    const response = await fetch(`${API_BASE_URL}/agora/generate-token`, {
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
      console.error('❌ API Error generating token:', data);
      throw new Error(data.error || 'Failed to generate token');
    }

    console.log('✅ API: Token generated successfully');
    return {
      success: true,
      token: data.token
    };

  } catch (error) {
    console.error('❌ API: generateToken failed:', error);
    throw error;
  }
},
  /**
   * Get active video sessions
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

      console.log('✅ API: Retrieved active sessions:', {
        count: data.sessions?.length || 0,
        sessions: data.sessions?.map(s => ({
          id: s.id,
          meeting_id: s.meeting_id,
          status: s.status,
          class_id: s.class_id
        }))
      });

      return {
        success: true,
        sessions: data.sessions || []
      };

    } catch (error) {
      console.error('❌ API: getActiveSessions failed:', error);
      return {
        success: false,
        error: error.message,
        sessions: []
      };
    }
  }
};

export default videoApi;
