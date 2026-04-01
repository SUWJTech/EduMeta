"use client";

import MetaPassport from "@/components/MetaPassport";
import { Building, type BuildingStyle, type FocusDomain } from "@/components/Building";
import { type Fragment, type FragmentRarity, type FragmentType, useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Line, OrbitControls, OrthographicCamera, Stars, Text } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const GRID_SIZE = 45;
const GRID_STEP = 2.4;
const ISO_ROTATION = -Math.PI / 4;

type ProfileRow = {
  id: string;
  display_name: string | null;
  compute_power?: number | null;
  total_compute_mined?: number | null;
  focus_hours?: number | null;
  academic?: number | null;
  tech?: number | null;
  social?: number | null;
  building_style?: string | null;
  is_focusing?: boolean | null;
  focus_domain?: string | null;
  focus_started_at?: string | null;
  focus_duration_minutes?: number | null;
};

type FragmentRow = {
  id: string;
  user_id: string;
  fragment_type: FragmentType;
  rarity: FragmentRarity;
  created_at: string;
};

type FragmentListingRow = {
  id: string;
  fragment_id: string;
  seller_id: string;
  price_compute: number;
  status: "active" | "sold" | "cancelled" | string;
  buyer_id?: string | null;
  created_at?: string | null;
  sold_at?: string | null;
};

type TradeResultRow = {
  listing_id: string | null;
  fragment_id: string | null;
  fragment_type: FragmentType | null;
  fragment_rarity: FragmentRarity | null;
  seller_id: string | null;
  buyer_id: string | null;
  price_compute: number | null;
  buyer_compute_power: number | null;
  seller_compute_power: number | null;
};

type CityBuilding = {
  id: string;
  label: string;
  position: [number, number, number];
  height: number;
  computePower: number;
  totalComputeMined: number;
  color: string;
  style: BuildingStyle;
  isFocusing: boolean;
  focusDomain: FocusDomain | null;
  focusProgress: number;
  fragmentCount: number;
  hasListing: boolean;
};

type ListingBeacon = {
  listing: FragmentListingRow;
  fragment: FragmentRow;
  position: [number, number, number];
};

type TradePulse = {
  id: number;
  from: [number, number, number];
  to: [number, number, number];
  progress: number;
  label: string;
};

const TYPE_COLOR: Record<FragmentType, string> = {
  Tech: "#38bdf8",
  Academic: "#a78bfa",
  Engine: "#fb923c",
};

const RARITY_GLOW: Record<FragmentRarity, number> = {
  common: 0.6,
  uncommon: 0.9,
  rare: 1.25,
  epic: 1.6,
};

const RARITY_TEXT: Record<FragmentRarity, string> = {
  common: "普通",
  uncommon: "进阶",
  rare: "稀有",
  epic: "史诗",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeStyle(input: unknown): BuildingStyle {
  if (input === "cyber_pagoda") return "cyber_pagoda";
  if (input === "void_monolith") return "void_monolith";
  return "default";
}

function normalizeFocusDomain(input: unknown): FocusDomain | null {
  if (input === "academic") return "academic";
  if (input === "tech") return "tech";
  if (input === "social") return "social";
  return null;
}

function mapIdToGridIndex(ids: string[]) {
  const sortedIds = [...ids].sort((a, b) => hashString(a) - hashString(b));
  const occupied = new Set<number>();
  const total = GRID_SIZE * GRID_SIZE;
  const lookup = new Map<string, number>();

  for (const id of sortedIds) {
    const seed = hashString(id);
    let attempt = 0;
    let index = seed % total;

    while (occupied.has(index) && attempt < total) {
      attempt += 1;
      index = (seed + attempt * attempt + attempt) % total;
    }

    if (occupied.has(index)) {
      for (let i = 0; i < total; i += 1) {
        if (!occupied.has(i)) {
          index = i;
          break;
        }
      }
    }

    occupied.add(index);
    lookup.set(id, index);
  }

  return lookup;
}

function mixDimensionColor(profile: ProfileRow) {
  const academic = Math.max(0, safeNumber(profile.academic, 0));
  const tech = Math.max(0, safeNumber(profile.tech, 0));
  const social = Math.max(0, safeNumber(profile.social, 0));
  const sum = academic + tech + social;
  const wa = sum > 0 ? academic / sum : 1 / 3;
  const wt = sum > 0 ? tech / sum : 1 / 3;
  const ws = sum > 0 ? social / sum : 1 / 3;

  const purple = [139, 92, 246];
  const blue = [56, 189, 248];
  const orange = [251, 146, 60];

  const r = Math.round((purple[0] * wa + blue[0] * wt + orange[0] * ws) * 0.86);
  const g = Math.round((purple[1] * wa + blue[1] * wt + orange[1] * ws) * 0.86);
  const b = Math.round((purple[2] * wa + blue[2] * wt + orange[2] * ws) * 0.86);

  return `rgb(${r}, ${g}, ${b})`;
}

function resolveCompute(profile: ProfileRow) {
  return Math.max(0, Math.round(safeNumber(profile.compute_power, 0)));
}

function resolveTotalCompute(profile: ProfileRow) {
  const balance = resolveCompute(profile);
  return Math.max(balance, Math.round(safeNumber(profile.total_compute_mined, balance)));
}

function resolveFocusProgress(profile: ProfileRow, nowMs: number) {
  if (!profile.is_focusing) return 0;
  const started = profile.focus_started_at ? new Date(profile.focus_started_at).getTime() : Number.NaN;
  const duration = safeNumber(profile.focus_duration_minutes, 0);
  if (!Number.isFinite(started) || duration <= 0) return 0;
  const elapsedMinutes = (nowMs - started) / 60_000;
  return clamp(elapsedMinutes / duration, 0, 1);
}

function createBuildings(
  profiles: ProfileRow[],
  nowMs: number,
  fragmentCountByUser: Map<string, number>,
  listingCountByUser: Map<string, number>
) {
  if (!profiles.length) return [] as CityBuilding[];

  const powers = profiles.map(resolveCompute);
  const maxPower = Math.max(...powers, 1);
  const lookup = mapIdToGridIndex(profiles.map((profile) => profile.id));
  const center = (GRID_SIZE - 1) / 2;

  return profiles.map((profile) => {
    const index = lookup.get(profile.id) ?? 0;
    const xIndex = index % GRID_SIZE;
    const zIndex = Math.floor(index / GRID_SIZE);
    const computePower = resolveCompute(profile);
    const normalized = clamp(computePower / maxPower, 0, 1);
    const height = 1.1 + Math.sqrt(normalized) * 10.5;

    return {
      id: profile.id,
      label: profile.display_name?.trim() || `Node-${profile.id.slice(0, 6)}`,
      position: [(xIndex - center) * GRID_STEP, 0, (zIndex - center) * GRID_STEP],
      height,
      computePower,
      totalComputeMined: resolveTotalCompute(profile),
      color: mixDimensionColor(profile),
      style: normalizeStyle(profile.building_style),
      isFocusing: Boolean(profile.is_focusing),
      focusDomain: normalizeFocusDomain(profile.focus_domain),
      focusProgress: resolveFocusProgress(profile, nowMs),
      fragmentCount: fragmentCountByUser.get(profile.id) ?? 0,
      hasListing: (listingCountByUser.get(profile.id) ?? 0) > 0,
    } satisfies CityBuilding;
  });
}

function ListingHologram({
  beacon,
  selected,
  onOpen,
}: {
  beacon: ListingBeacon;
  selected: boolean;
  onOpen: (listingId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const color = TYPE_COLOR[beacon.fragment.fragment_type];
  const glow = RARITY_GLOW[beacon.fragment.rarity];
  const seed = useMemo(() => hashString(beacon.listing.id), [beacon.listing.id]);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = ((seed % 360) * Math.PI) / 180;
  }, [seed]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!groupRef.current) return;
      groupRef.current.rotation.y += 0.01 + glow * 0.003;
      groupRef.current.position.y = beacon.position[1] + Math.sin(Date.now() * 0.0022 + seed) * 0.1;
    }, 16);
    return () => window.clearInterval(id);
  }, [beacon.position, glow, seed]);

  return (
    <group
      ref={groupRef}
      position={beacon.position}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(beacon.listing.id);
      }}
    >
      <mesh>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={new THREE.Color(color)}
          emissiveIntensity={selected ? 1.8 : 1 + glow * 0.7}
          transparent
          opacity={0.9}
          roughness={0.16}
          metalness={0.2}
        />
      </mesh>
      <mesh scale={1.34}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.68 : 0.42} wireframe toneMapped={false} />
      </mesh>
      <Text position={[0, 0.55, 0]} fontSize={0.12} color="#a5f3fc" anchorX="center" anchorY="middle">
        {beacon.listing.price_compute}CP
      </Text>
    </group>
  );
}

function DataLinkFx({ pulse }: { pulse: TradePulse }) {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...pulse.from);
    const end = new THREE.Vector3(...pulse.to);
    const mid = start.clone().lerp(end, 0.5);
    const height = Math.max(start.distanceTo(end) * 0.24, 1.3);
    const control1 = new THREE.Vector3(mid.x, mid.y + height, mid.z).lerp(start, 0.35);
    const control2 = new THREE.Vector3(mid.x, mid.y + height * 1.04, mid.z).lerp(end, 0.35);
    return new THREE.CubicBezierCurve3(start, control1, control2, end);
  }, [pulse.from, pulse.to]);

  const points = useMemo(() => curve.getPoints(54), [curve]);
  const p = clamp(pulse.progress, 0, 1);
  const orb = curve.getPoint(p);

  return (
    <group>
      <Line points={points} color="#67e8f9" transparent opacity={0.42} lineWidth={1.2} toneMapped={false} />
      <mesh position={[orb.x, orb.y, orb.z]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial color="#a5f3fc" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <Text position={[orb.x, orb.y + 0.32, orb.z]} fontSize={0.1} color="#a5f3fc" anchorX="center" anchorY="middle">
        {pulse.label}
      </Text>
    </group>
  );
}

function CameraLerpController({
  targetId,
  focusNonce,
  buildings,
  controlsRef,
}: {
  targetId: string | null;
  focusNonce: number;
  buildings: CityBuilding[];
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}) {
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const targetCameraRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);
  const targetZoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!targetId || !cameraRef.current) return;
    const building = buildings.find((item) => item.id === targetId);
    const controls = controlsRef.current;
    if (!building || !controls) return;

    const cam = cameraRef.current;
    const focusTarget = new THREE.Vector3(building.position[0], building.height * 0.6, building.position[2]);
    focusTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), ISO_ROTATION);

    const currentTarget = controls.target.clone();
    const offset = cam.position.clone().sub(currentTarget);

    targetLookAtRef.current = focusTarget;
    targetCameraRef.current = focusTarget.clone().add(offset);
    targetZoomRef.current = clamp(cam.zoom + 8, 34, 72);
  }, [buildings, controlsRef, focusNonce, targetId]);

  useFrame((_, delta) => {
    const cam = cameraRef.current;
    const controls = controlsRef.current;
    const targetCamera = targetCameraRef.current;
    const targetLookAt = targetLookAtRef.current;
    const targetZoom = targetZoomRef.current;

    if (!cam || !controls || !targetCamera || !targetLookAt || targetZoom === null) return;

    const step = 1 - Math.exp(-delta * 6.4);
    cam.position.lerp(targetCamera, step);
    controls.target.lerp(targetLookAt, step);
    cam.zoom = THREE.MathUtils.lerp(cam.zoom, targetZoom, Math.min(0.22, step + 0.04));
    cam.updateProjectionMatrix();
    controls.update();

    const done =
      cam.position.distanceTo(targetCamera) < 0.08 &&
      controls.target.distanceTo(targetLookAt) < 0.08 &&
      Math.abs(cam.zoom - targetZoom) < 0.14;

    if (done) {
      targetCameraRef.current = null;
      targetLookAtRef.current = null;
      targetZoomRef.current = null;
    }
  });

  return (
    <OrthographicCamera
      makeDefault
      ref={(cam) => {
        cameraRef.current = cam;
      }}
      position={[36, 36, 36]}
      zoom={42}
      near={0.1}
      far={260}
    />
  );
}

function CityScene({
  buildings,
  selectedId,
  onSelect,
  beacons,
  selectedListingId,
  onOpenListing,
  tradePulse,
  cameraTargetId,
  cameraFocusNonce,
}: {
  buildings: CityBuilding[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  beacons: ListingBeacon[];
  selectedListingId: string | null;
  onOpenListing: (listingId: string) => void;
  tradePulse: TradePulse | null;
  cameraTargetId: string | null;
  cameraFocusNonce: number;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      dpr={[1, 1.45]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      className="h-full w-full touch-none"
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#010104"]} />
      <fog attach="fog" args={["#010104", 30, 170]} />

      <CameraLerpController
        targetId={cameraTargetId}
        focusNonce={cameraFocusNonce}
        buildings={buildings}
        controlsRef={controlsRef}
      />

      <ambientLight intensity={0.5} />
      <directionalLight position={[24, 32, 10]} intensity={1.15} color="#60a5fa" />
      <pointLight position={[-20, 14, -12]} intensity={0.58} color="#1d4ed8" />

      <Stars radius={210} depth={120} count={2100} factor={2} saturation={0} fade speed={0.2} />

      <Grid
        position={[0, -0.02, 0]}
        infiniteGrid
        cellSize={1}
        cellThickness={0.5}
        cellColor="#0b1f44"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#1e3a8a"
        fadeDistance={220}
        fadeStrength={1.25}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[480, 480]} />
        <meshStandardMaterial color="#020612" roughness={0.95} metalness={0.06} />
      </mesh>

      <group rotation={[0, ISO_ROTATION, 0]}>
        {buildings.map((building) => (
          <Building
            key={building.id}
            id={building.id}
            position={building.position}
            height={building.height}
            color={building.color}
            style={building.style}
            isFocusing={building.isFocusing}
            focusDomain={building.focusDomain}
            focusProgress={building.focusProgress}
            fragmentEnergy={clamp(building.fragmentCount / 12, 0, 1)}
            hasActiveListing={building.hasListing}
            selected={selectedId === building.id}
            onSelect={(id) => onSelect(id)}
          />
        ))}

        {beacons.map((beacon) => (
          <ListingHologram
            key={beacon.listing.id}
            beacon={beacon}
            selected={selectedListingId === beacon.listing.id}
            onOpen={onOpenListing}
          />
        ))}

        {tradePulse ? <DataLinkFx pulse={tradePulse} /> : null}
      </group>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        enableRotate={false}
        enablePan
        enableZoom
        dampingFactor={0.08}
        zoomSpeed={0.84}
        panSpeed={0.85}
        screenSpacePanning
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        minZoom={18}
        maxZoom={112}
      />
    </Canvas>
  );
}

function rarityValue(rarity: FragmentRarity) {
  if (rarity === "epic") return 4;
  if (rarity === "rare") return 3;
  if (rarity === "uncommon") return 2;
  return 1;
}

export default function MarketPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const setComputeSnapshot = useUserStore((state) => state.setComputeSnapshot);
  const setFragmentsStore = useUserStore((state) => state.setFragments);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [fragments, setFragments] = useState<FragmentRow[]>([]);
  const [listings, setListings] = useState<FragmentListingRow[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [cameraTargetId, setCameraTargetId] = useState<string | null>(null);
  const [cameraFocusNonce, setCameraFocusNonce] = useState(0);
  const [listingFragmentId, setListingFragmentId] = useState<string>("");
  const [listingPrice, setListingPrice] = useState("30");
  const [creatingListing, setCreatingListing] = useState(false);
  const [buyingListingId, setBuyingListingId] = useState<string | null>(null);
  const [tradePulse, setTradePulse] = useState<TradePulse | null>(null);
  const [passportOpen, setPassportOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const refreshAll = useCallback(async () => {
    const [{ data: profileRows, error: profileError }, { data: fragmentRows, error: fragmentError }, { data: listingRows, error: listingError }] =
      await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_fragments").select("*").order("created_at", { ascending: false }),
        supabase.from("fragment_listings").select("*").eq("status", "active").order("created_at", { ascending: false }),
      ]);

    if (profileError) {
      setErrorText("城市节点同步失败，请稍后重试");
    } else {
      setProfiles((profileRows ?? []) as ProfileRow[]);
    }

    if (fragmentError) {
      setToast("碎片仓库同步失败");
    } else {
      setFragments((fragmentRows ?? []) as FragmentRow[]);
    }

    if (listingError) {
      setToast("交易所挂单同步失败");
    } else {
      setListings((listingRows ?? []) as FragmentListingRow[]);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      setErrorText(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        if (!user) {
          setIsAuthenticated(false);
          setSelfId(null);
          setProfiles([]);
          setFragments([]);
          setListings([]);
          setErrorText("请先登录后再访问碎片交易所");
          return;
        }

        setIsAuthenticated(true);
        setSelfId(user.id);

        const displayName = user.email ? user.email.split("@")[0] : null;
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            display_name: displayName,
            avatar_url: "default",
          })
          .eq("id", user.id);

        await refreshAll();
      } catch {
        if (!active) return;
        setErrorText("城市连接波动，正在尝试恢复");
      } finally {
        if (active) {
          setAuthReady(true);
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, [refreshAll, supabase]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const profilesChannel: RealtimeChannel = supabase
      .channel("market:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as ProfileRow;
          if (!oldRow?.id) return;
          setProfiles((current) => current.filter((item) => item.id !== oldRow.id));
          return;
        }

        const next = payload.new as ProfileRow;
        if (!next?.id) return;
        setProfiles((current) => {
          const index = current.findIndex((item) => item.id === next.id);
          if (index < 0) return [...current, next];
          const updated = [...current];
          updated[index] = { ...updated[index], ...next };
          return updated;
        });
      })
      .subscribe();

    const fragmentsChannel: RealtimeChannel = supabase
      .channel("market:fragments")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_fragments" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as FragmentRow;
          if (!oldRow?.id) return;
          setFragments((current) => current.filter((item) => item.id !== oldRow.id));
          return;
        }

        const next = payload.new as FragmentRow;
        if (!next?.id) return;
        setFragments((current) => {
          const index = current.findIndex((item) => item.id === next.id);
          if (index < 0) return [next, ...current];
          const updated = [...current];
          updated[index] = { ...updated[index], ...next };
          return updated;
        });
      })
      .subscribe();

    const listingsChannel: RealtimeChannel = supabase
      .channel("market:listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "fragment_listings" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as FragmentListingRow;
          if (!oldRow?.id) return;
          setListings((current) => current.filter((item) => item.id !== oldRow.id));
          return;
        }

        const next = payload.new as FragmentListingRow;
        if (!next?.id) return;
        setListings((current) => {
          if (next.status !== "active") return current.filter((item) => item.id !== next.id);
          const index = current.findIndex((item) => item.id === next.id);
          if (index < 0) return [next, ...current];
          const updated = [...current];
          updated[index] = { ...updated[index], ...next };
          return updated;
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(profilesChannel);
      void supabase.removeChannel(fragmentsChannel);
      void supabase.removeChannel(listingsChannel);
    };
  }, [isAuthenticated, supabase]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated) return;
    setPassportOpen(false);
  }, [isAuthenticated]);

  const activeListings = useMemo(() => listings.filter((item) => item.status === "active"), [listings]);

  const fragmentById = useMemo(() => {
    const map = new Map<string, FragmentRow>();
    for (const fragment of fragments) map.set(fragment.id, fragment);
    return map;
  }, [fragments]);

  const listingByFragmentId = useMemo(() => {
    const map = new Map<string, FragmentListingRow>();
    for (const listing of activeListings) map.set(listing.fragment_id, listing);
    return map;
  }, [activeListings]);

  const fragmentCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const fragment of fragments) {
      map.set(fragment.user_id, (map.get(fragment.user_id) ?? 0) + 1);
    }
    return map;
  }, [fragments]);

  const listingCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const listing of activeListings) {
      map.set(listing.seller_id, (map.get(listing.seller_id) ?? 0) + 1);
    }
    return map;
  }, [activeListings]);

  const buildings = useMemo(
    () => createBuildings(profiles, nowMs, fragmentCountByUser, listingCountByUser),
    [fragmentCountByUser, listingCountByUser, nowMs, profiles]
  );

  const selectedBuilding = useMemo(() => buildings.find((item) => item.id === selectedId) ?? null, [buildings, selectedId]);
  const selfBuilding = useMemo(() => (selfId ? buildings.find((item) => item.id === selfId) ?? null : null), [buildings, selfId]);
  const selfProfile = useMemo(() => profiles.find((item) => item.id === selfId) ?? null, [profiles, selfId]);
  const selfComputePower = selfProfile ? resolveCompute(selfProfile) : 0;
  const selfTotalComputeMined = selfProfile ? resolveTotalCompute(selfProfile) : selfComputePower;

  const focusCameraOnBuilding = useCallback((buildingId: string) => {
    setCameraTargetId(buildingId);
    setCameraFocusNonce((value) => value + 1);
  }, []);

  const selfFragments = useMemo(() => fragments.filter((item) => item.user_id === selfId), [fragments, selfId]);

  const selfFragmentModels = useMemo(
    () =>
      selfFragments.map(
        (item) =>
          ({
            id: item.id,
            type: item.fragment_type,
            rarity: item.rarity,
            timestamp: item.created_at,
          }) satisfies Fragment
      ),
    [selfFragments]
  );

  const selfUnlisted = useMemo(
    () => selfFragments.filter((fragment) => !listingByFragmentId.has(fragment.id)),
    [listingByFragmentId, selfFragments]
  );

  const selectedListing = useMemo(
    () => activeListings.find((item) => item.id === selectedListingId) ?? null,
    [activeListings, selectedListingId]
  );

  const listingsForSelectedBuilding = useMemo(() => {
    if (!selectedBuilding) return [] as FragmentListingRow[];
    return activeListings.filter((item) => item.seller_id === selectedBuilding.id);
  }, [activeListings, selectedBuilding]);

  const beacons = useMemo(() => {
    const buildingMap = new Map(buildings.map((building) => [building.id, building]));
    const sellerCursor = new Map<string, number>();

    return activeListings
      .map((listing) => {
        const fragment = fragmentById.get(listing.fragment_id);
        const building = buildingMap.get(listing.seller_id);
        if (!fragment || !building) return null;

        const index = sellerCursor.get(listing.seller_id) ?? 0;
        sellerCursor.set(listing.seller_id, index + 1);

        const angle = (index % 6) * (Math.PI / 3);
        const ring = 0.35 + (index % 2) * 0.25;
        const x = building.position[0] + Math.cos(angle) * ring;
        const z = building.position[2] + Math.sin(angle) * ring;

        return {
          listing,
          fragment,
          position: [x, building.height + 0.9 + Math.min(0.4, index * 0.08), z] as [number, number, number],
        } satisfies ListingBeacon;
      })
      .filter((item): item is ListingBeacon => Boolean(item));
  }, [activeListings, buildings, fragmentById]);

  useEffect(() => {
    if (!selfProfile) return;
    setComputeSnapshot(resolveCompute(selfProfile), resolveTotalCompute(selfProfile));
  }, [selfProfile, setComputeSnapshot]);

  useEffect(() => {
    setFragmentsStore(selfFragmentModels);
  }, [selfFragmentModels, setFragmentsStore]);

  useEffect(() => {
    if (!buildings.length) return;
    if (selectedId && buildings.some((item) => item.id === selectedId)) return;
    setSelectedId(selfId && buildings.some((item) => item.id === selfId) ? selfId : buildings[0].id);
  }, [buildings, selectedId, selfId]);

  useEffect(() => {
    if (!tradePulse) return;
    const pulseId = tradePulse.id;
    const startedAt = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = clamp((now - startedAt) / 1200, 0, 1);
      setTradePulse((current) => {
        if (!current || current.id !== pulseId) return current;
        return { ...current, progress };
      });

      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => {
          setTradePulse((current) => (current?.id === pulseId ? null : current));
        }, 360);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [tradePulse]);

  const createListing = async () => {
    if (!isAuthenticated || !selfId) {
      setToast("登录后才能挂单碎片");
      return;
    }
    if (creatingListing) return;

    const fragmentId = listingFragmentId || selfUnlisted[0]?.id;
    if (!fragmentId) {
      setToast("你没有可挂单的碎片");
      return;
    }

    const price = Math.max(1, Math.round(Number.parseInt(listingPrice, 10) || 0));
    if (!Number.isFinite(price) || price <= 0) {
      setToast("请输入有效的算力价格");
      return;
    }

    setCreatingListing(true);
    const { data, error } = await supabase.rpc("create_fragment_listing", {
      p_fragment_id: fragmentId,
      p_price_compute: price,
    });
    setCreatingListing(false);

    if (error) {
      if (error.message.includes("FRAGMENT_ALREADY_LISTED")) {
        setToast("该碎片已在交易所挂单");
      } else {
        setToast(error.message);
      }
      return;
    }

    const listing = (Array.isArray(data) ? data[0] : data) as FragmentListingRow | null;
    if (listing?.id) {
      setListings((current) => [listing, ...current.filter((item) => item.id !== listing.id)]);
      setListingFragmentId("");
      setToast(`挂单成功：${price} 算力`);
    }
  };

  const buySelectedListing = async () => {
    if (!selectedListing || !selfId) {
      setToast("请先选择一个碎片挂单");
      return;
    }
    if (selectedListing.seller_id === selfId) {
      setToast("不能购买自己的碎片");
      return;
    }

    setBuyingListingId(selectedListing.id);
    const { data, error } = await supabase.rpc("buy_fragment_listing", {
      p_listing_id: selectedListing.id,
    });
    setBuyingListingId(null);

    if (error) {
      if (error.message.includes("INSUFFICIENT_COMPUTE")) {
        setToast("算力不足，无法完成购买");
      } else if (error.message.includes("LISTING_NOT_ACTIVE")) {
        setToast("挂单已失效，可能已被抢购");
      } else {
        setToast(error.message);
      }
      return;
    }

    const trade = (Array.isArray(data) ? data[0] : data) as TradeResultRow | null;
    const buyerCompute = Number(trade?.buyer_compute_power);
    if (Number.isFinite(buyerCompute)) {
      const total = selfTotalComputeMined;
      setComputeSnapshot(Math.max(0, Math.round(buyerCompute)), total);
    }

    const sellerId = trade?.seller_id ?? selectedListing.seller_id;
    const sellerBuilding = buildings.find((item) => item.id === sellerId) ?? null;
    const buyerBuilding = buildings.find((item) => item.id === selfId) ?? null;

    if (sellerBuilding && buyerBuilding) {
      const type = trade?.fragment_type ?? "Tech";
      setTradePulse({
        id: Date.now(),
        from: [sellerBuilding.position[0], sellerBuilding.height + 0.9, sellerBuilding.position[2]],
        to: [buyerBuilding.position[0], buyerBuilding.height + 0.9, buyerBuilding.position[2]],
        progress: 0,
        label: `${type} LINK`,
      });
    }

    setSelectedListingId(null);
    setListings((current) => current.filter((item) => item.id !== selectedListing.id));
    setToast("交易达成：算力与碎片所有权已原子交换");
    await refreshAll();
  };

  return (
    <main className="relative min-h-[calc(100dvh-6rem)] overflow-hidden rounded-3xl bg-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(6,182,212,0.24),transparent_36%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.2),transparent_30%),radial-gradient(circle_at_50%_120%,rgba(167,139,250,0.14),transparent_45%)]" />

      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-xs">
        <h1 className="text-sm font-medium tracking-[0.28em] text-cyan-100/85">FRAGMENT EXCHANGE</h1>
        <p className="mt-2 text-xs leading-relaxed text-cyan-100/55">
          碎片挂单将以全息晶体悬浮在建筑上方。购买成功后，算力与碎片所有权会在一次原子事务中完成转移。
        </p>
      </div>

      <div className="h-[calc(100dvh-11rem)] min-h-[32rem] w-full">
        <CityScene
          buildings={buildings}
          selectedId={selectedId}
          onSelect={setSelectedId}
          beacons={beacons}
          selectedListingId={selectedListingId}
          onOpenListing={setSelectedListingId}
          tradePulse={tradePulse}
          cameraTargetId={cameraTargetId}
          cameraFocusNonce={cameraFocusNonce}
        />
      </div>

      {selectedBuilding && isAuthenticated ? (
        <aside className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[calc(100%-1.6rem)] max-w-sm -translate-x-1/2">
          <div className="rounded-2xl bg-black/40 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs tracking-[0.16em] text-cyan-100/75">{selectedBuilding.label}</div>
                <div className="mt-1 text-[11px] text-cyan-100/55">Node ID · {selectedBuilding.id.slice(0, 8)}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selfBuilding) {
                    setSelectedId(selfBuilding.id);
                    focusCameraOnBuilding(selfBuilding.id);
                    setToast("已定位到你的建筑");
                  } else {
                    focusCameraOnBuilding(selectedBuilding.id);
                    setToast("未找到你的建筑，已定位当前节点");
                  }
                }}
                className="pointer-events-auto rounded-md bg-white/10 px-2 py-1 text-[10px] text-cyan-100/80"
              >
                定位到我
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-cyan-100/82">
              <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
                <div className="text-[10px] text-cyan-100/55">算力</div>
                <div className="mt-0.5 font-semibold">{selectedBuilding.computePower}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
                <div className="text-[10px] text-cyan-100/55">碎片</div>
                <div className="mt-0.5 font-semibold">{selectedBuilding.fragmentCount}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
                <div className="text-[10px] text-cyan-100/55">高度</div>
                <div className="mt-0.5 font-semibold">{selectedBuilding.height.toFixed(1)}</div>
              </div>
            </div>

            {selectedBuilding.id === selfId ? (
              <div className="mt-3 rounded-xl border border-cyan-200/15 bg-cyan-400/8 p-3">
                <div className="text-[11px] tracking-[0.12em] text-cyan-100/75">碎片挂单</div>
                {selfUnlisted.length ? (
                  <>
                    <select
                      value={listingFragmentId || selfUnlisted[0]?.id || ""}
                      onChange={(event) => setListingFragmentId(event.target.value)}
                      className="pointer-events-auto mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-xs text-cyan-100 outline-none"
                    >
                      {selfUnlisted
                        .slice()
                        .sort((a, b) => {
                          const diff = rarityValue(b.rarity) - rarityValue(a.rarity);
                          if (diff !== 0) return diff;
                          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                        })
                        .map((fragment) => (
                          <option key={fragment.id} value={fragment.id}>
                            {fragment.fragment_type} · {RARITY_TEXT[fragment.rarity]}
                          </option>
                        ))}
                    </select>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={listingPrice}
                        onChange={(event) => setListingPrice(event.target.value)}
                        inputMode="numeric"
                        className="pointer-events-auto w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-xs text-cyan-100 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void createListing()}
                        disabled={creatingListing}
                        className="pointer-events-auto flex-1 rounded-lg bg-cyan-400/25 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-45"
                      >
                        {creatingListing ? "挂单中..." : "挂单碎片"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-[11px] text-cyan-100/58">暂无可挂单碎片（已全部挂单或尚未挖到）</div>
                )}
              </div>
            ) : listingsForSelectedBuilding.length ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] tracking-[0.12em] text-cyan-100/75">该节点挂单</div>
                <div className="mt-2 grid gap-1.5">
                  {listingsForSelectedBuilding.slice(0, 4).map((listing) => {
                    const fragment = fragmentById.get(listing.fragment_id);
                    if (!fragment) return null;
                    return (
                      <button
                        key={listing.id}
                        type="button"
                        onClick={() => setSelectedListingId(listing.id)}
                        className="pointer-events-auto flex items-center justify-between rounded-lg bg-black/35 px-2.5 py-2 text-left"
                      >
                        <span className="text-xs text-cyan-100/85">
                          {fragment.fragment_type} · {RARITY_TEXT[fragment.rarity]}
                        </span>
                        <span className="text-xs text-cyan-100/75">{listing.price_compute} 算力</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      {selfId && isAuthenticated ? (
        <div className="pointer-events-none absolute right-3 top-20 z-20 flex w-[calc(100%-1.5rem)] max-w-[20rem] flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setPassportOpen((value) => !value)}
            className="pointer-events-auto rounded-xl border border-cyan-200/25 bg-black/50 px-3 py-2 text-[11px] tracking-[0.1em] text-cyan-100/85 backdrop-blur-xl"
          >
            {passportOpen ? "收起 PASSPORT" : "打开 PASSPORT"}
          </button>
          <AnimatePresence>
            {passportOpen ? (
              <motion.aside
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="pointer-events-auto w-full"
              >
                <MetaPassport
                  fragments={selfFragmentModels}
                  computePower={selfComputePower}
                  totalComputeMined={selfTotalComputeMined}
                />
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      <AnimatePresence>
        {selectedListing && isAuthenticated ? (
          <motion.aside
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="pointer-events-auto absolute left-1/2 top-[15%] z-30 w-[calc(100%-1.6rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-black/62 p-4 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-[0.16em] text-cyan-100/80">碎片购买确认</div>
              <button
                type="button"
                onClick={() => setSelectedListingId(null)}
                className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-cyan-100/80"
              >
                关闭
              </button>
            </div>

            {(() => {
              const fragment = fragmentById.get(selectedListing.fragment_id);
              if (!fragment) return <div className="mt-3 text-xs text-cyan-100/60">碎片信息同步中...</div>;

              return (
                <>
                  <div className="mt-3 rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-sm text-cyan-100">
                      {fragment.fragment_type} · {RARITY_TEXT[fragment.rarity]} 碎片
                    </div>
                    <div className="mt-1 text-[11px] text-cyan-100/60">卖家节点：{selectedListing.seller_id.slice(0, 8)}</div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-cyan-400/12 px-3 py-2 text-xs text-cyan-100">
                    <span>购买价格</span>
                    <span>{selectedListing.price_compute} 算力</span>
                  </div>
                  <div className="mt-1 text-[11px] text-cyan-100/55">当前余额：{selfComputePower} 算力</div>

                  <button
                    type="button"
                    disabled={buyingListingId === selectedListing.id || selectedListing.seller_id === selfId}
                    onClick={() => void buySelectedListing()}
                    className="mt-3 w-full rounded-xl bg-cyan-400/25 px-3 py-2.5 text-sm font-medium text-cyan-100 disabled:opacity-45"
                  >
                    {selectedListing.seller_id === selfId
                      ? "这是你的挂单"
                      : buyingListingId === selectedListing.id
                        ? "交易执行中..."
                        : "确认购买"}
                  </button>
                </>
              );
            })()}
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {authReady && !isAuthenticated ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 backdrop-blur-[2px]">
          <div className="mx-4 w-full max-w-sm rounded-3xl border border-cyan-200/20 bg-[linear-gradient(160deg,rgba(255,255,255,0.15),rgba(255,255,255,0.04))] p-5 backdrop-blur-2xl">
            <div className="text-sm tracking-[0.14em] text-cyan-100">访问交易所前需要登录</div>
            <div className="mt-2 text-xs leading-relaxed text-cyan-100/70">
              登录后会自动同步你的碎片库存、算力余额与历史总产量。
            </div>
            <button
              type="button"
              onClick={() => router.push("/login?redirectTo=/market")}
              className="mt-4 w-full rounded-xl bg-cyan-400/25 px-4 py-2.5 text-sm font-medium text-cyan-100"
            >
              前往登录节点
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute right-4 top-[23.5rem] z-10 rounded-xl bg-black/40 px-3 py-2 text-xs text-cyan-100/70 backdrop-blur">
          正在同步碎片交易所...
        </div>
      ) : null}

      {errorText ? (
        <div className="pointer-events-none absolute right-4 top-[26.5rem] z-10 rounded-xl bg-rose-900/35 px-3 py-2 text-xs text-rose-100/85 backdrop-blur">
          {errorText}
        </div>
      ) : null}

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-1/2 top-4 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-black/60 px-4 py-2.5 text-center text-xs text-cyan-100 backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
