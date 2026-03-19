"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  analyser?:   AnalyserNode | null;   // live TTS analyser from Scene (optional)
  onForceJaw?: (v: number) => void;   // directly drive jaw open 0-1
}

export default function MouthDebug({ analyser, onForceJaw }: Props) {
  const [volume,    setVolume]    = useState(0);
  const [peak,      setPeak]      = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [forceJaw,  setForceJaw]  = useState(0);
  const [visible,   setVisible]   = useState(true);
  const [ctxState,  setCtxState]  = useState<"none"|"ready"|"suspended">("none");

  // MouthDebug owns its own AudioContext — created on first button click,
  // no dependency on parent component initialisation order.
  const ownCtx       = useRef<AudioContext | null>(null);
  const ownAnalyser  = useRef<AnalyserNode | null>(null);
  const oscillators  = useRef<OscillatorNode[]>([]);
  const gainNode     = useRef<GainNode | null>(null);
  const rafRef       = useRef<number>(0);
  const freqData     = useRef<Uint8Array | null>(null);
  const peakHold     = useRef(0);
  const peakDecay    = useRef(0);

  // ── Get/create the AudioContext ────────────────────────────
  const getCtx = (): AudioContext => {
    if (!ownCtx.current) {
      ownCtx.current = new AudioContext();
      console.log("✅ MouthDebug: created own AudioContext");
    }
    return ownCtx.current;
  };

  // ── Get the best available analyser ───────────────────────
  // Priority: live TTS analyser from Scene > own test analyser
  const getActiveAnalyser = (): AnalyserNode => {
    if (analyser) return analyser;
    if (!ownAnalyser.current) {
      const ctx = getCtx();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.6;
      an.connect(ctx.destination);
      ownAnalyser.current = an;
      console.log("✅ MouthDebug: created own AnalyserNode");
    }
    return ownAnalyser.current;
  };

  // ── Live volume poll (rAF loop) ────────────────────────────
  useEffect(() => {
    let handle: number;
    const poll = () => {
      // Use live TTS analyser when available, else own analyser (during test)
      const an = analyser ?? ownAnalyser.current;
      if (an) {
        if (!freqData.current || freqData.current.length !== an.frequencyBinCount) {
          freqData.current = new Uint8Array(an.frequencyBinCount);
        }
        an.getByteFrequencyData(freqData.current);
        let sumSq = 0;
        const end = Math.min(30, freqData.current.length);
        for (let i = 1; i < end; i++) {
          const n = freqData.current[i] / 255;
          sumSq += n * n;
        }
        const rms = Math.sqrt(sumSq / (end - 1));
        const vol = Math.min(rms * 3.5, 1.0);

        if (vol > peakHold.current) {
          peakHold.current  = vol;
          peakDecay.current = 60;
        } else if (peakDecay.current > 0) {
          peakDecay.current--;
        } else {
          peakHold.current = Math.max(0, peakHold.current - 0.015);
        }
        setVolume(vol);
        setPeak(peakHold.current);
      } else {
        setVolume(0);
        setPeak(0);
      }
      handle = requestAnimationFrame(poll);
    };
    handle = requestAnimationFrame(poll);
    rafRef.current = handle;
    return () => cancelAnimationFrame(handle);
  }, [analyser]); // re-runs when live analyser connects/disconnects

  // ── Test tone ──────────────────────────────────────────────
  const startTest = async () => {
    stopTest(); // clear any previous

    // Create or reuse own AudioContext — no parent dependency
    const ctx = getCtx();
    if (ctx.state === "suspended") await ctx.resume();
    setCtxState("ready");

    const an = getActiveAnalyser();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.connect(an);
    gainNode.current = gain;

    // Speech-like formants: fundamental + F1 + F2 + F3
    const freqs = [180, 600, 1200, 2400];
    const vols  = [0.5, 0.3,  0.2,  0.1];

    oscillators.current = freqs.map((freq, i) => {
      const osc     = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      oscGain.gain.setValueAtTime(vols[i], ctx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      return osc;
    });

    // 4 Hz LFO — syllable rhythm pulsing
    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(4, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.2, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    oscillators.current.push(lfo);

    setIsTesting(true);
  };

  const stopTest = () => {
    oscillators.current.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
    oscillators.current = [];
    gainNode.current?.disconnect();
    gainNode.current = null;
    setIsTesting(false);
  };

  const handleForceJaw = (v: number) => {
    setForceJaw(v);
    onForceJaw?.(v);
  };

  // ── Derived display ────────────────────────────────────────
  const volPct  = Math.round(volume * 100);
  const peakPct = Math.round(peak   * 100);
  const hasLive = !!analyser;

  if (!visible) return (
    <button onClick={() => setVisible(true)} style={{
      position: "absolute", bottom: "100px", right: "12px",
      background: "rgba(0,0,0,0.7)", color: "#0f0",
      border: "1px solid #0f0", borderRadius: "6px",
      padding: "4px 10px", fontSize: "11px",
      fontFamily: "monospace", cursor: "pointer", zIndex: 100,
    }}>👁 debug</button>
  );

  return (
    <div style={{
      position: "absolute", bottom: "100px", right: "12px",
      background: "rgba(0,0,0,0.9)",
      border: `1px solid ${hasLive ? "rgba(0,255,0,0.6)" : "rgba(0,200,255,0.4)"}`,
      borderRadius: "10px", padding: "12px 14px",
      zIndex: 100, width: "230px",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "11px", color: "#0f0",
      boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.1em" }}>🎤 MOUTH DEBUG</span>
        <button onClick={() => setVisible(false)} style={{
          background: "none", border: "none", color: "#555",
          cursor: "pointer", fontSize: "14px",
        }}>✕</button>
      </div>

      {/* Analyser status */}
      <div style={{ marginBottom: "8px", fontSize: "10px" }}>
        {hasLive
          ? <span style={{ color: "#0f0" }}>● LIVE TTS analyser connected</span>
          : isTesting
          ? <span style={{ color: "#0cf" }}>◎ TEST TONE playing (own analyser)</span>
          : <span style={{ color: "#888" }}>○ idle — click ▶ to test</span>
        }
      </div>

      {/* Volume bar */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
          <span style={{ opacity: 0.6 }}>VOLUME (RMS)</span>
          <span style={{ color: volPct > 30 ? "#0f0" : volPct > 5 ? "#ff0" : "#666" }}>
            {volPct}%
          </span>
        </div>
        <div style={{
          height: "10px", background: "rgba(255,255,255,0.08)",
          borderRadius: "3px", overflow: "hidden", position: "relative",
        }}>
          <div style={{
            height: "100%", width: `${volPct}%`,
            background: volPct > 60 ? "#f44" : volPct > 20 ? "#0f0" : "#ff0",
            borderRadius: "3px", transition: "width 0.03s",
          }} />
          {/* Peak hold marker */}
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${peakPct}%`, width: "2px",
            background: "rgba(255,255,255,0.7)",
            transition: "left 0.1s",
          }} />
        </div>
      </div>

      {/* Jaw values */}
      <div style={{ marginBottom: "10px", opacity: 0.55, fontSize: "10px" }}>
        pos.y  −{(volume * 0.045).toFixed(4)} units<br/>
        rot.x +{(volume * 0.35).toFixed(3)} rad
      </div>

      {/* Force jaw slider */}
      {onForceJaw && (
        <div style={{ marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ opacity: 0.7 }}>FORCE JAW OPEN</span>
            <span style={{ color: "#ff0" }}>{Math.round(forceJaw * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={forceJaw}
            onChange={e => handleForceJaw(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#ff0" }}
          />
          <div style={{ opacity: 0.4, fontSize: "10px" }}>
            Drag to open jaw without audio ↑
          </div>
        </div>
      )}

      {/* Test tone button */}
      <button
        onClick={isTesting ? stopTest : startTest}
        style={{
          width: "100%", padding: "8px",
          background: isTesting ? "rgba(255,50,50,0.25)" : "rgba(0,200,255,0.15)",
          border: `1px solid ${isTesting ? "#f55" : "#0cf"}`,
          borderRadius: "6px",
          color: isTesting ? "#f77" : "#0cf",
          fontFamily: "monospace", fontSize: "11px",
          cursor: "pointer", letterSpacing: "0.08em", fontWeight: 700,
        }}
      >
        {isTesting ? "■ STOP TEST TONE" : "▶ TEST MOUTH (no backend needed)"}
      </button>

      {isTesting && (
        <div style={{ marginTop: "6px", opacity: 0.5, fontSize: "10px", textAlign: "center" }}>
          Speech formants: 180 · 600 · 1200 · 2400 Hz<br/>
          4 Hz syllable pulse → watch volume bar + jaw
        </div>
      )}
    </div>
  );
}