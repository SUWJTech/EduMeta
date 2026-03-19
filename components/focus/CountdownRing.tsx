import { motion } from "framer-motion";

const RADIUS = 118;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CountdownRing({ timeText = "25:00" }: { timeText?: string }) {
  return (
    <div className="flex items-center justify-center">
      <motion.div
        className="relative h-72 w-72"
        animate={{ rotate: [0, 6, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          viewBox="0 0 280 280"
          className="h-full w-full"
          role="img"
          aria-label={`Countdown ${timeText}`}
        >
          <defs>
            <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
            </linearGradient>
            <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.8 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE}
          />
          <motion.circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * 0.08}
            filter="url(#ringGlow)"
            animate={{ opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[44px] font-semibold tracking-tight text-white">
              {timeText}
            </div>
            <div className="mt-2 text-xs font-medium text-white/50">Focus Session</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

