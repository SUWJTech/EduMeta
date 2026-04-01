"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function BroadcastMarquee({
  message,
  senderLabel,
}: {
  message: string | null;
  senderLabel?: string | null;
}) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={`${senderLabel ?? ""}:${message}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden rounded-2xl border border-violet-300/35 bg-[linear-gradient(120deg,rgba(76,29,149,0.82),rgba(30,58,138,0.78))] py-2 shadow-[0_10px_34px_rgba(139,92,246,0.3)]"
        >
          <motion.div
            className="whitespace-nowrap px-4 text-xs font-semibold tracking-wide text-white"
            animate={{ x: ["100%", "-100%"] }}
            transition={{ duration: 10, ease: "linear" }}
          >
            【引力波广播】{senderLabel ? `${senderLabel}：` : ""}{message}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
