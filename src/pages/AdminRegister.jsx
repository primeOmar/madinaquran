import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

// Initialize Supabase client (for session checking only)
const supabaseUrl = window._env_?.REACT_APP_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = window._env_?.REACT_APP_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API base URL
const API_BASE_URL = window._env_?.REACT_APP_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

export default function AdminRegister() {
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    confirmPassword: "" 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  // Check for existing admin session
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user has admin role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.role === 'admin') {
          navigate('/admin-dashboard');
        }
      }
    };
    
    checkUser();
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    if (!formData.name) {
      setError("Name is required");
      return;
    }
    
    setLoading(true);
    
    try {
      // Call server endpoint to create admin with proper role assignment
      const response = await fetch(`${API_BASE_URL}/api/admin/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }
      
      setSuccess("Admin account created successfully! Please check your email to confirm your account.");
      setLoading(false);
      
      // Reset form on success
      setFormData({ name: "", email: "", password: "", confirmPassword: "" });
      
    } catch (err) {
      setError(err.message || "An unexpected error occurred during registration");
      setLoading(false);
    }
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-center text-blue-700">
            Admin Registration
          </h2>
          <p className="text-gray-600 text-center mt-2">
            Restricted access - Super privileges required
          </p>
        </motion.div>
        
        <form onSubmit={handleRegister} className="space-y-4">
          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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
          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
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
                Creating Admin...
              </span>
            ) : (
              "Create Admin Account"
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
          Already have an admin account? <a href="/admin-login" className="text-blue-600 hover:underline">Sign in here</a>
        </p>
        
       
      </div>
    </div>
  );
}