// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { makeApiRequest } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  RefreshCcw,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Loader2,
  TrendingUp,
  Video,
  MessageCircle,
  ShieldCheck
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { toast } from 'react-toastify';

// === UTILITY FUNCTIONS ===
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

const uploadAudioToSupabase = async (audioBlob, fileName) => {
  try {
    const audioFile = new File([audioBlob], fileName, { 
      type: 'audio/wav',
      lastModified: Date.now()
    });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('User not authenticated. Please login again.');
    }

    const { data, error } = await supabase.storage
      .from('assignment-audio') 
      .upload(fileName, audioFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'audio/wav'
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('assignment-audio')
      .getPublicUrl(fileName);

    return {
      storagePath: data.path,
      publicUrl: urlData.publicUrl
    };

  } catch (error) {
    console.error('❌ [Upload] Upload process failed:', error);
    throw error;
  }
};

// STUDENT API WITH DEBUGGING
const studentApi = {
  getMyNotifications: async (limit = 20, page = 1) => {
    try {
      console.log('🔔 [API] Starting to fetch notifications...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('❌ [API] User authentication failed:', userError);
        throw new Error('User not authenticated');
      }

      console.log('👤 [API] User ID:', user.id);

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: notifications, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('❌ [API] Supabase query error:', error);
        throw error;
      }

      console.log('✅ [API] Notifications fetched successfully:', {
        count: notifications?.length || 0,
        data: notifications
      });

      return {
        notifications: notifications || [],
        total: count || 0,
        page,
        limit,
        hasMore: (count || 0) > to + 1
      };
    } catch (error) {
      console.error('❌ [API] Error in getMyNotifications:', error);
      throw error;
    }
  },

  markAsRead: async (notificationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  markAllAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('read', false)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  getUnreadCount: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  clearAllNotifications: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  }
};

// === REACT COMPONENTS ===
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
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        preload="metadata" 
        crossOrigin="anonymous" 
        onError={(e) => {
          console.error('Audio loading error:', e);
        }}
      />
      
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
      let audioUrl = null;
      
      if (audioBlob) {
        const fileName = `assignment-${assignment.id}-${Date.now()}.webm`;
        const uploadResult = await uploadAudioToSupabase(audioBlob, fileName);
        audioUrl = uploadResult.publicUrl;
      }

      const submissionData = {
        assignment_id: assignment.id,
        submission_text: submissionText,
        audio_url: audioUrl
      };

      await onSubmit(submissionData);
      onClose();
    } catch (error) {
      console.error('❌ [Submission] Failed:', error);
      toast.error('Failed to submit assignment: ' + error.message);
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

// NOTIFICATIONS DROPDOWN COMPONENT
const NotificationsDropdown = ({ 
  isOpen, 
  onClose, 
  notifications, 
  onNotificationClick, 
  onMarkAllAsRead, 
  onClearAll, 
  onDeleteNotification 
}) => {
  const formatNotificationTime = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffMs = now - notificationTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return notificationTime.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-80 bg-green-800/95 backdrop-blur-lg border border-green-700/30 rounded-xl shadow-xl z-50">
      <div className="p-4 border-b border-green-700/30">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Notifications</h3>
          <div className="flex space-x-2">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-green-300 hover:text-white transition-colors"
            >
              Mark all read
            </button>
            <button
              onClick={onClearAll}
              className="text-xs text-red-300 hover:text-red-200 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-green-300 text-sm">
            <Bell size={32} className="mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
            <p className="text-xs mt-1">We'll notify you when something new arrives</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => onNotificationClick(notification)}
              className={`p-4 border-b border-green-700/30 cursor-pointer transition-colors hover:bg-green-700/50 ${
                !notification.read ? 'bg-green-700/30' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    {notification.title || 'Notification'}
                  </p>
                  <p className="text-green-300 text-xs mt-1">
                    {notification.message || 'No message content'}
                  </p>
                  <p className="text-green-400 text-xs mt-2">
                    {formatNotificationTime(notification.created_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => onDeleteNotification(notification.id, e)}
                  className="text-red-300 hover:text-red-200 transition-colors ml-2 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// === MAIN DASHBOARD COMPONENT ===
export default function Dashboard() {
  // State declarations
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [progressStats, setProgressStats] = useState({
    completionRate: 0,
    streak: 0,
    level: 1,
    points: 0,
    nextLevel: 100
  });

  // Enhanced notification fetch with debugging
  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      console.log('🔔 [Dashboard] Starting to fetch notifications...');
      const notificationsData = await studentApi.getMyNotifications();
      
      console.log('📨 [Dashboard] Notifications data received:', notificationsData);
      
      // Ensure we're setting an array
      const notificationsArray = Array.isArray(notificationsData?.notifications) 
        ? notificationsData.notifications 
        : [];
      
      console.log('📋 [Dashboard] Setting notifications state:', notificationsArray);
      setNotifications(notificationsArray);
      
    } catch (error) {
      console.error('❌ [Dashboard] Error fetching notifications:', error);
      setNotifications([]);
      toast.error('Failed to load notifications');
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Enhanced student data fetch
  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setStudentName(user.user_metadata?.full_name || 'Student');
        setUserEmailVerified(user.email_confirmed_at !== null);
        
        console.log('👤 [Dashboard] User authenticated:', user.id);
        
        // Fetch all data including notifications
        await Promise.all([
          fetchStatsData(),
          fetchClasses(),
          fetchAssignments(),
          fetchPayments(),
          fetchNotifications() // Make sure this is included
        ]);
      } else {
        console.error('❌ [Dashboard] No user found');
      }
    } catch (error) {
      console.error('❌ [Dashboard] Error fetching student data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced notification handlers
  const handleMarkAllAsRead = async () => {
    try {
      await studentApi.markAllAsRead();
      
      // Update local state
      setNotifications(prev => prev.map(notification => ({ 
        ...notification, 
        read: true 
      })));
      
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      console.log('📱 [Dashboard] Notification clicked:', notification);
      
      // Mark as read in database if not already read
      if (!notification.read) {
        await studentApi.markAsRead(notification.id);
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
      
      // Close notifications dropdown
      setIsNotificationsOpen(false);
      
      // Navigate based on notification type
      const data = notification.data || {};
      if (data.assignment_id) {
        setActiveSection('assignments');
      } else if (data.class_id) {
        setActiveSection('classes');
      } else if (data.payment_id) {
        setActiveSection('payments');
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      // Still navigate even if marking as read fails
      setIsNotificationsOpen(false);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await studentApi.clearAllNotifications();
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation(); // Prevent triggering the notification click
    
    try {
      await studentApi.deleteNotification(notificationId);
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // Keep your existing API functions (fetchStatsData, fetchClasses, fetchAssignments, fetchPayments)
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
      setClasses(Array.isArray(classesData) ? classesData : classesData?.classes || []);
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
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : assignmentsData?.assignments || []);
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
      setPayments(Array.isArray(paymentsData) ? paymentsData : paymentsData?.payments || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Format date and time functions
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeUntilClass = (classDate) => {
    const now = new Date();
    const classTime = new Date(classDate);
    const diffMs = classTime - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return { status: 'completed', text: 'Class completed' };
    } else if (diffMins <= 0) {
      return { status: 'started', text: 'Class in progress' };
    } else if (diffMins < 60) {
      return { status: 'upcoming', text: `Starts in ${diffMins} minutes` };
    } else if (diffHours < 24) {
      return { status: 'upcoming', text: `Starts in ${diffHours} hours` };
    } else {
      return { status: 'upcoming', text: `Starts in ${diffDays} days` };
    }
  };

  // Event handlers
  const handleSubmitAssignment = async (submissionData) => {
    try {
      const result = await makeApiRequest('/api/student/submit-assignment', {
        method: 'POST',
        body: submissionData
      });

      if (result.success) {
        toast.success('Assignment submitted successfully!');
        await fetchAssignments();
      } else {
        throw new Error(result.error || 'Failed to submit assignment');
      }
    } catch (error) {
      console.error('Error submitting assignment:', error);
      throw error;
    }
  };

  const handleJoinClass = (classItem) => {
    if (classItem.video_session?.meeting_url) {
      window.open(classItem.video_session.meeting_url, '_blank');
    } else {
      toast.error('Meeting link not available');
    }
  };

  const handleSendMessage = async () => {
    if (!contactMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSendingMessage(true);
    try {
      const result = await makeApiRequest('/api/student/contact-teacher', {
        method: 'POST',
        body: { message: contactMessage }
      });

      if (result.success) {
        toast.success('Message sent to teacher!');
        setContactMessage('');
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
      setIsLoggingOut(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: (await supabase.auth.getUser()).data.user?.email,
      });

      if (error) throw error;
      setEmailSent(true);
      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      console.error('Error resending verification:', error);
      toast.error('Failed to send verification email');
    } finally {
      setResendingEmail(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchStudentData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-refresh notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-green-300" size={48} />
          <p className="text-green-200 mt-4 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex">
      {/* Email verification banner */}
      {!userEmailVerified && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-600 text-white px-4 py-3 z-50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-2 md:mb-0">
              <AlertCircle className="mr-2" size={20} />
              <span>Please verify your email address to access all features.</span>
            </div>
            <button
              onClick={handleResendVerification}
              disabled={resendingEmail || emailSent}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {resendingEmail ? 'Sending...' : emailSent ? 'Email Sent!' : 'Resend Verification'}
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-green-800/90 backdrop-blur-lg transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-green-700/30">
            <h1 className="text-2xl font-bold text-white">Madina Quran Classes</h1>
            <p className="text-green-300 text-sm">Student Dashboard</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {[
              { id: "classes", label: "My Classes", icon: Video },
              { id: "assignments", label: "Assignments", icon: FileText },
              { id: "exams", label: "Exams & Tests", icon: ClipboardList },
              { id: "payments", label: "Payments", icon: CreditCard },
              { id: "progress", label: "My Progress", icon: TrendingUp },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeSection === item.id
                    ? "bg-green-700 text-white shadow-lg"
                    : "text-green-200 hover:bg-green-700/50 hover:text-white"
                }`}
              >
                <item.icon className="mr-3" size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-green-700/30">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-700/30">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{studentName}</p>
                <p className="text-green-300 text-xs truncate">Student</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-0">
        <header className="bg-green-800/50 backdrop-blur-lg border-b border-green-700/30 sticky top-0 z-30">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="md:hidden p-2 rounded-lg bg-green-700/50 hover:bg-green-600/50 transition-colors"
                >
                  {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
                <h2 className="text-2xl font-bold text-white capitalize">
                  {activeSection === 'classes' && 'My Classes'}
                  {activeSection === 'assignments' && 'Assignments'}
                  {activeSection === 'exams' && 'Exams & Tests'}
                  {activeSection === 'payments' && 'Payments'}
                  {activeSection === 'progress' && 'My Progress'}
                </h2>
              </div>

              <div className="flex items-center space-x-4">
                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="relative p-2 rounded-lg bg-green-700/50 hover:bg-green-600/50 transition-colors"
                  >
                    <Bell size={20} />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {notifications.filter(n => !n.read).length}
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  <NotificationsDropdown
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(false)}
                    notifications={notifications}
                    onNotificationClick={handleNotificationClick}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onClearAll={handleClearAllNotifications}
                    onDeleteNotification={handleDeleteNotification}
                  />
                </div>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-3 p-2 rounded-lg bg-green-700/50 hover:bg-green-600/50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                    <ChevronDown size={16} className="text-green-300" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-green-800/95 backdrop-blur-lg border border-green-700/30 rounded-xl shadow-xl z-50">
                      <div className="p-2">
                        <button className="w-full flex items-center px-3 py-2 text-sm text-green-200 hover:bg-green-700/50 rounded-lg transition-colors">
                          <Settings className="mr-2" size={16} />
                          Settings
                        </button>
                        <button
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                          className="w-full flex items-center px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isLoggingOut ? (
                            <Loader2 className="animate-spin mr-2" size={16} />
                          ) : (
                            <LogOut className="mr-2" size={16} />
                          )}
                          {isLoggingOut ? 'Logging out...' : 'Logout'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-green-800/30 backdrop-blur-lg border border-green-700/30 rounded-xl p-6 hover:bg-green-800/50 transition-all duration-300 hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-300 text-sm font-medium">{stat.label}</p>
                    <p className="text-white text-2xl font-bold mt-2">{stat.value}</p>
                    <p className="text-green-400 text-xs mt-1">{stat.change} from last week</p>
                  </div>
                  <div className="p-3 bg-green-700/50 rounded-lg">
                    <stat.icon className="text-green-300" size={24} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Progress Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-green-800/30 backdrop-blur-lg border border-green-700/30 rounded-xl p-6 mb-8"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <TrendingUp className="mr-2" size={24} />
              Learning Progress
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-700/30 rounded-lg">
                <div className="text-2xl font-bold text-white">{progressStats.completionRate}%</div>
                <div className="text-green-300 text-sm">Completion Rate</div>
              </div>
              <div className="text-center p-4 bg-green-700/30 rounded-lg">
                <div className="text-2xl font-bold text-white">{progressStats.streak} days</div>
                <div className="text-green-300 text-sm">Learning Streak</div>
              </div>
              <div className="text-center p-4 bg-green-700/30 rounded-lg">
                <div className="text-2xl font-bold text-white">Level {progressStats.level}</div>
                <div className="text-green-300 text-sm">Current Level</div>
              </div>
              <div className="text-center p-4 bg-green-700/30 rounded-lg">
                <div className="text-2xl font-bold text-white">{progressStats.points} pts</div>
                <div className="text-green-300 text-sm">{progressStats.nextLevel} to next level</div>
              </div>
            </div>
          </motion.div>

          {/* Dynamic Content Sections */}
          <AnimatePresence mode="wait">
            {activeSection === 'classes' && (
              <motion.section
                key="classes"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-white">My Classes</h3>
                  <button 
                    onClick={fetchClasses}
                    className="bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200"
                  >
                    <RefreshCw className="mr-2" size={16} />
                    Refresh
                  </button>
                </div>

                {loadingClasses ? (
                  <div className="text-center py-12">
                    <Loader2 className="animate-spin mx-auto text-green-300" size={32} />
                    <p className="text-green-200 mt-4">Loading classes...</p>
                  </div>
                ) : classes.length === 0 ? (
                  <div className="text-center py-12 bg-green-800/30 rounded-xl">
                    <Video className="mx-auto text-green-400" size={48} />
                    <h4 className="text-white text-xl font-semibold mt-4">No classes scheduled</h4>
                    <p className="text-green-300 mt-2">Your upcoming classes will appear here.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {classes.map((classItem) => (
                      <ClassItem
                        key={classItem.id}
                        classItem={classItem}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        getTimeUntilClass={getTimeUntilClass}
                        joinClass={handleJoinClass}
                      />
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {activeSection === 'assignments' && (
              <motion.section
                key="assignments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-white">Assignments</h3>
                  <div className="flex space-x-3">
                    <select className="bg-green-800/50 border border-green-700/30 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent">
                      <option>All Status</option>
                      <option>Pending</option>
                      <option>Submitted</option>
                      <option>Graded</option>
                    </select>
                    <button 
                      onClick={fetchAssignments}
                      className="bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200"
                    >
                      <RefreshCw className="mr-2" size={16} />
                      Refresh
                    </button>
                  </div>
                </div>

                {loadingAssignments ? (
                  <div className="text-center py-12">
                    <Loader2 className="animate-spin mx-auto text-green-300" size={32} />
                    <p className="text-green-200 mt-4">Loading assignments...</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-12 bg-green-800/30 rounded-xl">
                    <FileText className="mx-auto text-green-400" size={48} />
                    <h4 className="text-white text-xl font-semibold mt-4">No assignments</h4>
                    <p className="text-green-300 mt-2">Your assignments will appear here.</p>
                  </div>
                ) : (
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
                )}
              </motion.section>
            )}

            {activeSection === 'payments' && (
              <motion.section
                key="payments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <h3 className="text-2xl font-bold text-white">Payment History</h3>
                
                {loadingPayments ? (
                  <div className="text-center py-12">
                    <Loader2 className="animate-spin mx-auto text-green-300" size={32} />
                    <p className="text-green-200 mt-4">Loading payments...</p>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-12 bg-green-800/30 rounded-xl">
                    <CreditCard className="mx-auto text-green-400" size={48} />
                    <h4 className="text-white text-xl font-semibold mt-4">No payment history</h4>
                    <p className="text-green-300 mt-2">Your payment records will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-green-800/30 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-green-700/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-green-300 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-green-300 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-green-300 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-green-300 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-700/30">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-green-700/20 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                              {formatDate(payment.created_at)}
                            </td>
                            <td className="px-6 py-4 text-sm text-green-200">
                              {payment.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                              ${payment.amount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                payment.status === 'completed' 
                                  ? 'bg-green-900/50 text-green-300'
                                  : payment.status === 'pending'
                                  ? 'bg-yellow-900/50 text-yellow-300'
                                  : 'bg-red-900/50 text-red-300'
                              }`}>
                                {payment.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.section>
            )}

            {activeSection === 'progress' && (
              <motion.section
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <h3 className="text-2xl font-bold text-white">Detailed Progress</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-green-800/30 backdrop-blur-lg border border-green-700/30 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Weekly Activity</h4>
                    <div className="h-64 flex items-center justify-center text-green-300">
                      Activity chart will be implemented here
                    </div>
                  </div>
                  <div className="bg-green-800/30 backdrop-blur-lg border border-green-700/30 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Subject Performance</h4>
                    <div className="h-64 flex items-center justify-center text-green-300">
                      Performance chart will be implemented here
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Contact Teacher Section */}
          {hasTeacher && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
              className="mt-8 bg-green-800/30 backdrop-blur-lg border border-green-700/30 rounded-xl p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <Mail className="mr-2" size={24} />
                Contact Your Teacher
              </h3>
              <div className="space-y-4">
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Type your message to the teacher here..."
                  rows="4"
                  className="w-full p-4 rounded-lg bg-green-800/50 border border-green-700/30 text-white placeholder-green-300 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !contactMessage.trim()}
                    className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-6 rounded-lg flex items-center transition-all duration-200"
                  >
                    {sendingMessage ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2" size={16} />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
