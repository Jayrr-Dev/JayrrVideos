const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "packages");
const LICENSE = path.join(ROOT, "LICENSE");
const REPO = "https://github.com/Jayrr-Dev/JayrrVideos";

const IMPORT_RENAMES = [
  ["@excalidraw/fractional-indexing", "@jayrrdev/fractional-indexing"],
  ["@excalidraw/laser-pointer", "@jayrrdev/laser-pointer"],
  ["@excalidraw/common", "@jayrrdev/common"],
  ["@excalidraw/element", "@jayrrdev/element"],
  ["@excalidraw/math", "@jayrrdev/math"],
  ["@excalidraw/utils", "@jayrrdev/utils"],
  ["@excalidraw/excalidraw", "jayrrvideos"],
];

const PUBLISH = [
  { dir: "common", npmName: "@jayrrdev/common" },
  { dir: "fractional-indexing", npmName: "@jayrrdev/fractional-indexing" },
  { dir: "math", npmName: "@jayrrdev/math" },
  { dir: "element", npmName: "@jayrrdev/element" },
  { dir: "laser-pointer", npmName: "@jayrrdev/laser-pointer" },
  {
    dir: "excalidraw",
    npmName: "jayrrvideos",
    description:
      "JayrrVideos React whiteboard. Free and open source (MIT). Based on Excalidraw.",
  },
];

const rewriteText = (text) => {
  let next = text;
  for (const [from, to] of IMPORT_RENAMES) {
    next = next.split(from).join(to);
  }
  return next;
};

const rewriteTree = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteTree(full);
      continue;
    }
    if (!/\.(js|mjs|cjs|d\.ts|map|css|json)$/.test(entry.name)) {
      continue;
    }
    const original = fs.readFileSync(full, "utf8");
    const rewritten = rewriteText(original);
    if (rewritten !== original) {
      fs.writeFileSync(full, rewritten);
    }
  }
};

const rewriteDeps = (deps) => {
  if (!deps) {
    return deps;
  }
  const next = {};
  for (const [name, version] of Object.entries(deps)) {
    const mapped = IMPORT_RENAMES.find(([from]) => from === name);
    next[mapped ? mapped[1] : name] = version;
  }
  return next;
};

const copyDir = (from, to) => {
  fs.cpSync(from, to, { recursive: true });
};

const publishOne = (spec) => {
  const src = path.join(PACKAGES_DIR, spec.dir);
  const dist = path.join(src, "dist");
  if (!fs.existsSync(dist)) {
    throw new Error(`Missing build: ${dist}`);
  }

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), `jayrr-${spec.dir}-`));
  copyDir(dist, path.join(stage, "dist"));
  fs.copyFileSync(LICENSE, path.join(stage, "LICENSE"));

  const pkg = JSON.parse(
    fs.readFileSync(path.join(src, "package.json"), "utf8"),
  );
  pkg.name = spec.npmName;
  pkg.repository = REPO;
  pkg.bugs = `${REPO}/issues`;
  pkg.homepage = REPO;
  pkg.publishConfig = { access: "public" };
  pkg.dependencies = rewriteDeps(pkg.dependencies);
  if (spec.description) {
    pkg.description = spec.description;
    pkg.keywords = [
      "jayrrvideos",
      "whiteboard",
      "excalidraw",
      "react",
      "mit",
    ];
  }
  fs.writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`,
  );

  rewriteTree(path.join(stage, "dist"));

  console.info(`Publishing ${spec.npmName}@${pkg.version} from ${stage}`);
  execSync("npm publish --access public", { cwd: stage, stdio: "inherit" });
};

for (const spec of PUBLISH) {
  publishOne(spec);
}

console.info("Published JayrrVideos packages.");
