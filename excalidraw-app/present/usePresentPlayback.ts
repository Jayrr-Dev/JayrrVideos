import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useRef, useState } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { buildPresentDeck, type PresentDeck } from "./buildPresentDeck";
import { PresentPlayer } from "./playPresentDeck";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
};

export const usePresentPlayback = (
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const api = useExcalidrawAPI();
  const player = useRef(new PresentPlayer());
  const [presenting, setPresenting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const restoreRef = useRef<{
    viewModeEnabled: boolean;
    zenModeEnabled: boolean;
  } | null>(null);

  const deck: PresentDeck = buildPresentDeck(elements);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const stepRef = useRef(stepIndex);
  stepRef.current = stepIndex;

  const applyStep = useCallback(
    (nextIndex: number, animate: boolean) => {
      if (!api) {
        return;
      }
      player.current.goTo({
        api,
        deck: deckRef.current,
        stepIndex: nextIndex,
        elements: elementsRef.current,
        animate,
      });
      setStepIndex(nextIndex);
    },
    [api],
  );

  const stopPresent = useCallback(() => {
    if (!api) {
      return;
    }
    player.current.stop(api);
    const restore = restoreRef.current;
    api.updateScene({
      appState: {
        viewModeEnabled: restore?.viewModeEnabled ?? false,
        zenModeEnabled: restore?.zenModeEnabled ?? false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
    restoreRef.current = null;
    setPresenting(false);
    setStepIndex(0);
  }, [api]);

  const startPresent = useCallback(() => {
    if (!api) {
      return;
    }
    const nextDeck = deckRef.current;
    if (nextDeck.steps.length === 0) {
      api.setToast({
        message: "Put shapes in frames, then press Present.",
        closable: true,
      });
      return;
    }
    const appState = api.getAppState();
    restoreRef.current = {
      viewModeEnabled: appState.viewModeEnabled,
      zenModeEnabled: appState.zenModeEnabled,
    };
    api.updateScene({
      appState: {
        viewModeEnabled: true,
        zenModeEnabled: true,
        openSidebar: null,
        openMenu: null,
        selectedElementIds: {},
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
    setPresenting(true);
    applyStep(0, false);
  }, [api, applyStep]);

  const goNext = useCallback(() => {
    const next = stepRef.current + 1;
    if (next >= deckRef.current.steps.length) {
      return;
    }
    applyStep(next, true);
  }, [applyStep]);

  const goPrev = useCallback(() => {
    const next = stepRef.current - 1;
    if (next < 0) {
      return;
    }
    applyStep(next, true);
  }, [applyStep]);

  useEffect(() => {
    const presentPlayer = player.current;
    return () => {
      presentPlayer.stop(api);
    };
  }, [api]);

  useEffect(() => {
    if (!presenting) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === KEYS.ESCAPE) {
        event.preventDefault();
        event.stopPropagation();
        stopPresent();
        return;
      }
      if (
        event.key === KEYS.ARROW_RIGHT ||
        event.key === KEYS.ARROW_DOWN ||
        event.key === KEYS.SPACE ||
        event.key === KEYS.PAGE_DOWN
      ) {
        event.preventDefault();
        event.stopPropagation();
        goNext();
        return;
      }
      if (
        event.key === KEYS.ARROW_LEFT ||
        event.key === KEYS.ARROW_UP ||
        event.key === KEYS.PAGE_UP
      ) {
        event.preventDefault();
        event.stopPropagation();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [goNext, goPrev, presenting, stopPresent]);

  return {
    deck,
    presenting,
    stepIndex,
    startPresent,
    stopPresent,
    goNext,
    goPrev,
  };
};
