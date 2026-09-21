import {
  playerPlayIcon,
  settingsIcon,
  TextIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";

import type { PointerEvent, ReactNode } from "react";

import type { AudioSourceOption } from "../objects/listAudioSources";

const stopCanvasPointer = (event: PointerEvent<HTMLElement>) => {
  event.stopPropagation();
};

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

const ICON_ACTION =
  "jayrr-called-hyperlink__action jayrr-called-hyperlink__action--icon";

type LiveStatus = {
  listening: boolean;
  paused: boolean;
};

export const LiveStatusDot = ({ listening, paused }: LiveStatus) => {
  if (!listening) {
    return null;
  }
  if (paused) {
    return (
      <span className="jayrr-called-hyperlink__pause" aria-label="Paused">
        <span />
        <span />
      </span>
    );
  }
  return (
    <span className="jayrr-called-hyperlink__listen" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
};

export const LiveWidgetToolbar = ({
  listening,
  paused,
  busy,
  startLabel,
  sourceId,
  sources,
  clearDisabled,
  configOpen,
  onClear,
  onStart,
  onToggleConfig,
  onSelectText,
  onSourceChange,
}: {
  listening: boolean;
  paused: boolean;
  busy: boolean;
  startLabel: string;
  sourceId: string;
  sources: readonly AudioSourceOption[];
  clearDisabled: boolean;
  configOpen?: boolean;
  onClear: () => void;
  onStart: () => void;
  onToggleConfig?: () => void;
  onSelectText?: () => void;
  onSourceChange: (sourceId: string) => void;
}): ReactNode => (
  <div className="jayrr-called-hyperlink__actions">
    <LiveStatusDot listening={listening} paused={paused} />
    <button
      type="button"
      className={ICON_ACTION}
      aria-label="Clear"
      title="Clear"
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      disabled={clearDisabled}
    >
      {TrashIcon}
    </button>
    {onSelectText ? (
      <button
        type="button"
        className={ICON_ACTION}
        aria-label="Text"
        title="Text"
        onClick={(event) => {
          event.stopPropagation();
          onSelectText();
        }}
      >
        {TextIcon}
      </button>
    ) : null}
    {onToggleConfig ? (
      <button
        type="button"
        className={ICON_ACTION}
        aria-label="Config"
        title="Config"
        aria-pressed={!!configOpen}
        onPointerDown={stopCanvasPointer}
        onPointerUp={stopCanvasPointer}
        onClick={(event) => {
          event.stopPropagation();
          onToggleConfig();
        }}
      >
        {settingsIcon}
      </button>
    ) : null}
    <button
      type="button"
      className={ICON_ACTION}
      aria-label={startLabel}
      title={startLabel}
      onClick={(event) => {
        event.stopPropagation();
        onStart();
      }}
      disabled={busy}
    >
      {startLabel === "Pause" ? PauseGlyph : playerPlayIcon}
    </button>
    <select
      className="jayrr-called-hyperlink__select"
      value={sourceId}
      disabled={listening && !paused}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        onSourceChange(event.target.value);
      }}
    >
      {sources.map((source) => (
        <option key={source.id} value={source.id}>
          {source.hasAudio ? source.label : `${source.label} (no audio)`}
        </option>
      ))}
    </select>
  </div>
);
