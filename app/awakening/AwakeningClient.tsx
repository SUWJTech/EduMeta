"use client";

import MindSphere from "@/components/MindSphere";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const BOOT_LINES = [
  "> 正在建立与物理世界的量子连接...",
  "> 分配校园网络节点 ID...",
  "> 正在同步你的初始算力基线...",
  "> 警告：检测到未知的数字潜意识，正在生成星核...",
];

type Stage = "cursor" | "typing" | "flash" | "core";

type OnboardingRow = {
  has_onboarded: boolean | null;
};

function randomTypingDelay() {
  return 24 + Math.floor(Math.random() * 36);
}

export default function AwakeningClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [stage, setStage] = useState<Stage>("cursor");
  const [lockedLines, setLockedLines] = useState<string[]>([]);
  const [activeLine, setActiveLine] = useState("");
  const audioRef = useRef<AudioContext | null>(null);

  const renderedLines = activeLine ? [...lockedLines, activeLine] : lockedLines;

  const playKeySound = () => {
    const AudioCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtor) return;

    if (!audioRef.current) {
      try {
        audioRef.current = new AudioCtor();
      } catch {
        return;
      }
    }

    const ctx = audioRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }

    const now = ctx.currentTime;
    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    const high = ctx.createOscillator();
    const highGain = ctx.createGain();

    low.type = "square";
    low.frequency.setValueAtTime(150 + Math.random() * 42, now);
    lowGain.gain.setValueAtTime(0.0001, now);
    lowGain.gain.exponentialRampToValueAtTime(0.042, now + 0.003);
    lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    high.type = "triangle";
    high.frequency.setValueAtTime(820 + Math.random() * 220, now);
    highGain.gain.setValueAtTime(0.0001, now);
    highGain.gain.exponentialRampToValueAtTime(0.015, now + 0.002);
    highGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    low.connect(lowGain);
    high.connect(highGain);
    lowGain.connect(ctx.destination);
    highGain.connect(ctx.destination);

    low.start(now);
    high.start(now);
    low.stop(now + 0.05);
    high.stop(now + 0.03);
  };

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => resolve(), ms);
        timers.push(id);
      });

    const runSequence = async () => {
      router.prefetch("/");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        router.replace("/login?redirectTo=%2Fawakening");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("has_onboarded")
        .eq("id", user.id)
        .maybeSingle<OnboardingRow>();
      if (cancelled) return;

      if (profile?.has_onboarded) {
        router.replace("/");
        return;
      }

      await wait(900);
      if (cancelled) return;

      setStage("typing");

      for (const line of BOOT_LINES) {
        let snapshot = "";
        for (const char of line) {
          snapshot += char;
          setActiveLine(snapshot);
          if (char.trim().length > 0) playKeySound();
          await wait(randomTypingDelay());
          if (cancelled) return;
        }

        setLockedLines((prev) => [...prev, snapshot]);
        setActiveLine("");
        await wait(340);
        if (cancelled) return;
      }

      await wait(240);
      if (cancelled) return;

      setStage("flash");
      await wait(560);
      if (cancelled) return;

      setStage("core");

      await supabase.from("profiles").upsert(
        {
          id: user.id,
          has_onboarded: true,
        },
        { onConflict: "id" }
      );

      await wait(1200);
      if (cancelled) return;

      router.replace("/");
    };

    void runSequence();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      const ctx = audioRef.current;
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => undefined);
      }
      audioRef.current = null;
    };
  }, [router, supabase]);

  return (
    <main className="fixed inset-0 z-[120] overflow-hidden bg-black">
      {stage !== "cursor" ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.08),transparent_48%)]" />
      ) : null}

      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {stage === "cursor" ? (
            <motion.div
              key="boot-cursor"
              className="h-6 w-3 rounded-[2px] bg-cyan-100"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : stage === "typing" ? (
            <motion.section
              key="terminal-text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl space-y-2 text-sm leading-relaxed text-cyan-100/90 md:text-base"
            >
              {renderedLines.map((line, idx) => (
                <p key={`${idx}-${line}`} className="whitespace-pre-wrap font-mono">
                  {line}
                </p>
              ))}
              <motion.span
                className="inline-block h-5 w-2 rounded-[1px] bg-cyan-100 align-[-2px]"
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.68, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {stage === "flash" ? (
          <motion.div
            key="flash"
            className="pointer-events-none absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="absolute inset-0 bg-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.96, 0] }}
              transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0, 1, 0], scale: [0.2, 10, 24] }}
              transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "core" ? (
          <motion.div
            key="core"
            className="absolute inset-0 z-30 grid place-items-center"
            initial={{ opacity: 0, scale: 0.7, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            <MindSphere inputIntensity={0.82} impactPulse={1.2} orbitTexts={["STAR CORE", "AWAKENING", "EDUMETA"]} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
