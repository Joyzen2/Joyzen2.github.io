"""成分股内打分与 Rank IC。移植自中证500 研究的 scores.py、evaluate.py。"""
from __future__ import annotations

import pandas as pd

import preprocess


def cross_section(f: pd.DataFrame, date: pd.Timestamp, codes: list[str], ind: pd.Series) -> tuple[pd.DataFrame, pd.DataFrame]:
    """某信号日、当期成分股内的 (z, valid)。当天停牌或上市不足 120 日的不打分。"""
    raw = f.loc[date].reindex(codes)
    raw = raw[raw["size"].notna()].astype("float64")
    return preprocess.process_cross_section(raw, ind)


def rank_ic(score: pd.Series, fwd: pd.Series) -> float:
    d = pd.concat([score, fwd], axis=1).dropna()
    if len(d) < 20:
        return float("nan")
    return float(d.iloc[:, 0].rank().corr(d.iloc[:, 1].rank()))


def execution_day(days: pd.DatetimeIndex, signal: pd.Timestamp) -> pd.Timestamp | None:
    """信号日的执行日：下一个交易日。"""
    p = days.searchsorted(signal, side="right")
    return days[p] if p < len(days) else None


def forward_return(pn, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """从 start 开盘到 end 开盘的收益（停牌股按最后成交价估值）。"""
    val = pn.valuation_price()
    return val.loc[end] / val.loc[start] - 1
