"use client";

import { motion } from "framer-motion";

type Orb = {
  size: number;
  x: string;
  y: string;
  colorClass: string;
  blurClass: string;
  baseOpacity: number;
  floatX: number;
  floatY: number;
  duration: number;
  delay: number;
};

const ORBS: Orb[] = [
  {
    size: 168,
    x: "50%",
    y: "48%",
    colorClass: "bg-meta-primary/25",
    blurClass: "blur-2xl",
    baseOpacity: 0.9,
    floatX: 6,
    floatY: -8,
    duration: 7.5,
    delay: 0,
  },
  {
    size: 132,
    x: "42%",
    y: "55%",
    colorClass: "bg-meta-secondary/20",
    blurClass: "blur-2xl",
    baseOpacity: 0.85,
    floatX: -7,
    floatY: 9,
    duration: 8.2,
    delay: 0.3,
  },
  {
    size: 110,
    x: "58%",
    y: "40%",
    colorClass: "bg-meta-primary/20",
    blurClass: "blur-xl",
    baseOpacity: 0.8,
    floatX: 8,
    floatY: 6,
    duration: 6.8,
    delay: 0.6,
  },
  {
    size: 92,
    x: "35%",
    y: "36%",
    colorClass: "bg-meta-secondary/18",
    blurClass: "blur-xl",
    baseOpacity: 0.75,
    floatX: -10,
    floatY: -6,
    duration: 9.1,
    delay: 0.1,
  },
  {
    size: 74,
    x: "64%",
    y: "62%",
    colorClass: "bg-meta-secondary/16",
    blurClass: "blur-lg",
    baseOpacity: 0.7,
    floatX: 10,
    floatY: -4,
    duration: 7.9,
    delay: 0.45,
  },
];

const PARTICLES = [
  { x: "30%", y: "22%", s: 2, o: 0.35, d: 0.1 },
  { x: "68%", y: "24%", s: 2, o: 0.3, d: 0.3 },
  { x: "76%", y: "48%", s: 1, o: 0.25, d: 0.55 },
  { x: "22%", y: "56%", s: 2, o: 0.28, d: 0.4 },
  { x: "44%", y: "76%", s: 1, o: 0.22, d: 0.2 },
  { x: "58%", y: "18%", s: 1, o: 0.22, d: 0.6 },
  { x: "18%", y: "38%", s: 1, o: 0.24, d: 0.75 },
  { x: "84%", y: "66%", s: 2, o: 0.28, d: 0.82 },
];

export default function EnergyCore() {
  return (
    <div className="flex w-full items-center justify-center">
      <motion.div
        className="relative h-64 w-64"
        animate={{ scale: [1, 1.05, 1], rotate: [0, 6, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute inset-4 rounded-full bg-gradient-to-br from-meta-primary/35 via-meta-secondary/15 to-meta-primary/25 blur-2xl"
          animate={{ opacity: [0.6, 0.95, 0.6] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-7 rounded-full bg-gradient-to-tr from-meta-secondary/30 via-transparent to-meta-primary/25 blur-2xl"
          animate={{ opacity: [0.45, 0.85, 0.45], rotate: [0, -8, 0] }}
          transition={{ duration: 8.2, repeat: Infinity, ease: "easeInOut" }}
        />

        {ORBS.map((orb, idx) => (
          <motion.div
            key={idx}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${orb.colorClass} ${orb.blurClass}`}
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              opacity: orb.baseOpacity,
            }}
            animate={{
              x: [-orb.floatX, orb.floatX, -orb.floatX],
              y: [-orb.floatY, orb.floatY, -orb.floatY],
              opacity: [orb.baseOpacity * 0.7, orb.baseOpacity, orb.baseOpacity * 0.7],
            }}
            transition={{
              duration: orb.duration,
              delay: orb.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/5 via-transparent to-white/10" />
        <div className="absolute inset-2 rounded-full border border-white/10" />

        {PARTICLES.map((p, idx) => (
          <motion.span
            key={idx}
            className="absolute rounded-full bg-white"
            style={{
              left: p.x,
              top: p.y,
              width: p.s,
              height: p.s,
              opacity: p.o,
              filter: "drop-shadow(0 0 10px rgba(139,92,246,0.45))",
            }}
            animate={{ opacity: [p.o, p.o + 0.25, p.o], scale: [1, 1.4, 1] }}
            transition={{ duration: 3.8, delay: p.d, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </motion.div>
    </div>
  );
}

