"use client";

import { useRef, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import Model from "./Model";

interface AnimatedModelProps {
  boardVisible: boolean;
  isSpeaking: boolean;
  audioAnalyser: AnalyserNode | null;
}

export default function AnimatedModel({ boardVisible, isSpeaking, audioAnalyser }: AnimatedModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const targetX = boardVisible ? 0.6 : 0;

  const timeRef = useRef(0);
  const blinkRef = useRef(0);
  const nextBlinkRef = useRef(3.0);
  const blinkStateRef = useRef(0);
  const freqDataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (audioAnalyser) {
      freqDataRef.current = new Uint8Array(audioAnalyser.frequencyBinCount);
    } else {
      freqDataRef.current = null;
    }
  }, [audioAnalyser]);

  useFrame((_, delta) => {
    if (!groupRef.current || !headRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;

    // Slide left/right
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      0.05
    );

    // Audio volume
    let volume = 0;
    if (audioAnalyser && freqDataRef.current && isSpeaking) {
      audioAnalyser.getByteFrequencyData(freqDataRef.current);
      const sum = freqDataRef.current.reduce((a, b) => a + b, 0);
      volume = sum / freqDataRef.current.length / 255;
    }

    // Breathing
    const breathe = 1 + Math.sin(t * 0.8) * 0.004;
    groupRef.current.scale.setScalar(breathe);

    // Idle head sway
    headRef.current.rotation.x = Math.sin(t * 0.4) * 0.018 + Math.sin(t * 0.7) * 0.008;
    headRef.current.rotation.y = Math.sin(t * 0.3) * 0.012;
    headRef.current.rotation.z = Math.sin(t * 0.25) * 0.010;

    // Talking movement
    if (isSpeaking) {
      headRef.current.rotation.x += Math.sin(t * 3.5) * 0.025 * volume * 4;
      headRef.current.rotation.y += Math.sin(t * 2.1) * 0.015 * volume * 3;
      headRef.current.position.y = THREE.MathUtils.lerp(
        headRef.current.position.y,
        Math.sin(t * 4.0) * 0.008 * volume * 5,
        0.1
      );
      // Jaw simulation via Y scale
      const jawOpen = Math.min(volume * 3.5, 0.06);
      headRef.current.scale.y = THREE.MathUtils.lerp(headRef.current.scale.y, 1 - jawOpen, 0.25);
    } else {
      headRef.current.position.y = THREE.MathUtils.lerp(headRef.current.position.y, 0, 0.05);
      headRef.current.scale.y = THREE.MathUtils.lerp(headRef.current.scale.y, 1, 0.1);
    }

    // Blink
    blinkRef.current += delta;
    if (blinkRef.current >= nextBlinkRef.current && blinkStateRef.current === 0) {
      blinkStateRef.current = 1;
    }
    if (blinkStateRef.current === 1) {
      headRef.current.scale.x = THREE.MathUtils.lerp(headRef.current.scale.x, 0.994, 0.35);
      if (headRef.current.scale.x < 0.996) blinkStateRef.current = 2;
    }
    if (blinkStateRef.current === 2) {
      headRef.current.scale.x = THREE.MathUtils.lerp(headRef.current.scale.x, 1.0, 0.3);
      if (headRef.current.scale.x > 0.999) {
        blinkStateRef.current = 0;
        blinkRef.current = 0;
        nextBlinkRef.current = 2.5 + Math.random() * 3.5;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -4.8, -5]}>
      <group ref={headRef}>
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[0.5, 1.5, 0.5]} />
            <meshStandardMaterial color="#cccccc" />
          </mesh>
        }>
          <Model scale={1.75} />
        </Suspense>
      </group>
      <ContactShadows position={[0, -0.05, 0]} opacity={0.12} scale={3} blur={2} color="#000000" />
    </group>
  );
}