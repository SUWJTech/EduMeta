"use client";

const OPTIONS = [15, 25, 45, 60] as const;

export default function DurationPills({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {OPTIONS.map((m) => {
        const active = m === minutes;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={
              active
                ? "rounded-2xl border border-white/18 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_26px_rgba(6,182,212,0.14)] backdrop-blur"
                : "rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 backdrop-blur transition-transform active:scale-[0.98]"
            }
          >
            {m}min
          </button>
        );
      })}
    </div>
  );
}

