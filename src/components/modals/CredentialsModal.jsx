
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, X, ClipboardList } from "lucide-react";
import { toast } from 'react-toastify';

export default function CredentialsModal({ isOpen, credentials, onClose, title }) {
  const copyToClipboard = async () => {
    try {
      const credentialsText = `Teacher Login Credentials:
Email: ${credentials.email}
Password: ${credentials.password}
Login URL: ${credentials.login_url}

Please share these credentials securely with the teacher.`;

      await navigator.clipboard.writeText(credentialsText);
      toast.success('Credentials copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && credentials && (
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
            className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center">
                <CheckCircle className="mr-2 text-green-400" size={24} />
                {title}
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-blue-800/50"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-blue-800/30 rounded-lg p-4 mb-4">
              <p className="text-blue-200 mb-3">Please share these login details:</p>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-blue-300">Email:</span>
                  <span className="font-mono">{credentials.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">Password:</span>
                  <span className="font-mono">{credentials.password}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">Login URL:</span>
                  <span className="font-mono text-sm">{credentials.login_url}</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center"
              >
                <ClipboardList size={16} className="mr-2" />
                Copy Credentials
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 p-3 bg-yellow-50/10 border border-yellow-200/20 rounded">
              <p className="text-sm text-yellow-300">
                Important: Please save these credentials securely and share them with the teacher. They won't be shown again.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
