export const debugTranscribe = (
  stage: string,
  detail: string | Record<string, unknown>,
) => {
  if (typeof detail === "string") {
    console.info(`[Jayrr Transcribe] ${stage}: ${detail}`);
    return;
  }
  console.info(`[Jayrr Transcribe] ${stage}`, detail);
};
