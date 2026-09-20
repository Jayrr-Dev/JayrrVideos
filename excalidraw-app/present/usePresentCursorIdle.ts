import { useEffect } from "react";

const IDLE_MS = 1000;
const MOVE_PX = 2;
const IDLE_CLASS = "jayrr-present-cursor-idle";

export const usePresentCursorIdle = (active: boolean) => {
  useEffect(() => {
    if (!active) {
      return;
    }

    const root = document.documentElement;
    let timer: number | null = null;
    let pressed = false;
    let lastX = Number.NaN;
    let lastY = Number.NaN;

    const clearTimer = () => {
      if (timer === null) {
        return;
      }
      window.clearTimeout(timer);
      timer = null;
    };

    const arm = () => {
      root.classList.remove(IDLE_CLASS);
      clearTimer();
      if (pressed) {
        return;
      }
      timer = window.setTimeout(() => {
        timer = null;
        root.classList.add(IDLE_CLASS);
      }, IDLE_MS);
    };

    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      const moved = Number.isNaN(lastX) || Math.hypot(dx, dy) >= MOVE_PX;
      if (!moved) {
        return;
      }
      lastX = event.clientX;
      lastY = event.clientY;
      arm();
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      pressed = true;
      lastX = event.clientX;
      lastY = event.clientY;
      arm();
    };

    const onUp = () => {
      if (!pressed) {
        return;
      }
      pressed = false;
      arm();
    };

    arm();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      clearTimer();
      root.classList.remove(IDLE_CLASS);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [active]);
};
