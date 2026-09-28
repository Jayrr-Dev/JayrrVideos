import { isNonDeletedElement } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useExcalidrawContainer } from "@excalidraw/excalidraw/components/App";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import {
  jayrrBgMediaKind,
  readJayrrBgMedia,
  type JayrrBgMedia,
} from "./jayrrBgMedia";
import { setJayrrBgMediaSource } from "./jayrrBgMediaLive";

import "./JayrrBgMediaOverlay.scss";

type LinkedFill = {
  id: string;
  media: JayrrBgMedia;
  dataURL: string;
  element: NonDeletedExcalidrawElement;
};

const MediaSource = ({
  elementId,
  media,
  dataURL,
  api,
}: {
  elementId: string;
  media: JayrrBgMedia;
  dataURL: string;
  api: NonNullable<ReturnType<typeof useExcalidrawAPI>>;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const kind = jayrrBgMediaKind(media.mime);

  useEffect(() => {
    const node = kind === "video" ? videoRef.current : imageRef.current;
    if (!node) {
      return;
    }
    setJayrrBgMediaSource(elementId, node);
    api.requestLiveRender();
    return () => {
      setJayrrBgMediaSource(elementId, null);
    };
  }, [api, dataURL, elementId, kind]);

  useEffect(() => {
    const video = videoRef.current;
    const image = imageRef.current;
    if (!api) {
      return;
    }
    let cancelled = false;
    let callback = 0;
    const tick = () => {
      if (cancelled) {
        return;
      }
      api.requestLiveRender();
      if (video && "requestVideoFrameCallback" in video) {
        callback = video.requestVideoFrameCallback(tick);
        return;
      }
      callback = requestAnimationFrame(tick);
    };
    if (kind === "video") {
      if (video) {
        tick();
      }
    } else if (image && /gif|webp|apng/i.test(media.mime)) {
      tick();
    } else {
      api.requestLiveRender();
    }
    return () => {
      cancelled = true;
      if (video && "cancelVideoFrameCallback" in video && callback) {
        video.cancelVideoFrameCallback(callback);
        return;
      }
      cancelAnimationFrame(callback);
    };
  }, [api, dataURL, kind, media.mime]);

  if (kind === "video") {
    return (
      <video
        ref={videoRef}
        className="jayrr-bg-media__source"
        src={dataURL}
        autoPlay
        muted
        loop
        playsInline
        onLoadedData={() => api.requestLiveRender()}
      />
    );
  }

  return (
    <img
      ref={imageRef}
      className="jayrr-bg-media__source"
      src={dataURL}
      alt=""
      onLoad={() => api.requestLiveRender()}
    />
  );
};

export const JayrrBgMediaOverlay = () => {
  const api = useExcalidrawAPI();
  const { container } = useExcalidrawContainer();
  const [elements, setElements] = useState<
    readonly NonDeletedExcalidrawElement[]
  >([]);
  const [files, setFiles] = useState<BinaryFiles>({});

  useEffect(() => {
    if (!api) {
      return;
    }
    setElements(api.getSceneElements());
    setFiles(api.getFiles());
    const offChange = api.onChange((nextElements) => {
      setElements(nextElements.filter(isNonDeletedElement));
      setFiles(api.getFiles());
    });
    return () => {
      offChange();
    };
  }, [api]);

  const linked = useMemo((): LinkedFill[] => {
    const next: LinkedFill[] = [];
    for (const element of elements) {
      const media = readJayrrBgMedia(element);
      if (!media) {
        continue;
      }
      const file = files[media.fileId];
      if (!file?.dataURL || file.dataURL === "data:,") {
        continue;
      }
      next.push({
        id: element.id,
        media,
        dataURL: file.dataURL,
        element,
      });
    }
    return next;
  }, [elements, files]);

  if (!api || !container || linked.length === 0) {
    return null;
  }

  return createPortal(
    <div className="jayrr-bg-media" aria-hidden="true">
      {linked.map((item) => (
        <MediaSource
          key={item.id}
          elementId={item.id}
          media={item.media}
          dataURL={item.dataURL}
          api={api}
        />
      ))}
    </div>,
    container,
  );
};
