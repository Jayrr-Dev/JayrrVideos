import { mkdirSync, writeFileSync } from "node:fs";

const Y = "#F5D000";
const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#111" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;

const icons = {
  selection: `<path fill="${Y}" d="M6.2 5.4l4.1 13.2c.2.5.9.4 1-.1l2.1-5.1 5.2-1.8c.5-.2.4-.9-.1-1L6.2 5.4z"/><path d="M6.2 5.4l4.1 13.2c.2.5.9.4 1-.1l2.1-5.1 5.2-1.8c.5-.2.4-.9-.1-1L6.2 5.4z"/><path d="M13.4 13.2l4.8 5.1"/>`,
  rectangle: `<path fill="${Y}" d="M4.2 5.1h15.2c.9.1 1.5.8 1.4 1.7l-.4 11.6c0 .9-.8 1.5-1.7 1.4H5.1c-.9 0-1.5-.8-1.4-1.7L4.2 5.1z"/><path d="M4.2 5.1h15.2c.9.1 1.5.8 1.4 1.7l-.4 11.6c0 .9-.8 1.5-1.7 1.4H5.1c-.9 0-1.5-.8-1.4-1.7L4.2 5.1z"/>`,
  diamond: `<path fill="${Y}" d="M12.1 3.4l8.2 8.1c.4.4.4 1.1 0 1.5l-8.3 7.9c-.4.4-1.1.4-1.5 0L2.6 13.1c-.4-.4-.4-1.1 0-1.5l8-8.2c.4-.4 1.1-.4 1.5 0z"/><path d="M12.1 3.4l8.2 8.1c.4.4.4 1.1 0 1.5l-8.3 7.9c-.4.4-1.1.4-1.5 0L2.6 13.1c-.4-.4-.4-1.1 0-1.5l8-8.2c.4-.4 1.1-.4 1.5 0z"/>`,
  ellipse: `<ellipse cx="12.1" cy="12" rx="8.6" ry="8.2" fill="${Y}"/><ellipse cx="12.1" cy="12" rx="8.6" ry="8.2"/>`,
  arrow: `<path d="M4.2 12.4h14.4"/><path fill="${Y}" d="M13.2 7.1l6.4 5.2-6.6 5.6z"/><path d="M13.2 7.1l6.4 5.2-6.6 5.6"/>`,
  line: `<path d="M3.8 14.2c3.4-2.8 6.2-4.6 8.7-5.2 2.8-.7 5.2.2 8.1 2.6"/>`,
  pencil: `<path fill="${Y}" d="M15.2 3.8l4.6 4.4-9.8 10.2-5 1.1 1.4-4.8z"/><path d="M15.2 3.8l4.6 4.4-9.8 10.2-5 1.1 1.4-4.8z"/><path d="M14.6 4.6l4.4 4.2"/>`,
  text: `<path fill="${Y}" d="M5.2 6.1h13.4v2.2H5.2z"/><path d="M5.2 6.1h13.4"/><path d="M12.1 6.1v13.2"/><path d="M8.4 19.4h7.4"/>`,
  image: `<path fill="${Y}" d="M4.1 5.2h15.4c.8 0 1.4.7 1.3 1.5v11.6c.1.8-.6 1.5-1.4 1.5H4.3c-.8 0-1.4-.7-1.3-1.5V6.6c0-.8.7-1.4 1.1-1.4z"/><path d="M4.1 5.2h15.4c.8 0 1.4.7 1.3 1.5v11.6c.1.8-.6 1.5-1.4 1.5H4.3c-.8 0-1.4-.7-1.3-1.5V6.6c0-.8.7-1.4 1.1-1.4z"/><circle cx="9.1" cy="9.2" r="1.5"/><path d="M4.4 16.8l4.2-3.6 3.1 2.6 3.6-4.2 4.4 5.1"/>`,
  eraser: `<path fill="${Y}" d="M14.8 4.6l5.1 5.1c.5.5.5 1.3 0 1.8L11.2 20H5.4l-1.6-1.7c-.5-.5-.5-1.3 0-1.8L14.8 4.6z"/><path d="M14.8 4.6l5.1 5.1c.5.5.5 1.3 0 1.8L11.2 20H5.4l-1.6-1.7c-.5-.5-.5-1.3 0-1.8L14.8 4.6z"/><path d="M8.4 18.8h11.2"/>`,
  play: `<rect x="3.2" y="4" width="17.6" height="16.2" rx="4" fill="${Y}"/><path fill="#111" d="M9.4 8.2l8 3.9-8.1 4.4z"/>`,
};

const out = new URL("../public/icons/jayrr/", import.meta.url);
mkdirSync(new URL("../artifacts/", import.meta.url), { recursive: true });
mkdirSync(out, { recursive: true });
for (const [name, body] of Object.entries(icons)) {
  writeFileSync(new URL(`${name}.svg`, out), wrap(body));
}

const names = Object.keys(icons);
writeFileSync(
  new URL("../artifacts/jayrr-icons.html", import.meta.url),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>JayrrVideos doodle icons</title><style>body{font:16px system-ui;margin:40px;background:#fff;color:#111}h1{font-family:Georgia,serif}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px}article{border:2px solid #111;border-radius:18px;text-align:center;padding:20px 10px}img{width:64px;height:64px}small{display:block;margin-top:12px}</style><h1>JayrrVideos doodle icons</h1><p>Thick black stroke · yellow fill · original doodles (Yobi-inspired, not copied)</p><div class="grid">${names
    .map(
      (name) =>
        `<article><img src="../public/icons/jayrr/${name}.svg" alt="${name}"><small>${name}</small></article>`,
    )
    .join("")}</div></html>`,
);
console.log(`Created ${names.length} SVG icons.`);
