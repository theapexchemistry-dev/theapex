import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer as createHttpServer } from "http";
import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

let groqClient: Groq | null = null;
function getGroqClient(): Groq {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY is not configured in environment variables. Please set your Groq API key.");
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey: key });
  }
  return groqClient;
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

  app.use(express.json({ limit: "25mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ---------- SMTP / Gmail Transporter Helper ----------
  const getSmtpTransporter = async (customConfig?: { gmailUser?: string; gmailAppPassword?: string }) => {
    const rawUser = customConfig?.gmailUser || process.env.GMAIL_USER || "theapexchemistry@gmail.com";
    const rawPass = customConfig?.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || "";

    const user = rawUser.trim();
    const pass = rawPass.trim().replace(/\s+/g, "");

    if (!user || !pass) {
      throw new Error(
        "Gmail credentials not configured. Please set your Gmail address and 16-character Google App Password in Admin Settings > Email Configuration, or set GMAIL_USER and GMAIL_APP_PASSWORD."
      );
    }

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user,
        pass
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 30000
    });

    return { transporter, user, pass };
  };

  // ---------- Send Note Email with Attachments ----------
  app.post("/api/send-note-email", async (req, res) => {
    try {
      const { to, subject, bodyHtml, attachment, config } = req.body || {};

      if (!Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ success: false, sentCount: 0, failedEmails: [], error: "No recipients provided." });
      }
      if (!subject || !bodyHtml) {
        return res.status(400).json({ success: false, sentCount: 0, failedEmails: [], error: "Subject and body are required." });
      }

      let smtp;
      try {
        smtp = await getSmtpTransporter(config);
      } catch (authErr: any) {
        return res.status(400).json({
          success: false,
          sentCount: 0,
          failedEmails: to,
          error: authErr.message
        });
      }

      const { transporter, user } = smtp;
      const senderDisplayName = (config?.senderName || "The Apex Chemistry").trim();
      let sentCount = 0;
      const failedEmails: string[] = [];
      let lastErrorMessage = "";

      for (const recipient of to) {
        try {
          const mailOptions: any = {
            from: `"${senderDisplayName}" <${user}>`,
            to: recipient,
            subject,
            html: bodyHtml
          };

          if (attachment && attachment.filename && attachment.content) {
            const base64Match = attachment.content.match(/^data:[^;]+;base64,(.*)$/);
            const base64Data = base64Match ? base64Match[1] : attachment.content;
            mailOptions.attachments = [{
              filename: attachment.filename,
              content: Buffer.from(base64Data, "base64"),
              contentType: attachment.mimeType || "application/octet-stream"
            }];
          }

          await transporter.sendMail(mailOptions);
          sentCount++;
        } catch (sendErr: any) {
          console.error(`[Email] Failed to send to ${recipient}:`, sendErr.message);
          failedEmails.push(recipient);
          lastErrorMessage = sendErr.message || "Failed to send email";
        }
      }

      return res.status(200).json({
        success: sentCount > 0,
        sentCount,
        failedEmails,
        error: sentCount === 0 ? (lastErrorMessage || "Failed to send to recipients.") : undefined
      });
    } catch (err: any) {
      console.error("[Email] Error in send-note-email:", err);
      return res.status(500).json({ success: false, sentCount: 0, failedEmails: [], error: err.message });
    }
  });

  // ---------- General Send Email Route (Fee reminders, Announcements, etc.) ----------
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html, text, config } = req.body || {};
      const recipients = Array.isArray(to) ? to : (to ? [to] : []);

      if (recipients.length === 0 || !subject || (!html && !text)) {
        return res.status(400).json({ success: false, error: "Recipient, subject, and content are required." });
      }

      const { transporter, user } = await getSmtpTransporter(config);
      const senderDisplayName = (config?.senderName || "The Apex Chemistry").trim();

      let sentCount = 0;
      const failedEmails: string[] = [];

      for (const recipient of recipients) {
        try {
          await transporter.sendMail({
            from: `"${senderDisplayName}" <${user}>`,
            to: recipient,
            subject,
            html: html || undefined,
            text: text || undefined
          });
          sentCount++;
        } catch (err: any) {
          console.error(`[Email] Send failed for ${recipient}:`, err.message);
          failedEmails.push(recipient);
        }
      }

      return res.json({
        success: sentCount > 0,
        sentCount,
        failedEmails,
        error: sentCount === 0 ? "Failed to deliver email" : undefined
      });
    } catch (err: any) {
      console.error("[Email] General send-email error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------- Test Email Connection Route ----------
  app.post("/api/test-email", async (req, res) => {
    try {
      const { testEmail, config } = req.body || {};
      if (!testEmail || !testEmail.includes("@")) {
        return res.status(400).json({ success: false, error: "Valid test email recipient is required." });
      }

      const { transporter, user } = await getSmtpTransporter(config);
      
      // 1. Verify SMTP connection
      await transporter.verify();

      // 2. Send test message
      const senderDisplayName = (config?.senderName || "The Apex Chemistry").trim();
      const testHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #4f46e5; margin: 0;">THE APEX CHEMISTRY</h2>
            <p style="color: #16a34a; font-weight: bold; margin: 6px 0 0 0;">✓ Email Dispatch System Test Succeeded</p>
          </div>
          <div style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #cbd5e1;">
            <p style="font-size: 14px; color: #1e293b; line-height: 1.6; margin: 0 0 12px 0;">
              Hello! This is a verification test from <strong>The Apex Chemistry</strong> portal.
            </p>
            <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
              Your Gmail SMTP connection is active and configured correctly. Notes, student credentials, and fee reminders can now be delivered directly to student inboxes.
            </p>
          </div>
          <div style="text-align: center; margin-top: 18px; color: #94a3b8; font-size: 12px;">
            Sender: ${user} • Time: ${new Date().toLocaleString('en-US')}
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${senderDisplayName}" <${user}>`,
        to: testEmail,
        subject: `✓ [Test] The Apex Chemistry Email Dispatch Active`,
        html: testHtml,
        text: `The Apex Chemistry email verification test succeeded. Sent from ${user} at ${new Date().toLocaleString('en-US')}.`
      });

      return res.json({
        success: true,
        message: `Test email successfully sent to ${testEmail} from ${user}!`
      });
    } catch (err: any) {
      console.error("[Email] Test email error:", err);
      let errorHint = err.message || "Failed to send test email";
      if (err.message && (err.message.includes("BadCredentials") || err.message.includes("Invalid login") || err.message.includes("535-5.7.8"))) {
        errorHint = "Google authentication failed (Invalid credentials). Ensure you are using a 16-character Google App Password (not your normal Google account password) and that 2-Step Verification is turned ON.";
      }
      return res.status(400).json({ success: false, error: errorHint });
    }
  });

  // ---------- Auto Send Credentials via Email & WhatsApp ----------
  app.post("/api/notify/credentials", async (req, res) => {
    try {
      const {
        studentId,
        password,
        name,
        phone,
        email,
        className,
        batchTitle,
        portalUrl,
        config
      } = req.body;

      if (!studentId || !name) {
        return res.status(400).json({ error: "Missing studentId or name" });
      }

      const results = {
        email: { sent: false, error: null as string | null },
        whatsapp: { sent: false, error: null as string | null }
      };

      const loginLink = portalUrl || "https://theapexchemistry.web.app";
      const cleanPhone = (phone || "").replace(/\D/g, "");

      // 1. Email notification
      if (email && email.includes("@")) {
        try {
          const { transporter, user } = await getSmtpTransporter(config);
          const senderDisplayName = (config?.senderName || "The Apex Chemistry").trim();

          const htmlContent = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">THE APEX CHEMISTRY</h1>
                <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px; font-weight: 600;">Account Activated & Credentials Confirmation</p>
              </div>

              <div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #cbd5e1; margin-bottom: 20px;">
                <p style="font-size: 15px; color: #1e293b; margin: 0 0 12px 0;">Dear <strong>${name}</strong>,</p>
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
                  Your account enrollment for <strong>${className || 'Chemistry Batch'}</strong> (<em>${batchTitle || 'Regular Batch'}</em>) has been officially approved and activated by <strong>Mr. Subhamoy Mondal</strong>.
                </p>

                <div style="background: #0f172a; color: #ffffff; padding: 18px; border-radius: 10px; margin-bottom: 16px;">
                  <div style="margin-bottom: 8px;">
                    <span style="color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 700;">Student ID:</span>
                    <strong style="color: #818cf8; font-size: 16px; margin-left: 8px; font-family: monospace;">${studentId}</strong>
                  </div>
                  <div>
                    <span style="color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 700;">Password:</span>
                    <strong style="color: #34d399; font-size: 16px; margin-left: 8px; font-family: monospace;">${password || 'apex123'}</strong>
                  </div>
                </div>

                <div style="text-align: center; margin: 24px 0 10px 0;">
                  <a href="${loginLink}" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
                    Login to Student Portal
                  </a>
                </div>
              </div>

              <div style="text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                <p style="margin: 0;"><strong>The Apex Chemistry</strong> • By Mr. Subhamoy Mondal</p>
                <p style="margin: 4px 0 0 0;">For queries or support, contact through your portal or WhatsApp.</p>
              </div>
            </div>
          `;

          await transporter.sendMail({
            from: `"${senderDisplayName}" <${user}>`,
            to: email,
            subject: `🎓 Your Account Credentials - The Apex Chemistry (${studentId})`,
            html: htmlContent,
            text: `Dear ${name},\nYour Apex Chemistry portal credentials are:\nStudent ID: ${studentId}\nPassword: ${password}\nPortal Link: ${loginLink}\n- Mr. Subhamoy Mondal`
          });

          results.email.sent = true;
          console.log(`[Auto-Notify] Credentials email delivered to ${email}`);
        } catch (e: any) {
          console.error("[Auto-Notify] Email delivery failed:", e.message);
          results.email.error = e.message || "Failed to send email";
        }
      }

      // 2. WhatsApp Cloud API notification (if token/phone ID is provided in server environment)
      if (cleanPhone && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
        try {
          const waPhone = cleanPhone.startsWith("91") && cleanPhone.length > 10 ? cleanPhone : `91${cleanPhone}`;
          const waMessage = `🎓 *Welcome to The Apex Chemistry!*\n\nDear *${name}*,\nYour account enrollment for *${className || 'Chemistry'}* (${batchTitle || 'Regular Batch'}) has been approved.\n\n📌 *Student ID:* ${studentId}\n🔑 *Password:* ${password}\n🌐 *Portal Link:* ${loginLink}\n\nYou can now log in to attend live classes, access handwritten notes, view tests, and resolve doubts.\n\n— *Mr. Subhamoy Mondal*\nThe Apex Chemistry`;

          const waRes = await fetch(
            `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: waPhone,
                type: "text",
                text: { body: waMessage }
              })
            }
          );

          if (waRes.ok) {
            results.whatsapp.sent = true;
            console.log(`[Auto-Notify] WhatsApp delivered automatically to ${waPhone}`);
          } else {
            const errBody = await waRes.text();
            results.whatsapp.error = `WhatsApp API responded with status ${waRes.status}: ${errBody}`;
          }
        } catch (e: any) {
          console.error("[Auto-Notify] WhatsApp notification error:", e);
          results.whatsapp.error = e.message || "WhatsApp sending failed";
        }
      } else if (cleanPhone) {
        // Log that WhatsApp webhook or direct dispatch was processed
        results.whatsapp.sent = false;
        results.whatsapp.error = "WhatsApp automated direct dispatch API ready (configured for one-tap WhatsApp / direct Cloud API)";
      }

      res.json({
        success: true,
        message: "Notification processing complete",
        results
      });
    } catch (err: any) {
      console.error("[Auto-Notify] Fatal error in credentials endpoint:", err);
      res.status(500).json({ error: err.message });
    }
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
      const { question, subject, className, image } = req.body || {};
      if (!question && !image) {
        return res.status(400).json({ error: "Please provide a question or attach an image." });
      }

      const userPrompt = `Student Class: ${className || 'Class 11-12 (JEE/NEET aspirant)'}\nSubject Area: ${subject || 'Chemistry'}\n\nStudent Question:\n"""\n${question || 'Please analyze and solve the chemistry problem shown in the attached image.'}\n"""\n\nAnswer as Apex AI. Follow the rules and output format strictly. Return JSON only.`;
      
      const groq = getGroqClient();
      const hasImage = image && typeof image === 'string' && image.startsWith('data:image/');
      const targetModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      
      let messages: any[];
      let model = targetModel;

      if (hasImage) {
        model = 'llama-3.2-11b-vision-preview';
        messages = [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ];
      } else {
        messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ];
      }

      let responseContent = "";
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages,
          temperature: 0.4,
          response_format: { type: "json_object" }
        });
        responseContent = completion.choices[0]?.message?.content || "{}";
      } catch (err: any) {
        // Fallback mechanism if vision or specific model is unavailable
        console.warn(`[Groq AI] Request with model ${model} failed (${err.message}). Attempting fallback.`);
        const fallbackModel = (model === targetModel) ? 'llama-3.3-70b-versatile' : targetModel;
        try {
          const fallbackCompletion = await groq.chat.completions.create({
            model: fallbackModel,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.4,
            response_format: { type: "json_object" }
          });
          responseContent = fallbackCompletion.choices[0]?.message?.content || "{}";
        } catch (fbErr: any) {
          throw err;
        }
      }
      
      res.json({ content: responseContent });
    } catch (err: any) {
      console.error("[Groq AI] Error:", err);
      const errMsg = err?.message || "Failed to generate AI response from Groq";
      res.status(500).json({ error: errMsg });
    }
  });

  app.post("/api/ai/follow-up", async (req, res) => {
    try {
      const { history, newQuestion, subject, className } = req.body || {};
      if (!newQuestion) {
        return res.status(400).json({ error: "Follow-up question is required." });
      }

      const groq = getGroqClient();
      const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT }
      ];

      (Array.isArray(history) ? history : []).forEach((m: any) => {
        messages.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text || ''
        });
      });

      messages.push({
        role: "user",
        content: `Subject Area: ${subject || 'Chemistry'}\nStudent Class: ${className || 'Class 11-12'}\n\nNEW MESSAGE FROM STUDENT:\n"""\n${newQuestion}\n"""\n\nAnswer as Apex AI. Be concise (≤200 words) and reference what was discussed earlier if relevant. Output STRICT JSON in the same format.`
      });
      
      const targetModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      let content = "{}";

      try {
        const completion = await groq.chat.completions.create({
          model: targetModel,
          messages,
          temperature: 0.4,
          response_format: { type: "json_object" }
        });
        content = completion.choices[0]?.message?.content || "{}";
      } catch (err: any) {
        console.warn(`[Groq AI] Follow-up with model ${targetModel} failed (${err.message}). Trying fallback.`);
        const fallbackCompletion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.4,
          response_format: { type: "json_object" }
        });
        content = fallbackCompletion.choices[0]?.message?.content || "{}";
      }
      
      res.json({ content });
    } catch (err: any) {
      console.error("[Groq AI] Follow-up Error:", err);
      const errMsg = err?.message || "Failed to generate AI follow-up response from Groq";
      res.status(500).json({ error: errMsg });
    }
  });

  // ---------- AI Exam Question Paper Generator ----------
  app.post("/api/ai/generate-questions", async (req, res) => {
    try {
      const {
        topic,
        className,
        numQuestions = 10,
        difficulty = "medium",
        customInstructions,
        marksPerQ = 4,
        negativeMarksPerQ = 1
      } = req.body || {};

      if (!topic || typeof topic !== "string" || !topic.trim()) {
        return res.status(400).json({ error: "Exam topic is required to generate questions." });
      }

      const count = Math.min(Math.max(Number(numQuestions) || 10, 1), 30);

      const prompt = `You are a Senior Chemistry Professor and Exam Designer at THE APEX CHEMISTRY (created by Mr. Subhamoy Mondal).
Generate a high-quality, scientifically accurate Chemistry Multiple Choice Question (MCQ) paper for:
- Exam Topic: "${topic.trim()}"
- Class / Target: "${className || 'Class 11 / 12 & JEE/NEET'}"
- Number of Questions: ${count}
- Difficulty Level: "${difficulty}"
${customInstructions ? `- Specific Instructions / Focus Areas: "${customInstructions.trim()}"` : ''}

RULES FOR QUESTIONS:
1. Generate exactly ${count} multiple choice questions.
2. Each question MUST have:
   - "id": unique identifier (e.g. "q-1", "q-2", ...)
   - "question": clear, unambiguous chemistry question with standard IUPAC / chemical notations (e.g. [Fe(CN)6]4-, H2SO4, ΔH, sp3d, etc.).
   - "options": EXACTLY 4 distinct option strings [Option A, Option B, Option C, Option D]. Ensure only ONE is scientifically true/correct.
   - "correctOption": 0 for Option A, 1 for Option B, 2 for Option C, 3 for Option D.
   - "explanation": 1-2 sentence detailed step-by-step conceptual or numerical explanation justifying the correct option.
   - "marks": ${marksPerQ}
   - "negativeMarks": ${negativeMarksPerQ}
3. Distribute the correct options fairly (do not make all of them option A or B).

OUTPUT FORMAT: Return STRICT JSON ONLY (no markdown code blocks, no backticks, no trailing comments):
{
  "topic": "${topic.trim()}",
  "questions": [
    {
      "id": "q-1",
      "question": "Question text here...",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctOption": 0,
      "explanation": "Explanation here..."
    }
  ]
}`;

      let rawOutput = "";
      const gemini = getGeminiClient();

      if (gemini) {
        try {
          console.log(`[AI Question Generator] Generating ${count} questions on "${topic}" using Gemini 3.7 Flash...`);
          const geminiResponse = await gemini.models.generateContent({
            model: "gemini-3.7-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.3
            }
          });
          rawOutput = geminiResponse.text || "";
        } catch (geminiErr: any) {
          console.warn("[AI Question Generator] Gemini error, trying Groq fallback:", geminiErr.message);
        }
      }

      if (!rawOutput) {
        try {
          console.log(`[AI Question Generator] Generating with Groq fallback...`);
          const groq = getGroqClient();
          const targetModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
          const completion = await groq.chat.completions.create({
            model: targetModel,
            messages: [
              {
                role: "system",
                content: "You are an expert Chemistry exam question creator. Always respond with strict valid JSON only."
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          });
          rawOutput = completion.choices[0]?.message?.content || "";
        } catch (groqErr: any) {
          console.error("[AI Question Generator] Groq error:", groqErr);
          throw new Error("Both Gemini and Groq AI services were unable to generate questions. " + groqErr.message);
        }
      }

      // Parse JSON from output
      let cleaned = rawOutput.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsedData = JSON.parse(cleaned);
      const generatedQuestions = Array.isArray(parsedData.questions) ? parsedData.questions : [];

      // Validate & clean questions
      const validatedQuestions = generatedQuestions.map((q: any, idx: number) => {
        const rawOpts = Array.isArray(q.options) ? q.options : [];
        const finalOptions: [string, string, string, string] = [
          String(rawOpts[0] || "Option A"),
          String(rawOpts[1] || "Option B"),
          String(rawOpts[2] || "Option C"),
          String(rawOpts[3] || "Option D")
        ];

        let correct = typeof q.correctOption === "number" ? q.correctOption : 0;
        if (correct < 0 || correct > 3) correct = 0;

        return {
          id: `ai-q-${Date.now()}-${idx + 1}`,
          question: String(q.question || `Question ${idx + 1}`).trim(),
          options: finalOptions,
          correctOption: correct,
          explanation: String(q.explanation || "").trim(),
          marks: marksPerQ,
          negativeMarks: negativeMarksPerQ
        };
      });

      if (validatedQuestions.length === 0) {
        return res.status(500).json({ error: "AI failed to produce valid questions. Please try again." });
      }

      res.json({
        success: true,
        topic: topic.trim(),
        count: validatedQuestions.length,
        questions: validatedQuestions
      });
    } catch (err: any) {
      console.error("[AI Question Generator] Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate AI questions" });
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
