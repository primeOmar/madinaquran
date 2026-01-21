import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Users, Repeat } from 'lucide-react';
import { adminApi } from '../../lib/supabaseClient';
import { toast } from 'react-toastify';

export default function ScheduleClassModal({ isOpen, onClose, teachers, onClassScheduled }) {
  const [formData, setFormData] = useState({
    title: '',
    teacher_id: '',
    scheduled_date: '',
    duration: 60,
    max_students: 20,
    description: '',
    recurring: { enabled: false, frequency: 'weekly', weeks: 4 }
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await adminApi.scheduleClass(formData);
      toast.success('Class scheduled successfully!');
      onClassScheduled(response);
      onClose();
      setFormData({
        title: '',
        teacher_id: '',
        scheduled_date: '',
        duration: 60,
        max_students: 20,
        description: '',
        recurring: { enabled: false, frequency: 'weekly', weeks: 4 }
      });
    } catch (error) {
      toast.error(`Failed to schedule class: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.startsWith('recurring.')) {
      const recurringField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        recurring: { ...prev.recurring, [recurringField]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
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
          className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center">
              <Calendar className="mr-2" size={24} />
              Schedule New Class
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-blue-800/50"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Advanced Mathematics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Teacher *</label>
                <select
                  required
                  value={formData.teacher_id}
                  onChange={(e) => handleInputChange('teacher_id', e.target.value)}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min="30"
                  max="240"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Max Students</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.max_students}
                  onChange={(e) => handleInputChange('max_students', parseInt(e.target.value))}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.recurring.enabled}
                    onChange={(e) => handleInputChange('recurring.enabled', e.target.checked)}
                    className="mr-2 rounded bg-blue-800/50 border-blue-700/30"
                  />
                  <span className="text-sm flex items-center">
                    <Repeat size={14} className="mr-1" />
                    Recurring weekly
                  </span>
                </label>
              </div>
            </div>

            {formData.recurring.enabled && (
              <div className="bg-blue-800/30 p-4 rounded-lg">
                <label className="block text-sm font-medium mb-2">Recurring Settings</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Frequency</label>
                    <select
                      value={formData.recurring.frequency}
                      onChange={(e) => handleInputChange('recurring.frequency', e.target.value)}
                      className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Number of classes</label>
                    <input
                      type="number"
                      min="2"
                      max="12"
                      value={formData.recurring.weeks}
                      onChange={(e) => handleInputChange('recurring.weeks', parseInt(e.target.value))}
                      className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows="3"
                className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500"
                placeholder="Class description and objectives..."
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? 'Scheduling...' : 'Schedule Class'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}