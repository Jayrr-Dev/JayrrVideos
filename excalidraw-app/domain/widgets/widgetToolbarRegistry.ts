import { useEffect, useState, type ReactNode } from "react";

type ToolbarRenderer = () => ReactNode;

const renderers = new Map<string, ToolbarRenderer>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const registerWidgetToolbar = (
  elementId: string,
  render: ToolbarRenderer,
) => {
  renderers.set(elementId, render);
  notify();
  return () => {
    if (renderers.get(elementId) === render) {
      renderers.delete(elementId);
      notify();
    }
  };
};

export const useWidgetToolbar = (elementId: string): ReactNode => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return renderers.get(elementId)?.() ?? null;
};

/** Re-register whenever deps change so the selection popover stays in sync. */
export const useRegisterWidgetToolbar = (
  elementId: string,
  render: ToolbarRenderer,
  deps: readonly unknown[],
) => {
  useEffect(
    () => registerWidgetToolbar(elementId, render),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns deps
    [elementId, ...deps],
  );
};
