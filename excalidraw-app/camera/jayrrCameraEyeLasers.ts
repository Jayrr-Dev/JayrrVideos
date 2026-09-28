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

const readEyes = (
  result: FaceLandmarkerResult,
  firing: boolean,
): EyePose | null => {
  const landmarks = result.faceLandmarks[0];
  const categories = result.faceBlendshapes[0]?.categories;
  if (
    !landmarks ||
    !categories ||
    !isEyeLaserGesture(
      new Map(
        categories.map(({ categoryName, score }) => [categoryName, score]),
      ),
      firing,
    )
  ) {
    return null;
  }
  // Iris centers in the 478-point face mesh.
  const left = landmarks[468];
  const right = landmarks[473];
  return left && right ? { left, right } : null;
};

export const createEyeLasers = (video: HTMLVideoElement) => {
  let cancelled = false;
  let tracker: FaceLandmarker | null = null;
  let eyes: EyePose | null = null;
  let lastTime = -Infinity;
  let lastGoodAt = -Infinity;
  let lastFrame = -1;

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
          const held = holdEyePose(
            eyes,
            readEyes(tracker.detectForVideo(video, now), eyes !== null),
            now,
            lastGoodAt,
          );
          eyes = held.eyes;
          lastGoodAt = held.lastGoodAt;
        } catch (error) {
          eyes = null;
          lastGoodAt = -Infinity;
          tracker.close();
          tracker = null;
          console.warn("Eye Lasers face tracking stopped", error);
        }
      }
      if (eyes && now - lastGoodAt > EYE_LASER_HOLD_MS) {
        eyes = null;
      }
      if (!eyes) {
        return;
      }
      const width = context.canvas.width;
      const height = context.canvas.height;
      const left = { x: eyes.left.x * width, y: eyes.left.y * height };
      const right = { x: eyes.right.x * width, y: eyes.right.y * height };
      const separation = Math.hypot(right.x - left.x, right.y - left.y);
      const angle = Math.atan2(right.y - left.y, right.x - left.x);
      const length = Math.hypot(width, height) * 2;
      const pulse = 1 + 0.03 * Math.sin(now / 90);
      const scale = offset.scale ?? 1;
      context.save();
      context.lineCap = "round";
      context.shadowColor = "#ff123b";
      for (const eye of [left, right]) {
        context.save();
        context.translate(eye.x + offset.x, eye.y + offset.y);
        context.rotate(angle + 0.3);
        for (const [color, thickness, blur] of [
          ["rgba(255, 0, 45, 0.25)", 0.24, 0.5],
          ["#ff1537", 0.1, 0.25],
          ["#fff2ed", 0.025, 0.1],
        ] as const) {
          context.strokeStyle = color;
          context.lineWidth = Math.max(
            1,
            separation * thickness * pulse * scale,
          );
          context.shadowBlur = separation * blur * scale;
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(length, 0);
          context.stroke();
        }
        const radius = Math.max(3, separation * 0.23 * pulse * scale);
        const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
        glow.addColorStop(0, "#ffffff");
        glow.addColorStop(0.18, "#ffb5b5");
        glow.addColorStop(0.4, "rgba(255, 0, 35, 0.85)");
        glow.addColorStop(1, "rgba(255, 0, 35, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      context.restore();
    },
    stop: () => {
      cancelled = true;
      eyes = null;
      tracker?.close();
      tracker = null;
    },
  };
};
