import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const LIBRARY_CANDIDATES = [
  process.env.SOUND_LIBRARY_ROOT,
  "C:\\Users\\Main\\OneDrive\\Sound Library\\Flatten",
  "C:\\Users\\Main\\Documents\\Sound Library\\Flatten",
].filter((value): value is string => Boolean(value));

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG,
  "C:\\Users\\Main\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe",
  "ffmpeg",
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

const TAG_RE =
  / \[(\d{1,3}),(\d{2}),(\d{2})\] \[(\d+)Hz\] \[sc(\d+)Hz\](?: \[(-?\d+)dB\])?/;

const TONE_DIR = join(tmpdir(), "jayrr-sound-tone");

const findExisting = (candidates: string[]) => {
  for (const candidate of candidates) {
    if (candidate === "ffmpeg" || existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const libraryRoot = () => findExisting(LIBRARY_CANDIDATES);

const ffmpegBin = () => findExisting(FFMPEG_CANDIDATES);

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

const parsePreview = (rel: string) => {
  const match = rel.match(TAG_RE);
  if (!match) {
    return { durationSec: 1.5, centroidHz: 440 };
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const centroidHz = Number(match[5]);
  const durationSec = hours * 3600 + minutes * 60 + seconds;
  return {
    durationSec: Math.min(30, Math.max(0.25, durationSec || 1.5)),
    centroidHz: Math.min(8000, Math.max(80, centroidHz || 440)),
  };
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

const runFfmpeg = (args: string[]) =>
  new Promise<void>((resolvePromise, reject) => {
    const bin = ffmpegBin();
    if (!bin) {
      reject(new Error("ffmpeg missing"));
      return;
    }
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(stderr || `ffmpeg exited ${code}`));
    });
  });

const ensureTone = async (rel: string) => {
  mkdirSync(TONE_DIR, { recursive: true });
  const id = createHash("sha1").update(rel).digest("hex");
  const oggPath = join(TONE_DIR, `${id}.ogg`);
  if (existsSync(oggPath) && statSync(oggPath).size > 0) {
    return oggPath;
  }
  const preview = parsePreview(rel);
  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `anoisesrc=color=brown:duration=${preview.durationSec}:sample_rate=44100`,
    "-af",
    `lowpass=f=${preview.centroidHz}`,
    "-c:a",
    "libopus",
    "-b:a",
    "48k",
    oggPath,
  ]);
  return oggPath;
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
  try {
    const tone = await ensureTone(rel);
    res.setHeader("X-Jayrr-Sound", "preview");
    sendFile(res, tone, req);
  } catch {
    res.statusCode = 404;
    res.end("Sound file not found");
  }
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
