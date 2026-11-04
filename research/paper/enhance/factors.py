"""月频 37 个因子，定义移植自中证500 研究。

在每个信号日 t 用 t 及以前的数据计算。量价因子在日频宽表上按窗口计算后取信号日那一行；
基本面因子用财报时点快照，估值类分母用 t 日的总市值（取不到时用流通市值）。

和研究的两处不同：
- 市场收益用中证全指（000985）。研究用全市场流通市值加权，那要取全市场数千只股票的行情；
- 现金分红来自东财分红配送表，研究来自通达信除权除息记录。
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

MIN_LISTED_DAYS = 120

# name: (类别, 中文说明)
SPEC: dict[str, tuple[str, str]] = {
    "size":         ("规模", "流通市值对数"),
    "ret_1w":       ("反转", "过去 5 日收益"),
    "ret_1m":       ("反转", "过去 20 日收益"),
    "mom_6_1":      ("动量", "t-120 到 t-20 日收益"),
    "mom_12_1":     ("动量", "t-240 到 t-20 日收益"),
    "high52":       ("动量", "收盘价 / 过去 240 日最高价"),
    "vol_1m":       ("波动", "20 日收益标准差"),
    "vol_3m":       ("波动", "60 日收益标准差"),
    "ivol_1m":      ("波动", "20 日对市场回归的残差波动"),
    "beta_1y":      ("波动", "240 日对市场的贝塔"),
    "max_1m":       ("波动", "20 日最大单日收益"),
    "skew_1m":      ("波动", "20 日收益偏度"),
    "turn_1m":      ("流动性", "20 日平均换手率"),
    "turn_3m":      ("流动性", "60 日平均换手率"),
    "abn_turn":     ("流动性", "20 日换手 / 240 日换手"),
    "turn_std_1m":  ("流动性", "20 日换手率标准差"),
    "amihud_1m":    ("流动性", "20 日 |收益|/成交额 均值"),
    "pv_corr_1m":   ("量价", "20 日收盘价与成交额相关系数"),
    "range_1m":     ("量价", "20 日平均振幅"),
    "overnight_1m": ("量价", "20 日隔夜收益之和"),
    "intraday_1m":  ("量价", "20 日日内收益之和"),
    "limit_up_1m":  ("量价", "20 日涨停收盘次数"),
    "ep_ttm":       ("估值", "TTM 归母净利润 / 总市值"),
    "bp":           ("估值", "归母净资产 / 总市值"),
    "sp_ttm":       ("估值", "TTM 营业总收入 / 总市值"),
    "cfp_ttm":      ("估值", "TTM 经营现金流 / 总市值"),
    "dy_12m":       ("估值", "过去 12 个月现金分红 / 总市值"),
    "roe_ttm":      ("质量", "TTM 归母净利润 / 平均归母净资产"),
    "roa_ttm":      ("质量", "TTM 归母净利润 / 总资产"),
    "gpm":          ("质量", "TTM 毛利率"),
    "leverage":     ("质量", "总负债 / 总资产"),
    "accruals":     ("质量", "(TTM 净利润 - TTM 经营现金流) / 总资产"),
    "np_q_yoy":     ("成长", "单季归母净利润同比"),
    "rev_q_yoy":    ("成长", "单季营收同比"),
    "sue":          ("成长", "标准化预期外盈余"),
    "delta_roe":    ("成长", "ROE 同比变化"),
    "asset_growth": ("成长", "总资产同比增速"),
}
NAMES = list(SPEC)
FUNDAMENTAL_NAMES = ["ep_ttm", "bp", "sp_ttm", "cfp_ttm", "dy_12m", "roe_ttm", "roa_ttm", "gpm", "leverage",
                     "accruals", "np_q_yoy", "rev_q_yoy", "sue", "delta_roe", "asset_growth"]


class _Windows:
    """在每个信号日直接切出最近 n 个交易日的窗口，用 numpy 算统计量（不用 pandas.rolling，避免累加误差）。"""

    def __init__(self, index: pd.DatetimeIndex, dates: pd.DatetimeIndex):
        self.dates = dates
        self.pos = index.get_indexer(dates)

    def _iter(self, arrays, n):
        for i, p in enumerate(self.pos):
            if p < 0:
                continue
            lo = max(0, p - n + 1)
            yield i, [a[lo:p + 1] for a in arrays]

    def stat(self, df: pd.DataFrame, n: int, minp: int, fn) -> pd.DataFrame:
        a = df.to_numpy(dtype="float64")
        out = np.full((len(self.dates), a.shape[1]), np.nan)
        for i, (w,) in self._iter([a], n):
            cnt = np.isfinite(w).sum(0)
            with np.errstate(all="ignore"), warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                v = fn(w, cnt)
            out[i] = np.where(cnt >= minp, v, np.nan)
        return pd.DataFrame(out, index=self.dates, columns=df.columns)

    def corr(self, x: pd.DataFrame, y: pd.DataFrame, n: int, minp: int) -> pd.DataFrame:
        a, b = x.to_numpy(dtype="float64"), y.to_numpy(dtype="float64")
        out = np.full((len(self.dates), a.shape[1]), np.nan)
        for i, (wa, wb) in self._iter([a, b], n):
            ok = np.isfinite(wa) & np.isfinite(wb)
            wa, wb = np.where(ok, wa, np.nan), np.where(ok, wb, np.nan)
            with np.errstate(all="ignore"), warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                da, db = wa - np.nanmean(wa, 0), wb - np.nanmean(wb, 0)
                c = np.nanmean(da * db, 0) / np.sqrt(np.nanmean(da * da, 0) * np.nanmean(db * db, 0))
            out[i] = np.where(ok.sum(0) >= minp, c, np.nan)
        return pd.DataFrame(out, index=self.dates, columns=x.columns)

    def beta_resid(self, r: pd.DataFrame, m: pd.Series, n: int, minp: int):
        a = r.to_numpy(dtype="float64")
        mv = m.reindex(r.index).to_numpy(dtype="float64")[:, None]
        beta = np.full((len(self.dates), a.shape[1]), np.nan)
        resid = beta.copy()
        for i, (wa, wm) in self._iter([a, mv], n):
            ok = np.isfinite(wa) & np.isfinite(wm)
            wa = np.where(ok, wa, np.nan)
            wm = np.where(ok, np.broadcast_to(wm, wa.shape), np.nan)
            with np.errstate(all="ignore"), warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                da, dm = wa - np.nanmean(wa, 0), wm - np.nanmean(wm, 0)
                var_m = np.nanmean(dm * dm, 0)
                b = np.nanmean(da * dm, 0) / var_m
                rv = np.clip(np.nanmean(da * da, 0) - b * b * var_m, 0, None)
            enough = ok.sum(0) >= minp
            beta[i] = np.where(enough, b, np.nan)
            resid[i] = np.where(enough, np.sqrt(rv), np.nan)
        mk = lambda x: pd.DataFrame(x, index=self.dates, columns=r.columns)  # noqa: E731
        return mk(beta), mk(resid)


def _mean(w, c):
    return np.nanmean(w, 0)


def _std(w, c):
    return np.nanstd(w, 0, ddof=1)


def _max(w, c):
    return np.nanmax(w, 0)


def _sum(w, c):
    return np.nansum(w, 0)


def _skew(w, c):
    """样本偏度（与 pandas / scipy bias=False 同一公式）。"""
    d = w - np.nanmean(w, 0)
    m2 = np.nanmean(d * d, 0)
    m3 = np.nanmean(d ** 3, 0)
    g1 = m3 / m2 ** 1.5
    return np.where(m2 > 0, g1 * np.sqrt(c * (c - 1)) / (c - 2), np.nan)


def price_volume(pn, dates: pd.DatetimeIndex, mkt: pd.Series) -> dict[str, pd.DataFrame]:
    """量价因子，返回 {因子名: 信号日 × 股票 宽表}。mkt：市场日收益。"""
    close, open_, high, low = pn.load("close"), pn.load("open"), pn.load("high"), pn.load("low")
    amount, turn, fcap, lim_up = pn.load("amount"), pn.load("turnover"), pn.load("float_mcap"), pn.load("limit_up")
    ret = pn.returns()
    fresh = pn.fresh_mask()
    listed = pn.listed_days()
    r1 = ret.where(fresh)                          # 只用真正的单日收益算波动类
    px = close.ffill(limit=10)                     # 短暂停牌用最后价，长期停牌作废
    W = _Windows(close.index, dates)

    out: dict[str, pd.DataFrame] = {}
    at = lambda x: x.reindex(dates)                # noqa: E731

    out["size"] = at(np.log(fcap))
    out["ret_1w"] = at(px / px.shift(5) - 1)
    out["ret_1m"] = at(px / px.shift(20) - 1)
    out["mom_6_1"] = at(px.shift(20) / px.shift(120) - 1)
    out["mom_12_1"] = at(px.shift(20) / px.shift(240) - 1)
    out["high52"] = at(px) / W.stat(close, 240, 120, _max)
    out["vol_1m"] = W.stat(r1, 20, 15, _std)
    out["vol_3m"] = W.stat(r1, 60, 40, _std)
    _, out["ivol_1m"] = W.beta_resid(r1, mkt, 20, 15)
    out["beta_1y"], _ = W.beta_resid(r1, mkt, 240, 120)
    out["max_1m"] = W.stat(r1, 20, 15, _max)
    out["skew_1m"] = W.stat(r1, 20, 15, _skew)
    out["turn_1m"] = W.stat(turn, 20, 15, _mean)
    out["turn_3m"] = W.stat(turn, 60, 40, _mean)
    out["abn_turn"] = out["turn_1m"] / W.stat(turn, 240, 120, _mean)
    out["turn_std_1m"] = W.stat(turn, 20, 15, _std)
    out["amihud_1m"] = W.stat(r1.abs() / amount.where(amount > 0) * 1e8, 20, 15, _mean)
    out["pv_corr_1m"] = W.corr(close, amount, 20, 15)
    prev_close = close.ffill().shift(1)
    out["range_1m"] = W.stat((high - low) / prev_close, 20, 15, _mean)
    on = np.log(open_ / prev_close).where(fresh)
    intra = np.log(close / open_)
    out["overnight_1m"] = W.stat(on, 20, 15, _sum)
    out["intraday_1m"] = W.stat(intra, 20, 15, _sum)
    out["limit_up_1m"] = W.stat(lim_up, 20, 15, _sum)

    # 上市不满 MIN_LISTED_DAYS 或当天没成交的股票不参与（新股连板、停牌股会污染截面）
    ok = at((listed >= MIN_LISTED_DAYS) & close.notna())
    return {k: v.where(ok) for k, v in out.items()}


def dividends_12m(data, dates: pd.DatetimeIndex, shares: pd.DataFrame) -> pd.DataFrame:
    """过去 365 天的现金分红总额（元），信号日 × 股票。"""
    first, last = dates.min() - pd.Timedelta(days=800), dates.max()
    periods = [d.strftime("%Y%m%d") for d in pd.date_range(first, last, freq="QE") if d.month in (3, 6, 9, 12)]
    dv = pd.concat([data.dividends(p) for p in periods], ignore_index=True)
    dv = dv[(dv.cash_per_10 > 0) & dv.ex_date.notna()].drop_duplicates(["code", "ex_date", "cash_per_10"])
    filled = shares.ffill()
    dv = dv[dv.code.isin(filled.columns) & (dv.ex_date > first)]
    pos = filled.index.searchsorted(dv.ex_date, side="right") - 1
    amount = []
    for c, p, v in zip(dv.code, pos, dv.cash_per_10):
        s = filled.iloc[p][c] if 0 <= p and c in filled.columns else np.nan
        amount.append(v / 10 * s)
    dv = dv.assign(cash=amount)
    out = {}
    for d in dates:
        win = dv[(dv.ex_date > d - pd.Timedelta(days=365)) & (dv.ex_date <= d)]
        out[d] = win.groupby("code")["cash"].sum()
    return pd.DataFrame(out).T


def fundamental(data, pn, snap: pd.DataFrame, dates: pd.DatetimeIndex, eligible: pd.DataFrame) -> dict[str, pd.DataFrame]:
    tm, fm = pn.load("total_mcap").reindex(dates), pn.load("float_mcap").reindex(dates)
    mcap = tm.where(tm.notna(), fm)

    def wide(col):
        return snap[col].unstack("code").reindex(index=dates, columns=mcap.columns)

    out = {
        "ep_ttm": wide("np_ttm") / mcap,
        "bp": wide("equity_parent") / mcap,
        "sp_ttm": wide("rev_ttm") / mcap,
        "cfp_ttm": wide("ocf_ttm") / mcap,
        "dy_12m": dividends_12m(data, dates, pn.load("total_shares")).reindex(index=dates, columns=mcap.columns).fillna(0.0) / mcap,
    }
    for col in ("roe_ttm", "roa_ttm", "gpm", "leverage", "accruals", "np_q_yoy", "rev_q_yoy",
                "sue", "delta_roe", "asset_growth"):
        out[col] = wide(col)
    return {k: v.where(eligible) for k, v in out.items()}


def compute(data, pn, snap: pd.DataFrame, dates: pd.DatetimeIndex, mkt: pd.Series) -> pd.DataFrame:
    """long 表：index=(date, code)，列=NAMES 里的因子。"""
    pv = price_volume(pn, dates, mkt)
    cols = pv["size"].columns
    eligible = pv["size"].notna()
    fd = fundamental(data, pn, snap, dates, eligible)
    wide = {**pv, **fd}
    r, c = np.nonzero(wide["size"].reindex(index=dates, columns=cols).notna().to_numpy())
    index = pd.MultiIndex.from_arrays([dates[r], cols[c]], names=["date", "code"])
    table = {k: wide[k].reindex(index=dates, columns=cols).to_numpy(dtype="float64")[r, c] for k in NAMES}
    return pd.DataFrame(table, index=index).replace([np.inf, -np.inf], np.nan)
