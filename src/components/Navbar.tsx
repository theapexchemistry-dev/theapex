// src/components/Navbar.tsx
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
          { id: 'support', label: 'Support' },
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
    <header className="sticky top-0 z-40 px-3 sm:px-4 lg:px-6 pt-3 pb-2">
      {/* ───────────────────────────────────────────────────────────────
          GLASS NAVBAR — frosted glass with heavy blur, very rounded
          corners, soft floating shadow, subtle white border.
         ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white/65 backdrop-blur-xl backdrop-saturate-150 rounded-[24px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03]">
          <div className="px-3 sm:px-4 lg:px-5 h-16 flex items-center justify-between gap-2">

            {/* Logo — light variant for light glass background */}
            <div
              onClick={() => onTabChange(role === 'guest' ? 'home' : 'dashboard')}
              className="cursor-pointer group min-w-0 flex-1 lg:flex-none"
            >
              <Logo size="md" variant="light" />
            </div>

            {/* Desktop nav — glass pill inside the glass bar */}
            {navItems.length > 0 && (
              <nav className="hidden lg:flex items-center gap-0.5 bg-white/40 backdrop-blur-md p-1 rounded-2xl border border-white/50 shrink-0">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                      activeTab === item.id
                        ? 'bg-amber-400 text-slate-950 shadow-sm font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {role !== 'guest' && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-white/70 transition-colors relative"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="fixed top-20 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 mt-2 sm:w-80 max-w-sm bg-white/85 backdrop-blur-xl text-slate-900 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/60 p-4 z-50 animate-in fade-in zoom-in-95 mx-auto">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 mb-2">
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
                              className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all hover:shadow-sm ${
                                n.read
                                  ? 'bg-white/50 border-slate-200/60 hover:bg-white/80'
                                  : 'bg-amber-50/80 border-amber-200/80 hover:bg-amber-100/80 shadow-xs'
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
                        <div className="mt-2 pt-2 border-t border-slate-200/60 text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Showing top 5 of {notifications.length} notifications
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {role === 'guest' ? (
                <button
                  onClick={onLoginClick}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-2xl shadow-md transition-all hover:scale-[1.02] flex items-center gap-1.5"
                >
                  <User className="w-4 h-4" /> Portal Login
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-white/40 backdrop-blur-md px-2 sm:px-3 py-1.5 rounded-2xl border border-white/60">
                  {role === 'admin' ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-400/30 text-amber-700 flex items-center justify-center font-bold text-xs">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="hidden xl:block text-left">
                        <p className="text-xs font-bold text-slate-900 leading-tight">Admin</p>
                        <p className="text-[10px] text-amber-700 font-medium">Mr. Subhamoy Mondal</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-400/30 text-amber-700 flex items-center justify-center font-bold text-xs">
                        {currentStudent?.name?.charAt(0) || 'S'}
                      </div>
                      <div className="hidden md:block text-left">
                        <p className="text-xs font-bold text-slate-900 leading-tight">{currentStudent?.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{currentStudent?.id}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onLogout}
                    title="Logout"
                    className="ml-1 p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}

              {role !== 'guest' && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 text-slate-700 hover:text-slate-950 hover:bg-white/70 rounded-xl transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu — also glass styled */}
      {role !== 'guest' && mobileMenuOpen && (
        <div className="lg:hidden max-w-[1400px] mx-auto px-1 sm:px-2 mt-2">
          <div className="bg-white/80 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-4 py-4 pb-6 space-y-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3.5 rounded-2xl text-base font-bold transition-all flex items-center gap-3 min-h-[48px] active:scale-[0.98] ${
                  activeTab === item.id
                    ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="w-full text-left px-4 py-3.5 rounded-2xl text-base font-bold transition-all flex items-center gap-3 text-red-600 hover:bg-red-500/10 mt-4 border border-red-500/20 min-h-[48px] active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
