import type {
  FaceLandmarker,
  FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Point = { x: number; y: number };
type EyePose = { left: Point; right: Point };

export const EYE_LASER_HOLD_MS = 700;
const EYE_BLEND = 0.45;

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

export const mixEyePose = (from: EyePose, to: EyePose): EyePose => ({
  left: {
    x: mix(from.left.x, to.left.x, EYE_BLEND),
    y: mix(from.left.y, to.left.y, EYE_BLEND),
  },
  right: {
    x: mix(from.right.x, to.right.x, EYE_BLEND),
    y: mix(from.right.y, to.right.y, EYE_BLEND),
  },
});

export const holdEyePose = (
  prev: EyePose | null,
  detected: EyePose | null,
  now: number,
  lastGoodAt: number,
): { eyes: EyePose | null; lastGoodAt: number } => {
  if (detected) {
    return {
      eyes: prev ? mixEyePose(prev, detected) : detected,
      lastGoodAt: now,
    };
  }
  if (prev && now - lastGoodAt < EYE_LASER_HOLD_MS) {
    return { eyes: prev, lastGoodAt };
  }
  return { eyes: null, lastGoodAt };
};

// A stare is enough. Brows help, but both are not required.
export const isEyeLaserGesture = (
  scores: ReadonlyMap<string, number>,
  firing: boolean,
) => {
  const score = (name: string) => scores.get(name) ?? 0;
  const raisedBrows = Math.max(
    score("browInnerUp"),
    Math.min(score("browOuterUpLeft"), score("browOuterUpRight")),
  );
  const wide = (score("eyeWideLeft") + score("eyeWideRight")) / 2;
  const blinking =
    score("eyeBlinkLeft") > (firing ? 0.7 : 0.4) ||
    score("eyeBlinkRight") > (firing ? 0.7 : 0.4);
  if (blinking) {
    return false;
  }
  return raisedBrows > (firing ? 0.06 : 0.2) || wide > (firing ? 0.06 : 0.16);
};

// Irises are tracked whenever a face is visible so beams keep following the
// head while they hold and fade after the gesture ends.
const readEyes = (
  result: FaceLandmarkerResult,
  firing: boolean,
): { irises: EyePose | null; gesture: boolean } => {
  const landmarks = result.faceLandmarks[0];
  const categories = result.faceBlendshapes[0]?.categories;
  // Iris centers in the 478-point face mesh.
  const left = landmarks?.[468];
  const right = landmarks?.[473];
  const irises = left && right ? { left, right } : null;
  const gesture =
    !!irises &&
    !!categories &&
    isEyeLaserGesture(
      new Map(
        categories.map(({ categoryName, score }) => [categoryName, score]),
      ),
      firing,
    );
  return { irises, gesture };
};

const FADE_IN_MS = 90;
const FADE_OUT_MS = 220;
const EXTEND_MS = 180;
// Beams fire down and slightly outward from the face, like a heat-vision stare.
const BEAM_DOWN_TILT = 0.12;

const flicker = (t: number, seed: number) =>
  0.9 + 0.06 * Math.sin(t / 37 + seed) + 0.04 * Math.sin(t / 13 + seed * 3.1);

const drawEyeLasers = (
  context: CanvasRenderingContext2D,
  eyes: EyePose,
  offset: Point & { scale?: number },
  now: number,
  sinceIgnite: number,
  power: number,
  width: number,
  height: number,
) => {
  const left = { x: eyes.left.x * width, y: eyes.left.y * height };
  const right = { x: eyes.right.x * width, y: eyes.right.y * height };
  const separation = Math.hypot(right.x - left.x, right.y - left.y);
  const faceAngle = Math.atan2(right.y - left.y, right.x - left.x);
  const scale = offset.scale ?? 1;
  const unit = separation * scale;
  const extend = 1 - (1 - Math.min(1, sinceIgnite / EXTEND_MS)) ** 3;
  const length = Math.hypot(width, height) * 1.6 * extend;
  // Ignition flash: a brief overdrive that settles.
  const flash = 1 + 0.6 * Math.max(0, 1 - sinceIgnite / 260);

  context.save();
  context.globalCompositeOperation = "lighter";

  [left, right].forEach((eye, index) => {
    const side = index === 0 ? -1 : 1;
    const seed = index * 2.3;
    const f = flicker(now, seed) * power * flash;
    const beamAngle = faceAngle + Math.PI / 2 - side * BEAM_DOWN_TILT;

    context.save();
    context.translate(eye.x + offset.x, eye.y + offset.y);

    // Red haze bleeding onto the face around the eye.
    const hazeR = unit * 0.9 * f;
    const haze = context.createRadialGradient(0, 0, 0, 0, 0, hazeR);
    haze.addColorStop(0, "rgba(255, 40, 30, 0.35)");
    haze.addColorStop(1, "rgba(255, 0, 20, 0)");
    context.fillStyle = haze;
    context.fillRect(-hazeR, -hazeR, hazeR * 2, hazeR * 2);

    // Beam: tapered layers from wide soft glow to white-hot core.
    context.rotate(beamAngle);
    for (const [start, end, color, alpha] of [
      [0.2, 0.55, "255, 20, 30", 0.18],
      [0.09, 0.22, "255, 45, 35", 0.55],
      [0.045, 0.1, "255, 140, 110", 0.85],
      [0.018, 0.04, "255, 250, 240", 1],
    ] as const) {
      const w0 = unit * start * f;
      const w1 = unit * end * f;
      const grad = context.createLinearGradient(0, 0, length, 0);
      grad.addColorStop(0, `rgba(${color}, ${alpha * power})`);
      grad.addColorStop(0.7, `rgba(${color}, ${alpha * 0.8 * power})`);
      grad.addColorStop(1, `rgba(${color}, 0)`);
      context.fillStyle = grad;
      context.beginPath();
      context.moveTo(0, -w0 / 2);
      context.lineTo(length, -w1 / 2);
      context.lineTo(length, w1 / 2);
      context.lineTo(0, w0 / 2);
      context.arc(0, 0, w0 / 2, Math.PI / 2, -Math.PI / 2);
      context.fill();
    }
    context.rotate(-beamAngle);

    // Anamorphic lens flare streak along the eye line.
    context.rotate(faceAngle);
    const streakW = unit * 1.3 * f;
    const streakH = unit * 0.05 * f;
    const streak = context.createRadialGradient(0, 0, 0, 0, 0, streakW);
    streak.addColorStop(0, `rgba(255, 235, 225, ${0.9 * power})`);
    streak.addColorStop(0.25, `rgba(255, 60, 50, ${0.5 * power})`);
    streak.addColorStop(1, "rgba(255, 0, 20, 0)");
    context.fillStyle = streak;
    context.save();
    context.scale(1, streakH / streakW);
    context.beginPath();
    context.arc(0, 0, streakW, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Hot core at the iris.
    const coreR = Math.max(3, unit * 0.22 * f);
    const core = context.createRadialGradient(0, 0, 0, 0, 0, coreR);
    core.addColorStop(0, "rgba(255, 255, 255, 1)");
    core.addColorStop(0.2, "rgba(255, 220, 205, 0.95)");
    core.addColorStop(0.5, "rgba(255, 30, 30, 0.6)");
    core.addColorStop(1, "rgba(255, 0, 20, 0)");
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, coreR, 0, Math.PI * 2);
    context.fill();

    context.restore();
  });

  context.restore();
};

export const createEyeLasers = (video: HTMLVideoElement) => {
  let cancelled = false;
  let tracker: FaceLandmarker | null = null;
  let eyes: EyePose | null = null;
  let lastTime = -Infinity;
  let lastGoodAt = -Infinity;
  let lastFrame = -1;
  let shown: EyePose | null = null;
  let tracked: EyePose | null = null;
  let power = 0;
  let ignitedAt = 0;
  let lastDraw = -1;

  void import("@mediapipe/tasks-vision")
    .then(async ({ FaceLandmarker, FilesetResolver }) => {
      const files = await FilesetResolver.forVisionTasks(WASM_ROOT);
      if (cancelled) {
        return;
      }
      const next = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      if (cancelled) {
        next.close();
      } else {
        tracker = next;
      }
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        console.warn("Eye Lasers could not load face tracking", error);
      }
    });

  return {
    draw: (
      context: CanvasRenderingContext2D,
      offset: Point & { scale?: number },
      width: number,
      height: number,
    ) => {
      const now = video.ownerDocument.defaultView?.performance.now();
      if (cancelled || !tracker || now === undefined || video.readyState < 2) {
        return;
      }
      // Bound synchronous inference to 30 fps while animating at camera frame rate.
      if (now - lastTime >= 33 && video.currentTime !== lastFrame) {
        lastTime = now;
        lastFrame = video.currentTime;
        try {
          const face = readEyes(
            tracker.detectForVideo(video, now),
            eyes !== null,
          );
          if (face.irises) {
            tracked = tracked ? mixEyePose(tracked, face.irises) : face.irises;
          }
          const held = holdEyePose(
            eyes,
            face.gesture ? face.irises : null,
            now,
            lastGoodAt,
          );
          eyes = held.eyes;
          lastGoodAt = held.lastGoodAt;
        } catch (error) {
          eyes = null;
          tracked = null;
          lastGoodAt = -Infinity;
          tracker.close();
          tracker = null;
          console.warn("Eye Lasers face tracking stopped", error);
        }
      }
      if (eyes && now - lastGoodAt > EYE_LASER_HOLD_MS) {
        eyes = null;
      }
      const dt = Math.min(100, lastDraw < 0 ? 16 : now - lastDraw);
      lastDraw = now;
      if (eyes) {
        if (power === 0) {
          ignitedAt = now;
        }
        power = Math.min(1, power + dt / FADE_IN_MS);
      } else {
        power = Math.max(0, power - dt / FADE_OUT_MS);
      }
      if (power > 0) {
        shown = tracked ?? eyes ?? shown;
      }
      if (!shown || power === 0) {
        shown = power === 0 ? null : shown;
        return;
      }
      drawEyeLasers(
        context,
        shown,
        offset,
        now,
        now - ignitedAt,
        power,
        width,
        height,
      );
    },
    stop: () => {
      cancelled = true;
      eyes = null;
      tracked = null;
      tracker?.close();
      tracker = null;
    },
  };
};
