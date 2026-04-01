"use client";

import MindSphere from "@/components/MindSphere";
import { useEffect, useMemo, useRef, useState } from "react";

type EnergyLifeCoreProps = {
  inputIntensity?: number;
  impactPulse?: number;
  orbitTexts?: string[];
  baseColor?: string;
  glowColor?: string;
  growth?: number;
  emotion?: string;
  arousal?: number;
  confidence?: number;
  fragmentCount?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function EnergyLifeCore({
  inputIntensity = 0,
  impactPulse = 0,
  orbitTexts = [],
  baseColor = "#0f172a",
  glowColor = "#38bdf8",
  growth = 0.12,
  emotion = "neutral",
  arousal = 0.45,
  confidence = 0.55,
  fragmentCount = 0,
}: EnergyLifeCoreProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const [useFallback, setUseFallback] = useState(false);

  const shellStyle = useMemo(
    () => ({
      boxShadow: `0 0 ${36 + growth * 80}px ${glowColor}55`,
      background: `radial-gradient(circle at 50% 40%, ${glowColor}44, ${baseColor}40 34%, rgba(0,0,0,0) 74%)`,
    }),
    [baseColor, glowColor, growth]
  );

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;

    const payload = {
      inputIntensity: clamp(inputIntensity, 0, 4),
      impactPulse: clamp(impactPulse, 0, 4),
      orbitTexts: orbitTexts.slice(0, 24),
      baseColor,
      glowColor,
      growth: clamp(growth, 0, 1),
      emotion,
      arousal: clamp(arousal, 0, 1),
      confidence: clamp(confidence, 0, 1),
      fragmentCount: Math.max(0, Math.round(fragmentCount)),
      timestamp: Date.now(),
    };

    frame.contentWindow.postMessage({ type: "edumeta:energy-update", payload }, window.location.origin);
  }, [arousal, baseColor, confidence, emotion, fragmentCount, glowColor, growth, impactPulse, inputIntensity, orbitTexts]);

  useEffect(() => {
    readyRef.current = false;
    setUseFallback(false);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.type === "edumeta:energy-ready") {
        readyRef.current = true;
        setUseFallback(false);
      }
      if (data?.type === "edumeta:energy-error") {
        readyRef.current = false;
        setUseFallback(true);
      }
    };

    const timer = window.setTimeout(() => {
      if (!readyRef.current) setUseFallback(true);
    }, 2200);

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative h-[20rem] w-full max-w-[24rem] overflow-hidden rounded-[2.2rem] border border-cyan-200/20 md:h-[24rem] md:max-w-[27rem]">
      <div className="pointer-events-none absolute inset-0 -z-10 blur-2xl" style={shellStyle} />
      {!useFallback ? (
        <iframe
          ref={iframeRef}
          src="/energy-core/index.html?embed=1"
          title="Energy Life Core"
          loading="eager"
          className="h-full w-full bg-transparent"
        />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_50%_42%,rgba(14,165,233,0.16),rgba(2,6,23,0.55)_42%,rgba(0,0,0,0.92)_92%)]">
          <div className="grid h-full w-full place-items-center">
            <MindSphere
              inputIntensity={inputIntensity}
              impactPulse={impactPulse}
              orbitTexts={orbitTexts}
              baseColor={baseColor}
              glowColor={glowColor}
              growth={growth}
            />
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-[2.2rem] border border-white/10" />
    </div>
  );
}
