import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Role, Student } from '../types';
import {
  Video, VideoOff, Mic, MicOff, Plus, Trash2, Calendar,
  Users, Copy, X, Circle, Radio, Clock, Play
} from 'lucide-react';

/* ============================================================================
 *  THE APEX WORLD — Live Classes (Jitsi Meet embed)
 * ----------------------------------------------------------------------------
 *  100% FREE • No API key • No time limit • No signup
 *  Uses the public `meet.jit.si` infrastructure via the official
 *  Jitsi Meet External API (iframe-based).
 *
 *  This file is SELF-CONTAINED — it does not depend on any other file.
 * ========================================================================== */

// ---------- Types ----------
interface LiveClass {
  id: string;
  title: string;
  batch: string;
  teacherName: string;
  scheduledAt: number;
  durationMins: number;
  roomName: string;
  createdAt: number;
}

interface JitsiMeetExternalAPIInstance {
  dispose: () => void;
  executeCommand: (command: string, value?: unknown) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface JitsiMeetExternalAPIConstructor {
  new (options: {
    roomName: string;
    parentNode: HTMLElement;
    configOverwrite?: Record<string, unknown>;
    interfaceConfigOverwrite?: Record<string, unknown>;
    userInfo?: { displayName: string; avatarUrl?: string };
  }): JitsiMeetExternalAPIInstance;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiMeetExternalAPIConstructor;
  }
}

// ---------- Constants ----------
const JITSI_DOMAIN = 'meet.jit.si';
const JITSI_API_URL = `https://${JITSI_DOMAIN}/external_api.js`;
const STORAGE_KEY = 'apex_live_classes';

// ---------- Jitsi script loader (loads once, globally) ----------
let jitsiApiPromise: Promise<JitsiMeetExternalAPIConstructor> | null = null;

function loadJitsiApi(): Promise<JitsiMeetExternalAPIConstructor> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Jitsi can only run in the browser'));
  }
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }
  if (jitsiApiPromise) return jitsiApiPromise;

  jitsiApiPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('jitsi-external-api') as HTMLScriptElement | null;
    if (existing) {
      if (window.JitsiMeetExternalAPI) { resolve(window.JitsiMeetExternalAPI); return; }
      existing.addEventListener('load', () => {
        if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
        else reject(new Error('Jitsi API script failed to initialise'));
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load Jitsi API')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'jitsi-external-api';
    script.src = JITSI_API_URL;
    script.async = true;
    script.onload = () => {
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
      else reject(new Error('Jitsi API script loaded but constructor not found'));
    };
    script.onerror = () => reject(new Error('Failed to load Jitsi API script'));
    document.head.appendChild(script);
  });
  return jitsiApiPromise;
}

function sanitizeRoomName(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------- Storage helpers (self-contained) ----------
function getLiveClasses(): LiveClass[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLiveClasses(classes: LiveClass[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_storage_updated'));
  }
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// "Live now" window: 5 min before start until duration + 30 min grace.
function isLiveNow(cls: LiveClass): boolean {
  const now = Date.now();
  const start = cls.scheduledAt;
  const end = start + cls.durationMins * 60 * 1000;
  return now >= start - 5 * 60 * 1000 && now <= end + 30 * 60 * 1000;
}

// ============================================================================
//  Embedded call overlay — mounts the Jitsi iframe full-screen
// ============================================================================
interface CallOverlayProps {
  cls: LiveClass;
  displayName: string;
  onLeave: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ cls, displayName, onLeave }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiMeetExternalAPIInstance | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMsg, setErrMsg] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    let disposed = false;
    setStatus('connecting');

    loadJitsiApi()
      .then((JitsiMeetExternalAPI) => {
        if (disposed || !containerRef.current) return;
        const api = new JitsiMeetExternalAPI({
          roomName: cls.roomName,
          parentNode: containerRef.current,
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableInviteFunctions: false,
            subject: cls.title,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection',
              'hangup', 'chat', 'settings', 'raisehand', 'videoquality',
              'filmstrip', 'shortcuts', 'tileview', 'mute-everyone', 'mute-video-everyone'
            ],
          },
          userInfo: { displayName },
        });
        apiRef.current = api;

        api.on('videoConferenceJoined', () => setStatus('connected'));
        api.on('videoConferenceLeft', () => { if (!disposed) onLeave(); });
        api.on('readyToClose', () => { if (!disposed) onLeave(); });
        api.on('audioMuteStatusChanged', (e: unknown) => {
          const m = (e as { muted?: boolean })?.muted;
          if (typeof m === 'boolean') setMuted(m);
        });
        api.on('videoMuteStatusChanged', (e: unknown) => {
          const off = (e as { muted?: boolean })?.muted;
          if (typeof off === 'boolean') setVideoOff(off);
        });
      })
      .catch((err) => {
        if (disposed) return;
        setErrMsg(err instanceof Error ? err.message : 'Failed to load Jitsi');
        setStatus('error');
      });

    return () => {
      disposed = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    try { apiRef.current?.executeCommand('toggleAudio'); } catch { /* noop */ }
  };
  const toggleVideo = () => {
    try { apiRef.current?.executeCommand('toggleVideo'); } catch { /* noop */ }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {status === 'connected' ? (
            <span className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
              <Radio className="w-4 h-4 animate-pulse" /> LIVE
            </span>
          ) : status === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
              <Circle className="w-3 h-3 fill-amber-400" /> Connecting…
            </span>
          ) : (
            <span className="text-red-400 text-xs font-bold">Error</span>
          )}
          <span className="text-white font-bold text-sm truncate">{cls.title}</span>
          <span className="text-slate-500 text-xs hidden sm:inline">· {cls.batch}</span>
        </div>
        <button
          onClick={onLeave}
          className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" /> Leave
        </button>
      </div>

      {/* Jitsi iframe container */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="absolute inset-0" aria-label="Live class video call" />

        {status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 pointer-events-none">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              <p className="text-slate-300 text-sm font-semibold">Connecting to live class…</p>
              <p className="text-slate-500 text-xs mt-1">Room: <span className="font-mono">{cls.roomName}</span></p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6">
            <div className="max-w-md text-center bg-slate-900 border border-red-500/30 rounded-2xl p-6">
              <p className="text-red-400 font-bold text-sm mb-2">Couldn't start the live class</p>
              <p className="text-slate-400 text-xs mb-4">{errorMsg}</p>
              <p className="text-slate-500 text-xs">
                Check your internet connection and make sure{' '}
                <span className="font-mono text-slate-300">{JITSI_DOMAIN}</span> is reachable, then try again.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls (only when connected) */}
      {status === 'connected' && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 border-t border-slate-800 shrink-0">
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              muted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
            title={muted ? 'Unmute mic' : 'Mute mic'}
          >
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              videoOff ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
            title={videoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
          <button
            onClick={onLeave}
            className="px-6 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold text-sm flex items-center gap-2 transition-colors"
          >
            <X className="w-5 h-5" /> Leave Call
          </button>
        </div>
      )}
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
  const [classes, setClasses] = useState<LiveClass[]>(() => getLiveClasses());
  const [showCreate, setShowCreate] = useState(false);
  const [activeCall, setActiveCall] = useState<LiveClass | null>(null);

  const [form, setForm] = useState({
    title: '',
    batch: 'All Batches',
    date: '',
    time: '',
    durationMins: 60,
  });

  const refresh = useCallback(() => setClasses(getLiveClasses()), []);
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
    : (student?.name || 'Student');

  const handleCreate = () => {
    if (!form.title.trim() || !form.date || !form.time) return;
    const dt = new Date(`${form.date}T${form.time}`);
    if (isNaN(dt.getTime())) return;

    const id = 'live-' + Date.now().toString(36);
    const roomBase = `ApexWorld_${id}`;
    const cls: LiveClass = {
      id,
      title: form.title.trim(),
      batch: form.batch.trim() || 'All Batches',
      teacherName: 'Mr. Subhamoy Mondal',
      scheduledAt: dt.getTime(),
      durationMins: Math.max(15, Math.min(240, Number(form.durationMins) || 60)),
      roomName: sanitizeRoomName(roomBase),
      createdAt: Date.now(),
    };
    const updated = [cls, ...getLiveClasses()];
    saveLiveClasses(updated);
    setClasses(updated);
    setShowCreate(false);
    setForm({ title: '', batch: 'All Batches', date: '', time: '', durationMins: 60 });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this live class? Students will no longer see it.')) return;
    const updated = getLiveClasses().filter(c => c.id !== id);
    saveLiveClasses(updated);
    setClasses(updated);
  };

  const handleCopyLink = (cls: LiveClass) => {
    const url = `https://${JITSI_DOMAIN}/${cls.roomName}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => alert('Live class link copied!\n\n' + url),
        () => alert('Link: ' + url)
      );
    } else {
      alert('Link: ' + url);
    }
  };

  const now = Date.now();
  const sorted = [...classes].sort((a, b) => {
    const aLive = isLiveNow(a) ? 1 : 0;
    const bLive = isLiveNow(b) ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    const aUpcoming = a.scheduledAt > now ? 1 : 0;
    const bUpcoming = b.scheduledAt > now ? 1 : 0;
    if (aUpcoming && bUpcoming) return a.scheduledAt - b.scheduledAt;
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    return b.scheduledAt - a.scheduledAt;
  });

  if (activeCall) {
    return (
      <CallOverlay
        cls={activeCall}
        displayName={displayName}
        onLeave={() => setActiveCall(null)}
      />
    );
  }

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
              ? 'Schedule and start live video classes for your students.'
              : 'Join live video classes hosted by your teacher.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Schedule New Class
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Circle className="w-3 h-3 text-amber-500 fill-amber-500 mt-1 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Free &amp; unlimited.</strong> Live classes run on the open-source Jitsi Meet platform —
          no API key, no time limit, no installation. Just click <strong>Join</strong> and allow
          camera/mic access when your browser asks.
        </p>
      </div>

      {/* Class list */}
      {sorted.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No live classes scheduled yet</p>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin
              ? 'Click "Schedule New Class" to create one.'
              : 'Check back soon — your teacher will schedule classes here.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(cls => {
            const live = isLiveNow(cls);
            const upcoming = cls.scheduledAt > now;
            return (
              <div
                key={cls.id}
                className={`bg-white border rounded-2xl p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${
                  live ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  {live ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-black rounded-full uppercase tracking-wide">
                      <Radio className="w-3 h-3 animate-pulse" /> Live Now
                    </span>
                  ) : upcoming ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wide">
                      <Clock className="w-3 h-3" /> Upcoming
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-wide">
                      <Circle className="w-2.5 h-2.5" /> Ended
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-black text-slate-900 leading-tight">{cls.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {cls.batch}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {formatDateTime(cls.scheduledAt)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {cls.durationMins} minutes
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-auto pt-2">
                  <button
                    onClick={() => setActiveCall(cls)}
                    disabled={!live && !upcoming}
                    className={`flex-1 px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                      live
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : upcoming
                        ? 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4" /> {live ? 'Join Now' : upcoming ? 'Join Early' : 'Ended'}
                  </button>
                  <button
                    onClick={() => handleCopyLink(cls)}
                    title="Copy shareable link"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(cls.id)}
                      title="Delete class"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" /> Schedule Live Class
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Class Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Mole Concept — Doubt Clearing"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Batch</label>
                <select
                  value={form.batch}
                  onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option>All Batches</option>
                  <option>Batch A</option>
                  <option>Batch B</option>
                  <option>Batch C</option>
                  <option>Class 11</option>
                  <option>Class 12</option>
                  <option>NEET Droppers</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Time *</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Duration (minutes)</label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={15}
                  value={form.durationMins}
                  onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.title.trim() || !form.date || !form.time}
                className="flex-1 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-bold text-sm rounded-xl transition-colors"
              >
                Schedule Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveClasses;
