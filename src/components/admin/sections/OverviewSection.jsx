
import { motion } from "framer-motion";
import { BarChart3, Users, UserPlus, BookOpen, Video } from "lucide-react";

export default function OverviewSection({ data, onRefresh }) {
  const { teachers = [], students = [], classes = [] } = data;

  return (
    <div>
      <h3 className="text-2xl font-semibold flex items-center mb-6">
        <BarChart3 className="mr-2" size={24} />
        System Overview
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-700/30 rounded-xl p-6 border border-blue-600/30">
          <h4 className="font-bold text-lg mb-4">Recent Activity</h4>
          <div className="space-y-4">
            {teachers.slice(0, 3).map((teacher) => (
              <div key={teacher.id} className="flex items-start p-3 bg-blue-800/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-3 mt-1">
                  <Users size={16} />
                </div>
                <div>
                  <p className="font-medium">Teacher: {teacher.name}</p>
                  <p className="text-xs text-blue-300">{teacher.subject}</p>
                </div>
              </div>
            ))}
            {teachers.length === 0 && (
              <p className="text-blue-300 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
        
        <div className="bg-blue-700/30 rounded-xl p-6 border border-blue-600/30">
          <h4 className="font-bold text-lg mb-4">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-4">
            <QuickActionButton
              icon={UserPlus}
              label="Add Teacher"
              onClick={() => {/* Add teacher action */}}
            />
            <QuickActionButton
              icon={UserPlus}
              label="Assign Student"
              onClick={() => {/* Assign student action */}}
            />
            <QuickActionButton
              icon={BookOpen}
              label="Create Class"
              onClick={() => {/* Create class action */}}
            />
            <QuickActionButton
              icon={Video}
              label="Join Session"
              onClick={() => {/* Join session action */}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="p-4 bg-blue-600 hover:bg-blue-500 rounded-lg flex flex-col items-center justify-center"
    >
      <Icon size={24} className="mb-2" />
      <span className="text-sm">{label}</span>
    </motion.button>
  );
}