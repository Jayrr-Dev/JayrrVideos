import { JAYRR_PHONE_SELF } from "../camera/jayrrCamera";

const CLIENT_KEY = "jayrrPhoneClientId";

export const getJayrrPhoneClientId = () => {
  const existing = sessionStorage.getItem(CLIENT_KEY);
  if (existing && existing.length >= 8) {
    return existing;
  }
  const id = `c_${crypto.randomUUID().replaceAll("-", "")}`;
  sessionStorage.setItem(CLIENT_KEY, id);
  return id;
};

export type JayrrPhonePerson = {
  userId: string;
  label: string;
};

const listeners = new Set<() => void>();
const remotes = new Map<string, MediaStream>();

let localStream: MediaStream | null = null;
let people: JayrrPhonePerson[] = [{ userId: JAYRR_PHONE_SELF, label: "You" }];
let error: string | null = null;
let selfHold = 0;

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const subscribeJayrrPhone = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const peekJayrrPhoneStream = (userId: string) => {
  if (userId === JAYRR_PHONE_SELF) {
    return localStream;
  }
  return remotes.get(userId) ?? null;
};

export const listJayrrPhonePeople = () => people;

export const getJayrrPhoneError = () => error;

export const getJayrrPhoneSelfWanted = () => selfHold > 0;

export const retainJayrrPhoneSelf = () => {
  selfHold += 1;
  notify();
};

export const releaseJayrrPhoneSelf = () => {
  selfHold = Math.max(0, selfHold - 1);
  notify();
};

export const setJayrrPhoneLocal = (stream: MediaStream | null) => {
  localStream = stream;
  notify();
};

export const setJayrrPhoneRemote = (
  userId: string,
  stream: MediaStream | null,
) => {
  if (!stream) {
    remotes.delete(userId);
  } else {
    remotes.set(userId, stream);
  }
  notify();
};

export const setJayrrPhonePeople = (next: JayrrPhonePerson[]) => {
  people = next;
  notify();
};

export const setJayrrPhoneError = (next: string | null) => {
  error = next;
  notify();
};

export const clearJayrrPhoneRemotes = () => {
  remotes.clear();
  notify();
};
