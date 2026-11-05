"""IC 空头对冲：按整数手跟随多头市值，到期前换月。"""
from __future__ import annotations

import datetime as dt

from . import config as C


def third_friday(year: int, month: int) -> dt.date:
    first = dt.date(year, month, 1)
    return first + dt.timedelta(days=(4 - first.weekday()) % 7 + 14)


def expiry(symbol: str) -> dt.date:
    """合约月份的第三个周五（遇节假日顺延的情况，以交易所最后交易日为准，这里只用来选合约）。"""
    return third_friday(2000 + int(symbol[2:4]), int(symbol[4:6]))


def pick_contract(day: dt.date, symbols: list[str]) -> str | None:
    """剩余天数大于 ROLL_MIN_DAYS 的最近合约。"""
    live = [(expiry(s) - day).days for s in symbols]
    ok = [(d, s) for d, s in zip(live, symbols) if d > C.ROLL_MIN_DAYS]
    return min(ok)[1] if ok else None


def fee(notional: float) -> float:
    return abs(notional) * (C.FUT_FEE + C.FUT_SLIPPAGE)


def step(state: dict, day: dt.date, closes: dict[str, float], long_value: float, rate: float,
         opens: dict[str, float] | None = None, open_value: float = 0.0) -> dict:
    """收盘后更新一天的对冲。state: {"symbol", "contracts", "price", "last_day"}。

    opens、open_value 只在建仓当天给：空头和多头一样在开盘建立，按开盘价成交，手数按开盘时的多头市值算，
    否则当天开盘到收盘的市场涨跌没有对冲，会一直留在对冲后净值里。

    返回当日期货盈亏、成本、保证金资金成本，以及更新后的 state。
    """
    pnl = cost = 0.0
    sym, n, last_price = state.get("symbol"), state.get("contracts", 0), state.get("price")
    last_day = state.get("last_day")
    if sym and n and sym in closes and last_price:
        pnl = -n * (closes[sym] - last_price) * C.HEDGE_MULTIPLIER
    target_sym = pick_contract(day, sorted(closes))
    events = []
    if opens and not n and opens.get(target_sym):
        sym, entry = target_sym, opens[target_sym]
        n = round(open_value * C.HEDGE_RATIO / (entry * C.HEDGE_MULTIPLIER))
        pnl = -n * (closes[sym] - entry) * C.HEDGE_MULTIPLIER
        cost += fee(n * entry * C.HEDGE_MULTIPLIER)
        events.append({"action": "open", "symbol": sym, "contracts": n, "price": entry})
    if sym and target_sym and target_sym != sym and n:
        # 换月：平旧开新
        cost += fee(n * closes[sym] * C.HEDGE_MULTIPLIER)
        events.append({"action": "close", "symbol": sym, "contracts": n, "price": closes[sym]})
        sym, n = None, 0
    sym = sym or target_sym
    if sym:
        price = closes[sym]
        want = round(long_value * C.HEDGE_RATIO / (price * C.HEDGE_MULTIPLIER))
        ratio = n * price * C.HEDGE_MULTIPLIER / long_value if long_value else 0.0
        # 新开仓、换月后，或实际比例偏离目标超过容忍带时才调整，避免在取整分界线附近来回加减
        if want != n and (n == 0 or abs(ratio - C.HEDGE_RATIO) > C.HEDGE_BAND):
            cost += fee((want - n) * price * C.HEDGE_MULTIPLIER)
            events.append({"action": "open" if want > n else "reduce", "symbol": sym,
                           "contracts": abs(want - n), "price": price})
            n = want
        state = {"symbol": sym, "contracts": n, "price": price}
    notional = n * (state.get("price") or 0) * C.HEDGE_MULTIPLIER
    # 保证金占用的资金成本：按上一交易日以来的自然日计
    days = (day - dt.date.fromisoformat(last_day)).days if last_day else 0
    funding = notional * C.MARGIN * rate * max(days, 0) / 365
    state["last_day"] = day.isoformat()
    return {"state": state, "pnl": pnl, "cost": cost, "funding": funding, "notional": notional,
            "ratio": notional / long_value if long_value else 0.0, "events": events}
