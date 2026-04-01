"use client";

import { AnimatePresence, motion } from "framer-motion";
import html2canvas from "html2canvas";
import { useEffect, useMemo, useRef, useState } from "react";

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  show: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 12 },
} as const;

const DEFAULT_TEXT =
  "YOLO Architecture: Dynamic Interactive Detection\n\n[1] Redmon, J.; Farhadi, A. (2018). YOLOv3: An Incremental Improvement. arXiv:1804.02767.\n[2] He, K.; Zhang, X.; Ren, S.; Sun, J. (2016). Deep Residual Learning for Image Recognition. CVPR.";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toPaddedId() {
  const t = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}_${p2(t.getHours())}${p2(
    t.getMinutes()
  )}${p2(t.getSeconds())}`;
}

export default function FragmentGeneratorModal({
  open,
  focusHours,
  onClose,
  onToast,
  onSpendFocus,
}: {
  open: boolean;
  focusHours: number;
  onClose: () => void;
  onToast: (message: string, variant?: "info" | "error") => void;
  onSpendFocus: (amount: number) => Promise<boolean>;
}) {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
  }, [open]);

  const canMint = useMemo(() => {
    if (busy) return false;
    if (text.trim().length === 0) return false;
    return focusHours >= 1;
  }, [busy, focusHours, text]);

  const mintAndSave = async () => {
    if (busy) return;
    const el = captureRef.current;
    if (!el) return;

    if (focusHours < 1) {
      onToast("算力不足，请先通过专注获取", "error");
      return;
    }

    setBusy(true);
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#020617",
        scale: 3,
        useCORS: true,
      });

      const spent = await onSpendFocus(1);
      if (!spent) return;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        onToast("生成图片失败", "error");
        return;
      }

      downloadBlob(blob, `EduMeta_Fragment_${toPaddedId()}.png`);
      onToast("铸造完成，已保存到本地", "info");
      onClose();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "生成失败", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80"
            onClick={onClose}
            aria-label="Close"
          />

          <div className="absolute inset-0 mx-auto w-full max-w-md px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6">
            <motion.section
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">学术碎片铸造</div>
                  <div className="mt-1 text-xs text-white/55">将知识转化为可视资产</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-white/70 active:scale-95"
                >
                  关闭
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-4">
                <div className="grid gap-4">
                  <div className="grid place-items-center">
                    <div
                      ref={captureRef}
                      className="relative w-full max-w-[360px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-[0_0_26px_rgba(6,182,212,0.14)]"
                      style={{ aspectRatio: "9 / 16" }}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-60" />
                      <div className="absolute -left-10 top-24 -rotate-12 text-[84px] font-semibold tracking-tight text-white/7">
                        FRAGMENT
                      </div>
                      <div className="absolute -right-12 top-40 rotate-6 text-[70px] font-semibold tracking-tight text-white/6">
                        EDU
                      </div>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.22),transparent_55%)]" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(6,182,212,0.18),transparent_60%)]" />

                      <div className="relative flex h-full flex-col p-6">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold tracking-[0.18em] text-white/70">
                            EDUMETA • ACADEMIC SHARD
                          </div>
                          <div className="text-[11px] text-white/45">v0.1</div>
                        </div>

                        <div className="mt-5 flex-1">
                          <div className="max-w-[90%] whitespace-pre-wrap text-[13px] leading-5 text-white/85">
                            {text}
                          </div>
                        </div>

                        <div className="mt-5 flex items-end justify-between">
                          <div className="text-xs text-white/55">Grid Depth • Bauhaus Minimal</div>
                          <div className="text-xs font-semibold text-white/80">NODE ASSET</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-white/60">知识文本</span>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={6}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/20"
                    />
                    <div className="flex items-center justify-between text-[11px] text-white/45">
                      <div>实时预览</div>
                      <div>铸造消耗：1 算力 • 当前：{Math.round(focusHours * 10) / 10} 算力</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={() => void mintAndSave()}
                  disabled={!canMint}
                  className="w-full rounded-2xl bg-meta-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(139,92,246,0.32)] transition-transform disabled:opacity-50 active:scale-95"
                >
                  {busy ? "铸造中..." : "铸造并保存 (Mint & Save)"}
                </button>
              </div>
            </motion.section>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

