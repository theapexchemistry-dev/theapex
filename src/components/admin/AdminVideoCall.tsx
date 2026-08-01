import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { Batch, Meeting } from '../../types';
import { openJitsiMeeting } from '../../lib/jitsi';
import { Video, Phone, Users, AlertCircle, Clock, ExternalLink, CheckCircle2 } from 'lucide-react';

export const AdminVideoCall: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>(() => StorageService.getBatches());
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [activeMeetings, setActiveMeetings] = useState<Meeting[]>(() => StorageService.getActiveMeetings());
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const refresh = () => {
      setBatches(StorageService.getBatches());
      setActiveMeetings(StorageService.getActiveMeetings());
    };
    window.addEventListener('apex_storage_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('apex_storage_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleStartMeeting = () => {
    if (!selectedBatchId) {
      setError('Please select a batch first');
      return;
    }
    const batch = batches.find(b => b.id === selectedBatchId);
    if (!batch) {
      setError('Batch not found');
      return;
    }

    setError('');
    const existing = StorageService.getActiveMeetingForBatch(selectedBatchId);
    if (existing) {
      StorageService.endMeeting(existing.id);
    }

    const meeting = StorageService.startMeeting(selectedBatchId, batch.title);
    setCurrentMeeting(meeting);
    setActiveMeetings(StorageService.getActiveMeetings());

    openJitsiMeeting({
      roomName: meeting.roomName,
      displayName: 'Mr. Subhamoy Mondal (Teacher)',
    });
  };

  const handleEndMeeting = () => {
    if (!currentMeeting) return;
    StorageService.endMeeting(currentMeeting.id);
    setCurrentMeeting(null);
    setActiveMeetings(StorageService.getActiveMeetings());
  };

  const handleRejoin = () => {
    if (!currentMeeting) return;
    openJitsiMeeting({
      roomName: currentMeeting.roomName,
      displayName: 'Mr. Subhamoy Mondal (Teacher)',
    });
  };

  const handleJoinExisting = (meeting: Meeting) => {
    setCurrentMeeting(meeting);
    openJitsiMeeting({
      roomName: meeting.roomName,
      displayName: 'Mr. Subhamoy Mondal (Teacher)',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Live Video Class</h2>
        <p className="text-sm text-slate-500">Start a live video class for a batch. Students of that batch will see a "Join" button.</p>
      </div>

      {!currentMeeting && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Batch</label>
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose a batch --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.title} ({b.className})</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleStartMeeting}
              disabled={!selectedBatchId}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Video className="w-4 h-4" /> Start Meeting
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {activeMeetings.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" /> Active Meetings
              </p>
              <div className="space-y-2">
                {activeMeetings.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{m.batchName}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Started {new Date(m.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoinExisting(m)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Rejoin
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentMeeting && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                LIVE: {currentMeeting.batchName}
              </p>
              <p className="text-[11px] text-slate-500">Started at {new Date(currentMeeting.startedAt).toLocaleTimeString()}</p>
            </div>
            <button
              onClick={handleEndMeeting}
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Phone className="w-4 h-4 rotate-[135deg]" /> End Meeting
            </button>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Meeting is Live!</h3>
            <p className="text-sm text-slate-600 mb-5">
              The video call opened in a new browser tab. Students of <strong>{currentMeeting.batchName}</strong> can now join from their Live Class tab.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={handleRejoin}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors justify-center"
              >
                <ExternalLink className="w-4 h-4" /> Reopen Call Tab
              </button>
              <button
                onClick={handleEndMeeting}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors justify-center"
              >
                <Phone className="w-4 h-4 rotate-[135deg]" /> End Meeting
              </button>
            </div>
            <div className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              If the new tab didn't open, check your popup blocker.
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 font-medium">
              Students of <strong>{currentMeeting.batchName}</strong> will see a "Join Live Class" button in their Live Class tab.
              Click "End Meeting" when class is over to remove the join button.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
