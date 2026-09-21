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
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
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

import {
  BringForwardIcon,
  BringToFrontIcon,
  checkIcon,
  CloseIcon,
  PlusIcon,
  SendBackwardIcon,
  SendToBackIcon,
} from "@excalidraw/excalidraw/components/icons";
import { DropdownMenu } from "radix-ui";

import {
  clipLaneId,
  collectLaneOverlaps,
  collectOverlapBands,
  collectSnapPointsMs,
  EDITOR_AUDIO_TYPE,
  EDITOR_HTML_TYPE,
  EDITOR_SOUND_TYPE,
  EDITOR_STATIC_TYPE,
  EDITOR_TRANSITION_OPTIONS,
  formatEditorClock,
  isEditorHtmlClip,
  isEditorStaticClip,
  MAX_STACK_LANES,
  resolveClipResize,
  SEQUENCE_LANE_ID,
  snapClipStart,
  snapTimeMs,
  type EditorBlendMode,
  type EditorClip,
  type EditorClipEdge,
  type EditorLayerDirection,
  type EditorTimeline,
  type EditorTransitionKind,
  type OverlapBand,
} from "./buildEditorTimeline";
import { filmstripSliceCount, getClipFilmstrip } from "./captureClipFilmstrip";

type ZoomMode = "fit" | "fixed";

const LANE_PREFIX = "lane:";

const laneDroppableId = (laneId: string) => `${LANE_PREFIX}${laneId}`;

const parseLaneDroppable = (id: string) =>
  id.startsWith(LANE_PREFIX) ? id.slice(LANE_PREFIX.length) : null;

type DragPlacement = {
  clipId: string;
  toLaneId: string;
  /** Pointer-driven start before snap. */
  rawStartMs: number;
  startMs: number;
  guideMs: number | null;
  durationMs: number;
};

type TrimDraft = {
  clipId: string;
  startMs: number;
  durationMs: number;
  sourceOffsetMs: number;
  guideMs: number | null;
  edgeMs: number;
};

type JayrrEditorTimelineProps = {
  timeline: EditorTimeline;
  currentTimeMs: number;
  selectedClipIds: ReadonlySet<string>;
  playheadClipId: string | null;
  zoomMode: ZoomMode;
  pxPerSecond: number;
  stackLaneIds: readonly string[];
  disabled?: boolean;
  emptyAction?: ReactNode;
  onSeek: (timeMs: number) => void;
  onSelectClip: (clip: EditorClip, opts?: { toggle?: boolean }) => void;
  onMoveClip: (args: {
    clipId: string;
    toLaneId: string;
    startMs: number;
  }) => void;
  onResizeClip: (args: {
    clipId: string;
    edge: EditorClipEdge;
    edgeMs: number;
  }) => void;
  onRestoreClipEdge: (args: { clipId: string; edge: EditorClipEdge }) => void;
  onSetTransition: (
    clipIds: readonly string[],
    kind: EditorTransitionKind,
  ) => void;
  onOpenBlend: (args: {
    clipIds: readonly string[];
    blendMode: EditorBlendMode;
  }) => void;
  overlapLayerMoves: (
    band: OverlapBand,
  ) => Record<EditorLayerDirection, boolean>;
  onReorderOverlap: (
    band: OverlapBand,
    direction: EditorLayerDirection,
  ) => void;
  onAddStackLane: () => void;
  onRemoveStackLane: (laneId: string) => void;
  menuContainer?: HTMLElement | null;
};

const msToPx = (ms: number, pxPerMs: number) => ms * pxPerMs;

const RULER_TICK_MS = 1000;
const TRACK_PAD_PX = 10;
const SNAP_THRESHOLD_PX = 8;
const CLIP_SHADE_COUNT = 5;

const clipShadeIndex = (clipId: string) => {
  let hash = 0;
  for (let i = 0; i < clipId.length; i++) {
    hash = (hash << 5) - hash + clipId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % CLIP_SHADE_COUNT;
};

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
  pxPerSecond,
  stackLaneIds,
  disabled,
  emptyAction,
  onSeek,
  onSelectClip,
  onMoveClip,
  onResizeClip,
  onRestoreClipEdge,
  onSetTransition,
  onOpenBlend,
  overlapLayerMoves,
  onReorderOverlap,
  onAddStackLane,
  onRemoveStackLane,
  menuContainer,
}: JayrrEditorTimelineProps) => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const draggingSeekRef = useRef(false);
  const skipClickRef = useRef(false);
  const altHeldRef = useRef(false);
  const placementRef = useRef<DragPlacement | null>(null);
  const trimRef = useRef<TrimDraft | null>(null);
  const trimSessionRef = useRef<{
    clip: EditorClip;
    edge: EditorClipEdge;
  } | null>(null);
  const [bodyHeight, setBodyHeight] = useState(360);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<DragPlacement | null>(null);
  const [trimDraft, setTrimDraft] = useState<TrimDraft | null>(null);
  const [hoveredStackId, setHoveredStackId] = useState<string | null>(null);

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

  const laneOverlaps = useMemo(
    () =>
      collectLaneOverlaps([
        { laneId: SEQUENCE_LANE_ID, clips: timeline.sequence },
        ...stackLaneIds.map((laneId) => ({
          laneId,
          clips: overlaysByLane.get(laneId) ?? [],
        })),
      ]),
    [overlaysByLane, stackLaneIds, timeline.sequence],
  );

  const overlapBands = useMemo(
    () =>
      collectOverlapBands(laneOverlaps, [SEQUENCE_LANE_ID, ...stackLaneIds]),
    [laneOverlaps, stackLaneIds],
  );

  const laneIndexById = useMemo(() => {
    const map = new Map<string, number>();
    map.set(SEQUENCE_LANE_ID, 0);
    stackLaneIds.forEach((laneId, index) => {
      map.set(laneId, index + 1);
    });
    return map;
  }, [stackLaneIds]);

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
      return pxPerSecond / 1000;
    }
    const total = Math.max(timeline.totalMs, 1);
    return Math.max(0.02, (bodyHeight - TRACK_PAD_PX * 2) / total);
  }, [bodyHeight, pxPerSecond, timeline.totalMs, zoomMode]);

  const snapThresholdMs = SNAP_THRESHOLD_PX / pxPerMs;

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
    (clientY: number, clampToTimeline = true) => {
      const body = bodyRef.current;
      if (!body) {
        return 0;
      }
      const rect = body.getBoundingClientRect();
      const y = clientY - rect.top + body.scrollTop - TRACK_PAD_PX;
      const ms = y / pxPerMs;
      if (!clampToTimeline) {
        return Math.max(0, ms);
      }
      return Math.max(0, Math.min(Math.max(timeline.totalMs, 1), ms));
    },
    [pxPerMs, timeline.totalMs],
  );

  const clearPlacement = useCallback(() => {
    placementRef.current = null;
    setPlacement(null);
  }, []);

  const updatePlacement = useCallback((next: DragPlacement | null) => {
    placementRef.current = next;
    setPlacement(next);
  }, []);

  useEffect(() => {
    if (!activeClipId) {
      altHeldRef.current = false;
      return;
    }
    const body = bodyRef.current;
    const doc = body?.ownerDocument;
    if (!doc) {
      return;
    }
    const applyAlt = (held: boolean) => {
      if (altHeldRef.current === held) {
        return;
      }
      altHeldRef.current = held;
      const clip = clipsById.get(activeClipId);
      const current = placementRef.current;
      if (!clip || !current) {
        return;
      }
      if (held) {
        updatePlacement({
          ...current,
          startMs: Math.round(current.rawStartMs),
          guideMs: null,
        });
        return;
      }
      const snapped = snapClipStart({
        startMs: current.rawStartMs,
        durationMs: clip.durationMs,
        snapPoints: collectSnapPointsMs({
          timeline,
          excludeClipId: clip.id,
          playheadMs: currentTimeMs,
        }),
        thresholdMs: snapThresholdMs,
      });
      updatePlacement({
        ...current,
        startMs: snapped.startMs,
        guideMs: snapped.guideMs,
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        applyAlt(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        applyAlt(false);
      }
    };
    doc.addEventListener("keydown", onKeyDown);
    doc.addEventListener("keyup", onKeyUp);
    return () => {
      doc.removeEventListener("keydown", onKeyDown);
      doc.removeEventListener("keyup", onKeyUp);
    };
  }, [
    activeClipId,
    clipsById,
    currentTimeMs,
    snapThresholdMs,
    timeline,
    updatePlacement,
  ]);

  const pxPerMsRef = useRef(pxPerMs);
  pxPerMsRef.current = pxPerMs;
  const snapThresholdMsRef = useRef(snapThresholdMs);
  snapThresholdMsRef.current = snapThresholdMs;
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const currentTimeMsRef = useRef(currentTimeMs);
  currentTimeMsRef.current = currentTimeMs;
  const clipsByIdRef = useRef(clipsById);
  clipsByIdRef.current = clipsById;

  const resolveTargetLane = useCallback(
    (overId: string | null | undefined, fallbackLaneId: string) => {
      if (!overId) {
        return fallbackLaneId;
      }
      const laneFromDrop = parseLaneDroppable(overId);
      if (laneFromDrop) {
        return laneFromDrop;
      }
      const overClip = clipsByIdRef.current.get(overId);
      if (overClip) {
        return clipLaneId(overClip);
      }
      return fallbackLaneId;
    },
    [],
  );

  const placementFromDelta = useCallback(
    (
      clip: EditorClip,
      deltaY: number,
      overId: string | null | undefined,
    ): DragPlacement => {
      const rawStartMs = Math.max(
        0,
        clip.startMs + deltaY / pxPerMsRef.current,
      );
      const toLaneId = resolveTargetLane(overId, clipLaneId(clip));
      const base = {
        clipId: clip.id,
        toLaneId,
        rawStartMs,
        durationMs: clip.durationMs,
      };
      if (altHeldRef.current) {
        return {
          ...base,
          startMs: Math.round(rawStartMs),
          guideMs: null,
        };
      }
      const snapped = snapClipStart({
        startMs: rawStartMs,
        durationMs: clip.durationMs,
        snapPoints: collectSnapPointsMs({
          timeline: timelineRef.current,
          excludeClipId: clip.id,
          playheadMs: currentTimeMsRef.current,
        }),
        thresholdMs: snapThresholdMsRef.current,
      });
      return {
        ...base,
        startMs: snapped.startMs,
        guideMs: snapped.guideMs,
      };
    },
    [resolveTargetLane],
  );

  const snapYModifier: Modifier = useCallback(
    ({ transform, active, over }) => {
      const clipId = active ? String(active.id) : null;
      const clip = clipId ? clipsByIdRef.current.get(clipId) : null;
      if (!clip) {
        return transform;
      }
      const overId = over ? String(over.id) : null;
      const next = placementFromDelta(clip, transform.y, overId);
      placementRef.current = next;
      return {
        ...transform,
        y: msToPx(next.startMs - clip.startMs, pxPerMsRef.current),
      };
    },
    [placementFromDelta],
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
    const clipId = String(event.active.id);
    const clip = clipsById.get(clipId);
    setActiveClipId(clipId);
    if (!clip) {
      return;
    }
    updatePlacement({
      clipId,
      toLaneId: clipLaneId(clip),
      rawStartMs: clip.startMs,
      startMs: clip.startMs,
      guideMs: null,
      durationMs: clip.durationMs,
    });
  };

  const onDragMove = (event: DragMoveEvent) => {
    const clipId = String(event.active.id);
    const clip = clipsById.get(clipId);
    if (!clip) {
      return;
    }
    const overId = event.over ? String(event.over.id) : null;
    // Modifier already wrote placementRef from the same transform; refresh
    // lane from the latest over target and push React state for guides.
    const fromRef = placementRef.current;
    const next =
      fromRef?.clipId === clipId
        ? {
            ...fromRef,
            toLaneId: resolveTargetLane(overId, fromRef.toLaneId),
          }
        : placementFromDelta(clip, event.delta.y, overId);
    updatePlacement(next);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const clipId = String(event.active.id);
    const clip = clipsById.get(clipId);
    const overId = event.over ? String(event.over.id) : null;
    const next =
      placementRef.current?.clipId === clipId
        ? {
            ...placementRef.current,
            toLaneId: resolveTargetLane(overId, placementRef.current.toLaneId),
          }
        : clip
        ? placementFromDelta(clip, event.delta.y, overId)
        : null;
    setActiveClipId(null);
    clearPlacement();
    if (!next || !clip) {
      return;
    }
    if (
      next.toLaneId === clipLaneId(clip) &&
      next.startMs === Math.round(clip.startMs)
    ) {
      return;
    }
    skipClickRef.current = true;
    onMoveClip({
      clipId: next.clipId,
      toLaneId: next.toLaneId,
      startMs: next.startMs,
    });
  };

  const onDragCancel = () => {
    setActiveClipId(null);
    clearPlacement();
  };

  const updateTrimDraft = useCallback((next: TrimDraft | null) => {
    trimRef.current = next;
    setTrimDraft(next);
  }, []);

  const draftFromPointer = useCallback(
    (
      clip: EditorClip,
      edge: EditorClipEdge,
      clientY: number,
      altKey: boolean,
    ) => {
      const rawMs = timeFromClientY(clientY, false);
      const snapPoints = collectSnapPointsMs({
        timeline,
        excludeClipId: clip.id,
        playheadMs: currentTimeMs,
      });
      let edgeMs = rawMs;
      let guideMs: number | null = null;
      if (!altKey) {
        const snapped = snapTimeMs({
          timeMs: rawMs,
          snapPoints,
          thresholdMs: snapThresholdMs,
        });
        edgeMs = snapped.timeMs;
        guideMs = snapped.guideMs;
      }
      const next = resolveClipResize({
        clip,
        startMs: clip.startMs,
        edge,
        edgeMs,
      });
      const appliedEdge =
        edge === "start" ? next.startMs : next.startMs + next.durationMs;
      if (guideMs != null && appliedEdge !== guideMs) {
        guideMs = null;
      }
      return {
        clipId: clip.id,
        startMs: next.startMs,
        durationMs: next.durationMs,
        sourceOffsetMs: next.sourceOffsetMs,
        guideMs,
        edgeMs: appliedEdge,
      };
    },
    [currentTimeMs, snapThresholdMs, timeFromClientY, timeline],
  );

  const onResizePointerDown = useCallback(
    (
      clip: EditorClip,
      edge: EditorClipEdge,
      event: PointerEvent<HTMLButtonElement>,
    ) => {
      if (disabled) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      skipClickRef.current = true;
      if (event.detail >= 2) {
        trimSessionRef.current = null;
        updateTrimDraft(null);
        onRestoreClipEdge({ clipId: clip.id, edge });
        return;
      }
      trimSessionRef.current = { clip, edge };
      const draft = draftFromPointer(clip, edge, event.clientY, event.altKey);
      updateTrimDraft(draft);
      onSeek(draft.edgeMs);
      const doc = event.currentTarget.ownerDocument;
      const pointerId = event.pointerId;
      try {
        event.currentTarget.setPointerCapture(pointerId);
      } catch {
        // Synthetic or already-released pointers can reject capture.
      }

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) {
          return;
        }
        const session = trimSessionRef.current;
        if (!session) {
          return;
        }
        const next = draftFromPointer(
          session.clip,
          session.edge,
          moveEvent.clientY,
          moveEvent.altKey,
        );
        updateTrimDraft(next);
        onSeek(next.edgeMs);
      };
      const onUp = (upEvent: globalThis.PointerEvent) => {
        if (upEvent.pointerId !== pointerId) {
          return;
        }
        doc.removeEventListener("pointermove", onMove);
        doc.removeEventListener("pointerup", onUp);
        doc.removeEventListener("pointercancel", onUp);
        const session = trimSessionRef.current;
        const next = trimRef.current;
        trimSessionRef.current = null;
        updateTrimDraft(null);
        if (!session || !next || next.clipId !== session.clip.id) {
          return;
        }
        onResizeClip({
          clipId: session.clip.id,
          edge: session.edge,
          edgeMs: next.edgeMs,
        });
      };
      doc.addEventListener("pointermove", onMove);
      doc.addEventListener("pointerup", onUp);
      doc.addEventListener("pointercancel", onUp);
    },
    [
      disabled,
      draftFromPointer,
      onResizeClip,
      onRestoreClipEdge,
      onSeek,
      updateTrimDraft,
    ],
  );

  const canAddStackLane = stackLaneIds.length < MAX_STACK_LANES;
  const laneCountStyle = {
    ["--jayrr-editor-lanes" as string]: String(1 + stackLaneIds.length),
  } as CSSProperties;
  const activeClip = activeClipId ? clipsById.get(activeClipId) : null;
  const hasClips = timeline.sequence.length + timeline.overlays.length > 0;
  const dropSlotTop =
    placement != null
      ? TRACK_PAD_PX + msToPx(placement.startMs, pxPerMs)
      : null;
  const dropSlotHeight =
    placement != null
      ? Math.max(18, msToPx(placement.durationMs, pxPerMs))
      : null;
  const snapGuideMs = placement?.guideMs ?? trimDraft?.guideMs ?? null;
  const snapLineTop =
    snapGuideMs != null ? TRACK_PAD_PX + msToPx(snapGuideMs, pxPerMs) : null;
  const snapIsPlayhead =
    snapGuideMs != null && Math.abs(snapGuideMs - currentTimeMs) < 0.5;

  return (
    <div className="jayrr-editor-timeline" style={laneCountStyle}>
      <div className="jayrr-editor-timeline__head">
        <div className="jayrr-editor-timeline__col-label jayrr-editor-timeline__col-label--ruler">
          Time
        </div>
        <LaneHeader
          label="1"
          addDisabled={!canAddStackLane}
          onAdd={onAddStackLane}
        />
        {stackLaneIds.map((laneId, index) => (
          <LaneHeader
            key={laneId}
            label={`${index + 2}`}
            hovered={hoveredStackId === laneId}
            onHover={(inside) => setHoveredStackId(inside ? laneId : null)}
            onRemove={() => onRemoveStackLane(laneId)}
          />
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
          modifiers={[snapYModifier]}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div
            className="jayrr-editor-timeline__tracks"
            style={{ height: totalHeight }}
          >
            <TimelineRuler ticks={ticks} pxPerMs={pxPerMs} />
            <TrackLane
              laneId={SEQUENCE_LANE_ID}
              dropSlot={
                placement?.toLaneId === SEQUENCE_LANE_ID &&
                dropSlotTop != null &&
                dropSlotHeight != null ? (
                  <DropSlot top={dropSlotTop} height={dropSlotHeight} />
                ) : null
              }
            >
              {timeline.sequence.map((clip) => (
                <TimelineClip
                  key={clip.id}
                  clip={visibleClip(clip, trimDraft)}
                  pxPerMs={pxPerMs}
                  selected={selectedClipIds.has(clip.id)}
                  playhead={playheadClipId === clip.id}
                  hidden={activeClipId === clip.id}
                  resizing={trimDraft?.clipId === clip.id}
                  onResizePointerDown={(edge, event) =>
                    onResizePointerDown(clip, edge, event)
                  }
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
              <TrackLane
                key={laneId}
                laneId={laneId}
                onHover={(inside) => setHoveredStackId(inside ? laneId : null)}
                dropSlot={
                  placement?.toLaneId === laneId &&
                  dropSlotTop != null &&
                  dropSlotHeight != null ? (
                    <DropSlot top={dropSlotTop} height={dropSlotHeight} />
                  ) : null
                }
              >
                {(overlaysByLane.get(laneId) ?? []).map((clip) => (
                  <TimelineClip
                    key={clip.id}
                    clip={visibleClip(clip, trimDraft)}
                    pxPerMs={pxPerMs}
                    selected={selectedClipIds.has(clip.id)}
                    playhead={playheadClipId === clip.id}
                    hidden={activeClipId === clip.id}
                    resizing={trimDraft?.clipId === clip.id}
                    onResizePointerDown={(edge, event) =>
                      onResizePointerDown(clip, edge, event)
                    }
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
            {overlapBands.map((band) => (
              <OverlapHandle
                key={band.id}
                band={band}
                laneIndexById={laneIndexById}
                pxPerMs={pxPerMs}
                container={menuContainer}
                onPick={(kind) => onSetTransition(band.clipIds, kind)}
                onOpenBlend={() =>
                  onOpenBlend({
                    clipIds: band.clipIds,
                    blendMode: band.blendMode,
                  })
                }
                layerMoves={overlapLayerMoves(band)}
                onReorder={(direction) => onReorderOverlap(band, direction)}
              />
            ))}
            {snapLineTop != null && snapGuideMs != null ? (
              <div
                className={`jayrr-editor-timeline__snap-line${
                  snapIsPlayhead ? " is-playhead" : ""
                }`}
                style={{ top: snapLineTop }}
                aria-hidden
              >
                <span className="jayrr-editor-timeline__snap-label">
                  {formatEditorClock(snapGuideMs ?? 0)}
                </span>
              </div>
            ) : null}
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
  hovered,
  onAdd,
  onRemove,
  onHover,
}: {
  label: string;
  addDisabled?: boolean;
  hovered?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  onHover?: (inside: boolean) => void;
}) => (
  <div
    className={`jayrr-editor-timeline__col-label${
      onAdd
        ? " jayrr-editor-timeline__col-label--sequence"
        : " jayrr-editor-timeline__col-label--stack"
    }${hovered ? " is-hovered" : ""}`}
    onPointerEnter={() => onHover?.(true)}
    onPointerLeave={() => onHover?.(false)}
  >
    <span>{label}</span>
    {onAdd ? (
      <button
        type="button"
        className="jayrr-editor-timeline__add-lane"
        aria-label="Add column"
        title="Add column"
        disabled={addDisabled}
        onClick={(event) => {
          event.stopPropagation();
          onAdd();
        }}
      >
        {PlusIcon}
      </button>
    ) : null}
    {onRemove ? (
      <button
        type="button"
        className="jayrr-editor-timeline__remove-lane"
        aria-label="Remove column"
        title="Move clips left and remove column"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        {CloseIcon}
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

const DropSlot = ({ top, height }: { top: number; height: number }) => (
  <div
    className="jayrr-editor-timeline__drop-slot"
    style={{ top, height }}
    aria-hidden
  />
);

const OverlapHandle = ({
  band,
  laneIndexById,
  pxPerMs,
  container,
  onPick,
  onOpenBlend,
  layerMoves,
  onReorder,
}: {
  band: OverlapBand;
  laneIndexById: ReadonlyMap<string, number>;
  pxPerMs: number;
  container?: HTMLElement | null;
  onPick: (kind: EditorTransitionKind) => void;
  onOpenBlend: () => void;
  layerMoves: Record<EditorLayerDirection, boolean>;
  onReorder: (direction: EditorLayerDirection) => void;
}) => {
  const [open, setOpen] = useState(false);
  const indexes = band.laneIds
    .map((laneId) => laneIndexById.get(laneId))
    .filter((index): index is number => index !== undefined);
  if (indexes.length === 0) {
    return null;
  }
  const fromIndex = Math.min(...indexes);
  const toIndex = Math.max(...indexes);
  const top = TRACK_PAD_PX + msToPx(band.joinMs, pxPerMs);
  const gridColumn = `${fromIndex + 2} / ${toIndex + 3}`;
  const joinClock = formatEditorClock(band.joinMs);
  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="jayrr-editor-timeline__overlap"
          style={{ top, gridColumn }}
          aria-label={`Choose overlap transition at ${joinClock}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
        >
          <span className="jayrr-editor-timeline__overlap-label" aria-hidden>
            {joinClock}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container ?? undefined}>
        <DropdownMenu.Content
          collisionPadding={8}
          className="jayrr-editor-menu"
          data-prevent-outside-click
          side="right"
          align="start"
          style={{ maxHeight: "none" }}
          onPointerDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenu.Group className="jayrr-editor-menu__header">
            {(
              [
                ["back", "Send to back", SendToBackIcon],
                ["backward", "Send backward", SendBackwardIcon],
                ["forward", "Bring forward", BringForwardIcon],
                ["front", "Bring to front", BringToFrontIcon],
              ] as const
            ).map(([direction, label, icon]) => (
              <DropdownMenu.Item
                key={direction}
                className="jayrr-editor-menu__icon"
                disabled={!layerMoves[direction]}
                title={label}
                aria-label={label}
                onSelect={() => onReorder(direction)}
              >
                {icon}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>
          <DropdownMenu.Separator className="jayrr-editor-menu__separator" />
          {EDITOR_TRANSITION_OPTIONS.map((option) => {
            const selected = band.transitionKind === option.id;
            return (
              <DropdownMenu.Item
                key={option.id}
                className={`jayrr-editor-menu__item${
                  selected ? " is-active" : ""
                }`}
                onSelect={() => onPick(option.id)}
              >
                <span>{option.label}</span>
                <span className="jayrr-editor-menu__check" aria-hidden>
                  {selected ? checkIcon : null}
                </span>
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className="jayrr-editor-menu__separator" />
          <DropdownMenu.Item
            className="jayrr-editor-menu__item"
            onSelect={onOpenBlend}
          >
            Blend…
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

const TrackLane = ({
  laneId,
  children,
  dropSlot,
  onHover,
}: {
  laneId: string;
  children: ReactNode;
  dropSlot?: ReactNode;
  onHover?: (inside: boolean) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: laneDroppableId(laneId),
  });
  return (
    <div
      ref={setNodeRef}
      className={`jayrr-editor-timeline__lane jayrr-editor-timeline__lane--stack${
        isOver ? " is-drop-target" : ""
      }`}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
    >
      {dropSlot}
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
    if (
      isEditorHtmlClip(clip) ||
      isEditorStaticClip(clip) ||
      !clip.url ||
      !ownerDocument ||
      sliceCount < 1
    ) {
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
  }, [clip, ownerDocument, sliceCount]);

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
  const isSound =
    clip.type === EDITOR_SOUND_TYPE || clip.type === EDITOR_AUDIO_TYPE;
  const skipFilmstrip =
    isSound ||
    clip.type === EDITOR_HTML_TYPE ||
    clip.type === EDITOR_STATIC_TYPE;
  const frames = useClipFilmstripFrames(
    clip,
    skipFilmstrip ? 0 : sliceCount,
    skipFilmstrip ? null : ownerDocument,
  );
  const slices = skipFilmstrip
    ? clip.type === EDITOR_STATIC_TYPE
      ? filmstripSources(sliceCount, null, clip.url)
      : []
    : filmstripSources(
        sliceCount,
        frames,
        clip.type === "clip" ? clip.posterUrl : null,
      );
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
      className={`jayrr-editor-clip jayrr-editor-clip--${clip.type}${
        packed ? "" : " jayrr-editor-clip--overlay"
      }${selected ? " is-selected" : ""}${playhead ? " is-playhead" : ""}${
        dragging ? " is-dragging" : ""
      }${hidden ? " is-hidden" : ""}`}
      data-clip-id={clip.id}
      data-shade={clipShadeIndex(clip.id)}
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

const visibleClip = (clip: EditorClip, draft: TrimDraft | null): EditorClip => {
  if (!draft || draft.clipId !== clip.id) {
    return clip;
  }
  return {
    ...clip,
    startMs: draft.startMs,
    durationMs: draft.durationMs,
    sourceOffsetMs: draft.sourceOffsetMs,
  };
};

const TimelineClip = ({
  clip,
  pxPerMs,
  selected,
  playhead,
  packed,
  hidden,
  resizing,
  onSelect,
  onResizePointerDown,
}: {
  clip: EditorClip;
  pxPerMs: number;
  selected: boolean;
  playhead: boolean;
  packed?: boolean;
  hidden?: boolean;
  resizing?: boolean;
  onSelect: (toggle: boolean) => void;
  onResizePointerDown?: (
    edge: EditorClipEdge,
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: clip.id,
  });
  const heightPx = Math.max(18, msToPx(clip.durationMs, pxPerMs));
  const top = packed ? undefined : TRACK_PAD_PX + msToPx(clip.startMs, pxPerMs);

  return (
    <div
      className={`jayrr-editor-clip-shell${
        packed ? "" : " jayrr-editor-clip-shell--overlay"
      }${selected ? " is-selected" : ""}${
        hidden || isDragging ? " is-hidden" : ""
      }${resizing ? " is-resizing" : ""}`}
      style={{
        height: heightPx,
        ...(top === undefined ? {} : { top }),
      }}
    >
      <ClipFace
        clip={clip}
        pxPerMs={pxPerMs}
        selected={selected}
        playhead={playhead}
        packed
        dragging={isDragging}
        buttonRef={setNodeRef}
        draggableProps={{ ...attributes, ...listeners }}
        onSelect={onSelect}
        style={{ height: "100%" }}
      />
      {onResizePointerDown ? (
        <>
          <button
            type="button"
            className="jayrr-editor-clip__edge jayrr-editor-clip__edge--start"
            aria-label="Trim start"
            title="Drag to trim. Double-click to restore the original start."
            onPointerDown={(event) => onResizePointerDown("start", event)}
            onDoubleClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="jayrr-editor-clip__edge jayrr-editor-clip__edge--end"
            aria-label="Trim end"
            title="Drag to trim. Double-click to restore the original end."
            onPointerDown={(event) => onResizePointerDown("end", event)}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        </>
      ) : null}
    </div>
  );
};
