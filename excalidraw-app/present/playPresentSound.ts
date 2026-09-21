import { api, convexClient } from "../convexClient";
import { jayrrSoundPlayUrls } from "../sounds/jayrrSoundPlayback";

import type { Id } from "../../convex/_generated/dataModel";

import {
  countedPresentObjects,
  type PresentDeck,
  type PresentSound,
} from "./buildPresentDeck";

type Cue = {
  audio: HTMLAudioElement | null;
  gen: number;
};

const frameCue: Cue = { audio: null, gen: 0 };
const objectCue: Cue = { audio: null, gen: 0 };
let stepKey: string | null = null;

const stopAudio = (audio: HTMLAudioElement | null) => {
  if (!audio) {
    return;
  }
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
};

const stopCue = (cue: Cue) => {
  cue.gen += 1;
  stopAudio(cue.audio);
  cue.audio = null;
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

const playUrl = async (current: HTMLAudioElement | null, url: string) => {
  const audio = current ?? new Audio();
  audio.loop = false;
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

const playCue = async (cue: Cue, sound: PresentSound) => {
  const gen = cue.gen + 1;
  cue.gen = gen;
  const immediate = jayrrSoundPlayUrls(null, sound.path ?? "");
  stopAudio(cue.audio);
  for (const url of immediate) {
    if (cue.gen !== gen) {
      return;
    }
    cue.audio = await playUrl(cue.audio, url);
    if (cue.audio && !cue.audio.paused) {
      return;
    }
  }
  const urls = await resolveUrls(sound);
  if (urls.length === 0 || cue.gen !== gen) {
    return;
  }
  for (const url of urls) {
    if (cue.gen !== gen) {
      return;
    }
    if (immediate.includes(url)) {
      continue;
    }
    cue.audio = await playUrl(cue.audio, url);
    if (cue.audio && !cue.audio.paused) {
      return;
    }
  }
};

export const stopPresentSounds = () => {
  stepKey = null;
  stopCue(frameCue);
  stopCue(objectCue);
};

export const syncPresentSounds = (deck: PresentDeck, stepIndex: number) => {
  const step = deck.steps[stepIndex];
  if (!step) {
    stopPresentSounds();
    return;
  }
  const nextKey = `${stepIndex}:${step.type}:${step.frameId}:${
    "elementId" in step ? step.elementId : ""
  }`;
  if (stepKey === nextKey) {
    return;
  }
  stepKey = nextKey;
  if (step.type !== "reveal") {
    return;
  }
  const frame = deck.frames.find((item) => item.id === step.frameId);
  const object = frame?.objects.find((item) => item.id === step.elementId);
  if (!object) {
    return;
  }
  const first = countedPresentObjects(frame?.objects ?? [])[0];
  if (frame?.sound && first?.id === object.id) {
    void playCue(frameCue, frame.sound);
  }
  if (object.sound) {
    void playCue(objectCue, object.sound);
  }
};
