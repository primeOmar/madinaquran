import { useState, useEffect } from 'react';
import { FileCheck, User, CheckCircle } from "lucide-react";
import { useAuth } from '../components/AuthContext';
import { teacherApi } from '../lib/supabaseClient';
import { toast } from 'react-toastify';

export default function GradingDashboard() {
  const { user } = useAuth();
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [gradedSubmissions, setGradedSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);

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
      
      setPendingSubmissions(pendingData || []);
      setGradedSubmissions(gradedData || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-blue-200">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
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

      <div className="space-y-4">
        {activeTab === 'pending' && (
          <>
            {pendingSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <FileCheck size={48} className="mx-auto text-green-400 mb-3" />
                <p className="text-blue-200">No pending submissions to grade</p>
              </div>
            ) : (
              pendingSubmissions.map((submission) => (
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
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'graded' && (
          <>
            {gradedSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle size={48} className="mx-auto text-blue-400 mb-3" />
                <p className="text-blue-200">No graded submissions yet</p>
              </div>
            ) : (
              gradedSubmissions.map((submission) => (
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
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
