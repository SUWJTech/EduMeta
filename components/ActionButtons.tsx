export default function ActionButtons({
  onMintRecord,
  onGravityPing,
}: {
  onMintRecord: () => void;
  onGravityPing: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onMintRecord}
        className="w-full rounded-2xl border border-cyan-300/25 bg-[linear-gradient(155deg,rgba(14,116,144,0.35),rgba(2,6,23,0.7))] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(34,211,238,0.22)] transition-transform active:scale-95"
      >
        算力封存
        <span className="mt-1 block text-[11px] font-medium text-white/70">Mint Record</span>
      </button>
      <button
        type="button"
        onClick={onGravityPing}
        className="w-full rounded-2xl border border-violet-300/25 bg-[linear-gradient(155deg,rgba(91,33,182,0.34),rgba(2,6,23,0.72))] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(139,92,246,0.22)] transition-transform active:scale-95"
      >
        引力波广播
        <span className="mt-1 block text-[11px] font-medium text-white/70">Gravity Ping</span>
      </button>
    </div>
  );
}
