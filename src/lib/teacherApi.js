import { supabase } from './supabaseClient';
const API_BASE_URL = 'https://madina-quran-backend.onrender.com';
export const teacherApi = {
  getOrCreateActiveSession: async (classId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🎯 Teacher getting or creating active session for class:', classId);

      // 1. First try to join existing session via backend
      try {
        const activeSession = await teacherApi.getActiveClassSession(classId);
        if (activeSession) {
          console.log('🔄 Found existing session, joining via backend:', activeSession.meeting_id);

          // Join via backend endpoint
          const joinResponse = await fetch(`${API_BASE_URL}/join-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              meeting_id: activeSession.meeting_id,
              user_id: user.id,
              user_type: 'teacher'
            })
          });

          const joinResult = await joinResponse.json();

          if (joinResult.success) {
            console.log('✅ Successfully joined existing session via backend');
            return {
              ...activeSession,
              agora_credentials: {
                appId: joinResult.app_id,
                channel: joinResult.channel,
                token: joinResult.token,
                uid: joinResult.uid
              },
              isNewSession: false
            };
          }
        }
      } catch (joinError) {
        console.log('⚠️ No active session to join, creating new one:', joinError.message);
      }

      // 2. Create new session via backend
      console.log('🆕 Creating new session via backend for class:', classId);
      return await teacherApi.createNewSession(classId);

    } catch (error) {
      console.error('❌ Error in getOrCreateActiveSession:', error);
      throw error;
    }
  },


  createNewSession: async (classId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🚀 Calling backend to start session...');

      // ✅ CORRECTED: Use /api/video/start-session
      const response = await fetch(`${API_BASE_URL}/api/video/start-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_id: classId,
          user_id: user.id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create session via backend');
      }

      console.log('✅ Backend session creation successful:', {
        meetingId: result.meeting_id,
        channel: result.channel,
        hasToken: !!result.token
      });

      return {
        id: result.session?.db_session_id,
        meeting_id: result.meeting_id,
        channel_name: result.channel,
        class_id: classId,
        teacher_id: user.id,
        status: 'active',
        started_at: new Date().toISOString(),
        agora_credentials: {
          appId: result.app_id || result.appId,
          channel: result.channel,
          token: result.token,
          uid: result.uid
        },
        isNewSession: true
      };

    } catch (error) {
      console.error('❌ Error creating new session via backend:', error);
      throw error;
    }
  },


generateAgoraCredentials: async (channelName, userId) => {
  try {
    console.log('🔑 Generating credentials for channel:', channelName);

    // Get teacher's Agora config
    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('agora_config')
      .eq('id', userId)
      .single();

    const appId = teacherProfile?.agora_config?.appId || 
                  import.meta.env.VITE_AGORA_APP_ID;

    if (!appId) {
      throw new Error('Agora App ID not configured');
    }

    // ✅ Generate CONSISTENT UID for teacher
    const generateTeacherUID = () => {
      const combined = `teacher_${userId}_${channelName}`;
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash) % 1000000;
    };

    const uid = generateTeacherUID();

    console.log('✅ Generated credentials:', {
      channel: channelName,
      uid: uid,
      appId: appId.substring(0, 8) + '...'
    });

    return {
      appId,
      channel: channelName, // ✅ Return exact channel name
      token: null,
      uid: uid
    };

  } catch (error) {
    console.error('❌ Error generating Agora credentials:', error);
    throw error;
  }
},

    // 🚀 CRITICAL FIX: Create AND join video session
    createAndJoinVideoSession: async (classId) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        console.log('🎥 Teacher creating and joining video session for class:', classId);

        // 1. First create the session using your existing method
        const sessionData = await teacherApi.startVideoSession(classId);

        if (!sessionData || !sessionData.meeting_id) {
          throw new Error('Failed to create video session');
        }

        console.log('✅ Session created:', sessionData.meeting_id);

        // 2. Then join the session using the videoApi
        const joinResult = await videoApi.joinVideoSession(sessionData.meeting_id, user.id);

        if (!joinResult.success) {
          throw new Error(joinResult.error || 'Failed to join video session');
        }

        console.log('✅ Teacher joined session successfully:', {
          meetingId: sessionData.meeting_id,
          channel: joinResult.channel,
          hasToken: !!joinResult.token
        });

        return {
          ...sessionData,
          agora_credentials: {
            appId: joinResult.appId,
            channel: joinResult.channel,
            token: joinResult.token,
            uid: joinResult.uid
          }
        };

      } catch (error) {
        console.error('❌ Error in createAndJoinVideoSession:', error);
        throw error;
      }
    },

    // 🚀 CRITICAL FIX: Join existing video session (for when teacher rejoins)
    joinVideoSession: async (meetingId) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        console.log('🎥 Teacher joining video session via backend:', meetingId);

        // ✅ CORRECTED: Use /api/video/join-session
        const response = await fetch(`${API_BASE_URL}/api/video/join-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meeting_id: meetingId,
            user_id: user.id,
            user_type: 'teacher',
            user_name: user.email
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to join session via backend');
        }

        console.log('✅ Backend join successful:', {
          channel: result.channel,
          uid: result.uid,
          hasToken: !!result.token
        });

        return {
          success: true,
          meetingId: result.meetingId || result.meeting_id,
          channel: result.channel,
          token: result.token,
          appId: result.appId || result.app_id,
          uid: result.uid,
          sessionInfo: {
            classTitle: result.sessionInfo?.class_title || result.session?.class_title,
            teacherName: user.email
          }
        };

      } catch (error) {
        console.error('❌ Error in teacher joinVideoSession:', error);
        throw error;
      }
    },



    checkSessionHealth: async (meetingId) => {
      try {
        console.log('🔍 Checking session health via backend:', meetingId);

        // ✅ CORRECTED: Use /api/video/session-status
        const response = await fetch(`${API_BASE_URL}/api/video/session-status/${meetingId}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        return {
          healthy: result.success && result.is_active,
          session: result.session,
          participants: result.total_participants || result.student_count || 0,
          is_teacher_joined: result.is_teacher_joined,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        console.error('❌ Error checking session health:', error);
        return {
          healthy: false,
          error: error.message,
          participants: 0
        };
      }
    },

    testVideoBackend: async () => {
      try {
        console.log('🔍 Testing video backend connection...');

        // Test health endpoint
        const healthResponse = await fetch(`${API_BASE_URL}/api/video/health`);
        const healthData = await healthResponse.json();
        console.log('🏥 Video health:', healthData);

        // Test active sessions
        const sessionsResponse = await fetch(`${API_BASE_URL}/api/video/active-sessions`);
        const sessionsData = await sessionsResponse.json();
        console.log('📊 Active sessions:', sessionsData);

        return {
          health: healthData,
          sessions: sessionsData,
          backendUrl: API_BASE_URL
        };

      } catch (error) {
        console.error('❌ Video backend test failed:', error);
        throw error;
      }
    },



    // 🚀 NEW: Get active session for a class
    getClassVideoSession: async (classId) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        console.log('🔍 Looking for active video session for class:', classId);

        const { data, error } = await supabase
        .from('video_sessions')
        .select(`
        *,
        class:classes (title, teacher_id)
        `)
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('🔍 No active session found for class:', classId);
            return null;
          }
          throw error;
        }

        // Verify teacher owns this class
        if (data.class.teacher_id !== user.id) {
          throw new Error('Unauthorized to access this video session');
        }

        console.log('✅ Found active session:', data.meeting_id);
        return data;

      } catch (error) {
        console.error('❌ Error getting class video session:', error);
        throw error;
      }
    },

    // 🚀 NEW: Get or create video session for a class
  getOrCreateActiveSession: async (classId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('🎯 Teacher getting/creating session for class:', classId);

    // 1. Check for EXISTING active session first
    const { data: existingSession, error: sessionError } = await supabase
      .from('video_sessions')
      .select(`
        *,
        class:classes (title, teacher_id)
      `)
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // 2. If session exists, JOIN IT (don't create new one!)
    if (existingSession && !sessionError) {
      console.log('🔄 Found existing session, joining:', existingSession.meeting_id);
      
      // Get Agora credentials for EXISTING channel
      const credentials = await teacherApi.generateAgoraCredentials(
        existingSession.channel_name,
        user.id
      );

      return {
        ...existingSession,
        agora_credentials: credentials,
        isNewSession: false
      };
    }

    // 3. No active session - create NEW one
    console.log('🆕 No active session, creating new one');
    
    const timestamp = Date.now();
    const meetingId = `class_${classId}_${timestamp}`;
    const channelName = `channel_${classId}_${timestamp}`; // ✅ CONSISTENT channel name

    console.log('🎯 Creating with channel:', channelName);

    // Create session in database
    const { data: newSession, error: createError } = await supabase
      .from('video_sessions')
      .insert([{
        class_id: classId,
        teacher_id: user.id,
        meeting_id: meetingId,
        channel_name: channelName, // ✅ Store channel name
        status: 'active',
        started_at: new Date().toISOString(),
        scheduled_date: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) throw createError;

    // Update class status
    await supabase
      .from('classes')
      .update({ status: 'active' })
      .eq('id', classId);

    // Generate Agora credentials
    const credentials = await teacherApi.generateAgoraCredentials(
      channelName,
      user.id
    );

    return {
      ...newSession,
      agora_credentials: credentials,
      isNewSession: true
    };

  } catch (error) {
    console.error('❌ Error in getOrCreateActiveSession:', error);
    throw error;
  }
},

    startClassVideoSession: async (classId) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        console.log('🎥 Teacher starting/joining class video session:', classId);

        // 1. First, check if there's an active session for this class
        const activeSession = await teacherApi.getActiveClassSession(classId);

        if (activeSession) {
          console.log('🔄 Found active session, joining:', activeSession.meeting_id);

          // Join the existing session
          const joinResult = await videoApi.joinVideoSession(activeSession.meeting_id, user.id);

          if (!joinResult.success) {
            throw new Error(joinResult.error || 'Failed to join existing session');
          }

          return {
            ...activeSession,
            agora_credentials: {
              appId: joinResult.appId,
              channel: joinResult.channel,
              token: joinResult.token,
              uid: joinResult.uid
            },
            isNewSession: false
          };
        }

        // 2. No active session, create a new one
        console.log('🆕 No active session found, creating new one');

        // Create session record
        const sessionData = await teacherApi.createVideoSession(classId);

        if (!sessionData || !sessionData.meeting_id) {
          throw new Error('Failed to create video session');
        }

        console.log('✅ Session created:', sessionData.meeting_id);

        // Join the newly created session
        const joinResult = await videoApi.joinVideoSession(sessionData.meeting_id, user.id);

        if (!joinResult.success) {
          // Clean up the session if join fails
          await teacherApi.endVideoSession(sessionData.id);
          throw new Error(joinResult.error || 'Failed to join new session');
        }

        console.log('✅ Teacher joined new session successfully');

        return {
          ...sessionData,
          agora_credentials: {
            appId: joinResult.appId,
            channel: joinResult.channel,
            token: joinResult.token,
            uid: joinResult.uid
          },
          isNewSession: true
        };

      } catch (error) {
        console.error('❌ Error in startClassVideoSession:', error);
        throw error;
      }
    },

    // 🚀 NEW: Get active session for a class
    getActiveClassSession: async (classId) => {
      try {
        console.log('🔍 Looking for active session for class:', classId);

        const { data: session, error } = await supabase
        .from('video_sessions')
        .select(`
        *,
        class:classes (title, teacher_id),
                teacher:teacher_id (name, email, agora_config)
                `)
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('🔍 No active session found for class:', classId);
            return null;
          }
          throw error;
        }

        console.log('✅ Found active session:', session.meeting_id);
        return session;

      } catch (error) {
        console.error('❌ Error getting active class session:', error);
        return null;
      }
    },


    checkSessionHealth: async (meetingId) => {
      try {
        console.log('🔍 Checking session health via backend:', meetingId);

        const response = await fetch(`${API_BASE_URL}/session-status/${meetingId}`);
        const result = await response.json();

        return {
          healthy: result.success && result.is_active,
          session: result.session,
          participants: result.total_participants || 0,
          is_teacher_joined: result.is_teacher_joined,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        console.error('❌ Error checking session health:', error);
        return {
          healthy: false,
          error: error.message,
          participants: 0
        };
      }
    },

    // 🆕 NEW: Debug session recovery
    debugSessionRecovery: async (meetingId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/session-recovery/${meetingId}`);
        return await response.json();
      } catch (error) {
        console.error('❌ Session recovery debug failed:', error);
        throw error;
      }
    },

    // 🚀 UPDATED: Create video session with better meeting ID
    createVideoSession: async (classId) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        // Verify teacher owns this class
        const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, title, teacher_id')
        .eq('id', classId)
        .single();

        if (classError) throw classError;

        if (classData.teacher_id !== user.id) {
          throw new Error('Unauthorized to start video session for this class');
        }

        // Generate consistent meeting ID and channel name
        const timestamp = Date.now();
        const meetingId = `class_${classId}_${timestamp}`;
        const channelName = `class_channel_${classId}_${timestamp}`;

        console.log('🎥 Creating video session with ID:', meetingId, 'Channel:', channelName);

        const { data, error } = await supabase
        .from('video_sessions')
        .insert([{
          class_id: classId,
          teacher_id: user.id,
          meeting_id: meetingId,
          channel_name: channelName,
          status: 'active',
          started_at: new Date().toISOString(),
                scheduled_date: new Date().toISOString()
        }])
        .select()
        .single();

        if (error) throw error;

        // Update class status
        await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

        console.log('✅ Video session created successfully');
        return data;

      } catch (error) {
        console.error('❌ Error creating video session:', error);
        throw error;
      }
    },

  // Get teacher's classes with related data
  getMyClasses: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          course:course_id (*),
          video_sessions (*),
          assignments (*)
        `)
        .eq('teacher_id', user.id)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  },

  // Get teacher's students
  getMyStudents: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          status,
          progress,
          attendance_rate,
          overall_score,
          completed_assignments,
          total_assignments,
          last_active,
          created_at
        `)
        .eq('teacher_id', user.id)
        .eq('role', 'student')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
  },

  // Get teacher's assignments with submissions and student info
  getMyAssignments: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          class:classes (title),
          student:student_id (name, email)
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      if (!assignments || assignments.length === 0) {
        return [];
      }

      const assignmentIds = assignments.map(a => a.id);
      const { data: submissions, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds);

      if (submissionsError) throw submissionsError;

      const assignmentsWithSubmissions = assignments.map(assignment => {
        const assignmentSubmissions = submissions?.filter(sub => sub.assignment_id === assignment.id) || [];
        
        return {
          ...assignment,
          submissions: assignmentSubmissions,
          submitted_count: assignmentSubmissions.length,
          graded_count: assignmentSubmissions.filter(s => s.grade !== null).length,
          pending_count: assignmentSubmissions.filter(s => s.grade === null).length
        };
      });

      return assignmentsWithSubmissions;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  },

  // Get all submissions for grading
  getSubmissions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // First, get the teacher's assignments
      const { data: teacherAssignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('id')
      .eq('teacher_id', user.id);

      if (assignmentsError) throw assignmentsError;

      if (!teacherAssignments || teacherAssignments.length === 0) {
        return [];
      }

      const assignmentIds = teacherAssignments.map(a => a.id);

      // Then get submissions for those assignments
      const { data, error } = await supabase
      .from('assignment_submissions')
      .select(`
      *,
      assignment:assignments (*),
              student:profiles!assignment_submissions_student_id_fkey (name, email),
              graded_by:profiles!assignment_submissions_graded_by_fkey (name)
              `)
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  },

  // Get pending submissions for grading
  getPendingSubmissions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:profiles!assignment_submissions_student_id_fkey (
            name, 
            email
          ),
          assignment:assignments!assignment_submissions_assignment_id_fkey (
            title, 
            max_score, 
            due_date,
            class:classes (title),
            teacher_id
          )
        `)
        .is('grade', null)
        .eq('assignment.teacher_id', user.id)
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pending submissions:', error);
      throw error;
    }
  },

  // Get assignments with detailed submissions
  getAssignmentsWithSubmissions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          class:classes (title),
          student:student_id (name, email),
          submissions:assignment_submissions (
            *,
            student:profiles!assignment_submissions_student_id_fkey (name, email)
          )
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching assignments with submissions:', error);
      throw error;
    }
  },

  // Get graded submissions history
  getGradedSubmissions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: submissions, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:profiles!assignment_submissions_student_id_fkey (
            id,
            name,
            email,
            overall_score
          ),
          assignment:assignments!assignment_submissions_assignment_id_fkey (
            id,
            title,
            description,
            max_score,
            due_date,
            teacher_id
          )
        `)
        .not('grade', 'is', null)
        .eq('assignment.teacher_id', user.id)
        .order('graded_at', { ascending: false });

      if (error) throw error;
      return submissions || [];
    } catch (error) {
      console.error('Error fetching graded submissions:', error);
      throw error;
    }
  },

  // Grade assignment submission
  gradeAssignment: async (submissionId, score, feedback, audioFeedbackUrl = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: submission, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select(`
          assignment:assignments!assignment_submissions_assignment_id_fkey (
            teacher_id
          )
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError) throw submissionError;

      if (!submission || submission.assignment.teacher_id !== user.id) {
        throw new Error('Submission not found or unauthorized');
      }

      const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
          grade: score,
          feedback: feedback,
          audio_feedback_url: audioFeedbackUrl,
          graded_at: new Date().toISOString(),
          graded_by: user.id,
          status: 'graded'
        })
        .eq('id', submissionId)
        .select(`
          *,
          student:student_id (name, email),
          assignment:assignment_id (title, max_score)
        `)
        .single();

      if (error) throw error;

      await teacherApi.updateStudentProgress(data.student_id);
      await teacherApi.sendGradingNotification(submissionId, score, feedback, !!audioFeedbackUrl);

      return data;
    } catch (error) {
      console.error('Error grading assignment:', error);
      throw error;
    }
  },

  // Get submission details for grading
  getSubmissionDetails: async (submissionId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:student_id (name, email),
          assignment:assignment_id (
            title, 
            max_score, 
            due_date,
            description,
            class:classes (title),
            teacher_id
          )
        `)
        .eq('id', submissionId)
        .single();

      if (error) throw error;

      if (data.assignment.teacher_id !== user.id) {
        throw new Error('Unauthorized to access this submission');
      }

      return data;
    } catch (error) {
      console.error('Error fetching submission details:', error);
      throw error;
    }
  },

  // Update student progress after grading
  updateStudentProgress: async (studentId) => {
    try {
      const { data: submissions, error } = await supabase
        .from('assignment_submissions')
        .select(`
          grade,
          assignment:assignments (max_score)
        `)
        .eq('student_id', studentId)
        .not('grade', 'is', null);

      if (error) throw error;

      if (submissions && submissions.length > 0) {
        const totalScore = submissions.reduce((sum, sub) => {
          const percentage = (sub.grade / sub.assignment.max_score) * 100;
          return sum + percentage;
        }, 0);
        
        const averageGrade = totalScore / submissions.length;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            overall_score: Math.round(averageGrade),
            completed_assignments: submissions.length,
            last_active: new Date().toISOString()
          })
          .eq('id', studentId);

        if (updateError) throw updateError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating student progress:', error);
      throw error;
    }
  },

  // Create a new assignment
  createAssignment: async (assignmentData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('assignments')
        .insert([{
          ...assignmentData,
          teacher_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select(`
          *,
          class:classes (title),
          student:student_id (name, email)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  },

  // Update an assignment
  updateAssignment: async (assignmentId, updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: assignment, error: verifyError } = await supabase
        .from('assignments')
        .select('teacher_id')
        .eq('id', assignmentId)
        .single();

      if (verifyError) throw verifyError;

      if (assignment.teacher_id !== user.id) {
        throw new Error('Unauthorized to update this assignment');
      }

      const { data, error } = await supabase
        .from('assignments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating assignment:', error);
      throw error;
    }
  },

  // Delete an assignment
  deleteAssignment: async (assignmentId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: assignment, error: verifyError } = await supabase
        .from('assignments')
        .select('teacher_id')
        .eq('id', assignmentId)
        .single();

      if (verifyError) throw verifyError;

      if (assignment.teacher_id !== user.id) {
        throw new Error('Unauthorized to delete this assignment');
      }

      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting assignment:', error);
      throw error;
    }
  },

  // Start a video session for a class
  startVideoSession: async (classId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('teacher_id')
        .eq('id', classId)
        .single();

      if (classError) throw classError;

      if (classData.teacher_id !== user.id) {
        throw new Error('Unauthorized to start video session for this class');
      }

      const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await supabase
        .from('video_sessions')
        .insert([{
          class_id: classId,
          teacher_id: user.id,
          meeting_id: meetingId,
          status: 'active',
          started_at: new Date().toISOString(),
          scheduled_date: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      
      await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

      return data;
    } catch (error) {
      console.error('Error starting video session:', error);
      throw error;
    }
  },

  // End a video session
  endVideoSession: async (sessionId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🛑 Ending video session via backend:', sessionId);

      // First get meeting_id from session ID
      const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('meeting_id')
      .eq('id', sessionId)
      .single();

      if (sessionError) {
        throw new Error('Session not found');
      }

      // ✅ CORRECTED: Use /api/video/end-session
      const response = await fetch(`${API_BASE_URL}/api/video/end-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meeting_id: session.meeting_id,
          user_id: user.id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to end session via backend');
      }

      console.log('✅ Session ended successfully via backend');
      return result;

    } catch (error) {
      console.error('❌ Error ending video session:', error);
      throw error;
    }
  },


  // Get teacher's video sessions
  getMyVideoSessions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          class:classes (title)
        `)
        .eq('teacher_id', user.id)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching video sessions:', error);
      throw error;
    }
  },

  // Get teacher dashboard statistics
  getDashboardStats: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const [
        { count: classesCount },
        { count: studentsCount },
        { count: assignmentsCount },
        { data: pendingSubmissions }
      ] = await Promise.all([
        supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id)
          .eq('status', 'active'),
        
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id)
          .eq('role', 'student')
          .eq('status', 'active'),
        
        supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id),
        
        supabase
          .from('assignment_submissions')
          .select(`
            *,
            assignment:assignments!assignment_submissions_assignment_id_fkey (teacher_id)
          `)
          .is('grade', null)
          .eq('assignment.teacher_id', user.id)
      ]);

      return {
        classes: classesCount || 0,
        students: studentsCount || 0,
        assignments: assignmentsCount || 0,
        pending_grading: pendingSubmissions?.length || 0
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  // Send notification to student
  sendNotification: async (studentId, notificationData) => {
    try {
      console.log('🔔 [NOTIFICATION] Starting sendNotification:', {
        studentId,
        notificationData
      });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Teacher not authenticated');
      }

      if (!studentId) {
        console.error('🔔 [NOTIFICATION] Missing studentId');
        throw new Error('Student ID is required');
      }

      if (!notificationData?.title || !notificationData?.message) {
        console.error('🔔 [NOTIFICATION] Missing title or message');
        throw new Error('Notification title and message are required');
      }

      const { data: studentProfile, error: studentError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', studentId)
        .single();

      console.log('🔔 [NOTIFICATION] Student verification result:', {
        studentExists: !!studentProfile,
        studentError: studentError?.message,
        studentName: studentProfile?.name,
        studentEmail: studentProfile?.email
      });

      if (studentError) {
        console.error('🔔 [NOTIFICATION] Student query error:', studentError);
        if (studentError.code === 'PGRST116') {
          throw new Error(`Student with ID ${studentId} not found in profiles table`);
        }
        throw studentError;
      }

      if (!studentProfile) {
        throw new Error(`Student profile not found for ID: ${studentId}`);
      }

      const notificationPayload = {
        user_id: studentId,
        title: notificationData.title.trim(),
        message: notificationData.message.trim(),
        type: notificationData.type || 'info',
        data: notificationData.data || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('🔔 [NOTIFICATION] Inserting notification:', notificationPayload);

      const { data, error } = await supabase
        .from('notifications')
        .insert([notificationPayload])
        .select()
        .single();

      if (error) {
        console.error('🔔 [NOTIFICATION] Supabase insert error:', error);
        throw error;
      }
      
      console.log('🔔 [NOTIFICATION] Insert successful:', data);
      return data;
    } catch (error) {
      console.error('🔔 [NOTIFICATION] Overall error:', error);
      throw error;
    }
  },

  // Send grading notification specifically
  sendGradingNotification: async (submissionId, score, feedback, hasAudioFeedback = false) => {
    try {
      console.log('🔔 [NOTIFICATION] Starting grading notification for submission:', submissionId);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Teacher not authenticated');
      }

      const { data: submission, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          assignment:assignments(
            title,
            max_score,
            description
          ),
          student:profiles!assignment_submissions_student_id_fkey(
            id,
            name,
            email
          )
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError || !submission) {
        console.error('🔔 [NOTIFICATION] Submission not found:', submissionError);
        throw new Error('Submission not found');
      }

      console.log('🔔 [NOTIFICATION] Submission details:', {
        submissionId: submission.id,
        studentId: submission.student_id,
        student: submission.student,
        assignment: submission.assignment
      });

      if (!submission.student || !submission.student.id) {
        throw new Error('Student profile not found for this submission');
      }

      const studentId = submission.student.id;
      const assignmentTitle = submission.assignment?.title || 'Assignment';
      const maxScore = submission.assignment?.max_score || 100;
      const percentage = Math.round((score / maxScore) * 100);
      
      let gradeEmoji = '📊';
      if (percentage >= 90) gradeEmoji = '🎉';
      else if (percentage >= 80) gradeEmoji = '👍';
      else if (percentage >= 70) gradeEmoji = '📝';
      else gradeEmoji = '💪';

      const notificationData = {
        user_id: studentId,
        title: `${gradeEmoji} Assignment Graded: ${assignmentTitle}`,
        message: `Your assignment "${assignmentTitle}" has been graded. You scored ${score}/${maxScore} (${percentage}%).${feedback ? ' Teacher provided feedback.' : ''}${hasAudioFeedback ? ' Includes audio feedback.' : ''}`,
        type: 'success',
        data: {
          submission_id: submissionId,
          assignment_title: assignmentTitle,
          score: score,
          max_score: maxScore,
          percentage: percentage,
          has_feedback: !!feedback,
          has_audio_feedback: hasAudioFeedback,
          graded_at: new Date().toISOString(),
          action_url: `/assignments/${submissionId}`,
          assignment_id: submission.assignment_id
        }
      };

      console.log('🔔 [NOTIFICATION] Sending grading notification:', notificationData);

      const result = await teacherApi.sendNotification(studentId, notificationData);
      console.log('🔔 [NOTIFICATION] Grading notification sent successfully:', result);
      return result;

    } catch (error) {
      console.error('🔔 [NOTIFICATION] Error sending grading notification:', error);
      throw error;
    }
  },

  // Debug function to test notification system
  testNotificationSystem: async () => {
    try {
      console.log('🧪 [DEBUG] Testing notification system...');
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🧪 [DEBUG] Current user:', user);

      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'student')
        .limit(1);

      if (studentsError || !students || students.length === 0) {
        console.error('🧪 [DEBUG] No students found');
        return { success: false, error: 'No students found' };
      }

      const testStudent = students[0];
      console.log('🧪 [DEBUG] Test student:', testStudent);

      const testNotification = {
        title: '🧪 Test Notification',
        message: 'This is a test notification from the debug system.',
        type: 'info',
        data: {
          test: true,
          debug_time: new Date().toISOString(),
          student_name: testStudent.name
        }
      };

      console.log('🧪 [DEBUG] Testing with notification:', testNotification);

      const result = await teacherApi.sendNotification(testStudent.id, testNotification);
      
      console.log('🧪 [DEBUG] Test notification created:', result);

      await supabase
        .from('notifications')
        .delete()
        .eq('id', result.id);

      console.log('🧪 [DEBUG] Test completed successfully');
      return { 
        success: true, 
        data: result
      };

    } catch (error) {
      console.error('🧪 [DEBUG] Test failed:', error);
      return { success: false, error: error.message };
    }
  }
};

export default teacherApi;
