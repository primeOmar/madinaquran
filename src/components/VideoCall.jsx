// pages/JoinClass.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import VideoCall from '../components/VideoCall';
import { teacherApi } from '../lib/supabaseClient';
import { Loader, ArrowLeft, Video, Users, Clock } from 'lucide-react';

const JoinClass = () => {
  const { meetingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [classInfo, setClassInfo] = useState(null);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const fetchClassInfo = async () => {
      try {
        // In a real app, you'd fetch class details by meetingId
        setClassInfo({
          title: 'Live Quran Class',
          teacher: 'Teacher Name',
          scheduledDate: new Date().toISOString(),
          duration: 60
        });
        setIsLoading(false);
      } catch (error) {
        setError('Class not found or session has ended');
        setIsLoading(false);
      }
    };

    if (meetingId) {
      fetchClassInfo();
    }
  }, [meetingId]);

  const handleJoinClass = () => {
    setJoined(true);
  };

  const handleLeaveClass = () => {
    setJoined(false);
    navigate('/student-dashboard');
  };

  if (joined && user) {
    return (
      <VideoCall
        meetingId={meetingId}
        user={user}
        onLeave={handleLeaveClass}
        isTeacher={false}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-white text-xl">Loading class information...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-500/20 border border-red-500/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Video className="text-red-400" size={32} />
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">Class Not Available</h2>
          <p className="text-blue-200 mb-6">{error}</p>
          <button
            onClick={() => navigate('/student-dashboard')}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white flex items-center mx-auto"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Join Class</h1>
          <p className="text-blue-200">You're about to join a live teaching session</p>
        </div>

        <div className="bg-white/5 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold text-lg mb-3">{classInfo?.title}</h3>
          
          <div className="space-y-3">
            <div className="flex items-center text-blue-200">
              <Users size={18} className="mr-3 text-blue-400" />
              <span>Teacher: {classInfo?.teacher}</span>
            </div>
            
            <div className="flex items-center text-blue-200">
              <Clock size={18} className="mr-3 text-blue-400" />
              <span>Duration: {classInfo?.duration} minutes</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h4 className="text-blue-300 font-semibold mb-2 flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
            Session Requirements
          </h4>
          <ul className="text-blue-200 text-sm space-y-1">
            <li>• Stable internet connection</li>
            <li>• Microphone and camera access</li>
            <li>• Google Chrome recommended</li>
            <li>• Quiet environment</li>
          </ul>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleJoinClass}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
          >
            Join Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinClass;
