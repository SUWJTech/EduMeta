export const FIELD_LABELS = [
  "逆向生长",
  "拓扑碎裂",
  "极坐标流体",
  "多维折叠",
  "流形拉伸",
  "涡旋簇",
  "脉冲星桥",
  "相位剪切",
  "双曲回响",
  "奇点吸积",
  "晶格风暴",
  "环面切片",
  "折叠脊线",
  "噪声羽化",
  "曲率爆发",
  "量子雨滴",
  "离散重组",
  "逆熵坍缩",
  "三轴涡流",
  "潮汐堆叠",
  "反向断层",
  "磁层漂移",
  "折返波前",
  "微分扭结",
  "星核涌泉",
  "隐形轮辐",
  "回旋迷宫",
  "层流折射",
  "裂缝缝合",
  "维度潮汐",
];

const EMOTION_FIELD_BASE = {
  joy: 7,
  calm: 2,
  focus: 0,
  anxious: 10,
  sad: 17,
  anger: 20,
  surprise: 24,
  neutral: 4,
};

export function mapEmotionToField(emotion, fragmentCount = 0) {
  const base = EMOTION_FIELD_BASE[emotion] ?? EMOTION_FIELD_BASE.neutral;
  return (base + Math.max(0, fragmentCount)) % FIELD_LABELS.length;
}

export const VECTOR_FIELD_GLSL = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z) * 2.0 - 1.0;
}

float noise4(vec4 p) {
  return noise3(p.xyz + p.w * vec3(0.173, -0.127, 0.091));
}

float fbm4(vec4 p) {
  float total = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    total += amp * noise4(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return total;
}

vec3 curlNoise(vec3 p, float t) {
  float e = 0.1;
  float n1 = fbm4(vec4(p + vec3(e, 0.0, 0.0), t));
  float n2 = fbm4(vec4(p - vec3(e, 0.0, 0.0), t));
  float n3 = fbm4(vec4(p + vec3(0.0, e, 0.0), t));
  float n4 = fbm4(vec4(p - vec3(0.0, e, 0.0), t));
  float n5 = fbm4(vec4(p + vec3(0.0, 0.0, e), t));
  float n6 = fbm4(vec4(p - vec3(0.0, 0.0, e), t));

  float dx = n1 - n2;
  float dy = n3 - n4;
  float dz = n5 - n6;

  return normalize(vec3(dy - dz, dz - dx, dx - dy) + 1e-5);
}

float sdfSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdfBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

vec3 polarFlow(vec3 p, float t) {
  float angle = atan(p.y, p.x);
  float radius = max(length(p.xy), 0.001);
  float swirl = sin(angle * 6.0 + t * 0.9) * 0.6;
  return vec3(-sin(angle + swirl), cos(angle + swirl), sin(radius * 6.0 - t));
}

vec3 evaluateField(vec3 p, vec3 v, float t, float pinch, float progress, int mode) {
  float s = 0.8 + progress * 1.3;
  vec3 cp = curlNoise(p * (0.7 + pinch * 0.9), t * 0.25);
  float n = fbm4(vec4(p * 1.1, t * 0.22));
  float dSphere = sdfSphere(p, 0.75 + progress * 0.4);
  float dBox = sdfBox(p, vec3(0.6 + pinch * 0.5));

  vec3 a = vec3(0.0);

  if (mode == 0) a = normalize(-p + cp * 0.8) * (1.1 + 0.5 * n);
  else if (mode == 1) a = normalize(vec3(sign(p.x), sign(p.y), sign(p.z)) * (abs(n) + 0.2)) * (1.4 + pinch);
  else if (mode == 2) a = polarFlow(p, t) * 1.2;
  else if (mode == 3) a = vec3(sin(p.y * 5.0 + t), cos(p.z * 5.0 - t), sin(p.x * 5.0 + t * 0.7)) * 0.9;
  else if (mode == 4) a = cp * (1.2 + pinch * 0.5);
  else if (mode == 5) a = vec3(-p.y, p.x, sin(t + p.z * 3.0)) * 0.9;
  else if (mode == 6) a = normalize(vec3(sin(t + p.y * 8.0), cos(t + p.z * 8.0), sin(t + p.x * 8.0))) * 1.05;
  else if (mode == 7) a = vec3(cos(t + p.x * 4.0), sin(t + p.y * 4.0), cos(t + p.z * 4.0)) * (1.1 + abs(n));
  else if (mode == 8) a = normalize(vec3(p.y - p.z, p.z - p.x, p.x - p.y)) * (0.8 + pinch * 0.8);
  else if (mode == 9) a = normalize(-p) * (1.5 / (0.3 + length(p))) + cp * 0.4;
  else if (mode == 10) a = normalize(vec3(sin(p.x * 11.0), sin(p.y * 11.0), sin(p.z * 11.0))) * 1.2;
  else if (mode == 11) a = vec3(-p.y, p.x, 0.0) * (0.5 + abs(sin(t + length(p) * 3.0)));
  else if (mode == 12) a = normalize(vec3(dSphere, dBox, n)) * 1.0;
  else if (mode == 13) a = cp + vec3(n, n * 0.5, -n) * 0.9;
  else if (mode == 14) a = normalize(p) * sin(length(p) * 12.0 - t * 2.0) * 1.4;
  else if (mode == 15) a = vec3(cos(t + p.y * 7.0), sin(t + p.x * 7.0), cos(t + p.z * 7.0)) * 1.05;
  else if (mode == 16) a = normalize(vec3(-p.x, p.y, -p.z) + cp) * (1.0 + pinch * 0.6);
  else if (mode == 17) a = normalize(-p) * (0.6 + smoothstep(-0.5, 0.6, -dSphere)) + cp * 0.5;
  else if (mode == 18) a = vec3(p.y, -p.x, sin(p.x * 3.0 + p.y * 3.0 + t)) * 0.9;
  else if (mode == 19) a = vec3(sin(t + p.z * 9.0), cos(t + p.x * 9.0), sin(t + p.y * 9.0)) * 1.0;
  else if (mode == 20) a = normalize(vec3(sign(p.x) * dBox, sign(p.y) * dSphere, n)) * 1.3;
  else if (mode == 21) a = cp * 0.9 + normalize(vec3(-p.z, p.y, p.x)) * 0.6;
  else if (mode == 22) a = vec3(cos(length(p) * 8.0 - t), sin(length(p) * 8.0 + t), -n) * 0.95;
  else if (mode == 23) a = normalize(vec3(p.y * p.z, p.x * p.z, p.x * p.y) + cp * 0.4) * 1.1;
  else if (mode == 24) a = normalize(vec3(-p.x, -p.y, 1.0 + n)) * (1.2 + pinch * 0.4);
  else if (mode == 25) a = vec3(-sin(t + p.y * 5.0), cos(t + p.x * 5.0), sin(t + p.z * 2.0)) * 1.0;
  else if (mode == 26) a = normalize(vec3(cos(p.x * 6.0), sin(p.y * 6.0), cos(p.z * 6.0)) + cp) * 1.1;
  else if (mode == 27) a = polarFlow(vec3(p.x, p.z, p.y), t * 1.1) * 0.95;
  else if (mode == 28) a = normalize(vec3(-dBox, dSphere, n + pinch)) * 1.25;
  else a = normalize(cp + vec3(sin(t), cos(t), sin(t * 0.7))) * 1.0;

  vec3 dampingIntegral = -v * (0.12 + pinch * 0.08);
  return (a * s + dampingIntegral) * 0.75;
}
`;
