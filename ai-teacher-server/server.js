const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;

const ai = new GoogleGenAI({});

// In-memory session memory
// Note: this resets when the server restarts
const sessions = new Map();

app.use(express.static("public"));
app.use(express.json());

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

function getSession(sessionId) {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      createdAt: Date.now(),
    });
  }

  return { sessionId, session: sessions.get(sessionId) };
}

function addToHistory(session, role, text) {
  session.history.push({ role, text });

  // Keep only the last 12 messages to avoid huge prompts
  if (session.history.length > 12) {
    session.history = session.history.slice(-12);
  }
}

function buildConversationContext(history) {
  if (!history.length) return "No previous conversation yet.";

  return history
    .map((item) => {
      const speaker = item.role === "user" ? "Student" : "Miss TMS";
      return `${speaker}: ${item.text}`;
    })
    .join("\n");
}

async function getGeminiResponse(prompt, history = []) {
  console.log("Fetching answer...");

  const conversationContext = buildConversationContext(history);

  const enhancedPrompt = `
You are a friendly, human-like teacher named Miss TMS.

Speak like a real person, not like a robot or an AI.
Never mention that you are an AI, language model, chatbot, or assistant.

You are Miss TMS — a warm, patient, supportive teacher who enjoys helping students learn.
You remember the ongoing conversation and should respond consistently with what was said before.

Your tone should be:
- natural and conversational
- friendly and human
- encouraging and supportive
- slightly curious sometimes

You can occasionally say things like:
- "By the way, what's your name?"
- "Does that make sense?"
- "Want me to explain that another way?"
- "You're doing really well"

But keep it natural and not repetitive.

IMPORTANT RULES:
- Use plain text only
- No markdown
- No hashtags
- No asterisks
- No code blocks
- No LaTeX
- No bullet points unless truly necessary
- Keep everything clean and easy to read
- Do not use special formatting

When solving problems:
- explain step by step
- keep it simple
- sound like you're sitting next to the student
- avoid sounding formal or robotic

Use the previous conversation to keep continuity and memory.

Previous conversation:
${conversationContext}

Student's latest question:
${prompt}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: enhancedPrompt,
  });

  const rawAnswer = response.text || "";
  const cleanedAnswer = cleanTextForDisplay(rawAnswer);

  console.log("Answer received.");
  return cleanedAnswer;
}

function streamSpeech(text, res) {
  const ttsPath = path.join(__dirname, "tts.js");
  const tts = spawn("node", [ttsPath, text]);

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Transfer-Encoding", "chunked");

  tts.stdout.on("data", (chunk) => {
    res.write(chunk);
  });

  tts.stderr.on("data", (err) => {
    console.error("TTS error:", err.toString());
  });

  tts.on("close", () => {
    res.end();
  });

  tts.on("error", (error) => {
    console.error("Failed to start TTS process:", error);
    if (!res.headersSent) {
      res.status(500).send("Failed to start TTS");
    } else {
      res.end();
    }
  });
}

app.post("/ask-voice", async (req, res) => {
  try {
    const prompt = (req.body.prompt || "").trim() || "Hello teacher";
    const incomingSessionId = req.body.sessionId;

    const { sessionId, session } = getSession(incomingSessionId);

    addToHistory(session, "user", prompt);

    const answer = await getGeminiResponse(prompt, session.history);
    addToHistory(session, "assistant", answer);

    res.json({
      sessionId,
      prompt,
      answer,
    });
  } catch (error) {
    console.error("Ask voice error:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/speak-text", async (req, res) => {
  try {
    const text = cleanTextForSpeech(req.body.text || "Hello there");
    streamSpeech(text, res);
  } catch (error) {
    console.error("Speak text error:", error);
    res.status(500).send("Failed to generate audio response");
  }
});

app.post("/reset-memory", (req, res) => {
  const sessionId = req.body.sessionId;
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});