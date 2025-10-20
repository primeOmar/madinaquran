import { useEffect } from 'react';
import { Routes, Route, useLocation } from "react-router-dom";

// ✅ Components
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import DiagonalSeparator from "./components/DiagonalSeparator";
import Courses from "./components/Courses";
import WhyChooseUs from "./components/WhyChooseUs";
import Testimonials from "./components/Testimonials";
import Pricing from "./components/Pricing";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
//import VideoCall from "./components/VideoCall";
import { useAuth } from "./components/AuthContext"; // ✅ Pull auth state
import ConnectionTest from './pages/ConnectionTest';

// ✅ Storage initialization
import { initializeStorage } from "./lib/supabaseClient";

// ✅ Pages
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Congratulations from "./pages/Congratulations"; 
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminRegister from "./pages/AdminRegister";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherDashboard from "./pages/TeacherDashboard";
import AuthCallback from './pages/AuthCallback';
import EmailConfirmationHandler from './pages/EmailConfirmationHandler';

function App() {
  const location = useLocation();
  const { user } = useAuth(); // ✅ get auth state
  
  // ✅ Initialize storage when app starts
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🚀 App starting - initializing storage...');
        
        // Initialize Supabase storage configuration
        const storageResult = await initializeStorage();
        console.log('📦 Storage initialization completed:', storageResult);
        
        if (storageResult.success) {
          console.log('✅ Storage is ready for audio operations');
        } else {
          console.warn('⚠️ Storage initialization had issues:', storageResult.error);
        }
      } catch (error) {
        console.error('💥 App initialization error:', error);
      }
    };

    initApp();
  }, []); // Run once when app mounts

  // ✅ Check if we are on dashboard route
  const isDashboard = location.pathname.startsWith("/dashboard");

  return (
    <>
      <Routes>
        {/* Homepage */}
        <Route
          path="/"
          element={
            <>
            <Navbar />
              <Hero />
              <DiagonalSeparator />
              <About />
              <Courses />
              <WhyChooseUs />
              <Testimonials />
              <Pricing />
              <CTA />
              <Footer />
            </>
          }
        />

        {/* Auth Pages */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/Congratulations" element={<Congratulations />} />

        {/* Dashboard Page (protected view) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin-register" element={<AdminRegister />} />
        <Route path="/teacher-login" element={<TeacherLogin />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="/email-confirmation" element={<EmailConfirmationHandler />} />
        <Route path="/debug-connection" element={<ConnectionTest />} />
        {/*<Route path="/video-call" element={<VideoCall />} />*/}
      </Routes>
    </>
  );
}

export default App;
