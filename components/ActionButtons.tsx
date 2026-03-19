export default function ActionButtons() {
  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="w-full rounded-2xl bg-meta-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(139,92,246,0.28)] transition-transform active:scale-95"
      >
        生成学术碎片 (Generate Wallpaper)
      </button>
      <button
        type="button"
        className="w-full rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-sm transition-transform active:scale-95"
      >
        开启环境扫描 (Scan Environment)
      </button>
    </div>
  );
}

