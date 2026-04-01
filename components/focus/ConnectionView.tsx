"use client";

import { motion } from "framer-motion";
import { Leaf } from "lucide-react";

function Avatar({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-meta-primary/60 to-meta-secondary/40 p-[2px] shadow-[0_0_18px_rgba(6,182,212,0.22)]">
        <div className="h-full w-full rounded-full bg-slate-900/80" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{label}</div>
        <div className="mt-0.5 text-xs text-white/55">Synchronized Focus</div>
      </div>
    </div>
  );
}

function StatusCard({ title, timeText }: { title: string; timeText: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-white/60">{title}</div>
        <div className="h-2 w-2 rounded-full bg-meta-secondary shadow-[0_0_14px_rgba(6,182,212,0.55)]" />
      </div>
      <div className="mt-3 grid gap-2">
        <div className="text-sm text-white/85">{timeText}</div>
        <div className="text-xs text-white/50">Ambient: Quiet • Mode: Deep</div>
      </div>
    </section>
  );
}

export default function ConnectionView({
  onDisconnect,
  partnerLabel,
  timeText,
}: {
  onDisconnect: () => void;
  partnerLabel: string;
  timeText: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg">
        <Avatar label="You" />
        <div className="mt-3">
          <StatusCard title="Your Focus" timeText={timeText} />
        </div>
      </div>

      <div className="relative flex items-center justify-center py-2">
        <motion.div
          className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-meta-primary/70 to-transparent shadow-[0_0_22px_rgba(139,92,246,0.35)]"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="relative grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-slate-950/70 backdrop-blur"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Leaf
            className="h-6 w-6 text-meta-secondary drop-shadow-[0_0_14px_rgba(6,182,212,0.55)]"
            aria-hidden="true"
          />
        </motion.div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg">
        <Avatar label={partnerLabel} />
        <div className="mt-3">
          <StatusCard title="Partner Focus" timeText={timeText} />
        </div>
      </div>

      <button
        type="button"
        onClick={onDisconnect}
        className="mt-1 w-full rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-sm transition-transform active:scale-95"
      >
        断开连接 (Disconnect)
      </button>
    </div>
  );
}
