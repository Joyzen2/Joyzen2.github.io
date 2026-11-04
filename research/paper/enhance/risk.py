"""简化版 Barra 风险模型（参照 CNE5 的结构），移植自中证500 研究。

r_i = Σ_k X_ik f_k + u_i
  X：月末计算的暴露（10 个风格 + 申万一级行业哑变量），到下个月末前不变
  f：因子收益，每个交易日对估计池做加权最小二乘（权重 = √流通市值）
  u：特质收益

组合风险 = (X'h)' F (X'h) + Σ h_i² D_i
  F：因子协方差，日度因子收益的 EWMA（半衰期 90 日，窗口 504 日）+ Newey-West（2 阶滞后），× 21 换成月度
  D：特质方差，日度残差平方的 EWMA（半衰期 42 日，窗口 252 日），向同市值十分位的均值收缩 30%
  再乘波动率状态调整（VRA）的乘数。

只用 t 及以前的数据估计 t 时刻的 F、D。

和研究的不同：研究的估计池是全市场流通市值前 2000 只，这里是传入的股票池（默认当期中证500 成分）。
风格暴露按估计池标准化，所以 ±0.10、±0.50 这些带宽的含义和研究不完全相同。
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import industry as ind_mod
from preprocess import winsorize_mad

STYLES = ["size", "beta", "momentum", "resvol", "nlsize", "btop", "liquidity", "earnyield", "growth", "leverage"]
HL_FACTOR, WIN_FACTOR, NW_LAGS = 90, 504, 2
HL_SPEC, WIN_SPEC, SPEC_SHRINK = 42, 252, 0.3
VRA_HL = 42


def _cap_std(x: pd.Series, cap: pd.Series) -> pd.Series:
    """Barra 口径：市值加权均值为 0，等权标准差为 1。"""
    x = winsorize_mad(x)
    w = cap.reindex(x.index)
    ok = x.notna() & w.notna()
    if ok.sum() < 2:
        return x * np.nan
    mu = (x[ok] * w[ok]).sum() / w[ok].sum()
    sd = x[ok].std()
    return (x - mu) / sd if sd > 0 else x * 0


def _orth(y: pd.Series, X: pd.DataFrame, w: pd.Series) -> pd.Series:
    ok = y.notna() & X.notna().all(axis=1)
    sw = np.sqrt(w[ok].to_numpy())
    beta, *_ = np.linalg.lstsq(X[ok].to_numpy() * sw[:, None], y[ok].to_numpy() * sw, rcond=None)
    out = y.copy()
    out[ok] = y[ok] - X[ok].to_numpy() @ beta
    return out


def exposures_at(date: pd.Timestamp, f: pd.DataFrame, hist: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """返回 (风格暴露, 行业, 流通市值)，股票 = 当月估计池。"""
    raw = f.loc[date]
    cap = np.exp(raw["size"].astype("float64"))
    estu = cap.dropna().index
    raw = raw.loc[estu].astype("float64")
    cap = cap.loc[estu]
    z = lambda s: _cap_std(s, cap)                       # noqa: E731
    X = pd.DataFrame(index=estu)
    X["size"] = z(raw["size"])
    X["beta"] = z(raw["beta_1y"])
    X["momentum"] = z(raw["mom_12_1"])
    rv = pd.concat([z(raw["vol_3m"]), z(raw["ivol_1m"])], axis=1).mean(axis=1)
    X["resvol"] = z(_orth(rv, X[["beta", "size"]].fillna(0), cap))
    X["nlsize"] = z(_orth(X["size"] ** 3, X[["size"]], cap))
    X["btop"] = z(raw["bp"])
    liq = pd.concat([z(np.log(raw["turn_1m"].clip(lower=1e-4))), z(np.log(raw["turn_3m"].clip(lower=1e-4)))], axis=1).mean(axis=1)
    X["liquidity"] = z(_orth(liq, X[["size"]], cap))
    X["earnyield"] = z(pd.concat([z(raw["ep_ttm"]), z(raw["cfp_ttm"])], axis=1).mean(axis=1))
    X["growth"] = z(pd.concat([z(raw["np_q_yoy"]), z(raw["rev_q_yoy"])], axis=1).mean(axis=1))
    X["leverage"] = z(raw["leverage"])
    ind = ind_mod.at(hist, date).reindex(estu).fillna("NA")
    # 缺失暴露用行业中位数补，再缺用 0（即市值加权均值）
    X = X.apply(lambda s: s.fillna(s.groupby(ind).transform("median"))).fillna(0.0)
    return X, ind, cap


def _wls(y: np.ndarray, A: np.ndarray, w: np.ndarray):
    sw = np.sqrt(w)
    coef, *_ = np.linalg.lstsq(A * sw[:, None], y * sw, rcond=None)
    return coef, y - A @ coef


def estimate(pn, f: pd.DataFrame, month_ends: list[pd.Timestamp], hist: pd.DataFrame) -> dict:
    """逐日回归：返回 {'factor_ret': 日 × 因子, 'resid': 日 × 股票, 'exposures': {月末: (X, ind, cap)}}。"""
    dates = set(f.index.get_level_values(0))
    expo = {t: exposures_at(t, f, hist) for t in month_ends if t in dates}
    ret = pn.returns().where(pn.fresh_mask())
    days = ret.index
    f_rows, u_rows = {}, {}
    months = sorted(expo)
    for t0, t1 in zip(months, months[1:] + [days[-1] + pd.Timedelta(days=1)]):
        X, ind, cap = expo[t0]
        D = pd.get_dummies(ind, prefix="ind", dtype="float64")
        A_full = pd.concat([X, D], axis=1)
        block = ret.loc[(days > t0) & (days <= t1), A_full.index]
        for d, r in block.iterrows():
            ok = r.notna().to_numpy()
            if ok.sum() < 200:
                continue
            A = A_full.to_numpy()[ok]
            keep = A.any(axis=0)                       # 当天没有股票的行业列去掉，防奇异
            coef, u = _wls(r.to_numpy()[ok], A[:, keep], np.sqrt(cap.to_numpy()[ok]))
            f_rows[d] = pd.Series(coef, index=A_full.columns[keep])
            u_rows[d] = pd.Series(u, index=A_full.index[ok])
    fr = pd.DataFrame(f_rows).T.sort_index()
    resid = pd.DataFrame(u_rows).T.sort_index().astype("float64")
    return {"factor_ret": fr, "resid": resid, "exposures": expo}


def _ewma_weights(n: int, hl: float) -> np.ndarray:
    w = 0.5 ** (np.arange(n)[::-1] / hl)
    return w / w.sum()


def ewma_cov(x: np.ndarray, hl: float, nw_lags: int = 0) -> np.ndarray:
    """日度收益矩阵 x（T × K，可含 NaN）的 EWMA 协方差，成对可用样本，带 Newey-West 调整。"""
    n = len(x)
    w = _ewma_weights(n, hl)
    obs = np.isfinite(x)
    x0 = np.where(obs, x, 0.0)
    mu = (w[:, None] * x0).sum(0) / np.maximum((w[:, None] * obs).sum(0), 1e-300)
    d = np.where(obs, x - mu, 0.0)
    sw = np.sqrt(w)[:, None]
    C = (d * sw).T @ (d * sw) / np.maximum((obs * sw).T @ (obs * sw), 1e-300)
    for lag in range(1, nw_lags + 1):
        s_lag = np.sqrt(w[lag:])[:, None]
        num = (d[lag:] * s_lag).T @ (d[:-lag] * s_lag)
        den = (obs[lag:] * s_lag).T @ (obs[:-lag] * s_lag)
        G = num / np.maximum(den, 1e-300)
        C = C + (1 - lag / (nw_lags + 1)) * (G + G.T)
    return C


def factor_cov(fr: pd.DataFrame, date: pd.Timestamp, cols: list[str]) -> pd.DataFrame:
    """t 时刻的月度因子协方差（只用 t 及以前的日度因子收益）。"""
    hist = fr.loc[:date].iloc[-WIN_FACTOR:].reindex(columns=cols)
    x = hist.to_numpy(dtype="float64")
    C = pd.DataFrame(ewma_cov(x, HL_FACTOR, NW_LAGS) * 21, index=cols, columns=cols)
    # 历史太短的行业：方差用其他行业的中位数，相关为 0
    cnt = pd.Series(np.isfinite(x).sum(0), index=cols)
    short = cnt[cnt < 60].index
    if len(short):
        ind_cols = [c for c in cols if c.startswith("ind_") and c not in short]
        med = np.median(np.diag(C.loc[ind_cols, ind_cols])) if ind_cols else np.median(np.diag(C))
        for c in short:
            C.loc[c, :] = 0.0
            C.loc[:, c] = 0.0
            C.loc[c, c] = med
    vals, vecs = np.linalg.eigh(C.to_numpy())
    C = vecs @ np.diag(np.clip(vals, 1e-10, None)) @ vecs.T
    return pd.DataFrame(C, index=cols, columns=cols)


def specific_var(resid: pd.DataFrame, date: pd.Timestamp, codes: pd.Index, cap: pd.Series) -> pd.Series:
    """t 时刻的月度特质方差。历史不足 63 日的股票用同市值十分位的中位数。"""
    hist = resid.loc[:date].iloc[-WIN_SPEC:].reindex(columns=codes).astype("float64")
    w = _ewma_weights(len(hist), HL_SPEC)
    x = hist.to_numpy()
    obs = np.isfinite(x)
    v = (w[:, None] * np.where(obs, x * x, 0)).sum(0) / np.maximum((w[:, None] * obs).sum(0), 1e-12)
    v = pd.Series(v * 21, index=codes)
    v[obs.sum(0) < 63] = np.nan
    dec = pd.qcut(cap.reindex(codes).rank(method="first"), 10, labels=False)
    prior = dec.map(v.groupby(dec).median())
    v = v.fillna(prior)
    v = (1 - SPEC_SHRINK) * v + SPEC_SHRINK * prior
    return v.fillna(v.median())


def vra_lambda(x: pd.DataFrame, hl_var: float, hl_vra: float = VRA_HL) -> pd.Series:
    """每天的 λ = √EWMA(截面平均 z²)，z = 当天收益 / 前一天预测的波动，|z| > 5 截断。"""
    x = x.astype("float64")
    var = (x ** 2).ewm(halflife=hl_var, min_periods=63).mean().shift(1)
    b2 = (x ** 2 / var).clip(upper=25).mean(axis=1, skipna=True)
    return np.sqrt(b2.ewm(halflife=hl_vra, min_periods=21).mean())


class RiskModel:
    """t 时刻的风险模型快照，供优化器使用。"""

    def __init__(self, date: pd.Timestamp, est: dict, hist: pd.DataFrame):
        X, ind, cap = est["exposures"][date]
        D = pd.get_dummies(ind, prefix="ind", dtype="float64")
        self.date = date
        self.hist = hist
        self.X = pd.concat([X, D], axis=1)
        self.styles = list(X.columns)
        self.industries = list(D.columns)
        self.F = factor_cov(est["factor_ret"], date, list(self.X.columns))
        self.spec = specific_var(est["resid"], date, self.X.index, cap)
        self.cap = cap
        lam_f = vra_lambda(est["factor_ret"], HL_FACTOR)
        lam_s = vra_lambda(est["resid"], HL_SPEC)
        lf = float(lam_f.loc[:date].dropna().iloc[-1]) if lam_f.loc[:date].notna().any() else 1.0
        ls = float(lam_s.loc[:date].dropna().iloc[-1]) if lam_s.loc[:date].notna().any() else 1.0
        self.F = self.F * lf ** 2
        self.spec = self.spec * ls ** 2
        self.vra = (lf, ls)

    def exposures(self, codes) -> pd.DataFrame:
        """不在估计池里的股票（当天停牌或上市不足 120 日）：风格暴露取 0，行业按当时归属。"""
        X = self.X.reindex(codes)
        miss = X.isna().all(axis=1)
        if miss.any():
            ind = ind_mod.at(self.hist, self.date).reindex(X.index[miss]).fillna("NA")
            X.loc[miss, self.styles] = 0.0
            X.loc[miss, self.industries] = 0.0
            for c, i in ind.items():
                col = f"ind_{i}"
                if col in X.columns:
                    X.loc[c, col] = 1.0
        return X.fillna(0.0)

    def specific(self, codes) -> pd.Series:
        s = self.spec.reindex(codes)
        return s.fillna(self.spec.quantile(0.75))     # 池外股票保守地取偏高的特质方差
