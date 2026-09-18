import fs from "node:fs";

// Original small-scale pen drawings. Width/dash/edge samples remain literal.
const Y = "#f4ce19";
// Keep the pen character, but give the UI-sized marks more presence.
const p = (d, fill = "none", strokeWidth = 1.4) => ({
  d,
  fill,
  strokeWidth: Number((strokeWidth * 1.5).toFixed(2)),
});
const accent = (d) => ({ d, fill: Y, stroke: "none" });
const dot = (x, y) => p(`M${x} ${y}h.05`, "none", 2.3);
const ring = "M12 3C5 2 2 8 3 14S10 23 16 20 24 10 19 5Q16 2 12 3";
const box = "M5 10 20 9.5 19.5 21 4.5 20.5Z";
const key =
  "M12 13C9 12 9 16 11 16L10.5 18.5 13.5 18.5 13 16C15 14 14 13 12 13Z";
const drawings = {
  lock: [
    accent("M7 11 10 11 9 20 6 20Z"),
    p(box),
    p("M8 10 8 6C8 1 17 1 17 6L17 9.5"),
    p(key, "currentColor", 0.6),
  ],
  unlock: [
    accent("M7 11 10 11 9 20 6 20Z"),
    p(box),
    p("M8 10 8 6C8 1 17 1 17 6"),
    p(key, "currentColor", 0.6),
  ],
  hand: [
    accent("M9 13Q14 10 19 13L18 19 11 21 8 17Z"),
    p(
      "M8 13 7 6Q7 3 9 4L11 11 10 3Q11 0 13 3L14 11 14 4Q16 2 17 5L17 12 18 8Q20 6 21 9L20 17Q19 22 13 22 9 22 7 18L3 13Q2 10 4 11Z",
    ),
    p("M11 15Q14 13 17 15M12 18 15 18", "none", 0.8),
  ],
  help: [
    accent("M14 3C22 4 24 16 15 20L12 18C19 16 20 7 14 3"),
    p(ring),
    p("M8 8C8 4 16 5 16 9Q16 11 12 12L12 14", "none", 1.9),
    dot(12, 17),
  ],
  menu: [
    accent("M4 10 20 9 20 13 4 14Z"),
    p("M4 5Q12 6 20 4M4 11Q12 10 20 11M4 18Q11 16 20 18", "none", 2),
    p("M5 21 14 20", "none", 0.65),
  ],
  library: [
    accent("M13 5 19 4 20 17 13 18Z"),
    p("M3 5Q8 3 12 6Q17 3 21 4L20 20Q16 18 12 21Q7 18 3 20Z"),
    p("M12 6 12 21M6 8 9 8M6 11 9 11M15 8 18 7M15 11 18 10", "none", 0.8),
  ],
  sidebar: [
    accent("M15 5 20 4 20 20 15 19Z"),
    p("M3 4Q12 5 21 3L20 21 4 20Z"),
    p("M14 5 14 20M17 8 19 7M17 11 19 10", "none", 0.9),
  ],
  chat: [
    accent("M4 6 8 5 7 14 4 14Z"),
    p("M4 5Q11 2 18 5C24 8 20 16 14 17L7 17 3 21 4 14Q1 9 4 5Z"),
    p("M7 8 16 8M7 11 14 11", "none", 0.8),
  ],
  presentation: [
    accent("M5 13 10 9 13 12 19 6 19 15 5 16Z"),
    p("M3 4 21 3 20 17 4 18ZM12 18 12 22M8 22 17 22"),
    p("M6 12 10 8 13 11 18 6", "none", 1),
  ],
  pin: [
    accent("M9 4 15 3 14 10 18 14 6 15 10 10Z"),
    p("M8 3 17 3M10 4 9 10 5 14 19 14 15 10 15 4M12 15 11 22"),
  ],
  close: [p("M6 5Q12 11 19 19M18 5Q10 13 5 19", "none", 1.9)],
  search: [
    accent("M12 4Q21 11 12 16L10 14Q16 11 12 4"),
    p("M10 3C1 2 1 17 10 17S21 4 10 3ZM16 16 22 22"),
    p("M5 9Q5 6 8 5", "none", 0.7),
  ],
  folder: [
    accent("M4 12 21 10 18 20 3 20Z"),
    p("M3 20 3 5 9 4 12 7 20 6 20 10M3 20 6 11 22 10 19 20Z"),
    p("M7 16 9 13", "none", 0.7),
  ],
  download: [
    accent("M10 3 14 3 13 12 17 11 12 17 7 12 11 12Z"),
    p("M12 3Q11 8 12 16M7 11 12 17 18 11M3 16 4 21 21 20 21 16"),
    p("M7 23 17 22", "none", 0.65),
  ],
  exportImage: [
    accent("M8 7C8 3 14 4 13 8S7 11 8 7"),
    p(
      "M19 11 20 3 3 4 4 20 11 20M5 16 9 11 13 15M14 18 22 18M19 14 23 18 19 22",
    ),
  ],
  users: [
    accent("M14 5C13 1 20 2 20 6S14 9 14 5"),
    p(
      "M7 3C2 3 3 10 7 10S12 3 7 3ZM2 21 3 15Q7 11 12 15L13 21M15 3C22 1 24 12 16 10M16 14Q21 13 22 20",
    ),
    p("M5 17 5 20", "none", 0.7),
  ],
  bolt: [p("M14 2 4 14 11 13 9 22 21 9 13 10Z", Y, 1.2)],
  trash: [
    accent("M7 8 10 8 10 20 7 19Z"),
    p("M5 7 20 6M7 8 8 21 18 20 19 7M9 5 9 2 16 2 16 5"),
    p("M11 10 12 18M15 9 15 18", "none", 0.75),
  ],
  sun: [
    accent("M8 8C14 3 21 13 14 17S3 12 8 8"),
    p(
      "M12 6C4 5 5 18 12 18S21 7 12 6ZM12 1 12 3M20 4 18 6M21 12 23 12M18 19 20 21M12 21 12 23M4 19 6 17M1 12 3 12M4 4 6 6",
    ),
  ],
  moon: [
    p("M15 3C2 0 0 18 11 21Q19 23 22 14C14 19 7 9 15 3Z", Y),
    p("M18 3 18 7M16 5 20 5", "none", 0.9),
  ],
  desktop: [
    accent("M4 15 20 14 20 18 4 18Z"),
    p("M3 4 21 3 20 18 4 18ZM12 18 12 22M7 22 17 22"),
    p("M6 7 10 6", "none", 0.7),
  ],
  eye: [
    accent("M12 7C21 6 19 17 12 17Z"),
    p("M2 12Q11 0 22 11Q13 24 2 12Z"),
    p("M12 7C6 6 6 17 12 17S19 7 12 7Z"),
    p("M12 10C9 9 9 14 12 14S15 10 12 10Z", "currentColor", 0.5),
  ],
  settings: [
    p("M3 5 21 4M3 12 21 12M3 20 21 19", "none", 1),
    p("M8 2 12 2 12 8 8 8Z", Y, 1),
    p("M14 9 18 9 18 15 14 15Z", "var(--island-bg-color, white)", 1),
    p("M6 16 10 16 10 22 6 22Z", Y, 1),
  ],
  brain: [
    accent("M13 3Q20 2 19 7C25 9 22 16 19 17Q19 22 13 21Z"),
    p(
      "M11 4C8 1 4 4 5 7C0 7 1 14 4 15C2 20 8 23 11 20ZM13 4C16 1 21 4 19 7C24 8 23 14 20 15C22 20 16 23 13 20Z",
    ),
    p("M5 7 8 9 7 12M4 15 8 14M19 7 16 9 17 12M20 15 16 14", "none", 0.8),
  ],
  mermaid: [
    accent("M10 13 14 13 14 21 10 21Z"),
    p("M3 3 8 4 12 10 16 4 21 3 20 8 15 14 14 21 10 21 9 14 4 9Z"),
    p("M6 6 12 13 18 6M12 13 12 19", "none", 0.8),
  ],
  magic: [
    p("M4 20 16 7 20 10 8 23Z", Y),
    p(
      "M13 10 17 14M5 2 5 8M2 5 8 5M18 1 18 4M21 3 23 3M21 18 21 22M19 20 23 20",
      "none",
      1,
    ),
  ],
  plus: [p("M12 4Q11 12 12 21M4 12Q12 11 21 12", "none", 2)],
  github: [
    accent("M10 15 14 15 15 22 9 22Z"),
    p(
      "M8 22 8 18Q3 19 2 15M8 18 8 16C1 15 2 9 4 7L4 2 9 5Q12 4 15 5L20 2 20 7C24 12 19 16 15 16Q17 18 16 22",
    ),
    p("M7 10 7 12M17 10 17 12", "none", 1.6),
  ],
  thin: [p("M4 12Q12 11.5 20 12", "none", 1)],
  bold: [p("M4 12Q12 11.4 20 12", "none", 2.5)],
  heavy: [p("M4 12Q12 11.3 20 12", "none", 4)],
  solid: [p("M3 12Q12 11.5 21 12", "none", 1.7)],
  dashed: [p("M3 12 7 11.8M10 11.8 14 12M17 12 21 11.8", "none", 1.7)],
  dotted: [
    dot(3, 12),
    dot(7.5, 11.8),
    dot(12, 12),
    dot(16.5, 11.8),
    dot(21, 12),
  ],
  neat: [p("M3 15 11 9 13 14 21 9", "none", 1.2)],
  sketch: [
    p("M3 15Q8 10 12 9L12 15 21 10M4 16 11 11 13 16 20 12", "none", 1.1),
  ],
  rough: [
    p(
      "M2 14 12 8 10 16 21 9M3 17 11 10 14 16 20 12M5 13 12 11 15 14 20 10",
      "none",
      1.2,
    ),
  ],
  sharp: [
    accent("M3 3 12 3 12 6 6 6 6 12 3 12Z"),
    p("M4 12 4 4 12 4"),
    p(
      "M16 4h.1M20 4h.1M20 8h.1M20 12h.1M20 16h.1M20 20h.1M16 20h.1M12 20h.1M8 20h.1M4 20h.1M4 16h.1",
      "none",
      1.3,
    ),
  ],
  round: [
    accent("M3 12Q2 2 12 3L12 6Q6 5 6 12Z"),
    p("M4 12Q3 3 12 4"),
    p(
      "M16 4h.1M20 4h.1M20 8h.1M20 12h.1M20 16h.1M20 20h.1M16 20h.1M12 20h.1M8 20h.1M4 20h.1M4 16h.1",
      "none",
      1.3,
    ),
  ],
  forward: [
    accent("M10 8 14 8 14 20 10 20Z"),
    p("M12 21 12 5M7 10 12 5 18 10"),
  ],
  backward: [
    accent("M10 4 14 4 14 17 10 17Z"),
    p("M12 3 12 19M7 14 12 19 18 14"),
  ],
  front: [
    accent("M10 11 14 11 14 21 10 21Z"),
    p("M12 21 12 9M7 14 12 9 18 14M4 4Q12 3 21 4"),
  ],
  back: [
    accent("M10 3 14 3 14 13 10 13Z"),
    p("M12 3 12 15M7 10 12 15 18 10M4 21Q12 20 21 21"),
  ],
  timeline: [
    accent("M8 11 16 10.5 15.5 14.2 8 14.5Z"),
    p("M3 12 21 12"),
    p("M6.5 8.5 6.5 15.5M12 7 12 17M17.5 8.5 17.5 15.5"),
  ],
};
const moduleText = `// Generated by scripts/generate-handdrawn-ui.mjs. Edit the source drawings there.\nimport React from "react";\n\nconst drawings = ${JSON.stringify(
  drawings,
  null,
  2,
)};\n\nexport const handdrawnUIIcon = (name: keyof typeof drawings) => (\n  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" role="img">\n    {drawings[name].map((props, index) => <path key={index} {...props} />)}\n  </svg>\n);\n`;
fs.writeFileSync(
  "packages/excalidraw/components/handdrawnUIIcons.tsx",
  moduleText,
);
fs.mkdirSync("public/icons/jayrr-handdrawn-ui", { recursive: true });
for (const [name, paths] of Object.entries(drawings)) {
  const body = paths
    .map(
      (props) =>
        "<path " +
        Object.entries(props)
          .map(
            ([key, value]) =>
              `${key === "strokeWidth" ? "stroke-width" : key}="${value}"`,
          )
          .join(" ") +
        "/>",
    )
    .join("");
  fs.writeFileSync(
    `public/icons/jayrr-handdrawn-ui/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#20211e" color="#20211e" stroke-linecap="round" stroke-linejoin="round"><title>${name}</title>${body}</svg>`,
  );
}
console.log(`Generated ${Object.keys(drawings).length} UI drawings.`);
