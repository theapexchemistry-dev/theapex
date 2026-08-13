import { useCallback, useEffect, useRef, useState } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "./firebase";
import { 
  subscribeToAllMeetings, 
  startMeeting as fsStartMeeting, 
  endMeeting as fsEndMeeting, 
  deleteMeeting as fsDeleteMeeting,
  LiveMeeting 
} from "./firebaseSync";

// ============================================================================
//  Types
// ============================================================================
export type { LiveMeeting };

export interface Participant {
  id: string;
  displayName: string;
  role: "admin" | "student";
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
  screenSharing: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
}

// ============================================================================
//  WebRTC config
// ============================================================================
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ============================================================================
//  Hook 1 — useMeetings: real-time meeting list sync using Firestore
// ============================================================================
export function useMeetings() {
  const [meetings, setMeetings] = useState<LiveMeeting[]>([]);
  const [connected, setConnected] = useState(true); // Firestore is always "connected" concept-wise

  useEffect(() => {
    // Use the Firestore-backed subscription from firebaseSync.ts
    const unsub = subscribeToAllMeetings((list) => {
      setMeetings(list);
    });
    return unsub;
  }, []);

  const startMeeting = useCallback((meeting: LiveMeeting) => {
    fsStartMeeting(meeting);
  }, []);

  const endMeeting = useCallback((id: string) => {
    fsEndMeeting(id);
  }, []);

  const deleteMeeting = useCallback((id: string) => {
    fsDeleteMeeting(id);
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
//  Hook 2 — useMeetingRoom: WebRTC room + participant list via Firestore
// ============================================================================
interface UseMeetingRoomArgs {
  active: boolean;
  meetingId: string; // We use meeting.id as the root for collections
  displayName: string;
  role: "admin" | "student";
}

export function useMeetingRoom({
  active,
  meetingId,
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
  const [handRaised, setHandRaised] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [error, setError] = useState<string>("");

  const participantIdRef = useRef<string>(Math.random().toString(36).substring(2, 15));
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const mainRemoteRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const roleRef = useRef(role);
  const displayRef = useRef(displayName);
  const meetingIdRef = useRef(meetingId);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);
  useEffect(() => {
    displayRef.current = displayName;
  }, [displayName]);
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  // --- Signaling Helpers ---
  const sendSignal = useCallback(async (to: string, type: string, payload: any) => {
    if (!meetingIdRef.current) return;
    try {
      const signalsCol = collection(db, "liveMeetings", meetingIdRef.current, "signals");
      await addDoc(signalsCol, {
        to,
        from: participantIdRef.current,
        type,
        payload: JSON.parse(JSON.stringify(payload)), // Deep clone for Firestore safety
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("[webrtc] sendSignal failed", err);
    }
  }, []);

  const createAdminPC = useCallback((peerId: string) => {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId)!;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(peerId, pc);

    const ls = localStreamRef.current;
    if (ls) {
      ls.getTracks().forEach((t) => {
        try { pc.addTrack(t, ls); } catch { /* ignore */ }
      });
    }
    const ss = screenStreamRef.current;
    if (ss) {
      ss.getVideoTracks().forEach((t) => {
        try { pc.addTrack(t, ss); } catch { /* ignore */ }
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(peerId, "ice", e.candidate);
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams && e.streams[0] ? e.streams[0] : null;
      if (stream) {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(peerId, stream);
          return next;
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(await pc.createOffer());
        sendSignal(peerId, "offer", pc.localDescription);
      } catch (err) {
        console.error("[webrtc] admin offer failed", err);
      }
    };

    // Trigger offer immediately if tracks are present
    if (ls || ss) {
      setTimeout(async () => {
        if (pc.signalingState === "stable") {
          try {
            await pc.setLocalDescription(await pc.createOffer());
            sendSignal(peerId, "offer", pc.localDescription);
          } catch (err) {
            console.error("[webrtc] admin manual offer failed", err);
          }
        }
      }, 300);
    }

    return pc;
  }, [sendSignal]);

  const createStudentPC = useCallback((adminId: string) => {
    if (pcsRef.current.has(adminId)) return pcsRef.current.get(adminId)!;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(adminId, pc);

    const ls = localStreamRef.current;
    if (ls) {
      ls.getTracks().forEach((t) => {
        try { pc.addTrack(t, ls); } catch { /* ignore */ }
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(adminId, "ice", e.candidate);
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(await pc.createOffer());
        sendSignal(adminId, "offer", pc.localDescription);
      } catch (err) {
        console.error("[webrtc] student offer failed", err);
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
        e.track.onended = () => { setRemoteScreen(null); };
      }
    };

    return pc;
  }, [sendSignal]);

  const flushPendingIce = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (!pc) return;
    const pending = pendingIceRef.current.get(peerId);
    if (!pending) return;
    pending.forEach(async (c) => {
      try { await pc.addIceCandidate(c); } catch (err) { console.warn("[webrtc] ice failed", err); }
    });
    pendingIceRef.current.delete(peerId);
  }, []);

  const requestMedia = useCallback(async () => {
    setError("");
    console.log("[webrtc] requesting media...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      console.log("[webrtc] media stream acquired");
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      setCamOn(true);

      pcsRef.current.forEach((pc) => {
        stream.getTracks().forEach((t) => {
          try { pc.addTrack(t, stream); } catch { /* ignore */ }
        });
      });

      // Update presence
      const presenceDoc = doc(db, "liveMeetings", meetingIdRef.current, "participants", participantIdRef.current);
      await setDoc(presenceDoc, { micOn: true, camOn: true }, { merge: true });

      return true;
    } catch (err) {
      console.error("[webrtc] media failed", err);
      setError("Could not access camera/microphone. Please ensure you have given permissions.");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!active || !meetingId) return;
    let mounted = true;

    // 1. Join Room (Presence)
    const presenceDoc = doc(db, "liveMeetings", meetingId, "participants", participantIdRef.current);
    const joinRoom = async () => {
      try {
        console.log(`[webrtc] joining room ${meetingId}...`);
        await setDoc(presenceDoc, {
          id: participantIdRef.current,
          displayName: displayRef.current,
          role: roleRef.current,
          micOn: roleRef.current === "admin",
          camOn: roleRef.current === "admin",
          handRaised: false,
          screenSharing: false,
          joinedAt: Date.now(),
          lastSeen: serverTimestamp(), // For cleanup
        });
        if (mounted) {
          console.log("[webrtc] room joined successfully");
          setConnected(true);
          if (roleRef.current === "admin") {
            requestMedia();
          }
        }
      } catch (err) {
        console.error("[webrtc] joinRoom failed", err);
        if (mounted) setError("Failed to join classroom. Please check your connection.");
      }
    };
    joinRoom();

    // 2. Listen for Participants
    const participantsCol = collection(db, "liveMeetings", meetingId, "participants");
    const unsubParticipants = onSnapshot(participantsCol, (snap) => {
      if (!mounted) return;
      const list = snap.docs.map(d => d.data() as Participant);
      setParticipants(list);

      // WebRTC Logic
      if (roleRef.current === "admin") {
        const studentIds = list
          .filter(p => p.role === "student" && p.id !== participantIdRef.current)
          .map(p => p.id);
        
        studentIds.forEach(sid => {
          if (!pcsRef.current.has(sid)) createAdminPC(sid);
        });

        // Close stale
        for (const peerId of Array.from(pcsRef.current.keys()) as string[]) {
          if (!studentIds.includes(peerId)) {
            pcsRef.current.get(peerId)?.close();
            pcsRef.current.delete(peerId);
          }
        }
      } else {
        const adminP = list.find(p => p.role === "admin");
        if (!adminP) {
          pcsRef.current.forEach(pc => pc.close());
          pcsRef.current.clear();
          mainRemoteRef.current = null;
          setAdminStream(null);
          setRemoteScreen(null);
        } else if (!adminP.screenSharing) {
          setRemoteScreen(null);
        }
      }
    });

    // 3. Listen for Signals (Signaling Bridge)
    const signalsCol = collection(db, "liveMeetings", meetingId, "signals");
    const q = query(signalsCol, where("to", "==", participantIdRef.current), orderBy("timestamp", "asc"));
    const unsubSignals = onSnapshot(q, (snap) => {
      if (!mounted) return;
      snap.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const msg = change.doc.data();
          const { from, type, payload } = msg;

          if (roleRef.current === "student") {
            if (type === "offer") {
              let pc = pcsRef.current.get(from);
              if (!pc) pc = createStudentPC(from);
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                flushPendingIce(from);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(from, "answer", answer);
              } catch (err) { console.error("[webrtc] offer fail", err); }
            } else if (type === "ice") {
              const pc = pcsRef.current.get(from);
              if (!pc) return;
              if (!pc.remoteDescription) {
                const arr = pendingIceRef.current.get(from) || [];
                arr.push(payload);
                pendingIceRef.current.set(from, arr);
              } else {
                try { await pc.addIceCandidate(new RTCIceCandidate(payload)); } catch (e) { /* ignore */ }
              }
            }
          } else {
            const pc = pcsRef.current.get(from);
            if (!pc) return;
            if (type === "offer") {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                flushPendingIce(from);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(from, "answer", answer);
              } catch (e) { console.error("[webrtc] admin offer handle fail", e); }
            } else if (type === "answer") {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                flushPendingIce(from);
              } catch (e) { console.error("[webrtc] answer fail", e); }
            } else if (type === "ice") {
              if (!pc.remoteDescription) {
                const arr = pendingIceRef.current.get(from) || [];
                arr.push(payload);
                pendingIceRef.current.set(from, arr);
              } else {
                try { await pc.addIceCandidate(new RTCIceCandidate(payload)); } catch (e) { /* ignore */ }
              }
            }
          }
          // Optional: delete signal doc after processing to keep collection clean
          deleteDoc(change.doc.ref).catch(() => {});
        }
      });
    });

    return () => {
      mounted = false;
      unsubParticipants();
      unsubSignals();
      deleteDoc(presenceDoc).catch(() => {});
      
      pcsRef.current.forEach(pc => pc.close());
      pcsRef.current.clear();
      
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
      
      setLocalStream(null);
      setAdminStream(null);
      setConnected(false);
      setParticipants([]);
    };
  }, [active, meetingId, createAdminPC, createStudentPC, flushPendingIce, sendSignal, requestMedia]);

  const toggleMic = useCallback(async () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const next = !micOn;
    ls.getAudioTracks().forEach(t => { t.enabled = next; });
    setMicOn(next);
    const presenceDoc = doc(db, "liveMeetings", meetingIdRef.current, "participants", participantIdRef.current);
    await setDoc(presenceDoc, { micOn: next }, { merge: true });
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const next = !camOn;
    ls.getVideoTracks().forEach(t => { t.enabled = next; });
    setCamOn(next);
    const presenceDoc = doc(db, "liveMeetings", meetingIdRef.current, "participants", participantIdRef.current);
    await setDoc(presenceDoc, { camOn: next }, { merge: true });
  }, [camOn]);

  const stopScreenShare = useCallback(async () => {
    const ss = screenStreamRef.current;
    if (!ss) return;
    const track = ss.getVideoTracks()[0];
    pcsRef.current.forEach(pc => {
      const s = pc.getSenders().find(s => s.track?.id === track?.id);
      if (s) try { pc.removeTrack(s); } catch { /* ignore */ }
    });
    ss.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
    const presenceDoc = doc(db, "liveMeetings", meetingIdRef.current, "participants", participantIdRef.current);
    await setDoc(presenceDoc, { screenSharing: false }, { merge: true });
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setScreenStream(stream);
      setScreenSharing(true);
      pcsRef.current.forEach(pc => {
        try { pc.addTrack(track, stream); } catch { /* ignore */ }
      });
      track.onended = stopScreenShare;
      const presenceDoc = doc(db, "liveMeetings", meetingIdRef.current, "participants", participantIdRef.current);
      await setDoc(presenceDoc, { screenSharing: true }, { merge: true });
    } catch { setError("Screen share failed."); }
  }, [stopScreenShare]);

  const toggleScreen = useCallback(() => {
    if (screenSharing) stopScreenShare();
    else startScreenShare();
  }, [screenSharing, startScreenShare, stopScreenShare]);

  const toggleHand = useCallback(async () => {
    const next = !handRaised;
    setHandRaised(next);
    const presenceDoc = doc(db, "liveMeetings", meetingIdRef.current, "participants", participantIdRef.current);
    await setDoc(presenceDoc, { handRaised: next }, { merge: true });
  }, [handRaised]);

  const leave = useCallback(() => {
    const presenceDoc = doc(db, "liveMeetings", meetingIdRef.current, "participants", participantIdRef.current);
    deleteDoc(presenceDoc).catch(() => {});
  }, []);

  return {
    connected,
    participants,
    localStream,
    screenStream,
    adminStream,
    remoteScreen,
    remoteStreams,
    adminParticipant: participants.find(p => p.role === "admin") || null,
    participantId: participantIdRef.current,
    micOn,
    camOn,
    handRaised,
    screenSharing,
    error,
    requestMedia,
    toggleMic,
    toggleCam,
    toggleScreen,
    toggleHand,
    leave,
  };
}

// ============================================================================
//  Hook 3 — useChat: Real-time chat sync
// ============================================================================
export function useChat(meetingId: string, userId: string, userName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!meetingId) return;
    const messagesCol = collection(db, "liveMeetings", meetingId, "messages");
    const q = query(messagesCol, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ChatMessage[];
      setMessages(list);
    });

    return unsub;
  }, [meetingId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!meetingId || !text.trim()) return;
      try {
        const messagesCol = collection(db, "liveMeetings", meetingId, "messages");
        await addDoc(messagesCol, {
          senderId: userId,
          senderName: userName,
          text: text.trim(),
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error("[chat] sendMessage failed", err);
      }
    },
    [meetingId, userId, userName]
  );

  return { messages, sendMessage };
}

