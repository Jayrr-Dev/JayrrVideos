import fs from 'node:fs';
import path from 'node:path';

// Deliberately drawn paths: no random jitter, filters, fonts or raster content.
const ink = '#20211e', yellow = '#f4ce19';
const p = (d, fill='none', w=2.5) => `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${Number((w * 1.5).toFixed(2))}" stroke-linecap="round" stroke-linejoin="round"/>`;
const y = d => `<path d="${d}" fill="${yellow}"/>`;
const icons = {
selection: y('M33 24 L70 53 51 57 62 78 51 84 40 62 27 75Z') + p('M28 18 Q43 32 69 51 L49 55 Q55 65 60 78 L50 83 39 61 26 73 Q29 47 28 18Z', 'white', 3) + y('M32 28 L57 49 44 51 53 75 50 77 38 55 31 64Z') + p('M15 21 11 14 M23 12 22 6 M38 15 43 9 M12 34 6 34', 'none', 1.8),
rectangle: y('M18 23 80 20 81 31 18 34Z') + p('M15 21 Q44 23 81 19 L83 75 Q56 74 16 78 Q18 52 15 21Z', 'none', 3) + p('M21 35 Q48 33 77 34 M23 40 24 70 M30 42 31 69 M37 42 38 70', 'none', 1.3) + p('M11 82 Q42 80 68 81 M76 81 89 80', 'none', 1.6),
diamond: y('M48 15 62 34 45 83 34 58Z') + p('M48 12 Q63 33 84 48 Q65 65 47 88 Q29 65 13 48 Q29 34 48 12Z', 'none', 2.9) + p('M17 47 78 48 M48 16 35 47 47 85 62 48 48 16 M30 31 65 31', 'none', 1.6) + p('M73 19 78 13 M82 29 89 26', 'none', 1.5),
ellipse: y('M65 20 C89 36 79 74 54 81 C75 65 72 39 57 23Z') + p('M49 18 C24 15 13 34 16 54 C18 76 35 85 54 81 C77 78 87 58 80 38 C75 24 66 18 52 18', 'none', 3) + p('M23 42 C22 30 32 23 42 23 M23 48 23 55 M63 72 75 55 M67 62 75 47 M70 49 73 41', 'none', 1.3),
arrow: y('M17 43 62 40 58 24 89 48 62 73 64 57 16 60Z') + p('M12 40 Q36 42 60 39 L58 22 Q74 36 89 48 L60 77 61 59 Q36 57 12 61Z', 'white', 2.8) + y('M18 47 67 46 65 34 80 48 66 63 68 53 18 55Z') + p('M16 67 31 65 M15 72 26 70 M44 47 65 47', 'none', 1.3),
line: p('M17 74 Q35 57 49 46 T81 19', 'none', 4.3) + p('M20 79 Q40 60 52 52', 'none', 1.2) + p('M12 71 19 67 24 74 18 81Z', yellow, 2.1) + p('M76 18 82 13 88 20 81 26Z', ink, 2) + p('M62 17 62 10 M77 7 78 3 M89 36 96 36', 'none', 1.6),
pencil: y('M33 27 49 21 68 72 62 89 49 79Z') + p('M29 24 Q35 15 46 19 L67 72 63 91 49 79Z', yellow, 2.7) + p('M29 24 Q39 28 47 20 M32 31 Q42 34 50 26 M49 79 52 70 58 74 62 68 67 72 M52 36 62 63 M39 38 50 66 M44 37 55 65', 'none', 1.5) + p('M58 84 63 91 65 81Z', ink, 1.6) + p('M18 36 12 31 M19 23 10 21 M23 13 19 7', 'none', 1.5),
text: p('M17 20 Q46 23 83 17 L81 35 73 36 72 29 57 30 Q55 54 58 77 L67 78 67 84 36 86 35 80 44 78 44 31 28 32 26 39 18 38Z', ink, 2) + y('M47 31 53 30 52 77 48 78Z') + p('M21 14 Q50 17 78 11 M72 81 78 81', 'none', 1.3),
image: p('M15 22 Q40 24 83 19 L80 80 Q46 77 16 83Z', 'white', 2.9) + p('M22 30 75 27 74 69 24 72Z', 'none', 1.7) + y('M47 39 C48 29 62 28 65 37 C69 50 48 52 47 39Z') + p('M50 36 C54 29 64 35 62 42 C59 49 48 46 50 36Z', 'none', 1.7) + p('M25 65 37 48 48 61 56 53 73 68', ink, 2) + p('M20 86 57 83 M64 83 78 85', 'none', 1.2),
eraser: p('M18 58 49 19 Q53 14 58 18 L84 39 Q88 43 83 49 L53 83 43 84Z', 'white', 2.7) + y('M21 58 36 40 67 64 53 81 44 81Z') + p('M35 37 69 63 M20 58 48 80 81 44 M48 80 47 71', 'none', 1.7) + p('M64 83 84 84 M73 76 80 77 M27 85 31 88 M18 81 22 82 M10 89 15 90', 'none', 1.8),
play: p('M13 29 Q12 21 22 22 Q48 18 79 23 Q86 24 86 33 L84 72 Q84 80 74 79 L22 81 Q13 81 14 71Z', 'white', 3) + p('M20 31 Q44 26 78 31 L77 70 21 73Z', 'none', 1.5) + y('M37 34 Q54 42 67 50 L39 68Z') + p('M40 36 Q54 43 64 51 Q54 57 40 64Z', ink, 2.2) + p('M19 87 42 85 M76 14 81 8 M88 21 94 17', 'none', 1.5),
idea: y('M29 24 C44 5 72 19 75 39 C77 52 63 64 59 70 L42 68 C40 57 16 44 29 24Z') + p('M43 69 C42 57 25 53 25 36 C24 8 66 9 73 31 C80 50 62 58 59 71Z', 'none', 2.8) + p('M45 65 C39 45 35 32 42 30 C51 28 52 47 45 50 C40 47 54 23 59 30 C67 38 53 53 50 65 M42 70 61 72 59 78 43 76 44 82 56 84 54 89 48 90 45 86', 'none', 2) + p('M14 31 7 29 M20 17 14 11 M43 7 42 2 M70 16 76 9 M83 32 92 29 M80 52 86 56', 'none', 1.7),
};
const dir = path.resolve('public/icons/jayrr-handdrawn');
// Keep the app's explicit path strokes in sync with these downloadable SVGs.
// Parent SVG stroke props cannot override a path's own stroke-width.
const appExports = {
  SelectionIcon: 'selection', RectangleIcon: 'rectangle', DiamondIcon: 'diamond',
  EllipseIcon: 'ellipse', ArrowIcon: 'arrow', LineIcon: 'line',
  FreedrawIcon: 'pencil', TextIcon: 'text', ImageIcon: 'image',
  EraserIcon: 'eraser', playerPlayIcon: 'play',
};
const appIconsPath = path.resolve('packages/excalidraw/components/icons.tsx');
let appIcons = fs.readFileSync(appIconsPath, 'utf8');
for (const [exportName, assetName] of Object.entries(appExports)) {
  const body = icons[assetName]
    .replaceAll(ink, 'currentColor')
    .replaceAll('fill="white"', 'fill="var(--island-bg-color, white)"')
    .replaceAll('stroke-width', 'strokeWidth')
    .replaceAll('stroke-linecap', 'strokeLinecap')
    .replaceAll('stroke-linejoin', 'strokeLinejoin');
  const pattern = new RegExp(`export const ${exportName} = createIcon\\([\\s\\S]*?\\r?\\n\\);`);
  if (!pattern.test(appIcons)) throw new Error(`Missing app icon: ${exportName}`);
  appIcons = appIcons.replace(pattern, () =>
    `export const ${exportName} = createIcon(\n  <g>${body}</g>,\n  handdrawnToolIconProps,\n);`);
}
fs.writeFileSync(appIconsPath, appIcons);
fs.mkdirSync(dir,{recursive:true});
const svg = (name, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" role="img" aria-labelledby="title"><title id="title">${name} — hand-drawn icon</title>${body}</svg>`;
for(const [name,body] of Object.entries(icons)) fs.writeFileSync(path.join(dir,`${name}.svg`),svg(name,body));
let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="880" viewBox="0 0 1000 880"><title>Ink and yellow — twelve hand-drawn icons</title><rect width="1000" height="880" fill="#fffef9"/><text x="64" y="76" font-family="Georgia,serif" font-size="40" font-weight="bold" fill="${ink}">A little less perfect.</text><text x="66" y="110" font-family="Arial,sans-serif" font-size="15" fill="#64645b">TWELVE ORIGINAL PEN DRAWINGS / INK + YELLOW</text><path d="M65 129 Q340 134 575 128 T934 130" fill="none" stroke="${ink}" stroke-width="2"/>`;
Object.entries(icons).forEach(([name,body],i)=>{const x=70+(i%4)*230,y0=157+Math.floor(i/4)*224; sheet+=`<g transform="translate(${x+28} ${y0}) scale(1.55)">${body}</g><text x="${x+104}" y="${y0+185}" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" letter-spacing="2" fill="#64645b">${name.toUpperCase()}</text>`;});
sheet+='</svg>';
fs.writeFileSync('artifacts/handdrawn-icon-sheet.svg',sheet);
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hand-drawn icon studies</title><style>body{margin:0;background:#eeede6;color:#20211e;font:15px system-ui}main{max-width:1000px;margin:30px auto}header{padding:24px 32px;background:white}h1{font:32px Georgia;margin:0 0 12px}p{line-height:1.6;max-width:760px}.sheet{display:block;width:100%;height:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1px;background:#ddd}.card{background:white;padding:24px}.sizes{display:flex;align-items:center;gap:20px;height:112px}a{color:inherit}small{color:#777}</style><main><header><h1>More pen. More personality.</h1><p>Uneven contours, asymmetric shapes, fine interior marks and selective yellow. Each icon is drawn with editable SVG paths. Compare the current 48px icon on the left with the new drawing at 48px and 100px.</p><a href="handdrawn-icon-sheet.svg" download>Download the full SVG sheet</a></header><img class="sheet" src="handdrawn-icon-sheet.svg" alt="Twelve original hand-drawn black and yellow icons"><div class="grid">${Object.keys(icons).map(name=>`<article class="card"><a href="../public/icons/jayrr-handdrawn/${name}.svg" download>${name}</a><div class="sizes">${name==='idea'?'<span style="width:48px">New</span>':`<img width="48" height="48" src="../public/icons/jayrr/${name}.svg" alt="Original ${name}">`}<img width="48" height="48" src="../public/icons/jayrr-handdrawn/${name}.svg" alt="New ${name} small"><img width="100" height="100" src="../public/icons/jayrr-handdrawn/${name}.svg" alt="New ${name}"></div><small>BEFORE / AFTER / DETAIL</small></article>`).join('')}</div></main></html>`;
fs.writeFileSync('artifacts/handdrawn-icons.html',html);
console.log(`Wrote ${Object.keys(icons).length} individual SVGs, sheet, and comparison page.`);
