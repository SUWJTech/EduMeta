"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export type MintedActivityLog = {
  id: string;
  task_summary: string;
  duration_minutes: number;
  block_hash: string;
  created_at: string;
};

type MintRecordModalProps = {
  open: boolean;
  focusHours: number;
  onClose: () => void;
  onMintRecord: (taskSummary: string, durationMinutes: number) => Promise<MintedActivityLog | null>;
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 14 },
  show: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 14 },
} as const;

function shortHash(hash: string) {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export default function MintRecordModal({ open, focusHours, onClose, onMintRecord }: MintRecordModalProps) {
  const [taskSummary, setTaskSummary] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState<MintedActivityLog | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setMinted(null);
    setTaskSummary("");
    setDurationMinutes(25);
  }, [open]);

  const canMint = useMemo(() => {
    if (busy) return false;
    if (taskSummary.trim().length < 4) return false;
    if (durationMinutes <= 0) return false;
    return focusHours >= 1;
  }, [busy, durationMinutes, focusHours, taskSummary]);

  const onSubmit = async () => {
    if (!canMint) return;
    setBusy(true);
    try {
      const row = await onMintRecord(taskSummary.trim(), durationMinutes);
      if (row) setMinted(row);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Close"
            onClick={onClose}
          />

          <div className="absolute inset-0 mx-auto w-full max-w-md px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6">
            <motion.section
              role="dialog"
              aria-modal="true"
              className="flex h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(165deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] backdrop-blur-2xl"
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                <div>
                  <div className="text-sm font-semibold text-white">算力封存</div>
                  <div className="mt-1 text-xs text-white/60">Mint Record • 把一次完成写入链式记忆</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/15 bg-slate-950/40 px-3 py-2 text-xs text-white/75 active:scale-95"
                >
                  关闭
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-4">
                {minted ? (
                  <div className="grid gap-4">
                    <div className="relative overflow-hidden rounded-3xl border border-cyan-300/30 bg-slate-950/85 p-5 shadow-[0_18px_44px_rgba(34,211,238,0.18)]">
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:20px_20px] opacity-45" />
                      <div className="relative">
                        <div className="text-[11px] font-semibold tracking-[0.2em] text-cyan-300/90">
                          EDU META • BLOCK RECORD
                        </div>
                        <div className="mt-4 text-xs text-white/65">哈希指纹</div>
                        <div className="mt-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-cyan-200/90">
                          {shortHash(minted.block_hash)}
                        </div>

                        <div className="mt-4 grid gap-2 text-xs text-white/75">
                          <div>时间戳：{new Date(minted.created_at).toLocaleString("zh-CN")}</div>
                          <div>时长：{minted.duration_minutes} 分钟</div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            任务摘要：{minted.task_summary}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center text-xs text-white/60">封存已完成，1 算力已扣除。</div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium text-white/70">刚才完成了什么？</span>
                      <textarea
                        rows={7}
                        value={taskSummary}
                        onChange={(e) => setTaskSummary(e.target.value)}
                        placeholder="例如：完成《操作系统》第二章笔记整理，并复盘 3 道并发题。"
                        className="w-full resize-none rounded-2xl border border-white/15 bg-slate-950/35 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-300/35"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-medium text-white/70">本次专注时长（分钟）</span>
                      <input
                        type="number"
                        min={1}
                        max={360}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value) || 1)}
                        className="w-full rounded-2xl border border-white/15 bg-slate-950/35 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/35"
                      />
                    </label>

                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/65">
                      铸造消耗：1 算力 • 当前：{Math.round(focusHours * 10) / 10} 算力
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 pb-5">
                {minted ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_34px_rgba(34,211,238,0.28)] active:scale-95"
                  >
                    完成
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onSubmit()}
                    disabled={!canMint}
                    className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_34px_rgba(34,211,238,0.28)] transition-transform disabled:opacity-50 active:scale-95"
                  >
                    {busy ? "铸造中..." : "铸造"}
                  </button>
                )}
              </div>
            </motion.section>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
