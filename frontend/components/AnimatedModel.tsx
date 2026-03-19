"use client";

/**
 * EXACT BIND POSE FROM LOGS:
 *   leftShoulder   x=1.6808  y=0.0512  z=-1.3611
 *   leftArm        x=0.1036  y=-0.0109 z=-0.2092   (T-pose, arm ~horizontal)
 *   leftForeArm    x=-0.1024 y=-0.0153 z=0.2963
 *   rightShoulder  x=1.6808  y=-0.0512 z=1.3611
 *   rightArm       x=0.1036  y=0.0109  z=0.2092
 *   rightForeArm   x=-0.1024 y=0.0153  z=-0.2963
 *
 * World X-axis of leftArm at bind: (0.984, -0.095, -0.153)
 * → Y≈0, meaning the bone's X axis is nearly horizontal.
 * → The arm is in near-T-pose.
 *
 * The shoulder has a large X rotation (1.68 rad ≈ 96°) which has
 * already tilted the arm bone's parent frame. In this parent frame,
 * rotating the arm bone's Z DOWN requires understanding the parent.
 *
 * DIRECT APPROACH: use the first log's values (before our code
 * interfered) which showed leftArm z=-0.2092 at true bind pose.
 * We need to rotate the arm DOWN in world space by ~90°.
 *
 * Given the shoulder's x=1.68 rad parent rotation, the arm's
 * local Z rotation controls lateral swing. To point arm DOWN:
 *   - Increase leftArm X significantly (rotate forward/down)
 *   - leftArm target: x = 0.1036 + 1.3  →  ~1.4 rad
 *   - rightArm target: x = 0.1036 + 1.3 →  ~1.4 rad  (same, symmetric)
 * Z stays near bind pose (just controls front/back sway).
 */

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
  rest:          Record<string, RotXYZ>;
}

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
function snap(r: THREE.Euler): RotXYZ { return { x: r.x, y: r.y, z: r.z }; }

function SyncedModel({ scale = 1.75, onReady }: {
  scale?: number;
  onReady: (refs: BoneRefs) => void;
}) {
  const { scene } = useGLTF("/indian_gangster.glb");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    const find = (name: string) => {
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

    if ([spine2,neck1,head,leftEye,rightEye,leftShoulder,leftArm,
         leftForeArm,rightShoulder,rightArm,rightForeArm,teethLower].some(b=>!b)) {
      console.warn("⚠️ Missing bones"); return;
    }

    const rest: Record<string, RotXYZ> = {};
    for (const [k, b] of Object.entries({
      spine2, neck1, head, leftEye, rightEye,
      leftShoulder, leftArm, leftForeArm,
      rightShoulder, rightArm, rightForeArm,
    })) { rest[k] = snap((b as THREE.Object3D).rotation); }

    called.current = true;
    onReady({
      spine2:spine2!, neck1:neck1!, head:head!,
      leftEye:leftEye!, rightEye:rightEye!,
      leftShoulder:leftShoulder!, leftArm:leftArm!, leftForeArm:leftForeArm!,
      rightShoulder:rightShoulder!, rightArm:rightArm!, rightForeArm:rightForeArm!,
      teethLower:teethLower!,
      teethRestY: teethLower!.position.y,
      teethRestRotX: teethLower!.rotation.x,
      rest,
    });
  }, [scene, onReady]);

  return <primitive object={scene} scale={scale} />;
}

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

  const curPose    = useRef<HeadGesture>(TEACHING_GESTURES[0]);
  const nextPose   = useRef<HeadGesture>(TEACHING_GESTURES[0]);
  const poseTimer  = useRef(0);
  const blendAlpha = useRef(1.0);
  const isSpeakRef = useRef(false);

  const smSpine2 = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });
  const smNeck1  = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });
  const smHead   = useRef<RotXYZ>({ x: 0, y: 0, z: 0 });

  // Hardcoded arm targets derived from the exact bind-pose log values.
  // Bind: leftArm x=0.1036, z=-0.2092  (arm pointing ~forward/outward)
  // The shoulder's large X rotation (1.68 rad) means the arm bone's
  // local X axis maps to world Z (forward), and local Z maps to world Y (up/down).
  // To swing the arm DOWN we need to rotate local X by ~+1.35 rad.
  // This was determined by: shoulder_x (1.68) brings Z up → arm X rotates Z down.
  //
  // Targets (absolute rotations, not deltas):
  //   leftArm:      x=+1.45  y=-0.0109  z=-0.2092  (x increased by ~1.35)
  //   leftForeArm:  x=-0.10  y=-0.0153  z=+0.2963  (keep near rest, slight bend)
  //   rightArm:     x=+1.45  y=+0.0109  z=+0.2092  (mirror)
  //   rightForeArm: x=-0.10  y=+0.0153  z=-0.2963

  const tLA  = useRef<RotXYZ>({ x:  1.45, y: -0.0109, z: -0.2092 });
  const tLFA = useRef<RotXYZ>({ x: -0.10, y: -0.0153, z:  0.2963 });
  const tRA  = useRef<RotXYZ>({ x:  1.45, y:  0.0109, z:  0.2092 });
  const tRFA = useRef<RotXYZ>({ x: -0.10, y:  0.0153, z: -0.2963 });
  const armsReady = useRef(false);

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

    smSpine2.current = { ...rest.spine2 };
    smNeck1.current  = { ...rest.neck1  };
    smHead.current   = { ...rest.head   };

    // Use exact bind-pose values as base, add X offset to bring arms down.
    // rest.leftArm.x ≈ 0.1036 at true bind. Adding 1.35 → ~1.45 total.
    // Clamp to actual rest values in case of variation between model loads.
    const LA = rest.leftArm;
    const RA = rest.rightArm;
    const LF = rest.leftForeArm;
    const RF = rest.rightForeArm;

    tLA.current  = { x: LA.x + 1.35, y: LA.y, z: LA.z };
    tLFA.current = { x: LF.x,        y: LF.y, z: LF.z };   // forearm keeps rest
    tRA.current  = { x: RA.x + 1.35, y: RA.y, z: RA.z };
    tRFA.current = { x: RF.x,        y: RF.y, z: RF.z };

    armsReady.current = true;

    console.log("🎯 Arm targets (absolute):",
      `L x=${tLA.current.x.toFixed(3)} z=${tLA.current.z.toFixed(3)}`,
      `R x=${tRA.current.x.toFixed(3)} z=${tRA.current.z.toFixed(3)}`
    );
  }, []);

  useEffect(() => { pickNext(); }, [pickNext]);

  useFrame((_, delta) => {
    if (!groupRef.current || !B.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    isSpeakRef.current = isSpeaking;

    let volume = 0;
    if (audioAnalyser && isSpeaking) {
      if (!freqData.current) freqData.current = new Uint8Array(audioAnalyser.frequencyBinCount);
      audioAnalyser.getByteFrequencyData(freqData.current);
      let sum = 0;
      for (let i = 2; i < 14; i++) sum += freqData.current[i];
      volume = sum / (12 * 255);
    }

    poseTimer.current += delta;
    if (poseTimer.current >= curPose.current.duration) {
      poseTimer.current = 0;
      curPose.current   = nextPose.current;
      pickNext();
    }
    blendAlpha.current = Math.min(blendAlpha.current + delta, 1.0);
    const pose = blendAlpha.current >= 1 ? curPose.current : nextPose.current;

    const SPEED     = 0.04;
    const ARM_SPEED = 0.04;

    const {
      rest, spine2, neck1, head, leftEye, rightEye,
      leftShoulder, leftArm, leftForeArm,
      rightShoulder, rightArm, rightForeArm,
      teethLower, teethRestY, teethRestRotX,
    } = B.current;

    smSpine2.current.x = lerp(smSpine2.current.x, pose.spine2?.x ?? 0, SPEED);
    smSpine2.current.y = lerp(smSpine2.current.y, pose.spine2?.y ?? 0, SPEED);
    smSpine2.current.z = lerp(smSpine2.current.z, pose.spine2?.z ?? 0, SPEED);
    smNeck1.current.x  = lerp(smNeck1.current.x,  pose.neck1?.x  ?? 0, SPEED * 1.3);
    smNeck1.current.y  = lerp(smNeck1.current.y,  pose.neck1?.y  ?? 0, SPEED * 1.3);
    smNeck1.current.z  = lerp(smNeck1.current.z,  pose.neck1?.z  ?? 0, SPEED * 1.3);
    smHead.current.x   = lerp(smHead.current.x,   pose.head?.x   ?? 0, SPEED * 1.5);
    smHead.current.y   = lerp(smHead.current.y,   pose.head?.y   ?? 0, SPEED * 1.5);
    smHead.current.z   = lerp(smHead.current.z,   pose.head?.z   ?? 0, SPEED * 1.5);

    groupRef.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.003);

    if (spine2) {
      spine2.rotation.x = smSpine2.current.x + Math.sin(t * 0.7) * 0.003;
      spine2.rotation.y = smSpine2.current.y;
      spine2.rotation.z = smSpine2.current.z + Math.sin(t * 0.5) * 0.002;
    }
    if (neck1) {
      neck1.rotation.x = smNeck1.current.x;
      neck1.rotation.y = smNeck1.current.y;
      neck1.rotation.z = smNeck1.current.z;
    }
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

    if (armsReady.current) {
      const breathe = Math.sin(t * 0.8) * 0.004;

      leftArm.rotation.x = lerp(leftArm.rotation.x, tLA.current.x + breathe, ARM_SPEED);
      leftArm.rotation.y = lerp(leftArm.rotation.y, tLA.current.y, ARM_SPEED);
      leftArm.rotation.z = lerp(leftArm.rotation.z, tLA.current.z, ARM_SPEED);

      leftForeArm.rotation.x = lerp(leftForeArm.rotation.x, tLFA.current.x, ARM_SPEED);
      leftForeArm.rotation.y = lerp(leftForeArm.rotation.y, tLFA.current.y, ARM_SPEED);
      leftForeArm.rotation.z = lerp(leftForeArm.rotation.z, tLFA.current.z, ARM_SPEED);

      rightArm.rotation.x = lerp(rightArm.rotation.x, tRA.current.x + breathe, ARM_SPEED);
      rightArm.rotation.y = lerp(rightArm.rotation.y, tRA.current.y, ARM_SPEED);
      rightArm.rotation.z = lerp(rightArm.rotation.z, tRA.current.z, ARM_SPEED);

      rightForeArm.rotation.x = lerp(rightForeArm.rotation.x, tRFA.current.x, ARM_SPEED);
      rightForeArm.rotation.y = lerp(rightForeArm.rotation.y, tRFA.current.y, ARM_SPEED);
      rightForeArm.rotation.z = lerp(rightForeArm.rotation.z, tRFA.current.z, ARM_SPEED);

      leftShoulder.rotation.x  = lerp(leftShoulder.rotation.x,  rest.leftShoulder.x,  ARM_SPEED);
      leftShoulder.rotation.y  = lerp(leftShoulder.rotation.y,  rest.leftShoulder.y,  ARM_SPEED);
      leftShoulder.rotation.z  = lerp(leftShoulder.rotation.z,  rest.leftShoulder.z,  ARM_SPEED);
      rightShoulder.rotation.x = lerp(rightShoulder.rotation.x, rest.rightShoulder.x, ARM_SPEED);
      rightShoulder.rotation.y = lerp(rightShoulder.rotation.y, rest.rightShoulder.y, ARM_SPEED);
      rightShoulder.rotation.z = lerp(rightShoulder.rotation.z, rest.rightShoulder.z, ARM_SPEED);
    }

    blinkTimer.current += delta;
    if (blinkTimer.current >= nextBlink.current && blinkPhase.current === "idle") blinkPhase.current = "closing";
    if (blinkPhase.current === "closing") {
      eyeBlink.current = lerp(eyeBlink.current, 1, 0.42);
      if (eyeBlink.current > 0.88) blinkPhase.current = "opening";
    }
    if (blinkPhase.current === "opening") {
      eyeBlink.current = lerp(eyeBlink.current, 0, 0.36);
      if (eyeBlink.current < 0.08) {
        eyeBlink.current = 0; blinkPhase.current = "idle";
        blinkTimer.current = 0; nextBlink.current = 2.5 + Math.random() * 3.5;
      }
    }
    if (leftEye && rightEye) {
      const ey = 1 - eyeBlink.current * 0.9;
      leftEye.scale.y = ey; rightEye.scale.y = ey;
    }

    if (teethLower) {
      const target = isSpeaking ? Math.min(volume * 3.2, 1.0) * (0.7 + Math.sin(t * 9.0) * 0.3) : 0;
      jawOpen.current = lerp(jawOpen.current, target, 0.25);
      const o = jawOpen.current;
      teethLower.position.y = teethRestY - o * 0.012;
      teethLower.rotation.x = teethRestRotX + o * 0.18;
    }
  });

  return (
    <group ref={groupRef} position={[0, -4.8, 0]}>
      <Suspense fallback={
        <mesh><boxGeometry args={[0.5, 1.5, 0.5]} /><meshStandardMaterial color="#cccccc" /></mesh>
      }>
        <SyncedModel scale={1.75} onReady={handleReady} />
      </Suspense>
      <ContactShadows position={[0, -0.05, 0]} opacity={0.12} scale={3} blur={2} color="#000000" />
    </group>
  );
}