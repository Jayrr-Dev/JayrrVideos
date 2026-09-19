import { useEffect, useRef, useState } from "react";

import "./JayrrPresentCursor.scss";

type Burst = {
  id: number;
  x: number;
  y: number;
};

const SPARKS = [
  { x: "-28px", y: "-22px" },
  { x: "26px", y: "-18px" },
  { x: "22px", y: "24px" },
  { x: "-24px", y: "20px" },
  { x: "4px", y: "-32px" },
  { x: "-6px", y: "30px" },
] as const;

const PointerGlyph = () => (
  <svg viewBox="0 0 88 88" aria-hidden="true" focusable="false">
    <path
      d="M8 6v62l16-15 10 24 16-7-11-23h22Z"
      fill="#fff7e8"
      stroke="#1e1e1e"
      strokeWidth="5.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path d="M18 22 58 40 40 46 30 68 22 64 32 44Z" fill="#fa5252" />
    <circle
      cx="14"
      cy="14"
      r="6"
      fill="#ffd43b"
      stroke="#1e1e1e"
      strokeWidth="3"
    />
  </svg>
);

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

export const JayrrPresentCursor = () => {
  const pointerRef = useRef<HTMLDivElement | null>(null);
  const pointRef = useRef({ x: 0, y: 0 });
  const pressedRef = useRef(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add("jayrr-present-custom-cursor");
    return () => {
      document.documentElement.classList.remove("jayrr-present-custom-cursor");
    };
  }, []);

  useEffect(() => {
    const movePointer = (event: PointerEvent) => {
      pointRef.current = { x: event.clientX, y: event.clientY };
      writePointerTransform(
        pointerRef.current,
        event.clientX,
        event.clientY,
        pressedRef.current,
      );
    };
    const press = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      pressedRef.current = true;
      writePointerTransform(
        pointerRef.current,
        event.clientX,
        event.clientY,
        true,
      );
      burstId.current += 1;
      setBursts((current) => [
        ...current,
        { id: burstId.current, x: event.clientX, y: event.clientY },
      ]);
    };
    const release = () => {
      pressedRef.current = false;
      writePointerTransform(
        pointerRef.current,
        pointRef.current.x,
        pointRef.current.y,
        false,
      );
    };

    window.addEventListener("pointermove", movePointer);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  return (
    <div className="jayrr-present-cursor" aria-hidden="true">
      {bursts.map((burst) => (
        <span
          key={burst.id}
          className="jayrr-present-cursor__ripple"
          style={{ left: burst.x, top: burst.y }}
          onAnimationEnd={() => {
            setBursts((current) =>
              current.filter((item) => item.id !== burst.id),
            );
          }}
        />
      ))}
      {bursts.map((burst) =>
        SPARKS.map((spark, index) => (
          <span
            key={`${burst.id}-spark-${index}`}
            className="jayrr-present-cursor__spark"
            style={{
              left: burst.x,
              top: burst.y,
              ["--spark-x" as string]: spark.x,
              ["--spark-y" as string]: spark.y,
              animationDelay: `${index * 18}ms`,
            }}
          />
        )),
      )}
      <div ref={pointerRef} className="jayrr-present-cursor__pointer">
        <PointerGlyph />
      </div>
    </div>
  );
};
