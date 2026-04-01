import { NextResponse } from "next/server";

type InputMode = "text" | "voice" | "image";

type SentienceResponse = {
  emotion: "joy" | "calm" | "focus" | "anxious" | "sad" | "anger" | "surprise" | "neutral";
  valence: number;
  arousal: number;
  confidence: number;
  keywords: string[];
  summary: string;
  source: "doubao" | "fallback";
};

const EMOTIONS: Array<SentienceResponse["emotion"]> = [
  "joy",
  "calm",
  "focus",
  "anxious",
  "sad",
  "anger",
  "surprise",
  "neutral",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanupText(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function extractJson(raw: string) {
  const fenceJson = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenceJson?.[1]) return fenceJson[1].trim();

  const fenceAny = raw.match(/```([\s\S]*?)```/);
  const source = fenceAny?.[1] ? fenceAny[1].trim() : raw.trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) return source.slice(start, end + 1);
  return source;
}

function normalizeResult(input: Partial<SentienceResponse>, source: SentienceResponse["source"]): SentienceResponse {
  const emotion = EMOTIONS.includes(input.emotion as SentienceResponse["emotion"])
    ? (input.emotion as SentienceResponse["emotion"])
    : "neutral";

  const keywords = Array.isArray(input.keywords)
    ? input.keywords
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanupText(item))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    emotion,
    valence: clamp(asNumber(input.valence, 0), -1, 1),
    arousal: clamp(asNumber(input.arousal, 0.5), 0, 1),
    confidence: clamp(asNumber(input.confidence, 0.55), 0, 1),
    keywords,
    summary: cleanupText(input.summary || "星核已接收输入，正在进行情绪共振。"),
    source,
  };
}

function fallbackAnalyze(text: string, mode: InputMode): SentienceResponse {
  const lower = text.toLowerCase();
  const positive = ["开心", "兴奋", "进展", "突破", "赞", "喜欢", "快乐", "love", "great", "awesome"];
  const negative = ["焦虑", "烦", "累", "痛苦", "崩溃", "难受", "angry", "sad", "tired", "stress"];
  const focus = ["专注", "学习", "训练", "模型", "论文", "写代码", "debug", "optimize", "research"];
  const surprise = ["震惊", "惊喜", "没想到", "突然", "wow", "unexpected"];

  const positiveHits = positive.reduce((sum, key) => sum + (lower.includes(key) ? 1 : 0), 0);
  const negativeHits = negative.reduce((sum, key) => sum + (lower.includes(key) ? 1 : 0), 0);
  const focusHits = focus.reduce((sum, key) => sum + (lower.includes(key) ? 1 : 0), 0);
  const surpriseHits = surprise.reduce((sum, key) => sum + (lower.includes(key) ? 1 : 0), 0);

  let emotion: SentienceResponse["emotion"] = "neutral";
  if (surpriseHits > 0) emotion = "surprise";
  else if (focusHits > 0) emotion = "focus";
  else if (negativeHits > positiveHits && negativeHits > 0) emotion = "anxious";
  else if (positiveHits > negativeHits && positiveHits > 0) emotion = "joy";
  else if (mode === "voice") emotion = "calm";

  const valence = clamp((positiveHits - negativeHits) * 0.25, -1, 1);
  const arousal = clamp(
    0.35 + Math.min(0.5, (positiveHits + negativeHits + focusHits + surpriseHits) * 0.1),
    0,
    1
  );
  const confidence = clamp(0.45 + Math.min(0.45, (positiveHits + negativeHits + focusHits + surpriseHits) * 0.08), 0, 1);

  const words = cleanupText(text)
    .split(" ")
    .filter((item) => item.length > 1)
    .slice(0, 6);

  return normalizeResult(
    {
      emotion,
      valence,
      arousal,
      confidence,
      keywords: words.length ? words : mode === "image" ? ["视觉输入", "情绪映射"] : ["情绪脉冲"],
      summary:
        mode === "image"
          ? "视觉样本已注入，星核正在重组纹理与能级。"
          : "输入信号已写入星核，情绪波形完成一次共振采样。",
    },
    "fallback"
  );
}

async function analyzeWithDoubao(params: {
  text: string;
  mode: InputMode;
  imageDataUrl?: string | null;
}): Promise<SentienceResponse> {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error("missing_doubao_key");
  }

  const baseUrl = (process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, "");
  const model = process.env.DOUBAO_MODEL || "doubao-1.5-lite-32k-250115";

  const systemPrompt =
    "你是数字生命情绪引擎。只输出JSON，不要解释。字段必须包含：emotion, valence, arousal, confidence, keywords, summary。emotion只能是joy/calm/focus/anxious/sad/anger/surprise/neutral。";

  const taskPrompt =
    "请根据输入做情绪分析：valence范围[-1,1]，arousal/confidence范围[0,1]，keywords最多6个短词，summary一句话（不超过30字）。";

  const userText = cleanupText(params.text || "");
  const content =
    params.mode === "image" && params.imageDataUrl
      ? [
          { type: "text", text: `${taskPrompt}\n输入文本：${userText || "（无）"}` },
          { type: "image_url", image_url: { url: params.imageDataUrl } },
        ]
      : `${taskPrompt}\n输入文本：${userText || "（无）"}\n输入模式：${params.mode}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 320,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`doubao_http_${response.status}:${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };

  const rawContent = payload.choices?.[0]?.message?.content;
  const textContent =
    typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent
            .map((item) => (typeof item?.text === "string" ? item.text : ""))
            .join(" ")
            .trim()
        : "";

  const parsed = JSON.parse(extractJson(textContent || "{}")) as Partial<SentienceResponse>;
  return normalizeResult(parsed, "doubao");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text?: string;
      mode?: InputMode;
      imageDataUrl?: string | null;
    };

    const mode: InputMode =
      body.mode === "voice" || body.mode === "image" || body.mode === "text" ? body.mode : "text";
    const text = cleanupText(body.text || "");
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : null;

    const result = await analyzeWithDoubao({ text, mode, imageDataUrl }).catch(() =>
      fallbackAnalyze(text, mode)
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(fallbackAnalyze("", "text"));
  }
}
