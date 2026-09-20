import { DEFAULT_SIDEBAR } from "@excalidraw/common";
import { isNonDeletedElement } from "@excalidraw/element";
import {
  DefaultSidebar,
  Sidebar,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import {
  EmbedIcon,
  aiIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { JAYRR_AI_TAB, JayrrAiChat } from "../ai/JayrrAiChat";
import { TopErrorBoundary } from "../components/TopErrorBoundary";
import {
  JAYRR_EDITOR_TAB,
  JayrrEditorPanel,
  editorTabIcon,
} from "../domain/editor";
import {
  JAYRR_CALLED_OBJECTS_TAB,
  JAYRR_CALLED_OBJECT_DRAG,
  JayrrCalledObjectsPanel,
  dataTransferHasMarkdownFile,
  dataTransferHasPdfFile,
  defForCalledObjectKind,
  insertCalledObjectAt,
  parseCalledObjectDrag,
  tryDropMarkdownFiles,
  tryDropPdfFiles,
} from "../domain/widgets";

import { JayrrCameraHost } from "../camera/JayrrCameraHost";
import { JayrrFrameHost } from "../frame/JayrrFrameHost";

import { JayrrPresentCursor } from "./JayrrPresentCursor";
import { JayrrPresentHud, JayrrPresentPanel } from "./JayrrPresentPanel";
import {
  JAYRR_RECORDINGS_TAB,
  JayrrPresentRecordingsPanel,
  recordingsTabIcon,
} from "./JayrrPresentRecordingsPanel";
import { JayrrPresentTranslationOverlay } from "./JayrrPresentTranslationOverlay";
import { JAYRR_PRESENT_TAB } from "./buildPresentDeck";
import {
  JAYRR_RECORDING_DRAG,
  insertPresentRecordingAt,
  parsePresentRecordingDrag,
  scenePointFromClient,
} from "./insertPresentRecording";
import { getPresentCustomCursor } from "./presentCursor";
import { PRESENT_TRAP_CLASS } from "./presentFocus";
import {
  pausePresentRecording,
  resumePresentRecording,
  startPresentRecording,
  stopPresentRecording,
} from "./recordPresent";
import { uploadPresentRecording } from "./uploadPresentRecording";
import { usePresentCursorIdle } from "./usePresentCursorIdle";
import { usePresentPlayback } from "./usePresentPlayback";

export const JayrrPresentHost = ({
  onPresentingChange,
}: {
  onPresentingChange?: (presenting: boolean) => void;
}) => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const [elements, setElements] = useState<
    readonly NonDeletedExcalidrawElement[]
  >([]);
  const [selectedElementIds, setSelectedElementIds] = useState<
    Record<string, boolean>
  >({});
  const [recording, setRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const finishingRef = useRef(false);
  const recordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedMsRef = useRef(0);

  useEffect(() => {
    if (!api) {
      return;
    }
    setElements(api.getSceneElements());
    setSelectedElementIds(api.getAppState().selectedElementIds);
    return api.onChange((nextElements, appState) => {
      setElements(nextElements.filter(isNonDeletedElement));
      setSelectedElementIds(appState.selectedElementIds);
    });
  }, [api]);

  const {
    deck,
    presenting,
    interactive,
    stepIndex,
    startPresent,
    stopPresent,
    goNext,
    seekStep,
    clearPreview,
  } = usePresentPlayback(elements);
  const trapRef = useRef<HTMLDivElement | null>(null);
  usePresentCursorIdle(presenting);

  useEffect(() => {
    onPresentingChange?.(presenting);
  }, [onPresentingChange, presenting]);

  useEffect(() => {
    if (!presenting) {
      return;
    }
    trapRef.current?.focus();
  }, [presenting, stepIndex]);

  const finishRecording = useCallback(async () => {
    if (finishingRef.current) {
      return;
    }
    finishingRef.current = true;
    recordingRef.current = false;
    if (pausedAtRef.current) {
      pausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
    }
    setRecording(false);
    setRecordingPaused(false);
    const result = await stopPresentRecording();
    stopPresent();
    if (!result || result.blob.size === 0) {
      finishingRef.current = false;
      return;
    }
    setUploading(true);
    try {
      const durationMs = Math.max(
        0,
        Date.now() - startedAtRef.current - pausedMsRef.current,
      );
      await uploadPresentRecording(
        result.blob,
        durationMs,
        result.width,
        result.height,
      );
      api?.setToast({ message: "Recording saved.", closable: true });
      api?.updateScene({
        appState: {
          openSidebar: {
            name: DEFAULT_SIDEBAR.name,
            tab: JAYRR_RECORDINGS_TAB,
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save recording.";
      api?.setToast({ message, closable: true });
    } finally {
      setUploading(false);
      finishingRef.current = false;
    }
  }, [api, stopPresent]);

  const startRecordPresent = useCallback(async () => {
    if (!api || !container) {
      return;
    }
    const ownerWindow = container.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }
    startedAtRef.current = Date.now();
    pausedAtRef.current = 0;
    pausedMsRef.current = 0;
    recordingRef.current = true;
    setRecording(true);
    setRecordingPaused(false);
    const started = startPresent();
    if (!started) {
      recordingRef.current = false;
      setRecording(false);
      setRecordingPaused(false);
      return;
    }
    await new Promise<void>((resolve) => {
      ownerWindow.requestAnimationFrame(() => {
        ownerWindow.requestAnimationFrame(() => resolve());
      });
    });
    if (!recordingRef.current) {
      return;
    }
    try {
      await startPresentRecording(container, ownerWindow);
    } catch (error) {
      recordingRef.current = false;
      setRecording(false);
      setRecordingPaused(false);
      stopPresent();
      const message =
        error instanceof Error ? error.message : "Could not start recording.";
      api.setToast({ message, closable: true });
      return;
    }
    if (!recordingRef.current) {
      await stopPresentRecording();
    }
  }, [api, container, startPresent, stopPresent]);

  useEffect(() => {
    if (presenting || !recordingRef.current) {
      return;
    }
    void finishRecording();
  }, [finishRecording, presenting]);

  useEffect(() => {
    if (!api) {
      return;
    }
    const onDragOver = (event: DragEvent) => {
      const types = event.dataTransfer?.types;
      if (
        !types?.includes(JAYRR_RECORDING_DRAG) &&
        !types?.includes(JAYRR_CALLED_OBJECT_DRAG) &&
        !dataTransferHasMarkdownFile(event.dataTransfer) &&
        !dataTransferHasPdfFile(event.dataTransfer)
      ) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };
    const onDrop = (event: DragEvent) => {
      const calledRaw = event.dataTransfer?.getData(JAYRR_CALLED_OBJECT_DRAG);
      if (calledRaw) {
        const kind = parseCalledObjectDrag(calledRaw);
        const def = kind ? defForCalledObjectKind(kind) : null;
        if (!def) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const point = scenePointFromClient(api, event.clientX, event.clientY);
        insertCalledObjectAt(api, def, point.x, point.y);
        return;
      }
      if (dataTransferHasPdfFile(event.dataTransfer)) {
        void tryDropPdfFiles(api, event);
        return;
      }
      if (dataTransferHasMarkdownFile(event.dataTransfer)) {
        void tryDropMarkdownFiles(api, event);
        return;
      }
      const raw = event.dataTransfer?.getData(JAYRR_RECORDING_DRAG);
      if (!raw) {
        return;
      }
      const payload = parsePresentRecordingDrag(raw);
      if (!payload) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const point = scenePointFromClient(api, event.clientX, event.clientY);
      insertPresentRecordingAt(api, payload, point.x, point.y);
    };
    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [api]);

  return (
    <>
      <JayrrCameraHost presenting={presenting} />
      <JayrrFrameHost />
      {presenting ? (
        createPortal(
          <>
            <div
              ref={trapRef}
              className={
                interactive
                  ? `${PRESENT_TRAP_CLASS} is-passthrough`
                  : PRESENT_TRAP_CLASS
              }
              tabIndex={0}
              role="application"
              aria-label="Slideshow. Arrow keys or click to advance. Escape to exit."
              onMouseDown={(event) => {
                event.preventDefault();
                trapRef.current?.focus();
              }}
              onClick={interactive ? undefined : goNext}
            />
            {getPresentCustomCursor() ? <JayrrPresentCursor /> : null}
            {recording ? (
              <JayrrPresentHud
                caption={recordingPaused ? "Paused" : "Recording"}
                recording
                paused={recordingPaused}
                onPause={() => {
                  pausePresentRecording();
                  pausedAtRef.current = Date.now();
                  setRecordingPaused(true);
                }}
                onResume={() => {
                  resumePresentRecording();
                  if (pausedAtRef.current) {
                    pausedMsRef.current += Date.now() - pausedAtRef.current;
                    pausedAtRef.current = 0;
                  }
                  setRecordingPaused(false);
                }}
                onExit={() => {
                  void finishRecording();
                }}
              />
            ) : null}
          </>,
          document.body,
        )
      ) : (
        <>
          <JayrrPresentTranslationOverlay deck={deck} />
          <DefaultSidebar docked onDock={false}>
            <DefaultSidebar.TabTriggers>
              <Sidebar.TabTrigger
                tab={JAYRR_PRESENT_TAB}
                title="Present"
                aria-label="Present"
              >
                {presentationIcon}
              </Sidebar.TabTrigger>
              <Sidebar.TabTrigger
                tab={JAYRR_RECORDINGS_TAB}
                title="Recordings"
                aria-label="Recordings"
              >
                {recordingsTabIcon}
              </Sidebar.TabTrigger>
              <Sidebar.TabTrigger
                tab={JAYRR_EDITOR_TAB}
                title="Video editor"
                aria-label="Video editor"
              >
                {editorTabIcon}
              </Sidebar.TabTrigger>
            </DefaultSidebar.TabTriggers>
            <DefaultSidebar.TrailingTabTriggers>
              <Sidebar.TabTrigger
                tab={JAYRR_CALLED_OBJECTS_TAB}
                title="Widgets"
                aria-label="Widgets"
              >
                {EmbedIcon}
              </Sidebar.TabTrigger>
              <Sidebar.TabTrigger tab={JAYRR_AI_TAB} title="AI" aria-label="AI">
                {aiIcon}
              </Sidebar.TabTrigger>
            </DefaultSidebar.TrailingTabTriggers>
            <Sidebar.Tab tab={JAYRR_EDITOR_TAB}>
              <TopErrorBoundary compact>
                <JayrrEditorPanel
                  deck={deck}
                  presenting={presenting}
                  stepIndex={stepIndex}
                  seekStep={seekStep}
                  clearPreview={clearPreview}
                />
              </TopErrorBoundary>
            </Sidebar.Tab>
            <Sidebar.Tab tab={JAYRR_CALLED_OBJECTS_TAB}>
              <TopErrorBoundary compact>
                <JayrrCalledObjectsPanel />
              </TopErrorBoundary>
            </Sidebar.Tab>
            <Sidebar.Tab tab={JAYRR_PRESENT_TAB}>
              <TopErrorBoundary compact>
                <JayrrPresentPanel
                  deck={deck}
                  presenting={presenting}
                  uploading={uploading}
                  stepIndex={stepIndex}
                  selectedElementIds={selectedElementIds}
                  startPresent={startPresent}
                  startRecordPresent={startRecordPresent}
                  stopPresent={stopPresent}
                />
              </TopErrorBoundary>
            </Sidebar.Tab>
            <Sidebar.Tab tab={JAYRR_RECORDINGS_TAB}>
              <TopErrorBoundary compact>
                <JayrrPresentRecordingsPanel uploading={uploading} />
              </TopErrorBoundary>
            </Sidebar.Tab>
            <Sidebar.Tab tab={JAYRR_AI_TAB}>
              <TopErrorBoundary compact>
                <JayrrAiChat />
              </TopErrorBoundary>
            </Sidebar.Tab>
          </DefaultSidebar>
        </>
      )}
    </>
  );
};
