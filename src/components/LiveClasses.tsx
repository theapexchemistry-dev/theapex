/**
 * ============================================================================
 *  LiveClasses.tsx — REAL-TIME SYNC via your existing firebaseSync.ts
 * ----------------------------------------------------------------------------
 *  Uses your EXISTING firebaseSync.ts (which already syncs the liveMeetings
 *  and batches collections to Firestore + localStorage).
 *
 *  HOW IT WORKS:
 *    Admin clicks "Start live class"
 *        ↓
 *    syncDocToFirestore('liveMeetings', id, meeting)  ← your existing function
 *        ↓
 *    Firestore writes the doc → onSnapshot fires on EVERY device
 *        ↓
 *    firebaseSync.ts merges it into localStorage key "apex_liveMeetings_v2"
 *        ↓
 *    "apex_storage_updated" event fires → LiveClasses re-renders
 *        ↓
 *    Meeting card appears on student's screen instantly
 *
 *  No link sharing. No codes. Real-time auto-sync.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Video,
  Trash2,
  X,
  Radio,
  Play,
  Clock,
  Wifi,
  Info,
  Users,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { syncDocToFirestore, deleteFromFirestore } from "../lib/firebaseSync";

// ---------- Types ----------
export type Role = "admin" | "student";

export interface Student {
  id?: string;
  name: string;
  className?: string;
  batchId?: string;
  batchTitle?: string;
}

interface LiveMeeting {
  id: string;
  title: string;
  scope: "batch" | "class" | "all";
  batchId?: string | null;
  batchTitle?: string | null;
  className?: string | null;
  teacherName: string;
  roomName: string;
  startedAt: number;
  durationMins: number;
  active: boolean;
  endedAt?: number | null;
  createdAt: number;
}

interface LiveClassesProps {
  role: Role;
  student?: Student | null;
}

// ---------- Constants ----------
// ⚠️ This MUST match the key firebaseSync.ts uses.
// firebaseSync.ts uses: `apex_${key}_v2` where key = 'liveMeetings'
const STORAGE_KEY = "apex_liveMeetings_v2";
const BATCHES_KEY = "apex_batches_v2";

// ---------- Helpers ----------
function sanitizeRoomName(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]/g, "").replace(/^-+|-+$/g, "").slice(0, 60);
}

function generateRoomName(title: string): string {
  const slug = (title || "class")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "class";
  const rand = Math.random().toString(36).slice(2, 10);
  return sanitizeRoomName(`ApexWorld_${slug}_${rand}`);
}

function buildJitsiUrl(roomName: string, displayName: string): string {
  const safe = sanitizeRoomName(roomName);
  const user = encodeURIComponent(displayName || "Guest");
  return `https://meet.jit.si/${safe}#config.displayName=${user}&config.startWithAudioMuted=true&config.startWithVideoMuted=false&interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true`;
}

function getMeetings(): LiveMeeting[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LiveMeeting[]) : [];
  } catch {
    return [];
  }
}

// Batches in your DB might use different field names for the title.
// This picks the first non-empty one so the dropdown always shows something useful.
function getBatchTitle(batch: any): string {
  if (!batch) return "Untitled batch";
  return (
    batch.title ||
    batch.name ||
    batch.batchName ||
    batch.batchTitle ||
    batch.className ||
    batch.id ||
    "Untitled batch"
  );
}

// Load batches from localStorage (firebaseSync.ts keeps them at this key)
function getBatches(): any[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(BATCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeClassName(c: string): string {
  if (!c) return "";
  const lower = c.toLowerCase().trim();
  const match = lower.match(/\d+/);
  return match ? match[0] : lower;
}

function isMeetingForStudent(meeting: LiveMeeting, student: Student): boolean {
  if (meeting.scope === "all") return true;
  if (meeting.scope === "class") {
    if (!meeting.className || !student.className) return false;
    return normalizeClassName(meeting.className) === normalizeClassName(student.className);
  }
  if (meeting.scope === "batch") {
    if (student.batchId && meeting.batchId && student.batchId === meeting.batchId) return true;
    if (meeting.className && student.className)
      return normalizeClassName(meeting.className) === normalizeClassName(student.className);
    return false;
  }
  return false;
}

// ============================================================================
//  Main component
// ============================================================================
export function LiveClasses({ role, student }: LiveClassesProps) {
  const isStudent = role === "student";

  const [meetings, setMeetings] = useState<LiveMeeting[]>([]);
  const [connected, setConnected] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");

  // ---- Load from localStorage + listen for real-time updates ----
  // firebaseSync.ts dispatches "apex_storage_updated" whenever Firestore
  // pushes a new snapshot. We re-read localStorage on every such event.
  useEffect(() => {
    const handler = () => {
      setMeetings(getMeetings());
      setBatches(getBatches());
    };
    handler();
    setConnected(true);
    window.addEventListener("apex_storage_updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("apex_storage_updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // ---- Admin form state ----
  const [title, setTitle] = useState("");
  const [teacherName, setTeacherName] = useState("Apex Chemistry");
  const [duration, setDuration] = useState(60);
  const [starting, setStarting] = useState(false);

  // scope is derived from selectedBatchId: "all" → all students, else → batch
  const scope: "batch" | "class" | "all" = selectedBatchId === "all" ? "all" : "batch";

  const handleStartMeeting = useCallback(async () => {
    if (!title.trim()) return;
    setStarting(true);
    try {
      const selectedBatch = batches.find((b) => b.id === selectedBatchId);
      const meeting: LiveMeeting = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(),
        scope,
        batchId: scope === "batch" ? selectedBatchId : null,
        batchTitle: scope === "batch" ? getBatchTitle(selectedBatch) : null,
        className: null,
        teacherName: teacherName.trim() || "Apex Chemistry",
        roomName: generateRoomName(title),
        startedAt: Date.now(),
        durationMins: duration,
        active: true,
        endedAt: null,
        createdAt: Date.now(),
      };
      // 👇 Uses YOUR EXISTING firebaseSync.ts function — writes to Firestore
      await syncDocToFirestore("liveMeetings", meeting.id, meeting);
      // Optimistically update local state (Firestore onSnapshot will confirm)
      const current = getMeetings();
      const updated = [meeting, ...current.filter((m) => m.id !== meeting.id)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("apex_storage_updated"));
      setTitle("");
    } catch (err) {
      console.error("[LiveClasses] startMeeting failed:", err);
    } finally {
      setStarting(false);
    }
  }, [title, teacherName, scope, selectedBatchId, duration, batches, student]);

  const handleEndMeeting = useCallback(async (id: string) => {
    const current = getMeetings();
    const updated = current.map((m) =>
      m.id === id ? { ...m, active: false, endedAt: Date.now() } : m
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("apex_storage_updated"));
    const m = updated.find((x) => x.id === id);
    if (m) await syncDocToFirestore("liveMeetings", id, m);
  }, []);

  const handleDeleteMeeting = useCallback(async (id: string) => {
    const current = getMeetings();
    const updated = current.filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("apex_storage_updated"));
    await deleteFromFirestore("liveMeetings", id);
  }, []);

  // ---- Student: filter by scope ----
  const visibleMeetings = useMemo(() => {
    const active = meetings.filter((m) => m.active);
    if (!isStudent || !student) return active;
    return active.filter((m) => isMeetingForStudent(m, student));
  }, [meetings, isStudent, student]);

  // ---- Live "time ago" ticker ----
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const [joinMeeting, setJoinMeeting] = useState<LiveMeeting | null>(null);

  // ========================================================================
  //  RENDER — ADMIN
  // ========================================================================
  if (!isStudent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
          <div className="flex items-center gap-2 font-semibold">
            <Wifi className="h-3.5 w-3.5" /> Live · synced
          </div>
          <span className="font-mono">{visibleMeetings.length} active</span>
        </div>

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
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mole Concept — Revision"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher name</label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)}
                placeholder="e.g. Mr. Sharma"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                <option value="all">All students</option>
                {batches.length === 0 && (
                  <option value="_loading" disabled>Loading batches…</option>
                )}
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {getBatchTitle(b)}
                  </option>
                ))}
              </select>
              {batches.length === 0 && (
                <p className="text-[11px] text-amber-600">
                  No batches found. Make sure batches are synced in your admin panel.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration (minutes)</label>
              <input type="number" min={15} max={240} value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 60)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
          </div>

          <button onClick={handleStartMeeting} disabled={starting || !title.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto">
            {starting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" /> Starting…</>
            : <><Play className="h-4 w-4" /> Start live class</>}
          </button>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            When you start a class, it instantly appears on every student's screen.
            Students just click <strong>Join Now</strong> — no links to share.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Active right now ({visibleMeetings.length})</h3>
          {visibleMeetings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Video className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-500">No active classes. Start one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleMeetings.map((m) => {
                const scopeLabel = m.scope === "all" ? "All students" : m.scope === "class" ? m.className : m.batchTitle;
                return (
                  <div key={m.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="flex h-2 w-2 items-center justify-center">
                            <span className="h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wide text-red-600">Live</span>
                          <span className="text-xs text-slate-500">· {timeAgo(m.startedAt)}</span>
                        </div>
                        <h4 className="truncate text-sm font-bold text-slate-900">{m.title}</h4>
                        <p className="mt-0.5 text-xs text-slate-600">{m.teacherName} · {scopeLabel}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Started {formatTime(m.startedAt)} · {m.durationMins} min</p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <a href={buildJitsiUrl(m.roomName, m.teacherName)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
                          <ExternalLink className="h-3 w-3" /> Join
                        </a>
                        <button onClick={() => handleEndMeeting(m.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300">End</button>
                        <button onClick={() => handleDeleteMeeting(m.id)}
                          className="inline-flex items-center justify-center rounded-md bg-red-100 p-1.5 text-red-600 transition hover:bg-red-200">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================================================================
  //  RENDER — STUDENT
  // ========================================================================
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
        <div className="flex items-center gap-2 font-semibold">
          <Wifi className="h-3.5 w-3.5" /> Live · synced
        </div>
        <span className="font-mono">{visibleMeetings.length} active</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          {student?.className || "Student"}
          {student?.batchTitle ? ` · ${student.batchTitle}` : ""}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">
          Hi {student?.name?.split(" ")[0] || "there"} 👋
        </h3>
        <p className="text-sm text-slate-600">
          Live classes started by your teacher will appear here automatically. You don't need to refresh.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Live now ({visibleMeetings.length})</h3>
        {visibleMeetings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Radio className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No live classes right now</p>
            <p className="mt-1 text-xs text-slate-500">
              When your teacher starts a class, it will appear here instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleMeetings.map((m) => (
              <div key={m.id} className="rounded-xl border-2 border-emerald-300 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 items-center justify-center">
                    <span className="h-2.5 w-2.5 animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-red-600">Live now</span>
                  <span className="text-xs text-slate-500">· started {timeAgo(m.startedAt)}</span>
                </div>
                <h4 className="text-base font-bold text-slate-900">{m.title}</h4>
                <p className="mt-1 text-sm text-slate-600">by <span className="font-semibold">{m.teacherName}</span></p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime(m.startedAt)} · {m.durationMins} min</span>
                  {m.scope !== "all" && (
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />
                      {m.scope === "class" ? m.className : m.batchTitle}
                    </span>
                  )}
                </div>
                <button onClick={() => setJoinMeeting(m)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">
                  <Play className="h-4 w-4" /> Join now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {joinMeeting && (
        <JoinModal meeting={joinMeeting} studentName={student?.name || "Student"} onClose={() => setJoinMeeting(null)} />
      )}
    </div>
  );
}

function JoinModal({ meeting, studentName, onClose }: {
  meeting: LiveMeeting; studentName: string; onClose: () => void;
}) {
  const joinUrl = buildJitsiUrl(meeting.roomName, studentName);
  useEffect(() => {
    try { window.open(joinUrl, "_blank", "noopener,noreferrer"); } catch { /* popup blocked */ }
  }, [joinUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Joining class</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">{meeting.title}</h3>
            <p className="text-sm text-slate-600">by {meeting.teacherName}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="mb-2 flex items-start gap-1.5">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            The meeting opens in a new tab. Allow camera & microphone access when your browser asks.
          </p>
          <p className="text-xs">If it didn't open automatically (popup blocked), click the button below:</p>
        </div>
        <a href={joinUrl} target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">
          <ExternalLink className="h-4 w-4" /> Open meeting room
        </a>
        <button onClick={onClose} className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Close</button>
      </div>
    </div>
  );
}

export default LiveClasses;
