import { useState, useRef, useEffect } from 'react';
import { 
  FileText, Download, Upload, Mic, Square, Play, Pause, 
  Trash2, CheckCircle, AlertCircle, Loader2 
} from "lucide-react";

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

      // Start timer
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
      audio.addEventListener('ended', handleEnd);
      return () => audio.removeEventListener('ended', handleEnd);
    }
  }, []);

  return (
    <div className="flex items-center space-x-3 p-3 bg-green-900/30 rounded-lg">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <button
        onClick={togglePlay}
        className="p-2 bg-green-600 hover:bg-green-500 rounded-full"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      
      <span className="text-sm text-green-300">Your recording</span>
      
      <button
        onClick={onDelete}
        className="ml-auto p-2 text-red-300 hover:text-red-200"
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
      alert('Please either record audio or add text comments before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('assignment_id', assignment.id);
      formData.append('submission_text', submissionText);
      
      if (audioBlob) {
        formData.append('audio_submission', audioBlob, `assignment_${assignment.id}_audio.wav`);
      }

      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting assignment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-green-900/90 border border-green-700/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Submit Assignment: {assignment.title}</h3>
          <button onClick={onClose} className="text-green-300 hover:text-white">✕</button>
        </div>

        <div className="space-y-6">
          {/* Assignment Details */}
          <div className="bg-green-800/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Assignment Details</h4>
            <p className="text-green-200 text-sm">{assignment.description}</p>
            <div className="mt-2 text-xs text-green-300">
              Due: {new Date(assignment.due_date).toLocaleDateString()} • {assignment.max_score} points
            </div>
          </div>

          {/* Audio Recording Section */}
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
                    className={`p-3 rounded-full ${
                      isRecording 
                        ? 'bg-red-600 hover:bg-red-500' 
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

          {/* Text Comments */}
          <div>
            <h4 className="font-semibold mb-3">Additional Comments (Optional)</h4>
            <textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Add any additional comments or notes about your submission..."
              rows="4"
              className="w-full p-3 rounded-lg bg-green-800/50 border border-green-700/30 text-white placeholder-green-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Submission Instructions */}
          <div className="bg-blue-900/30 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle size={16} className="text-blue-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-200">
                <strong>Note:</strong> Your audio recording will be submitted along with any comments. 
                You can review your recording before submitting.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-green-800/50 hover:bg-green-700/50 border border-green-700/30"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (!hasRecording && !submissionText.trim())}
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
      </div>
    </div>
  );
};

// Updated Assignments Section in Dashboard
{activeSection === "assignments" && (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-2xl font-semibold flex items-center">
        <FileText className="mr-2" size={24} />
        Assignments
      </h3>
      <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center">
        <Download className="mr-2" size={16} />
        Download All
      </button>
    </div>
    
    {loadingAssignments ? (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
        <p>Loading assignments...</p>
      </div>
    ) : assignments.length > 0 ? (
      <div className="grid gap-4">
        {assignments.map((assignment) => {
          const [showSubmissionModal, setShowSubmissionModal] = useState(false);
          const [submitting, setSubmitting] = useState(false);

          const handleSubmitAssignment = async (formData) => {
            setSubmitting(true);
            try {
              // Use makeApiRequest to submit the assignment
              const response = await makeApiRequest('/api/student/submit-assignment', {
                method: 'POST',
                body: formData,
                // Note: Don't set Content-Type header for FormData - browser will set it automatically with boundary
              });

              if (response.success) {
                toast.success('Assignment submitted successfully!');
                // Refresh assignments to show updated status
                fetchAssignments();
              } else {
                throw new Error(response.error || 'Failed to submit assignment');
              }
            } catch (error) {
              console.error('Error submitting assignment:', error);
              toast.error(`Failed to submit assignment: ${error.message}`);
              throw error;
            } finally {
              setSubmitting(false);
            }
          };

          const isSubmitted = assignment.submissions?.[0]?.status === "submitted" || 
                             assignment.submissions?.[0]?.status === "graded";
          const isGraded = assignment.submissions?.[0]?.status === "graded";
          const dueDate = new Date(assignment.due_date);
          const isOverdue = dueDate < new Date() && !isSubmitted;

          return (
            <div key={assignment.id}>
              <div className="p-4 rounded-lg bg-green-700/30 border border-green-600/30 hover:bg-green-700/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{assignment.title}</h4>
                    <div className="flex flex-wrap items-center mt-2 text-sm text-green-200">
                      <span className="flex items-center mr-4">
                        <BookOpen size={14} className="mr-1" />
                        {assignment.subject || assignment.class?.title}
                      </span>
                      <span className="flex items-center mr-4">
                        <Calendar size={14} className="mr-1" />
                        Due: {formatDate(assignment.due_date)}
                      </span>
                      <span className="flex items-center">
                        <Award size={14} className="mr-1" />
                        {assignment.max_score} points
                      </span>
                    </div>
                    {assignment.description && (
                      <p className="text-green-300 text-sm mt-2">{assignment.description}</p>
                    )}
                    
                    {/* Status and overdue warning */}
                    <div className="mt-3 flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isGraded 
                          ? "bg-green-900/50 text-green-300" 
                          : isSubmitted
                          ? "bg-blue-900/50 text-blue-300"
                          : isOverdue
                          ? "bg-red-900/50 text-red-300"
                          : "bg-yellow-900/50 text-yellow-300"
                      }`}>
                        {isGraded 
                          ? `Graded: ${assignment.submissions[0].score}/${assignment.max_score}`
                          : isSubmitted
                          ? "Submitted - Awaiting Grade"
                          : isOverdue
                          ? "Overdue"
                          : "Pending Submission"
                        }
                      </span>
                      
                      {isOverdue && (
                        <span className="text-xs text-red-300 flex items-center">
                          <AlertCircle size={12} className="mr-1" />
                          Past due date
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex space-x-2 flex-wrap gap-2">
                  {/* Download assignment materials */}
                  <button className="text-sm bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center">
                    <Download className="mr-2" size={16} />
                    Download Materials
                  </button>
                  
                  {/* Submit button - only show if not graded */}
                  {!isGraded && (
                    <button 
                      onClick={() => setShowSubmissionModal(true)}
                      disabled={submitting}
                      className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-2 px-4 rounded-lg flex items-center"
                    >
                      <Mic className="mr-2" size={16} />
                      {isSubmitted ? 'Resubmit Audio' : 'Record & Submit'}
                    </button>
                  )}
                  
                  {/* View feedback if graded */}
                  {isGraded && assignment.submissions?.[0]?.feedback && (
                    <button className="text-sm bg-purple-600 hover:bg-purple-500 py-2 px-4 rounded-lg flex items-center">
                      <CheckCircle className="mr-2" size={16} />
                      View Feedback
                    </button>
                  )}
                </div>
              </div>

              {/* Submission Modal */}
              <AssignmentSubmissionModal
                assignment={assignment}
                isOpen={showSubmissionModal}
                onClose={() => setShowSubmissionModal(false)}
                onSubmit={handleSubmitAssignment}
              />
            </div>
          );
        })}
      </div>
    ) : (
      <div className="text-center py-8">
        <FileText size={48} className="mx-auto text-green-400 mb-3" />
        <p className="text-green-200">No assignments posted yet.</p>
      </div>
    )}
  </div>
)}
