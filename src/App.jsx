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
import { useAuth } from "./components/AuthContext"; // ✅ Pull auth state

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
// import TeacherDashboard from ".pages/TeacherDashboard";

function App() {
  const location = useLocation();
  const { user } = useAuth(); // ✅ get auth stat
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
        {/*<Route path="/TeacherDashboard" element={<TeacherDashboard/>} />*/}
      </Routes>
    </>
  );
}

export default App;
