import { useState, useEffect } from 'react';
import { FileCheck, User, CheckCircle, Loader } from "lucide-react";
import { useAuth } from '../components/AuthContext';
import { teacherApi } from '../lib/supabaseClient';
import { toast } from 'react-toastify';

export default function GradingDashboard() {
  const { user } = useAuth();
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [gradedSubmissions, setGradedSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      loadSubmissions();
    }
  }, [user]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Loading submissions...');
      
      // Test if the methods exist
      if (!teacherApi.getPendingSubmissions || !teacherApi.getGradedSubmissions) {
        throw new Error('Grading methods not available');
      }

      const [pendingData, gradedData] = await Promise.all([
        teacherApi.getPendingSubmissions(),
        teacherApi.getGradedSubmissions()
      ]);
      
      console.log('✅ Submissions loaded:', {
        pending: pendingData?.length,
        graded: gradedData?.length
      });
      
      setPendingSubmissions(pendingData || []);
      setGradedSubmissions(gradedData || []);
    } catch (error) {
      console.error('❌ Error loading submissions:', error);
      setError(error.message);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <FileCheck size={48} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-400 text-lg mb-2">Error Loading Grading Dashboard</p>
          <p className="text-blue-200 mb-4">{error}</p>
          <button
            onClick={loadSubmissions}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-white"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 text-blue-400 mx-auto mb-4" />
          <p className="text-blue-200">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Stats */}
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
      <div className="space-y-4">
        {activeTab === 'pending' && (
          <PendingSubmissions submissions={pendingSubmissions} />
        )}

        {activeTab === 'graded' && (
          <GradedSubmissions submissions={gradedSubmissions} />
        )}
      </div>
    </div>
  );
}

// Pending Submissions Component
const PendingSubmissions = ({ submissions }) => {
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
        <div key={submission.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center mb-3">
                <User size={20} className="text-yellow-400 mr-3" />
                <div>
                  <h4 className="font-semibold text-white text-lg">
                    {submission.student?.name || 'Unknown Student'}
                  </h4>
                  <p className="text-yellow-300 text-sm">
                    {submission.student?.email || 'No email'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-blue-200 text-sm">Assignment</p>
                  <p className="text-white font-medium">
                    {submission.assignment?.title || 'Unknown Assignment'}
                  </p>
                  {submission.assignment?.description && (
                    <p className="text-blue-300 text-sm mt-1">
                      {submission.assignment.description}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Details</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-white">
                      Max Score: {submission.assignment?.max_score || 'N/A'}
                    </span>
                    <span className="text-blue-300">
                      Due: {submission.assignment?.due_date ? 
                        new Date(submission.assignment.due_date).toLocaleDateString() : 
                        'No due date'
                      }
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
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
                  <p className="text-blue-200 text-sm font-medium mb-2">Audio Submission:</p>
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
        <CheckCircle size={48} className="mx-auto text-blue-400 mb-3" />
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
                  <h4 className="font-semibold text-white text-lg">
                    {submission.student?.name || 'Unknown Student'}
                  </h4>
                  <p className="text-green-300 text-sm">
                    {submission.student?.email || 'No email'}
                  </p>
                </div>
                <div className="ml-4 bg-green-500/20 px-3 py-1 rounded-full">
                  <span className="text-green-300 text-sm">
                    Score: {submission.grade}/{submission.assignment?.max_score || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-blue-200 text-sm">Assignment</p>
                  <p className="text-white font-medium">
                    {submission.assignment?.title || 'Unknown Assignment'}
                  </p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Grading Details</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-green-400">
                      {Math.round((submission.grade / (submission.assignment?.max_score || 100)) * 100)}%
                    </span>
                    <span className="text-blue-300">
                      Graded: {submission.graded_at ? 
                        new Date(submission.graded_at).toLocaleDateString() : 
                        'Unknown date'
                      }
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
                  <p className="text-blue-200 text-sm font-medium mb-2">Audio Feedback:</p>
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
