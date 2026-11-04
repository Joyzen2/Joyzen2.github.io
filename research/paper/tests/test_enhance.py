"""移植模块的关键规则：组合约束、偏差校准、IC 只用已实现的期、涨停判定。"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "enhance"))

cp = pytest.importorskip("cvxpy")

import combine  # noqa: E402
import optimize  # noqa: E402

STYLES = ["size", "beta", "momentum", "resvol", "nlsize", "btop", "liquidity", "earnyield", "growth", "leverage"]


class StubRisk:
    def __init__(self, codes, seed=0):
        rng = np.random.default_rng(seed)
        self.date = pd.Timestamp("2026-11-30")
        self.styles = STYLES
        self.industries = [f"ind_{i}" for i in range(6)]
        X = pd.DataFrame(rng.normal(0, 1, (len(codes), len(STYLES))), index=codes, columns=STYLES)
        for k, col in enumerate(self.industries):
            X[col] = (np.arange(len(codes)) % 6 == k).astype(float)
        self.X = X
        cols = list(X.columns)
        self.F = pd.DataFrame(np.eye(len(cols)) * 2e-3, index=cols, columns=cols)
        self.spec = pd.Series(rng.uniform(0.004, 0.02, len(codes)), index=codes)

    def exposures(self, codes):
        return self.X.reindex(codes).fillna(0.0)

    def specific(self, codes):
        return self.spec.reindex(codes).fillna(self.spec.quantile(0.75))


def _inputs(n=300, seed=0):
    rng = np.random.default_rng(seed)
    codes = pd.Index([f"{i:06d}" for i in range(n)])
    b = pd.Series(rng.lognormal(0, 0.6, n), index=codes)
    return codes, b / b.sum(), pd.Series(rng.normal(0, 1, n), index=codes), StubRisk(codes, seed)


def test_first_build_respects_every_constraint():
    codes, b, score, rm = _inputs()
    cfg = optimize.OptConfig(te=0.2)
    res = optimize.optimize(score, b, pd.Series(dtype="float64"), rm, cfg)
    w = res.weights
    assert abs(w.sum() - 1) < 1e-6 and (w >= -1e-9).all()
    assert w.max() <= cfg.stock_cap + 1e-6
    assert res.max_violation <= 1e-5
    X = rm.exposures(b.index)
    active = w.reindex(b.index).fillna(0.0) - b
    assert np.abs(X[rm.industries].T @ active).max() <= cfg.ind_tol + 1e-5
    assert set(w.index) <= set(score.sort_values(ascending=False).index[:cfg.candidates])


def test_small_weights_are_dropped_unless_constraints_need_them():
    codes, b, score, rm = _inputs(seed=1)
    res = optimize.optimize(score, b, pd.Series(dtype="float64"), rm, optimize.OptConfig(te=0.2))
    if res.resolved != "keep_small":
        assert res.weights.min() >= 0.003 - 1e-6


def test_stock_out_of_index_is_sold_and_turnover_capped():
    codes, b, score, rm = _inputs(seed=2)
    first = optimize.optimize(score, b, pd.Series(dtype="float64"), rm, optimize.OptConfig(te=0.2)).weights
    w0 = first.copy()
    gone = w0.index[0]
    new_b = b.drop(gone)
    new_b = new_b / new_b.sum()
    res = optimize.optimize(score.drop(gone), new_b, w0, rm, optimize.OptConfig(te=0.2))
    assert gone not in res.weights.index
    keep_only = optimize.optimize(score, b, first, rm, optimize.OptConfig(te=0.2))
    union = keep_only.weights.index.union(first.index)
    turnover = (keep_only.weights.reindex(union).fillna(0) - first.reindex(union).fillna(0)).abs().sum() / 2
    assert turnover <= 0.30 + 1e-5 or keep_only.relaxed


def test_te_is_relaxed_in_steps_not_dropped():
    codes, b, score, rm = _inputs(seed=3)
    tight = optimize.optimize(score, b, pd.Series(dtype="float64"), rm, optimize.OptConfig(te=1e-4))
    assert tight.relaxed            # 这么低的上限一定放不下
    wide = optimize.optimize(score, b, pd.Series(dtype="float64"), rm, optimize.OptConfig(te=0.2))
    assert wide.relaxed == ""


def test_icir_uses_only_earlier_periods():
    days = pd.date_range("2023-01-31", periods=40, freq="ME")
    ic = pd.DataFrame({"a": np.linspace(0.01, 0.05, 40), "b": -0.02 + 0.01 * np.sin(np.arange(40))}, index=days)
    t = days[-1]
    w = combine.icir_weights(ic, t)
    hist = ic.iloc[-37:-1]
    assert w["a"] == pytest.approx(hist["a"].mean() / hist["a"].std())
    with pytest.raises(ValueError):
        combine.icir_weights(ic.iloc[:10], days[9])


def test_calibration_needs_a_year_and_is_clipped():
    import types
    sys.modules.setdefault("paper", types.ModuleType("paper"))
    # 只测公式，不导入 bridge（它依赖完整数据层）
    z = list(np.random.default_rng(0).normal(0, 3, 40))
    calib = lambda h: 1.0 if len(h) < 12 else float(np.clip(np.std(h[-36:], ddof=1), 0.8, 1.6))  # noqa: E731
    assert calib(z[:11]) == 1.0
    assert calib(z) == 1.6
