/** Webcam overlays, authored in eye-line coordinates (400 units = face width). */
export const CAMERA_ACCESSORIES = [
  { id: "puppy", name: "Puppy" },
  { id: "flower-crown", name: "Flower Crown" },
  { id: "sport-shades", name: "Sport Shades" },
  { id: "cat-ears", name: "Cat Ears" },
  { id: "devil-horns", name: "Devil Horns" },
  { id: "tiara", name: "Tiara" },
  { id: "disguise", name: "Disguise" },
] as const;

export type CameraAccessory =
  | "glasses"
  | typeof CAMERA_ACCESSORIES[number]["id"];
type OverlayAccessory = Exclude<CameraAccessory, "glasses">;
type Context = CanvasRenderingContext2D;
type Bounds = { x: number; y: number; width: number; height: number };

const bounds: Record<OverlayAccessory, Bounds> = {
  puppy: { x: -275, y: -235, width: 550, height: 395 },
  "flower-crown": { x: -270, y: -270, width: 540, height: 210 },
  "sport-shades": { x: -270, y: -90, width: 540, height: 170 },
  "cat-ears": { x: -250, y: -325, width: 500, height: 220 },
  "devil-horns": { x: -230, y: -460, width: 460, height: 350 },
  tiara: { x: -250, y: -335, width: 500, height: 230 },
  disguise: { x: -270, y: -90, width: 540, height: 295 },
};

export const isCameraAccessory = (value: unknown): value is CameraAccessory =>
  value === "glasses" || CAMERA_ACCESSORIES.some(({ id }) => id === value);

function gradient(
  ctx: Context,
  x: number,
  y: number,
  x2: number,
  y2: number,
  colors: string[],
) {
  const fill = ctx.createLinearGradient(x, y, x2, y2);
  colors.forEach((color, index) =>
    fill.addColorStop(index / (colors.length - 1), color),
  );
  return fill;
}

function path(
  ctx: Context,
  data: string,
  fill: string | CanvasGradient,
  stroke?: string | CanvasGradient,
  width = 1,
) {
  const view = ctx.canvas.ownerDocument.defaultView;
  if (!view) {
    return;
  }
  const shape = new view.Path2D(data);
  ctx.fillStyle = fill;
  ctx.fill(shape);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(shape);
  }
}

function ellipse(
  ctx: Context,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient,
  rotation = 0,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function shine(ctx: Context, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  path(
    ctx,
    `M0 ${-size} Q2 -2 ${size} 0 Q2 2 0 ${size} Q-2 2 ${-size} 0 Q-2 -2 0 ${-size}`,
    "#fff9e9",
  );
  ctx.restore();
}

function puppy(ctx: Context) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    path(
      ctx,
      "M145 -184 C167 -229 218 -219 230 -170 C242 -124 261 -30 230 18 C213 43 170 28 162 -8 C151 -58 178 -113 145 -184Z",
      gradient(ctx, 149, -100, 246, -75, [
        "#573327",
        "#bf8b59",
        "#815332",
        "#3b2925",
      ]),
      "#533629",
      2,
    );
    path(
      ctx,
      "M178 -179 C204 -193 217 -161 220 -124 C224 -82 240 -32 215 -7 C202 8 185 -3 185 -26 C184 -73 193 -117 178 -179Z",
      gradient(ctx, 180, -140, 225, -10, ["#dfac79", "#c18a5e", "#875238"]),
    );
    for (let i = 0; i < 26; i++) {
      const y = -169 + i * 7;
      path(
        ctx,
        `M${225 + Math.sin(i) * 3} ${y} q8 5 5 12`,
        "transparent",
        "#d8a87755",
        1.3,
      );
    }
    ctx.restore();
  }
  path(
    ctx,
    "M-39 91 C-50 65 49 65 39 91 C32 107 12 117 0 118 C-12 117 -32 107 -39 91Z",
    gradient(ctx, -25, 72, 20, 114, ["#6b5859", "#251f24", "#100f14"]),
    "#2d2025",
    2,
  );
  ellipse(ctx, -12, 79, 15, 4, "#ffffff88", -0.12);
  path(
    ctx,
    "M0 117 L0 128 M0 128 Q-13 142 -24 130 M0 128 Q13 142 24 130",
    "transparent",
    "#453037",
    3,
  );
}

function ears(ctx: Context) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    path(
      ctx,
      "M100 -137 C110 -199 170 -290 210 -304 C234 -223 218 -163 179 -125Z",
      gradient(ctx, 90, -270, 217, -145, ["#73717b", "#33343e", "#14151c"]),
      "#443330",
      2,
    );
    path(
      ctx,
      "M126 -153 C137 -204 172 -256 197 -268 C207 -213 186 -176 169 -147Z",
      gradient(ctx, 123, -320, 175, -142, ["#d38597", "#f4c3c6", "#b4778b"]),
    );
    path(ctx, "M179 -234 Q149 -188 148 -166", "transparent", "#fff3e34d", 4);
    for (let i = 0; i < 19; i++) {
      const x = 96 + i * 4.8;
      const y = -139 + Math.sin(i * 1.8) * 4;
      path(
        ctx,
        `M${x} ${y + 8} q-4 -12 2 -21`,
        "transparent",
        "#8e899366",
        1.6,
      );
    }
    ctx.restore();
  }
}

function horns(ctx: Context) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    const gloss = ctx.createRadialGradient(108, -220, 6, 138, -250, 155);
    gloss.addColorStop(0, "#ff8b7a");
    gloss.addColorStop(0.2, "#f03a32");
    gloss.addColorStop(0.55, "#c4121a");
    gloss.addColorStop(0.85, "#8a0c14");
    gloss.addColorStop(1, "#4a060c");
    path(
      ctx,
      "M100 -420 C148 -355 175 -270 172 -180 C170 -145 155 -120 130 -122 C108 -124 96 -145 102 -172 C112 -235 112 -345 100 -420Z",
      gloss,
    );
    ellipse(ctx, 112, -210, 9, 32, "#ffffff28", -0.55);
    ctx.restore();
  }
}

function flower(
  ctx: Context,
  x: number,
  y: number,
  size: number,
  light: string,
  dark: string,
) {
  ctx.save();
  ctx.translate(x, y);
  for (let layer = 0; layer < 3; layer++) {
    const count = 8 - layer;
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.rotate((i / count) * Math.PI * 2 + layer * 0.43);
      const scale = 1 - layer * 0.24;
      ellipse(
        ctx,
        size * 0.31 * scale,
        0,
        size * 0.48 * scale,
        size * 0.24 * scale,
        gradient(ctx, 0, -size * 0.2, size * 0.6, size * 0.2, [
          dark,
          light,
          dark,
        ]),
      );
      ctx.restore();
    }
  }
  ellipse(ctx, 0, 0, size * 0.15, size * 0.15, "#be8837");
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ellipse(
      ctx,
      Math.cos(a) * size * 0.105,
      Math.sin(a) * size * 0.105,
      2,
      2,
      "#ffdf86",
    );
  }
  ctx.restore();
}

function flowers(ctx: Context) {
  path(ctx, "M-224 -148 Q0 -239 224 -148", "transparent", "#3f6646", 10);
  for (let i = 0; i < 15; i++) {
    const x = -221 + i * 31.5;
    const y = -175 - 30 * (1 - (x / 230) ** 2);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side * 0.7 + i * 0.1);
      path(
        ctx,
        "M0 0 Q10 -30 35 -20 Q30 2 0 0Z",
        gradient(ctx, 0, -25, 35, 4, ["#a2b87b", "#366748"]),
      );
      path(ctx, "M2 -1 L29 -18", "transparent", "#b9ca9766", 1);
      ctx.restore();
    }
  }
  const palette = [
    ["#fff2d9", "#d7b49b"],
    ["#fbd4dc", "#bd758b"],
    ["#e5d1f4", "#9c7eae"],
  ];
  for (let i = 0; i < 9; i++) {
    const x = -207 + i * 51.75;
    const y = -157 - 45 * (1 - (x / 230) ** 2);
    const [light, dark] = palette[i % 3];
    flower(ctx, x, y, i % 2 ? 41 : 52, light, dark);
  }
}

function shades(ctx: Context, sport: boolean) {
  const frame = gradient(ctx, 0, -58, 0, 64, [
    "#6e7985",
    "#111821",
    "#303b49",
    "#070d15",
  ]);
  path(
    ctx,
    "M-218 -16 L-257 -34 L-253 -45 L-204 -29 M218 -16 L257 -34 L253 -45 L204 -29",
    frame,
  );
  if (sport) {
    const outline =
      "M-229 -36 Q-218 -65 -179 -61 L-46 -48 Q0 -37 46 -48 L179 -61 Q218 -65 229 -36 L198 43 Q157 70 91 53 L42 32 L21 -5 Q0 -17 -21 -5 L-42 32 L-91 53 Q-157 70 -198 43Z";
    path(ctx, outline, frame, "#121d2a", 3);
    const lens = gradient(ctx, -85, -53, 55, 61, [
      "#a8f7ff",
      "#168dbe",
      "#28449c",
      "#392f78",
      "#21c5d9",
    ]);
    path(
      ctx,
      "M-214 -32 Q-207 -49 -180 -46 L-47 -34 Q0 -23 47 -34 L180 -46 Q207 -49 214 -32 L187 33 Q150 56 94 40 L51 23 L30 -15 Q0 -33 -30 -15 L-51 23 L-94 40 Q-150 56 -187 33Z",
      lens,
      "#b3eef055",
      1.5,
    );
    path(
      ctx,
      "M-201 -30 Q-111 -37 -43 -21 L-51 -6 Q-130 -23 -205 -17Z",
      "#d2ffff66",
    );
    path(ctx, "M43 -21 Q126 -38 202 -30 L196 -16 Q130 -25 50 -6Z", "#d2ffff55");
    path(
      ctx,
      "M-202 6 L-175 39 M-183 -17 L-143 44 M160 -36 L185 -4",
      "transparent",
      "#e7ffff22",
      8,
    );
    path(
      ctx,
      "M-218 -38 Q-201 -58 -180 -55 L-47 -42 Q0 -31 47 -42 L180 -55 Q201 -58 218 -38",
      "transparent",
      "#9aa9b7",
      2,
    );
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 228, -28, 9, 4, "#cdd7df", side * -0.45);
    }
  } else {
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 111, 0, 88, 70, frame);
      ellipse(
        ctx,
        side * 111,
        0,
        77,
        59,
        gradient(ctx, 0, -60, 0, 60, [
          "#9ca9b8",
          "#394452",
          "#121a2a",
          "#263144",
        ]),
      );
      path(
        ctx,
        `M${side * 111 - 55} -28 q55 -28 110 0`,
        "transparent",
        "#ffffff33",
        7,
      );
    }
    path(ctx, "M-25 -5 Q0 -26 25 -5", "transparent", "#b79c70", 7);
  }
}

function tiara(ctx: Context) {
  const gold = gradient(ctx, -170, -290, 180, -115, [
    "#9d6b27",
    "#ffe8a2",
    "#b48231",
    "#fff1b9",
    "#ad7429",
  ]);
  path(
    ctx,
    "M-217 -134 Q0 -185 217 -134 L211 -113 Q0 -158 -211 -113Z",
    gold,
    "#a47c38",
    1,
  );
  for (let i = -3; i <= 3; i++) {
    const x = i * 57;
    const base = -151 + Math.abs(i) * 4;
    const h = 151 - Math.abs(i) * 29;
    path(
      ctx,
      `M${x - 34} ${base} Q${x - 32} ${base - h * 0.64} ${x} ${base - h} Q${
        x + 32
      } ${base - h * 0.64} ${x + 34} ${base}`,
      "transparent",
      gold,
      7,
    );
    path(
      ctx,
      `M${x - 18} ${base - 8} Q${x} ${base - 31} ${x + 18} ${base - 8}`,
      "transparent",
      gold,
      3,
    );
    const y = base - h * 0.54;
    path(
      ctx,
      `M${x} ${y - 23} L${x + 15} ${y} L${x} ${y + 23} L${x - 15} ${y}Z`,
      gold,
    );
    path(
      ctx,
      `M${x} ${y - 19} L${x + 11} ${y} L${x} ${y + 19} L${x - 11} ${y}Z`,
      gradient(ctx, x - 10, y - 20, x + 10, y + 20, [
        "#eee9ff",
        "#9075c8",
        "#483070",
      ]),
    );
    path(ctx, `M${x} ${y - 19} L${x} ${y + 19} L${x - 11} ${y}Z`, "#ddd6ff77");
    ellipse(
      ctx,
      x,
      base - h,
      7,
      7,
      gradient(ctx, x - 4, base - h - 5, x + 5, base - h + 5, [
        "#fffef0",
        "#d5be8c",
      ]),
    );
  }
  for (let i = 0; i < 29; i++) {
    const x = -202 + i * 14.4;
    const y = -132 - 20 * (1 - (x / 210) ** 2);
    ellipse(ctx, x, y, 3.5, 3.5, "#fff6d6");
  }
  shine(ctx, -57, -215, 10);
  shine(ctx, 0, -302, 12);
  shine(ctx, 166, -168, 7);
}

function disguise(ctx: Context) {
  shades(ctx, false);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    path(
      ctx,
      "M0 121 C24 90 67 128 104 142 C128 150 146 131 136 115 C167 134 144 174 114 177 C69 182 44 142 0 146Z",
      gradient(ctx, 0, 100, 0, 179, ["#88604b", "#3b2624", "#1b171b"]),
      "#2b1e20",
      2,
    );
    for (let i = 0; i < 13; i++) {
      path(
        ctx,
        `M${9 + i * 2} ${119 + i * 1.2} Q72 ${122 + i * 3} 112 ${
          158 + i * 0.65
        } Q139 160 142 140`,
        "transparent",
        "#ae806b44",
        1,
      );
    }
    ctx.restore();
  }
}

function paint(ctx: Context, accessory: OverlayAccessory) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (accessory) {
    case "puppy":
      puppy(ctx);
      break;
    case "flower-crown":
      flowers(ctx);
      break;
    case "sport-shades":
      shades(ctx, true);
      break;
    case "cat-ears":
      ears(ctx);
      break;
    case "devil-horns":
      horns(ctx);
      break;
    case "tiara":
      tiara(ctx);
      break;
    case "disguise":
      disguise(ctx);
      break;
  }
}

// Render once per mounted document. The webcam loop only transforms/blits a sprite.
const sprites = new WeakMap<
  Document,
  Map<OverlayAccessory, HTMLCanvasElement>
>();
function sprite(doc: Document, accessory: OverlayAccessory) {
  let cache = sprites.get(doc);
  if (!cache) {
    cache = new Map();
    sprites.set(doc, cache);
  }
  const existing = cache.get(accessory);
  if (existing) {
    return existing;
  }
  const box = bounds[accessory];
  const canvas = doc.createElement("canvas");
  const resolution = 2;
  canvas.width = box.width * resolution;
  canvas.height = box.height * resolution;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.scale(resolution, resolution);
  ctx.translate(-box.x, -box.y);
  paint(ctx, accessory);
  cache.set(accessory, canvas);
  return canvas;
}

export function drawCameraAccessory(
  ctx: Context,
  accessory: OverlayAccessory,
  pose: { x: number; y: number; s: number; rz: number; ok: boolean },
  offset: { x: number; y: number; scale?: number },
) {
  if (!pose.ok) {
    return;
  }
  const { width, height } = ctx.canvas;
  const size = Math.max(24, pose.s * width);
  const box = bounds[accessory];
  const scale = (offset.scale ?? 1) * (size / 400);
  ctx.save();
  ctx.translate(
    (0.5 + 0.5 * pose.x) * width + offset.x,
    (0.5 - 0.5 * pose.y) * height - size * 0.26 + offset.y,
  );
  ctx.rotate(-pose.rz);
  ctx.scale(scale, scale);
  ctx.drawImage(
    sprite(ctx.canvas.ownerDocument, accessory),
    box.x,
    box.y,
    box.width,
    box.height,
  );
  ctx.restore();
}

function opaqueBox(canvas: HTMLCanvasElement): Bounds | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  let pixels: ImageData;
  try {
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
  const { data, width, height } = pixels;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 16) {
      continue;
    }
    const index = (i - 3) / 4;
    const x = index % width;
    const y = (index - x) / width;
    if (x < minX) {
      minX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
  }
  if (maxX < 0) {
    return null;
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function drawAccessoryPreview(
  canvas: HTMLCanvasElement,
  accessory: OverlayAccessory,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const texture = sprite(canvas.ownerDocument, accessory);
  const crop = opaqueBox(texture) ?? {
    x: 0,
    y: 0,
    width: texture.width,
    height: texture.height,
  };
  const scale = Math.min(
    canvas.width / crop.width,
    canvas.height / crop.height,
  );
  const width = crop.width * scale;
  const height = crop.height * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    texture,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  );
}
