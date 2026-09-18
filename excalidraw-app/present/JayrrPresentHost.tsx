import { isNonDeletedElement } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useEffect, useState } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { JayrrPresentHud, JayrrPresentPanel } from "./JayrrPresentPanel";
import { stepCaption } from "./buildPresentDeck";
import { usePresentPlayback } from "./usePresentPlayback";

export const JayrrPresentHost = () => {
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

  return (
    <>
      <JayrrPresentPanel
        deck={playback.deck}
        presenting={playback.presenting}
        stepIndex={playback.stepIndex}
        selectedElementIds={selectedElementIds}
        startPresent={playback.startPresent}
        stopPresent={playback.stopPresent}
      />
      {playback.presenting ? (
        <JayrrPresentHud
          caption={stepCaption(playback.deck, playback.stepIndex)}
          onExit={playback.stopPresent}
        />
      ) : null}
    </>
  );
};
