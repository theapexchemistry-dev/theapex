// ============================================================================
//  live-sync server — Socket.io relay for Live Classes
// ----------------------------------------------------------------------------
//  Deploys to Render, Railway, Fly.io, or any Node host.
//  Set PORT env var (most hosts do this automatically).
// ============================================================================
import { createServer } from "http";
import { Server } from "socket.io";

// ---------- Types (mirror the frontend) ----------
// (plain JS, but we keep the shape consistent)

// ---------- In-memory stores ----------
const activeMeetings = new Map(); // id -> meeting
const rooms = new Map(); // roomName -> socketId -> participant

function getRoom(roomName) {
  let room = rooms.get(roomName);
  if (!room) {
    room = new Map();
    rooms.set(roomName, room);
  }
  return room;
}

function broadcastParticipants(roomName) {
  const room = rooms.get(roomName);
  if (!room) return;
  const list = Array.from(room.values());
  for (const socketId of room.keys()) {
    io.to(socketId).emit("participants", { roomName, participants: list });
  }
}

function removeSocketFromAllRooms(socketId) {
  for (const [roomName, room] of rooms) {
    if (room.has(socketId)) {
      room.delete(socketId);
      if (room.size === 0) {
        rooms.delete(roomName);
      } else {
        broadcastParticipants(roomName);
      }
    }
  }
}

// ---------- HTTP server (health check) ----------
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "live-sync",
        activeMeetings: activeMeetings.size,
        rooms: rooms.size,
        uptime: process.uptime(),
      })
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("live-sync OK");
});

// ---------- Socket.io server ----------
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[live-sync] client connected: ${socket.id}`);

  // ---- 1. Meeting list sync ----
  socket.emit("active_meetings", Array.from(activeMeetings.values()));

  socket.on("start_meeting", (meeting) => {
    if (!meeting || !meeting.id || !meeting.roomName) return;
    const clean = { ...meeting, active: true, endedAt: null };
    activeMeetings.set(clean.id, clean);
    console.log(`[live-sync] meeting started: ${clean.id} (${clean.title})`);
    io.emit("meeting_started", clean);
  });

  socket.on("end_meeting", (payload) => {
    const { id, endedAt } = payload;
    if (!id) return;
    const existing = activeMeetings.get(id);
    if (existing) {
      existing.active = false;
      existing.endedAt = endedAt;
      activeMeetings.delete(id);
      console.log(`[live-sync] meeting ended: ${id}`);
      io.emit("meeting_ended", { id, endedAt });
    }
  });

  socket.on("delete_meeting", (id) => {
    if (!id) return;
    activeMeetings.delete(id);
    console.log(`[live-sync] meeting deleted: ${id}`);
    io.emit("meeting_deleted", id);
  });

  // ---- 2. Room presence + participant list ----
  socket.on("join_room", (payload) => {
    if (!payload || !payload.roomName) return;
    const participant = {
      id: socket.id,
      displayName: payload.displayName || "Guest",
      role: payload.role || "student",
      micOn: !!payload.micOn,
      camOn: !!payload.camOn,
      screenSharing: !!payload.screenSharing,
      joinedAt: Date.now(),
    };
    const room = getRoom(payload.roomName);
    room.set(socket.id, participant);
    socket.data.roomName = payload.roomName;
    console.log(
      `[live-sync] ${participant.role} "${participant.displayName}" joined room ${payload.roomName} (${socket.id}) — ${room.size} in room`
    );
    broadcastParticipants(payload.roomName);
  });

  socket.on("update_media", (payload) => {
    const roomName = socket.data.roomName;
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (!room) return;
    const p = room.get(socket.id);
    if (!p) return;
    if (typeof payload.micOn === "boolean") p.micOn = payload.micOn;
    if (typeof payload.camOn === "boolean") p.camOn = payload.camOn;
    if (typeof payload.screenSharing === "boolean")
      p.screenSharing = payload.screenSharing;
    broadcastParticipants(roomName);
  });

  socket.on("leave_room", () => {
    const roomName = socket.data.roomName;
    if (!roomName) return;
    const room = rooms.get(roomName);
    if (room) {
      room.delete(socket.id);
      socket.data.roomName = null;
      if (room.size === 0) rooms.delete(roomName);
      else broadcastParticipants(roomName);
    }
  });

  // ---- 3. WebRTC signaling relay ----
  socket.on("webrtc_signal", (msg) => {
    if (!msg || !msg.to) return;
    io.to(msg.to).emit("webrtc_signal", {
      from: socket.id,
      type: msg.type,
      payload: msg.payload,
    });
  });

  // ---- Disconnect cleanup ----
  socket.on("disconnect", (reason) => {
    removeSocketFromAllRooms(socket.id);
    console.log(`[live-sync] client disconnected: ${socket.id} (${reason})`);
  });

  socket.on("error", (err) => {
    console.error(`[live-sync] socket error (${socket.id}):`, err);
  });
});

// ---------- Auto-cleanup: drop stale meetings after 4 hours ----------
const STALE_MS = 4 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, m] of activeMeetings) {
    if (now - m.startedAt > STALE_MS) {
      m.active = false;
      m.endedAt = now;
      activeMeetings.delete(id);
      io.emit("meeting_ended", { id, endedAt: now });
      console.log(`[live-sync] auto-expired stale meeting: ${id}`);
    }
  }
}, 60 * 1000);

// ---------- Start ----------
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[live-sync] WebSocket server running on 0.0.0.0:${PORT}`);
  console.log(`[live-sync] Health check: http://localhost:${PORT}/health`);
});
