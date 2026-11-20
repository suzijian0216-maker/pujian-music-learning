import puppeteer from 'puppeteer-core';

const URL = process.env.APP_URL || 'http://127.0.0.1:5180';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${URL}/#home`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.nav button');

  // ---- 识谱 ----
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.nav button')].find((b) => b.textContent?.includes('识谱'));
    button?.click();
  });
  await page.waitForSelector('.opts .opt');
  const optionCount = await page.$$eval('.opts .opt', (nodes) => nodes.length);
  check('识谱页 4 个选项', optionCount === 4, `实际 ${optionCount}`);

  for (let i = 0; i < 20; i += 1) {
    const buttons = await page.$$('.opts .opt');
    if (buttons.length === 0) break;
    await buttons[0].click();
    await sleep(950);
  }
  await page.waitForSelector('.done-title', { timeout: 8000 }).catch(() => null);
  const doneText = await page.$eval('.done-title', (node) => node.textContent).catch(() => '');
  check('20 题后进入结算', doneText === '本组完成', doneText);

  const afterSight = await page.evaluate(() => JSON.parse(localStorage.getItem('pujian:data:v1') || 'null'));
  check('识谱 session 已落库', Array.isArray(afterSight?.sessions) && afterSight.sessions.length === 1,
    `sessions=${afterSight?.sessions?.length ?? 'null'}`);
  check('识谱 session 数据完整', afterSight?.sessions?.[0]?.total === 20,
    `total=${afterSight?.sessions?.[0]?.total}`);

  // ---- 钢琴 ----
  await page.evaluate(() => {
    document.querySelectorAll('.nav button')[2]?.click();
  });
  await page.waitForSelector('.piano .wkey');
  const whiteKeys = await page.$$eval('.piano .wkey', (nodes) => nodes.length);
  check('双手分区键盘 10 个白键', whiteKeys === 10, `实际 ${whiteKeys}`);

  const phraseKeys = ['a', 'a', 'g', 'g', 'h', 'h', 'g'];
  for (const key of phraseKeys) {
    await page.keyboard.down(key);
    await sleep(120);
    await page.keyboard.up(key);
    await sleep(120);
  }
  await sleep(400);
  const pianoDone = await page.$eval('.feedback', (node) => node.textContent).catch(() => '');
  check('键盘跟弹完成 7 个音', (pianoDone || '').includes('完成'), pianoDone || '');

  const afterPiano = await page.evaluate(() => JSON.parse(localStorage.getItem('pujian:data:v1') || 'null'));
  check('钢琴 session 已落库', afterPiano?.sessions?.length === 2, `sessions=${afterPiano?.sessions?.length}`);

  // ---- 节拍器 ----
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.nav button')].find((b) => b.textContent?.includes('节拍器'));
    button?.click();
  });
  await page.waitForSelector('.bpm-big');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('开始'));
    button?.click();
  });
  await sleep(1200);
  const beatOn = await page.$$eval('.beats i.on', (nodes) => nodes.length);
  check('节拍器运行并有拍点', beatOn === 1, `高亮拍点 ${beatOn}`);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('停止'));
    button?.click();
  });

  // ---- 进度 ----
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.nav button')].find((b) => b.textContent?.includes('进度'));
    button?.click();
  });
  await page.waitForSelector('.table');
  const rows = await page.$$eval('.table tbody tr', (nodes) => nodes.length);
  check('进度页显示练习记录', rows === 2, `记录 ${rows} 条`);

  // ---- 刷新后数据仍在 ----
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('pujian:data:v1') || 'null'));
  check('刷新后数据仍在本机', persisted?.sessions?.length === 2, `sessions=${persisted?.sessions?.length}`);

  check('无未捕获 JS 错误', errors.length === 0, errors.slice(0, 2).join(' | '));

  await page.screenshot({ path: '/tmp/appshots/e2e-progress.png' });
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
