import { SpeechCanvasWidget } from "./TranscriptionWidget";

export const CaptionWidget = ({ elementId }: { elementId: string }) => (
  <SpeechCanvasWidget elementId={elementId} kind="caption" />
);
