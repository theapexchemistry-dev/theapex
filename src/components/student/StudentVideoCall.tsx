import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { Student, Meeting } from '../../types';
import { openJitsiMeeting } from '../../lib/jitsi';
import { Video, AlertCircle, VideoOff, Clock, ExternalLink } from 'lucide-react';

interface StudentVideoCallProps {
  student: Student;
}

export const StudentVideoCall: React.FC<StudentVideoCallProps> = ({ student }) => {
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(() =>
    StorageService.getActiveMeetingForBatch(student.batchId)
  );
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const checkMeeting = () => {
      const meeting = StorageService.getActiveMeetingForBatch(student.batchId);
      setActiveMeeting(meeting);
    };
    checkMeeting();
    window.addEventListener('apex_storage_updated', checkMeeting);
    window.addEventListener('storage', checkMeeting);
    const interval = setInterval(checkMeeting, 3000);
    return () => {
      window.removeEventListener('apex_storage_updated', checkMeeting);
      window.removeEventListener('storage', checkMeeting);
      clearInterval(interval);
    };
  }, [student.batchId]);

  const handleJoin = () => {
    if (!activeMeeting) return;
    setError('');
    openJitsiMeeting({
      roomName: activeMeeting.roomName,
      displayName: student.name,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Live Video Class</h2>
        <p className="text-sm text-slate-500">Join live classes for your batch</p>
      </div>

      {activeMeeting ? (
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Live Class in Progress!</h3>
          <p className="text-sm text-slate-500 mb-1">{activeMeeting.batchName}</p>
          <p className="text-xs text-slate-400 mb-6 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            Started {new Date(activeMeeting.startedAt).toLocaleTimeString()}
          </p>
          <button
            onClick={handleJoin}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors mx-auto"
          >
            <ExternalLink className="w-5 h-5" /> Join Live Class
          </button>
          <p className="text-[11px] text-slate-500 mt-3">
            You will join as: <strong>{student.name}</strong>
          </p>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <div className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            If the meeting doesn't open, check your popup blocker.
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <VideoOff className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No Live Class Right Now</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            When your teacher starts a live class for your batch, a "Join" button will appear here automatically.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 px-4 py-2 rounded-xl">
            <Clock className="w-4 h-4" /> Checking for live classes...
          </div>
        </div>
      )}
    </div>
  );
};
