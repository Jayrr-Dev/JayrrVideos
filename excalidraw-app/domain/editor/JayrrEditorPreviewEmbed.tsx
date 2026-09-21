import { useLayoutEffect, useRef } from "react";

import { MAX_STACK_LANES } from "./buildEditorTimeline";
import { bindEditorPreviewCutout } from "./editorClipCutout";
import { registerEditorPreviewLayers } from "./editorPreviewModel";

import "./JayrrEditorPreviewEmbed.scss";

const STACK_INDEXES = Array.from(
  { length: MAX_STACK_LANES },
  (_, index) => index,
);

const PreviewVideo = ({
  videoRef,
  className,
  elementId,
  layer,
  stackIndex,
  zIndex,
}: {
  videoRef: (node: HTMLVideoElement | null) => void;
  className: string;
  elementId: string;
  layer: string;
  stackIndex?: number;
  zIndex?: number;
}) => {
  const nodeRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const video = nodeRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    return bindEditorPreviewCutout(video, canvas);
  }, [elementId, layer, stackIndex]);

  return (
    <>
      <video
        ref={(node) => {
          nodeRef.current = node;
          videoRef(node);
        }}
        className={className}
        data-element-id={elementId}
        data-editor-layer={layer}
        {...(typeof stackIndex === "number"
          ? { "data-stack-index": stackIndex }
          : {})}
        style={typeof zIndex === "number" ? { zIndex } : undefined}
        crossOrigin="anonymous"
        playsInline
        preload={layer === "stack" ? "metadata" : "auto"}
      />
      <canvas
        ref={canvasRef}
        className="jayrr-editor-preview-embed__cutout"
        data-editor-layer={`${layer}-cutout`}
        style={typeof zIndex === "number" ? { zIndex } : undefined}
      />
    </>
  );
};

export const JayrrEditorPreviewEmbed = ({
  elementId,
}: {
  elementId: string;
}) => {
  const baseRef = useRef<HTMLVideoElement | null>(null);
  const baseAltRef = useRef<HTMLVideoElement | null>(null);
  const compositionRef = useRef<HTMLIFrameElement | null>(null);
  const staticBaseRef = useRef<HTMLImageElement | null>(null);
  const stackRefs = useRef<(HTMLVideoElement | null)[]>(
    Array.from({ length: MAX_STACK_LANES }, () => null),
  );
  const staticStackRefs = useRef<(HTMLImageElement | null)[]>(
    Array.from({ length: MAX_STACK_LANES }, () => null),
  );

  useLayoutEffect(() => {
    const base = baseRef.current;
    const baseAlt = baseAltRef.current;
    if (!base) {
      return;
    }
    const stacks = stackRefs.current.filter(
      (video): video is HTMLVideoElement => Boolean(video),
    );
    const staticStacks = staticStackRefs.current.filter(
      (image): image is HTMLImageElement => Boolean(image),
    );
    return registerEditorPreviewLayers(elementId, {
      base,
      baseAlt,
      stacks,
      composition: compositionRef.current,
      staticBase: staticBaseRef.current,
      staticStacks,
    });
  }, [elementId]);

  return (
    <div className="jayrr-editor-preview-embed" data-element-id={elementId}>
      <PreviewVideo
        videoRef={(node) => {
          baseRef.current = node;
        }}
        className="jayrr-editor-preview-embed__video"
        elementId={elementId}
        layer="base"
      />
      <PreviewVideo
        videoRef={(node) => {
          baseAltRef.current = node;
        }}
        className="jayrr-editor-preview-embed__video"
        elementId={elementId}
        layer="base-alt"
      />
      {STACK_INDEXES.map((index) => (
        <PreviewVideo
          key={index}
          videoRef={(node) => {
            stackRefs.current[index] = node;
          }}
          className="jayrr-editor-preview-embed__stack"
          elementId={elementId}
          layer="stack"
          stackIndex={index}
          zIndex={2 + index}
        />
      ))}
      <iframe
        ref={compositionRef}
        className="jayrr-editor-preview-embed__html"
        title="HTML clip"
        sandbox="allow-scripts"
        tabIndex={-1}
      />
      <img
        ref={staticBaseRef}
        className="jayrr-editor-preview-embed__still"
        alt=""
        crossOrigin="anonymous"
        draggable={false}
      />
      {STACK_INDEXES.map((index) => (
        <img
          key={`still-${index}`}
          ref={(node) => {
            staticStackRefs.current[index] = node;
          }}
          className="jayrr-editor-preview-embed__still jayrr-editor-preview-embed__still--stack"
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          data-stack-index={index}
          style={{ zIndex: 2 + index }}
        />
      ))}
      <div className="jayrr-editor-preview-embed__label" aria-hidden>
        Editor preview
      </div>
    </div>
  );
};
