const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");
const cors = require("cors");
const os = require("os");
const fs = require("fs");

require("dotenv").config();

const app = express();
const PORT = 3001;

const ai = new GoogleGenAI({});
const sessions = new Map();

const VOICE = process.env.TTS_VOICE || "en-US-AndrewNeural";
const isWindows = os.platform() === "win32";
const pythonCmd = isWindows ? "python" : "python3";

app.use(cors({
  origin: "http://localhost:3000",
  exposedHeaders: ["X-Session-Id", "X-Segments"],
}));
app.use(express.static("public"));
app.use(express.json());

// ── Text cleaning ──────────────────────────────────────────────
function cleanTextForDisplay(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/gm, "")
    .trim();
}

function cleanTextForSpeech(text) {
  return cleanTextForDisplay(text)
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Sessions ───────────────────────────────────────────────────
function getSession(sessionId) {
  if (!sessionId) sessionId = crypto.randomUUID();
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], createdAt: Date.now() });
  }
  return { sessionId, session: sessions.get(sessionId) };
}

function addToHistory(session, role, text) {
  session.history.push({ role, text });
  if (session.history.length > 20) session.history = session.history.slice(-20);
}

function buildConversationContext(history) {
  if (!history.length) return "No previous conversation yet.";
  return history
    .map(item => `${item.role === "user" ? "Student" : "Miss TMS"}: ${item.text}`)
    .join("\n");
}

// ── Gemini ─────────────────────────────────────────────────────
async function getGeminiResponse(prompt, history = [], retries = 2) {
  console.log("🤖 Thinking...");
  const context = buildConversationContext(history);

  const enhancedPrompt = `
You are Miss TMS, a warm and patient teacher having a one-on-one lesson with a student.

YOUR TEACHING STYLE:
- Teach in SHORT chunks — never more than 2-3 sentences at a time before pausing.
- Always pause and check in. Ask the student a question to verify understanding before moving on.
- Questions should be direct: either a concept check ("What do you think happens when...?") or a small worked example ("Can you try: what is 3 × 4?").
- Be encouraging but concise. No long speeches.
- If the student's answer is wrong, gently correct and re-explain just that part, then ask again.
- If the student's answer is right, praise briefly and move to the next chunk.
- Never dump the full answer. Teach step by step, waiting for the student.

OUTPUT FORMAT — you MUST follow this exactly:
Split your response into segments using the delimiter: |||

Each segment is either:
  EXPLAIN: <short explanation, 1-3 sentences, plain text>
  QUESTION: <a single direct question for the student, plain text>

Rules:
- Always end with a QUESTION segment (never end with EXPLAIN).
- Maximum 2 EXPLAIN segments per response, then a QUESTION.
- Plain text only — no markdown, asterisks, bullet points, hashtags, LaTeX.
- Keep each segment short. Students get overwhelmed by walls of text.

Example of correct format:
EXPLAIN: Water boils at 100 degrees Celsius at sea level. That's when it turns from liquid into steam.|||QUESTION: At what temperature do you think water would boil on top of a mountain — higher or lower than 100 degrees?

Previous conversation:
${context}

Student says:
${prompt}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: enhancedPrompt,
    });
    const raw = response.text || "";
    console.log("✅ Answer ready.");
    return cleanTextForDisplay(raw);
  } catch (err) {
    if (err.status === 429 && retries > 0) {
      console.log(`Rate limited — retrying in 5s... (${retries} left)`);
      await new Promise(r => setTimeout(r, 5000));
      return getGeminiResponse(prompt, history, retries - 1);
    }
    throw err;
  }
}

// ── Parse segments from Gemini response ───────────────────────
// Returns array of { type: "explain"|"question", text: string }
function parseSegments(raw) {
  const parts = raw.split("|||").map(s => s.trim()).filter(Boolean);
  return parts.map(part => {
    if (part.startsWith("EXPLAIN:")) {
      return { type: "explain", text: part.slice("EXPLAIN:".length).trim() };
    }
    if (part.startsWith("QUESTION:")) {
      return { type: "question", text: part.slice("QUESTION:".length).trim() };
    }
    // Fallback: treat as explain
    return { type: "explain", text: part };
  });
}

// ── Split into sentences ───────────────────────────────────────
function splitIntoSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);
}

// ── Generate one sentence → tmp MP3 file ──────────────────────
function generateSentenceAudio(sentence) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`
    );

    const edge = spawn(pythonCmd, [
      "-m", "edge_tts",
      "--voice", VOICE,
      "--text", sentence,
      "--write-media", tmpFile,
    ]);

    edge.stderr.on("data", () => {});

    edge.on("close", (code) => {
      if (code !== 0) return reject(new Error(`edge_tts failed: ${code}`));
      resolve(tmpFile);
    });

    edge.on("error", reject);
  });
}

// ── Stream audio for a single text block ──────────────────────
// Each sentence = 4-byte length header + MP3 bytes
async function streamTextAudio(text, res) {
  const sentences = splitIntoSentences(cleanTextForSpeech(text));
  for (let i = 0; i < sentences.length; i++) {
    try {
      const tmpFile = await generateSentenceAudio(sentences[i]);
      const audioData = fs.readFileSync(tmpFile);
      fs.unlink(tmpFile, () => {});

      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeUInt32BE(audioData.length, 0);
      res.write(lengthBuf);
      res.write(audioData);

      console.log(`  ✓ [${i + 1}/${sentences.length}] "${sentences[i].slice(0, 45)}"`);
    } catch (err) {
      console.error(`Sentence ${i + 1} TTS error:`, err.message);
    }
  }
}

// ── Routes ─────────────────────────────────────────────────────

// Main teaching endpoint — streams segments as framed packets
// Protocol:
//   Each packet = 1-byte type (0=explain, 1=question, 255=done)
//                + 4-byte text length + text bytes (UTF-8)
//                + [if type 0 or 1] 4-byte audio length + audio bytes (per-sentence framed MP3 stream)
//
// Simpler flat protocol actually used:
//   We stream JSON segment headers via SSE-like newline-delimited text,
//   then a separate /segment-audio endpoint for each segment.
//
// ACTUALLY — simplest reliable approach:
//   Return JSON array of segments in body.
//   Frontend fetches audio for each segment via /speak-text.
//   This avoids complex binary framing over SSE.

app.post("/ask", async (req, res) => {
  try {
    const prompt = (req.body.prompt || "").trim() || "Hello teacher";
    const { sessionId, session } = getSession(req.body.sessionId);

    addToHistory(session, "user", prompt);
    const raw = await getGeminiResponse(prompt, session.history);
    addToHistory(session, "assistant", raw);

    const segments = parseSegments(raw);
    console.log(`📝 ${segments.length} segments:`, segments.map(s => `[${s.type}] ${s.text.slice(0, 40)}`));

    res.json({ sessionId, segments });
  } catch (err) {
    console.error("ask error:", err.message?.slice(0, 120));
    const msg = err.status === 429
      ? "I need a short break — please try again in 30 seconds."
      : "Something went wrong. Please try again.";
    res.status(err.status || 500).json({ error: msg });
  }
});

// TTS endpoint — streams framed MP3 sentences for a text string
app.post("/speak-text", async (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    if (!text) { res.end(); return; }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Transfer-Encoding", "chunked");

    await streamTextAudio(text, res);
    res.end();
  } catch (err) {
    console.error("speak-text error:", err.message);
    if (!res.headersSent) res.status(500).send("TTS failed");
  }
});

app.post("/reset-memory", (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && sessions.has(sessionId)) sessions.delete(sessionId);
  res.json({ success: true });
});

app.get("/health", (_, res) => {
  res.json({ status: "ok", sessions: sessions.size });
});

app.listen(PORT, () => {
  console.log(`✅ Miss TMS server on http://localhost:${PORT}`);
  console.log(`🎙️  Voice: ${VOICE}`);
});