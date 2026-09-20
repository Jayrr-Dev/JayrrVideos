import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

import {
  EDITOR_PX_PER_SECOND,
  formatEditorClock,
  type EditorClip,
  type EditorTimeline,
} from "./buildEditorTimeline";
import { filmstripSliceCount, getClipFilmstrip } from "./captureClipFilmstrip";

type ZoomMode = "fit" | "fixed";

type JayrrEditorTimelineProps = {
  timeline: EditorTimeline;
  currentTimeMs: number;
  selectedClipIds: ReadonlySet<string>;
  playheadClipId: string | null;
  zoomMode: ZoomMode;
  disabled?: boolean;
  emptyAction?: ReactNode;
  onSeek: (timeMs: number) => void;
  onSelectClip: (clip: EditorClip, opts?: { toggle?: boolean }) => void;
  onReorderClips: (orderedIds: readonly string[]) => void;
};

const msToPx = (ms: number, pxPerMs: number) => ms * pxPerMs;

const RULER_TICK_MS = 1000;

export const JayrrEditorTimeline = ({
  timeline,
  currentTimeMs,
  selectedClipIds,
  playheadClipId,
  zoomMode,
  disabled,
  emptyAction,
  onSeek,
  onSelectClip,
  onReorderClips,
}: JayrrEditorTimelineProps) => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const draggingSeekRef = useRef(false);
  const skipClickRef = useRef(false);
  const [bodyHeight, setBodyHeight] = useState(360);

  const clipIds = useMemo(
    () => timeline.sequence.map((clip) => clip.id),
    [timeline.sequence],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

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
    draggingSeekRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onSeek(timeFromClientY(event.clientY));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingSeekRef.current) {
      return;
    }
    onSeek(timeFromClientY(event.clientY));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingSeekRef.current) {
      return;
    }
    draggingSeekRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = clipIds.indexOf(String(active.id));
    const newIndex = clipIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    skipClickRef.current = true;
    onReorderClips(arrayMove(clipIds, oldIndex, newIndex));
  };

  const canReorder = clipIds.length >= 2;

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={clipIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="jayrr-editor-timeline__lane jayrr-editor-timeline__lane--sequence">
                {timeline.sequence.map((clip) => (
                  <SequenceClip
                    key={clip.id}
                    clip={clip}
                    pxPerMs={pxPerMs}
                    selected={selectedClipIds.has(clip.id)}
                    playhead={playheadClipId === clip.id}
                    reorderDisabled={!canReorder}
                    onSelect={(toggle) => {
                      if (skipClickRef.current) {
                        skipClickRef.current = false;
                        return;
                      }
                      onSelectClip(clip, { toggle });
                      if (!toggle) {
                        onSeek(clip.startMs);
                      }
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div
            className="jayrr-editor-timeline__playhead"
            style={{ top: playheadTop }}
            aria-hidden
          />
        </div>
        {timeline.sequence.length === 0 && emptyAction ? (
          <div
            className="jayrr-editor-timeline__empty"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {emptyAction}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const useClipFilmstripFrames = (
  clip: EditorClip,
  sliceCount: number,
  ownerDocument: Document | null,
) => {
  const [frames, setFrames] = useState<readonly string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFrames(null);
    if (!clip.url || !ownerDocument) {
      return;
    }
    void getClipFilmstrip({
      url: clip.url,
      sourceOffsetMs: clip.sourceOffsetMs ?? 0,
      durationMs: clip.durationMs,
      sliceCount,
      ownerDocument,
    }).then((next) => {
      if (!cancelled) {
        setFrames(next.length > 0 ? next : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    clip.url,
    clip.durationMs,
    clip.sourceOffsetMs,
    ownerDocument,
    sliceCount,
  ]);

  return frames;
};

const filmstripSources = (
  sliceCount: number,
  frames: readonly string[] | null,
  posterUrl: string | null,
): readonly string[] => {
  if (frames && frames.length > 0) {
    if (frames.length === sliceCount) {
      return frames;
    }
    const out: string[] = [];
    for (let i = 0; i < sliceCount; i++) {
      const src = frames[Math.min(frames.length - 1, i)];
      if (src) {
        out.push(src);
      }
    }
    return out;
  }
  if (!posterUrl) {
    return [];
  }
  return Array.from({ length: sliceCount }, () => posterUrl);
};

const SequenceClip = ({
  clip,
  pxPerMs,
  selected,
  playhead,
  reorderDisabled,
  onSelect,
}: {
  clip: EditorClip;
  pxPerMs: number;
  selected: boolean;
  playhead: boolean;
  reorderDisabled?: boolean;
  onSelect: (toggle: boolean) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id, disabled: reorderDisabled });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  const heightPx = Math.max(18, msToPx(clip.durationMs, pxPerMs));
  const sliceCount = filmstripSliceCount(heightPx);
  const [ownerDocument, setOwnerDocument] = useState<Document | null>(null);
  useLayoutEffect(() => {
    setOwnerDocument(buttonRef.current?.ownerDocument ?? null);
  }, []);
  const frames = useClipFilmstripFrames(clip, sliceCount, ownerDocument);
  const slices = filmstripSources(sliceCount, frames, clip.posterUrl);

  const style: CSSProperties = {
    height: heightPx,
    transform: CSS.Transform.toString(transform),
    transition,
    ["--jayrr-editor-slice-count" as string]: String(Math.max(1, sliceCount)),
  };

  return (
    <button
      ref={setRefs}
      type="button"
      className={`jayrr-editor-clip jayrr-editor-clip--recording${
        selected ? " is-selected" : ""
      }${playhead ? " is-playhead" : ""}${isDragging ? " is-dragging" : ""}`}
      style={style}
      title={clip.label}
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        const toggle = event.ctrlKey || event.metaKey;
        onSelect(toggle);
      }}
    >
      <span className="jayrr-editor-clip__filmstrip" aria-hidden>
        {slices.map((src, index) => (
          <span key={`${clip.id}-${index}`} className="jayrr-editor-clip__cell">
            <img
              className="jayrr-editor-clip__slice"
              src={src}
              alt=""
              draggable={false}
            />
          </span>
        ))}
      </span>
      <span className="jayrr-editor-clip__label">{clip.label}</span>
    </button>
  );
};
