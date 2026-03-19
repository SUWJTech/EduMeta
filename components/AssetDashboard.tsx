function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg">
      <div className="text-xs font-medium text-white/65">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        <span className="bg-gradient-to-r from-meta-primary to-meta-secondary bg-clip-text text-transparent">
          {value}
        </span>
      </div>
    </section>
  );
}

export default function AssetDashboard() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="算力 (Focus Time)" value="12.5h" />
      <StatCard label="通证 (Meta Coins)" value="340" />
    </div>
  );
}

