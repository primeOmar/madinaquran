simport { useState, useEffect } from 'react';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { useNotifications } from '../components/NotificationContext';
import { useNavigate } from 'react-router-dom';

const StudentNotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Handle notification action
    if (notification.data?.submission_id) {
      navigate(`/assignment-feedback/${notification.data.submission_id}`);
    } else if (notification.data?.action_url) {
      navigate(notification.data.action_url);
    }
    
    setIsOpen(false);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-blue-200 hover:text-white relative transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 border border-gray-200">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
              <div className="flex space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    title="Mark all as read"
                  >
                    <Check size={14} className="mr-1" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center"
                  title="Clear all notifications"
                >
                  <Trash2 size={14} className="mr-1" />
                  Clear all
                </button>
              </div>
            </div>
          </div>
          
          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No notifications yet</p>
                <p className="text-gray-400 text-sm">You'll see notifications here when teachers grade your work.</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <p className={`font-medium ${
                          notification.type === 'success' ? 'text-green-800' : 'text-gray-800'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{notification.message}</p>
                      
                      {notification.data && (
                        <div className="text-xs text-gray-500 space-y-1">
                          {notification.data.assignment_title && (
                            <p>Assignment: {notification.data.assignment_title}</p>
                          )}
                          {notification.data.score && (
                            <p className="font-medium">
                              Score: {notification.data.score}/{notification.data.max_score}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-gray-400 text-xs">
                          {formatTime(notification.created_at)}
                        </span>
                        {notification.data?.action_url && (
                          <ExternalLink size={12} className="text-blue-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentNotificationBell;
