import { isNonDeletedElement } from "@excalidraw/element";
import {
  DefaultSidebar,
  Sidebar,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { presentationIcon } from "@excalidraw/excalidraw/components/icons";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { JayrrPresentPanel } from "./JayrrPresentPanel";
import { JAYRR_PRESENT_TAB } from "./buildPresentDeck";
import { PRESENT_TRAP_CLASS } from "./presentFocus";
import { usePresentPlayback } from "./usePresentPlayback";

export const JayrrPresentHost = ({
  onPresentingChange,
}: {
  onPresentingChange?: (presenting: boolean) => void;
}) => {
  const api = useExcalidrawAPI();
  const [elements, setElements] = useState<
    readonly NonDeletedExcalidrawElement[]
  >([]);
  const [selectedElementIds, setSelectedElementIds] = useState<
    Record<string, boolean>
  >({});

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

  const playback = usePresentPlayback(elements);
  const trapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onPresentingChange?.(playback.presenting);
  }, [onPresentingChange, playback.presenting]);

  useEffect(() => {
    if (!playback.presenting) {
      return;
    }
    trapRef.current?.focus();
  }, [playback.presenting, playback.stepIndex]);

  if (playback.presenting) {
    return createPortal(
      <div
        ref={trapRef}
        className={PRESENT_TRAP_CLASS}
        tabIndex={0}
        role="application"
        aria-label="Slideshow. Arrow keys or click to advance. Escape to exit."
        onMouseDown={(event) => {
          event.preventDefault();
          trapRef.current?.focus();
        }}
        onClick={playback.goNext}
      />,
      document.body,
    );
  }

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab={JAYRR_PRESENT_TAB}
          title="Present"
          aria-label="Present"
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab={JAYRR_PRESENT_TAB}>
        <JayrrPresentPanel
          deck={playback.deck}
          presenting={playback.presenting}
          stepIndex={playback.stepIndex}
          selectedElementIds={selectedElementIds}
          startPresent={playback.startPresent}
          stopPresent={playback.stopPresent}
        />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
