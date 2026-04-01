"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import type { MarketItemRow } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function glowStyle(ageMinutes: number) {
  const t = clamp(1 - ageMinutes / 120, 0.15, 1);
  const borderAlpha = 0.08 + 0.22 * t;
  const glowAlpha = 0.06 + 0.28 * t;
  const glow = 10 + 22 * t;
  return {
    borderColor: `rgba(6, 182, 212, ${borderAlpha})`,
    boxShadow: `0 0 ${glow}px rgba(6, 182, 212, ${glowAlpha})`,
  } as const;
}

function timeAgoLabel(iso: string) {
  const created = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - created);
  const mins = Math.floor(diffMs / 60000);
  if (mins <= 1) return "刚刚";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function typeLabel(type: MarketItemRow["type"]) {
  if (type === "技能") return "技能交换";
  if (type === "硬件") return "硬件转让";
  return "求助任务";
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
} as const;

export default function MarketCard({
  item,
  accepting,
  onAccept,
  highlighted,
}: {
  item: MarketItemRow;
  accepting?: boolean;
  onAccept?: (item: MarketItemRow, el: HTMLElement) => void;
  highlighted?: boolean;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const label = typeLabel(item.type);
  const ago = timeAgoLabel(item.created_at);
  const ageMinutes = (() => {
    const created = new Date(item.created_at).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - created) / 60000));
  })();

  const claimed = item.status === "claimed";

  return (
    <motion.article
      variants={itemVariants}
      className="relative overflow-hidden rounded-2xl border bg-white/5 p-4 backdrop-blur-lg"
      style={
        highlighted
          ? {
              ...glowStyle(ageMinutes),
              borderColor: "rgba(34, 211, 238, 0.95)",
              boxShadow: "0 0 26px rgba(34, 211, 238, 0.9)",
            }
          : glowStyle(ageMinutes)
      }
      ref={(el) => {
        rootRef.current = el;
      }}
      data-market-id={item.id}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
      <div className="relative">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[11px] font-medium text-white/75">
          {label}
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
              {item.price}
            </span>
            <span className="text-white/45"> 算力</span>
          </div>
          <div className="text-white/55">{ago}</div>
        </div>

        <div className="mt-4 grid">
          <button
            type="button"
            disabled={claimed || accepting}
            onClick={() => {
              const el = rootRef.current;
              if (!el || !onAccept) return;
              onAccept(item, el);
            }}
            className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-white/80 shadow-[0_0_20px_rgba(6,182,212,0.16)] transition-transform disabled:opacity-60 active:scale-[0.99]"
          >
            {claimed ? "已认领" : accepting ? "共振中..." : "共振 (Accept)"}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
