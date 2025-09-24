// LiveSessionsSection.jsx
import { Video, Users, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import WaveLoader from "../loaders/WaveLoader";

export default function LiveSessionsSection({ 
  videoSessions = [], // Add default value
  loading, 
  onJoinSession, 
  onRemoveParticipant 
}) {
  // Add safety check for videoSessions
  const safeVideoSessions = videoSessions || [];
  
  return (
    <div>
      <h3 className="text-2xl font-semibold flex items-center mb-6">
        <Video className="mr-2" size={24} />
        Live Sessions
      </h3>
      
      {loading.live ? (
        <div className="flex justify-center items-center py-12 flex-col">
          <WaveLoader />
          <span className="mt-4 text-blue-300">Loading live sessions...</span>
        </div>
      ) : safeVideoSessions.length > 0 ? ( // Use safeVideoSessions here
        <div className="grid gap-4">
          {safeVideoSessions.map((session) => ( // And here
            <div
              key={session.id}
              className="p-4 rounded-lg bg-blue-700/30 border border-blue-600/30 hover:bg-blue-700/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-lg flex items-center">
                    {session.meeting_id || session.title}
                    {session.status === 'live' && (
                      <span className="w-2 h-2 bg-red-500 rounded-full ml-2 animate-pulse"></span>
                    )}
                  </h4>
                  <div className="flex flex-wrap items-center mt-2 text-sm text-blue-200">
                    <span className="flex items-center mr-4">
                      <Users size={14} className="mr-1" />
                      {session.participants?.length || 0} participants
                    </span>
                    {session.started_at && (
                      <span className="flex items-center">
                        <Clock size={14} className="mr-1" />
                        Started: {new Date(session.started_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  {session.teacher && (
                    <p className="text-sm text-blue-300 mt-2">
                      Teacher: {session.teacher.name} ({session.teacher.email})
                    </p>
                  )}
                  {session.class && (
                    <p className="text-sm text-blue-300">
                      Class: {session.class.title}
                    </p>
                  )}
                  {session.agenda && (
                    <p className="text-sm text-blue-300 mt-2">
                      Agenda: {session.agenda}
                    </p>
                  )}
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onJoinSession(session.meeting_id || session.id)}
                  disabled={loading.joinClass}
                  className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.joinClass ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Video size={16} className="mr-1" />
                  )}
                  Join
                </motion.button>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-blue-300">
                  Session ID: {session.id?.slice(0, 8)}...
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  session.status === 'live' 
                    ? 'bg-red-900/50 text-red-300' 
                    : session.status === 'ended'
                    ? 'bg-gray-900/50 text-gray-300'
                    : 'bg-blue-900/50 text-blue-300'
                }`}>
                  {session.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>

              {session.status === 'live' && (
                <div className="mt-4 pt-4 border-t border-blue-600/30">
                  <button 
                    onClick={() => onRemoveParticipant(session.meeting_id || session.id, 'participant-id')}
                    className="text-sm bg-red-600 hover:bg-red-500 py-1 px-3 rounded-lg flex items-center"
                  >
                    <Users size={14} className="mr-1" />
                    Remove Participant
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Video size={48} className="mx-auto text-blue-400 mb-3" />
          <p className="text-blue-200">No live sessions at the moment.</p>
        </div>
      )}
    </div>
  );
}