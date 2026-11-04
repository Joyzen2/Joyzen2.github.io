"""调仓成交模拟：在执行日开盘，按目标权重把持仓调过去。"""
from __future__ import annotations

from dataclasses import dataclass

from . import config as C
from .rules import buy_shares, limit_prices, sell_shares


@dataclass
class Quote:
    """执行日的一只股票。open 为不复权开盘价；volume 为当日成交量，0 视为停牌。"""
    open: float | None
    prev_close: float | None
    volume: float
    is_st: bool = False

    @property
    def suspended(self) -> bool:
        return not self.open or self.open <= 0 or self.volume <= 0 or not self.prev_close


def _status(code: str, q: Quote) -> str:
    if q.suspended:
        return "suspended"
    up, down = limit_prices(code, q.prev_close, q.is_st)
    if q.open >= up - 1e-9:
        return "limit_up"       # 开盘封涨停：只能减不能加
    if q.open <= down + 1e-9:
        return "limit_down"     # 开盘封跌停：只能加不能减
    return "normal"


def rebalance(holdings: dict[str, float], cash: float, targets: dict[str, float],
              quotes: dict[str, Quote], last_close: dict[str, float]) -> dict:
    """返回新的持仓、现金、成交明细和开盘时的组合市值。

    holdings: 股数；targets: 目标权重（和为 1）；last_close: 停牌股的估值价。
    """
    codes = sorted(set(holdings) | set(targets))
    price = {}
    for c in codes:
        q = quotes.get(c)
        price[c] = q.open if q and not q.suspended else last_close.get(c)
    value = {c: holdings.get(c, 0.0) * (price[c] or 0.0) for c in codes}
    nav = cash + sum(value.values())
    investable = nav * (1 - C.CASH_BUFFER)

    status = {c: _status(c, quotes[c]) if c in quotes else "suspended" for c in codes}
    desired = {c: targets.get(c, 0.0) * investable for c in codes}

    # 受限的股票先定下最终市值，再把剩余的资金按目标比例分给可自由交易的股票
    final, free = {}, []
    for c in codes:
        s, cur, want = status[c], value[c], desired[c]
        if s == "suspended":
            final[c] = cur
        elif s == "limit_up" and want > cur:
            final[c] = cur
        elif s == "limit_down" and want < cur:
            final[c] = cur
        else:
            free.append(c)
    room = investable - sum(final.values())
    free_target = sum(desired[c] for c in free)
    scale = room / free_target if free_target > 0 else 0.0
    for c in free:
        final[c] = max(0.0, desired[c] * scale)

    trades, new = [], dict(holdings)
    # 先卖
    for c in codes:
        if status[c] == "suspended" or not price[c]:
            continue
        held = holdings.get(c, 0.0)
        want_shares = final[c] / price[c]
        if want_shares < held:
            n = sell_shares(c, held, held - want_shares)
            if n > 0:
                amount = n * price[c]
                fee = amount * (C.SELL_COST + C.STAMP_DUTY)
                cash += amount - fee
                new[c] = held - n
                trades.append({"code": c, "side": "sell", "shares": round(n, 4), "price": price[c],
                               "amount": round(amount, 2), "fee": round(fee, 2), "status": status[c]})
    # 再买：现金不够时按比例缩减
    orders = {}
    for c in codes:
        if status[c] == "suspended" or not price[c]:
            continue
        held = new.get(c, 0.0)
        gap = final[c] / price[c] - held
        if gap > 0:
            orders[c] = gap
    need = sum(orders[c] * price[c] * (1 + C.BUY_COST) for c in orders)
    shrink = min(1.0, cash / need) if need > 0 else 1.0
    for c, gap in orders.items():
        n = buy_shares(c, gap * shrink)
        if n <= 0:
            continue
        amount = n * price[c]
        fee = amount * C.BUY_COST
        if amount + fee > cash:
            continue
        cash -= amount + fee
        new[c] = new.get(c, 0.0) + n
        trades.append({"code": c, "side": "buy", "shares": n, "price": price[c],
                       "amount": round(amount, 2), "fee": round(fee, 2), "status": status[c]})

    new = {c: s for c, s in new.items() if s > 1e-9}
    blocked = {c: status[c] for c in codes if status[c] != "normal" and abs(desired[c] - value[c]) > 1}
    return {"holdings": new, "cash": cash, "trades": trades, "nav_open": nav, "blocked": blocked}
