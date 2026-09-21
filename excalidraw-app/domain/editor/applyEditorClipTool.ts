export type CreateEditorClipInput = {
  label: string;
  durationMs: number;
  html: string;
  css?: string;
  width?: number;
  height?: number;
};

export const isCreateEditorClipInput = (
  value: unknown,
): value is CreateEditorClipInput => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const label = Reflect.get(value, "label");
  const durationMs = Reflect.get(value, "durationMs");
  const html = Reflect.get(value, "html");
  if (typeof label !== "string" || !label.trim()) {
    return false;
  }
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return false;
  }
  if (typeof html !== "string" || !html.trim()) {
    return false;
  }
  return true;
};
