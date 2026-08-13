import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

// ============================================================================
//  Types
// ============================================================================
export interface LiveMeeting {
  id: string;
  title: string;
  scope: "batch" | "all";
  batchId?: string | null;
  batchTitle?: string | null;
  className?: string | null;
  teacherName: string;
  roomName: string;
  startedAt: number;
  active: boolean;
  endedAt?: number | null;
  createdAt: number;
}

export interface Participant {
  id: string;
  displayName: string;
  role: "admin" | "student";
  micOn: boolean;
  camOn: boolean;
  screenSharing: boolean;
  joinedAt: number;
}

// ============================================================================
//  Socket config
// ============================================================================
const SOCKET_URL =
  (import.meta as any).env?.VITE_LIVE_SYNC_URL || "http://localhost:3001";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function makeSocket(): Socket {
  return io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
}

// ============================================================================
//  Hook 1 — useMeetings: real-time meeting list sync
// ============================================================================
export function useMeetings() {
  const [meetings, setMeetings] = useState<LiveMeeting[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = makeSocket();
    let mounted = true;

    const onConn = () => mounted && setConnected(true);
    const onDisc = () => mounted && setConnected(false);
    const onActive = (list: LiveMeeting[]) =>
      mounted && setMeetings(Array.isArray(list) ? list : []);
    const onStarted = (m: LiveMeeting) =>
      mounted &&
      setMeetings((prev) =>
        prev.some((x) => x.id === m.id)
          ? prev.map((x) => (x.id === m.id ? m : x))
          : [m, ...prev]
      );
    const onEnded = (p: { id: string; endedAt: number }) =>
      mounted &&
      setMeetings((prev) =>
        prev.map((x) =>
          x.id === p.id ? { ...x, active: false, endedAt: p.endedAt } : x
        )
      );
    const onDeleted = (id: string) =>
      mounted && setMeetings((prev) => prev.filter((x) => x.id !== id));

    socket.on("connect", onConn);
    socket.on("disconnect", onDisc);
    socket.on("active_meetings", onActive);
    socket.on("meeting_started", onStarted);
    socket.on("meeting_ended", onEnded);
    socket.on("meeting_deleted", onDeleted);

    return () => {
      mounted = false;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const startMeeting = useCallback((meeting: LiveMeeting) => {
    const s = makeSocket();
    s.emit("start_meeting", meeting);
    setMeetings((prev) =>
      prev.some((x) => x.id === meeting.id) ? prev : [meeting, ...prev]
    );
    setTimeout(() => s.disconnect(), 500);
  }, []);

  const endMeeting = useCallback((id: string) => {
    const s = makeSocket();
    s.emit("end_meeting", { id, endedAt: Date.now() });
    setMeetings((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, active: false, endedAt: Date.now() } : x
      )
    );
    setTimeout(() => s.disconnect(), 500);
  }, []);

  const deleteMeeting = useCallback((id: string) => {
    const s = makeSocket();
    s.emit("delete_meeting", id);
    setMeetings((prev) => prev.filter((x) => x.id !== id));
    setTimeout(() => s.disconnect(), 500);
  }, []);

  const activeMeetings = meetings.filter((m) => m.active);
  const pastMeetings = meetings.filter((m) => !m.active);

  return {
    meetings,
    activeMeetings,
    pastMeetings,
    connected,
    startMeeting,
    endMeeting,
    deleteMeeting,
  };
}

// ============================================================================
//  Hook 2 — useMeetingRoom: WebRTC room + participant list
// ============================================================================
interface UseMeetingRoomArgs {
  active: boolean;
  roomName: string | null;
  displayName: string;
  role: "admin" | "student";
}

export function useMeetingRoom({
  active,
  roomName,
  displayName,
  role,
}: UseMeetingRoomArgs) {
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [adminStream, setAdminStream] = useState<MediaStream | null>(null);
  const [remoteScreen, setRemoteScreen] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(role === "admin");
  const [camOn, setCamOn] = useState(role === "admin");
  const [screenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const mainRemoteRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const roleRef = useRef(role);
  const displayRef = useRef(displayName);
  const screenTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);
  useEffect(() => {
    displayRef.current = displayName;
  }, [displayName]);

  const createAdminPC = useCallback((peerId: string) => {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId)!;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(peerId, pc);

    const ls = localStreamRef.current;
    if (ls) {
      ls.getTracks().forEach((t) => {
        try {
          pc.addTrack(t, ls);
        } catch {
          /* already added */
        }
      });
    }
    const ss = screenStreamRef.current;
    if (ss) {
      ss.getVideoTracks().forEach((t) => {
        try {
          pc.addTrack(t, ss);
        } catch {
          /* ignore */
        }
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("webrtc_signal", {
          to: peerId,
          type: "ice",
          payload: e.candidate,
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        await pc.setLocalDescription(await pc.createOffer());
        if (socketRef.current) {
          socketRef.current.emit("webrtc_signal", {
            to: peerId,
            type: "offer",
            payload: pc.localDescription,
          });
        }
      } catch (err) {
        console.error("[webrtc] admin offer failed", err);
      }
    };

    pc.ontrack = () => {
      /* no-op */
    };

    return pc;
  }, []);

  const createStudentPC = useCallback((adminId: string) => {
    if (pcsRef.current.has(adminId)) return pcsRef.current.get(adminId)!;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(adminId, pc);

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("webrtc_signal", {
          to: adminId,
          type: "ice",
          payload: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams && e.streams[0] ? e.streams[0] : null;
      if (!stream) return;
      if (!mainRemoteRef.current) {
        mainRemoteRef.current = stream;
        setAdminStream(stream);
      } else if (stream !== mainRemoteRef.current) {
        setRemoteScreen(stream);
        e.track.onended = () => {
          setRemoteScreen(null);
        };
      }
    };

    return pc;
  }, []);

  const flushPendingIce = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (!pc) return;
    const pending = pendingIceRef.current.get(peerId);
    if (!pending) return;
    pending.forEach(async (c) => {
      try {
        await pc.addIceCandidate(c);
      } catch (err) {
        console.warn("[webrtc] flush addIceCandidate failed", err);
      }
    });
    pendingIceRef.current.delete(peerId);
  }, []);

  useEffect(() => {
    if (!active || !roomName) return;
    let mounted = true;

    const socket = makeSocket();
    socketRef.current = socket;

    socket.on("connect", async () => {
      if (!mounted) return;
      setConnected(true);

      if (roleRef.current === "admin") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          });
          if (!mounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = stream;
          setLocalStream(stream);
          setMicOn(true);
          setCamOn(true);
        } catch (err) {
          console.error("[webrtc] getUserMedia failed", err);
          setError(
            "Could not access camera/microphone. Please allow access and retry."
          );
        }
      }

      socket.emit("join_room", {
        roomName,
        displayName: displayRef.current,
        role: roleRef.current,
        micOn: roleRef.current === "admin",
        camOn: roleRef.current === "admin",
        screenSharing: false,
      });
    });

    socket.on("disconnect", () => {
      if (mounted) setConnected(false);
    });

    socket.on(
      "participants",
      (data: { roomName: string; participants: Participant[] }) => {
        if (!mounted) return;
        setParticipants(data.participants || []);

        if (roleRef.current === "admin") {
          const studentIds = data.participants
            .filter((p) => p.role === "student" && p.id !== socket.id)
            .map((p) => p.id);
          studentIds.forEach((sid) => {
            if (!pcsRef.current.has(sid)) {
              createAdminPC(sid);
            }
          });
          for (const peerId of Array.from(pcsRef.current.keys())) {
            if (!studentIds.includes(peerId)) {
              const pc = pcsRef.current.get(peerId)!;
              try {
                pc.close();
              } catch {
                /* ignore */
              }
              pcsRef.current.delete(peerId);
            }
          }
        } else {
          const adminP = data.participants.find((p) => p.role === "admin");
          if (!adminP) {
            for (const pc of Array.from(pcsRef.current.values())) {
              try {
                pc.close();
              } catch {
                /* ignore */
              }
            }
            pcsRef.current.clear();
            mainRemoteRef.current = null;
            setAdminStream(null);
            setRemoteScreen(null);
          } else if (!adminP.screenSharing) {
            setRemoteScreen(null);
          }
        }
      }
    );

    socket.on(
      "webrtc_signal",
      async (msg: { from: string; type: string; payload: any }) => {
        if (!mounted || !msg) return;
        const { from, type, payload } = msg;

        if (roleRef.current === "student") {
          if (type === "offer") {
            let pc = pcsRef.current.get(from);
            if (!pc) pc = createStudentPC(from);
            try {
              await pc.setRemoteDescription(payload);
              flushPendingIce(from);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("webrtc_signal", {
                to: from,
                type: "answer",
                payload: answer,
              });
            } catch (err) {
              console.error("[webrtc] student answer failed", err);
            }
          } else if (type === "ice") {
            const pc = pcsRef.current.get(from);
            if (!pc) return;
            if (!pc.remoteDescription || !pc.remoteDescription.type) {
              const arr = pendingIceRef.current.get(from) || [];
              arr.push(payload as RTCIceCandidate);
              pendingIceRef.current.set(from, arr);
            } else {
              try {
                await pc.addIceCandidate(payload);
              } catch (err) {
                console.warn("[webrtc] student addIceCandidate failed", err);
              }
            }
          }
        } else {
          const pc = pcsRef.current.get(from);
          if (!pc) return;
          if (type === "answer") {
            try {
              await pc.setRemoteDescription(payload);
              flushPendingIce(from);
            } catch (err) {
              console.error("[webrtc] admin setRemoteDescription failed", err);
            }
          } else if (type === "ice") {
            if (!pc.remoteDescription || !pc.remoteDescription.type) {
              const arr = pendingIceRef.current.get(from) || [];
              arr.push(payload as RTCIceCandidate);
              pendingIceRef.current.set(from, arr);
            } else {
              try {
                await pc.addIceCandidate(payload);
              } catch (err) {
                console.warn("[webrtc] admin addIceCandidate failed", err);
              }
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      for (const pc of Array.from(pcsRef.current.values())) {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      pcsRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      mainRemoteRef.current = null;
      screenTrackIdRef.current = null;
      pendingIceRef.current.clear();
      try {
        socket.emit("leave_room");
      } catch {
        /* ignore */
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setLocalStream(null);
      setScreenStream(null);
      setAdminStream(null);
      setRemoteScreen(null);
      setParticipants([]);
      setConnected(false);
      setMicOn(false);
      setCamOn(false);
      setScreenSharing(false);
    };
  }, [active, roomName, createAdminPC, createStudentPC, flushPendingIce]);

  const toggleMic = useCallback(() => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const next = !micOn;
    ls.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
    socketRef.current?.emit("update_media", { micOn: next });
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const next = !camOn;
    ls.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
    socketRef.current?.emit("update_media", { camOn: next });
  }, [camOn]);

  const stopScreenShare = useCallback(() => {
    const ss = screenStreamRef.current;
    if (!ss) return;
    const screenTrack = ss.getVideoTracks()[0];
    for (const pc of Array.from(pcsRef.current.values())) {
      try {
        const senders = pc.getSenders();
        const screenSender = senders.find(
          (s) => s.track && s.track.id === screenTrack?.id
        );
        if (screenSender) {
          pc.removeTrack(screenSender);
        }
      } catch (err) {
        console.warn("[webrtc] removeTrack(screen) failed", err);
      }
    }
    ss.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    screenTrackIdRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
    socketRef.current?.emit("update_media", { screenSharing: false });
  }, []);

  const startScreenShare = useCallback(async () => {
    if (screenStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      screenTrackIdRef.current = track?.id || null;
      setScreenStream(stream);
      setScreenSharing(true);

      for (const pc of Array.from(pcsRef.current.values())) {
        try {
          pc.addTrack(track, stream);
        } catch (err) {
          console.warn("[webrtc] addTrack(screen) failed", err);
        }
      }

      track.onended = () => {
        stopScreenShare();
      };

      socketRef.current?.emit("update_media", { screenSharing: true });
    } catch (err) {
      console.error("[webrtc] getDisplayMedia failed", err);
      setError("Screen share was cancelled or could not be started.");
    }
  }, [stopScreenShare]);

  const toggleScreen = useCallback(() => {
    if (screenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [screenSharing, startScreenShare, stopScreenShare]);

  const leave = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      socketRef.current?.emit("leave_room");
    } catch {
      /* ignore */
    }
  }, []);

  const adminParticipant =
    participants.find((p) => p.role === "admin") || null;

  return {
    connected,
    participants,
    localStream,
    screenStream,
    adminStream,
    remoteScreen,
    adminParticipant,
    micOn,
    camOn,
    screenSharing,
    error,
    toggleMic,
    toggleCam,
    toggleScreen,
    leave,
  };
}
