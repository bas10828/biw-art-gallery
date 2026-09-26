// Builds the 3D gallery textures from public/images/<file>.
//   node scripts/build-textures.mjs
// Writes public/images/tex/sm (phones) and tex/lg (desktop) as webp, and prints
// each texture's width/height ratio — copy it into `ratio` in lib/artworks.ts.
//
// Some source photos show the painting inside a frame or on a wall; CROP lists
// the painted area as fractions [left, top, right, bottom] so only the canvas
// ends up in the 3D frame.

import fs from "node:fs";
import sharp from "sharp";

const CROP = {
  "firefly-forest.jpg": [0.08, 0.1, 0.92, 0.91],
  "dream-forest.jpg": [0.09, 0.1, 0.91, 0.905],
  "creature-pink-framed.jpg": [0.145, 0.175, 0.87, 0.87],
  "creature-white-framed.jpg": [0.15, 0.135, 0.87, 0.85],
  "voices-of-the-wilderness.jpg": [0.187, 0.13, 0.813, 0.77],
};

const src = fs.readFileSync("lib/artworks.ts", "utf8");
const files = [...src.matchAll(/file: "([^"]+)"/g)].map((m) => m[1]);

for (const dir of ["sm", "lg"]) fs.mkdirSync(`public/images/tex/${dir}`, { recursive: true });

for (const file of files) {
  const input = `public/images/${file}`;
  const { width, height } = await sharp(input).metadata();
  let img = sharp(input).rotate();
  const crop = CROP[file];
  let w = width;
  let h = height;
  if (crop) {
    const [l, t, r, b] = crop;
    const box = {
      left: Math.round(l * width),
      top: Math.round(t * height),
      width: Math.round((r - l) * width),
      height: Math.round((b - t) * height),
    };
    img = img.extract(box);
    w = box.width;
    h = box.height;
  }
  const buf = await img.toBuffer();
  const base = file.replace(/\.\w+$/, "");
  await sharp(buf).resize(720, 720, { fit: "inside" }).webp({ quality: 78 }).toFile(`public/images/tex/sm/${base}.webp`);
  await sharp(buf)
    .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(`public/images/tex/lg/${base}.webp`);
  console.log(`${file}\tratio: ${(w / h).toFixed(3)}`);
}
