import React from 'react';
import { motion } from 'framer-motion';
import { Mail, BookOpen, Users, UserX, Trash2 } from 'lucide-react';

// StudentRow component
const StudentRow = React.memo(({ 
  student, 
  availableTeachers = [], // <-- defensive default
  assignmentMap = {},     // <-- defensive default
  onAssign, 
  onRemove,
  onAssignmentChange 
}) => {
  return (
    <div className="p-4 rounded-lg bg-blue-700/30 border border-blue-600/30 hover:bg-blue-700/50 transition-colors mb-2">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-bold text-lg">{student.name}</h4>
          <div className="flex flex-wrap items-center mt-2 text-sm text-blue-200">
            <span className="flex items-center mr-4">
              <Mail size={14} className="mr-1" />
              {student.email}
            </span>
            <span className="flex items-center mr-4">
              <BookOpen size={14} className="mr-1" />
              {student.course}
            </span>
            <span className="flex items-center">
              <Users size={14} className="mr-1" />
              {student.teacher_name || "Not assigned"}
            </span>
          </div>
          {student.teacher_name && (
            <div className="mt-2 text-xs text-blue-300">
              <span className="flex items-center">
                <Mail size={12} className="mr-1" />
                {student.teacher_email} • {student.teacher_subject}
              </span>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          {student.teacher_id ? (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAssign(student.id, null)}
              className="text-sm bg-yellow-600 hover:bg-yellow-500 py-1 px-3 rounded-lg flex items-center"
            >
              <UserX size={14} className="mr-1" />
              Unassign
            </motion.button>
          ) : (
            <select
              value={assignmentMap?.[student.id] || ''}
              onChange={(e) => onAssignmentChange(student.id, e.target.value)}
              className="p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Assign to...</option>
              {availableTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} - {teacher.subject}
                </option>
              ))}
            </select>
          )}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onRemove(student.id)}
            className="p-2 rounded-lg bg-red-800/50 hover:bg-red-700/50"
          >
            <Trash2 size={16} />
          </motion.button>
        </div>
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <span className="text-sm text-blue-300">
          Student ID: {student.id.slice(0, 8)}...
        </span>
        {student.assigned_at && (
          <span className="text-xs text-blue-400">
            Assigned: {new Date(student.assigned_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
});

// Main StudentsList component
export default function StudentsList({ 
  students = [],              // <-- default to empty array
  availableTeachers = [],     // <-- default to empty array
  assignmentMap = {},         // <-- default to empty object
  onAssign, 
  onRemove,
  onAssignmentChange 
}) {
  return (
    <div className="space-y-3">
      {students.map((student) => (
        <StudentRow
          key={student.id}
          student={student}
          availableTeachers={availableTeachers}
          assignmentMap={assignmentMap}
          onAssign={onAssign}
          onRemove={onRemove}
          onAssignmentChange={onAssignmentChange}
        />
      ))}
    </div>
  );
}