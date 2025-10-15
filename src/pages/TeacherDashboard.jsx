import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, Calendar, Clock, User, Video, Play, Eye, 
  Users, BarChart3, Home, Settings, LogOut, Bell,
  Search, Filter, Plus, MessageCircle, FileText, 
  FileCheck, FileEdit, GraduationCap, Award, CheckCircle, 
  XCircle, Edit, Trash2, Download, Upload, Send, Share2,
  ChevronDown, Menu, X, Mic, Square, RefreshCw
} from "lucide-react";
import { useAuth } from '../components/AuthContext';
import { teacherApi } from '../lib/supabaseClient';
import videoApi from '../lib/agora/videoApi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom'; 
import VideoCall from '../components/VideoCall';

// Format time utility function
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Enhanced Safe Audio Player Component
const SafeAudioPlayer = ({ src, className = "" }) => {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const processAudioSource = async () => {
      if (!src) {
        setError(true);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(false);

        let processedUrl = src;
        if (src.startsWith('https://') && src.includes('supabase.co')) {
          const separator = src.includes('?') ? '&' : '?';
          processedUrl = `${src}${separator}t=${Date.now()}`;
        }

        setAudioUrl(processedUrl);
      } catch (err) {
        setError(true);
        setIsLoading(false);
      }
    };

    processAudioSource();
  }, [src, retryCount]);

  const handleAudioError = () => {
    setError(true);
    setIsLoading(false);
  };

  const handleAudioCanPlay = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleRetry = () => {
    setError(false);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    
    if (audioRef.current) {
      setTimeout(() => {
        audioRef.current.load();
      }, 100);
    }
  };

  if (error || !audioUrl) {
    return (
      <div className={`bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-center ${className}`}>
        <div className="flex flex-col items-center space-y-2">
          <XCircle size={24} className="text-red-400" />
          <p className="text-red-300 text-sm">Audio playback unavailable</p>
          <button
            onClick={handleRetry}
            className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-xs mt-2 flex items-center"
          >
            <RefreshCw size={12} className="mr-1" />
            Retry Playback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-800/20 rounded-lg z-10 backdrop-blur-sm">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            <span className="text-blue-300 text-sm">Loading audio...</span>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        controls
        className="w-full rounded-lg bg-blue-800/20"
        preload="metadata"
        onError={handleAudioError}
        onCanPlay={handleAudioCanPlay}
        crossOrigin="anonymous"
      >
        <source src={audioUrl} type="audio/webm" />
        <source src={audioUrl} type="audio/mp4" />
        <source src={audioUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

// Audio recording hook
const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      const options = { 
        audioBitsPerSecond: 128000,
        mimeType: 'audio/webm;codecs=opus' 
      };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { 
            type: mediaRecorderRef.current.mimeType || 'audio/webm'
          });
          
          const dataUrl = await blobToBase64(blob);
          setAudioData(dataUrl);
          
          stream.getTracks().forEach(track => track.stop());
          
        } catch (error) {
          toast.error('Failed to process audio recording');
        }
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access.');
      } else {
        toast.error('Failed to access microphone');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const clearRecording = () => {
    setAudioData(null);
    setRecordingTime(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    audioData,
    recordingTime: formatTime(recordingTime),
    startRecording,
    stopRecording,
    clearRecording,
    hasRecording: !!audioData
  };
};

// Helper function to convert blob to base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export default function TeacherDashboard() {
  const { user, signOut } = useAuth(); 
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [completedClasses, setCompletedClasses] = useState([]);
  const [isGrading, setIsGrading] = useState(false);
  const [loading, setLoading] = useState({ 
    classes: true, 
    students: true, 
    assignments: true 
  });
  const [submissions, setSubmissions] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [activeGradingTab, setActiveGradingTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [assignmentCreated, setAssignmentCreated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    totalClasses: 0,
    upcomingClasses: 0,
    completedClasses: 0,
    totalStudents: 0,
    totalAssignments: 0,
    pendingSubmissions: 0
  });
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    due_date: '',
    max_score: 100,
    class_id: '',
    for_all_students: true,
    selected_students: [] 
  });
  
  const [gradeData, setGradeData] = useState({ 
    score: '', 
    feedback: '', 
    audioFeedbackData: ''
  });

  // Video call state - UPDATED INTEGRATION
  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [videoCallError, setVideoCallError] = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [endingSession, setEndingSession] = useState(null);

  // Audio recorder hook
  const {
    isRecording: audioIsRecording,
    audioData,
    recordingTime: audioRecordingTime,
    startRecording,
    stopRecording,
    clearRecording,
    hasRecording
  } = useAudioRecorder();

  const [recordingInterval, setRecordingInterval] = useState(null);

  useEffect(() => {
    return () => {
      if (recordingInterval) {
        clearInterval(recordingInterval);
      }
    };
  }, [recordingInterval]);

  // Monitor authentication state
  useEffect(() => {
    if (!user) {
      navigate('/teacher-login');
    }
  }, [user, navigate]);

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/teacher-login');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  // Load submissions
  const loadSubmissions = async () => {
    try {
      const assignmentsData = await teacherApi.getMyAssignments();
      
      const allSubmissions = assignmentsData.flatMap(assignment => 
        (assignment.submissions || []).map(submission => ({
          ...submission,
          assignment_title: assignment.title,
          assignment_max_score: assignment.max_score,
          assignment_due_date: assignment.due_date,
          assignment: assignment 
        }))
      );
      
      const pendingData = allSubmissions.filter(submission => {
        const grade = submission.grade;
        return grade === null || grade === undefined || grade === '' || isNaN(Number(grade));
      });
      
      setSubmissions(allSubmissions);
      setPendingSubmissions(pendingData);
      
      setStats(prev => ({
        ...prev,
        pendingSubmissions: pendingData.length
      }));
      
    } catch (error) {
      toast.error('Failed to load submissions');
    }
  };

  useEffect(() => {
    if (user) {
      loadSubmissions();
    }
  }, [user]);

  // Filter classes based on filters
  const filteredClasses = useMemo(() => {
    if (!classes || classes.length === 0) return [];
    
    let result = [...classes];

    if (filters.status) {
      result = result.filter(cls => cls.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(cls => 
        cls.title?.toLowerCase().includes(searchLower) ||
        (cls.course?.name?.toLowerCase().includes(searchLower)) ||
        cls.status?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [classes, filters]);

  // Load teacher data
  const loadTeacherData = async () => {
    try {
      setLoading({ classes: true, students: true, assignments: true });
      
      const classesData = await teacherApi.getMyClasses();
      setClasses(classesData);
      
      const studentsData = await teacherApi.getMyStudents();
      setStudents(studentsData);
      
      const assignmentsData = await teacherApi.getMyAssignments();
      setAssignments(assignmentsData);
      
      await loadSubmissions();
      
      const now = new Date();
      const upcoming = classesData.filter(cls => 
        new Date(cls.scheduled_date) > now && cls.status === 'scheduled'
      );
      const completed = classesData.filter(cls => 
        cls.status === 'completed' || (new Date(cls.scheduled_date) < now && cls.status !== 'cancelled')
      );
      
      setUpcomingClasses(upcoming);
      setCompletedClasses(completed);
      
      setStats({
        totalClasses: classesData.length,
        upcomingClasses: upcoming.length,
        completedClasses: completed.length,
        totalStudents: studentsData.length,
        totalAssignments: assignmentsData.length,
        pendingSubmissions: pendingSubmissions.length
      });
      
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading({ classes: false, students: false, assignments: false });
    }
  };

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user]);

  // ============= VIDEO CALL INTEGRATION - UPDATED =============

  /**
   * Start video session (Teacher clicks "Start Video Class")
   */
  const handleStartVideoSession = async (classItem) => {
    try {
      console.log('🎬 Starting video session for class:', classItem.id);
      setStartingSession(classItem.id);
      setVideoCallError(null);

      // Validate required data
      if (!classItem) {
        throw new Error('Class information is missing');
      }

      if (!classItem.id) {
        throw new Error('Class ID is missing');
      }

      if (!user) {
        throw new Error('User not loaded. Please refresh the page.');
      }

      if (!user.id) {
        throw new Error('User ID is missing. Please log in again.');
      }

      console.log('✅ Validation passed:', {
        classId: classItem.id,
        className: classItem.title,
        userId: user.id,
        userName: user.name
      });

      // Call backend API to start session
      const result = await videoApi.startVideoSession(classItem.id, user.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start video session');
      }

      console.log('✅ Video session started:', result);

      // Set active video call - this will render the VideoCall component
      setActiveVideoCall({
        meetingId: result.meetingId,
        classId: classItem.id,
        className: classItem.title,
        isTeacher: true
      });

      toast.success(`Starting ${classItem.title}...`);

    } catch (error) {
      console.error('❌ Video session start failed:', error);
      
      const errorMessage = error.message || 'Failed to start video session';
      setVideoCallError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setStartingSession(null);
    }
  };

  /**
   * Join existing video session (if session already started)
   */
  const handleJoinExistingSession = async (classItem, session) => {
    try {
      console.log('🔗 Joining existing session:', {
        classId: classItem.id,
        meetingId: session.meeting_id
      });

      if (!session.meeting_id) {
        throw new Error('Meeting ID is missing');
      }

      setActiveVideoCall({
        meetingId: session.meeting_id,
        classId: classItem.id,
        className: classItem.title,
        isTeacher: true
      });

      toast.success('Rejoining class...');

    } catch (error) {
      console.error('❌ Failed to join session:', error);
      toast.error(error.message);
    }
  };

  /**
   * End video session
   */
  const handleEndVideoSession = async (classItem, session) => {
    try {
      setEndingSession(classItem.id);
      
      await videoApi.endVideoSession(session.meeting_id);
      
      toast.success('Class session ended!');
      
    } catch (error) {
      toast.error('Failed to end session');
    } finally {
      setEndingSession(null);
    }
  };

  /**
   * Leave video call
   */
  const handleLeaveVideoCall = async () => {
    console.log('👋 Leaving video call');
    setActiveVideoCall(null);
    setVideoCallError(null);
    
    // Reload classes to update status
    await loadTeacherData();
  };

  /**
   * Session ended by teacher
   */
  const handleSessionEnded = async () => {
    console.log('🏁 Session ended by teacher');
    setActiveVideoCall(null);
    setVideoCallError(null);
    
    // Reload classes
    await loadTeacherData();
    toast.success('Class session ended successfully!');
  };

  // Utility functions for video sessions
  const canStartVideo = (classItem) => {
    const classTime = new Date(classItem.scheduled_date);
    const now = new Date();
    const timeDiff = classTime - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    return classItem.status === 'scheduled' && hoursDiff > -2;
  };

  const hasActiveSession = (classItem) => {
    return classItem.video_sessions?.some(s => s.status === 'active');
  };

  const copyClassLink = (meetingId) => {
    const link = `${window.location.origin}/join-class/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Class link copied!');
  };

  // ============= ASSIGNMENT FUNCTIONS =============

  const createAssignment = async () => {
    try {
      setIsCreatingAssignment(true);
      
      if (!newAssignment.title.trim()) {
        toast.error('Please provide a title for the assignment');
        setIsCreatingAssignment(false);
        return;
      }
      
      if (!newAssignment.due_date) {
        toast.error('Please set a due date for the assignment');
        setIsCreatingAssignment(false);
        return;
      }

      if (!newAssignment.for_all_students && newAssignment.selected_students.length === 0) {
        toast.error('Please select at least one student');
        setIsCreatingAssignment(false);
        return;
      }

      const assignmentData = {
        title: newAssignment.title,
        description: newAssignment.description,
        due_date: newAssignment.due_date,
        max_score: newAssignment.max_score,
        class_id: newAssignment.class_id || null,
        for_all_students: newAssignment.for_all_students,
        student_ids: newAssignment.for_all_students ? 'all' : newAssignment.selected_students
      };

      await teacherApi.createAssignment(assignmentData);
      
      setAssignmentCreated(true);
      
      setTimeout(() => {
        setShowCreateAssignment(false);
        setAssignmentCreated(false);
        setIsCreatingAssignment(false);
        
        setNewAssignment({
          title: '',
          description: '',
          due_date: '',
          max_score: 100,
          class_id: '',
          class_filter: '',
          for_all_students: true,
          selected_students: []
        });
        
        loadAssignments();
        
      }, 2000);

    } catch (error) {
      setIsCreatingAssignment(false);
      
      if (error.message.includes('No valid students')) {
        toast.error('No students are assigned to you yet. Please contact administration.');
      } else if (error.message.includes('token') || error.message.includes('Unauthorized')) {
        toast.error('Session expired. Please log in again.');
        setTimeout(() => navigate('/teacher-login'), 2000);
      } else {
        toast.error(`Failed to create assignment: ${error.message}`);
      }
    }
  };

  const loadAssignments = async () => {
    try {
      const assignmentsData = await teacherApi.getMyAssignments();
      setAssignments(assignmentsData);
    } catch (error) {
      // Silent fail for assignments load
    }
  };

  const getAllStudentsForTeacher = () => {
    return students.map(student => {
      const studentClasses = classes.filter(cls => 
        cls.students_classes?.some(sc => sc.student_id === student.id)
      );
      
      return {
        id: student.id,
        name: student.name,
        classes: studentClasses,
        class_name: studentClasses.length > 0 
          ? studentClasses.map(c => c.title).join(', ') 
          : 'Not assigned to any class'
      };
    });
  };

  const getFilteredStudents = () => {
    const allStudents = getAllStudentsForTeacher();
    
    if (!newAssignment.class_filter) {
      return allStudents;
    }
    
    return allStudents.filter(student => 
      student.classes.some(cls => cls.id === newAssignment.class_filter)
    );
  };

  const handleStudentSelection = (studentId) => {
    setNewAssignment(prev => {
      const isSelected = prev.selected_students.includes(studentId);
      return {
        ...prev,
        selected_students: isSelected
          ? prev.selected_students.filter(id => id !== studentId)
          : [...prev.selected_students, studentId]
      };
    });
  };

  // Grade assignment function
  const gradeAssignment = async (submissionId, score, feedback, audioFeedbackData = '') => {
    setIsGrading(true);
    try {
      if (!score || isNaN(score) || score < 0) {
        toast.error('Please enter a valid score');
        setIsGrading(false);
        return;
      }
      
      const numericScore = parseInt(score);
      const submissionToGrade = submissions.find(s => s.id === submissionId) || 
                              pendingSubmissions.find(s => s.id === submissionId);
      
      if (!submissionToGrade) {
        toast.error('Submission not found');
        setIsGrading(false);
        return;
      }

      let finalAudioFeedbackUrl = '';

      if (audioFeedbackData && audioFeedbackData.startsWith('data:audio/')) {
        try {
          if (typeof teacherApi.uploadAudioFeedback !== 'function') {
            finalAudioFeedbackUrl = audioFeedbackData;
          } else {
            const response = await fetch(audioFeedbackData);
            if (!response.ok) {
              throw new Error('Failed to fetch audio data');
            }
            
            const audioBlob = await response.blob();
            const audioFile = new File([audioBlob], `feedback-${submissionId}-${Date.now()}.webm`, {
              type: 'audio/webm'
            });
            
            finalAudioFeedbackUrl = await teacherApi.uploadAudioFeedback(audioFile, submissionId);
          }
        } catch (uploadError) {
          toast.warning('Audio feedback could not be saved, but written feedback was submitted.');
          finalAudioFeedbackUrl = '';
        }
      } else if (audioFeedbackData && audioFeedbackData.startsWith('https://')) {
        finalAudioFeedbackUrl = audioFeedbackData;
      }

      // Update local state
      const updatedSubmissions = submissions.map(sub => 
        sub.id === submissionId 
          ? { 
              ...sub, 
              grade: numericScore, 
              feedback, 
              audio_feedback_url: finalAudioFeedbackUrl,
              graded_at: new Date().toISOString()
            }
          : sub
      );

      const updatedPending = pendingSubmissions.filter(sub => sub.id !== submissionId);

      setSubmissions(updatedSubmissions);
      setPendingSubmissions(updatedPending);
      
      setStats(prev => ({
        ...prev,
        pendingSubmissions: updatedPending.length
      }));
      
      // Call API to grade assignment
      await teacherApi.gradeAssignment(submissionId, numericScore, feedback, finalAudioFeedbackUrl);
      
      // Update student progress
      if (submissionToGrade.student_id) {
        await teacherApi.updateStudentProgress(submissionToGrade.student_id);
      }
      
      // Send notification to student
      try {
        const assignmentTitle = submissionToGrade.assignment?.title || submissionToGrade.assignment_title || 'Assignment';
        const maxScore = submissionToGrade.assignment?.max_score || submissionToGrade.assignment_max_score || 100;
        
        await teacherApi.sendNotification(submissionToGrade.student_id, {
          title: 'Assignment Graded 📝',
          message: `Your assignment "${assignmentTitle}" has been graded. You scored ${numericScore}/${maxScore}.${feedback ? ' Teacher left feedback.' : ''}`,
          type: 'success',
          data: {
            submission_id: submissionId,
            assignment_title: assignmentTitle,
            score: numericScore,
            max_score: maxScore,
            has_feedback: !!feedback,
            has_audio_feedback: !!finalAudioFeedbackUrl,
            graded_at: new Date().toISOString(),
            action_url: `/assignments/${submissionId}`
          }
        });
      } catch (notificationError) {
        toast.warning('Assignment graded, but failed to send notification to student.');
      }
      
      toast.success('Assignment graded successfully!');
      setGradingSubmission(null);
      setSelectedSubmission(null);
      setGradeData({ score: '', feedback: '', audioFeedbackData: '' });
      clearRecording();
      
    } catch (error) {
      toast.error(`Failed to grade assignment: ${error.message}`);
      await loadSubmissions();
    } finally {
      setIsGrading(false);
    }
  };

  // Utility functions
  const formatDateTime = (dateString) => {
    if (!dateString) return "Not scheduled";
    
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Stats grid data
  const statsGrid = [
    { icon: BookOpen, value: stats.totalClasses, label: 'Total Classes', color: 'blue' },
    { icon: Calendar, value: stats.upcomingClasses, label: 'Upcoming', color: 'green' },
    { icon: BarChart3, value: stats.completedClasses, label: 'Completed', color: 'purple' },
    { icon: Users, value: stats.totalStudents, label: 'Students', color: 'yellow' },
    { icon: FileText, value: stats.totalAssignments, label: 'Assignments', color: 'indigo' },
    { icon: FileCheck, value: stats.pendingSubmissions, label: 'Pending Grading', color: 'orange', highlight: stats.pendingSubmissions > 0 }
  ];

  // Navigation tabs
  const tabs = [
    { id: 'classes', label: 'My Classes', icon: BookOpen },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'grading', label: 'Grade Work', icon: FileCheck, badge: pendingSubmissions.length },
    { id: 'upcoming', label: 'Upcoming', icon: Calendar },
    { id: 'completed', label: 'Completed', icon: BarChart3 }
  ];

  // ============= COMPONENT SECTIONS =============

  const ClassesTab = ({ classes, formatDateTime }) => {
    const [deletingClass, setDeletingClass] = useState(null);

    // Sort and filter classes
    const { upcomingClasses, completedClasses } = useMemo(() => {
      const now = new Date();
      
      const sortedClasses = [...classes].sort((a, b) => {
        const dateA = new Date(a.scheduled_date);
        const dateB = new Date(b.scheduled_date);
        return dateA - dateB;
      });

      const upcoming = sortedClasses.filter(cls => {
        const classTime = new Date(cls.scheduled_date);
        const timeDiff = classTime - now;
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        return hoursDiff > -2 && cls.status === 'scheduled';
      });

      const completed = sortedClasses.filter(cls => {
        const classTime = new Date(cls.scheduled_date);
        const timeDiff = classTime - now;
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        return hoursDiff <= -2 || cls.status === 'completed';
      });

      return { upcomingClasses: upcoming, completedClasses: completed };
    }, [classes]);

    // Delete class
    const handleDeleteClass = async (classId) => {
      try {
        setDeletingClass(classId);
        await teacherApi.deleteClass(classId);
        toast.success('Class deleted successfully');
        loadTeacherData();
      } catch (error) {
        toast.error('Failed to delete class');
      } finally {
        setDeletingClass(null);
      }
    };

    return (
      <div>
        {/* Video Call Modal */}
        {activeVideoCall && (
          <VideoCall
            meetingId={activeVideoCall.meetingId}
            user={user}
            isTeacher={activeVideoCall.isTeacher}
            onLeave={handleLeaveVideoCall}
            onSessionEnded={handleSessionEnded}
          />
        )}

        {/* Error Display */}
        {videoCallError && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <XCircle size={20} className="text-red-400 mr-3" />
                <div>
                  <p className="text-red-300 font-medium">Video Session Error</p>
                  <p className="text-red-400 text-sm">{videoCallError}</p>
                </div>
              </div>
              <button
                onClick={() => setVideoCallError(null)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">My Classes</h3>
          <div className="text-blue-300 text-sm">
            {upcomingClasses.length} upcoming • {completedClasses.length} completed
          </div>
        </div>

        {/* Upcoming Classes */}
        {upcomingClasses.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-white mb-4">Upcoming Classes</h4>
            <div className="grid gap-6">
              {upcomingClasses.map((classItem) => {
                const activeSession = hasActiveSession(classItem);
                const studentCount = classItem.students_classes?.length || 0;
                const canStart = canStartVideo(classItem);
                const isStarting = startingSession === classItem.id;
                const isEnding = endingSession === classItem.id;
                const isDeleting = deletingClass === classItem.id;

                return (
                  <div key={classItem.id} className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-white/20 rounded-xl p-6">
                    
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                      
                      {/* Class Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-bold text-2xl text-white">{classItem.title}</h4>
                          {activeSession && (
                            <div className="flex items-center space-x-2 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full">
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="text-red-300 text-sm font-medium">LIVE</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center text-blue-200">
                            <Calendar size={18} className="mr-3 text-blue-400" />
                            <div>
                              <p className="text-sm font-medium">{formatDateTime(classItem.scheduled_date)}</p>
                              <p className="text-xs text-blue-300">Scheduled Time</p>
                            </div>
                          </div>
                          
                          {classItem.duration && (
                            <div className="flex items-center text-blue-200">
                              <Clock size={18} className="mr-3 text-blue-400" />
                              <div>
                                <p className="text-sm font-medium">{classItem.duration} minutes</p>
                                <p className="text-xs text-blue-300">Duration</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center text-blue-200">
                            <Users size={18} className="mr-3 text-blue-400" />
                            <div>
                              <p className="text-sm font-medium">{studentCount} students</p>
                              <p className="text-xs text-blue-300">Enrolled</p>
                            </div>
                          </div>
                        </div>

                        {/* Class Description */}
                        {classItem.description && (
                          <p className="text-blue-300 text-lg mb-4">{classItem.description}</p>
                        )}

                        {/* Course Name */}
                        {classItem.course?.name && (
                          <div className="inline-flex items-center bg-blue-800/30 border border-blue-700/30 px-4 py-2 rounded-full">
                            <BookOpen size={16} className="mr-2 text-blue-400" />
                            <span className="text-blue-300 text-sm">{classItem.course.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col space-y-3 w-full lg:w-auto">
                        {/* Start Session Button - Only show if class can start */}
                        {canStart && !activeSession && (
                          <button
                            onClick={() => handleStartVideoSession(classItem)}
                            disabled={isStarting}
                            className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-xl flex items-center justify-center text-white font-semibold disabled:opacity-50"
                          >
                            {isStarting ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                Starting...
                              </>
                            ) : (
                              <>
                                <Play size={20} className="mr-3" />
                                Start Video Class
                              </>
                            )}
                          </button>
                        )}
                        
                        {/* Join Active Session Button */}
                        {activeSession && (
                          <button
                            onClick={() => handleJoinExistingSession(
                              classItem, 
                              classItem.video_sessions.find(s => s.status === 'active')
                            )}
                            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl flex items-center justify-center text-white font-semibold"
                          >
                            <Video size={20} className="mr-3" />
                            Join Active Session
                          </button>
                        )}
                        
                        {/* Active Session Buttons */}
                        {activeSession && (
                          <>
                            <button
                              onClick={() => copyClassLink(
                                classItem.video_sessions.find(s => s.status === 'active').meeting_id
                              )}
                              className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl flex items-center justify-center text-white font-semibold"
                            >
                              <Share2 size={20} className="mr-3" />
                              Copy Invite Link
                            </button>
                            
                            <button
                              onClick={() => handleEndVideoSession(
                                classItem, 
                                classItem.video_sessions.find(s => s.status === 'active')
                              )}
                              disabled={isEnding}
                              className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl flex items-center justify-center text-white font-semibold disabled:opacity-50"
                            >
                              {isEnding ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                  Ending...
                                </>
                              ) : (
                                <>
                                  <X size={20} className="mr-3" />
                                  End Class Session
                                </>
                              )}
                            </button>
                          </>
                        )}

                        {/* Delete Class Button */}
                        <button
                          onClick={() => handleDeleteClass(classItem.id)}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-white flex items-center justify-center disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 size={16} className="mr-2" />
                              Delete Class
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Status Footer */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-6 pt-4 border-t border-white/10">
                      <div className="flex items-center space-x-4 text-sm mb-3 md:mb-0">
                        <span className={`px-4 py-2 rounded-full text-xs font-bold ${
                          classItem.status === "scheduled" 
                            ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" 
                            : classItem.status === "active"
                            ? "bg-green-500/20 text-green-300 border border-green-500/30"
                            : classItem.status === "completed"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}>
                          {classItem.status?.toUpperCase()}
                        </span>
                        
                        {activeSession && (
                          <span className="flex items-center text-green-400 text-sm">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                            Session active
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-blue-300 text-sm">
                        <User size={14} />
                        <span>
                          {studentCount} student{studentCount !== 1 ? 's' : ''} enrolled
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Classes */}
        {completedClasses.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Completed Classes</h4>
            <div className="grid gap-4">
              {completedClasses.map((classItem) => (
                <div key={classItem.id} className="bg-white/10 border border-white/20 rounded-lg p-4">
                  <h4 className="font-bold text-white">{classItem.title}</h4>
                  <p className="text-blue-300 text-sm">{formatDateTime(classItem.scheduled_date)}</p>
                  <p className="text-blue-200 text-sm">Students: {classItem.students_classes?.length || 0}</p>
                  <div className="mt-3 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs inline-block">
                    COMPLETED
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Classes */}
        {classes.length === 0 && (
          <div className="text-center py-16">
            <BookOpen size={64} className="mx-auto text-blue-400 mb-4 opacity-50" />
            <h3 className="text-2xl font-bold text-white mb-2">No Classes Scheduled</h3>
            <p className="text-blue-300 text-lg">You don't have any classes scheduled yet.</p>
          </div>
        )}
      </div>
    );
  };

  // [Rest of the component code remains the same - StudentsTab, AssignmentsTab, GradingTab, etc.]
  // ... (Include all the other tab components exactly as they were)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 relative">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 relative z-[10000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button 
                className="md:hidden text-white mr-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <BookOpen className="h-8 w-8 text-blue-400 mr-3" />
              <h1 className="text-xl md:text-2xl font-bold text-white">Teacher Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="p-2 text-blue-200 hover:text-white">
                <Bell size={20} />
              </button>
              
              <div className="relative group" style={{ isolation: 'isolate', zIndex: 10000 }}>
                <div className="flex items-center cursor-pointer">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-2">
                    <User size={16} />
                  </div>
                  <span className="text-white hidden md:inline">{user?.name}</span>
                  <ChevronDown size={16} className="ml-1 text-blue-200" />
                </div>
                
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
                  style={{ zIndex: 10001 }}
                >
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    <LogOut size={16} className="mr-2" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statsGrid.map((stat, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="flex items-center">
                <stat.icon className={`h-6 w-6 text-${stat.color}-400 mr-3`} />
                <div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-blue-200 text-sm">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Navigation Tabs */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
            <nav className="flex flex-col space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <tab.icon size={16} className="mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:block bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
          <nav className="flex space-x-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon size={16} className="mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 md:p-6 border border-white/20">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({ status: '', search: '' })}
                className="w-full bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center justify-center text-white"
              >
                <Filter size={16} className="mr-2" />
                Clear Filters
              </button>
            </div>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'classes' && (
            <ClassesTab 
              classes={filteredClasses} 
              formatDateTime={formatDateTime}
            />
          )}

          {activeTab === 'students' && (
            <StudentsTab students={students} loading={loading.students} />
          )}

          {activeTab === 'assignments' && (
            <AssignmentsTab 
              assignments={assignments} 
              showCreateModal={showCreateAssignment}
              setShowCreateModal={setShowCreateAssignment}
              loading={loading.assignments}
            />
          )}

          {activeTab === 'grading' && (
            <GradingTab 
              submissions={submissions}
              pendingSubmissions={pendingSubmissions}
              onGradeAssignment={gradeAssignment}
              onStartGrading={(submission) => {
                setGradingSubmission(submission);
                setGradeData({ 
                  score: submission.score || '', 
                  feedback: submission.feedback || '',
                  audioFeedbackData: submission.audio_feedback_url || ''
                });
              }}
              activeTab={activeGradingTab}
              setActiveTab={setActiveGradingTab}
            />
          )}

          {activeTab === 'upcoming' && (
            <UpcomingTab classes={upcomingClasses} formatDateTime={formatDateTime} />
          )}

          {activeTab === 'completed' && (
            <CompletedTab classes={completedClasses} formatDateTime={formatDateTime} />
          )}
        </div>
      </div>

      {/* Create Assignment Modal */}
      {showCreateAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-white">Create New Assignment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Title *</label>
                <input
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                  placeholder="Assignment title"
                  required
                  disabled={isCreatingAssignment}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Description</label>
                <textarea
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                  rows="3"
                  placeholder="Assignment description"
                  disabled={isCreatingAssignment}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Due Date *</label>
                <input
                  type="datetime-local"
                  value={newAssignment.due_date}
                  onChange={(e) => setNewAssignment({...newAssignment, due_date: e.target.value})}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                  required
                  disabled={isCreatingAssignment}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Max Score</label>
                <input
                  type="number"
                  value={newAssignment.max_score}
                  onChange={(e) => setNewAssignment({...newAssignment, max_score: parseInt(e.target.value) || 100})}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                  min="1"
                  max="100"
                  disabled={isCreatingAssignment}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Class (Optional)
                </label>
                <select
                  value={newAssignment.class_id}
                  onChange={(e) => setNewAssignment({...newAssignment, class_id: e.target.value})}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                  disabled={isCreatingAssignment}
                >
                  <option value="">Select Class (Optional)</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.title}</option>
                  ))}
                </select>
                <p className="text-blue-300 text-xs mt-1">Optional: Categorize assignment by class</p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newAssignment.for_all_students}
                  onChange={(e) => {
                    setNewAssignment({
                      ...newAssignment, 
                      for_all_students: e.target.checked,
                      selected_students: e.target.checked ? [] : newAssignment.selected_students
                    });
                  }}
                  className="mr-2"
                  disabled={isCreatingAssignment}
                />
                <span className="text-blue-200 text-sm">Assign to all my students</span>
              </div>

              {!newAssignment.for_all_students && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Select Students *
                  </label>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-blue-200 mb-1">Filter by Class (Optional)</label>
                    <select
                      value={newAssignment.class_filter || ""}
                      onChange={(e) => setNewAssignment({...newAssignment, class_filter: e.target.value})}
                      className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                      disabled={isCreatingAssignment}
                    >
                      <option value="">All Classes</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.title}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto bg-blue-800/30 rounded-lg p-2 border border-blue-700/30">
                    {getFilteredStudents().length > 0 ? (
                      <>
                        <div className="text-blue-300 text-xs mb-2">
                          Showing {getFilteredStudents().length} student(s)
                          {newAssignment.class_filter && ` in selected class`}
                        </div>
                        
                        {getFilteredStudents().map(student => (
                          <label key={student.id} className="flex items-center p-2 hover:bg-blue-700/30 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newAssignment.selected_students.includes(student.id)}
                              onChange={() => handleStudentSelection(student.id)}
                              className="mr-3 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                              disabled={isCreatingAssignment}
                            />
                            <div>
                              <span className="text-blue-200 block">{student.name}</span>
                              <span className="text-blue-400 text-xs block">
                                Class: {student.class_name || 'Not assigned'}
                              </span>
                            </div>
                          </label>
                        ))}
                      </>
                    ) : (
                      <p className="text-blue-300 text-sm p-2">
                        {students.length === 0 
                          ? 'No students assigned to you yet' 
                          : 'No students match the current filter'
                        }
                      </p>
                    )}
                  </div>
                  
                  {newAssignment.selected_students.length === 0 && (
                    <p className="text-red-300 text-xs mt-1">Please select at least one student</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateAssignment(false)}
                className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50 text-white transition-colors disabled:opacity-50"
                disabled={isCreatingAssignment}
              >
                Cancel
              </button>
              <button
                onClick={createAssignment}
                disabled={
                  (!newAssignment.for_all_students && newAssignment.selected_students.length === 0) ||
                  isCreatingAssignment
                }
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-800/50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[80px]"
              >
                {isCreatingAssignment ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </div>
                ) : (
                  'Create'
                )}
              </button>
            </div>

            {assignmentCreated && (
              <div className="absolute inset-0 bg-green-900/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2">Assignment Created!</h4>
                  <p className="text-green-200">
                    {newAssignment.for_all_students 
                      ? `Sent to all ${students.length} students assigned to you` 
                      : `Sent to ${newAssignment.selected_students.length} student(s)`
                    }
                  </p>
                  {newAssignment.class_id && (
                    <p className="text-green-300 text-sm mt-1">
                      Categorized under: {classes.find(c => c.id === newAssignment.class_id)?.title}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setAssignmentCreated(false);
                      setShowCreateAssignment(false); 
                    }}
                    className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grade Assignment Modal with Audio Recording */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-white">Grade Assignment</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-blue-800/30 rounded-lg">
              <div>
                <p className="text-blue-200 text-sm">Student</p>
                <p className="text-white font-medium">{gradingSubmission.student?.name || 'Unknown Student'}</p>
                <p className="text-blue-300 text-xs">{gradingSubmission.student?.email}</p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">Assignment</p>
                <p className="text-white font-medium">{gradingSubmission.assignment?.title}</p>
                <p className="text-blue-300 text-xs">
                  Max Score: {gradingSubmission.assignment?.max_score}
                </p>
              </div>
            </div>

            {gradingSubmission.audio_url && (
              <div className="mb-6">
                <p className="text-blue-200 text-sm font-medium mb-2">Student's Audio Submission:</p>
                <SafeAudioPlayer src={gradingSubmission.audio_url} />
              </div>
            )}

            {gradingSubmission.submission_text && (
              <div className="mb-6">
                <p className="text-blue-200 text-sm font-medium mb-2">Written Submission:</p>
                <div className="bg-blue-800/30 p-4 rounded-lg max-h-32 overflow-y-auto">
                  <p className="text-white text-sm">{gradingSubmission.submission_text}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Score * (Max: {gradingSubmission.assignment?.max_score || 100})
                </label>
                <input
                  type="number"
                  value={gradeData.score}
                  onChange={(e) => setGradeData({...gradeData, score: e.target.value})}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                  min="0"
                  max={gradingSubmission.assignment?.max_score || 100}
                  placeholder="Enter score"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Written Feedback</label>
                <textarea
                  value={gradeData.feedback}
                  onChange={(e) => setGradeData({...gradeData, feedback: e.target.value})}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
                  rows="4"
                  placeholder="Provide written feedback to the student..."
                />
              </div>

              <div className="border-t border-blue-700/30 pt-4">
                <label className="block text-sm font-medium text-blue-200 mb-3">
                  Audio Feedback (Record corrections or detailed feedback)
                </label>
                
                <div className="bg-blue-800/30 rounded-lg p-4 border border-blue-700/30">
                  {!gradeData.audioFeedbackData && !audioData ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={async () => {
                              if (audioIsRecording) {
                                stopRecording();
                                setTimeout(() => {
                                  setGradeData(prev => ({
                                    ...prev, 
                                    audioFeedbackData: audioData
                                  }));
                                }, 500);
                                
                                if (recordingInterval) {
                                  clearInterval(recordingInterval);
                                  setRecordingInterval(null);
                                }
                              } else {
                                await startRecording();
                                
                                const interval = setInterval(() => {
                                  // Minimal state update for recording time
                                }, 1000);
                                
                                setRecordingInterval(interval);
                              }
                            }}
                            className={`p-3 rounded-full transition-all duration-200 ${
                              audioIsRecording 
                                ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
                                : 'bg-green-600 hover:bg-green-500'
                            }`}
                          >
                            {audioIsRecording ? <Square size={20} /> : <Mic size={20} />}
                          </button>
                          
                          <div>
                            <div className="text-sm text-blue-300">
                              {audioIsRecording ? `Recording... ${audioRecordingTime}` : 'Click to record audio feedback'}
                            </div>
                            <div className="text-xs text-blue-400">
                              {audioIsRecording ? 'Click stop when finished' : 'Record pronunciation corrections or detailed feedback'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-green-400 text-sm font-medium">✅ Audio feedback recorded</span>
                        <button
                          onClick={() => {
                            clearRecording();
                            setGradeData(prev => ({...prev, audioFeedbackData: ''}));
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Re-record
                        </button>
                      </div>
                      
                      <div className="bg-blue-900/50 p-3 rounded-lg">
                        <SafeAudioPlayer src={gradeData.audioFeedbackData || audioData} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setGradingSubmission(null);
                  setGradeData({ score: '', feedback: '', audioFeedbackData: '' });
                  clearRecording();
                  if (recordingInterval) {
                    clearInterval(recordingInterval);
                    setRecordingInterval(null);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50 text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => gradeAssignment(
                  gradingSubmission.id, 
                  parseInt(gradeData.score), 
                  gradeData.feedback,
                  gradeData.audioFeedbackData || audioData
                )}
                disabled={!gradeData.score || isNaN(parseInt(gradeData.score)) || isGrading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-800/50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isGrading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Grading...
                  </>
                ) : (
                  'Submit Grade & Feedback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
