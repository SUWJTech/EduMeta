"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type EnergyCoreProps = {
  computePower: number;
  focusHours: number;
  academic?: number | null;
  tech?: number | null;
  social?: number | null;
  isFocusing?: boolean;
};

type RGB = { r: number; g: number; b: number };

const DIMENSION_COLORS: Record<"academic" | "tech" | "social", RGB> = {
  academic: { r: 168, g: 85, b: 247 },
  tech: { r: 56, g: 189, b: 248 },
  social: { r: 251, g: 146, b: 60 },
};

const COMPANION_MESSAGES = [
  "节点能量充沛，适合开启深度计算。",
  "星核响应稳定，建议执行高强度推演。",
  "共振频率上扬，灵感回路已开启。",
  "卫星轨迹清晰，适合推进下一里程碑。",
  "数据流平稳，当前是高效专注窗口。",
];

const PULSE_RING_DELAYS = [0, 0.12, 0.24, 0.36, 0.48, 0.6];

const AMBIENT_PARTICLES = [
  { x: "22%", y: "30%", size: 2, opacity: 0.26, delay: 0.1 },
  { x: "74%", y: "28%", size: 2, opacity: 0.32, delay: 0.28 },
  { x: "64%", y: "72%", size: 1, opacity: 0.25, delay: 0.45 },
  { x: "30%", y: "68%", size: 2, opacity: 0.28, delay: 0.62 },
  { x: "50%", y: "18%", size: 1, opacity: 0.22, delay: 0.82 },
];

function clamp(v: number | null | undefined) {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, v);
}

function toRgba(color: RGB, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

export default function EnergyCore({
  computePower,
  focusHours,
  academic = 0,
  tech = 0,
  social = 0,
  isFocusing = false,
}: EnergyCoreProps) {
  const prevPowerRef = useRef(computePower);
  const messageTimerRef = useRef<number | null>(null);
  const [burst, setBurst] = useState(false);
  const [waves, setWaves] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevPowerRef.current;
    if (computePower > prev) {
      setBurst(true);
      const id = window.setTimeout(() => setBurst(false), 900);
      prevPowerRef.current = computePower;
      return () => window.clearTimeout(id);
    }
    prevPowerRef.current = computePower;
  }, [computePower]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const weights = useMemo(() => {
    const safeAcademic = clamp(academic);
    const safeTech = clamp(tech);
    const safeSocial = clamp(social);
    const total = safeAcademic + safeTech + safeSocial;

    if (total <= 0) {
      return { academic: 1 / 3, tech: 1 / 3, social: 1 / 3 };
    }

    return {
      academic: safeAcademic / total,
      tech: safeTech / total,
      social: safeSocial / total,
    };
  }, [academic, social, tech]);

  const intensity = useMemo(() => {
    const base = Math.min(1, Math.max(0, computePower / 1200));
    const focusBonus = isFocusing ? 0.2 : 0;
    const burstBonus = burst ? 0.28 : 0;
    return Math.min(1, base + focusBonus + burstBonus);
  }, [burst, computePower, isFocusing]);

  const colorSystem = useMemo(() => {
    const aStop = Math.round(weights.academic * 100);
    const tStop = Math.round((weights.academic + weights.tech) * 100);
    const softA = Math.max(0, aStop - 10);
    const softT = Math.max(0, tStop - 10);

    const blended = {
      r: Math.round(
        DIMENSION_COLORS.academic.r * weights.academic +
          DIMENSION_COLORS.tech.r * weights.tech +
          DIMENSION_COLORS.social.r * weights.social
      ),
      g: Math.round(
        DIMENSION_COLORS.academic.g * weights.academic +
          DIMENSION_COLORS.tech.g * weights.tech +
          DIMENSION_COLORS.social.g * weights.social
      ),
      b: Math.round(
        DIMENSION_COLORS.academic.b * weights.academic +
          DIMENSION_COLORS.tech.b * weights.tech +
          DIMENSION_COLORS.social.b * weights.social
      ),
    };

    const coreGradient = `conic-gradient(
      from 220deg at 50% 50%,
      ${toRgba(DIMENSION_COLORS.academic, 0.9)} 0%,
      ${toRgba(DIMENSION_COLORS.academic, 0.9)} ${aStop}%,
      ${toRgba(DIMENSION_COLORS.tech, 0.88)} ${softA}%,
      ${toRgba(DIMENSION_COLORS.tech, 0.88)} ${tStop}%,
      ${toRgba(DIMENSION_COLORS.social, 0.9)} ${softT}%,
      ${toRgba(DIMENSION_COLORS.social, 0.9)} 100%
    )`;

    const shellGradient = `radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.06) 32%, transparent 58%), ${coreGradient}`;

    const haloGradient = `radial-gradient(circle, rgba(${blended.r}, ${blended.g}, ${blended.b}, 0.48) 0%, rgba(${blended.r}, ${blended.g}, ${blended.b}, 0.16) 40%, rgba(${blended.r}, ${blended.g}, ${blended.b}, 0) 74%)`;

    return { blended, coreGradient, shellGradient, haloGradient };
  }, [weights]);

  const satellites = useMemo(() => {
    const count = Math.min(12, Math.floor(Math.max(0, focusHours) / 10));
    return Array.from({ length: count }, (_, idx) => ({
      id: idx,
      phase: (360 / Math.max(1, count)) * idx,
      radius: 96 + (idx % 3) * 10,
      duration: 8 + (idx % 4) * 1.8,
      color:
        idx % 3 === 0
          ? toRgba(DIMENSION_COLORS.academic, 0.9)
          : idx % 3 === 1
            ? toRgba(DIMENSION_COLORS.tech, 0.9)
            : toRgba(DIMENSION_COLORS.social, 0.9),
    }));
  }, [focusHours]);

  const onCoreClick = () => {
    const id = Date.now() + Math.random();
    setWaves((prev) => [...prev, id]);

    const randomIndex = Math.floor(Math.random() * COMPANION_MESSAGES.length);
    setMessage(COMPANION_MESSAGES[randomIndex]);

    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => setMessage(null), 1900);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 py-2">
      <motion.button
        type="button"
        onClick={onCoreClick}
        className="relative h-72 w-72 rounded-full border-0 bg-transparent p-0"
        animate={{ scale: [1, 1.03 + intensity * 0.015, 1], rotate: [0, 4, 0] }}
        transition={{ duration: isFocusing ? 2.1 : 4.6, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.97 }}
        aria-label="Aura Core"
      >
        <motion.div
          className="absolute inset-2 rounded-full blur-3xl"
          style={{ backgroundImage: colorSystem.haloGradient }}
          animate={{
            opacity: [0.42 + intensity * 0.1, 0.68 + intensity * 0.14, 0.42 + intensity * 0.1],
          }}
          transition={{ duration: isFocusing ? 1.8 : 3.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {isFocusing
          ? PULSE_RING_DELAYS.map((delay, idx) => (
              <motion.span
                key={idx}
                className="absolute inset-5 rounded-full border pointer-events-none"
                style={{ borderColor: toRgba(colorSystem.blended, 0.45) }}
                animate={{ scale: [0.72, 1.34], opacity: [0.52, 0] }}
                transition={{ duration: 1.05, delay, repeat: Infinity, ease: "linear" }}
              />
            ))
          : null}

        {satellites.map((satellite) => (
          <motion.div
            key={satellite.id}
            className="absolute inset-0"
            initial={{ rotate: satellite.phase }}
            animate={{ rotate: satellite.phase + 360 }}
            transition={{ duration: satellite.duration, repeat: Infinity, ease: "linear" }}
          >
            <motion.span
              className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
              style={{
                y: -satellite.radius,
                background: satellite.color,
                boxShadow: `0 0 14px ${satellite.color}`,
              }}
              animate={{ scale: [0.72, 1.12, 0.72], opacity: [0.68, 1, 0.68] }}
              transition={{ duration: 2.1 + (satellite.id % 3) * 0.35, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        ))}

        <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundImage: colorSystem.shellGradient }}
            animate={{
              rotate: [0, 360],
              boxShadow: [
                `0 0 30px rgba(${colorSystem.blended.r}, ${colorSystem.blended.g}, ${colorSystem.blended.b}, 0.22)`,
                `0 0 52px rgba(${colorSystem.blended.r}, ${colorSystem.blended.g}, ${colorSystem.blended.b}, 0.36)`,
                `0 0 30px rgba(${colorSystem.blended.r}, ${colorSystem.blended.g}, ${colorSystem.blended.b}, 0.22)`,
              ],
            }}
            transition={{
              rotate: { duration: 24, repeat: Infinity, ease: "linear" },
              boxShadow: { duration: isFocusing ? 1.5 : 3.2, repeat: Infinity, ease: "easeInOut" },
            }}
          />

          <motion.div
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: toRgba(colorSystem.blended, 0.42) }}
            animate={{ opacity: [0.45, 0.9, 0.45] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-[10%] rounded-full bg-gradient-to-b from-white/14 via-transparent to-white/10" />

          {burst ? (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.28) 0%, rgba(${colorSystem.blended.r}, ${colorSystem.blended.g}, ${colorSystem.blended.b}, 0.16) 35%, transparent 74%)`,
              }}
              initial={{ opacity: 0.1, scale: 0.94 }}
              animate={{ opacity: [0.15, 0.6, 0], scale: [0.94, 1.08, 1.16] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          ) : null}
        </div>

        {AMBIENT_PARTICLES.map((particle, idx) => (
          <motion.span
            key={idx}
            className="absolute rounded-full bg-white"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
            }}
            animate={{ opacity: [particle.opacity, particle.opacity + 0.22, particle.opacity], scale: [1, 1.35, 1] }}
            transition={{ duration: 2.6, delay: particle.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        <AnimatePresence>
          {waves.map((wave) => (
            <motion.span
              key={wave}
              className="absolute inset-7 rounded-full border pointer-events-none"
              style={{ borderColor: toRgba(colorSystem.blended, 0.62) }}
              initial={{ scale: 0.84, opacity: 0.7 }}
              animate={{ scale: 1.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              onAnimationComplete={() => {
                setWaves((prev) => prev.filter((id) => id !== wave));
              }}
              transition={{ duration: 0.84, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence mode="wait">
        {message ? (
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="max-w-[22rem] rounded-full border border-white/10 bg-slate-950/45 px-4 py-2 text-center text-xs text-white/85 backdrop-blur-xl"
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
