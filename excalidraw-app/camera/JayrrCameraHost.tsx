import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { setLiveMediaPainter } from "@excalidraw/excalidraw/liveMedia";
import { useEffect } from "react";

import { jayrrCameraAction } from "./jayrrCameraAction";
import { JayrrCameraCropOverlay } from "./JayrrCameraCropOverlay";
import { paintJayrrCameraLive } from "./jayrrCameraLive";
import { JayrrCameraOverlay } from "./JayrrCameraOverlay";

export const JayrrCameraHost = ({
  presenting = false,
}: {
  presenting?: boolean;
}) => {
  const api = useExcalidrawAPI();

  useEffect(() => {
    if (!api) {
      return;
    }
    api.registerAction(jayrrCameraAction);
    api.refresh();
  }, [api]);

  useEffect(() => {
    setLiveMediaPainter(paintJayrrCameraLive);
    return () => {
      setLiveMediaPainter(null);
    };
  }, []);

  return (
    <>
      <JayrrCameraOverlay presenting={presenting} />
      <JayrrCameraCropOverlay />
    </>
  );
};
