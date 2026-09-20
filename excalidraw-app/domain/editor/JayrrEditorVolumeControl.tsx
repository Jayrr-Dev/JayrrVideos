import type { ReactNode } from "react";

import { useEditorPreviewAudio } from "./editorPreviewModel";

const VolumeGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10v4h3l4 4V6L7 10H4z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
    <path d="M18 6a8 8 0 0 1 0 12" />
  </svg>
);

const MuteGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10v4h3l4 4V6L7 10H4z" fill="currentColor" stroke="none" />
    <path d="M18 9l-5 5M13 9l5 5" />
  </svg>
);

const ControlButton = ({
  className,
  label,
  onClick,
  children,
}: {
  className: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    className={className}
    aria-label={label}
    title={label}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    {children}
  </button>
);

export const JayrrEditorVolumeControl = ({
  className,
  buttonClassName,
  sliderClassName,
  extraVideo,
}: {
  className: string;
  buttonClassName: string;
  sliderClassName: string;
  extraVideo?: HTMLVideoElement | null;
}) => {
  const { volume, muted, writeAudio } = useEditorPreviewAudio(extraVideo);
  const silent = muted || volume === 0;
  const sliderValue = muted ? 0 : Math.round(volume * 100);

  return (
    <div className={className}>
      <ControlButton
        className={buttonClassName}
        label={silent ? "Unmute preview" : "Mute preview"}
        onClick={() => {
          if (silent) {
            writeAudio(volume === 0 ? 1 : volume, false);
            return;
          }
          writeAudio(volume, true);
        }}
      >
        {silent ? MuteGlyph : VolumeGlyph}
      </ControlButton>
      <input
        className={sliderClassName}
        type="range"
        min={0}
        max={100}
        step={1}
        value={sliderValue}
        aria-label="Preview volume"
        style={{
          background: `linear-gradient(to right, var(--color-primary) ${sliderValue}%, var(--color-gray-20, #e5e7eb) ${sliderValue}%)`,
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const next = Number(event.currentTarget.value) / 100;
          writeAudio(next, next === 0);
        }}
      />
    </div>
  );
};
