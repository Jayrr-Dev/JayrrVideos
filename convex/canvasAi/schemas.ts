import { z } from "zod";

const colorSchema = z
  .string()
  .describe(
    'Palette name (black, grey, red, blue, green-light, blue-tint, ...) or hex like "#a5d8ff", or "transparent".',
  );

export const canvasFontNames = ["hand", "heading", "code", "clean"] as const;
export type CanvasFontName = typeof canvasFontNames[number];

const fontSchema = z
  .enum(canvasFontNames)
  .describe(
    "hand = Excalifont (default body), heading = Lilita One (titles/section headers), code = Comic Shanns (numbers, ids, technical), clean = Nunito (professional).",
  );

const textAlignSchema = z.enum(["left", "center", "right"]);
const verticalAlignSchema = z.enum(["top", "middle", "bottom"]);

const arrowheadSchema = z.enum([
  "none",
  "arrow",
  "triangle",
  "triangle_outline",
  "bar",
  "dot",
  "circle",
  "circle_outline",
  "diamond",
  "diamond_outline",
]);

const styleFields = {
  stroke: colorSchema.optional().describe("Outline color. Default black."),
  fill: colorSchema
    .optional()
    .describe(
      "Background color. Default transparent. Use *-light / *-tint names for readable pastel fills.",
    ),
  fillStyle: z.enum(["solid", "hachure", "cross-hatch", "zigzag"]).optional(),
  strokeWidth: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  roughness: z
    .union([z.literal(0), z.literal(1), z.literal(2)])
    .optional()
    .describe(
      "0 = clean architect lines, 1 = default sketchy, 2 = very rough.",
    ),
  opacity: z.number().min(0).max(100).optional(),
  group: z
    .string()
    .optional()
    .describe(
      "Elements sharing the same group key get grouped so they move together.",
    ),
};

const refField = z
  .string()
  .optional()
  .describe(
    'Short name that becomes the element id (e.g. "title", "scene_1"). Reuse it in later calls: arrows from/to, frame children, update/delete ids. Must be unique on the board.',
  );

const labelFields = {
  text: z.string().optional().describe("Label text. Use \\n for line breaks."),
  fontSize: z.number().optional().describe("Default 20. Headings 28-36."),
  font: fontSchema.optional(),
  textColor: colorSchema.optional().describe("Label color. Default black."),
  textAlign: textAlignSchema.optional().describe("Default left."),
  verticalAlign: verticalAlignSchema.optional().describe("Default top."),
};

const containerSchema = z.object({
  type: z.enum(["rectangle", "ellipse", "diamond"]),
  ref: refField,
  x: z.number(),
  y: z.number(),
  w: z.number().describe("Width. Labeled boxes: at least 160."),
  h: z
    .number()
    .describe("Height. Labeled boxes: at least 60. Grows to fit text."),
  rounded: z
    .boolean()
    .optional()
    .describe("Rounded corners (rectangles). Default true."),
  ...labelFields,
  ...styleFields,
});

const textSchema = z.object({
  type: z.literal("text"),
  ref: refField,
  x: z.number(),
  y: z.number(),
  text: z
    .string()
    .describe("Use \\n for line breaks. Size is measured automatically."),
  fontSize: z
    .number()
    .optional()
    .describe("Default 20. Titles 32-40, captions 14-16."),
  font: fontSchema.optional(),
  color: colorSchema.optional().describe("Text color. Default black."),
  textAlign: textAlignSchema.optional(),
  group: styleFields.group,
  opacity: styleFields.opacity,
});

const noteSchema = z.object({
  type: z.literal("note"),
  ref: refField,
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string(),
  fontSize: z.number().optional(),
  fill: colorSchema.optional().describe("Sticky color. Default yellow-light."),
  group: styleFields.group,
});

const pointSchema = z.tuple([z.number(), z.number()]);

const arrowSchema = z.object({
  type: z.literal("arrow"),
  ref: refField,
  from: z
    .string()
    .optional()
    .describe(
      "ref (this or an earlier call) or existing element id the arrow starts at. Anchor point is computed for you.",
    ),
  to: z
    .string()
    .optional()
    .describe(
      "ref (this or an earlier call) or existing element id the arrow points to. Anchor point is computed for you.",
    ),
  route: z
    .enum(["straight", "elbow", "curved"])
    .optional()
    .describe(
      "elbow = orthogonal segments (default for flows), straight, or curved.",
    ),
  x: z.number().optional().describe("Only when from/to are omitted."),
  y: z.number().optional().describe("Only when from/to are omitted."),
  points: z
    .array(pointSchema)
    .min(2)
    .optional()
    .describe(
      "Only when from/to are omitted. Relative to x,y; first point is [0,0].",
    ),
  startArrowhead: arrowheadSchema.optional().describe("Default none."),
  endArrowhead: arrowheadSchema.optional().describe("Default arrow."),
  label: z
    .string()
    .optional()
    .describe("Short text on the arrow (under 20 chars)."),
  labelFontSize: z.number().optional(),
  stroke: styleFields.stroke,
  strokeWidth: styleFields.strokeWidth,
  strokeStyle: styleFields.strokeStyle,
  roughness: styleFields.roughness,
  opacity: styleFields.opacity,
  group: styleFields.group,
});

const lineSchema = z.object({
  type: z.literal("line"),
  ref: refField,
  x: z.number(),
  y: z.number(),
  points: z
    .array(pointSchema)
    .min(2)
    .describe(
      "Relative to x,y; first point is [0,0]. Use for axes, dividers, timelines, chart lines.",
    ),
  stroke: styleFields.stroke,
  strokeWidth: styleFields.strokeWidth,
  strokeStyle: styleFields.strokeStyle,
  roughness: styleFields.roughness,
  opacity: styleFields.opacity,
  group: styleFields.group,
});

const frameSchema = z.object({
  type: z.literal("frame"),
  ref: refField,
  name: z.string().describe("Frame title shown above the frame."),
  children: z
    .array(z.string())
    .min(1)
    .describe(
      "refs (this or earlier calls) or existing ids. Frame bounds are computed from children plus padding.",
    ),
  padding: z
    .number()
    .optional()
    .describe("Padding around children. Default 24."),
});

export const createElementSchema = z.discriminatedUnion("type", [
  containerSchema,
  textSchema,
  noteSchema,
  arrowSchema,
  lineSchema,
  frameSchema,
]);

export const updateElementSchema = z.object({
  id: z
    .string()
    .describe(
      "Element id from the canvas snapshot, or the ref you drew it with.",
    ),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z
    .number()
    .optional()
    .describe(
      "New width. Required when the new text is longer than the placeholder. Category labels at least 280. Labeled boxes at least 280.",
    ),
  h: z
    .number()
    .optional()
    .describe("New height. Grow with the text. Labeled boxes at least 80."),
  text: z
    .string()
    .optional()
    .describe(
      "New label. Keep it short enough to fit: under 22 characters per line. Abbreviate rather than clip.",
    ),
  fontSize: z.number().optional(),
  stroke: styleFields.stroke,
  fill: styleFields.fill,
  fillStyle: styleFields.fillStyle,
  strokeWidth: styleFields.strokeWidth,
  strokeStyle: styleFields.strokeStyle,
  roughness: styleFields.roughness,
  opacity: styleFields.opacity,
});

export type CreateElementInput = z.infer<typeof createElementSchema>;
export type UpdateElementInput = z.infer<typeof updateElementSchema>;
export type CanvasContainerInput = z.infer<typeof containerSchema>;
export type CanvasTextInput = z.infer<typeof textSchema>;
export type CanvasNoteInput = z.infer<typeof noteSchema>;
export type CanvasArrowInput = z.infer<typeof arrowSchema>;
export type CanvasLineInput = z.infer<typeof lineSchema>;
export type CanvasFrameInput = z.infer<typeof frameSchema>;
