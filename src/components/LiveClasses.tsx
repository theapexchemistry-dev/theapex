import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Role, Student, Batch } from '../types';
import { StorageService } from '../lib/storage';
import {
  Video, Trash2, Users, Copy, X, Radio, Play,
  Zap, ShieldCheck, AlertCircle, Calendar, ExternalLink
} from 'lucide-react';

/* ============================================================================
 *  THE APEX WORLD — Live Classes (batch-based instant meetings)
 * ----------------------------------------------------------------------------
 *  Admin starts an instant meeting for a specific Batch / Class / Everyone.
 *  Only students in that target group see the "LIVE NOW" banner and can join.
 *  Students auto-join with their real name as the display name.
 *
 *  Powered by Jitsi Meet (meet.jit.si) — 100% free, no API key, no time limit.
 *
 *  ⚠️  IMPLEMENTATION NOTE:
 *  We use a PLAIN <iframe> pointing at meet.jit.si with URL-hash config.
 *  We do NOT use the external_api.js script because the current build of
 *  meet.jit.si throws "Failed to construct 'URL': Invalid URL" when the
 *  script tries to resolve its own config URLs. The iframe method is the
 *  officially supported "simple embed" and is 100% reliable.
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

function saveMeetings(meetings: LiveMeeting[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
  } catch {
    /* storage full or unavailable — ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_storage_updated'));
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

/**
 * Build the Jitsi embed URL for a given room + display name.
 *
 * We use the URL-hash config format documented at:
 *   https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe
 *
 *   #config.startWithAudioMuted=false
 *   &config.startWithVideoMuted=false
 *   &config.prejoinPageEnabled=false        ← skip Jitsi's own lobby
 *   &config.disableDeepLinking=true         ← don't try to open the native app
 *   &userInfo.displayName=<encoded>         ← set the student/teacher name
 *
 * This avoids the external_api.js script entirely, which throws
 * "Failed to construct 'URL': Invalid URL" in the current meet.jit.si build.
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

/**
 * Decide whether a given student should see / join a meeting.
 * - scope 'all'    → every student
 * - scope 'batch'  → only students whose batchId matches
 * - scope 'class'  → only students whose className matches (case-insensitive)
 */
function canStudentSee(meeting: LiveMeeting, student: Student): boolean {
  if (!meeting.active) return false;
  if (meeting.scope === 'all') return true;
  if (meeting.scope === 'batch') {
    return (meeting.batchId || '') === student.batchId;
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

// ============================================================================
//  CallOverlay — full-screen embedded Jitsi video call via plain <iframe>
// ============================================================================
interface CallOverlayProps {
  meeting: LiveMeeting;
  displayName: string;
  onLeave: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ meeting, displayName, onLeave }) => {
  const jitsiUrl = useMemo(
    () => buildJitsiUrl(meeting.roomName, displayName),
    [meeting.roomName, displayName]
  );

  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Safety net: if the iframe hasn't fired onLoad within 20s, show an error
  // hint so the user isn't stuck looking at a spinner forever.
  useEffect(() => {
    setIframeLoaded(false);
    setIframeError(false);
    const timer = setTimeout(() => {
      if (!iframeLoaded) setIframeError(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, [iframeLoaded]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
            <Radio className="w-4 h-4 animate-pulse" /> LIVE
          </span>
          <span className="text-white font-bold text-sm truncate">{meeting.title}</span>
          <span className="text-slate-500 text-xs hidden sm:inline">
            · {meetingAudienceLabel(meeting)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={jitsiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg items-center gap-1.5 transition-colors"
            title="Open in full Jitsi tab (useful for screen share / desktop mode)"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in tab
          </a>
          <button
            onClick={onLeave}
            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" /> Leave
          </button>
        </div>
      </div>

      {/* Jitsi iframe (plain embed — no external_api.js) */}
      <div className="flex-1 relative bg-slate-950">
        <iframe
          src={jitsiUrl}
          title={`Live class: ${meeting.title}`}
          allow="camera; microphone; fullscreen; display-capture; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0 bg-slate-950"
          onLoad={() => setIframeLoaded(true)}
          onError={() => setIframeError(true)}
        />

        {/* Loading spinner shown until the iframe reports onLoad */}
        {!iframeLoaded && !iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 pointer-events-none">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              <p className="text-slate-300 text-sm font-semibold">
                Connecting to live class…
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Room: <span className="font-mono">{meeting.roomName}</span>
              </p>
              <p className="text-slate-600 text-[10px] mt-3">
                Please allow camera &amp; mic access when your browser asks.
              </p>
            </div>
          </div>
        )}

        {/* Timeout / load error hint */}
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6">
            <div className="max-w-md text-center bg-slate-900 border border-amber-500/30 rounded-2xl p-6">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-amber-300 font-bold text-sm mb-2">
                Taking longer than expected
              </p>
              <p className="text-slate-400 text-xs mb-4">
                The live class is still connecting. If your browser didn&apos;t ask for
                camera/mic permission, the page might be blocking it.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href={jitsiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl inline-flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" /> Open class in a new tab
                </a>
                <button
                  onClick={onLeave}
                  className="px-4 py-2 border border-slate-700 text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-800"
                >
                  Go back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint bar */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 shrink-0">
        <p className="text-center text-[11px] text-slate-500">
          Use the buttons inside the video player to mute mic, turn off camera, share screen,
          or leave the call.{' '}
          <button onClick={onLeave} className="text-red-400 hover:underline font-semibold">
            Leave call
          </button>
        </p>
      </div>
    </div>
  );
};

// ============================================================================
//  Main LiveClasses component
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
  const [activeCall, setActiveCall] = useState<LiveMeeting | null>(null);

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

  const refresh = useCallback(() => {
    setMeetings(getMeetings());
    setBatches(getBatchesSafe());
    setStudentCount(getStudentsSafe().length);
  }, []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('apex_storage_updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('apex_storage_updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  const displayName = isAdmin
    ? 'Mr. Subhamoy Mondal (Teacher)'
    : student?.name || 'Student';

  const classOptions = useMemo(() => {
    const fromBatches = batches.map((b) => b.className).filter(Boolean);
    const merged = Array.from(new Set([...FALLBACK_CLASSES, ...fromBatches]));
    return merged.sort();
  }, [batches]);

  const countStudentsFor = useCallback(
    (
      scope: 'batch' | 'class' | 'all',
      batchId?: string,
      className?: string
    ): number => {
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

    const updated = [meeting, ...getMeetings()];
    saveMeetings(updated);
    setMeetings(updated);
    setShowStart(false);
    setForm({ scope: 'class', batchId: '', className: 'Class 12', title: '' });

    setActiveCall(meeting);
  };

  const handleEndMeeting = (id: string) => {
    const ok = window.confirm(
      'End this live class?\n\nStudents will no longer be able to join from the website.'
    );
    if (!ok) return;
    const updated = getMeetings().map((m) =>
      m.id === id ? { ...m, active: false, endedAt: Date.now() } : m
    );
    saveMeetings(updated);
    setMeetings(updated);
  };

  const handleDeleteMeeting = (id: string) => {
    if (!window.confirm('Delete this meeting record? This cannot be undone.')) return;
    const updated = getMeetings().filter((m) => m.id !== id);
    saveMeetings(updated);
    setMeetings(updated);
  };

  const handleCopyLink = (meeting: LiveMeeting) => {
    const url = `https://${JITSI_DOMAIN}/${sanitizeRoomName(meeting.roomName)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => window.alert('Live class link copied!\n\n' + url),
        () => window.alert('Link: ' + url)
      );
    } else {
      window.alert('Link: ' + url);
    }
  };

  const visibleMeetings = isAdmin
    ? meetings
    : meetings.filter((m) => (student ? canStudentSee(m, student) : false));

  const activeMeetings = visibleMeetings.filter((m) => m.active);
  const endedMeetings = visibleMeetings.filter((m) => !m.active);

  const sortedActive = [...activeMeetings].sort(
    (a, b) => b.startedAt - a.startedAt
  );
  const sortedEnded = [...endedMeetings].sort(
    (a, b) => (b.endedAt || 0) - (a.endedAt || 0)
  );

  if (activeCall) {
    return (
      <CallOverlay
        meeting={activeCall}
        displayName={displayName}
        onLeave={() => setActiveCall(null)}
      />
    );
  }

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
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Batch-restricted.</strong> Only students in the selected batch or class can
          see and join the meeting. Each class gets a unique, unguessable Jitsi room. Free,
          unlimited, no signup — just allow camera &amp; mic access when your browser asks.
        </p>
      </div>

      {/* Student: no active meetings */}
      {!isAdmin && sortedActive.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No live classes right now</p>
          <p className="text-slate-400 text-sm mt-1">
            When your teacher starts a class for your batch, it will appear here automatically.
          </p>
        </div>
      )}

      {/* Active (LIVE NOW) meetings */}
      {sortedActive.length > 0 && (
        <div className="space-y-4">
          {sortedActive.map((m) => (
            <div
              key={m.id}
              className={`bg-white border-2 rounded-2xl p-5 ${
                isAdmin ? 'border-red-200' : 'border-red-300'
              } ring-4 ring-red-50`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                      <Radio className="w-3 h-3 animate-pulse" /> Live Now
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      {meetingAudienceLabel(m)}
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
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveCall(m)}
                    className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-colors"
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
              {!isAdmin && (
                <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> You will join as{' '}
                  <strong>{displayName}</strong>
                </p>
              )}
            </div>
          ))}
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
    </div>
  );
};

export default LiveClasses;
