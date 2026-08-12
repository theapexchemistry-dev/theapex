import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../../lib/storage';
import { SupportRequest } from '../../types';
import { subscribeToSupportRequests, fetchDataFromFirestore } from '../../lib/firebaseSync';
import { HelpCircle, CheckCircle2, MessageSquare, Clock, Filter, Search, RefreshCw, AlertTriangle } from 'lucide-react';

export const AdminSupport: React.FC = () => {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Subscribe DIRECTLY to Firestore supportRequests collection.
    // This bypasses the localStorage/merge layer and gives real-time updates.
    // If Firestore fails (e.g. permission denied), we fall back to localStorage.
    const unsub = subscribeToSupportRequests(
      (allRequests) => {
        if (!mountedRef.current) return;
        setRequests(allRequests as SupportRequest[]);
        setSyncError(null);
      },
      (err) => {
        if (!mountedRef.current) return;
        console.debug('AdminSupport: Firestore subscription failed, using localStorage only:', err);
        setRequests(StorageService.getSupportRequests());
        setSyncError('Live sync unavailable — showing locally cached tickets. Click Refresh to retry.');
      }
    );

    // Also listen for localStorage updates (same-device tickets from student)
    const onStorageUpdate = () => {
      if (!mountedRef.current) return;
      setRequests(StorageService.getSupportRequests());
    };
    window.addEventListener('apex_storage_updated', onStorageUpdate);
    window.addEventListener('storage', onStorageUpdate);

    return () => {
      mountedRef.current = false;
      unsub();
      window.removeEventListener('apex_storage_updated', onStorageUpdate);
      window.removeEventListener('storage', onStorageUpdate);
    };
  }, []);

  const handleResolve = (id: string) => {
    StorageService.resolveSupportRequest(id);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchDataFromFirestore();
      setRequests(StorageService.getSupportRequests());
      setSyncError(null);
    } catch (err) {
      console.error('Refresh failed:', err);
      setSyncError('Refresh failed. Check your connection and try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredRequests = requests
    .filter(req => statusFilter === 'all' || req.status === statusFilter)
    .filter(req =>
      req.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.issueType.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const totalCount = requests.length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-indigo-600" />
              Student Support Requests
            </h2>
            <p className="text-sm text-slate-500 mt-1">Manage and resolve issues reported by students</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-amber-800 font-bold text-sm">{pendingCount} Pending</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
              title="Force-fetch latest tickets from server"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {syncError && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 font-semibold text-xs rounded-2xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Live sync active
        </span>
        <span>{totalCount} total ticket{totalCount !== 1 ? 's' : ''}</span>
        <span>{pendingCount} pending</span>
        <span>{totalCount - pendingCount} resolved</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or issue type..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">All Caught Up!</h3>
            <p className="text-slate-500 text-sm">
              {totalCount === 0
                ? 'No support requests yet. When a student submits a ticket, it will appear here instantly.'
                : 'No support requests match your filters.'}
            </p>
          </div>
        ) : (
          filteredRequests.map(req => (
            <div key={req.id} className={`bg-white p-5 rounded-2xl border ${req.status === 'pending' ? 'border-amber-200 shadow-sm' : 'border-slate-200'} transition-all`}>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${req.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {req.status}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{req.issueType}</h3>
                  <p className="text-sm font-medium text-indigo-600 mt-1">
                    {req.studentName} <span className="text-slate-400 font-normal">({req.studentClass})</span>
                  </p>
                </div>
                {req.status === 'pending' && (
                  <button
                    onClick={() => handleResolve(req.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Resolved
                  </button>
                )}
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-start gap-3 text-slate-700">
                  <MessageSquare className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{req.message}</p>
                </div>
              </div>
              {req.status === 'resolved' && req.resolvedAt && (
                <div className="mt-3 text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Resolved on {new Date(req.resolvedAt).toLocaleString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
