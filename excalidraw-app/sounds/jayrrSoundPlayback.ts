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
  if (convexUrl && !urls.includes(convexUrl)) {
    urls.push(convexUrl);
  }
  return urls;
};

const WAIT_MEDIA_MS = 4000;

/** Load `src` onto a media element. Resolves false on error. */
export const assignMediaSrc = (
  media: HTMLMediaElement,
  src: string,
): Promise<boolean> => {
  if (
    media.getAttribute("src") === src &&
    media.readyState >= 1 &&
    !media.error
  ) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      media.removeEventListener("loadedmetadata", onOk);
      media.removeEventListener("error", onErr);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onOk = () => finish(true);
    const onErr = () => finish(false);
    const timer = window.setTimeout(() => {
      finish(media.readyState >= 1 && !media.error);
    }, WAIT_MEDIA_MS);
    media.addEventListener("loadedmetadata", onOk);
    media.addEventListener("error", onErr);
    media.src = src;
    media.load();
  });
};

/** Try sources in order until one can decode. */
export const assignMediaSrcFromList = async (
  media: HTMLMediaElement,
  sources: readonly string[],
): Promise<string | null> => {
  const current = media.getAttribute("src") || "";
  if (
    current &&
    sources.includes(current) &&
    media.readyState >= 1 &&
    !media.error
  ) {
    return current;
  }
  for (const src of sources) {
    if (!src) {
      continue;
    }
    const ok = await assignMediaSrc(media, src);
    if (ok) {
      return src;
    }
  }
  return null;
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
