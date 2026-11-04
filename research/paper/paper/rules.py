"""A 股交易规则：板块、涨跌停价、最小交易单位。"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal


def board(code: str) -> str:
    if code.startswith("688"):
        return "star"          # 科创板
    if code.startswith(("300", "301")):
        return "chinext"       # 创业板
    return "main"


def limit_pct(code: str, is_st: bool) -> float:
    """涨跌幅限制。科创板、创业板 20%（含 ST）；主板 10%，主板 ST 5%。"""
    if board(code) in ("star", "chinext"):
        return 0.20
    return 0.05 if is_st else 0.10


def limit_prices(code: str, prev_close: float, is_st: bool) -> tuple[float, float]:
    """涨停价、跌停价：前收 × (1 ± 幅度)，四舍五入到分。"""
    p = limit_pct(code, is_st)
    q = Decimal("0.01")
    up = Decimal(str(prev_close)) * Decimal(str(1 + p))
    down = Decimal(str(prev_close)) * Decimal(str(1 - p))
    return float(up.quantize(q, ROUND_HALF_UP)), float(down.quantize(q, ROUND_HALF_UP))


def buy_shares(code: str, shares: float) -> int:
    """把想买的股数向下取到可成交的数量。主板、创业板 100 股一手；科创板至少 200 股，之后按 1 股递增。"""
    if shares <= 0:
        return 0
    if board(code) == "star":
        return int(shares) if shares >= 200 else 0
    return int(shares // 100) * 100


def sell_shares(code: str, held: float, shares: float) -> float:
    """可卖出的股数。清仓时零股可一次卖出；部分卖出按买入的单位取整，且不能留下不足最小单位的零股（科创板）。"""
    if shares <= 0:
        return 0.0
    if shares >= held - 1e-9:
        return held
    if board(code) == "star":
        n = int(shares)
        if held - n < 200:          # 剩下不足 200 股就一并卖出
            return held
        return float(n)
    return float(int(shares // 100) * 100)
