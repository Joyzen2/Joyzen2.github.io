"""把研究的月频 ICIR 信号接到模拟实盘：月末最后一个交易日收盘后，产出下一期目标权重。

流程：取数 → 财报时点快照 → 37 个因子 → 成分股内打分 → ICIR 合成 → 风险模型 → 组合优化 → 检查。

state/ic_history.csv  已实现的月度 Rank IC（初始来自研究，到 2026-07；之后持有期结束才追加）
state/te_log.csv      每期预测跟踪误差和实现的「主动收益 / 预测 TE」（初始来自用同样约束跑的回测），滚动偏差校准用
试运行（--dry-run）只读这两个文件，追加的内容不落盘。
"""
from __future__ import annotations

import datetime as dt
import json

import numpy as np
import pandas as pd

from paper import config as C

import benchmark
import combine
import factors
import fetch
import fundamentals
import industry as ind_mod
import optimize
import risk
import scores
from panel import Panel

RISK_HISTORY_DAYS = 800          # 504 日因子协方差窗口 + 最早一个月末暴露需要的 240 日
FIN_START = "2022-12-31"         # 最早用到的报告期：SUE 要约 12 个季度，TTM 与同比再往前
CALIB_MIN, CALIB_WIN, CALIB_RANGE = 12, 36, (0.8, 1.6)
IC_FILE = C.STATE / "ic_history.csv"
TE_FILE = C.STATE / "te_log.csv"


def _periods(day: dt.date) -> list[str]:
    return [d.strftime("%Y-%m-%d") for d in pd.date_range(FIN_START, day, freq="QE")]


def calibration(z_hist: list[float]) -> float:
    """滚动偏差校准系数：已实现的「主动收益 / 预测 TE」的标准差。不足 1 年不校准。"""
    if len(z_hist) < CALIB_MIN:
        return 1.0
    return float(np.clip(np.std(z_hist[-CALIB_WIN:], ddof=1), *CALIB_RANGE))


def _load_ic() -> pd.DataFrame:
    return pd.read_csv(IC_FILE, index_col="date", parse_dates=["date"]).sort_index()


def _update_ic(ic: pd.DataFrame, f, pn, members, hist, months) -> tuple[pd.DataFrame, list[str]]:
    """持有期已经结束、但还没进历史的信号日，算出 Rank IC 追加。成分用当前名单，半年调样一次，中间几个月基本不变。"""
    added = []
    done = set(ic.index)
    codes = list(members["code"])
    for s, s_next in zip(months[:-1], months[1:]):
        if s in done or s <= ic.index.max():
            continue
        start, end = scores.execution_day(pn.days, s), scores.execution_day(pn.days, s_next)
        if start is None or end is None:
            continue
        z, v = scores.cross_section(f, s, codes, ind_mod.at(hist, s))
        fwd = scores.forward_return(pn, start, end)
        ic.loc[s] = {c: scores.rank_ic(z[c].where(v[c]), fwd) for c in ic.columns}
        added.append(s.strftime("%Y-%m-%d"))
    return ic.sort_index(), added


def _update_te_log(log: pd.DataFrame, pn, members) -> pd.DataFrame:
    """前一期已走完的信号补上实现的 z：组合和基准都从该信号的执行日开盘持有到下一信号的执行日开盘。"""
    signals = sorted(p.stem for p in (C.STATE / "signals").glob("*.json"))
    for s, s_next in zip(signals[:-1], signals[1:]):
        t = pd.Timestamp(s)
        if t not in log.index or pd.notna(log.at[t, "z"]):
            continue
        start, end = scores.execution_day(pn.days, t), scores.execution_day(pn.days, pd.Timestamp(s_next))
        if start is None or end is None:
            continue
        w = pd.Series(json.loads((C.STATE / "signals" / f"{s}.json").read_text(encoding="utf-8"))["weights"], dtype="float64")
        r = scores.forward_return(pn, start, end)
        gross = float((w * r.reindex(w.index).fillna(0.0)).sum())
        b = members.set_index("code")["weight"].astype("float64")
        bench = float(((b / b.sum()) * r.reindex(b.index).fillna(0.0)).sum())
        log.at[t, "z"] = (gross - bench) / (log.at[t, "pred_te"] / np.sqrt(12))
    return log


def monthly_target(day: dt.date, data, holdings: dict[str, float], dry_run: bool = False) -> pd.DataFrame:
    """月末最后一个交易日收盘后，返回下一期的目标权重：code、weight、score、industry。试运行不写回状态文件。"""
    t = pd.Timestamp(day)
    members = data.members(day)
    codes = sorted(set(members["code"]) | set(holdings))
    pn = Panel(data, codes, day, RISK_HISTORY_DAYS)
    hist = ind_mod.history(data)

    ix = data.index_close("000985", pn.days[0].date(), day)
    ix.index = pd.to_datetime(list(ix.index))
    mkt = ix.reindex(pn.days).ffill().pct_change()

    rec = fundamentals.load_records(data, _periods(day), set(codes))
    rec = fundamentals.derive(rec, pn.load("total_shares"))
    usable = pn.days[239:]                                # 240 日窗口算得满的月末才用来估风险模型
    months = [m for m in pn.month_ends() if m in usable and m < t]
    dates = pd.DatetimeIndex(months + [t])
    snap = fundamentals.snapshot(rec, dates)
    f = factors.compute(data, pn, snap, dates, mkt)

    ic = _load_ic()
    ic, added = _update_ic(ic, f, pn, members, hist, months + [t])
    w_icir = combine.icir_weights(ic, t)

    z, valid = scores.cross_section(f, t, list(members["code"]), ind_mod.at(hist, t))
    score = combine.composite(z, w_icir)
    score = score.drop(pn.no_factor, errors="ignore")      # 没有复权因子的股票（新浪不提供 689xxx）日跑记不了账，不进候选

    est = risk.estimate(pn, f, list(dates), hist)
    rm = risk.RiskModel(t, est, hist)

    bench = benchmark.drifted_weights(members, pn.load("close"), t)
    held = pd.Series(holdings, dtype="float64")
    w0 = pd.Series(dtype="float64")
    if len(held):
        px = pn.load("raw_close").ffill().iloc[-1].reindex(held.index)
        w0 = (held * px).dropna()
        w0 = w0 / w0.sum()

    te_log = pd.read_csv(TE_FILE, index_col="date", parse_dates=["date"]).sort_index() if TE_FILE.exists() \
        else pd.DataFrame(columns=["pred_te", "z"], index=pd.DatetimeIndex([], name="date"), dtype="float64")
    te_log = _update_te_log(te_log, pn, members)
    b = calibration(te_log["z"].dropna().tolist())
    cfg = optimize.OptConfig(te=C.TE_CAP / b, stock_cap=C.STOCK_CAP, ind_tol=C.INDUSTRY_BAND, size_tol=C.SIZE_BAND,
                             style_tol=C.STYLE_BAND, turnover=C.TURNOVER_CAP, candidates=C.CANDIDATES,
                             min_weight=C.MIN_WEIGHT)
    res = optimize.optimize(score, bench, w0, rm, cfg)
    weights = res.weights

    # 返回前自己检查行业偏离和风格暴露
    ind_now = ind_mod.at(hist, t)
    port = weights.groupby(ind_now.reindex(weights.index).fillna("NA")).sum()
    base = bench.groupby(ind_now.reindex(bench.index).fillna("NA")).sum()
    gap = port.sub(base, fill_value=0.0).sort_values()
    over = gap[gap.abs() > C.INDUSTRY_BAND + 1e-5]
    if len(over):
        raise ValueError("行业偏离超限：" + "，".join(f"{ind_mod.L1_NAMES.get(k, k)} {v:.2%}" for k, v in over.items()))

    diag = {
        "date": day.isoformat(), "holdings": int(len(weights)), "max_weight": float(weights.max()),
        "min_weight": float(weights.min()), "pred_te": res.pred_te, "te_cap_after_calibration": cfg.te, "calibration": b,
        "status": res.status, "relaxed": res.relaxed, "te_floor": res.te_floor, "resolved": res.resolved, "max_violation": res.max_violation,
        "vra": list(rm.vra), "estimation_universe": int(rm.X.shape[0]), "factor_days": int(len(est["factor_ret"])),
        "industry_active": {ind_mod.L1_NAMES.get(k, k): float(v) for k, v in gap.items()},
        "style_active": {k: float(res.active_expo[k]) for k in rm.styles},
        "icir_weights": {k: float(v) for k, v in w_icir.items()},
        "ic_rows": int(len(ic)), "ic_added": added, "ic_last": ic.index.max().strftime("%Y-%m-%d"),
        "missing_codes": pn.missing, "no_factor_codes": pn.no_factor, "scored": int(len(z)),
        "coverage": {c: float(valid[c].mean()) for c in valid.columns},
    }
    out_dir = C.CACHE / "diag"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{day.isoformat()}.json").write_text(json.dumps(diag, ensure_ascii=False, indent=1), encoding="utf-8")
    print("信号诊断：" + json.dumps({k: diag[k] for k in ("holdings", "max_weight", "pred_te", "calibration", "relaxed", "te_floor", "resolved", "max_violation", "scored", "ic_added")}, ensure_ascii=False), flush=True)

    if not dry_run:
        ic.reset_index(names="date").to_csv(IC_FILE, index=False)
        te_log.loc[t, ["pred_te", "z"]] = [res.pred_te, np.nan]
        te_log.reset_index(names="date").to_csv(TE_FILE, index=False)

    return pd.DataFrame({"code": weights.index, "weight": weights.values,
                         "score": score.reindex(weights.index).values,
                         "industry": ind_now.reindex(weights.index).values})
