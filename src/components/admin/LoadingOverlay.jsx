import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";

export default function LoadingOverlay({ isVisible, message = "Loading..." }) {
  return (
    <AnimatePresence>
      {isVisible && (
       <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="fixed inset-0 bg-blue-950/90 backdrop-blur-xl z-50 flex items-center justify-center"
       >
         <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ type: "spring", damping: 15 }}
           className="text-center"
         >
           <motion.div
             animate={{ rotate: 360 }}
             transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
             className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
           />
           <p className="text-white text-lg font-semibold">{message}</p>
           <p className="text-blue-300 text-sm mt-2">Please wait...</p>
         </motion.div>
       </motion.div>
      )}
    </AnimatePresence>
  );
}
