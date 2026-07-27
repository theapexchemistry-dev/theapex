import { loadInitialDataFromFirestore } from '../../lib/firebaseSync'; // (not strictly needed, kept for reference)
import { RefreshCw } from 'lucide-react';
import { fetchDataFromFirestore } from '../../lib/firebaseSync';
import React, { useState } from 'react';
import { googleSignIn } from '../../lib/auth';
import { syncFeeRemindersToCalendar } from '../../lib/calendar';
import { CalendarSync } from 'lucide-react';
import { StorageService } from '../../lib/storage';
import {
  Users,
  Layers,
  IndianRupee,
  HelpCircle,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Bell,
  FileText,
  RefreshCw
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {

  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  const handleSyncCalendar = async () => {
    try {
      setIsSyncingCalendar(true);
      await googleSignIn();
      if (!window.confirm('Schedule recurring monthly fee reminders in Google Calendar for all students with emails?')) return;
      await syncFeeRemindersToCalendar(students);
      alert('Successfully scheduled automated monthly fee reminders in Google Calendar for all students with emails!');
    } catch (err: any) {
      console.error(err);
      alert('Failed to sync calendar: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSyncingCalendar(false);
    }
  };

const [isRefreshing, setIsRefreshing] = useState(false);
const [refreshTick, setRefreshTick] = useState(0); // bumps to force stats re-read

const handleRefreshDatabase = async () => {
  try {
    setIsRefreshing(true);
    await fetchDataFromFirestore(); // re-pull all 7 collections + logo from Firestore
    setRefreshTick(t => t + 1);     // force this component to re-read stats
    // eslint-disable-next-line no-console
    console.log('Database refreshed from Firestore. tick =', refreshTick + 1);
  } catch (err: any) {
    console.error('Refresh failed:', err);
    alert('Failed to refresh database: ' + (err?.message || 'Unknown error'));
  } finally {
    setIsRefreshing(false);
  }
};
  
  const students = StorageService.getStudents();
  const batches = StorageService.getBatches();
  const doubts = StorageService.getDoubts();
  const notes = StorageService.getNotes();
  const fees = StorageService.getFeeRecords();
  const notifications = StorageService.getNotifications().filter(n => n.targetRole === 'admin');

  // Calculate earnings dynamically
  const paidFees = fees.filter(f => f.status === 'paid');
  const totalEarnings = paidFees.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
  const pendingFeesAmount = fees.filter(f => f.status === 'unpaid').reduce((acc, f) => acc + (Number(f.amount) || 0), 0);

  const pendingDoubtsCount = doubts.filter(d => d.status === 'pending').length;

  // Calculate students joined this month
  const currentMonthNum = new Date().getMonth();
  const currentYearNum = new Date().getFullYear();
  const studentsThisMonth = students.filter(s => {
    if (!s.joiningDate) return false;
    const date = new Date(s.joiningDate);
    return date.getMonth() === currentMonthNum && date.getFullYear() === currentYearNum;
  }).length;

  // Monthly fee collection data (Last 6 months dynamically)
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const fullMonth = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const label = d.toLocaleString('en-US', { month: 'short' });
    
    const monthPaid = paidFees
      .filter(f => f.month === fullMonth)
      .reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
      
    return { month: label, earnings: monthPaid };
  });

  const maxEarning = Math.max(...chartData.map(d => d.earnings), 1);

  return (
    <div className="space-y-6">
      {/* Top Welcome Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h2>
          <p className="text-sm text-slate-500">Welcome back, Mr. Subhamoy Mondal! Here is your institute overview.</p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          
          <button
            onClick={handleSyncCalendar}
            disabled={isSyncingCalendar}
            className="col-span-2 sm:col-span-1 w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <CalendarSync className="w-4 h-4" /> {isSyncingCalendar ? 'Syncing...' : 'Sync Calendar'}
          </button>
          <button
          onClick={handleRefreshDatabase}
          disabled={isRefreshing}
          title="Pull the latest data from the cloud database"
          className="col-span-2 sm:col-span-1 w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Database'}
          </button>
          <button
            onClick={() => onNavigate('students')}
            className="w-full sm:w-auto flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            + Add Student
          </button>
          <button
            onClick={() => onNavigate('batches')}
            className="w-full sm:w-auto flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            + New Batch
          </button>
          <button
            onClick={() => onNavigate('notes')}
            className="w-full sm:w-auto flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            + Upload Notes
          </button>
          <button
            onClick={() => onNavigate('fees')}
            className="w-full sm:w-auto flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            Manage Fees
          </button>
        </div>
      </div>

      {/* 5 Stat Cards Matching Image 1 Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Students</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{students.length}</h3>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +{studentsThisMonth} this month
            </p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Batches</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{batches.length}</h3>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Active schedule
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Fees</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">₹{pendingFeesAmount.toLocaleString()}</h3>
            <p className="text-[11px] font-semibold text-indigo-600 mt-1">
              {fees.filter(f => f.status === 'unpaid').length} pending payments
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Doubts</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{doubts.length}</h3>
            <p className="text-[11px] font-semibold text-indigo-600 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {pendingDoubtsCount} pending answers
            </p>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center font-bold">
            <HelpCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Notes</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{notes.length}</h3>
            <p className="text-[11px] font-semibold text-indigo-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded notes
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Graph & Notifications Section */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Earnings Graph matching Image 1 Dashboard */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Monthly Fee Collection</h3>
              <p className="text-xs text-slate-500">Revenue collection trend across recent months</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Total Collection: ₹{totalEarnings.toLocaleString()}
            </span>
          </div>

          {/* SVG Custom Bar/Line Chart Visual */}
          <div className="h-64 pt-6 flex items-end justify-between gap-3 px-2">
            {chartData.map((d, i) => {
              const heightPercent = d.earnings > 0 ? Math.max(15, Math.round((d.earnings / maxEarning) * 100)) : 8;
              return (
                <div key={i} className="h-full flex-1 flex flex-col items-center justify-end gap-2 group relative">
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-md pointer-events-none z-10 whitespace-nowrap mb-2" style={{ bottom: `${heightPercent}%` }}>
                    ₹{d.earnings.toLocaleString()}
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[42px] rounded-t-xl group-hover:brightness-110 transition-all shadow-sm ${
                      d.earnings > 0
                        ? 'bg-gradient-to-t from-slate-900 to-indigo-600'
                        : 'bg-slate-200 border-t border-slate-300'
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-600 shrink-0">{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notifications & Quick Alerts */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" /> Recent Activity
            </h3>
            <button
              onClick={() => onNavigate('doubts')}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {notifications.slice(0, 5).map(n => (
              <div key={n.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                <p className="font-bold text-slate-800">{n.title}</p>
                <p className="text-slate-600 leading-snug">{n.message}</p>
                <span className="text-[10px] text-slate-400 font-mono block">{n.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Doubts Table matching Image 1 Dashboard */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Recent Student Doubts</h3>
          <button
            onClick={() => onNavigate('doubts')}
            className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1"
          >
            Go to Doubts Panel <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-3">Student</th>
                <th className="p-3">Batch</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Question</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {doubts.slice(0, 4).map(d => (
                <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-bold text-slate-900">{d.studentName}</td>
                  <td className="p-3 text-slate-500">{d.batchTitle}</td>
                  <td className="p-3 font-medium text-amber-600">{d.subject}</td>
                  <td className="p-3 max-w-xs truncate">{d.question}</td>
                  <td className="p-3">
                    {d.status === 'pending' ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                        ● Pending
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                        ✓ Answered
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onNavigate('doubts')}
                      className="px-2.5 py-1 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
