// アイコン生成（ローカル用。CIでは使わない）: node scripts/make-icons.mjs
import sharp from 'sharp';
const svg = 'scripts/icon.svg';
await sharp(svg).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
// maskable：安全領域に収まるよう縮小して余白を背景色で埋める
const inner = await sharp(svg).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#120f18' } })
  .composite([{ input: inner, top: 56, left: 56 }]).png().toFile('public/icons/icon-maskable-512.png');
console.log('icons done');
