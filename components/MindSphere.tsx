"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrthographicCamera, Text, shaderMaterial } from "@react-three/drei";
import { useMemo, useRef } from "react";
import type { Group, MeshBasicMaterial, ShaderMaterial } from "three";
import { AdditiveBlending, Color, MathUtils } from "three";

type MindSphereProps = {
  inputIntensity?: number;
  impactPulse?: number;
  orbitTexts?: string[];
  baseColor?: string;
  glowColor?: string;
  growth?: number;
};

const vertexShader = `
uniform float uTime;
uniform float uInput;
uniform float uGrowth;
varying float vNoise;
varying float vFresnel;
varying vec3 vViewDir;
varying vec3 vNormalW;

vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 p = position;
  float n = fbm(normalize(p) * 2.45 + vec3(0.0, uTime * 0.2, 0.0));
  float n2 = snoise(p * 4.2 + vec3(uTime * 0.9, 0.0, uTime * 0.4));
  float ripple = sin((p.y + uTime * 1.9) * 8.0 + n * 7.0) * (0.028 + uGrowth * 0.02) * uInput;
  float pulse = n2 * (0.04 + uGrowth * 0.02) * uInput;
  float displacement = n * (0.22 + uGrowth * 0.2) + ripple + pulse;
  vec3 displaced = p + normal * displacement;

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vec3 viewDir = normalize(cameraPosition - worldPos.xyz);

  vNoise = n;
  vNormalW = worldNormal;
  vViewDir = viewDir;
  vFresnel = pow(1.0 - max(dot(worldNormal, viewDir), 0.0), 2.7);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uInput;
uniform float uGrowth;
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
varying float vNoise;
varying float vFresnel;

void main() {
  float n = vNoise * 0.5 + 0.5;
  float electricMask = smoothstep(0.32, 0.98, n + uInput * 0.18 + uGrowth * 0.15);
  float pulse = 0.45 + 0.55 * sin(uTime * (1.2 + uGrowth * 0.8) + n * 6.2831);

  vec3 abyss = uBaseColor * (0.4 + n * 0.55 + uGrowth * 0.12);
  vec3 charge = uGlowColor * (electricMask * (0.68 + uGrowth * 0.24) + vFresnel * 1.15);
  vec3 col = abyss + charge * pulse;

  float alpha = clamp(0.58 + electricMask * 0.2 + vFresnel * (0.24 + uGrowth * 0.08), 0.0, 0.95);
  gl_FragColor = vec4(col, alpha);
}
`;

const LiquidAetherMaterial = shaderMaterial(
  {
    uTime: 0,
    uInput: 0,
    uGrowth: 0.12,
    uBaseColor: new Color("#1a0b32"),
    uGlowColor: new Color("#39ddff"),
  },
  vertexShader,
  fragmentShader
);

function alphaColor(color: string, alpha: number) {
  const parsed = new Color(color);
  const r = Math.round(parsed.r * 255);
  const g = Math.round(parsed.g * 255);
  const b = Math.round(parsed.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function AetherCore({
  inputIntensity,
  impactPulse,
  baseColor,
  glowColor,
  growth,
}: {
  inputIntensity: number;
  impactPulse: number;
  baseColor: string;
  glowColor: string;
  growth: number;
}) {
  const material = useMemo(() => {
    const m = new LiquidAetherMaterial() as ShaderMaterial & {
      uTime: number;
      uInput: number;
      uGrowth: number;
      uBaseColor: Color;
      uGlowColor: Color;
    };
    m.transparent = true;
    m.depthWrite = false;
    return m;
  }, []);
  const outerRef = useRef<MeshBasicMaterial>(null);
  const shellRef = useRef<Group>(null);
  const baseTarget = useMemo(() => new Color(baseColor), [baseColor]);
  const glowTarget = useMemo(() => new Color(glowColor), [glowColor]);

  useFrame((state, delta) => {
    const target = Math.min(2.4, inputIntensity * 1.2 + impactPulse * 1.6);
    material.uTime = state.clock.elapsedTime;
    material.uInput = MathUtils.damp(material.uInput, target, 4.2, delta);
    material.uGrowth = MathUtils.damp(material.uGrowth, growth, 3.8, delta);
    material.uBaseColor.lerp(baseTarget, 1 - Math.exp(-delta * 6.5));
    material.uGlowColor.lerp(glowTarget, 1 - Math.exp(-delta * 6.5));

    const outer = outerRef.current;
    if (outer) {
      outer.opacity = MathUtils.damp(outer.opacity, 0.1 + impactPulse * 0.2 + growth * 0.08, 5, delta);
      outer.color.lerp(glowTarget, 1 - Math.exp(-delta * 6.2));
    }

    const shell = shellRef.current;
    if (shell) {
      const current = shell.scale.x;
      const targetScale = 1 + growth * 0.34 + impactPulse * 0.03;
      const nextScale = MathUtils.damp(current, targetScale, 4, delta);
      shell.scale.setScalar(nextScale);
    }
  });

  return (
    <group ref={shellRef}>
      <Float speed={0.9} floatIntensity={0.2} rotationIntensity={0.15}>
        <mesh>
          <icosahedronGeometry args={[1.08, 5]} />
          <primitive object={material} attach="material" />
        </mesh>
        <mesh scale={1.22}>
          <icosahedronGeometry args={[1.08, 4]} />
          <meshBasicMaterial
            ref={outerRef}
            color="#28d8ff"
            transparent
            opacity={0.14}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Float>
    </group>
  );
}

function OrbitTextCloud({ orbitTexts }: { orbitTexts: string[] }) {
  const ringRef = useRef<Group>(null);

  useFrame((state, delta) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z += delta * 0.22;
    ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.26) * 0.14;
  });

  return (
    <group ref={ringRef} rotation={[0.28, 0, 0]}>
      {orbitTexts.map((label, idx) => {
        const angle = (idx / orbitTexts.length) * Math.PI * 2;
        const radius = 1.96 + (idx % 3) * 0.08;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <Text
            key={`${label}-${idx}`}
            position={[x, y, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
            fontSize={0.12}
            color="#8ce8ff"
            fillOpacity={0.26}
            anchorX="center"
            anchorY="middle"
            maxWidth={1.6}
          >
            {label}
          </Text>
        );
      })}
    </group>
  );
}

export default function MindSphere({
  inputIntensity = 0,
  impactPulse = 0,
  orbitTexts = [],
  baseColor = "#1a0b32",
  glowColor = "#39ddff",
  growth = 0.12,
}: MindSphereProps) {
  const words = useMemo(() => {
    if (orbitTexts.length === 0) return ["AETHER", "SYNAPSE", "FLOW", "ECHO", "NODE", "MIND"];
    return orbitTexts.slice(0, 18);
  }, [orbitTexts]);

  const shellStyle = useMemo(
    () => ({
      boxShadow: `0 0 ${42 + growth * 70}px ${alphaColor(glowColor, 0.3)}`,
      background: `radial-gradient(circle at 50% 45%, ${alphaColor(glowColor, 0.24)}, ${alphaColor(
        baseColor,
        0.16
      )} 36%, rgba(0,0,0,0) 72%)`,
    }),
    [baseColor, glowColor, growth]
  );

  return (
    <div className="relative h-[20rem] w-full max-w-[23rem] md:h-[24rem] md:max-w-[26rem]">
      <div className="pointer-events-none absolute inset-0 blur-2xl" style={shellStyle} />
      <Canvas dpr={[1, 1.45]} gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}>
        <OrthographicCamera makeDefault zoom={135} position={[0, 0, 8]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[2.8, 2.2, 3.5]} intensity={1.1 + growth * 0.45} color={glowColor} />
        <pointLight position={[-2.1, -1.6, 2.5]} intensity={0.56 + growth * 0.32} color={baseColor} />
        <AetherCore
          inputIntensity={inputIntensity}
          impactPulse={impactPulse}
          baseColor={baseColor}
          glowColor={glowColor}
          growth={growth}
        />
        <OrbitTextCloud orbitTexts={words} />
      </Canvas>
    </div>
  );
}
