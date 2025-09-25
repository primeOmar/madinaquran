// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { makeApiRequest, supabase, testAuthentication } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  ClipboardList,
  BookOpen,
  Clock,
  User,
  Calendar,
  Award,
  BarChart3,
  Download,
  Upload,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Mail,
  RefreshCw
} from "lucide-react";


export default function Dashboard() {
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [exams, setExams] = useState([]);
  const [stats, setStats] = useState([
    { label: "Total Classes", value: "0", icon: BookOpen, change: "+0" },
    { label: "Hours Learned", value: "0", icon: Clock, change: "+0" },
    { label: "Assignments", value: "0", icon: FileText, change: "+0" },
    { label: "Avg. Score", value: "0%", icon: BarChart3, change: "+0%" },
  ]);
  const [studentName, setStudentName] = useState("Student");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [hasTeacher, setHasTeacher] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeSection, setActiveSection] = useState("classes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userEmailVerified, setUserEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // PROPERLY AUTHENTICATED FETCH FUNCTIONS
 const fetchStatsData = async () => {
    try {
      console.log('📊 Starting stats fetch...');
      const statsData = await makeApiRequest('/student/stats');
      console.log('📊 Stats data received:', statsData);
      
      if (!statsData || typeof statsData !== 'object') {
        throw new Error('Invalid stats data received');
      }
      const statsArray = [
        { 
          label: "Total Classes", 
          value: statsData.total_classes?.toString() || "0", 
          icon: BookOpen, 
          change: "+0" 
        },
        { 
          label: "Hours Learned", 
          value: statsData.hours_learned?.toString() || "0", 
          icon: Clock, 
          change: "+0" 
        },
        { 
          label: "Assignments", 
          value: statsData.assignments?.toString() || "0", 
          icon: FileText, 
          change: "+0" 
        },
        { 
          label: "Avg. Score", 
          value: `${statsData.avg_score || "0"}%`, 
          icon: BarChart3, 
          change: "+0%" 
        },
      ];
      
      setStats(statsArray);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats([
        { label: "Total Classes", value: "0", icon: BookOpen, change: "+0" },
        { label: "Hours Learned", value: "0", icon: Clock, change: "+0" },
        { label: "Assignments", value: "0", icon: FileText, change: "+0" },
        { label: "Avg. Score", value: "0%", icon: BarChart3, change: "+0%" },
      ]);
      alert('Failed to load statistics. Please try again later.');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const classesData = await makeApiRequest('/api/student/classes');
      
      if (Array.isArray(classesData)) {
        setClasses(classesData);
      } else if (classesData && Array.isArray(classesData.classes)) {
        setClasses(classesData.classes);
      } else {
        setClasses([]);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]);
      alert('Failed to load classes. Please try again later.');
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const assignmentsData = await makeApiRequest('/api/student/assignments');
      
      if (Array.isArray(assignmentsData)) {
        setAssignments(assignmentsData);
      } else if (assignmentsData && Array.isArray(assignmentsData.assignments)) {
        setAssignments(assignmentsData.assignments);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
      alert('Failed to load assignments. Please try again later.');
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const paymentsData = await makeApiRequest('/api/student/payments');
      
      if (Array.isArray(paymentsData)) {
        setPayments(paymentsData);
      } else if (paymentsData && Array.isArray(paymentsData.payments)) {
        setPayments(paymentsData.payments);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
      alert('Failed to load payments. Please try again later.');
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchTeacherStatus = async () => {
    try {
      const teacherData = await makeApiRequest('/api/student/teacher-check');
      
      if (typeof teacherData === 'object' && teacherData !== null) {
        setHasTeacher(teacherData.hasTeacher || teacherData.has_teacher || false);
      } else {
        setHasTeacher(false);
      }
    } catch (error) {
      console.error('Error fetching teacher status:', error);
      setHasTeacher(false);
    }
  };

  const fetchExams = async () => {
    try {
      const examsData = await makeApiRequest('/api/student/exams');
      
      if (Array.isArray(examsData)) {
        setExams(examsData);
      } else if (examsData && Array.isArray(examsData.exams)) {
        setExams(examsData.exams);
      } else {
        setExams([]);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
      setExams([]);
    }
  };

  const handleContactAdmin = async () => {
    if (!contactMessage.trim()) {
      alert('Please enter a message before sending.');
      return;
    }

    setSendingMessage(true);
    try {
      const response = await makeApiRequest('/api/student/contact-admin', {
        method: 'POST',
        body: JSON.stringify({
          message: contactMessage
        }),
      });
      
      if (response && response.success !== false) {
        alert('Message sent to admin! They will contact you soon.');
        setContactMessage('');
      } else {
        throw new Error(response?.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error contacting admin:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // FIXED: Initialize dashboard without headers
 
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        console.log('🚀 Initializing dashboard with auth check...');
        
        // Test authentication first
        const authTest = await testAuthentication();
        console.log('🔐 Auth test result:', authTest);
        
        if (!authTest.success) {
          setAuthError(authTest.error);
          setLoading(false);
          return;
        }
        
        console.log('✅ Authentication successful, fetching data...');
        
        setStudentName(authTest.user.user_metadata?.name || "Student");
        setUserEmailVerified(authTest.user.email_confirmed_at !== null);
        
        if (authTest.user.email_confirmed_at) {
          // Fetch all data in parallel
          await Promise.allSettled([
            fetchStatsData(),
            fetchClasses(),
            fetchTeacherStatus(),
            fetchAssignments(),
            fetchPayments()
          ]);
        }
        
      } catch (error) {
        console.error('❌ Dashboard initialization error:', error);
        setAuthError(error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, []);
    
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  } []);

  // FIXED: Fetch data based on active section - NO HEADERS
  useEffect(() => {
    if (!userEmailVerified) return;

    const fetchData = async () => {
      try {
        switch (activeSection) {
          case "classes":
            await fetchClasses();
            break;
          case "assignments":
            await fetchAssignments();
            break;
          case "payments":
            await fetchPayments();
            break;
          case "exams":
            await fetchExams();
            break;
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [activeSection, userEmailVerified]);

  const getTimeUntilClass = (scheduledDate) => {
    const now = new Date();
    const classTime = new Date(scheduledDate);
    const diffMs = classTime - now;
    
    if (diffMs <= 0) return { status: 'started', text: 'Class in progress' };
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { 
      status: 'upcoming', 
      text: `Starts in ${diffHours}h ${diffMinutes}m` 
    };
  };

  const joinClass = (classItem) => {
    if (classItem.video_session) {
      window.open(`/video-call/${classItem.video_session.meeting_id}`, '_blank');
    } else {
      alert('No video session available for this class');
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      
      if (error) {
        console.error('Error resending verification email:', error.message);
      } else {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 5000);
      }
    } catch (error) {
      console.error('Error resending verification:', error);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error.message);
      }
      
      window.location.href = "/login";
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-700 text-white">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent"
          />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userEmailVerified) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-700 text-white p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-green-800/40 backdrop-blur-md rounded-2xl p-8 border border-green-700/30 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-700/50 flex items-center justify-center">
            <Mail size={32} className="text-green-300" />
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Verify Your Email</h2>
          <p className="text-green-200 mb-6">
            Please check your email inbox and verify your account to access the dashboard.
          </p>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleResendVerification}
            disabled={resendingEmail || emailSent}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-700 py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
          >
            {resendingEmail ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Sending...
              </>
            ) : emailSent ? (
              <>
                <CheckCircle size={18} className="mr-2" />
                Email Sent!
              </>
            ) : (
              <>
                <Mail size={18} className="mr-2" />
                Resend Verification Email
              </>
            )}
          </motion.button>
          
          <button 
            onClick={handleLogout}
            className="mt-4 text-green-300 hover:text-green-200 text-sm"
          >
            Not your account? Sign out
          </button>
        </motion.div>
      </div>
    );
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsMobile && setIsSidebarOpen(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-green-900 via-green-800 to-green-700 text-white overflow-hidden">
      <AnimatePresence>
        {isLoggingOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="text-center p-8 rounded-2xl bg-green-900/90 border border-green-700/30 shadow-2xl"
            >
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 1.5, repeat: Infinity, ease: "linear" },
                  scale: { duration: 0.8, repeat: Infinity }
                }}
                className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-500 to-teal-400 flex items-center justify-center"
              >
                <LogOut className="text-white" size={28} />
              </motion.div>
              <h3 className="text-2xl font-bold mb-2">Logging Out</h3>
              <p className="text-green-200">Taking you to the login page...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-40 bg-green-950/90 backdrop-blur-md border-b border-green-700/30 p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-lg hover:bg-green-800/50 mr-2"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-xl font-bold flex items-center">
            <BookOpen className="mr-2" size={24} />
            Madrasa Dashboard
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="relative p-2 rounded-lg hover:bg-green-800/50">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-green-800/50"
            >
              <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center">
                <User size={16} />
              </div>
              <span className="hidden sm:block">{studentName}</span>
              <ChevronDown size={16} />
            </button>
            
            {userMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-green-900 rounded-lg shadow-lg py-1 z-50 border border-green-700/30"
              >
                <button className="w-full text-left px-4 py-2 hover:bg-green-800 flex items-center transition-colors">
                  <Settings size={16} className="mr-2" />
                  Settings
                </button>
                <motion.button 
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-green-800 flex items-center transition-colors text-red-300 hover:text-red-200"
                >
                  <LogOut size={16} className="mr-2" />
                  Sign Out
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
        <button 
  onClick={() => window.open('/debug-connection', '_blank')}
  className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg z-50"
>
  🐛 Debug Connection
</button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div 
          className={`
            fixed md:relative inset-y-0 left-0 z-30 w-64 bg-green-950/90 backdrop-blur-md 
            transform transition-transform duration-300 ease-in-out md:transform-none
            flex-shrink-0 h-full overflow-y-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-6 flex flex-col h-full">
            <div className="mb-8 mt-4">
              <h2 className="text-xl font-bold text-green-300 flex items-center">
                <Award className="mr-2" size={24} />
                Student Panel
              </h2>
              <p className="text-green-100 mt-2 flex items-center">
                <User size={16} className="mr-2" />
                Welcome, {studentName}
              </p>
            </div>

            <nav className="flex-1 space-y-2">
              <motion.button
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setActiveSection("classes"); closeSidebar(); }}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeSection === "classes"
                    ? "bg-green-700 text-white shadow-lg"
                    : "hover:bg-green-800/60"
                }`}
              >
                <LayoutDashboard size={20} /> 
                <span>Classes</span>
              </motion.button>

              <motion.button
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setActiveSection("assignments"); closeSidebar(); }}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeSection === "assignments"
                    ? "bg-green-700 text-white shadow-lg"
                    : "hover:bg-green-800/60"
                }`}
              >
                <FileText size={20} /> 
                <span>Assignments</span>
              </motion.button>

              <motion.button
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setActiveSection("payments"); closeSidebar(); }}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeSection === "payments"
                    ? "bg-green-700 text-white shadow-lg"
                    : "hover:bg-green-800/60"
                }`}
              >
                <CreditCard size={20} /> 
                <span>Payments</span>
              </motion.button>

              <motion.button
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setActiveSection("exams"); closeSidebar(); }}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeSection === "exams"
                    ? "bg-green-700 text-white shadow-lg"
                    : "hover:bg-green-800/60"
                }`}
              >
                <ClipboardList size={20} /> 
                <span>Exams</span>
              </motion.button>
            </nav>

            <div className="pt-6 border-t border-green-800/50">
              <div className="bg-green-800/30 p-4 rounded-lg">
                <p className="text-sm text-green-200">Need help?</p>
                <p className="text-xs text-green-300 mt-1">Contact support: support@madrasa.com</p>
              </div>
            </div>
          </div>
        </div>

        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-green-800/40 backdrop-blur-md rounded-xl p-4 border border-green-700/30"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-green-300 text-sm">{stat.label}</p>
                    <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                    <p className="text-green-400 text-xs mt-1 flex items-center">
                      <span className="text-green-300">↑ {stat.change}</span>
                      <span className="ml-2">from last week</span>
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-700/30">
                    <stat.icon size={20} className="text-green-300" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-green-800/40 backdrop-blur-md rounded-xl p-4 md:p-6 border border-green-700/30"
            >
              {activeSection === "classes" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-semibold flex items-center">
                      <LayoutDashboard className="mr-2" size={24} />
                      Scheduled Classes
                    </h3>
                    <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center">
                      <Calendar className="mr-2" size={16} />
                      View Calendar
                    </button>
                  </div>
                  
                  {loadingClasses ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
                      <p>Loading your classes...</p>
                    </div>
                  ) : classes.length > 0 ? (
                    <div className="grid gap-4">
                      {classes.map((classItem) => {
                        const timeInfo = getTimeUntilClass(classItem.scheduled_date);
                        const isClassStarted = timeInfo.status === 'started';
                        const isClassCompleted = new Date(classItem.scheduled_date) < new Date();
                        
                        return (
                          <div
                            key={classItem.id}
                            className="p-4 rounded-lg bg-green-700/30 border border-green-600/30 hover:bg-green-700/50 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-lg flex items-center">
                                  {classItem.title}
                                  {isClassCompleted && (
                                    <CheckCircle size={16} className="text-green-300 ml-2" />
                                  )}
                                </h4>
                                <div className="flex flex-wrap items-center mt-2 text-sm text-green-200">
                                  <span className="flex items-center mr-4">
                                    <Clock size={14} className="mr-1" />
                                    {formatTime(classItem.scheduled_date)} - {formatTime(classItem.end_date)}
                                  </span>
                                  <span className="flex items-center mr-4">
                                    <User size={14} className="mr-1" />
                                    {classItem.teacher?.name || 'Teacher'}
                                  </span>
                                  <span className="flex items-center">
                                    <Calendar size={14} className="mr-1" />
                                    {formatDate(classItem.scheduled_date)}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-green-300">
                                  {timeInfo.text}
                                </div>
                              </div>
                              {isClassStarted && !isClassCompleted && (
                                <button 
                                  className="bg-green-600 hover:bg-green-500 p-2 rounded-lg flex items-center"
                                  onClick={() => joinClass(classItem)}
                                >
                                  <PlayCircle size={16} className="mr-1" />
                                  Join
                                </button>
                              )}
                            </div>
                            
                            {classItem.video_session && (
                              <div className="mt-3 text-xs text-green-400">
                                Meeting ID: {classItem.video_session.meeting_id}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : !hasTeacher ? (
                    <div className="text-center py-8">
                      <AlertCircle size={48} className="mx-auto text-yellow-400 mb-3" />
                      <h4 className="text-lg font-semibold mb-2">No Teacher Assigned</h4>
                      <p className="text-green-200 mb-4">
                        You haven't been assigned to a teacher yet. Please contact admin to get started with your classes.
                      </p>
                      <div className="max-w-md mx-auto">
                        <textarea
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="Message to admin..."
                          className="w-full p-3 rounded-lg bg-green-900/50 border border-green-700/30 text-white placeholder-green-300 mb-2"
                          rows="3"
                        />
                        <button
                          onClick={handleContactAdmin}
                          disabled={sendingMessage || !contactMessage.trim()}
                          className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-700 py-2 px-6 rounded-lg text-white"
                        >
                          {sendingMessage ? 'Sending...' : 'Contact Admin'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar size={48} className="mx-auto text-green-400 mb-3" />
                      <p className="text-green-200">No classes scheduled yet. Your teacher will schedule classes soon.</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === "assignments" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-semibold flex items-center">
                      <FileText className="mr-2" size={24} />
                      Assignments
                    </h3>
                    <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center">
                      <Download className="mr-2" size={16} />
                      Download All
                    </button>
                  </div>
                  
                  {loadingAssignments ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
                      <p>Loading assignments...</p>
                    </div>
                  ) : assignments.length > 0 ? (
                    <div className="grid gap-4">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="p-4 rounded-lg bg-green-700/30 border border-green-600/30 hover:bg-green-700/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-lg">{assignment.title}</h4>
                              <div className="flex flex-wrap items-center mt-2 text-sm text-green-200">
                                <span className="flex items-center mr-4">
                                  <BookOpen size={14} className="mr-1" />
                                  {assignment.subject || assignment.class?.title}
                                </span>
                                <span className="flex items-center mr-4">
                                  <Calendar size={14} className="mr-1" />
                                  Due: {formatDate(assignment.due_date)}
                                </span>
                                <span className="flex items-center">
                                  <Award size={14} className="mr-1" />
                                  {assignment.max_score} points
                                </span>
                              </div>
                              {assignment.description && (
                                <p className="text-green-300 text-sm mt-2">{assignment.description}</p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              assignment.submissions?.[0]?.status === "submitted" || assignment.submissions?.[0]?.status === "graded"
                                ? "bg-green-900/50 text-green-300" 
                                : "bg-yellow-900/50 text-yellow-300"
                            }`}>
                              {assignment.submissions?.[0]?.status === "graded" 
                                ? `Graded: ${assignment.submissions[0].score}/${assignment.max_score}`
                                : assignment.submissions?.[0]?.status === "submitted"
                                ? "Submitted"
                                : "Pending"
                              }
                            </span>
                          </div>
                          
                          <div className="mt-4 flex space-x-2">
                            <button className="text-sm bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center">
                              <Upload className="mr-2" size={16} />
                              Submit Work
                            </button>
                            <button className="text-sm bg-green-700/50 hover:bg-green-600/50 py-2 px-4 rounded-lg flex items-center">
                              <Download className="mr-2" size={16} />
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText size={48} className="mx-auto text-green-400 mb-3" />
                      <p className="text-green-200">No assignments posted yet.</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === "payments" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-semibold flex items-center">
                      <CreditCard className="mr-2" size={24} />
                      Payments
                    </h3>
                    <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center">
                      Payment History
                    </button>
                  </div>
                  
                  {loadingPayments ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
                      <p>Loading payments...</p>
                    </div>
                  ) : payments.length > 0 ? (
                    <div className="grid gap-4">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="p-4 rounded-lg bg-green-700/30 border border-green-600/30 hover:bg-green-700/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-lg">Tuition Payment</h4>
                              <div className="flex flex-wrap items-center mt-2 text-sm text-green-200">
                                <span className="flex items-center mr-4">
                                  <Calendar size={14} className="mr-1" />
                                  {formatDate(payment.payment_date)}
                                </span>
                                <span className="flex items-center">
                                  <CreditCard size={14} className="mr-1" />
                                  {payment.payment_method}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">${payment.amount}</p>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                payment.status === "confirmed" 
                                  ? "bg-green-900/50 text-green-300" 
                                  : payment.status === "rejected"
                                  ? "bg-red-900/50 text-red-300"
                                  : "bg-yellow-900/50 text-yellow-300"
                              }`}>
                                {payment.status === "confirmed" ? "Confirmed" : 
                                 payment.status === "rejected" ? "Rejected" : "Pending"}
                              </span>
                            </div>
                          </div>
                          {payment.transaction_code && (
                            <div className="mt-2 text-xs text-green-400">
                              Transaction: {payment.transaction_code}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard size={48} className="mx-auto text-green-400 mb-3" />
                      <p className="text-green-200">No payments found.</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === "exams" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-semibold flex items-center">
                      <ClipboardList className="mr-2" size={24} />
                      Exams
                    </h3>
                    <button className="text-sm bg-green-700 hover:bg-green-600 py-2 px-4 rounded-lg flex items-center">
                      Exam Schedule
                    </button>
                  </div>
                  
                  {exams.length > 0 ? (
                    <div className="grid gap-4">
                      {exams.map((exam) => (
                        <div
                          key={exam.id}
                          className="p-4 rounded-lg bg-green-700/30 border border-green-600/30 hover:bg-green-700/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-lg">{exam.title}</h4>
                              <div className="flex flex-wrap items-center mt-2 text-sm text-green-200">
                                <span className="flex items-center mr-4">
                                  <BookOpen size={14} className="mr-1" />
                                  {exam.subject}
                                </span>
                                <span className="flex items-center mr-4">
                                  <Calendar size={14} className="mr-1" />
                                  {exam.date}
                                </span>
                                <span className="flex items-center">
                                  <Clock size={14} className="mr-1" />
                                  {exam.duration}
                                </span>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              exam.status === "completed" 
                                ? "bg-green-900/50 text-green-300" 
                                : "bg-blue-900/50 text-blue-300"
                            }`}>
                              {exam.status === "completed" ? "Completed" : "Upcoming"}
                            </span>
                          </div>
                          
                          <div className="mt-4 flex space-x-2">
                            <button className="text-sm bg-green-600 hover:bg-green-500 py-2 px-4 rounded-lg flex items-center">
                              <Download className="mr-2" size={16} />
                              Study Materials
                            </button>
                            {exam.status !== "completed" && (
                              <button className="text-sm bg-green-700/50 hover:bg-green-600/50 py-2 px-4 rounded-lg flex items-center">
                                <AlertCircle className="mr-2" size={16} />
                                Exam Guidelines
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <ClipboardList size={48} className="mx-auto text-green-400 mb-3" />
                      <p className="text-green-200">No exams scheduled yet.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
