"use client";

import { useEffect, useState, useRef } from "react";

interface WhiteboardProps {
  text:        string;
  topic:       string;
  segmentType: "explain" | "question" | "idle";
  isSpeaking:  boolean;
}

// ─────────────────────────────────────────────────────────────
// Typewriter — appends only new text, fast chalk-write speed
// ─────────────────────────────────────────────────────────────
function useLiveSyncTypewriter(text: string) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const prevRef  = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (!text) { setDisplayed(""); setDone(true); prevRef.current = ""; return; }
    if (text === prev) return;

    if (text.startsWith(prev)) {
      const suffix = text.slice(prev.length);
      let i = 0;
      setDone(false);
      timerRef.current = setInterval(() => {
        i++;
        setDisplayed(prev + suffix.slice(0, i));
        if (i >= suffix.length) {
          clearInterval(timerRef.current!); timerRef.current = null;
          prevRef.current = text; setDone(true);
        }
      }, 14);
    } else {
      let i = 0;
      setDisplayed(""); setDone(false); prevRef.current = "";
      timerRef.current = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(timerRef.current!); timerRef.current = null;
          prevRef.current = text; setDone(true);
        }
      }, 14);
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [text]);

  return { displayed, done };
}

// ─────────────────────────────────────────────────────────────
// ChalkLine — renders one line styled as chalk on blackboard
// ─────────────────────────────────────────────────────────────
function ChalkLine({ line, isQuestion }: { line: string; isQuestion: boolean }) {
  const t = line.trim();
  if (!t) return <div style={{ height: "38px" }} />;

  const baseStyle: React.CSSProperties = {
    lineHeight: "38px",
    color: isQuestion ? "#ffd97a" : "#f0ece0",
    fontFamily: "'Caveat', 'Patrick Hand', cursive",
    fontSize: "18px",
    textShadow: isQuestion
      ? "0 0 8px rgba(255,217,122,0.4), 1px 1px 0 rgba(0,0,0,0.3)"
      : "0 0 6px rgba(240,236,224,0.25), 1px 1px 0 rgba(0,0,0,0.2)",
    letterSpacing: "0.02em",
  };

  // Section header (ALL CAPS line)
  if (/^[A-Z][A-Z\s\-:]{3,}$/.test(t)) {
    return (
      <div style={{
        ...baseStyle,
        fontSize: "15px",
        fontFamily: "'Caveat', cursive",
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#a8d8a8",
        textShadow: "0 0 10px rgba(168,216,168,0.4)",
        borderBottom: "1px solid rgba(168,216,168,0.2)",
        marginBottom: "2px",
        paddingBottom: "2px",
      }}>{t}</div>
    );
  }

  // Math / equation — centered, bigger, bright
  if (/[=+\-*/^²³√∑∫]/.test(t) && t.length < 55 && !/[a-z]{5,}/.test(t)) {
    return (
      <div style={{
        ...baseStyle,
        fontSize: "22px",
        textAlign: "center",
        color: "#fff9c4",
        textShadow: "0 0 12px rgba(255,249,196,0.5), 1px 1px 0 rgba(0,0,0,0.3)",
        fontWeight: 700,
      }}>{t}</div>
    );
  }

  // Bullet point
  if (t.startsWith("• ")) return (
    <div style={{ ...baseStyle, display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <span style={{ color: "#a8d8a8", flexShrink: 0, marginTop: "1px", fontSize: "20px" }}>•</span>
      <span>{t.slice(2)}</span>
    </div>
  );

  // Arrow
  if (t.startsWith("→ ")) return (
    <div style={{ ...baseStyle, display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <span style={{ color: "#a8d8a8", flexShrink: 0, marginTop: "1px" }}>→</span>
      <span>{t.slice(2)}</span>
    </div>
  );

  // Question text — warm yellow chalk
  if (isQuestion) return (
    <div style={{
      ...baseStyle,
      fontSize: "20px",
      fontStyle: "italic",
      color: "#ffd97a",
      textShadow: "0 0 10px rgba(255,217,122,0.35)",
    }}>{t}</div>
  );

  return <div style={baseStyle}>{t}</div>;
}

// ─────────────────────────────────────────────────────────────
// Whiteboard — real chalkboard UI
// ─────────────────────────────────────────────────────────────
export default function Whiteboard({ text, topic, segmentType, isSpeaking }: WhiteboardProps) {
  const { displayed, done } = useLiveSyncTypewriter(text);
  const lines      = displayed.split("\n");
  const isQuestion = segmentType === "question";

  return (
    <div style={{
      width: "100%",
      maxWidth: "640px",        // bigger
      position: "relative",
      // Wooden outer frame
      background: "linear-gradient(135deg, #8B5E3C 0%, #6B4423 30%, #8B5E3C 50%, #5C3317 70%, #8B5E3C 100%)",
      borderRadius: "4px",
      padding: "22px 20px 24px 20px",
      boxShadow: `
        inset 0 2px 4px rgba(255,255,255,0.15),
        inset 0 -2px 4px rgba(0,0,0,0.4),
        0 8px 32px rgba(0,0,0,0.6),
        0 2px 8px rgba(0,0,0,0.5),
        0 0 0 2px rgba(0,0,0,0.3)
      `,
      animation: "slideInLeft 0.5s cubic-bezier(0.4,0,0.2,1) both",
    }}>

      {/* Wood grain texture overlay */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "4px",
        backgroundImage: `repeating-linear-gradient(
          92deg,
          transparent 0px, transparent 8px,
          rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 9px,
          transparent 9px, transparent 18px,
          rgba(255,255,255,0.03) 18px, rgba(255,255,255,0.03) 19px
        )`,
        pointerEvents: "none",
      }} />

      {/* Corner bolts */}
      {[
        { top: "10px", left: "10px" },
        { top: "10px", right: "10px" },
        { bottom: "10px", left: "10px" },
        { bottom: "10px", right: "10px" },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos,
          width: "10px", height: "10px", borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #c8a96e, #7a5c2e)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 2px rgba(255,255,255,0.2)",
          zIndex: 2,
        }} />
      ))}

      {/* Inner chalk-rail top */}
      <div style={{
        position: "absolute", top: "18px", left: "18px", right: "18px",
        height: "3px",
        background: "linear-gradient(90deg, rgba(200,169,110,0.6), rgba(200,169,110,0.3), rgba(200,169,110,0.6))",
        borderRadius: "1px",
      }} />

      {/* The slate surface */}
      <div style={{
        position: "relative",
        background: isQuestion
          ? "linear-gradient(160deg, #1a2e1a 0%, #142014 40%, #1a2a1a 100%)"
          : "linear-gradient(160deg, #1e2e1e 0%, #162416 40%, #1c2a1c 100%)",
        borderRadius: "2px",
        minHeight: "520px",   // taller
        overflow: "hidden",
        boxShadow: `
          inset 0 2px 8px rgba(0,0,0,0.6),
          inset 0 0 40px rgba(0,0,0,0.3),
          inset 2px 0 6px rgba(0,0,0,0.2),
          inset -2px 0 6px rgba(0,0,0,0.2)
        `,
      }}>

        {/* Slate texture — subtle noise */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.015) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(255,255,255,0.01) 0%, transparent 50%),
            repeating-linear-gradient(
              0deg,
              transparent 0px, transparent 3px,
              rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px
            )
          `,
          pointerEvents: "none",
        }} />

        {/* Chalk dust smears — static atmosphere */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `
            radial-gradient(ellipse 120px 40px at 15% 85%, rgba(240,236,224,0.04) 0%, transparent 70%),
            radial-gradient(ellipse 80px 25px at 75% 92%, rgba(240,236,224,0.03) 0%, transparent 70%),
            radial-gradient(ellipse 60px 20px at 45% 95%, rgba(240,236,224,0.025) 0%, transparent 70%)
          `,
        }} />

        {/* Header area */}
        <div style={{
          padding: "16px 20px 10px 20px",
          borderBottom: isQuestion
            ? "1px solid rgba(255,217,122,0.2)"
            : "1px solid rgba(168,216,168,0.15)",
          display: "flex", alignItems: "center", gap: "12px",
          position: "relative",
        }}>
          {/* Topic label */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Caveat', cursive",
              fontSize: "11px",
              color: isQuestion ? "rgba(255,217,122,0.5)" : "rgba(168,216,168,0.5)",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              marginBottom: "2px",
            }}>
              {isQuestion ? "Your Turn" : "Lesson"}
            </div>
            <div style={{
              fontFamily: "'Caveat', cursive",
              fontSize: "22px",
              fontWeight: 700,
              color: isQuestion ? "#ffd97a" : "#a8d8a8",
              textShadow: isQuestion
                ? "0 0 12px rgba(255,217,122,0.3)"
                : "0 0 12px rgba(168,216,168,0.3)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              letterSpacing: "0.03em",
            }}>
              {isQuestion ? "Answer the question ✏️" : topic}
            </div>
          </div>

          {/* Live chalk-writing indicator */}
          {(!done || isSpeaking) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  height: "2px",
                  background: isQuestion
                    ? "rgba(255,217,122,0.6)"
                    : "rgba(168,216,168,0.6)",
                  borderRadius: "1px",
                  animation: `chalkLine 1.0s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Writing surface */}
        <div style={{
          padding: "18px 24px 24px 24px",
          position: "relative",
          minHeight: "420px",
        }}>
          {/* Horizontal chalk rules — faint */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              top: `${18 + i * 38}px`,
              left: "20px", right: "20px",
              height: "1px",
              background: "rgba(255,255,255,0.04)",
            }} />
          ))}

          {/* Content lines */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {lines.map((line, i) => (
              <ChalkLine key={i} line={line} isQuestion={isQuestion} />
            ))}

            {/* Chalk cursor */}
            {!done && (
              <span style={{
                display: "inline-block",
                width: "2px", height: "20px",
                background: isQuestion
                  ? "rgba(255,217,122,0.9)"
                  : "rgba(240,236,224,0.9)",
                marginLeft: "3px",
                verticalAlign: "middle",
                animation: "blink 0.55s step-end infinite",
                boxShadow: isQuestion
                  ? "0 0 6px rgba(255,217,122,0.8)"
                  : "0 0 6px rgba(240,236,224,0.6)",
              }} />
            )}
          </div>
        </div>

        {/* Bottom chalk tray */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "28px",
          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center",
          padding: "0 16px", gap: "8px",
        }}>
          {/* Chalk sticks */}
          {[
            { w: 32, color: "#f0ece0" },
            { w: 24, color: "#c8f0c8" },
            { w: 28, color: "#ffd97a" },
            { w: 18, color: "#f0ece0" },
            { w: 22, color: "#f0c8c8" },
          ].map((chalk, i) => (
            <div key={i} style={{
              width: `${chalk.w}px`,
              height: "7px",
              background: chalk.color,
              borderRadius: "2px",
              opacity: 0.55,
              boxShadow: `0 1px 3px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.3)`,
            }} />
          ))}
          <div style={{ flex: 1 }} />
          {/* Eraser */}
          <div style={{
            width: "36px", height: "14px",
            background: "linear-gradient(180deg, #d4a8a8 0%, #b88080 100%)",
            borderRadius: "2px",
            opacity: 0.6,
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }} />
        </div>
      </div>

      {/* Bottom chalk rail */}
      <div style={{
        position: "absolute", bottom: "20px", left: "18px", right: "18px",
        height: "3px",
        background: "linear-gradient(90deg, rgba(200,169,110,0.6), rgba(200,169,110,0.3), rgba(200,169,110,0.6))",
        borderRadius: "1px",
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap');

        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes chalkLine {
          0%   { width: 18px; opacity: 0.4; }
          50%  { width: 32px; opacity: 0.8; }
          100% { width: 18px; opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}