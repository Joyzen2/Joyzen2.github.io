"""组合优化（cvxpy + CLARABEL），移植自中证500 研究，约束改成模拟实盘的设置。

  max   α'w − λ·(w−b)'Σ(w−b) − κ·‖w − w₀‖₁
  s.t.  Σw = 1,  0 ≤ w ≤ 个股上限（只在候选池里）        只做多；不在候选池的股票权重为 0
        |X_ind'(w−b)| ≤ ind_tol                      行业主动暴露
        |X_style'(w−b)| ≤ style_tol（规模类更紧）       风格主动暴露
        ‖w − w₀‖₁ ≤ 2·turnover                        单边换手上限
        (w−b)'Σ(w−b) ≤ TE² / 12                       跟踪误差（月度方差）
  Σ = X F X' + diag(D)，不显式构造 n×n 矩阵：风险 = ‖Lᵀ X'(w−b)‖² + Σ D_i (w_i−b_i)²

α 按 Grinold 公式把分数换成收益：α_i = IC × σ_i × z_i（σ_i 为月度特质波动），IC 取 0.05。
w₀ 是上期持仓漂移到今天的权重，κ 是单边交易成本。

和研究的区别只有组合构建：
- 个股上限从「基准权重 + 0.8%」改成绝对 2%，行业主动暴露从 ±1% 改成 ±3%；
- 候选池：分数最高的前 N 只 + 仍在指数里的现有持仓，其余权重为 0；
- 求解后剔除低于最小权重的股票再归一。归一后如果任何约束被破坏，就固定这批股票
  （每只不低于最小权重）在同样的约束下再解一次；解不出时补进第一轮权重最大的落选股票，
  优先补缺口超限的行业。仍解不出才保留第一轮的小权重，硬约束优先于最小权重。
- 无解时的放宽顺序：先放开换手（调出指数的股票必须卖）；还不行，就先解出这组约束下能达到的最低跟踪误差，
  上限放到它的 1.05 倍。持仓集中后最低可达的跟踪误差可能高于上限；研究里直接去掉上限，这里那样做预测跟踪误差会跳到 10% 左右。
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass

import cvxpy as cp
import numpy as np
import pandas as pd


@dataclass(frozen=True)
class OptConfig:
    te: float = 0.05               # 年化跟踪误差上限（调用方先除以滚动偏差校准系数）
    stock_cap: float = 0.02        # 个股权重上限
    ind_tol: float = 0.03          # 申万一级行业主动暴露
    size_tol: float = 0.10         # 规模、非线性规模
    style_tol: float = 0.50        # 其余风格
    turnover: float = 0.30         # 单边换手上限
    risk_aversion: float = 1.0
    cost: float = 0.0015           # 单边成本，进目标函数
    ic: float = 0.05
    candidates: int = 160          # 候选池：分数最高的前 N 只，加上现有持仓
    min_weight: float = 0.003      # 低于此权重的剔除


@dataclass
class OptResult:
    weights: pd.Series
    status: str
    relaxed: str                    # 为可行放开了哪条约束（空串表示没有）
    pred_te: float                  # 预测年化跟踪误差
    active_expo: pd.Series
    max_violation: float = 0.0      # 最终权重上实测的最大约束违反量
    resolved: str = ""              # 归一后约束被破坏时怎么处理的：resolve 重解、expand 补股票后重解、keep_small 保留小权重
    te_floor: float | None = None   # 跟踪误差上限放不下时，这组约束下能达到的最低预测跟踪误差


def _violations(w, b, prev, Xi, Xs, tight, loose, L, Xa, D, cfg, turnover_cap, te) -> dict[str, float]:
    """最终权重相对各条约束的超出量（没超出记 0）。"""
    a = w - b
    out = {"cap": max(float(np.max(w)) - cfg.stock_cap, 0.0),
           "industry": max(float(np.max(np.abs(Xi.T @ a))) - cfg.ind_tol, 0.0) if Xi.shape[1] else 0.0,
           "size": max(float(np.max(np.abs(Xs[:, tight].T @ a))) - cfg.size_tol, 0.0),
           "style": max(float(np.max(np.abs(Xs[:, loose].T @ a))) - cfg.style_tol, 0.0)}
    if turnover_cap is not None and prev.sum() > 0:
        out["turnover"] = max(float(np.abs(w - prev).sum()) / 2 - turnover_cap, 0.0)
    if te is not None:
        risk = float(np.sum((L.T @ (Xa.T @ a)) ** 2) + np.sum(D * a ** 2))
        out["te"] = max(np.sqrt(risk * 12) - te, 0.0)
    return out


def _renormalize(w: np.ndarray, keep: np.ndarray, cap: float) -> np.ndarray:
    """剔除后按比例归一，超过上限的部分按比例分给其余股票。"""
    out = np.where(keep, w, 0.0)
    out = out / out.sum()
    for _ in range(50):
        over = out > cap + 1e-12
        if not over.any():
            break
        excess = (out[over] - cap).sum()
        out[over] = cap
        room = keep & ~over
        out[room] += excess * out[room] / out[room].sum()
    return out


def optimize(score: pd.Series, bench: pd.Series, w0: pd.Series, rm, cfg: OptConfig | None = None) -> OptResult:
    """rm 只需要提供 exposures(codes)、specific(codes)、F、styles、industries、date。"""
    cfg = cfg or OptConfig()
    codes = bench.index.union(w0[w0 > 1e-8].index)
    in_bench = codes.isin(bench.index)
    b = bench.reindex(codes).fillna(0.0).to_numpy()
    prev = w0.reindex(codes).fillna(0.0).to_numpy()
    X = rm.exposures(codes)
    D = rm.specific(codes).to_numpy()
    F = rm.F.reindex(index=X.columns, columns=X.columns).fillna(0.0).to_numpy()
    L = np.linalg.cholesky(F + 1e-12 * np.eye(len(F)))
    z = score.reindex(codes).fillna(0.0).to_numpy()
    alpha = cfg.ic * np.sqrt(D) * z
    Xs = X[rm.styles].to_numpy()
    ind_cols = [c for c in rm.industries if X[c].abs().sum() > 0]
    Xi = X[ind_cols].to_numpy()
    tight = [rm.styles.index(s) for s in ("size", "nlsize")]
    loose = [k for k in range(len(rm.styles)) if k not in tight]
    Xa = X.to_numpy()

    ranked = score.reindex(bench.index).dropna().sort_values(ascending=False)
    pool = set(ranked.index[:cfg.candidates]) | {c for c in w0[w0 > 1e-8].index if c in bench.index}
    allowed = np.array([c in pool for c in codes]) & in_bench

    def solve(turnover_cap: float | None, te: float | None, support: np.ndarray | None = None, min_risk: bool = False):
        w = cp.Variable(len(codes))
        a = w - b
        risk = cp.sum_squares(L.T @ (Xa.T @ a)) + cp.sum(cp.multiply(D, cp.square(a)))
        ub = np.where(allowed if support is None else support, cfg.stock_cap, 0.0)
        lb = 0.0 if support is None else np.where(support, cfg.min_weight, 0.0)
        cons = [cp.sum(w) == 1, w >= lb, w <= ub,
                cp.abs(Xi.T @ a) <= cfg.ind_tol,
                cp.abs(Xs[:, tight].T @ a) <= cfg.size_tol,
                cp.abs(Xs[:, loose].T @ a) <= cfg.style_tol]
        if turnover_cap is not None and prev.sum() > 0:
            cons.append(cp.norm1(w - prev) <= 2 * turnover_cap)
        if te is not None:
            cons.append(1e4 * risk <= 1e4 * te ** 2 / 12)          # 两边放大，改善数值尺度
        obj = alpha @ w - cfg.risk_aversion * risk
        if min_risk:
            obj = -1e2 * risk
        elif prev.sum() > 0:
            obj = obj - cfg.cost * cp.norm1(w - prev)
        prob = cp.Problem(cp.Maximize(1e3 * obj), cons)           # 单期 alpha ~1e-3，放大后内点法更稳
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                prob.solve(solver=cp.CLARABEL)
        except cp.SolverError:
            return None, "solver_error"
        if prob.status not in ("optimal", "optimal_inaccurate") or w.value is None:
            return None, prob.status
        viol = max(float(np.max(c.violation())) for c in cons)
        if viol > 1e-5:
            return None, f"{prob.status}(违反{viol:.1e})"
        return w.value, prob.status

    status, te_floor = "", None
    w = None
    for relaxed, tc, te in (("", cfg.turnover, cfg.te), ("turnover", None, cfg.te)):
        w, status = solve(tc, te)
        if w is not None:
            break
    if w is None:
        low, status = solve(None, None, min_risk=True)
        if low is None:
            raise RuntimeError(f"{rm.date} 优化失败：{status}")
        a0 = low - b
        te_floor = float(np.sqrt(12 * (np.sum((L.T @ (Xa.T @ a0)) ** 2) + np.sum(D * a0 ** 2))))
        relaxed, tc, te = "turnover+te_floor", None, te_floor * 1.05
        w, status = solve(tc, te)
        if w is None:
            relaxed, te = "turnover+te", None
            w, status = solve(tc, te)
        if w is None:
            raise RuntimeError(f"{rm.date} 优化失败：{status}")
    w = np.clip(w, 0, None)
    first = w / w.sum()
    keep = first >= cfg.min_weight
    final = _renormalize(first, keep, cfg.stock_cap)
    bad = _violations(final, b, prev, Xi, Xs, tight, loose, L, Xa, D, cfg, tc, te)
    resolved = ""
    if max(bad.values()) > 1e-6:
        support = keep.copy()
        order = np.argsort(-first)
        solved = None
        for round_ in range(8):
            w2, status2 = solve(tc, te, support)
            if w2 is not None:
                solved = w2
                resolved = "resolve" if round_ == 0 else "expand"
                status = status2
                break
            # 缺口超限的行业优先：补进第一轮权重最大的落选股票
            trial = _renormalize(first, support, cfg.stock_cap)
            active = Xi.T @ (trial - b)
            short = np.where(active < -cfg.ind_tol + 1e-4)[0]
            add = []
            for k in short:
                names = [i for i in order if not support[i] and allowed[i] and Xi[i, k] > 0][:2]
                add += names
            if not add:
                add = [i for i in order if not support[i] and allowed[i] and first[i] > 1e-5][:5]
            if not add:
                break
            support[add] = True
        if solved is not None:
            final = np.clip(solved, 0, None)
            final = final / final.sum()
        else:
            dust = first >= 1e-4                       # 只去掉数值噪声，第一轮本身满足全部约束
            final = _renormalize(first, dust, cfg.stock_cap)
            resolved = "keep_small"
        bad = _violations(final, b, prev, Xi, Xs, tight, loose, L, Xa, D, cfg, tc, te)
    a = final - b
    pred = float(np.sum((L.T @ (Xa.T @ a)) ** 2) + np.sum(D * a ** 2))
    weights = pd.Series(final, index=codes)
    return OptResult(weights[weights > 1e-10], status, relaxed, float(np.sqrt(pred * 12)),
                     pd.Series(Xa.T @ a, index=X.columns), max(bad.values()), resolved, te_floor)
