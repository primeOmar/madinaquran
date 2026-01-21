
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-8">
      <Icon size={48} className="mx-auto text-blue-400 mb-3" />
      <p className="text-blue-200">{title}</p>
      {subtitle && <p className="text-blue-300 text-sm mt-1">{subtitle}</p>}
      {action && (
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="mt-4 bg-blue-600 hover:bg-blue-500 py-2 px-6 rounded-lg flex items-center mx-auto"
        >
          <Plus size={16} className="mr-2" />
          {action.label}
        </motion.button>
      )}
    </div>
  );
}
