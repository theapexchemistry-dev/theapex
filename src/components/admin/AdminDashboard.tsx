import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { subscribeToSupportRequests } from '../../lib/firebaseSync';
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
  ChevronRight,
  Search
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
  const [supportRequests, setSupportRequests] = useState(() => StorageService.getSupportRequests());
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Listen for storage updates and subscribe to support requests
  useEffect(() => {
    const refresh = () => {
      setStudents(StorageService.getStudents());
      setBatches(StorageService.getBatches());
      setFees(StorageService.getFeeRecords());
      setDoubts(StorageService.getDoubts());
      setNotes(StorageService.getNotes());
      setAllNotifications(StorageService.getNotifications());
      setSupportRequests(StorageService.getSupportRequests());
    };
    window.addEventListener('apex_storage_updated', refresh);
    window.addEventListener('storage', refresh);

    let unsubSupport = () => {};
    try {
      unsubSupport = subscribeToSupportRequests((allRequests) => {
        setSupportRequests(allRequests);
      });
    } catch (e) {
      console.debug('Dashboard support subscription skipped', e);
    }

    return () => {
      window.removeEventListener('apex_storage_updated', refresh);
      window.removeEventListener('storage', refresh);
      unsubSupport();
    };
  }, []);

  // ✅ FIX: Sort notifications NEWEST FIRST
  const sortedNotifications = [...allNotifications].sort((a, b) => {
    const parseTimestamp = (ts: string): number => {
      if (!ts || ts === 'Just now') return Date.now();
      const parsed = Date.parse(ts);
      return isNaN(parsed) ? 0 : parsed;
    };
    return parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp);
  });

  const recentNotifications = sortedNotifications.slice(0, 4);

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
      setSupportRequests(StorageService.getSupportRequests());
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
  const pendingFeesAmount = pendingFees.reduce((sum, f) => sum + f.amount, 0);
  const pendingDoubts = doubts.filter(d => d.status === 'pending');
  const answeredDoubts = doubts.filter(d => d.status === 'answered');
  const pendingSupport = supportRequests.filter(s => s.status === 'pending');
  const totalNotes = notes.length;

  // Recent doubts for the table (5 most recent)
  const recentDoubts = [...doubts]
    .sort((a, b) => {
      const parseTs = (ts: string): number => {
        if (!ts) return 0;
        const p = Date.parse(ts);
        return isNaN(p) ? 0 : p;
      };
      return parseTs(b.createdAt) - parseTs(a.createdAt);
    })
    .slice(0, 5);

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
    StorageService.markNotificationsRead('admin');
    setAllNotifications(StorageService.getNotifications());
  };

  // 6 main stats cards
  const stats = [
    {
      label: 'Total Students',
      value: totalStudents,
      sub: `${students.filter(s => {
        const jDate = new Date(s.joiningDate);
        const now = new Date();
        return jDate.getMonth() === now.getMonth() && jDate.getFullYear() === now.getFullYear();
      }).length} new this month`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      ring: 'ring-blue-100',
      onClick: () => onTabChange('students')
    },
    {
      label: 'Total Batches',
      value: totalBatches,
      sub: 'Active schedule',
      icon: Layers,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-100',
      onClick: () => onTabChange('batches')
    },
    {
      label: 'Pending Fees',
      value: `₹${pendingFeesAmount.toLocaleString('en-IN')}`,
      sub: `${pendingFees.length} pending payments`,
      icon: IndianRupee,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      ring: 'ring-orange-100',
      onClick: () => onTabChange('fees')
    },
    {
      label: 'Total Doubts',
      value: doubts.length,
      sub: `${pendingDoubts.length} pending answers`,
      icon: HelpCircle,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      ring: 'ring-purple-100',
      onClick: () => onTabChange('doubts')
    },
    {
      label: 'Total Notes',
      value: totalNotes,
      sub: 'Uploaded documents',
      icon: FileText,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      ring: 'ring-indigo-100',
      onClick: () => onTabChange('notes')
    },
    {
      label: 'Support Tickets',
      value: supportRequests.length,
      sub: `${pendingSupport.length} pending requests`,
      icon: AlertCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      ring: 'ring-rose-100',
      onClick: () => onTabChange('support')
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">Welcome back, Mr. Subhamoy Mondal! Here's your institute overview.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleRefreshDatabase}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 border border-slate-200 shadow-sm w-full sm:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={onAddStudent}
            className="px-3.5 py-2.5 sm:py-2 bg-[#0B132B] hover:bg-slate-900 text-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm w-full sm:w-auto"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Student
          </button>
          <button
            onClick={onAddBatch}
            className="px-3.5 py-2.5 sm:py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" /> New Batch
          </button>
          <button
            onClick={onUploadNotes}
            className="px-3.5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm w-full sm:w-auto"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Notes
          </button>
        </div>
      </div>

      {/* Stats Cards — fully responsive grid up to 6 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              onClick={stat.onClick}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center ring-4 ${stat.ring} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-1">{stat.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts + Notifications Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly Fee Collection Chart — takes 2 columns */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
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

          {/* Bar Chart */}
          <div className="flex items-end justify-between gap-3 h-48 mt-6">
            {chartData.map((month, idx) => {
              const barHeight = maxChartAmount > 0
                ? Math.max((month.amount / maxChartAmount) * 140, month.amount > 0 ? 6 : 0)
                : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="text-[10px] font-bold text-slate-700">
                    ₹{month.amount > 0 ? (month.amount / 1000).toFixed(0) + 'k' : '0'}
                  </div>
                  <div className="w-full h-[140px] bg-slate-100 rounded-t-lg relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 hover:from-indigo-700 hover:to-indigo-500"
                      style={{ height: `${barHeight}px` }}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500">{month.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Notifications — takes 1 column */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Recent Notifications
            </h3>
            <button
              onClick={() => setShowAllNotificationsModal(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 transition-colors"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-80 pr-1">
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

      {/* Recent Doubts Table — matching the screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-purple-500" /> Recent Doubts
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest student questions across all batches</p>
          </div>
          <button
            onClick={() => onTabChange('doubts')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 transition-colors"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentDoubts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HelpCircle className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-500">No doubts yet</p>
            <p className="text-xs text-slate-400">Student questions will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Batch</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Question</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDoubts.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {d.studentName?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{d.studentName}</p>
                          <p className="text-[10px] text-slate-400">{d.studentClass}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-slate-600">{d.batchTitle || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {d.subject || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-xs text-slate-700 line-clamp-1">{d.question}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {d.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold border border-orange-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Answered
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => onTabChange('doubts')}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

            {/* Modal Body */}
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
