import React, { useState, useEffect } from 'react';
import { Bell, X, ShieldAlert } from 'lucide-react';
import { enablePushNotifications, triggerSystemNotification } from '../lib/pushNotifications';
import { Role, Student } from '../types';

interface NotificationPermissionBannerProps {
  role: Role;
  currentStudent: Student | null;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  role,
  currentStudent,
}) => {
  const [showBanner, setShowBanner] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running inside iframe preview
    if (window.self !== window.top) {
      setIsInIframe(true);
    }

    // Check notification support and permission state
    if (!('Notification' in window)) return;

    const isDismissed = sessionStorage.getItem('apex_notif_banner_dismissed') === 'true';
    if (Notification.permission === 'default' && !isDismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (isInIframe) {
      alert(
        "Browser notifications require top-level window access. Please open the app in a new browser tab or install the PWA on your phone."
      );
    }

    setRequesting(true);
    try {
      const studentId = role === 'student' ? currentStudent?.id : undefined;
      const targetRole = role === 'admin' || role === 'moderator' ? 'admin' : 'student';
      
      const result = await enablePushNotifications(targetRole, studentId);
      
      if (result.success || Notification.permission === 'granted') {
        setShowBanner(false);
        // Fire a test welcome notification so the user sees the popup on their screen right away!
        await triggerSystemNotification(
          '🔔 Notifications Enabled!',
          'You will now receive instant popups on your phone screen whenever updates arrive.'
        );
      } else {
        alert(result.error || 'Notification permission was not granted by the browser.');
      }
    } catch (err: any) {
      console.error('Permission request error:', err);
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('apex_notif_banner_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner || Notification.permission !== 'default') return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-slate-950 px-4 py-3 shadow-lg relative transition-all duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="p-2 bg-slate-950/20 rounded-2xl shrink-0">
            <Bell className="w-5 h-5 text-amber-950 animate-bounce" />
          </div>
          <div>
            <p className="font-extrabold text-sm text-slate-950 leading-snug">
              Enable Phone Screen Popup Notifications
            </p>
            <p className="text-xs text-slate-900/90 font-medium">
              Get instant popups on your phone screen for new class notes, fee reminders, doubt answers, and live classes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            onClick={handleRequestPermission}
            disabled={requesting}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            <Bell className="w-3.5 h-3.5" />
            {requesting ? 'Requesting...' : 'Allow Popup Notifications'}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-900 hover:text-slate-950 hover:bg-slate-950/10 rounded-lg transition-colors shrink-0"
            title="Ask Later"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
