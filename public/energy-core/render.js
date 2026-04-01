import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/postprocessing/AfterimagePass.js";
import { CinematographyController, InteractionBridge } from "./camera_io.js";
import { FIELD_LABELS } from "./fields.js";
import { GPGPUPipeline } from "./pipeline.js";

function notifyParent(type, detail = null) {
  try {
    window.parent?.postMessage({ type, detail }, window.location.origin);
  } catch {
    // no-op
  }
}

function setFpsLabel(text) {
  const fpsLabel = document.querySelector("[data-role='fps']");
  if (fpsLabel) fpsLabel.textContent = text;
}

async function boot() {
  const canvas = document.getElementById("energy-canvas");
  const panelRoot = document.getElementById("vj-console");

  if (!canvas) {
    notifyParent("edumeta:energy-error", "missing_canvas");
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#010205");
  scene.fog = new THREE.Fog("#010205", 18, 120);

  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 240);
  camera.position.set(0, 0, 20);

  const ambient = new THREE.AmbientLight("#8fe9ff", 0.42);
  scene.add(ambient);

  const keyLight = new THREE.PointLight("#3b82f6", 1.35, 120, 2);
  keyLight.position.set(14, 10, 16);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight("#f0abfc", 0.9, 90, 1.8);
  rimLight.position.set(-12, -8, -6);
  scene.add(rimLight);

  const helperStars = new THREE.Points(
    (() => {
      const geo = new THREE.BufferGeometry();
      const count = 900;
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const r = 28 + Math.random() * 52;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        arr[i * 3 + 1] = r * Math.cos(phi);
        arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      return geo;
    })(),
    new THREE.PointsMaterial({ color: "#7dd3fc", size: 0.08, transparent: true, opacity: 0.35 })
  );
  scene.add(helperStars);

  const pipeline = new GPGPUPipeline(renderer, {
    size: 384,
    pointCloudUrl: "",
  });
  await pipeline.init();
  scene.add(pipeline.points);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.6, 0.18);
  composer.addPass(bloomPass);

  const afterimagePass = new AfterimagePass();
  afterimagePass.uniforms.damp.value = 0.9;
  composer.addPass(afterimagePass);

  const cine = new CinematographyController(camera, {
    minDistance: 9,
    maxDistance: 44,
    objectRadius: 8.2,
  });

  const io = new InteractionBridge({
    canvas,
    panelRoot,
    fieldLabels: FIELD_LABELS,
  });

  io.onUpdate((state) => {
    pipeline.setFieldMode(state.fieldMode);
    pipeline.setProgress(state.progress);
    pipeline.setPinch(state.pinch);
    pipeline.setGlowMix(state.glowMix);

    bloomPass.strength = state.bloom;
    afterimagePass.uniforms.damp.value = state.afterimage;
    cine.setTimeScale(state.timeScale);
    cine.setFocusOffset(state.focusX, state.focusY);
  });

  notifyParent("edumeta:energy-ready");

  let raf = 0;
  let last = performance.now();
  let fpsFrames = 0;
  let fpsLast = performance.now();

  function loop(now) {
    const rawDt = (now - last) / 1000;
    last = now;
    const dt = Math.min(1 / 24, Math.max(1 / 180, rawDt));
    const elapsed = now / 1000;

    io.update(dt);
    pipeline.update(dt * io.state.timeScale, elapsed);
    cine.update(dt * io.state.timeScale);

    keyLight.intensity = 1.15 + Math.sin(elapsed * 0.6) * 0.24 + io.state.progress * 0.25;
    rimLight.intensity = 0.65 + Math.cos(elapsed * 0.9) * 0.2 + io.state.pinch * 0.35;

    composer.render();

    fpsFrames += 1;
    if (now - fpsLast > 650) {
      const fps = Math.round((fpsFrames * 1000) / (now - fpsLast));
      setFpsLabel(`${fps} FPS`);
      fpsFrames = 0;
      fpsLast = now;
    }

    raf = window.requestAnimationFrame(loop);
  }

  raf = window.requestAnimationFrame(loop);

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
  }

  window.addEventListener("resize", onResize);

  window.addEventListener("beforeunload", () => {
    window.cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  });
}

boot().catch((error) => {
  console.error("[energy-core] boot failed", error);
  notifyParent("edumeta:energy-error", String(error?.message || error || "boot_failed"));
});
