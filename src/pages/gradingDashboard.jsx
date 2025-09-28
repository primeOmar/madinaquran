import { useState, useEffect } from 'react';
import { 
  FileCheck, User, Calendar, Award, Play, Square, 
  Mic, StopCircle, Send, Search, Filter, CheckCircle,
  Volume2, Download, Clock, AlertCircle
} from "lucide-react";
import { useAuth } from '../components/AuthContext';
import { teacherApi } from '../lib/supabaseClient';
import { toast } from 'react-toastify';

export default function GradingDashboard() {
  const { user } = useAuth();
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [gradedSubmissions, setGradedSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [gradeData, setGradeData] = useState({ 
    score: '', 
    feedback: '',
    audioFeedback: null 
  });
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      loadSubmissions();
    }
  }, [user]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const [pendingData, gradedData] = await Promise.all([
        teacherApi.getPendingSubmissions(),
        teacherApi.getGradedSubmissions()
      ]);
      
      setPendingSubmissions(pendingData);
      setGradedSubmissions(gradedData);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setGradeData(prev => ({ ...prev, audioFeedback: blob }));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const gradeSubmission = async () => {
    if (!gradeData.score || isNaN(gradeData.score) || gradeData.score < 0) {
      toast.error('Please enter a valid score');
      return;
    }

    try {
      setGrading(true);
      
      await teacherApi.gradeAssignment(
        selectedSubmission.id,
        parseInt(gradeData.score),
        gradeData.feedback,
        gradeData.audioFeedback
      );

      // Update student progress
      await teacherApi.updateStudentProgress(selectedSubmission.student.id);

      toast.success('Assignment graded successfully!');
      
      // Reset state
      setSelectedSubmission(null);
      setGradeData({ score: '', feedback: '', audioFeedback: null });
      setAudioBlob(null);
      
      // Reload data
      await loadSubmissions();
    } catch (error) {
      toast.error(`Failed to grade assignment: ${error.message}`);
    } finally {
      setGrading(false);
    }
  };

  const filteredPendingSubmissions = pendingSubmissions.filter(sub => 
    sub.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.assignment.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGradedSubmissions = gradedSubmissions.filter(sub => 
    sub.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.assignment.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-blue-200">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Grade Student Work</h1>
              <div className="flex items-center space-x-6 text-blue-200">
                <div className="flex items-center">
                  <FileCheck size={16} className="mr-2" />
                  <span>{pendingSubmissions.length} Pending</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle size={16} className="mr-2" />
                  <span>{gradedSubmissions.length} Graded</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
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
        </div>

        {/* Tabs */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileCheck size={16} className="mr-2" />
              Pending Grading
              {pendingSubmissions.length > 0 && (
                <span className="ml-2 bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full text-xs">
                  {pendingSubmissions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('graded')}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'graded'
                  ? 'bg-green-600 text-white'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <CheckCircle size={16} className="mr-2" />
              Graded Work
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          {activeTab === 'pending' && (
            <PendingSubmissions
              submissions={filteredPendingSubmissions}
              onSelectSubmission={setSelectedSubmission}
            />
          )}

          {activeTab === 'graded' && (
            <GradedSubmissions
              submissions={filteredGradedSubmissions}
            />
          )}
        </div>
      </div>

      {/* Grading Modal */}
      {selectedSubmission && (
        <GradingModal
          submission={selectedSubmission}
          gradeData={gradeData}
          setGradeData={setGradeData}
          isRecording={isRecording}
          audioBlob={audioBlob}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onGrade={gradeSubmission}
          onClose={() => {
            setSelectedSubmission(null);
            setGradeData({ score: '', feedback: '', audioFeedback: null });
            setAudioBlob(null);
          }}
          loading={grading}
        />
      )}
    </div>
  );
}

// Pending Submissions Component
const PendingSubmissions = ({ submissions, onSelectSubmission }) => {
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
      {submissions.map((submission) => (
        <div key={submission.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 hover:bg-yellow-500/15 transition-colors cursor-pointer"
          onClick={() => onSelectSubmission(submission)}>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center mb-3">
                <User size={20} className="text-yellow-400 mr-3" />
                <div>
                  <h4 className="font-semibold text-white text-lg">{submission.student.name}</h4>
                  <p className="text-yellow-300 text-sm">{submission.student.email}</p>
                </div>
                {submission.student.overall_score && (
                  <div className="ml-4 bg-blue-500/20 px-3 py-1 rounded-full">
                    <span className="text-blue-300 text-sm">Overall: {submission.student.overall_score}%</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-blue-200 text-sm">Assignment</p>
                  <p className="text-white font-medium">{submission.assignment.title}</p>
                  {submission.assignment.description && (
                    <p className="text-blue-300 text-sm mt-1">{submission.assignment.description}</p>
                  )}
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Details</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-white">Max Score: {submission.assignment.max_score}</span>
                    <span className="text-blue-300">
                      Due: {new Date(submission.assignment.due_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <Clock size={14} className="text-blue-300 mr-1" />
                    <span className="text-blue-300 text-sm">
                      Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submission Content */}
              {submission.submission_text && (
                <div className="mt-3 p-3 bg-black/20 rounded">
                  <p className="text-blue-200 text-sm font-medium mb-2">Student's Submission:</p>
                  <p className="text-white text-sm">{submission.submission_text}</p>
                </div>
              )}

              {submission.audio_url && (
                <div className="mt-3">
                  <p className="text-blue-200 text-sm font-medium mb-2">Student's Audio Submission:</p>
                  <audio controls className="w-full max-w-md">
                    <source src={submission.audio_url} type="audio/webm" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>

            <div className="flex space-x-2 self-end md:self-auto">
              <button className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded-lg text-white flex items-center">
                <FileCheck size={16} className="mr-2" />
                Grade Now
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Graded Submissions Component
const GradedSubmissions = ({ submissions }) => {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <Award size={48} className="mx-auto text-blue-400 mb-3" />
        <p className="text-blue-200">No graded submissions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <div key={submission.id} className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center mb-3">
                <User size={20} className="text-green-400 mr-3" />
                <div>
                  <h4 className="font-semibold text-white text-lg">{submission.student.name}</h4>
                  <p className="text-green-300 text-sm">{submission.student.email}</p>
                </div>
                <div className="ml-4 bg-green-500/20 px-3 py-1 rounded-full">
                  <span className="text-green-300 text-sm">
                    Score: {submission.grade}/{submission.assignment.max_score}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-blue-200 text-sm">Assignment</p>
                  <p className="text-white font-medium">{submission.assignment.title}</p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Grading Details</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-green-400">
                      {Math.round((submission.grade / submission.assignment.max_score) * 100)}%
                    </span>
                    <span className="text-blue-300">
                      Graded: {new Date(submission.graded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              {submission.feedback && (
                <div className="mt-3 p-3 bg-black/20 rounded">
                  <p className="text-blue-200 text-sm font-medium mb-2">Your Feedback:</p>
                  <p className="text-white text-sm">{submission.feedback}</p>
                </div>
              )}

              {submission.audio_feedback_url && (
                <div className="mt-3">
                  <p className="text-blue-200 text-sm font-medium mb-2">Your Audio Feedback:</p>
                  <audio controls className="w-full max-w-md">
                    <source src={submission.audio_feedback_url} type="audio/webm" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Grading Modal Component
const GradingModal = ({ 
  submission, 
  gradeData, 
  setGradeData, 
  isRecording, 
  audioBlob, 
  onStartRecording, 
  onStopRecording, 
  onGrade, 
  onClose, 
  loading 
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-white">Grade Assignment</h3>
        
        {/* Student and Assignment Info */}
        <div className="bg-blue-800/30 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-3">
            <User size={20} className="text-blue-400 mr-3" />
            <div>
              <h4 className="font-semibold text-white">{submission.student.name}</h4>
              <p className="text-blue-300 text-sm">{submission.student.email}</p>
            </div>
          </div>
          <p className="text-blue-200">
            <span className="font-medium">Assignment:</span> {submission.assignment.title}
          </p>
          <p className="text-blue-200">
            <span className="font-medium">Max Score:</span> {submission.assignment.max_score}
          </p>
        </div>

        {/* Student's Submission */}
        <div className="mb-6">
          <h5 className="text-white font-medium mb-3">Student's Submission:</h5>
          
          {submission.submission_text && (
            <div className="p-3 bg-black/20 rounded mb-3">
              <p className="text-white">{submission.submission_text}</p>
            </div>
          )}

          {submission.audio_url && (
            <div className="mb-3">
              <p className="text-blue-200 text-sm mb-2">Audio Submission:</p>
              <audio controls className="w-full">
                <source src={submission.audio_url} type="audio/webm" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>

        {/* Grading Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-1">
              Score * (Max: {submission.assignment.max_score})
            </label>
            <input
              type="number"
              value={gradeData.score}
              onChange={(e) => setGradeData({...gradeData, score: e.target.value})}
              className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
              min="0"
              max={submission.assignment.max_score}
              placeholder="Enter score"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-200 mb-1">
              Written Feedback
            </label>
            <textarea
              value={gradeData.feedback}
              onChange={(e) => setGradeData({...gradeData, feedback: e.target.value})}
              className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 text-white"
              rows="4"
              placeholder="Provide feedback to the student..."
            />
          </div>

          {/* Audio Feedback */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Audio Feedback (Optional)
            </label>
            
            <div className="space-y-3">
              {!isRecording && !audioBlob && (
                <button
                  onClick={onStartRecording}
                  className="flex items-center bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-white"
                >
                  <Mic size={16} className="mr-2" />
                  Start Recording Feedback
                </button>
              )}

              {isRecording && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center text-red-400">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse mr-2"></div>
                    Recording...
                  </div>
                  <button
                    onClick={onStopRecording}
                    className="flex items-center bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-white"
                  >
                    <StopCircle size={14} className="mr-1" />
                    Stop
                  </button>
                </div>
              )}

              {audioBlob && (
                <div className="flex items-center space-x-3">
                  <audio controls className="flex-1">
                    <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                    Your browser does not support the audio element.
                  </audio>
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setGradeData(prev => ({ ...prev, audioFeedback: null }));
                    }}
                    className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-white text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50 text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onGrade}
            disabled={!gradeData.score || loading}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:bg-green-800/50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Grading...
              </div>
            ) : (
              <>
                <Send size={16} className="mr-2" />
                Submit Grade
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

