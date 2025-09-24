import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "../lib/supabaseClient";
import { REDIRECT_URL } from "./config";

const buttonVariants = {
  idle: { scale: 1, boxShadow: "0px 0px 6px rgba(59, 130, 246, 0.6)" },
  loading: {
    scale: 1.1,
    boxShadow: "0px 0px 20px rgba(59, 130, 246, 0.9)",
    transition: {
      yoyo: Infinity,
      duration: 0.6,
      ease: "easeInOut",
    },
  },
  tap: { scale: 0.95 },
};

const messageVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300 } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.3 } },
};

export default function AdminLogin() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    
    try {
      // First sign in with email/password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      
      // Check if user has admin role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();
        
      if (profileError || profileData.role !== 'admin') {
        await supabase.auth.signOut();
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }
      
      setSuccess("Admin login successful! Redirecting...");
      setTimeout(() => {
        window.location.href = "/admin-dashboard";
      }, 1500);
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: REDIRECT_URL },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="pt-16 min-h-screen w-screen flex items-center justify-center bg-gradient-to-r from-blue-800 via-blue-900 to-indigo-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-center text-blue-700">
            Admin Portal
          </h2>
          <p className="text-gray-600 text-center mt-2">
            Restricted access - Super privileges required
          </p>
        </motion.div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="email"
            name="email"
            placeholder="Admin Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <motion.button
            variants={buttonVariants}
            initial="idle"
            animate={loading ? "loading" : "idle"}
            whileTap="tap"
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  className="loader-dot bg-white rounded-full w-4 h-4"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                />
                <motion.span
                  className="loader-dot bg-white rounded-full w-4 h-4"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                />
                <motion.span
                  className="loader-dot bg-white rounded-full w-4 h-4"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                />
                Authenticating...
              </span>
            ) : (
              "Admin Login"
            )}
          </motion.button>
        </form>
        
        <AnimatePresence>
          {error && (
            <motion.p
              className="mt-4 text-sm text-red-600 text-center bg-red-100 border border-red-400 rounded-md p-2 shadow-sm"
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              ⚠️ {error}
            </motion.p>
          )}
          {success && (
            <motion.p
              className="mt-4 text-sm text-green-600 text-center bg-green-100 border border-green-400 rounded-md p-2 shadow-sm"
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              ✅ {success}
            </motion.p>
          )}
        </AnimatePresence>
        
        <p className="text-center mt-6 text-gray-600 text-sm">
          Forgot credentials? Contact system administrator
        </p>
      </div>
    </div>
  );
}