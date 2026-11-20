import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(root, '..');
const dist = path.join(app, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(app, 'src/main.tsx')],
  bundle: true,
  outdir: path.join(dist, 'assets'),
  format: 'esm',
  jsx: 'automatic',
  target: 'es2020',
  loader: { '.css': 'css' },
  minify: true,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

fs.copyFileSync(path.join(app, 'public/index.html'), path.join(dist, 'index.html'));
console.log('built → dist/');
