import { useLayoutEffect, useRef } from "react";

import { MAX_STACK_LANES } from "./buildEditorTimeline";
import { registerEditorPreviewLayers } from "./editorPreviewModel";

import "./JayrrEditorPreviewEmbed.scss";

const STACK_INDEXES = Array.from(
  { length: MAX_STACK_LANES },
  (_, index) => index,
);

export const JayrrEditorPreviewEmbed = ({
  elementId,
}: {
  elementId: string;
}) => {
  const baseRef = useRef<HTMLVideoElement | null>(null);
  const baseAltRef = useRef<HTMLVideoElement | null>(null);
  const stackRefs = useRef<(HTMLVideoElement | null)[]>(
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
    return registerEditorPreviewLayers(elementId, {
      base,
      baseAlt,
      stacks,
    });
  }, [elementId]);

  return (
    <div className="jayrr-editor-preview-embed">
      <video
        ref={baseRef}
        className="jayrr-editor-preview-embed__video"
        data-element-id={elementId}
        data-editor-layer="base"
        playsInline
        preload="auto"
      />
      <video
        ref={baseAltRef}
        className="jayrr-editor-preview-embed__video"
        data-element-id={elementId}
        data-editor-layer="base-alt"
        playsInline
        preload="auto"
      />
      {STACK_INDEXES.map((index) => (
        <video
          key={index}
          ref={(node) => {
            stackRefs.current[index] = node;
          }}
          className="jayrr-editor-preview-embed__stack"
          data-element-id={elementId}
          data-editor-layer="stack"
          data-stack-index={index}
          style={{ zIndex: 2 + index }}
          playsInline
          preload="metadata"
        />
      ))}
      <div className="jayrr-editor-preview-embed__label" aria-hidden>
        Editor preview
      </div>
    </div>
  );
};
