export const formatRecordingClock = (durationMs: number) => {
  const total = Math.max(0, Math.round(durationMs / 1000));
  return formatMediaClock(total);
};

export const formatMediaClock = (totalSeconds: number) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }
  const total = Math.floor(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const finiteMediaSeconds = (value: number | undefined | null) => {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
};

export const formatRecordingWhen = (createdAt: number) => {
  return new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatRecordingSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }
  const mb = sizeBytes / (1024 * 1024);
  if (mb < 10) {
    return `${mb.toFixed(1)} MB`;
  }
  if (mb < 1024) {
    return `${Math.round(mb)} MB`;
  }
  return `${(mb / 1024).toFixed(1)} GB`;
};

export const formatRecordingQuality = (width: number, height: number) => {
  const short = Math.min(width, height);
  if (short >= 2160) {
    return "4K";
  }
  if (short >= 1440) {
    return "1440p";
  }
  if (short >= 1080) {
    return "1080p";
  }
  if (short >= 720) {
    return "720p";
  }
  if (short >= 480) {
    return "480p";
  }
  if (short > 0) {
    return "SD";
  }
  return null;
};
