# 谱间 · M1 应用

M1 可运行版本：识谱速认、电脑键盘钢琴、节拍器、本地练习记录。

## 环境

- Node.js 18+（本机没装 Node 时，`start.command` 会自动使用 DSH 内置的 Node）
- 首次运行需要安装依赖：`npm install` 或 `pnpm install`

## 启动

最简单：双击本目录下的 **`start.command`**，它会启动服务并打开浏览器。

命令行：

```bash
npm run dev
# 然后打开 http://127.0.0.1:5180
```

生产构建：

```bash
npm run build     # 类型检查 + 打包到 dist/
npm run preview   # 本地预览 dist/，默认 5181
```

## 测试

先确保 dev server 在跑，然后：

```bash
npm run test:e2e
```

会启动无头 Chrome，实际点 20 道识谱题、用键盘弹完《小星星》片段、启动节拍器、检查记录落库与刷新后持久化。

## 为什么用 esbuild 而不是 Vite

Vite 依赖的 Rollup 原生模块（`@rollup/rollup-darwin-arm64`）在这台 Mac 上被代码签名校验拦截（Team ID 不一致，`ERR_DLOPEN_FAILED`）。esbuild 是独立可执行文件，不受该限制，因此：

- 打包与 dev server 用 esbuild（`scripts/dev.mjs`）
- 类型检查用 `tsc --noEmit`（`npm run build` 前置）
- 没有 HMR，改代码后刷新页面即可

## 结构

```
src/
  lib/
    notes.ts        音名 / MIDI / 频率 / 音分 / 位置描述
    layouts.ts      两套电脑键盘键位（双手分区 / 双排两八度）
    audio.ts        AudioContext 复用、复音合成、节拍器 click
    metronome.ts    lookahead 节拍器引擎
    storage.ts      localStorage 数据模型与导入导出
    stats.ts        连续天数、时长、正确率、最近 N 天
  components/
    Staff.tsx       VexFlow 五线谱渲染
    PianoKeyboard.tsx
  pages/
    Home.tsx  SightReading.tsx  Piano.tsx  Tools.tsx  Progress.tsx
```

## 数据

- 只存在浏览器 `localStorage`（key：`pujian:data:v1`），不上传
- 清缓存 / 换浏览器会丢数据，建议在「进度 → 导出 JSON」定期备份
- 音频全部本地合成，无外部请求

## M1 范围

- 识谱：高/低音谱号，L1–L3，20 题一组，正确率、反应时间、连对、结算
- 钢琴：两套键位、按住发声、移八度、示范、跟弹判定、自由弹奏
- 节拍器：40–208 BPM、2/3/4/6 拍、Tap tempo、空格控制
- 记录：每次练习落库，首页与进度页展示、导出/导入/清空

下一步 M2：麦克风接入、单音音准判定、曲库与 MusicXML 导入、视奏计时。
