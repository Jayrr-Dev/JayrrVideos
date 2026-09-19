import {
  allowFullScreen,
  exitFullScreen,
  isFullScreen,
  KEYS,
} from "@excalidraw/common";
import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useRef, useState } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  buildPresentDeck,
  nextPresentStepIndex,
  type PresentDeck,
} from "./buildPresentDeck";
import { PresentPlayer } from "./playPresentDeck";
import { refocusPresentTrap, startPresentFocusGuard } from "./presentFocus";
import { getPresentHideFrames } from "./presentHideFrames";

const PRESENTING_CLASS = "jayrr-presenting";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
};

const isPresentAdvanceKey = (event: KeyboardEvent) =>
  event.key === KEYS.ARROW_RIGHT ||
  event.key === KEYS.ARROW_DOWN ||
  event.key === KEYS.SPACE ||
  event.key === KEYS.PAGE_DOWN ||
  event.code === "ArrowRight" ||
  event.code === "ArrowDown" ||
  event.code === "Space" ||
  event.code === "PageDown";

const isPresentBackKey = (event: KeyboardEvent) =>
  event.key === KEYS.ARROW_LEFT ||
  event.key === KEYS.ARROW_UP ||
  event.key === KEYS.PAGE_UP ||
  event.code === "ArrowLeft" ||
  event.code === "ArrowUp" ||
  event.code === "PageUp";

export const usePresentPlayback = (
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const api = useExcalidrawAPI();
  const player = useRef(new PresentPlayer());
  const [presenting, setPresenting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const presentingRef = useRef(false);
  const enteredFullscreenRef = useRef(false);
  const restoreRef = useRef<{
    viewModeEnabled: boolean;
    zenModeEnabled: boolean;
    frameRenderingEnabled: boolean;
  } | null>(null);

  const deck: PresentDeck = buildPresentDeck(elements);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  // Navigation reads/writes this ref only; React state mirrors it for the UI.
  const stepRef = useRef(0);

  const applyStep = useCallback(
    (nextIndex: number, animate: boolean) => {
      if (!api) {
        return;
      }
      stepRef.current = nextIndex;
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
    document.documentElement.classList.remove(PRESENTING_CLASS);
    if (!presentingRef.current) {
      return;
    }
    presentingRef.current = false;
    stepRef.current = 0;
    if (!api) {
      setPresenting(false);
      setStepIndex(0);
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
    api.updateFrameRendering({
      enabled: restore?.frameRenderingEnabled ?? true,
    });
    restoreRef.current = null;
    if (enteredFullscreenRef.current && isFullScreen()) {
      void exitFullScreen();
    }
    enteredFullscreenRef.current = false;
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
      frameRenderingEnabled: appState.frameRendering.enabled,
    };
    presentingRef.current = true;
    document.documentElement.classList.add(PRESENTING_CLASS);
    if (!isFullScreen()) {
      void allowFullScreen()
        .then(() => {
          enteredFullscreenRef.current = true;
        })
        .catch(() => {
          enteredFullscreenRef.current = false;
        });
    }
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
    if (getPresentHideFrames()) {
      api.updateFrameRendering({ enabled: false });
    }
    // Start on the first landable step (same rule Next/Back use).
    const first = nextPresentStepIndex(nextDeck, -1, 1) ?? 0;
    setPresenting(true);
    applyStep(first, false);
    refocusPresentTrap();
  }, [api, applyStep]);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!presentingRef.current) {
        return;
      }
      const next = nextPresentStepIndex(
        deckRef.current,
        stepRef.current,
        direction,
      );
      if (next === null) {
        return;
      }
      applyStep(next, true);
    },
    [applyStep],
  );

  const goNext = useCallback(() => step(1), [step]);

  const goPrev = useCallback(() => step(-1), [step]);

  useEffect(() => {
    const presentPlayer = player.current;
    return () => {
      document.documentElement.classList.remove(PRESENTING_CLASS);
      presentPlayer.stop(api);
    };
  }, [api]);

  useEffect(() => {
    if (!presenting || !api) {
      return;
    }
    const refit = () => {
      if (!presentingRef.current) {
        return;
      }
      player.current.goTo({
        api,
        deck: deckRef.current,
        stepIndex: stepRef.current,
        elements: elementsRef.current,
        animate: false,
      });
    };
    const onFullscreenChange = () => {
      // Stopping a video often exits iframe/document fullscreen.
      // Do not treat that as Exit Present — only Escape / Exit does.
      if (isFullScreen()) {
        enteredFullscreenRef.current = true;
        refit();
      }
    };
    window.addEventListener("resize", refit);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("resize", refit);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [api, presenting, stopPresent]);

  useEffect(() => {
    if (!presenting) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === KEYS.ESCAPE || event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        stopPresent();
        return;
      }
      if (isPresentAdvanceKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        goNext();
        refocusPresentTrap();
        return;
      }
      if (isPresentBackKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        goPrev();
        refocusPresentTrap();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLIFrameElement) {
        event.preventDefault();
        refocusPresentTrap();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    const stopGuard = startPresentFocusGuard();
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      stopGuard();
    };
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
