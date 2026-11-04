"""截面预处理：MAD 去极值 → 标准化 → 行业中位数补缺 → 行业 + 市值中性化。原样移植自中证500 研究。

每个信号日在当月成分股内单独做。
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def winsorize_mad(x: pd.Series, k: float = 5.0) -> pd.Series:
    med = x.median()
    mad = (x - med).abs().median() * 1.4826
    if not np.isfinite(mad) or mad == 0:
        return x
    return x.clip(med - k * mad, med + k * mad)


def zscore(x: pd.Series) -> pd.Series:
    sd = x.std()
    if not np.isfinite(sd) or sd == 0:
        return x * 0.0
    return (x - x.mean()) / sd


def industry_dummies(ind: pd.Series) -> pd.DataFrame:
    return pd.get_dummies(ind.fillna("NA"), dtype="float64")


def neutralize(y: pd.Series, ind: pd.Series, size: pd.Series | None) -> pd.Series:
    """y 对行业哑变量（+ 市值）做 OLS，取残差。y 中不能有 NaN。"""
    X = industry_dummies(ind.reindex(y.index))
    if size is not None:
        X = X.assign(_size=size.reindex(y.index).fillna(0.0).to_numpy())
    beta, *_ = np.linalg.lstsq(X.to_numpy(), y.to_numpy(dtype="float64"), rcond=None)
    return y - X.to_numpy() @ beta


def process_cross_section(raw: pd.DataFrame, ind: pd.Series, neutral: bool = True) -> tuple[pd.DataFrame, pd.DataFrame]:
    """raw：某信号日股票池内的原始因子（行=股票，列=因子）。

    返回 (z, valid)：
      z     处理后的分数（无缺失），neutral=True 时已对行业 + 市值中性化（size 本身只对行业中性化）
      valid 原始值是否存在（单因子 IC 只在原始值存在的股票上算，补缺值不参与）
    """
    valid = raw.notna()
    ind = ind.reindex(raw.index)
    z = pd.DataFrame(index=raw.index, columns=raw.columns, dtype="float64")
    for c in raw.columns:
        x = raw[c].astype("float64")
        if x.notna().sum() < 10:
            z[c] = 0.0
            continue
        x = zscore(winsorize_mad(x))
        fill = x.groupby(ind).transform("median")
        z[c] = x.fillna(fill).fillna(0.0)
    if neutral:
        size = z["size"] if "size" in z else None
        for c in z.columns:
            r = neutralize(z[c], ind, None if c == "size" else size)
            z[c] = zscore(r)
    return z, valid
