"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent.toLowerCase();
  const isIPhoneIPadIPod = /iphone|ipad|ipod/.test(ua);
  const isIPadOS = ua.includes("mac") && "ontouchend" in document;
  return isIPhoneIPadIPod || isIPadOS;
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

export default function PWAInstallPrompt() {
  if (process.env.NODE_ENV !== "production") return null;
  return <PWAInstallPromptInner />;
}

function PWAInstallPromptInner() {
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  const eligible = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (isIOS() || isAndroid()) && !isStandalone();
  }, []);

  useEffect(() => {
    if (!eligible) return;

    const key = "edumeta_pwa_prompt_dismissed";
    if (localStorage.getItem(key) === "1") return;

    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [eligible]);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    localStorage.setItem("edumeta_pwa_prompt_dismissed", "1");
    setOpen(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && eligible ? (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-[5.25rem] left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="text-sm font-semibold text-white">添加到主屏幕</div>
          <div className="mt-1 text-xs text-white/60">
            点击“分享”并“添加到主屏幕”，开启你的 EduMeta 节点
          </div>

          <div className="mt-3 flex items-center gap-2">
            {deferred ? (
              <button
                type="button"
                onClick={install}
                className="flex-1 rounded-2xl bg-meta-primary px-3 py-2 text-xs font-semibold text-white transition-transform active:scale-95"
              >
                一键安装
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-xs font-semibold text-white/85 transition-transform active:scale-95"
            >
              知道了
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
