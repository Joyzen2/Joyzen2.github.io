"""账户与每日流程。

state/ 下的文件是公开记录：
    account.json        现金、持仓股数、复权因子、对冲状态、待执行的信号
    nav.csv             每日净值（多头、基准、对冲后）
    trades.csv          股票成交
    hedge.csv           期货开平与换月
    signals/<日期>.json  每期目标持仓，信号日当晚提交，早于下一交易日开盘
"""
from __future__ import annotations

import csv
import datetime as dt
import json
from pathlib import Path

import pandas as pd

from . import config as C
from . import hedge as H
from .broker import Quote, rebalance
from .signal import benchmark_target, icir_target, validate

NAV_FIELDS = ["date", "cash", "long_value", "nav_long", "bench_level", "nav_bench", "fut_pnl", "fut_cost",
              "fut_funding", "hedge_cum", "nav_hedged", "contract", "contracts", "hedge_ratio", "holdings"]


class Book:
    def __init__(self, state_dir: Path):
        self.dir = Path(state_dir)
        (self.dir / "signals").mkdir(parents=True, exist_ok=True)
        path = self.dir / "account.json"
        self.acct = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {
            "cash": float(C.CAPITAL), "holdings": {}, "factors": {}, "hedge": {}, "hedge_cum": 0.0,
            "last_day": None, "pending": None, "bench_start": None, "started": None}

    def save(self):
        (self.dir / "account.json").write_text(json.dumps(self.acct, ensure_ascii=False, indent=1), encoding="utf-8")

    def _append(self, name: str, rows: list[dict], fields: list[str]):
        if not rows:
            return
        path = self.dir / name
        new = not path.exists()
        with path.open("a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            if new:
                w.writeheader()
            w.writerows(rows)


def _asof(series: pd.Series, day: dt.date):
    s = series[series.index <= day]
    return s.iloc[-1] if len(s) else None


def is_signal_day(day: dt.date, cal: list[dt.date]) -> bool:
    """月末最后一个交易日。"""
    later = [d for d in cal if d > day]
    return bool(later) and later[0].month != day.month


def run_day(book: Book, data, day: dt.date, strategy: str = "icir", force_signal: bool = False,
            dry_run: bool = False) -> dict:
    cal = data.calendar()
    if day not in cal:
        return {"skipped": f"{day} 不是交易日"}
    acct = book.acct
    if acct["last_day"] and dt.date.fromisoformat(acct["last_day"]) >= day:
        return {"skipped": f"{day} 已经记过账，不重复计算"}
    prev = max(d for d in cal if d < day)
    log = []

    signal_day = force_signal or (is_signal_day(day, cal) and day >= dt.date.fromisoformat(C.FIRST_SIGNAL))
    pending = acct.get("pending")
    target = None
    if pending:
        target = json.loads((book.dir / "signals" / f"{pending}.json").read_text(encoding="utf-8"))
    members = data.members(day) if signal_day else None
    codes = set(acct["holdings"]) | set(target["weights"] if target else {})

    start = prev - dt.timedelta(days=15)
    bars = {c: data.bars(c, start, day) for c in sorted(codes)}

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
    for c in sorted(set(acct["holdings"]) | set(target["weights"] if target else {})):
        f = data.hfq_factor(c)
        factors[c] = (_asof(f, day), _asof(f, prev))
        old = acct["factors"].get(c)
        if c in acct["holdings"] and old and factors[c][0] and factors[c][0] != old:
            acct["holdings"][c] *= factors[c][0] / old
            log.append(f"{c} 除权除息，股数按复权因子 {old} → {factors[c][0]} 调整")
        if factors[c][0]:
            acct["factors"][c] = factors[c][0]

    # 2. 执行日：开盘按上一期信号调仓
    trades = []
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
        book._append("trades.csv", trades, ["date", "signal", "code", "side", "shares", "price", "amount", "fee", "status"])
        if res["blocked"]:
            log.append("未能按目标成交：" + "，".join(f"{c}（{s}）" for c, s in res["blocked"].items()))
        acct["pending"] = None
        if not acct["started"]:
            # 组合在开盘买入，基准也从开盘算起：全收益指数前收 × 价格指数的隔夜跳空（与研究口径一致）
            tr_prev = _asof(data.index_close(C.BENCHMARK, prev - dt.timedelta(days=10), prev), prev)
            px_open, px_prev = data.index_open(C.INDEX, day), _asof(data.index_close(C.INDEX, prev - dt.timedelta(days=10), prev), prev)
            acct["bench_start"] = tr_prev * px_open / px_prev
            acct["started"] = day.isoformat()
        held = set(acct["holdings"])
        acct["factors"] = {c: f for c, f in acct["factors"].items() if c in held}

    # 3. 收盘估值与对冲
    row = None
    if acct["started"]:
        long_value = sum(s * (last_close(c, day) or 0.0) for c, s in acct["holdings"].items())
        bench = data.index_close(C.BENCHMARK, prev, day)
        level = _asof(bench, day)
        rate = _asof(data.shibor_3m(), prev) or 0.0
        h = H.step(acct["hedge"], day, data.ic_closes(day), long_value, rate)
        acct["hedge"] = h["state"]
        acct["hedge_cum"] += h["pnl"] - h["cost"] - h["funding"]
        book._append("hedge.csv", [{"date": day.isoformat(), **e} for e in h["events"]],
                     ["date", "action", "symbol", "contracts", "price"])
        equity = acct["cash"] + long_value
        row = {"date": day.isoformat(), "cash": round(acct["cash"], 2), "long_value": round(long_value, 2),
               "nav_long": round(equity / C.CAPITAL, 6), "bench_level": level,
               "nav_bench": round(level / acct["bench_start"], 6) if level and acct["bench_start"] else None,
               "fut_pnl": round(h["pnl"], 2), "fut_cost": round(h["cost"], 2), "fut_funding": round(h["funding"], 2),
               "hedge_cum": round(acct["hedge_cum"], 2), "nav_hedged": round((equity + acct["hedge_cum"]) / C.CAPITAL, 6),
               "contract": h["state"].get("symbol"), "contracts": h["state"].get("contracts", 0),
               "hedge_ratio": round(h["ratio"], 4), "holdings": len(acct["holdings"])}
        book._append("nav.csv", [row], NAV_FIELDS)

    # 4. 月末：出下一期信号（当晚提交，早于下一交易日开盘）
    signal = None
    if signal_day:
        if strategy == "benchmark":
            tgt = benchmark_target(members)
        else:
            tgt = icir_target(day, data, acct["holdings"])
        industry = None
        problems = validate(tgt, members, industry)
        if problems and not (dry_run and strategy == "benchmark"):
            raise SystemExit("目标持仓没有通过检查，未写入信号：\n  " + "\n  ".join(problems))
        weights = {r.code: round(float(r.weight), 8) for r in tgt.itertuples()}
        signal = {"signal_day": day.isoformat(), "execute": "下一交易日开盘", "strategy": strategy,
                  "holdings": len(weights), "weights": weights, "checks": problems or ["通过"]}
        (book.dir / "signals" / f"{day.isoformat()}.json").write_text(
            json.dumps(signal, ensure_ascii=False, indent=1), encoding="utf-8")
        acct["pending"] = day.isoformat()
        log.append(f"已写入 signals/{day.isoformat()}.json：请在下一交易日开盘前提交并推送")

    acct["last_day"] = day.isoformat()
    book.save()
    return {"day": day.isoformat(), "nav": row, "trades": len(trades), "signal": bool(signal), "log": log}
