export const jayrrLocalSoundUrl = (path: string) =>
  `/jayrr-sound?path=${encodeURIComponent(path)}`;

export const jayrrSoundPlayUrls = (
  convexUrl: string | null,
  path: string,
): string[] => {
  const urls: string[] = [];
  if (path) {
    urls.push(jayrrLocalSoundUrl(path));
  }
  if (convexUrl) {
    urls.push(convexUrl);
  }
  return urls;
};

export const assignAndPlayAudio = (
  audio: HTMLAudioElement,
  src: string,
): Promise<boolean> => {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      resolve(ok);
    };
    const onPlaying = () => {
      finish(true);
    };
    const onError = () => {
      finish(false);
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
    audio.src = src;
    void audio.play().then(
      () => undefined,
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          finish(true);
          return;
        }
        finish(false);
      },
    );
  });
};
