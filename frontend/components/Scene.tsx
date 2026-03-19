"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import Whiteboard from "./Whiteboard";
import ChatBar from "./ChatBar";
import HUD from "./HUD";
import AnimatedModel from "./AnimatedModel";

type Segment = { type: "explain" | "question"; text: string };
type UIMode  = "idle" | "speaking" | "waiting";

const BACKEND = "http://localhost:3001";

// ─────────────────────────────────────────────────────────────
// playFramedStream — decodes length-prefixed MP3 stream.
// Fires onSentencePlaying(idx, startAtSeconds) when each
// sentence is scheduled so the board types in exact sync.
// ─────────────────────────────────────────────────────────────
async function playFramedStream(
  text: string,
  ctx: AudioContext,
  analyser: AnalyserNode,
  sentences: string[],
  onSentencePlaying: (idx: number, startAt: number) => void
): Promise<number> {
  const res = await fetch(`${BACKEND}/speak-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");

  const reader = res.body!.getReader();
  let rawBuf   = new Uint8Array(0);
  let nextStart = ctx.currentTime + 0.05;
  let idx       = 0;

  const append = (chunk: Uint8Array) => {
    const next = new Uint8Array(rawBuf.length + chunk.length);
    next.set(rawBuf); next.set(chunk, rawBuf.length);
    rawBuf = next;
  };

  const schedule = async () => {
    while (rawBuf.length >= 4) {
      const view = new DataView(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
      const len  = view.getUint32(0);
      if (rawBuf.length < 4 + len) break;

      const mp3 = rawBuf.slice(4, 4 + len);
      rawBuf    = rawBuf.slice(4 + len);
      const i   = idx++;

      try {
        const copy     = mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength);
        const audioBuf = await ctx.decodeAudioData(copy);
        const src      = ctx.createBufferSource();
        src.buffer     = audioBuf;
        src.connect(analyser);
        const startAt  = Math.max(nextStart, ctx.currentTime + 0.01);
        src.start(startAt);
        onSentencePlaying(i, startAt);          // ← board types this sentence now
        nextStart = startAt + audioBuf.duration;
      } catch (e) {
        console.warn("Decode error:", e);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    append(value);
    await schedule();
  }
  await schedule();
  return Math.max(nextStart - ctx.currentTime, 0);
}

function RendererKeepAlive() {
  const { gl, scene, camera } = useThree();
  useFrame(() => gl.render(scene, camera));
  return null;
}

// ─────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────
export default function Scene() {
  const [uiMode,     setUiMode]     = useState<UIMode>("idle");
  const [boardText,  setBoardText]  = useState("");
  const [boardKey,   setBoardKey]   = useState(0);
  const [boardType,  setBoardType]  = useState<"explain"|"question"|"idle">("idle");
  const [isThinking, setIsThinking] = useState(false);
  const [topic,      setTopic]      = useState("Miss TMS");
  const [msgCount,   setMsgCount]   = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [analyser,   setAnalyser]   = useState<AnalyserNode | null>(null);
  const [lastAnswer, setLastAnswer] = useState("");
  const [lastQ,      setLastQ]      = useState("");

  const audioCtx  = useRef<AudioContext | null>(null);
  const sessionId = useRef<string | null>(null);
  const talkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending   = useRef<Segment[]>([]);

  // ── Play one segment ──────────────────────────────────────
  const playSegment = useCallback(async (seg: Segment) => {
    // Fresh blank board
    setBoardKey(k => k + 1);
    setBoardText("");
    setBoardType(seg.type);

    if (!audioCtx.current) audioCtx.current = new AudioContext();
    const ctx = audioCtx.current;
    if (ctx.state === "suspended") await ctx.resume();

    const an = ctx.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.7;
    an.connect(ctx.destination);
    setAnalyser(an);
    setIsSpeaking(true);
    setUiMode("speaking");

    // Split text into sentences (same as server)
    const sentences = seg.text
      .replace(/\n/g, " ").replace(/\s+/g, " ").trim()
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim()).filter(s => s.length > 2);

    let accText = "";

    try {
      const totalDur = await playFramedStream(
        seg.text, ctx, an, sentences,
        (sentIdx, startAt) => {
          // Fire exactly when this sentence's audio begins
          const delayMs = Math.max((startAt - ctx.currentTime) * 1000, 0);
          const txt     = sentences[sentIdx] ?? "";
          setTimeout(() => {
            accText = accText ? accText + " " + txt : txt;
            setBoardText(accText);
          }, delayMs);
        }
      );

      await new Promise<void>(resolve => {
        talkTimer.current = setTimeout(resolve, totalDur * 1000 + 300);
      });
    } catch (err) {
      console.error("playSegment:", err);
    }

    setIsSpeaking(false);
    setAnalyser(null);

    if (pending.current.length > 0) {
      const next = pending.current.shift()!;
      await new Promise(r => setTimeout(r, 380));
      await playSegment(next);
    } else {
      setUiMode("waiting");
    }
  }, []);

  // ── Student sends message ─────────────────────────────────
  const handleSend = useCallback(async (message: string) => {
    if (talkTimer.current) clearTimeout(talkTimer.current);
    setIsThinking(true);
    setUiMode("speaking");
    setMsgCount(c => c + 1);
    setLastQ(message);
    pending.current = [];

    try {
      const res = await fetch(`${BACKEND}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: message, sessionId: sessionId.current }),
      });
      if (!res.ok) throw new Error(`Backend ${res.status}`);

      const data = await res.json();
      if (data.sessionId) sessionId.current = data.sessionId;

      const segments: Segment[] = data.segments ?? [];
      if (!segments.length) throw new Error("No segments");

      const first = segments.find(s => s.type === "explain");
      if (first) {
        setTopic(first.text.split(/[.\n]/)[0].slice(0, 45) || message);
        setLastAnswer(first.text);
      }

      setIsThinking(false);
      const [head, ...rest] = segments;
      pending.current = rest;
      await playSegment(head);

    } catch (err) {
      console.error("handleSend:", err);
      setIsThinking(false);
      setIsSpeaking(false);
      setUiMode("waiting");
      setBoardKey(k => k + 1);
      setBoardText("ERROR: Is the backend running?\nnode server.js");
      setBoardType("explain");
    }
  }, [playSegment]);

  const handleStop = useCallback(() => {
    audioCtx.current?.suspend();
    setIsSpeaking(false);
    setAnalyser(null);
    if (talkTimer.current) clearTimeout(talkTimer.current);
    pending.current = [];
    setUiMode("waiting");
  }, []);

  const handleReset = useCallback(async () => {
    if (talkTimer.current) clearTimeout(talkTimer.current);
    audioCtx.current?.suspend();
    pending.current = [];
    setUiMode("idle");
    setBoardText("");
    setBoardKey(k => k + 1);
    setBoardType("idle");
    setIsSpeaking(false);
    setIsThinking(false);
    setAnalyser(null);
    setTopic("Miss TMS");
    if (sessionId.current) {
      await fetch(`${BACKEND}/reset-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current }),
      }).catch(() => {});
      sessionId.current = null;
    }
  }, []);

  const boardVisible = uiMode !== "idle";

  return (
    <div style={{
      height: "100vh", width: "100%",
      background: "#ffffff", overflow: "hidden",
      display: "flex", position: "relative",
    }}>

      {/* ── LEFT: Whiteboard 55% ── */}
      <div style={{
        width: "55%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "56px 16px 120px 28px",
        zIndex: 2,
        opacity: boardVisible ? 1 : 0,
        transform: boardVisible ? "translateX(0)" : "translateX(-40px)",
        transition: "opacity 0.6s ease, transform 0.6s cubic-bezier(0.4,0,0.2,1)",
        pointerEvents: boardVisible ? "auto" : "none",
      }}>
        {boardVisible && (
          <Whiteboard
            key={boardKey}
            text={boardText}
            topic={topic}
            segmentType={boardType}
            isSpeaking={isSpeaking}
          />
        )}
      </div>

      {/* ── RIGHT: 3D Model 45% ── */}
      <div style={{ width: "45%", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <Canvas
          frameloop="always"
          style={{ height: "100%", width: "100%" }}
          // Closer camera: fov tightened, z pulled in from 6.0 → 4.2
          // y slightly raised so head/chest fills the frame
          camera={{ position: [0, 0.6, 4.2], fov: 42 }}
          gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
          onCreated={({ gl, scene }) => {
            scene.background = new THREE.Color("#ffffff");
            gl.domElement.addEventListener("webglcontextlost", e => e.preventDefault());
          }}
        >
          <RendererKeepAlive />
          <ambientLight intensity={0.9} color="#ffffff" />
          <directionalLight position={[2, 4, 4]}  intensity={2.2} color="#ffffff" />
          <directionalLight position={[-2, 1, 2]} intensity={0.5} color="#f0f4ff" />
          <pointLight       position={[0, 2, 3]}  intensity={0.4} color="#fff5ee" />
          <hemisphereLight  args={["#ffffff", "#e0e0e0", 0.6]} />
          <Suspense fallback={null}>
            <AnimatedModel isSpeaking={isSpeaking} audioAnalyser={analyser} />
          </Suspense>
          <Environment preset="studio" />
        </Canvas>

        {/* Idle greeting */}
        {uiMode === "idle" && (
          <div style={{
            position: "absolute", bottom: "140px", left: 0, right: 0,
            zIndex: 3, pointerEvents: "none",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
            animation: "fadeUp 0.5s ease both",
          }}>
            
          </div>
        )}

        {/* Waiting dots */}
        {uiMode === "waiting" && (
          <div style={{
            position: "absolute", bottom: "140px", left: 0, right: 0,
            zIndex: 3, pointerEvents: "none",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
          }}>
            <div style={{ display: "flex", gap: "5px" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: "7px", height: "7px", borderRadius: "50%", background: "#111",
                  animation: `waitPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <div style={{
              fontSize: "11px", color: "rgba(0,0,0,0.35)",
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em",
            }}>your turn...</div>
          </div>
        )}
      </div>

      {/* Thinking overlay */}
      {isThinking && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.75)", backdropFilter: "blur(4px)",
          pointerEvents: "none",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              border: "2px solid rgba(0,0,0,0.1)", borderTopColor: "#000",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{
              color: "#111", fontFamily: "'Syne', sans-serif",
              fontWeight: 700, fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase",
            }}>Thinking...</div>
          </div>
        </div>
      )}

      {/* HUD + ChatBar */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <HUD messageCount={msgCount} isSpeaking={isSpeaking} mode={uiMode} onReset={handleReset} />
          <ChatBar
            onSend={handleSend}
            onStop={handleStop}
            isThinking={isThinking}
            isSpeaking={isSpeaking}
            lastAnswer={lastAnswer}
            lastQuestion={lastQ}
            isWaiting={uiMode === "waiting"}
          />
        </div>
      </div>

      <style>{`
        @keyframes waitPulse {
          0%,100%{opacity:0.2;transform:scale(0.8)}
          50%{opacity:1;transform:scale(1.2)}
        }
        @keyframes fadeUp {
          from{opacity:0;transform:translateY(12px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes soundwave { 0%,100%{height:4px} 50%{height:16px} }
        @keyframes slideInLeft {
          from{opacity:0;transform:translateX(-20px)}
          to{opacity:1;transform:translateX(0)}
        }
      `}</style>
    </div>
  );
}