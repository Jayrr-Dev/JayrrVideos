import { useEffect, useRef, useState } from "react";

import "./JayrrPresentCursor.scss";

type Burst = {
  id: number;
  x: number;
  y: number;
};

const BURST_LINE_COUNT = 12;
const BURST_ANGLES = Array.from(
  { length: BURST_LINE_COUNT },
  (_, index) => (360 / BURST_LINE_COUNT) * index,
);

const PointerGlyph = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path
      d="M8 4v22l5.5-5.5 4 8.5 3.5-1.7-3.8-8.3h7.3Z"
      fill="#1b1b1f"
      stroke="#ffffff"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
);

// Presses held longer than this show the hold ring instead of a burst.
const HOLD_MS = 200;

const writePointerTransform = (
  node: HTMLDivElement | null,
  x: number,
  y: number,
  pressed: boolean,
) => {
  if (!node) {
    return;
  }
  const scale = pressed ? 0.86 : 1;
  node.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
};

const writeHoldTransform = (
  node: HTMLDivElement | null,
  x: number,
  y: number,
) => {
  if (!node) {
    return;
  }
  node.style.transform = `translate(${x}px, ${y}px)`;
};

export const JayrrPresentCursor = () => {
  const pointerRef = useRef<HTMLDivElement | null>(null);
  const holdRef = useRef<HTMLDivElement | null>(null);
  const pointRef = useRef({ x: 0, y: 0 });
  const pressedRef = useRef(false);
  const holdingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add("jayrr-present-custom-cursor");
    return () => {
      document.documentElement.classList.remove("jayrr-present-custom-cursor");
    };
  }, []);

  useEffect(() => {
    const clearHoldTimer = () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
    const movePointer = (event: PointerEvent) => {
      pointRef.current = { x: event.clientX, y: event.clientY };
      writePointerTransform(
        pointerRef.current,
        event.clientX,
        event.clientY,
        pressedRef.current,
      );
      if (holdingRef.current) {
        writeHoldTransform(holdRef.current, event.clientX, event.clientY);
      }
    };
    const press = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      pressedRef.current = true;
      pointRef.current = { x: event.clientX, y: event.clientY };
      writePointerTransform(
        pointerRef.current,
        event.clientX,
        event.clientY,
        true,
      );
      clearHoldTimer();
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        holdingRef.current = true;
        setHolding(true);
      }, HOLD_MS);
    };
    const release = () => {
      if (!pressedRef.current) {
        return;
      }
      pressedRef.current = false;
      clearHoldTimer();
      writePointerTransform(
        pointerRef.current,
        pointRef.current.x,
        pointRef.current.y,
        false,
      );
      if (holdingRef.current) {
        holdingRef.current = false;
        setHolding(false);
        return;
      }
      burstId.current += 1;
      setBursts((current) => [
        ...current,
        { id: burstId.current, x: pointRef.current.x, y: pointRef.current.y },
      ]);
    };

    window.addEventListener("pointermove", movePointer);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      clearHoldTimer();
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  return (
    <div className="jayrr-present-cursor" aria-hidden="true">
      {bursts.map((burst) =>
        BURST_ANGLES.map((angle, index) => (
          <span
            key={`${burst.id}-line-${index}`}
            className={
              index % 2 === 0
                ? "jayrr-present-cursor__line is-long"
                : "jayrr-present-cursor__line"
            }
            style={{
              left: burst.x,
              top: burst.y,
              ["--angle" as string]: `${angle}deg`,
            }}
            onAnimationEnd={
              index === 0
                ? () => {
                    setBursts((current) =>
                      current.filter((item) => item.id !== burst.id),
                    );
                  }
                : undefined
            }
          />
        )),
      )}
      {holding ? (
        <div
          ref={(node) => {
            holdRef.current = node;
            writeHoldTransform(node, pointRef.current.x, pointRef.current.y);
          }}
          className="jayrr-present-cursor__hold"
        />
      ) : null}
      <div ref={pointerRef} className="jayrr-present-cursor__pointer">
        <PointerGlyph />
      </div>
    </div>
  );
};
