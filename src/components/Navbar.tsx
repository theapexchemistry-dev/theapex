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
  X,
  Sun,
  Moon
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

  // ── Dark mode state ───────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (darkMode) {
      root.classList.add('dark');
      body.style.backgroundColor = '#000000';
      body.style.transition = 'background-color 0.3s ease';
    } else {
      root.classList.remove('dark');
      body.style.backgroundColor = '';
      body.style.transition = 'background-color 0.3s ease';
    }
    try {
      localStorage.setItem('apex_dark_mode', String(darkMode));
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  useEffect(() => {
    const refreshNotifs = () => setAllNotifications(StorageService.getNotifications());
    window.addEventListener('apex_storage_updated', refreshNotifs);
    window.addEventListener('storage', refreshNotifs);
    return () => {
      window.removeEventListener('apex_storage_updated', refreshNotifs);
      window.removeEventListener('storage', refreshNotifs);
    };
  }, []);

  const getTimestampFromId = (id: string): number => {
    if (id && id.startsWith('n-')) {
      const parsed = parseInt(id.slice(2), 36);
      if (!isNaN(parsed)) return parsed;
    }
    return 0; // fallback
  };

  const timeAgo = (ts: number): string => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) return '1 hour ago';
    if (hrs < 24) return `${hrs} hours ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const notifications = [...allNotifications].filter(n => {
    if (role === 'admin') return n.targetRole === 'admin';
    if (role === 'student') {
      if (n.targetRole !== 'student') return false;
      if (n.targetStudentId) {
        return n.targetStudentId.toLowerCase() === currentStudent?.id.toLowerCase();
      }
      return true;
    }
    return false;
  }).sort((a, b) => getTimestampFromId(b.id) - getTimestampFromId(a.id));
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

  // ── Glass styling tokens (light vs dark) ─────────────────────────────
  const glassBar = darkMode
    ? 'bg-slate-900/60 backdrop-blur-xl backdrop-saturate-150 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/5'
    : 'bg-white/65 backdrop-blur-xl backdrop-saturate-150 border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03]';

  const innerPill = darkMode
    ? 'bg-white/5 backdrop-blur-md border-white/10'
    : 'bg-white/40 backdrop-blur-md border-white/50';

  const txtPrimary = darkMode ? 'text-white' : 'text-slate-900';
  const txtSecondary = darkMode ? 'text-slate-300' : 'text-slate-600';
  const txtMuted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const hoverBg = darkMode ? 'hover:bg-white/10' : 'hover:bg-white/70';
  const iconColor = darkMode ? 'text-slate-300' : 'text-slate-700';
  const iconHover = darkMode ? 'hover:text-white' : 'hover:text-slate-950';
  const logoutColor = darkMode
    ? 'text-slate-400 hover:text-red-400'
    : 'text-slate-500 hover:text-red-500';

  return (
    <header className="sticky top-0 z-40 px-2 sm:px-4 lg:px-6 pt-3 pb-2 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto">
        <div className={`border rounded-[28px] sm:rounded-[32px] ${glassBar} transition-colors duration-300`}>
          {/* ── Row: [Logo] [spacer] [dark mode | bell | logout | hamburger] ── */}
          {/* Mobile: tighter padding (px-2), desktop: comfortable (px-5) */}
          <div className="px-2 sm:px-4 lg:px-5 h-14 sm:h-16 flex items-center gap-1 sm:gap-3">

            {/* Logo — fixed width, never squeezed */}
            <div
              onClick={() => onTabChange(role === 'guest' ? 'home' : 'dashboard')}
              className="cursor-pointer group shrink-0 transition-transform duration-200 hover:scale-[1.03]"
            >
              <Logo size="md" variant={darkMode ? 'dark' : 'light'} compact={false} />
            </div>

            {/* Spacer to push the right cluster to the end */}
            <div className="flex-1" />

            {/* Desktop nav — hidden on mobile */}
            {navItems.length > 0 && (
              <nav className={`hidden lg:flex items-center gap-1 p-1.5 rounded-[28px] border ${innerPill} shrink-0 transition-colors duration-300`}>
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-2xl text-[11px] font-bold transition-all duration-200 whitespace-nowrap hover:scale-110 active:scale-95 ${
                      activeTab === item.id
                        ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105'
                        : darkMode
                          ? `${txtSecondary} hover:text-white hover:bg-white/10`
                          : 'text-slate-600 hover:text-slate-950 hover:bg-white/70'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            )}

            {/* Right-side action cluster — tighter gap on mobile */}
            <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
              {/* ── Dark mode toggle ─────────────────────────────────── */}
              <button
                onClick={() => setDarkMode(d => !d)}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl ${iconColor} ${iconHover} ${hoverBg} transition-all duration-300 hover:scale-110 active:scale-90`}
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>

              {role !== 'guest' && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl ${iconColor} ${iconHover} ${hoverBg} transition-all duration-200 hover:scale-110 active:scale-90 relative`}
                  >
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-amber-400 text-slate-950 text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className={`fixed top-20 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 mt-2 sm:w-80 max-w-sm rounded-[28px] p-4 z-50 animate-in fade-in zoom-in-95 mx-auto transition-colors duration-300 ${
                      darkMode
                        ? 'bg-slate-900/85 backdrop-blur-xl text-white border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
                        : 'bg-white/85 backdrop-blur-xl text-slate-900 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)]'
                    }`}>
                      <div className={`flex justify-between items-center pb-2 mb-2 border-b ${darkMode ? 'border-white/10' : 'border-slate-200/60'}`}>
                        <h4 className={`font-bold text-sm flex items-center gap-1.5 ${txtPrimary}`}>
                          <Bell className="w-4 h-4 text-amber-500" /> Notifications
                        </h4>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkNotificationsRead}
                            className="text-[11px] text-amber-500 hover:underline font-semibold"
                          >
                            Mark read
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-2 text-xs">
                        {notifications.length === 0 ? (
                          <p className={`text-center py-4 font-medium ${txtMuted}`}>No notifications yet.</p>
                        ) : (
                          notifications.slice(0, 5).map(n => (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all hover:shadow-sm hover:scale-[1.02] ${
                                n.read
                                  ? darkMode
                                    ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                    : 'bg-white/50 border-slate-200/60 hover:bg-white/80'
                                  : 'bg-amber-50/80 border-amber-200/80 hover:bg-amber-100/80 shadow-xs'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <p className={`font-bold leading-snug ${txtPrimary}`}>{n.title}</p>
                                {!n.read && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                                )}
                              </div>
                              <p className={`mt-0.5 text-[11px] leading-relaxed ${txtSecondary}`}>{n.message}</p>
                              <span className={`text-[10px] mt-1 block font-mono ${txtMuted}`}>
                                {getTimestampFromId(n.id) ? timeAgo(getTimestampFromId(n.id)) : n.timestamp}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {notifications.length > 5 && (
                        <div className={`mt-2 pt-2 border-t text-center ${darkMode ? 'border-white/10' : 'border-slate-200/60'}`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
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
                  className="px-3 sm:px-5 py-1.5 sm:py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[11px] sm:text-xs rounded-xl sm:rounded-2xl shadow-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <User className="w-4 h-4" /> <span className="hidden sm:inline">Portal Login</span><span className="sm:hidden">Login</span>
                </button>
              ) : (
                <>
                  {/* ── MOBILE: standalone logout icon (compact) ── */}
                  <button
                    onClick={onLogout}
                    title="Logout"
                    className={`md:hidden p-1.5 rounded-xl ${logoutColor} ${hoverBg} transition-all duration-200 hover:scale-110 active:scale-90`}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>

                  {/* ── DESKTOP (md+): full user badge with avatar + name + logout ── */}
                  <div className={`hidden md:flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-2xl border ${innerPill} transition-colors duration-300`}>
                    {role === 'admin' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-amber-400/30 text-amber-600 flex items-center justify-center font-bold text-xs">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="hidden xl:block text-left">
                          <p className={`text-xs font-bold leading-tight ${txtPrimary}`}>Admin</p>
                          <p className="text-[10px] text-amber-600 font-medium">Mr. Subhamoy Mondal</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-amber-400/30 text-amber-600 flex items-center justify-center font-bold text-xs">
                          {currentStudent?.name?.charAt(0) || 'S'}
                        </div>
                        <div className="hidden xl:block text-left">
                          <p className={`text-xs font-bold leading-tight ${txtPrimary}`}>{currentStudent?.name}</p>
                          <p className={`text-[10px] font-medium ${txtMuted}`}>{currentStudent?.id}</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={onLogout}
                      title="Logout"
                      className={`p-1.5 rounded-xl transition-all duration-200 hover:scale-110 active:scale-90 ${logoutColor}`}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {role !== 'guest' && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className={`lg:hidden p-1.5 sm:p-2 rounded-xl sm:rounded-2xl ${iconColor} ${iconHover} ${hoverBg} transition-all duration-200 hover:scale-110 active:scale-90`}
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu — also glass styled, ultra-round */}
      {role !== 'guest' && mobileMenuOpen && (
        <div className="lg:hidden max-w-[1400px] mx-auto px-1 sm:px-2 mt-2">
          <div className={`rounded-[28px] px-4 py-4 pb-6 space-y-2 transition-colors duration-300 ${
            darkMode
              ? 'bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
              : 'bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)]'
          }`}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3.5 rounded-3xl text-base font-bold transition-all duration-200 flex items-center gap-3 min-h-[48px] hover:scale-[1.02] active:scale-[0.98] ${
                  activeTab === item.id
                    ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                    : darkMode
                      ? 'text-slate-200 hover:text-white hover:bg-white/10'
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
              className="w-full text-left px-4 py-3.5 rounded-3xl text-base font-bold transition-all duration-200 flex items-center gap-3 text-red-500 hover:bg-red-500/10 mt-4 border border-red-500/20 min-h-[48px] hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
