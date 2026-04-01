"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function SettlementOverlay({
  open,
  focusText,
  coinText,
}: {
  open: boolean;
  focusText: string;
  coinText: string;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />

          <motion.div
            className="relative mx-6 w-[min(440px,calc(100%-3rem))] overflow-hidden rounded-3xl border border-white/12 bg-white/6 p-6 text-center backdrop-blur-xl"
            initial={{ y: 18, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(139,92,246,0.35),transparent_55%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(6,182,212,0.28),transparent_60%)]" />

            <motion.div
              className="relative"
              animate={{ filter: ["drop-shadow(0 0 10px rgba(139,92,246,0.35))", "drop-shadow(0 0 22px rgba(6,182,212,0.45))", "drop-shadow(0 0 10px rgba(139,92,246,0.35))"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="text-sm font-semibold text-white/90">算力凝聚完成！</div>
              <div className="mt-2 text-xl font-semibold text-white">
                <span className="bg-gradient-to-r from-meta-primary to-meta-secondary bg-clip-text text-transparent">
                  {focusText}
                </span>
                <span className="mx-2 text-white/35">•</span>
                <span className="bg-gradient-to-r from-meta-secondary to-meta-primary bg-clip-text text-transparent">
                  {coinText}
                </span>
              </div>
              <div className="mt-3 text-xs text-white/55">数据已写回你的节点资产</div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
