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
from paper.book import Book, StaleData, is_signal_day, run_day  # noqa: E402
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


def test_rebalance_costs_and_cash(monkeypatch):
    monkeypatch.setattr(C, "STOCK_CAP", 1.0)               # 这里只检查费用和现金，单只全仓
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

    def ic_opens(self, day):
        return self.ic_closes(day)


def test_hedge_opens_with_the_long():
    """建仓当天空头按开盘价建立，开盘到收盘的市场涨跌被对冲。"""
    closes, opens = {"IC2611": 6300.0, "IC2612": 6280.0}, {"IC2611": 6100.0, "IC2612": 6080.0}
    s = H.step({}, dt.date(2026, 11, 3), closes, 10_300_000, 0.014, opens=opens, open_value=10_000_000)
    n = round(10_000_000 / (6080 * 200))
    assert s["state"]["symbol"] == "IC2612" and s["state"]["contracts"] == n and s["state"]["price"] == 6280.0
    assert s["pnl"] == pytest.approx(-n * 200 * 200)
    assert s["cost"] == pytest.approx(n * 6080 * 200 * (C.FUT_FEE + C.FUT_SLIPPAGE))
    assert s["events"] == [{"action": "open", "symbol": "IC2612", "contracts": n, "price": 6080.0}]
    later = H.step(s["state"], dt.date(2026, 11, 4), closes, 10_300_000, 0.014, opens=opens, open_value=10_000_000)
    assert later["pnl"] == 0 and later["events"] == []                # 已有空头时不再按开盘价建仓


def test_first_day_hedge_in_ledger(tmp_path):
    class Rally(FakeData):
        def ic_opens(self, day):
            return {k: v / 1.03 for k, v in self.ic_closes(day).items()}

    data, book = Rally(), Book(tmp_path)
    for d in [dt.date(2026, 11, 30), dt.date(2026, 12, 1)]:
        run_day(book, data, d, strategy="benchmark", dry_run=True)
    row = pd.read_csv(tmp_path / "nav.csv").iloc[0]
    hedge = pd.read_csv(tmp_path / "hedge.csv").iloc[0]
    close = data.ic_closes(dt.date(2026, 12, 1))[hedge["symbol"]]
    assert hedge["action"] == "open" and hedge["price"] == pytest.approx(close / 1.03)
    assert row["fut_pnl"] == pytest.approx(-hedge["contracts"] * (close - hedge["price"]) * 200, abs=0.01)
    assert row["nav_hedged"] < row["nav_long"]                        # 市场涨，空头当天就亏


def test_cffex_file_fetched_once(tmp_path, monkeypatch):
    from paper import data as D
    import arbitrage as basis
    raw = ("合约代码,今开盘,最高价,最低价,成交量,成交金额,持仓量,持仓变化,今收盘,今结算,前结算,涨跌1,涨跌2,Delta\n"
           "IC2612 ,6515.2,6710,6500,100,1,1000,1,6703.6,6700,6600,1,1,--\n"
           "IF2612 ,4500,4510,4490,100,1,1000,1,4505,4504,4490,1,1,--\n").encode("gbk")
    calls = []

    class Resp:
        status_code, content = 200, raw

    monkeypatch.setattr(basis, "_http_get", lambda url: calls.append(url) or Resp())
    d = object.__new__(D.AkshareData)
    day = dt.date(2026, 11, 5)
    assert d.ic_closes(day) == {"IC2612": 6703.6} and d.ic_opens(day) == {"IC2612": 6515.2}
    assert len(calls) == 1


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


def test_formal_signal_requires_bridge(tmp_path, monkeypatch):
    monkeypatch.setattr(C, "ROOT", tmp_path)            # 没有 enhance/bridge.py 的目录
    with pytest.raises(SystemExit, match="ICIR 信号还没有接上"):
        run_day(Book(tmp_path / "state"), FakeData(), dt.date(2026, 11, 30), strategy="icir")


def test_cash_drag_after_build():
    """1000 万分到 80 只、股价 3 到 300 元：整手取整后补买，现金应接近 CASH_BUFFER。"""
    rng = np.random.default_rng(3)
    codes = [f"{600000 + i}" for i in range(60)] + [f"{688000 + i}" for i in range(20)]
    prices = np.round(np.exp(rng.uniform(np.log(3), np.log(300), len(codes))), 2)
    q = {c: Quote(float(p), float(p), 1e6) for c, p in zip(codes, prices)}
    res = rebalance({}, float(C.CAPITAL), {c: 1 / len(codes) for c in codes}, q, {})
    ratio = res["cash"] / C.CAPITAL
    assert C.CASH_BUFFER * 0.9 <= ratio < 0.01, ratio
    w = {t["code"]: t["amount"] / C.CAPITAL for t in res["trades"]}
    assert max(w.values()) <= C.STOCK_CAP + 1e-9


class LateBench(FakeData):
    """H00905 当天还没发布。"""
    def index_close(self, symbol, start, end):
        s = super().index_close(symbol, start, end)
        return s[s.index < end] if symbol == C.BENCHMARK else s


def test_stale_data_writes_nothing_and_rerun_is_clean(tmp_path):
    data = FakeData()
    book = Book(tmp_path)
    run_day(book, data, dt.date(2026, 11, 30), strategy="benchmark", dry_run=True)
    late = LateBench()
    with pytest.raises(StaleData):
        run_day(Book(tmp_path), late, dt.date(2026, 12, 1), strategy="benchmark", dry_run=True)
    assert not (tmp_path / "trades.csv").exists() and not (tmp_path / "nav.csv").exists()
    assert json.loads((tmp_path / "account.json").read_text())["pending"] == "2026-11-30"
    run_day(Book(tmp_path), data, dt.date(2026, 12, 1), strategy="benchmark", dry_run=True)
    trades = pd.read_csv(tmp_path / "trades.csv")
    assert len(trades) == len(trades.drop_duplicates(["date", "code", "side"]))


def test_commit_replaces_same_day_rows(tmp_path):
    """写到一半中断后重跑：同一天的旧行先删掉，不会重复。"""
    book = Book(tmp_path)
    day = dt.date(2026, 12, 1)
    row = {"date": day.isoformat(), "signal": "2026-11-30", "code": "600000", "side": "buy", "shares": 100,
           "price": 10, "amount": 1000, "fee": 1, "status": "normal"}
    book.commit(dict(book.acct), day, {"trades.csv": [row]}, None)
    book.commit(dict(book.acct), day, {"trades.csv": [row]}, None)
    assert len(pd.read_csv(tmp_path / "trades.csv")) == 1


def test_redistribution_respects_stock_cap():
    """停牌股冻结的权重分给其余股票时，不能把它们推过个股上限。"""
    codes = [f"{600000 + i}" for i in range(55)]
    q = {c: Quote(10.0, 10.0, 1e6) for c in codes}
    q["600000"] = Quote(None, 10.0, 0)                     # 停牌，持有不足目标
    targets = {c: 0.0182 for c in codes}                    # 和约为 1
    targets["600000"] = 1 - 0.0182 * 54
    res = rebalance({"600000": 100.0}, float(C.CAPITAL), targets, q, {"600000": 10.0})
    w = {c: s * 10.0 / res["nav_open"] for c, s in res["holdings"].items()}
    assert max(w.values()) <= C.STOCK_CAP + 1e-9


class LateIndex(FakeData):
    """中证500 价格指数当天还没发布。"""
    def index_close(self, symbol, start, end):
        s = super().index_close(symbol, start, end)
        return s[s.index < end]


def test_first_signal_checks_freshness(tmp_path):
    with pytest.raises(StaleData):
        run_day(Book(tmp_path), LateIndex(), dt.date(2026, 11, 30), strategy="benchmark", dry_run=True)
    assert not list((tmp_path / "signals").glob("*.json"))
    assert not (tmp_path / "account.json").exists()


def test_index_close_cache(tmp_path, monkeypatch):
    from paper import data as D
    monkeypatch.setattr(C, "CACHE", tmp_path)
    calls = []

    class StubAk:
        def stock_zh_index_hist_csindex(self, symbol, start_date, end_date):
            calls.append((start_date, end_date))
            days = pd.bdate_range(start_date, end_date)
            return pd.DataFrame({"日期": days, "收盘": np.arange(len(days), dtype=float) + 100, "开盘": 99.0})

    d = object.__new__(D.AkshareData)
    d.offline, d.ak, d._index, d._asked = False, StubAk(), {}, set()
    a = d.index_close("H00905", dt.date(2026, 11, 2), dt.date(2026, 11, 4))
    b = d.index_close("H00905", dt.date(2026, 11, 2), dt.date(2026, 11, 4))
    assert len(calls) == 1 and list(a.index) == list(b.index) == [dt.date(2026, 11, d) for d in (2, 3, 4)]
    d2 = object.__new__(D.AkshareData)                      # 第二天新开一次运行：只补取缺的部分
    d2.offline, d2.ak, d2._index, d2._asked = False, StubAk(), {}, set()
    c = d2.index_close("H00905", dt.date(2026, 11, 2), dt.date(2026, 11, 5))
    assert calls[-1] == ("20261104", "20261105") and len(c) == 4      # 从缓存最后一天起补取


def test_refuses_before_close(tmp_path, monkeypatch):
    from paper import clock
    monkeypatch.setattr(clock, "now", lambda: dt.datetime(2026, 12, 1, 10, 2, tzinfo=clock.TZ))
    with pytest.raises(StaleData, match="收盘后再跑"):
        run_day(Book(tmp_path), FakeData(), dt.date(2026, 12, 1), strategy="benchmark", dry_run=True)
    assert not (tmp_path / "account.json").exists()


def test_intraday_bars_are_refetched_after_close(tmp_path, monkeypatch):
    """收盘前取到的当天那一行是半截的：收盘后重跑必须重新请求，并用新值覆盖。"""
    import os
    from paper import clock
    from paper import data as D
    monkeypatch.setattr(C, "CACHE", tmp_path)
    day = dt.date(2026, 11, 5)
    state = {"close": 1400.0, "amount": 2.3e8}             # 盘中
    calls = []

    class StubAk:
        def stock_zh_a_hist(self, symbol, period, start_date, end_date, adjust):
            calls.append(clock.now())
            days = list(pd.bdate_range("2026-10-26", day))
            close = [1500.0] * (len(days) - 1) + [state["close"]]
            amount = [1e9] * (len(days) - 1) + [state["amount"]]
            return pd.DataFrame({"日期": days, "开盘": close, "最高": close, "最低": close, "收盘": close,
                                 "成交量": 1, "成交额": amount, "换手率": 0.1})

    def run_at(hh, mm):
        t = dt.datetime(2026, 11, 5, hh, mm, tzinfo=clock.TZ)
        monkeypatch.setattr(clock, "now", lambda: t)
        d = object.__new__(D.AkshareData)
        d.offline, d.ak, d._index, d._asked, d._factor_memo = False, StubAk(), {}, set(), {}
        out = d.bars("600519", dt.date(2026, 10, 27), day)
        path = tmp_path / "bars" / "600519.csv"
        os.utime(path, (t.timestamp(), t.timestamp()))   # 让文件修改时间等于这次运行的时间
        return out

    morning = run_at(10, 2)
    assert float(morning["close"].iloc[-1]) == 1400.0
    state.update(close=1452.5, amount=9.8e8)              # 收盘
    evening = run_at(20, 45)
    assert len(calls) == 2, "收盘后应当重新请求"
    assert float(evening["close"].iloc[-1]) == 1452.5 and float(evening["amount"].iloc[-1]) == 9.8e8
    again = run_at(21, 0)
    assert len(calls) == 2 and float(again["close"].iloc[-1]) == 1452.5   # 收盘后取过的不再重复请求


def _stub_data(tmp_path, monkeypatch, ak):
    from paper import data as D
    monkeypatch.setattr(C, "CACHE", tmp_path)
    monkeypatch.setattr(D.time, "sleep", lambda s: None)
    d = object.__new__(D.AkshareData)
    d.offline, d.ak, d._index, d._asked, d._factor_memo = False, ak, {}, set(), {}
    return d


def test_hfq_factor_missing_vs_failing(tmp_path, monkeypatch):
    """新浪明确没有 → 空序列；临时失败（即使本机有副本）→ 报错，当天的账不记。"""
    from paper import data as D

    class Missing:
        def stock_zh_a_daily(self, symbol, adjust):
            raise ValueError(D.NO_FACTOR)

    class Flaky:
        def stock_zh_a_daily(self, symbol, adjust):
            raise ValueError("Expecting value: line 1 column 1 (char 0)")   # JSON 解析错误也是 ValueError

    assert _stub_data(tmp_path, monkeypatch, Missing()).hfq_factor("689009").empty
    path = tmp_path / "factors" / "600000.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"date": ["2020-01-02"], "hfq_factor": [1.0]}).to_csv(path, index=False)
    import os
    os.utime(path, (0, 0))                                   # 旧副本
    with pytest.raises(RuntimeError, match="复权因子"):
        _stub_data(tmp_path, monkeypatch, Flaky()).hfq_factor("600000")


class FactorOutage(FakeData):
    """除权日新浪临时失败。"""
    def hfq_factor(self, code, refresh=True):
        raise RuntimeError(f"{code} 复权因子 取数失败：ConnectionError")


def test_factor_outage_writes_nothing(tmp_path):
    data = FakeData()
    days = [d for d in data.cal if dt.date(2026, 11, 30) <= d <= dt.date(2026, 12, 14)]
    for d in days:
        run_day(Book(tmp_path), data, d, strategy="benchmark", dry_run=True)
    before = {p.name: p.read_bytes() for p in tmp_path.glob("*.*")}
    with pytest.raises(RuntimeError):
        run_day(Book(tmp_path), FactorOutage(), data.ex[1], strategy="benchmark", dry_run=True)
    assert {p.name: p.read_bytes() for p in tmp_path.glob("*.*")} == before


def test_panel_marks_codes_without_factor():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "enhance"))
    from panel import Panel

    class WithValues(FakeData):
        def hfq_factor(self, code, refresh=True):
            return pd.Series(dtype="float64") if code == "600001" else super().hfq_factor(code)

        def value_history(self, code):
            idx = pd.to_datetime(self.cal)
            return pd.DataFrame({"total_mcap": 1e10, "float_mcap": 8e9, "total_shares": 1e9}, index=idx)

    pn = Panel(WithValues(), ["600000", "600001", "600002"], dt.date(2026, 11, 30), 40)
    assert pn.no_factor == ["600001"]
    assert pn.value_last["600000"] == pd.Timestamp("2027-01-29")


def test_index_not_yet_published_is_stale_not_throttled(tmp_path, monkeypatch):
    """缓存到前一天、当天还没发布：只请求一次，报"还没有发布"，不当成限流重试。"""
    calls = []

    class Unpublished:
        def stock_zh_index_hist_csindex(self, symbol, start_date, end_date):
            calls.append((start_date, end_date))
            days = [d for d in pd.bdate_range(start_date, end_date) if d < pd.Timestamp("2026-11-05")]
            if not days:                                    # 空表：akshare 在这里会报 Length mismatch
                raise ValueError("Length mismatch: Expected axis has 0 elements")
            return pd.DataFrame({"日期": days, "收盘": 100.0, "开盘": 99.0})

    d = _stub_data(tmp_path, monkeypatch, Unpublished())
    d.index_close("H00905", dt.date(2026, 11, 2), dt.date(2026, 11, 4))      # 缓存到 11-04
    d2 = _stub_data(tmp_path, monkeypatch, Unpublished())
    s = d2.index_close("H00905", dt.date(2026, 11, 4), dt.date(2026, 11, 5))
    assert dt.date(2026, 11, 5) not in s.index and calls[-1] == ("20261104", "20261105") and len(calls) == 2
    with pytest.raises(StaleData, match="还没有发布"):
        d2.index_open("000905", dt.date(2026, 11, 5))
    assert len(calls) == 3
