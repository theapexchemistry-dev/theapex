import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer as createHttpServer } from "http";
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
function getAiClient() {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set.");
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const httpServer = createHttpServer(app);

  // ---------- Socket.io server ----------
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const activeMeetings = new Map(); // id -> meeting
  const rooms = new Map(); // roomName -> socketId -> participant

  function getRoom(roomName: string) {
    let room = rooms.get(roomName);
    if (!room) {
      room = new Map();
      rooms.set(roomName, room);
    }
    return room;
  }

  function broadcastParticipants(roomName: string) {
    const room = rooms.get(roomName);
    if (!room) return;
    const list = Array.from(room.values());
    for (const socketId of room.keys()) {
      io.to(socketId).emit("participants", { roomName, participants: list });
    }
  }

  function removeSocketFromAllRooms(socketId: string) {
    for (const [roomName, room] of rooms.entries()) {
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

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const SYSTEM_PROMPT = `You are "Apex AI", a chemistry teaching assistant working for THE APEX WORLD — an Indian chemistry tuition portal run by Mr. Subhamoy Mondal. Your role is to help students in classes 9-12 (and JEE/NEET aspirants) with Physical, Organic, and Inorganic chemistry doubts.

RULES:
1. Answer in clear, simple English a Class 11 student can understand.
2. Show step-by-step working for numerical problems (units, formulas, substitutions, final answer with correct units).
3. For reaction mechanisms, draw out the steps textually with arrow notation (->).
4. Always explain the underlying concept in 1-2 lines before giving the answer.
5. Keep the answer under ~250 words unless the question genuinely needs more.
6. Use plain text notation for formulas when helpful, e.g. H2O, CH3COOH, n = PV/RT.
7. If you are unsure, or the question requires seeing a specific exam/paper, or the student's question is unclear, set needsFaculty=true and briefly explain what the faculty should clarify.
8. End every answer with one short follow-up question that probes the student's deeper understanding (e.g. "Can you tell me why the carbocation forms at the more substituted carbon?").
9. NEVER invent factual data. If a number is uncertain, say so.

OUTPUT FORMAT — return STRICT JSON only, no markdown fences, no extra text:
{
  "answer": "your step-by-step explanation here",
  "confidence": "high | medium | low",
  "followUpQuestion": "one short probing question",
  "needsFaculty": false
}`;

  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { question, subject, className } = req.body;
      const userPrompt = `Student Class: ${className || 'Class 11-12 (JEE/NEET aspirant)'}\nSubject Area: ${subject}\n\nStudent Question:\n"""\n ${question}\n"""\n\nAnswer as Apex AI. Follow the rules and output format strictly. Return JSON only.`;
      
      const client = getAiClient();
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.4,
          responseMimeType: "application/json",
        }
      });
      
      res.json({ content: response.text });
    } catch (err: any) {
      console.error("[AI] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/follow-up", async (req, res) => {
    try {
      const { history, newQuestion, subject, className } = req.body;
      const contents = history.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      contents.push({
        role: "user",
        parts: [{
          text: `Subject Area: ${subject}\nStudent Class: ${className || 'Class 11-12'}\n\nNEW MESSAGE FROM STUDENT:\n"""\n ${newQuestion}\n"""\n\nAnswer as Apex AI. Be concise (≤200 words) and reference what was discussed earlier if relevant. Output STRICT JSON in the same format.`
        }]
      });
      
      const client = getAiClient();
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.4,
          responseMimeType: "application/json",
        }
      });
      
      res.json({ content: response.text });
    } catch (err: any) {
      console.error("[AI] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
