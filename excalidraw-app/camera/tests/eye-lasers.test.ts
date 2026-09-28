import { describe, expect, it } from "vitest";

import {
  EYE_LASER_HOLD_MS,
  holdEyePose,
  isEyeLaserGesture,
  mixEyePose,
} from "../jayrrCameraEyeLasers";

const gesture = (overrides: Record<string, number> = {}) =>
  new Map(
    Object.entries({
      browInnerUp: 0.7,
      eyeWideLeft: 0.65,
      eyeWideRight: 0.65,
      ...overrides,
    }),
  );

describe("eye laser gesture", () => {
  it("fires on raised brows or wide eyes", () => {
    expect(isEyeLaserGesture(gesture(), false)).toBe(true);
    expect(
      isEyeLaserGesture(
        gesture({ browInnerUp: 0, eyeWideLeft: 0.3, eyeWideRight: 0.3 }),
        false,
      ),
    ).toBe(true);
    expect(
      isEyeLaserGesture(
        gesture({ eyeWideLeft: 0, eyeWideRight: 0, browInnerUp: 0.3 }),
        false,
      ),
    ).toBe(true);
    expect(isEyeLaserGesture(new Map(), false)).toBe(false);
    expect(isEyeLaserGesture(new Map(), true)).toBe(false);
  });

  it("ignores a rest face", () => {
    expect(
      isEyeLaserGesture(
        gesture({
          browInnerUp: 0.08,
          eyeWideLeft: 0.08,
          eyeWideRight: 0.08,
        }),
        false,
      ),
    ).toBe(false);
  });

  it("stops on a hard blink even when other scores remain high", () => {
    expect(isEyeLaserGesture(gesture({ eyeBlinkLeft: 0.8 }), true)).toBe(false);
    expect(isEyeLaserGesture(gesture({ eyeBlinkRight: 0.8 }), true)).toBe(
      false,
    );
  });

  it("accepts both outer brows raised but not just one", () => {
    expect(
      isEyeLaserGesture(
        gesture({
          browInnerUp: 0,
          eyeWideLeft: 0,
          eyeWideRight: 0,
          browOuterUpLeft: 0.7,
          browOuterUpRight: 0.7,
        }),
        false,
      ),
    ).toBe(true);
    expect(
      isEyeLaserGesture(
        gesture({
          browInnerUp: 0,
          eyeWideLeft: 0,
          eyeWideRight: 0,
          browOuterUpLeft: 0.7,
        }),
        false,
      ),
    ).toBe(false);
  });

  it("holds through small score changes and releases when the gesture relaxes", () => {
    const nearThreshold = gesture({
      browInnerUp: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
    });
    expect(isEyeLaserGesture(nearThreshold, false)).toBe(false);
    expect(isEyeLaserGesture(nearThreshold, true)).toBe(true);
    expect(
      isEyeLaserGesture(
        gesture({
          browInnerUp: 0.02,
          eyeWideLeft: 0.02,
          eyeWideRight: 0.02,
        }),
        true,
      ),
    ).toBe(false);
  });

  it("keeps firing through a noisy blink score", () => {
    expect(isEyeLaserGesture(gesture({ eyeBlinkLeft: 0.4 }), true)).toBe(true);
    expect(isEyeLaserGesture(gesture({ eyeBlinkRight: 0.4 }), true)).toBe(true);
  });

  it("holds the last eye pose through a short miss, then eases to the next hit", () => {
    const first = {
      left: { x: 0.3, y: 0.4 },
      right: { x: 0.7, y: 0.4 },
    };
    const next = {
      left: { x: 0.4, y: 0.5 },
      right: { x: 0.8, y: 0.5 },
    };
    const held = holdEyePose(first, null, EYE_LASER_HOLD_MS - 1, 0);
    expect(held.eyes).toEqual(first);
    expect(holdEyePose(first, null, EYE_LASER_HOLD_MS + 1, 0).eyes).toBe(null);
    const mixed = mixEyePose(first, next);
    expect(mixed.left.x).toBeCloseTo(0.345);
    expect(mixed.left.y).toBeCloseTo(0.445);
    expect(mixed.right.x).toBeCloseTo(0.745);
    expect(mixed.right.y).toBeCloseTo(0.445);
  });
});
