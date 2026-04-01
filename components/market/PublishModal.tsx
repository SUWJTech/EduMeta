"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { MarketItemType } from "@/components/market/types";

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 8 },
} as const;

export default function PublishModal({
  open,
  onClose,
  onPublished,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  onPublished?: () => void | Promise<void>;
  onToast?: (message: string, variant?: "info" | "error") => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MarketItemType>("任务");
  const [price, setPrice] = useState<number>(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && price > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        onToast?.("请先登录后再发布", "error");
        return;
      }

      if (type === "任务") {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("compute_power")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          setMessage(profileError.message);
          return;
        }

        if ((profile?.compute_power ?? 0) < price) {
          onToast?.("算力余额不足，请先通过专注获取", "error");
          return;
        }
      }

      const { error } = await supabase.rpc("publish_market_item", {
        p_type: type,
        p_title: title.trim(),
        p_description: "",
        p_price: price,
      });

      if (error) {
        if (error.message.includes("INSUFFICIENT_BALANCE")) {
          onToast?.("算力余额不足，请先通过专注获取", "error");
          return;
        }
        setMessage(error.message);
        return;
      }

      setTitle("");
      setType("任务");
      setPrice(50);
      onClose();
      await onPublished?.();
      router.refresh();
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
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            aria-label="Close"
          />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <motion.section
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-5 pb-4 pt-5">
                <div>
                  <div className="text-sm font-semibold text-white">发布信号</div>
                  <div className="mt-1 text-xs text-white/50">写入当前维度的集市流</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-white/70 active:scale-95"
                >
                  关闭
                </button>
              </div>

              <div className="max-h-[70dvh] overflow-y-auto px-5 pb-4">
                <div className="grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-white/60">标题</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="例如：修电脑 / 求带饭 / 交换技能"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/20"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium text-white/60">类型</span>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as MarketItemType)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/20"
                      >
                        <option value="技能">技能交换</option>
                        <option value="硬件">硬件转让</option>
                        <option value="任务">求助</option>
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-medium text-white/60">悬赏算力</span>
                      <input
                        value={Number.isFinite(price) ? String(price) : ""}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setPrice(Number.isFinite(next) ? next : 0);
                        }}
                        inputMode="numeric"
                        type="number"
                        min={1}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/20"
                      />
                    </label>
                  </div>

                  {message ? (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs text-white/70">
                      {message}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="w-full rounded-2xl bg-meta-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(139,92,246,0.32)] transition-transform disabled:opacity-50 active:scale-95"
                >
                  {busy ? "发布中..." : "发布"}
                </button>
              </div>
            </motion.section>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
