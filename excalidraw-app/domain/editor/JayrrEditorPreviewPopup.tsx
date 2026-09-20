import { playerPlayIcon } from "@excalidraw/excalidraw/components/icons";
import { type ReactNode } from "react";

import { formatEditorClock } from "./buildEditorTimeline";
import { useEditorPlaybackControls } from "./editorPlaybackBridge";
import { getEditorPreviewVideo } from "./editorPreviewModel";
import { JayrrEditorVolumeControl } from "./JayrrEditorVolumeControl";

import "./JayrrEditorPreviewPopup.scss";

const PauseGlyph = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <rect x="5" y="4" width="5" height="16" rx="1.2" />
    <rect x="14" y="4" width="5" height="16" rx="1.2" />
  </svg>
);

const ControlButton = ({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    className="jayrr-editor-preview-popup__btn"
    aria-label={label}
    title={label}
    disabled={disabled}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    {children}
  </button>
);

export const JayrrEditorPreviewPopup = ({
  elementId,
}: {
  elementId: string;
}) => {
  const playback = useEditorPlaybackControls();
  const extraVideo = getEditorPreviewVideo(elementId);

  const totalMs = playback?.totalMs ?? 0;
  const currentTimeMs = playback?.currentTimeMs ?? 0;
  const playing = playback?.playing ?? false;
  const progress = totalMs > 0 ? (currentTimeMs / totalMs) * 100 : 0;
  const canTransport = Boolean(playback) && totalMs > 0;

  return (
    <div
      className="jayrr-editor-preview-popup"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="jayrr-editor-preview-popup__kind">Preview</span>
      <ControlButton
        label={playing ? "Pause" : "Play"}
        disabled={!canTransport}
        onClick={() => {
          if (!playback) {
            return;
          }
          if (playing) {
            playback.pause();
            return;
          }
          playback.play();
        }}
      >
        {playing ? PauseGlyph : playerPlayIcon}
      </ControlButton>
      <span className="jayrr-editor-preview-popup__time">
        {formatEditorClock(currentTimeMs)} / {formatEditorClock(totalMs)}
      </span>
      <input
        className="jayrr-editor-preview-popup__scrub"
        type="range"
        min={0}
        max={1000}
        step={1}
        disabled={!canTransport}
        value={Math.round(progress * 10)}
        aria-label="Seek"
        style={{
          background: `linear-gradient(to right, var(--color-primary) ${progress}%, var(--color-gray-20, #e5e7eb) ${progress}%)`,
        }}
        onChange={(event) => {
          if (!playback || totalMs <= 0) {
            return;
          }
          const ratio = Number(event.currentTarget.value) / 1000;
          playback.seek(ratio * totalMs);
        }}
      />
      <JayrrEditorVolumeControl
        className="jayrr-editor-preview-popup__volume"
        buttonClassName="jayrr-editor-preview-popup__btn"
        sliderClassName="jayrr-editor-preview-popup__volume-slider"
        extraVideo={extraVideo}
      />
    </div>
  );
};
