import { api, convexClient } from "../convexClient";
import { jayrrSoundPlayUrls } from "../sounds/jayrrSoundPlayback";

import type { Id } from "../../convex/_generated/dataModel";
import type { PresentDeck, PresentSound } from "./buildPresentDeck";

let bed: HTMLAudioElement | null = null;
let sfx: HTMLAudioElement | null = null;
let bedKey: string | null = null;

const stopAudio = (audio: HTMLAudioElement | null) => {
  if (!audio) {
    return;
  }
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
};

const resolveUrls = async (sound: PresentSound) => {
  const localUrls = jayrrSoundPlayUrls(null, sound.path ?? "");
  if (!convexClient) {
    return localUrls;
  }
  try {
    const row = await convexClient.query(api.sounds.get, {
      soundId: sound.id as Id<"sounds">,
    });
    if (!row) {
      return localUrls;
    }
    return jayrrSoundPlayUrls(row.url, row.path || sound.path || "");
  } catch {
    return localUrls;
  }
};

const playUrl = async (
  current: HTMLAudioElement | null,
  url: string,
  loop: boolean,
) => {
  const audio = current ?? new Audio();
  audio.loop = loop;
  audio.src = url;
  try {
    await audio.play();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return audio;
    }
  }
  return audio;
};

const playBed = async (sound: PresentSound, key: string) => {
  const immediate = jayrrSoundPlayUrls(null, sound.path ?? "");
  stopAudio(bed);
  for (const url of immediate) {
    if (bedKey !== key) {
      return;
    }
    bed = await playUrl(bed, url, true);
    if (bed && !bed.paused) {
      return;
    }
  }
  const urls = await resolveUrls(sound);
  if (urls.length === 0 || bedKey !== key) {
    return;
  }
  for (const url of urls) {
    if (bedKey !== key) {
      return;
    }
    if (immediate.includes(url)) {
      continue;
    }
    bed = await playUrl(bed, url, true);
    if (bed && !bed.paused) {
      return;
    }
  }
};

const playSfx = async (sound: PresentSound) => {
  const immediate = jayrrSoundPlayUrls(null, sound.path ?? "");
  stopAudio(sfx);
  for (const url of immediate) {
    sfx = await playUrl(sfx, url, false);
    if (sfx && !sfx.paused) {
      return;
    }
  }
  const urls = await resolveUrls(sound);
  if (urls.length === 0) {
    return;
  }
  for (const url of urls) {
    if (immediate.includes(url)) {
      continue;
    }
    sfx = await playUrl(sfx, url, false);
    if (sfx && !sfx.paused) {
      return;
    }
  }
};

export const stopPresentSounds = () => {
  bedKey = null;
  stopAudio(bed);
  stopAudio(sfx);
  bed = null;
  sfx = null;
};

export const syncPresentSounds = (deck: PresentDeck, stepIndex: number) => {
  const step = deck.steps[stepIndex];
  if (!step) {
    stopPresentSounds();
    return;
  }
  const frame = deck.frames.find((item) => item.id === step.frameId);
  const nextBed = frame?.sound ?? null;
  const nextKey = nextBed && frame ? `${frame.id}:${nextBed.id}` : null;
  if (bedKey !== nextKey) {
    bedKey = nextKey;
    stopAudio(bed);
    if (nextBed && nextKey) {
      void playBed(nextBed, nextKey);
    }
  }
  if (step.type !== "reveal") {
    return;
  }
  const object = frame?.objects.find((item) => item.id === step.elementId);
  if (object?.sound) {
    void playSfx(object.sound);
  }
};
