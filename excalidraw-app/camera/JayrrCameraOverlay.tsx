import { isNonDeletedElement } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtomValue } from "../app-jotai";
import {
  peekJayrrPhoneStream,
  releaseJayrrPhoneSelf,
  retainJayrrPhoneSelf,
  subscribeJayrrPhone,
} from "../collab/jayrrCollabVideoSession";
import { cameraCutoutAtom } from "../domain/flags/cameraCutoutFlag";
import {
  getTranscribeEnabled,
  listenDisplayAudio,
  subscribeTranscribeSettings,
} from "../domain/transcription";

import {
  canLinkJayrrCamera,
  isJayrrDisplay,
  isJayrrPhone,
  JAYRR_PHONE_SELF,
  readDisplayQuality,
  readDisplayRate,
  readJayrrCamera,
  type JayrrCamera,
} from "./jayrrCamera";
import { startJayrrCameraCutout } from "./jayrrCameraCutout";
import { setJayrrCameraVideo } from "./jayrrCameraLive";
import {
  acquireJayrrCamera,
  acquireJayrrDisplay,
  displayWantedSize,
  peekJayrrDisplayStream,
  releaseJayrrCamera,
  releaseJayrrDisplay,
  tuneJayrrDisplay,
  type DisplayTune,
} from "./jayrrCameraStreams";

import "./JayrrCameraOverlay.scss";

type LinkedFill = {
  id: string;
  camera: JayrrCamera;
  element: NonDeletedExcalidrawElement;
};

const fitDisplayVideo = (video: HTMLVideoElement, tune: DisplayTune) => {
  const view = video.ownerDocument.defaultView ?? undefined;
  const wanted = displayWantedSize(tune, view);
  video.width = wanted.width;
  video.height = wanted.height;
  video.style.width = `${wanted.width}px`;
  video.style.height = `${wanted.height}px`;
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
  const phone = isJayrrPhone(camera);
  const phoneUserId = phone ? camera.userId : null;
  const cameraId = display || phone ? null : camera.deviceId;
  const nonce = display ? camera.nonce ?? 0 : 0;
  const surface = display ? camera.surface : undefined;
  const quality = readDisplayQuality(display ? camera : null);
  const frameRate = readDisplayRate(display ? camera : null);
  const tuneRef = useRef({ quality, frameRate });
  tuneRef.current = { quality, frameRate };
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
    if (phone) {
      return;
    }
    let cancelled = false;
    let held: MediaStream | null = null;
    setStreamReady(false);
    if (display) {
      fitDisplayVideo(video, tuneRef.current);
    }
    const start = display
      ? acquireJayrrDisplay(elementId, surface, tuneRef.current)
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
        if (display) {
          fitDisplayVideo(video, tuneRef.current);
        }
        video.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        const facing = track?.getSettings().facingMode;
        video.dataset.jayrrMirror = !display && facing === "user" ? "1" : "";
        if (!display) {
          video.style.width = "";
          video.style.height = "";
        }
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
  }, [cameraId, display, elementId, nonce, phone, surface]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !phone || !phoneUserId) {
      return;
    }
    if (phoneUserId === JAYRR_PHONE_SELF) {
      retainJayrrPhoneSelf();
    }
    let cancelled = false;
    const attach = () => {
      if (cancelled) {
        return;
      }
      const stream = peekJayrrPhoneStream(phoneUserId);
      if (!stream) {
        video.srcObject = null;
        setJayrrCameraVideo(elementId, null);
        setStreamReady(false);
        return;
      }
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.dataset.jayrrMirror = phoneUserId === JAYRR_PHONE_SELF ? "1" : "";
        setJayrrCameraVideo(elementId, video);
        setStreamReady(true);
        void video.play().catch(() => undefined);
      }
    };
    attach();
    const stopListen = subscribeJayrrPhone(attach);
    return () => {
      cancelled = true;
      stopListen();
      if (phoneUserId === JAYRR_PHONE_SELF) {
        releaseJayrrPhoneSelf();
      }
      setJayrrCameraVideo(elementId, null);
      setStreamReady(false);
      video.srcObject = null;
    };
  }, [elementId, phone, phoneUserId]);

  useEffect(() => {
    if (!display || !streamReady) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    fitDisplayVideo(video, { quality, frameRate });
    void tuneJayrrDisplay(elementId, { quality, frameRate });
  }, [display, elementId, frameRate, quality, streamReady]);

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
  }, [api, cameraId, display, elementId, nonce, phone, phoneUserId, surface]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = cutoutRef.current;
    if (!video || !canvas || display || phone || cutout === "off") {
      return;
    }
    if (!streamReady) {
      return;
    }
    return startJayrrCameraCutout(elementId, video, canvas, cutout);
  }, [cutout, display, elementId, phone, streamReady]);

  return (
    <>
      <video
        ref={videoRef}
        className="jayrr-camera-window__video"
        autoPlay
        muted={!phone || phoneUserId === JAYRR_PHONE_SELF}
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
