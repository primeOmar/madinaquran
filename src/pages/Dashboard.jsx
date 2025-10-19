// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { studentApi } from "../lib/studentApi";
import {
  FileText,
  CreditCard,
  ClipboardList,
  BookOpen,
  Clock,
  User,
  Calendar,
  Award,
  RefreshCw,
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
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Loader2,
  TrendingUp,
  Video,
  MessageCircle,
  ShieldCheck,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Crown
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

// === STUDENT VIDEO CALL COMPONENT ===
const StudentVideoCall = ({ classItem, isOpen, onClose }) => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [teacherStream, setTeacherStream] = useState(null);
  const localVideoRef = useRef(null);
  const teacherVideoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      initializeCall();
      startTimer();
      fetchParticipants();
    } else {
      cleanupCall();
    }

    return () => {
      cleanupCall();
    };
  }, [isOpen]);

  const initializeCall = async () => {
    try {
      setIsConnecting(true);
      
      // Get user media with error handling
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connect to actual video session
      await connectToVideoSession();

    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast.error('Could not access camera/microphone. Please check permissions.');
      setIsConnecting(false);
    }
  };

  const connectToVideoSession = async () => {
    try {
      // Simulate connecting to teacher's stream
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
        
        // Simulate teacher stream (in production, this would be real)
        const teacherStream = new MediaStream();
        setTeacherStream(teacherStream);
        
        if (teacherVideoRef.current) {
          teacherVideoRef.current.srcObject = teacherStream;
        }
        
        toast.success('Connected to class successfully!');
      }, 2000);

    } catch (error) {
      console.error('Error connecting to video session:', error);
      toast.error('Failed to connect to class session');
      setIsConnecting(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      // Simulate fetching participants
      setParticipants([
        { name: classItem.teacher_name || 'Teacher', role: 'teacher', isOnline: true },
        { name: 'You', role: 'student', isOnline: true }
      ]);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (teacherStream) {
      teacherStream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCallDuration(0);
    setIsConnected(false);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
      toast.info(isAudioMuted ? 'Microphone on' : 'Microphone muted');
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
      toast.info(isVideoOff ? 'Camera on' : 'Camera off');
    }
  };

  const leaveCall = async () => {
    try {
      // Record student leaving in database
      await supabase
        .from('session_participants')
        .update({ 
          left_at: new Date().toISOString(),
          status: 'left'
        })
        .eq('session_id', classItem.video_session?.id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    } catch (error) {
      console.error('Error leaving call:', error);
    } finally {
      cleanupCall();
      onClose();
      toast.info('You left the class');
    }
  };

  const raiseHand = () => {
    toast.info('Hand raised! Teacher will be notified.');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-green-800 text-white p-4 flex justify-between items-center border-b border-green-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-sm">{isConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
          <div className="h-6 w-px bg-green-600"></div>
          <div>
            <h2 className="text-xl font-bold">{classItem.title}</h2>
            <p className="text-green-200 text-sm">
              {classItem.teacher_name} • Duration: {formatTime(callDuration)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-green-700 px-3 py-1 rounded-full text-sm">
            {participants.length} online
          </div>
          <button
            onClick={leaveCall}
            className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
          >
            <PhoneOff size={18} className="mr-2" />
            Leave Class
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 bg-gray-900 relative p-6">
        {isConnecting ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="animate-spin mx-auto text-green-400" size={48} />
              <p className="text-white mt-4 text-lg font-semibold">Connecting to Class</p>
              <p className="text-gray-400 mt-2">Please wait while we connect you to {classItem.teacher_name}</p>
              <div className="mt-4 flex justify-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Teacher's Video - Main */}
            <div className="lg:col-span-2 bg-gray-800 rounded-xl relative overflow-hidden border-2 border-green-500">
              <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 to-transparent"></div>
              <video
                ref={teacherVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded-lg backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <User size={16} className="text-green-400" />
                  <span className="font-medium">{classItem.teacher_name}</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-300 text-sm">LIVE</span>
                </div>
              </div>
              {!teacherStream && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <User size={64} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-semibold">Waiting for Teacher</p>
                    <p className="text-gray-400">Teacher's video will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Student's Video & Controls */}
            <div className="space-y-6">
              {/* Student Video */}
              <div className="bg-gray-800 rounded-xl relative overflow-hidden border border-green-600/30">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-48 object-cover"
                />
                <div className="absolute bottom-3 left-3 bg-black/70 text-white px-2 py-1 rounded text-sm backdrop-blur-sm">
                  You {isVideoOff ? '(Camera Off)' : ''}
                </div>
                {isVideoOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <CameraOff size={32} className="text-gray-500" />
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-4">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Controls</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={toggleAudio}
                    className={`flex items-center justify-center space-x-2 py-3 rounded-lg transition-all duration-200 ${
                      isAudioMuted 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    <span className="text-sm">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
                  </button>
                  
                  <button
                    onClick={toggleVideo}
                    className={`flex items-center justify-center space-x-2 py-3 rounded-lg transition-all duration-200 ${
                      isVideoOff 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {isVideoOff ? <CameraOff size={20} /> : <Camera size={20} />}
                    <span className="text-sm">{isVideoOff ? 'Camera On' : 'Camera Off'}</span>
                  </button>
                </div>

                <button
                  onClick={raiseHand}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  <span>Raise Hand</span>
                </button>
              </div>

              {/* Participants */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-3">
                  Participants ({participants.length})
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {participants.map((participant, index) => (
                    <div
                      key={index}
                      className={`flex items-center space-x-3 p-2 rounded-lg ${
                        participant.role === 'teacher' 
                          ? 'bg-green-900/30 border border-green-700/30' 
                          : 'bg-gray-700/50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        participant.isOnline ? 'bg-green-500' : 'bg-gray-500'
                      }`}></div>
                      <User size={16} className={
                        participant.role === 'teacher' ? 'text-green-400' : 'text-gray-400'
                      } />
                      <span className="text-white text-sm flex-1">
                        {participant.name}
                        {participant.role === 'teacher' && ' (Teacher)'}
                      </span>
                      {participant.role === 'teacher' && (
                        <Crown size={14} className="text-yellow-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex justify-center items-center space-x-6">
          <button
            onClick={toggleAudio}
            className={`flex flex-col items-center space-y-2 p-3 rounded-xl transition-all duration-200 ${
              isAudioMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
            <span className="text-white text-xs">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
          </button>
          
          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center space-y-2 p-3 rounded-xl transition-all duration-200 ${
              isVideoOff ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {isVideoOff ? <CameraOff size={24} /> : <Camera size={24} />}
            <span className="text-white text-xs">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
          </button>

          <button
            onClick={raiseHand}
            className="flex flex-col items-center space-y-2 p-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl transition-all duration-200"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
            <span className="text-white text-xs">Raise Hand</span>
          </button>

          <div className="h-8 w-px bg-gray-600"></div>

          <button
            onClick={leaveCall}
            className="flex flex-col items-center space-y-2 p-3 bg-red-600 hover:bg-red-500 rounded-xl transition-all duration-200"
          >
            <PhoneOff size={24} />
            <span className="text-white text-xs">Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced class sorting with video session integration
const sortClasses = (classes) => {
  if (!Array.isArray(classes)) return [];
  
  return classes.sort((a, b) => {
    const now = new Date();
    const classAStart = new Date(a.scheduled_date);
    const classAEnd = new Date(a.end_date);
    const classBStart = new Date(b.scheduled_date);
    const classBEnd = new Date(b.end_date);
    
    // Check if classes are live (current time is between start and end)
    const isALive = now >= classAStart && now <= classAEnd;
    const isBLive = now >= classBStart && now <= classBEnd;
    
    // Check if classes are upcoming (future start time)
    const isAUpcoming = classAStart > now;
    const isBUpcoming = classBStart > now;
    
    // Check if classes are completed (end time has passed)
    const isACompleted = classAEnd < now;
    const isBCompleted = classBEnd < now;
    
    // Priority: Live > Upcoming > Completed
    if (isALive && !isBLive) return -1;
    if (isBLive && !isALive) return 1;
    
    // Both live - sort by which ends sooner
    if (isALive && isBLive) {
      return classAEnd - classBEnd;
    }
    
    // Both upcoming - sort by which starts sooner
    if (isAUpcoming && isBUpcoming) {
      return classAStart - classBStart;
    }
    
    // One upcoming, one completed
    if (isAUpcoming && isBCompleted) return -1;
    if (isBUpcoming && isACompleted) return 1;
    
    // Both completed - sort by most recent
    if (isACompleted && isBCompleted) {
      return classBEnd - classAEnd;
    }
    
    return 0;
  });
};

// Enhanced getTimeUntilClass function
const getTimeUntilClass = (classDate, endDate) => {
  const now = new Date();
  const classTime = new Date(classDate);
  const classEnd = new Date(endDate);
  
  // Check if class is currently live (current time is between start and end)
  const isLive = now >= classTime && now <= classEnd;
  
  // Check if class is completed (end time has passed)
  const isCompleted = classEnd < now;
  
  // Check if class is upcoming (future start time)
  const isUpcoming = classTime > now;

  if (isLive) {
    const timeLeft = classEnd - now;
    const minsLeft = Math.floor(timeLeft / (1000 * 60));
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    
    if (minsLeft < 60) {
      return { status: 'live', text: `Live - Ends in ${minsLeft} minutes` };
    } else {
      return { status: 'live', text: `Live - Ends in ${hoursLeft} hours` };
    }
  } else if (isCompleted) {
    return { status: 'completed', text: 'Class completed' };
  } else {
    // Upcoming class
    const diffMs = classTime - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins <= 0) {
      return { status: 'starting', text: 'Starting now' };
    } else if (diffMins < 60) {
      return { status: 'upcoming', text: `Starts in ${diffMins} minutes` };
    } else if (diffHours < 24) {
      return { status: 'upcoming', text: `Starts in ${diffHours} hours` };
    } else {
      return { status: 'upcoming', text: `Starts in ${diffDays} days` };
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

const ClassItem = ({ classItem, formatDate, formatTime, getTimeUntilClass, onJoinClass }) => {
  const timeInfo = getTimeUntilClass(classItem.scheduled_date, classItem.end_date);
  const isClassLive = timeInfo.status === 'live';
  const isClassCompleted = timeInfo.status === 'completed';
  const isUpcoming = timeInfo.status === 'upcoming' || timeInfo.status === 'starting';

  const handleJoinClass = async () => {
    if (isClassLive) {
      await onJoinClass(classItem);
    }
  };

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
          : isClassLive
          ? 'bg-blue-900/30 border-blue-600/30 animate-pulse border-2'
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
                {isClassLive && (
                  <div className="flex items-center ml-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping mr-1"></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                )}
              </h4>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isClassCompleted 
                  ? 'bg-green-900/50 text-green-300'
                  : isClassLive
                  ? 'bg-red-900/50 text-red-300 animate-pulse'
                  : 'bg-yellow-900/50 text-yellow-300'
              }`}>
                {isClassCompleted ? 'Completed' : 
                 isClassLive ? 'Live Now' : 
                 'Upcoming'}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center mt-3 text-sm text-green-200">
              <span className="flex items-center mr-4 mb-2">
                <Clock size={14} className="mr-1" />
                {formatTime(classItem.scheduled_date)} - {formatTime(classItem.end_date)}
              </span>
              <span className="flex items-center mr-4 mb-2">
                <User size={14} className="mr-1" />
                {classItem.teacher_name || 'Teacher'}
                {isClassLive && (
                  <div className="w-2 h-2 bg-green-500 rounded-full ml-1 animate-pulse"></div>
                )}
              </span>
              <span className="flex items-center mr-4 mb-2">
                <Calendar size={14} className="mr-1" />
                {formatDate(classItem.scheduled_date)}
              </span>
            </div>
            
            <div className={`mt-2 text-sm ${
              isClassLive ? 'text-red-300 font-semibold' : 'text-green-300'
            }`}>
              {timeInfo.text}
              {isClassLive && (
                <span className="ml-2 text-green-300">• Teacher is live - Click to join!</span>
              )}
            </div>

            {/* Video Session Info */}
            {classItem.video_session && (
              <div className="mt-2 text-xs text-green-400 flex items-center">
                <ShieldCheck size={12} className="mr-1" />
                Meeting: {classItem.video_session.meeting_id}
                {classItem.video_session.channel_name && (
                  <span className="ml-2">• Channel: {classItem.video_session.channel_name}</span>
                )}
                {isClassLive && (
                  <span className="ml-2 text-red-400">• LIVE</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          {isClassLive && (
            <button 
              className="bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200 shadow-lg"
              onClick={handleJoinClass}
            >
              <PlayCircle size={16} className="mr-1"/>
              Join Live Class
            </button>
          )}
          
          {isUpcoming && (
            <button className="bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
              <Calendar size={16} className="mr-1"/>
              Add to Calendar
            </button>
          )}
          
          {isClassCompleted && classItem.video_session && (
            <button className="bg-purple-600 hover:bg-purple-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
              <Download size={16} className="mr-1"/>
              View Recording
            </button>
          )}
          
          <button className="bg-gray-600 hover:bg-gray-500 py-2 px-4 rounded-lg flex items-center transition-all duration-200">
            <MessageCircle size={16} className="mr-1"/>
            View Details
          </button>
        </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNotification(notification.id);
                  }}
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

// Live Class Card with Enhanced Join Button
const LiveClassCard = ({ classItem, formatDate, formatTime, getTimeUntilClass, onJoinClass }) => {
  const timeInfo = getTimeUntilClass(classItem.scheduled_date, classItem.end_date);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinClick = async () => {
    setIsJoining(true);
    try {
      await onJoinClass(classItem);
    } catch (error) {
      console.error('Error joining class:', error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden"
    >
      {/* Animated Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-red-700/20 animate-pulse rounded-2xl"></div>
      <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl blur opacity-30 animate-pulse"></div>
      
      <div className="relative bg-gray-900/90 backdrop-blur-lg border-2 border-red-500 rounded-2xl p-6">
        {/* Header with Live Badge */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            <h4 className="text-xl font-bold text-white flex items-center">
              <Video className="mr-2" size={24} />
              {classItem.title}
            </h4>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-semibold animate-pulse shadow-lg">
              🔴 LIVE NOW
            </span>
            <span className="px-3 py-1 bg-red-800/50 text-red-200 rounded-full text-xs">
              {timeInfo.text}
            </span>
          </div>
        </div>

        {/* Class Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center space-x-2 text-white">
            <Clock size={16} className="text-red-400" />
            <span className="text-sm">
              {formatTime(classItem.scheduled_date)} - {formatTime(classItem.end_date)}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-white">
            <User size={16} className="text-red-400" />
            <span className="text-sm">{classItem.teacher_name || 'Teacher'}</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          
          <div className="flex items-center space-x-2 text-white">
            <Calendar size={16} className="text-red-400" />
            <span className="text-sm">{formatDate(classItem.scheduled_date)}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-white">
            <ShieldCheck size={16} className="text-red-400" />
            <span className="text-sm">
              {classItem.video_session?.channel_name || 'Main Channel'}
            </span>
          </div>
        </div>

        {/* Video Session Info */}
        {classItem.video_session && (
          <div className="mb-6 p-4 bg-red-900/30 rounded-lg border border-red-700/30">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center space-x-2 text-red-200">
                <Video size={14} />
                <span>Meeting: {classItem.video_session.meeting_id}</span>
              </div>
              {classItem.video_session.agenda && (
                <div className="flex items-center space-x-2 text-red-200">
                  <FileText size={14} />
                  <span>Agenda: {classItem.video_session.agenda}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Primary Join Button */}
          <button 
            onClick={handleJoinClick}
            disabled={isJoining}
            className="flex-1 min-w-[200px] bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 py-4 px-6 rounded-xl flex items-center justify-center space-x-3 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {isJoining ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span className="text-lg font-semibold">Joining Class...</span>
              </>
            ) : (
              <>
                <PlayCircle size={24} />
                <span className="text-lg font-semibold">Join Live Class</span>
              </>
            )}
          </button>

          {/* Secondary Actions */}
          <button className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center space-x-2 transition-all duration-200">
            <Calendar size={18} />
            <span>Add to Calendar</span>
          </button>
          
          <button className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center space-x-2 transition-all duration-200">
            <MessageCircle size={18} />
            <span>View Details</span>
          </button>
        </div>

        {/* Quick Status */}
        <div className="mt-4 flex items-center justify-between text-xs text-red-300">
          <span>🎯 Teacher is currently live and waiting</span>
          <span>⏱️ Class ends in {timeInfo.text.split('Ends in ')[1]}</span>
        </div>
      </div>
    </motion.div>
  );
};

// Upcoming Class Card
const UpcomingClassCard = ({ classItem, formatDate, formatTime, getTimeUntilClass }) => {
  const timeInfo = getTimeUntilClass(classItem.scheduled_date, classItem.end_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="p-6 rounded-xl bg-blue-900/20 border border-blue-700/30 hover:bg-blue-900/30 transition-all duration-300"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            <Video className="text-blue-400" size={20} />
            <h4 className="font-bold text-lg text-white">{classItem.title}</h4>
            <span className="px-3 py-1 bg-blue-800/50 text-blue-300 rounded-full text-xs">
              {timeInfo.text}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-blue-200">
            <span className="flex items-center space-x-1">
              <Clock size={14} />
              <span>{formatTime(classItem.scheduled_date)} - {formatTime(classItem.end_date)}</span>
            </span>
            <span className="flex items-center space-x-1">
              <User size={14} />
              <span>{classItem.teacher_name || 'Teacher'}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar size={14} />
              <span>{formatDate(classItem.scheduled_date)}</span>
            </span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all duration-200">
            Add to Calendar
          </button>
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-all duration-200">
            View Details
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Completed Class Card
const CompletedClassCard = ({ classItem, formatDate, formatTime, getTimeUntilClass }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-xl bg-green-900/20 border border-green-700/30"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            <Video className="text-green-400" size={20} />
            <h4 className="font-bold text-lg text-white">{classItem.title}</h4>
            <span className="px-3 py-1 bg-green-800/50 text-green-300 rounded-full text-xs">
              Completed
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-green-200">
            <span className="flex items-center space-x-1">
              <Clock size={14} />
              <span>{formatTime(classItem.scheduled_date)} - {formatTime(classItem.end_date)}</span>
            </span>
            <span className="flex items-center space-x-1">
              <User size={14} />
              <span>{classItem.teacher_name || 'Teacher'}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar size={14} />
              <span>{formatDate(classItem.scheduled_date)}</span>
            </span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {classItem.video_session && (
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-all duration-200">
              View Recording
            </button>
          )}
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-all duration-200">
            View Details
          </button>
        </div>
      </div>
    </motion.div>
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
  const [selectedClassForCall, setSelectedClassForCall] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [progressStats, setProgressStats] = useState({
    completionRate: 0,
    streak: 0,
    level: 1,
    points: 0,
    nextLevel: 100
  });

  // Enhanced student data fetch with new API
 const fetchStudentData = async () => {
  setLoading(true);
  try {
    console.log('🔄 Fetching dashboard data using studentApi...');
    
    const dashboardData = await studentApi.getDashboardData();
    
    setStudentName(dashboardData.student.name);
    setUserEmailVerified(true);
    
    // Set all the data from the API
    setClasses(sortClasses(dashboardData.classes));
    setAssignments(dashboardData.assignments);
    setNotifications(dashboardData.notifications);
    setHasTeacher(dashboardData.hasTeacher);
    
    // Transform stats for the frontend
    const statsArray = [
      { 
        label: "Total Classes", 
        value: dashboardData.stats.total_classes?.toString() || "0", 
        icon: BookOpen, 
        change: "+0" 
      },
      { 
        label: "Hours Learned", 
        value: dashboardData.stats.hours_learned?.toString() || "0", 
        icon: Clock, 
        change: "+0" 
      },
      { 
        label: "Assignments", 
        value: dashboardData.stats.assignments?.toString() || "0", 
        icon: FileText, 
        change: "+0" 
      },
      { 
        label: "Avg. Score", 
        value: `${dashboardData.stats.avg_score || "0"}%`, 
        icon: BarChart3, 
        change: "+0%" 
      },
    ];
    
    setStats(statsArray);

    setProgressStats({
      completionRate: dashboardData.stats.completion_rate || 0,
      streak: dashboardData.stats.streak || 0,
      level: dashboardData.stats.level || 1,
      points: dashboardData.stats.points || 0,
      nextLevel: dashboardData.stats.next_level || 100
    });

    console.log('✅ Dashboard data loaded successfully via studentApi');

  } catch (error) {
    console.error('❌ [Dashboard] Error fetching student data:', error);
    toast.error('Failed to load dashboard data');
  } finally {
    setLoading(false);
  }
};

  const fetchStatsData = async () => {
  setLoadingStats(true);
  try {
    console.log('🔄 Fetching stats via studentApi...');
    const statsData = await studentApi.getMyStats();
    
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
      completionRate: statsData.completion_rate || 0,
      streak: statsData.streak || 0,
      level: statsData.level || 1,
      points: statsData.points || 0,
      nextLevel: statsData.next_level || 100
    });
    
    console.log('✅ Stats fetched successfully');
  } catch (error) {
    console.error('Error fetching stats:', error);
  } finally {
    setLoadingStats(false);
  }
};

  // Enhanced notification fetch
  const fetchNotifications = async () => {
  setLoadingNotifications(true);
  try {
    console.log('🔄 Fetching notifications via studentApi...');
    const notificationsData = await studentApi.getMyNotifications();
    setNotifications(notificationsData.notifications || []);
    console.log('✅ Notifications fetched successfully');
  } catch (error) {
    console.error('❌ [Dashboard] Error fetching notifications:', error);
    setNotifications([]);
    toast.error('Failed to load notifications');
  } finally {
    setLoadingNotifications(false);
  }
};

// Enhanced notification handlers using studentApi
const handleMarkAllAsRead = async () => {
  try {
    await studentApi.markAllNotificationsAsRead();
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
    if (!notification.read) {
      await studentApi.markNotificationAsRead(notification.id);
    }

    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );
    
    setIsNotificationsOpen(false);
    
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
  event.stopPropagation();
  
  try {
    await studentApi.deleteNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    toast.success('Notification deleted');
  } catch (error) {
    console.error('Error deleting notification:', error);
    toast.error('Failed to delete notification');
  }
};

  // Fetch individual data functions
 const fetchClasses = async () => {
  setLoadingClasses(true);
  try {
    console.log('🔄 Fetching classes via studentApi...');
    const classesData = await studentApi.getMyClasses();
    setClasses(sortClasses(classesData.classes || []));
    console.log('✅ Classes fetched successfully');
  } catch (error) {
    console.error('Error fetching classes:', error);
    setClasses([]);
    toast.error('Failed to load classes');
  } finally {
    setLoadingClasses(false);
  }
};

const fetchAssignments = async () => {
  setLoadingAssignments(true);
  try {
    console.log('🔄 Fetching assignments via studentApi...');
    const assignmentsData = await studentApi.getMyAssignments();
    setAssignments(assignmentsData.assignments || []);
    console.log('✅ Assignments fetched successfully');
  } catch (error) {
    console.error('Error fetching assignments:', error);
    setAssignments([]);
    toast.error('Failed to load assignments');
  } finally {
    setLoadingAssignments(false);
  }
};

  const fetchPayments = async () => {
  setLoadingPayments(true);
  try {
    console.log('🔄 Fetching payments via studentApi...');
    const paymentsData = await studentApi.getMyPayments();
    setPayments(paymentsData);
    console.log('✅ Payments fetched successfully');
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

  // Event handlers
 const handleSubmitAssignment = async (submissionData) => {
  try {
    console.log('🔄 Submitting assignment via studentApi...');
    const result = await studentApi.submitAssignment(submissionData);

    if (result.success) {
      toast.success('Assignment submitted successfully!');
      // Refresh assignments data
      const assignmentsData = await studentApi.getMyAssignments();
      setAssignments(assignmentsData.assignments || []);
      console.log('✅ Assignment submitted successfully');
    } else {
      throw new Error(result.error || 'Failed to submit assignment');
    }
  } catch (error) {
    console.error('Error submitting assignment:', error);
    throw error;
  }
};


  // Enhanced join class function with video call integration
  const handleJoinClass = async (classItem) => {
  try {
    if (!classItem.video_session?.meeting_id) {
      toast.error('No active video session for this class');
      return;
    }

    console.log('🔄 Joining video session via studentApi...');
    const result = await studentApi.joinVideoSession(classItem.video_session.meeting_id);
    
    if (result) {
      // Set the class for video call and open the call interface
      setSelectedClassForCall(classItem);
      setShowVideoCall(true);
      toast.success('Joining class session...');
    }
  } catch (error) {
    console.error('Error joining class:', error);
    toast.error(error.message || 'Failed to join class. Please try again.');
  }
};

  const handleSendMessage = async () => {
  if (!contactMessage.trim()) {
    toast.error('Please enter a message');
    return;
  }

  setSendingMessage(true);
  try {
    console.log('🔄 Sending message via studentApi...');
    await studentApi.contactAdmin(contactMessage);
    toast.success('Message sent to admin successfully!');
    setContactMessage('');
    console.log('✅ Message sent successfully');
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

  // Auto-refresh classes and notifications
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeSection === 'classes') {
        fetchClasses();
      }
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [activeSection]);

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
      {/* Video Call Component */}
      {showVideoCall && selectedClassForCall && (
        <StudentVideoCall
          classItem={selectedClassForCall}
          isOpen={showVideoCall}
          onClose={() => {
            setShowVideoCall(false);
            setSelectedClassForCall(null);
          }}
        />
      )}

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
            // === ENHANCED CLASSES SECTION ===
{activeSection === 'classes' && (
  <motion.section
    key="classes"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    {/* Header with Live Indicator */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center space-x-4">
        <h3 className="text-2xl font-bold text-white">My Classes</h3>
        
        {/* Live Classes Counter */}
        {classes.filter(classItem => {
  const now = new Date();
  const start = new Date(classItem.scheduled_date);
  const end = new Date(classItem.end_date);
  return now >= start && now <= end;
}).length > 0 && (
          <div className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 rounded-full shadow-lg animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
            <span className="text-white text-sm font-semibold">
              {classes.filter(classItem => {
                const now = new Date();
                const start = new Date(classItem.scheduled_date);
                const end = new Date(classItem.end_date);
                return now >= start && now <= end;
              }).length} Class{classes.filter(classItem => {
                const now = new Date();
                const start = new Date(classItem.scheduled_date);
                const end = new Date(classItem.end_date);
                return now >= start && now <= end;
              }).length > 1 ? 'es' : ''} Live Now
            </span>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-3">
        {/* Status Filter */}
        <select 
          onChange={(e) => {
            // Add filter logic here if needed
            console.log('Filter:', e.target.value);
          }}
          className="bg-green-800/50 border border-green-600/30 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
        >
          <option value="all">All Classes</option>
          <option value="live">Live Now</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
        
        <button 
          onClick={fetchClasses}
          disabled={loadingClasses}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 py-2 px-4 rounded-lg flex items-center transition-all duration-200 shadow-lg"
        >
          <RefreshCw className={`mr-2 ${loadingClasses ? 'animate-spin' : ''}`} size={16} />
          {loadingClasses ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>

    {/* Loading State */}
    {loadingClasses ? (
      <div className="text-center py-12 bg-green-800/20 rounded-2xl backdrop-blur-sm">
        <Loader2 className="animate-spin mx-auto text-green-300" size={32} />
        <p className="text-green-200 mt-4 text-lg">Loading your classes...</p>
        <p className="text-green-400 text-sm mt-2">Checking for live sessions</p>
      </div>
    ) : classes.length === 0 ? (
      <div className="text-center py-16 bg-green-800/20 rounded-2xl backdrop-blur-sm border border-green-700/30">
        <Video className="mx-auto text-green-400 mb-4" size={64} />
        <h4 className="text-white text-2xl font-semibold mb-2">No classes scheduled</h4>
        <p className="text-green-300 text-lg mb-6">Your upcoming classes will appear here</p>
        <button 
          onClick={fetchClasses}
          className="bg-green-600 hover:bg-green-500 py-3 px-6 rounded-lg transition-all duration-200"
        >
          Check for Classes
        </button>
      </div>
    ) : (
      <div className="space-y-8">
        {/* Live Classes Section - PRIORITY */}
        {classes.filter(classItem => {
          const now = new Date();
          const start = new Date(classItem.scheduled_date);
          const end = new Date(classItem.end_date);
          return now >= start && now <= end;
        }).length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
              <h4 className="text-xl font-bold text-white bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 rounded-lg">
                🔴 Live Classes - Join Now!
              </h4>
            </div>
            
            <div className="grid gap-6">
              {classes
                .filter(classItem => {
                  const now = new Date();
                  const start = new Date(classItem.scheduled_date);
                  const end = new Date(classItem.end_date);
                  return now >= start && now <= end;
                })
                .map((classItem) => (
                  <LiveClassCard
                    key={classItem.id}
                    classItem={classItem}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getTimeUntilClass={getTimeUntilClass}
                    onJoinClass={handleJoinClass}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Upcoming Classes Section */}
        {classes.filter(classItem => new Date(classItem.scheduled_date) > new Date()).length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 rounded-lg">
              ⏰ Upcoming Classes
            </h4>
            <div className="grid gap-4">
              {classes
                .filter(classItem => new Date(classItem.scheduled_date) > new Date())
                .map((classItem) => (
                  <UpcomingClassCard
                    key={classItem.id}
                    classItem={classItem}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getTimeUntilClass={getTimeUntilClass}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Completed Classes Section */}
        {classes.filter(classItem => new Date(classItem.end_date) < new Date()).length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-700 px-4 py-2 rounded-lg">
              ✅ Completed Classes
            </h4>
            <div className="grid gap-4">
              {classes
                .filter(classItem => new Date(classItem.end_date) < new Date())
                .map((classItem) => (
                  <CompletedClassCard
                    key={classItem.id}
                    classItem={classItem}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getTimeUntilClass={getTimeUntilClass}
                  />
                ))}
            </div>
          </div>
        )}
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
