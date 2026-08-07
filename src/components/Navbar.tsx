import React, { useState, useEffect } from 'react';
import { Role, Student, NotificationItem } from '../types';
import { StorageService } from '../lib/storage';
import { Logo } from './Logo';
import {
  Bell,
  LogOut,
  User,
  ShieldCheck,
  BookOpen,
  Menu,
  X
} from 'lucide-react';

interface NavbarProps {
  role: Role;
  currentStudent: Student | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLoginClick: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  role,
  currentStudent,
  activeTab,
  onTabChange,
  onLoginClick,
  onLogout
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>(() => StorageService.getNotifications());

  useEffect(() => {
    const refreshNotifs = () => setAllNotifications(StorageService.getNotifications());
    window.addEventListener('apex_storage_updated', refreshNotifs);
    window.addEventListener('storage', refreshNotifs);
    return () => {
      window.removeEventListener('apex_storage_updated', refreshNotifs);
      window.removeEventListener('storage', refreshNotifs);
    };
  }, []);

  const notifications = allNotifications.filter(n => {
    if (role === 'admin') return n.targetRole === 'admin';
    if (role === 'student') {
      if (n.targetRole !== 'student') return false;
      if (n.targetStudentId) {
        return n.targetStudentId.toLowerCase() === currentStudent?.id.toLowerCase();
      }
      return true;
    }
    return false;
  });
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkNotificationsRead = () => {
    StorageService.markNotificationsRead(role === 'admin' ? 'admin' : 'student', currentStudent?.id);
    setAllNotifications(StorageService.getNotifications());
  };

  const handleNotificationClick = (n: NotificationItem) => {
    StorageService.markSingleNotificationRead(n.id);
    setAllNotifications(StorageService.getNotifications());
    setShowNotifications(false);

    if (n.type === 'doubt') {
      onTabChange('doubts');
    } else if (n.type === 'fee_reminder' || n.type === 'payment_received') {
      onTabChange('fees');
    } else if (n.type === 'note') {
      onTabChange('notes');
    } else if (n.type === 'test') {
      onTabChange('tests');
    }
  };

  const navItems =
    role === 'admin'
      ? [
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'students', label: 'Students' },
          { id: 'batches', label: 'Batches' },
          { id: 'fees', label: 'Fees' },
          { id: 'notes', label: 'Notes' },
          { id: 'doubts', label: 'Doubts' },
          { id: 'tests', label: 'Tests' },
          { id: 'live', label: 'Live' },
          { id: 'settings', label: 'Settings' }
        ]
      : role === 'student'
      ? [
          { id: 'dashboard', label: 'Home' },
          { id: 'live', label: 'Live' },
          { id: 'fees', label: 'Fees' },
          { id: 'notes', label: 'Notes' },
          { id: 'doubts', label: 'Ask Doubts' },
          { id: 'tests', label: 'Tests & Rank' },
          { id: 'profile', label: 'Profile' },
          { id: 'help', label: 'Help' }
        ]
      : [];

  return (
    <header className="sticky top-0 z-40 bg-[#0B132B] text-white border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Logo Branding — allowed to shrink so name + tagline stay visible */}
        <div
          onClick={() => onTabChange(role === 'guest' ? 'home' : 'dashboard')}
          className="cursor-pointer group min-w-0 flex-1 lg:flex-none"
        >
          <Logo size="md" variant="dark" />
        </div>

        {/* Desktop Navigation Links — hidden below lg (1024px) */}
        {navItems.length > 0 && (
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === item.id
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-extrabold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right Side Actions & User Status */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {role !== 'guest' && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 mt-2 sm:w-80 max-w-sm bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 mx-auto">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 mb-2">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-amber-500" /> Notifications
                    </h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkNotificationsRead}
                        className="text-[11px] text-amber-600 hover:underline font-semibold"
                      >
                        Mark read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 text-xs">
                    {notifications.length === 0 ? (
                      <p className="text-slate-400 text-center py-4 font-medium">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:shadow-sm ${
                            n.read
                              ? 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/80'
                              : 'bg-amber-50/90 border-amber-200 hover:bg-amber-100/80 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="font-bold text-slate-900 leading-snug">{n.title}</p>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block font-mono">{n.timestamp}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 5 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Showing top 5 of {notifications.length} notifications
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Profile Badge or Login / Sign Up Buttons */}
          {role === 'guest' ? (
            <button
              onClick={onLoginClick}
              className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all hover:scale-[1.02] flex items-center gap-1.5"
            >
              <User className="w-4 h-4" /> Portal Login
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-800">
              {role === 'admin' ? (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-white leading-tight">Admin</p>
                    <p className="text-[10px] text-amber-400 font-medium">Mr. Subhamoy Mondal</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                    {currentStudent?.name?.charAt(0) || 'S'}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-white leading-tight">{currentStudent?.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{currentStudent?.id}</p>
                  </div>
                </div>
              )}

              <button
                onClick={onLogout}
                title="Logout"
                className="ml-1 p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle — visible below lg (1024px) */}
          {role !== 'guest' && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer Menu — visible below lg (1024px) */}
      {role !== 'guest' && mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-4 pb-28 space-y-2 shadow-2xl absolute w-full left-0 z-50 overflow-y-auto max-h-[85vh]">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl text-base font-bold transition-all flex items-center gap-3 min-h-[48px] active:scale-[0.98] ${
                activeTab === item.id ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold' : 'text-slate-200 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
          {role !== 'guest' && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="w-full text-left px-4 py-3.5 rounded-xl text-base font-bold transition-all flex items-center gap-3 text-red-400 hover:bg-red-500/10 mt-4 border border-red-500/20 min-h-[48px] active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          )}
        </div>
      )}
    </header>
  );
};
