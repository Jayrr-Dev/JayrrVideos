import { useState } from "react";

import { JayrrSoundLibraryDialog } from "../components/ui/JayrrSoundLibraryDialog";

import type { PresentSound } from "./buildPresentDeck";

const noteIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M6.2 12.4c0 1.1-.9 1.9-2.1 1.9S2 13.5 2 12.4s.9-1.9 2.1-1.9c.4 0 .8.1 1.1.3V4.7l7.6-1.3v7.4c0 1.1-.9 1.9-2.1 1.9s-2.1-.8-2.1-1.9.9-1.9 2.1-1.9c.4 0 .8.1 1.1.3V4.4L6.2 5.6z"
      fill="currentColor"
    />
  </svg>
);

export const PresentSoundCue = ({
  sound,
  label,
  disabled,
  onSound,
}: {
  sound: PresentSound | null;
  label: string;
  disabled: boolean;
  onSound: (sound: PresentSound | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const title = sound ? `${label}: ${sound.name}` : label;

  return (
    <>
      <button
        type="button"
        className={
          sound ? "jayrr-present__sound-cue is-set" : "jayrr-present__sound-cue"
        }
        aria-label={title}
        title={title}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {noteIcon}
      </button>
      {open ? (
        <JayrrSoundLibraryDialog
          selectedId={sound?.id ?? null}
          onClose={() => {
            setOpen(false);
          }}
          onSelect={(next) => {
            onSound(
              next ? { id: next.id, name: next.name, path: next.path } : null,
            );
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
};
