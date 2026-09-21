export type CreateEditorClipInput = {
  label: string;
  durationMs: number;
  html: string;
  css?: string;
  width?: number;
  height?: number;
};

const readFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

export const parseCreateEditorClipInput = (
  value: unknown,
): CreateEditorClipInput | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const label = Reflect.get(value, "label");
  const durationMs = readFiniteNumber(Reflect.get(value, "durationMs"));
  const html = Reflect.get(value, "html");
  if (typeof label !== "string" || !label.trim()) {
    return null;
  }
  if (durationMs == null || durationMs < 1) {
    return null;
  }
  if (typeof html !== "string" || !html.trim()) {
    return null;
  }
  const css = Reflect.get(value, "css");
  const width = readFiniteNumber(Reflect.get(value, "width"));
  const height = readFiniteNumber(Reflect.get(value, "height"));
  return {
    label,
    durationMs: Math.round(durationMs),
    html,
    ...(typeof css === "string" && css.trim() ? { css } : {}),
    ...(width != null && width > 0 ? { width: Math.round(width) } : {}),
    ...(height != null && height > 0 ? { height: Math.round(height) } : {}),
  };
};

export const isCreateEditorClipInput = (
  value: unknown,
): value is CreateEditorClipInput => parseCreateEditorClipInput(value) != null;
