import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Menu, X, Bell, Settings, ChevronDown, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import sub-components
import Sidebar from './Sidebar';
import StatsOverview from './StatsOverview';
import OverviewSection from './sections/OverviewSection';
import TeachersSection from './sections/TeachersSection';
import StudentsSection from './sections/StudentsSection';
import ClassesSection from './sections/ClassesSection';
import FeesSection from './sections/FeesSection';
import LiveSessionsSection from './sections/LiveSessionsSection';
import LoadingOverlay from './LoadingOverlay';
import ErrorAlert from './ErrorAlert';
import { useAdminData } from '../../hooks/useAdminData';

// Import your modal
import AddTeacherModal from '../modals/AddTeacherModal';

export default function AdminDashboard({ adminName = "Administrator" }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [addTeacherLoading, setAddTeacherLoading] = useState(false);
  // Use custom hook for data management
  const {
    teachers,
    students,
    classes,
    videoSessions,
    feePayments,
    stats,
    loading,
    refreshData
  } = useAdminData();

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Session expiration monitoring
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          toast.info('Session expired. Please log in again.');
          window.location.replace("/admin-login");
          return;
        }
        
        // Check if session is about to expire (within 5 minutes)
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        
        if (expiresAt < fiveMinutesFromNow) {
          toast.info('Your session will expire soon. Please save your work.');
        }
      } catch (error) {
        console.error('Session check error:', error);
      }
    };

    // Check session every minute
    const sessionInterval = setInterval(checkSession, 60000);
    
    // Initial check
    checkSession();

    return () => clearInterval(sessionInterval);
  }, []);

  // Enhanced logout function
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setError("");
    
    try {
      // Security: Clear any sensitive data from localStorage first
      const sensitiveKeys = ['admin_token', 'user_session', 'sensitive_data'];
      sensitiveKeys.forEach(key => localStorage.removeItem(key));
      
      // Security: Add a small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Perform logout
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Security: Clear all client-side data
      localStorage.clear();
      sessionStorage.clear();
      
      // Show success message with animation
      toast.success('Logged out successfully! Redirecting...', {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: true,
      });
      
      // Redirect with security delay
      setTimeout(() => {
        window.location.replace("/admin-login");
      }, 1500);
      
    } catch (error) {
      console.error('Logout error:', error);
      setError(error.message || 'Failed to log out securely');
      toast.error('Logout failed. Please try again.');
    } finally {
      setIsLoggingOut(false);
      setUserMenuOpen(false);
    }
  };

  // Add teacher handler
const handleAddTeacher = async (teacherData) => {
  try {
    const response = await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teacherData)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to add teacher');
    }

    return result;
  } catch (error) {
    console.error('Teacher creation error:', error);
    throw error;
  }
};

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => isMobile && setIsSidebarOpen(false);

  // Render active section
  const renderActiveSection = () => {
    const commonProps = {
      data: { teachers, students, classes, videoSessions, feePayments },
      loading,
      onRefresh: refreshData,
      onError: setError
    };

    switch (activeSection) {
      case "overview":
        return <OverviewSection {...commonProps} />;
      case "teachers":
        return <TeachersSection {...commonProps} onAddTeacher={() => setShowAddTeacherModal(true)} />;
      case "students":
        return <StudentsSection {...commonProps} />;
      case "classes":
        return <ClassesSection {...commonProps} />;
      case "fees":
        return <FeesSection {...commonProps} />;
      case "live":
        return <LiveSessionsSection {...commonProps} />;
      default:
        return <OverviewSection {...commonProps} />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white overflow-hidden">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      {/* Loading Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 bg-blue-950/90 backdrop-blur-xl z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-white text-lg font-semibold">Logging Out</p>
            <p className="text-blue-300 text-sm mt-2">Please wait...</p>
          </div>
        </div>
      )}

      <ErrorAlert error={error} onClose={() => setError("")} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-blue-950/90 backdrop-blur-md border-b border-blue-700/30 p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
           <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-blue-800/50 transition-all duration-200"
          >
            {isSidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button> 
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-400" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
        </div>

        {/* Enhanced User Menu with Animations */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-blue-800/50 transition-all duration-200 group"
            onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
          >
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <Shield size={20} className="text-white" />
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium">{adminName}</p>
                <p className="text-xs text-blue-300">Administrator</p>
              </div>
            </div>
            <ChevronDown 
              size={16} 
              className={`text-blue-300 transition-transform duration-200 ${
                userMenuOpen ? 'rotate-180' : 'group-hover:rotate-180'
              }`}
            />
          </button>

          {/* Enhanced Dropdown Menu with Animations */}
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-64 bg-blue-950/95 backdrop-blur-xl rounded-xl shadow-2xl border border-blue-700/30 py-2 z-50"
              >
                {/* User Info */}
                <div className="px-4 py-3 border-b border-blue-700/30">
                  <p className="text-sm font-semibold text-white truncate">{adminName}</p>
                  <p className="text-xs text-blue-300 mt-1">Administrator Account</p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      <Shield size={12} className="mr-1" />
                      Super Admin
                    </span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center w-full px-4 py-2 text-sm text-blue-200 hover:bg-blue-800/50 transition-all duration-200 group"
                  >
                    <Settings size={16} className="mr-3 text-blue-400 group-hover:scale-110 transition-transform" />
                    Settings & Preferences
                  </button>
                  
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center w-full px-4 py-2 text-sm text-blue-200 hover:bg-blue-800/50 transition-all duration-200 group"
                  >
                    <Bell size={16} className="mr-3 text-blue-400 group-hover:scale-110 transition-transform" />
                    Notification Center
                  </button>
                </div>

                {/* Logout Section */}
                <div className="py-2 border-t border-blue-700/30">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="mr-3">
                      <LogOut size={16} className="text-red-400 group-hover:scale-110 transition-transform" />
                    </div>
                    {isLoggingOut ? "Signing Out..." : "Sign Out"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isMobile={isMobile}
          adminName={adminName}
        />

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <StatsOverview stats={stats} />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-blue-800/40 backdrop-blur-md rounded-xl p-4 md:p-6 border border-blue-700/30"
            >
              {renderActiveSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      {/* Modal rendered at the root level */}
      <AddTeacherModal
        isOpen={showAddTeacherModal}
        onClose={() => setShowAddTeacherModal(false)}
        onSubmit={handleAddTeacher}
        isLoading={addTeacherLoading}
      />
    </div>
  );
}