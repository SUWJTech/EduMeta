import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js";
import { FIELD_LABELS, mapEmotionToField } from "./fields.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothStep(current, target, rate, dt) {
  const t = 1 - Math.exp(-rate * dt);
  return lerp(current, target, t);
}

function cubicBezierAt(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

const CINEMA_PRESETS = [
  { azimuth: 0.2, elevation: 0.35, radius: 1.0, duration: 4.0 },
  { azimuth: 0.8, elevation: 0.45, radius: 1.08, duration: 4.2 },
  { azimuth: 1.2, elevation: 0.25, radius: 0.96, duration: 3.4 },
  { azimuth: 1.9, elevation: 0.42, radius: 1.12, duration: 3.8 },
  { azimuth: 2.6, elevation: 0.3, radius: 0.9, duration: 3.6 },
  { azimuth: 3.1, elevation: 0.5, radius: 1.04, duration: 4.2 },
  { azimuth: 3.8, elevation: 0.28, radius: 0.88, duration: 3.4 },
  { azimuth: 4.4, elevation: 0.52, radius: 1.2, duration: 3.8 },
  { azimuth: 5.0, elevation: 0.35, radius: 1.0, duration: 3.4 },
  { azimuth: 5.6, elevation: 0.4, radius: 1.1, duration: 3.5 },
  { azimuth: 6.1, elevation: 0.24, radius: 0.92, duration: 3.3 },
  { azimuth: 6.8, elevation: 0.46, radius: 1.15, duration: 3.7 },
  { azimuth: 7.3, elevation: 0.36, radius: 1.02, duration: 3.3 },
  { azimuth: 7.9, elevation: 0.3, radius: 0.95, duration: 3.2 },
  { azimuth: 8.4, elevation: 0.48, radius: 1.14, duration: 4.1 },
];

export class CinematographyController {
  constructor(camera, { minDistance = 8, maxDistance = 45, objectRadius = 8.5 } = {}) {
    this.camera = camera;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.objectRadius = objectRadius;

    this.focus = new THREE.Vector3();
    this.focusTarget = new THREE.Vector3();
    this.cursor = { azimuth: CINEMA_PRESETS[0].azimuth, elevation: CINEMA_PRESETS[0].elevation, radius: CINEMA_PRESETS[0].radius };

    this.sequenceIndex = 0;
    this.sequenceTime = 0;
    this.timeline = null;
    this.usingGsap = false;

    this.setupTimeline();
  }

  fitDistanceToFrustum(radius = this.objectRadius) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = radius / Math.tan(fov * 0.5);
    return clamp(dist * 1.08, this.minDistance, this.maxDistance);
  }

  setupTimeline() {
    const gsap = window.gsap;
    if (!gsap) return;

    this.usingGsap = true;
    const timeline = gsap.timeline({ repeat: -1 });
    const proxy = this.cursor;

    for (let i = 0; i < CINEMA_PRESETS.length; i += 1) {
      const preset = CINEMA_PRESETS[i];
      timeline.to(proxy, {
        azimuth: preset.azimuth,
        elevation: preset.elevation,
        radius: preset.radius,
        duration: preset.duration,
        ease: "sine.inOut",
      });
    }

    this.timeline = timeline;
  }

  setTimeScale(scale) {
    if (!this.timeline) return;
    this.timeline.timeScale(clamp(scale, 0.2, 2.2));
  }

  setFocusOffset(x, y) {
    this.focusTarget.set(clamp(x, -1, 1) * 4.5, clamp(y, -1, 1) * 2.8, 0);
  }

  update(dt) {
    this.focus.x = smoothStep(this.focus.x, this.focusTarget.x, 6.5, dt);
    this.focus.y = smoothStep(this.focus.y, this.focusTarget.y, 6.5, dt);
    this.focus.z = smoothStep(this.focus.z, this.focusTarget.z, 6.5, dt);

    if (!this.usingGsap) {
      this.sequenceTime += dt;
      const current = CINEMA_PRESETS[this.sequenceIndex % CINEMA_PRESETS.length];
      const next = CINEMA_PRESETS[(this.sequenceIndex + 1) % CINEMA_PRESETS.length];
      const progress = clamp(this.sequenceTime / current.duration, 0, 1);
      const eased = cubicBezierAt(progress, 0, 0.25, 0.75, 1);

      this.cursor.azimuth = lerp(current.azimuth, next.azimuth, eased);
      this.cursor.elevation = lerp(current.elevation, next.elevation, eased);
      this.cursor.radius = lerp(current.radius, next.radius, eased);

      if (progress >= 1) {
        this.sequenceIndex += 1;
        this.sequenceTime = 0;
      }
    }

    const baseDistance = this.fitDistanceToFrustum();
    const dist = clamp(baseDistance * this.cursor.radius, this.minDistance, this.maxDistance);

    const spherical = new THREE.Spherical(
      dist,
      clamp(this.cursor.elevation + Math.PI * 0.2, 0.2, Math.PI - 0.2),
      this.cursor.azimuth
    );
    const offset = new THREE.Vector3().setFromSpherical(spherical);

    const targetPosition = this.focus.clone().add(offset);
    this.camera.position.lerp(targetPosition, 1 - Math.exp(-dt * 4.8));
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }
}

export class InteractionBridge {
  constructor({ canvas, panelRoot, fieldLabels = FIELD_LABELS } = {}) {
    this.canvas = canvas;
    this.panelRoot = panelRoot;
    this.fieldLabels = fieldLabels;

    this.listeners = new Set();
    this.target = {
      progress: 0.2,
      pinch: 0,
      focusX: 0,
      focusY: 0,
      fieldMode: 0,
      glowMix: 0.62,
      bloom: 0.9,
      afterimage: 0.9,
      timeScale: 1,
    };
    this.state = { ...this.target };

    this.externalEmotion = "neutral";
    this.externalKeywords = [];

    this.pointerDown = false;
    this.pointerStart = null;
    this.mediaPipeActive = false;

    this.bindCanvasFocus();
    this.bindWindowMessages();
    this.bindPanelControls();
  }

  bindCanvasFocus() {
    if (!this.canvas) return;

    this.canvas.addEventListener("pointermove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      this.target.focusX = nx;
      this.target.focusY = -ny;

      if (this.pointerDown && this.pointerStart) {
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.target.pinch = clamp(dist / 240, 0, 1);
      }
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = true;
      this.pointerStart = { x: event.clientX, y: event.clientY };
    });

    window.addEventListener("pointerup", () => {
      this.pointerDown = false;
      this.pointerStart = null;
      this.target.pinch *= 0.72;
    });
  }

  bindWindowMessages() {
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.type !== "edumeta:energy-update") return;

      const payload = message.payload || {};
      const growth = clamp(Number(payload.growth) || 0, 0, 1);
      const inputIntensity = clamp(Number(payload.inputIntensity) || 0, 0, 3);
      const impactPulse = clamp(Number(payload.impactPulse) || 0, 0, 3);
      const arousal = clamp(Number(payload.arousal) || 0.4, 0, 1);
      const confidence = clamp(Number(payload.confidence) || 0.5, 0, 1);
      const fragmentCount = Math.max(0, Number(payload.fragmentCount) || 0);

      this.externalEmotion = String(payload.emotion || "neutral");
      this.externalKeywords = Array.isArray(payload.orbitTexts) ? payload.orbitTexts : [];

      this.target.fieldMode = mapEmotionToField(this.externalEmotion, fragmentCount);
      this.target.progress = clamp(growth * 0.58 + arousal * 0.3 + inputIntensity * 0.08 + impactPulse * 0.04, 0, 1);
      this.target.glowMix = clamp(0.35 + confidence * 0.7 + fragmentCount * 0.01, 0, 1.35);
      this.target.bloom = clamp(0.6 + arousal * 0.55 + impactPulse * 0.18, 0.35, 1.6);
      this.target.afterimage = clamp(0.86 + confidence * 0.1, 0.75, 0.97);

      if (this.panelRoot) {
        const modeLabel = this.panelRoot.querySelector("[data-role='field-label']");
        if (modeLabel) {
          modeLabel.textContent = this.fieldLabels[this.target.fieldMode] ?? `Field-${this.target.fieldMode}`;
        }
      }
    });
  }

  async enableMediaPipePinch() {
    if (this.mediaPipeActive) return;
    const HandsCtor = window.Hands;
    const CameraCtor = window.Camera;

    if (!HandsCtor || !CameraCtor || !navigator.mediaDevices?.getUserMedia) return;

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.style.position = "absolute";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);

    const hands = new HandsCtor({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      const landmarks = results.multiHandLandmarks?.[0];
      if (!landmarks) {
        this.target.pinch *= 0.92;
        return;
      }
      const thumb = landmarks[4];
      const index = landmarks[8];
      const dx = thumb.x - index.x;
      const dy = thumb.y - index.y;
      const dz = thumb.z - index.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.target.pinch = clamp(1.0 - dist * 7.2, 0, 1);
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 360, height: 240 },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    const camera = new CameraCtor(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 360,
      height: 240,
    });

    camera.start();
    this.mediaPipeActive = true;
  }

  bindPanelControls() {
    if (!this.panelRoot) return;

    const getEl = (selector) => this.panelRoot.querySelector(selector);
    const progressInput = getEl("[data-role='progress']");
    const fieldInput = getEl("[data-role='field']");
    const bloomInput = getEl("[data-role='bloom']");
    const afterInput = getEl("[data-role='afterimage']");
    const speedInput = getEl("[data-role='speed']");
    const gestureBtn = getEl("[data-role='gesture']");

    if (progressInput) {
      progressInput.addEventListener("input", () => {
        this.target.progress = clamp(Number(progressInput.value), 0, 1);
      });
    }

    if (fieldInput) {
      fieldInput.max = String(this.fieldLabels.length - 1);
      fieldInput.addEventListener("input", () => {
        this.target.fieldMode = clamp(Math.round(Number(fieldInput.value)), 0, this.fieldLabels.length - 1);
        const label = getEl("[data-role='field-label']");
        if (label) label.textContent = this.fieldLabels[this.target.fieldMode];
      });
    }

    if (bloomInput) {
      bloomInput.addEventListener("input", () => {
        this.target.bloom = clamp(Number(bloomInput.value), 0.2, 2.0);
      });
    }

    if (afterInput) {
      afterInput.addEventListener("input", () => {
        this.target.afterimage = clamp(Number(afterInput.value), 0.6, 0.99);
      });
    }

    if (speedInput) {
      speedInput.addEventListener("input", () => {
        this.target.timeScale = clamp(Number(speedInput.value), 0.2, 2.2);
      });
    }

    if (gestureBtn) {
      gestureBtn.addEventListener("click", () => {
        void this.enableMediaPipePinch();
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() !== "v") return;
      if (!this.panelRoot) return;
      this.panelRoot.classList.toggle("open");
    });
  }

  onUpdate(handler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  emit() {
    for (const handler of this.listeners) handler(this.state);
  }

  update(dt) {
    this.state.progress = smoothStep(this.state.progress, this.target.progress, 4.2, dt);
    this.state.pinch = smoothStep(this.state.pinch, this.target.pinch, 6.5, dt);
    this.state.focusX = smoothStep(this.state.focusX, this.target.focusX, 7.2, dt);
    this.state.focusY = smoothStep(this.state.focusY, this.target.focusY, 7.2, dt);
    this.state.glowMix = smoothStep(this.state.glowMix, this.target.glowMix, 4.8, dt);
    this.state.bloom = smoothStep(this.state.bloom, this.target.bloom, 4.8, dt);
    this.state.afterimage = smoothStep(this.state.afterimage, this.target.afterimage, 4.8, dt);
    this.state.timeScale = smoothStep(this.state.timeScale, this.target.timeScale, 4.8, dt);

    const normalizedMode = clamp(this.target.fieldMode, 0, this.fieldLabels.length - 1);
    this.state.fieldMode = Math.round(normalizedMode);

    this.emit();
  }
}
