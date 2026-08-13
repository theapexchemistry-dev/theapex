import React, { useEffect, useRef } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ScreenShare,
  MonitorOff,
  PhoneOff,
  Users,
  Info,
  CheckCircle2,
  X,
  MonitorPlay,
  Hand,
  MessageSquare,
  Send,
} from "lucide-react";
import {
  useMeetingRoom,
  useChat,
  type LiveMeeting,
  type Participant,
  type ChatMessage,
} from "../lib/useLiveClass";
import { updateMeeting } from "../lib/firebaseSync";

// Tiny className joiner (no external dep)
function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
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

// ============================================================================
//  MeetingDialog — the full-screen WebRTC call surface
// ============================================================================
interface MeetingDialogProps {
  meeting: LiveMeeting;
  role: "admin" | "student";
  displayName: string;
  meetingActive: boolean;
  onClose: () => void;
  onEndMeeting: (id: string) => void;
}

export function MeetingDialog({
  meeting,
  role,
  displayName,
  meetingActive,
  onClose,
  onEndMeeting,
}: MeetingDialogProps) {
  const isAdmin = role === "admin";
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const room = useMeetingRoom({
    active: true,
    meetingId: meeting.id,
    displayName,
    role,
  });

  const chat = useChat(meeting.id, room.participantId, displayName);
  const [sidebarTab, setSidebarTab] = React.useState<"participants" | "chat">("participants");
  const [chatInput, setChatInput] = React.useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ended = !meetingActive;
  const [countdown, setCountdown] = React.useState(5);

  useEffect(() => {
    if (sidebarTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat.messages.length, sidebarTab]);

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    chat.sendMessage(chatInput);
    setChatInput("");
  };

  // Set teacherJoined: true in Firestore when the teacher joins
  useEffect(() => {
    if (isAdmin && meeting.id && !meeting.teacherJoined) {
      updateMeeting({
        ...meeting,
        teacherJoined: true,
        active: true,
      }).catch((err) => {
        console.error("Failed to update teacherJoined in Firestore:", err);
      });
    }
  }, [isAdmin, meeting.id, meeting.teacherJoined]);

  useEffect(() => {
    if (!ended) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ended, onClose]);

  const scopeLabel =
    meeting.scope === "all"
      ? "All students"
      : meeting.batchTitle || "Selected batch";

  const handleEnd = () => {
    if (isAdmin) {
      onEndMeeting(meeting.id);
    } else {
      room.leave();
      onClose();
    }
  };

  const handleLeave = () => {
    room.leave();
    if (isAdmin && meeting.id) {
      updateMeeting({
        ...meeting,
        teacherJoined: false,
      }).catch((err) => {
        console.error("Failed to update teacherJoined on leave:", err);
      });
    }
    onClose();
  };

  const showScreen = isAdmin
    ? room.screenSharing
    : !!(room.adminParticipant?.screenSharing || room.remoteScreen);
  const mainStream = isAdmin
    ? room.screenSharing
      ? room.screenStream
      : room.localStream
    : showScreen
    ? room.remoteScreen
    : room.adminStream;

  const activeStudentStreams = Array.from(room.remoteStreams.entries()).filter(([id]) => {
    const p = room.participants.find(p => p.id === id);
    return p && (p.camOn || p.micOn);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-red-400">
              Live
            </span>
            <span className="text-[11px] text-slate-400">
              · {timeAgo(meeting.startedAt)}
            </span>
            {!room.connected && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                connecting…
              </span>
            )}
            {room.error && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                {room.error}
              </span>
            )}
          </div>
          <h2 className="truncate text-sm font-bold sm:text-base">
            {meeting.title}
          </h2>
          <p className="truncate text-[11px] text-slate-400">
            by {meeting.teacherName} · {scopeLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold sm:flex">
            <Users className="h-3.5 w-3.5" />
            {room.participants.length}
          </div>
          {isAdmin ? (
            <button
              onClick={handleEnd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold transition hover:bg-red-700"
            >
              <PhoneOff className="h-3.5 w-3.5" /> End class
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold transition hover:bg-slate-600"
            >
              <X className="h-3.5 w-3.5" /> Leave
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Stage */}
        <div className="relative flex flex-1 items-center justify-center bg-black p-3">
          {ended ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <CheckCircle2 className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm font-bold">The class has ended</p>
              <p className="mt-1 text-xs text-slate-400">Closing automatically in {countdown}s…</p>
            </div>
          ) : mainStream ? (
            <>
              <MediaView
                stream={mainStream}
                muted={isAdmin}
                mirror={isAdmin && !showScreen}
                className="h-full w-full rounded-xl object-contain"
              />
              {showScreen && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  <MonitorPlay className="h-3 w-3" />
                  {isAdmin ? "Sharing your screen" : "Screen share"}
                </span>
              )}
              
              {/* Student video grid for Admin */}
              {isAdmin && activeStudentStreams.length > 0 && (
                <div className="absolute bottom-3 left-3 flex gap-2 overflow-x-auto pb-2 max-w-[calc(100%-24px)]">
                  {activeStudentStreams.map(([id, stream]) => {
                    const p = room.participants.find(x => x.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-slate-900 shadow-lg">
                        <MediaView stream={stream} className="h-full w-full object-cover" />
                        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between bg-black/40 px-1 rounded">
                          <span className="truncate text-[8px] font-bold">{p.displayName}</span>
                          {p.handRaised && <Hand className="h-2.5 w-2.5 text-amber-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-slate-400 max-w-md p-6 bg-slate-900/60 rounded-2xl border border-white/5 shadow-xl">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 animate-pulse">
                <Video className="h-7 w-7 text-amber-400" />
              </div>
              <p className="text-sm font-bold text-white">
                {isAdmin 
                  ? "Setting Up Live Classroom…" 
                  : meeting.teacherJoined 
                    ? "Connecting to Teacher's Stream…" 
                    : "Teacher is yet to join…"}
              </p>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {isAdmin
                  ? "Allow camera and microphone access to start your video stream. If prompted by your browser, please choose 'Allow'."
                  : meeting.teacherJoined
                    ? "Teacher is online! Establishing secure peer connection, please wait."
                    : "The live stream will begin as soon as the teacher goes online."}
              </p>

              {/* IFrame Sandbox Warning */}
              {isInIframe && isAdmin && (
                <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left text-xs space-y-2">
                  <p className="font-extrabold text-amber-300 flex items-center gap-1.5">
                    ⚠️ Browser Sandbox Limitation
                  </p>
                  <p className="text-slate-300 leading-normal text-[11px]">
                    You are currently viewing the portal inside an <strong>iframe preview panel</strong>. Browsers block video/mic hardware access inside sandboxed frames.
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-2 rounded-lg font-black text-xs transition-colors"
                  >
                    Open Portal in New Tab ↗
                  </a>
                </div>
              )}

              {/* Retry & Manual Instructions */}
              {isAdmin && (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => room.requestMedia()}
                    className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md"
                  >
                    Request Camera & Mic Permission Again
                  </button>
                  
                  {!isInIframe && (
                    <p className="text-[10px] text-slate-500 leading-normal">
                      If the browser does not prompt you, click the lock icon (🔒) on the left of your browser address bar to manually enable <strong>Camera</strong> and <strong>Microphone</strong> access.
                    </p>
                  )}
                </div>
              )}

              {room.error && (
                <p className="mt-3 inline-block rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 border border-red-500/20">
                  Error: {room.error}
                </p>
              )}
            </div>
          )}

          {/* Teacher camera thumbnail (student view, when screen is sharing) */}
          {!isAdmin && showScreen && room.adminStream && room.adminParticipant?.camOn && (
            <div className="absolute bottom-5 right-5 z-10 h-28 w-40 overflow-hidden rounded-lg border-2 border-white/20 bg-black shadow-xl sm:h-32 sm:w-48">
              <MediaView
                stream={room.adminStream}
                muted={false}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Student self-view thumbnail (student view, when camera is on) */}
          {!isAdmin && room.camOn && room.localStream && (
            <div className={cn(
              "absolute z-10 overflow-hidden rounded-lg border-2 border-white/20 bg-black shadow-xl transition-all",
              showScreen ? "bottom-36 right-5 h-24 w-32" : "bottom-5 right-5 h-28 w-40 sm:h-32 sm:w-48"
            )}>
              <MediaView
                stream={room.localStream}
                muted={true}
                mirror={true}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-1 left-1 rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-bold text-white">
                You
              </div>
            </div>
          )}
        </div>

        {/* Participants panel */}
        <aside className="flex w-full flex-col border-t border-white/10 bg-slate-900 lg:w-80 lg:border-l lg:border-t-0">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setSidebarTab("participants")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold transition",
                sidebarTab === "participants"
                  ? "border-b-2 border-indigo-500 bg-white/5 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <Users className="h-4 w-4" />
              Participants ({room.participants.length})
            </button>
            <button
              onClick={() => setSidebarTab("chat")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold transition",
                sidebarTab === "chat"
                  ? "border-b-2 border-indigo-500 bg-white/5 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
              {sidebarTab !== "chat" && chat.messages.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          </div>

          {sidebarTab === "participants" ? (
            <div className="max-h-48 flex-1 overflow-y-auto px-2 py-2 lg:max-h-none">
              {room.participants.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">
                  No participants yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {room.participants.map((p) => (
                    <ParticipantRow key={p.id} p={p} />
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chat.messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <MessageSquare className="mb-2 h-8 w-8 text-slate-700" />
                    <p className="text-xs text-slate-500">No messages yet.<br/>Start the conversation!</p>
                  </div>
                ) : (
                  chat.messages.map((m) => (
                    <div key={m.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wider",
                          m.senderId === room.participantId ? "text-indigo-400" : "text-slate-400"
                        )}>
                          {m.senderId === room.participantId ? "You" : m.senderName}
                        </span>
                        <span className="text-[9px] text-slate-600">
                          {m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}
                        </span>
                      </div>
                      <p className="rounded-lg bg-white/5 p-2.5 text-xs leading-relaxed text-slate-200">
                        {m.text}
                      </p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="border-t border-white/10 p-3">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full rounded-xl bg-white/5 py-2.5 pl-4 pr-10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-indigo-400 transition hover:bg-indigo-500/10 disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </aside>
      </div>

      {/* Controls */}
      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-slate-900 px-4 py-3 sm:gap-3">
        {isAdmin ? (
          <>
            <ControlButton
              active={room.micOn}
              onClick={room.toggleMic}
              onIcon={<Mic className="h-5 w-5" />}
              offIcon={<MicOff className="h-5 w-5" />}
              labelOn="Mute"
              labelOff="Unmute"
            />
            <ControlButton
              active={room.camOn}
              onClick={room.toggleCam}
              onIcon={<Video className="h-5 w-5" />}
              offIcon={<VideoOff className="h-5 w-5" />}
              labelOn="Stop video"
              labelOff="Start video"
            />
            <ControlButton
              active={room.screenSharing}
              onClick={room.toggleScreen}
              onIcon={<ScreenShare className="h-5 w-5" />}
              offIcon={<MonitorOff className="h-5 w-5" />}
              labelOn="Stop share"
              labelOff="Share screen"
              accent
            />
          </>
        ) : (
          <>
            <ControlButton
              active={room.micOn}
              onClick={() => {
                if (!room.localStream) room.requestMedia();
                else room.toggleMic();
              }}
              onIcon={<Mic className="h-5 w-5" />}
              offIcon={<MicOff className="h-5 w-5" />}
              labelOn="Mute"
              labelOff="Unmute"
            />
            <ControlButton
              active={room.camOn}
              onClick={() => {
                if (!room.localStream) room.requestMedia();
                else room.toggleCam();
              }}
              onIcon={<Video className="h-5 w-5" />}
              offIcon={<VideoOff className="h-5 w-5" />}
              labelOn="Stop video"
              labelOff="Start video"
            />
            <ControlButton
              active={room.handRaised}
              onClick={room.toggleHand}
              onIcon={<Hand className="h-5 w-5 fill-amber-400" />}
              offIcon={<Hand className="h-5 w-5" />}
              labelOn="Lower Hand"
              labelOff="Raise Hand"
              accent={room.handRaised}
            />
          </>
        )}
        
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              onClick={handleEnd}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2.5 text-xs font-bold transition hover:bg-red-700"
            >
              <PhoneOff className="h-4 w-4" /> End class
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-5 py-2.5 text-xs font-bold transition hover:bg-slate-600"
            >
              <PhoneOff className="h-4 w-4" /> Leave
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
//  Sub-components
// ============================================================================
function MediaView({
  stream,
  muted,
  mirror,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (stream) {
      v.srcObject = stream;
      v.play().catch(() => {
        /* autoplay may be blocked until user gesture */
      });
    } else {
      v.srcObject = null;
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn(
        "h-full w-full object-contain",
        mirror && "-scale-x-100",
        className
      )}
    />
  );
}

function ControlButton({
  active,
  onClick,
  onIcon,
  offIcon,
  labelOn,
  labelOff,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  labelOn: string;
  labelOff: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={active ? labelOn : labelOff}
      className={cn(
        "inline-flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold transition sm:px-4",
        active
          ? accent
            ? "bg-emerald-500 text-white hover:bg-emerald-600"
            : "bg-white/10 text-white hover:bg-white/20"
          : "bg-red-500/90 text-white hover:bg-red-600"
      )}
    >
      {active ? onIcon : offIcon}
      <span className="hidden sm:inline">{active ? labelOn : labelOff}</span>
    </button>
  );
}

function ParticipantRow({ p }: { p: Participant; key?: React.Key }) {
  const initial = (p.displayName || "?").trim().charAt(0).toUpperCase();
  const isHost = p.role === "admin";
  return (
    <li className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          isHost ? "bg-amber-400 text-slate-950" : "bg-slate-700 text-slate-200"
        )}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-white">
            {p.displayName}
          </span>
          {isHost && (
            <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
              Host
            </span>
          )}
        </div>
        <span className="text-[10px] capitalize text-slate-400">{p.role}</span>
      </div>
      <div className="flex items-center gap-1">
        {p.handRaised && <Hand className="h-3.5 w-3.5 animate-bounce text-amber-400" />}
        {p.screenSharing && (
          <MonitorPlay className="h-3.5 w-3.5 text-emerald-400" />
        )}
        {p.micOn ? (
          <Mic className="h-3.5 w-3.5 text-slate-300" />
        ) : (
          <MicOff className="h-3.5 w-3.5 text-slate-500" />
        )}
        {p.camOn ? (
          <Video className="h-3.5 w-3.5 text-slate-300" />
        ) : (
          <VideoOff className="h-3.5 w-3.5 text-slate-500" />
        )}
      </div>
    </li>
  );
}
