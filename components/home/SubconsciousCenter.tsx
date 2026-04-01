"use client";

import EnergyLifeCore from "@/components/home/EnergyLifeCore";
import { type Fragment, type FragmentType, useUserStore } from "@/store/useUserStore";
import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import { AudioLines, ImagePlus, Mic, SendHorizontal, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type InputMode = "text" | "voice" | "image";

type Sentience = {
  emotion: "joy" | "calm" | "focus" | "anxious" | "sad" | "anger" | "surprise" | "neutral";
  valence: number;
  arousal: number;
  confidence: number;
  keywords: string[];
  summary: string;
  source: "doubao" | "fallback";
};

type SignalPulse = {
  id: number;
  mode: InputMode;
  summary: string;
  keywords: string[];
  timestamp: number;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultItemLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  length: number;
  [index: number]: SpeechRecognitionResultItemLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  SpeechRecognition?: SpeechRecognitionCtor;
};

const EMOTION_THEME: Record<Sentience["emotion"], { glow: string; label: string }> = {
  joy: { glow: "#f59e0b", label: "兴奋" },
  calm: { glow: "#22d3ee", label: "平稳" },
  focus: { glow: "#38bdf8", label: "专注" },
  anxious: { glow: "#f97316", label: "焦虑" },
  sad: { glow: "#6366f1", label: "低落" },
  anger: { glow: "#ef4444", label: "高压" },
  surprise: { glow: "#a855f7", label: "惊异" },
  neutral: { glow: "#67e8f9", label: "中性" },
};

const TYPE_THEME: Record<FragmentType, { base: string; glow: string }> = {
  Tech: { base: "#0d1f3d", glow: "#38bdf8" },
  Academic: { base: "#1b133a", glow: "#a78bfa" },
  Engine: { base: "#2a1609", glow: "#fb923c" },
};

const SIGNAL_PRESETS = ["把今天最关键任务压缩成 3 条", "我现在卡在哪一步？", "根据这段输入给我下一步行动"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanupText(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function countByType(fragments: Fragment[]) {
  const map = { Tech: 0, Academic: 0, Engine: 0 };
  for (const fragment of fragments) map[fragment.type] += 1;
  return map;
}

function dominantType(fragments: Fragment[]): FragmentType {
  const counts = countByType(fragments);
  if (counts.Academic >= counts.Tech && counts.Academic >= counts.Engine) return "Academic";
  if (counts.Engine >= counts.Tech && counts.Engine >= counts.Academic) return "Engine";
  return "Tech";
}

function fallbackSentience(text: string, mode: InputMode): Sentience {
  const normalized = text.toLowerCase();
  const focusHit = ["专注", "学习", "模型", "训练", "debug", "论文"].some((key) => normalized.includes(key));
  const joyHit = ["开心", "兴奋", "突破", "喜欢", "great", "awesome"].some((key) => normalized.includes(key));
  const anxiousHit = ["焦虑", "烦", "累", "崩", "stress", "tired"].some((key) => normalized.includes(key));

  const emotion: Sentience["emotion"] = focusHit ? "focus" : joyHit ? "joy" : anxiousHit ? "anxious" : mode === "voice" ? "calm" : "neutral";

  return {
    emotion,
    valence: joyHit ? 0.45 : anxiousHit ? -0.35 : 0.12,
    arousal: focusHit ? 0.72 : joyHit ? 0.66 : anxiousHit ? 0.58 : 0.42,
    confidence: 0.55,
    keywords: cleanupText(text)
      .split(/[\s,，。;；、]+/)
      .filter((item) => item.length > 1)
      .slice(0, 5),
    summary: mode === "image" ? "视觉样本已注入，星核纹理正在重构。" : "信号接入完成，星核已更新当前情绪光谱。",
    source: "fallback",
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("文件读取失败"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function formatTime(ts: number) {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function SubconsciousCenter() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [draft, setDraft] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [lastMode, setLastMode] = useState<InputMode>("text");
  const [analyzing, setAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [typingIntensity, setTypingIntensity] = useState(0);
  const [impactPulse, setImpactPulse] = useState(0);
  const [status, setStatus] = useState("星核已待机，输入任意信号开始唤醒。");
  const [sentience, setSentience] = useState<Sentience>({
    emotion: "neutral",
    valence: 0,
    arousal: 0.45,
    confidence: 0.55,
    keywords: [],
    summary: "星核已待机，输入任意信号开始唤醒。",
    source: "fallback",
  });
  const [pulse, setPulse] = useState<SignalPulse | null>(null);

  const computePower = useUserStore((state) => state.computePower);
  const totalComputeMined = useUserStore((state) => state.totalComputeMined);
  const fragments = useUserStore((state) => state.fragments);
  const mindTags = useUserStore((state) => state.mindTags);
  const addMindTag = useUserStore((state) => state.addMindTag);

  const fluxBar = useSpring(0, { stiffness: 220, damping: 28, mass: 0.26 });
  const fluxWidth = useTransform(fluxBar, (v) => `${Math.round(v * 100)}%`);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const fluctuation = computePower * (1 + Math.sin(now * 0.0042) * 0.03 + Math.sin(now * 0.009 + 1.4) * 0.014);
      fluxBar.set(clamp(fluctuation / 1400, 0, 1));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [computePower, fluxBar]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTypingIntensity((prev) => Math.max(0, prev * 0.84 - 0.008));
      setImpactPulse((prev) => Math.max(0, prev * 0.88 - 0.01));
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setDraft(cleanupText(transcript));
      setLastMode("voice");
      setTypingIntensity((prev) => Math.max(prev, 0.85));
    };

    recognition.onerror = (event) => {
      const errorLabel = cleanupText(event.error || "unknown");
      setStatus(`语音采样中断(${errorLabel})，请重试。`);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const fragmentStats = useMemo(() => {
    const counts = countByType(fragments);
    const rareCount = fragments.filter((fragment) => fragment.rarity === "rare" || fragment.rarity === "epic").length;
    return { ...counts, total: fragments.length, rareCount };
  }, [fragments]);

  const dominant = useMemo(() => dominantType(fragments), [fragments]);

  const palette = useMemo(() => {
    const core = TYPE_THEME[dominant];
    const emotionGlow = EMOTION_THEME[sentience.emotion].glow;
    return { base: core.base, glow: emotionGlow || core.glow };
  }, [dominant, sentience.emotion]);

  const growth = useMemo(() => {
    const pulseGrowth = pulse ? 0.04 : 0;
    const fragmentGrowth = fragmentStats.total * 0.035;
    const rareGrowth = fragmentStats.rareCount * 0.06;
    return clamp(0.12 + pulseGrowth + fragmentGrowth + rareGrowth, 0, 1);
  }, [fragmentStats.rareCount, fragmentStats.total, pulse]);

  const inputRipple = useMemo(
    () => clamp(typingIntensity + sentience.arousal * 0.9 + fragmentStats.total * 0.018, 0, 2.6),
    [fragmentStats.total, sentience.arousal, typingIntensity]
  );

  const impact = useMemo(
    () => clamp(impactPulse + sentience.confidence * 0.9 + fragmentStats.rareCount * 0.08, 0, 2.4),
    [fragmentStats.rareCount, impactPulse, sentience.confidence]
  );

  const orbitTexts = useMemo(() => {
    const fragmentTokens = fragments.slice(0, 10).map((fragment) => `${fragment.type}-${fragment.rarity.toUpperCase()}`);
    const emotionTokens = sentience.keywords.slice(0, 8);

    const combined = [...emotionTokens, ...fragmentTokens, ...mindTags]
      .map((text) => cleanupText(text))
      .filter(Boolean);

    const deduped: string[] = [];
    for (const item of combined) {
      if (!deduped.includes(item)) deduped.push(item);
      if (deduped.length >= 18) break;
    }

    return deduped;
  }, [fragments, mindTags, sentience.keywords]);

  const submitSignal = async () => {
    if (analyzing) return;

    const text = cleanupText(draft);
    if (!text && !imageDataUrl) {
      setStatus("输入一段文字，或附加语音/图像后再注入。");
      return;
    }

    const mode: InputMode = imageDataUrl ? "image" : lastMode;

    setAnalyzing(true);
    setStatus("正在调用情绪引擎，解析输入信号...");

    try {
      const response = await fetch("/api/sentience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text,
          imageDataUrl,
        }),
      });

      const payload = (await response.json()) as Sentience;
      const analysis = response.ok ? payload : fallbackSentience(text, mode);

      setSentience(analysis);
      setTypingIntensity((prev) => Math.max(prev, 0.45 + analysis.arousal * 1.25));
      setImpactPulse((prev) => Math.max(prev, 0.4 + analysis.confidence * 1.3));
      setPulse({
        id: Date.now(),
        mode,
        summary: analysis.summary,
        keywords: analysis.keywords,
        timestamp: Date.now(),
      });

      analysis.keywords.forEach((keyword) => addMindTag(keyword));
      if (text) addMindTag(text.length > 12 ? text.slice(0, 12) : text);

      setStatus(analysis.summary);
      setDraft("");
      setImageDataUrl(null);
      setImageName("");
      setLastMode("text");
    } catch {
      const fallback = fallbackSentience(text, mode);
      setSentience(fallback);
      setTypingIntensity((prev) => Math.max(prev, 0.72));
      setImpactPulse((prev) => Math.max(prev, 0.76));
      setStatus("情绪引擎网络抖动，已启用本地感知模式。");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleVoice = () => {
    if (!voiceSupported || !recognitionRef.current) {
      setStatus("当前设备不支持语音识别，请改用文字输入。");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setStatus("语音采样已暂停，点击发送注入星核。");
      return;
    }

    try {
      setDraft("");
      setLastMode("voice");
      recognitionRef.current.start();
      setIsListening(true);
      setStatus("语音采样中，请自然说话...");
    } catch {
      setStatus("语音设备初始化失败，请重试。");
      setIsListening(false);
    }
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageName(file.name);
      setLastMode("image");
      setTypingIntensity((prev) => Math.max(prev, 0.62));
      setStatus("图像样本已挂载，可直接发送。");
    } catch {
      setStatus("图像读取失败，请换一张图片。");
    }
  };

  const emotionTheme = EMOTION_THEME[sentience.emotion];

  return (
    <section className="relative flex min-h-[calc(100dvh-7.2rem)] flex-col overflow-hidden pb-[calc(8.2rem+env(safe-area-inset-bottom))] pt-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(20,184,166,0.18),rgba(59,130,246,0.14)_28%,rgba(0,0,0,0)_68%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="pointer-events-none absolute left-3 top-3 z-20">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/70">Core Compute</div>
        <div className="mt-1 font-mono text-2xl font-light text-cyan-50/90">{computePower}</div>
        <div className="relative mt-2 h-[2px] w-32 overflow-hidden bg-cyan-300/20">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[linear-gradient(90deg,rgba(56,189,248,0.4),rgba(103,232,249,0.95),rgba(34,211,238,0.4))]"
            style={{ width: fluxWidth }}
          />
        </div>
        <div className="mt-1 font-mono text-[10px] text-cyan-100/45">total mined {totalComputeMined}</div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-20 text-right">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-100/70">Fragment Sync</div>
        <div className="mt-1 font-mono text-2xl font-light text-violet-100/88">{fragmentStats.total}</div>
        <div className="mt-1 text-[10px] text-violet-100/60">T {fragmentStats.Tech} · A {fragmentStats.Academic} · E {fragmentStats.Engine}</div>
      </div>

      <div className="relative z-10 mx-auto mt-12 w-full max-w-[28rem]">
        <EnergyLifeCore
          inputIntensity={inputRipple}
          impactPulse={impact}
          orbitTexts={orbitTexts}
          baseColor={palette.base}
          glowColor={palette.glow}
          growth={growth}
          emotion={sentience.emotion}
          arousal={sentience.arousal}
          confidence={sentience.confidence}
          fragmentCount={fragmentStats.total}
        />

        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] tracking-[0.18em] text-cyan-100/85">
          {emotionTheme.label} · confidence {Math.round(sentience.confidence * 100)}%
        </div>

        <div className="pointer-events-none absolute left-1/2 top-[6rem] -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-cyan-100/75">
          growth {Math.round(growth * 100)}% · arousal {Math.round(sentience.arousal * 100)}%
        </div>
      </div>

      <AnimatePresence>
        {pulse ? (
          <motion.div
            key={pulse.id}
            initial={{ opacity: 0, y: 8, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(5px)" }}
            className="relative z-10 mx-auto mt-3 w-full max-w-[32rem] rounded-2xl border border-cyan-200/20 bg-black/30 px-4 py-3 backdrop-blur-xl"
          >
            <div className="text-xs text-cyan-100/75">{pulse.summary}</div>
            <div className="mt-1 text-[10px] text-cyan-100/55">{pulse.keywords.join(" · ") || "情绪波形已更新"} · {formatTime(pulse.timestamp)}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 mt-auto">
        <motion.div
          className="mx-auto w-full max-w-[34rem] rounded-3xl border border-cyan-200/20 bg-[linear-gradient(165deg,rgba(15,23,42,0.78),rgba(15,23,42,0.52))] p-4 backdrop-blur-2xl"
          animate={{
            boxShadow: [
              "0 0 0 rgba(0,0,0,0)",
              `0 0 ${14 + inputRipple * 14}px ${emotionTheme.glow}44`,
              "0 0 0 rgba(0,0,0,0)",
            ],
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] tracking-[0.18em] text-cyan-100/65">LIFE LINK DOCK</div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] text-cyan-100/65">
              {sentience.source === "doubao" ? "Doubao" : "Fallback"}
            </div>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {SIGNAL_PRESETS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setDraft(prompt);
                  setLastMode("text");
                  setTypingIntensity((prev) => Math.max(prev, 0.55));
                }}
                className="rounded-full border border-cyan-100/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] text-cyan-100/75"
              >
                {prompt}
              </button>
            ))}
          </div>

          {imageDataUrl ? (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-cyan-200/20 bg-black/35 p-2">
              <div className="h-10 w-14 overflow-hidden rounded-md border border-cyan-200/20">
                <Image src={imageDataUrl} alt="sample" width={120} height={80} unoptimized className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 truncate text-[11px] text-cyan-100/70">图像样本：{imageName || "未命名图片"}</div>
              <button
                type="button"
                onClick={() => {
                  setImageDataUrl(null);
                  setImageName("");
                  setLastMode("text");
                }}
                className="grid h-7 w-7 place-items-center rounded-md border border-white/15 bg-black/40 text-cyan-100/70"
                aria-label="移除图像"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-2xl border border-cyan-100/20 bg-black/35 px-2 py-2">
            <input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setLastMode("text");
                setTypingIntensity((prev) => Math.max(prev, 0.45 + event.target.value.length / 120));
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void submitSignal();
              }}
              placeholder="输入文字，或附加语音/图像后发送给星核"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-cyan-50 placeholder:text-cyan-100/35 outline-none"
            />

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void onPickImage(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/5 text-cyan-100/75"
              aria-label="上传图像"
            >
              <ImagePlus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleVoice}
              className={`grid h-9 w-9 place-items-center rounded-xl border ${
                isListening ? "border-rose-300/45 bg-rose-500/20 text-rose-100" : "border-white/15 bg-white/5 text-cyan-100/75"
              }`}
              aria-label="语音输入"
            >
              {isListening ? <AudioLines className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              type="button"
              disabled={analyzing}
              onClick={() => void submitSignal()}
              className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/35 bg-cyan-400/20 text-cyan-100 disabled:opacity-55"
              aria-label="发送"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-cyan-100/62">
            <div className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              {status}
            </div>
            <div>{voiceSupported ? (isListening ? "语音采样中" : "语音可用") : "语音不可用"}</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
