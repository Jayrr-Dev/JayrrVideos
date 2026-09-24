import { atom } from "../app-jotai";

export const ROOM_GUEST_LIMIT_MIN = 1;
export const ROOM_GUEST_LIMIT_MAX = 50;
export const ROOM_GUEST_LIMIT_DEFAULT = 8;

export const roomGuestLimitAtom = atom(ROOM_GUEST_LIMIT_DEFAULT);

export const clampRoomGuestLimit = (value: number) => {
  if (!Number.isFinite(value)) {
    return ROOM_GUEST_LIMIT_DEFAULT;
  }
  return Math.min(
    ROOM_GUEST_LIMIT_MAX,
    Math.max(ROOM_GUEST_LIMIT_MIN, Math.floor(value)),
  );
};

export const parseRoomGuestLimit = (raw: string) => {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return ROOM_GUEST_LIMIT_DEFAULT;
  }
  return clampRoomGuestLimit(parsed);
};

export const guestLimitToMaxParticipants = (guestLimit: number) =>
  clampRoomGuestLimit(guestLimit) + 1;
