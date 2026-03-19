"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import Model from "./Model";
import Whiteboard from "./Whiteboard";
import ChatBar from "./ChatBar";
import HUD from "./HUD";


type Mode = "idle" | "talking" | "board";

function AnimatedModel({ boardVisible }: { boardVisible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  // When board visible: stay right. When idle: center
  const targetX = boardVisible ? 0.6 : 0;

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      0.05
    );
  });

  return (
   <group ref={groupRef} position={[0, -4.8, -5]}>
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[0.5, 1.5, 0.5]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      }>
        <Model scale={1.75} />
      </Suspense>
      <ContactShadows position={[0, -1, 0]} opacity={0.12} scale={3} blur={2} color="#000000" />
    </group>
  );
}

function RendererKeepAlive() {
  const { gl, scene, camera } = useThree();
  useFrame(() => gl.render(scene, camera));
  return null;
}

export default function Scene() {
  const [mode, setMode] = useState<Mode>("idle");
  const [whiteboardText, setWhiteboardText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [topic, setTopic] = useState("Miss TMS");
  const [messageCount, setMessageCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const talkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.speechSynthesis.getVoices();
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        v.name.includes("Google UK English Female") ||
        v.name.includes("Samantha") ||
        v.name.includes("Karen") ||
        v.name.includes("Moira")
      );
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); onDone?.(); };
      utterance.onerror = () => { setIsSpeaking(false); onDone?.(); };
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length > 0) trySpeak();
    else window.speechSynthesis.onvoiceschanged = trySpeak;
  }, []);

  const handleSend = useCallback(async (message: string) => {
    if (talkTimerRef.current) clearTimeout(talkTimerRef.current);
    window.speechSynthesis.cancel();
    setIsThinking(true);
    setMode("talking");
    setWhiteboardText("");
    setMessageCount(c => c + 1);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an enthusiastic world-class AI teacher. Format your response EXACTLY like this:

TOPIC: [short topic, max 5 words]
SPEECH: [2-3 warm, clear sentences to speak aloud. No special characters or markdown.]
BOARD:
[Structured whiteboard notes:
- Section headings in ALL CAPS followed by colon
- Bullet points starting with "• "
- Steps starting with "→ "
- Math equations on their own line
- Max 14 lines total]`,
          messages: [{ role: "user", content: message }],
        }),
      });

      const data = await response.json();
      const fullText = data.content
        .map((b: { type: string; text?: string }) => b.type === "text" ? b.text : "")
        .join("");

      const topicMatch = fullText.match(/TOPIC:\s*(.+)/);
      const speechMatch = fullText.match(/SPEECH:\s*([\s\S]+?)(?=\nBOARD:)/);
      const boardMatch = fullText.match(/BOARD:\s*([\s\S]+)/);

      const extractedTopic = topicMatch?.[1]?.trim() ?? message;
      const spokenPart = speechMatch?.[1]?.trim() ?? "";
      const boardPart = boardMatch?.[1]?.trim() ?? "";

      setTopic(extractedTopic);
      setIsThinking(false);

      const showBoard = () => {
        if (talkTimerRef.current) clearTimeout(talkTimerRef.current);
        setMode("board");
        setWhiteboardText(boardPart);
      };

      speak(spokenPart, showBoard);
      talkTimerRef.current = setTimeout(showBoard, Math.max(spokenPart.length * 52, 4000));

    } catch (err) {
      console.error(err);
      setIsThinking(false);
      setMode("board");
      setWhiteboardText("ERROR:\n\n• Check your API key\n• Check your connection");
      setTopic("Error");
    }
  }, [speak]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if (talkTimerRef.current) clearTimeout(talkTimerRef.current);
    if (whiteboardText) setMode("board");
  }, [whiteboardText]);

  const handleReset = useCallback(() => {
    if (talkTimerRef.current) clearTimeout(talkTimerRef.current);
    window.speechSynthesis.cancel();
    setMode("idle");
    setWhiteboardText("");
    setIsSpeaking(false);
    setIsThinking(false);
    setTopic("Miss TMS");
  }, []);

  const whiteboardVisible = mode === "board";

  return (
    <div style={{
      height: "100vh", width: "100%", position: "relative",
      background: "#ffffff", overflow: "hidden",
    }}>

      {/* Canvas — full screen, model animates inside */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <Canvas
          frameloop="always"
          style={{ height: "100%", width: "100%" }}
          camera={{ position: [0, 0.1, 3.0], fov: 45 }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false,
            alpha: true,
          }}
          onCreated={({ gl, scene }) => {
            scene.background = new THREE.Color("#ffffff");
            gl.domElement.addEventListener("webglcontextlost", e => e.preventDefault());
          }}
        >
          <RendererKeepAlive />
          <ambientLight intensity={0.8} color="#ffffff" />
          <directionalLight position={[2, 4, 4]} intensity={2.0} color="#ffffff" />
          <directionalLight position={[-2, 1, 2]} intensity={0.5} color="#f0f4ff" />
          <pointLight position={[0, 2, 3]} intensity={0.4} color="#fff5ee" />
          <hemisphereLight args={["#ffffff", "#e0e0e0", 0.6]} />

          <Suspense fallback={null}>
            <AnimatedModel boardVisible={whiteboardVisible} />
          </Suspense>

          <Environment preset="studio" />
        </Canvas>
      </div>

      {/* Whiteboard — LEFT side, slides in */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: "50%", zIndex: 2, pointerEvents: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "64px 12px 130px 24px",
        opacity: whiteboardVisible ? 1 : 0,
        transform: whiteboardVisible ? "translateX(0)" : "translateX(-40px)",
        transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {whiteboardVisible && <Whiteboard text={whiteboardText} topic={topic} />}
      </div>

      {/* Idle state greeting */}
      {mode === "idle" && (
        <div style={{
          position: "absolute", bottom: "130px", left: 0, right: 0,
          zIndex: 3, pointerEvents: "none",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: "6px",
          animation: "fadeUp 0.5s ease both",
        }}>
          <div style={{
            fontSize: "20px", fontWeight: 800,
            fontFamily: "'Syne', sans-serif",
            color: "#111", letterSpacing: "0.01em",
          }}>Hello, I'm Miss TMS 👋</div>
          <div style={{
            fontSize: "13px", color: "rgba(0,0,0,0.45)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>Ask me anything to start your lesson</div>
        </div>
      )}

      {/* Thinking overlay */}
      {isThinking && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.7)", backdropFilter: "blur(4px)",
          pointerEvents: "none",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              border: "2px solid rgba(0,0,0,0.1)",
              borderTopColor: "#000",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{
              color: "#111", fontFamily: "'Syne', sans-serif",
              fontWeight: 700, fontSize: "12px",
              letterSpacing: "0.15em", textTransform: "uppercase",
            }}>Preparing lesson...</div>
          </div>
        </div>
      )}

      <HUD
        messageCount={messageCount}
        isSpeaking={isSpeaking}
        mode={mode}
        onReset={handleReset}
      />

      <ChatBar
        onSend={handleSend}
        onStop={handleStop}
        isThinking={isThinking}
        isSpeaking={isSpeaking}
      />
    </div>
  );
}