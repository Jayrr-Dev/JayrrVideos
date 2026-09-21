import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const LIBRARY_CANDIDATES = [
  process.env.SOUND_LIBRARY_ROOT,
  "C:\\Users\\Main\\OneDrive\\Sound Library\\Flatten",
  "C:\\Users\\Main\\Documents\\Sound Library\\Flatten",
].filter((value): value is string => Boolean(value));

const TYPES: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".m4a": "audio/mp4",
  ".wma": "audio/x-ms-wma",
  ".webm": "audio/webm",
};

const findExisting = (candidates: string[]) => {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const libraryRoot = () => findExisting(LIBRARY_CANDIDATES);

const readRelPath = (req: IncomingMessage) => {
  const rawUrl = req.url ?? "";
  const query = rawUrl.includes("?")
    ? rawUrl.slice(rawUrl.indexOf("?") + 1)
    : "";
  const raw = new URLSearchParams(query).get("path");
  if (!raw) {
    return null;
  }
  const decoded = raw.replaceAll("\\", "/");
  if (decoded.includes("\0") || decoded.split("/").includes("..")) {
    return null;
  }
  return decoded;
};

const sendFile = (res: ServerResponse, full: string, req: IncomingMessage) => {
  const stat = statSync(full);
  const type = TYPES[extname(full).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range;
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${stat.size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", String(end - start + 1));
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    createReadStream(full, { start, end }).pipe(res);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(stat.size));
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  createReadStream(full).pipe(res);
};

const handleSound = async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end();
    return;
  }
  const rel = readRelPath(req);
  if (!rel) {
    res.statusCode = 400;
    res.end("Missing path");
    return;
  }
  const root = libraryRoot();
  if (root) {
    const full = resolve(join(root, rel.split("/").join(sep)));
    const rootWithSep = root.endsWith(sep) ? root : root + sep;
    if (full === root || full.startsWith(rootWithSep)) {
      if (existsSync(full)) {
        sendFile(res, full, req);
        return;
      }
    }
  }
  res.statusCode = 404;
  res.end("Sound file not found");
};

const attach = (middlewares: {
  use: (
    path: string,
    handler: (
      req: IncomingMessage,
      res: ServerResponse,
      next: () => void,
    ) => void,
  ) => void;
}) => {
  middlewares.use("/jayrr-sound", (req, res) => {
    void handleSound(req, res).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Sound proxy failed");
      }
    });
  });
};

export const soundLibraryProxy = (): Plugin => ({
  name: "jayrr-sound-library-proxy",
  configureServer(server) {
    attach(server.middlewares);
  },
  configurePreviewServer(server) {
    attach(server.middlewares);
  },
});
