"use client";

/**
 * TeethDump.tsx — drop temporarily into your Canvas Suspense to
 * find what's actually controlling the lower teeth geometry.
 * 
 * Add to Scene.tsx inside <Suspense fallback={null}>:
 *   import TeethDump from "./TeethDump";
 *   <TeethDump />
 * 
 * Remove after reading the console output.
 */

import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function TeethDump() {
  const { scene } = useGLTF("/indian_gangster.glb");

  useEffect(() => {
    console.group("🦷 TEETH INVESTIGATION");

    // 1. Find all objects with "teeth" or "lower" in name
    console.log("\n--- All nodes with 'teeth' or 'lower' in name ---");
    scene.traverse(obj => {
      const n = obj.name.toLowerCase();
      if (n.includes("teeth") || n.includes("lower") || n.includes("jaw") || n.includes("mouth")) {
        console.log(
          `[${obj.type}] ${obj.name}`,
          `pos:(${obj.position.x.toFixed(3)},${obj.position.y.toFixed(3)},${obj.position.z.toFixed(3)})`,
          `children:${obj.children.length}`
        );
        if (obj instanceof THREE.SkinnedMesh) {
          console.log("  → IS SkinnedMesh ✅");
          console.log("  → geometry.attributes:", Object.keys(obj.geometry.attributes));
          // Log the skeleton bones it's bound to
          if (obj.skeleton) {
            console.log("  → skeleton bones:", obj.skeleton.bones.map(b => b.name).join(", "));
          }
        }
        // Log children
        obj.children.forEach(c => {
          console.log(`  child: [${c.type}] ${c.name}`);
          if (c instanceof THREE.SkinnedMesh) {
            console.log("    → SkinnedMesh ✅ skeleton:", c.skeleton?.bones.length, "bones");
          }
        });
      }
    });

    // 2. Find all SkinnedMeshes and their bone influence
    console.log("\n--- All SkinnedMeshes in scene ---");
    scene.traverse(obj => {
      if (obj instanceof THREE.SkinnedMesh) {
        console.log(`[SkinnedMesh] ${obj.name || "(unnamed)"} — skeleton: ${obj.skeleton?.bones.length} bones`);
        
        // Check if this mesh has JOINTS_0 (bone weights)
        const joints = obj.geometry.attributes["JOINTS_0"] || obj.geometry.attributes["skinIndex"];
        const weights = obj.geometry.attributes["WEIGHTS_0"] || obj.geometry.attributes["skinWeight"];
        
        if (joints && weights && obj.skeleton) {
          // Sample first 5 vertices to see which bones they're weighted to
          const sampleCount = Math.min(5, joints.count);
          const boneInfluences = new Set<string>();
          for (let i = 0; i < sampleCount; i++) {
            for (let j = 0; j < 4; j++) {
              const boneIdx = joints.getComponent(i, j);
              const w = weights.getComponent(i, j);
              if (w > 0.1 && obj.skeleton.bones[boneIdx]) {
                boneInfluences.add(obj.skeleton.bones[boneIdx].name);
              }
            }
          }
          if (boneInfluences.size > 0) {
            console.log(`  → influenced by bones: ${[...boneInfluences].join(", ")}`);
          }
        }
      }
    });

    // 3. Specifically check AvatarTeethLower and AvatarTeethUpper
    console.log("\n--- TeethLower node deep dive ---");
    const findAll = (name: string) => {
      const results: THREE.Object3D[] = [];
      scene.traverse(o => { if (o.name === name) results.push(o); });
      return results;
    };
    
    ["AvatarTeethLower", "AvatarTeethUpper"].forEach(name => {
      const nodes = findAll(name);
      console.log(`\n${name}: found ${nodes.length} node(s)`);
      nodes.forEach(node => {
        console.log(`  type: ${node.type}`);
        console.log(`  world pos:`, (() => {
          const wp = new THREE.Vector3();
          node.getWorldPosition(wp);
          return `(${wp.x.toFixed(3)}, ${wp.y.toFixed(3)}, ${wp.z.toFixed(3)})`;
        })());
        console.log(`  local pos: (${node.position.x.toFixed(4)}, ${node.position.y.toFixed(4)}, ${node.position.z.toFixed(4)})`);
        console.log(`  children: ${node.children.length}`);
        node.children.forEach((c, i) => {
          console.log(`    [${i}] ${c.type} "${c.name}"`);
          if (c instanceof THREE.SkinnedMesh) {
            console.log(`      SkinnedMesh — ${c.geometry.attributes.position?.count} verts`);
            const joints = c.geometry.attributes["JOINTS_0"] || c.geometry.attributes["skinIndex"];
            const wts    = c.geometry.attributes["WEIGHTS_0"] || c.geometry.attributes["skinWeight"];
            if (joints && wts && c.skeleton) {
              const boneSet = new Set<string>();
              for (let i = 0; i < Math.min(20, joints.count); i++) {
                for (let j = 0; j < 4; j++) {
                  const bi = joints.getComponent(i, j);
                  const w  = wts.getComponent(i, j);
                  if (w > 0.05 && c.skeleton.bones[bi]) {
                    boneSet.add(`${c.skeleton.bones[bi].name}(${w.toFixed(2)})`);
                  }
                }
              }
              console.log(`      Bone influences: ${[...boneSet].join(", ")}`);
            }
          }
        });
      });
    });

    // 4. Check Object_7 through Object_18 (the unnamed SkinnedMeshes from metadata)
    console.log("\n--- Unnamed SkinnedMesh bone influences ---");
    for (let i = 7; i <= 18; i++) {
      const node = findAll(`Object_${i}`)[0];
      if (node instanceof THREE.SkinnedMesh) {
        const joints = node.geometry.attributes["JOINTS_0"] || node.geometry.attributes["skinIndex"];
        const wts    = node.geometry.attributes["WEIGHTS_0"] || node.geometry.attributes["skinWeight"];
        if (joints && wts && node.skeleton) {
          const boneSet = new Set<string>();
          for (let vi = 0; vi < Math.min(30, joints.count); vi++) {
            for (let j = 0; j < 4; j++) {
              const bi = joints.getComponent(vi, j);
              const w  = wts.getComponent(vi, j);
              if (w > 0.1 && node.skeleton.bones[bi]) {
                boneSet.add(node.skeleton.bones[bi].name);
              }
            }
          }
          console.log(`Object_${i}: bones → ${[...boneSet].join(", ")}`);
        }
      }
    }

    console.groupEnd();
  }, [scene]);

  return null;
}