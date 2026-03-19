export default function TopBar() {
  return (
    <header className="flex items-center justify-between">
      <div className="text-base font-semibold tracking-tight">EduMeta</div>
      <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-meta-primary/70 to-meta-secondary/60 p-[2px] shadow-[0_0_18px_rgba(139,92,246,0.35)]">
        <div className="h-full w-full rounded-full bg-slate-900/80" />
      </div>
    </header>
  );
}

