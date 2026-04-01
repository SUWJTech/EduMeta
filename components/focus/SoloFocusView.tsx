"use client";

import { motion } from "framer-motion";

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export default function SoloFocusView({
  timeText,
  progress,
  onStop,
}: {
  timeText: string;
  progress: number;
  onStop: () => void | Promise<void>;
}) {
  const p = clamp01(progress);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-white/60">单节点算力挖掘</div>
          <div className="h-2 w-2 rounded-full bg-meta-secondary shadow-[0_0_14px_rgba(6,182,212,0.55)]" />
        </div>

        <div className="mt-3 grid gap-3">
          <div className="text-sm text-white/85">{timeText} Session</div>

          <div className="relative h-20 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-meta-primary/40 via-meta-secondary/25 to-transparent"
              animate={{ height: `${Math.round(p * 100)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(139,92,246,0.18),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(6,182,212,0.16),transparent_55%)]" />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => void onStop()}
        className="w-full rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-sm transition-transform active:scale-95"
      >
        停止专注
      </button>
    </div>
  );
}

