
import { useState } from 'react';
import { motion } from "framer-motion";
import { UserPlus, Users, RefreshCw, Search, CheckCircle, UserX } from "lucide-react";
import StudentsList from '../../lists/StudentsList';
import AssignStudentModal from '../../modals/AssignStudentModal';
import OrbitalLoader from '../loaders/OrbitalLoader';
import { useDebounce } from '../../../hooks/useDebounce';
import { useMemo } from 'react';

export default function StudentsSection({ data, loading, onRefresh, onError }) {
  
  
  const [showAssignStudentForm, setShowAssignStudentForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { students = [], teachers = [] } = data;
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

const EmptyState = ({ icon: Icon, title, subtitle }) => {
  return (
    <div className="text-center py-8">
      <Icon size={48} className="mx-auto text-blue-400 mb-3" />
      <p className="text-blue-200 text-lg font-medium">{title}</p>
      {subtitle && (
        <p className="text-blue-300 text-sm mt-1">{subtitle}</p>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-900/30",
    green: "bg-green-900/30", 
    yellow: "bg-yellow-900/30"
  };

  return (
    <div className={`bg-blue-700/30 rounded-xl p-4 border border-blue-600/30 ${colorClasses[color]}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-blue-300 text-sm">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-white">{value}</h3>
        </div>
        <div className="p-2 rounded-lg bg-blue-900/30">
          <Icon size={20} className="text-blue-300" />
        </div>
      </div>
    </div>
  );
};

  const filteredStudents = useMemo(() => {
    if (!debouncedSearchTerm) return students;
    
    return students.filter(student =>
      student.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      student.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      student.course?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      student.teacher_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [students, debouncedSearchTerm]);

  const unassignedStudents = students.filter(s => !s.teacher_id);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold flex items-center">
          <UserPlus className="mr-2" size={24} />
          Student Management
        </h3>
        <div className="flex space-x-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAssignStudentForm(true)}
            className="text-sm bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center"
          >
            <Users size={16} className="mr-2" />
            Assign Students
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRefresh(['students'])}
            className="text-sm bg-blue-800/50 hover:bg-blue-700/50 py-2 px-4 rounded-lg flex items-center"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </motion.button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Students"
          value={students.length}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Assigned Students"
          value={students.filter(s => s.teacher_id).length}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Unassigned Students"
          value={unassignedStudents.length}
          icon={UserX}
          color="yellow"
        />
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300" />
          <input
            type="text"
            placeholder="Search students by name, email, or course..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-blue-800/30 border border-blue-700/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Students List */}
      {loading.students ? (
        <div className="flex justify-center items-center py-12 flex-col">
          <OrbitalLoader />
          <span className="mt-4 text-blue-300">Loading students...</span>
        </div>
      ) : filteredStudents.length > 0 ? (
        <StudentsList
          students={filteredStudents}
          onRefresh={onRefresh}
          onError={onError}
        />
      ) : (
        <EmptyState
          icon={UserPlus}
          title={searchTerm ? "No students found" : "No students found"}
          subtitle={searchTerm ? "Try adjusting your search terms" : undefined}
        />
      )}

      <AssignStudentModal
        isOpen={showAssignStudentForm}
        onClose={() => setShowAssignStudentForm(false)}
        unassignedStudents={unassignedStudents}
        availableTeachers={teachers}
        onRefresh={onRefresh}
      />
    </div>
  );
}
