"use client";

import type { Fragment, FragmentRarity, FragmentType } from "@/store/useUserStore";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const TYPE_COLOR: Record<FragmentType, string> = {
  Tech: "#38bdf8",
  Academic: "#a78bfa",
  Engine: "#fb923c",
};

const RARITY_WEIGHT: Record<FragmentRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
};

const RARITY_LABEL: Record<FragmentRarity, string> = {
  common: "普通",
  uncommon: "进阶",
  rare: "稀有",
  epic: "史诗",
};

const RARITY_BRIGHTNESS: Record<FragmentRarity, number> = {
  common: 0.65,
  uncommon: 0.9,
  rare: 1.22,
  epic: 1.5,
};

function ShardMesh({ color, rarity }: { color: string; rarity: FragmentRarity }) {
  const ref = useRef<THREE.Mesh>(null);
  const aura = RARITY_BRIGHTNESS[rarity];

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * (0.5 + aura * 0.5);
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.7) * 0.28;
  });

  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.72, 0]} />
      <meshPhysicalMaterial
        color={color}
        emissive={new THREE.Color(color).multiplyScalar(0.4 * aura)}
        emissiveIntensity={0.6 + aura * 0.5}
        roughness={0.08}
        metalness={0.24}
        transmission={0.7}
        thickness={0.6}
        clearcoat={1}
        clearcoatRoughness={0.05}
      />
    </mesh>
  );
}

function ShardCell({ fragment }: { fragment: Fragment | null }) {
  if (!fragment) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-cyan-100/10 bg-slate-950/55">
        <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(34,211,238,0.05),rgba(2,6,23,0.2))]" />
      </div>
    );
  }

  const color = TYPE_COLOR[fragment.type];
  const brightness = RARITY_BRIGHTNESS[fragment.rarity];

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-cyan-100/25 bg-slate-950/60"
      style={{ filter: `saturate(${1 + brightness * 0.25}) brightness(${0.85 + brightness * 0.15})` }}
      title={`${fragment.type} · ${RARITY_LABEL[fragment.rarity]}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent_46%)]" />
      <Canvas dpr={[1, 1.4]} gl={{ antialias: false, alpha: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[2.2, 2.3, 2.6]} intensity={2.1} color={color} />
        <pointLight position={[-2.4, -1.8, 2.1]} intensity={0.8} color="#ffffff" />
        <ShardMesh color={color} rarity={fragment.rarity} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] text-cyan-50/85">
        {RARITY_LABEL[fragment.rarity]}
      </div>
    </div>
  );
}

function byRarityThenTime(a: Fragment, b: Fragment) {
  const rarityGap = RARITY_WEIGHT[b.rarity] - RARITY_WEIGHT[a.rarity];
  if (rarityGap !== 0) return rarityGap;
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

export default function MetaPassport({
  fragments,
  computePower,
  totalComputeMined,
}: {
  fragments: Fragment[];
  computePower: number;
  totalComputeMined: number;
}) {
  const top9 = useMemo(() => [...fragments].sort(byRarityThenTime).slice(0, 9), [fragments]);
  const slots = useMemo(
    () => Array.from({ length: 9 }, (_, index) => top9[index] ?? null),
    [top9]
  );

  const rareTypeSet = useMemo(() => {
    const set = new Set<FragmentType>();
    for (const fragment of fragments) {
      if (fragment.rarity === "rare" || fragment.rarity === "epic") set.add(fragment.type);
    }
    return set;
  }, [fragments]);

  const starRingUnlocked = rareTypeSet.has("Tech") && rareTypeSet.has("Academic") && rareTypeSet.has("Engine");

  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-100/15 bg-[linear-gradient(165deg,rgba(8,47,73,0.28),rgba(2,6,23,0.82))] p-3">
      {starRingUnlocked ? (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/30"
          animate={{ rotate: [0, 360], opacity: [0.4, 0.7, 0.4], scale: [0.94, 1.04, 0.94] }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "linear" }}
        />
      ) : null}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] tracking-[0.16em] text-cyan-100/75">META PASSPORT</div>
        <div className="text-[10px] text-cyan-100/55">{fragments.length} Fragments</div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-cyan-100/10 bg-black/25 px-2.5 py-2">
          <div className="text-[10px] text-cyan-100/55">实时算力余额</div>
          <div className="mt-1 text-lg font-semibold text-cyan-50">{Math.max(0, Math.round(computePower))}</div>
        </div>
        <div className="rounded-xl border border-cyan-100/10 bg-black/25 px-2.5 py-2">
          <div className="text-[10px] text-cyan-100/55">历史总产量</div>
          <div className="mt-1 text-lg font-semibold text-cyan-50">{Math.max(0, Math.round(totalComputeMined))}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {slots.map((fragment, index) => (
          <div key={fragment?.id ?? `empty-${index}`} className="aspect-square">
            <ShardCell fragment={fragment} />
          </div>
        ))}
      </div>

      <div className="mt-3 text-[10px] text-cyan-100/55">
        {starRingUnlocked
          ? "全息星环已解锁：稀有三系碎片共鸣完成"
          : "收集 Tech / Academic / Engine 三系稀有碎片可解锁全息星环"}
      </div>
    </section>
  );
}
