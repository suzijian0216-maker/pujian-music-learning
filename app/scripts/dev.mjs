import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(root, '..');

const ctx = await esbuild.context({
  entryPoints: [path.join(app, 'src/main.tsx')],
  bundle: true,
  outdir: path.join(app, 'public/assets'),
  format: 'esm',
  jsx: 'automatic',
  target: 'es2020',
  loader: { '.css': 'css' },
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'info',
});

await ctx.watch();
const { host, port } = await ctx.serve({
  servedir: path.join(app, 'public'),
  port: 5180,
});

console.log(`\n  谱间 dev server → http://${host}:${port}\n`);
