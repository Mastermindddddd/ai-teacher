/**
 * BoneDump.tsx  —  debug component
 * 
 * Drop this temporarily into your scene to print every bone name:
 * 
 *  
 * 
 * Check your browser console for the full list, then remove this file.
 */

"use client";
import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function BoneDump() {
  const { scene } = useGLTF("/indian_gangster.glb");

  useEffect(() => {
    const bones: { name: string; type: string }[] = [];
    scene.traverse(obj => {
      if (obj instanceof THREE.Bone || obj instanceof THREE.Object3D) {
        bones.push({ name: obj.name, type: obj.type });
      }
    });
    console.group("🦴 All bones / nodes in model:");
    bones.forEach(b => console.log(`  [${b.type}] ${b.name}`));
    console.groupEnd();

    // Also specifically flag likely jaw bones
    const jawCandidates = bones.filter(b =>
      b.name.toLowerCase().includes("jaw") ||
      b.name.toLowerCase().includes("mouth") ||
      b.name.toLowerCase().includes("lower") ||
      b.name.toLowerCase().includes("mandible")
    );
    if (jawCandidates.length) {
      console.log("🎯 Jaw bone candidates:", jawCandidates.map(b => b.name));
    } else {
      console.warn("⚠️ No obvious jaw bone found. Check full list above.");
    }
  }, [scene]);

  return null;
}