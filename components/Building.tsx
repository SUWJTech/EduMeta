"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";

export type BuildingStyle = "default" | "cyber_pagoda" | "void_monolith";
export type FocusDomain = "academic" | "tech" | "social";

type StyleProps = {
  color: string;
  height: number;
  opacity: number;
  glow: number;
  selected: boolean;
  seed: number;
};

type BuildingProps = {
  id: string;
  position: [number, number, number];
  style: BuildingStyle;
  height: number;
  color: string;
  isFocusing?: boolean;
  focusDomain?: FocusDomain | null;
  focusProgress?: number;
  fragmentEnergy?: number;
  hasActiveListing?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

const DOMAIN_COLOR: Record<FocusDomain, string> = {
  academic: "#a78bfa",
  tech: "#38bdf8",
  social: "#fb923c",
};

const VOID_VERTEX_SHADER = `
uniform float uTime;
uniform float uGlow;
uniform float uSeed;
varying float vPulse;
varying float vHeight;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(17.13, 13.71, 19.19))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

void main() {
  vec3 p = position;
  float t = uTime * 0.9;
  float field = noise(vec3(p.x * 2.4 + uSeed, p.y * 1.2 - t, p.z * 2.4 + t));
  float wave = sin((p.y * 3.2 + t * 3.8 + uSeed) * 1.3) * 0.05;
  float displacement = (field - 0.5) * 0.22 + wave;

  p += normal * displacement * (1.0 + uGlow * 0.25);

  vPulse = field + wave;
  vHeight = p.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const VOID_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uGlow;
varying float vPulse;
varying float vHeight;

void main() {
  float pulse = 0.55 + 0.45 * sin(vPulse * 18.0);
  float vertical = smoothstep(-0.3, 1.2, vHeight);

  vec3 deep = vec3(0.02, 0.07, 0.16);
  vec3 tint = mix(deep, uColor, 0.65 + pulse * 0.35);
  tint += vec3(0.04, 0.16, 0.28) * (0.3 + uGlow * 0.7) * vertical;

  gl_FragColor = vec4(tint, uOpacity * (0.72 + pulse * 0.24));
}
`;

function hashSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 997) / 997;
}

function DefaultTower({ color, height, opacity, glow, selected }: StyleProps) {
  const outline = opacity * (selected ? 0.4 : 0.28) + glow * 0.2;
  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[1.05, height, 1.05]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.58 * opacity}
          metalness={0.4}
          roughness={0.22}
          emissive="#1d4ed8"
          emissiveIntensity={0.62 + glow * 1.2}
        />
      </mesh>
      <mesh position={[0, height / 2, 0]} scale={[1.04, 1.02, 1.04]}>
        <boxGeometry args={[1.05, height, 1.05]} />
        <meshBasicMaterial
          color={selected ? "#67e8f9" : "#1d4ed8"}
          wireframe
          transparent
          opacity={outline}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CyberPagoda({ color, height, opacity, glow, selected }: StyleProps) {
  const h1 = height * 0.38;
  const h2 = height * 0.34;
  const h3 = height * 0.28;
  const y1 = h1 / 2;
  const y2 = h1 + h2 / 2;
  const y3 = h1 + h2 + h3 / 2;

  const edgeColor = selected ? "#67e8f9" : "#2563eb";
  const edgeOpacity = opacity * 0.32 + glow * 0.24;

  return (
    <group>
      <mesh position={[0, y1, 0]}>
        <boxGeometry args={[1.42, h1, 1.42]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.55 * opacity}
          metalness={0.46}
          roughness={0.2}
          emissive="#1d4ed8"
          emissiveIntensity={0.78 + glow * 1.2}
        />
      </mesh>
      <mesh position={[0, y2, 0]}>
        <boxGeometry args={[1.1, h2, 1.1]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.6 * opacity}
          metalness={0.48}
          roughness={0.18}
          emissive="#1e40af"
          emissiveIntensity={0.86 + glow * 1.25}
        />
      </mesh>
      <mesh position={[0, y3, 0]}>
        <boxGeometry args={[0.82, h3, 0.82]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.66 * opacity}
          metalness={0.5}
          roughness={0.16}
          emissive="#3b82f6"
          emissiveIntensity={0.9 + glow * 1.25}
        />
      </mesh>

      <mesh position={[0, h1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.58, 0.74, 36]} />
        <meshBasicMaterial color={edgeColor} transparent opacity={edgeOpacity * 0.9} toneMapped={false} />
      </mesh>
      <mesh position={[0, h1 + h2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.56, 36]} />
        <meshBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} toneMapped={false} />
      </mesh>
      <mesh position={[0, height + 0.1, 0]}>
        <cylinderGeometry args={[0.06, 0.12, 0.22, 16]} />
        <meshStandardMaterial
          color="#67e8f9"
          transparent
          opacity={Math.min(0.95, 0.5 + opacity * 0.45)}
          emissive="#22d3ee"
          emissiveIntensity={1.2 + glow * 1.5}
          metalness={0.16}
          roughness={0.24}
        />
      </mesh>
    </group>
  );
}

function VoidMonolith({ color, height, opacity, glow, selected, seed }: StyleProps) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uGlow: { value: glow },
      uSeed: { value: seed * 8 + 0.2 },
    }),
    [color, glow, opacity, seed]
  );

  useFrame((_, delta) => {
    const material = shaderRef.current;
    if (!material) return;

    material.uniforms.uTime.value += delta;
    material.uniforms.uOpacity.value = THREE.MathUtils.lerp(material.uniforms.uOpacity.value, opacity, 0.2);
    material.uniforms.uGlow.value = THREE.MathUtils.lerp(material.uniforms.uGlow.value, glow, 0.15);
    material.uniforms.uColor.value.lerp(new THREE.Color(color), 0.15);
  });

  const edgeOpacity = opacity * 0.34 + glow * 0.22;
  const edgeColor = selected ? "#67e8f9" : "#1d4ed8";

  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.42, 0.88, height, 5, 48, true]} />
        <shaderMaterial
          ref={shaderRef}
          uniforms={uniforms}
          vertexShader={VOID_VERTEX_SHADER}
          fragmentShader={VOID_FRAGMENT_SHADER}
          transparent
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, height / 2, 0]} scale={[1.06, 1.03, 1.06]}>
        <cylinderGeometry args={[0.42, 0.88, height, 5, 24, true]} />
        <meshBasicMaterial color={edgeColor} wireframe transparent opacity={edgeOpacity} toneMapped={false} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]}>
        <octahedronGeometry args={[0.23, 0]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={Math.min(0.96, 0.48 + opacity * 0.45)}
          emissive="#22d3ee"
          emissiveIntensity={1.3 + glow * 1.45}
          metalness={0.15}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function renderStyle(style: BuildingStyle, props: StyleProps) {
  if (style === "cyber_pagoda") return <CyberPagoda {...props} />;
  if (style === "void_monolith") return <VoidMonolith {...props} />;
  return <DefaultTower {...props} />;
}

function QuantumFocusFx({
  height,
  domain,
  progress,
}: {
  height: number;
  domain: FocusDomain;
  progress: number;
}) {
  const ringRef = useRef<THREE.Points>(null);
  const shieldRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>(null);
  const beamRef = useRef<THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>>(null);
  const tint = DOMAIN_COLOR[domain];
  const tintColor = useMemo(() => new THREE.Color(tint), [tint]);
  const particleCount = 120;

  const particlePositions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const t = i / particleCount;
      const angle = t * Math.PI * 2;
      const radius = 1.05 + Math.sin(t * 18.2) * 0.08 + Math.random() * 0.26;
      const y = height * (0.55 + (Math.random() - 0.5) * 0.16);
      arr[i * 3 + 0] = Math.cos(angle) * radius;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return arr;
  }, [height]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.8);
    const progressPulse = 0.4 + progress * 0.6;

    if (ringRef.current) {
      ringRef.current.rotation.y += delta * (0.5 + progress * 1.2);
      ringRef.current.rotation.x = Math.sin(t * 0.7) * 0.12;
      const material = ringRef.current.material as THREE.PointsMaterial;
      material.opacity = 0.34 + pulse * 0.3;
    }

    if (shieldRef.current) {
      const scalePulse = 1 + Math.sin(t * 2.1) * 0.04;
      shieldRef.current.scale.set(1.28 * scalePulse, Math.max(1.2, height * 0.42), 1.28 * scalePulse);
      shieldRef.current.material.opacity = 0.08 + pulse * 0.05;
    }

    if (beamRef.current) {
      const beamPulse = 1 + Math.sin(t * 4.2) * 0.07;
      beamRef.current.scale.set(beamPulse, 1, beamPulse);
      beamRef.current.material.opacity = 0.22 + progressPulse * 0.26 + pulse * 0.08;
      beamRef.current.material.emissiveIntensity = 1.2 + progressPulse * 1.2;
    }
  });

  return (
    <group>
      <mesh ref={shieldRef} position={[0, height * 0.58, 0]}>
        <sphereGeometry args={[1, 26, 26]} />
        <meshBasicMaterial color={tintColor} transparent opacity={0.12} wireframe toneMapped={false} />
      </mesh>

      <points ref={ringRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={tintColor}
          size={0.085}
          sizeAttenuation
          transparent
          opacity={0.58}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <mesh ref={beamRef} position={[0, height + 4.6, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 9.2, 24, 1, true]} />
        <meshStandardMaterial
          color={tintColor}
          emissive={tintColor}
          emissiveIntensity={1.6}
          transparent
          opacity={0.42}
          metalness={0.1}
          roughness={0.32}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, height + 9.2, 0]}>
        <sphereGeometry args={[0.26, 20, 20]} />
        <meshBasicMaterial color={tintColor} transparent opacity={0.82} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Building({
  id,
  position,
  style,
  height,
  color,
  isFocusing = false,
  focusDomain = null,
  focusProgress = 0,
  fragmentEnergy = 0,
  hasActiveListing = false,
  selected = false,
  onSelect,
}: BuildingProps) {
  const [currentStyle, setCurrentStyle] = useState<BuildingStyle>(style);
  const [previousStyle, setPreviousStyle] = useState<BuildingStyle | null>(null);
  const [blend, setBlend] = useState(1);
  const [pulse, setPulse] = useState(0);
  const morphingRef = useRef(false);
  const styleRef = useRef<BuildingStyle>(style);
  const seed = useMemo(() => hashSeed(id), [id]);

  useEffect(() => {
    if (styleRef.current === style) return;
    setPreviousStyle(styleRef.current);
    setCurrentStyle(style);
    styleRef.current = style;
    setBlend(0);
    setPulse(1);
    morphingRef.current = true;
  }, [style]);

  useFrame((_, delta) => {
    if (morphingRef.current) {
      setBlend((current) => {
        const next = Math.min(1, current + delta * 2.2);
        if (next >= 1) {
          morphingRef.current = false;
          setPreviousStyle(null);
        }
        return next;
      });
    }

    setPulse((current) => {
      if (current <= 0) return 0;
      const next = Math.max(0, current - delta * 1.7);
      return next < 0.01 ? 0 : next;
    });
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.(id);
  };

  const normalizedEnergy = Math.max(0, Math.min(1, fragmentEnergy));
  const baseGlow = (selected ? 0.26 : 0.12) + pulse * 1.35 + normalizedEnergy * 0.42;

  return (
    <group position={position} onClick={onClick}>
      {previousStyle
        ? renderStyle(previousStyle, {
            color,
            height,
            opacity: 1 - blend,
            glow: baseGlow * (1 - blend),
            selected,
            seed,
          })
        : null}

      {renderStyle(currentStyle, {
        color,
        height,
        opacity: previousStyle ? blend : 1,
        glow: baseGlow,
        selected,
        seed,
      })}

      {pulse > 0.02 ? (
        <mesh position={[0, height / 2, 0]} scale={[1 + pulse * 0.58, 1.02, 1 + pulse * 0.58]}>
          <cylinderGeometry args={[0.72, 1.08, height + 0.5, 28, 1, true]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={pulse * 0.28} toneMapped={false} />
        </mesh>
      ) : null}

      {normalizedEnergy > 0.01 ? (
        <>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1 + normalizedEnergy * 0.4, 1, 1 + normalizedEnergy * 0.4]}>
            <ringGeometry args={[0.82, 1.22, 40]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.22 + normalizedEnergy * 0.26} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1 + normalizedEnergy * 0.64, 1, 1 + normalizedEnergy * 0.64]}>
            <ringGeometry args={[1.08, 1.42, 40]} />
            <meshBasicMaterial
              color={hasActiveListing ? "#a5f3fc" : "#67e8f9"}
              transparent
              opacity={hasActiveListing ? 0.36 : 0.18 + normalizedEnergy * 0.16}
              toneMapped={false}
            />
          </mesh>
        </>
      ) : null}

      {isFocusing && focusDomain ? (
        <QuantumFocusFx height={height} domain={focusDomain} progress={Math.max(0, Math.min(1, focusProgress))} />
      ) : null}
    </group>
  );
}
