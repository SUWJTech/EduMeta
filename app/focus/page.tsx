"use client";

import LootDropReveal from "@/components/focus/LootDropReveal";
import { type Fragment, type FragmentRarity, type FragmentType, useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

const MIN_MINUTES = 10;
const MAX_MINUTES = 120;
const MATCH_TIMEOUT_MS = 10_000;

type FocusDomain = "academic" | "tech" | "social";
type Stage = "idle" | "matching" | "running" | "report";
type FocusMode = "solo" | "entangled";
type PresenceStatus = "idle" | "searching" | "running";

type PresenceMeta = {
  status: PresenceStatus;
  node_id: string;
  duration: number;
  started_at: number | null;
  partner_id: string | null;
};

type FinalizeMiningRow = {
  added_compute: number | null;
  profile_compute_power: number | null;
  profile_total_compute_mined: number | null;
  dropped_fragment_id: string | null;
  dropped_fragment_type: FragmentType | null;
  dropped_fragment_rarity: FragmentRarity | null;
};

type FragmentRow = {
  id: string;
  fragment_type: FragmentType;
  rarity: FragmentRarity;
  created_at: string;
};

type FocusReport = {
  addedCompute: number;
  minutes: number;
  mode: FocusMode;
  dropped: Fragment | null;
};

type RpcResult =
  | { kind: "timeout" }
  | { kind: "reject" }
  | {
      kind: "rpc";
      payload: {
        data: FinalizeMiningRow[] | FinalizeMiningRow | null;
        error: { message: string } | null;
      };
    };

const DOMAIN_OPTIONS: Array<{ key: FocusDomain; label: string; hint: string }> = [
  { key: "academic", label: "学术", hint: "知识矿脉" },
  { key: "tech", label: "技术", hint: "代码矿脉" },
  { key: "social", label: "社交", hint: "协作矿脉" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nodeIdOf(userId: string) {
  return `NODE-${userId.slice(0, 6).toUpperCase()}`;
}

function toMmSs(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function matchPartner(
  state: Record<string, PresenceMeta[]>,
  selfId: string,
  duration: number
): { id: string; meta: PresenceMeta } | null {
  const candidates = Object.entries(state)
    .map(([id, metas]) => ({ id, meta: metas[metas.length - 1] }))
    .filter(
      (entry): entry is { id: string; meta: PresenceMeta } =>
        Boolean(entry.meta) && entry.meta.status === "searching" && entry.meta.duration === duration
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < candidates.length - 1; i += 2) {
    const left = candidates[i];
    const right = candidates[i + 1];
    if (left.id === selfId) return right;
    if (right.id === selfId) return left;
  }

  return null;
}

function fragmentFromRow(row: FragmentRow): Fragment {
  return {
    id: row.id,
    type: row.fragment_type,
    rarity: row.rarity,
    timestamp: row.created_at,
  };
}

export default function FocusPage() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfUserIdRef = useRef<string | null>(null);
  const partnerUserIdRef = useRef<string | null>(null);
  const stageRef = useRef<Stage>("idle");
  const modeRef = useRef<FocusMode>("solo");
  const selectedMinutesRef = useRef(40);
  const focusDomainRef = useRef<FocusDomain>("tech");
  const startedAtMsRef = useRef<number | null>(null);
  const finalizingRef = useRef(false);
  const matchTimeoutRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  const optimisticComputeGuardRef = useRef<{ min: number; expiresAt: number } | null>(null);

  const setComputeSnapshot = useUserStore((state) => state.setComputeSnapshot);
  const addComputePower = useUserStore((state) => state.addComputePower);
  const setFragments = useUserStore((state) => state.setFragments);
  const addFragment = useUserStore((state) => state.addFragment);
  const addMindTag = useUserStore((state) => state.addMindTag);

  const [stage, setStage] = useState<Stage>("idle");
  const [mode, setMode] = useState<FocusMode>("solo");
  const [selectedMinutes, setSelectedMinutes] = useState(40);
  const [focusDomain, setFocusDomain] = useState<FocusDomain>("tech");
  const [tag, setTag] = useState("深层挖掘");
  const [remainingSec, setRemainingSec] = useState(40 * 60);
  const [depthProgress, setDepthProgress] = useState(0);
  const [depthNoise, setDepthNoise] = useState(0);
  const [nodeId, setNodeId] = useState("NODE-LOCAL");
  const [partnerNodeId, setPartnerNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ending, setEnding] = useState(false);
  const [report, setReport] = useState<FocusReport | null>(null);

  const running = stage === "running";

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    selectedMinutesRef.current = selectedMinutes;
  }, [selectedMinutes]);

  useEffect(() => {
    focusDomainRef.current = focusDomain;
  }, [focusDomain]);

  const setProfileFocusing = useCallback(
    async (isFocusing: boolean) => {
      const userId = selfUserIdRef.current;
      if (!userId) return;

      const payload = isFocusing
        ? {
            is_focusing: true,
            focus_domain: focusDomainRef.current,
            focus_started_at: new Date(startedAtMsRef.current ?? Date.now()).toISOString(),
            focus_duration_minutes: selectedMinutesRef.current,
          }
        : {
            is_focusing: false,
            focus_domain: null,
            focus_started_at: null,
            focus_duration_minutes: null,
          };

      const { error } = await supabaseRef.current.from("profiles").update(payload).eq("id", userId);
      if (error) setToast(error.message);
    },
    []
  );

  const runWithTimeout = useCallback(async <T,>(task: Promise<T>, timeoutMs: number): Promise<T | null> => {
    const race = await Promise.race([
      task.then((value) => ({ kind: "ok" as const, value })),
      new Promise<{ kind: "timeout" }>((resolve) => {
        window.setTimeout(() => resolve({ kind: "timeout" }), timeoutMs);
      }),
    ]);

    if (race.kind === "timeout") return null;
    return race.value;
  }, []);

  const trackIdle = useCallback(async () => {
    const selfId = selfUserIdRef.current;
    const channel = channelRef.current;
    if (!selfId || !channel) return;

    await channel.track({
      status: "idle",
      node_id: nodeIdOf(selfId),
      duration: selectedMinutesRef.current,
      started_at: null,
      partner_id: null,
    } satisfies PresenceMeta);
  }, []);

  const syncSelfFragments = useCallback(async () => {
    const selfId = selfUserIdRef.current;
    if (!selfId) return;

    const { data, error } = await supabaseRef.current
      .from("user_fragments")
      .select("id, fragment_type, rarity, created_at")
      .eq("user_id", selfId)
      .order("created_at", { ascending: false });

    if (error) {
      setToast("碎片仓库同步失败");
      return;
    }

    const mapped = ((data ?? []) as FragmentRow[]).map(fragmentFromRow);
    setFragments(mapped);
  }, [setFragments]);

  const finishSession = useCallback(
    async (reason: "complete" | "manual" | "leave") => {
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      if (reason !== "leave") setEnding(true);

      if (matchTimeoutRef.current !== null) {
        window.clearTimeout(matchTimeoutRef.current);
        matchTimeoutRef.current = null;
      }
      if (settleTimerRef.current !== null) {
        window.clearInterval(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      const now = Date.now();
      const started = startedAtMsRef.current ?? now;
      const elapsedSec = Math.max(0, Math.floor((now - started) / 1000));
      const elapsedMinutesFloor = Math.floor(elapsedSec / 60);
      const elapsedMinutesRounded = Math.round(elapsedSec / 60);
      const settledMinutes =
        reason === "complete"
          ? selectedMinutesRef.current
          : reason === "manual"
            ? clamp(Math.max(1, elapsedMinutesRounded), 1, selectedMinutesRef.current)
            : clamp(elapsedMinutesFloor, 0, selectedMinutesRef.current);
      const shouldSettle = settledMinutes >= 1;
      const online = modeRef.current === "entangled" && Boolean(partnerUserIdRef.current);
      const localGained = online ? Math.round(settledMinutes * 1.2) : settledMinutes;

      if (shouldSettle) addMindTag(tag.trim() || "未标注");

      let nextReport: FocusReport | null = null;

      try {
        if (shouldSettle) {
          const rpcTask = (async () => {
            try {
              const payload = await supabaseRef.current.rpc("finalize_focus_mining", {
                p_minutes: settledMinutes,
                p_is_online: online,
                p_focus_domain: focusDomainRef.current,
                p_focus_tag: tag.trim() || "未标注",
              });
              return { kind: "rpc" as const, payload };
            } catch {
              return { kind: "reject" as const };
            }
          })();

          const rpcOrTimeout = (await Promise.race([
            rpcTask,
            new Promise<{ kind: "timeout" }>((resolve) => {
              window.setTimeout(() => resolve({ kind: "timeout" }), 8000);
            }),
          ])) as RpcResult;

          if (rpcOrTimeout.kind === "timeout") {
            if (reason !== "leave") setToast("结算链路超时，已按本地快照结算");
            addComputePower(localGained);
            optimisticComputeGuardRef.current = {
              min: useUserStore.getState().computePower,
              expiresAt: Date.now() + 20_000,
            };
            nextReport = {
              addedCompute: localGained,
              minutes: settledMinutes,
              mode: modeRef.current,
              dropped: null,
            };
          } else if (rpcOrTimeout.kind === "reject") {
            if (reason !== "leave") setToast("结算请求失败，已按本地快照补发算力");
            addComputePower(localGained);
            optimisticComputeGuardRef.current = {
              min: useUserStore.getState().computePower,
              expiresAt: Date.now() + 20_000,
            };
            nextReport = {
              addedCompute: localGained,
              minutes: settledMinutes,
              mode: modeRef.current,
              dropped: null,
            };
          } else {
            const { data, error } = rpcOrTimeout.payload;
            if (error) {
              if (reason !== "leave") setToast(error.message);
              addComputePower(localGained);
              optimisticComputeGuardRef.current = {
                min: useUserStore.getState().computePower,
                expiresAt: Date.now() + 20_000,
              };
              nextReport = {
                addedCompute: localGained,
                minutes: settledMinutes,
                mode: modeRef.current,
                dropped: null,
              };
            } else {
              const row = (Array.isArray(data) ? data[0] : data) as FinalizeMiningRow | null;
              const gained = Number(row?.added_compute);
              const profileCompute = Number(row?.profile_compute_power);
              const profileTotal = Number(row?.profile_total_compute_mined);

              if (Number.isFinite(profileCompute)) {
                setComputeSnapshot(
                  Math.max(0, Math.round(profileCompute)),
                  Number.isFinite(profileTotal) ? Math.max(0, Math.round(profileTotal)) : null
                );
              } else if (Number.isFinite(gained)) {
                addComputePower(Math.max(0, Math.round(gained)));
              } else {
                addComputePower(localGained);
              }

              let dropped: Fragment | null = null;
              if (row?.dropped_fragment_id && row.dropped_fragment_type && row.dropped_fragment_rarity) {
                dropped = {
                  id: row.dropped_fragment_id,
                  type: row.dropped_fragment_type,
                  rarity: row.dropped_fragment_rarity,
                  timestamp: new Date().toISOString(),
                };
                addFragment(dropped);
              }

              nextReport = {
                addedCompute: Number.isFinite(gained) ? Math.max(0, Math.round(gained)) : localGained,
                minutes: settledMinutes,
                mode: modeRef.current,
                dropped,
              };
              optimisticComputeGuardRef.current = null;
            }
          }
        }
      } finally {
        void (async () => {
          await runWithTimeout(setProfileFocusing(false), 3500);
          await runWithTimeout(trackIdle(), 2500);
          void runWithTimeout(syncSelfFragments(), 3000);
        })();

        partnerUserIdRef.current = null;

        if (!unmountedRef.current && reason !== "leave") {
          setRemainingSec(0);
          setPartnerNodeId(null);
          setDepthProgress(1);
          setDepthNoise(0);
          setReport(
            nextReport ?? {
              addedCompute: 0,
              minutes: settledMinutes,
              mode: modeRef.current,
              dropped: null,
            }
          );
          setStage("report");
        }

        finalizingRef.current = false;
        if (!unmountedRef.current && reason !== "leave") setEnding(false);
      }
    },
    [addComputePower, addFragment, addMindTag, runWithTimeout, setComputeSnapshot, setProfileFocusing, syncSelfFragments, tag, trackIdle]
  );

  const beginRunning = useCallback(
    async (nextMode: FocusMode, partnerId: string | null, partnerNode: string | null) => {
      modeRef.current = nextMode;
      setMode(nextMode);
      partnerUserIdRef.current = partnerId;
      setPartnerNodeId(partnerNode);
      startedAtMsRef.current = Date.now();
      setRemainingSec(selectedMinutesRef.current * 60);
      setDepthProgress(0);
      setDepthNoise(0);
      setStage("running");
      await setProfileFocusing(true);
    },
    [setProfileFocusing]
  );

  const startMatching = async () => {
    if (!isAuthenticated) {
      setToast("请先登录后再开始挖掘");
      router.push("/login?redirectTo=/focus");
      return;
    }

    const channel = channelRef.current;
    const selfId = selfUserIdRef.current;
    if (!channel || !selfId) {
      setToast("量子链路尚未就绪，请稍后再试");
      return;
    }

    if (matchTimeoutRef.current !== null) {
      window.clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }

    setReport(null);
    setStage("matching");
    setPartnerNodeId(null);

    await channel.track({
      status: "searching",
      node_id: nodeIdOf(selfId),
      duration: selectedMinutesRef.current,
      started_at: Date.now(),
      partner_id: null,
    } satisfies PresenceMeta);

    matchTimeoutRef.current = window.setTimeout(() => {
      if (stageRef.current !== "matching") return;
      void beginRunning("solo", null, null);
      setToast("未匹配到同频节点，转为单人深层挖掘");
    }, MATCH_TIMEOUT_MS);
  };

  useEffect(() => {
    let mounted = true;
    const supabase = supabaseRef.current;

    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;
        if (!user) {
          setIsAuthenticated(false);
          setToast("请先登录后再开启挖掘");
          return;
        }

        setIsAuthenticated(true);
        selfUserIdRef.current = user.id;
        setNodeId(nodeIdOf(user.id));
        await syncSelfFragments();

        const channel = supabase.channel("focus:mining:room", {
          config: { presence: { key: user.id } },
        });
        channelRef.current = channel;

        channel.on("presence", { event: "sync" }, () => {
          const selfId = selfUserIdRef.current;
          if (!selfId) return;
          const state = channel.presenceState() as Record<string, PresenceMeta[]>;

          if (stageRef.current === "matching") {
            const candidate = matchPartner(state, selfId, selectedMinutesRef.current);
            if (!candidate) return;

            if (matchTimeoutRef.current !== null) {
              window.clearTimeout(matchTimeoutRef.current);
              matchTimeoutRef.current = null;
            }

            void beginRunning("entangled", candidate.id, candidate.meta.node_id);
            return;
          }

          if (stageRef.current === "running" && modeRef.current === "entangled") {
            const partnerId = partnerUserIdRef.current;
            if (!partnerId) return;
            const partnerMeta = state[partnerId]?.[state[partnerId].length - 1];
            if (!partnerMeta || partnerMeta.status === "idle") {
              modeRef.current = "solo";
              setMode("solo");
              setPartnerNodeId(null);
              setToast("纠缠链路中断，已切换为单人挖掘");
            }
          }
        });

        channel.subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          void channel.track({
            status: "idle",
            node_id: nodeIdOf(user.id),
            duration: selectedMinutesRef.current,
            started_at: null,
            partner_id: null,
          } satisfies PresenceMeta);
        });
      } catch {
        if (!mounted) return;
        setToast("节点连接失败，请稍后重试");
      } finally {
        if (mounted) setBooting(false);
      }
    };

    void init();

    return () => {
      mounted = false;
    };
  }, [beginRunning, syncSelfFragments]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const supabase = supabaseRef.current;

    const profileChannel = supabase
      .channel("focus:profiles:compute")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${selfUserIdRef.current ?? ""}` },
        (payload) => {
          const row = payload.new as { compute_power?: number; total_compute_mined?: number };
          const nextCompute = Number(row.compute_power);
          const nextTotal = Number(row.total_compute_mined);
          if (Number.isFinite(nextCompute)) {
            const guard = optimisticComputeGuardRef.current;
            if (guard) {
              if (Date.now() > guard.expiresAt) {
                optimisticComputeGuardRef.current = null;
              } else if (nextCompute < guard.min) {
                return;
              } else {
                optimisticComputeGuardRef.current = null;
              }
            }
            setComputeSnapshot(
              Math.max(0, Math.round(nextCompute)),
              Number.isFinite(nextTotal) ? Math.max(0, Math.round(nextTotal)) : null
            );
          }
        }
      )
      .subscribe();

    const fragmentsChannel = supabase
      .channel("focus:fragments:self")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_fragments", filter: `user_id=eq.${selfUserIdRef.current ?? ""}` },
        () => {
          void syncSelfFragments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
      void supabase.removeChannel(fragmentsChannel);
    };
  }, [isAuthenticated, setComputeSnapshot, syncSelfFragments]);

  useEffect(() => {
    if (stage !== "running") return;

    const tick = () => {
      const started = startedAtMsRef.current ?? Date.now();
      const elapsedSec = Math.floor((Date.now() - started) / 1000);
      const totalSec = selectedMinutesRef.current * 60;
      const remaining = Math.max(0, totalSec - elapsedSec);
      const progress = totalSec > 0 ? clamp(elapsedSec / totalSec, 0, 1) : 0;

      setRemainingSec(remaining);
      setDepthProgress(progress);
      setDepthNoise((v) => (v + Math.random() * 0.18 + 0.03) % 1);

      if (remaining === 0) {
        void finishSession("complete");
      }
    };

    tick();
    settleTimerRef.current = window.setInterval(tick, 1000);

    return () => {
      if (settleTimerRef.current !== null) {
        window.clearInterval(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [finishSession, stage]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const supabase = supabaseRef.current;

    return () => {
      unmountedRef.current = true;

      if (matchTimeoutRef.current !== null) {
        window.clearTimeout(matchTimeoutRef.current);
        matchTimeoutRef.current = null;
      }
      if (settleTimerRef.current !== null) {
        window.clearInterval(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      if (stageRef.current === "running") {
        void finishSession("leave");
      } else {
        void setProfileFocusing(false);
        void trackIdle();
      }

      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [finishSession, setProfileFocusing, trackIdle]);

  const detectionDepth = useMemo(() => {
    if (!running) return 0;
    return clamp(depthProgress * 0.88 + depthNoise * 0.12, 0, 1);
  }, [depthNoise, depthProgress, running]);

  return (
    <main className="relative flex min-h-[calc(100dvh-6rem)] flex-col overflow-hidden font-mono">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(14,165,233,0.2),rgba(15,23,42,0.65)_40%,rgba(1,2,7,1)_75%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:30px_30px]" />

      <section className="relative z-10 mx-auto grid w-full max-w-[34rem] flex-1 content-center gap-6 px-2 py-5">
        {stage === "idle" ? (
          !booting && !isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto w-full max-w-md rounded-3xl border border-cyan-200/25 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))] p-5 shadow-[0_22px_70px_rgba(6,182,212,0.22)] backdrop-blur-2xl"
            >
              <div className="text-sm font-semibold tracking-[0.14em] text-cyan-100">需要登录后才能专注挖掘</div>
              <div className="mt-2 text-xs leading-relaxed text-cyan-100/70">登录后才能进入量子共鸣态，解锁 1.2x 算力产出与更高碎片掉率。</div>
              <button
                type="button"
                onClick={() => router.push("/login?redirectTo=/focus")}
                className="mt-4 w-full rounded-2xl border border-cyan-300/35 bg-cyan-400/20 px-4 py-3 text-sm font-semibold text-cyan-100"
              >
                前往登录节点
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5">
              <div className="text-center">
                <div className="text-sm font-semibold tracking-[0.16em] text-cyan-100">THE FOCUS MINE</div>
                <div className="mt-1 text-xs text-cyan-100/60">专注不是消耗时间，而是在驱动星核挖掘数字资产</div>
              </div>

              <div className="grid justify-items-center gap-3">
                <div className="grid h-36 w-36 place-items-center rounded-full border border-cyan-300/30 bg-[radial-gradient(circle,rgba(34,211,238,0.42),rgba(2,6,23,0.28)_72%)] shadow-[0_0_80px_rgba(34,211,238,0.24)]">
                  <div className="text-center">
                    <div className="text-4xl font-semibold text-white">{selectedMinutes}</div>
                    <div className="text-xs text-cyan-100/70">分钟</div>
                  </div>
                </div>

                <input
                  type="range"
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  value={selectedMinutes}
                  onChange={(event) => setSelectedMinutes(Number(event.target.value))}
                  className="w-full accent-cyan-300"
                />
                <div className="flex w-full justify-between text-[11px] text-cyan-100/55">
                  <span>10m</span>
                  <span>120m</span>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs text-cyan-100/65">专注矿脉类型</div>
                <div className="grid grid-cols-3 gap-2">
                  {DOMAIN_OPTIONS.map((option) => {
                    const active = focusDomain === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setFocusDomain(option.key)}
                        className={`rounded-xl px-2 py-2 text-xs transition ${
                          active
                            ? "border border-cyan-300/45 bg-cyan-400/20 text-cyan-100"
                            : "border border-white/15 bg-white/5 text-white/70"
                        }`}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="mt-0.5 text-[10px] opacity-75">{option.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <input
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                placeholder="专注标签（影响掉落类型）"
                className="w-full rounded-2xl border border-cyan-100/20 bg-black/40 px-4 py-3 text-sm text-cyan-50 placeholder:text-cyan-100/35 outline-none backdrop-blur-md"
              />

              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-cyan-100/70">
                单人产出：1 点/分钟，掉率 5% · 共鸣产出：1.2x，掉率 25%
              </div>

              <button
                type="button"
                onClick={() => void startMatching()}
                disabled={booting}
                className="w-full rounded-2xl border border-cyan-300/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(59,130,246,0.3))] px-4 py-3 text-sm font-semibold tracking-[0.08em] text-white shadow-[0_18px_42px_rgba(34,211,238,0.28)] disabled:opacity-50"
              >
                开启挖掘
              </button>
            </motion.div>
          )
        ) : null}

        {stage === "matching" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid justify-items-center gap-7">
            <div className="relative h-64 w-64">
              {[0, 0.26, 0.52, 0.78].map((delay, idx) => (
                <motion.div
                  key={idx}
                  className="absolute inset-0 rounded-full border border-cyan-300/35"
                  initial={{ scale: 0.22, opacity: 0.65 }}
                  animate={{ scale: 1.22, opacity: 0 }}
                  transition={{ duration: 2.1, delay, repeat: Infinity, ease: "easeOut" }}
                />
              ))}
              <motion.div
                className="absolute left-1/2 top-1/2 h-64 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(125,211,252,0.95),transparent)]"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold tracking-[0.1em] text-cyan-100">正在匹配量子共鸣节点...</div>
              <div className="mt-1 text-xs text-cyan-100/55">10 秒内未匹配成功将自动转为单人挖掘</div>
            </div>
          </motion.div>
        ) : null}

        {stage === "running" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-3 text-center">
                <div className="text-[11px] text-cyan-100/65">我的节点</div>
                <div className="mt-1 text-sm font-semibold text-cyan-100">{nodeId}</div>
              </div>
              <div className="rounded-2xl border border-violet-300/25 bg-violet-400/10 p-3 text-center">
                <div className="text-[11px] text-violet-100/65">连接状态</div>
                <div className="mt-1 text-sm font-semibold text-violet-100">
                  {mode === "entangled" ? `共鸣中 · ${partnerNodeId ?? "NODE"}` : "单人挖掘"}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-300/20 bg-black/35 p-5 text-center">
              <div className="bg-gradient-to-b from-cyan-50 to-cyan-200 bg-clip-text text-6xl font-semibold text-transparent">
                {toMmSs(remainingSec)}
              </div>
              <div className="mt-2 text-xs text-cyan-100/70">
                {mode === "entangled" ? "量子共鸣产出倍率：1.2x" : "单人产出倍率：1.0x"}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200/15 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] text-cyan-100/70">
                <span>探测深度</span>
                <span>{Math.round(detectionDepth * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(167,139,250,0.9))]"
                  animate={{ width: `${Math.round(detectionDepth * 100)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-cyan-100/55">深层数据脉冲正在破岩，晶体结构已开始显影</div>
            </div>

            <button
              type="button"
              onClick={() => void finishSession("manual")}
              disabled={ending}
              className="w-full rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100"
            >
              {ending ? "结算中..." : "提前结束并结算"}
            </button>
          </motion.div>
        ) : null}

        {stage === "report" && report ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-cyan-200/30 bg-[linear-gradient(165deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] p-5 backdrop-blur-2xl"
          >
            <div className="text-center">
              <div className="text-xl font-semibold text-white">挖掘结算</div>
              <div className="mt-1 text-xs text-cyan-100/65">
                {report.mode === "entangled" ? "量子共鸣结算" : "单人挖掘结算"} · {report.minutes} 分钟
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-3 text-center">
              <div className="text-[11px] text-cyan-100/70">算力收益</div>
              <div className="mt-1 text-2xl font-semibold text-cyan-50">+{report.addedCompute}</div>
            </div>

            <div className="mt-4">
              {report.dropped ? (
                <LootDropReveal type={report.dropped.type} rarity={report.dropped.rarity} />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center text-sm text-cyan-100/70">
                  本轮未掉落晶体碎片，继续深挖可提高命中机会。
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setReport(null);
                setPartnerNodeId(null);
                setDepthProgress(0);
                setDepthNoise(0);
                setStage("idle");
              }}
              className="mt-4 w-full rounded-2xl border border-cyan-300/35 bg-cyan-400/20 px-4 py-3 text-sm font-semibold text-cyan-100"
            >
              返回挖掘舱
            </button>
          </motion.div>
        ) : null}
      </section>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed left-1/2 top-4 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-cyan-300/20 bg-black/60 px-4 py-3 text-center text-xs text-cyan-100 backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
