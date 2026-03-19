"use client";

import { motion } from "framer-motion";

const RINGS = [0, 0.65, 1.3];

export default function RadarScan({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className="relative h-64 w-64">
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-meta-primary/10 via-transparent to-meta-secondary/10 blur-2xl"
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {RINGS.map((delay, idx) => (
          <motion.div
            key={idx}
            className="absolute inset-0 rounded-full border border-meta-secondary/25"
            initial={{ scale: 0.25, opacity: 0.65 }}
            animate={{ scale: 1.15, opacity: 0 }}
            transition={{
              duration: 1.95,
              delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}

        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-meta-secondary shadow-[0_0_18px_rgba(6,182,212,0.55)]" />
        <div className="absolute inset-0 rounded-full border border-white/10" />
      </div>

      <div className="text-center text-sm text-white/70">
        <span className="bg-gradient-to-r from-meta-primary to-meta-secondary bg-clip-text text-transparent">
          {label}
        </span>
      </div>
    </div>
  );
}

