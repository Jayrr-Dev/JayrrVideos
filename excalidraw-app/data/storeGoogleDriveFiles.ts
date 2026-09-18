import { getDataURL } from "@excalidraw/excalidraw/data/blob";

import type { FileId } from "@excalidraw/element/types";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

import {
  GOOGLE_DRIVE_FOLDER_NAME,
  GOOGLE_DRIVE_MIN_FILE_BYTES,
  STORAGE_KEYS,
} from "../app_constants";

import {
  getGoogleAccessToken,
  refreshGoogleAccessToken,
} from "./connectGoogleDrive";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const RESUMABLE_CHUNK_BYTES = 8 * 1024 * 1024;
export const DRIVE_FILE_PLACEHOLDER_DATA_URL = "data:," as DataURL;

export type LocalStoredFile = BinaryFileData & {
  driveFileId?: string;
};

type DriveFileList = {
  files?: Array<{ id: string }>;
};

type DriveFileResource = {
  id: string;
};

export const isDriveFileStub = (file: LocalStoredFile): boolean => {
  if (!file.driveFileId) {
    return false;
  }

  return !file.dataURL || file.dataURL === DRIVE_FILE_PLACEHOLDER_DATA_URL;
};

export const shouldStoreFileOnDrive = (file: BinaryFileData): boolean => {
  return estimateDataUrlBytes(file.dataURL) >= GOOGLE_DRIVE_MIN_FILE_BYTES;
};

export const toDriveFileStub = (
  file: BinaryFileData,
  driveFileId: string,
): LocalStoredFile => {
  return {
    id: file.id,
    mimeType: file.mimeType,
    created: file.created,
    lastRetrieved: file.lastRetrieved,
    version: file.version,
    driveFileId,
    dataURL: DRIVE_FILE_PLACEHOLDER_DATA_URL,
  };
};

export const uploadBinaryFileToDrive = async (
  file: BinaryFileData,
): Promise<string> => {
  const accessToken = await getGoogleAccessToken();
  const folderId = await getOrCreateDriveFolder(accessToken);
  const existingId = await findDriveFileId(accessToken, folderId, file.id);
  const blob = dataUrlToBlob(file.dataURL, file.mimeType);

  if (existingId) {
    await uploadResumable({
      accessToken,
      blob,
      mimeType: file.mimeType,
      fileId: existingId,
    });
    return existingId;
  }

  return uploadResumable({
    accessToken,
    blob,
    mimeType: file.mimeType,
    metadata: {
      name: driveFileName(file),
      parents: [folderId],
      appProperties: { jayrrFileId: file.id },
    },
  });
};

export const downloadBinaryFileFromDrive = async (
  stub: LocalStoredFile,
): Promise<{ file: BinaryFileData; driveFileId: string }> => {
  const accessToken = await getGoogleAccessToken();
  const folderId = await getOrCreateDriveFolder(accessToken);
  const driveFileId =
    stub.driveFileId ?? (await findDriveFileId(accessToken, folderId, stub.id));

  if (!driveFileId) {
    throw new Error(`Drive file missing for ${stub.id}`);
  }

  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(driveFileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Drive download failed (${response.status})`);
  }

  const blob = await response.blob();
  const dataURL = await getDataURL(blob);
  const mimeType = (blob.type || stub.mimeType) as BinaryFileData["mimeType"];

  return {
    driveFileId,
    file: {
      id: stub.id,
      mimeType,
      created: stub.created,
      lastRetrieved: Date.now(),
      version: stub.version,
      dataURL,
    },
  };
};

const getOrCreateDriveFolder = async (accessToken: string): Promise<string> => {
  const cached = localStorage.getItem(
    STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_FOLDER_ID,
  );
  if (cached) {
    return cached;
  }

  const query = encodeURIComponent(
    `name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listResponse = await driveFetch(
    `${DRIVE_API}/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!listResponse.ok) {
    throw new Error(`Drive folder lookup failed (${listResponse.status})`);
  }

  const list = (await listResponse.json()) as DriveFileList;
  const existing = list.files?.[0]?.id;
  if (existing) {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_FOLDER_ID,
      existing,
    );
    return existing;
  }

  const createResponse = await driveFetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: GOOGLE_DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Drive folder create failed (${createResponse.status})`);
  }

  const created = (await createResponse.json()) as DriveFileResource;
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_GOOGLE_DRIVE_FOLDER_ID,
    created.id,
  );
  return created.id;
};

const findDriveFileId = async (
  accessToken: string,
  folderId: string,
  fileId: FileId,
): Promise<string | null> => {
  const query = encodeURIComponent(
    `'${folderId}' in parents and appProperties has { key='jayrrFileId' and value='${fileId}' } and trashed=false`,
  );
  const response = await driveFetch(
    `${DRIVE_API}/files?q=${query}&fields=files(id)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    return null;
  }

  const list = (await response.json()) as DriveFileList;
  return list.files?.[0]?.id ?? null;
};

const uploadResumable = async ({
  accessToken,
  blob,
  mimeType,
  fileId,
  metadata,
}: {
  accessToken: string;
  blob: Blob;
  mimeType: string;
  fileId?: string;
  metadata?: {
    name: string;
    parents: string[];
    appProperties: { jayrrFileId: string };
  };
}): Promise<string> => {
  const url = fileId
    ? `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(
        fileId,
      )}?uploadType=resumable`
    : `${DRIVE_UPLOAD_API}/files?uploadType=resumable`;

  const sessionResponse = await driveFetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(blob.size),
    },
    body: metadata ? JSON.stringify(metadata) : undefined,
  });

  if (!sessionResponse.ok) {
    throw new Error(`Drive upload session failed (${sessionResponse.status})`);
  }

  const sessionUrl = sessionResponse.headers.get("Location");
  if (!sessionUrl) {
    throw new Error("Drive upload session missing Location header.");
  }

  const total = blob.size;
  let offset = 0;
  let lastResource: DriveFileResource | null = null;

  while (offset < total) {
    const end = Math.min(offset + RESUMABLE_CHUNK_BYTES, total);
    const chunk = blob.slice(offset, end);
    const chunkResponse = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(chunk.size),
        "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
      },
      body: chunk,
    });

    if (chunkResponse.status === 308) {
      offset = end;
      continue;
    }

    if (!chunkResponse.ok) {
      throw new Error(`Drive chunk upload failed (${chunkResponse.status})`);
    }

    lastResource = (await chunkResponse.json()) as DriveFileResource;
    offset = end;
  }

  if (!lastResource?.id && fileId) {
    return fileId;
  }

  if (!lastResource?.id) {
    throw new Error("Drive upload returned no file id.");
  }

  return lastResource.id;
};

const driveFetch = async (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  const response = await fetch(url, init);
  if (response.status !== 401) {
    return response;
  }

  const accessToken = await refreshGoogleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(url, { ...init, headers });
};

const dataUrlToBlob = (dataURL: DataURL, mimeType: string): Blob => {
  const comma = dataURL.indexOf(",");
  const header = comma >= 0 ? dataURL.slice(0, comma) : "";
  const payload = comma >= 0 ? dataURL.slice(comma + 1) : dataURL;
  const isBase64 = header.includes(";base64");
  const bytes = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const buffer = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }

  return new Blob([buffer], { type: mimeType });
};

const driveFileName = (file: BinaryFileData): string => {
  const subtype = file.mimeType.split("/")[1] ?? "bin";
  return `${file.id}.${subtype}`;
};

const estimateDataUrlBytes = (dataURL: string): number => {
  const comma = dataURL.indexOf(",");
  const payload = comma >= 0 ? dataURL.slice(comma + 1) : dataURL;
  return Math.floor((payload.length * 3) / 4);
};
