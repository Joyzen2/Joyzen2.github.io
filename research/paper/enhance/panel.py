"""日频面板：把逐股行情拼成「交易日 × 股票」宽表。口径同中证500 研究：

- 价格一律后复权（不复权价 × 后复权因子）。东财自带的后复权是加法复权，不能用。
- 停牌日整行不存在 → 宽表里是 NaN，绝不前填成 0% 收益。
- 涨停：复权涨幅达到当日幅度（容差 0.3%）且收在最高价；ST 不单独判，与研究的行情库一致
  （中证500 选样排除 ST）。

字段：open/high/low/close（后复权）、raw_close、amount（元）、turnover（%）、float_mcap、total_mcap（元）、limit_up。
"""
from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

LIMIT_TOL = 0.003


def _limit_pct(code: str) -> float:
    return 0.20 if code.startswith(("688", "689", "300", "301", "302")) else 0.10


class Panel:
    def __init__(self, data, codes: list[str], day: dt.date, history: int):
        days = [d for d in data.calendar() if d <= day][-history:]
        self.day = pd.Timestamp(day)
        self.days = pd.DatetimeIndex(days)
        self.missing: list[str] = []
        self.no_factor: list[str] = []
        fields: dict[str, dict[str, pd.Series]] = {k: {} for k in (
            "open", "high", "low", "close", "raw_close", "amount", "turnover", "float_mcap", "total_mcap", "total_shares", "limit_up")}
        for c in sorted(set(codes)):
            b = data.bars(c, days[0], day)
            if b is None or b.empty:
                self.missing.append(c)
                continue
            b = b[pd.to_numeric(b["volume"], errors="coerce") > 0].set_index("date").sort_index()
            try:
                f = data.hfq_factor(c)
            except Exception:                        # 新浪不提供个别代码的因子文件：当作没有除权，并记下来
                f = pd.Series(dtype="float64")
                self.no_factor.append(c)
            if len(f):
                fac = pd.Series(f.values, index=pd.to_datetime(list(f.index))).sort_index()
                fac = fac.reindex(fac.index.union(b.index)).ffill().bfill().reindex(b.index)
            else:
                fac = pd.Series(1.0, index=b.index)
            for k in ("open", "high", "low", "close"):
                fields[k][c] = pd.to_numeric(b[k], errors="coerce") * fac
            fields["raw_close"][c] = pd.to_numeric(b["close"], errors="coerce")
            fields["amount"][c] = pd.to_numeric(b["amount"], errors="coerce")
            fields["turnover"][c] = pd.to_numeric(b["turnover"], errors="coerce")
            adj = fields["close"][c]
            hit = (adj / adj.shift(1) - 1) >= _limit_pct(c) - LIMIT_TOL
            fields["limit_up"][c] = (hit & (pd.to_numeric(b["close"]) == pd.to_numeric(b["high"]))).astype("float64")
            v = data.value_history(c)
            if v is not None and len(v):
                v = v.reindex(v.index.union(b.index)).ffill().reindex(b.index)
                fields["float_mcap"][c] = v["float_mcap"]
                fields["total_mcap"][c] = v["total_mcap"]
                fields["total_shares"][c] = v["total_shares"]
        self.tables = {k: pd.DataFrame(v).reindex(self.days).astype("float64") for k, v in fields.items()}
        traded = self.tables["close"].notna()
        for k in ("float_mcap", "total_mcap", "turnover", "limit_up"):
            self.tables[k] = self.tables[k].where(traded)

    def load(self, field: str) -> pd.DataFrame:
        return self.tables[field]

    def returns(self) -> pd.DataFrame:
        """收盘到收盘日收益。停牌当天 NaN；复牌当天是跨停牌期的累计收益（不是 0）。"""
        c = self.load("close")
        return (c / c.ffill().shift(1) - 1).where(c.notna())

    def fresh_mask(self) -> pd.DataFrame:
        """当天和前一个交易日都有成交：只有这样的收益才是真正的「一天」收益。"""
        c = self.load("close")
        return c.notna() & c.shift(1).notna()

    def listed_days(self) -> pd.DataFrame:
        """截至每天的成交天数（窗口内累计，停牌不计）。"""
        return self.load("close").notna().cumsum()

    def month_ends(self) -> pd.DatetimeIndex:
        s = pd.Series(self.days, index=self.days)
        return pd.DatetimeIndex(s.groupby(self.days.to_period("M")).max().values)

    def valuation_price(self) -> pd.DataFrame:
        """执行日估值价：当天有开盘价就用开盘价，停牌则用最后一个收盘价。"""
        o = self.load("open")
        return o.where(o.notna(), self.load("close").ffill().shift(1))
