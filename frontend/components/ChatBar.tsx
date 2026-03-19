"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, Square } from "lucide-react";

interface ChatBarProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isThinking: boolean;
  isSpeaking: boolean;
  lastAnswer?: string;
  lastQuestion?: string;
}

const SUGGESTIONS = [
  "Explain photosynthesis",
  "How does gravity work?",
  "Pythagorean theorem",
  "How do computers work?"
];

export default function ChatBar({
  onSend, onStop, isThinking, isSpeaking,
}: ChatBarProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
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

  useEffect(() => { return () => { recognitionRef.current?.stop(); }; }, []);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome for voice input."); return; }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interim = ""; let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t; else interim += t;
      }
      if (final) { setInput(prev => (prev + " " + final).trim()); setTranscript(""); }
      else setTranscript(interim);
    };

    recognition.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setIsListening(false); setTranscript("");
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition && isListeningRef.current) {
        try { recognition.start(); } catch {}
      } else { setIsListening(false); setTranscript(""); }
    };

    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false); setTranscript("");
  }, []);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    stopListening();
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const busy = isThinking || isSpeaking;
  const displayValue = isListening && transcript ? input + " " + transcript : input;

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center",
      padding: "0 0 16px",
    }}>

      {/* Suggestion chips — only on first load */}
      {!busy && !input && !isListening && (
        <div style={{
          display: "flex", gap: "6px", marginBottom: "10px",
          flexWrap: "wrap", justifyContent: "center",
          padding: "0 24px", animation: "fadeUp 0.3s ease both",
        }}>
          {SUGGESTIONS.map(s => (
            <button key={s}
              onClick={() => { setInput(s); inputRef.current?.focus(); }}
              style={{
                background: "#f7f7f8", border: "1px solid #e5e5e5",
                color: "#555", borderRadius: "999px",
                padding: "6px 14px", fontSize: "12px",
                fontFamily: "'Syne', sans-serif", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#efefef"; e.currentTarget.style.borderColor = "#ccc"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f7f7f8"; e.currentTarget.style.borderColor = "#e5e5e5"; }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Input box */}
      <div style={{ width: "100%", maxWidth: "720px", padding: "0 16px" }}>
        <div style={{
          background: "#ffffff",
          border: `1.5px solid ${isListening ? "#e53e3e" : focused ? "#999" : "#e5e5e5"}`,
          borderRadius: "16px",
          boxShadow: isListening
            ? "0 0 0 4px rgba(229,62,62,0.08), 0 2px 12px rgba(0,0,0,0.08)"
            : focused
            ? "0 0 0 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.08)"
            : "0 2px 8px rgba(0,0,0,0.06)",
          transition: "all 0.2s",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* Speaking indicator */}
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

          {/* Listening indicator */}
          {isListening && (
            <div style={{
              padding: "8px 16px 0",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <div style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: "#e53e3e",
                animation: "pulse 1s ease infinite",
              }} />
              <span style={{
                fontSize: "11px", color: "#e53e3e",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.06em", fontWeight: 700,
              }}>
                {transcript ? transcript : "Listening..."}
              </span>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={displayValue}
            onChange={e => { if (!isListening) setInput(e.target.value); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              isThinking ? "Preparing your lesson..."
              : isListening ? ""
              : "Ask Miss TMS anything..."
            }
            disabled={isThinking}
            rows={1}
            style={{
              width: "100%", background: "transparent",
              border: "none", outline: "none",
              color: "#111", fontSize: "15px",
              fontFamily: "'Syne', sans-serif", fontWeight: 500,
              padding: "14px 16px 4px", letterSpacing: "0.01em",
              resize: "none", lineHeight: "1.6", overflow: "hidden",
            }}
          />

          {/* Actions row */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px 10px",
          }}>
            <span style={{
              fontSize: "11px", color: "#bbb",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.04em", paddingLeft: "6px",
            }}>
              {isThinking ? "Thinking..."
                : isListening ? "Speak now · Enter to send"
                : "Enter to send · Shift+Enter newline"}
            </span>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>

              {/* Clear input */}
              {input && !isListening && (
                <button onClick={() => setInput("")} style={{
                  background: "none", border: "none", color: "#ccc",
                  cursor: "pointer", padding: "4px", borderRadius: "6px",
                  display: "flex", alignItems: "center", transition: "color 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.color = "#888"}
                  onMouseLeave={e => e.currentTarget.style.color = "#ccc"}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}

              {/* Stop TTS */}
              {isSpeaking && (
                <button onClick={onStop} style={{
                  background: "#f7f7f8", border: "1px solid #e5e5e5",
                  color: "#444", borderRadius: "8px",
                  padding: "5px 10px", fontSize: "12px",
                  fontFamily: "'Syne', sans-serif", fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#eee"; e.currentTarget.style.borderColor = "#bbb"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#f7f7f8"; e.currentTarget.style.borderColor = "#e5e5e5"; }}
                >
                  <Square size={11} />
                  Stop
                </button>
              )}

              {/* Mic */}
              {!isThinking && !isSpeaking && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  title={isListening ? "Stop listening" : "Speak your question"}
                  style={{
                    width: "34px", height: "34px",
                    borderRadius: "10px", border: "none",
                    background: isListening ? "#e53e3e" : "#f0f0f0",
                    color: isListening ? "#fff" : "#666",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                    boxShadow: isListening ? "0 0 0 3px rgba(229,62,62,0.2)" : "none",
                  }}>
                  {isListening ? <Square size={13} /> : <Mic size={15} />}
                </button>
              )}

              {/* Send */}
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
                }}>
                {isThinking
                  ? <div style={{
                      width: "14px", height: "14px", borderRadius: "50%",
                      border: "2px solid rgba(0,0,0,0.15)", borderTopColor: "#666",
                      animation: "spin 0.8s linear infinite",
                    }} />
                  : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div style={{
          textAlign: "center", marginTop: "8px",
          fontSize: "10px", color: "#ccc",
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em",
        }}>
          Powered by Gemini · Miss TMS can make mistakes
        </div>
      </div>
    </div>
  );
}