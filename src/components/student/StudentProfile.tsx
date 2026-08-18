import React, { useState, useEffect } from 'react';
import { Student } from '../../types';
import { 
  User, 
  Phone, 
  Calendar, 
  IndianRupee, 
  BookOpen, 
  ShieldCheck, 
  Award,
  Bell,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import {
  enablePushNotifications,
  disablePushNotifications,
  getPushPermissionState,
  type PushPermissionState
} from '../../lib/pushNotifications';
import { StorageService } from '../../lib/storage';

interface StudentProfileProps {
  student: Student;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({ student }) => {
  const [pushState, setPushState] = useState<PushPermissionState>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    getPushPermissionState().then(setPushState);
  }, []);

  const handleEnablePush = async () => {
    if (window.self !== window.top) {
      alert("Browser notifications cannot be properly configured inside this preview window. Please open the application in a new tab using the button in the top right corner.");
      return;
    }
    setPushBusy(true);
    setStatusMsg('');
    try {
      const result = await enablePushNotifications('student', student.id);
      if (result.success) {
        setPushState('granted');
        setStatusMsg('✓ Push notifications ENABLED! You will now receive alerts for new notes, tests, and fee reminders.');
      } else {
        setStatusMsg('Failed to enable push: ' + (result.error || 'Unknown error'));
      }
    } finally {
      setPushBusy(false);
      setTimeout(() => setStatusMsg(''), 6000);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      await disablePushNotifications('student', student.id);
      setPushState('default');
      setStatusMsg('Push notifications disabled for this device.');
    } finally {
      setPushBusy(false);
      setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Status Message Toast */}
      {statusMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-bottom-4">
          {statusMsg}
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl border border-indigo-500/30 shadow-xl flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-4xl shadow-lg border-2 border-indigo-400">
          {student.name.charAt(0)}
        </div>

        <div className="text-center sm:text-left space-y-1">
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
            Enrolled Student
          </span>
          <h2 className="text-3xl font-black text-white">{student.name}</h2>
          <p className="text-sm font-mono text-indigo-300 font-bold">Student ID: {student.id}</p>
          <p className="text-xs text-slate-300">{student.className} • {student.batchTitle}</p>
        </div>
      </div>

      {/* Credentials Card (Password EXCLUDED) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
          <ShieldCheck className="w-5 h-5 text-indigo-600" /> Student Official Credentials
        </h3>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block font-medium">Student Registration ID</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{student.id}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block font-medium">Full Name</span>
            <span className="text-sm font-bold text-slate-900">{student.name}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block font-medium">Academic Class</span>
            <span className="text-sm font-bold text-indigo-600">{student.className}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block font-medium">Assigned Batch</span>
            <span className="text-sm font-bold text-slate-900">{student.batchTitle || 'Regular Chemistry Batch'}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block font-medium">Contact Phone</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{student.phone}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block font-medium">Monthly Tuition Fee Rate</span>
            <span className="text-sm font-extrabold text-indigo-600 font-mono">₹{student.fees.toLocaleString()} / month</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2">
            <span className="text-slate-400 block font-medium">Date of Enrollment</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{student.joiningDate}</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center italic pt-2">
          🔒 Password is encrypted for security and hidden from standard profile view. Contact Admin for credentials reset.
        </p>
      </div>

      {/* Push Notifications Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
          <BellRing className="w-5 h-5 text-indigo-600" /> Notifications & Alerts
        </h3>
        
        <p className="text-xs text-slate-600 font-medium leading-relaxed">
          Enable browser notifications to receive instant alerts for new study notes, upcoming tests, fee reminders, and announcements — even when the app is closed.
        </p>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            pushState === 'granted' ? 'bg-emerald-100 text-emerald-600' :
            pushState === 'denied' ? 'bg-rose-100 text-rose-600' :
            'bg-slate-200 text-slate-500'
          }`}>
            {pushState === 'granted' ? <CheckCircle2 className="w-5 h-5" /> : 
             pushState === 'denied' ? <AlertTriangle className="w-5 h-5" /> : 
             <Bell className="w-5 h-5" />}
          </div>
          
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">
              Notification Status: <span className={
                pushState === 'granted' ? 'text-emerald-600' :
                pushState === 'denied' ? 'text-rose-600' :
                'text-slate-500'
              }>
                {pushState === 'granted' ? 'Enabled' : 
                 pushState === 'denied' ? 'Blocked' : 
                 pushState === 'unsupported' ? 'Unsupported' : 'Not Setup'}
              </span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {pushState === 'granted' 
                ? 'This device is registered to receive real-time notifications from The Apex World.' 
                : pushState === 'denied'
                ? 'Notifications are blocked in your browser. Please enable them in your browser settings.'
                : 'Grant permission to stay updated with your classroom activity.'}
            </p>
          </div>
        </div>

        {pushState === 'granted' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={async () => {
                const now = new Date().toLocaleTimeString();
                StorageService.addNotification({
                  title: 'Success!',
                  message: `Test notification successful at ${now}. Push alerts are working perfectly on this device.`,
                  type: 'announcement',
                  targetRole: 'student',
                  targetStudentId: student.id,
                  read: false
                });
                setStatusMsg('✓ Test alert sent! Check your notification bar.');
              }}
              className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-indigo-200"
            >
              <Bell className="w-4 h-4" />
              Send Test Alert
            </button>
            <button
              onClick={handleDisablePush}
              disabled={pushBusy}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
              Disable on this device
            </button>
          </div>
        ) : (
          <button
            onClick={handleEnablePush}
            disabled={pushBusy || pushState === 'denied' || pushState === 'unsupported'}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            {pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Enable Push Notifications
          </button>
        )}
      </div>
    </div>
  );
};
