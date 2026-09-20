import { api, convexClient } from "../convexClient";

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

const resolveUrl = async (sound: PresentSound) => {
  if (!convexClient) {
    return null;
  }
  try {
    const row = await convexClient.query(api.sounds.get, {
      soundId: sound.id as Id<"sounds">,
    });
    return row?.url ?? null;
  } catch {
    return null;
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
  const url = await resolveUrl(sound);
  if (!url || bedKey !== key) {
    return;
  }
  stopAudio(bed);
  bed = await playUrl(bed, url, true);
};

const playSfx = async (sound: PresentSound) => {
  const url = await resolveUrl(sound);
  if (!url) {
    return;
  }
  stopAudio(sfx);
  sfx = await playUrl(sfx, url, false);
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
