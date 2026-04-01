"use client";

import type { FragmentRarity, FragmentType } from "@/store/useUserStore";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const TYPE_COLOR: Record<FragmentType, string> = {
  Tech: "#38bdf8",
  Academic: "#a78bfa",
  Engine: "#fb923c",
};

const RARITY_GLOW: Record<FragmentRarity, number> = {
  common: 0.6,
  uncommon: 0.9,
  rare: 1.3,
  epic: 1.8,
};

function Crystal({
  type,
  rarity,
}: {
  type: FragmentType;
  rarity: FragmentRarity;
}) {
  const shardRef = useRef<THREE.Mesh>(null);
  const chunksRef = useRef<Array<THREE.Mesh | null>>([]);
  const color = TYPE_COLOR[type];
  const glow = RARITY_GLOW[rarity];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (shardRef.current) {
      shardRef.current.rotation.y = t * (0.9 + glow * 0.3);
      shardRef.current.position.y = Math.max(0.1, Math.min(1.25, t * 0.8));
      shardRef.current.scale.setScalar(Math.min(1, 0.2 + t * 1.6));
    }

    chunksRef.current.forEach((chunk, index) => {
      if (!chunk) return;
      const phase = t * (1.4 + index * 0.06);
      const direction = index % 2 === 0 ? 1 : -1;
      chunk.position.x = Math.sin(phase + index) * (0.4 + index * 0.01) * direction;
      chunk.position.z = Math.cos(phase + index) * (0.26 + index * 0.015);
      chunk.position.y = 0.05 + Math.min(0.75, t * 0.45) + Math.sin(phase * 2) * 0.08;
      chunk.rotation.x = phase * 0.8;
      chunk.rotation.y = phase * 1.05;
    });
  });

  return (
    <group>
      <mesh ref={shardRef} position={[0, 0.1, 0]} scale={0.2}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshPhysicalMaterial
          color={color}
          emissive={new THREE.Color(color).multiplyScalar(0.35 * glow)}
          emissiveIntensity={0.8 + glow}
          roughness={0.08}
          metalness={0.25}
          transmission={0.72}
          thickness={0.55}
          clearcoat={1}
          clearcoatRoughness={0.04}
        />
      </mesh>
      {Array.from({ length: 14 }).map((_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            chunksRef.current[index] = node;
          }}
          position={[0, 0.05, 0]}
          scale={0.13 + (index % 3) * 0.03}
        >
          <tetrahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4 + glow * 0.6}
            metalness={0.1}
            roughness={0.28}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.56, 1.2, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function LootDropReveal({
  type,
  rarity,
}: {
  type: FragmentType;
  rarity: FragmentRarity;
}) {
  const color = TYPE_COLOR[type];
  const rarityLabel = useMemo(() => {
    if (rarity === "epic") return "史诗";
    if (rarity === "rare") return "稀有";
    if (rarity === "uncommon") return "进阶";
    return "普通";
  }, [rarity]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-cyan-100/20 bg-black/45"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.15),rgba(2,6,23,0.4)_48%,rgba(0,0,0,0.88)_100%)]" />
      <div className="h-48 w-full">
        <Canvas dpr={[1, 1.4]} gl={{ antialias: false, alpha: true }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[2.4, 2.5, 2.5]} intensity={2.4} color={color} />
          <pointLight position={[-2.1, 1.2, 2.8]} intensity={1.1} color="#ffffff" />
          <Crystal type={type} rarity={rarity} />
        </Canvas>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-cyan-100/35 bg-black/50 px-3 py-1 text-[10px] tracking-[0.16em] text-cyan-100">
        {type} · {rarityLabel}
      </div>
    </motion.div>
  );
}
