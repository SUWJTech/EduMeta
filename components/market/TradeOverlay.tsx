"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

function makeDigitColumn(rows: number) {
  return Array.from({ length: rows }, () => String(Math.floor(Math.random() * 10))).join("\n");
}

export default function TradeOverlay({
  open,
  from,
  to,
  onDone,
}: {
  open: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
  onDone: () => void;
}) {
  const digits = useMemo(() => (open ? makeDigitColumn(22) : ""), [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />

          <motion.div
            className="pointer-events-none absolute left-0 top-0"
            initial={{ x: from.x, y: from.y, opacity: 0, scale: 0.9 }}
            animate={{ x: to.x, y: to.y, opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            onAnimationComplete={onDone}
            style={{ filter: "drop-shadow(0 0 18px rgba(6,182,212,0.55))" }}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              <div className="absolute left-1/2 top-1/2 h-28 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-cyan-400/50 via-cyan-400/10 to-transparent blur-xl" />
              <div className="relative grid place-items-center rounded-2xl border border-cyan-300/30 bg-slate-950/35 px-3 py-2 backdrop-blur">
                <pre className="select-none font-mono text-[10px] leading-[10px] text-cyan-100/85">
                  {digits}
                </pre>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
