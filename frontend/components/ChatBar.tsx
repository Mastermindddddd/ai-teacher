"use client";

import { useState, useRef, useEffect } from "react";

interface ChatBarProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isThinking: boolean;
  isSpeaking: boolean;
}

const SUGGESTIONS = [
  "Explain photosynthesis",
  "How does gravity work?",
  "Pythagorean theorem",
  "Explain DNA",
  "How do computers work?",
  "What caused WW2?",
];

export default function ChatBar({ onSend, onStop, isThinking, isSpeaking }: ChatBarProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const busy = isThinking || isSpeaking;

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      zIndex: 20,
      padding: "0 0 20px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>

      {/* Suggestion chips — only when idle */}
      {!busy && input === "" && (
        <div style={{
          display: "flex", gap: "6px", marginBottom: "12px",
          flexWrap: "wrap", justifyContent: "center",
          padding: "0 24px",
          animation: "fadeUp 0.3s ease both",
        }}>
          {SUGGESTIONS.map(s => (
            <button key={s}
              onClick={() => { setInput(s); inputRef.current?.focus(); }}
              style={{
                background: "#f7f7f8",
                border: "1px solid #e5e5e5",
                color: "#444", borderRadius: "999px",
                padding: "6px 14px", fontSize: "12px",
                fontFamily: "'Syne', sans-serif", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#efefef";
                e.currentTarget.style.borderColor = "#ccc";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#f7f7f8";
                e.currentTarget.style.borderColor = "#e5e5e5";
              }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Main input box — ChatGPT style */}
      <div style={{
        width: "100%", maxWidth: "720px",
        padding: "0 16px",
      }}>
        <div style={{
          background: "#ffffff",
          border: `1.5px solid ${focused ? "#aaa" : "#e5e5e5"}`,
          borderRadius: "16px",
          boxShadow: focused
            ? "0 0 0 4px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.08)"
            : "0 2px 8px rgba(0,0,0,0.06)",
          transition: "all 0.2s",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* Speaking indicator bar */}
          {isSpeaking && (
            <div style={{
              padding: "8px 16px 0",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <div style={{ display: "flex", gap: "2px", alignItems: "center", height: "16px" }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{
                    width: "2px", background: "#111", borderRadius: "2px",
                    animation: `soundwave 0.5s ease-in-out ${i * 0.1}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{
                fontSize: "11px", color: "#666",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.06em",
              }}>Miss TMS is speaking...</span>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              isThinking ? "Preparing your lesson..."
              : "Ask Miss TMS anything..."
            }
            disabled={isThinking}
            rows={1}
            style={{
              width: "100%", background: "transparent",
              border: "none", outline: "none",
              color: "#111", fontSize: "15px",
              fontFamily: "'Syne', sans-serif", fontWeight: 500,
              padding: "14px 16px 4px",
              letterSpacing: "0.01em",
              resize: "none", lineHeight: "1.6",
              overflow: "hidden",
            }}
          />

          {/* Bottom row — actions */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px 10px",
          }}>
            <div style={{
              fontSize: "11px", color: "#aaa",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em", paddingLeft: "6px",
            }}>
              {isThinking ? "Thinking..." : "Enter ↵ to send · Shift+Enter for newline"}
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {/* Clear */}
              {input && (
                <button onClick={() => setInput("")} style={{
                  background: "none", border: "none",
                  color: "#aaa", cursor: "pointer",
                  fontSize: "18px", lineHeight: 1,
                  padding: "4px", borderRadius: "6px",
                  transition: "color 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.color = "#666"}
                  onMouseLeave={e => e.currentTarget.style.color = "#aaa"}
                >×</button>
              )}

              {/* Stop speaking */}
              {isSpeaking && (
                <button onClick={onStop} style={{
                  background: "#f7f7f8",
                  border: "1px solid #e5e5e5",
                  color: "#444", borderRadius: "8px",
                  padding: "5px 10px", fontSize: "12px",
                  fontFamily: "'Syne', sans-serif", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  <span>⏹</span> Stop
                </button>
              )}

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={isThinking || !input.trim()}
                style={{
                  width: "34px", height: "34px",
                  borderRadius: "10px", border: "none",
                  background: input.trim() && !isThinking ? "#111" : "#e5e5e5",
                  color: input.trim() && !isThinking ? "#fff" : "#aaa",
                  cursor: isThinking || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                  fontSize: "14px",
                }}>
                {isThinking
                  ? <div style={{
                      width: "14px", height: "14px", borderRadius: "50%",
                      border: "2px solid rgba(0,0,0,0.15)",
                      borderTopColor: "#666",
                      animation: "spin 0.8s linear infinite",
                    }} />
                  : "↑"}
              </button>
            </div>
          </div>
        </div>

        <div style={{
          textAlign: "center", marginTop: "8px",
          fontSize: "10px", color: "#bbb",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.06em",
        }}>
          Powered by Claude · Miss TMS can make mistakes
        </div>
      </div>
    </div>
  );
}