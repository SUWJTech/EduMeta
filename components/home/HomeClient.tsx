"use client";

import ActionButtons from "@/components/ActionButtons";
import AssetDashboard from "@/components/AssetDashboard";
import EnergyCore from "@/components/EnergyCore";
import BroadcastMarquee from "@/components/home/BroadcastMarquee";
import GravityPingModal from "@/components/home/GravityPingModal";
import MintRecordModal, { type MintedActivityLog } from "@/components/home/MintRecordModal";
import Toast from "@/components/focus/Toast";
import { useProfile } from "@/hooks/useProfile";
import { useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useMemo, useState } from "react";

type BroadcastRow = {
  id: string;
  message: string;
  expires_at: string;
  sender_label?: string | null;
};

type ActiveBroadcast = {
  id: string;
  message: string;
  expiresAt: string;
  senderLabel?: string | null;
};

export default function HomeClient({
  userId,
  initialBroadcast,
}: {
  userId: string | null;
  initialBroadcast?: BroadcastRow | null;
}) {
  const { profile } = useProfile(userId);
  const supabase = useMemo(() => createClient(), []);
  const [mintOpen, setMintOpen] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "info" | "error" } | null>(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState<ActiveBroadcast | null>(
    initialBroadcast
      ? {
          id: initialBroadcast.id,
          message: initialBroadcast.message,
          expiresAt: initialBroadcast.expires_at,
          senderLabel: initialBroadcast.sender_label ?? null,
        }
      : null
  );

  const fragments = useUserStore((state) => state.fragments);
  const setComputeSnapshot = useUserStore((state) => state.setComputeSnapshot);
  const computePower = profile?.compute_power ?? 0;
  const totalComputeMined = profile?.total_compute_mined ?? computePower;
  const focusHours = profile?.focus_hours ?? 0;
  const academic = profile?.academic ?? 0;
  const tech = profile?.tech ?? 0;
  const social = profile?.social ?? 0;

  useEffect(() => {
    setComputeSnapshot(computePower, totalComputeMined);
  }, [computePower, setComputeSnapshot, totalComputeMined]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!activeBroadcast) return;
    const expiresMs = new Date(activeBroadcast.expiresAt).getTime() - Date.now();
    if (expiresMs <= 0) {
      setActiveBroadcast(null);
      return;
    }
    const id = window.setTimeout(() => {
      setActiveBroadcast((prev) => (prev?.id === activeBroadcast.id ? null : prev));
    }, expiresMs);
    return () => window.clearTimeout(id);
  }, [activeBroadcast]);

  useEffect(() => {
    if (!userId) {
      setIsFocusing(false);
      return;
    }

    const channel = supabase.channel("focus_room");

    const syncPresence = () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ status?: "idle" | "focusing" }>
      >;
      const me = state[userId];
      const latest = me?.[me.length - 1];
      setIsFocusing(latest?.status === "focusing");
    };

    channel.on("presence", { event: "sync" }, syncPresence).subscribe((status) => {
      if (status === "SUBSCRIBED") syncPresence();
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    const channel = supabase.channel("home:broadcasts");

    const activate = (row: BroadcastRow) => {
      if (!row.message || !row.expires_at) return;
      if (new Date(row.expires_at).getTime() <= Date.now()) return;
      setActiveBroadcast({
        id: row.id,
        message: row.message,
        expiresAt: row.expires_at,
        senderLabel: row.sender_label ?? null,
      });
    };

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcasts" }, (payload) => {
        activate(payload.new as BroadcastRow);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const onToast = (message: string, variant: "info" | "error" = "info") => {
    setToast({ message, variant });
  };

  const onMintRecord = async (
    taskSummary: string,
    durationMinutes: number
  ): Promise<MintedActivityLog | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      onToast("请先登录后再封存", "error");
      return null;
    }

    const { data, error } = await supabase.rpc("mint_activity_record", {
      p_task_summary: taskSummary,
      p_duration_minutes: durationMinutes,
    });

    if (error) {
      if (error.message.includes("INSUFFICIENT_FOCUS")) {
        onToast("算力不足，至少需要 1 算力", "error");
        return null;
      }
      onToast(error.message, "error");
      return null;
    }

    const row = (Array.isArray(data) ? data[0] : data) as MintedActivityLog | null;
    if (!row) {
      onToast("封存失败，请稍后重试", "error");
      return null;
    }
    onToast("封存成功，记录已上链", "info");
    return row;
  };

  const onLaunchBroadcast = async (message: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      onToast("请先登录后再广播", "error");
      return false;
    }

    const { data, error } = await supabase.rpc("create_broadcast_ping", {
      p_message: message,
      p_cost: 5,
      p_ttl_seconds: 10,
    });

    if (error) {
      if (error.message.includes("INSUFFICIENT_BALANCE")) {
        onToast("算力不足，至少需要 5 算力", "error");
        return false;
      }
      onToast(error.message, "error");
      return false;
    }

    const row = (Array.isArray(data) ? data[0] : data) as BroadcastRow | null;
    if (row?.id) {
      setActiveBroadcast({
        id: row.id,
        message: row.message,
        expiresAt: row.expires_at,
        senderLabel: row.sender_label ?? null,
      });
    }

    onToast("广播已发射，正在同步全网节点", "info");
    return true;
  };

  return (
    <>
      <Toast message={toast?.message ?? null} variant={toast?.variant ?? "info"} />
      <MintRecordModal
        open={mintOpen}
        focusHours={focusHours}
        onClose={() => setMintOpen(false)}
        onMintRecord={onMintRecord}
      />
      <GravityPingModal
        open={pingOpen}
        computePower={computePower}
        onClose={() => setPingOpen(false)}
        onLaunch={onLaunchBroadcast}
      />

      <BroadcastMarquee message={activeBroadcast?.message ?? null} senderLabel={activeBroadcast?.senderLabel} />

      <section className="pt-2">
        <EnergyCore
          computePower={computePower}
          focusHours={focusHours}
          academic={academic}
          tech={tech}
          social={social}
          isFocusing={isFocusing}
        />
      </section>

      <AssetDashboard
        computePower={computePower}
        totalComputeMined={totalComputeMined}
        fragmentCount={fragments.length}
      />

      <div className="flex-1" />

      <section className="pb-2">
        <ActionButtons onMintRecord={() => setMintOpen(true)} onGravityPing={() => setPingOpen(true)} />
      </section>
    </>
  );
}
