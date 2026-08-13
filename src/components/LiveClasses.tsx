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

        {showWebRTCModal && (
          <MeetingDialog
            meeting={showWebRTCModal}
            role="admin"
            displayName={teacherName || "Mr. Subhamoy Mondal"}
            meetingActive={showWebRTCModal.active || (showWebRTCModal.isScheduled && showWebRTCModal.scheduledAt && Date.now() >= showWebRTCModal.scheduledAt)}
            onClose={() => setShowWebRTCModal(null)}
            onEndMeeting={(id) => {
              handleEndMeeting(id);
              setShowWebRTCModal(null);
            }}
          />
        )}
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

      {showWebRTCModal && (
        <MeetingDialog
          meeting={showWebRTCModal}
          role="student"
          displayName={studentRegisteredName}
          meetingActive={showWebRTCModal.active || (showWebRTCModal.isScheduled && showWebRTCModal.scheduledAt && Date.now() >= showWebRTCModal.scheduledAt)}
          onClose={() => setShowWebRTCModal(null)}
          onEndMeeting={() => setShowWebRTCModal(null)}
        />
      )}
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
  // Convert Google Drive view URL to preview URL for iframe embedding
  let embedUrl = meeting.recordingUrl || '';
  if (embedUrl.includes('drive.google.com') && embedUrl.includes('/view')) {
    embedUrl = embedUrl.replace(/\/view.*$/, '/preview');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-3xl bg-slate-900 p-1 shadow-2xl border border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex flex-col">
            <h3 className="text-lg font-black text-white">{meeting.title}</h3>
            <p className="text-xs text-slate-400">Recorded on {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(meeting.startedAt)} at {new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(meeting.startedAt)}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative w-full aspect-video bg-black rounded-b-3xl overflow-hidden">
          {embedUrl ? (
            <iframe 
              src={embedUrl}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Video className="w-12 h-12 mb-3 opacity-20" />
              <p>No valid recording URL provided.</p>
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
  const [urlInput, setUrlInput] = useState("");
  const [showPlayer, setShowPlayer] = useState(false);

  const handleSaveRecording = () => {
    if (!urlInput.trim()) return;
    if (onUpdate) {
      onUpdate({ ...meeting, recordingUrl: urlInput.trim() });
    }
    setShowAddUrl(false);
  };

  if (meeting.recordingUrl) {
    return (
      <>
        <div 
          onClick={() => setShowPlayer(true)}
          className="group relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-emerald-300 overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 z-10 flex gap-2">
            {isAdmin && onDelete && (
               <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete record" className="inline-flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm shadow-sm p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
          
          <div className="relative w-full h-32 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-emerald-500 to-slate-900 mix-blend-overlay"></div>
            <div className="z-10 flex flex-col items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
               <div className="h-12 w-12 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-lg backdrop-blur-md">
                 <Play className="h-5 w-5 fill-current ml-1" />
               </div>
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded-md text-[10px] font-bold text-white backdrop-blur-md">
              RECORDED
            </div>
          </div>
          
          <div className="flex flex-col min-w-0">
            <h4 className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{meeting.title}</h4>
            <p className="mt-0.5 text-xs text-slate-500">{meeting.teacherName} · {scopeLabel}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(meeting.startedAt)}</p>
          </div>
        </div>
        {showPlayer && <RecordingPlayerModal meeting={meeting} onClose={() => setShowPlayer(false)} />}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ended Class</span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">· {meeting.platform || "live"}</span>
          </div>
          <h4 className="truncate text-sm font-semibold text-slate-800">{meeting.title}</h4>
          <p className="mt-0.5 text-xs text-slate-500">{meeting.teacherName} · {scopeLabel}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(meeting.startedAt)} · {formatDuration(meeting.startedAt, meeting.endedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && onDelete && (<button onClick={onDelete} title="Delete record" className="inline-flex items-center justify-center rounded-lg bg-red-50 p-2 text-red-500 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button>)}
        </div>
      </div>
      {isAdmin && !showAddUrl && (
        <button onClick={() => setShowAddUrl(true)} className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <LinkIcon className="h-3.5 w-3.5" /> Attach Google Drive Recording
        </button>
      )}
      {isAdmin && showAddUrl && (
        <div className="mt-2 flex items-center gap-2">
          <input 
            type="url" 
            placeholder="Paste Google Drive link..." 
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
          />
          <button onClick={handleSaveRecording} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Save</button>
          <button onClick={() => setShowAddUrl(false)} className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
        </div>
      )}
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
