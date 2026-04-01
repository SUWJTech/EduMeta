"use client";

import type { MarketCategory } from "./types";

const PILLS: Array<{ key: MarketCategory; label: string }> = [
  { key: "all", label: "全部 (All)" },
  { key: "skills", label: "技能交换 (Skills)" },
  { key: "hardware", label: "硬件转让 (Hardware)" },
  { key: "requests", label: "求助任务 (Requests)" },
];

export default function FilterPills({
  value,
  onChange,
}: {
  value: MarketCategory;
  onChange: (value: MarketCategory) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-2">
        {PILLS.map((pill) => {
          const active = pill.key === value;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => onChange(pill.key)}
              className={
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 " +
                (active
                  ? "border-white/20 bg-white/10 text-white shadow-[0_0_22px_rgba(6,182,212,0.18)]"
                  : "border-white/10 bg-transparent text-white/60 hover:text-white")
              }
            >
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
