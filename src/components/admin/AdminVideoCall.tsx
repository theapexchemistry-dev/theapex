// ============================================================================
//  AdminVideoCall.tsx — Real WebRTC live classes (Option B)
// ----------------------------------------------------------------------------
//  Admin fills in: title, teacher name, audience (batches) → Start live class.
//  A meeting dialog opens with REAL controls: mute/unmute (mic), video on/off
//  (camera), share screen. These actually capture/stop media and broadcast to
//  every student via WebRTC. Live participant list shown in the dialog.
// ============================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  Video,
  PhoneOff,
  Users,
  AlertCircle,
  Clock,
  Play,
  Radio,
  History,
  Trash2,
  CheckCircle2,
  Wifi,
  Info,
} from "lucide-react";
import { StorageService } from "../../lib/storage";
import { Batch } from "../../types";
import {
  useMeetings,
  type LiveMeeting,
} from "../../lib/useLiveClass";
import { MeetingDialog } from "../MeetingRoom";

export const AdminVideoCall: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>(() => StorageService.getBatches());
  const {
    activeMeetings,
    pastMeetings,
    connected,
    startMeeting,
    endMeeting,
    deleteMeeting,
  } = useMeetings();

  const [activeMeeting, setActiveMeeting] = useState<LiveMeeting | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [teacherName, setTeacherName] = useState("Mr. Subhamoy Mondal");
  const [audience, setAudience] = useState<string>("all"); // 'all' | batchId
  const [starting, setStarting] = useState(false);

  // Refresh batches in case StorageService changes
  useEffect(() => {
    setBatches(StorageService.getBatches());
  }, []);

  const handleStart = () => {
    if (!title.trim()) return;
    setStarting(true);

    const batch = batches.find((b) => b.id === audience);
    const meeting: LiveMeeting = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      scope: audience === "all" ? "all" : "batch",
      batchId: audience === "all" ? null : batch?.id || null,
      batchTitle: audience === "all" ? null : batch?.title || null,
      className: audience === "all" ? null : batch?.className || null,
      teacherName: teacherName.trim() || "Teacher",
      roomName: `ApexWorld_${(title || "class")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24)}_${Math.random().toString(36).slice(2, 10)}`,
      startedAt: Date.now(),
      active: true,
      endedAt: null,
      createdAt: Date.now(),
    };

    startMeeting(meeting);
    setTitle("");
    setStarting(false);
    setActiveMeeting(meeting);
  };

  // Live "time ago" ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const displayName = teacherName.trim() || "Teacher";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Live Video Class
        </h2>
        <p className="text-sm text-slate-500">
          Start a live class with real-time video, audio, and screen sharing.
          Students of the selected batch see a "Join" button instantly.
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
        <span className="font-mono">{activeMeetings.length} active</span>
      </div>

      {/* Start meeting form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Radio className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Start a live class</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live class title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mole Concept — Revision"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teacher name
            </label>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="e.g. Mr. Subhamoy Mondal"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Audience
            </label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="all">All students</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.className})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={starting || !title.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
        >
          {starting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Starting…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Start live class
            </>
          )}
        </button>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          When you start a class, a meeting dialog opens with real mic, camera
          and screen-share controls. Students of the selected audience see a
          "Join" button instantly — across devices.
        </p>
      </div>

      {/* Active meetings */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          Active right now ({activeMeetings.length})
        </h3>
        {activeMeetings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Video className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-500">
              No active classes. Start one above and it appears here instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeMeetings.map((m) => (
              <ActiveMeetingCard
                key={m.id}
                meeting={m}
                onJoin={() => setActiveMeeting(m)}
                onEnd={() => endMeeting(m.id)}
                onDelete={() => deleteMeeting(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent classes */}
      {pastMeetings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Recent classes ({pastMeetings.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pastMeetings.slice(0, 8).map((m) => (
              <PastMeetingCard
                key={m.id}
                meeting={m}
                onDelete={() => deleteMeeting(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Meeting dialog */}
      {activeMeeting && (
        <MeetingDialog
          meeting={activeMeeting}
          role="admin"
          displayName={displayName}
          meetingActive={activeMeetings.some(
            (m) => m.id === activeMeeting.id
          )}
          onClose={() => setActiveMeeting(null)}
          onEndMeeting={(id) => endMeeting(id)}
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

function ActiveMeetingCard({
  meeting,
  onJoin,
  onEnd,
  onDelete,
}: {
  meeting: LiveMeeting;
  onJoin: () => void;
  onEnd: () => void;
  onDelete: () => void;
}) {
  const scopeLabel =
    meeting.scope === "all" ? "All students" : meeting.batchTitle;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-red-600">
              Live
            </span>
            <span className="text-xs text-slate-500">
              · {timeAgo(meeting.startedAt)}
            </span>
          </div>
          <h4 className="truncate text-sm font-bold text-slate-900">
            {meeting.title}
          </h4>
          <p className="mt-0.5 text-xs text-slate-600">
            {meeting.teacherName} · {scopeLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Started {formatTime(meeting.startedAt)}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={onJoin}
            title="Open the meeting room"
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <Play className="h-3 w-3" /> Join
          </button>
          <button
            onClick={onEnd}
            title="End meeting (moves to history)"
            className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
          >
            End
          </button>
          <button
            onClick={onDelete}
            title="Permanently delete this record"
            className="inline-flex items-center justify-center rounded-md bg-red-100 p-1.5 text-red-600 transition hover:bg-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PastMeetingCard({
  meeting,
  onDelete,
}: {
  meeting: LiveMeeting;
  onDelete: () => void;
}) {
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
      <button
        onClick={onDelete}
        title="Permanently delete this record"
        className="inline-flex items-center justify-center rounded-md bg-red-50 p-1.5 text-red-500 transition hover:bg-red-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
