"""ICIR 合成，移植自中证500 研究。

时点纪律：信号日 t 合成时，只能用「t 时刻已经完全实现」的 IC。IC 历史里只存已实现的期（持有期结束才追加），
所以这里直接取 t 之前最近 36 期。权重 = IC 均值 / IC 标准差；方向由历史 IC 决定，不用事先预期。
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from preprocess import zscore

LOOKBACK = 36


def icir_weights(ic: pd.DataFrame, t: pd.Timestamp) -> pd.Series:
    hist = ic[ic.index < t].iloc[-LOOKBACK:]
    if len(hist) < LOOKBACK:
        raise ValueError(f"已实现的 IC 只有 {len(hist)} 期，不足 {LOOKBACK} 期")
    return (hist.mean() / hist.std()).fillna(0.0)


def composite(z: pd.DataFrame, w: pd.Series) -> pd.Series:
    s = z.to_numpy(dtype="float64") @ w.reindex(z.columns).to_numpy()
    return zscore(pd.Series(s, index=z.index))
