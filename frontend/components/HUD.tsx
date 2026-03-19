"use client";

type Mode = "idle" | "talking" | "board";

interface HUDProps {
  messageCount: number;
  isSpeaking: boolean;
  mode: Mode;
  onReset: () => void;
}

export default function HUD({ messageCount, isSpeaking, mode, onReset }: HUDProps) {
  const modeLabel = mode === "idle" ? "Ready" : mode === "talking" ? "Speaking" : "Board";

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0,
      height: "52px", zIndex: 20, pointerEvents: "none",
      display: "flex", alignItems: "center",
      padding: "0 20px", gap: "12px",
      background: "rgba(255,255,255,0.92)",
      borderBottom: "1px solid #ebebeb",
      backdropFilter: "blur(8px)",
    }}>
      {/* Logo */}
      <div style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 800,
        fontSize: "14px", letterSpacing: "0.1em",
        textTransform: "uppercase", color: "#111",
      }}>Mr M</div>

      <div style={{ width: "1px", height: "14px", background: "#ddd" }} />

      {/* Mode */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: mode === "idle" ? "#ccc" : "#111",
          animation: mode === "talking" ? "pulse 1s ease infinite" : "none",
        }} />
        <span style={{
          fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#888",
          fontFamily: "'Syne', sans-serif",
        }}>{modeLabel}</span>
      </div>

      {/* Sound wave */}
      {isSpeaking && (
        <div style={{ display: "flex", gap: "2px", alignItems: "center", height: "16px" }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: "2px", background: "#111", borderRadius: "2px",
              animation: `soundwave 0.5s ease-in-out ${i * 0.1}s infinite`,
            }} />
          ))}
        </div>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "14px" }}>
        <span style={{
          fontSize: "11px", color: "#aaa",
          fontFamily: "'JetBrains Mono', monospace",
        }}>{messageCount} {messageCount === 1 ? "lesson" : "lessons"}</span>

        {mode !== "idle" && (
          <button onClick={onReset} style={{
            pointerEvents: "all",
            background: "transparent",
            border: "1px solid #e5e5e5",
            color: "#888", borderRadius: "6px",
            padding: "3px 10px", fontSize: "11px",
            fontFamily: "'Syne', sans-serif", fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#111";
              e.currentTarget.style.color = "#111";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "#e5e5e5";
              e.currentTarget.style.color = "#888";
            }}
          >Reset</button>
        )}
      </div>
    </div>
  );
}