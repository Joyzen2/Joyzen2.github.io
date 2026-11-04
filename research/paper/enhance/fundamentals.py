"""财报时点面板：每个信号日，每只股票「当时已经公告」的最新一期财报及其衍生指标。移植自中证500 研究。

- 时点（可用日）= 东财业绩报表（CPD）的 NOTICE_DATE，即首次披露日；
  缺失或早于报告期末时退回法定截止日次日。
- 研究里还把已上市公司的可用日封顶到法定截止日次日，那是为了修 2014 年以前的日期错误。
  这里只用近几年的数据，不封顶，按真实公告日。
- 三表只取数值。流量科目是年初至今累计值：单季 = 本期累计 - 上一季累计；TTM = 本期累计 + 上年年报 - 上年同期累计。
"""
from __future__ import annotations

import numpy as np
import pandas as pd

MAX_STALE_DAYS = 456          # 最新一期报告期末距今超过约 15 个月视为失效


def _deadline(report_date: pd.Series) -> pd.Series:
    q = report_date.dt.quarter
    y = report_date.dt.year
    md = q.map({1: "04-30", 2: "08-31", 3: "10-31", 4: "04-30"})
    yy = np.where(q == 4, y + 1, y)
    return pd.to_datetime(pd.Series(yy, index=report_date.index).astype(str) + "-" + md)


def load_records(data, periods: list[str], codes) -> pd.DataFrame:
    """每行一个（股票, 报告期），合并四张表，带可用日 avail。"""
    def table(report):
        df = pd.concat([data.fin_period(report, p) for p in periods], ignore_index=True)
        df["report_date"] = pd.to_datetime(df["report_date"])
        return df[df["SECURITY_CODE"].isin(codes)]
    cpd, bal, cf, inc = table("cpd"), table("balance"), table("cashflow"), table("income")
    key = ["SECURITY_CODE", "report_date"]
    df = cpd[key + ["NOTICE_DATE", "PARENT_NETPROFIT", "TOTAL_OPERATE_INCOME", "BPS", "XSMLL"]].rename(
        columns={"NOTICE_DATE": "notice", "PARENT_NETPROFIT": "np", "TOTAL_OPERATE_INCOME": "rev",
                 "BPS": "bps", "XSMLL": "gpm_ytd"})
    df["notice"] = pd.to_datetime(df["notice"], errors="coerce")
    df = df.merge(bal[key + ["TOTAL_ASSETS", "TOTAL_LIABILITIES", "TOTAL_EQUITY"]], on=key, how="outer")
    df = df.merge(cf[key + ["NETCASH_OPERATE"]], on=key, how="outer")
    df = df.merge(inc[key + ["PARENT_NETPROFIT", "TOTAL_OPERATE_INCOME", "OPERATE_COST"]]
                  .rename(columns={"PARENT_NETPROFIT": "np_inc", "TOTAL_OPERATE_INCOME": "rev_inc"}),
                  on=key, how="outer")
    df = df.rename(columns={"SECURITY_CODE": "code", "TOTAL_ASSETS": "assets",
                            "TOTAL_LIABILITIES": "liab", "TOTAL_EQUITY": "equity_total",
                            "NETCASH_OPERATE": "ocf", "OPERATE_COST": "cogs"})
    df["np"] = df["np"].fillna(df.pop("np_inc"))
    df["rev"] = df["rev"].fillna(df.pop("rev_inc"))
    df = df[df.report_date.dt.is_quarter_end]
    deadline1 = _deadline(df.report_date) + pd.Timedelta(days=1)
    bad = df.notice.isna() | (df.notice < df.report_date)
    df["avail"] = df.notice.where(~bad, deadline1)
    return df.sort_values(["code", "report_date"]).reset_index(drop=True)


def _shares_at_quarter_ends(codes, dates, shares: pd.DataFrame) -> pd.Series:
    """报告期末的总股本（股），用来把 BPS 还原成归母净资产。取报告期末前最后一个有记录的交易日，最多往前 40 天。"""
    filled = shares.ffill(limit=40)
    pos = filled.index.searchsorted(dates, side="right") - 1
    out = {}
    for d, p in zip(dates, pos):
        if p < 0:
            continue
        row = filled.iloc[p]
        for c in codes:
            if c in row.index:
                out[(c, d)] = row[c]
    return pd.Series(out, dtype="float64")


def derive(df: pd.DataFrame, shares: pd.DataFrame) -> pd.DataFrame:
    """单季、TTM、同比、SUE 等。全部只用同一股票更早的报告期。shares：交易日 × 股票 的总股本（股）。"""
    df = df.copy()
    df["year"] = df.report_date.dt.year
    df["q"] = df.report_date.dt.quarter
    idx = df.set_index(["code", "year", "q"])

    def lookup(col, dy, q_new):
        """同一股票 (year+dy, q_new) 的值。"""
        k = pd.MultiIndex.from_arrays([df.code, df.year + dy, q_new])
        return idx[col].reindex(k).to_numpy()

    for col in ("np", "rev", "ocf", "cogs"):
        prev_q = lookup(col, 0, df.q - 1)
        single = np.where(df.q == 1, df[col], df[col] - prev_q)
        df[f"{col}_q"] = single
        annual_prev = lookup(col, -1, pd.Series(4, index=df.index))
        same_prev = lookup(col, -1, df.q)
        ttm = np.where(df.q == 4, df[col], df[col] + annual_prev - same_prev)
        df[f"{col}_ttm"] = ttm

    idx = df.set_index(["code", "year", "q"])
    for col in ("np_q", "rev_q"):
        last = lookup(col, -1, df.q)
        df[f"{col}_yoy"] = (df[col] - last) / np.abs(last)
        df.loc[np.abs(last) < 1e6, f"{col}_yoy"] = np.nan         # 基数太小（<100 万）同比没意义
        df[f"{col}_diff"] = df[col] - last

    # SUE：单季净利润同比差额 / 过去 8 个季度同比差额的标准差（至少 4 个）
    df = df.sort_values(["code", "report_date"])
    sd = (df.groupby("code")["np_q_diff"]
            .transform(lambda s: s.shift(1).rolling(8, min_periods=4).std()))
    df["sue"] = df["np_q_diff"] / sd

    dates = pd.DatetimeIndex(sorted(df.report_date.unique()))
    sh = _shares_at_quarter_ends(df.code.unique(), dates, shares)
    sh = sh.reindex(pd.MultiIndex.from_arrays([df.code, df.report_date])).to_numpy()
    eq_parent = df["bps"].to_numpy() * sh
    df["equity_parent"] = np.where(np.isfinite(eq_parent) & (eq_parent > 0), eq_parent, df["equity_total"])

    idx = df.set_index(["code", "year", "q"])
    eq_prev = lookup("equity_parent", -1, df.q)
    eq_avg = np.where(np.isfinite(eq_prev), (df["equity_parent"] + eq_prev) / 2, df["equity_parent"])
    df["roe_ttm"] = df["np_ttm"] / np.where(eq_avg > 0, eq_avg, np.nan)
    df["roa_ttm"] = df["np_ttm"] / df["assets"].where(df["assets"] > 0)
    gpm = 1 - df["cogs_ttm"] / df["rev_ttm"].where(df["rev_ttm"] > 0)
    df["gpm"] = gpm.where(np.isfinite(gpm), df["gpm_ytd"] / 100)
    df["leverage"] = df["liab"] / df["assets"].where(df["assets"] > 0)
    df["accruals"] = (df["np_ttm"] - df["ocf_ttm"]) / df["assets"].where(df["assets"] > 0)
    idx = df.set_index(["code", "year", "q"])
    df["delta_roe"] = df["roe_ttm"] - lookup("roe_ttm", -1, df.q)
    assets_prev = lookup("assets", -1, df.q)
    df["asset_growth"] = df["assets"] / np.where(assets_prev > 0, assets_prev, np.nan) - 1
    return df


KEEP = ["report_date", "avail", "np_ttm", "rev_ttm", "ocf_ttm", "equity_parent", "assets",
        "roe_ttm", "roa_ttm", "gpm", "leverage", "accruals", "np_q_yoy", "rev_q_yoy", "sue",
        "delta_roe", "asset_growth"]


def snapshot(rec: pd.DataFrame, dates) -> pd.DataFrame:
    """每个信号日取「可用日 <= 当天」的报告期最新一期。"""
    rec = rec.sort_values("avail")
    out = []
    for d in dates:
        avail = rec[(rec.avail <= d) & (rec.report_date >= d - pd.Timedelta(days=MAX_STALE_DAYS))]
        latest = avail.sort_values(["code", "report_date"]).groupby("code").tail(1)
        out.append(latest[["code"] + KEEP].assign(date=d))
    snap = pd.concat(out, ignore_index=True)
    return snap.set_index(["date", "code"]).sort_index()
