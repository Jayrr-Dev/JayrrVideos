import { CaptionWidget } from "../objects/CaptionWidget";
import { ClassifierWidget } from "../objects/ClassifierWidget";
import { MarkdownWidget } from "../objects/MarkdownWidget";
import { PdfWidget } from "../objects/PdfWidget";
import { TranscribeWidget } from "../objects/TranscribeWidget";
import { TranscriptionWidget } from "../objects/TranscriptionWidget";

import "./JayrrCalledObjectEmbed.scss";

import type { CalledObjectKind } from "../model";

export const JayrrCalledObjectEmbed = ({
  kind,
  elementId,
}: {
  kind: CalledObjectKind;
  elementId: string;
}) => {
  if (kind === "classifier") {
    return <ClassifierWidget elementId={elementId} />;
  }
  if (kind === "transcription") {
    return <TranscriptionWidget elementId={elementId} />;
  }
  if (kind === "caption") {
    return <CaptionWidget elementId={elementId} />;
  }
  if (kind === "markdown") {
    return <MarkdownWidget elementId={elementId} />;
  }
  if (kind === "pdf") {
    return <PdfWidget elementId={elementId} />;
  }
  return <TranscribeWidget elementId={elementId} />;
};
