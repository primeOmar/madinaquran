import { motion, AnimatePresence } from "framer-motion";
import { XCircle, X } from "lucide-react";

export default function ErrorAlert({ error, onClose }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 right-4 z-50 bg-red-600 text-white p-4 rounded-lg shadow-lg max-w-md"
        >
          <div className="flex items-start">
            <XCircle className="mr-2 flex-shrink-0 mt-0.5" size={20} />
            <span className="flex-1">{error}</span>
            <button 
              onClick={onClose}
              className="ml-4 text-white hover:text-gray-200 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
