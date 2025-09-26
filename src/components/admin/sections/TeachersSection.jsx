import { useState } from 'react';
import { motion } from "framer-motion";
import { Users, Plus, Edit, Trash2, Mail, BookOpen, CheckCircle, XCircle, Loader2, Copy } from "lucide-react";
import { toast } from 'react-toastify';
import { adminApi } from '../../../lib/supabaseClient';
import AddTeacherModal from '../../modals/AddTeacherModal';
import CredentialsModal from '../../modals/CredentialsModal';
import WaveLoader from '../loaders/WaveLoader';

export default function TeachersSection({ data, loading, onRefresh, onError }) {
  const [showAddTeacherForm, setShowAddTeacherForm] = useState(false);
  const [teacherCredentials, setTeacherCredentials] = useState(null);
  const [showCredentialsPopup, setShowCredentialsPopup] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const { teachers = [] } = data;

  const handleAddTeacher = async (teacherForm) => {
    setActionLoading(prev => ({ ...prev, addTeacher: true }));
    
    try {
      const data = await adminApi.addTeacher(teacherForm);
      
      if (data.success) {
        setTeacherCredentials(data.credentials);
        setShowCredentialsPopup(true);
        
        try {
          const credentialsText = `Email: ${data.credentials.email}\nPassword: ${data.credentials.password}\nLogin: ${data.credentials.login_url}`;
          await navigator.clipboard.writeText(credentialsText);
          toast.success(`Teacher ${data.teacher.name} added successfully! Credentials copied to clipboard.`);
        } catch (clipError) {
          toast.success(`Teacher ${data.teacher.name} added successfully!`);
        }
        
        setShowAddTeacherForm(false);
        onRefresh(['teachers']);
      } else {
        throw new Error(data.error || 'Failed to create teacher');
      }
    } catch (error) {
      let errorMessage = 'Failed to add teacher';
      if (error.message.includes('already exists')) {
        errorMessage = 'A teacher with this email already exists';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setActionLoading(prev => ({ ...prev, addTeacher: false }));
    }
  };

  const removeTeacher = async (teacherId) => {
    if (!window.confirm("Are you sure you want to remove this teacher?")) return;
    
    setActionLoading(prev => ({ ...prev, [`remove_${teacherId}`]: true }));
    
    try {
      await adminApi.removeTeacher(teacherId);
      toast.success("Teacher removed successfully");
      onRefresh(['teachers']);
    } catch (error) {
      toast.error(`Failed to remove teacher: ${error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [`remove_${teacherId}`]: false }));
    }
  };

  const handleResendInvite = async (teacherId, teacherName) => {
    setActionLoading(prev => ({ ...prev, [`resend_${teacherId}`]: true }));
    
    try {
      // Fetch teacher credentials from the database
      const credentials = await adminApi.getTeacherCredentials(teacherId);
      
      if (credentials) {
        setTeacherCredentials({
          ...credentials,
          teacherName: teacherName
        });
        setShowCredentialsPopup(true);
        toast.success(`Login credentials fetched for ${teacherName}`);
      } else {
        throw new Error('Could not fetch teacher credentials');
      }
    } catch (error) {
      toast.error(`Failed to fetch credentials: ${error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [`resend_${teacherId}`]: false }));
    }
  };

  const copyCredentialsToClipboard = async (credentials) => {
    try {
      const credentialsText = `Email: ${credentials.email}\nPassword: ${credentials.password}\nLogin URL: ${credentials.login_url}`;
      await navigator.clipboard.writeText(credentialsText);
      toast.success('Credentials copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy credentials to clipboard');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold flex items-center">
          <Users className="mr-2" size={24} />
          Teacher Management
        </h3>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddTeacherForm(true)}
          className="text-sm bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center"
        >
          <Plus size={16} className="mr-2" />
          Add Teacher
        </motion.button>
      </div>
      
      {loading.teachers ? (
        <div className="flex justify-center items-center py-12 flex-col">
          <WaveLoader />
          <span className="mt-4 text-blue-300">Loading teachers...</span>
        </div>
      ) : teachers.length > 0 ? (
        <div className="grid gap-4">
          {teachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              onRemove={removeTeacher}
              onResendInvite={handleResendInvite}
              isRemoving={actionLoading[`remove_${teacher.id}`]}
              isResending={actionLoading[`resend_${teacher.id}`]}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No teachers added yet"
          action={{
            label: "Add Your First Teacher",
            onClick: () => setShowAddTeacherForm(true)
          }}
        />
      )}

      <AddTeacherModal
        isOpen={showAddTeacherForm}
        onClose={() => setShowAddTeacherForm(false)}
        onSubmit={handleAddTeacher}
        isLoading={actionLoading.addTeacher}
      />

      <CredentialsModal
        isOpen={showCredentialsPopup}
        credentials={teacherCredentials}
        onClose={() => setShowCredentialsPopup(false)}
        onCopy={copyCredentialsToClipboard}
        title="Teacher Login Credentials"
        teacherName={teacherCredentials?.teacherName}
      />
    </div>
  );
}

// Component for individual teacher card
function TeacherCard({ teacher, onRemove, onResendInvite, isRemoving, isResending }) {
  return (
    <div className="p-4 rounded-lg bg-blue-700/30 border border-blue-600/30 hover:bg-blue-700/50 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-lg flex items-center">
            {teacher.name}
            {teacher.status === "active" ? (
              <CheckCircle size={16} className="text-blue-300 ml-2" />
            ) : (
              <XCircle size={16} className="text-red-300 ml-2" />
            )}
          </h4>
          <div className="flex flex-wrap items-center mt-2 text-sm text-blue-200">
            <span className="flex items-center mr-4">
              <Mail size={14} className="mr-1" />
              {teacher.email}
            </span>
            <span className="flex items-center">
              <BookOpen size={14} className="mr-1" />
              {teacher.subject}
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button className="p-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50">
            <Edit size={16} />
          </button>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onRemove(teacher.id)}
            disabled={isRemoving}
            className="p-2 rounded-lg bg-red-800/50 hover:bg-red-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </motion.button>
        </div>
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          teacher.status === "active" 
            ? "bg-green-900/50 text-green-300" 
            : "bg-red-900/50 text-red-300"
        }`}>
          {teacher.status === "active" ? "Active" : "Inactive"}
        </span>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onResendInvite(teacher.id, teacher.name)}
          disabled={isResending}
          className="text-sm bg-green-600 hover:bg-green-500 py-1 px-3 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isResending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Mail size={14} className="mr-1" />
          )}
          Resend Invite
        </motion.button>
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ icon: Icon, title, action }) {
  return (
    <div className="text-center py-8">
      <Icon size={48} className="mx-auto text-blue-400 mb-3" />
      <p className="text-blue-200 mb-4">{title}</p>
      <button
        onClick={action.onClick}
        className="text-sm bg-blue-600 hover:bg-blue-500 py-2 px-4 rounded-lg flex items-center mx-auto"
      >
        <Plus size={16} className="mr-2" />
        {action.label}
      </button>
    </div>
  );
}

// Updated CredentialsModal component
function CredentialsModal({ isOpen, credentials, onClose, onCopy, title, teacherName }) {
  if (!isOpen || !credentials) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        {teacherName && (
          <p className="text-blue-200 mb-4">Credentials for: <strong>{teacherName}</strong></p>
        )}
        
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-blue-300 mb-1">Email</label>
            <div className="flex items-center justify-between p-2 bg-blue-800/50 rounded-lg">
              <code className="text-blue-100">{credentials.email}</code>
              <button
                onClick={() => navigator.clipboard.writeText(credentials.email)}
                className="text-blue-300 hover:text-white ml-2"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-blue-300 mb-1">Password</label>
            <div className="flex items-center justify-between p-2 bg-blue-800/50 rounded-lg">
              <code className="text-blue-100">{credentials.password}</code>
              <button
                onClick={() => navigator.clipboard.writeText(credentials.password)}
                className="text-blue-300 hover:text-white ml-2"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
          
          {credentials.login_url && (
            <div>
              <label className="block text-sm font-medium text-blue-300 mb-1">Login URL</label>
              <div className="flex items-center justify-between p-2 bg-blue-800/50 rounded-lg">
                <code className="text-blue-100 text-xs">{credentials.login_url}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(credentials.login_url)}
                  className="text-blue-300 hover:text-white ml-2"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => onCopy(credentials)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center"
          >
            <Copy size={16} className="mr-2" />
            Copy All
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
