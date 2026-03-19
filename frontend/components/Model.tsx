"use client";

import { useGLTF } from "@react-three/drei";
import { GroupProps } from "@react-three/fiber";

useGLTF.preload("/indian_gangster.glb");

export default function Model(props: GroupProps) {
  const { scene } = useGLTF("/indian_gangster.glb");
  return <primitive object={scene} {...props} />;
}