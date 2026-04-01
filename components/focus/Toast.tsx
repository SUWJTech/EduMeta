"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function Toast({
  message,
  variant = "info",
}: {
  message: string | null;
  variant?: "info" | "error";
}) {
  const glowClass =
    variant === "error"
      ? "shadow-[0_0_26px_rgba(239,68,68,0.22)] border-rose-500/30"
      : "shadow-[0_0_26px_rgba(6,182,212,0.12)]";

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={`fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center text-xs text-white/80 backdrop-blur ${glowClass}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
