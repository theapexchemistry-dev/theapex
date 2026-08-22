import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Maximize2,
  Minimize2,
  Settings,
  MoreVertical,
  Layout,
  Trash2,
} from "lucide-react";
import Logo from "../assets/images/apex_logo.jpg";
import {
  useMeetingRoom,
  useChat,
  type LiveMeeting,
  type Participant,
  type ChatMessage,
} from "../lib/useLiveClass";
import { updateMeeting } from "../lib/firebaseSync";
import { StorageService } from "../lib/storage";

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

  const siteLogo = StorageService.getSiteLogo();

  useEffect(() => {
    if (room.removedByAdmin) {
      alert("You have been removed from the class by the admin.");
      onClose();
    }
  }, [room.removedByAdmin, onClose]);

  const chat = useChat(meeting.id, room.participantId, displayName);
  const [sidebarTab, setSidebarTab] = React.useState<"participants" | "chat">("participants");
  const [chatInput, setChatInput] = React.useState("");
  const [elapsedTime, setElapsedTime] = React.useState("00:00:00");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Timer logic
  useEffect(() => {
    if (!meetingActive) return;
    const interval = setInterval(() => {
      const start = meeting.startedAt || Date.now();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsedTime(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingActive, meeting.startedAt]);

  const ended = !meetingActive;
 
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
    onClose();
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
    }
    onClose();
  };

  // Browser notification for hand raised
  const requestNotificationPermission = React.useCallback(async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(err => {
        console.warn('SW Registration failed:', err);
      });
    }
  }, [requestNotificationPermission]);

  const playHandRaiseSound = React.useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (startTime: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, startTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.2, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);
      };

      // Play a double beep for a stronger "reminder"
      playBeep(audioContext.currentTime);
      playBeep(audioContext.currentTime + 0.4);
    } catch (e) {
      // Audio might be blocked until user interaction
    }
  }, []);

  const raisedRef = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = React.useState<{ id: string; name: string; timestamp: number }[]>([]);

  useEffect(() => {
    const newlyRaised = room.participants.filter(
      (p) =>
        p.handRaised &&
        !raisedRef.current.has(p.id) &&
        p.id !== room.participantId
    );

    newlyRaised.forEach((p) => {
      // 1. Browser notification (Desktop / Background) via Service Worker for reliability
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          const title = "Student Hand Raised";
          const options: any = {
            body: `${p.displayName} has raised his or her hand in ${meeting.title}.`,
            icon: siteLogo || '/icon-192.png',
            tag: `hand-raise-${p.id}`,
            renotify: true,
            requireInteraction: true, // Keep it visible until the user interacts
          };

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
              if (reg && reg.showNotification) {
                reg.showNotification(title, options).catch(err => {
                  console.error('Service Worker showNotification failed:', err);
                  new Notification(title, options);
                });
              } else {
                new Notification(title, options);
              }
            }).catch(() => {
              new Notification(title, options);
            });
          } else {
            new Notification(title, options);
          }
        }
      }
      
      // 2. Play Sound (Audible in background)
      if (isAdmin) {
        playHandRaiseSound();
        
        // 3. Stacking Toast for Teacher (Transient in-app UI)
        const toastId = `${p.id}-${Date.now()}`;
        setToasts(prev => [...prev, { id: toastId, name: p.displayName, timestamp: Date.now() }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 12000);
      }

      raisedRef.current.add(p.id);
    });

    // Sync ref with participants
    const currentlyRaisedIds = new Set(room.participants.filter(p => p.handRaised).map(p => p.id));
    raisedRef.current = new Set([...raisedRef.current].filter(id => currentlyRaisedIds.has(id)));
  }, [room.participants, room.participantId, isAdmin, meeting.title, playHandRaiseSound, siteLogo]);

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white font-sans">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-purple-600 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-[100] flex items-center justify-between gap-3 border-b border-white/5 bg-slate-900/40 backdrop-blur-xl px-4 py-3 sm:px-6">
        <div className="min-w-0 flex items-center gap-4">
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/20 overflow-hidden">
            {siteLogo ? (
              <img src={siteLogo} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Video className="h-5 w-5 text-indigo-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-2">
              <span className="flex h-2 w-2 items-center justify-center">
                <span className="h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
                Live Class
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                · {timeAgo(meeting.startedAt)}
              </span>
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/20">
                Live: {elapsedTime}
              </span>
              {!room.connected && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/20">
                  Connecting...
                </span>
              )}
            </div>
            <h2 className="truncate text-sm font-extrabold sm:text-base tracking-tight text-white/90">
              {meeting.title}
            </h2>
          </div>
        </div>

        {/* Stacking Hand Raise Toasts */}
        <div className="fixed top-24 right-6 z-[120] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {isAdmin && toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, x: 50 }}
                className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-indigo-600 p-4 shadow-2xl shadow-indigo-500/40 border border-indigo-400/30 min-w-[280px]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <Hand className="h-6 w-6 text-white animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-0.5">
                    Hand Raised
                  </p>
                  <p className="text-sm font-bold text-white truncate">
                    {toast.name}
                  </p>
                  <p className="text-[10px] text-indigo-100/70">
                    Needs assistance in class
                  </p>
                </div>
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-2 rounded-xl bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 sm:flex">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            {room.participants.length}
          </div>
          
          <div className="h-8 w-px bg-white/10 hidden sm:block" />

          {isAdmin ? (
            <button
              onClick={handleEnd}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-red-500 px-4 py-2 text-xs font-black transition-all hover:bg-red-600 active:scale-95 shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">End Class</span>
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 px-4 py-2 text-xs font-black transition-all active:scale-95 border border-white/5"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Stage */}
        <div 
          ref={stageRef}
          className="relative flex flex-1 flex-col overflow-hidden bg-black/40"
        >
          {/* Audio Fallback for Students */}
          {!isAdmin && room.adminStream && room.adminStream !== mainStream && (
            <AudioFallback stream={room.adminStream} />
          )}

          {/* Fullscreen toggle button */}
          <button
            onClick={toggleFullscreen}
            className="absolute right-6 top-6 z-30 rounded-xl bg-black/40 p-2.5 text-white/70 backdrop-blur-md border border-white/10 transition-all hover:bg-black/60 hover:text-white hover:scale-110 active:scale-95"
            title="Toggle Fullscreen"
          >
            {typeof document !== "undefined" && document.fullscreenElement ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>

          <div className="flex-1 flex flex-col p-4 sm:p-6 gap-6 overflow-y-auto no-scrollbar">
            <AnimatePresence mode="wait">
              {ended ? (
                <motion.div 
                  key="ended"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-1 items-center justify-center text-center"
                >
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-black text-white">The class has ended</h3>
                    <p className="mt-2 text-sm text-slate-400 font-medium">Thank you for attending!</p>
                  </div>
                </motion.div>
              ) : isAdmin ? (
                /* ADMIN VIEW: TWO PANELS */
                <motion.div 
                  key="admin-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 flex-col gap-6"
                >
                  {/* Panel 1: Admin's Own Screen */}
                  <div className="flex-[3] relative min-h-[300px]">
                    <div className="absolute inset-0 rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl">
                      {mainStream ? (
                        <MediaView
                          stream={mainStream}
                          muted={true}
                          mirror={!showScreen}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center p-8 bg-slate-900/60">
                           <img src={siteLogo || Logo} alt="Logo" className="h-16 w-16 mb-4 opacity-20 grayscale invert brightness-200 object-contain" />
                           <p className="text-xs font-bold text-slate-500">Camera access needed for your preview</p>
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                        {showScreen ? <MonitorPlay className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                        {showScreen ? "Your Screen Share" : "Your Camera"}
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: Student Gallery View */}
                  <div className="flex-[2] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        Student View Grid
                      </h3>
                      <span className="text-[10px] font-bold text-slate-500">
                        {activeStudentStreams.length} active stream(s)
                      </span>
                    </div>
                    
                    {activeStudentStreams.length === 0 ? (
                      <div className="flex-1 rounded-2xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center p-8 text-center min-h-[150px]">
                        <Users className="h-8 w-8 text-slate-700 mb-2" />
                        <p className="text-xs font-bold text-slate-500 italic">No students have joined with video/mic yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {activeStudentStreams.map(([id, stream]) => {
                          const p = room.participants.find(x => x.id === id);
                          if (!p) return null;
                          return (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              key={id} 
                              className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl group"
                            >
                              <MediaView stream={stream} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                                <span className="truncate text-[9px] font-black text-white/90 uppercase tracking-tighter">{p.displayName}</span>
                                <div className="flex items-center gap-1.5">
                                  {p.handRaised && <Hand className="h-3 w-3 text-amber-400 fill-amber-400 animate-pulse" />}
                                  {p.micOn ? <Mic className="h-2.5 w-2.5 text-emerald-400" /> : <MicOff className="h-2.5 w-2.5 text-red-400" />}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                /* STUDENT VIEW: HOST ONLY (PLUS OWN PREVIEW) */
                <motion.div 
                  key="student-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 flex-col relative"
                >
                  <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl">
                    {mainStream ? (
                      <div className="relative h-full w-full flex items-center justify-center">
                        <MediaView
                          stream={mainStream}
                          muted={false}
                          className="h-full w-full object-contain"
                        />
                        {showScreen && (
                          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                            <MonitorPlay className="h-3.5 w-3.5" />
                            Teacher Sharing Screen
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Teacher: {meeting.teacherName}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center p-8 bg-slate-900/60">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20 relative overflow-hidden p-2">
                          <div className="absolute inset-0 rounded-3xl bg-indigo-500/20 animate-ping opacity-20" />
                          <img src={siteLogo || Logo} alt="Logo" className="h-full w-full object-contain opacity-40 grayscale invert brightness-200" />
                        </div>
                        <h3 className="text-lg font-black text-white mb-2 italic">
                          {meeting.teacherJoined 
                            ? "Connecting to Teacher..." 
                            : "Waiting for Teacher..."}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium max-w-xs">
                          {meeting.teacherJoined
                            ? "Teacher is online! Establishing secure connection, please hold on."
                            : "The live session will begin as soon as the teacher goes online."}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Student self-view thumbnail (his screen panel) */}
                  {room.camOn && room.localStream && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute bottom-8 right-8 z-20 h-32 w-48 overflow-hidden rounded-2xl border-2 border-white/20 bg-slate-900 shadow-2xl group"
                    >
                      <MediaView
                        stream={room.localStream}
                        muted={true}
                        mirror={true}
                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-[9px] font-black text-white/90 uppercase tracking-widest">
                        Your Panel
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Participants panel */}
        <aside className="relative z-10 flex w-full flex-col border-t border-white/5 bg-slate-900/40 backdrop-blur-2xl lg:w-80 lg:border-l lg:border-t-0">
          <div className="flex p-2 gap-1 border-b border-white/5">
            <button
              onClick={() => setSidebarTab("participants")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all",
                sidebarTab === "participants"
                  ? "bg-white/10 text-white shadow-inner"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
              )}
            >
              <Users className="h-4 w-4" />
              <span>People ({room.participants.length})</span>
            </button>
            <button
              onClick={() => setSidebarTab("chat")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all",
                sidebarTab === "chat"
                  ? "bg-white/10 text-white shadow-inner"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
              {sidebarTab !== "chat" && chat.messages.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {sidebarTab === "participants" ? (
              <div className="h-full overflow-y-auto p-3 no-scrollbar">
                {room.participants.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
                    <Users className="mb-2 h-10 w-10 text-slate-700" />
                    <p className="text-xs font-bold text-slate-500">Classroom is empty</p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {room.participants.map((p) => (
                      <ParticipantRow 
                        key={p.id} 
                        p={p} 
                        canRemove={isAdmin && p.role !== "admin"}
                        onRemove={() => room.removeParticipant(p.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                  {chat.messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
                      <MessageSquare className="mb-2 h-10 w-10 text-slate-700" />
                      <p className="text-xs font-bold text-slate-500">No messages yet</p>
                    </div>
                  ) : (
                    chat.messages.map((m) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={m.id} 
                        className="flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            m.senderId === room.participantId ? "text-indigo-400" : "text-slate-400"
                          )}>
                            {m.senderId === room.participantId ? "You" : m.senderName}
                          </span>
                          <span className="text-[9px] font-bold text-slate-600">
                            {m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/5 p-3 text-xs leading-relaxed text-slate-200 shadow-sm">
                          {m.text}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendChat} className="p-4 bg-slate-900/40 backdrop-blur-xl border-t border-white/5">
                  <div className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Send a message..."
                      className="w-full rounded-2xl bg-white/5 border border-white/5 py-3 pl-4 pr-12 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-indigo-400 transition-all hover:bg-indigo-500/10 disabled:opacity-20 active:scale-90"
                    >
                      <Send className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Controls */}
      <footer className="relative z-20 flex flex-wrap items-center justify-center gap-3 border-t border-white/5 bg-slate-900/60 backdrop-blur-2xl px-6 py-4">
        <div className="flex items-center gap-3 p-1.5 bg-white/5 rounded-2xl border border-white/5 shadow-2xl">
          {isAdmin ? (
            <>
              <ControlButton
                active={room.micOn}
                onClick={room.toggleMic}
                onIcon={<Mic className="h-5 w-5" />}
                offIcon={<MicOff className="h-5 w-5" />}
                labelOn="Mic On"
                labelOff="Mic Off"
              />
              <ControlButton
                active={room.camOn}
                onClick={room.toggleCam}
                onIcon={<Video className="h-5 w-5" />}
                offIcon={<VideoOff className="h-5 w-5" />}
                labelOn="Video On"
                labelOff="Video Off"
              />
              <div className="w-px h-6 bg-white/10 mx-1" />
              <ControlButton
                active={room.screenSharing}
                onClick={room.toggleScreen}
                onIcon={<ScreenShare className="h-5 w-5" />}
                offIcon={<MonitorOff className="h-5 w-5" />}
                labelOn="Stop Share"
                labelOff="Share Screen"
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
                labelOn="Mic On"
                labelOff="Mic Off"
              />
              <ControlButton
                active={room.camOn}
                onClick={() => {
                  if (!room.localStream) room.requestMedia();
                  else room.toggleCam();
                }}
                onIcon={<Video className="h-5 w-5" />}
                offIcon={<VideoOff className="h-5 w-5" />}
                labelOn="Video On"
                labelOff="Video Off"
              />
              <div className="w-px h-6 bg-white/10 mx-1" />
              <ControlButton
                active={room.handRaised}
                onClick={room.toggleHand}
                onIcon={<Hand className="h-5 w-5 fill-amber-400" />}
                offIcon={<Hand className="h-5 w-5" />}
                labelOn="Hand Raised"
                labelOff="Raise Hand"
                accent={room.handRaised}
              />
            </>
          )}
          
          <div className="w-px h-6 bg-white/10 mx-1" />
          
          <button
            onClick={() => setSidebarTab(sidebarTab === "chat" ? "participants" : "chat")}
            className={cn(
              "p-3 rounded-xl transition-all relative active:scale-90",
              sidebarTab === "chat" ? "bg-white/10 text-indigo-400" : "text-slate-400 hover:bg-white/5"
            )}
          >
            <MessageSquare className="h-5 w-5" />
            {chat.messages.length > 0 && sidebarTab !== "chat" && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-500 border-2 border-slate-900" />
            )}
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              onClick={handleEnd}
              className="inline-flex items-center gap-2 rounded-2xl bg-red-500 hover:bg-red-600 px-6 py-3 text-xs font-black transition-all active:scale-95 shadow-xl shadow-red-500/20"
            >
              <PhoneOff className="h-4 w-4" /> End Class
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 px-6 py-3 text-xs font-black transition-all active:scale-95 border border-white/5"
            >
              <PhoneOff className="h-4 w-4" /> Leave Room
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function AudioFallback({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  if (!stream) return null;
  return <audio ref={ref} autoPlay playsInline muted={false} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />;
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
    <div className={cn("relative overflow-hidden bg-slate-900/50", className)}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          "h-full w-full object-contain transition-transform duration-700",
          mirror && "-scale-x-100"
        )}
      />
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 p-12">
          <img src={Logo} alt="Logo" className="max-h-full max-w-full object-contain opacity-20 grayscale invert brightness-200" />
        </div>
      )}
    </div>
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
        "group inline-flex flex-col items-center gap-1 rounded-2xl px-4 py-2.5 text-[10px] font-black transition-all active:scale-90",
        active
          ? accent
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30"
            : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
          : "bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30"
      )}
    >
      <div className="mb-0.5 transition-transform group-hover:scale-110">
        {active ? onIcon : offIcon}
      </div>
      <span className="hidden sm:inline opacity-80 uppercase tracking-tighter">{active ? labelOn : labelOff}</span>
    </button>
  );
}

function ParticipantRow({ 
  p, 
  canRemove, 
  onRemove 
}: { 
  p: Participant; 
  canRemove?: boolean;
  onRemove?: () => void;
  key?: React.Key 
}) {
  const initial = (p.displayName || "?").trim().charAt(0).toUpperCase();
  const isHost = p.role === "admin";
  return (
    <motion.li 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-white/5 border border-white/5 transition-all hover:bg-white/10"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-lg",
          isHost ? "bg-amber-400 text-slate-950" : "bg-slate-700 text-slate-200"
        )}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-black text-white/90">
            {p.displayName}
          </span>
          {isHost && (
            <span className="rounded-lg bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-300 border border-amber-400/20">
              Host
            </span>
          )}
        </div>
        <span className="text-[9px] uppercase tracking-tighter font-bold text-slate-500">{p.role}</span>
      </div>
      <div className="flex items-center gap-2">
        {p.handRaised && <Hand className="h-3.5 w-3.5 animate-bounce text-amber-400 fill-amber-400" />}
        {p.screenSharing && (
          <MonitorPlay className="h-3.5 w-3.5 text-emerald-400" />
        )}
        <div className="flex items-center gap-1 opacity-60">
          {p.micOn ? (
            <Mic className="h-3 w-3 text-white" />
          ) : (
            <MicOff className="h-3 w-3 text-red-400" />
          )}
          {p.camOn ? (
            <Video className="h-3 w-3 text-white" />
          ) : (
            <VideoOff className="h-3 w-3 text-red-400" />
          )}
        </div>
        {canRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="ml-1 hidden rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 group-hover:block transition-all"
            title="Remove from class"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.li>
  );
}
