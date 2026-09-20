import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { ReactNode } from "react";

export type MinimizedDialogEntry = {
  id: string;
  label: string;
  restore: () => void;
  requestClose: () => void;
};

type MinimizedDialogsContextValue = {
  entries: readonly MinimizedDialogEntry[];
  register: (entry: MinimizedDialogEntry) => void;
  unregister: (id: string) => void;
};

const MinimizedDialogsContext =
  createContext<MinimizedDialogsContextValue | null>(null);

export const useMinimizedDialogsRegistry = () => {
  return useContext(MinimizedDialogsContext);
};

export const ProvidesMinimizedDialogs = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [entries, setEntries] = useState<MinimizedDialogEntry[]>([]);

  const register = useCallback((entry: MinimizedDialogEntry) => {
    setEntries((current) => {
      const withoutEntry = current.filter(
        (existing) => existing.id !== entry.id,
      );
      return [...withoutEntry, entry];
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((current) => current.filter((existing) => existing.id !== id));
  }, []);

  const contextValue = useMemo(
    (): MinimizedDialogsContextValue => ({ entries, register, unregister }),
    [entries, register, unregister],
  );

  return (
    <MinimizedDialogsContext.Provider value={contextValue}>
      {children}
    </MinimizedDialogsContext.Provider>
  );
};
