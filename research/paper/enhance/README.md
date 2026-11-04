# 从中证500研究移植的模块

正式信号（月频 ICIR 合成，37 个因子）沿用原研究项目 `src/enhance` 的方法。移植到这里的模块：

| 模块 | 用途 |
|---|---|
| `factors.py` | 37 个月频因子的定义 |
| `preprocess.py` | MAD 去极值（5 倍）、标准化、行业中位数补缺、行业与市值中性化 |
| `industry.py` | 申万一级行业的时点归属 |
| `scores.py`、`evaluate.py` | 成分股内打分、Rank IC |
| `combine.py` | ICIR 合成（36 个月滚动） |
| `risk.py` | 简化 Barra 风险模型（10 个风格 + 申万一级） |
| `optimize.py` | cvxpy + CLARABEL 组合优化 |
| `benchmark.py` | 近似基准权重（只用到这一部分） |
| `fetch.py` | 东方财富数据中心的财报请求（取 NOTICE_DATE） |

移植时去掉本机路径与 `.env` 读取，数据改由 `paper.data.AkshareData` 提供（原项目的通达信行情接口已关闭）。

## bridge.py 的约定

`research/paper/paper/signal.py` 会调用：

```python
def monthly_target(day: datetime.date, data: AkshareData, holdings: dict[str, float]) -> pandas.DataFrame:
    """月末最后一个交易日收盘后，返回下一期的目标权重。"""
```

- 返回列 `code`、`weight`，可选 `score`、`industry`；权重和为 1，只做多。
- 约束取自 `paper/config.py`：个股 ≤ `STOCK_CAP`、申万一级行业主动暴露 ±`INDUSTRY_BAND`、规模 ±`SIZE_BAND`、其余风格 ±`STYLE_BAND`、跟踪误差 ≤ `TE_CAP`（含滚动偏差校准）、单边换手 ≤ `TURNOVER_CAP`。
- 持仓约 `TARGET_HOLDINGS` 只：先取分数最高的 `CANDIDATES` 只加现有持仓作为候选池，优化后剔除低于 `MIN_WEIGHT` 的再归一。
- ICIR 的 IC 历史：初始用原研究的月度 Rank IC 面板（到 2026-07），之后每月用新数据追加，保存在 `state/ic_history.csv`。
- 返回前自己检查行业偏离（需要行业归属）；`signal.validate` 还会再检查权重和、个股上限与成分股范围。
