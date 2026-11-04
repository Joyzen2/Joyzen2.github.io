"""月末信号：产出下一期的目标权重。

正式信号是月频 ICIR 合成（37 个因子，沿用中证500 研究的因子、预处理、风险模型与优化器）。
那部分代码从原研究项目移植到 research/paper/enhance/ 后，由 enhance/bridge.py 提供：

    monthly_target(day: date, data: AkshareData, holdings: dict[str, float]) -> pandas.DataFrame
        必须返回列 code、weight；可选 score、industry。权重和为 1，只做多。

在移植完成之前，只能用 "benchmark" 占位信号做试运行：它按指数权重取前 TARGET_HOLDINGS 只并封顶，
不含任何选股能力，不能用于正式记录。
"""
from __future__ import annotations

import datetime as dt
import sys

import pandas as pd

from . import config as C


def benchmark_target(members: pd.DataFrame) -> pd.DataFrame:
    """占位信号：指数权重最大的 TARGET_HOLDINGS 只，按权重归一后封顶 STOCK_CAP，超出部分按比例分给其余股票。"""
    top = members.sort_values("weight", ascending=False).head(C.TARGET_HOLDINGS)
    w = top.set_index("code")["weight"].astype(float)
    w = w / w.sum()
    for _ in range(50):
        over = w > C.STOCK_CAP
        if not over.any():
            break
        excess = (w[over] - C.STOCK_CAP).sum()
        w[over] = C.STOCK_CAP
        w[~over] += excess * w[~over] / w[~over].sum()
    return pd.DataFrame({"code": w.index, "weight": w.values})


def icir_target(day: dt.date, data, holdings: dict[str, float]) -> pd.DataFrame:
    sys.path.insert(0, str(C.ROOT / "enhance"))
    try:
        from bridge import monthly_target  # noqa: PLC0415
    except ImportError as exc:
        raise SystemExit("ICIR 信号还没有接上：请先把原研究项目的模块移植到 research/paper/enhance/，"
                         "并在 enhance/bridge.py 里实现 monthly_target。试运行可用 --signal benchmark。") from exc
    return monthly_target(day, data, holdings)


def validate(target: pd.DataFrame, members: pd.DataFrame, industry: dict[str, str] | None = None) -> list[str]:
    """检查目标持仓；返回问题列表，空列表表示通过。"""
    problems = []
    w = target.set_index("code")["weight"].astype(float)
    if (w < -1e-12).any():
        problems.append("出现负权重")
    if abs(w.sum() - 1) > 1e-6:
        problems.append(f"权重和为 {w.sum():.6f}，不是 1")
    if (w > C.STOCK_CAP + 1e-6).any():
        problems.append(f"{int((w > C.STOCK_CAP + 1e-6).sum())} 只超过个股上限 {C.STOCK_CAP:.0%}")
    outside = sorted(set(w.index) - set(members["code"]))
    if outside:
        problems.append(f"{len(outside)} 只不在当月成分股里：{', '.join(outside[:5])}")
    if industry:
        b = members.set_index("code")["weight"].astype(float)
        b = b / b.sum()
        port = w.groupby(lambda c: industry.get(c, "未知")).sum()
        bench = b.groupby(lambda c: industry.get(c, "未知")).sum()
        gap = port.sub(bench, fill_value=0).abs()
        bad = gap[gap > C.INDUSTRY_BAND + 1e-6]
        if len(bad):
            problems.append("行业偏离超限：" + "，".join(f"{k} {v:.2%}" for k, v in bad.items()))
    return problems
