"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type GravityPingModalProps = {
  open: boolean;
  computePower: number;
  onClose: () => void;
  onLaunch: (message: string) => Promise<boolean>;
};

const RING_DELAYS = [0, 0.26, 0.52, 0.78];

export default function GravityPingModal({ open, computePower, onClose, onLaunch }: GravityPingModalProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setBusy(false);
  }, [open]);

  const canLaunch = useMemo(() => {
    if (busy) return false;
    if (message.trim().length < 3) return false;
    return computePower >= 5;
  }, [busy, computePower, message]);

  const fire = async () => {
    if (!canLaunch) return;
    setBusy(true);
    try {
      const ok = await onLaunch(message.trim());
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-slate-950/90"
            onClick={onClose}
          />

          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-[42%] h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/20" />
            {RING_DELAYS.map((delay, idx) => (
              <motion.div
                key={idx}
                className="absolute left-1/2 top-[42%] h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/25"
                initial={{ scale: 0.25, opacity: 0.55 }}
                animate={{ scale: 1.42, opacity: 0 }}
                transition={{ duration: 1.8, delay, repeat: Infinity, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="absolute left-1/2 top-[42%] h-[24rem] w-[1px] -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(34,211,238,0.85),transparent)]"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "center center" }}
            />
          </div>

          <div className="absolute inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mx-auto max-w-md">
            <motion.section
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="rounded-3xl border border-white/15 bg-[linear-gradient(165deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] p-5 backdrop-blur-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="text-sm font-semibold text-white">引力波广播</div>
              <div className="mt-1 text-xs text-white/60">你想向全校节点广播什么？</div>

              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="例如：图书馆三楼自习区有空位，欢迎组队冲刺算法题。"
                className="mt-4 w-full resize-none rounded-2xl border border-white/15 bg-slate-950/35 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-violet-300/35"
              />

              <div className="mt-3 text-xs text-white/65">发射消耗：5 算力 • 当前：{computePower} 算力</div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white/85 active:scale-95"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void fire()}
                  disabled={!canLaunch}
                  className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(139,92,246,0.3)] transition-transform disabled:opacity-50 active:scale-95"
                >
                  {busy ? "发射中..." : "发射"}
                </button>
              </div>
            </motion.section>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
