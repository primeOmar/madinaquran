// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { makeApiRequest } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  ClipboardList,
  BookOpen,
  Clock,
  User,
  Calendar,
  Award,
  BarChart3,
  Download,
  Upload,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Mail,
  RefreshCw,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Loader2,
  Star,
  TrendingUp,
  Users,
  Target,
  Video,
  MessageCircle,
  FileCheck,
  ShieldCheck
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { toast } from 'react-toastify';

// === COMPONENTS MOVED OUTSIDE DASHBOARD ===

// Audio recording hook
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
      alert('Microphone access denied. Please allow microphone access to record audio.');
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

// Audio Player Component
const AudioPlayer = ({ audioUrl, onDelete }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnd = () => setIsPlaying(false);
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handleLoadedMetadata = () => setDuration(audio.duration);

      audio.addEventListener('ended', handleEnd);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        audio.removeEventListener('ended', handleEnd);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, []);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-green-900/30 rounded-lg">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <button
        onClick={togglePlay}
        className="p-2 bg-green-600 hover:bg-green-500 rounded-full transition-all duration-200"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      
      <div className="flex-1">
        <div className="text-sm text-green-300">Your recording</div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-green-400">{formatTime(currentTime)}</span>
          <div className="flex-1 bg-green-800/50 rounded-full h-1">
            <div 
              className="bg-green-500 h-1 rounded-full transition-all duration-200"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs text-green-400">{formatTime(duration)}</span>
        </div>
      </div>
      
      <button
        onClick={onDelete}
        className="p-2 text-red-300 hover:text-red-200 transition-colors duration-200"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

// Assignment Submission Modal
const AssignmentSubmissionModal = ({ assignment, isOpen, onClose, onSubmit }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const {
    isRecording,
    audioBlob,
    audioUrl,
    recordingTime,
    startRecording,
    stopRecording,
    clearRecording,
    hasRecording
  } = useAudioRecorder();

  const handleSubmit = async () => {
    if (!hasRecording && !submissionText.trim()) {
      toast.error('Please either record audio or add text comments before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      let audioBase64 = null;
      
      if (audioBlob) {
        audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
      }

      const submissionData = {
        assignment_id: assignment.id,
        submission_text: submissionText,
        audio_data: audioBase64
      };

      await onSubmit(submissionData);
      onClose();
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast.error('Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-green-900/90 border border-green-700/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Submit Assignment: {assignment.title}</h3>
          <button onClick={onClose} className="text-green-300 hover:text-white transition-colors">✕</button>
        </div>

        <div className="space-y-6">
          <div className="bg-green-800/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Assignment Details</h4>
            <p className="text-green-200 text-sm">{assignment.description}</p>
            <div className="mt-2 text-xs text-green-300">
              Due: {new Date(assignment.due_date).toLocaleDateString()} • {assignment.max_score} points
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3 flex items-center">
              <Mic className="mr-2" size={18} />
              Record Audio Submission
            </h4>
            
            <div className="space-y-3">
              {!hasRecording ? (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-full transition-all duration-200 ${
                      isRecording 
                        ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
                        : 'bg-green-600 hover:bg-green-500'
                    }`}
                  >
                    {isRecording ? <Square size={20} /> : <Mic size={20} />}
                  </button>
                  
                  <div className="flex-1">
                    <div className="text-sm text-green-300">
                      {isRecording ? `Recording... ${recordingTime}` : 'Click to start recording'}
                    </div>
                    <div className="text-xs text-green-400">
                      {isRecording ? 'Click stop when finished' : 'Record your audio response'}
                    </div>
                  </div>
                </div>
              ) : (
                <AudioPlayer audioUrl={audioUrl} onDelete={clearRecording} />
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Additional Comments (Optional)</h4>
            <textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Add any additional comments or notes about your submission..."
              rows="4"
              className="w-full p-3 rounded-lg bg-green-800/50 border border-green-700/30 text-white placeholder-green-300 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="bg-blue-900/30 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle size={16} className="text-blue-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-200">
                <strong>Note:</strong> Your audio recording will be submitted along with any comments. 
                You can review your recording before submitting.
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-green-800/50 hover:bg-green-700/50 border border-green-700/30 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (!hasRecording && !submissionText.trim())}
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all duration-200"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="mr-2" size={16} />
                  Submit Assignment
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Assignment Item Component
const AssignmentItem = ({ assignment, onSubmitAssignment, formatDate }) => {
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  const isSubmitted = assignment.submissions?.[0]?.status === "submitted" || 
                     assignment.submissions?.[0]?.status === "graded";
  const isGraded = assignment.submissions?.[0]?.status === "graded";
  const dueDate = new Date(assignment.due_date);
  const isOverdue = dueDate < new Date() && !isSubmitted;
  const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <div className="p-4 rounded-lg bg-green-700/30 border border-green-600/30 hover:bg-green-700/50 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg flex items-center">
                <FileText className="mr-2" size={20} />
                {assignment.title}
              </h4>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isGraded 
                  ? "bg-green-900/50 text-green-300" 
                  : isSubmitted
                  ? "bg-blue-900/50 text-blue-300"
                  : isOverdue
                  ? "bg-red-900/50 text-red-300"
                  : "bg-yellow-900/50 text-yellow-300"
              }`}>
                {isGraded 
                  ? `Graded: ${assignment.submissions?.[0]?.score}/${assignment.max_score}`
                  : isSubmitted
                  ? "Submitted - Awaiting Grade"
                  : isOverdue
                  ? "Overdue"
                  : daysUntilDue <= 3 ? `Due in ${daysUntilDue} days` : "Pending Submission"
                }
              </div>
            </div>
            
            <div className="flex flex-wrap items-center mt-3 text-sm text-green-200">
              <span className="flex items-center mr-4 mb-2">
                <BookOpen size={14} className="mr-1" />
                {assignment.subject || assignment.class?.title}
              </span>
              <span className="flex items-center mr-4 mb-2">
                <Calendar size={14} className="mr-1" />
                Due: {formatDate(assignment.due_date)}
              </span>
              <span className="flex items-center mr-4 mb-2">
                <Award size={14} className="mr-1" />
                {assignment.max_score} points
              </span>
            </div>
            
            {assignment.description && (
              <p className="text-green-300 text-sm mt-2">{assignment.description}</p>
            )}
            
            {isOverdue && (
              <div className="mt-2 flex items-center text-red-300 text-sm">
                <AlertCircle size={14} className="mr-1" />
                This assignment is {Math.abs(daysUntilDue)} days overdue
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="text-sm bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
            <Download className="mr-2" size={16} />
            Materials
          </button>
          
          {!isGraded && (
            <button 
              onClick={() => setShowSubmissionModal(true)}
              className={`text-sm py-2 px-4 rounded-lg flex items-center transition-all duration-200 ${
                isOverdue 
                  ? 'bg-red-600 hover:bg-red-500' 
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              <Mic className="mr-2" size={16} />
              {isSubmitted ? 'Resubmit' : 'Record & Submit'}
            </button>
          )}
          
          {isGraded && assignment.submissions?.[0]?.feedback && (
            <button className="text-sm bg-purple-600 hover:bg-purple-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
              <MessageCircle className="mr-2" size={16} />
              View Feedback
            </button>
          )}
        </div>
      </div>

      <AssignmentSubmissionModal
        assignment={assignment}
        isOpen={showSubmissionModal}
        onClose={() => setShowSubmissionModal(false)}
        onSubmit={onSubmitAssignment}
      />
    </motion.div>
  );
};

// Class Item Component
const ClassItem = ({ classItem, formatDate, formatTime, getTimeUntilClass, joinClass }) => {
  const timeInfo = getTimeUntilClass(classItem.scheduled_date);
  const isClassStarted = timeInfo.status === 'started';
  const isClassCompleted = new Date(classItem.scheduled_date) < new Date();
  const isUpcoming = !isClassStarted && !isClassCompleted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <div className={`p-4 rounded-lg border transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl ${
        isClassCompleted 
          ? 'bg-green-800/20 border-green-600/20' 
          : isClassStarted
          ? 'bg-blue-900/30 border-blue-600/30'
          : 'bg-green-700/30 border-green-600/30'
      }`}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg flex items-center">
                <Video className="mr-2" size={20} />
                {classItem.title}
                {isClassCompleted && (
                  <CheckCircle size={16} className="text-green-300 ml-2" />
                )}
              </h4>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isClassCompleted 
                  ? 'bg-green-900/50 text-green-300'
                  : isClassStarted
                  ? 'bg-blue-900/50 text-blue-300 animate-pulse'
                  : 'bg-yellow-900/50 text-yellow-300'
              }`}>
                {isClassCompleted ? 'Completed' : isClassStarted ? 'Live Now' : 'Upcoming'}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center mt-3 text-sm text-green-200">
              <span className="flex items-center mr-4 mb-2">
                <Clock size={14} className="mr-1" />
                {formatTime(classItem.scheduled_date)} - {formatTime(classItem.end_date)}
              </span>
              <span className="flex items-center mr-4 mb-2">
                <User size={14} className="mr-1" />
                {classItem.teacher?.name || 'Teacher'}
              </span>
              <span className="flex items-center mr-4 mb-2">
                <Calendar size={14} className="mr-1" />
                {formatDate(classItem.scheduled_date)}
              </span>
            </div>
            
            <div className="mt-2 text-sm text-green-300">
              {timeInfo.text}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          {isClassStarted && !isClassCompleted && (
            <button 
              className="bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200"
              onClick={() => joinClass(classItem)}
            >
              <PlayCircle size={16} className="mr-1"/>
              Join Class
            </button>
          )}
          
          {isUpcoming && (
            <button className="bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
              <Calendar size={16} className="mr-1"/>
              Add to Calendar
            </button>
          )}
          
          {isClassCompleted && (
            <button className="bg-purple-600 hover:bg-purple-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
              <Download size={16} className="mr-1"/>
              Download Recording
            </button>
          )}
        </div>
        
        {classItem.video_session && (
          <div className="mt-3 text-xs text-green-400 flex items-center">
            <ShieldCheck size={12} className="mr-1" />
            Secure Meeting ID: {classItem.video_session.meeting_id}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Simple DollarSign component
const DollarSign = ({ size = 16, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

// === MAIN DASHBOARD COMPONENT ===
export default function Dashboard() {
  // State declarations
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [exams, setExams] = useState([]);
  const [stats, setStats] = useState([
    { label: "Total Classes", value: "0", icon: BookOpen, change: "+0" },
    { label: "Hours Learned", value: "0", icon: Clock, change: "+0" },
    { label: "Assignments", value: "0", icon: FileText, change: "+0" },
    { label: "Avg. Score", value: "0%", icon: BarChart3, change: "+0%" },
  ]);
  const [studentName, setStudentName] = useState("Student");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [hasTeacher, setHasTeacher] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeSection, setActiveSection] = useState("classes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userEmailVerified, setUserEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [progressStats, setProgressStats] = useState({
    completionRate: 0,
    streak: 0,
    level: 1,
    points: 0,
    nextLevel: 100
  });

  // API fetch functions
  const fetchStatsData = async () => {
    setLoadingStats(true);
    try {
      const statsData = await makeApiRequest('/api/student/stats');
      
      if (!statsData || typeof statsData !== 'object') {
        throw new Error('Invalid stats data received');
      }
      
      const statsArray = [
        { 
          label: "Total Classes", 
          value: statsData.total_classes?.toString() || "0", 
          icon: BookOpen, 
          change: "+0" 
        },
        { 
          label: "Hours Learned", 
          value: statsData.hours_learned?.toString() || "0", 
          icon: Clock, 
          change: "+0" 
        },
        { 
          label: "Assignments", 
          value: statsData.assignments?.toString() || "0", 
          icon: FileText, 
          change: "+0" 
        },
        { 
          label: "Avg. Score", 
          value: `${statsData.avg_score || "0"}%`, 
          icon: BarChart3, 
          change: "+0%" 
        },
      ];
      
      setStats(statsArray);

      setProgressStats({
        completionRate: Math.min(100, Math.round((statsData.completed_assignments || 0) / (statsData.total_assignments || 1) * 100)),
        streak: statsData.streak || 0,
        level: Math.floor((statsData.points || 0) / 100) + 1,
        points: statsData.points || 0,
        nextLevel: 100 - ((statsData.points || 0) % 100)
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const classesData = await makeApiRequest('/api/student/classes');
      
      if (Array.isArray(classesData)) {
        setClasses(classesData);
      } else if (classesData && Array.isArray(classesData.classes)) {
        setClasses(classesData.classes);
      } else {
        setClasses([]);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const assignmentsData = await makeApiRequest('/api/student/assignments');
      
      if (Array.isArray(assignmentsData)) {
        setAssignments(assignmentsData);
      } else if (assignmentsData && Array.isArray(assignmentsData.assignments)) {
        setAssignments(assignmentsData.assignments);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const paymentsData = await makeApiRequest('/api/student/payments');
      
      if (Array.isArray(paymentsData)) {
        setPayments(paymentsData);
      } else if (paymentsData && Array.isArray(paymentsData.payments)) {
        setPayments(paymentsData.payments);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchTeacherStatus = async () => {
    try {
      const teacherData = await makeApiRequest('/api/student/teacher-check');
      setHasTeacher(teacherData.hasTeacher || teacherData.has_teacher || false);
    } catch (error) {
      console.error('Error fetching teacher status:', error);
      setHasTeacher(false);
    }
  };

  const fetchExams = async () => {
    try {
      const examsData = await makeApiRequest('/api/student/exams');
      
      if (Array.isArray(examsData)) {
        setExams(examsData);
      } else if (examsData && Array.isArray(examsData.exams)) {
        setExams(examsData.exams);
      } else {
        setExams([]);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
      setExams([]);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotifications([
        { id: 1, type: 'assignment', message: 'New assignment posted', time: '5 min ago', read: false },
        { id: 2, type: 'class', message: 'Class starting in 15 minutes', time: '1 hour ago', read: true },
      ]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleContactAdmin = async () => {
    if (!contactMessage.trim()) {
      toast.error('Please enter a message before sending.');
      return;
    }

    setSendingMessage(true);
    try {
      const response = await makeApiRequest('/api/student/contact-admin', {
        method: 'POST',
        body: JSON.stringify({ message: contactMessage }),
      });
      
      if (response && response.success !== false) {
        toast.success('Message sent to admin! They will contact you soon.');
        setContactMessage('');
      } else {
        throw new Error(response?.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error contacting admin:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

 const handleSubmitAssignment = async (submissionData) => {
  try {
    console.log('🎯 [Assignment] Starting submission process...');
    
    // Validate submission data
    if (!submissionData.assignment_id) {
      throw new Error('Assignment ID is required');
    }

    console.log('📝 [Assignment] Submission data:', {
      assignment_id: submissionData.assignment_id,
      has_audio: !!submissionData.audio_data,
      audio_length: submissionData.audio_data?.length || 0,
      has_text: !!submissionData.submission_text,
      text_length: submissionData.submission_text?.length || 0
    });

    // Make the API request
    const response = await makeApiRequest('/api/student/submit-assignment', {
      method: 'POST',
      body: submissionData
    });

    if (response.success) {
      console.log('✅ [Assignment] Submission successful!', response);
      toast.success('Assignment submitted successfully!');
      
      // Refresh the data
      await Promise.all([
        fetchAssignments(),
        fetchStatsData()
      ]);
      
      return response;
    } else {
      throw new Error(response.error || 'Failed to submit assignment');
    }

  } catch (error) {
    console.error('❌ [Assignment] Submission failed:', error);
    
    // Handle specific error cases
    if (error.message.includes('Authentication') || 
        error.message.includes('session') || 
        error.message.includes('token')) {
      toast.error('Your session has expired. Please login again.');
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else if (error.message.includes('Network error')) {
      toast.error('Network error. Please check your internet connection.');
    } else {
      toast.error(`Failed to submit assignment: ${error.message}`);
    }
    
    throw error;
  }
};

  // Effects
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) throw userError;
        
        if (user) {
          setUserEmailVerified(user.email_confirmed_at !== null);
          setStudentName(user.user_metadata?.name || "Student");
          
          if (user.email_confirmed_at) {
            await Promise.all([
              fetchStatsData(),
              fetchClasses(),
              fetchTeacherStatus(),
              fetchAssignments(),
              fetchPayments(),
              fetchNotifications()
            ]);
          }
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        
        if (error.message.includes('JWT') || error.message.includes('authentication')) {
          await supabase.auth.signOut();
          window.location.href = "/login";
        }
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
    
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!userEmailVerified) return;

    const fetchData = async () => {
      try {
        switch (activeSection) {
          case "classes":
            await fetchClasses();
            break;
          case "assignments":
            await fetchAssignments();
            break;
          case "payments":
            await fetchPayments();
            break;
          case "exams":
            try {
              await fetchExams();
            } catch (examError) {
              console.log('Exam route not available yet');
              setExams([]);
            }
            break;
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [activeSection, userEmailVerified]);

  // Utility functions
  const getTimeUntilClass = (scheduledDate) => {
    const now = new Date();
    const classTime = new Date(scheduledDate);
    const diffMs = classTime - now;
    
    if (diffMs <= 0) return { status: 'started', text: 'Class in progress' };
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { 
      status: 'upcoming', 
      text: `Starts in ${diffHours}h ${diffMinutes}m` 
    };
  };

  const joinClass = (classItem) => {
    if (classItem.video_session) {
      window.open(`/video-call/${classItem.video_session.meeting_id}`, '_blank');
    } else {
      toast.error('No video session available for this class');
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      
      if (error) {
        console.error('Error resending verification email:', error.message);
        toast.error('Failed to resend verification email');
      } else {
        setEmailSent(true);
        toast.success('Verification email sent!');
        setTimeout(() => setEmailSent(false), 5000);
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      toast.error('Failed to resend verification email');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error.message);
      }
      window.location.href = "/login";
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsMobile && setIsSidebarOpen(false);

  // Render loading state
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-700 text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent"
          />
          <motion.h2 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-2"
          >
            Welcome to Madina Quran Classes. Dashboard setting up
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-green-200"
          >
            Preparing your learning dashboard...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Email verification screen
  if (!userEmailVerified) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-700 text-white p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-green-800/40 backdrop-blur-md rounded-2xl p-8 border border-green-700/30 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-700/50 flex items-center justify-center"
          >
            <Mail size={32} className="text-green-300" />
          </motion.div>
          
          <h2 className="text-2xl font-bold mb-4">Verify Your Email</h2>
          <p className="text-green-200 mb-6">
            Please check your email inbox and verify your account to access your personalized learning dashboard.
          </p>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleResendVerification}
            disabled={resendingEmail || emailSent}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-700 py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-200 mb-4"
          >
            {resendingEmail ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Sending...
              </>
            ) : emailSent ? (
              <>
                <CheckCircle size={18} className="mr-2" />
                Email Sent!
              </>
            ) : (
              <>
                <Mail size={18} className="mr-2" />
                Resend Verification Email
              </>
            )}
          </motion.button>
          
          <button 
            onClick={handleLogout}
            className="text-green-300 hover:text-green-200 text-sm transition-colors duration-200"
          >
            Not your account? Sign out
          </button>
        </motion.div>
      </div>
    );
  }

  // Main dashboard render
  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-green-900 via-green-800 to-green-700 text-white overflow-hidden">
      <AnimatePresence>
        {isLoggingOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="text-center p-8 rounded-2xl bg-green-900/90 border border-green-700/30 shadow-2xl"
            >
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 1.5, repeat: Infinity, ease: "linear" },
                  scale: { duration: 0.8, repeat: Infinity }
                }}
                className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-500 to-teal-400 flex items-center justify-center"
              >
                <LogOut className="text-white" size={28} />
              </motion.div>
              <h3 className="text-2xl font-bold mb-2">Logging Out</h3>
              <p className="text-green-200">Taking you to the login page...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-40 bg-green-950/90 backdrop-blur-md border-b border-green-700/30 p-4 flex items-center justify-between flex-shrink-0"
      >
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-lg hover:bg-green-800/50 mr-2 transition-all duration-200 bg-black"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xl font-bold flex items-center"
          >
            <BookOpen className="mr-2" size={24} />
            Madrasa Dashboard
          </motion.h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button className="flex items-center space-x-2 p-2 bg-black rounded-lg hover:bg-green-800/50 transition-all duration-200 relative">
              <Bell size={20} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-2 rounded-lg bg-black hover:bg-green-800/50 transition-all duration-200"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-400 flex items-center justify-center">
                <User size={16} />
              </div>
              <span className="hidden sm:block font-medium">{name}</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {userMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-green-900 rounded-lg shadow-xl py-1 z-50 border border-green-700/30"
                >
                  <div className="px-4 py-2 border-b border-green-700/30">
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-green-300">Student</p>
                  </div>
                  <button className="w-full text-left px-4 py-2 hover:bg-green-800 bg-black flex items-center transition-all duration-200">
                    <Settings size={16} className="mr-2" />
                    Settings
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-green-800 bg-black flex items-center transition-all duration-200">
                    <Award size={16} className="mr-2" />
                    Achievements
                  </button>
                  <motion.button 
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 hover:bg-green-800 flex items-center bg-black transition-all duration-200 text-red-300 hover:text-red-200"
                  >
                    <LogOut size={16} className="mr-2" />
                    Sign Out
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <motion.div 
          initial={{ x: -300 }}
          animate={{ x: isSidebarOpen ? 0 : (isMobile ? -300 : 0) }}
          className={`
            fixed md:relative inset-y-0 left-0 z-30 w-64 bg-green-950/90 backdrop-blur-md 
            transform transition-transform duration-300 ease-in-out md:transform-none
            flex-shrink-0 h-full overflow-y-auto border-r border-green-700/30 pt-16 md:pt-0
          `}
        >
          <div className="p-6 flex flex-col h-full">
            {/* User Profile Section */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8 mt-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-400 flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-green-100">{name}</h2>
                  <p className="text-green-300 text-sm">Level {progressStats.level}</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-green-300 mb-1">
                  <span>Progress to Level {progressStats.level + 1}</span>
                  <span>{progressStats.points % 100}/100</span>
                </div>
                <div className="w-full bg-green-800/50 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressStats.points % 100}%` }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
              {[
                { id: "classes", icon: LayoutDashboard, label: "Classes", badge: classes.filter(c => new Date(c.scheduled_date) > new Date()).length },
                { id: "assignments", icon: FileText, label: "Assignments", badge: assignments.filter(a => new Date(a.due_date) > new Date()).length },
                { id: "payments", icon: CreditCard, label: "Payments" },
                { id: "exams", icon: ClipboardList, label: "Exams" }
              ].map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setActiveSection(item.id); closeSidebar(); }}
                  className={`w-full flex items-center justify-between space-x-3 p-3 bg-black rounded-lg transition-all duration-200 group ${
                    activeSection === item.id
                      ? "bg-gradient-to-r from-green-600 to-teal-500 text-white shadow-lg"
                      : "hover:bg-green-800/60"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon size={20} /> 
                    <span>{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className={`px-2 py-1 rounded-full bg-black text-xs ${
                      activeSection === item.id 
                        ? "bg-white/20" 
                        : "bg-green-700/50"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              ))}
            </nav>

            {/* Stats Summary */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-6 border-t border-green-800/50"
            >
              <div className="bg-green-800/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-200">Current Streak</span>
                  <TrendingUp size={14} className="text-green-300" />
                </div>
                <div className="text-2xl font-bold text-green-100">{progressStats.streak} days</div>
                <div className="text-xs text-green-400 mt-1">Keep learning!</div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Sidebar overlay for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h2 className="text-2xl font-bold mb-2">
              Welcome back, {studentName}! 👋
            </h2>
            <p className="text-green-200">
              {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}
              {", ready to continue your learning journey?"}
            </p>
          </motion.div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="bg-green-800/40 backdrop-blur-md rounded-xl p-4 border border-green-700/30 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-green-300 text-sm">{stat.label}</p>
                    <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                    <p className="text-green-400 text-xs mt-1 flex items-center">
                      <TrendingUp size={12} className="mr-1" />
                      <span className="text-green-300">{stat.change}</span>
                      <span className="ml-2">from last week</span>
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-700/30">
                    <stat.icon size={20} className="text-green-300" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
          >
            <div className="bg-gradient-to-r from-green-600 to-teal-500 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold mb-1">{classes.filter(c => new Date(c.scheduled_date) > new Date()).length}</div>
              <div className="text-sm">Upcoming Classes</div>
            </div>
            <div className="bg-gradient-to-r from-blue-600 to-purple-500 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold mb-1">{assignments.filter(a => new Date(a.due_date) > new Date() && !a.submissions?.[0]).length}</div>
              <div className="text-sm">Pending Assignments</div>
            </div>
            <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold mb-1">{progressStats.completionRate}%</div>
              <div className="text-sm">Completion Rate</div>
            </div>
          </motion.div>

          {/* Section content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-green-800/40 backdrop-blur-md rounded-xl p-4 md:p-6 border border-green-700/30"
            >
              {/* Classes Section */}
              {activeSection === "classes" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold flex items-center">
                        <LayoutDashboard className="mr-2" size={24} />
                        My Classes
                      </h3>
                      <p className="text-green-200 mt-1">
                        {classes.length > 0 
                          ? `You have ${classes.filter(c => new Date(c.scheduled_date) > new Date()).length} upcoming classes`
                          : 'No classes scheduled yet'
                        }
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
                        <Calendar className="mr-2" size={16} />
                        Calendar View
                      </button>
                    </div>
                  </div>
                  
                  {loadingClasses ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
                      <p className="text-green-200">Loading your classes...</p>
                    </div>
                  ) : classes.length > 0 ? (
                    <div className="grid gap-4">
                      {classes.map((classItem, index) => (
                        <ClassItem
                          key={classItem.id}
                          classItem={classItem}
                          formatDate={formatDate}
                          formatTime={formatTime}
                          getTimeUntilClass={getTimeUntilClass}
                          joinClass={joinClass}
                        />
                      ))}
                    </div>
                  ) : !hasTeacher ? (
                    <div className="text-center py-12">
                      <AlertCircle size={64} className="mx-auto text-yellow-400 mb-4" />
                      <h4 className="text-xl font-semibold mb-2">No Teacher Assigned</h4>
                      <p className="text-green-200 mb-6 max-w-md mx-auto">
                        You haven't been assigned to a teacher yet. Contact our admin team to get started with personalized classes.
                      </p>
                      <div className="max-w-md mx-auto">
                        <textarea
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="Tell us about your learning goals..."
                          className="w-full p-3 rounded-lg bg-green-900/50 border border-green-700/30 text-white placeholder-green-300 mb-3 focus:ring-2 focus:ring-green-500 transition-all duration-200"
                          rows="3"
                        />
                        <button
                          onClick={handleContactAdmin}
                          disabled={sendingMessage || !contactMessage.trim()}
                          className="bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-500 hover:to-orange-400 disabled:opacity-50 py-3 px-6 rounded-lg text-white font-medium transition-all duration-200"
                        >
                          {sendingMessage ? (
                            <>
                              <Loader2 className="animate-spin mr-2 inline" size={16} />
                              Sending...
                            </>
                          ) : (
                            <>
                              <MessageCircle className="mr-2 inline" size={16} />
                              Contact Admin Team
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Calendar size={64} className="mx-auto text-green-400 mb-4" />
                      <h4 className="text-xl font-semibold mb-2">No Classes Scheduled</h4>
                      <p className="text-green-200 mb-4">Your teacher will schedule classes soon.</p>
                      <button className="bg-green-600 hover:bg-green-500 py-2 px-6 rounded-lg transition-all duration-200">
                        Request a Class
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Assignments Section */}
              {activeSection === "assignments" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold flex items-center">
                        <FileText className="mr-2" size={24} />
                        My Assignments
                      </h3>
                      <p className="text-green-200 mt-1">
                        {assignments.length > 0 
                          ? `${assignments.filter(a => !a.submissions?.[0]).length} pending, ${assignments.filter(a => a.submissions?.[0]?.status === 'graded').length} graded`
                          : 'No assignments posted yet'
                        }
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
                        <Download className="mr-2" size={16} />
                        Export All
                      </button>
                    </div>
                  </div>
                  
                  {loadingAssignments ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
                      <p className="text-green-200">Loading your assignments...</p>
                    </div>
                  ) : assignments.length > 0 ? (
                    <div className="grid gap-4">
                      {assignments.map((assignment) => (
                        <AssignmentItem 
                          key={assignment.id} 
                          assignment={assignment}
                          onSubmitAssignment={handleSubmitAssignment}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText size={64} className="mx-auto text-green-400 mb-4" />
                      <h4 className="text-xl font-semibold mb-2">No Assignments Yet</h4>
                      <p className="text-green-200 mb-4">Your teacher will post assignments soon.</p>
                      <div className="bg-green-800/30 p-4 rounded-lg max-w-md mx-auto">
                        <p className="text-sm text-green-300">
                          💡 <strong>Pro Tip:</strong> Check back regularly for new assignments and stay ahead of your learning goals!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payments Section */}
              {activeSection === "payments" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold flex items-center">
                        <CreditCard className="mr-2" size={24} />
                        Payment History
                      </h3>
                      <p className="text-green-200 mt-1">
                        {payments.length > 0 
                          ? `${payments.filter(p => p.status === 'confirmed').length} confirmed payments`
                          : 'No payment history found'
                        }
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
                        <Download className="mr-2" size={16} />
                        Invoice History
                      </button>
                    </div>
                  </div>
                  
                  {loadingPayments ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
                      <p className="text-green-200">Loading payment history...</p>
                    </div>
                  ) : payments.length > 0 ? (
                    <div className="grid gap-4">
                      {payments.map((payment, index) => (
                        <motion.div
                          key={payment.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="group"
                        >
                          <div className="p-4 rounded-lg bg-green-700/30 border border-green-600/30 hover:bg-green-700/50 transition-all duration-300 group-hover:scale-[1.02]">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-bold text-lg flex items-center">
                                    <CreditCard className="mr-2" size={20} />
                                    Tuition Payment #{payment.id.slice(-6)}
                                  </h4>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    payment.status === "confirmed" 
                                      ? "bg-green-900/50 text-green-300" 
                                      : payment.status === "rejected"
                                      ? "bg-red-900/50 text-red-300"
                                      : "bg-yellow-900/50 text-yellow-300"
                                  }`}>
                                    {payment.status === "confirmed" ? "✅ Confirmed" : 
                                     payment.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div className="space-y-2">
                                    <div className="flex items-center text-green-200">
                                      <Calendar size={14} className="mr-2" />
                                      <span>Date: {formatDate(payment.payment_date)}</span>
                                    </div>
                                    <div className="flex items-center text-green-200">
                                      <CreditCard size={14} className="mr-2" />
                                      <span>Method: {payment.payment_method}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-center text-green-200">
                                      <DollarSign size={14} className="mr-2" />
                                      <span>Amount: ${payment.amount}</span>
                                    </div>
                                    {payment.due_date && (
                                      <div className="flex items-center text-green-200">
                                        <Clock size={14} className="mr-2" />
                                        <span>Due: {formatDate(payment.due_date)}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    {payment.transaction_code && (
                                      <div className="flex items-center text-green-200">
                                        <ShieldCheck size={14} className="mr-2" />
                                        <span>Ref: {payment.transaction_code}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-4 flex space-x-2">
                              <button className="text-sm bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
                                <Download className="mr-2" size={16} />
                                Download Receipt
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <CreditCard size={64} className="mx-auto text-green-400 mb-4" />
                      <h4 className="text-xl font-semibold mb-2">No Payment History</h4>
                      <p className="text-green-200 mb-4">Your payment records will appear here.</p>
                      <div className="bg-green-800/30 p-4 rounded-lg max-w-md mx-auto">
                        <p className="text-sm text-green-300">
                          💳 <strong>Need to make a payment?</strong> Contact support for assistance with tuition payments.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Exams Section */}
              {activeSection === "exams" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold flex items-center">
                        <ClipboardList className="mr-2" size={24} />
                        Exams & Assessments
                      </h3>
                      <p className="text-green-200 mt-1">
                        Track your exam progress and preparation
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-center py-12">
                    <ClipboardList size={64} className="mx-auto text-green-400 mb-4" />
                    <h4 className="text-xl font-semibold mb-2">Exams Feature Coming Soon</h4>
                    <p className="text-green-200">
                      The exams section is currently under development and will be available soon.
                    </p>
                    <div className="bg-green-800/30 p-4 rounded-lg max-w-md mx-auto mt-4">
                      <p className="text-sm text-green-300">
                        🎯 <strong>Stay tuned!</strong> We're working on comprehensive exam tracking and preparation tools.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center text-green-300 text-sm"
          >
            <p>Madrasa Learning Platform • {new Date().getFullYear()} • v2.1.0</p>
            <p className="mt-1">Designed for excellence in Islamic education</p>
          </motion.footer>
        </div>
      </div>
    </div>
  );
}
