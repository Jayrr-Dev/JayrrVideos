import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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

import { PlusIcon } from "@excalidraw/excalidraw/components/icons";

import {
  clipLaneId,
  EDITOR_PX_PER_SECOND,
  formatEditorClock,
  MAX_STACK_LANES,
  SEQUENCE_LANE_ID,
  type EditorClip,
  type EditorTimeline,
} from "./buildEditorTimeline";
import { filmstripSliceCount, getClipFilmstrip } from "./captureClipFilmstrip";

type ZoomMode = "fit" | "fixed";

const LANE_PREFIX = "lane:";

const laneDroppableId = (laneId: string) => `${LANE_PREFIX}${laneId}`;

const parseLaneDroppable = (id: string) =>
  id.startsWith(LANE_PREFIX) ? id.slice(LANE_PREFIX.length) : null;

type JayrrEditorTimelineProps = {
  timeline: EditorTimeline;
  currentTimeMs: number;
  selectedClipIds: ReadonlySet<string>;
  playheadClipId: string | null;
  zoomMode: ZoomMode;
  stackLaneIds: readonly string[];
  disabled?: boolean;
  emptyAction?: ReactNode;
  onSeek: (timeMs: number) => void;
  onSelectClip: (clip: EditorClip, opts?: { toggle?: boolean }) => void;
  onMoveClip: (args: {
    clipId: string;
    toLaneId: string;
    timeMs: number;
    overClipId?: string | null;
  }) => void;
  onAddStackLane: () => void;
};

const msToPx = (ms: number, pxPerMs: number) => ms * pxPerMs;

const RULER_TICK_MS = 1000;
const TRACK_PAD_PX = 10;

const collideLanes: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  const onClips = pointerHits.filter(
    (hit) => !String(hit.id).startsWith(LANE_PREFIX),
  );
  if (onClips.length > 0) {
    return onClips;
  }
  if (pointerHits.length > 0) {
    return pointerHits;
  }
  return rectIntersection(args);
};

export const JayrrEditorTimeline = ({
  timeline,
  currentTimeMs,
  selectedClipIds,
  playheadClipId,
  zoomMode,
  stackLaneIds,
  disabled,
  emptyAction,
  onSeek,
  onSelectClip,
  onMoveClip,
  onAddStackLane,
}: JayrrEditorTimelineProps) => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const draggingSeekRef = useRef(false);
  const skipClickRef = useRef(false);
  const [bodyHeight, setBodyHeight] = useState(360);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const clipsById = useMemo(() => {
    const map = new Map<string, EditorClip>();
    for (const clip of timeline.sequence) {
      map.set(clip.id, clip);
    }
    for (const clip of timeline.overlays) {
      map.set(clip.id, clip);
    }
    return map;
  }, [timeline.overlays, timeline.sequence]);

  const overlaysByLane = useMemo(() => {
    const map = new Map<string, EditorClip[]>();
    for (const laneId of stackLaneIds) {
      map.set(laneId, []);
    }
    for (const clip of timeline.overlays) {
      const laneId = clipLaneId(clip);
      const list = map.get(laneId);
      if (list) {
        list.push(clip);
        continue;
      }
      map.set(laneId, [clip]);
    }
    return map;
  }, [stackLaneIds, timeline.overlays]);

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
    return Math.max(0.02, (bodyHeight - TRACK_PAD_PX * 2) / total);
  }, [bodyHeight, timeline.totalMs, zoomMode]);

  const totalHeight = Math.max(
    80,
    msToPx(timeline.totalMs, pxPerMs) + TRACK_PAD_PX * 2,
  );
  const playheadTop = TRACK_PAD_PX + msToPx(currentTimeMs, pxPerMs);

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
      const y = clientY - rect.top + body.scrollTop - TRACK_PAD_PX;
      const ms = y / pxPerMs;
      return Math.max(0, Math.min(Math.max(timeline.totalMs, 1), ms));
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

  const onDragStart = (event: DragStartEvent) => {
    setActiveClipId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveClipId(null);
    if (!over) {
      return;
    }
    const clipId = String(active.id);
    const overId = String(over.id);
    if (clipId === overId) {
      return;
    }
    const laneFromDrop = parseLaneDroppable(overId);
    const overClip = clipsById.get(overId);
    const toLaneId = laneFromDrop ?? (overClip ? clipLaneId(overClip) : null);
    if (!toLaneId) {
      return;
    }
    const activator = event.activatorEvent as { clientY?: number };
    const clientY =
      typeof activator.clientY === "number"
        ? activator.clientY + event.delta.y
        : event.active.rect.current.translated?.top;
    const timeMs =
      typeof clientY === "number"
        ? timeFromClientY(clientY)
        : overClip?.startMs ?? 0;
    skipClickRef.current = true;
    onMoveClip({
      clipId,
      toLaneId,
      timeMs,
      overClipId:
        overClip && clipLaneId(overClip) === SEQUENCE_LANE_ID
          ? overClip.id
          : null,
    });
  };

  const canAddStackLane = stackLaneIds.length < MAX_STACK_LANES;
  const laneCountStyle = {
    ["--jayrr-editor-lanes" as string]: String(1 + stackLaneIds.length),
  } as CSSProperties;
  const activeClip = activeClipId ? clipsById.get(activeClipId) : null;
  const hasClips = timeline.sequence.length + timeline.overlays.length > 0;

  return (
    <div className="jayrr-editor-timeline" style={laneCountStyle}>
      <div className="jayrr-editor-timeline__head">
        <div className="jayrr-editor-timeline__col-label jayrr-editor-timeline__col-label--ruler">
          Time
        </div>
        <LaneHeader
          label="Sequence"
          addDisabled={!canAddStackLane}
          onAdd={onAddStackLane}
        />
        {stackLaneIds.map((laneId, index) => (
          <LaneHeader key={laneId} label={`Stack ${index + 1}`} />
        ))}
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
        <DndContext
          sensors={sensors}
          collisionDetection={collideLanes}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveClipId(null)}
        >
          <div
            className="jayrr-editor-timeline__tracks"
            style={{ height: totalHeight }}
          >
            <TimelineRuler ticks={ticks} pxPerMs={pxPerMs} />
            <TrackLane laneId={SEQUENCE_LANE_ID} packed>
              {timeline.sequence.map((clip) => (
                <TimelineClip
                  key={clip.id}
                  clip={clip}
                  pxPerMs={pxPerMs}
                  selected={selectedClipIds.has(clip.id)}
                  playhead={playheadClipId === clip.id}
                  packed
                  hidden={activeClipId === clip.id}
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
            </TrackLane>
            {stackLaneIds.map((laneId) => (
              <TrackLane key={laneId} laneId={laneId}>
                {(overlaysByLane.get(laneId) ?? []).map((clip) => (
                  <TimelineClip
                    key={clip.id}
                    clip={clip}
                    pxPerMs={pxPerMs}
                    selected={selectedClipIds.has(clip.id)}
                    playhead={playheadClipId === clip.id}
                    hidden={activeClipId === clip.id}
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
              </TrackLane>
            ))}
            <div
              className="jayrr-editor-timeline__playhead"
              style={{ top: playheadTop }}
              aria-hidden
            />
          </div>
          <DragOverlay dropAnimation={null}>
            {activeClip ? (
              <div className="jayrr-editor-timeline__drag-ghost">
                <ClipFace
                  clip={activeClip}
                  pxPerMs={pxPerMs}
                  selected={selectedClipIds.has(activeClip.id)}
                  playhead={playheadClipId === activeClip.id}
                  packed
                  dragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {!hasClips && emptyAction ? (
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

const LaneHeader = ({
  label,
  addDisabled,
  onAdd,
}: {
  label: string;
  addDisabled?: boolean;
  onAdd?: () => void;
}) => (
  <div className="jayrr-editor-timeline__col-label jayrr-editor-timeline__col-label--sequence">
    <span>{label}</span>
    {onAdd ? (
      <button
        type="button"
        className="jayrr-editor-timeline__add-lane"
        aria-label="Add stack column"
        title="Add stack column"
        disabled={addDisabled}
        onClick={(event) => {
          event.stopPropagation();
          onAdd();
        }}
      >
        {PlusIcon}
      </button>
    ) : null}
  </div>
);

const TimelineRuler = ({
  ticks,
  pxPerMs,
}: {
  ticks: readonly number[];
  pxPerMs: number;
}) => (
  <div className="jayrr-editor-timeline__ruler">
    {ticks.map((t) => (
      <div
        key={t}
        className="jayrr-editor-timeline__tick"
        style={{ top: TRACK_PAD_PX + msToPx(t, pxPerMs) }}
      >
        {formatEditorClock(t)}
      </div>
    ))}
  </div>
);

const TrackLane = ({
  laneId,
  packed,
  children,
}: {
  laneId: string;
  packed?: boolean;
  children: ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: laneDroppableId(laneId),
  });
  return (
    <div
      ref={setNodeRef}
      className={`jayrr-editor-timeline__lane${
        packed
          ? " jayrr-editor-timeline__lane--sequence"
          : " jayrr-editor-timeline__lane--stack"
      }${isOver ? " is-drop-target" : ""}`}
    >
      {children}
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

const ClipFace = ({
  clip,
  pxPerMs,
  selected,
  playhead,
  dragging,
  hidden,
  packed,
  style,
  buttonRef,
  draggableProps,
  onSelect,
}: {
  clip: EditorClip;
  pxPerMs: number;
  selected: boolean;
  playhead: boolean;
  dragging?: boolean;
  hidden?: boolean;
  packed?: boolean;
  style?: CSSProperties;
  buttonRef?: (node: HTMLButtonElement | null) => void;
  draggableProps?: Record<string, unknown>;
  onSelect?: (toggle: boolean) => void;
}) => {
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      buttonRef?.(node);
    },
    [buttonRef],
  );
  const heightPx = Math.max(18, msToPx(clip.durationMs, pxPerMs));
  const sliceCount = filmstripSliceCount(heightPx);
  const [ownerDocument, setOwnerDocument] = useState<Document | null>(null);
  useLayoutEffect(() => {
    setOwnerDocument(innerRef.current?.ownerDocument ?? null);
  }, []);
  const frames = useClipFilmstripFrames(clip, sliceCount, ownerDocument);
  const slices = filmstripSources(sliceCount, frames, clip.posterUrl);
  const top = packed ? undefined : TRACK_PAD_PX + msToPx(clip.startMs, pxPerMs);
  const mergedStyle: CSSProperties = {
    height: heightPx,
    ...(top === undefined ? {} : { top }),
    ["--jayrr-editor-slice-count" as string]: String(Math.max(1, sliceCount)),
    ...style,
  };

  return (
    <button
      ref={setRefs}
      type="button"
      className={`jayrr-editor-clip jayrr-editor-clip--recording${
        packed ? "" : " jayrr-editor-clip--overlay"
      }${selected ? " is-selected" : ""}${playhead ? " is-playhead" : ""}${
        dragging ? " is-dragging" : ""
      }${hidden ? " is-hidden" : ""}`}
      style={mergedStyle}
      title={clip.label}
      {...draggableProps}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        const toggle = event.ctrlKey || event.metaKey;
        onSelect?.(toggle);
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

const TimelineClip = ({
  clip,
  pxPerMs,
  selected,
  playhead,
  packed,
  hidden,
  onSelect,
}: {
  clip: EditorClip;
  pxPerMs: number;
  selected: boolean;
  playhead: boolean;
  packed?: boolean;
  hidden?: boolean;
  onSelect: (toggle: boolean) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: clip.id,
  });

  return (
    <ClipFace
      clip={clip}
      pxPerMs={pxPerMs}
      selected={selected}
      playhead={playhead}
      packed={packed}
      hidden={hidden || isDragging}
      buttonRef={setNodeRef}
      draggableProps={{ ...attributes, ...listeners }}
      onSelect={onSelect}
    />
  );
};
