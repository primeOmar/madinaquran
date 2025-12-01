import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "../lib/supabaseClient";
import { REDIRECT_URL } from "./config";

const buttonVariants = {
  idle: { scale: 1, boxShadow: "0px 0px 6px rgba(0, 255, 0, 0.6)" },
  loading: {
    scale: 1.1,
    boxShadow: "0px 0px 20px rgba(0, 255, 0, 0.9)",
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

export default function Login() {
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
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
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
    <div className="pt-16 min-h-screen w-screen flex items-center justify-center bg-gradient-to-r from-green-700 via-green-800 to-green-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-green-700">
          Welcome Back
        </h2>
        <p className="text-gray-600 text-center mt-2 mb-6">
          Login to continue your learning journey
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500"
          />
          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500"
          />
          <motion.button
            variants={buttonVariants}
            initial="idle"
            animate={loading ? "loading" : "idle"}
            whileTap="tap"
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold shadow-md hover:bg-green-700 transition disabled:opacity-50"
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
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </motion.button>
        </form>
        <div className="my-6 flex items-center justify-center">
          <span className="w-1/3 border-b"></span>
          <span className="px-2 text-gray-500">or</span>
          <span className="w-1/3 border-b"></span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border rounded-lg py-3 shadow hover:bg-gray-100 transition"
        >
          <FcGoogle size={24} /> Continue with Google
        </motion.button>
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
        <p className="text-center mt-6 text-gray-600">
          Don’t have an account?{" "}
          <a
            href="/register"
            className="text-green-600 font-semibold hover:underline"
          >
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
