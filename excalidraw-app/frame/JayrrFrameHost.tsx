import { useEffect } from "react";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";

import { jayrrFrameAction } from "./jayrrFrameAction";
import { JayrrFrameOverlay } from "./JayrrFrameOverlay";

export const JayrrFrameHost = () => {
  const api = useExcalidrawAPI();

  useEffect(() => {
    if (!api) {
      return;
    }
    api.registerAction(jayrrFrameAction);
    api.refresh();
  }, [api]);

  return <JayrrFrameOverlay />;
};
