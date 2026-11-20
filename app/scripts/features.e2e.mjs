import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pujian-features-'));
let browser;
let checks = 0;
function pass(label) { checks++; console.log(`✓ ${label}`); }
try {
  await esbuild.build({ entryPoints: [path.join(root, 'src/lib/pitch.ts')], outfile: path.join(temp, 'pitch.mjs'), platform: 'node', format: 'esm', bundle: true });
  const { detectPitch } = await import(pathToFileURL(path.join(temp, 'pitch.mjs')).href);
  for (const rate of [44100, 48000]) {
    for (const hz of [65.41, 196, 293.665, 440, 659.255, 1046.5, 1975.53]) {
      const signal = Float32Array.from({ length: 4096 }, (_, i) => 0.22 * Math.sin(2 * Math.PI * hz * i / rate) + 0.09 * Math.sin(4 * Math.PI * hz * i / rate));
      const actual = detectPitch(signal, rate); assert(actual, `No pitch ${hz}`);
      assert(Math.abs(1200 * Math.log2(actual.frequency / hz)) < 8, `${hz}: got ${actual.frequency}`);
    }
  }
  assert.equal(detectPitch(new Float32Array(4096), 48000), null);
  let seed = 1;
  const noise = Float32Array.from({ length: 4096 }, () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return (seed / 2 ** 32 - .5) * .3; });
  assert.equal(detectPitch(noise, 48000), null);
  pass('音高检测：两种采样率、14 个单音、静音与噪声');

  const sampleRate = 48000, count = sampleRate * 3;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(9000 * Math.sin(2 * Math.PI * 440 * i / sampleRate) + 3000 * Math.sin(2 * Math.PI * 880 * i / sampleRate)), 44 + i * 2);
  const wavPath = path.join(temp, 'a4.wav'); await fs.writeFile(wavPath, wav);
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wavPath}`, '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(() => { Math.random = () => 0; });
  const url = process.env.APP_URL || 'http://127.0.0.1:5180';
  async function click(text) {
    for (const button of await page.$$('button')) { if ((await button.evaluate((node) => node.textContent?.trim())) === text) { await button.click(); return; } }
    throw new Error(`Button missing: ${text}`);
  }
  await page.goto(`${url}/#theory`); await page.waitForSelector('#theory-query');
  await page.type('#theory-query', 'crescendo');
  await page.waitForFunction(() => document.querySelector('.theory-article h2')?.textContent === '力度记号');
  assert((await page.$eval('.theory-article', (node) => node.textContent)).includes('渐强'));
  await click('重置'); await page.type('#theory-query', '纯五度');
  await page.waitForFunction(() => document.querySelector('.theory-article h2')?.textContent === '音程');
  await click('三和弦 ↗'); await page.waitForFunction(() => document.querySelector('.theory-article h2')?.textContent === '三和弦');
  await page.type('#theory-query', 'xyz不存在'); await page.waitForFunction(() => document.body.textContent.includes('没有找到匹配词条'));
  await click('重置'); await click('节奏与节拍');
  assert((await page.$eval('.theory-results', (node) => node.textContent)).includes('拍号'));
  pass('乐理搜索：中英文、正文匹配、相关跳转、空状态、分类');
  await page.setViewport({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow');
  await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'screenshots/theory-mobile.png'), fullPage: true });
  pass('390px 乐理页面无横向溢出');
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(`${url}/#ear`); await page.waitForSelector('.ear-card');
  for (const mode of ['单音辨认', '音程辨认']) {
    await click(mode); await click('开始练习并播放');
    for (let i = 0; i < 10; i++) {
      await page.waitForFunction(() => { const b = document.querySelector('.ear-options button'); return b && !b.disabled; });
      await page.click('.ear-options button');
      if (i < 9) { await page.waitForSelector('.ear-feedback'); await click('下一题并播放'); }
    }
    await page.waitForSelector('.ear-score');
    assert((await page.$eval('.ear-score', (node) => node.textContent)).startsWith('10'));
    await click('再练一组'); // a new round must not duplicate the completed session
    await page.evaluate(() => document.querySelector('.nav button.active')?.blur());
  }
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pujian:data:v1')));
  assert.equal(stored.sessions.filter((item) => item.domain === 'ear-training').length, 2);
  pass('听音两种模式：20 题播放、答题、满分结算、每组只写入一次');
  await page.goto(`${url}/#progress`); await page.waitForSelector('.table'); assert((await page.$eval('.table', (node) => node.textContent)).includes('听音练习'));
  await page.reload(); await page.waitForSelector('.table'); assert((await page.$eval('.table', (node) => node.textContent)).includes('听音练习'));
  pass('听音成绩与进度集成，刷新持久化');
  await page.goto(`${url}/#live`); await page.waitForSelector('.capture-controls');
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => { const stream = await original(...args); window.__capturedTracks = stream.getTracks(); return stream; };
  });
  await click('开始麦克风');
  await page.waitForFunction(() => document.querySelector('.live-note')?.textContent === 'A4', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.sound-metric strong')?.textContent.includes('等待'), { timeout: 10000 });
  assert((await page.$eval('.live-cents', (node) => node.textContent)).includes('接近参照音'));
  await page.select('select[aria-label="音准参照"]', 'D4');
  await page.waitForFunction(() => document.querySelector('.live-cents')?.textContent.includes('偏高'));
  await page.select('select[aria-label="音准参照"]', 'auto');
  await page.waitForFunction(() => document.querySelector('.live-cents')?.textContent.includes('接近参照音'));
  await page.waitForFunction(() => !document.querySelector('.sound-metric strong')?.textContent.includes('等待'));
  await page.setViewport({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewport({ width: 1400, height: 1100 }); await page.screenshot({ path: path.join(root, 'screenshots/live-sound.png'), fullPage: true });
  await click('■ 停止聆听');
  assert(await page.evaluate(() => window.__capturedTracks.every((track) => track.readyState === 'ended')));
  await click('开始麦克风'); await page.waitForFunction(() => document.querySelector('.live-note')?.textContent === 'A4');
  await page.evaluate(() => { location.hash = 'theory'; });
  await page.waitForSelector('#theory-query');
  assert(await page.evaluate(() => window.__capturedTracks.every((track) => track.readyState === 'ended')));
  pass('模拟麦克风 A4：音名、稳定性、参照切换、移动布局、停止与切页释放');
  await page.goto(`${url}/#live`); await page.waitForSelector('.capture-controls');
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); }; });
  await click('开始麦克风'); await page.waitForFunction(() => document.body.textContent.includes('麦克风权限被拒绝'));
  pass('麦克风拒绝授权时提供恢复说明');
  await page.evaluate(() => {
    window.__contexts = [];
    const OriginalContext = window.AudioContext;
    window.AudioContext = class extends OriginalContext { constructor(...args) { super(...args); window.__contexts.push(this); } };
    navigator.mediaDevices.getUserMedia = () => new Promise((resolve) => { window.__resolveMic = resolve; });
  });
  await click('开始麦克风'); await page.waitForFunction(() => !!window.__resolveMic);
  await click('取消等待');
  await page.waitForFunction(() => window.__contexts.every((context) => context.state === 'closed'));
  await page.evaluate(() => { window.__resolveMic(new MediaStream()); });
  await page.waitForFunction(() => document.querySelector('.capture-controls button')?.textContent === '开始麦克风');
  pass('等待授权期间取消会释放音频上下文，迟到的授权不会重新启动');
  assert.deepEqual(errors, []); pass('新增功能无未捕获浏览器异常');
  console.log(`\n${checks} 组功能检查通过。真实乐器和真实麦克风效果需人工验收。`);
} finally { await browser?.close(); await fs.rm(temp, { recursive: true, force: true }); }
