import { clearCaption, writeCaption } from "./captions";
import { listenStreamTranscript } from "./listenStreamTranscript";
import { ensureSpeakerNames, speakerLabel } from "./transcriptTurns";

export const listenDisplayAudio = (
  elementId: string,
  stream: MediaStream,
): (() => void) => {
  const committed: string[] = [];
  let names: Record<number, string> = {};
  const session = listenStreamTranscript(
    stream,
    (turns, isFinal) => {
      names = ensureSpeakerNames(
        names,
        turns.map((turn) => turn.speaker),
      );
      const lines = turns.map(
        (turn) => `${speakerLabel(turn.speaker, names)}: ${turn.text}`,
      );
      if (isFinal) {
        committed.push(...lines);
        writeCaption(elementId, committed.slice(-12).join("\n"));
        return;
      }
      writeCaption(elementId, [...committed.slice(-12), ...lines].join("\n"));
    },
    (message) => writeCaption(elementId, message),
  );
  return () => {
    session.stop();
    clearCaption(elementId);
  };
};
