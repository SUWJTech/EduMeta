"use client";

import { useEffect, useRef, useState } from "react";
import CountdownRing from "@/components/focus/CountdownRing";
import ConnectionView from "@/components/focus/ConnectionView";
import RadarScan from "@/components/focus/RadarScan";

type FocusState = "idle" | "searching" | "connected";

export default function FocusPage() {
  const [state, setState] = useState<FocusState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state !== "searching") return;

    timerRef.current = setTimeout(() => {
      setState("connected");
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [state]);

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setState("idle");
  };

  return (
    <main className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <div className="flex-1" />

      {state === "idle" ? (
        <section className="grid justify-items-center gap-8">
          <CountdownRing timeText="25:00" />
          <button
            type="button"
            onClick={() => setState("searching")}
            className="w-full rounded-2xl bg-meta-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(139,92,246,0.32)] transition-transform active:scale-95"
          >
            寻找共鸣 (Find Partner)
          </button>
        </section>
      ) : null}

      {state === "searching" ? (
        <section className="grid justify-items-center">
          <RadarScan label="正在连接同维度的节点..." />
        </section>
      ) : null}

      {state === "connected" ? (
        <section className="w-full">
          <ConnectionView onDisconnect={reset} />
        </section>
      ) : null}

      <div className="flex-1" />
    </main>
  );
}
