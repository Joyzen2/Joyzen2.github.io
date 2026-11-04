"""基准权重。

研究拿不到历史官方权重，用「成分 × 流通市值 × 自由流通系数」近似。模拟实盘只往前走，能直接用中证官网的最新权重：
官方权重截至上一个月末（as_of），这里按复权价涨跌漂移到信号日。
"""
from __future__ import annotations

import pandas as pd


def drifted_weights(members: pd.DataFrame, close: pd.DataFrame, day: pd.Timestamp) -> pd.Series:
    """code -> 信号日的基准权重。取不到价格的股票保持官方权重不漂移。"""
    w = members.set_index("code")["weight"].astype("float64")
    w = w / w.sum()
    as_of = pd.Timestamp(members["as_of"].iloc[0])
    filled = close.ffill()
    if as_of < day and as_of in filled.index and day in filled.index:
        growth = (filled.loc[day] / filled.loc[as_of]).reindex(w.index).fillna(1.0)
        w = w * growth
    return w / w.sum()
