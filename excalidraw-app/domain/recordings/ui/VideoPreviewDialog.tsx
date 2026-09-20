import { helpIcon } from "@excalidraw/excalidraw/components/icons";

import { Dialog, Tooltip } from "../../../components/ui/editor";

import { VideoPlayer } from "./VideoPlayer";

import "./VideoPreviewDialog.scss";

import type { VideoPreviewSource } from "../model";

const INFO =
  "Play this recording with scrub, volume, mute, and fullscreen controls. Space or K plays or pauses. M mutes. F toggles fullscreen. Arrow keys seek and change volume.";

type VideoPreviewDialogProps = {
  source: VideoPreviewSource;
  onClose: () => void;
};

export const VideoPreviewDialog = ({
  source,
  onClose,
}: VideoPreviewDialogProps) => {
  return (
    <Dialog
      className="jayrr-video-preview"
      size="wide"
      autofocus={false}
      onCloseRequest={onClose}
      title={
        <span className="jayrr-video-preview__title-row">
          <span className="jayrr-video-preview__title">{source.title}</span>
          <Tooltip label={INFO} long position="top">
            <span className="jayrr-video-preview__info" aria-label="More info">
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p className="visually-hidden">{INFO}</p>
      <VideoPlayer
        src={source.url}
        poster={source.posterUrl}
        label={source.title}
        durationHintMs={source.durationMs}
        autoPlay
      />
    </Dialog>
  );
};
