"""账户与每日流程。

state/ 下的文件是公开记录：
    account.json        现金、持仓股数、复权因子、对冲状态、待执行的信号
    nav.csv             每日净值（多头、基准、对冲后）
    trades.csv          股票成交
    hedge.csv           期货开平与换月
    signals/<日期>.json  每期目标持仓，信号日当晚提交，早于下一交易日开盘

一天的账要么完整记下，要么什么都不写：所有计算在账户的副本上进行，数据取齐、检查通过后才一次性写文件；
写文件时先删掉同一天的旧行，即使写到一半中断，重跑也不会重复记账。
"""
from __future__ import annotations

import copy
import csv
import datetime as dt
import json
from pathlib import Path

import pandas as pd

from . import clock
from . import config as C
from . import hedge as H
from .broker import Quote, rebalance
from .signal import benchmark_target, icir_target, validate

NAV_FIELDS = ["date", "cash", "long_value", "nav_long", "bench_level", "nav_bench", "fut_pnl", "fut_cost",
              "fut_funding", "hedge_cum", "nav_hedged", "contract", "contracts", "hedge_ratio", "holdings"]
TRADE_FIELDS = ["date", "signal", "code", "side", "shares", "price", "amount", "fee", "status"]
HEDGE_FIELDS = ["date", "action", "symbol", "contracts", "price"]


class StaleData(RuntimeError):
    """当天的数据还没有发布或没有取全。"""


class Book:
    def __init__(self, state_dir: Path):
        self.dir = Path(state_dir)
        (self.dir / "signals").mkdir(parents=True, exist_ok=True)
        path = self.dir / "account.json"
        self.acct = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {
            "cash": float(C.CAPITAL), "holdings": {}, "factors": {}, "hedge": {}, "hedge_cum": 0.0,
            "last_day": None, "pending": None, "bench_start": None, "started": None}

    def commit(self, acct: dict, day: dt.date, rows: dict[str, list[dict]], signal: dict | None):
        """一次性写入一天的结果：信号 → 各记录文件（先删同日旧行）→ 账户。"""
        if signal:
            (self.dir / "signals" / f"{signal['signal_day']}.json").write_text(
                json.dumps(signal, ensure_ascii=False, indent=1), encoding="utf-8")
        for name, fields in (("trades.csv", TRADE_FIELDS), ("nav.csv", NAV_FIELDS), ("hedge.csv", HEDGE_FIELDS)):
            path = self.dir / name
            old = []
            if path.exists():
                with path.open(encoding="utf-8") as f:
                    old = [r for r in csv.DictReader(f) if r["date"] != day.isoformat()]
            new = rows.get(name, [])
            if not old and not new:
                continue
            with path.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
                w.writeheader()
                w.writerows(old + new)
        self.acct = acct
        (self.dir / "account.json").write_text(json.dumps(acct, ensure_ascii=False, indent=1), encoding="utf-8")


def _asof(series: pd.Series, day: dt.date):
    s = series[series.index <= day]
    return s.iloc[-1] if len(s) else None


def is_signal_day(day: dt.date, cal: list[dt.date]) -> bool:
    """月末最后一个交易日。"""
    later = [d for d in cal if d > day]
    return not later or later[0].month != day.month       # 日历只到年底、明年的还没公布时，最后一天也是月末


def days_to_catch_up(book: Book, data, today: dt.date) -> list[dt.date]:
    """账本最后一天之后、到今天为止的交易日，按日期排好；今天还没收盘就不算今天。账本是空的就只记今天。"""
    cal = data.calendar()
    last = dt.date.fromisoformat(book.acct["last_day"]) if book.acct["last_day"] else None
    if last is None:
        days = [today] if today in cal else []
    else:
        days = [d for d in cal if last < d <= today]
    return [d for d in days if d < today or clock.closed(d)]


def run_day(book: Book, data, day: dt.date, strategy: str = "icir", force_signal: bool = False,
            dry_run: bool = False) -> dict:
    if day >= clock.today() and not clock.closed(day):
        raise StaleData(f"{day} 还没有收盘结算（北京时间 {clock.SETTLED_AFTER:%H:%M} 之前），收盘后再跑")
    cal = data.calendar()
    if day > cal[-1]:
        raise StaleData(f"交易日历只到 {cal[-1]}，还没有 {day}，请稍后再跑")
    if day not in cal:
        return {"skipped": f"{day} 不是交易日"}
    if book.acct["last_day"] and dt.date.fromisoformat(book.acct["last_day"]) >= day:
        return {"skipped": f"{day} 已经记过账，不重复计算"}
    acct = copy.deepcopy(book.acct)
    prev = max(d for d in cal if d < day)
    # 账本在走的时候不能跳过交易日：待执行的信号必须在下一交易日开盘成交，跳过就成了晚一天成交
    if acct["last_day"] and (acct["started"] or acct.get("pending")):
        missed = [d for d in cal if dt.date.fromisoformat(acct["last_day"]) < d < day]
        if missed:
            raise StaleData(f"账本只记到 {acct['last_day']}，{missed[0]} 还没记，请先按日期补：run.py daily --date {missed[0]}")
    log, rows = [], {"trades.csv": [], "nav.csv": [], "hedge.csv": []}

    signal_day = force_signal or (is_signal_day(day, cal) and day >= dt.date.fromisoformat(C.FIRST_SIGNAL))
    pending = acct.get("pending")
    target = json.loads((book.dir / "signals" / f"{pending}.json").read_text(encoding="utf-8")) if pending else None
    codes = set(acct["holdings"]) | set(target["weights"] if target else {})

    # ── 取数，并确认当天数据已经发布 ──
    bars = {c: data.bars(c, prev - dt.timedelta(days=15), day) for c in sorted(codes)}
    for c in acct["holdings"]:
        if bars[c] is None or bars[c].empty:      # 停牌超过取数窗口：往前多取，按最后一个收盘价估值
            bars[c] = data.bars(c, prev - dt.timedelta(days=400), day)
            if bars[c] is None or bars[c].empty:
                raise RuntimeError(f"持仓 {c} 取不到日线，无法估值")
    if codes:
        latest = max((b["date"].max().date() for b in bars.values() if b is not None and not b.empty), default=None)
        if latest != day:
            raise StaleData(f"个股日线最新只到 {latest}，{day} 的行情还没有发布，请稍后再跑")
        missing = sorted(c for c, b in bars.items() if b is None or b.empty or b["date"].max().date() != day)
        if missing:
            log.append(f"当日无日线，按停牌处理：{', '.join(missing)}")

    def bar(c, d):
        b = bars.get(c)
        if b is None or b.empty:
            return None
        row = b[b["date"].dt.date == d]
        return row.iloc[0] if len(row) else None

    def last_close(c, d):
        b = bars.get(c)
        if b is None or b.empty:
            return None
        b = b[b["date"].dt.date <= d]
        return float(b["close"].iloc[-1]) if len(b) else None

    # 1. 除权除息：股数按复权因子同步（送转增加股数，现金分红视为再投资）
    factors = {}
    for c in sorted(codes):
        f = data.hfq_factor(c)
        if f.empty:
            if c in acct["holdings"]:
                log.append(f"警告：{c} 没有复权因子，除权除息日的股数无法同步")
            continue
        factors[c] = (_asof(f, day), _asof(f, prev))
        old = acct["factors"].get(c)
        if c in acct["holdings"] and old and factors[c][0] and factors[c][0] != old:
            acct["holdings"][c] *= factors[c][0] / old
            log.append(f"{c} 除权除息，股数按复权因子 {old} → {factors[c][0]} 调整")
        if factors[c][0]:
            acct["factors"][c] = factors[c][0]

    # 2. 执行日：开盘按上一期信号调仓
    trades = []
    open_value = 0.0
    if pending and target:
        st = data.st_codes()
        quotes = {}
        for c in codes:
            b, pc = bar(c, day), last_close(c, prev)
            ft, fp = factors.get(c, (None, None))
            if pc and ft and fp and ft != fp:
                pc = pc * fp / ft           # 除权日用除权参考价算涨跌停
            quotes[c] = Quote(open=float(b["open"]) if b is not None else None, prev_close=pc,
                              volume=float(b["volume"]) if b is not None else 0.0, is_st=c in st)
        res = rebalance(acct["holdings"], acct["cash"], target["weights"], quotes,
                        {c: last_close(c, prev) for c in codes})
        acct["holdings"], acct["cash"] = res["holdings"], res["cash"]
        trades = [{"date": day.isoformat(), "signal": pending, **t} for t in res["trades"]]
        rows["trades.csv"] = trades
        if res["blocked"]:
            log.append("未能按目标成交：" + "，".join(f"{c}（{s}）" for c, s in res["blocked"].items()))
        if res["below_lot"]:
            log.append("有目标权重但未能买入（不足最小交易单位或现金不足）：" + "，".join(res["below_lot"]))
        acct["pending"] = None
        if not acct["started"]:
            # 组合在开盘买入，基准也从开盘算起：全收益指数前收 × 价格指数的隔夜跳空（与研究口径一致）
            tr_prev = _asof(data.index_close(C.BENCHMARK, prev - dt.timedelta(days=10), prev), prev)
            px_prev = _asof(data.index_close(C.INDEX, prev - dt.timedelta(days=10), prev), prev)
            acct["bench_start"] = tr_prev * data.index_open(C.INDEX, day) / px_prev
            acct["started"] = day.isoformat()
            open_value = sum(s * (quotes[c].open or 0.0) for c, s in acct["holdings"].items())   # 空头也在开盘建立
        held = set(acct["holdings"])
        acct["factors"] = {c: f for c, f in acct["factors"].items() if c in held}

    # 3. 收盘估值与对冲
    row = None
    if acct["started"]:
        long_value = sum(s * (last_close(c, day) or 0.0) for c, s in acct["holdings"].items())
        bench = data.index_close(C.BENCHMARK, prev, day)
        if day not in bench.index:
            raise StaleData(f"{C.BENCHMARK} 的 {day} 收盘还没有发布（全收益指数通常晚于价格指数），请稍后再跑")
        level = float(bench[day])
        rate = _asof(data.shibor_3m(), prev) or 0.0
        h = H.step(acct["hedge"], day, data.ic_closes(day), long_value, rate,
                   opens=data.ic_opens(day) if open_value else None, open_value=open_value)
        acct["hedge"] = h["state"]
        acct["hedge_cum"] += h["pnl"] - h["cost"] - h["funding"]
        rows["hedge.csv"] = [{"date": day.isoformat(), **e} for e in h["events"]]
        equity = acct["cash"] + long_value
        row = {"date": day.isoformat(), "cash": round(acct["cash"], 2), "long_value": round(long_value, 2),
               "nav_long": round(equity / C.CAPITAL, 6), "bench_level": level,
               "nav_bench": round(level / acct["bench_start"], 6),
               "fut_pnl": round(h["pnl"], 2), "fut_cost": round(h["cost"], 2), "fut_funding": round(h["funding"], 2),
               "hedge_cum": round(acct["hedge_cum"], 2), "nav_hedged": round((equity + acct["hedge_cum"]) / C.CAPITAL, 6),
               "contract": h["state"].get("symbol"), "contracts": h["state"].get("contracts", 0),
               "hedge_ratio": round(h["ratio"], 4), "holdings": len(acct["holdings"])}
        rows["nav.csv"] = [row]

    # 4. 月末：出下一期信号（当晚提交，早于下一交易日开盘）
    signal = None
    if signal_day:
        # 第一次信号时还没有持仓，前面的日线检查不会生效，这里单独确认当天已经收盘
        if day not in data.index_close(C.INDEX, prev, day).index:
            raise StaleData(f"中证500 的 {day} 收盘还没有发布，请稍后再跑")
        members = data.members(day)
        if strategy == "benchmark":
            # 占位信号：跳过没有复权因子的股票（日跑记不了账）
            ranked = members.sort_values("weight", ascending=False)
            keep = []
            for c in ranked["code"]:
                if not data.hfq_factor(c).empty:
                    keep.append(c)
                if len(keep) == C.TARGET_HOLDINGS:
                    break
            tgt = benchmark_target(members[members["code"].isin(keep)])
        else:
            tgt = icir_target(day, data, acct["holdings"], dry_run=dry_run)
        problems = validate(tgt, members)
        if problems and not (dry_run and strategy == "benchmark"):
            raise SystemExit("目标持仓没有通过检查，未写入信号：\n  " + "\n  ".join(problems))
        weights = {r.code: round(float(r.weight), 8) for r in tgt.itertuples()}
        signal = {"signal_day": day.isoformat(), "execute": "下一交易日开盘", "strategy": strategy,
                  "holdings": len(weights), "weights": weights, "checks": problems or ["通过"]}
        acct["pending"] = day.isoformat()
        log.append(f"已写入 signals/{day.isoformat()}.json：请在下一交易日开盘前提交并推送")

    acct["last_day"] = day.isoformat()
    book.commit(acct, day, rows, signal)
    return {"day": day.isoformat(), "nav": row, "trades": len(trades), "signal": bool(signal), "log": log}
