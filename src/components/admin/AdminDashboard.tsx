import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { Student, Batch, NotificationItem, FeeRecord, Doubt, Note } from '../../types';
import {
  Users,
  Layers,
  IndianRupee,
  HelpCircle,
  FileText,
  Calendar,
  RefreshCw,
  UserPlus,
  Plus,
  Upload,
  Wallet,
  Bell,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ChevronRight
} from 'lucide-react';

interface AdminDashboardProps {
  onTabChange: (tab: string) => void;
  onAddStudent: () => void;
  onAddBatch: () => void;
  onUploadNotes: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onTabChange,
  onAddStudent,
  onAddBatch,
  onUploadNotes
}) => {
  const [students, setStudents] = useState<Student[]>(() => StorageService.getStudents());
  const [batches, setBatches] = useState<Batch[]>(() => StorageService.getBatches());
  const [fees, setFees] = useState<FeeRecord[]>(() => StorageService.getFeeRecords());
  const [doubts, setDoubts] = useState<Doubt[]>(() => StorageService.getDoubts());
  const [notes, setNotes] = useState<Note[]>(() => StorageService.getNotes());
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>(() =>
    StorageService.getNotifications()
  );
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Listen for storage updates
  useEffect(() => {
    const refresh = () => {
      setStudents(StorageService.getStudents());
      setBatches(StorageService.getBatches());
      setFees(StorageService.getFeeRecords());
      setDoubts(StorageService.getDoubts());
      setNotes(StorageService.getNotes());
      setAllNotifications(StorageService.getNotifications());
    };
    window.addEventListener('apex_storage_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('apex_storage_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

    // ✅ FIX: Sort notifications NEWEST FIRST (reliable)
  // The `timestamp` field is stored as a human string like "Oct 30, 2:45 PM"
  // (no year). Date.parse() CANNOT read that — it returns NaN → 0 for every
  // notification, so the old sort was a no-op and the list kept whatever
  // order getNotifications() returned (often oldest-first).
  //
  // Instead we sort by the notification `id`, which is generated as
  //   'n-' + Date.now().toString(36)
  // in StorageService.addNotification(). That encodes the exact creation
  // time (epoch ms) as a base-36 number, so parsing it back gives a 100%
  // reliable sort key. Newest id = newest notification.
  const notifTime = (n: NotificationItem): number => {
    if (n.id && n.id.startsWith('n-')) {
      const num = parseInt(n.id.slice(2), 36);
      if (!isNaN(num) && num > 0) return num;
    }
    // Fallback: try the timestamp string, then treat "Just now" as now.
    if (!n.timestamp || n.timestamp === 'Just now') return Date.now();
    const parsed = Date.parse(n.timestamp);
    return isNaN(parsed) ? 0 : parsed;
  };
  const sortedNotifications = [...allNotifications].sort(
    (a, b) => notifTime(b) - notifTime(a)
  );

  const recentNotifications = sortedNotifications.slice(0, 3);

  const handleRefreshDatabase = async () => {
    setIsRefreshing(true);
    try {
      const { fetchDataFromFirestore } = await import('../../lib/firebaseSync');
      await fetchDataFromFirestore();
      setStudents(StorageService.getStudents());
      setBatches(StorageService.getBatches());
      setFees(StorageService.getFeeRecords());
      setDoubts(StorageService.getDoubts());
      setNotes(StorageService.getNotes());
      setAllNotifications(StorageService.getNotifications());
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Stats calculations
  const totalStudents = students.length;
  const totalBatches = batches.length;
  const pendingFees = fees.filter(f => f.status === 'unpaid' || f.status === 'pending_verification');
  console.log("Students with pending fees:", pendingFees);
  const pendingFeesAmount = pendingFees.reduce((sum, f) => sum + f.amount, 0);
  const pendingDoubts = doubts.filter(d => d.status === 'pending');
  const totalNotes = notes.length;

  // Monthly fee collection chart data (last 6 months)
  const chartData = (() => {
    const months: { label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const monthFullName = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const amount = fees
        .filter(f => f.month === monthFullName && f.status === 'paid')
        .reduce((sum, f) => sum + f.amount, 0);
      months.push({ label: monthLabel, amount });
    }
    return months;
  })();

  const maxChartAmount = Math.max(...chartData.map(m => m.amount), 1000);
  const totalCollection = chartData.reduce((sum, m) => sum + m.amount, 0);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'doubt':
        return <HelpCircle className="w-4 h-4 text-purple-600" />;
      case 'fee_reminder':
      case 'payment_received':
        return <Wallet className="w-4 h-4 text-emerald-600" />;
      case 'note':
        return <FileText className="w-4 h-4 text-indigo-600" />;
      case 'test':
        return <CheckCircle2 className="w-4 h-4 text-amber-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  const getNotificationBg = (type: string, read: boolean) => {
    if (read) return 'bg-slate-50 border-slate-200';
    switch (type) {
      case 'doubt':
        return 'bg-purple-50 border-purple-200';
      case 'fee_reminder':
      case 'payment_received':
        return 'bg-emerald-50 border-emerald-200';
      case 'note':
        return 'bg-indigo-50 border-indigo-200';
      case 'test':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const handleMarkAsRead = (id: string) => {
    StorageService.markSingleNotificationRead(id);
    setAllNotifications(StorageService.getNotifications());
  };

  const handleMarkAllRead = () => {
    StorageService.markAllNotificationsRead(sortedNotifications.map(n => n.id));
    setAllNotifications(StorageService.getNotifications());
  };

  const stats = [
    { label: 'TOTAL STUDENTS', value: totalStudents, sub: `+ 0 this month`, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'TOTAL BATCHES', value: totalBatches, sub: 'Active schedule', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'PENDING FEES', value: `₹${pendingFeesAmount.toLocaleString('en-IN')}`, sub: `${pendingFees.length} pending payments`, icon: IndianRupee, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'TOTAL DOUBTS', value: doubts.length, sub: `${pendingDoubts.length} pending answers`, icon: HelpCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'TOTAL NOTES', value: totalNotes, sub: 'Uploaded notes', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h2>
          <p className="text-sm text-slate-500">Welcome back, Mr. Subhamoy Mondal! Here is your institute overview.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* ✅ FIX: Sync Calendar now goes to Fees tab (which has Google Calendar sign-in)
                     instead of the non-existent 'calendar' tab. */}
          <button
            onClick={() => onTabChange('fees')}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" /> Sync Calendar
          </button>
          <button
            onClick={handleRefreshDatabase}
            disabled={isRefreshing}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Database'}
          </button>
          <button
            onClick={onAddStudent}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Student
          </button>
          <button
            onClick={onAddBatch}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Batch
          </button>
          <button
            onClick={onUploadNotes}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Notes
          </button>
          <button
            onClick={() => onTabChange('fees')}
            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" /> Manage Fees
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{stat.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Lower Section: Chart + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly Fee Collection Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Monthly Fee Collection</h3>
              <p className="text-xs text-slate-500">Revenue collection trend across recent months</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5" />
              Total: ₹{totalCollection.toLocaleString('en-IN')}
            </div>
          </div>

          {/* ✅ FIX: Chart bars were collapsing to 0px because the bar wrapper
                     had height:100% but its flex-col parent had no defined height.
                     Now each column has h-full, the bar wrapper uses flex-1
                     min-h-[120px] so it always has visible height, and
                     zero-amount months show a 2% sliver instead of disappearing. */}
          <div className="flex items-end justify-between gap-3 h-56 mt-6">
            {chartData.map((month, idx) => {
              const pct = maxChartAmount > 0 ? (month.amount / maxChartAmount) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                  <div className="text-[10px] font-bold text-slate-700">
                    {month.amount > 0 ? `₹${(month.amount / 1000).toFixed(0)}k` : ''}
                  </div>
                  <div className="w-full bg-slate-100 rounded-t-lg relative flex-1 min-h-[120px] overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 hover:from-indigo-700 hover:to-indigo-500"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={`₹${month.amount.toLocaleString('en-IN')}`}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500">{month.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity (Notifications) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Recent Activity
            </h3>
            <button
              onClick={() => setShowAllNotificationsModal(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 transition-colors"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-80 pr-1">
            {recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No recent activity</p>
                <p className="text-[11px] text-slate-400">Notifications will appear here</p>
              </div>
            ) : (
              recentNotifications.map(n => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border ${getNotificationBg(n.type, n.read)} cursor-pointer transition-all hover:shadow-sm`}
                  onClick={() => handleMarkAsRead(n.id)}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-slate-200">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 leading-tight">{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {n.timestamp}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* All Notifications Modal */}
      {showAllNotificationsModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAllNotificationsModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">All Notifications</h3>
                  <p className="text-[11px] text-slate-500">
                    {sortedNotifications.length} notification(s) total
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllRead}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                >
                  Mark all as read
                </button>
                <button
                  onClick={() => setShowAllNotificationsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body — Scrollable list of ALL notifications */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {sortedNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Bell className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-500">No notifications yet</p>
                  <p className="text-xs text-slate-400">Activity from students and fees will appear here</p>
                </div>
              ) : (
                sortedNotifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border ${getNotificationBg(n.type, n.read)} cursor-pointer transition-all hover:shadow-md`}
                    onClick={() => handleMarkAsRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-200">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900 leading-tight">{n.title}</p>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {n.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">
                Click any notification to mark it as read
              </span>
              <button
                onClick={() => setShowAllNotificationsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
