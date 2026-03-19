"use client";

import { useEffect, useState } from "react";

interface WhiteboardProps {
  text: string;
  topic: string;
}

function useTypewriter(text: string, speed = 14) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

export default function Whiteboard({ text, topic }: WhiteboardProps) {
  const { displayed, done } = useTypewriter(text, 14);
  const lines = displayed.split("\n");

  return (
    <div style={{
      width: "100%", maxWidth: "100%",
      background: "#fafaf8",
      borderRadius: "2px",
      boxShadow: "0 0 0 10px #1a1a1a, 0 0 0 12px #333, 0 24px 80px rgba(0,0,0,0.8)",
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      minHeight: "440px",
      animation: "slideInLeft 0.55s cubic-bezier(0.4,0,0.2,1) both",
    }}>
      {/* Top frame bar */}
      <div style={{ height: "8px", background: "#1a1a1a" }} />

      {/* Header */}
      <div style={{
        background: "#111111",
        padding: "10px 18px",
        display: "flex", alignItems: "center", gap: "10px",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <span style={{ fontSize: "16px" }}>📚</span>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{
            color: "rgba(255,255,255,0.4)", fontSize: "9px",
            fontFamily: "'Syne', sans-serif", fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase",
          }}>Lesson Notes</div>
          <div style={{
            color: "#ffffff", fontSize: "14px",
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{topic}</div>
        </div>
        {!done && (
          <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "20px" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: "2px", background: "#666", borderRadius: "2px",
                animation: `soundwave 0.5s ease-in-out ${i * 0.1}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Writing area */}
      <div style={{
        flex: 1, padding: "14px 18px 18px 48px",
        backgroundImage: `repeating-linear-gradient(transparent, transparent 33px, #e8eef2 33px, #e8eef2 34px)`,
        backgroundPositionY: "8px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "12.5px", lineHeight: "34px",
        color: "#1a1a1a",
        position: "relative",
        minHeight: "340px",
      }}>
        {/* Red margin line */}
        <div style={{
          position: "absolute", top: 0, left: "40px", bottom: 0,
          width: "1px", background: "rgba(180,40,40,0.25)",
        }} />

        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} style={{ height: "34px" }} />;

          if (/^[A-Z][A-Z\s\-]{2,}:?$/.test(trimmed)) {
            return (
              <div key={i} style={{
                color: "#111", fontWeight: 700,
                fontSize: "11px", letterSpacing: "0.12em",
                textTransform: "uppercase", lineHeight: "34px",
                borderBottom: "1px solid rgba(0,0,0,0.1)",
                marginRight: "8px",
              }}>{trimmed}</div>
            );
          }

          if (trimmed.startsWith("• ")) {
            return (
              <div key={i} style={{ lineHeight: "34px", display: "flex", gap: "6px" }}>
                <span style={{ color: "#333", fontWeight: 700, flexShrink: 0 }}>•</span>
                <span>{trimmed.slice(2)}</span>
              </div>
            );
          }

          if (trimmed.startsWith("→ ")) {
            return (
              <div key={i} style={{ lineHeight: "34px", display: "flex", gap: "6px" }}>
                <span style={{ color: "#555", fontWeight: 700, flexShrink: 0 }}>→</span>
                <span>{trimmed.slice(2)}</span>
              </div>
            );
          }

          if (/[=+\-*/^²³√∑∫]/.test(trimmed) && trimmed.length < 60 && !/[a-z]{5,}/.test(trimmed)) {
            return (
              <div key={i} style={{
                lineHeight: "34px", color: "#222",
                fontWeight: 700, fontSize: "14px",
                textAlign: "center", paddingRight: "20px",
              }}>{trimmed}</div>
            );
          }

          return <div key={i} style={{ lineHeight: "34px" }}>{trimmed}</div>;
        })}

        {!done && (
          <span style={{
            display: "inline-block", width: "1.5px", height: "14px",
            background: "#1a1a1a", marginLeft: "2px",
            animation: "blink 0.6s step-end infinite",
            verticalAlign: "middle",
          }} />
        )}
      </div>

      {/* Bottom tray */}
      <div style={{
        height: "12px", background: "#1a1a1a",
        display: "flex", alignItems: "center",
        padding: "0 14px", gap: "5px",
      }}>
        {["#f5f5f0", "#ddd", "#bbb"].map((c, i) => (
          <div key={i} style={{
            width: "20px", height: "5px",
            background: c, borderRadius: "1px", opacity: 0.7,
          }} />
        ))}
      </div>
    </div>
  );
}