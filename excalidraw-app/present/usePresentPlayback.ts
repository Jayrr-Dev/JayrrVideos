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
import { getPresentInteract } from "./presentInteract";

const PRESENTING_CLASS = "jayrr-presenting";
// A press shorter than this, without drag, counts as "advance".
const TAP_MS = 250;
const TAP_MOVE_PX = 6;

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
  const [interactive, setInteractive] = useState(false);
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
      return false;
    }
    const nextDeck = deckRef.current;
    if (nextDeck.steps.length === 0) {
      api.setToast({
        message: "Put shapes in frames, then press Present.",
        closable: true,
      });
      return false;
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
    const interact = getPresentInteract();
    api.updateScene({
      appState: {
        viewModeEnabled: !interact,
        zenModeEnabled: true,
        openSidebar: null,
        openMenu: null,
        selectedElementIds: {},
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
    if (interact) {
      api.setActiveTool({ type: "selection" });
    }
    if (getPresentHideFrames()) {
      api.updateFrameRendering({ enabled: false });
    }
    // Start on the opening showFrame so the first object is still hidden.
    setInteractive(interact);
    setPresenting(true);
    applyStep(0, false);
    refocusPresentTrap();
    return true;
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
      const el = document.fullscreenElement;
      // YouTube / embed player fullscreen is the iframe, not the document.
      if (el && el.nodeName !== "HTML") {
        return;
      }
      if (el?.nodeName === "HTML") {
        enteredFullscreenRef.current = true;
        refit();
        return;
      }
      // First Esc is consumed by the browser to leave document fullscreen.
      // That must also leave Present — otherwise preview (zen, trap, view
      // mode) stays up until a second Esc.
      if (presentingRef.current) {
        stopPresent();
      }
    };
    window.addEventListener("resize", refit);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("resize", refit);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [api, presenting, stopPresent]);

  // Interactive mode: pointer events reach the canvas, so "click to advance"
  // becomes "quick tap without drag advances". Holds and drags stay normal.
  useEffect(() => {
    if (!presenting || !interactive || !api) {
      return;
    }
    let press: { x: number; y: number; time: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isTypingTarget(event.target)) {
        press = null;
        return;
      }
      press = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    };
    const onPointerUp = (event: PointerEvent) => {
      const start = press;
      press = null;
      if (!start || event.button !== 0) {
        return;
      }
      const moved = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (event.timeStamp - start.time > TAP_MS || moved > TAP_MOVE_PX) {
        return;
      }
      goNext();
      // The tap also selected whatever was under it; drop that so the
      // selection box does not sit on screen.
      window.setTimeout(() => {
        if (!presentingRef.current) {
          return;
        }
        api.updateScene({
          appState: { selectedElementIds: {} },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
      }, 0);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [api, goNext, interactive, presenting]);

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

  /** Seek PresentPlayer to a step without entering fullscreen Present. */
  const seekStep = useCallback(
    (nextIndex: number, animate: boolean) => {
      applyStep(nextIndex, animate);
    },
    [applyStep],
  );

  /** Clear preview overrides when the editor stops (and Present is not live). */
  const clearPreview = useCallback(() => {
    if (presentingRef.current) {
      return;
    }
    if (!api) {
      return;
    }
    player.current.stop(api);
    stepRef.current = 0;
    setStepIndex(0);
  }, [api]);

  return {
    deck,
    presenting,
    interactive,
    stepIndex,
    startPresent,
    stopPresent,
    goNext,
    goPrev,
    seekStep,
    clearPreview,
  };
};
