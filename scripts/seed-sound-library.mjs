import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api.js";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(rootDir, "..");
const loadEnv = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnv(join(repoRoot, ".env.local"));
loadEnv(join(repoRoot, "excalidraw-app", ".env.development.local"));
loadEnv(join(repoRoot, ".env.example"));

const CATALOG_PATH = join(
  "C:\\Users\\Main\\Documents\\Projects\\sound-effect-picker",
  "src",
  "data",
  "catalog.json",
);

const LIBRARY_CANDIDATES = [
  process.env.SOUND_LIBRARY_ROOT,
  "C:\\Users\\Main\\OneDrive\\Sound Library\\Flatten",
  "C:\\Users\\Main\\Documents\\Sound Library\\Flatten",
].filter(Boolean);

const FFMPEG =
  process.env.FFMPEG ??
  "C:\\Users\\Main\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";

const url = process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL;
const secret = process.env.SEED_SECRET ?? "";
const reset = process.argv.includes("--reset");
const metadataOnly = process.argv.includes("--metadata-only");
const previewFallback = process.argv.includes("--preview-fallback");
const keepExisting = process.argv.includes("--keep-existing");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : 0;
const CONCURRENCY = 12;

if (!url) {
  throw new Error("VITE_CONVEX_URL is not set");
}

if (!existsSync(CATALOG_PATH)) {
  throw new Error(`Catalog not found: ${CATALOG_PATH}`);
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const client = new ConvexHttpClient(url);
const tmpOggDir = join(tmpdir(), "jayrr-sound-ogg");
mkdirSync(tmpOggDir, { recursive: true });

const findLibraryRoot = () => {
  for (const candidate of LIBRARY_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const TAG_RE =
  / \[(\d{1,3}),(\d{2}),(\d{2})\] \[(\d+)Hz\] \[sc(\d+)Hz\](?: \[(-?\d+)dB\])?/;

const loudnessFromFile = (file) => {
  if (typeof file.loudnessDb === "number") {
    return file.loudnessDb;
  }
  const match = String(file.path ?? "").match(TAG_RE);
  if (match?.[6] != null) {
    return Number(match[6]);
  }
  return undefined;
};

const toSound = (file) => {
  const folderPath = file.folders.join("/");
  const loudnessDb = loudnessFromFile(file);
  return {
    path: file.path,
    name: file.name,
    source: file.source ?? file.name,
    owner: file.owner ?? "",
    credit: file.credit ?? "",
    license: file.license ?? "",
    folders: file.folders,
    folderPath,
    category: file.folders[0] ?? "",
    ext: ".ogg",
    durationSec: file.durationSec,
    sampleRate: file.sampleRate,
    centroidHz: file.centroidHz,
    ...(typeof loudnessDb === "number" ? { loudnessDb } : {}),
    search: [
      file.name,
      file.source ?? file.name,
      file.owner ?? "",
      file.credit ?? "",
      file.license ?? "",
      file.path,
      folderPath,
    ]
      .join(" ")
      .toLowerCase(),
  };
};

const buildFolders = (files) => {
  const map = new Map();
  map.set("", { path: "", name: "Library", parent: "", count: files.length });
  for (const file of files) {
    let parent = "";
    for (const name of file.folders) {
      const path = parent ? `${parent}/${name}` : name;
      const row = map.get(path) ?? { path, name, parent, count: 0 };
      row.count += 1;
      map.set(path, row);
      parent = path;
    }
  }
  return [...map.values()];
};

const spawnFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `ffmpeg exited ${code}`));
    });
  });

const parsePreview = (rel) => {
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

const convertSource = (input, output) =>
  spawnFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input,
    "-vn",
    "-c:a",
    "libopus",
    "-b:a",
    "64k",
    "-ar",
    "48000",
    output,
  ]);

const convertPreview = (rel, output) => {
  const preview = parsePreview(rel);
  return spawnFfmpeg([
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
    output,
  ]);
};

const uploadOgg = async (oggPath) => {
  const uploadUrl = await client.mutation(api.soundSeed.generateUploadUrl, {
    secret,
  });
  const body = readFileSync(oggPath);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "audio/ogg" },
    body,
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  const json = await response.json();
  return json.storageId;
};

const sourcePathFor = (libraryRoot, file) =>
  libraryRoot ? join(libraryRoot, file.path) : null;

const mapPool = async (items, n, fn) => {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, n) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) {
        return;
      }
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
};

if (reset) {
  console.log("Clearing existing sounds...");
  for (;;) {
    const cleared = await client.mutation(api.soundSeed.clearPage, { secret });
    console.log(
      `  deleted sounds=${cleared.sounds} folders=${cleared.folders}`,
    );
    if (cleared.sounds === 0 && cleared.folders === 0) {
      break;
    }
  }
}

const libraryRoot = findLibraryRoot();
if (!libraryRoot) {
  console.warn(
    "Flatten library missing at C:\\Users\\Main\\OneDrive\\Sound Library\\Flatten",
  );
  if (!previewFallback) {
    console.warn(
      "Skipping audio upload. Pass --preview-fallback to store brown-noise stand-ins.",
    );
  }
}

const files =
  Number.isFinite(limit) && limit > 0
    ? catalog.files.slice(0, limit)
    : catalog.files;
console.log(
  `Catalog files: ${files.length}${limit > 0 ? ` (limit ${limit})` : ""}`,
);
console.log(`Library root: ${libraryRoot ?? "(missing)"}`);

const SOUND_BATCH = 80;
console.log(`Upserting ${files.length} sound rows...`);
for (let i = 0; i < files.length; i += SOUND_BATCH) {
  const batch = files.slice(i, i + SOUND_BATCH).map(toSound);
  await client.mutation(api.soundSeed.insertSounds, { secret, files: batch });
  console.log(`  ${Math.min(i + SOUND_BATCH, files.length)}/${files.length}`);
}

const folders = buildFolders(limit > 0 ? catalog.files : files);
const FOLDER_BATCH = 100;
console.log(`Upserting ${folders.length} folders...`);
for (let i = 0; i < folders.length; i += FOLDER_BATCH) {
  const batch = folders.slice(i, i + FOLDER_BATCH);
  await client.mutation(api.soundSeed.insertFolders, {
    secret,
    folders: batch,
  });
}

if (!existsSync(FFMPEG) || metadataOnly) {
  console.log(
    `Done. Audio conversion skipped (ffmpeg=${existsSync(
      FFMPEG,
    )} metadataOnly=${metadataOnly}).`,
  );
  process.exit(0);
}

const CHECK_BATCH = 80;
const existing = new Map();
for (let i = 0; i < files.length; i += CHECK_BATCH) {
  const slice = files
    .slice(i, i + CHECK_BATCH)
    .map((file) => toSound(file).path);
  const rows = await client.mutation(api.soundSeed.existingPaths, {
    secret,
    paths: slice,
  });
  for (const row of rows) {
    existing.set(row.path, row.hasAudio);
  }
}

let converted = 0;
let previewed = 0;
let skipped = 0;
let missing = 0;
let failed = 0;
let done = 0;

await mapPool(files, CONCURRENCY, async (file) => {
  const sound = toSound(file);
  const sourcePath = sourcePathFor(libraryRoot, file);
  const hasSource = Boolean(sourcePath && existsSync(sourcePath));
  const hasAudio = existing.get(sound.path) === true;

  if (!hasSource && !previewFallback) {
    missing += 1;
    done += 1;
    return;
  }

  if (hasAudio && keepExisting) {
    skipped += 1;
    done += 1;
    return;
  }

  if (hasAudio && !hasSource && previewFallback) {
    skipped += 1;
    done += 1;
    return;
  }

  const hash = createHash("sha1").update(sound.path).digest("hex");
  const oggPath = join(tmpOggDir, `${hash}.ogg`);
  try {
    if (hasSource) {
      await convertSource(sourcePath, oggPath);
    } else {
      await convertPreview(sound.path, oggPath);
    }
    const storageId = await uploadOgg(oggPath);
    await client.mutation(api.soundSeed.attachAudio, {
      secret,
      path: sound.path,
      storageId,
    });
    if (hasSource) {
      converted += 1;
    } else {
      previewed += 1;
    }
  } catch (error) {
    failed += 1;
    console.error(`  fail ${file.path}: ${error.message}`);
  } finally {
    if (existsSync(oggPath)) {
      unlinkSync(oggPath);
    }
  }

  done += 1;
  if (done % 50 === 0 || done === files.length) {
    console.log(
      `  ${done}/${files.length} source=${converted} preview=${previewed} missing=${missing} skipped=${skipped} failed=${failed}`,
    );
  }
});

console.log(
  `Done. source=${converted} preview=${previewed} missing=${missing} skipped=${skipped} failed=${failed}`,
);
