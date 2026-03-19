"use client";

import { Suspense, useRef, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";

type RotXYZ = { x: number; y: number; z: number };

interface BoneRefs {
  spine2:        THREE.Bone;
  neck1:         THREE.Bone;
  head:          THREE.Bone;
  leftEye:       THREE.Bone;
  rightEye:      THREE.Bone;
  leftShoulder:  THREE.Bone;
  leftArm:       THREE.Bone;
  leftForeArm:   THREE.Bone;
  rightShoulder: THREE.Bone;
  rightArm:      THREE.Bone;
  rightForeArm:  THREE.Bone;
  teethLower:    THREE.Object3D;
  teethRestY:    number;
  teethRestRotX: number;
  // Captured bind-pose rotations for every bone we touch
  rest: Record<string, RotXYZ>;
}

// ─────────────────────────────────────────────────────────────
// Head / spine gestures (deltas from rest)
// ─────────────────────────────────────────────────────────────
type HeadGesture = {
  name:     string;
  duration: number;
  spine2?:  Partial<RotXYZ>;
  neck1?:   Partial<RotXYZ>;
  head?:    Partial<RotXYZ>;
};

const TEACHING_GESTURES: HeadGesture[] = [
  { name: "neutral",    duration: 3.0 },
  { name: "nodForward", duration: 2.5, spine2: { x: 0.04 }, neck1: { x: 0.03 }, head: { x: 0.05 } },
  { name: "lookLeft",   duration: 3.0, head: { y:  0.12 }, neck1: { y:  0.06 } },
  { name: "lookRight",  duration: 3.0, head: { y: -0.12 }, neck1: { y: -0.06 } },
  { name: "tiltLeft",   duration: 3.5, head: { z:  0.08 }, neck1: { z:  0.04 } },
  { name: "tiltRight",  duration: 3.5, head: { z: -0.08 }, neck1: { z: -0.04 } },
  { name: "leanIn",     duration: 2.5, spine2: { x: 0.05 }, neck1: { x: 0.04 }, head: { x: 0.04 } },
  { name: "tiltLook",   duration: 3.0, head: { y: 0.08, z: -0.06 }, neck1: { y: 0.04 } },
];

const WAITING_GESTURES: HeadGesture[] = [
  { name: "waitNeutral", duration: 5.0 },
  { name: "waitTilt",    duration: 4.0, head: { z: -0.07, y: 0.05 }, neck1: { z: -0.03 } },
  { name: "waitLookUp",  duration: 3.5, head: { x: -0.04 }, neck1: { x: -0.02 } },
  { name: "waitLeanIn",  duration: 4.5, spine2: { x: 0.03 }, neck1: { x: 0.03 }, head: { x: 0.05 } },
];

function lerp(a: number, b: number, t: number) {
  return THREE.MathUtils.lerp(a, b, t);
}

function snap(r: THREE.Euler): RotXYZ {
  return { x: r.x, y: r.y, z: r.z };
}

// ─────────────────────────────────────────────────────────────
// Inner GLTF loader
// ─────────────────────────────────────────────────────────────
function SyncedModel({
  scale = 1.75,
  onReady,
}: {
  scale?: number;
  onReady: (refs: BoneRefs) => void;
}) {
  const { scene } = useGLTF("/indian_gangster.glb");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;

    const find = (name: string): THREE.Object3D | null => {
      let r: THREE.Object3D | null = null;
      scene.traverse(o => { if (o.name === name) r = o; });
      return r;
    };

    const spine2        = find("Spine2_04")        as THREE.Bone;
    const neck1         = find("Neck1_06")         as THREE.Bone;
    const head          = find("Head_08")          as THREE.Bone;
    const leftEye       = find("LeftEye_09")       as THREE.Bone;
    const rightEye      = find("RightEye_010")     as THREE.Bone;
    const leftShoulder  = find("LeftShoulder_012") as THREE.Bone;
    const leftArm       = find("LeftArm_013")      as THREE.Bone;
    const leftForeArm   = find("LeftForeArm_014")  as THREE.Bone;
    const rightShoulder = find("RightShoulder_038")as THREE.Bone;
    const rightArm      = find("RightArm_039")     as THREE.Bone;
    const rightForeArm  = find("RightForeArm_040") as THREE.Bone;
    const teethLower    = find("AvatarTeethLower") as THREE.Object3D;

    const required = [spine2, neck1, head, leftEye, rightEye,
                      leftShoulder, leftArm, leftForeArm,
                      rightShoulder, rightArm, rightForeArm, teethLower];

    if (required.some(b => !b)) {
      console.warn("⚠️ Missing bones");
      return;
    }

    // Log every bone's exact bind-pose rotation so we can tune offsets
    const boneMap: Record<string, THREE.Object3D> = {
      spine2, neck1, head, leftEye, rightEye,
      leftShoulder, leftArm, leftForeArm,
      rightShoulder, rightArm, rightForeArm,
    };
    console.group("📐 Bind-pose rotations (radians):");
    const rest: Record<string, RotXYZ> = {};
    for (const [k, b] of Object.entries(boneMap)) {
      rest[k] = snap(b.rotation);
      console.log(
        `  ${k.padEnd(16)} x=${rest[k].x.toFixed(4)}  y=${rest[k].y.toFixed(4)}  z=${rest[k].z.toFixed(4)}`
      );
    }
    console.groupEnd();

    called.current = true;
    onReady({
      spine2: spine2!, neck1: neck1!, head: head!,
      leftEye: leftEye!, rightEye: rightEye!,
      leftShoulder: leftShoulder!, leftArm: leftArm!, leftForeArm: leftForeArm!,
      rightShoulder: rightShoulder!, rightArm: rightArm!, rightForeArm: rightForeArm!,
      teethLower: teethLower!,
      teethRestY: teethLower!.position.y,
      teethRestRotX: teethLower!.rotation.x,
      rest,
    });
  }, [scene, onReady]);

  return <primitive object={scene} scale={scale} />;
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────
export default function AnimatedModel({
  isSpeaking,
  audioAnalyser,
}: {
  isSpeaking: boolean;
  audioAnalyser: AnalyserNode | null;
}) {
  const groupRef   = useRef<THREE.Group>(null);
  const timeRef    = useRef(0);
  const freqData   = useRef<Uint8Array | null>(null);
  const B          = useRef<BoneRefs | null>(null);

  // Gesture state
  const curPose    = useRef<HeadGesture>(TEACHING_GESTURES[0]);
  const nextPose   = useRef<HeadGesture>(TEACHING_GESTURES[0]);
  const poseTimer  = useRef(0);
  const blendAlpha = useRef(1.0);
  const isSpeakRef = useRef(false);

  // Smoothed head/spine rotations — absolute world values
  const smSpine2 = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });
  const smNeck1  = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });
  const smHead   = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });

  // Smoothed arm target rotations — absolute (rest + down offset)
  // We lerp arms toward these every frame so they ease into position
  const smLeftArm    = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });
  const smRightArm   = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });
  const armsReady    = useRef(false);

  // Jaw / blink
  const jawOpen    = useRef(0);
  const eyeBlink   = useRef(0);
  const blinkTimer = useRef(0);
  const nextBlink  = useRef(3.0);
  const blinkPhase = useRef<"idle"|"closing"|"opening">("idle");

  const pickNext = useCallback(() => {
    const pool   = isSpeakRef.current ? TEACHING_GESTURES : WAITING_GESTURES;
    const others = pool.filter(g => g.name !== curPose.current.name);
    nextPose.current   = others[Math.floor(Math.random() * others.length)] ?? pool[0];
    blendAlpha.current = 0;
  }, []);

  const handleReady = useCallback((refs: BoneRefs) => {
    B.current = refs;
    const { rest } = refs;

    // Seed head/spine smooth values from bind pose
    smSpine2.current = { ...rest.spine2 };
    smNeck1.current  = { ...rest.neck1  };
    smHead.current   = { ...rest.head   };

    // ── ARM DOWN TARGETS ──────────────────────────────────
    // T-pose: arms are horizontal (Z ≈ ±1.57 rad from spine).
    // To bring them to a relaxed "hands at sides" position we rotate
    // Z back toward 0 (or slightly past). The exact target is:
    //   leftArm  Z: rest.z + 1.4   (rotate inward/down)
    //   rightArm Z: rest.z - 1.4   (mirror)
    // We also tuck the forearms slightly inward with a small X bend.
    // These are absolute rotation targets — we lerp to them on mount.

    const LA = rest.leftArm;
    const RA = rest.rightArm;

    smLeftArm.current = {
      x: LA.x + 0.05,         // slight forward lean
      y: LA.y,
      z: LA.z + 1.42,         // rotate arm DOWN from T-pose
    };
    smRightArm.current = {
      x: RA.x + 0.05,
      y: RA.y,
      z: RA.z - 1.42,         // mirror
    };

    armsReady.current = true;

    console.log("🎯 Arm targets set:",
      `L z=${smLeftArm.current.z.toFixed(3)}`,
      `R z=${smRightArm.current.z.toFixed(3)}`
    );
  }, []);

  useEffect(() => { pickNext(); }, [pickNext]);

  useFrame((_, delta) => {
    if (!groupRef.current || !B.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    isSpeakRef.current = isSpeaking;

    // ── Volume ─────────────────────────────────────────────
    let volume = 0;
    if (audioAnalyser && isSpeaking) {
      if (!freqData.current) freqData.current = new Uint8Array(audioAnalyser.frequencyBinCount);
      audioAnalyser.getByteFrequencyData(freqData.current);
      let sum = 0;
      for (let i = 2; i < 14; i++) sum += freqData.current[i];
      volume = sum / (12 * 255);
    }

    // ── Gesture timer ──────────────────────────────────────
    poseTimer.current += delta;
    if (poseTimer.current >= curPose.current.duration) {
      poseTimer.current = 0;
      curPose.current   = nextPose.current;
      pickNext();
    }
    blendAlpha.current = Math.min(blendAlpha.current + delta * 1.0, 1.0);
    const pose = blendAlpha.current >= 1 ? curPose.current : nextPose.current;

    const SPEED      = 0.04;
    const ARM_SPEED  = 0.06;   // arms ease in a bit faster on load

    const { rest,
            spine2, neck1, head, leftEye, rightEye,
            leftShoulder, leftArm, leftForeArm,
            rightShoulder, rightArm, rightForeArm,
            teethLower, teethRestY, teethRestRotX } = B.current;

    // ── Head / spine smooth ────────────────────────────────
    smSpine2.current.x = lerp(smSpine2.current.x, (pose.spine2?.x ?? 0), SPEED);
    smSpine2.current.y = lerp(smSpine2.current.y, (pose.spine2?.y ?? 0), SPEED);
    smSpine2.current.z = lerp(smSpine2.current.z, (pose.spine2?.z ?? 0), SPEED);

    smNeck1.current.x  = lerp(smNeck1.current.x,  (pose.neck1?.x  ?? 0), SPEED * 1.3);
    smNeck1.current.y  = lerp(smNeck1.current.y,  (pose.neck1?.y  ?? 0), SPEED * 1.3);
    smNeck1.current.z  = lerp(smNeck1.current.z,  (pose.neck1?.z  ?? 0), SPEED * 1.3);

    smHead.current.x   = lerp(smHead.current.x,   (pose.head?.x   ?? 0), SPEED * 1.5);
    smHead.current.y   = lerp(smHead.current.y,   (pose.head?.y   ?? 0), SPEED * 1.5);
    smHead.current.z   = lerp(smHead.current.z,   (pose.head?.z   ?? 0), SPEED * 1.5);

    // ── Body breathing ─────────────────────────────────────
    groupRef.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.003);

    // ── Spine ──────────────────────────────────────────────
    if (spine2) {
      spine2.rotation.x = smSpine2.current.x + Math.sin(t * 0.7) * 0.003;
      spine2.rotation.y = smSpine2.current.y;
      spine2.rotation.z = smSpine2.current.z + Math.sin(t * 0.5) * 0.002;
    }

    // ── Neck ───────────────────────────────────────────────
    if (neck1) {
      neck1.rotation.x = smNeck1.current.x;
      neck1.rotation.y = smNeck1.current.y;
      neck1.rotation.z = smNeck1.current.z;
    }

    // ── Head ───────────────────────────────────────────────
    if (head) {
      const idleX = Math.sin(t * 0.38) * 0.008 + Math.sin(t * 0.61) * 0.003;
      const idleY = Math.sin(t * 0.27) * 0.006;
      const idleZ = Math.sin(t * 0.21) * 0.004;
      const talkX = isSpeaking ? Math.sin(t * 3.5) * 0.007 * volume * 2.5 : 0;
      const talkY = isSpeaking ? Math.sin(t * 2.2) * 0.005 * volume * 2.0 : 0;
      head.rotation.x = smHead.current.x + idleX + talkX;
      head.rotation.y = smHead.current.y + idleY + talkY;
      head.rotation.z = smHead.current.z + idleZ;
    }

    // ── Arms — lerp every frame toward down-target ─────────
    if (armsReady.current) {
      const breathSway = Math.sin(t * 0.7) * 0.004;

      // Left arm: ease toward down position
      leftArm.rotation.x = lerp(leftArm.rotation.x, smLeftArm.current.x, ARM_SPEED);
      leftArm.rotation.y = lerp(leftArm.rotation.y, smLeftArm.current.y, ARM_SPEED);
      leftArm.rotation.z = lerp(leftArm.rotation.z, smLeftArm.current.z + breathSway, ARM_SPEED);

      // Left forearm: rest rotation + slight tuck
      const LF = rest.leftForeArm;
      leftForeArm.rotation.x = lerp(leftForeArm.rotation.x, LF.x + 0.08, ARM_SPEED);
      leftForeArm.rotation.y = lerp(leftForeArm.rotation.y, LF.y,        ARM_SPEED);
      leftForeArm.rotation.z = lerp(leftForeArm.rotation.z, LF.z,        ARM_SPEED);

      // Right arm
      rightArm.rotation.x = lerp(rightArm.rotation.x, smRightArm.current.x, ARM_SPEED);
      rightArm.rotation.y = lerp(rightArm.rotation.y, smRightArm.current.y, ARM_SPEED);
      rightArm.rotation.z = lerp(rightArm.rotation.z, smRightArm.current.z - breathSway, ARM_SPEED);

      // Right forearm
      const RF = rest.rightForeArm;
      rightForeArm.rotation.x = lerp(rightForeArm.rotation.x, RF.x + 0.08, ARM_SPEED);
      rightForeArm.rotation.y = lerp(rightForeArm.rotation.y, RF.y,        ARM_SPEED);
      rightForeArm.rotation.z = lerp(rightForeArm.rotation.z, RF.z,        ARM_SPEED);

      // Shoulders: keep at rest (no change)
      leftShoulder.rotation.x  = lerp(leftShoulder.rotation.x,  rest.leftShoulder.x,  ARM_SPEED);
      leftShoulder.rotation.y  = lerp(leftShoulder.rotation.y,  rest.leftShoulder.y,  ARM_SPEED);
      leftShoulder.rotation.z  = lerp(leftShoulder.rotation.z,  rest.leftShoulder.z,  ARM_SPEED);
      rightShoulder.rotation.x = lerp(rightShoulder.rotation.x, rest.rightShoulder.x, ARM_SPEED);
      rightShoulder.rotation.y = lerp(rightShoulder.rotation.y, rest.rightShoulder.y, ARM_SPEED);
      rightShoulder.rotation.z = lerp(rightShoulder.rotation.z, rest.rightShoulder.z, ARM_SPEED);
    }

    // ── Blink ──────────────────────────────────────────────
    blinkTimer.current += delta;
    if (blinkTimer.current >= nextBlink.current && blinkPhase.current === "idle") {
      blinkPhase.current = "closing";
    }
    if (blinkPhase.current === "closing") {
      eyeBlink.current = lerp(eyeBlink.current, 1, 0.42);
      if (eyeBlink.current > 0.88) blinkPhase.current = "opening";
    }
    if (blinkPhase.current === "opening") {
      eyeBlink.current = lerp(eyeBlink.current, 0, 0.36);
      if (eyeBlink.current < 0.08) {
        eyeBlink.current   = 0;
        blinkPhase.current = "idle";
        blinkTimer.current = 0;
        nextBlink.current  = 2.5 + Math.random() * 3.5;
      }
    }
    if (leftEye && rightEye) {
      const ey = 1 - eyeBlink.current * 0.9;
      leftEye.scale.y  = ey;
      rightEye.scale.y = ey;
    }

    // ── Jaw ────────────────────────────────────────────────
    if (teethLower) {
      const target = isSpeaking
        ? Math.min(volume * 3.2, 1.0) * (0.7 + Math.sin(t * 9.0) * 0.3)
        : 0;
      jawOpen.current = lerp(jawOpen.current, target, 0.25);
      const o = jawOpen.current;
      teethLower.position.y = teethRestY - o * 0.012;
      teethLower.rotation.x = teethRestRotX + o * 0.18;
    }
  });

  return (
    <group ref={groupRef} position={[0, -4.8, 0]}>
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[0.5, 1.5, 0.5]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      }>
        <SyncedModel scale={1.75} onReady={handleReady} />
      </Suspense>
      <ContactShadows position={[0, -0.05, 0]} opacity={0.12} scale={3} blur={2} color="#000000" />
    </group>
  );
}