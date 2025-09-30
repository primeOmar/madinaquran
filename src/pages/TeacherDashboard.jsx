import { useState, useEffect, useMemo, react, useRef} from 'react';
import { 
  BookOpen, Calendar, Clock, User, Video, Play, Eye, 
  Users, BarChart3, Home, Settings, LogOut, Bell,
  Search, Filter, Plus, MessageCircle, FileText, 
  FileCheck, FileEdit, GraduationCap, Award, CheckCircle, 
  XCircle, Edit, Trash2, Download, Upload, Send,
  ChevronDown, Menu, X, Mic, Square
} from "lucide-react";
import { useAuth } from '../components/AuthContext';
import { teacherApi } from '../lib/supabaseClient';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom'; 
// Audio recording hook for teacher feedback
const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Microphone access denied. Please allow microphone access to record audio feedback.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setAudioUrl('');
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [audioUrl]);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    recordingTime: formatTime(recordingTime),
    startRecording,
    stopRecording,
    clearRecording,
    hasRecording: !!audioBlob
  };
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
  const [notifications, setNotifications] = useState([]);
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
  
  // Monitor authentication state
  useEffect(() => {
    if (!user) {
      navigate('/teacher-login');
    }
  }, [user, navigate]);

  // Add logout function
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/teacher-login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  useEffect(() => {
    if (user) {
      loadSubmissions();
    }
  }, [user]);

  const loadSubmissions = async () => {
    try {
      const assignmentsData = await teacherApi.getMyAssignments();
      
      const allSubmissions = assignmentsData.flatMap(assignment => 
        (assignment.submissions || []).map(submission => ({
          ...submission,
          assignment_title: assignment.title,
          assignment_max_score: assignment.max_score,
          assignment_due_date: assignment.due_date
        }))
      );
      
      const pendingData = allSubmissions.filter(submission => 
        submission.grade === null || submission.grade === undefined
      );
      
      setSubmissions(allSubmissions);
      setPendingSubmissions(pendingData);
      
      setStats(prev => ({
        ...prev,
        pendingSubmissions: pendingData.length
      }));
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    }
  };

const [gradeData, setGradeData] = useState({ 
  score: '', 
  feedback: '', 
  audioFeedbackUrl: '',
  isRecording: false,
  recordingTime: 0,
  audioBlob: null
});

// audio recorder hook
const {
  isRecording: audioIsRecording,
  audioBlob,
  audioUrl,
  recordingTime: audioRecordingTime,
  startRecording,
  stopRecording,
  clearRecording,
  hasRecording
} = useAudioRecorder();

const [recordingInterval, setRecordingInterval] = useState(null);
  
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
  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user]);

  const loadTeacherData = async () => {
    try {
      setLoading({ classes: true, students: true, assignments: true });
      
      const classesData = await teacherApi.getMyClasses();
      setClasses(classesData);
      
      const studentsData = await teacherApi.getMyStudents();
      setStudents(studentsData);
      
      const assignmentsData = await teacherApi.getMyAssignments();
      setAssignments(assignmentsData);
      
      const pendingSubmissionsCount = assignmentsData.reduce((sum, assignment) => 
        sum + (assignment.pending_count || 0), 0
      );
      
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
        pendingSubmissions: pendingSubmissionsCount
      });
      
    } catch (error) {
      console.error('Error loading teacher data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading({ classes: false, students: false, assignments: false });
    }
  };
  const startVideoSession = async (classId) => {
    try {
      const session = await teacherApi.startVideoSession(classId);
      toast.success('Video session started!');
      window.open(`/video-call/${session.meeting_id}`, '_blank');
    } catch (error) {
      toast.error(`Failed to start session: ${error.message}`);
    }
  };

  const joinVideoSession = (meetingId) => {
    window.open(`/video-call/${meetingId}`, '_blank');
  };

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
        toast.error('No students are assigned to you yet. Please contact administration to assign students to your account.');
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
      console.error('Error loading assignments:', error);
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

  const gradeAssignment = async (submissionId, score, feedback, audioFeedbackUrl = '') => {
  try {
    if (!score || isNaN(score) || score < 0) {
      toast.error('Please enter a valid score');
      return;
    }
    
    // Ensure score is a number
    const numericScore = parseInt(score);
    
    await teacherApi.gradeAssignment(submissionId, numericScore, feedback, audioFeedbackUrl);
    
    // Find the submission to update progress
    const submission = submissions.find(s => s.id === submissionId) || 
                      pendingSubmissions.find(s => s.id === submissionId);
    
    if (submission && submission.student_id) {
      await teacherApi.updateStudentProgress(submission.student_id);
    }
    
    toast.success('Assignment graded successfully!');
    setGradingSubmission(null);
    setSelectedSubmission(null);
    setGradeData({ score: '', feedback: '', audioFeedbackUrl: '' });
    
    // Reload data
    await loadSubmissions();
    await loadTeacherData();
  } catch (error) {
    console.error('Grading error:', error);
    toast.error(`Failed to grade assignment: ${error.message}`);
  }
};

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

  if (loading.classes) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-blue-200">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

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

  // Tab Components
  const ClassesTab = ({ classes, onStartSession, onJoinSession, formatDateTime }) => (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">My Classes</h3>
      {classes.length > 0 ? (
        <div className="grid gap-4">
          {classes.map((classItem) => (
            <ClassCard 
              key={classItem.id} 
              classItem={classItem} 
              onStartSession={onStartSession}
              onJoinSession={onJoinSession}
              formatDateTime={formatDateTime}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto text-blue-400 mb-3" />
          <p className="text-blue-200">No classes found</p>
        </div>
      )}
    </div>
  );

  const ClassCard = ({ classItem, onStartSession, onJoinSession, formatDateTime }) => (
    <div className="bg-white/10 border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex-1">
          <h4 className="font-bold text-lg text-white">{classItem.title}</h4>
          <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center mt-2 text-sm text-blue-200 space-y-2 md:space-y-0 md:space-x-4">
            <span className="flex items-center">
              <Calendar size={14} className="mr-1" />
              {formatDateTime(classItem.scheduled_date)}
            </span>
            {classItem.duration && (
              <span className="flex items-center">
                <Clock size={14} className="mr-1" />
                {classItem.duration} minutes
              </span>
            )}
            {classItem.course?.name && (
              <span className="flex items-center">
                <BookOpen size={14} className="mr-1" />
                {classItem.course.name}
              </span>
            )}
          </div>
          {classItem.description && (
            <p className="text-blue-300 text-sm mt-2">{classItem.description}</p>
          )}
        </div>
        <div className="flex space-x-2 self-end md:self-auto">
          {classItem.status === 'scheduled' && (
            <button
              onClick={() => onStartSession(classItem.id)}
              className="p-2 rounded-lg bg-green-600 hover:bg-green-500 flex items-center text-white"
              title="Start Video Session"
            >
              <Play size={16} />
            </button>
          )}
          {classItem.status === 'active' && classItem.video_sessions?.[0] && (
            <button
              onClick={() => onJoinSession(classItem.video_sessions[0].meeting_id)}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center text-white"
              title="Join Video Session"
            >
              <Eye size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <span className="text-sm text-blue-300">
          Students: {classItem.students_classes?.length || 0}
          {classItem.max_students && ` / ${classItem.max_students}`}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          classItem.status === "scheduled" 
            ? "bg-yellow-500/20 text-yellow-300" 
            : classItem.status === "active"
            ? "bg-green-500/20 text-green-300"
            : classItem.status === "completed"
            ? "bg-blue-500/20 text-blue-300"
            : "bg-red-500/20 text-red-300"
        }`}>
          {classItem.status?.toUpperCase()}
        </span>
      </div>
    </div>
  );

  const StudentsTab = ({ students, loading }) => (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">My Students ({students.length})</h3>
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-blue-200 mt-2">Loading students...</p>
        </div>
      ) : students.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <div key={student.id} className="bg-white/10 border border-white/20 rounded-lg p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                  <User size={16} />
                </div>
                <div>
                  <p className="font-medium text-white">{student.name}</p>
                  <p className="text-blue-400 text-xs">Joined: {new Date(student.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="mt-3 flex space-x-2">
                <button className="flex-1 bg-blue-600 hover:bg-blue-500 py-1 px-2 rounded text-sm text-white">
                  <MessageCircle size={14} className="inline mr-1" />
                  Message
                </button>
                <button className="flex-1 bg-green-600 hover:bg-green-500 py-1 px-2 rounded text-sm text-white">
                  <FileText size={14} className="inline mr-1" />
                  Progress
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-blue-400 mb-3" />
          <p className="text-blue-200">No students enrolled yet</p>
        </div>
      )}
    </div>
  );

  const AssignmentCard = ({ assignment, onGrade, onStartGrading }) => {
    const totalSubmissions = assignment.submissions?.length || 0;
    const gradedSubmissions = assignment.submissions?.filter(s => s.grade !== null && s.grade !== undefined).length || 0;
    const pendingSubmissions = totalSubmissions - gradedSubmissions;

    return (
      <div className="bg-white/10 border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <h4 className="font-bold text-lg text-white">{assignment.title}</h4>
            <p className="text-blue-300 text-sm mt-1">{assignment.description}</p>
            
            <div className="flex flex-wrap items-center mt-3 text-sm text-blue-200 gap-4">
              <span className="flex items-center">
                <Calendar size={14} className="mr-1" />
                Due: {new Date(assignment.due_date).toLocaleDateString()}
              </span>
              <span className="flex items-center">
                <Award size={14} className="mr-1" />
                Max Score: {assignment.max_score}
              </span>
              <span className="flex items-center">
                <Users size={14} className="mr-1" />
                Students: {assignment.student_count || 0}
              </span>
              {assignment.class?.title && (  
                <span className="flex items-center">
                  <BookOpen size={14} className="mr-1" />
                  Class: {assignment.class.title}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 self-end md:self-auto">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              new Date(assignment.due_date) < new Date() && pendingSubmissions > 0
                ? "bg-red-500/20 text-red-300"
                : "bg-green-500/20 text-green-300"
            }`}>
              {new Date(assignment.due_date) < new Date() && pendingSubmissions > 0
                ? "OVERDUE"
                : "ON TIME"
              }
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{totalSubmissions}</p>
            <p className="text-blue-300">Submitted</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{gradedSubmissions}</p>
            <p className="text-blue-300">Graded</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{pendingSubmissions}</p>
            <p className="text-blue-300">Pending</p>
          </div>
        </div>

        {assignment.submissions && assignment.submissions.length > 0 && (
          <div className="mt-4">
            <h5 className="font-semibold text-blue-200 mb-2">Submissions:</h5>
            <div className="space-y-2">
              {assignment.submissions.map((submission) => (
                <div key={submission.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-2 bg-white/5 rounded gap-2">
                  <div>
                    <p className="text-white text-sm">{submission.student_name}</p>
                    <p className="text-blue-300 text-xs">
                      {submission.submitted_at 
                        ? `Submitted: ${new Date(submission.submitted_at).toLocaleDateString()}`
                        : 'Not submitted'
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {submission.grade !== null ? (
                      <span className="text-green-400 text-sm">
                        Score: {submission.grade}/{assignment.max_score}
                      </span>
                    ) : (
                      <button
                        onClick={() => onStartGrading(submission)}
                        className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm text-white"
                      >
                        Grade
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const AssignmentsTab = ({ 
    assignments, 
    classes, 
    onCreateAssignment, 
    onGradeAssignment, 
    showCreateModal, 
    setShowCreateModal, 
    newAssignment, 
    setNewAssignment,
    loading,
    gradingSubmission,
    setGradingSubmission,
    gradeData,
    setGradeData
  }) => {
    const [currentAssignmentIndex, setCurrentAssignmentIndex] = useState(0);

    const nextAssignment = () => {
      setCurrentAssignmentIndex(prev => 
        prev < assignments.length - 1 ? prev + 1 : 0
      );
    };

    const prevAssignment = () => {
      setCurrentAssignmentIndex(prev => 
        prev > 0 ? prev - 1 : assignments.length - 1
      );
    };

    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-blue-200 mt-2">Loading assignments...</p>
        </div>
      );
    }

    return (
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-lg font-semibold text-white">Assignments ({assignments.length})</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center text-white w-full md:w-auto justify-center"
          >
            <Plus size={16} className="mr-2" />
            New Assignment
          </button>
        </div>

        {assignments.length > 0 ? (
          <div className="relative">
            {assignments.length > 1 && (
              <>
                <button
                  onClick={prevAssignment}
                  className="hidden md:flex absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-6 bg-blue-600 hover:bg-blue-500 p-3 rounded-full text-white z-10"
                  aria-label="Previous assignment"
                >
                  <ChevronDown size={20} className="transform rotate-90" />
                </button>
                <button
                  onClick={nextAssignment}
                  className="hidden md:flex absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-6 bg-blue-600 hover:bg-blue-500 p-3 rounded-full text-white z-10"
                  aria-label="Next assignment"
                >
                  <ChevronDown size={20} className="transform -rotate-90" />
                </button>
              </>
            )}

            <div className="bg-white/10 border border-white/20 rounded-lg p-6 mb-4">
              <AssignmentCard 
                key={assignments[currentAssignmentIndex].id} 
                assignment={assignments[currentAssignmentIndex]} 
                onGrade={onGradeAssignment}
                onStartGrading={(submission) => {
                  setGradingSubmission(submission);
                  setGradeData({ score: submission.score || '', feedback: submission.feedback || '' });
                }}
              />
            </div>

            {assignments.length > 1 && (
              <div className="flex items-center justify-center space-x-4 mt-4">
                <button
                  onClick={prevAssignment}
                  className="md:hidden bg-blue-600 hover:bg-blue-500 p-2 rounded-full text-white"
                  aria-label="Previous assignment"
                >
                  <ChevronDown size={16} className="transform rotate-90" />
                </button>
                
                <div className="flex space-x-2">
                  {assignments.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentAssignmentIndex(index)}
                      className={`w-3 h-3 rounded-full ${
                        index === currentAssignmentIndex 
                          ? 'bg-blue-400' 
                          : 'bg-blue-600/50 hover:bg-blue-500'
                      }`}
                      aria-label={`Go to assignment ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={nextAssignment}
                  className="md:hidden bg-blue-600 hover:bg-blue-500 p-2 rounded-full text-white"
                  aria-label="Next assignment"
                >
                  <ChevronDown size={16} className="transform -rotate-90" />
                </button>

                <span className="text-blue-300 text-sm ml-4">
                  {currentAssignmentIndex + 1} of {assignments.length}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-blue-400 mb-3" />
            <p className="text-blue-200">No assignments created yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg text-white"
            >
              Create Your First Assignment
            </button>
          </div>
        )}
      </div>
    );
  };

  const PendingSubmissions = ({ submissions, onStartGrading, onViewSubmission }) => {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileCheck size={48} className="mx-auto text-green-400 mb-3" />
        <p className="text-blue-200">No pending submissions to grade</p>
        <p className="text-blue-300 text-sm mt-1">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        // Safely get student name with multiple fallbacks
        const studentName = submission.student?.name || submission.student_name || submission.students?.name || 'Unknown Student';
        const studentEmail = submission.student?.email || submission.student_email || '';
        const assignmentTitle = submission.assignment?.title || submission.assignment_title || 'Unknown Assignment';
        const maxScore = submission.assignment?.max_score || submission.assignment_max_score || 100;
        const dueDate = submission.assignment?.due_date || submission.assignment_due_date;

        return (
          <div key={submission.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 hover:bg-yellow-500/15 transition-colors">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <User size={16} className="text-yellow-400 mr-2" />
                  <h4 className="font-semibold text-white">{studentName}</h4>
                  {studentEmail && (
                    <span className="ml-3 text-yellow-300 text-sm bg-yellow-500/20 px-2 py-1 rounded">
                      {studentEmail}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-blue-200">Assignment: <span className="text-white">{assignmentTitle}</span></p>
                    <p className="text-blue-200">Due: <span className="text-white">
                      {dueDate ? new Date(dueDate).toLocaleDateString() : 'No due date'}
                    </span></p>
                  </div>
                  <div>
                    <p className="text-blue-200">Submitted: <span className="text-white">
                      {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : 'Not submitted'}
                    </span></p>
                    <p className="text-blue-200">Max Score: <span className="text-white">{maxScore}</span></p>
                  </div>
                </div>

                {submission.submission_text && (
                  <div className="mt-3 p-3 bg-black/20 rounded">
                    <p className="text-blue-200 text-sm font-medium mb-1">Submission:</p>
                    <p className="text-white text-sm line-clamp-2">{submission.submission_text}</p>
                  </div>
                )}

               {submission.audio_url && (
  <div className="mt-4">
    <p className="text-blue-200 text-sm font-medium mb-2">Audio Submission:</p>
    
    {/* Debug Info */}
    <div className="bg-blue-800/30 p-3 rounded mb-3 text-xs">
      <p className="text-blue-300 mb-1">Audio File Info:</p>
      <p className="text-white break-all mb-2">URL: {submission.audio_url}</p>
      
      <div className="flex space-x-2">
        <button
          onClick={async () => {
            console.log('🔍 Testing audio URL access:', submission.audio_url);
            try {
              // Test with HEAD request first
              const headResponse = await fetch(submission.audio_url, { 
                method: 'HEAD',
                mode: 'no-cors'
              });
              
              console.log('📡 HEAD request completed');
              
              // Then try GET request
              const getResponse = await fetch(submission.audio_url);
              console.log('✅ GET request status:', getResponse.status, getResponse.statusText);
              
              if (!getResponse.ok) {
                throw new Error(`HTTP ${getResponse.status}: ${getResponse.statusText}`);
              }
              
              const blob = await getResponse.blob();
              console.log('🎵 Audio blob details:', {
                size: blob.size,
                type: blob.type,
                url: URL.createObjectURL(blob)
              });
              
              if (blob.size === 0) {
                toast.error('Audio file is empty (0 bytes)');
              } else {
                toast.success(`✅ Audio accessible: ${(blob.size / 1024).toFixed(1)}KB`);
                
                // Test playback
                const testAudio = new Audio(URL.createObjectURL(blob));
                testAudio.oncanplay = () => {
                  console.log('🔊 Audio can play successfully');
                  toast.success('Audio playback test passed!');
                };
                testAudio.onerror = (e) => {
                  console.error('🔇 Audio playback failed:', e);
                  toast.error('Audio playback failed');
                };
              }
            } catch (error) {
              console.error('❌ Audio test failed:', error);
              toast.error(`Audio access failed: ${error.message}`);
            }
          }}
          className="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-white text-xs"
        >
          Test Audio Access
        </button>
        
        <a 
          href={submission.audio_url} 
          download 
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-white text-xs"
        >
          Download Audio
        </a>
      </div>
    </div>
    
    {/* Audio Player with Better Error Handling */}
    <div className="bg-black/30 p-3 rounded-lg">
      <audio 
        controls 
        className="w-full rounded-lg"
        preload="metadata"
        crossOrigin="anonymous"
        onError={(e) => {
          const audio = e.target;
          console.error('🎵 Audio Player Error:', {
            errorCode: audio.error?.code,
            errorMessage: audio.error?.message,
            networkState: audio.networkState,
            readyState: audio.readyState,
            src: audio.src
          });
          
          const errorMessages = {
            1: 'Playback was aborted',
            2: 'Network error while loading audio',
            3: 'Audio format cannot be decoded',
            4: 'Audio source not supported or URL invalid'
          };
          
          const errorMsg = errorMessages[audio.error?.code] || `Error code: ${audio.error?.code}`;
          toast.error(`Audio playback error: ${errorMsg}`);
        }}
        onLoadStart={() => console.log('🔄 Audio loading started')}
        onLoadedMetadata={(e) => {
          console.log('✅ Audio metadata loaded:', {
            duration: e.target.duration,
            currentSrc: e.target.currentSrc
          });
          toast.success('Audio loaded successfully');
        }}
        onCanPlay={() => console.log('🔊 Audio ready to play')}
        onPlaying={() => console.log('▶️ Audio playback started')}
      >
        <source src={submission.audio_url} type="audio/webm" />
        <source src={submission.audio_url} type="audio/mpeg" />
        <source src={submission.audio_url} type="audio/wav" />
        <source src={submission.audio_url} type="audio/ogg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  </div>
)}
              </div>

              <div className="flex space-x-2 self-end md:self-auto">
                <button
                  onClick={() => onViewSubmission(submission.id)}
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-white flex items-center"
                >
                  <Eye size={16} className="mr-2" />
                  View Details
                </button>
                <button
                  onClick={() => onStartGrading(submission)}
                  className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded-lg text-white flex items-center"
                >
                  <FileCheck size={16} className="mr-2" />
                  Grade Now
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const GradedSubmissions = ({ submissions, onViewSubmission }) => {
  // Filter only graded submissions and ensure they have valid data
  const gradedSubmissions = submissions.filter(sub => 
    sub.grade !== null && sub.grade !== undefined
  );

  if (gradedSubmissions.length === 0) {
    return (
      <div className="text-center py-12">
        <Award size={48} className="mx-auto text-blue-400 mb-3" />
        <p className="text-blue-200">No graded submissions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {gradedSubmissions.map((submission) => {
        // Fix student name access - try multiple possible paths
        const studentName = submission.student?.name || 
                           submission.student_name || 
                           submission.students?.name || 
                           'Unknown Student';
        
        const assignmentTitle = submission.assignment?.title || 
                               submission.assignment_title || 
                               'Unknown Assignment';
        
        const maxScore = submission.assignment?.max_score || 
                        submission.assignment_max_score || 
                        100;
        
        const submittedDate = submission.submitted_at ? 
          new Date(submission.submitted_at).toLocaleDateString() : 
          'Not submitted';
        
        const gradedDate = submission.graded_at ? 
          new Date(submission.graded_at).toLocaleDateString() : 
          'Not graded';

        return (
          <div key={submission.id} className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <User size={16} className="text-green-400 mr-2" />
                  <h4 className="font-semibold text-white">{studentName}</h4>
                  <div className="ml-3 flex items-center space-x-2">
                    <span className="text-green-300 text-sm bg-green-500/20 px-2 py-1 rounded">
                      Score: {submission.grade}/{maxScore}
                    </span>
                    <span className="text-blue-300 text-sm">
                      {Math.round((submission.grade / maxScore) * 100)}%
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-blue-200">Assignment: <span className="text-white">{assignmentTitle}</span></p>
                    <p className="text-blue-200">Graded on: <span className="text-white">{gradedDate}</span></p>
                  </div>
                  <div>
                    <p className="text-blue-200">Submitted: <span className="text-white">{submittedDate}</span></p>
                    <p className="text-blue-200">Status: <span className="text-green-400">Graded</span></p>
                  </div>
                </div>

                {submission.feedback && (
                  <div className="mt-3 p-3 bg-black/20 rounded">
                    <p className="text-blue-200 text-sm font-medium mb-1">Your Feedback:</p>
                    <p className="text-white text-sm">{submission.feedback}</p>
                  </div>
                )}
              </div>

              <div className="flex space-x-2 self-end md:self-auto">
                <button
                  onClick={() => onViewSubmission(submission.id)}
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-white flex items-center"
                >
                  <Eye size={16} className="mr-2" />
                  View Details
                </button>
                <span className="bg-green-600 text-green-100 px-3 py-1 rounded-full text-sm">
                  GRADED
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

  const GradingTab = ({ 
  submissions, 
  pendingSubmissions, 
  onGradeAssignment, 
  onStartGrading,
  activeTab,
  setActiveTab 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Fix the filtered submissions logic
  const filteredPendingSubmissions = pendingSubmissions.filter(sub => {
    const studentName = sub.student?.name || sub.student_name || sub.students?.name || '';
    const assignmentTitle = sub.assignment?.title || sub.assignment_title || '';
    
    return studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           assignmentTitle.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredGradedSubmissions = submissions.filter(sub => 
    sub.grade !== null && sub.grade !== undefined
  ).filter(sub => {
    const studentName = sub.student?.name || sub.student_name || sub.students?.name || '';
    const assignmentTitle = sub.assignment?.title || sub.assignment_title || '';
    
    return studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           assignmentTitle.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const loadSubmissionDetails = async (submissionId) => {
    try {
      const submission = await teacherApi.getSubmissionDetails(submissionId);
      setSelectedSubmission(submission);
    } catch (error) {
      console.error('Error loading submission details:', error);
      toast.error('Failed to load submission details');
    }
  };

  // Fix the submission details panel
  const SubmissionDetailsPanel = ({ submission, onClose, onStartGrading }) => {
    if (!submission) return null;

    // Safely get submission data with fallbacks
    const studentName = submission.student?.name || submission.student_name || submission.students?.name || 'Unknown Student';
    const studentEmail = submission.student?.email || submission.student_email || '';
    const assignmentTitle = submission.assignment?.title || submission.assignment_title || 'Unknown Assignment';
    const dueDate = submission.assignment?.due_date || submission.assignment_due_date;
    const maxScore = submission.assignment?.max_score || submission.assignment_max_score || 100;

    return (
      <div className="lg:w-1/3 bg-white/10 border border-white/20 rounded-lg p-6 h-fit">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-semibold text-white">Submission Details</h4>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-blue-200 text-sm">Student</p>
            <p className="text-white font-medium">{studentName}</p>
            {studentEmail && (
              <p className="text-blue-300 text-xs">{studentEmail}</p>
            )}
          </div>

          <div>
            <p className="text-blue-200 text-sm">Assignment</p>
            <p className="text-white font-medium">{assignmentTitle}</p>
            {dueDate && (
              <p className="text-blue-300 text-xs">
                Due: {new Date(dueDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {submission.submission_text && (
            <div>
              <p className="text-blue-200 text-sm">Written Submission</p>
              <p className="text-white text-sm bg-white/5 p-3 rounded mt-1">
                {submission.submission_text}
              </p>
            </div>
          )}

          {submission.audio_url && (
            <div>
              <p className="text-blue-200 text-sm">Audio Submission</p>
              <audio 
                controls 
                className="w-full mt-2 rounded-lg"
                src={submission.audio_url}
                onError={(e) => {
                  console.error('Audio loading error:', e);
                  toast.error('Failed to load audio file');
                }}
              >
                <source src={submission.audio_url} type="audio/webm" />
                <source src={submission.audio_url} type="audio/mpeg" />
                <source src={submission.audio_url} type="audio/wav" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {submission.submitted_at && (
            <div>
              <p className="text-blue-200 text-sm">Submitted</p>
              <p className="text-white text-sm">
                {new Date(submission.submitted_at).toLocaleString()}
              </p>
            </div>
          )}

          {(!submission.grade || submission.grade === null) && (
            <button
              onClick={() => {
                onStartGrading(submission);
                onClose();
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg text-white font-medium mt-4"
            >
              Grade This Submission
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Grade Student Work</h3>
            <p className="text-blue-300 text-sm">
              {pendingSubmissions.length} pending submission{pendingSubmissions.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300" />
              <input
                type="text"
                placeholder="Search students or assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex space-x-4 mb-6 border-b border-white/20">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-yellow-400 text-yellow-400'
                : 'border-transparent text-blue-300 hover:text-white'
            }`}
          >
            Pending Grading
            {pendingSubmissions.length > 0 && (
              <span className="ml-2 bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full text-xs">
                {pendingSubmissions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('graded')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'graded'
                ? 'border-green-400 text-green-400'
                : 'border-transparent text-blue-300 hover:text-white'
            }`}
          >
            Graded Work
            <span className="ml-2 bg-green-500 text-green-900 px-2 py-1 rounded-full text-xs">
              {filteredGradedSubmissions.length}
            </span>
          </button>
        </div>

        {activeTab === 'pending' && (
          <PendingSubmissions 
            submissions={filteredPendingSubmissions}
            onStartGrading={onStartGrading}
            onViewSubmission={loadSubmissionDetails}
          />
        )}

        {activeTab === 'graded' && (
          <GradedSubmissions 
            submissions={filteredGradedSubmissions}
            onViewSubmission={loadSubmissionDetails}
          />
        )}
      </div>

      {/* Use the fixed SubmissionDetailsPanel component */}
      {selectedSubmission && (
        <SubmissionDetailsPanel 
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onStartGrading={onStartGrading}
        />
      )}
    </div>
  );
};

  const UpcomingTab = ({ classes, formatDateTime }) => (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Upcoming Classes ({classes.length})</h3>
      {classes.length > 0 ? (
        <div className="grid gap-4">
          {classes.map((classItem) => (
            <div key={classItem.id} className="bg-white/10 border border-white/20 rounded-lg p-4">
              <h4 className="font-bold text-white">{classItem.title}</h4>
              <p className="text-blue-300 text-sm mt-1">{formatDateTime(classItem.scheduled_date)}</p>
              <p className="text-blue-200 text-sm">Duration: {classItem.duration} minutes</p>
              <div className="mt-3 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-xs inline-block">
                UPCOMING
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-blue-400 mb-3" />
          <p className="text-blue-200">No upcoming classes</p>
        </div>
      )}
    </div>
  );

  const CompletedTab = ({ classes, formatDateTime }) => (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Completed Classes ({classes.length})</h3>
      {classes.length > 0 ? (
        <div className="grid gap-4">
          {classes.map((classItem) => (
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
      ) : (
        <div className="text-center py-12">
          <BarChart3 size={48} className="mx-auto text-blue-400 mb-3" />
          <p className="text-blue-200">No completed classes yet</p>
        </div>
      )}
    </div>
  );

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
            
            {/* User dropdown with logout option */}
            <div className="relative group" style={{ isolation: 'isolate', zIndex: 10000 }}>
              <div className="flex items-center cursor-pointer">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-2">
                  <User size={16} />
                </div>
                <span className="text-white hidden md:inline">{user?.name}</span>
                <ChevronDown size={16} className="ml-1 text-blue-200" />
              </div>
              
              {/* Dropdown menu - Fixed z-index and positioning */}
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
            onStartSession={startVideoSession}
            onJoinSession={joinVideoSession}
            formatDateTime={formatDateTime}
          />
        )}

        {activeTab === 'students' && (
          <StudentsTab students={students} loading={loading.students} />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsTab 
            assignments={assignments} 
            classes={classes}
            onCreateAssignment={createAssignment}
            onGradeAssignment={gradeAssignment}
            showCreateModal={showCreateAssignment}
            setShowCreateModal={setShowCreateAssignment}
            newAssignment={newAssignment}
            setNewAssignment={setNewAssignment}
            loading={loading.assignments}
            gradingSubmission={gradingSubmission}
            setGradingSubmission={setGradingSubmission}
            gradeData={gradeData}
            setGradeData={setGradeData}
          />
        )}

        {activeTab === 'grading' && (
          <GradingTab 
            submissions={assignments}
            pendingSubmissions={pendingSubmissions}
            onGradeAssignment={gradeAssignment}
            onStartGrading={(submission) => {
              setGradingSubmission(submission);
              setGradeData({ 
                score: submission.grade || '', 
                feedback: submission.feedback || '',
                audioFeedbackUrl: submission.audio_feedback_url || ''
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

            {/* Class field (optional for categorization) */}
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

            {/* Default Quran Subject */}
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1">Subject</label>
              <input
                type="text"
                value="Quran"
                readOnly
                className="w-full p-2 rounded-lg bg-blue-800/30 border border-blue-700/30 text-blue-300 cursor-not-allowed"
              />
              <p className="text-blue-300 text-xs mt-1">Subject is automatically set to Quran</p>
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

            {/* Student Selection (only show when not assigning to all students) */}
            {!newAssignment.for_all_students && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  Select Students *
                </label>
                
                {/* Class filter for students */}
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

          {/* Success Animation */}
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

    {/* Grade Assignment Modal */}
   {/* Grade Assignment Modal with Audio Recording */}
{gradingSubmission && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
    <div className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <h3 className="text-xl font-bold mb-4 text-white">Grade Assignment</h3>
      
      {/* Student and Assignment Info */}
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

      {/* Student's Audio Submission */}
      {gradingSubmission.audio_url && (
        <div className="mb-6">
          <p className="text-blue-200 text-sm font-medium mb-2">Student's Audio Submission:</p>
          <audio controls className="w-full rounded-lg">
            <source src={gradingSubmission.audio_url} type="audio/webm" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Student's Written Submission */}
      {gradingSubmission.submission_text && (
        <div className="mb-6">
          <p className="text-blue-200 text-sm font-medium mb-2">Written Submission:</p>
          <div className="bg-blue-800/30 p-4 rounded-lg max-h-32 overflow-y-auto">
            <p className="text-white text-sm">{gradingSubmission.submission_text}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Score Input */}
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

        {/* Written Feedback */}
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

       {/* Audio Feedback Recording Section */}
<div className="border-t border-blue-700/30 pt-4">
  <label className="block text-sm font-medium text-blue-200 mb-3">
    Audio Feedback (Record corrections or detailed feedback)
  </label>
  
  {/* Audio Recorder Component */}
  <div className="bg-blue-800/30 rounded-lg p-4 border border-blue-700/30">
    {!gradeData.audioFeedbackUrl && !audioUrl ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                if (audioIsRecording) {
                  // Stop recording
                  stopRecording();
                  setGradeData(prev => ({
                    ...prev, 
                    isRecording: false,
                    audioFeedbackUrl: audioUrl // Use the URL from the recording hook
                  }));
                  
                  // Clear the interval
                  if (recordingInterval) {
                    clearInterval(recordingInterval);
                    setRecordingInterval(null);
                  }
                } else {
                  // Start recording
                  await startRecording();
                  setGradeData(prev => ({...prev, isRecording: true}));
                  
                  // Update recording time every second
                  const interval = setInterval(() => {
                    setGradeData(prev => ({
                      ...prev, 
                      recordingTime: prev.recordingTime + 1
                    }));
                  }, 1000);
                  
                  // Store interval ID to clear later
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
          
          {audioIsRecording && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-300 text-sm">Recording</span>
            </div>
          )}
        </div>

        {/* Recording Visualization */}
        {audioIsRecording && (
          <div className="flex items-center space-x-1 h-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-green-500/30 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 12 + 4}px`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        )}
      </div>
    ) : (
      /* Audio Preview after Recording */
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-green-400 text-sm font-medium">✅ Audio feedback recorded</span>
          <button
            onClick={() => {
              clearRecording();
              setGradeData(prev => ({...prev, audioFeedbackUrl: ''}));
            }}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Re-record
          </button>
        </div>
        
        <audio 
          controls 
          className="w-full rounded-lg"
          src={gradeData.audioFeedbackUrl || audioUrl}
        >
          Your browser does not support the audio element.
        </audio>
        
        <div className="text-blue-300 text-xs">
          Students will be able to listen to this audio feedback in their dashboard
        </div>
      </div>
    )}
  </div>

  {/* Instructions */}
  <div className="mt-2 text-blue-300 text-xs">
    💡 <strong>Perfect for:</strong> Tajweed corrections, detailed explanations, 
    Quranic recitation feedback, or personalized encouragement
  </div>
</div>
        
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={() => {
            setGradingSubmission(null);
            setGradeData({ score: '', feedback: '', audioFeedbackUrl: '' });
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
            gradeData.audioFeedbackUrl
          )}
          disabled={!gradeData.score || isNaN(parseInt(gradeData.score))}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-800/50 disabled:cursor-not-allowed"
        >
          Submit Grade & Feedback
        </button>
      </div>
    </div>
)}
