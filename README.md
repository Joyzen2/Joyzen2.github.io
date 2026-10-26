# Joyzen2.github.io

金正的个人研究作品集与宏观利率研究网站：<https://joyzen2.github.io/>

- `/`：React + Vite 作品集，源代码在 `portfolio/`。
- `/macro/`：原宏观研究首页；原有文章、笔记和工具网址保留。
- 研究文章在 `content/`，图在 `charts/`。
- `uv run python build.py` 构建两部分到 `docs/`；首次需要 Node.js/npm 安装依赖。
- GitHub Pages 从 `main` 分支的 `docs/` 发布。

回退：在 Git 中撤销首页切换提交后推送即可恢复旧版。

## Independent research sites

- `/csi500/` — four-method index-enhancement comparison, weekly date inspection and robustness results.
- `/text-factors/` — announcement timing, event returns, placebo comparisons and model knowledge-boundary controls.
- `/investorbench/` — null-model intervals, original-paper result comparison and 2×2 ablation.

These are Vite multi-page entries, sourced from `portfolio/src/studies/`. The frontend includes public aggregated snapshots under `portfolio/public/research-data/` and a source/checksum manifest. Research figures read the snapshots; building the websites does not rerun any research experiment. Existing macro routes and the separately hosted AI engineering site are unchanged.
