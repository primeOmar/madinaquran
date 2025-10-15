// lib/agora/videoApi.js - UPDATED FOR COMPLETE INTEGRATION

const API_BASE_URL = 'https://madina-quran-backend.onrender.com/api';

const videoApi = {
  /**
   * Start a video session (for teachers)
   */
  async startVideoSession(classId, userId) {
    try {
      console.log('📡 API: Starting video session via /agora/start-session');

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
        console.error('❌ API Error:', data);
        throw new Error(data.error || 'Failed to start video session');
      }

      console.log('✅ API: Video session started:', data);

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
   * Join a video session (for students and teachers)
   */
  async joinVideoSession(meetingId, userId) {
    try {
      console.log('📡 API: Joining video session via /agora/join-session');

      const response = await fetch(`${API_BASE_URL}/agora/join-session`, {
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
        throw new Error(data.error || 'Failed to join video session');
      }

      console.log('✅ API: Joined video session:', data);

      return {
        success: true,
        meetingId: data.meeting_id || data.meetingId || meetingId,
        channel: data.channel,
        token: data.token,
        appId: data.app_id || data.appId,
        uid: data.uid || userId,
        session: data.session,
        class_title: data.class_title,
        teacher_name: data.teacher_name,
        user_role: data.user_role
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
  async leaveVideoSession(meetingId, userId) {
    try {
      console.log('📡 API: Leaving video session via /agora/leave-session');

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

      // Don't throw errors for leave - it's optional
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API: Left video session:', data);
      }

      return {
        success: true
      };

    } catch (error) {
      console.warn('⚠️ API: leaveVideoSession failed:', error);
      return {
        success: true // Always return success for leave
      };
    }
  },

  /**
   * End a video session (teacher only)
   */
  async endVideoSession(meetingId, userId) {
    try {
      console.log('📡 API: Ending video session via /agora/end-session');

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
        console.error('❌ API Error:', data);
        throw new Error(data.error || 'Failed to end video session');
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
  },

  /**
   * Generate Agora token directly
   */
  async generateToken(channelName, uid, role = 'publisher') {
    try {
      const response = await fetch(`${API_BASE_URL}/agora/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelName,
          uid,
          role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate token');
      }

      return {
        success: true,
        token: data.token,
        appId: data.appId,
        channelName: data.channelName,
        uid: data.uid
      };

    } catch (error) {
      console.error('❌ API: generateToken failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Check video service health
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/agora/health`);
      const data = await response.json();
      
      return {
        success: true,
        healthy: data.videoEnabled,
        ...data
      };
    } catch (error) {
      console.error('❌ API: checkHealth failed:', error);
      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }
};

export default videoApi;
