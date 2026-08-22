/**
 * ============================================================================
 *  LiveClasses.tsx — Google Meet & Multi-Platform Live Classes
 * ----------------------------------------------------------------------------
 *  Features:
 *    1. Google Meet Integration with Instant Meet, Custom Links & Calendar scheduling.
 *    2. Automatic Student Name Configuration per Registration Details.
 *    3. In-App WebRTC options.
 *    4. Real-time Firestore synchronization across all devices.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from"react";
import {
  Video, Trash2, X, Radio, Play, ExternalLink, Clock,
  CheckCircle2, Wifi, WifiOff, Info, Users, History,
  Copy, Calendar, Sparkles, UserCheck, Link as LinkIcon, Share2
} from"lucide-react";
import {
  subscribeToAllMeetings,
  startMeeting as fbStartMeeting,
  endMeeting as fbEndMeeting,
  deleteMeeting as fbDeleteMeeting, updateMeeting as fbUpdateMeeting,
  type LiveMeeting,
} from"../lib/firebaseSync";
import { StorageService } from"../lib/storage";
import type { Batch } from"../types";
import { MeetingDialog } from"./MeetingRoom";

export type Role ="admin" |"student";

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

// ── Google Meet & Calendar Helpers ─────────────────────────────────────────

function buildGoogleMeetUrl(roomName: string, customUrl?: string): string {
  if (customUrl && customUrl.trim().startsWith("http")) {
    return customUrl.trim();
  }
  // Standard instant Google Meet endpoint
  return"https://meet.google.com/new";
}



function generateGoogleCalendarUrl(title: string, durationMins: number, details: string): string {
  const now = new Date();
  const startTime = now.toISOString().replace(/-|:|\.\d\d\d/g,"");
  const endTime = new Date(now.getTime()+ durationMins * 60000).toISOString().replace(/-|:|\.\d\d\d/g,"");
  const encTitle = encodeURIComponent(`Live Class: ${title} — The Apex Chemistry`);
  const encDetails = encodeURIComponent(`${details}\n\nJoin live class on The Apex Chemistry Portal.`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encTitle}&dates=${startTime}/${endTime}&details=${encDetails}&add=meet`;
}

function generateRoomName(title: string): string {
  const slug = (title ||"class").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0, 24) ||"class";
  const rand = Math.random().toString(36).slice(2, 10);
  return `ApexWorld_${slug}_${rand}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return"just now";
  if (mins === 1) return"1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return"1 hour ago";
  return `${hrs} hours ago`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
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
  const isStudent = role ==="student";

  const [meetings, setMeetings] = useState<LiveMeeting[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Firestore Subscription
  useEffect(() => {
    const unsub = subscribeToAllMeetings(
      (next) => { setMeetings(next); setConnected(true); setSyncError(null); },
      (err) => { setConnected(false); setSyncError(err.message ||"Failed to sync with Firestore."); }
    );
    return () => unsub();
  }, []);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load Real Batches
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

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    batches.forEach((b) => { if (b.className) set.add(b.className); });
    return Array.from(set).sort();
  }, [batches]);

  // Form State
  const [title, setTitle] = useState("");
  const [teacherName, setTeacherName] = useState("Mr. Subhamoy Mondal");
  const [platform, setPlatform] = useState<"webrtc">("webrtc");
  const [customMeetUrl, setCustomMeetUrl] = useState("");
  const [scope, setScope] = useState<"batch" |"class" |"all">("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [duration, setDuration] = useState(60);
  const [starting, setStarting] = useState(false);
  const [joinMeeting, setJoinMeeting] = useState<LiveMeeting | null>(null);
  const [showWebRTCModal, setShowWebRTCModal] = useState<LiveMeeting | null>(null);

  // Scheduling State
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [tick, setTick] = useState(0);

  // Real-time ticking updates (for smooth live countdowns)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scope ==="batch") {
      if (!selectedBatchId && batches.length > 0) setSelectedBatchId(batches[0].id);
    } else if (scope ==="class") {
      if (!selectedClassName && classOptions.length > 0) setSelectedClassName(classOptions[0]);
    }
  }, [scope, batches, classOptions, selectedBatchId, selectedClassName]);

  const handleStartMeeting = useCallback(async () => {
    if (!title.trim()) return;
    if (scope ==="batch" && !selectedBatchId) { setSyncError("Please pick a batch."); return; }
    if (scope ==="class" && !selectedClassName) { setSyncError("Please pick a class."); return; }
    if (isScheduling && !scheduleTime) { setSyncError("Please select a scheduled start time."); return; }

    setStarting(true);
    try {
      const roomName = generateRoomName(title);
      const chosenBatch = scope ==="batch" ? batches.find((b) => b.id === selectedBatchId) : undefined;
      const finalMeetUrl = platform ==="google_meet" 
        ? (customMeetUrl.trim() || buildGoogleMeetUrl(roomName))
        : null;

      const meetingTime = isScheduling ? new Date(scheduleTime).getTime() : Date.now();

      const meeting: LiveMeeting = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(),
        scope,
        batchId: scope ==="batch" ? (chosenBatch?.id || selectedBatchId || null) : null,
        batchTitle: scope ==="batch" ? (chosenBatch?.title || null) : null,
        className: scope ==="class" ? (selectedClassName || null) : null,
        teacherName: teacherName.trim() ||"Mr. Subhamoy Mondal",
        roomName,
        startedAt: meetingTime,
        durationMins: duration,
        active: !isScheduling,
        endedAt: null,
        createdAt: Date.now(),
        platform,
        meetUrl: finalMeetUrl,
        autoNameConfig: true,
        isScheduled: isScheduling,
        scheduledAt: isScheduling ? meetingTime : null
      };

      // Auto-launch Google Meet if configured
      if (!isScheduling && platform === "webrtc") {
        setShowWebRTCModal(meeting);
      }

      await fbStartMeeting(meeting);
      setTitle("");
      setCustomMeetUrl("");
      setScheduleTime("");
      setIsScheduling(false);
      setToastMessage(isScheduling ? "Live class scheduled successfully!" : "Live class launched successfully!");
    } catch (err) {
      console.error("[LiveClasses] startMeeting failed:", err);
      setSyncError(err instanceof Error ? err.message :"Failed to start meeting.");
    } finally {
      setStarting(false);
    }
  }, [title, teacherName, scope, duration, selectedBatchId, selectedClassName, batches, platform, customMeetUrl, isScheduling, scheduleTime]);

  const handleStartScheduledEarly = useCallback(async (meeting: LiveMeeting) => {
    try {
      const updated = {
        ...meeting,
        active: true,
        startedAt: Date.now()
      };
      await fbUpdateMeeting(updated);
      setShowWebRTCModal(updated);
      setToastMessage("Scheduled class started early!");
    } catch (err) {
      console.error("[LiveClasses] startScheduledEarly failed:", err);
    }
  }, []);

  const handleEndMeeting = useCallback(async (id: string) => {
    try { 
      await fbEndMeeting(id);
      setToastMessage("Live class ended and saved to history.");
    } catch (err) { console.error("[LiveClasses] endMeeting failed:", err); }
  }, []);

  const handleDeleteMeeting = useCallback(async (id: string) => {
    try { 
      await fbDeleteMeeting(id);
      setToastMessage("Class record deleted.");
    } catch (err) { console.error("[LiveClasses] deleteMeeting failed:", err); }
  }, []);

  // Dynamically treat scheduled meetings whose scheduled time has arrived as active
  const activeMeetings = useMemo(() => {
    return meetings.filter((m) => m.active || (m.isScheduled && m.scheduledAt && Date.now() >= m.scheduledAt && !m.endedAt));
  }, [meetings, tick]);

  const scheduledMeetings = useMemo(() => {
    return meetings.filter((m) => m.isScheduled && m.scheduledAt && Date.now() < m.scheduledAt && !m.active && !m.endedAt);
  }, [meetings, tick]);

  const pastMeetings = useMemo(() => {
    return meetings.filter((m) => !m.active && !(m.isScheduled && m.scheduledAt && Date.now() < m.scheduledAt));
  }, [meetings, tick]);

  const visibleActive = useMemo(() => {
    if (!isStudent || !student) return activeMeetings;
    return activeMeetings.filter((m) => {
      if (m.scope ==="all") return true;
      if (m.scope ==="class") return m.className === student.className;
      if (m.scope ==="batch") return m.batchId === student.batchId;
      return true;
    });
  }, [activeMeetings, isStudent, student]);

  const visibleScheduled = useMemo(() => {
    if (!isStudent || !student) return scheduledMeetings;
    return scheduledMeetings.filter((m) => {
      if (m.scope ==="all") return true;
      if (m.scope ==="class") return m.className === student.className;
      if (m.scope ==="batch") return m.batchId === student.batchId;
      return true;
    });
  }, [scheduledMeetings, isStudent, student]);

  const visiblePast = useMemo(() => {
    if (!isStudent || !student) return pastMeetings;
    return pastMeetings.filter((m) => {
      if (m.scope ==="all") return true;
      if (m.scope ==="class") return m.className === student.className;
      if (m.scope ==="batch") return m.batchId === student.batchId;
      return true;
    });
  }, [pastMeetings, isStudent, student]);

  // Student details for auto-configuration
  const studentRegisteredName = student?.name ||"Student";
  const studentRegisteredClass = student?.className ||"General Class";
  const studentRegisteredBatch = student?.batchTitle ||"Main Batch";

  // ===== ADMIN RENDER =====
  if (!isStudent) {
    return (
      <div className="space-y-6">
        <SyncStatusBar connected={connected} error={syncError} count={activeMeetings.length} />

        {toastMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm animate-fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Manage Live Classes</h3>
                <p className="text-xs text-slate-500">Launch instant meetings or schedule classes</p>
              </div>
            </div>

            {/* Premium Tab Bar inside the Start Class Card */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setIsScheduling(false)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  !isScheduling
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Instant Live
              </button>
              <button
                type="button"
                onClick={() => setIsScheduling(true)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  isScheduling
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Schedule Class
              </button>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class topic / title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Organic Chemistry — Reaction Mechanisms" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher name</label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="e.g. Mr. Subhamoy Mondal" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target Audience</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "batch" | "class" | "all")} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                <option value="all">All enrolled students</option>
                <option value="class">Specific class grade</option>
                <option value="batch">Specific batch</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {scope === "batch" ? "Select batch" : scope === "class" ? "Select class" : "Duration"}
              </label>
              {scope === "batch" ? (
                batches.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No batches found.</p>
                ) : (
                  <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.title}</option>))}
                  </select>
                )
              ) : scope === "class" ? (
                classOptions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No classes found.</p>
                ) : (
                  <select value={selectedClassName} onChange={(e) => setSelectedClassName(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {classOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" min={15} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  <span className="text-xs text-slate-500">minutes</span>
                </div>
              )}
            </div>

            {isScheduling && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
            )}
          </div>
          
          <div className="mt-5 border-t border-slate-200 pt-5">
            <button
              onClick={handleStartMeeting}
              disabled={starting}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm shadow-amber-400/20"
            >
              {starting ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />Processing…</>
              ) : isScheduling ? (
                <><Calendar className="h-4 w-4" /> Schedule Live Class (WebRTC)</>
              ) : (
                <><Play className="h-4 w-4 fill-current" /> Start Live Class (WebRTC)</>
              )}
            </button>
          </div>
        </div>

        {/* Scheduled classes list for admin */}
        {scheduledMeetings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Scheduled Upcoming Classes ({scheduledMeetings.length})</h3>
            </div>
            <div className="space-y-3">
              {scheduledMeetings.map((m) => (
                <AdminScheduledMeetingCard
                  key={m.id}
                  meeting={m}
                  onStart={() => handleStartScheduledEarly(m)}
                  onDelete={() => handleDeleteMeeting(m.id)}
                  tick={tick}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Active Live Classes ({activeMeetings.length})</h3>
          </div>
          {activeMeetings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Video className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-500">No active classes. Launch one above and students will see it instantly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMeetings.map((m) => (
                <AdminMeetingCard
                  key={m.id}
                  meeting={m}
                  onEnd={() => handleEndMeeting(m.id)}
                  onDelete={() => handleDeleteMeeting(m.id)}
                  onRejoin={() => setShowWebRTCModal(m)}
                />
              ))}
            </div>
          )}
        </div>

        {pastMeetings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Recent Class History ({pastMeetings.length})</h3>
            </div>
            <div className="space-y-2">
              {pastMeetings.map((m) => (<PastMeetingCard key={m.id} meeting={m} isAdmin onDelete={() => handleDeleteMeeting(m.id)} onUpdate={fbUpdateMeeting} />))}
            </div>
          </div>
        )}

        {showWebRTCModal && (() => {
          const currentMeeting = meetings.find((m) => m.id === showWebRTCModal.id) || showWebRTCModal;
          return (
            <MeetingDialog
              meeting={currentMeeting}
              role="admin"
              displayName={teacherName || "Mr. Subhamoy Mondal"}
              meetingActive={currentMeeting.active || (currentMeeting.isScheduled && currentMeeting.scheduledAt && Date.now() >= currentMeeting.scheduledAt)}
              onClose={() => setShowWebRTCModal(null)}
              onEndMeeting={(id) => {
                handleEndMeeting(id);
              }}
            />
          );
        })()}
      </div>
    );
  }

  // ===== STUDENT RENDER =====
  return (
    <div className="space-y-6">
      <SyncStatusBar connected={connected} error={syncError} count={visibleActive.length} />
      
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          {toastMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              {studentRegisteredClass} · {studentRegisteredBatch}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Welcome, {studentRegisteredName} 👋
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Your registered student identity is auto-configured for all Live Classes.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-800">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            Auto-Name Configured
          </div>
        </div>
      </div>

      {/* Live Now list for Student */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Live Now ({visibleActive.length})</h3>
        </div>
        
        {visibleActive.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Video className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">No live classes running right now.</p>
            <p className="text-xs text-slate-500 mt-1">When a teacher starts a class for your batch, it will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleActive.map((m) => (
              <StudentMeetingCard
                key={m.id}
                meeting={m}
                studentName={studentRegisteredName}
                studentClass={studentRegisteredClass}
                onJoin={() => setShowWebRTCModal(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scheduled Classes list for Student */}
      {visibleScheduled.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Scheduled Upcoming Classes ({visibleScheduled.length})</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleScheduled.map((m) => (
              <StudentScheduledMeetingCard
                key={m.id}
                meeting={m}
                tick={tick}
              />
            ))}
          </div>
        </div>
      )}

      {visiblePast.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Recent Classes ({visiblePast.length})</h3>
          </div>
          <div className="space-y-2">
            {visiblePast.map((m) => (<PastMeetingCard key={m.id} meeting={m} />))}
          </div>
        </div>
      )}

      {showWebRTCModal && (() => {
        const currentMeeting = meetings.find((m) => m.id === showWebRTCModal.id) || showWebRTCModal;
        return (
          <MeetingDialog
            meeting={currentMeeting}
            role="student"
            displayName={studentRegisteredName}
            meetingActive={currentMeeting.active || (currentMeeting.isScheduled && currentMeeting.scheduledAt && Date.now() >= currentMeeting.scheduledAt)}
            onClose={() => setShowWebRTCModal(null)}
            onEndMeeting={() => setShowWebRTCModal(null)}
          />
        );
      })()}
    </div>
  );
}
// ===== Sub-components =====

function SyncStatusBar({ connected, error, count }: { connected: boolean; error: string | null; count: number }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium ${
      error 
        ?"border-red-200 bg-red-50 text-red-700" 
        : connected 
          ?"border-emerald-200 bg-emerald-50 text-emerald-800" 
          :"border-amber-200 bg-amber-50 text-amber-800"
    }`}>
      <div className="flex items-center gap-2 font-semibold">
        {error ? (<><WifiOff className="h-3.5 w-3.5 text-red-500" /> Real-time sync error</>) : connected ? (<><Wifi className="h-3.5 w-3.5 text-emerald-600" /> Firestore Live Sync Connected</>) : (<><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Connecting to cloud…</>)}
      </div>
      <span className="font-mono text-[11px]">{error ?"Check connection" : `${count} live class${count === 1 ? '' : 'es'}`}</span>
    </div>
  );
}

function AdminMeetingCard({ meeting, onEnd, onDelete, onRejoin }: { meeting: LiveMeeting; onEnd: () => void; onDelete: () => void; onRejoin: () => void; key?: React.Key }) {
  const scopeLabel = meeting.scope ==="all" ?"All students" : meeting.scope ==="class" ? meeting.className : meeting.batchTitle;
  const isMeet = false;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-red-600">LIVE NOW</span>
            
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
              "bg-amber-100 text-amber-800"
            }`}>
              {"WebRTC"}
            </span>

            <span className="text-xs text-slate-500">· started {timeAgo(meeting.startedAt)}</span>
          </div>
          <h4 className="text-base font-bold text-slate-900 truncate">{meeting.title}</h4>
          <p className="mt-0.5 text-xs text-slate-600">{meeting.teacherName} · {scopeLabel}</p>
          <p className="mt-1 text-[11px] text-slate-500">Started {formatTime(meeting.startedAt)} · {meeting.durationMins} min</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={onRejoin} title="Open live meeting room" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm">
            <ExternalLink className="h-3.5 w-3.5" /> Open Room
          </button>
          <button onClick={onEnd} title="End meeting (moves to history)" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300">
            End
          </button>
          <button onClick={onDelete} title="Delete record" className="inline-flex items-center justify-center rounded-xl bg-red-100 p-2 text-red-600 transition hover:bg-red-200">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentMeetingCard({ meeting, studentName, studentClass, onJoin }: { meeting: LiveMeeting; studentName: string; studentClass?: string; onJoin: () => void; key?: React.Key }) {
  const isMeet = false;

  return (
    <div className="rounded-2xl border-2 border-emerald-400 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 items-center justify-center">
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-red-600">LIVE CLASS NOW</span>
          <span className="text-xs text-slate-500">· started {timeAgo(meeting.startedAt)}</span>
        </div>

        <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
          isMeet 
            ?"bg-emerald-100 text-emerald-800" 
            :"bg-amber-100 text-amber-800"
        }`}>
          {isMeet ?"Google Meet" : "In-App Video"}
        </span>
      </div>

      <h4 className="text-lg font-extrabold text-slate-900">{meeting.title}</h4>
      <p className="mt-1 text-sm text-slate-600">Teacher: <span className="font-semibold text-slate-900">{meeting.teacherName}</span></p>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> {formatTime(meeting.startedAt)} ({meeting.durationMins} min)</span>
        {meeting.scope !=="all" && (<span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-amber-500" />{meeting.scope ==="class" ? meeting.className : meeting.batchTitle}</span>)}
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><UserCheck className="h-3.5 w-3.5" /> Joining as: {studentName}</span>
      </div>

      <button onClick={onJoin} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition shadow-sm">
        <Play className="h-4 w-4 fill-current" /> Join {isMeet ?"Google Meet" :"Class"} (Auto Name Configured)
      </button>
    </div>
  );
}


function RecordingPlayerModal({ meeting, onClose }: { meeting: LiveMeeting; onClose: () => void }) {
  const rawUrl = (meeting.recordingUrl || '').trim();
  const isNativeVideo = Boolean(rawUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i));
  
  let embedUrl = rawUrl;
  if (rawUrl) {
    if (rawUrl.includes('youtube.com/watch?v=')) {
      const videoId = rawUrl.split('watch?v=')[1]?.split('&')[0];
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
      }
    } else if (rawUrl.includes('youtu.be/')) {
      const videoId = rawUrl.split('youtu.be/')[1]?.split('?')[0];
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
      }
    } else if (rawUrl.includes('loom.com/share/')) {
      const loomId = rawUrl.split('loom.com/share/')[1]?.split('?')[0];
      if (loomId) {
        embedUrl = `https://www.loom.com/embed/${loomId}?autoplay=1`;
      }
    } else if (!isNativeVideo && rawUrl.includes('drive.google.com')) {
      if (rawUrl.includes('/view')) {
        embedUrl = rawUrl.replace(/\/view(\?.*)?$/, '/preview');
      } else if (rawUrl.includes('/file/d/')) {
        const fileId = rawUrl.split('/file/d/')[1]?.split('/')[0];
        if (fileId) {
          embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }
    }
  }

  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl rounded-2xl sm:rounded-3xl bg-slate-950 shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[95vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unified Single Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5 bg-slate-900/95 border-b border-slate-800/80 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center justify-center shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-base font-bold text-white tracking-tight truncate">
                {meeting.title}
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Class Recording • {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(meeting.startedAt)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {meeting.recordingUrl && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(meeting.recordingUrl!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all bg-slate-900 border border-slate-700/60"
                  title="Copy video URL"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
                <a 
                  href={meeting.recordingUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  title="Open video in new tab"
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:bg-indigo-600/20 hover:text-indigo-200 transition-all bg-indigo-600/10 border border-indigo-500/30 min-h-[36px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Open in Tab</span>
                </a>
              </>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="inline-flex items-center justify-center rounded-lg h-9 w-9 text-slate-400 hover:bg-slate-800 hover:text-white transition-all bg-slate-900 border border-slate-700/60 min-h-[36px] min-w-[36px]"
              title="Close player"
              aria-label="Close player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Single Video Stage with Aspect Ratio to avoid duplicate scrollbars/stacked panels on mobile */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {embedUrl ? (
            isNativeVideo ? (
              <video 
                src={embedUrl}
                controls
                controlsList="nodownload"
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                preload="metadata"
              />
            ) : (
              <iframe 
                src={embedUrl}
                title={meeting.title || "Class Recording"}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-950">
              <Video className="w-10 h-10 mb-3 text-slate-700 animate-pulse" />
              <p className="font-bold text-sm text-slate-300">No valid recording URL provided</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Please provide a valid YouTube, Google Drive, Loom, or direct video link to enable playback.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PastMeetingCard({ meeting, isAdmin = false, onDelete, onUpdate }: { meeting: LiveMeeting; isAdmin?: boolean; onDelete?: () => void; onUpdate?: (m: LiveMeeting) => void; key?: React.Key }) {
  const scopeLabel = meeting.scope === "all" ? "All students" : meeting.scope === "class" ? meeting.className : meeting.batchTitle;
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(meeting.recordingUrl || "");
  const [showPlayer, setShowPlayer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setUrlInput(meeting.recordingUrl || "");
  }, [meeting.recordingUrl]);

  const handleSaveRecording = async () => {
    if (!urlInput.trim()) return;
    setIsSaving(true);
    try {
      if (onUpdate) {
        await onUpdate({ ...meeting, recordingUrl: urlInput.trim() });
      }
      setShowAddUrl(false);
    } catch (err) {
      console.error("Failed to save recording URL:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(meeting.startedAt);
  const startTime = formatTime(meeting.startedAt);
  const endTime = meeting.endedAt ? formatTime(meeting.endedAt) : "N/A";

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-indigo-400 transition-all flex flex-col justify-between group relative">
      {isAdmin && onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-2 rounded-xl bg-red-50 text-red-500 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-100"
          title="Delete History Record"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 pr-8 sm:pr-0">
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200 uppercase">
            Live Class History
          </span>
          <span className="text-[10px] font-mono font-medium text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {formattedDate}
          </span>
        </div>

        <div>
          <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-indigo-600 shrink-0" />
            {meeting.title}
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              {startTime} — {endTime}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              {scopeLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">
          Teacher: <span className="font-bold text-slate-800">{meeting.teacherName}</span>
        </p>

        <div className="flex items-center gap-2">
          {meeting.recordingUrl ? (
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Watch Recording
              </button>
              {isAdmin && !showAddUrl && (
                <button 
                  onClick={() => setShowAddUrl(true)}
                  className="px-2 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                  title="Change recording link"
                >
                  Edit
                </button>
              )}
            </div>
          ) : (
            isAdmin && !showAddUrl && (
              <button 
                onClick={() => setShowAddUrl(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Attach Recording
              </button>
            )
          )}
        </div>

        {isAdmin && showAddUrl && (
          <div className="mt-2 flex w-full items-center gap-2">
            <input 
              type="url" 
              placeholder="Paste Google Drive, YouTube, or MP4 link..." 
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <button 
              onClick={handleSaveRecording} 
              disabled={isSaving}
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button 
              onClick={() => setShowAddUrl(false)} 
              className="rounded-xl bg-slate-100 px-2.5 py-2 text-slate-500 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {showPlayer && <RecordingPlayerModal meeting={meeting} onClose={() => setShowPlayer(false)} />}
    </div>
  );
}


function formatCountdown(targetTs: number): string {
  const diff = targetTs - Date.now();
  if (diff <= 0) return "Starting...";
  const hours = Math.floor(diff / (3600 * 1000));
  const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  const secs = Math.floor((diff % (60 * 1000)) / 1000);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || hours > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function AdminScheduledMeetingCard({ meeting, onStart, onDelete, tick }: { meeting: LiveMeeting; onStart: () => void; onDelete: () => void; tick: number; key?: React.Key }) {
  const scopeLabel = meeting.scope === "all" ? "All students" : meeting.scope === "class" ? meeting.className : meeting.batchTitle;
  const timeFormatted = new Date(meeting.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">
              Scheduled
            </span>
            <span className="text-xs text-slate-500 font-medium">· starts in {formatCountdown(meeting.startedAt)}</span>
          </div>
          <h4 className="text-base font-bold text-slate-900 truncate">{meeting.title}</h4>
          <p className="mt-0.5 text-xs text-slate-600">{meeting.teacherName} · {scopeLabel}</p>
          <p className="mt-1 text-[11px] text-slate-500">Scheduled Time: {timeFormatted} · {meeting.durationMins} min</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={onStart} title="Start class early" className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-600 shadow-sm">
            <Play className="h-3.5 w-3.5 fill-current" /> Start Now
          </button>
          <button onClick={onDelete} title="Delete schedule" className="inline-flex items-center justify-center rounded-xl bg-red-100 p-2 text-red-600 transition hover:bg-red-200">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentScheduledMeetingCard({ meeting, tick }: { meeting: LiveMeeting; tick: number; key?: React.Key }) {
  const scopeLabel = meeting.scope === "all" ? "All students" : meeting.scope === "class" ? meeting.className : meeting.batchTitle;
  const timeFormatted = new Date(meeting.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md animate-fade-in">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
            Upcoming Scheduled Class
          </span>
        </div>
        <span className="text-xs font-extrabold text-slate-500">Starts in: {formatCountdown(meeting.startedAt)}</span>
      </div>

      <h4 className="text-lg font-extrabold text-slate-900">{meeting.title}</h4>
      <p className="mt-1 text-sm text-slate-600">Teacher: <span className="font-semibold text-slate-900">{meeting.teacherName}</span></p>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> {timeFormatted} ({meeting.durationMins} min)</span>
        {meeting.scope !== "all" && (
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-amber-500" /> {meeting.scope === "class" ? meeting.className : meeting.batchTitle}</span>
        )}
      </div>

      <button disabled className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed">
        <Clock className="h-4 w-4 animate-pulse" /> Class will automatically unlock at scheduled time
      </button>
    </div>
  );
}


export default LiveClasses;
