import { describe, expect, it, vi } from "vitest";

import {
  CAMERA_ACCESSORIES,
  drawAccessoryPreview,
  drawCameraAccessory,
  isCameraAccessory,
} from "../jayrrCameraAccessories";

const cameraCanvas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  return canvas;
};

describe("webcam accessories", () => {
  it.each(CAMERA_ACCESSORIES)(
    "renders $name in the webcam and its menu preview",
    ({ id, name }) => {
      expect(name.split(/\s+/).length).toBeLessThanOrEqual(2);
      const canvas = cameraCanvas();
      const ctx = canvas.getContext("2d")!;
      const draw = vi.spyOn(ctx, "drawImage");
      drawCameraAccessory(
        ctx,
        id,
        { x: 0, y: 0, s: 0.35, rz: 0, ok: true },
        { x: 0, y: 0 },
      );
      expect(draw).toHaveBeenCalledOnce();
      const texture = draw.mock.calls[0][0] as HTMLCanvasElement;
      expect(texture.ownerDocument).toBe(canvas.ownerDocument);
      expect(texture.width).toBeGreaterThan(0);
      expect(texture.height).toBeGreaterThan(0);
      const preview = document.createElement("canvas");
      preview.width = 96;
      preview.height = 64;
      const previewDraw = vi.spyOn(preview.getContext("2d")!, "drawImage");
      drawAccessoryPreview(preview, id);
      const call = previewDraw.mock.calls[0];
      expect(call[0]).toBe(texture);
      const destWidth = Number(call[call.length === 9 ? 7 : 3]);
      const destHeight = Number(call[call.length === 9 ? 8 : 4]);
      expect(
        Math.max(destWidth / preview.width, destHeight / preview.height),
      ).toBeCloseTo(1);
    },
  );

  it("follows the existing glasses eye-line, face size, tilt and position offsets", () => {
    const ctx = cameraCanvas().getContext("2d")!;
    const translate = vi.spyOn(ctx, "translate");
    const rotate = vi.spyOn(ctx, "rotate");
    const scale = vi.spyOn(ctx, "scale");
    const restore = vi.spyOn(ctx, "restore");
    drawCameraAccessory(
      ctx,
      "sport-shades",
      { x: 0.2, y: -0.1, s: 0.25, rz: 0.3, ok: true },
      { x: 12, y: -8 },
    );
    expect(translate.mock.calls[0][0]).toBeCloseTo(780);
    expect(translate.mock.calls[0][1]).toBeCloseTo(304.8);
    expect(rotate).toHaveBeenCalledWith(-0.3);
    expect(scale).toHaveBeenCalledWith(0.8, 0.8);
    expect(restore).toHaveBeenCalledOnce();
  });

  it("applies a user scale on top of the face-size scale", () => {
    const ctx = cameraCanvas().getContext("2d")!;
    const scale = vi.spyOn(ctx, "scale");
    drawCameraAccessory(
      ctx,
      "sport-shades",
      { x: 0.2, y: -0.1, s: 0.25, rz: 0.3, ok: true },
      { x: 12, y: -8, scale: 2 },
    );
    expect(scale).toHaveBeenCalledWith(1.6, 1.6);
  });

  it("hides the accessory when face tracking is lost", () => {
    const ctx = cameraCanvas().getContext("2d")!;
    const draw = vi.spyOn(ctx, "drawImage");
    drawCameraAccessory(
      ctx,
      "puppy",
      { x: 0, y: 0, s: 0.35, rz: 0, ok: false },
      { x: 0, y: 0 },
    );
    expect(draw).not.toHaveBeenCalled();
  });

  it("accepts the original glasses and rejects invalid stored selections", () => {
    expect(isCameraAccessory("glasses")).toBe(true);
    expect(isCameraAccessory("sport-shades")).toBe(true);
    expect(isCameraAccessory(null)).toBe(false);
    expect(isCameraAccessory("unknown")).toBe(false);
  });
});
