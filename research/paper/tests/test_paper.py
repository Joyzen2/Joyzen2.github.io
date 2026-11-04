"""离线测试：uv run --with pytest --with pandas pytest research/paper/tests -q"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from paper import config as C  # noqa: E402
from paper import hedge as H  # noqa: E402
from paper.book import Book, is_signal_day, run_day  # noqa: E402
from paper.broker import Quote, rebalance  # noqa: E402
from paper.rules import buy_shares, limit_prices, sell_shares  # noqa: E402


# ── 交易规则 ──
def test_limit_prices():
    assert limit_prices("600000", 10.05, False) == (11.06, 9.05)     # 主板 10%，四舍五入到分
    assert limit_prices("600000", 10.0, True) == (10.5, 9.5)         # 主板 ST 5%
    assert limit_prices("688001", 50.0, False) == (60.0, 40.0)       # 科创板 20%
    assert limit_prices("300001", 20.0, True) == (24.0, 16.0)        # 创业板 ST 也是 20%


def test_lots():
    assert buy_shares("600000", 1234) == 1200
    assert buy_shares("688001", 199) == 0 and buy_shares("688001", 233.7) == 233
    assert sell_shares("600000", 1250, 1250) == 1250                  # 清仓零股一次卖出
    assert sell_shares("600000", 1250, 830) == 800
    assert sell_shares("688001", 300, 150) == 300                     # 剩下不足 200 股，一并卖出


# ── 成交 ──
def test_rebalance_rules():
    q = {"600000": Quote(10.0, 10.0, 1e6), "600001": Quote(11.0, 10.0, 1e6),     # 600001 开盘涨停
         "600002": Quote(9.0, 10.0, 1e6), "600003": Quote(None, 10.0, 0)}         # 600002 跌停，600003 停牌
    holdings = {"600002": 30000.0, "600003": 20000.0}
    res = rebalance(holdings, 500000.0, {"600000": 0.5, "600001": 0.5}, q, {"600003": 10.0})
    h = res["holdings"]
    assert "600001" not in h                                          # 涨停买不进
    assert h["600002"] == 30000                                       # 跌停卖不出
    assert h["600003"] == 20000                                       # 停牌冻结
    assert res["cash"] >= 0
    assert all(t["code"] != "600001" for t in res["trades"])
    assert h["600000"] % 100 == 0
    fee = sum(t["fee"] for t in res["trades"])
    assert fee == pytest.approx(sum(t["amount"] for t in res["trades"] if t["side"] == "buy") * C.BUY_COST, rel=1e-6)


def test_rebalance_costs_and_cash():
    q = {"600000": Quote(10.0, 10.0, 1e6), "000001": Quote(20.0, 20.0, 1e6)}
    res = rebalance({"600000": 100000.0}, 0.0, {"000001": 1.0}, q, {})
    sell = [t for t in res["trades"] if t["side"] == "sell"][0]
    assert sell["fee"] == pytest.approx(1_000_000 * (C.SELL_COST + C.STAMP_DUTY))
    assert res["cash"] >= 0 and res["holdings"]["000001"] % 100 == 0
    assert res["cash"] / res["nav_open"] < C.CASH_BUFFER + 0.01


# ── 对冲 ──
def test_hedge_contract_and_roll():
    closes = {"IC2611": 6300.0, "IC2612": 6280.0, "IC2703": 6200.0}
    s = H.step({}, dt.date(2026, 11, 3), closes, 10_000_000, 0.014)
    assert s["state"]["symbol"] == "IC2612"                           # IC2611 只剩 17 天
    assert s["state"]["contracts"] == round(10_000_000 / (6280 * 200))
    up = {k: v * 1.01 for k, v in closes.items()}
    t = H.step(s["state"], dt.date(2026, 11, 4), up, 10_100_000, 0.014)
    assert t["pnl"] < 0                                               # 指数涨，空头亏
    assert t["funding"] == pytest.approx(t["notional"] * C.MARGIN * 0.014 / 365)
    roll = H.step(t["state"], dt.date(2026, 11, 30), {"IC2612": 6300.0, "IC2701": 6290.0, "IC2703": 6250.0}, 10_000_000, 0.014)
    assert roll["state"]["symbol"] == "IC2701" and any(e["action"] == "close" for e in roll["events"])


# ── 端到端 ──
class FakeData:
    """造的数据：100 只股票随机游走，一只在 12 月有一次 10 送 3 的除权。"""

    def __init__(self, seed=0):
        rng = np.random.default_rng(seed)
        self.cal = [d.date() for d in pd.bdate_range("2026-10-01", "2027-01-29")]
        self.codes = [f"{600000 + i}" for i in range(60)] + [f"{300000 + i}" for i in range(30)] + [f"{688000 + i}" for i in range(10)]
        self.px = {}
        for c in self.codes:
            p = 10 * np.exp(np.cumsum(rng.normal(0, 0.015, len(self.cal))))
            self.px[c] = pd.Series(np.round(p, 2), index=self.cal)
        self.ex = (self.codes[0], dt.date(2026, 12, 15))
        c, d = self.ex
        self.px[c] = self.px[c].where(self.px[c].index < d, np.round(self.px[c] / 1.3, 2))
        w = rng.random(len(self.codes))
        self.weights = pd.Series(w / w.sum(), index=self.codes)
        self.idx = pd.Series(6000 * np.exp(np.cumsum(rng.normal(0, 0.01, len(self.cal)))), index=self.cal)

    def calendar(self):
        return self.cal

    def members(self, day):
        return pd.DataFrame({"code": self.codes, "name": self.codes, "weight": self.weights.values, "as_of": day})

    def bars(self, code, start, end):
        s = self.px[code]
        s = s[(s.index >= start) & (s.index <= end)]
        return pd.DataFrame({"date": pd.to_datetime(list(s.index)), "open": s.values, "high": s.values, "low": s.values,
                             "close": s.values, "volume": 1e6, "amount": 1e7, "turnover": 1.0})

    def hfq_factor(self, code, refresh=True):
        if code == self.ex[0]:
            return pd.Series([1.0, 1.3], index=[dt.date(2020, 1, 2), self.ex[1]])
        return pd.Series([1.0], index=[dt.date(2020, 1, 2)])

    def st_codes(self):
        return set()

    def index_close(self, symbol, start, end):
        s = self.idx * (1.02 if symbol == C.BENCHMARK else 1.0)
        return s[(s.index >= start) & (s.index <= end)]

    def index_open(self, symbol, day):
        return float(self.idx[day])

    def shibor_3m(self):
        return pd.Series(0.014, index=self.cal)

    def ic_closes(self, day):
        y, m = day.year, day.month
        months = [(y + (m - 1 + k) // 12, (m - 1 + k) % 12 + 1) for k in range(4)]
        return {f"IC{yy % 100:02d}{mm:02d}": float(self.idx[day]) * (1 - 0.005 * k) for k, (yy, mm) in enumerate(months)}


def test_end_to_end(tmp_path):
    data, book = FakeData(), Book(tmp_path)
    days = [d for d in data.cal if dt.date(2026, 11, 27) <= d <= dt.date(2027, 1, 8)]
    for d in days:
        run_day(book, data, d, strategy="benchmark", dry_run=True)
    assert is_signal_day(dt.date(2026, 11, 30), data.cal) and (tmp_path / "signals" / "2026-11-30.json").exists()
    assert (tmp_path / "signals" / "2026-12-31.json").exists()
    nav = pd.read_csv(tmp_path / "nav.csv")
    assert nav["date"].iloc[0] == "2026-12-01"                           # 第一次成交日开始记净值
    assert nav["contracts"].iloc[0] == round(nav["long_value"].iloc[0] / (data.idx[dt.date(2026, 12, 1)] * 0.995 * 200))
    trades = pd.read_csv(tmp_path / "trades.csv", dtype={"code": str})
    second = min(d for d in data.cal if d > dt.date(2026, 12, 31)).isoformat()
    assert set(trades["date"]) == {"2026-12-01", second}                 # 只在信号日之后的第一个交易日成交
    acct = json.loads((tmp_path / "account.json").read_text())
    assert acct["cash"] >= 0 and 0 < acct["cash"] / C.CAPITAL < 0.05
    # 除权日前后组合市值连续（股数随复权因子增加）
    code, ex = data.ex
    before = nav[nav["date"] < ex.isoformat()].iloc[-1]
    after = nav[nav["date"] == ex.isoformat()].iloc[0]
    assert abs(after["nav_long"] / before["nav_long"] - 1) < 0.08
    # 同一天不重复记账
    again = run_day(book, data, days[-1], strategy="benchmark", dry_run=True)
    assert "skipped" in again


def test_formal_signal_requires_bridge(tmp_path):
    data = FakeData()
    with pytest.raises(SystemExit, match="ICIR 信号还没有接上"):
        run_day(Book(tmp_path), data, dt.date(2026, 11, 30), strategy="icir")
