/**
 * Heuristic: pasted text looks like Markdown (not plain prose / TSV / mermaid).
 * Strong signals alone are enough; otherwise need several weaker ones.
 */
export const isLikelyMarkdown = (text: string): boolean => {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed || trimmed.length < 8) {
    return false;
  }

  // Tab-separated spreadsheets → chart paste, not MD
  const lines = trimmed.split(/\r?\n/);
  const tabLines = lines.filter((line) => line.includes("\t")).length;
  if (tabLines >= 2 && tabLines / Math.max(lines.length, 1) > 0.4) {
    return false;
  }

  // Mermaid diagrams should stay on the mermaid path
  if (isMaybeMermaidDefinition(trimmed)) {
    return false;
  }

  // Pure URL list → embeddables
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (
    nonEmpty.length > 0 &&
    nonEmpty.every((line) => /^https?:\/\/\S+$/i.test(line))
  ) {
    return false;
  }

  let score = 0;

  if (/^#{1,6}\s+\S/m.test(trimmed)) {
    score += 3;
  }
  if (/^```[\w-]*\s*$/m.test(trimmed) && /```/.test(trimmed.slice(3))) {
    score += 3;
  }
  if (/^\|(.+\|)+\s*$/m.test(trimmed) && /^\s*\|?\s*:?-{3,}/m.test(trimmed)) {
    score += 3;
  }
  if (/^\s*[-*+]\s+\[[ xX]\]\s+/m.test(trimmed)) {
    score += 2;
  }
  if (/^\s{0,3}>\s+\S/m.test(trimmed)) {
    score += 2;
  }
  if (/!\[[^\]]*\]\([^)\s]+\)/.test(trimmed)) {
    score += 2;
  }
  if (/\[[^\]]+\]\([^)\s]+\)/.test(trimmed)) {
    score += 1;
  }
  if (/^\s{0,3}([-*+]|\d+\.)\s+\S/m.test(trimmed)) {
    score += 1;
  }
  if (/(\*\*[^*\n]+\*\*|__[^_\n]+__)/.test(trimmed)) {
    score += 1;
  }
  if (/(`[^`\n]+`)/.test(trimmed)) {
    score += 1;
  }
  if (/^---\s*$/m.test(trimmed) || /^\*\*\*\s*$/m.test(trimmed)) {
    score += 1;
  }

  // Front matter
  if (/^---\s*\n[\s\S]*?\n---\s*\n/.test(trimmed)) {
    score += 2;
  }

  return score >= 3;
};

/** Same chart-type sniff as packages/excalidraw/mermaid.ts (not exported). */
const isMaybeMermaidDefinition = (text: string) => {
  const chartTypes = [
    "flowchart",
    "graph",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "journey",
    "gantt",
    "pie",
    "quadrantChart",
    "requirementDiagram",
    "gitGraph",
    "C4Context",
    "mindmap",
    "timeline",
    "zenuml",
    "sankey",
    "xychart",
    "block",
  ];
  const re = new RegExp(
    `^(?:%%{.*?}%%[\\s\\n]*)?\\b(?:${chartTypes
      .map((x) => `\\s*${x}(-beta)?`)
      .join("|")})\\b`,
  );
  return re.test(text.trim());
};

export const isMarkdownFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  if (
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".mdx")
  ) {
    return true;
  }
  const type = (file.type || "").toLowerCase();
  return (
    type === "text/markdown" ||
    type === "text/x-markdown" ||
    type === "text/mdx"
  );
};
