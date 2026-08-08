/**
 * ============================================================================
 *  LiveClasses.tsx — BULLETPROOF VERSION (NO Firebase required)
 * ----------------------------------------------------------------------------
 *  Drop-in replacement for the Firebase-dependent version.
 *  Uses localStorage + a shareable Join URL (?join=ROOM) instead of Firestore.
 *  No API keys, no security rules, no configuration. Never throws permission errors.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Video,
  Trash2,
  Copy,
  X,
  Radio,
  Play,
  Zap,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Clock,
  KeyRound,
  CheckCircle2,
  Link2,
  Info,
} from "lucide-react";

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

interface LiveClassesProps {
  role: Role;
  student?: Student | null;
}

// ---------- Constants ----------
const JITSI_DOMAIN = "meet.jit.si";
const STORAGE_KEY = "apex_live_meetings_v3";
const FALLBACK_CLASSES = ["Class 9", "Class 10", "Class 11", "Class 12"];
const JOIN_URL_PARAM = "join";

// ---------- Helpers ----------
function sanitizeRoomName(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function generateRoomName(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return sanitizeRoomName(`ApexWorld_${Date.now().toString(36)}_${rand}`);
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

function saveMeetingsLocal(meetings: LiveMeeting[]): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
    window.dispatchEvent(new Event("apex_storage_updated"));
  } catch {
    /* ignore quota errors */
  }
}

function readJoinParamFromUrl(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const val = url.searchParams.get(JOIN_URL_PARAM);
    if (!val) return null;
    return sanitizeRoomName(val);
  } catch {
    return null;
  }
}

function clearJoinParamFromUrl(): void {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has(JOIN_URL_PARAM)) {
      url.searchParams.delete(JOIN_URL_PARAM);
      window.history.replaceState({}, "", url.toString());
    }
  } catch {
    /* ignore */
  }
}

function buildJitsiUrl(roomName: string, displayName: string): string {
  const safeRoom = sanitizeRoomName(roomName);
  const encodedName = encodeURIComponent(displayName);
  const hash = [
    "config.startWithAudioMuted=false",
    "config.startWithVideoMuted=false",
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    `userInfo.displayName=${encodedName}`,
  ].join("&");
  return `https://${JITSI_DOMAIN}/${safeRoom}#${hash}`;
}

function buildPlainLink(roomName: string): string {
  return `https://${JITSI_DOMAIN}/${sanitizeRoomName(roomName)}`;
}

function buildSiteJoinLink(roomName: string): string {
  try {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.origin);
    url.searchParams.set(JOIN_URL_PARAM, sanitizeRoomName(roomName));
    return url.toString();
  } catch {
    return "";
  }
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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

function normalizeClassName(c: string): string {
  if (!c) return "";
  const lower = c.toLowerCase().trim();
  const match = lower.match(/\d+/);
  return match ? match[0] : lower;
}

function isMeetingForStudent(meeting: LiveMeeting, student: Student): boolean {
  if (meeting.scope === "all") return true;
  if (meeting.scope === "batch") {
    if (student.batchId && meeting.batchId && student.batchId === meeting.batchId) {
      return true;
    }
    if (meeting.className && student.className) {
      if (normalizeClassName(meeting.className) === normalizeClassName(student.className)) {
        return true;
      }
    }
    return false;
  }
  if (meeting.scope === "class") {
    if (!meeting.className || !student.className) return false;
    return normalizeClassName(meeting.className) === normalizeClassName(student.className);
  }
  return false;
}

function meetingAudienceLabel(meeting: LiveMeeting): string {
  if (meeting.scope === "all") return "All Students";
  if (meeting.scope === "batch") return meeting.batchTitle || meeting.batchId || "Batch";
  if (meeting.scope === "class") return meeting.className || "Class";
  return "—";
}

function openInNewTab(url: string): boolean {
  try {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) return false;
    try { win.focus(); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ============================================================================
//  LiveClasses — main component
// ============================================================================
export const LiveClasses: React.FC<LiveClassesProps> = ({ role, student }) => {
  const isAdmin = role === "admin";

  const [meetings, setMeetings] = useState<LiveMeeting[]>(() => getMeetings());
  const [showStart, setShowStart] = useState(false);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [manualRoom, setManualRoom] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [autoJoinMeeting, setAutoJoinMeeting] = useState<LiveMeeting | null>(null);

  const [form, setForm] = useState<{
    scope: "batch" | "class" | "all";
    className: string;
    title: string;
  }>({
    scope: "class",
    className: "Class 12",
    title: "",
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(() => {
    setMeetings(getMeetings());
  }, []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("apex_storage_updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("apex_storage_updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  // ----- URL ?join=ROOM handling (auto-join prompt) -----
  useEffect(() => {
    const joinRoom = readJoinParamFromUrl();
    if (!joinRoom) return;

    const run = () => {
      const existing = getMeetings().find(
        (m) => sanitizeRoomName(m.roomName) === joinRoom && m.active
      );

      if (existing) {
        setAutoJoinMeeting(existing);
      } else {
        const guest: LiveMeeting = {
          id: "guest-" + Date.now().toString(36),
          title: "Live Class (joined via link)",
          scope: "all",
          teacherName: "Teacher",
          roomName: joinRoom,
          startedAt: Date.now(),
          durationMins: 60,
          active: true,
          createdAt: Date.now(),
        };
        const updated = [guest, ...getMeetings()];
        saveMeetingsLocal(updated);
        setMeetings(updated);
        setAutoJoinMeeting(guest);
      }
      clearJoinParamFromUrl();
    };

    const timer = setTimeout(run, 0);
    return () => clearTimeout(timer);
  }, []);

  const displayName = isAdmin
    ? "Mr. Subhamoy Mondal (Teacher)"
    : student?.name || "Student";

  const classOptions = useMemo(() => {
    return Array.from(new Set([...FALLBACK_CLASSES])).sort();
  }, []);

  const handleJoin = useCallback(
    (meeting: LiveMeeting) => {
      const url = buildJitsiUrl(meeting.roomName, displayName);
      const ok = openInNewTab(url);
      if (!ok) setPopupBlockedUrl(url);
    },
    [displayName]
  );

  const handleManualJoin = () => {
    const room = sanitizeRoomName(manualRoom);
    if (!room) return;
    const url = buildJitsiUrl(room, displayName);
    const ok = openInNewTab(url);
    if (!ok) {
      setPopupBlockedUrl(url);
    } else {
      setShowManualJoin(false);
      setManualRoom("");
      showToast("Opening meeting in a new tab…");
    }
  };

  const handleAutoJoinConfirm = () => {
    if (autoJoinMeeting) {
      handleJoin(autoJoinMeeting);
      setAutoJoinMeeting(null);
    }
  };

  const handleAutoJoinDismiss = () => {
    setAutoJoinMeeting(null);
  };

  const handleStartMeeting = () => {
    const scope = form.scope;
    let title = form.title.trim();
    let className: string | undefined;

    if (scope === "class") {
      if (!form.className) return;
      className = form.className;
      if (!title) title = `${form.className} — Live Class`;
    } else if (scope === "all") {
      if (!title) title = "Live Class — All Batches";
    } else {
      if (!title) title = "Live Class";
    }

    const meeting: LiveMeeting = {
      id: "live-" + Date.now().toString(36),
      title,
      scope,
      className,
      teacherName: "Mr. Subhamoy Mondal",
      roomName: generateRoomName(),
      startedAt: Date.now(),
      durationMins: 60,
      active: true,
      createdAt: Date.now(),
    };

    const updated = [meeting, ...getMeetings()];
    saveMeetingsLocal(updated);
    setMeetings(updated);

    setShowStart(false);
    setForm({ scope: "class", className: "Class 12", title: "" });

    setTimeout(() => {
      const url = buildJitsiUrl(meeting.roomName, displayName);
      const ok = openInNewTab(url);
      if (!ok) setPopupBlockedUrl(url);
    }, 100);
  };

  const handleEndMeeting = (id: string) => {
    const ok = window.confirm(
      "End this live class?\n\nStudents will no longer be able to join from the website."
    );
    if (!ok) return;
    const updated = getMeetings().map((m) =>
      m.id === id ? { ...m, active: false, endedAt: Date.now() } : m
    );
    saveMeetingsLocal(updated);
    setMeetings(updated);
  };

  const handleDeleteMeeting = (id: string) => {
    if (!window.confirm("Delete this meeting record? This cannot be undone.")) return;
    const updated = getMeetings().filter((m) => m.id !== id);
    saveMeetingsLocal(updated);
    setMeetings(updated);
  };

  const handleCopyLink = async (meeting: LiveMeeting) => {
    const url = buildPlainLink(meeting.roomName);
    const ok = await copyToClipboard(url);
    if (ok) {
      showToast("Direct Jitsi link copied!");
      window.alert("Direct meeting link copied!\n\n" + url);
    } else {
      window.alert("Link: " + url);
    }
  };

  const handleCopyRoomCode = async (meeting: LiveMeeting) => {
    const code = meeting.roomName;
    const ok = await copyToClipboard(code);
    if (ok) {
      showToast("Room code copied!");
      window.alert(
        "🔑 Room Code copied!\n\n" +
          code +
          "\n\nShare this code with your student. They click \"Join by Code\" and paste it."
      );
    } else {
      window.alert("Room Code: " + code);
    }
  };

  const handleCopyJoinLink = async (meeting: LiveMeeting) => {
    const link = buildSiteJoinLink(meeting.roomName);
    if (!link) return;
    const ok = await copyToClipboard(link);
    if (ok) {
      showToast("Join link copied! Share via WhatsApp.");
      window.alert(
        "🔗 Join Link copied!\n\n" +
          link +
          "\n\nShare this link with your students via WhatsApp/SMS. " +
          "When they open it, the meeting will appear automatically and they can join with one click."
      );
    } else {
      window.alert("Join Link: " + link);
    }
  };

  const handleCopyPopupUrl = async () => {
    if (!popupBlockedUrl) return;
    const ok = await copyToClipboard(popupBlockedUrl);
    if (ok) showToast("Link copied! Paste in a new tab.");
  };

  const visibleMeetings = isAdmin ? meetings : meetings.filter((m) => m.active);
  const activeMeetings = visibleMeetings.filter((m) => m.active);
  const endedMeetings = visibleMeetings.filter((m) => !m.active);

  const sortedActive = isAdmin
    ? [...activeMeetings].sort((a, b) => b.startedAt - a.startedAt)
    : [...activeMeetings].sort((a, b) => {
        if (student) {
          const aFor = isMeetingForStudent(a, student) ? 0 : 1;
          const bFor = isMeetingForStudent(b, student) ? 0 : 1;
          if (aFor !== bFor) return aFor - bFor;
        }
        return b.startedAt - a.startedAt;
      });
  const sortedEnded = [...endedMeetings].sort(
    (a, b) => (b.endedAt || 0) - (a.endedAt || 0)
  );

  const canStart = true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
            <Video className="w-7 h-7 text-amber-500" /> Live Classes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? "Start an instant live class. Share the join link via WhatsApp."
              : "Join live classes hosted by your teacher."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <button
              onClick={() => setShowManualJoin(true)}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
              title="Join using a room code from your teacher"
            >
              <KeyRound className="w-4 h-4" /> Join by Code
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowStart(true)}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Start Instant Meeting
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-800 leading-relaxed">
          <strong>Works without any setup.</strong>{" "}
          {isAdmin ? (
            <>
              After starting a meeting, click the <strong>🔗 button</strong> to copy a{" "}
              <strong>Join Link</strong> and share it with your students via WhatsApp.
              When they open the link, the meeting appears automatically. You can also
              share the <strong>🔑 room code</strong> for the &quot;Join by Code&quot; fallback.
            </>
          ) : (
            <>
              When your teacher shares a <strong>Join Link</strong> via WhatsApp, just open
              it and the meeting will appear here automatically. You can also use{" "}
              <strong>Join by Code</strong> if your teacher gave you a room code.
            </>
          )}{" "}
          Meetings open in a <strong>new browser tab</strong> — just allow camera &amp; mic
          access when your browser asks.
        </div>
      </div>

      {/* Student: no active meetings */}
      {!isAdmin && sortedActive.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No live classes right now</p>
          <p className="text-slate-400 text-sm mt-1">
            When your teacher starts a class and shares the link, it will appear here.
          </p>
          {student && (
            <div className="mt-5 inline-block text-left bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] font-mono text-slate-500 space-y-1">
              <p><span className="text-slate-400">Your name:</span> {student.name || "—"}</p>
              <p><span className="text-slate-400">Your class:</span> {student.className || "—"}</p>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-4">
            Ask your teacher for the <strong>Join Link</strong> (via WhatsApp) or the{" "}
            <strong>room code</strong>, then use{" "}
            <button
              onClick={() => setShowManualJoin(true)}
              className="text-amber-600 hover:underline font-bold"
            >
              Join by Code
            </button>{" "}
            above.
          </p>
        </div>
      )}

      {/* Active (LIVE NOW) meetings */}
      {sortedActive.length > 0 && (
        <div className="space-y-4">
          {sortedActive.map((m) => {
            const elapsed = now - m.startedAt;
            const forMyClass = !isAdmin && student ? isMeetingForStudent(m, student) : true;
            return (
              <div
                key={m.id}
                className={`bg-white border-2 rounded-2xl p-5 ${
                  isAdmin ? "border-red-200" : forMyClass ? "border-red-300" : "border-slate-200"
                } ring-4 ${forMyClass ? "ring-red-50" : "ring-slate-50"}`}
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
                      {!isAdmin && student && (
                        forMyClass ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" /> For Your Class
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            Other Class
                          </span>
                        )
                      )}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{m.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {formatDateTime(m.startedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" /> {m.teacherName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => handleJoin(m)}
                      className={`px-5 py-2.5 text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-sm ${
                        forMyClass ? "bg-red-500 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      <Play className="w-4 h-4" /> Join Now
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleCopyJoinLink(m)}
                          title="Copy Join Link (share via WhatsApp — auto-adds meeting on student's device)"
                          className="p-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyLink(m)}
                          title="Copy direct Jitsi link"
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyRoomCode(m)}
                          title="Copy room code (for 'Join by Code' fallback)"
                          className="p-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
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
                      <ShieldCheck className="w-3.5 h-3.5" /> You will join as{" "}
                      <strong>{displayName}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Opens in new tab · 🔗 = share link · 🔑 = room code
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
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">
            Past Meetings
          </h3>
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
              <button onClick={() => setShowStart(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Who can join?</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: "class", label: "Entire Class" },
                    { val: "all", label: "All Students" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setForm({ ...form, scope: opt.val })}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        form.scope === opt.val
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {form.scope === "class" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Class</label>
                  <select
                    value={form.className}
                    onChange={(e) => setForm({ ...form, className: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {classOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Meeting title (optional)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={form.scope === "class" ? `${form.className} — Live Class` : "Live Class — All Batches"}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  After starting, you&apos;ll get a <strong>🔗 Join Link</strong> to share
                  via WhatsApp. Students who open it will see the meeting here automatically.
                </div>
              </div>
              <button
                onClick={handleStartMeeting}
                disabled={!canStart}
                className="w-full px-4 py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Start Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join by Code modal */}
      {showManualJoin && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowManualJoin(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" /> Join by Code
              </h3>
              <button onClick={() => setShowManualJoin(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Paste the room code your teacher shared with you. It looks like{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">ApexWorld_xxx_yyy</code>.
            </p>
            <input
              type="text"
              value={manualRoom}
              onChange={(e) => setManualRoom(e.target.value)}
              placeholder="Paste room code here"
              autoFocus
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={handleManualJoin}
              disabled={!sanitizeRoomName(manualRoom)}
              className="w-full mt-4 px-4 py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> Join Meeting
            </button>
          </div>
        </div>
      )}

      {/* Auto-join prompt (when opened via ?join=ROOM) */}
      {autoJoinMeeting && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Radio className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">Join Live Class?</h3>
            <p className="text-sm text-slate-500 mb-1">{autoJoinMeeting.title}</p>
            <p className="text-xs text-slate-400 mb-5">
              You&apos;ll join as <strong>{displayName}</strong>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAutoJoinDismiss}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
              >
                Not now
              </button>
              <button
                onClick={handleAutoJoinConfirm}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Join Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup-blocked fallback */}
      {popupBlockedUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Popup blocked</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Your browser blocked the new tab. Copy the link below and paste it in a new browser tab to join the meeting.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-600 break-all mb-4">
              {popupBlockedUrl}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPopupBlockedUrl(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCopyPopupUrl}
                className="flex-1 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
};

export default LiveClasses;
