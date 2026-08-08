/**
 * ============================================================================
 *  LiveClasses.tsx — Real-time live classes (Vite + React)
 * ----------------------------------------------------------------------------
 *  Features:
 *    1. Admin clicks "Start live class" → Jitsi tab opens AUTOMATICALLY.
 *    2. Ended meetings move to a "Recent classes" history section (NOT deleted).
 *    3. Real-time sync across all devices via Firestore onSnapshot.
 *    4. Audience dropdown loads REAL batches from StorageService.getBatches().
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Video, Trash2, X, Radio, Play, ExternalLink, Clock,
  CheckCircle2, Wifi, WifiOff, Info, Users, History,
} from "lucide-react";
import {
  subscribeToAllMeetings,
  startMeeting as fbStartMeeting,
  endMeeting as fbEndMeeting,
  deleteMeeting as fbDeleteMeeting,
  type LiveMeeting,
} from "../lib/firebaseSync";
import { StorageService } from "../lib/storage";
import type { Batch } from "../types";

export type Role = "admin" | "student";

export interface Student {
  id?: string;
  name: string;
  className?: string;
  batchId?: string;
  batchTitle?: string;
}

interface LiveClassesProps {
  role: Role;
  student?: Student | null;
}

function buildJitsiUrl(roomName: string, displayName: string): string {
  const safe = encodeURIComponent(roomName);
  const user = encodeURIComponent(displayName || "Guest");
  return `https://meet.jit.si/${safe}#config.displayName=${user}&config.startWithAudioMuted=true&config.startWithVideoMuted=false&interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true`;
}

function generateRoomName(title: string): string {
  const slug = (title || "class").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "class";
  const rand = Math.random().toString(36).slice(2, 10);
  return `ApexWorld_${slug}_${rand}`;
}

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
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(startedAt: number, endedAt: number | null | undefined): string {
  const end = endedAt || Date.now();
  const mins = Math.max(1, Math.round((end - startedAt) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function LiveClasses({ role, student }: LiveClassesProps) {
  const isStudent = role === "student";

  const [meetings, setMeetings] = useState<LiveMeeting[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllMeetings(
      (next) => { setMeetings(next); setConnected(true); setSyncError(null); },
      (err) => { setConnected(false); setSyncError(err.message || "Failed to sync with Firestore."); }
    );
    return () => unsub();
  }, []);

  // ---- Load REAL batches from StorageService ----
  const [batches, setBatches] = useState<Batch[]>([]);
  useEffect(() => {
    const refresh = () => setBatches(StorageService.getBatches());
    refresh();
    window.addEventListener("apex_storage_updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("apex_storage_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Unique class names derived from batches
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    batches.forEach((b) => { if (b.className) set.add(b.className); });
    return Array.from(set).sort();
  }, [batches]);

  const [title, setTitle] = useState("");
  const [teacherName, setTeacherName] = useState("Apex Chemistry");
  const [scope, setScope] = useState<"batch" | "class" | "all">("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [duration, setDuration] = useState(60);
  const [starting, setStarting] = useState(false);
  const [joinMeeting, setJoinMeeting] = useState<LiveMeeting | null>(null);

  // Auto-select first batch/class when scope changes
  useEffect(() => {
    if (scope === "batch") {
      if (!selectedBatchId && batches.length > 0) setSelectedBatchId(batches[0].id);
    } else if (scope === "class") {
      if (!selectedClassName && classOptions.length > 0) setSelectedClassName(classOptions[0]);
    }
  }, [scope, batches, classOptions, selectedBatchId, selectedClassName]);

  const handleStartMeeting = useCallback(async () => {
    if (!title.trim()) return;
    if (scope === "batch" && !selectedBatchId) { setSyncError("Please pick a batch."); return; }
    if (scope === "class" && !selectedClassName) { setSyncError("Please pick a class."); return; }

    setStarting(true);
    try {
      const roomName = generateRoomName(title);
      const chosenBatch = scope === "batch" ? batches.find((b) => b.id === selectedBatchId) : undefined;

      const meeting: LiveMeeting = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(),
        scope,
        batchId: scope === "batch" ? (chosenBatch?.id || selectedBatchId || null) : null,
        batchTitle: scope === "batch" ? (chosenBatch?.title || null) : null,
        className: scope === "class" ? (selectedClassName || null) : null,
        teacherName: teacherName.trim() || "Apex Chemistry",
        roomName,
        startedAt: Date.now(),
        durationMins: duration,
        active: true,
        endedAt: null,
        createdAt: Date.now(),
      };

      // ✅ Open Jitsi tab IMMEDIATELY within the click gesture
      const joinUrl = buildJitsiUrl(roomName, teacherName.trim() || "Apex Chemistry");
      let opened = false;
      try { const w = window.open(joinUrl, "_blank", "noopener,noreferrer"); opened = !!w; } catch { opened = false; }

      await fbStartMeeting(meeting);
      if (!opened) setJoinMeeting(meeting);
      setTitle("");
    } catch (err) {
      console.error("[LiveClasses] startMeeting failed:", err);
      setSyncError(err instanceof Error ? err.message : "Failed to start meeting.");
    } finally {
      setStarting(false);
    }
  }, [title, teacherName, scope, duration, student, selectedBatchId, selectedClassName, batches]);

  const handleEndMeeting = useCallback(async (id: string) => {
    try { await fbEndMeeting(id); } catch (err) { console.error("[LiveClasses] endMeeting failed:", err); }
  }, []);

  const handleDeleteMeeting = useCallback(async (id: string) => {
    try { await fbDeleteMeeting(id); } catch (err) { console.error("[LiveClasses] deleteMeeting failed:", err); }
  }, []);

  const activeMeetings = useMemo(() => meetings.filter((m) => m.active), [meetings]);
  const pastMeetings = useMemo(() => meetings.filter((m) => !m.active), [meetings]);

  const visibleActive = useMemo(() => {
    if (!isStudent || !student) return activeMeetings;
    return activeMeetings.filter((m) => {
      if (m.scope === "all") return true;
      if (m.scope === "class") return m.className === student.className;
      if (m.scope === "batch") return m.batchId === student.batchId;
      return true;
    });
  }, [activeMeetings, isStudent, student]);

  const visiblePast = useMemo(() => {
    if (!isStudent || !student) return pastMeetings;
    return pastMeetings.filter((m) => {
      if (m.scope === "all") return true;
      if (m.scope === "class") return m.className === student.className;
      if (m.scope === "batch") return m.batchId === student.batchId;
      return true;
    });
  }, [pastMeetings, isStudent, student]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ===== ADMIN RENDER =====
  if (!isStudent) {
    return (
      <div className="space-y-6">
        <SyncStatusBar connected={connected} error={syncError} count={activeMeetings.length} />

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Radio className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Start a live class</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mole Concept — Revision" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher name</label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="e.g. Mr. Sharma" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>

            {/* Audience type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "batch" | "class" | "all")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                <option value="all">All students</option>
                <option value="class">A specific class</option>
                <option value="batch">A specific batch</option>
              </select>
            </div>

            {/* Sub-selection based on audience type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {scope === "batch" ? "Pick batch" : scope === "class" ? "Pick class" : "Duration (minutes)"}
              </label>
              {scope === "batch" ? (
                batches.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No batches found. Create one in the Batches tab first.</p>
                ) : (
                  <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.title}{b.className ? ` · ${b.className}` : ""}</option>))}
                  </select>
                )
              ) : scope === "class" ? (
                classOptions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No classes found. Create a batch first.</p>
                ) : (
                  <select value={selectedClassName} onChange={(e) => setSelectedClassName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {classOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                )
              ) : (
                <input type="number" min={15} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              )}
            </div>

            {scope !== "all" && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration (minutes)</label>
                <input type="number" min={15} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 md:max-w-xs" />
              </div>
            )}
          </div>

          <button onClick={handleStartMeeting} disabled={starting || !title.trim() || (scope === "batch" && batches.length === 0) || (scope === "class" && classOptions.length === 0)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto">
            {starting ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />Starting…</>) : (<><Play className="h-4 w-4" /> Start live class</>)}
          </button>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            When you start a class, the meeting room opens in a new tab automatically and the class card appears on every student&apos;s screen instantly — no links to share.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Active right now ({activeMeetings.length})</h3>
          </div>
          {activeMeetings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Video className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-500">No active classes. Start one above and it appears here instantly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMeetings.map((m) => (<AdminMeetingCard key={m.id} meeting={m} onEnd={() => handleEndMeeting(m.id)} onDelete={() => handleDeleteMeeting(m.id)} onRejoin={() => setJoinMeeting(m)} />))}
            </div>
          )}
        </div>

        {pastMeetings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Recent classes ({pastMeetings.length})</h3>
            </div>
            <div className="space-y-2">
              {pastMeetings.map((m) => (<PastMeetingCard key={m.id} meeting={m} isAdmin onDelete={() => handleDeleteMeeting(m.id)} />))}
            </div>
          </div>
        )}

        {joinMeeting && (<JoinModal meeting={joinMeeting} displayName={teacherName || "Apex Chemistry"} onClose={() => setJoinMeeting(null)} />)}
      </div>
    );
  }

  // ===== STUDENT RENDER =====
  return (
    <div className="space-y-6">
      <SyncStatusBar connected={connected} error={syncError} count={visibleActive.length} />

      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          {student?.className || "Student"}{student?.batchTitle ? ` · ${student.batchTitle}` : ""}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">Hi {student?.name?.split(" ")[0] || "there"} 👋</h3>
        <p className="text-sm text-slate-600">Live classes started by your teacher will appear here automatically. You don&apos;t need to refresh — it updates in real-time.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Live now ({visibleActive.length})</h3>
        </div>
        {visibleActive.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Radio className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No live classes right now</p>
            <p className="mt-1 text-xs text-slate-500">When your teacher starts a class, it will appear here instantly.<br />You don&apos;t need to refresh — it updates automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleActive.map((m) => (<StudentMeetingCard key={m.id} meeting={m} studentName={student?.name || "Student"} onJoin={() => setJoinMeeting(m)} />))}
          </div>
        )}
      </div>

      {visiblePast.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Recent classes ({visiblePast.length})</h3>
          </div>
          <div className="space-y-2">
            {visiblePast.map((m) => (<PastMeetingCard key={m.id} meeting={m} />))}
          </div>
        </div>
      )}

      {joinMeeting && (<JoinModal meeting={joinMeeting} displayName={student?.name || "Student"} onClose={() => setJoinMeeting(null)} />)}
    </div>
  );
}

// ===== Sub-components =====

function SyncStatusBar({ connected, error, count }: { connected: boolean; error: string | null; count: number }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs ${error ? "border-red-200 bg-red-50 text-red-700" : connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
      <div className="flex items-center gap-2 font-semibold">
        {error ? (<><WifiOff className="h-3.5 w-3.5" /> Sync error</>) : connected ? (<><Wifi className="h-3.5 w-3.5" /> Live · synced</>) : (<><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Connecting…</>)}
      </div>
      <span className="font-mono">{error ? "Check Firestore rules" : `${count} active`}</span>
    </div>
  );
}

function AdminMeetingCard({ meeting, onEnd, onDelete, onRejoin }: { meeting: LiveMeeting; onEnd: () => void; onDelete: () => void; onRejoin: () => void; }) {
  const scopeLabel = meeting.scope === "all" ? "All students" : meeting.scope === "class" ? meeting.className : meeting.batchTitle;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-red-600">Live</span>
            <span className="text-xs text-slate-500">· {timeAgo(meeting.startedAt)}</span>
          </div>
          <h4 className="truncate text-sm font-bold text-slate-900">{meeting.title}</h4>
          <p className="mt-0.5 text-xs text-slate-600">{meeting.teacherName} · {scopeLabel}</p>
          <p className="mt-1 text-[11px] text-slate-500">Started {formatTime(meeting.startedAt)} · {meeting.durationMins} min</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button onClick={onRejoin} title="Open the meeting room again" className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"><ExternalLink className="h-3 w-3" /> Join</button>
          <button onClick={onEnd} title="End meeting (moves to history — does NOT delete)" className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300">End</button>
          <button onClick={onDelete} title="Permanently delete this record" className="inline-flex items-center justify-center rounded-md bg-red-100 p-1.5 text-red-600 transition hover:bg-red-200"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function StudentMeetingCard({ meeting, studentName, onJoin }: { meeting: LiveMeeting; studentName: string; onJoin: () => void; }) {
  return (
    <div className="rounded-xl border-2 border-emerald-300 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-2.5 w-2.5 items-center justify-center">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-red-600">Live now</span>
        <span className="text-xs text-slate-500">· started {timeAgo(meeting.startedAt)}</span>
      </div>
      <h4 className="text-base font-bold text-slate-900">{meeting.title}</h4>
      <p className="mt-1 text-sm text-slate-600">by <span className="font-semibold">{meeting.teacherName}</span></p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime(meeting.startedAt)} · {meeting.durationMins} min</span>
        {meeting.scope !== "all" && (<span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{meeting.scope === "class" ? meeting.className : meeting.batchTitle}</span>)}
      </div>
      <button onClick={onJoin} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"><Play className="h-4 w-4" /> Join now</button>
    </div>
  );
}

function PastMeetingCard({ meeting, isAdmin = false, onDelete }: { meeting: LiveMeeting; isAdmin?: boolean; onDelete?: () => void; }) {
  const scopeLabel = meeting.scope === "all" ? "All students" : meeting.scope === "class" ? meeting.className : meeting.batchTitle;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ended</span>
        </div>
        <h4 className="truncate text-sm font-semibold text-slate-800">{meeting.title}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{meeting.teacherName} · {scopeLabel}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{formatTime(meeting.startedAt)}{meeting.endedAt ? ` → ${formatTime(meeting.endedAt)}` : ""} · {formatDuration(meeting.startedAt, meeting.endedAt)}</p>
      </div>
      {isAdmin && onDelete && (<button onClick={onDelete} title="Permanently delete this record" className="inline-flex items-center justify-center rounded-md bg-red-50 p-1.5 text-red-500 transition hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button>)}
    </div>
  );
}

function JoinModal({ meeting, displayName, onClose }: { meeting: LiveMeeting; displayName: string; onClose: () => void; }) {
  const joinUrl = buildJitsiUrl(meeting.roomName, displayName);
  useEffect(() => { try { window.open(joinUrl, "_blank", "noopener,noreferrer"); } catch { /* popup blocked */ } }, [joinUrl]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Joining class</span></div>
            <h3 className="text-lg font-bold text-slate-900">{meeting.title}</h3>
            <p className="text-sm text-slate-600">by {meeting.teacherName}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="mb-2 flex items-start gap-1.5"><Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />The meeting opens in a new tab. Allow camera &amp; microphone access when your browser asks.</p>
          <p className="text-xs">If it didn&apos;t open automatically (popup blocked), click the button below:</p>
        </div>
        <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"><ExternalLink className="h-4 w-4" /> Open meeting room</a>
        <button onClick={onClose} className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Close</button>
      </div>
    </div>
  );
}

export default LiveClasses;
