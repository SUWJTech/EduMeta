import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js";
import { GPUComputationRenderer } from "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/misc/GPUComputationRenderer.js";
import { VECTOR_FIELD_GLSL } from "./fields.js";

const DEFAULT_POINT_SIZE = 1.45;
const DEFAULT_WORLD_SCALE = 8.6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parsePly(text) {
  const lines = text.split(/\r?\n/);
  let vertexCount = 0;
  let headerEnd = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith("element vertex")) {
      const parts = line.split(/\s+/);
      vertexCount = Number(parts[2] || 0);
    }
    if (line === "end_header") {
      headerEnd = i + 1;
      break;
    }
  }

  if (headerEnd < 0 || vertexCount <= 0) return null;

  const out = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i += 1) {
    const row = lines[headerEnd + i];
    if (!row) break;
    const parts = row.trim().split(/\s+/);
    out[i * 3 + 0] = Number(parts[0] || 0);
    out[i * 3 + 1] = Number(parts[1] || 0);
    out[i * 3 + 2] = Number(parts[2] || 0);
  }
  return out;
}

function normalizeByBounds(points) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i + 0];
    const y = points[i + 1];
    const z = points[i + 2];
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  const size = [Math.max(max[0] - min[0], 1e-5), Math.max(max[1] - min[1], 1e-5), Math.max(max[2] - min[2], 1e-5)];
  const center = [(max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5];
  const longest = Math.max(size[0], size[1], size[2]);

  const normalized = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    normalized[i + 0] = (points[i + 0] - center[0]) / longest;
    normalized[i + 1] = (points[i + 1] - center[1]) / longest;
    normalized[i + 2] = (points[i + 2] - center[2]) / longest;
  }

  return { normalized, bounds: { min, max, center, size, longest } };
}

function generateFallbackCloud(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const fi = i / count;
    const theta = fi * Math.PI * 2.0 * 12.0;
    const y = 1 - fi * 2;
    const radius = Math.sqrt(Math.max(0.0, 1 - y * y));
    const ripple = 0.32 * Math.sin(theta * 0.25 + fi * Math.PI * 24);

    out[i * 3 + 0] = (radius + ripple) * Math.cos(theta);
    out[i * 3 + 1] = y * (1.0 + 0.15 * Math.sin(theta * 0.7));
    out[i * 3 + 2] = (radius + ripple) * Math.sin(theta);
  }
  return normalizeByBounds(out);
}

async function loadPointCloud(url, fallbackCount) {
  if (!url) return generateFallbackCloud(fallbackCount);

  try {
    const res = await fetch(url);
    if (!res.ok) return generateFallbackCloud(fallbackCount);
    const text = await res.text();
    const parsed = parsePly(text);
    if (!parsed || parsed.length < 9) return generateFallbackCloud(fallbackCount);
    return normalizeByBounds(parsed);
  } catch {
    return generateFallbackCloud(fallbackCount);
  }
}

function buildPositionShader() {
  return /* glsl */ `
uniform float uDelta;
uniform float uProgress;
uniform sampler2D uOriginTexture;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(texturePosition, uv).xyz;
  vec3 vel = texture2D(textureVelocity, uv).xyz;
  vec3 origin = texture2D(uOriginTexture, uv).xyz;

  pos += vel * uDelta;
  float homeStrength = smoothstep(0.0, 1.0, uProgress) * 0.38;
  pos += (origin - pos) * homeStrength * uDelta;

  gl_FragColor = vec4(pos, 1.0);
}
`;
}

function buildVelocityShader() {
  return /* glsl */ `
${VECTOR_FIELD_GLSL}

uniform float uTime;
uniform float uDelta;
uniform float uProgress;
uniform float uPinch;
uniform float uDamping;
uniform int uFieldMode;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(texturePosition, uv).xyz;
  vec3 vel = texture2D(textureVelocity, uv).xyz;

  vec3 accel = evaluateField(pos, vel, uTime, uPinch, uProgress, uFieldMode);
  vel = vel * max(0.0, 1.0 - uDamping * uDelta) + accel * uDelta;
  vel = clamp(vel, vec3(-3.2), vec3(3.2));

  gl_FragColor = vec4(vel, 1.0);
}
`;
}

function buildPointsMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPositionTexture: { value: null },
      uVelocityTexture: { value: null },
      uPointSize: { value: DEFAULT_POINT_SIZE },
      uGlowMix: { value: 0.65 },
      uColorA: { value: new THREE.Color("#0ea5e9") },
      uColorB: { value: new THREE.Color("#f0abfc") },
      uWorldScale: { value: DEFAULT_WORLD_SCALE },
    },
    vertexShader: /* glsl */ `
attribute vec2 aRef;
uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform float uPointSize;
uniform float uWorldScale;
varying float vSpeed;

void main() {
  vec3 pos = texture2D(uPositionTexture, aRef).xyz * uWorldScale;
  vec3 vel = texture2D(uVelocityTexture, aRef).xyz;
  vSpeed = clamp(length(vel) * 0.22, 0.0, 1.0);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPointSize * (1.0 + vSpeed * 2.0) * (300.0 / max(90.0, -mv.z));
}
`,
    fragmentShader: /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uGlowMix;
varying float vSpeed;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float alpha = smoothstep(0.5, 0.0, d);
  if (alpha < 0.01) discard;

  vec3 col = mix(uColorA, uColorB, clamp(vSpeed * uGlowMix, 0.0, 1.0));
  gl_FragColor = vec4(col, alpha * (0.45 + vSpeed * 0.8));
}
`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export class GPGPUPipeline {
  constructor(renderer, { size = 384, pointCloudUrl = "", pointCount = 0 } = {}) {
    this.renderer = renderer;
    this.size = size;
    this.capacity = size * size;
    this.pointCloudUrl = pointCloudUrl;
    this.pointCount = pointCount > 0 ? Math.min(pointCount, this.capacity) : this.capacity;

    this.gpu = null;
    this.posVar = null;
    this.velVar = null;
    this.originTexture = null;

    this.points = null;
    this.material = null;

    this.fieldMode = 0;
    this.progress = 0;
    this.pinch = 0;
    this.glowMix = 0.65;
    this.bounds = null;
  }

  async init() {
    const loaded = await loadPointCloud(this.pointCloudUrl, this.pointCount);
    this.bounds = loaded.bounds;

    const gpu = new GPUComputationRenderer(this.size, this.size, this.renderer);
    if (this.renderer.capabilities.isWebGL2 === false) {
      gpu.setDataType(THREE.HalfFloatType);
    }

    const dtPos = gpu.createTexture();
    const dtVel = gpu.createTexture();
    const origin = gpu.createTexture();

    const posData = dtPos.image.data;
    const velData = dtVel.image.data;
    const originData = origin.image.data;

    for (let i = 0; i < this.capacity; i += 1) {
      const p = (i % this.pointCount) * 3;
      const x = loaded.normalized[p + 0] ?? 0;
      const y = loaded.normalized[p + 1] ?? 0;
      const z = loaded.normalized[p + 2] ?? 0;

      const k = i * 4;
      posData[k + 0] = x;
      posData[k + 1] = y;
      posData[k + 2] = z;
      posData[k + 3] = 1;

      originData[k + 0] = x;
      originData[k + 1] = y;
      originData[k + 2] = z;
      originData[k + 3] = 1;

      velData[k + 0] = (Math.random() - 0.5) * 0.012;
      velData[k + 1] = (Math.random() - 0.5) * 0.012;
      velData[k + 2] = (Math.random() - 0.5) * 0.012;
      velData[k + 3] = 1;
    }

    const posVar = gpu.addVariable("texturePosition", buildPositionShader(), dtPos);
    const velVar = gpu.addVariable("textureVelocity", buildVelocityShader(), dtVel);

    gpu.setVariableDependencies(posVar, [posVar, velVar]);
    gpu.setVariableDependencies(velVar, [posVar, velVar]);

    posVar.material.uniforms.uDelta = { value: 0.016 };
    posVar.material.uniforms.uProgress = { value: 0 };
    posVar.material.uniforms.uOriginTexture = { value: origin };

    velVar.material.uniforms.uTime = { value: 0 };
    velVar.material.uniforms.uDelta = { value: 0.016 };
    velVar.material.uniforms.uProgress = { value: 0 };
    velVar.material.uniforms.uPinch = { value: 0 };
    velVar.material.uniforms.uDamping = { value: 0.2 };
    velVar.material.uniforms.uFieldMode = { value: 0 };

    const error = gpu.init();
    if (error) {
      throw new Error(`GPU init failed: ${error}`);
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.capacity * 3);
    const refs = new Float32Array(this.capacity * 2);
    let rp = 0;
    let rr = 0;

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        positions[rp + 0] = 0;
        positions[rp + 1] = 0;
        positions[rp + 2] = 0;
        rp += 3;

        refs[rr + 0] = (x + 0.5) / this.size;
        refs[rr + 1] = (y + 0.5) / this.size;
        rr += 2;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aRef", new THREE.BufferAttribute(refs, 2));

    const material = buildPointsMaterial();
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    this.gpu = gpu;
    this.posVar = posVar;
    this.velVar = velVar;
    this.originTexture = origin;
    this.points = points;
    this.material = material;

    this.syncMaterialTextures();
  }

  syncMaterialTextures() {
    if (!this.gpu || !this.posVar || !this.velVar || !this.material) return;
    this.material.uniforms.uPositionTexture.value = this.gpu.getCurrentRenderTarget(this.posVar).texture;
    this.material.uniforms.uVelocityTexture.value = this.gpu.getCurrentRenderTarget(this.velVar).texture;
  }

  setFieldMode(mode) {
    this.fieldMode = Number.isFinite(mode) ? Math.round(mode) : 0;
  }

  setProgress(progress) {
    this.progress = clamp(progress, 0, 1);
  }

  setPinch(pinch) {
    this.pinch = clamp(pinch, 0, 1);
  }

  setColor(baseColor, glowColor) {
    if (!this.material) return;
    this.material.uniforms.uColorA.value.set(baseColor);
    this.material.uniforms.uColorB.value.set(glowColor);
  }

  setGlowMix(value) {
    this.glowMix = clamp(value, 0, 1.4);
    if (!this.material) return;
    this.material.uniforms.uGlowMix.value = this.glowMix;
  }

  update(delta, elapsedTime) {
    if (!this.gpu || !this.posVar || !this.velVar) return;

    this.posVar.material.uniforms.uDelta.value = delta;
    this.posVar.material.uniforms.uProgress.value = this.progress;

    this.velVar.material.uniforms.uDelta.value = delta;
    this.velVar.material.uniforms.uTime.value = elapsedTime;
    this.velVar.material.uniforms.uProgress.value = this.progress;
    this.velVar.material.uniforms.uPinch.value = this.pinch;
    this.velVar.material.uniforms.uFieldMode.value = this.fieldMode;

    this.gpu.compute();
    this.syncMaterialTextures();
  }
}
