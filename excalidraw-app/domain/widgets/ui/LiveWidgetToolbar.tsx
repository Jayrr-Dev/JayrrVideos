import type { ReactNode } from "react";

import type { AudioSourceOption } from "../objects/listAudioSources";

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
      className="jayrr-called-hyperlink__action"
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      disabled={clearDisabled}
    >
      Clear
    </button>
    {onSelectText ? (
      <button
        type="button"
        className="jayrr-called-hyperlink__action"
        onClick={(event) => {
          event.stopPropagation();
          onSelectText();
        }}
      >
        Text
      </button>
    ) : null}
    {onToggleConfig ? (
      <button
        type="button"
        className={
          configOpen
            ? "jayrr-called-hyperlink__action is-on"
            : "jayrr-called-hyperlink__action"
        }
        onClick={(event) => {
          event.stopPropagation();
          onToggleConfig();
        }}
      >
        Config
      </button>
    ) : null}
    <button
      type="button"
      className="jayrr-called-hyperlink__action"
      onClick={(event) => {
        event.stopPropagation();
        onStart();
      }}
      disabled={busy}
    >
      {startLabel}
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
