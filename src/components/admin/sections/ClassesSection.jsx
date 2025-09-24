// components/admin/sections/ClassesSection.jsx - Fixed Version
import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Calendar, Clock, UserPlus, Edit, Trash2, Video, Plus, 
  Users, Search, Filter, Play, Eye, User, UserX, Repeat, CalendarDays
} from "lucide-react";
import PulsarLoader from "../loaders/PulsarLoader";
// import ScheduleClassModal from "../../modals/ScheduleClassModal"; // Commented out if doesn't exist
import { adminApi } from "../../../lib/supabaseClient";
import { toast } from 'react-toastify';

export default function ClassesSection({ data = {}, loading = {}, onRefresh, onError }) {
  // Get data from props with fallbacks
  const { classes: propClasses = [], teachers: propTeachers = [] } = data;
  
  // Local state for component-specific data
  const [classes, setClasses] = useState(propClasses);
  const [teachers, setTeachers] = useState(propTeachers);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    teacher: '',
    search: ''
  });

const [newClass, setNewClass] = useState({
    title: '',
    teacher_id: '',
    scheduled_date: '',
    duration: 60,
    description: '',
    status: 'scheduled',
    is_exam: false,
    recurring: false,
    recurrence_type: 'none', 
    recurrence_days: 30, 
    recurrence_interval: 1, 
  });

  const [scheduling, setScheduling] = useState(false);
  // Update local state when props change
  useEffect(() => {
    setClasses(propClasses);
    setTeachers(propTeachers);
  }, [propClasses, propTeachers]);

  // Fetch classes directly if not provided via props
  const fetchClasses = async () => {
    setLocalLoading(true);
    try {
      console.log('🏫 Fetching classes...');
      const classesData = await adminApi.getClasses();
      console.log('✅ Classes fetched:', classesData);
      setClasses(Array.isArray(classesData) ? classesData : []);
    } catch (error) {
      console.error('❌ Error fetching classes:', error);
      toast.error('Failed to load classes');
      setClasses([]);
      if (onError) onError(error.message);
    } finally {
      setLocalLoading(false);
    }
  };

  // Fetch teachers if not provided
  const fetchTeachers = async () => {
    if (teachers.length === 0) {
      try {
        console.log('👨‍🏫 Fetching teachers...');
        const teachersData = await adminApi.getTeachers();
        console.log('✅ Teachers fetched:', teachersData);
        setTeachers(Array.isArray(teachersData) ? teachersData : []);
      } catch (error) {
        console.error('❌ Error fetching teachers:', error);
        setTeachers([]);
      }
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (classes.length === 0) {
      fetchClasses();
    }
    if (teachers.length === 0) {
      fetchTeachers();
    }
  }, []);

  // Enhanced search and filter logic
  const filteredClasses = useMemo(() => {
    if (!classes || classes.length === 0) return [];
    
    let result = [...classes];

    // Status filter
    if (filters.status) {
      result = result.filter(cls => cls.status === filters.status);
    }

    // Teacher filter
    if (filters.teacher) {
      result = result.filter(cls => cls.teacher_id === filters.teacher);
    }

    // Search filter - enhanced for better accuracy
    if (filters.search) {
      const searchLower = filters.search.toLowerCase().trim();
      result = result.filter(cls => {
        // Search in class title
        const titleMatch = cls.title?.toLowerCase().includes(searchLower);
        const nameMatch = cls.name?.toLowerCase().includes(searchLower);
        
        // Search in teacher name and email
        const teacherNameMatch = cls.teacher?.name?.toLowerCase().includes(searchLower);
        const teacherEmailMatch = cls.teacher?.email?.toLowerCase().includes(searchLower);
        
        // Search in description
        const descriptionMatch = cls.description?.toLowerCase().includes(searchLower);
        
        // Search in status
        const statusMatch = cls.status?.toLowerCase().includes(searchLower);
        
        // Search in subject if available
        const subjectMatch = cls.subject?.toLowerCase().includes(searchLower);
        
        return titleMatch || nameMatch || teacherNameMatch || teacherEmailMatch || 
               descriptionMatch || statusMatch || subjectMatch;
      });
    }

    return result;
  }, [classes, filters]);

  // Find teachers without classes
  const teachersWithoutClasses = useMemo(() => {
    if (!teachers.length || !classes.length) return teachers;
    
    const teacherIdsWithClasses = new Set(classes.map(cls => cls.teacher_id).filter(Boolean));
    return teachers.filter(teacher => !teacherIdsWithClasses.has(teacher.id));
  }, [classes, teachers]);

  // Utility functions
  const formatDateTime = (dateString) => {
    if (!dateString) return "Not scheduled";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid date";
      
      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'scheduled':
        return "bg-yellow-500/20 text-yellow-300";
      case 'active':
        return "bg-green-500/20 text-green-300";
      case 'completed':
        return "bg-blue-500/20 text-blue-300";
      case 'cancelled':
        return "bg-red-500/20 text-red-300";
      default:
        return "bg-gray-500/20 text-gray-300";
    }
  };

  // Event handlers

  
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: '', teacher: '', search: '' });
  };

  const refreshData = async () => {
    await Promise.all([fetchClasses(), fetchTeachers()]);
    if (onRefresh) onRefresh(['classes', 'teachers']);
  };

  const handleScheduleClass = async (e) => {
    e.preventDefault();
    setScheduling(true);

    try {
      // Prepare class data for API
      const classData = {
        title: newClass.title,
        teacher_id: newClass.teacher_id,
        scheduled_date: new Date(newClass.scheduled_date).toISOString(),
        duration: newClass.duration,
        description: newClass.description,
        status: newClass.status,
        is_exam: newClass.is_exam,
        recurring: newClass.recurring,
        recurrence_type: newClass.recurrence_type,
        recurrence_days: newClass.recurrence_days,
        recurrence_interval: newClass.recurrence_interval
      };

      await adminApi.scheduleClass(classData);
      
      toast.success(newClass.is_exam ? 'Exam scheduled successfully!' : 'Class scheduled successfully!');
      setShowScheduleModal(false);
      
      // Reset form
      setNewClass({
        title: '',
        teacher_id: '',
        scheduled_date: '',
        duration: 60,
        description: '',
        status: 'scheduled',
        is_exam: false,
        recurring: false,
        recurrence_type: 'none',
        recurrence_days: 30,
        recurrence_interval: 1
      });

      // Refresh data
      if (onRefresh) onRefresh();

    } catch (error) {
      console.error('Error scheduling class:', error);
      toast.error(`Failed to schedule: ${error.message}`);
    } finally {
      setScheduling(false);
    }
  };


  const startVideoSession = async (classItem) => {
    try {
      const session = await adminApi.startVideoSession({
        classId: classItem.id,
        teacherId: classItem.teacher_id,
        className: classItem.title || classItem.name
      });
      toast.success('Video session started!');
      window.open(`/video-call/${session.meeting_id}`, '_blank');
    } catch (error) {
      toast.error(`Failed to start session: ${error.message}`);
    }
  };

  const viewVideoSession = (meetingId) => {
    if (meetingId) {
      window.open(`/video-call/${meetingId}`, '_blank');
    }
  };

  const editClass = (classItem) => {
    // Handle edit functionality
    console.log('Edit class:', classItem);
    toast.info('Edit functionality coming soon!');
  };

  const deleteClass = async (classItem) => {
    if (window.confirm(`Are you sure you want to delete "${classItem.title || classItem.name}"?`)) {
      try {
        await adminApi.deleteClass(classItem.id);
        toast.success('Class deleted successfully!');
        refreshData();
      } catch (error) {
        toast.error(`Failed to delete class: ${error.message}`);
      }
    }
  };

  // Loading state
  const isLoading = loading.classes || localLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12 flex-col">
        <PulsarLoader />
        <span className="mt-4 text-blue-300">Loading classes...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold flex items-center">
          <BookOpen className="mr-2" size={24} />
          Class Management
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={refreshData}
            className="bg-blue-800/50 hover:bg-blue-700/50 py-2 px-4 rounded-lg flex items-center"
          >
            <Users size={16} className="mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center"
          >
            <Plus size={16} className="mr-2" />
            Schedule Class
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-blue-800/30 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300" />
              <input
                type="text"
                placeholder="Search classes, teachers..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Teacher Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Teacher</label>
            <select
              value={filters.teacher}
              onChange={(e) => updateFilter('teacher', e.target.value)}
              className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All Teachers</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} - {teacher.subject || 'No subject'}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center justify-center"
            >
              <Filter size={16} className="mr-2" />
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Search Results Header */}
      {(filters.search || filters.status || filters.teacher) && (
        <div className="bg-blue-900/20 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold text-blue-200 mb-2">
            {filters.search && `Search Results for "${filters.search}"`}
            {!filters.search && 'Filtered Results'}
          </h3>
          <p className="text-blue-300 text-sm">
            Found {filteredClasses.length} class{filteredClasses.length !== 1 ? 'es' : ''}
            {filters.search && teachersWithoutClasses.length > 0 && 
              ` • ${teachersWithoutClasses.length} available teacher${teachersWithoutClasses.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
      )}

      {/* Classes List */}
      {filteredClasses.length > 0 ? (
        <div className="space-y-4">
          {filteredClasses.map((classItem) => (
            <div
              key={classItem.id}
              className="p-4 rounded-lg bg-blue-700/30 border border-blue-600/30 hover:bg-blue-700/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-bold text-lg">
                    {classItem.title || classItem.name || 'Untitled Class'}
                  </h4>
                  <div className="flex flex-wrap items-center mt-2 text-sm text-blue-200 gap-4">
                    <span className="flex items-center">
                      <User size={14} className="mr-1" />
                      Teacher: {classItem.teacher?.name || 'Unassigned'}
                      {classItem.teacher?.email && (
                        <span className="text-blue-300 ml-1">({classItem.teacher.email})</span>
                      )}
                    </span>
                    <span className="flex items-center">
                      <Calendar size={14} className="mr-1" />
                      {formatDateTime(classItem.scheduled_date || classItem.created_at)}
                    </span>
                    {classItem.duration && (
                      <span className="flex items-center">
                        <Clock size={14} className="mr-1" />
                        {classItem.duration} minutes
                      </span>
                    )}
                  </div>
                  {classItem.description && (
                    <p className="text-blue-300 text-sm mt-2">{classItem.description}</p>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {classItem.status === 'scheduled' && (
                    <button
                      onClick={() => startVideoSession(classItem)}
                      className="p-2 rounded-lg bg-green-600 hover:bg-green-500 flex items-center"
                      title="Start Video Session"
                    >
                      <Play size={16} />
                    </button>
                  )}
                  {classItem.status === 'active' && classItem.meeting_id && (
                    <button
                      onClick={() => viewVideoSession(classItem.meeting_id)}
                      className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center"
                      title="Join Video Session"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => editClass(classItem)}
                    className="p-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50"
                    title="Edit Class"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => deleteClass(classItem)}
                    className="p-2 rounded-lg bg-red-800/50 hover:bg-red-700/50"
                    title="Delete Class"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {/* Class Info Footer */}
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-blue-300">
                  Students: {classItem.students_classes?.length || classItem.enrolled_count || 0}
                  {classItem.max_students && ` / ${classItem.max_students}`}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(classItem.status)}`}>
                  {(classItem.status || 'unknown').toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* No Classes Found */
        <div className="text-center py-8">
          <BookOpen size={48} className="mx-auto text-blue-400 mb-3" />
          <p className="text-blue-200 mb-2">
            {filters.search || filters.status || filters.teacher
              ? `No classes found matching your criteria`
              : "No classes scheduled yet"
            }
          </p>
          {(filters.search || filters.status || filters.teacher) && (
            <button
              onClick={clearFilters}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Clear filters to see all classes
            </button>
          )}
        </div>
      )}

      {/* Teachers Without Classes Section */}
      {teachersWithoutClasses.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-blue-200 mb-4 flex items-center">
            <UserX size={20} className="mr-2" />
            Available Teachers ({teachersWithoutClasses.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {teachersWithoutClasses.map((teacher) => (
              <div key={teacher.id} className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="font-medium text-blue-100">{teacher.name}</p>
                    <p className="text-blue-300 text-sm">{teacher.subject || teacher.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      {classes.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4 mt-6">
          <h4 className="text-blue-200 font-semibold mb-3">Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-100">{classes.length}</p>
              <p className="text-blue-300">Total Classes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-100">
                {classes.filter(c => c.status === 'active').length}
              </p>
              <p className="text-blue-300">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-100">
                {classes.filter(c => c.status === 'scheduled').length}
              </p>
              <p className="text-blue-300">Scheduled</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-100">{teachersWithoutClasses.length}</p>
              <p className="text-blue-300">Available Teachers</p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Class Modal - Placeholder */}
       {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {newClass.is_exam ? 'Schedule New Exam' : 'Schedule New Class'}
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-blue-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleClass} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Exam/Class Toggle */}
                <div className="md:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newClass.is_exam}
                      onChange={(e) => setNewClass({...newClass, is_exam: e.target.checked})}
                      className="mr-2 rounded bg-blue-800/50 border-blue-700/30"
                    />
                    <span className="text-sm font-medium">This is an exam</span>
                  </label>
                </div>

                {/* Class/Exam Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    {newClass.is_exam ? 'Exam Title *' : 'Class Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newClass.title}
                    onChange={(e) => setNewClass({...newClass, title: e.target.value})}
                    placeholder={newClass.is_exam ? 'Enter exam title' : 'Enter class title'}
                    className="w-full p-3 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Teacher Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Teacher *</label>
                  <select
                    required
                    value={newClass.teacher_id}
                    onChange={(e) => setNewClass({...newClass, teacher_id: e.target.value})}
                    className="w-full p-3 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} ({teacher.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scheduled Date */}
                <div>
                  <label className="block text-sm font-medium mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newClass.scheduled_date}
                    onChange={(e) => setNewClass({...newClass, scheduled_date: e.target.value})}
                    className="w-full p-3 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (minutes) *</label>
                  <input
                    type="number"
                    required
                    min="30"
                    max="240"
                    value={newClass.duration}
                    onChange={(e) => setNewClass({...newClass, duration: parseInt(e.target.value)})}
                    placeholder="60"
                    className="w-full p-3 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium mb-1">Status *</label>
                  <select
                    required
                    value={newClass.status}
                    onChange={(e) => setNewClass({...newClass, status: e.target.value})}
                    className="w-full p-3 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Recurring Schedule */}
                <div className="md:col-span-2">
                  <label className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      checked={newClass.recurring}
                      onChange={(e) => setNewClass({...newClass, recurring: e.target.checked})}
                      className="mr-2 rounded bg-blue-800/50 border-blue-700/30"
                    />
                    <span className="text-sm font-medium flex items-center">
                      <Repeat size={16} className="mr-1" />
                      Recurring Schedule
                    </span>
                  </label>

                  {newClass.recurring && (
                    <div className="bg-blue-800/30 p-4 rounded-lg space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Recurrence Type</label>
                        <select
                          value={newClass.recurrence_type}
                          onChange={(e) => setNewClass({...newClass, recurrence_type: e.target.value})}
                          className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="custom">Custom Interval</option>
                        </select>
                      </div>

                      {newClass.recurrence_type === 'custom' && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Interval (days)</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={newClass.recurrence_interval}
                            onChange={(e) => setNewClass({...newClass, recurrence_interval: parseInt(e.target.value)})}
                            className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30"
                            placeholder="1"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-1">Duration (days)</label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={newClass.recurrence_days}
                          onChange={(e) => setNewClass({...newClass, recurrence_days: parseInt(e.target.value)})}
                          className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30"
                          placeholder="30"
                        />
                        <p className="text-xs text-blue-300 mt-1">
                          Schedule will repeat for {newClass.recurrence_days} days
                        </p>
                      </div>

                      {newClass.recurrence_type === 'daily' && (
                        <div className="flex items-center text-sm text-blue-300">
                          <CalendarDays size={14} className="mr-2" />
                          Daily for {newClass.recurrence_days} days
                        </div>
                      )}

                      {newClass.recurrence_type === 'weekly' && (
                        <div className="flex items-center text-sm text-blue-300">
                          <CalendarDays size={14} className="mr-2" />
                          Weekly for {Math.ceil(newClass.recurrence_days / 7)} weeks
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newClass.description}
                    onChange={(e) => setNewClass({...newClass, description: e.target.value})}
                    placeholder={newClass.is_exam ? 'Enter exam description' : 'Enter class description'}
                    rows="3"
                    className="w-full p-3 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-6 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50 border border-blue-700/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {scheduling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Scheduling...
                    </>
                  ) : (
                    newClass.is_exam ? 'Schedule Exam' : 'Schedule Class'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}