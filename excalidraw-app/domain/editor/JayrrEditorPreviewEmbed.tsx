import { useEffect, useRef } from "react";

import { registerEditorPreviewVideo } from "./editorPreviewModel";

import "./JayrrEditorPreviewEmbed.scss";

export const JayrrEditorPreviewEmbed = ({
  elementId,
}: {
  elementId: string;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    return registerEditorPreviewVideo(elementId, video);
  }, [elementId]);

  return (
    <div className="jayrr-editor-preview-embed">
      <video
        ref={videoRef}
        className="jayrr-editor-preview-embed__video"
        data-element-id={elementId}
        playsInline
        preload="metadata"
      />
      <div className="jayrr-editor-preview-embed__label" aria-hidden>
        Editor preview
      </div>
    </div>
  );
};
