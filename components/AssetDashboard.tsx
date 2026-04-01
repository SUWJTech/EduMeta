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

export default function AssetDashboard({
  computePower,
  totalComputeMined,
  fragmentCount,
}: {
  computePower: number;
  totalComputeMined: number;
  fragmentCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="实时算力" value={String(Math.max(0, Math.round(computePower)))} />
      <StatCard label="历史总产量" value={String(Math.max(0, Math.round(totalComputeMined)))} />
      <StatCard label="碎片仓储" value={String(Math.max(0, Math.round(fragmentCount)))} />
    </div>
  );
}
