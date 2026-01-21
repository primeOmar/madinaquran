import { useState, useEffect } from 'react';
import { FileCheck, User, CheckCircle, Loader, AlertCircle } from "lucide-react";
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
      console.log('🔄 Loading submissions for grading...');
      
      // Use the methods we know exist
      const pendingData = await teacherApi.getPendingSubmissions();
      const gradedData = await teacherApi.getGradedSubmissions();
      
      console.log('✅ Grading data loaded:', {
        pending: pendingData?.length,
        graded: gradedData?.length
      });
      
      setPendingSubmissions(pendingData || []);
      setGradedSubmissions(gradedData || []);
    } catch (error) {
      console.error('❌ Error loading submissions for grading:', error);
      setError(error.message);
      toast.error('Failed to load submissions for grading');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
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
          <p className="text-blue-200">Loading submissions for grading...</p>
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
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <User size={16} className="text-yellow-400 mr-2" />
                <h4 className="font-semibold text-white">{submission.student?.name || 'Unknown Student'}</h4>
              </div>
              <p className="text-blue-200 text-sm">Assignment: {submission.assignment?.title}</p>
              <p className="text-blue-300 text-sm">
                Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
              </p>
              {submission.submission_text && (
                <p className="text-white text-sm mt-2 line-clamp-2">{submission.submission_text}</p>
              )}
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
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <User size={16} className="text-green-400 mr-2" />
                <h4 className="font-semibold text-white">{submission.student?.name || 'Unknown Student'}</h4>
              </div>
              <p className="text-blue-200 text-sm">Assignment: {submission.assignment?.title}</p>
              <p className="text-green-400 text-sm">
                Score: {submission.grade}/{submission.assignment?.max_score}
              </p>
              {submission.feedback && (
                <p className="text-white text-sm mt-2 line-clamp-2">{submission.feedback}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
