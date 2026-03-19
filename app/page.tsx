import ActionButtons from "@/components/ActionButtons";
import AssetDashboard from "@/components/AssetDashboard";
import EnergyCore from "@/components/EnergyCore";
import TopBar from "@/components/TopBar";

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100dvh-6rem)] flex-col gap-7">
      <TopBar />

      <section className="pt-2">
        <EnergyCore />
      </section>

      <AssetDashboard />

      <div className="flex-1" />

      <section className="pb-2">
        <ActionButtons />
      </section>
    </main>
  );
}
