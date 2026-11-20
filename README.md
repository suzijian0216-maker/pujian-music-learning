# 谱间 · 音乐练习室

个人音乐学习网站，使用 React、TypeScript、esbuild 和 VexFlow。页面、合成音频与麦克风分析都在浏览器中运行，无账号、无后端。

## 功能

- 识谱训练：高低音谱号、分级随机题、快捷键与结算。
- 钢琴：电脑键盘或触屏演奏，两套键位、移八度与跟弹。
- 乐理大全：42 个词条，中英文关键词查询，解释、实例与相关知识。
- 听音练习：单音与音程辨认，每组 10 题，保存成绩。
- 拉奏分析：麦克风单音识别、音准偏差、波形、频谱与长音稳定性。
- 节拍器、练习统计与 JSON 导出/导入。

音色分析提供辅助指标，不对悦耳程度评分。真实乐器、麦克风与房间会影响检测结果；真实小提琴效果仍需实际拉奏验收。

## 在线使用：GitHub Pages

本仓库已包含 `.github/workflows/pages.yml`：每次推送到 `main` 自动安装依赖、检查类型、构建和部署。

首次发布需要仓库管理员完成：

1. 使用公开仓库（适用于 GitHub Free 的 Pages）。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 推送代码到 `main`；若推送时尚未启用 Pages，在 **Actions → Deploy Pujian to GitHub Pages → Run workflow** 重新运行。
4. 部署完成后，以 **Settings → Pages** 或部署任务给出的 HTTPS 地址为准。通常为 `https://<用户名>.github.io/<仓库名>/`。

在其他电脑直接用浏览器打开该地址，无需安装 Node。麦克风功能需浏览器授权，推荐新版 Chrome/Edge。资源采用相对路径，可部署到仓库子目录。

## 数据与换电脑

练习记录和设置保存在当前浏览器的 localStorage，**不会通过 GitHub 同步**。换电脑前在「进度 → 导出 JSON」下载备份，再在另一台电脑的「进度 → 导入」恢复。导入会覆盖当前数据。

麦克风音频仅在本机实时分析，不录制、不保存、不上传。清除网站数据会删除本地记录。

## 本地开发

使用 Node.js 22 与 pnpm 9：

```bash
cd app
pnpm install --frozen-lockfile
pnpm dev
```

访问 `http://127.0.0.1:5180`。Mac 也可双击 `app/start.command` 启动（需先安装依赖）。

```bash
pnpm build          # 类型检查并构建到 app/dist
pnpm preview        # http://127.0.0.1:5181
```

## 自动检查

先启动开发服务，确保本机安装 Google Chrome，再在 `app/` 执行：

```bash
pnpm test:e2e       # 原有 11 项端到端检查
pnpm test:features  # 乐理、听音、合成单音与模拟麦克风等检查
```

可用 `APP_URL` 和 `CHROME_PATH` 覆盖测试地址与浏览器路径。模拟麦克风检查不代表真实乐器效果已通过验收。

## 目录

- `app/src/`：应用代码；乐理内容在 `app/src/data/theory.ts`。
- `app/public/index.html`：HTML 入口。
- `app/scripts/`：开发、构建、预览与检查脚本。
- `design/`：历史设计方案和演示原型，与当前应用功能可能不同。
- `.github/workflows/pages.yml`：GitHub Pages 部署流程。

生成物、依赖、截图、个人交接记录及本地配置已通过 `.gitignore` 排除。
