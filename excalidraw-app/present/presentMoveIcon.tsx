import type { ReactNode } from "react";

const MOVE_ICON_PATHS = (
  <>
    <path d="M10 3.1v13.8M3.1 10h13.8" />
    <path d="M7.1 6.2 10 3.1l2.9 3.1M7.1 13.8 10 16.9l2.9-3.1M6.2 7.1 3.1 10l3.1 2.9M13.8 7.1 16.9 10l-3.1 2.9" />
  </>
);

export const PresentMoveIcon = (): ReactNode => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    {MOVE_ICON_PATHS}
  </svg>
);

export const PresentMoveHandle = ({
  x,
  y,
  size = 18,
}: {
  x: number;
  y: number;
  size?: number;
}): ReactNode => {
  const scale = size / 20;
  return (
    <g
      className="jayrr-present-translation__handle"
      transform={`translate(${x} ${y}) scale(${scale}) translate(-10 -10)`}
    >
      {MOVE_ICON_PATHS}
    </g>
  );
};
