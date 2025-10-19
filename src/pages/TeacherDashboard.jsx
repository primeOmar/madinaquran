import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, Calendar, Clock, User, Video, Play, 
  Users, BarChart3, LogOut, Bell,
  Search, Filter, Plus, FileText, 
  FileCheck, Trash2, Share2, X,
  ChevronDown, Menu, XCircle, Mail,
  Download, Upload, MessageCircle, CheckCircle,
  Edit, Eye, Star, Award, GraduationCap
} from "lucide-react";
import { useAuth } from '../components/AuthContext';
import { teacherApi } from '../lib/teacherApi';
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

// Audio recording hook (simplified version)
const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingTime(0);
      // Simulate recording for demo
      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      setTimeout(() => {
        clearInterval(interval);
        setIsRecording(false);
        setAudioData('demo-audio-data');
      }, 5000);
    } catch (error) {
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const clearRecording = () => {
    setAudioData(null);
    setRecordingTime(0);
  };

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

export default function TeacherDashboard() {
  const { user, signOut } = useAuth(); 
  const navigate = useNavigate();
  
  // State management
  const [activeTab, setActiveTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [loading, setLoading] = useState({ 
    classes: true, 
    students: true, 
    assignments: true 
  });
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    totalClasses: 0,
    upcomingClasses: 0,
    completedClasses: 0,
    totalStudents: 0,
    totalAssignments: 0,
    pendingSubmissions: 0
  });

  // Video call state
  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [videoCallError, setVideoCallError] = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [endingSession, setEndingSession] = useState(null);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);

  // Assignment creation state
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    due_date: '',
    max_score: 100,
    class_id: '',
    for_all_students: true,
    selected_students: []
  });

  // Grading state
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeData, setGradeData] = useState({ 
    score: '', 
    feedback: '', 
    audioFeedbackData: ''
  });
  const [isGrading, setIsGrading] = useState(false);

  // Audio recorder
  const audioRecorder = useAudioRecorder();

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

      // Load submissions for grading
      await loadSubmissions();
      
      const now = new Date();
      const upcoming = classesData.filter(cls => 
        new Date(cls.scheduled_date) > now && cls.status === 'scheduled'
      );
      const completed = classesData.filter(cls => 
        cls.status === 'completed' || (new Date(cls.scheduled_date) < now && cls.status !== 'cancelled')
      );
      
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

  // Load submissions for grading
  const loadSubmissions = async () => {
    try {
      const submissionsData = await teacherApi.getSubmissions();
      setSubmissions(submissionsData);
      
      const pending = submissionsData.filter(sub => 
        !sub.grade && sub.status === 'submitted'
      );
      setPendingSubmissions(pending);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadTeacherData();
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

  // ============= VIDEO CALL INTEGRATION =============

  const handleStartVideoSession = async (classItem) => {
    try {
      console.log('🎬 Starting video session for class:', classItem.id);
      setStartingSession(classItem.id);
      setVideoCallError(null);

      if (!classItem || !classItem.id || !user || !user.id) {
        throw new Error('Missing required information to start video session');
      }

      const result = await videoApi.startVideoSession(classItem.id, user.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start video session');
      }

      setActiveVideoCall({
        meetingId: result.meetingId,
        classId: classItem.id,
        className: classItem.title,
        isTeacher: true
      });

      setShowVideoCallModal(true);
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

  const handleJoinExistingSession = async (classItem, session) => {
    try {
      if (!session.meeting_id) {
        throw new Error('Meeting ID is missing');
      }

      setActiveVideoCall({
        meetingId: session.meeting_id,
        classId: classItem.id,
        className: classItem.title,
        isTeacher: true
      });

      setShowVideoCallModal(true);
      toast.success('Rejoining class...');

    } catch (error) {
      console.error('❌ Failed to join session:', error);
      toast.error(error.message);
    }
  };

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

  const handleLeaveVideoCall = async () => {
    setActiveVideoCall(null);
    setVideoCallError(null);
    setShowVideoCallModal(false);
    await loadTeacherData();
  };

  const handleSessionEnded = async () => {
    setActiveVideoCall(null);
    setVideoCallError(null);
    setShowVideoCallModal(false);
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
      if (!newAssignment.title.trim()) {
        toast.error('Please provide a title for the assignment');
        return;
      }
      
      if (!newAssignment.due_date) {
        toast.error('Please set a due date for the assignment');
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
      
      toast.success('Assignment created successfully!');
      setShowCreateAssignment(false);
      setNewAssignment({
        title: '',
        description: '',
        due_date: '',
        max_score: 100,
        class_id: '',
        for_all_students: true,
        selected_students: []
      });
      
      await loadTeacherData();
      
    } catch (error) {
      toast.error(`Failed to create assignment: ${error.message}`);
    }
  };

  // ============= GRADING FUNCTIONS =============

  const gradeAssignment = async (submissionId, score, feedback, audioFeedbackData = '') => {
    setIsGrading(true);
    try {
      if (!score || isNaN(score) || score < 0) {
        toast.error('Please enter a valid score');
        setIsGrading(false);
        return;
      }
      
      const numericScore = parseInt(score);
      
      // Update local state
      const updatedSubmissions = submissions.map(sub => 
        sub.id === submissionId 
          ? { 
              ...sub, 
              grade: numericScore, 
              feedback,
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
      await teacherApi.gradeAssignment(submissionId, numericScore, feedback, audioFeedbackData);
      
      toast.success('Assignment graded successfully!');
      setGradingSubmission(null);
      setGradeData({ score: '', feedback: '', audioFeedbackData: '' });
      audioRecorder.clearRecording();
      
    } catch (error) {
      toast.error(`Failed to grade assignment: ${error.message}`);
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
    { icon: FileCheck, value: stats.pendingSubmissions, label: 'Pending Grading', color: 'orange' }
  ];

  // Navigation tabs
  const tabs = [
    { id: 'classes', label: 'My Classes', icon: BookOpen },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'grading', label: 'Grade Work', icon: FileCheck, badge: pendingSubmissions.length },
  ];

  // ============= COMPONENT SECTIONS =============

  const ClassesTab = ({ classes, formatDateTime }) => {
    const [deletingClass, setDeletingClass] = useState(null);

    const { upcomingClasses, completedClasses } = useMemo(() => {
      const now = new Date();
      const sortedClasses = [...classes].sort((a, b) => {
        return new Date(a.scheduled_date) - new Date(b.scheduled_date);
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
        {/* Video Call Error Display */}
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
              <button onClick={() => setVideoCallError(null)} className="text-red-400 hover:text-red-300 text-sm">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">My Classes</h3>
          <div className="text-blue-300 text-sm">
            {upcomingClasses.length} upcoming • {completedClasses.length} completed
          </div>
        </div>

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

                        {classItem.description && (
                          <p className="text-blue-300 text-lg mb-4">{classItem.description}</p>
                        )}

                        {classItem.course?.name && (
                          <div className="inline-flex items-center bg-blue-800/30 border border-blue-700/30 px-4 py-2 rounded-full">
                            <BookOpen size={16} className="mr-2 text-blue-400" />
                            <span className="text-blue-300 text-sm">{classItem.course.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col space-y-3 w-full lg:w-auto">
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
                        
                        {activeSession && (
                          <button
                            onClick={() => handleJoinExistingSession(classItem, classItem.video_sessions.find(s => s.status === 'active'))}
                            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl flex items-center justify-center text-white font-semibold"
                          >
                            <Video size={20} className="mr-3" />
                            Join Active Session
                          </button>
                        )}
                        
                        {activeSession && (
                          <>
                            <button
                              onClick={() => copyClassLink(classItem.video_sessions.find(s => s.status === 'active').meeting_id)}
                              className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl flex items-center justify-center text-white font-semibold"
                            >
                              <Share2 size={20} className="mr-3" />
                              Copy Invite Link
                            </button>
                            
                            <button
                              onClick={() => handleEndVideoSession(classItem, classItem.video_sessions.find(s => s.status === 'active'))}
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
                        <span>{studentCount} student{studentCount !== 1 ? 's' : ''} enrolled</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

  // ============= STUDENTS TAB =============

  const StudentsTab = () => {
    const [studentSearch, setStudentSearch] = useState('');

    const filteredStudents = useMemo(() => {
      if (!students || students.length === 0) return [];
      
      if (!studentSearch) return students;

      const searchLower = studentSearch.toLowerCase();
      return students.filter(student =>
        student.name?.toLowerCase().includes(searchLower) ||
        student.email?.toLowerCase().includes(searchLower)
      );
    }, [students, studentSearch]);

    const sendMessageToStudent = async (student) => {
      try {
        await teacherApi.sendNotification(student.id, {
          title: 'Message from Teacher',
          message: 'Your teacher has sent you a message.',
          type: 'info'
        });
        toast.success(`Message sent to ${student.name}`);
      } catch (error) {
        toast.error('Failed to send message');
      }
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Students Management</h3>
          <div className="text-blue-300 text-sm">
            {students.length} total students
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300" />
            <input
              type="text"
              placeholder="Search students by name or email..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Students Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <div key={student.id} className="bg-white/10 border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                    <User size={20} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{student.name}</h4>
                    <p className="text-blue-300 text-sm">{student.email}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => sendMessageToStudent(student)}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
                    title="Send Message"
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button
                    className="p-2 bg-green-600 hover:bg-green-500 rounded-lg text-white"
                    title="View Progress"
                  >
                    <BarChart3 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-300">Classes:</span>
                  <span className="text-white">{student.classes_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">Assignments:</span>
                  <span className="text-white">{student.assignments_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">Average Grade:</span>
                  <span className="text-white">{student.average_grade || 'N/A'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex space-x-2">
                  <button className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 px-3 rounded-lg text-white text-sm">
                    View Profile
                  </button>
                  <button className="flex-1 bg-purple-600 hover:bg-purple-500 py-2 px-3 rounded-lg text-white text-sm">
                    Progress
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-16">
            <Users size={64} className="mx-auto text-blue-400 mb-4 opacity-50" />
            <h3 className="text-2xl font-bold text-white mb-2">No Students Found</h3>
            <p className="text-blue-300 text-lg">
              {studentSearch ? 'No students match your search' : 'No students assigned to your classes yet'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ============= ASSIGNMENTS TAB =============

  const AssignmentsTab = () => {
    const [assignmentSearch, setAssignmentSearch] = useState('');

    const filteredAssignments = useMemo(() => {
      if (!assignments || assignments.length === 0) return [];
      
      if (!assignmentSearch) return assignments;

      const searchLower = assignmentSearch.toLowerCase();
      return assignments.filter(assignment =>
        assignment.title?.toLowerCase().includes(searchLower) ||
        assignment.description?.toLowerCase().includes(searchLower)
      );
    }, [assignments, assignmentSearch]);

    const deleteAssignment = async (assignmentId) => {
      try {
        await teacherApi.deleteAssignment(assignmentId);
        toast.success('Assignment deleted successfully');
        loadTeacherData();
      } catch (error) {
        toast.error('Failed to delete assignment');
      }
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Assignments</h3>
          <button
            onClick={() => setShowCreateAssignment(true)}
            className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg flex items-center text-white"
          >
            <Plus size={16} className="mr-2" />
            Create Assignment
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Assignments Grid */}
        <div className="grid gap-6">
          {filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="bg-white/10 border border-white/20 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-white text-xl mb-2">{assignment.title}</h4>
                  {assignment.description && (
                    <p className="text-blue-300 mb-3">{assignment.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => deleteAssignment(assignment.id)}
                    className="p-2 bg-red-600 hover:bg-red-500 rounded-lg text-white"
                    title="Delete Assignment"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
                    title="View Submissions"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center text-blue-200">
                  <Calendar size={16} className="mr-2 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium">Due: {formatDateTime(assignment.due_date)}</p>
                    <p className="text-xs text-blue-300">Due Date</p>
                  </div>
                </div>
                
                <div className="flex items-center text-blue-200">
                  <FileCheck size={16} className="mr-2 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium">{assignment.max_score} points</p>
                    <p className="text-xs text-blue-300">Max Score</p>
                  </div>
                </div>
                
                <div className="flex items-center text-blue-200">
                  <Users size={16} className="mr-2 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium">{assignment.submissions_count || 0} submissions</p>
                    <p className="text-xs text-blue-300">Submissions</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-white/20">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  assignment.status === 'active' 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                }`}>
                  {assignment.status?.toUpperCase() || 'ACTIVE'}
                </span>
                
                <div className="flex space-x-2">
                  <button className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-white text-sm">
                    View Details
                  </button>
                  <button className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded-lg text-white text-sm">
                    Grade Submissions
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAssignments.length === 0 && (
          <div className="text-center py-16">
            <FileText size={64} className="mx-auto text-blue-400 mb-4 opacity-50" />
            <h3 className="text-2xl font-bold text-white mb-2">No Assignments Found</h3>
            <p className="text-blue-300 text-lg">
              {assignmentSearch ? 'No assignments match your search' : 'Create your first assignment to get started'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ============= GRADING TAB =============

  const GradingTab = () => {
    const [activeGradingTab, setActiveGradingTab] = useState('pending');

    const submissionsToShow = activeGradingTab === 'pending' ? pendingSubmissions : submissions;

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Grade Work</h3>
          <div className="text-blue-300 text-sm">
            {pendingSubmissions.length} pending • {submissions.length} total
          </div>
        </div>

        {/* Grading Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveGradingTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeGradingTab === 'pending'
                ? 'bg-orange-600 text-white'
                : 'bg-white/10 text-blue-200 hover:text-white hover:bg-white/20'
            }`}
          >
            Pending Grading ({pendingSubmissions.length})
          </button>
          <button
            onClick={() => setActiveGradingTab('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeGradingTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-blue-200 hover:text-white hover:bg-white/20'
            }`}
          >
            All Submissions ({submissions.length})
          </button>
        </div>

        {/* Submissions List */}
        <div className="grid gap-4">
          {submissionsToShow.map((submission) => (
            <div key={submission.id} className="bg-white/10 border border-white/20 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-white text-lg mb-1">
                    {submission.assignment?.title || 'Assignment'}
                  </h4>
                  <p className="text-blue-300 text-sm mb-2">
                    Submitted by: {submission.student?.name || 'Student'}
                  </p>
                  {submission.submitted_at && (
                    <p className="text-blue-400 text-xs">
                      Submitted: {formatDateTime(submission.submitted_at)}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {submission.grade ? (
                    <div className="flex items-center space-x-2">
                      <div className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-bold">
                        {submission.grade}/{submission.assignment?.max_score || 100}
                      </div>
                      <CheckCircle size={20} className="text-green-400" />
                    </div>
                  ) : (
                    <div className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-sm font-bold">
                      PENDING
                    </div>
                  )}
                </div>
              </div>

              {submission.submission_text && (
                <div className="mb-4">
                  <p className="text-blue-200 text-sm mb-1">Submission:</p>
                  <div className="bg-blue-800/30 p-3 rounded-lg max-h-32 overflow-y-auto">
                    <p className="text-white text-sm">{submission.submission_text}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-white/20">
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setGradingSubmission(submission);
                      setGradeData({ 
                        score: submission.grade || '', 
                        feedback: submission.feedback || '',
                        audioFeedbackData: submission.audio_feedback_url || ''
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-white text-sm flex items-center"
                  >
                    {submission.grade ? <Edit size={16} className="mr-2" /> : <FileCheck size={16} className="mr-2" />}
                    {submission.grade ? 'Regrade' : 'Grade'}
                  </button>
                  
                  <button className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-white text-sm flex items-center">
                    <Eye size={16} className="mr-2" />
                    View Details
                  </button>
                </div>

                {submission.graded_at && (
                  <span className="text-blue-400 text-xs">
                    Graded: {formatDateTime(submission.graded_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {submissionsToShow.length === 0 && (
          <div className="text-center py-16">
            <FileCheck size={64} className="mx-auto text-blue-400 mb-4 opacity-50" />
            <h3 className="text-2xl font-bold text-white mb-2">
              {activeGradingTab === 'pending' ? 'No Pending Submissions' : 'No Submissions'}
            </h3>
            <p className="text-blue-300 text-lg">
              {activeGradingTab === 'pending' 
                ? 'All submissions have been graded! 🎉' 
                : 'No submissions found for your assignments'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  // Rest of the component (return statement) remains the same as your original
  // including the VideoCall modal, header, stats grid, navigation, and main content area

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 relative">
      {/* Video Call Modal */}
      {showVideoCallModal && activeVideoCall && (
        <VideoCall
          isOpen={showVideoCallModal}
          meetingId={activeVideoCall.meetingId}
          user={user}
          isTeacher={activeVideoCall.isTeacher}
          onLeave={handleLeaveVideoCall}
          onSessionEnded={handleSessionEnded}
        />
      )}

      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 relative z-50">
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
              
              <div className="relative group">
                <div className="flex items-center cursor-pointer">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-2">
                    <User size={16} />
                  </div>
                  <span className="text-white hidden md:inline">{user?.name}</span>
                  <ChevronDown size={16} className="ml-1 text-blue-200" />
                </div>
                
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  {tab.badge && tab.badge > 0 && (
                    <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-2 py-1">
                      {tab.badge}
                    </span>
                  )}
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
                {tab.badge && tab.badge > 0 && (
                  <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-2 py-1">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 md:p-6 border border-white/20">
          {/* Filters - Only show for classes tab */}
          {activeTab === 'classes' && (
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
          )}

          {/* Content based on active tab */}
          {activeTab === 'classes' && (
            <ClassesTab 
              classes={filteredClasses} 
              formatDateTime={formatDateTime}
            />
          )}

          {activeTab === 'students' && <StudentsTab />}
          {activeTab === 'assignments' && <AssignmentsTab />}
          {activeTab === 'grading' && <GradingTab />}
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
                >
                  <option value="">Select Class (Optional)</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newAssignment.for_all_students}
                  onChange={(e) => setNewAssignment({
                    ...newAssignment, 
                    for_all_students: e.target.checked,
                    selected_students: e.target.checked ? [] : newAssignment.selected_students
                  })}
                  className="mr-2"
                />
                <span className="text-blue-200 text-sm">Assign to all my students</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateAssignment(false)}
                className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createAssignment}
                disabled={!newAssignment.title || !newAssignment.due_date}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-800/50 disabled:cursor-not-allowed transition-colors"
              >
                Create Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Assignment Modal */}
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
                  Audio Feedback (Optional)
                </label>
                
                <div className="bg-blue-800/30 rounded-lg p-4 border border-blue-700/30">
                  {!gradeData.audioFeedbackData && !audioRecorder.audioData ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={audioRecorder.isRecording ? audioRecorder.stopRecording : audioRecorder.startRecording}
                          className={`p-3 rounded-full transition-all duration-200 ${
                            audioRecorder.isRecording 
                              ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
                              : 'bg-green-600 hover:bg-green-500'
                          }`}
                        >
                          {audioRecorder.isRecording ? <X size={20} /> : <Mail size={20} />}
                        </button>
                        
                        <div>
                          <div className="text-sm text-blue-300">
                            {audioRecorder.isRecording ? `Recording... ${audioRecorder.recordingTime}` : 'Record audio feedback'}
                          </div>
                          <div className="text-xs text-blue-400">
                            {audioRecorder.isRecording ? 'Click stop when finished' : 'Optional: Record detailed feedback'}
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
                            audioRecorder.clearRecording();
                            setGradeData(prev => ({...prev, audioFeedbackData: ''}));
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Re-record
                        </button>
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
                  audioRecorder.clearRecording();
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
                  gradeData.audioFeedbackData || audioRecorder.audioData
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
