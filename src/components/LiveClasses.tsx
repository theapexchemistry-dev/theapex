import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Role, Student, Batch } from '../types';
import { StorageService } from '../lib/storage';
import { syncDocToFirestore, deleteFromFirestore } from '../lib/firebaseSync';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Video, Trash2, Users, Copy, X, Radio, Play,
  Zap, ShieldCheck, AlertCircle, Calendar, ExternalLink, Clock
} from 'lucide-react';

/* ============================================================================
 *  THE APEX WORLD — Live Classes (batch-based instant meetings)
 * ----------------------------------------------------------------------------
 *  Admin starts an instant meeting for a specific Batch / Class / Everyone.
 *  Only students in that target group see the "LIVE NOW" banner and can join.
 *  Students join with their real name as the display name.
 *
 *  IMPORTANT: Meetings open in a NEW BROWSER TAB (not an embedded iframe).
 *  Why? Jitsi's free meet.jit.si shows a 5-minute limit warning when embedded
 *  in an iframe, but is 100% free & unlimited when opened in a full tab.
 *  Opening in a new tab also avoids cross-origin / permission / stuck-loading
 *  issues that the embedded iframe had.
 *
 *  Meetings sync through Firestore so students on other devices see them
 *  in real time (same sync mechanism as notes, doubts, fees, etc.).
 * ========================================================================== */

// ---------- Types ----------
interface LiveMeeting {
  id: string;
  title: string;
  scope: 'batch' | 'class' | 'all';
  batchId?: string;
  batchTitle?: string;
  className?: string;
  teacherName: string;
  roomName: string;
  startedAt: number;
  durationMins: number;
  active: boolean;
  endedAt?: number;
  createdAt: number;
}

// ---------- Constants ----------
const JITSI_DOMAIN = 'meet.jit.si';
const STORAGE_KEY = 'apex_live_meetings';
const FIRESTORE_COLLECTION = 'liveMeetings';
const FALLBACK_CLASSES = ['Class 9', 'Class 10', 'Class 11', 'Class 12'];

// ---------- Helpers ----------
function sanitizeRoomName(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]/g, '').replace(/^-+|-+$/g, '').slice(0, 60);
}

function generateRoomName(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return sanitizeRoomName(`ApexWorld_${Date.now().toString(36)}_${rand}`);
}

function getMeetings(): LiveMeeting[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LiveMeeting[]) : [];
  } catch {
    return [];
  }
}

function saveMeetingsLocal(meetings: LiveMeeting[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_storage_updated'));
  }
}

/** Write a single meeting doc to Firestore (fire-and-forget). */
function syncMeetingToFirestore(meeting: LiveMeeting): void {
  try {
    syncDocToFirestore(FIRESTORE_COLLECTION, meeting.id, {
      ...meeting,
      batchId: meeting.batchId || null,
      batchTitle: meeting.batchTitle || null,
      className: meeting.className || null,
      endedAt: meeting.endedAt || null,
    }).catch(() => {
      /* ignore — local data still works */
    });
  } catch {
    /* ignore */
  }
}

/** Delete a meeting doc from Firestore (fire-and-forget). */
function deleteMeetingFromFirestore(id: string): void {
  try {
    deleteFromFirestore(FIRESTORE_COLLECTION, id).catch(() => {});
  } catch {
    /* ignore */
  }
}

function getBatchesSafe(): Batch[] {
  try {
    return StorageService.getBatches();
  } catch {
    return [];
  }
}

function getStudentsSafe(): Student[] {
  try {
    return StorageService.getStudents();
  } catch {
    return [];
  }
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Build the Jitsi URL for a given room + display name.
 * Uses URL-hash config (officially supported method).
 * The URL is opened in a NEW TAB — this avoids the 5-minute embedded limit
 * and gives full meet.jit.si functionality (free, unlimited).
 */
function buildJitsiUrl(roomName: string, displayName: string): string {
  const safeRoom = sanitizeRoomName(roomName);
  const encodedName = encodeURIComponent(displayName);
  const hash = [
    'config.startWithAudioMuted=false',
    'config.startWithVideoMuted=false',
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=true',
    `userInfo.displayName=${encodedName}`,
  ].join('&');
  return `https://${JITSI_DOMAIN}/${safeRoom}#${hash}`;
}

/** Plain (no hash) link for copying / sharing. */
function buildPlainLink(roomName: string): string {
  return `https://${JITSI_DOMAIN}/${sanitizeRoomName(roomName)}`;
}

function canStudentSee(meeting: LiveMeeting, student: Student): boolean {
  if (!meeting.active) return false;
  if (meeting.scope === 'all') return true;
  if (meeting.scope === 'batch') {
    // Match by batchId (primary) — this is the most reliable.
    if (student.batchId && meeting.batchId && student.batchId === meeting.batchId) {
      return true;
    }
    // Fallback: if the meeting has a className, also match by class.
    if (meeting.className && student.className) {
      const mc = meeting.className.toLowerCase().trim();
      const sc = student.className.toLowerCase().trim();
      if (mc !== '' && mc === sc) return true;
    }
    return false;
  }
  if (meeting.scope === 'class') {
    const mc = (meeting.className || '').toLowerCase().trim();
    const sc = (student.className || '').toLowerCase().trim();
    return mc !== '' && mc === sc;
  }
  return false;
}

function meetingAudienceLabel(meeting: LiveMeeting): string {
  if (meeting.scope === 'all') return 'All Students';
  if (meeting.scope === 'batch') return meeting.batchTitle || meeting.batchId || 'Batch';
  if (meeting.scope === 'class') return meeting.className || 'Class';
  return '—';
}

/**
 * Try to open a URL in a new tab.
 * Returns true if it succeeded, false if the popup blocker stopped it.
 */
function openInNewTab(url: string): boolean {
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) return false;
    try { win.focus(); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
//  LiveClasses — main component
// ============================================================================
interface LiveClassesProps {
  role: Role;
  student?: Student | null;
}

export const LiveClasses: React.FC<LiveClassesProps> = ({ role, student }) => {
  const isAdmin = role === 'admin';

  const [meetings, setMeetings] = useState<LiveMeeting[]>(() => getMeetings());
  const [batches, setBatches] = useState<Batch[]>(() => getBatchesSafe());
  const [studentCount, setStudentCount] = useState<number>(() => getStudentsSafe().length);
  const [showStart, setShowStart] = useState(false);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const [form, setForm] = useState<{
    scope: 'batch' | 'class' | 'all';
    batchId: string;
    className: string;
    title: string;
  }>({
    scope: 'class',
    batchId: '',
    className: 'Class 12',
    title: '',
  });

  // Tick every second so the "live for Xm" timer updates.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(() => {
    setMeetings(getMeetings());
    setBatches(getBatchesSafe());
    setStudentCount(getStudentsSafe().length);
  }, []);

  // Listen for local storage updates (same-browser, other tabs)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('apex_storage_updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('apex_storage_updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  // ── Firestore real-time listener ───────────────────────────────────────
  // This is what makes meetings show up on the STUDENT'S device. When the
  // admin starts a meeting, it's written to Firestore; this listener fires
  // in every browser (admin + student) and updates the local state.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const q = collection(db, FIRESTORE_COLLECTION);
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const firestoreMeetings = snapshot.docs.map((d) => d.data() as LiveMeeting);
          saveMeetingsLocal(firestoreMeetings);
          setMeetings(firestoreMeetings);
        },
        (err) => {
          console.debug('Live meetings listener error:', err);
        }
      );
    } catch (e) {
      console.debug('Firebase listener setup failed:', e);
    }
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const displayName = isAdmin
    ? 'Mr. Subhamoy Mondal (Teacher)'
    : student?.name || 'Student';

  const classOptions = useMemo(() => {
    const fromBatches = batches.map((b) => b.className).filter(Boolean);
    const merged = Array.from(new Set([...FALLBACK_CLASSES, ...fromBatches]));
    return merged.sort();
  }, [batches]);

  const countStudentsFor = useCallback(
    (scope: 'batch' | 'class' | 'all', batchId?: string, className?: string): number => {
      const students = getStudentsSafe();
      if (scope === 'all') return students.length;
      if (scope === 'batch') {
        return students.filter((s) => s.batchId === batchId).length;
      }
      const target = (className || '').toLowerCase().trim();
      return students.filter(
        (s) => (s.className || '').toLowerCase().trim() === target
      ).length;
    },
    []
  );

  // ---- Join helper (opens Jitsi in a new tab) ----
  const handleJoin = useCallback(
    (meeting: LiveMeeting) => {
      const url = buildJitsiUrl(meeting.roomName, displayName);
      const ok = openInNewTab(url);
      if (!ok) {
        // Popup was blocked — show the link so the user can click it manually.
        setPopupBlockedUrl(url);
      }
    },
    [displayName]
  );

  // ---- Actions ----

  const handleStartMeeting = () => {
    const scope = form.scope;
    let title = form.title.trim();
    let batchId: string | undefined;
    let batchTitle: string | undefined;
    let className: string | undefined;

    if (scope === 'batch') {
      if (!form.batchId) return;
      const batch = batches.find((b) => b.id === form.batchId);
      if (!batch) return;
      batchId = batch.id;
      batchTitle = batch.title;
      className = batch.className;
      if (!title) title = `${batch.className} — Live Class`;
    } else if (scope === 'class') {
      if (!form.className) return;
      className = form.className;
      if (!title) title = `${form.className} — Live Class`;
    } else {
      if (!title) title = 'Live Class — All Batches';
    }

    const meeting: LiveMeeting = {
      id: 'live-' + Date.now().toString(36),
      title,
      scope,
      batchId,
      batchTitle,
      className,
      teacherName: 'Mr. Subhamoy Mondal',
      roomName: generateRoomName(),
      startedAt: Date.now(),
      durationMins: 60,
      active: true,
      createdAt: Date.now(),
    };

    // 1. Save locally for instant UI feedback
    const updated = [meeting, ...getMeetings()];
    saveMeetingsLocal(updated);
    setMeetings(updated);

    // 2. Sync to Firestore so students on OTHER devices see it
    syncMeetingToFirestore(meeting);

    // 3. Close modal & reset form
    setShowStart(false);
    setForm({ scope: 'class', batchId: '', className: 'Class 12', title: '' });

    // 4. Open the meeting in a new tab for the admin (teacher)
    setTimeout(() => {
      const url = buildJitsiUrl(meeting.roomName, displayName);
      const ok = openInNewTab(url);
      if (!ok) {
        setPopupBlockedUrl(url);
      }
    }, 100);
  };

  const handleEndMeeting = (id: string) => {
    const ok = window.confirm(
      'End this live class?\n\nStudents will no longer be able to join from the website.'
    );
    if (!ok) return;

    const updated = getMeetings().map((m) =>
      m.id === id ? { ...m, active: false, endedAt: Date.now() } : m
    );
    saveMeetingsLocal(updated);
    setMeetings(updated);

    const ended = updated.find((m) => m.id === id);
    if (ended) syncMeetingToFirestore(ended);
  };

  const handleDeleteMeeting = (id: string) => {
    if (!window.confirm('Delete this meeting record? This cannot be undone.')) return;
    const updated = getMeetings().filter((m) => m.id !== id);
    saveMeetingsLocal(updated);
    setMeetings(updated);
    deleteMeetingFromFirestore(id);
  };

  const handleCopyLink = (meeting: LiveMeeting) => {
    const url = buildPlainLink(meeting.roomName);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => window.alert('Live class link copied!\n\n' + url),
        () => window.alert('Link: ' + url)
      );
    } else {
      window.alert('Link: ' + url);
    }
  };

  const handleCopyPopupUrl = () => {
    if (!popupBlockedUrl) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(popupBlockedUrl).then(
        () => window.alert('Link copied! Paste it in a new browser tab.'),
        () => {/* ignore */}
      );
    }
  };

  // ---- Derived lists ----

  const visibleMeetings = isAdmin
    ? meetings
    : meetings.filter((m) => (student ? canStudentSee(m, student) : false));

  const activeMeetings = visibleMeetings.filter((m) => m.active);
  const endedMeetings = visibleMeetings.filter((m) => !m.active);

  const sortedActive = [...activeMeetings].sort((a, b) => b.startedAt - a.startedAt);
  const sortedEnded = [...endedMeetings].sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));

  const canStart = form.scope !== 'batch' || form.batchId !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
            <Video className="w-7 h-7 text-amber-500" /> Live Classes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Start an instant live class for a specific batch or class.'
              : 'Join live classes hosted by your teacher.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowStart(true)}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" /> Start Instant Meeting
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <strong>Batch-restricted &amp; unlimited.</strong> Only students in the selected
          batch or class can see and join the meeting. Each class gets a unique, unguessable
          Jitsi room. Meetings open in a <strong>new browser tab</strong> so there is no
          time limit — just allow camera &amp; mic access when your browser asks.
        </div>
      </div>

      {/* Student: no active meetings */}
      {!isAdmin && sortedActive.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No live classes right now</p>
          <p className="text-slate-400 text-sm mt-1">
            When your teacher starts a class for your batch, it will appear here
            automatically.
          </p>
          {student && (
            <p className="text-[11px] text-slate-400 mt-3">
              Your class: <strong>{student.className || '—'}</strong>
              {student.batchId ? <> · Batch ID: <strong>{student.batchId}</strong></> : null}
            </p>
          )}
        </div>
      )}

      {/* Active (LIVE NOW) meetings */}
      {sortedActive.length > 0 && (
        <div className="space-y-4">
          {sortedActive.map((m) => {
            const elapsed = now - m.startedAt;
            return (
              <div
                key={m.id}
                className={`bg-white border-2 rounded-2xl p-5 ${
                  isAdmin ? 'border-red-200' : 'border-red-300'
                } ring-4 ring-red-50`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                        <Radio className="w-3 h-3 animate-pulse" /> Live Now
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
                        <Clock className="w-3 h-3" /> {formatDuration(elapsed)}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        · {meetingAudienceLabel(m)}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                      {m.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {formatDateTime(m.startedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {countStudentsFor(m.scope, m.batchId, m.className)} students
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" /> {m.teacherName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleJoin(m)}
                      className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Play className="w-4 h-4" /> Join Now
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleCopyLink(m)}
                          title="Copy direct link"
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEndMeeting(m.id)}
                          title="End meeting"
                          className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 font-bold text-xs transition-colors"
                        >
                          End
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {!isAdmin ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> You will join as{' '}
                      <strong>{displayName}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Meeting opens in a new tab
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    If a new tab doesn&apos;t open, allow popups for this site.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past meetings (admin only) */}
      {isAdmin && sortedEnded.length > 0 && (
        <div>
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">
            Past Meetings
          </h2>
          <div className="space-y-2">
            {sortedEnded.slice(0, 10).map((m) => (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase">
                      Ended
                    </span>
                    <p className="font-bold text-slate-700 text-sm truncate">{m.title}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {meetingAudienceLabel(m)} · {formatDateTime(m.startedAt)}
                    {m.endedAt && ` → ended ${formatDateTime(m.endedAt)}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteMeeting(m.id)}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Delete record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start meeting modal */}
      {showStart && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowStart(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> Start Instant Meeting
              </h3>
              <button
                onClick={() => setShowStart(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Who can join?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { val: 'class', label: 'Entire Class' },
                      { val: 'batch', label: 'Specific Batch' },
                      { val: 'all', label: 'All Students' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setForm({ ...form, scope: opt.val })}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        form.scope === opt.val
                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.scope === 'batch' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Batch *
                  </label>
                  {batches.length === 0 ? (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg p-3">
                      No batches found. Add batches first in the Batches tab.
                    </p>
                  ) : (
                    <select
                      value={form.batchId}
                      onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    >
                      <option value="">— Select a batch —</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.className})
                        </option>
                      ))}
                    </select>
                  )}
                  {form.batchId && (
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {countStudentsFor('batch', form.batchId)} student(s) will see this meeting
                    </p>
                  )}
                </div>
              )}

              {form.scope === 'class' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Class *
                  </label>
                  <select
                    value={form.className}
                    onChange={(e) => setForm({ ...form, className: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {countStudentsFor('class', undefined, form.className)} student(s) will see
                    this meeting
                  </p>
                </div>
              )}

              {form.scope === 'all' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  All {studentCount} students across every batch will see this meeting.
                </p>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Class Title (optional)
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Mole Concept — Doubt Clearing"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Leave blank to auto-generate from the class or batch name.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2">
                <ExternalLink className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  The meeting opens in a <strong>new browser tab</strong> using Jitsi Meet
                  (free, no time limit, no signup). Please allow camera &amp; microphone access
                  when prompted. Students click <strong>Join Now</strong> on their end to enter.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowStart(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartMeeting}
                disabled={!canStart}
                className="flex-1 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Start &amp; Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup-blocked fallback modal */}
      {popupBlockedUrl && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPopupBlockedUrl(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Popup Blocked
              </h3>
              <button
                onClick={() => setPopupBlockedUrl(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Your browser blocked the automatic meeting tab. Allow popups for this site,
              or open the link below manually:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
              <p className="text-[11px] font-mono text-slate-500 break-all">{popupBlockedUrl}</p>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={popupBlockedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Open Meeting
              </a>
              <button
                onClick={handleCopyPopupUrl}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveClasses;
