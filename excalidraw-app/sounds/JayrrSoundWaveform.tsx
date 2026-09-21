import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  amplitudeToWaveScale,
  loadPeaks,
  resamplePeaks,
  slicePeaks,
} from "../data/jayrrSoundLoudness";

type WaveformTone = "idle" | "playing";

type JayrrSoundWaveformProps = {
  sources: string[];
  tone?: WaveformTone;
  progress?: number;
  /** Clip window into the source, 0–1. */
  start?: number;
  end?: number;
  /** Time runs left-to-right (`x`) or top-to-bottom (`y`). */
  axis?: "x" | "y";
  /** Clip gain 0–1. Applied before dB height mapping. */
  volume?: number;
  className?: string;
};

const withAlpha = (color: string, alpha: number) => {
  const hex = color.trim();
  if (hex.startsWith("#") && (hex.length === 7 || hex.length === 4)) {
    const n =
      hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
    const r = Number.parseInt(n.slice(1, 3), 16);
    const g = Number.parseInt(n.slice(3, 5), 16);
    const b = Number.parseInt(n.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
};

const barGradient = (
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  color: string,
  axis: "x" | "y",
) => {
  const gradient =
    axis === "x"
      ? ctx.createLinearGradient(0, from, 0, to)
      : ctx.createLinearGradient(from, 0, to, 0);
  gradient.addColorStop(0, withAlpha(color, 0));
  gradient.addColorStop(0.38, withAlpha(color, 0.85));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(0.62, withAlpha(color, 0.85));
  gradient.addColorStop(1, withAlpha(color, 0));
  return gradient;
};

const readTone = (node: HTMLElement, playing: boolean) => {
  const styles = node.ownerDocument.defaultView?.getComputedStyle(node);
  const rest = styles?.getPropertyValue("--color-gray-40").trim() || "#9ca3af";
  const played =
    styles?.getPropertyValue("--color-primary").trim() || "#6965db";
  return playing ? played : rest;
};

export const JayrrSoundWaveform = memo(
  ({
    sources,
    tone = "idle",
    progress = 0,
    start = 0,
    end = 1,
    axis = "x",
    volume = 1,
    className,
  }: JayrrSoundWaveformProps) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const peaksRef = useRef<Float32Array | null>(null);
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState(0);
    const srcKey = sources.filter(Boolean).join("|");

    useEffect(() => {
      const el = wrapRef.current;
      if (!el) {
        return;
      }
      const view = el.ownerDocument.defaultView;
      if (!view) {
        return;
      }
      const io = new view.IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setVisible(true);
          }
        },
        { rootMargin: "160px 0px" },
      );
      io.observe(el);
      return () => io.disconnect();
    }, []);

    useEffect(() => {
      if (!visible || !srcKey) {
        return;
      }
      let cancelled = false;
      peaksRef.current = null;
      setVersion((n) => n + 1);
      void loadPeaks(srcKey.split("|").filter(Boolean)).then((peaks) => {
        if (cancelled || !peaks) {
          return;
        }
        peaksRef.current = peaks;
        setVersion((n) => n + 1);
      });
      return () => {
        cancelled = true;
      };
    }, [srcKey, visible]);

    useLayoutEffect(() => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) {
        return;
      }
      const view = wrap.ownerDocument.defaultView;
      if (!view) {
        return;
      }

      const draw = () => {
        const width = wrap.clientWidth;
        const height = wrap.clientHeight;
        if (width < 2 || height < 2) {
          return;
        }

        const dpr = view.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const color = readTone(wrap, tone === "playing");
        const span = axis === "x" ? width : height;
        const thick = axis === "x" ? height : width;
        const mid = Math.floor(thick / 2) + 0.5;
        const peaks = peaksRef.current;

        if (!peaks) {
          ctx.strokeStyle = withAlpha(color, 0.45);
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (axis === "x") {
            ctx.moveTo(0, mid);
            ctx.lineTo(width, mid);
          } else {
            ctx.moveTo(mid, 0);
            ctx.lineTo(mid, height);
          }
          ctx.stroke();
          return;
        }

        const windowed = slicePeaks(peaks, start, end);
        const barCount = Math.max(32, Math.floor(span / 2));
        const bars = resamplePeaks(windowed, barCount);
        const gap = 1;
        const step = span / barCount;
        const barW = Math.max(1, step - gap);
        const gain =
          Number.isFinite(volume) && volume > 0 ? Math.min(1, volume) : 0;

        for (let i = 0; i < barCount; i += 1) {
          const amp =
            amplitudeToWaveScale((bars[i] ?? 0) * gain) * (thick * 0.48);
          if (amp < 0.5) {
            continue;
          }
          const played = i / barCount < progress;
          const fill = played
            ? color
            : withAlpha(color, tone === "playing" ? 1 : 0.85);
          if (axis === "x") {
            const top = mid - amp;
            ctx.fillStyle = barGradient(ctx, top, mid + amp, fill, "x");
            ctx.fillRect(i * step, top, barW, amp * 2);
          } else {
            const left = mid - amp;
            ctx.fillStyle = barGradient(ctx, left, mid + amp, fill, "y");
            ctx.fillRect(left, i * step, amp * 2, barW);
          }
        }

        if (progress > 0) {
          ctx.fillStyle = withAlpha(color, 0.85);
          if (axis === "x") {
            const x = Math.min(width - 2, Math.max(0, progress * width));
            ctx.fillRect(x, 0, 2, height);
          } else {
            const y = Math.min(height - 2, Math.max(0, progress * height));
            ctx.fillRect(0, y, width, 2);
          }
        }
      };

      draw();
      const ro = new view.ResizeObserver(draw);
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [axis, end, progress, start, tone, version, volume]);

    return (
      <div
        ref={wrapRef}
        className={className ?? "jayrr-sound-wave"}
        aria-hidden
      >
        <canvas ref={canvasRef} className="jayrr-sound-wave__canvas" />
      </div>
    );
  },
);
