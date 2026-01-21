import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "../lib/supabaseClient";

export default function Register() {
  const [step, setStep] = useState(1);
  const [course, setCourse] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect logged-in users
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = "/dashboard";
        }
      } catch (err) {
        console.error("Session check error:", err);
      }
    };
    checkUser();
  }, []);

  const handleChange = (e) => {
    setErrorMessage("");
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage("");
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
        },
      });

      if (error) {
        setErrorMessage(`Google sign-in failed: ${error.message}`);
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      setErrorMessage("Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // register function 

const registerUser = async (userData) => {
  try {
    // Validate input data
    if (!userData.email || !userData.password || !userData.name || !userData.course) {
      throw new Error('All fields are required');
    }

    if (userData.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Sign up user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth-callback`,
        data: {
          full_name: userData.name, // Use 'full_name' instead of 'name'
          course: userData.course,
          role: 'student'
        },
      },
    });

    if (error) {
      console.error('Supabase auth signup error:', error);
      
      // User-friendly error messages
      if (error.message.includes('already registered')) {
        throw new Error('This email is already registered. Please try logging in instead.');
      } else if (error.message.includes('Invalid email')) {
        throw new Error('Please enter a valid email address.');
      } else {
        throw new Error(`Registration failed: ${error.message}`);
      }
    }

    // After signup, manually create the student profile
    if (data.user) {
      // Create profile entry
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: userData.email,
          name: userData.name,
          role: 'student',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }

      // Create student entry
      const { error: studentError } = await supabase
        .from('students')
        .upsert({
          name: userData.name,
          email: userData.email,
          profile_id: data.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (studentError) {
        console.error('Student creation error:', studentError);
      }
    }

    return {
      success: true,
      needsConfirmation: !data.session,
      user: data.user,
      message: 'Please check your email to confirm your account.'
    };

  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};
  // Handle user registration
  const handleNext = async () => {
    if (step === 1 && course) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setIsLoading(true);
      setErrorMessage("");
      
      const { name, email, password, confirmPassword } = formData;

      // Validation
      if (!name.trim()) {
        setErrorMessage("Name is required!");
        setIsLoading(false);
        return;
      }
      if (!email.trim()) {
        setErrorMessage("Email is required!");
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match!");
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters long!");
        setIsLoading(false);
        return;
      }

      try {
        const userData = {
          name: name.trim(),
          email: email.trim(),
          password,
          course
        };

        // Register user
        const result = await registerUser(userData);

        if (!result.success) {
          setErrorMessage(result.error || "Registration failed. Please try again.");
          setIsLoading(false);
          return;
        }

        // Handle email confirmation requirement
        if (result.needsConfirmation) {
          setStep(4); // Email confirmation step
          setIsLoading(false);
          return;
        }

        // If we have a session (email confirmation not required), redirect to dashboard
        setStep(3);
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 2000);

      } catch (err) {
        console.error("Registration process error:", err);
        setErrorMessage("Registration failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="pt-16 min-h-screen w-screen flex items-center justify-center bg-gradient-to-r from-green-200 via-green-300 to-green-400">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 w-full max-w-md">
        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
            {errorMessage}
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold text-center text-green-700">
                Choose Your Course
              </h2>
              <p className="text-gray-600 text-center mt-2 mb-6">
                Select the course you want to enroll in
              </p>
              <div className="space-y-4">
                {["Hifdh", "Recitation", "Qaida"].map((c) => (
                  <motion.button
                    key={c}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCourse(c)}
                    className={`w-full py-3 rounded-lg font-semibold border shadow-md transition-all ${
                      course === c
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-green-700 hover:bg-green-50 border-green-300"
                    }`}
                  >
                    {c}
                  </motion.button>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: course ? 1.05 : 1 }}
                whileTap={{ scale: course ? 0.95 : 1 }}
                onClick={handleNext}
                disabled={!course}
                className={`mt-6 w-full py-3 rounded-lg font-semibold shadow-md transition-all ${
                  course
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
              >
                Next
              </motion.button>
              <p className="text-center mt-6 text-gray-600">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-green-600 font-semibold hover:underline"
                >
                  Login
                </a>
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold text-center text-green-700">
                Create Your Account
              </h2>
              <p className="text-gray-600 text-center mt-2 mb-6">
                Course: <span className="font-semibold text-green-600">{course}</span>
              </p>
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-4">
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="email"
                    name="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="password"
                    name="password"
                    placeholder="Password (min. 6 characters)"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    disabled={isLoading}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <motion.button
                    whileHover={{ scale: isLoading ? 1 : 1.05 }}
                    whileTap={{ scale: isLoading ? 1 : 0.95 }}
                    onClick={handleNext}
                    disabled={isLoading}
                    className={`w-full py-3 rounded-lg font-semibold shadow-md transition-all ${
                      isLoading
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating Account...
                      </div>
                    ) : (
                      "Register"
                    )}
                  </motion.button>
                </div>
              </form>

              <div className="my-6 flex items-center justify-center">
                <span className="w-1/3 border-b"></span>
                <span className="px-2 text-gray-500">or</span>
                <span className="w-1/3 border-b"></span>
              </div>

              <motion.button
                whileHover={{ scale: isLoading ? 1 : 1.05 }}
                whileTap={{ scale: isLoading ? 1 : 0.95 }}
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border rounded-lg py-3 shadow hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FcGoogle className="text-xl" /> 
                Continue with Google
              </motion.button>
              
              <div className="flex justify-between mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep(1)}
                  className="text-green-600 font-semibold hover:underline"
                  disabled={isLoading}
                >
                  ← Back
                </motion.button>
                <p className="text-gray-600">
                  Have an account?{" "}
                  <a
                    href="/login"
                    className="text-green-600 font-semibold hover:underline"
                  >
                    Login
                  </a>
                </p>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-green-700 mb-4">
                Registration Successful!
              </h2>
              <p className="text-gray-600 mb-2">
                Welcome to <span className="font-semibold text-green-600">{course}</span>!
              </p>
              <p className="text-gray-600 mb-4">
                Your account has been created successfully.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Redirecting to dashboard...
              </p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
  <motion.div
    key="step4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="text-center"
  >
    <div className="text-6xl mb-4">📧</div>
    <h2 className="text-3xl font-bold text-green-700 mb-4">
      Check Your Email
    </h2>
    <p className="text-gray-600 mb-4">
      We've sent a confirmation email to <br/>
      <span className="font-semibold">{formData.email}</span>
    </p>
    <p className="text-gray-600 mb-6">
      Please click the confirmation link to complete your registration 
      and access your dashboard.
    </p>
    <p className="text-sm text-gray-500 mb-4">
      You'll be automatically redirected to your dashboard after confirmation.
    </p>
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => window.location.href = "/login"}
      className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
    >
      Go to Login
    </motion.button>
  </motion.div>
)}
      </AnimatePresence>
      </div>
    </div>
  );
}