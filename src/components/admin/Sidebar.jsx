import { motion } from "framer-motion";
import { 
  Shield, Settings, BarChart3, Users, UserPlus, 
  BookOpen, CreditCard, Video 
} from "lucide-react";

export default function Sidebar({ 
  activeSection, 
  setActiveSection, 
  isSidebarOpen, 
  setIsSidebarOpen,
  isMobile,
  adminName 
}) {
  const menuItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "teachers", label: "Teachers", icon: Users },
    { id: "students", label: "Students", icon: UserPlus },
    { id: "classes", label: "Classes", icon: BookOpen },
    { id: "fees", label: "Fees Management", icon: CreditCard },
    { id: "live", label: "Live Sessions", icon: Video },
  ];

  const closeSidebar = () => isMobile && setIsSidebarOpen(false);

  return (
    <div 
      className={`
        fixed md:relative inset-y-0 left-0 z-30 w-64 bg-blue-950/90 backdrop-blur-md 
        transform transition-transform duration-300 ease-in-out md:transform-none
        flex-shrink-0 h-full overflow-y-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      <div className="p-6 flex flex-col h-full">
        <div className="mb-8 mt-4">
          <h2 className="text-xl font-bold text-blue-300 flex items-center">
            <Shield className="mr-2" size={24} />
            Admin Panel
          </h2>
          <p className="text-blue-100 mt-2 flex items-center">
            <Settings size={16} className="mr-2" />
            Welcome, {adminName}
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { 
                setActiveSection(item.id); 
                closeSidebar(); 
              }}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                activeSection === item.id
                  ? "bg-blue-700 text-white shadow-lg"
                  : "hover:bg-blue-800/60"
              }`}
            >
              <item.icon size={20} /> 
              <span>{item.label}</span>
            </motion.button>
          ))}
        </nav>

        <div className="pt-6 border-t border-blue-800/50">
          <div className="bg-blue-800/30 p-4 rounded-lg">
            <p className="text-sm text-blue-200">System Status</p>
            <p className="text-xs text-blue-300 mt-1 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              All systems operational
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

