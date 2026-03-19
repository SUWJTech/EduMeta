"use client";

import { motion } from "framer-motion";
import type { MarketItem } from "./mock";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function glowStyle(distanceM: number) {
  const t = clamp(1 - distanceM / 320, 0.15, 1);
  const borderAlpha = 0.08 + 0.22 * t;
  const glowAlpha = 0.06 + 0.28 * t;
  const glow = 10 + 22 * t;
  return {
    borderColor: `rgba(6, 182, 212, ${borderAlpha})`,
    boxShadow: `0 0 ${glow}px rgba(6, 182, 212, ${glowAlpha})`,
  } as const;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
} as const;

export default function MarketCard({ item }: { item: MarketItem }) {
  return (
    <motion.article
      variants={itemVariants}
      className="relative overflow-hidden rounded-2xl border bg-white/5 p-4 backdrop-blur-lg"
      style={glowStyle(item.distanceM)}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
      <div className="relative">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[11px] font-medium text-white/75">
          {item.tag}
        </div>

        <h3
          className="mt-3 text-sm font-semibold leading-snug text-white/90"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {item.title}
        </h3>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs">
          <div className="text-white/70">
            <span className="text-white/45">悬赏 </span>
            <span className="bg-gradient-to-r from-meta-primary to-meta-secondary bg-clip-text font-semibold text-transparent">
              {item.reward}
            </span>
            <span className="text-white/45"> 通证</span>
          </div>
          <div className="text-white/55">距你 {item.distanceM}m</div>
        </div>
      </div>
    </motion.article>
  );
}

