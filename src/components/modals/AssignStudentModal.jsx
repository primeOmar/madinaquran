// AssignStudentModal.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, CheckCircle, UserPlus, Loader2 } from 'lucide-react';
import { adminApi } from '../../lib/supabaseClient';
import { toast } from 'react-toastify';

export default function AssignStudentModal({ 
  isOpen, 
  onClose, 
  unassignedStudents, 
  availableTeachers, 
  onRefresh 
}) {
  const [assignmentMap, setAssignmentMap] = useState({});
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  const handleQuickAssign = async (studentId, teacherId) => {
    if (!teacherId) {
      toast.error('Please select a teacher');
      return;
    }

    try {
      await adminApi.assignStudentToTeacher(studentId, teacherId);
      toast.success('Student assigned successfully!');
      
      // Update local state optimistically
      setAssignmentMap(prev => {
        const newMap = { ...prev };
        delete newMap[studentId];
        return newMap;
      });
      
      // Refresh the main students list
      onRefresh(['students']);
    } catch (error) {
      toast.error(`Failed to assign student: ${error.message}`);
    }
  };

  const handleBulkAssign = async () => {
    const assignments = Object.entries(assignmentMap)
      .filter(([_, teacherId]) => teacherId)
      .map(([studentId, teacherId]) => ({ studentId, teacherId }));

    if (assignments.length === 0) {
      toast.error('No assignments selected');
      return;
    }

    setIsBulkAssigning(true);
    
    try {
      const result = await adminApi.bulkAssignStudents(assignments);
      toast.success(`Successfully assigned ${result.assigned} students!`);
      
      onClose();
      setAssignmentMap({});
      onRefresh(['students']);
    } catch (error) {
      toast.error(`Failed to assign students: ${error.message}`);
    } finally {
      setIsBulkAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold flex items-center">
              <Users className="mr-2" size={24} />
              Assign Students to Teachers
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-blue-800/50"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {unassignedStudents.length > 0 ? (
              <div className="space-y-3">
                {unassignedStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-blue-800/30 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">{student.name}</h4>
                      <p className="text-sm text-blue-300">
                        {student.email} • {student.course}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-3 ml-4">
                      <select
                        value={assignmentMap[student.id] || ''}
                        onChange={(e) => setAssignmentMap({
                          ...assignmentMap,
                          [student.id]: e.target.value
                        })}
                        className="p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 text-sm min-w-[200px]"
                      >
                        <option value="">Select Teacher</option>
                        {availableTeachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name} - {teacher.subject}
                          </option>
                        ))}
                      </select>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleQuickAssign(student.id, assignmentMap[student.id])}
                        disabled={!assignmentMap[student.id]}
                        className="p-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle size={16} />
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle size={48} className="mx-auto text-green-400 mb-3" />
                <p className="text-blue-200">All students have been assigned to teachers!</p>
                <p className="text-blue-300 text-sm mt-1">Great job managing your students.</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 mt-4 border-t border-blue-700/30">
            <span className="text-sm text-blue-300">
              {Object.values(assignmentMap).filter(Boolean).length} students selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={isBulkAssigning || Object.values(assignmentMap).filter(Boolean).length === 0}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isBulkAssigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} className="mr-2" />
                    Assign Selected ({Object.values(assignmentMap).filter(Boolean).length})
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}