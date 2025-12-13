// lib/agora/videoApi.js - UPDATED FOR TEACHER-STUDENT SYNC
const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

const studentvideoApi = {
  /**
   * Start a video session (for teachers)
   * Creates new session and returns meeting ID for students to join
   */
  async startVideoSession(classId, userId) {
    try {
      console.log('📡 TEACHER API: Starting video session via /agora/start-session', {
        classId,
        userId,
        timestamp: new Date().toISOString()
      });

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

      if (!response.ok) {
        console.error('❌ TEACHER API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        throw new Error(data.error || `Failed to start video session: ${response.status}`);
      }

      // VALIDATE RESPONSE HAS ALL REQUIRED FIELDS
      if (!data.meeting_id || !data.channel || !data.token || !data.app_id) {
        console.error('❌ TEACHER API: Incomplete response:', data);
        throw new Error('Invalid response from server: missing required fields');
      }

      console.log('✅ TEACHER API: Video session started successfully:', {
        meetingId: data.meeting_id,
        channel: data.channel,
        tokenExists: !!data.token,
        tokenLength: data.token?.length,
        appId: data.app_id,
        sessionExists: !!data.session,
        uid: data.uid
      });

      return {
        success: true,
        meetingId: data.meeting_id,
        channel: data.channel,
        token: data.token,
        appId: data.app_id,
        uid: data.uid || userId,
        session: data.session,
        class_title: data.class_title,
        role: 'teacher'
      };

    } catch (error) {
      console.error('❌ TEACHER API: startVideoSession failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to start video session'
      };
    }
  },

  /**
   * Join a video session (for students) - UPDATED
   * Student joins using same meeting_id from teacher's session
   */
async joinVideoSession(meetingId, userId, userType = 'student') {
  try {
    console.log('🎓 STUDENT API: Joining video session:', {
      meetingId,
      userId,
      userType,
      timestamp: new Date().toISOString()
    });

    // Validate meeting ID
    if (!meetingId || meetingId === 'undefined' || meetingId === 'null') {
      console.error('❌ STUDENT API: Invalid meeting ID:', meetingId);
      throw new Error(`Invalid meeting ID: "${meetingId}"`);
    }

    // Make real API call to backend
    const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        meeting_id: meetingId.toString(),
        user_id: userId,
        role: 'student',
        user_type: 'student'
      })
    });

    console.log('🔍 STUDENT API: Raw response status:', response.status);
    
    const data = await response.json();
    console.log('🔍 STUDENT API: Response data:', data);

    if (!response.ok) {
      console.error('❌ STUDENT API: Join failed with status:', response.status);
      throw new Error(data.error || `Failed to join: ${response.status}`);
    }

    // Validate response has required fields
    if (!data.token || !data.channel || !data.app_id) {
      console.error('❌ STUDENT API: Missing required fields:', {
        hasToken: !!data.token,
        hasChannel: !!data.channel,
        hasAppId: !!data.app_id,
        data
      });
      throw new Error('Server response missing required fields');
    }

    console.log('✅ STUDENT API: Join successful!', {
      meetingId: data.meeting_id,
      channel: data.channel,
      tokenLength: data.token?.length,
      appId: data.app_id,
      uid: data.uid,
      teacherPresent: data.session?.teacher_id ? '✅' : '❌'
    });

    return {
      success: true,
      meetingId: data.meeting_id,
      channel: data.channel,
      token: data.token,
      appId: data.app_id,
      uid: data.uid,
      session: data.session,
      role: 'student',
      teacher_id: data.session?.teacher_id
    };

  } catch (error) {
    console.error('❌ STUDENT API: joinVideoSession failed:', {
      error: error.message,
      meetingId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Re-throw for proper error handling in component
    throw error;
  }
},

/**
 * Smart student join - finds and joins the correct session
 */
async smartStudentJoin(classId, studentId) {
  try {
    console.log('🎓 SMART STUDENT JOIN: Finding session for class:', classId);
    
    // Step 1: Try to find active session for this class
    const sessionInfo = await this.getSessionByClassId(classId);
    
    if (sessionInfo.exists && sessionInfo.isActive) {
      console.log('✅ Found active session:', {
        meetingId: sessionInfo.meetingId,
        teacher: sessionInfo.teacher_id,
        channel: sessionInfo.channel
      });
      
      // Join the found session
      return await this.joinVideoSession(sessionInfo.meetingId, studentId, 'student');
    }
    
    // Step 2: Try common meeting ID patterns
    console.log('🔄 No session found, trying common patterns...');
    
    const commonPatterns = [
      `class_${classId}`,                     // Basic: class_123
      `class_${classId}_${classId}`,          // Duplicate
      `class_channel_${classId}`,             // Channel pattern
      `class_${classId}_live`,                // Live suffix
    ];
    
    for (const pattern of commonPatterns) {
      try {
        console.log('🔄 Trying pattern:', pattern);
        const testSession = await this.getSessionInfo(pattern);
        
        if (testSession.exists && testSession.isActive) {
          console.log('✅ Found session with pattern:', pattern);
          return await this.joinVideoSession(pattern, studentId, 'student');
        }
      } catch (error) {
        console.warn('⚠️ Pattern failed:', pattern, error.message);
        continue;
      }
    }
    
    // Step 3: Final fallback - try generic meeting ID
    const genericMeetingId = `class_${classId}`;
    console.log('🔄 Trying generic meeting ID:', genericMeetingId);
    
    try {
      return await this.joinVideoSession(genericMeetingId, studentId, 'student');
    } catch (finalError) {
      console.error('❌ All join attempts failed');
      throw new Error('No active session found for this class. Teacher needs to start the session first.');
    }
    
  } catch (error) {
    console.error('❌ SMART STUDENT JOIN failed:', error);
    throw error;
  }
},

  /**
 * Join a video session (for students) - BYPASS ALL PERMISSION CHECKS
 * Allows any student to join any session for testing
 */
async joinVideoSession(meetingId, userId, userType = 'student') {
  try {
    console.log('🎓 STUDENT API: Joining video session:', {
      meetingId,
      userId,
      userType,
      timestamp: new Date().toISOString()
    });

    // REMOVED BYPASS LOGIC - Always make real API call
    
    const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        meeting_id: meetingId,
        user_id: userId,
        user_type: userType  // Use userType parameter
      })
    });

    console.log('🔍 STUDENT API: Raw response status:', response.status);
    
    const data = await response.json();
    console.log('🔍 STUDENT API: Response data:', data);

    if (!response.ok) {
      console.error('❌ STUDENT API: Join failed with status:', response.status);
      throw new Error(data.error || `Failed to join: ${response.status}`);
    }

    // Validate response has required fields
    if (!data.token || !data.channel || !data.app_id) {
      console.error('❌ STUDENT API: Missing required fields:', {
        hasToken: !!data.token,
        hasChannel: !!data.channel,
        hasAppId: !!data.app_id,
        data
      });
      throw new Error('Server response missing required fields');
    }

    console.log('✅ STUDENT API: Join successful!', {
      meetingId: data.meeting_id,
      channel: data.channel,
      tokenLength: data.token?.length,
      appId: data.app_id,
      uid: data.uid
    });

    return {
      success: true,
      meetingId: data.meeting_id,
      channel: data.channel,
      token: data.token,
      appId: data.app_id,
      uid: data.uid,
      session: data.session,
      role: 'student',
      teacher_id: data.session?.teacher_id
    };

  } catch (error) {
    console.error('❌ STUDENT API: joinVideoSession failed:', {
      error: error.message,
      meetingId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Return error instead of mock data
    return {
      success: false,
      error: error.message,
      message: 'Failed to join video session'
    };
  }
},

/**
 * Generate Agora credentials - Helper function
 */
async generateAgoraCredentials(channelName, userId) {
  try {
    // Try to get real token from backend
    const response = await fetch(`${API_BASE_URL}/agora/generate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        channel_name: channelName,
        user_id: userId,
        role: 'student'
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        token: data.token,
        appId: data.appId,
        uid: data.uid
      };
    }
  } catch (error) {
    console.log('⚠️ Token generation failed, using null token:', error.message);
  }

  // Return null token (Agora allows this for testing)
  return {
    token: null,
    appId: process.env.AGORA_APP_ID || 'YOUR_APP_ID',
    uid: Math.floor(Math.random() * 1000000)
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
   * Get session by class ID - NEW METHOD
   * For students to find active session for their class
   */
  async getSessionByClassId(classId) {
    try {
      console.log('🔍 API: Getting session by class ID:', { classId });

      const response = await fetch(`${API_BASE_URL}/agora/session-by-class/${classId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      console.log('📊 API: Session by class response:', {
        status: response.status,
        hasSession: !!data.session,
        sessionStatus: data.session?.status,
        classIdMatch: data.session?.class_id === classId
      });

      if (!response.ok || !data.session) {
        return {
          success: false,
          exists: false,
          isActive: false,
          error: data.error || 'No active session for this class'
        };
      }

      const sessionExists = !!data.session;
      const isActive = data.session?.status === 'active';

      return {
        success: true,
        session: data.session,
        exists: sessionExists,
        isActive,
        meetingId: data.session?.meeting_id,
        channel: data.session?.channel_name,
        appId: data.session?.app_id,
        teacher_id: data.session?.teacher_id
      };

    } catch (error) {
      console.error('❌ API: getSessionByClassId failed:', error);
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


async getSessionByClassId(classId) {
  try {
    console.log('🔍 API: Getting session by class ID:', { classId });

    const response = await fetch(`${API_BASE_URL}/agora/session-by-class/${classId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();

    console.log('📊 API: Session by class response:', {
      status: response.status,
      success: data.success,
      hasSession: !!data.session,
      exists: data.exists,
      isActive: data.isActive,
      meetingId: data.meetingId,
      channel: data.channel
    });

    if (!response.ok) {
      return {
        success: false,
        exists: false,
        isActive: false,
        error: data.error || 'No active session for this class'
      };
    }

    if (!data.session) {
      return {
        success: false,
        exists: false,
        isActive: false,
        error: 'Session data missing from response'
      };
    }

    return {
      success: true,
      session: data.session,
      exists: data.exists,
      isActive: data.isActive,
      meetingId: data.meetingId || data.session.meeting_id,
      channel: data.channel || data.session.channel_name,
      appId: data.session?.app_id,
      teacher_id: data.teacher_id || data.session.teacher_id
    };

  } catch (error) {
    console.error('❌ API: getSessionByClassId failed:', error);
    return {
      success: false,
      error: error.message,
      exists: false,
      isActive: false
    };
  }
},

async getParticipantProfiles(meetingId, agoraUids) {
  try {
    console.log('📡 API: Getting profiles for UIDs:', {
      meetingId,
      uids: agoraUids
    });

    const response = await fetch(`${API_BASE_URL}/agora/get-participant-profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        meeting_id: meetingId,
        agora_uids: agoraUids
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn('⚠️ Failed to get profiles:', data.error);
      return {
        success: false,
        profiles: []
      };
    }

    console.log('✅ Retrieved profiles:', {
      count: data.profiles?.length || 0,
      teacher: data.profiles?.find(p => p.is_teacher)?.name
    });

    return {
      success: true,
      profiles: data.profiles || []
    };

  } catch (error) {
    console.error('❌ getParticipantProfiles failed:', error);
    return {
      success: false,
      profiles: []
    };
  }
},
  /**
   * Get session participants with role info - ENHANCED
   */
  async getSessionParticipants(meetingId) {
    try {
      console.log('👥 API: Getting session participants for:', meetingId);

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

      // Log participant details
      const participants = data.participants || [];
      console.log('✅ API: Retrieved session participants:', {
        count: participants.length,
        teachers: participants.filter(p => p.role === 'teacher').length,
        students: participants.filter(p => p.role === 'student').length,
        participants: participants.map(p => ({
          id: p.user_id,
          role: p.role,
          status: p.status,
          name: p.name
        }))
      });

      return participants;

    } catch (error) {
      console.error('❌ API: getSessionParticipants failed:', error);
      return [];
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

export default studentvideoApi;