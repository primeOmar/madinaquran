// lib/agora/videoApi.js - PRODUCTION READY

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const videoApi = {
  /**
   * Start a video session (for teachers)
   * @param {string|number} classId - The class ID
   * @param {string|number} userId - The user ID
   */
  async startVideoSession(classId, userId) {
    try {
      console.log('📡 API: Starting video session:', { classId, userId });

      // Validate inputs
      if (!classId || !userId) {
        console.error('❌ Missing required parameters:', { classId, userId });
        throw new Error('CLASS_ID_AND_USER_ID_REQUIRED');
      }

      const response = await fetch(`${API_BASE_URL}/video/start-session`, {
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
        console.error('❌ API Error:', data);
        throw new Error(data.error || data.message || 'Failed to start video session');
      }

      console.log('✅ API: Video session started:', data);

      return {
        success: true,
        meetingId: data.meeting_id || data.meetingId,
        channel: data.channel,
        token: data.token,
        appId: data.app_id || data.appId,
        uid: data.uid || userId
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
   * Join a video session (for students and teachers)
   * @param {string} meetingId - The meeting ID
   * @param {string|number} userId - The user ID
   */
  async joinVideoSession(meetingId, userId) {
    try {
      console.log('📡 API: Joining video session:', { meetingId, userId });

      // Validate inputs
      if (!meetingId || !userId) {
        console.error('❌ Missing required parameters:', { meetingId, userId });
        throw new Error('MEETING_ID_AND_USER_ID_REQUIRED');
      }

      const response = await fetch(`${API_BASE_URL}/video/join-session`, {
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
        console.error('❌ API Error:', data);
        throw new Error(data.error || data.message || 'Failed to join video session');
      }

      console.log('✅ API: Joined video session:', data);

      return {
        success: true,
        meetingId: data.meeting_id || data.meetingId || meetingId,
        channel: data.channel,
        token: data.token,
        appId: data.app_id || data.appId,
        uid: data.uid || userId
      };

    } catch (error) {
      console.error('❌ API: joinVideoSession failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to join video session'
      };
    }
  },

  /**
   * Leave a video session
   */
  async leaveVideoSession() {
    try {
      console.log('📡 API: Leaving video session');

      const response = await fetch(`${API_BASE_URL}/video/leave-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        console.warn('⚠️ API: Leave session warning:', data);
        // Don't throw - leaving should always succeed on client side
      }

      console.log('✅ API: Left video session');

      return {
        success: true
      };

    } catch (error) {
      console.warn('⚠️ API: leaveVideoSession failed:', error);
      // Return success anyway - client-side cleanup is what matters
      return {
        success: true
      };
    }
  },

  /**
   * End a video session (teacher only)
   * @param {string} meetingId - The meeting ID
   */
  async endVideoSession(meetingId) {
    try {
      console.log('📡 API: Ending video session:', meetingId);

      if (!meetingId) {
        throw new Error('MEETING_ID_REQUIRED');
      }

      const response = await fetch(`${API_BASE_URL}/video/end-session`, {
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
        console.error('❌ API Error:', data);
        throw new Error(data.error || data.message || 'Failed to end video session');
      }

      console.log('✅ API: Video session ended:', data);

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ API: endVideoSession failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to end video session'
      };
    }
  },

  /**
   * Get active video sessions
   */
  async getActiveSessions() {
    try {
      const response = await fetch(`${API_BASE_URL}/video/active-sessions`, {
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
