import { useEffect, useState } from "react";

export type EditorPlaybackControls = {
  playing: boolean;
  currentTimeMs: number;
  totalMs: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (ms: number) => void;
};

let controls: EditorPlaybackControls | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const publishEditorPlayback = (next: EditorPlaybackControls | null) => {
  controls = next;
  notify();
};

export const useEditorPlaybackControls = (): EditorPlaybackControls | null => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return controls;
};
