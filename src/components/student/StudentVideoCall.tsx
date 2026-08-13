// ============================================================================
//  StudentVideoCall.tsx — Real WebRTC live classes (Option B)
// ----------------------------------------------------------------------------
//  Student sees a "Join" card ONLY when a live class is running for their
//  batch (or "All students"). Clicking Join opens the meeting dialog where
//  they watch the teacher's camera + screen in real time. Live participant
//  list shown in the dialog.
// ============================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  Video,
  PhoneOff,
  Users,
  Clock,
  Play,
  Radio,
  History,
  CheckCircle2,
  Wifi,
} from "lucide-react";
import { Student } from "../../types";
import {
  useMeetings,
  type LiveMeeting,
} from "../../lib/useLiveClass";
import { MeetingDialog } from "../MeetingRoom";

interface StudentVideoCallProps {
  student: Student;
}

export const StudentVideoCall: React.FC<StudentVideoCallProps> = ({
  student,
}) => {
  const { activeMeetings, pastMeetings, connected } = useMeetings();
  const [activeMeeting, setActiveMeeting] = useState<LiveMeeting | null>(null);

  // Filter meetings for this student
  const visibleActive = useMemo(() => {
    return activeMeetings.filter((m) => {
      if (m.scope === "all") return true;
      // batch scope: match by batchId
      if (student.batchId && m.batchId && student.batchId === m.batchId)
        return true;
      return false;
    });
  }, [activeMeetings, student.batchId]);

  const visiblePast = useMemo(() => {
    return pastMeetings.filter((m) => {
      if (m.scope === "all") return true;
      if (student.batchId && m.batchId && student.batchId === m.batchId)
        return true;
      return false;
    });
  }, [pastMeetings, student.batchId]);

  // Live "time ago" ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const displayName = student.name || "Student";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Live Video Class
        </h2>
        <p className="text-sm text-slate-500">
          Live classes started by your teacher for your batch appear here
          automatically — no refresh needed.
        </p>
      </div>

      {/* Sync status */}
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs ${
          connected
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          <Wifi className="h-3.5 w-3.5" /> Live ·{" "}
          {connected ? "synced" : "connecting…"}
        </div>
        <span className="font-mono">{visibleActive.length} active</span>
      </div>

      {/* Welcome card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          {student.className || "Student"}
          {student.batchTitle ? ` · ${student.batchTitle}` : ""}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">
          Hi {student.name?.split(" ")[0] || "there"}
        </h3>
        <p className="text-sm text-slate-600">
          When your teacher starts a class for your batch, a "Join" button will
          appear here instantly.
        </p>
      </div>

      {/* Live now */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          Live now ({visibleActive.length})
        </h3>
        {visibleActive.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Radio className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              No live classes right now
            </p>
            <p className="mt-1 text-xs text-slate-500">
              When your teacher starts a class for your batch, a "Join" button
              will appear here instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleActive.map((m) => (
              <StudentMeetingCard
                key={m.id}
                meeting={m}
                onJoin={() => setActiveMeeting(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent classes */}
      {visiblePast.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Recent classes ({visiblePast.length})
            </h3>
          </div>
          <div className="space-y-2">
            {visiblePast.slice(0, 6).map((m) => (
              <PastMeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        </div>
      )}

      {/* Meeting dialog */}
      {activeMeeting && (
        <MeetingDialog
          meeting={activeMeeting}
          role="student"
          displayName={displayName}
          meetingActive={activeMeetings.some(
            (m) => m.id === activeMeeting.id
          )}
          onClose={() => setActiveMeeting(null)}
          onEndMeeting={() => {}}
        />
      )}
    </div>
  );
};

// ============================================================================
//  Sub-components
// ============================================================================
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "1 hour ago";
  return `${hrs} hours ago`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StudentMeetingCard({
  meeting,
  onJoin,
}: {
  meeting: LiveMeeting;
  onJoin: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-emerald-300 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-2.5 w-2.5 items-center justify-center">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-red-600">
          Live now
        </span>
        <span className="text-xs text-slate-500">
          · started {timeAgo(meeting.startedAt)}
        </span>
      </div>

      <h4 className="text-base font-bold text-slate-900">{meeting.title}</h4>
      <p className="mt-1 text-sm text-slate-600">
        by <span className="font-semibold">{meeting.teacherName}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {formatTime(meeting.startedAt)}
        </span>
        {meeting.scope !== "all" && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {meeting.batchTitle}
          </span>
        )}
      </div>

      <button
        onClick={onJoin}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
      >
        <Play className="h-4 w-4" /> Join now
      </button>
    </div>
  );
}

function PastMeetingCard({ meeting }: { meeting: LiveMeeting }) {
  const scopeLabel =
    meeting.scope === "all" ? "All students" : meeting.batchTitle;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Ended
          </span>
        </div>
        <h4 className="truncate text-sm font-semibold text-slate-800">
          {meeting.title}
        </h4>
        <p className="mt-0.5 text-xs text-slate-500">
          {meeting.teacherName} · {scopeLabel}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {formatTime(meeting.startedAt)}
          {meeting.endedAt ? ` → ${formatTime(meeting.endedAt)}` : ""}
        </p>
      </div>
    </div>
  );
}
