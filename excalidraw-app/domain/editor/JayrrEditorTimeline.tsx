import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import {
  EDITOR_PX_PER_SECOND,
  formatEditorClock,
  type EditorClip,
  type EditorTimeline,
} from "./buildEditorTimeline";

type ZoomMode = "fit" | "fixed";

type JayrrEditorTimelineProps = {
  timeline: EditorTimeline;
  currentTimeMs: number;
  activeClipId: string | null;
  zoomMode: ZoomMode;
  disabled?: boolean;
  onSeek: (timeMs: number) => void;
  onSelectClip: (clip: EditorClip) => void;
};

const msToPx = (ms: number, pxPerMs: number) => ms * pxPerMs;

const RULER_TICK_MS = 1000;

export const JayrrEditorTimeline = ({
  timeline,
  currentTimeMs,
  activeClipId,
  zoomMode,
  disabled,
  onSeek,
  onSelectClip,
}: JayrrEditorTimelineProps) => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [bodyHeight, setBodyHeight] = useState(360);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }
    const measure = () => {
      setBodyHeight(body.clientHeight || 360);
    };
    measure();
    const ownerWindow = body.ownerDocument.defaultView;
    if (!ownerWindow || typeof ResizeObserver === "undefined") {
      ownerWindow?.addEventListener("resize", measure);
      return () => ownerWindow?.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  const pxPerMs = useMemo(() => {
    if (zoomMode === "fixed") {
      return EDITOR_PX_PER_SECOND / 1000;
    }
    const total = Math.max(timeline.totalMs, 1);
    return Math.max(0.02, (bodyHeight - 24) / total);
  }, [bodyHeight, timeline.totalMs, zoomMode]);

  const totalHeight = Math.max(80, msToPx(timeline.totalMs, pxPerMs));
  const playheadTop = msToPx(currentTimeMs, pxPerMs);

  const ticks = useMemo(() => {
    const marks: number[] = [];
    const total = timeline.totalMs;
    for (let t = 0; t <= total; t += RULER_TICK_MS) {
      marks.push(t);
    }
    const last = marks[marks.length - 1] ?? 0;
    if (total - last >= 500) {
      marks.push(total);
    }
    return marks;
  }, [timeline.totalMs]);

  const timeFromClientY = useCallback(
    (clientY: number) => {
      const body = bodyRef.current;
      if (!body) {
        return 0;
      }
      const rect = body.getBoundingClientRect();
      const y = clientY - rect.top + body.scrollTop;
      const ms = y / pxPerMs;
      return Math.max(0, Math.min(timeline.totalMs, ms));
    },
    [pxPerMs, timeline.totalMs],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest(".jayrr-editor-clip")) {
      return;
    }
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onSeek(timeFromClientY(event.clientY));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }
    onSeek(timeFromClientY(event.clientY));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="jayrr-editor-timeline">
      <div className="jayrr-editor-timeline__head">
        <div className="jayrr-editor-timeline__col-label jayrr-editor-timeline__col-label--ruler">
          Time
        </div>
        <div className="jayrr-editor-timeline__col-label">Sequence</div>
      </div>
      <div
        ref={bodyRef}
        className="jayrr-editor-timeline__body"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label="Timeline playhead"
        aria-valuemin={0}
        aria-valuemax={Math.round(timeline.totalMs)}
        aria-valuenow={Math.round(currentTimeMs)}
        aria-valuetext={formatEditorClock(currentTimeMs)}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
      >
        <div
          className="jayrr-editor-timeline__tracks jayrr-editor-timeline__tracks--video"
          style={{ height: totalHeight }}
        >
          <div className="jayrr-editor-timeline__ruler">
            {ticks.map((t) => (
              <div
                key={t}
                className="jayrr-editor-timeline__tick"
                style={{ top: msToPx(t, pxPerMs) }}
              >
                {formatEditorClock(t)}
              </div>
            ))}
          </div>
          <div className="jayrr-editor-timeline__lane jayrr-editor-timeline__lane--sequence">
            {timeline.sequence.map((clip) => (
              <SequenceClip
                key={clip.id}
                clip={clip}
                pxPerMs={pxPerMs}
                active={activeClipId === clip.id}
                disabled={disabled}
                onSelect={() => {
                  onSelectClip(clip);
                  onSeek(clip.startMs);
                }}
              />
            ))}
          </div>
          <div
            className="jayrr-editor-timeline__playhead"
            style={{ top: playheadTop }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
};

const SequenceClip = ({
  clip,
  pxPerMs,
  active,
  disabled,
  onSelect,
}: {
  clip: EditorClip;
  pxPerMs: number;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) => {
  return (
    <button
      type="button"
      className={`jayrr-editor-clip jayrr-editor-clip--recording${
        active ? " is-active" : ""
      }`}
      style={{
        top: msToPx(clip.startMs, pxPerMs),
        height: Math.max(18, msToPx(clip.durationMs, pxPerMs) - 2),
        ...(clip.posterUrl
          ? {
              backgroundImage: `linear-gradient(90deg, rgb(30 41 59 / 78%), rgb(30 41 59 / 45%)), url(${clip.posterUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
      disabled={disabled}
      title={clip.label}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="jayrr-editor-clip__label">{clip.label}</span>
    </button>
  );
};
