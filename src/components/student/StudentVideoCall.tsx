import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../../lib/storage';
import { Student, Meeting } from '../../types';
import { createJitsiMeeting } from '../../lib/jitsi';
import { Video, Phone, Loader2, AlertCircle, VideoOff, Clock } from 'lucide-react';

interface StudentVideoCallProps {
  student: Student;
}

export const StudentVideoCall: React.FC<StudentVideoCallProps> = ({ student }) => {
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(() =>
    StorageService.getActiveMeetingForBatch(student.batchId)
  );
  const [joined, setJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string>('');
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);

  useEffect(() => {
    const checkMeeting = () => {
      const meeting = StorageService.getActiveMeetingForBatch(student.batchId);
      setActiveMeeting(meeting);
      if (!meeting && joined) {
        if (jitsiApiRef.current) {
          jitsiApiRef.current.dispose();
          jitsiApiRef.current = null;
        }
        setJoined(false);
      }
    };
    checkMeeting();
    window.addEventListener('apex_storage_updated', checkMeeting);
    window.addEventListener('storage', checkMeeting);
    const interval = setInterval(checkMeeting, 5000);
    return () => {
      window.removeEventListener('apex_storage_updated', checkMeeting);
      window.removeEventListener('storage', checkMeeting);
      clearInterval(interval);
    };
  }, [student.batchId, joined]);

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  const handleJoin = async () => {
    if (!activeMeeting) return;
    setIsJoining(true);
    setError('');
    try {
      setJoined(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (jitsiContainerRef.current) {
        jitsiApiRef.current = await createJitsiMeeting({
          roomName: activeMeeting.roomName,
          parentNode: jitsiContainerRef.current,
          displayName: student.name,
        });
      }
    } catch (err) {
      console.error('Failed to join meeting:', err);
      setError('Failed to join the meeting. Please try again.');
      setJoined(false);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    setJoined(false);
  };

  if (joined && activeMeeting) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              LIVE CLASS: {activeMeeting.batchName}
            </p>
            <p className="text-[11px] text-slate-500">You are joined as: {student.name}</p>
          </div>
          <button
            onClick={handleLeave}
            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Phone className="w-4 h-4 rotate-[135deg]" /> Leave
          </button>
        </div>

        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div ref={jitsiContainerRef} className="w-full h-[500px] md:h-[600px] rounded-xl overflow-hidden bg-slate-900" />
        </div>
      </div>
    );
  }

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
            disabled={isJoining}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors mx-auto"
          >
            {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
            {isJoining ? 'Joining...' : 'Join Live Class'}
          </button>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
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
