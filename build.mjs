// ビルド：esbuild で src を束ね、dist/ に PWA 一式を出力する。
//   node build.mjs          … 本番ビルド
//   node build.mjs --serve  … ビルドして http://localhost:5173 で確認
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative } from 'node:path';

const DIST = 'dist';
const serve = process.argv.includes('--serve');

const jst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets'), { recursive: true });

const result = await esbuild.build({
  entryPoints: { app: 'src/main.tsx' },
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  outdir: join(DIST, 'assets'),
  entryNames: '[name]-[hash]',
  metafile: true,
  logLevel: 'warning',
  define: {
    'process.env.NODE_ENV': '"production"',
    __GOOGLE_CLIENT_ID__: JSON.stringify(process.env.GOOGLE_CLIENT_ID ?? ''),
    __BUILD_TIME__: JSON.stringify(jst),
  },
});

const outputs = Object.keys(result.metafile.outputs).map((p) => relative(DIST, p).replaceAll('\\', '/'));
const js = outputs.find((p) => p.endsWith('.js'));
const css = outputs.find((p) => p.endsWith('.css'));

if (existsSync('public')) cpSync('public', DIST, { recursive: true });

writeFileSync(
  join(DIST, 'index.html'),
  readFileSync('index.html', 'utf8').replace('%JS%', js).replace('%CSS%', css),
);

// GitHub Pages で Jekyll 処理をさせない
writeFileSync(join(DIST, '.nojekyll'), '');

// Service Worker：ビルドごとにキャッシュ名が変わる
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST)
  .map((p) => relative(DIST, p).replaceAll('\\', '/'))
  .filter((p) => !p.startsWith('.') && p !== 'sw.js');
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(readFileSync(join(DIST, f)));
const version = hash.digest('hex').slice(0, 10);
const precache = ['./', ...files.map((f) => `./${f}`)];
writeFileSync(
  join(DIST, 'sw.js'),
  readFileSync('src/sw.template.js', 'utf8')
    .replace('__VERSION__', version)
    .replace('__PRECACHE__', JSON.stringify(precache)),
);

console.log(`built ${js} ${css} (sw ${version}, ${files.length} files) ${jst} JST`);

if (serve) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.json': 'application/json' };
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(DIST, p);
    if (!existsSync(f)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  }).listen(5173, () => console.log('http://localhost:5173/'));
}
