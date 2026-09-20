import { isNonDeletedElement } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtomValue } from "../app-jotai";
import { cameraCutoutAtom } from "../domain/flags/cameraCutoutFlag";
import {
  getTranscribeEnabled,
  listenDisplayAudio,
  subscribeTranscribeSettings,
} from "../domain/transcription";

import {
  canLinkJayrrCamera,
  isJayrrDisplay,
  readJayrrCamera,
  type JayrrCamera,
} from "./jayrrCamera";
import { startJayrrCameraCutout } from "./jayrrCameraCutout";
import { setJayrrCameraVideo } from "./jayrrCameraLive";
import {
  acquireJayrrCamera,
  acquireJayrrDisplay,
  peekJayrrDisplayStream,
  releaseJayrrCamera,
  releaseJayrrDisplay,
} from "./jayrrCameraStreams";

import "./JayrrCameraOverlay.scss";

type LinkedFill = {
  id: string;
  camera: JayrrCamera;
  element: NonDeletedExcalidrawElement;
};

const CameraVideo = ({
  elementId,
  camera,
  api,
}: {
  elementId: string;
  camera: JayrrCamera;
  api: NonNullable<ReturnType<typeof useExcalidrawAPI>>;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cutoutRef = useRef<HTMLCanvasElement | null>(null);
  const cutout = useAtomValue(cameraCutoutAtom);
  const display = isJayrrDisplay(camera);
  const cameraId = display ? null : camera.deviceId;
  const nonce = display ? camera.nonce ?? 0 : 0;
  const surface = display ? camera.surface : undefined;
  const [settingsTick, setSettingsTick] = useState(0);
  const [streamReady, setStreamReady] = useState(false);

  useEffect(
    () =>
      subscribeTranscribeSettings(() => {
        setSettingsTick((value) => value + 1);
      }),
    [],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    let cancelled = false;
    let held: MediaStream | null = null;
    setStreamReady(false);
    const start = display
      ? acquireJayrrDisplay(elementId, surface)
      : acquireJayrrCamera(cameraId ?? "default");
    void start
      .then((stream) => {
        if (cancelled) {
          if (display) {
            releaseJayrrDisplay(elementId, stream);
          } else if (cameraId) {
            releaseJayrrCamera(cameraId, stream);
          }
          return;
        }
        held = stream;
        video.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        const facing = track?.getSettings().facingMode;
        video.dataset.jayrrMirror = !display && facing === "user" ? "1" : "";
        setJayrrCameraVideo(elementId, video);
        setStreamReady(true);
        return video.play().catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      setJayrrCameraVideo(elementId, null);
      setStreamReady(false);
      video.srcObject = null;
      if (!held) {
        return;
      }
      if (display) {
        releaseJayrrDisplay(elementId, held);
      } else if (cameraId) {
        releaseJayrrCamera(cameraId, held);
      }
    };
  }, [cameraId, display, elementId, nonce, surface]);

  useEffect(() => {
    if (!display || !streamReady) {
      return;
    }
    if (!getTranscribeEnabled()) {
      return;
    }
    const stream = peekJayrrDisplayStream(elementId);
    if (!stream) {
      return;
    }
    return listenDisplayAudio(elementId, stream);
  }, [display, elementId, nonce, settingsTick, streamReady, surface]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !api) {
      return;
    }
    let cancelled = false;
    let callback = 0;
    const tick = () => {
      if (cancelled) {
        return;
      }
      api.requestLiveRender();
      if ("requestVideoFrameCallback" in video) {
        callback = video.requestVideoFrameCallback(tick);
        return;
      }
      callback = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelled = true;
      if ("cancelVideoFrameCallback" in video && callback) {
        video.cancelVideoFrameCallback(callback);
        return;
      }
      cancelAnimationFrame(callback);
    };
  }, [api, cameraId, display, elementId, nonce, surface]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = cutoutRef.current;
    if (!video || !canvas || display || cutout === "off") {
      return;
    }
    if (!streamReady) {
      return;
    }
    return startJayrrCameraCutout(elementId, video, canvas, cutout);
  }, [cutout, display, elementId, streamReady]);

  return (
    <>
      <video
        ref={videoRef}
        className="jayrr-camera-window__video"
        autoPlay
        muted
        playsInline
      />
      <canvas ref={cutoutRef} className="jayrr-camera-window__cutout" />
    </>
  );
};

export const JayrrCameraOverlay = (_props: { presenting?: boolean }) => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const [elements, setElements] = useState<
    readonly NonDeletedExcalidrawElement[]
  >([]);

  useEffect(() => {
    if (!api) {
      return;
    }
    setElements(api.getSceneElements());
    const offChange = api.onChange((nextElements) => {
      setElements(nextElements.filter(isNonDeletedElement));
    });
    return () => {
      offChange();
    };
  }, [api]);

  const linked = useMemo((): LinkedFill[] => {
    const next: LinkedFill[] = [];
    for (const element of elements) {
      if (!canLinkJayrrCamera(element)) {
        continue;
      }
      const camera = readJayrrCamera(element);
      if (!camera) {
        continue;
      }
      next.push({ id: element.id, camera, element });
    }
    return next;
  }, [elements]);

  if (!api || !container || linked.length === 0) {
    return null;
  }

  return createPortal(
    <div className="jayrr-camera-overlay" aria-hidden="true">
      {linked.map((item) => (
        <CameraVideo
          key={item.id}
          elementId={item.id}
          camera={item.camera}
          api={api}
        />
      ))}
    </div>,
    container,
  );
};
