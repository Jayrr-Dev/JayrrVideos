import { appJotaiStore, atom } from "../app-jotai";
import { GOOGLE_DRIVE_SCOPE, STORAGE_KEYS } from "../app_constants";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const TOKEN_EXPIRY_SKEW_MS = 60_000;

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: string | number;
};

type StoredToken = {
  accessToken: string;
  expiresAt: number;
};

type TokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;
let pendingTokenRequest: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
} | null = null;

export const googleDriveConnectedAtom = atom(readDriveEnabled());

export const getGoogleClientId = (): string => {
  return import.meta.env.VITE_APP_GOOGLE_CLIENT_ID?.trim() ?? "";
};

export const isGoogleDriveConfigured = (): boolean => {
  return getGoogleClientId().length > 0;
};

export const isGoogleDriveEnabled = (): boolean => {
  return readDriveEnabled();
};

export const connectGoogleDrive = async (): Promise<string> => {
  if (!isGoogleDriveConfigured()) {
    throw new Error(
      "Missing VITE_APP_GOOGLE_CLIENT_ID. Add a Google OAuth Web client ID in .env.development.local.",
    );
  }

  const token = await requestAccessToken("consent");
  writeDriveEnabled(true);
  appJotaiStore.set(googleDriveConnectedAtom, true);
  return token;
};

export const disconnectGoogleDrive = async (): Promise<void> => {
  const stored = readStoredToken();
  if (stored) {
    await loadGisScript();
    await new Promise<void>((resolve) => {
      window.google?.accounts.oauth2.revoke(stored.accessToken, () => {
        resolve();
      });
      window.setTimeout(() => resolve(), 1500);
    });
  }

  localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_FOLDER_ID);
  writeDriveEnabled(false);
  appJotaiStore.set(googleDriveConnectedAtom, false);
};

export const getGoogleAccessToken = async (): Promise<string> => {
  if (!isGoogleDriveEnabled()) {
    throw new Error("Google Drive is not connected.");
  }

  const stored = readStoredToken();
  if (stored && stored.expiresAt - TOKEN_EXPIRY_SKEW_MS > Date.now()) {
    return stored.accessToken;
  }

  return requestAccessToken("");
};

export const refreshGoogleAccessToken = async (): Promise<string> => {
  return requestAccessToken("");
};

const requestAccessToken = async (prompt: string): Promise<string> => {
  await loadGisScript();
  const client = getTokenClient();

  if (pendingTokenRequest) {
    pendingTokenRequest.reject(new Error("Google sign-in was replaced."));
    pendingTokenRequest = null;
  }

  return new Promise((resolve, reject) => {
    pendingTokenRequest = { resolve, reject };
    client.requestAccessToken({ prompt });
  });
};

const getTokenClient = (): TokenClient => {
  if (tokenClient) {
    return tokenClient;
  }

  const clientId = getGoogleClientId();
  if (!window.google) {
    throw new Error("Google Identity Services failed to load.");
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_DRIVE_SCOPE,
    callback: (response) => {
      const pending = pendingTokenRequest;
      pendingTokenRequest = null;

      if (!pending) {
        return;
      }

      if (response.error || !response.access_token) {
        pending.reject(
          new Error(
            response.error_description ||
              response.error ||
              "Google sign-in failed.",
          ),
        );
        return;
      }

      const expiresInSeconds = Number(response.expires_in ?? 3600);
      const stored: StoredToken = {
        accessToken: response.access_token,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      };
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_TOKEN,
        JSON.stringify(stored),
      );
      pending.resolve(stored.accessToken);
    },
  });

  return tokenClient;
};

const loadGisScript = (): Promise<void> => {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (gisScriptPromise) {
    return gisScriptPromise;
  }

  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
};

const readStoredToken = (): StoredToken | null => {
  const raw = localStorage.getItem(
    STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_TOKEN,
  );
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredToken;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

function readDriveEnabled(): boolean {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_ENABLED) ===
      "true"
    );
  } catch {
    return false;
  }
}

function writeDriveEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_ENABLED,
      "true",
    );
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_ENABLED);
}
