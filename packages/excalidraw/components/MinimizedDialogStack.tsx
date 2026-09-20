import clsx from "clsx";
import { useState } from "react";

import { useMinimizedDialogsRegistry } from "./DialogMinimizeRegistry";

import "./MinimizedDialogStack.scss";

import type { MinimizedDialogEntry } from "./DialogMinimizeRegistry";

const FAB_COLLAPSED_PX = 32;
const FAB_EXPANDED_BASE_PX = 88;
const FAB_EXPANDED_EXTRA_PER_CHAR_PX = 5;
const FAB_EXPANDED_MAX_PX = 176;

const RestoreGlyph = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const pillWidthPx = (label: string) => {
  const extra = Math.max(0, label.length - 4) * FAB_EXPANDED_EXTRA_PER_CHAR_PX;
  return Math.min(FAB_EXPANDED_MAX_PX, FAB_EXPANDED_BASE_PX + extra);
};

const MinimizedDialogCircle = ({ entry }: { entry: MinimizedDialogEntry }) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isExpanded = hovered || focused;
  const width = pillWidthPx(entry.label);

  return (
    <div
      className="MinimizedDialogStack__item"
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <button
        type="button"
        title={entry.label}
        aria-label={`Restore dialog: ${entry.label}`}
        onClick={entry.restore}
        style={{
          width: isExpanded ? width : FAB_COLLAPSED_PX,
          height: FAB_COLLAPSED_PX,
        }}
        className={clsx(
          "MinimizedDialogStack__pill",
          isExpanded && "is-expanded",
        )}
      >
        {RestoreGlyph}
        <span className="MinimizedDialogStack__label">{entry.label}</span>
      </button>
    </div>
  );
};

export const MinimizedDialogStack = () => {
  const registry = useMinimizedDialogsRegistry();
  if (!registry || registry.entries.length === 0) {
    return null;
  }

  return (
    <div className="MinimizedDialogStack">
      {registry.entries.map((entry) => (
        <MinimizedDialogCircle key={entry.id} entry={entry} />
      ))}
    </div>
  );
};
