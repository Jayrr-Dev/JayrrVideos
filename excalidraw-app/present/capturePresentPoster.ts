const POSTER_MAX_WIDTH = 640;
const POSTER_QUALITY = 0.82;

export const capturePresentPoster = (file: Blob): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (poster: Blob | null) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      resolve(poster);
    };

    const timeoutId = window.setTimeout(() => finish(null), 8000);

    const draw = () => {
      if (video.videoWidth < 2 || video.videoHeight < 2) {
        finish(null);
        return;
      }
      const scale = Math.min(1, POSTER_MAX_WIDTH / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        finish(null);
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((poster) => finish(poster), "image/jpeg", POSTER_QUALITY);
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      const seekTo =
        Number.isFinite(video.duration) && video.duration > 0.25 ? 0.2 : 0;
      if (Math.abs(video.currentTime - seekTo) < 0.01) {
        draw();
        return;
      }
      video.currentTime = seekTo;
    };
    video.onseeked = draw;
  });
};
