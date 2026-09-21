import { describe, expect, it } from "vitest";

import { amplitudeToWaveScale, WAVEFORM_DB_FLOOR } from "./jayrrSoundLoudness";

describe("amplitudeToWaveScale", () => {
  it("maps full scale to the clip height", () => {
    expect(amplitudeToWaveScale(1)).toBe(1);
  });

  it("maps the display floor and below to silence", () => {
    const floorAmp = 10 ** (WAVEFORM_DB_FLOOR / 20);
    expect(amplitudeToWaveScale(floorAmp)).toBe(0);
    expect(amplitudeToWaveScale(0)).toBe(0);
    expect(amplitudeToWaveScale(-1)).toBe(0);
  });

  it("maps -24 dB to half height with a -48 dB floor", () => {
    expect(amplitudeToWaveScale(10 ** (-24 / 20))).toBeCloseTo(0.5, 5);
  });
});
