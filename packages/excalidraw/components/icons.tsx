//
// Includes original Jayrr hand-drawn icons, Tabler icons, and Font Awesome icons.
// Font Awesome source: https://fontawesome.com/icons?d=gallery
// Icons are under the license https://fontawesome.com/license
//

// Note: when adding new icons, review https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/RTL_Guidelines
// to determine whether or not the icons should be mirrored in right-to-left languages.

import clsx from "clsx";
import React from "react";

import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { handdrawnUIIcon } from "./handdrawnUIIcons";

export const iconFillColor = (theme: Theme) => "var(--icon-fill-color)";

const handlerColor = (theme: Theme) =>
  theme === THEME.LIGHT ? "#fff" : "#1e1e1e";

type Opts = {
  width?: number;
  height?: number;
  mirror?: true;
} & React.SVGProps<SVGSVGElement>;

export const createIcon = (
  d: string | React.ReactNode,
  opts: number | Opts = 512,
) => {
  const {
    width = 512,
    height = width,
    mirror,
    style,
    ...rest
  } = typeof opts === "number" ? ({ width: opts } as Opts) : opts;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      className={clsx({ "rtl-mirror": mirror })}
      style={style}
      {...rest}
    >
      {typeof d === "string" ? <path fill="currentColor" d={d} /> : d}
    </svg>
  );
};

const tablerIconProps: Opts = {
  width: 24,
  height: 24,
  fill: "none",
  strokeWidth: 2,
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const modifiedTablerIconProps: Opts = {
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const arrowheadPreviewIconProps: Opts = {
  width: 40,
  height: 20,
} as const;

/** JayrrVideos brand: Yobi-like doodle — thick round stroke, yellow blob fill. */
const doodleIconProps: Opts = {
  width: 24,
  height: 24,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.55,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: {
    transform: "scale(1.25)",
    transformOrigin: "center",
  },
} as const;

const JAYRR_YELLOW = "#F5D000";

// These drawings use a 100-unit artboard, independently of doodleIconProps.
// The class lets the toolbar size them without changing other icon consumers.
const handdrawnToolIconProps: Opts = {
  width: 100,
  height: 100,
  fill: "none",
  className: "handdrawn-tool-icon",
};

// -----------------------------------------------------------------------------

// tabler-icons: present
export const PlusPromoIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <rect x={3} y={8} width={18} height={4} rx={1} />
    <line x1={12} y1={8} x2={12} y2={21} />
    <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
  </g>,
  tablerIconProps,
);

// tabler-icons: book
export const LibraryIcon = handdrawnUIIcon("library");

export const SceneIcon = handdrawnUIIcon("sketch");

// tabler-icons: plus
export const PlusIcon = handdrawnUIIcon("plus");

// tabler-icons: dots-vertical
export const DotsIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
    <circle cx="12" cy="5" r="1"></circle>
  </g>,
  tablerIconProps,
);

// tabler-icons: dots-horizontal (horizontal equivalent of dots-vertical)
export const DotsHorizontalIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  </g>,
  tablerIconProps,
);

// tabler-icons: pinned
export const PinIcon = handdrawnUIIcon("pin");

export const polygonIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M19 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M5 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M15 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M6.5 9.5l3.5 -3" />
    <path d="M14 5.5l3 1.5" />
    <path d="M18.5 10l-2.5 7" />
    <path d="M13.5 17.5l-7 -5" />
  </g>,
  tablerIconProps,
);

// tabler-icons: lock-open (via Figma)
export const UnlockedIcon = handdrawnUIIcon("unlock");

// tabler-icons: lock (via Figma)
export const LockedIcon = handdrawnUIIcon("lock");

export const LockedIconFilled = handdrawnUIIcon("lock");

// custom
export const WelcomeScreenMenuArrow = createIcon(
  <>
    <path
      d="M38.5 83.5c-14-2-17.833-10.473-21-22.5C14.333 48.984 12 22 12 12.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m12.005 10.478 7.905 14.423L6 25.75l6.005-15.273Z"
      fill="currentColor"
    />
    <path
      d="M12.005 10.478c1.92 3.495 3.838 7 7.905 14.423m-7.905-14.423c3.11 5.683 6.23 11.368 7.905 14.423m0 0c-3.68.226-7.35.455-13.91.85m13.91-.85c-5.279.33-10.566.647-13.91.85m0 0c1.936-4.931 3.882-9.86 6.005-15.273M6 25.75c2.069-5.257 4.135-10.505 6.005-15.272"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </>,
  { width: 41, height: 94, fill: "none" },
);

// custom
export const WelcomeScreenHelpArrow = createIcon(
  <>
    <path
      d="M18.026 1.232c-5.268 13.125-5.548 33.555 3.285 42.311 8.823 8.75 33.31 12.304 42.422 13.523"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m72.181 59.247-13.058-10-2.948 13.62 16.006-3.62Z"
      fill="currentColor"
    />
    <path
      d="M72.181 59.247c-3.163-2.429-6.337-4.856-13.058-10m13.058 10c-5.145-3.936-10.292-7.882-13.058-10m0 0c-.78 3.603-1.563 7.196-2.948 13.62m2.948-13.62c-1.126 5.168-2.24 10.346-2.948 13.62m0 0c5.168-1.166 10.334-2.343 16.006-3.62m-16.006 3.62c5.51-1.248 11.01-2.495 16.006-3.62"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </>,
  { width: 85, height: 71, fill: "none" },
);

// custom
export const WelcomeScreenTopToolbarArrow = createIcon(
  <>
    <path
      d="M1 77c14-2 31.833-11.973 35-24 3.167-12.016-6-35-9.5-43.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m24.165 1.093-2.132 16.309 13.27-4.258-11.138-12.05Z"
      fill="currentColor"
    />
    <path
      d="M24.165 1.093c-.522 3.953-1.037 7.916-2.132 16.309m2.131-16.309c-.835 6.424-1.68 12.854-2.13 16.308m0 0c3.51-1.125 7.013-2.243 13.27-4.257m-13.27 4.257c5.038-1.608 10.08-3.232 13.27-4.257m0 0c-3.595-3.892-7.197-7.777-11.14-12.05m11.14 12.05c-3.837-4.148-7.667-8.287-11.14-12.05"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </>,
  { width: 38, height: 78, fill: "none" },
);

// custom
export const ExcalLogo = createIcon(
  <g fill="currentColor">
    <path
      d="M39.9 32.889a.326.326 0 0 0-.279-.056c-2.094-3.083-4.774-6-7.343-8.833l-.419-.472a.212.212 0 0 0-.056-.139.586.586 0 0 0-.167-.111l-.084-.083-.056-.056c-.084-.167-.28-.278-.475-.167-.782.39-1.507.973-2.206 1.528-.92.722-1.842 1.445-2.708 2.25a8.405 8.405 0 0 0-.977 1.028c-.14.194-.028.361.14.444-.615.611-1.23 1.223-1.843 1.861a.315.315 0 0 0-.084.223c0 .083.056.166.111.194l1.09.833v.028c1.535 1.528 4.244 3.611 7.12 5.861.418.334.865.667 1.284 1 .195.223.39.473.558.695.084.11.28.139.391.055.056.056.14.111.196.167a.398.398 0 0 0 .167.056.255.255 0 0 0 .224-.111.394.394 0 0 0 .055-.167c.029 0 .028.028.056.028a.318.318 0 0 0 .224-.084l5.082-5.528a.309.309 0 0 0 0-.444Zm-14.63-1.917a.485.485 0 0 0 .111.14c.586.5 1.2 1 1.843 1.555l-2.569-1.945-.251-.166c-.056-.028-.112-.084-.168-.111l-.195-.167.056-.056.055-.055.112-.111c.866-.861 2.346-2.306 3.1-3.028-.81.805-2.43 3.167-2.095 3.944Zm8.767 6.89-2.122-1.612a44.713 44.713 0 0 0-2.625-2.5c1.145.861 2.122 1.611 2.262 1.75 1.117.972 1.06.806 1.815 1.445l.921.666a1.06 1.06 0 0 1-.251.25Zm.558.416-.056-.028c.084-.055.168-.111.252-.194l-.196.222ZM1.089 5.75c.055.361.14.722.195 1.056.335 1.833.67 3.5 1.284 4.75l.252.944c.084.361.223.806.363.917 1.424 1.25 3.602 3.11 5.947 4.889a.295.295 0 0 0 .363 0s0 .027.028.027a.254.254 0 0 0 .196.084.318.318 0 0 0 .223-.084c2.988-3.305 5.221-6.027 6.813-8.305.112-.111.14-.278.14-.417.111-.111.195-.25.307-.333.111-.111.111-.306 0-.39l-.028-.027c0-.055-.028-.139-.084-.167-.698-.666-1.2-1.138-1.731-1.638-.922-.862-1.871-1.75-3.881-3.75l-.028-.028c-.028-.028-.056-.056-.112-.056-.558-.194-1.703-.389-3.127-.639C6.087 2.223 3.21 1.723.614.944c0 0-.168 0-.196.028l-.083.084c-.028.027-.056.055-.224.11h.056-.056c.028.167.028.278.084.473 0 .055.112.5.112.555l.782 3.556Zm15.496 3.278-.335-.334c.084.112.196.195.335.334Zm-3.546 4.666-.056.056c0-.028.028-.056.056-.056Zm-2.038-10c.168.167.866.834 1.033.973-.726-.334-2.54-1.167-3.379-1.445.838.167 1.983.334 2.346.472ZM1.424 2.306c.419.722.754 3.222 1.089 5.666-.196-.778-.335-1.555-.503-2.278-.251-1.277-.503-2.416-.838-3.416.056 0 .14 0 .252.028Zm-.168-.584c-.112 0-.223-.028-.307-.028 0-.027 0-.055-.028-.055.14 0 .223.028.335.083Zm-1.089.222c0-.027 0-.027 0 0ZM39.453 1.333c.028-.11-.558-.61-.363-.639.42-.027.42-.666 0-.666-.558.028-1.144.166-1.675.25-.977.194-1.982.389-2.96.61-2.205.473-4.383.973-6.561 1.557-.67.194-1.424.333-2.066.666-.224.111-.196.333-.084.472-.056.028-.084.028-.14.056-.195.028-.363.056-.558.083-.168.028-.252.167-.224.334 0 .027.028.083.028.11-1.173 1.556-2.485 3.195-3.909 4.945-1.396 1.611-2.876 3.306-4.356 5.056-4.719 5.5-10.052 11.75-15.943 17.25a.268.268 0 0 0 0 .389c.028.027.056.055.084.055-.084.084-.168.14-.252.222-.056.056-.084.111-.084.167a.605.605 0 0 0-.111.139c-.112.111-.112.305.028.389.111.11.307.11.39-.028.029-.028.029-.056.056-.056a.44.44 0 0 1 .615 0c.335.362.67.723.977 1.028l-.698-.583c-.112-.111-.307-.083-.39.028-.113.11-.085.305.027.389l7.427 6.194c.056.056.112.056.196.056s.14-.028.195-.084l.168-.166c.028.027.083.027.111.027.084 0 .14-.027.196-.083 10.052-10.055 18.15-17.639 27.42-24.417.083-.055.111-.166.111-.25.112 0 .196-.083.251-.194 1.704-5.194 2.039-9.806 2.15-12.083v-.028c0-.028.028-.056.028-.083.028-.056.028-.084.028-.084a1.626 1.626 0 0 0-.111-1.028ZM21.472 9.5c.446-.5.893-1.028 1.34-1.5-2.876 3.778-7.65 9.583-14.408 16.5 4.607-5.083 9.242-10.333 13.068-15ZM5.193 35.778h.084-.084Zm3.462 3.194c-.027-.028-.027-.028 0-.028v.028Zm4.16-3.583c.224-.25.448-.472.699-.722 0 0 0 .027.028.027-.252.223-.475.445-.726.695Zm1.146-1.111c.14-.14.279-.334.446-.5l.028-.028c1.648-1.694 3.351-3.389 5.082-5.111l.028-.028c.419-.333.921-.694 1.368-1.028a379.003 379.003 0 0 0-6.952 6.695ZM24.794 6.472c-.921 1.195-1.954 2.778-2.82 4.028-2.736 3.944-11.532 13.583-11.727 13.75a1976.983 1976.983 0 0 1-8.042 7.639l-.167.167c-.14-.167-.14-.417.028-.556C14.49 19.861 22.03 10.167 25.074 5.917c-.084.194-.14.36-.28.555Zm4.83 5.695c-1.116-.64-1.646-1.64-1.34-2.611l.084-.334c.028-.083.084-.194.14-.277.307-.5.754-.917 1.257-1.167.027 0 .055 0 .083-.028-.028-.056-.028-.139-.028-.222.028-.167.14-.278.335-.278.335 0 1.369.306 1.76.639.111.083.223.194.335.305.14.167.363.445.474.667.056.028.112.306.196.445.056.222.111.472.084.694-.028.028 0 .194-.028.194a2.668 2.668 0 0 1-.363 1.028c-.028.028-.028.056-.056.084l-.028.027c-.14.223-.335.417-.53.556-.643.444-1.369.583-2.095.389 0 0-.195-.084-.28-.111Zm8.154-.834a39.098 39.098 0 0 1-.893 3.167c0 .028-.028.083 0 .111-.056 0-.084.028-.14.056-2.206 1.61-4.356 3.305-6.506 5.028 1.843-1.64 3.686-3.306 5.613-4.945.558-.5.949-1.139 1.06-1.861l.28-1.667v-.055c.14-.334.67-.195.586.166Z"
      fill="currentColor"
    />
  </g>,
  { width: 40, height: 40, fill: "none" },
);

// Original artwork matches public/icons/jayrr-handdrawn; ink follows the UI theme.
export const SelectionIcon = createIcon(
  <g>
    <path d="M33 24 L70 53 51 57 62 78 51 84 40 62 27 75Z" fill="#f4ce19" />
    <path
      d="M28 18 Q43 32 69 51 L49 55 Q55 65 60 78 L50 83 39 61 26 73 Q29 47 28 18Z"
      fill="var(--island-bg-color, white)"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M32 28 L57 49 44 51 53 75 50 77 38 55 31 64Z" fill="#f4ce19" />
    <path
      d="M15 21 11 14 M23 12 22 6 M38 15 43 9 M12 34 6 34"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const LassoIcon = createIcon(
  <g>
    <path
      fill={JAYRR_YELLOW}
      d="M6.5 11.2c-.4-1-.6-2.1-.5-3.2C6.2 5.2 9.4 3.2 13 3.4c3.5.2 6.2 2.8 6 5.9-.2 3-3.2 5.4-6.6 5.3-1.6 0-3.1-.4-4.3-1.1"
    />
    <path d="M6.5 11.2c-.4-1-.6-2.1-.5-3.2C6.2 5.2 9.4 3.2 13 3.4c3.5.2 6.2 2.8 6 5.9-.2 3-3.2 5.4-6.6 5.3-1.6 0-3.1-.4-4.3-1.1" />
    <circle cx="5.4" cy="15.2" r="2.1" fill={JAYRR_YELLOW} />
    <circle cx="5.4" cy="15.2" r="2.1" />
    <path d="M5.6 17.2c.2 1.4.7 2.8 1.5 4" />
  </g>,
  doodleIconProps,
);

export const RectangleIcon = createIcon(
  <g>
    <path d="M18 23 80 20 81 31 18 34Z" fill="#f4ce19" />
    <path
      d="M15 21 Q44 23 81 19 L83 75 Q56 74 16 78 Q18 52 15 21Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 35 Q48 33 77 34 M23 40 24 70 M30 42 31 69 M37 42 38 70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 82 Q42 80 68 81 M76 81 89 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const DiamondIcon = createIcon(
  <g>
    <path d="M48 15 62 34 45 83 34 58Z" fill="#f4ce19" />
    <path
      d="M48 12 Q63 33 84 48 Q65 65 47 88 Q29 65 13 48 Q29 34 48 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 47 78 48 M48 16 35 47 47 85 62 48 48 16 M30 31 65 31"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M73 19 78 13 M82 29 89 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const EllipseIcon = createIcon(
  <g>
    <path d="M65 20 C89 36 79 74 54 81 C75 65 72 39 57 23Z" fill="#f4ce19" />
    <path
      d="M49 18 C24 15 13 34 16 54 C18 76 35 85 54 81 C77 78 87 58 80 38 C75 24 66 18 52 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M23 42 C22 30 32 23 42 23 M23 48 23 55 M63 72 75 55 M67 62 75 47 M70 49 73 41"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const ArrowIcon = createIcon(
  <g>
    <path d="M17 43 62 40 58 24 89 48 62 73 64 57 16 60Z" fill="#f4ce19" />
    <path
      d="M12 40 Q36 42 60 39 L58 22 Q74 36 89 48 L60 77 61 59 Q36 57 12 61Z"
      fill="var(--island-bg-color, white)"
      stroke="currentColor"
      strokeWidth="4.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M18 47 67 46 65 34 80 48 66 63 68 53 18 55Z" fill="#f4ce19" />
    <path
      d="M16 67 31 65 M15 72 26 70 M44 47 65 47"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const LineIcon = createIcon(
  <g>
    <path
      d="M17 74 Q35 57 49 46 T81 19"
      fill="none"
      stroke="currentColor"
      strokeWidth="6.45"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 79 Q40 60 52 52"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 71 19 67 24 74 18 81Z"
      fill="#f4ce19"
      stroke="currentColor"
      strokeWidth="3.15"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M76 18 82 13 88 20 81 26Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M62 17 62 10 M77 7 78 3 M89 36 96 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const PenModeIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M20 17v-12c0 -1.121 -.879 -2 -2 -2s-2 .879 -2 2v12l2 2l2 -2z"></path>
    <path d="M16 7h4"></path>
    <path d="M18 19h-13a2 2 0 1 1 0 -4h4a2 2 0 1 0 0 -4h-3"></path>
  </g>,
  tablerIconProps,
);

export const FreedrawIcon = createIcon(
  <g>
    <path d="M33 27 49 21 68 72 62 89 49 79Z" fill="#f4ce19" />
    <path
      d="M29 24 Q35 15 46 19 L67 72 63 91 49 79Z"
      fill="#f4ce19"
      stroke="currentColor"
      strokeWidth="4.05"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M29 24 Q39 28 47 20 M32 31 Q42 34 50 26 M49 79 52 70 58 74 62 68 67 72 M52 36 62 63 M39 38 50 66 M44 37 55 65"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M58 84 63 91 65 81Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 36 12 31 M19 23 10 21 M23 13 19 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const TextIcon = createIcon(
  <g>
    <path
      d="M17 20 Q46 23 83 17 L81 35 73 36 72 29 57 30 Q55 54 58 77 L67 78 67 84 36 86 35 80 44 78 44 31 28 32 26 39 18 38Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M47 31 53 30 52 77 48 78Z" fill="#f4ce19" />
    <path
      d="M21 14 Q50 17 78 11 M72 81 78 81"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const TextSizeIcon = createIcon(
  <g stroke="currentColor" strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 7v-2h13v2" />
    <path d="M10 5v14" />
    <path d="M12 19h-4" />
    <path d="M15 13v-1h6v1" />
    <path d="M18 12v7" />
    <path d="M17 19h2" />
  </g>,
  tablerIconProps,
);

export const ImageIcon = createIcon(
  <g>
    <path
      d="M15 22 Q40 24 83 19 L80 80 Q46 77 16 83Z"
      fill="var(--island-bg-color, white)"
      stroke="currentColor"
      strokeWidth="4.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 30 75 27 74 69 24 72Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M47 39 C48 29 62 28 65 37 C69 50 48 52 47 39Z" fill="#f4ce19" />
    <path
      d="M50 36 C54 29 64 35 62 42 C59 49 48 46 50 36Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M25 65 37 48 48 61 56 53 73 68"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 86 57 83 M64 83 78 85"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const EraserIcon = createIcon(
  <g>
    <path
      d="M18 58 49 19 Q53 14 58 18 L84 39 Q88 43 83 49 L53 83 43 84Z"
      fill="var(--island-bg-color, white)"
      stroke="currentColor"
      strokeWidth="4.05"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M21 58 36 40 67 64 53 81 44 81Z" fill="#f4ce19" />
    <path
      d="M35 37 69 63 M20 58 48 80 81 44 M48 80 47 71"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M64 83 84 84 M73 76 80 77 M27 85 31 88 M18 81 22 82 M10 89 15 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const ZoomInIcon = createIcon(
  <path strokeWidth="1.25" d="M10 4.167v11.666M4.167 10h11.666" />,
  modifiedTablerIconProps,
);

export const ZoomOutIcon = createIcon(
  <path d="M5 10h10" strokeWidth="1.25" />,
  modifiedTablerIconProps,
);

export const ZoomResetIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M21 21l-6 -6" />
    <path d="M3.268 12.043a7.017 7.017 0 0 0 6.634 4.957a7.012 7.012 0 0 0 7.043 -6.131a7 7 0 0 0 -5.314 -7.672a7.021 7.021 0 0 0 -8.241 4.403" />
    <path d="M3 4v4h4" />
  </g>,
  tablerIconProps,
);

export const TrashIcon = handdrawnUIIcon("trash");

export const EmbedIcon = createIcon(
  <g>
    <path d="M8.4 6.2L3.6 12.1 8.6 17.8" />
    <path d="M15.6 6.2L20.4 12.1 15.4 17.8" />
    <path d="M13.4 4.8l-2.8 14.4" />
  </g>,
  doodleIconProps,
);

export const DuplicateIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M14.375 6.458H8.958a2.5 2.5 0 0 0-2.5 2.5v5.417a2.5 2.5 0 0 0 2.5 2.5h5.417a2.5 2.5 0 0 0 2.5-2.5V8.958a2.5 2.5 0 0 0-2.5-2.5Z" />
    <path
      clipRule="evenodd"
      d="M11.667 3.125c.517 0 .986.21 1.325.55.34.338.55.807.55 1.325v1.458H8.333c-.485 0-.927.185-1.26.487-.343.312-.57.75-.609 1.24l-.005 5.357H5a1.87 1.87 0 0 1-1.326-.55 1.87 1.87 0 0 1-.549-1.325V5c0-.518.21-.987.55-1.326.338-.34.807-.549 1.325-.549h6.667Z"
    />
  </g>,
  modifiedTablerIconProps,
);

export const MoonIcon = handdrawnUIIcon("moon");

export const SunIcon = handdrawnUIIcon("sun");

export const HamburgerMenuIcon = handdrawnUIIcon("menu");

export const ExportIcon = handdrawnUIIcon("download");

export const HelpIcon = handdrawnUIIcon("help");

export const HelpIconThin = handdrawnUIIcon("help");

export const ExternalLinkIcon = createIcon(
  <path
    strokeWidth="1.25"
    d="M9.167 5.833H5.833c-1.254 0-2.5 1.282-2.5 2.5v5.834c0 1.283 1.252 2.5 2.5 2.5h5.834c1.251 0 2.5-1.25 2.5-2.5v-3.334M8.333 11.667l8.334-8.334M12.5 3.333h4.167V7.5"
  />,
  modifiedTablerIconProps,
);

export const GithubIcon = handdrawnUIIcon("github");

export const DiscordIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M7.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM12.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM6.25 6.25c2.917-.833 4.583-.833 7.5 0M5.833 13.75c2.917.833 5.417.833 8.334 0" />
    <path d="M12.917 14.167c0 .833 1.25 2.5 1.666 2.5 1.25 0 2.361-1.39 2.917-2.5.556-1.39.417-4.861-1.25-9.584-1.214-.846-2.5-1.116-3.75-1.25l-.833 2.084M7.083 14.167c0 .833-1.13 2.5-1.526 2.5-1.191 0-2.249-1.39-2.778-2.5-.529-1.39-.397-4.861 1.19-9.584 1.157-.846 2.318-1.116 3.531-1.25l.833 2.084" />
  </g>,
  modifiedTablerIconProps,
);

export const XBrandIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </g>,
  tablerIconProps,
);

export const checkIcon = createIcon(
  <polyline fill="none" stroke="currentColor" points="20 6 9 17 4 12" />,
  {
    width: 24,
    height: 24,
  },
);

export const LinkIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M8.333 11.667a2.917 2.917 0 0 0 4.167 0l3.333-3.334a2.946 2.946 0 1 0-4.166-4.166l-.417.416" />
    <path d="M11.667 8.333a2.917 2.917 0 0 0-4.167 0l-3.333 3.334a2.946 2.946 0 0 0 4.166 4.166l.417-.416" />
  </g>,
  modifiedTablerIconProps,
);

export const save = handdrawnUIIcon("download");

export const saveAs = handdrawnUIIcon("download");

// tabler-icon: folder
export const LoadIcon = handdrawnUIIcon("folder");

export const clipboard = createIcon(
  "M384 112v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h80c0-35.29 28.71-64 64-64s64 28.71 64 64h80c26.51 0 48 21.49 48 48zM192 40c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24m96 114v-20a6 6 0 0 0-6-6H102a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h180a6 6 0 0 0 6-6z",
  { width: 384, height: 512 },
);

export const palette = createIcon(
  "M204.3 5C104.9 24.4 24.8 104.3 5.2 203.4c-37 187 131.7 326.4 258.8 306.7 41.2-6.4 61.4-54.6 42.5-91.7-23.1-45.4 9.9-98.4 60.9-98.4h79.7c35.8 0 64.8-29.6 64.9-65.3C511.5 97.1 368.1-26.9 204.3 5zM96 320c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm32-128c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128-64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128 64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z",
);

export const bucketFillIconSvgPaths = [
  "M5 16l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737z",
  "M13.737 9.737c2.299 -2.3 3.23 -5.095 2.081 -6.245c-1.15 -1.15 -3.945 -.217 -6.244 2.082c-2.3 2.299 -3.231 5.095 -2.082 6.244c1.15 1.15 3.946 .218 6.245 -2.081z",
  "M7.492 11.818c.362 .362 .768 .676 1.208 .934l6.895 4.047c1.078 .557 2.255 -.075 3.692 -1.512c1.437 -1.437 2.07 -2.614 1.512 -3.692c-.372 -.718 -1.72 -3.017 -4.047 -6.895a6.015 6.015 0 0 0 -.934 -1.208",
] as const;

export const bucketFillIcon = createIcon(
  <g>
    <path
      fill={JAYRR_YELLOW}
      d="M12.8 4.4c2.6-2.4 5.8-2.1 6.6-.4.8 1.8-.8 4.6-3.4 7.1-2.6 2.4-5.8 2.2-6.6.4-.8-1.7.8-4.6 3.4-7.1z"
    />
    <path d="M12.8 4.4c2.6-2.4 5.8-2.1 6.6-.4.8 1.8-.8 4.6-3.4 7.1-2.6 2.4-5.8 2.2-6.6.4-.8-1.7.8-4.6 3.4-7.1z" />
    <path d="M8.2 10.8c.4.4.9.8 1.4 1.1l6.4 3.8c.9.5 1.6.2 2.8-1 1.2-1.2 1.6-2.1 1.1-3-1.6-3.1-4.2-6.4-5.6-7.6" />
    <path d="M5.2 16.4l1.2 1.4a1.6 1.6 0 1 1-2.4.1z" fill={JAYRR_YELLOW} />
    <path d="M5.2 16.4l1.2 1.4a1.6 1.6 0 1 1-2.4.1z" />
  </g>,
  doodleIconProps,
);

// simple / icon
export const slashIcon = createIcon(
  <g strokeWidth={1.5}>
    <path d="M6 18l12 -12" />
  </g>,
  tablerIconProps,
);

export const ExportImageIcon = handdrawnUIIcon("exportImage");

export const exportToFileIcon = createIcon(
  "M216 0h80c13.3 0 24 10.7 24 24v168h87.7c17.8 0 26.7 21.5 14.1 34.1L269.7 378.3c-7.5 7.5-19.8 7.5-27.3 0L90.1 226.1c-12.6-12.6-3.7-34.1 14.1-34.1H192V24c0-13.3 10.7-24 24-24zm296 376v112c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V376c0-13.3 10.7-24 24-24h146.7l49 49c20.1 20.1 52.5 20.1 72.6 0l49-49H488c13.3 0 24 10.7 24 24zm-124 88c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20zm64 0c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20z",
  { width: 512, height: 512 },
);

export const zoomIn = createIcon(
  "M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z",
  { width: 448, height: 512 },
);

export const zoomOut = createIcon(
  "M416 208H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h384c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z",
  { width: 448, height: 512 },
);

export const done = createIcon(
  "M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z",
);

export const menu = handdrawnUIIcon("menu");

export const UndoIcon = createIcon(
  <path
    d="M7.5 10.833 4.167 7.5 7.5 4.167M4.167 7.5h9.166a3.333 3.333 0 0 1 0 6.667H12.5"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const RedoIcon = createIcon(
  <path
    d="M12.5 10.833 15.833 7.5 12.5 4.167M15.833 7.5H6.667a3.333 3.333 0 1 0 0 6.667H7.5"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const questionCircle = handdrawnUIIcon("help");

export const share = createIcon(
  <path
    d="M5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7.25 8.917l5.5-2.834M7.25 11.083l5.5 2.834"
    strokeWidth="1.5"
  />,
  modifiedTablerIconProps,
);

export const warning = createIcon(
  "M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z",
);

export const shareIOS = createIcon(
  "M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z",
  { width: 24, height: 24 },
);

export const exportToPlus = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 9h-1a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a2 2 0 0 0 -2 -2h-1" />
    <path d="M12 14v-11" />
    <path d="M9 6l3 -3l3 3" />
  </g>,
  tablerIconProps,
);

export const shareWindows = createIcon(
  <>
    <path
      fill="currentColor"
      d="M40 5.6v6.1l-4.1.7c-8.9 1.4-16.5 6.9-20.6 15C13 32 10.9 43 12.4 43c.4 0 2.4-1.3 4.4-3 5-3.9 12.1-7 18.2-7.7l5-.6v12.8l11.2-11.3L62.5 22 51.2 10.8 40-.5v6.1zm10.2 22.6L44 34.5v-6.8l-6.9.6c-3.9.3-9.8 1.7-13.2 3.1-3.5 1.4-6.5 2.4-6.7 2.2-.9-1 3-7.5 6.4-10.8C28 18.6 34.4 16 40.1 16c3.7 0 3.9-.1 3.9-3.2V9.5l6.2 6.3 6.3 6.2-6.3 6.2z"
    />
    <path
      stroke="currentColor"
      fill="currentColor"
      d="M0 36v20h48v-6.2c0-6 0-6.1-2-4.3-1.1 1-2 2.9-2 4.2V52H4V34c0-17.3-.1-18-2-18s-2 .7-2 20z"
    />
  </>,
  { width: 64, height: 64 },
);

// Icon imported form Storybook
// Storybook is licensed under MIT https://github.com/storybookjs/storybook/blob/next/LICENSE
export const resetZoom = createIcon(
  <path
    stroke="currentColor"
    strokeWidth="40"
    fill="currentColor"
    d="M148 560a318 318 0 0 0 522 110 316 316 0 0 0 0-450 316 316 0 0 0-450 0c-11 11-21 22-30 34v4h47c25 0 46 21 46 46s-21 45-46 45H90c-13 0-25-6-33-14-9-9-14-20-14-33V156c0-25 20-45 45-45s45 20 45 45v32l1 1a401 401 0 0 1 623 509l212 212a42 42 0 0 1-59 59L698 757A401 401 0 0 1 65 570a42 42 0 0 1 83-10z"
  />,
  { width: 1024 },
);

export const BringForwardIcon = handdrawnUIIcon("forward");

export const SendBackwardIcon = handdrawnUIIcon("backward");

export const BringToFrontIcon = handdrawnUIIcon("front");

export const SendToBackIcon = handdrawnUIIcon("back");

//
// Align action icons created from scratch to match those of z-index actions
// Note: vertical align icons are flipped so the larger item is always the
// first one the user sees. Horizontal align icons should not be flipped since
// that would make them lie about their function.
//
export const AlignTopIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 3.333h13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.542 6.458h-.417c-.92 0-1.667.747-1.667 1.667v7.083c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667V8.125c0-.92-.746-1.667-1.666-1.667ZM6.875 6.458h-.417c-.92 0-1.666.747-1.666 1.667v3.75c0 .92.746 1.667 1.666 1.667h.417c.92 0 1.667-.746 1.667-1.667v-3.75c0-.92-.747-1.667-1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const AlignBottomIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 16.667h13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.875 3.125h-.417c-.92 0-1.666.746-1.666 1.667v7.083c0 .92.746 1.667 1.666 1.667h.417c.92 0 1.667-.746 1.667-1.667V4.792c0-.92-.747-1.667-1.667-1.667ZM13.542 5.817h-.417c-.92 0-1.667.747-1.667 1.667v4.391c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667V7.484c0-.92-.746-1.667-1.666-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const AlignLeftIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 3.333v13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.208 4.792H8.125c-.92 0-1.667.746-1.667 1.666v.417c0 .92.747 1.667 1.667 1.667h7.083c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666ZM12.516 11.458H8.125c-.92 0-1.667.746-1.667 1.667v.417c0 .92.747 1.666 1.667 1.666h4.391c.92 0 1.667-.746 1.667-1.666v-.417c0-.92-.746-1.667-1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const AlignRightIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M16.667 3.333v13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.875 4.792H4.792c-.92 0-1.667.746-1.667 1.666v.417c0 .92.746 1.667 1.667 1.667h7.083c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666ZM11.683 11.458H7.292c-.92 0-1.667.746-1.667 1.667v.417c0 .92.746 1.666 1.667 1.666h4.39c.921 0 1.667-.746 1.667-1.666v-.417c0-.92-.746-1.667-1.666-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const DistributeHorizontallyIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M16.667 3.333v13.334M3.333 3.333v13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.375 10.208v-.416c0-.92-.746-1.667-1.667-1.667H7.292c-.92 0-1.667.746-1.667 1.667v.416c0 .92.746 1.667 1.667 1.667h5.416c.92 0 1.667-.746 1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const DistributeVerticallyIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 3.333h13.334M3.333 16.667h13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.208 5.625h-.416c-.92 0-1.667.746-1.667 1.667v5.416c0 .92.746 1.667 1.667 1.667h.416c.92 0 1.667-.746 1.667-1.667V7.292c0-.92-.746-1.667-1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const CenterVerticallyIcon = createIcon(
  <g stroke="currentColor" strokeWidth="1.25">
    <path d="M1.667 10h2.916" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.333 10h3.334" strokeLinejoin="round" />
    <path d="M15.417 10h2.916" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.875 4.792h-.417c-.92 0-1.666.746-1.666 1.666v7.084c0 .92.746 1.666 1.666 1.666h.417c.92 0 1.667-.746 1.667-1.666V6.458c0-.92-.747-1.666-1.667-1.666ZM13.542 6.458h-.417c-.92 0-1.667.747-1.667 1.667v3.75c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667v-3.75c0-.92-.746-1.667-1.666-1.667Z" />
  </g>,
  modifiedTablerIconProps,
);

export const CenterHorizontallyIcon = createIcon(
  <g stroke="currentColor" strokeWidth="1.25">
    <path d="M10 18.333v-2.916" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11.667V8.333" strokeLinejoin="round" />
    <path d="M10 4.583V1.667" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.792 13.125v.417c0 .92.746 1.666 1.666 1.666h7.084c.92 0 1.666-.746 1.666-1.666v-.417c0-.92-.746-1.667-1.666-1.667H6.458c-.92 0-1.666.746-1.666 1.667ZM6.458 6.458v.417c0 .92.747 1.667 1.667 1.667h3.75c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666h-3.75c-.92 0-1.667.746-1.667 1.666Z" />
  </g>,
  modifiedTablerIconProps,
);

export const usersIcon = handdrawnUIIcon("users");

// not mirrored because it's inspired by a playback control, which is always RTL
export const start = createIcon(
  "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm115.7 272l-176 101c-15.8 8.8-35.7-2.5-35.7-21V152c0-18.4 19.8-29.8 35.7-21l176 107c16.4 9.2 16.4 32.9 0 42z",
);

export const stop = createIcon(
  "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm96 328c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h160c8.8 0 16 7.2 16 16v160z",
);

export const CloseIcon = handdrawnUIIcon("close");

export const clone = createIcon(
  "M464 0c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48H176c-26.51 0-48-21.49-48-48V48c0-26.51 21.49-48 48-48h288M176 416c-44.112 0-80-35.888-80-80V128H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-48H176z",
  { mirror: true },
);

// modified https://feathericons.com/?query=shield
export const shield = createIcon(
  "M11.553 22.894a.998.998 0 00.894 0s3.037-1.516 5.465-4.097C19.616 16.987 21 14.663 21 12V5a1 1 0 00-.649-.936l-8-3a.998.998 0 00-.702 0l-8 3A1 1 0 003 5v7c0 2.663 1.384 4.987 3.088 6.797 2.428 2.581 5.465 4.097 5.465 4.097zm-1.303-8.481l6.644-6.644a.856.856 0 111.212 1.212l-7.25 7.25a.856.856 0 01-1.212 0l-3.75-3.75a.856.856 0 111.212-1.212l3.144 3.144z",
  { width: 24 },
);

export const file = createIcon(
  "M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm32-48h224V288l-23.5-23.5c-4.7-4.7-12.3-4.7-17 0L176 352l-39.5-39.5c-4.7-4.7-12.3-4.7-17 0L80 352v64zm48-240c-26.5 0-48 21.5-48 48s21.5 48 48 48 48-21.5 48-48-21.5-48-48-48z",
  { width: 384, height: 512 },
);

// TODO barnabasmolnar/editor-redesign
// couldn't find a new icon for this
export const GroupIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <>
      <path d="M25 26H111V111H25" fill={iconFillColor(theme)} />
      <path
        d="M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z"
        stroke={iconFillColor(theme)}
        strokeWidth="2"
      />
      <path d="M100 100H160V160H100" fill={iconFillColor(theme)} />
      <path
        d="M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z"
        stroke={iconFillColor(theme)}
        strokeWidth="2"
      />
      <g
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      >
        <rect x="2.5" y="2.5" width="30" height="30" />
        <rect x="2.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="2.5" width="30" height="30" />
      </g>
    </>,
    { width: 182, height: 182, mirror: true },
  ),
);

export const UngroupIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <>
      <path d="M25 26H111V111H25" fill={iconFillColor(theme)} />
      <path
        d="M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z"
        stroke={iconFillColor(theme)}
        strokeWidth="2"
      />
      <path d="M100 100H160V160H100" fill={iconFillColor(theme)} />
      <path
        d="M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z"
        stroke={iconFillColor(theme)}
        strokeWidth="2"
      />
      <g
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      >
        <rect x="2.5" y="2.5" width="30" height="30" />
        <rect x="78.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="78.5" width="30" height="30" />
        <rect x="105.5" y="2.5" width="30" height="30" />
        <rect x="2.5" y="102.5" width="30" height="30" />
      </g>
    </>,
    { width: 182, height: 182, mirror: true },
  ),
);

export const FillZigZagIcon = createIcon(
  <g strokeWidth={1.25}>
    <path d="M5.879 2.625h8.242a3.27 3.27 0 0 1 3.254 3.254v8.242a3.27 3.27 0 0 1-3.254 3.254H5.88a3.27 3.27 0 0 1-3.254-3.254V5.88A3.27 3.27 0 0 1 5.88 2.626l-.001-.001ZM4.518 16.118l7.608-12.83m.198 13.934 5.051-9.897M2.778 9.675l9.348-6.387m-7.608 12.83 12.857-8.793" />
  </g>,
  modifiedTablerIconProps,
);

export const FillHachureIcon = createIcon(
  <>
    <path
      d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z"
      stroke="currentColor"
      strokeWidth="1.25"
    />
    <mask
      id="FillHachureIcon"
      style={{ maskType: "alpha" }}
      maskUnits="userSpaceOnUse"
      x={2}
      y={2}
      width={16}
      height={16}
    >
      <path
        d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </mask>
    <g mask="url(#FillHachureIcon)">
      <path
        d="M2.258 15.156 15.156 2.258M7.324 20.222 20.222 7.325m-20.444 5.35L12.675-.222m-8.157 18.34L17.416 5.22"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </>,
  modifiedTablerIconProps,
);

export const FillCrossHatchIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <mask
        id="FillCrossHatchIcon"
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x={-1}
        y={-1}
        width={22}
        height={22}
      >
        <path
          d="M2.426 15.044 15.044 2.426M7.383 20 20 7.383M0 12.617 12.617 0m-7.98 17.941L17.256 5.324m-2.211 12.25L2.426 4.956M20 12.617 7.383 0m5.234 20L0 7.383m17.941 7.98L5.324 2.745"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <g mask="url(#FillCrossHatchIcon)">
        <path
          d="M14.121 2H5.88A3.879 3.879 0 0 0 2 5.879v8.242A3.879 3.879 0 0 0 5.879 18h8.242A3.879 3.879 0 0 0 18 14.121V5.88A3.879 3.879 0 0 0 14.121 2Z"
          fill="currentColor"
        />
      </g>
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FillSolidIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  { ...modifiedTablerIconProps, fill: "currentColor" },
);

export const StrokeWidthBaseIcon = handdrawnUIIcon("thin");

export const StrokeWidthBoldIcon = handdrawnUIIcon("bold");

export const StrokeWidthExtraBoldIcon = handdrawnUIIcon("heavy");

export const StrokeStyleSolidIcon = React.memo((_props: { theme: Theme }) =>
  handdrawnUIIcon("solid"),
);

export const StrokeStyleDashedIcon = handdrawnUIIcon("dashed");

// tabler-icons: line-dotted
export const StrokeStyleDottedIcon = handdrawnUIIcon("dotted");

export const SloppinessArchitectIcon = handdrawnUIIcon("neat");

export const SloppinessArtistIcon = handdrawnUIIcon("sketch");

export const SloppinessCartoonistIcon = handdrawnUIIcon("rough");

export const strokeVariabilityConstantIcon = createIcon(
  <g>
    <path
      d="M4 12 C 5 8, 6 8, 8 12"
      fill="none"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 12 C 9 16, 10 16, 12 12"
      fill="none"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 12 C 14 8, 15 8, 16 12"
      fill="none"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 12 C 17 16, 18 16, 19 12"
      fill="none"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  tablerIconProps,
);

export const strokeVariabilityVariableIcon = createIcon(
  <g>
    <path
      d="M4 12 C 5 8, 6 8, 8 12"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 12 C 9 16, 10 16, 12 12"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 12 C 14 8, 15 8, 16 12"
      fill="none"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 12 C 17 16, 18 16, 19 12"
      fill="none"
      strokeWidth="3.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  tablerIconProps,
);

export const EdgeSharpIcon = handdrawnUIIcon("sharp");

// tabler-icons: border-radius
export const EdgeRoundIcon = handdrawnUIIcon("round");

export const ArrowheadNoneIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        stroke="currentColor"
        opacity={0.3}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      >
        <path d="M7,11 H19" />
        <path d="M25,6 L33,16 M33,6 L25,16" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadArrowIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7,11 H33 M23,5 L33,11 L23,17" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadTriangleIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="currentColor"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeLinejoin="round"
      >
        <path d="M7,11 H23" strokeWidth={2} strokeLinecap="round" />
        <path d="M23,5 L35,11 L23,17 Z" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadTriangleOutlineIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M7,11 H23" />
        <path d="M23,5 L35,11 L23,17 Z" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCircleIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="currentColor"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
      >
        <path d="M7,11 H25" strokeWidth={2} strokeLinecap="round" />
        <circle cx="29" cy="11" r="4" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCircleOutlineIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeWidth={2}
      >
        <path d="M7,11 H25" strokeLinecap="round" />
        <circle cx="29" cy="11" r="4" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadDiamondIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="currentColor"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeLinejoin="round"
      >
        <path d="M7,11 H21" strokeWidth={2} strokeLinecap="round" />
        <path d="M21,11 L28,5 L35,11 L28,17 Z" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadDiamondOutlineIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeLinejoin="round"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <path d="M7,11 H21" />
        <path d="M21,11 L28,5 L35,11 L28,17 Z" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadBarIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      >
        <path d="M11,11 H31 M31,5 V17" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCardinalityOneIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M35,11 H7 M15,5 V17" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCardinalityManyIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M35,11 H7 M15,11 L7,5 M15,11 L7,17" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCardinalityOneOrManyIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M35,11 H7 M23,5 V17 M15,11 L7,5 M15,11 L7,17" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCardinalityExactlyOneIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M35,11 H7 M15,5 V17 M7,5 V17" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCardinalityZeroOrOneIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M35,11 H19 M11,11 H7 M7,5 V17" />
        <circle cx="15" cy="11" r="4" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const ArrowheadCardinalityZeroOrManyIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M35,11 H27 M19,11 H7 M15,11 L7,5 M15,11 L7,17" />
        <circle cx="23" cy="11" r="4" />
      </g>,
      arrowheadPreviewIconProps,
    ),
);

export const FontSizeSmallIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M14.167 6.667a3.333 3.333 0 0 0-3.334-3.334H9.167a3.333 3.333 0 0 0 0 6.667h1.666a3.333 3.333 0 0 1 0 6.667H9.167a3.333 3.333 0 0 1-3.334-3.334"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FontSizeMediumIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M5 16.667V3.333L10 15l5-11.667v13.334"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FontSizeLargeIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M5.833 3.333v13.334h8.334"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FontSizeExtraLargeIcon = createIcon(
  <>
    <path
      d="m1.667 3.333 6.666 13.334M8.333 3.333 1.667 16.667M11.667 3.333v13.334h6.666"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>,
  modifiedTablerIconProps,
);

export const fontSizeIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 7v-2h13v2" />
    <path d="M10 5v14" />
    <path d="M12 19h-4" />
    <path d="M15 13v-1h6v1" />
    <path d="M18 12v7" />
    <path d="M17 19h2" />
  </g>,
  tablerIconProps,
);

export const FontFamilyHeadingIcon = createIcon(
  <>
    <g
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 12h10" />
      <path d="M7 5v14" />
      <path d="M17 5v14" />
      <path d="M15 19h4" />
      <path d="M15 5h4" />
      <path d="M5 19h4" />
      <path d="M5 5h4" />
    </g>
  </>,
  tablerIconProps,
);

export const FontFamilyNormalIcon = createIcon(
  <>
    <g
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.833 16.667v-10a3.333 3.333 0 0 1 3.334-3.334h1.666a3.333 3.333 0 0 1 3.334 3.334v10M5.833 10.833h8.334" />
    </g>
  </>,
  modifiedTablerIconProps,
);

export const codeIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M7 8l-4 4l4 4" />
    <path d="M17 8l4 4l-4 4" />
    <path d="M14 4l-4 16" />
  </g>,
  tablerIconProps,
);

export const FontFamilyCodeIcon = codeIcon;

export const TextAlignLeftIcon = createIcon(
  <g
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="4" y1="12" x2="12" y2="12" />
    <line x1="4" y1="16" x2="16" y2="16" />
  </g>,
  tablerIconProps,
);

export const TextAlignCenterIcon = createIcon(
  <g
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="6" y1="16" x2="18" y2="16" />
  </g>,
  tablerIconProps,
);

export const TextAlignRightIcon = createIcon(
  <g
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="8" y1="16" x2="20" y2="16" />
  </g>,
  tablerIconProps,
);

// tabler-icons: layout-align-top
export const TextAlignTopIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <g
      strokeWidth="1.5"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="4" y1="4" x2="20" y2="4" />
      <rect x="9" y="8" width="6" height="12" rx="2" />
    </g>,
    tablerIconProps,
  ),
);

// tabler-icons: layout-align-bottom
export const TextAlignBottomIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <g
      strokeWidth="2"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="9" y="4" width="6" height="12" rx="2"></rect>
    </g>,
    tablerIconProps,
  ),
);

// tabler-icons: layout-align-middle
export const TextAlignMiddleIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <g
      strokeWidth="1.5"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="4" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="20" y2="12" />
      <rect x="9" y="6" width="6" height="12" rx="2" />
    </g>,
    tablerIconProps,
  ),
);

export const angleIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M21 19h-18l9 -15" />
    <path d="M20.615 15.171h.015" />
    <path d="M19.515 11.771h.015" />
    <path d="M17.715 8.671h.015" />
    <path d="M15.415 5.971h.015" />
  </g>,
  tablerIconProps,
);

export const publishIcon = createIcon(
  <path
    d="M537.6 226.6c4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32c-88.4 0-160 71.6-160 160 0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4zM393.4 288H328v112c0 8.8-7.2 16-16 16h-48c-8.8 0-16-7.2-16-16V288h-65.4c-14.3 0-21.4-17.2-11.3-27.3l105.4-105.4c6.2-6.2 16.4-6.2 22.6 0l105.4 105.4c10.1 10.1 2.9 27.3-11.3 27.3z"
    fill="currentColor"
  />,
  { width: 640, height: 512 },
);

export const eraser = EraserIcon;

export const handIcon = handdrawnUIIcon("hand");

export const downloadIcon = handdrawnUIIcon("download");

export const copyIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"></path>
    <path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"></path>
  </>,
  tablerIconProps,
);

export const cutIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M7 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M9.15 14.85l8.85 -10.85" />
    <path d="M6 4l8.85 10.85" />
  </g>,
  tablerIconProps,
);

export const helpIcon = handdrawnUIIcon("help");

export const playerPlayIcon = createIcon(
  <g>
    <path
      d="M13 29 Q12 21 22 22 Q48 18 79 23 Q86 24 86 33 L84 72 Q84 80 74 79 L22 81 Q13 81 14 71Z"
      fill="var(--island-bg-color, white)"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 31 Q44 26 78 31 L77 70 21 73Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M37 34 Q54 42 67 50 L39 68Z" fill="#f4ce19" />
    <path
      d="M40 36 Q54 43 64 51 Q54 57 40 64Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="3.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19 87 42 85 M76 14 81 8 M88 21 94 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>,
  handdrawnToolIconProps,
);

export const playerStopFilledIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path
      d="M17 4h-10a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3 -3v-10a3 3 0 0 0 -3 -3z"
      strokeWidth="0"
      fill="currentColor"
    ></path>
  </>,
  tablerIconProps,
);

export const tablerCheckIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M5 12l5 5l10 -10"></path>
  </>,
  tablerIconProps,
);

export const alertTriangleIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>,
  tablerIconProps,
);

export const eyeDropperIconSvgPaths = [
  "M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z",
  "M11 7l6 6",
] as const;

export const eyeDropperIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    {eyeDropperIconSvgPaths.map((path) => (
      <path key={path} d={path} />
    ))}
  </g>,
  tablerIconProps,
);

export const frameToolIcon = createIcon(
  <g>
    <path d="M4.2 7.2h15.6" />
    <path d="M4.2 16.8h15.6" />
    <path d="M7.2 3.8v16.4" />
    <path d="M16.8 3.8v16.4" />
    <rect x="8.6" y="8.8" width="6.8" height="6.4" fill={JAYRR_YELLOW} />
  </g>,
  doodleIconProps,
);

export const stickyNoteToolIcon = createIcon(
  <g>
    <path
      fill={JAYRR_YELLOW}
      d="M6.2 3.8h11.6c.9 0 1.6.8 1.6 1.7v9.4l-4.8 5.2H6.3c-.9 0-1.6-.8-1.6-1.7V5.5c0-.9.7-1.7 1.5-1.7z"
    />
    <path strokeWidth={0.6} d="M14.6 20.1v-4.1c0-.8.7-1.5 1.5-1.5h4.1" />
    <path strokeWidth={0.6} d="M8.2 9h7.6M8.2 12.6h5.2" />
  </g>,
  // Match the 4.5-unit outlines on the other icons' 100-unit artboards.
  { ...doodleIconProps, strokeWidth: 1.08 },
);

export const mermaidLogoIcon = handdrawnUIIcon("mermaid");

// tabler-icons: refresh
export const RetryIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
  </g>,
  tablerIconProps,
);

export const stackPushIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 10l-2 1l8 4l8 -4l-2 -1" />
    <path d="M4 15l8 4l8 -4" />
    <path d="M12 4v7" />
    <path d="M15 8l-3 3l-3 -3" />
  </g>,
  tablerIconProps,
);

export const ArrowRightIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M4.16602 10H15.8327" />
    <path d="M12.5 13.3333L15.8333 10" />
    <path d="M12.5 6.66666L15.8333 9.99999" />
  </g>,
  modifiedTablerIconProps,
);

export const drawShapeToolIcon = createIcon(
  <g>
    <ellipse cx="9.2" cy="9.4" rx="6.1" ry="5.8" fill={JAYRR_YELLOW} />
    <ellipse cx="9.2" cy="9.4" rx="6.1" ry="5.8" />
    <path
      fill={JAYRR_YELLOW}
      d="M11.2 11.6h8.4c.8 0 1.4.7 1.4 1.5v7.1c0 .8-.6 1.5-1.4 1.5h-8.4c-.8 0-1.5-.7-1.5-1.5v-7.1c0-.8.7-1.5 1.5-1.5z"
    />
    <path d="M11.2 11.6h8.4c.8 0 1.4.7 1.4 1.5v7.1c0 .8-.6 1.5-1.4 1.5h-8.4c-.8 0-1.5-.7-1.5-1.5v-7.1c0-.8.7-1.5 1.5-1.5z" />
  </g>,
  doodleIconProps,
);

export const laserPointerToolIcon = createIcon(
  <g>
    <path fill={JAYRR_YELLOW} d="M8.4 14.6l8.2-8.6 3.2 3-8.4 8.8z" />
    <path d="M8.4 14.6l8.2-8.6 3.2 3-8.4 8.8z" />
    <path d="M7.2 16.2l-3.6 4.2M4.2 13.4l-2.4.6M9.6 19.6l-.4 2.2" />
  </g>,
  doodleIconProps,
);

export const MagicIcon = handdrawnUIIcon("magic");

export const MagicIconThin = handdrawnUIIcon("magic");

export const OpenAIIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M11.217 19.384a3.501 3.501 0 0 0 6.783 -1.217v-5.167l-6 -3.35" />
    <path d="M5.214 15.014a3.501 3.501 0 0 0 4.446 5.266l4.34 -2.534v-6.946" />
    <path d="M6 7.63c-1.391 -.236 -2.787 .395 -3.534 1.689a3.474 3.474 0 0 0 1.271 4.745l4.263 2.514l6 -3.348" />
    <path d="M12.783 4.616a3.501 3.501 0 0 0 -6.783 1.217v5.067l6 3.45" />
    <path d="M18.786 8.986a3.501 3.501 0 0 0 -4.446 -5.266l-4.34 2.534v6.946" />
    <path d="M18 16.302c1.391 .236 2.787 -.395 3.534 -1.689a3.474 3.474 0 0 0 -1.271 -4.745l-4.308 -2.514l-5.955 3.42" />
  </g>,
  tablerIconProps,
);

export const fullscreenIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 8v-2a2 2 0 0 1 2 -2h2" />
    <path d="M4 16v2a2 2 0 0 0 2 2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2" />
    <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
  </g>,
  tablerIconProps,
);

export const eyeIcon = handdrawnUIIcon("eye");

export const eyeClosedIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
    <path d="M3 3l18 18" />
  </g>,
  tablerIconProps,
);

export const brainIcon = handdrawnUIIcon("brain");

export const brainIconThin = handdrawnUIIcon("brain");

export const searchIcon = handdrawnUIIcon("search");

// clock-bolt
export const historyCommandIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M20.984 12.53a9 9 0 1 0 -7.552 8.355" />
    <path d="M12 7v5l3 3" />
    <path d="M19 16l-2 3h4l-2 3" />
  </g>,
  tablerIconProps,
);

// history
export const historyIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 8l0 4l2 2" />
    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
  </g>,
  tablerIconProps,
);

export const microphoneIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M8 21l8 0" />
    <path d="M12 17l0 4" />
  </g>,
  tablerIconProps,
);

export const microphoneMutedIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 3l18 18" />
    <path d="M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -.13 .874m-2 2a3 3 0 0 1 -3.87 -2.872v-1" />
    <path d="M5 10a7 7 0 0 0 10.846 5.85m2 -2a6.967 6.967 0 0 0 1.152 -3.85" />
    <path d="M8 21l8 0" />
    <path d="M12 17l0 4" />
  </g>,
  tablerIconProps,
);

export const boltIcon = handdrawnUIIcon("bolt");
export const selectAllIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 8m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" />
    <path d="M12 20v.01" />
    <path d="M16 20v.01" />
    <path d="M8 20v.01" />
    <path d="M4 20v.01" />
    <path d="M4 16v.01" />
    <path d="M4 12v.01" />
    <path d="M4 8v.01" />
    <path d="M4 4v.01" />
    <path d="M8 4v.01" />
    <path d="M12 4v.01" />
    <path d="M16 4v.01" />
    <path d="M20 4v.01" />
    <path d="M20 8v.01" />
    <path d="M20 12v.01" />
    <path d="M20 16v.01" />
    <path d="M20 20v.01" />
  </g>,
  tablerIconProps,
);

export const abacusIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 3v18" />
    <path d="M19 21v-18" />
    <path d="M5 7h14" />
    <path d="M5 15h14" />
    <path d="M8 13v4" />
    <path d="M11 13v4" />
    <path d="M16 13v4" />
    <path d="M14 5v4" />
    <path d="M11 5v4" />
    <path d="M8 5v4" />
    <path d="M3 21h18" />
  </g>,
  tablerIconProps,
);

export const flipVertical = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 12l18 0" />
    <path d="M7 16l10 0l-10 5l0 -5" />
    <path d="M7 8l10 0l-10 -5l0 5" />
  </g>,
  tablerIconProps,
);

export const flipHorizontal = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 3l0 18" />
    <path d="M16 7l0 10l5 0l-5 -10" />
    <path d="M8 7l0 10l-5 0l5 -10" />
  </g>,
  tablerIconProps,
);

export const paintIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 3m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" />
    <path d="M19 6h1a2 2 0 0 1 2 2a5 5 0 0 1 -5 5l-5 0v2" />
    <path d="M10 15m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
  </g>,
  tablerIconProps,
);

export const zoomAreaIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15 15m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" />
    <path d="M22 22l-3 -3" />
    <path d="M6 18h-1a2 2 0 0 1 -2 -2v-1" />
    <path d="M3 11v-1" />
    <path d="M3 6v-1a2 2 0 0 1 2 -2h1" />
    <path d="M10 3h1" />
    <path d="M15 3h1a2 2 0 0 1 2 2v1" />
  </g>,
  tablerIconProps,
);

export const svgIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
    <path d="M4 20.25c0 .414 .336 .75 .75 .75h1.25a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h1.25a.75 .75 0 0 1 .75 .75" />
    <path d="M10 15l2 6l2 -6" />
    <path d="M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3" />
  </g>,
  tablerIconProps,
);

export const pngIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
    <path d="M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3" />
    <path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" />
    <path d="M11 21v-6l3 6v-6" />
  </g>,
  tablerIconProps,
);

export const magnetIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 13v-8a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v8a2 2 0 0 0 6 0v-8a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v8a8 8 0 0 1 -16 0" />
    <path d="M4 8l5 0" />
    <path d="M15 8l4 0" />
  </g>,
  tablerIconProps,
);

export const coffeeIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1" />
    <path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
    <path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
    <path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z" />
    <path d="M16.746 16.726a3 3 0 1 0 .252 -5.555" />
  </g>,
  tablerIconProps,
);

export const DeviceDesktopIcon = handdrawnUIIcon("desktop");

// login
export const loginIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
    <path d="M21 12h-13l3 -3" />
    <path d="M11 15l-3 -3" />
  </g>,
  tablerIconProps,
);

export const youtubeIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8z" />
    <path d="M10 9l5 3l-5 3z" />
  </g>,
  tablerIconProps,
);

export const gridIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h18" />
    <path d="M6 3v18" />
    <path d="M12 3v18" />
    <path d="M18 3v18" />
  </g>,
  tablerIconProps,
);

export const lineEditorIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M17 3m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
    <path d="M3 17m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
    <path d="M17 5c-6.627 0 -12 5.373 -12 12" />
  </g>,
  tablerIconProps,
);

// arrow-up-right (modified)
export const sharpArrowIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 18l12 -12" />
    <path d="M18 10v-4h-4" />
  </g>,
  tablerIconProps,
);

// arrow-guide (modified)
export const elbowArrowIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4,19L10,19C11.097,19 12,18.097 12,17L12,9C12,7.903 12.903,7 14,7L21,7" />
    <path d="M18 4l3 3l-3 3" />
  </g>,
  tablerIconProps,
);

// arrow-ramp-right-2 (heavily modified)
export const roundArrowIcon = createIcon(
  <g>
    <path d="M16,12L20,9L16,6" />
    <path d="M6 20c0 -6.075 4.925 -11 11 -11h3" />
  </g>,
  tablerIconProps,
);

export const collapseDownIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 9l6 6l6 -6" />
  </g>,
  tablerIconProps,
);

export const collapseUpIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 15l6 -6l6 6" />
  </g>,
  tablerIconProps,
);

export const upIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 15l6 -6l6 6" />
  </g>,
  tablerIconProps,
);

export const cropIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 5v10a1 1 0 0 0 1 1h10" />
    <path d="M5 8h10a1 1 0 0 1 1 1v10" />
  </g>,
  tablerIconProps,
);

export const elementLinkIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M19 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M5 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M19 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M5 7l0 10" />
    <path d="M7 5l10 0" />
    <path d="M7 19l10 0" />
    <path d="M19 7l0 10" />
  </g>,
  tablerIconProps,
);

export const resizeIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 11v8a1 1 0 0 0 1 1h8m-9 -14v-1a1 1 0 0 1 1 -1h1m5 0h2m5 0h1a1 1 0 0 1 1 1v1m0 5v2m0 5v1a1 1 0 0 1 -1 1h-1" />
    <path d="M4 12h7a1 1 0 0 1 1 1v7" />
  </g>,
  tablerIconProps,
);

export const adjustmentsIcon = handdrawnUIIcon("settings");

export const strokeIcon = createIcon(
  <g strokeWidth={1}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 10l4 -4 L6 14l8 -8 L6 18l12 -12 L10 18l8 -8 L14 18l4 -4" />
  </g>,
  tablerIconProps,
);

export const pencilIcon = FreedrawIcon;

export const chevronLeftIcon = createIcon(
  <g strokeWidth={1}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M11 7l-5 5l5 5" />
    <path d="M17 7l-5 5l5 5" />
  </g>,
  tablerIconProps,
);

export const sidebarRightIcon = handdrawnUIIcon("sidebar");

export const messageCircleIcon = handdrawnUIIcon("chat");

export const presentationIcon = handdrawnUIIcon("presentation");

// empty placeholder icon (used for alignment in menus)
export const emptyIcon = <div style={{ width: "1rem", height: "1rem" }} />;

//tabler-icons: chevron-down
export const chevronDownIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <polyline points="6 9 12 15 18 9" />
  </g>,
  tablerIconProps,
);

//tabler-icons: chevron-right
export const chevronRight = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <polyline points="9 6 15 12 9 18" />
  </g>,
  tablerIconProps,
);

// tabler-icons: adjustments-horizontal
export const settingsIcon = handdrawnUIIcon("settings");
