"use client";

import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Camera, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type CameraState = "pending" | "granted" | "denied" | "unsupported";

type DetectableTarget = {
  id: string;
  title: string;
};

type DetectionBox = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  targetId: string | null;
};

const fallbackLabels = [
  "节点活动痕迹",
  "低频资源信号",
  "协作意图聚集区",
  "潜在交易链路",
];

function randomRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function ScanClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("pending");
  const [targets, setTargets] = useState<DetectableTarget[]>([]);
  const [boxes, setBoxes] = useState<DetectionBox[]>([]);

  useEffect(() => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      return;
    }

    let mounted = true;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }

        setCameraState("granted");
      } catch {
        if (!mounted) return;
        setCameraState("denied");
      }
    };

    void start();

    return () => {
      mounted = false;
      const stream = streamRef.current;
      streamRef.current = null;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const loadTargets = async () => {
      const { data } = await supabase
        .from("market_items")
        .select("id,title,status")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(16);

      const rows = (data ?? []) as Array<{ id: string; title: string }>;
      setTargets(rows.map((item) => ({ id: item.id, title: item.title })));
    };

    void loadTargets();
  }, [supabase]);

  useEffect(() => {
    const tick = setInterval(() => {
      const width = randomRange(26, 42);
      const height = randomRange(14, 24);
      const left = randomRange(4, 96 - width);
      const top = randomRange(12, 90 - height);

      const chosen =
        targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : null;
      const distance = Math.round(randomRange(8, 90));
      const label = chosen
        ? `距离 ${distance}m: ${chosen.title}`
        : fallbackLabels[Math.floor(Math.random() * fallbackLabels.length)];

      const box: DetectionBox = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        left,
        top,
        width,
        height,
        label,
        targetId: chosen?.id ?? null,
      };

      setBoxes((prev) => [...prev.slice(-3), box]);

      setTimeout(() => {
        setBoxes((prev) => prev.filter((item) => item.id !== box.id));
      }, 7000);
    }, 2400);

    return () => clearInterval(tick);
  }, [targets]);

  const cameraMessage =
    cameraState === "pending"
      ? "正在请求摄像头权限..."
      : cameraState === "denied"
      ? "摄像头权限被拒绝，已切换到雷达模拟背景"
      : cameraState === "unsupported"
      ? "当前设备不支持摄像头访问，已启用雷达背景"
      : "后置摄像头在线，正在进行环境扫描";

  return (
    <main className="fixed inset-0 z-[90] overflow-hidden bg-slate-950 text-cyan-100">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      {cameraState !== "granted" ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22)_0%,rgba(2,6,23,0.96)_58%)]">
          <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/35" />
          <div className="absolute left-1/2 top-1/2 h-[52vmin] w-[52vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30 animate-[radarPulse_2.8s_ease-out_infinite]" />
          <div className="absolute left-1/2 top-1/2 h-[34vmin] w-[34vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/25" />
          <div className="absolute left-1/2 top-1/2 h-[2px] w-[60vmin] -translate-x-1/2 -translate-y-1/2 origin-left bg-gradient-to-r from-cyan-300/0 via-cyan-300/75 to-cyan-300/0 animate-[spin_4s_linear_infinite]" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/55" />
      )}

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-4 top-4 h-10 w-10 border-l-2 border-t-2 border-cyan-300/80" />
        <div className="absolute right-4 top-4 h-10 w-10 border-r-2 border-t-2 border-cyan-300/80" />
        <div className="absolute bottom-24 left-4 h-10 w-10 border-b-2 border-l-2 border-cyan-300/80" />
        <div className="absolute bottom-24 right-4 h-10 w-10 border-b-2 border-r-2 border-cyan-300/80" />

        <div className="absolute left-1/2 top-[16%] h-[56%] w-[2px] -translate-x-1/2 bg-gradient-to-b from-cyan-300/0 via-cyan-300/75 to-cyan-300/0 animate-[scanline_2.2s_ease-in-out_infinite_alternate]" />
      </div>

      {boxes.map((box) => (
        <button
          key={box.id}
          type="button"
          onClick={() => {
            if (box.targetId) {
              router.push(`/market?highlight=${box.targetId}`);
              return;
            }
            router.push("/market");
          }}
          className="absolute z-[95] rounded-sm border border-cyan-300/85 bg-cyan-300/10 shadow-[0_0_18px_rgba(34,211,238,0.6)] transition-transform active:scale-95"
          style={{
            left: `${box.left}%`,
            top: `${box.top}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
          }}
        >
          <span className="absolute -top-6 left-0 whitespace-nowrap rounded-sm border border-cyan-300/45 bg-slate-950/75 px-2 py-0.5 text-[10px] text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.35)]">
            {box.label}
          </span>
        </button>
      ))}

      <header className="absolute inset-x-0 top-0 z-[100] flex items-center justify-between px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-slate-950/45 px-3 py-2 text-xs text-cyan-100 backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </button>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-slate-950/45 px-3 py-2 text-xs text-cyan-100 backdrop-blur">
          <Radar className="h-4 w-4" /> 扫描中
        </div>
      </header>

      <footer className="absolute inset-x-0 bottom-0 z-[100] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <div className="rounded-2xl border border-cyan-300/30 bg-slate-950/55 p-3 text-xs text-cyan-100/90 backdrop-blur">
          <div className="inline-flex items-center gap-2 font-medium">
            <Camera className="h-4 w-4" /> {cameraMessage}
          </div>
          <p className="mt-1 text-cyan-100/70">点击目标框可跳转集市并定位对应帖子。</p>
        </div>
      </footer>
    </main>
  );
}
