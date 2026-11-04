# /// script
# requires-python = ">=3.12"
# dependencies = ["akshare>=1.17", "pandas>=2.2", "requests>=2.31"]
# ///
"""ETF 与股指期货的期现基差研究。

用法（在仓库根目录）：
    uv run research/basis/arbitrage.py            # 取数（有缓存）并计算，写出研究快照
    uv run research/basis/arbitrage.py --offline  # 只用本机缓存重算

数据全部来自公开来源：中金所每日行情（逐合约收盘价），新浪的指数日线，东方财富的
ETF 日线（未复权与后复权，用来算含分红的总收益）与 Shibor 3 个月利率；中证指数官网的
全收益指数只用来自检。原始行情只缓存在本机
research/basis/.cache/，不进仓库；仓库里只放 portfolio/public/research-data/arbitrage.json
里的聚合结果。
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import math
import re
import time
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / ".cache"
OUT = ROOT / "portfolio" / "public" / "research-data" / "arbitrage.json"

START = dt.date(2019, 1, 2)

# 品种：期货代码 -> (指数名, 新浪指数代码, ETF 代码, ETF 名称)
VARIETIES = {
    "IH": ("上证50", "sh000016", "510050", "上证50ETF"),
    "IF": ("沪深300", "sh000300", "510300", "沪深300ETF"),
    "IC": ("中证500", "sh000905", "510500", "中证500ETF"),
    "IM": ("中证1000", "sh000852", "512100", "中证1000ETF"),
}

# 成本与资金假设。均为单边、按成交金额计；页面会原样展示这些数。
# 期货手续费取交易所标准（开仓与非当日平仓），不含期货公司加收；ETF 佣金因券商而异。
ASSUMPTIONS = {
    "etf_commission": 0.00005,   # ETF 佣金，单边
    "etf_slippage": 0.0001,      # ETF 滑点，单边
    "fut_fee": 0.000023,         # 股指期货手续费，单边
    "fut_slippage": 0.0001,      # 股指期货滑点，单边
    "margin": 0.15,              # 期货保证金占用，按合约面值
    "roll_min_days": 20,         # 连续持有时，换到剩余天数大于此值的最近合约
    "entry_min_days": 15,        # 择机开仓：剩余天数下限
    "entry_max_days": 120,       # 择机开仓：剩余天数上限
}


# ───────────────────────────── 取数 ─────────────────────────────

def _http_get(url: str, **kw):
    import requests

    headers = {"User-Agent": "Mozilla/5.0 (research script)"}
    for attempt in range(4):
        try:
            r = requests.get(url, headers=headers, timeout=30, **kw)
            return r
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def _parse_cffex_csv(raw: bytes, date: str) -> pd.DataFrame:
    text = raw.decode("gbk", errors="replace")
    df = pd.read_csv(io.StringIO(text))
    # 列的位置与 AkShare 的 get_cffex_daily 一致：0 合约代码、4 成交量、6 持仓量、8 收盘、9 结算
    df = df.iloc[:, [0, 4, 6, 8, 9]]
    df.columns = ["symbol", "volume", "open_interest", "close", "settle"]
    df["symbol"] = df["symbol"].astype(str).str.strip()
    df = df[df["symbol"].str.match(r"^(IH|IF|IC|IM)\d{4}$")]
    for col in ["volume", "open_interest", "close", "settle"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["date"] = pd.Timestamp(date)
    df["variety"] = df["symbol"].str[:2]
    return df


def _cffex_month(month: str, refresh: bool) -> pd.DataFrame:
    """一个月的逐合约日线。整月压缩包下载一次，按月缓存。"""
    path = CACHE / "cffex" / f"{month}.csv"
    if path.exists() and not refresh:
        return pd.read_csv(path, parse_dates=["date"])
    frames = []
    r = _http_get(f"http://www.cffex.com.cn/sj/historysj/{month}/zip/{month}.zip")
    if r is not None and r.ok and r.content[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            for name in zf.namelist():
                m = re.search(r"(\d{8})_1\.csv$", name)
                if m:
                    frames.append(_parse_cffex_csv(zf.read(name), m.group(1)))
    else:
        # 当月的压缩包可能还没发布，改为逐日取当日行情
        first = dt.date(int(month[:4]), int(month[4:]), 1)
        day = first
        while day.month == first.month and day <= dt.date.today():
            if day.weekday() < 5:
                d = day.strftime("%Y%m%d")
                rr = _http_get(f"http://www.cffex.com.cn/sj/hqsj/rtj/{d[:6]}/{d[6:]}/{d}_1.csv")
                if rr is not None and rr.ok and rr.content and b"<html" not in rr.content[:200].lower():
                    try:
                        frames.append(_parse_cffex_csv(rr.content, d))
                    except Exception:
                        pass
                time.sleep(0.3)
            day += dt.timedelta(days=1)
    if not frames:
        # 取不到就不写缓存，下次运行会重新尝试，而不是把这个月永远记成空的
        print(f"  ！期货 {month} 没有取到数据，本次跳过", flush=True)
        return pd.DataFrame(columns=["symbol", "volume", "open_interest", "close", "settle", "date", "variety"])
    df = pd.concat(frames, ignore_index=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return df


# 份额折算的识别阈值：ETF 未复权价当日涨跌与指数相差超过此值。2015 年以来四只 ETF 在非折算日的
# 最大偏离约 7.6%，已知最小的一次折算（510500，2022-08-29，比例约 0.873）偏离约 12.9%。
SPLIT_GAP = 0.10


def etf_total_return(raw: pd.Series, hfq: pd.Series, index: pd.Series) -> tuple[pd.Series, list[str], list[float]]:
    """ETF 的总收益净值（含分红）。

    东方财富的后复权不是比例复权：在两次份额折算之间，后复权价 = k × 未复权价 + 累计分红
    （k 在折算前为 1），所以直接用后复权价相除会把涨跌幅压低。这里以份额折算日为界分段，
    每段用「后复权日变动 / 未复权日变动」的中位数估计 k，当日总收益 = 后复权日变动 / (k × 前一日未复权价)。
    除息日也成立：后复权当天多出的部分正好是 k × 每份分红。折算当天两者尺度不连续，用指数当日收益代替。
    """
    dates = raw.dropna().index.intersection(hfq.dropna().index).intersection(index.dropna().index)
    raw, hfq, index = raw[dates], hfq[dates], index[dates]
    idx_ret = index.pct_change()
    split = (raw.pct_change() - idx_ret).abs() > SPLIT_GAP
    segment = split.cumsum()
    d_raw, d_hfq = raw.diff(), hfq.diff()
    moving = (d_raw.abs() > 1e-9) & ~split
    slope = d_hfq / d_raw
    k = slope[moving].groupby(segment).median()
    # 防线：每年的倍数应与所在段一致；不一致多半是一次没识别出来的份额折算
    yearly = slope[moving].groupby([segment[moving], slope[moving].index.year]).median()
    for (seg, year), value in yearly.items():
        if abs(value / k[seg] - 1) > 0.02:
            print(f"  ！警告：{year} 年后复权/未复权倍数 {value:.4f}，与所在段的 {k[seg]:.4f} 不一致，"
                  f"可能有未识别的份额折算，请检查", flush=True)
    ret = d_hfq / (segment.map(k) * raw.shift(1))
    ret[split] = idx_ret[split]
    nav = (1 + ret.fillna(0)).cumprod()
    return nav, [d.strftime("%Y-%m-%d") for d in dates[split]], [round(float(x), 4) for x in k]


def fetch_market(offline: bool) -> dict:
    import akshare as ak

    CACHE.mkdir(parents=True, exist_ok=True)
    today = dt.date.today()

    # 期货：最近两个月每次都重新取，更早的月份读缓存
    months, m = [], dt.date(START.year, START.month, 1)
    while m <= today:
        months.append(m.strftime("%Y%m"))
        m = (m.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    recent = set(months[-2:])
    futures = []
    for month in months:
        path = CACHE / "cffex" / f"{month}.csv"
        if offline:
            if path.exists():
                futures.append(pd.read_csv(path, parse_dates=["date"]))
            continue
        futures.append(_cffex_month(month, refresh=month in recent))
        print(f"  期货 {month}", flush=True)
    futures = pd.concat(futures, ignore_index=True)

    def cached(name: str, loader):
        path = CACHE / f"{name}.csv"
        if offline:
            return pd.read_csv(path)
        df = loader()
        df.to_csv(path, index=False)
        time.sleep(0.5)
        return df

    index, etf, splits, tr_index = {}, {}, {}, {}
    for code, (_, index_code, etf_code, _) in VARIETIES.items():
        idx = cached(f"index_{index_code}", lambda c=index_code: ak.stock_zh_index_daily(symbol=c))
        index[code] = pd.Series(idx["close"].values, index=pd.to_datetime(idx["date"]), name=code).sort_index()
        prices = {}
        for adjust in ("hfq", ""):
            e = cached(f"etf_{etf_code}_{adjust or 'raw'}", lambda c=etf_code, a=adjust: ak.fund_etf_hist_em(
                symbol=c, period="daily", start_date="20150101", end_date=today.strftime("%Y%m%d"), adjust=a))
            prices[adjust] = pd.Series(e["收盘"].values, index=pd.to_datetime(e["日期"]), name=code).sort_index()
        etf[code], splits[code], scale = etf_total_return(prices[""], prices["hfq"], index[code])
        print(f"  {code} ETF 份额折算日 {splits[code] or '无'}，各段后复权/未复权倍数 {scale}", flush=True)
        # 全收益指数只用来自检，取不到不影响结果
        try:
            tr = cached(f"tr_index_H{index_code[-5:]}", lambda c=index_code: ak.stock_zh_index_hist_csindex(
                symbol=f"H{c[-5:]}", start_date="20150101", end_date=today.strftime("%Y%m%d")))
            tr_index[code] = pd.Series(pd.to_numeric(tr["收盘"], errors="coerce").values,
                                       index=pd.to_datetime(tr["日期"]), name=code).sort_index()
        except Exception as exc:
            print(f"  （{code} 全收益指数未取到，跳过自检：{type(exc).__name__}）", flush=True)
        print(f"  {code} 指数与 ETF", flush=True)

    rate = cached("shibor_3m", lambda: ak.rate_interbank(
        market="上海银行同业拆借市场", symbol="Shibor人民币", indicator="3月"))
    rate = pd.Series(pd.to_numeric(rate["利率"], errors="coerce").values / 100,
                     index=pd.to_datetime(rate["报告日"]), name="rate").sort_index()
    return {"futures": futures, "index": index, "etf": etf, "rate": rate, "splits": splits, "tr_index": tr_index}


# ───────────────────────────── 计算 ─────────────────────────────

def third_friday(year: int, month: int) -> pd.Timestamp:
    first = dt.date(year, month, 1)
    offset = (4 - first.weekday()) % 7
    return pd.Timestamp(first + dt.timedelta(days=offset + 14))


def expiries(fut: pd.DataFrame) -> dict[str, pd.Timestamp]:
    """到期日：已经到期的合约用它最后出现的交易日，仍在交易的用合约月份的第三个周五。"""
    last_seen = fut.groupby("symbol")["date"].max()
    data_end = fut["date"].max()
    out = {}
    for sym, seen in last_seen.items():
        y, m = 2000 + int(sym[2:4]), int(sym[4:6])
        nominal = third_friday(y, m)
        out[sym] = seen if seen < data_end else nominal
    return out


def r5(x):
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return None
    return round(float(x), 5)


def analyse_variety(code: str, fut: pd.DataFrame, S: pd.Series, E: pd.Series, rate: pd.Series) -> dict:
    a = ASSUMPTIONS
    rt_cost = 2 * (a["etf_commission"] + a["etf_slippage"]) + 2 * (a["fut_fee"] + a["fut_slippage"])
    roll_cost = 2 * (a["fut_fee"] + a["fut_slippage"])
    cap = 1 + a["margin"]

    fut = fut[fut["variety"] == code].dropna(subset=["close"])
    fut = fut[fut["close"] > 0]
    if fut.empty:
        return None
    F = fut.pivot_table(index="date", columns="symbol", values="close", aggfunc="last").sort_index()
    exp = expiries(fut)
    dates = F.index.intersection(S.dropna().index).intersection(E.dropna().index)
    dates = dates[dates >= pd.Timestamp(START)]
    F, S, E = F.loc[dates], S.loc[dates], E.loc[dates]
    r = rate.reindex(rate.index.union(dates)).sort_index().ffill().reindex(dates).bfill()

    dte = pd.DataFrame({sym: (exp[sym] - dates).days for sym in F.columns}, index=dates)
    basis = F.div(S, axis=0) - 1
    ann = basis * 365 / dte.where(dte > 0)

    # 连续持有用的合约：剩余天数大于 roll_min_days 的最近合约
    live = F.notna() & (dte > a["roll_min_days"])
    held = dte.where(live).apply(lambda row: row.idxmin() if row.notna().any() else None, axis=1)

    monitor = [r5(ann.at[d, held[d]]) if isinstance(held[d], str) else None for d in dates]

    # 一直持有：多 ETF（后复权）、空连续合约，按日固定名义本金
    rows = []
    for i in range(1, len(dates)):
        d0, d1 = dates[i - 1], dates[i]
        c = held[d0]
        if not isinstance(c, str) or pd.isna(F.at[d1, c]):
            continue
        rf = F.at[d1, c] / F.at[d0, c] - 1
        rs = S[d1] / S[d0] - 1
        re_ = E[d1] / E[d0] - 1
        cost = roll_cost if isinstance(held[d1], str) and held[d1] != c else 0.0
        rows.append({
            "date": d1, "basis": rs - rf, "tracking": re_ - rs, "cost": cost,
            "funding": r[d0] * (d1 - d0).days / 365,
        })
    carry = pd.DataFrame(rows).set_index("date")
    carry["net_cap"] = (carry["basis"] + carry["tracking"] - carry["cost"]) / cap
    carry["excess"] = carry["net_cap"] - carry["funding"]
    years = []
    for y, g in carry.groupby(carry.index.year):
        years.append({
            "year": int(y), "days": int(len(g)),
            "basis": r5(g["basis"].sum() / cap), "tracking": r5(g["tracking"].sum() / cap),
            "cost": r5(-g["cost"].sum() / cap), "net": r5(g["net_cap"].sum()),
            "funding": r5(-g["funding"].sum()), "excess": r5(g["excess"].sum()),
        })
    span_years = (carry.index[-1] - carry.index[0]).days / 365.25
    carry_summary = {
        "net_ann": r5(carry["net_cap"].sum() / span_years),
        "funding_ann": r5(carry["funding"].sum() / span_years),
        "excess_ann": r5(carry["excess"].sum() / span_years),
        "basis_ann": r5(carry["basis"].sum() / cap / span_years),
        "tracking_ann": r5(carry["tracking"].sum() / cap / span_years),
    }

    # 择机正向套利：T 日收盘出信号，T+1 日收盘成交；持有到合约最后交易日，或基差转负时提前平仓
    # 开仓时两腿名义本金相等，之后数量固定，所以整笔盈亏 = ETF 收益 − 期货收益（都相对开仓价）。
    trades = []
    pos, pending, exit_next = None, None, False
    for i, d in enumerate(dates):
        if pending and pos is None:
            c = pending
            pending = None
            if pd.notna(F.at[d, c]):
                pos = {"symbol": c, "entry": d, "F0": F.at[d, c], "S0": S[d], "E0": E[d], "ann0": ann.at[d, c]}
                continue
        if pos is not None:
            c = pos["symbol"]
            last_day = d >= exp[c]
            final = i == len(dates) - 1
            if exit_next or last_day or final:
                rs = S[d] / pos["S0"] - 1
                rf = F.at[d, c] / pos["F0"] - 1
                re_ = E[d] / pos["E0"] - 1
                days = (d - pos["entry"]).days
                funding = r[pos["entry"]:d].mean() * days / 365
                net_cap = (re_ - rf - rt_cost) / cap
                trades.append({
                    "symbol": c, "entry": pos["entry"].strftime("%Y-%m-%d"), "exit": d.strftime("%Y-%m-%d"),
                    "days": int(days), "entry_ann": r5(pos["ann0"]),
                    "basis": r5((rs - rf) / cap), "tracking": r5((re_ - rs) / cap), "cost": r5(-rt_cost / cap),
                    "net": r5(net_cap), "funding": r5(-funding), "excess": r5(net_cap - funding),
                    # 样本末尾仍在持有：按最后一天收盘估值，不算作已完成的交易
                    "open": final and not (last_day or exit_next),
                })
                pos, exit_next = None, False
                continue
            if basis.at[d, c] <= 0:
                exit_next = True
            continue
        # 空仓：找扣除成本、按资金占用年化后最高的合约
        row = dte.loc[d]
        ok = F.loc[d].notna() & (row >= a["entry_min_days"]) & (row <= a["entry_max_days"])
        if ok.any() and i < len(dates) - 1:
            net_ann = ((basis.loc[d][ok] - rt_cost) / cap * 365 / row[ok])
            best = net_ann.idxmax()
            if net_ann[best] > r[d]:
                pending = best

    closed = [t for t in trades if not t["open"]]
    in_pos_days = sum(t["days"] for t in trades)
    total_days = (dates[-1] - dates[0]).days
    span = total_days / 365.25
    arb_summary = {
        "trades": len(closed),
        "wins": sum(1 for t in closed if t["excess"] is not None and t["excess"] > 0),
        "avg_days": r5(sum(t["days"] for t in closed) / len(closed)) if closed else None,
        "in_position": r5(in_pos_days / total_days) if total_days else None,
        "excess_ann": r5(sum(t["excess"] for t in trades) / span) if trades else 0.0,
        "net_ann": r5(sum(t["net"] for t in trades) / span) if trades else 0.0,
        "avg_entry_ann": r5(sum(t["entry_ann"] for t in closed) / len(closed)) if closed else None,
    }
    # 画图用的累计曲线：每笔的超额按持有天数平摊，终点与逐笔加总一致
    curve = pd.Series(0.0, index=dates)
    for t in trades:
        span_idx = dates[(dates > pd.Timestamp(t["entry"])) & (dates <= pd.Timestamp(t["exit"]))]
        if len(span_idx):
            curve[span_idx] += t["excess"] / len(span_idx)
    curve = curve.cumsum()

    # 季节性：连续合约年化基差的月度均值
    mon = pd.Series(monitor, index=dates, dtype=float)
    season = [r5(mon[mon.index.month == m].mean()) for m in range(1, 13)]
    valid = mon.dropna()

    # 反向套利：贴水超过一次往返交易成本的交易日占比（需要融券，费率与券源不公开，不计算收益）
    cur = pd.Series([basis.at[d, held[d]] if isinstance(held[d], str) else math.nan for d in dates], index=dates)
    reverse_share = r5((cur < -rt_cost).mean())
    forward_share = r5((cur > rt_cost).mean())

    last = dates[-1]
    term = sorted(
        ({"symbol": s, "dte": int(dte.at[last, s]), "ann": r5(ann.at[last, s]), "basis": r5(basis.at[last, s])}
         for s in F.columns if pd.notna(F.at[last, s]) and dte.at[last, s] > 0),
        key=lambda x: x["dte"])

    def week_end(series: pd.Series) -> pd.Series:
        """每周取该周实际最后一个交易日，日期标签不会落到还没发生的周五。"""
        series = series.dropna()
        return series.groupby(series.index.to_period("W-FRI")).tail(1)

    weekly = week_end(carry["excess"].cumsum())
    curve_w = week_end(curve)
    return {
        "start": dates[0].strftime("%Y-%m-%d"), "end": last.strftime("%Y-%m-%d"), "days": int(len(dates)),
        "monitor": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "ann": monitor},
        "distribution": {
            "positive": r5((valid > 0).mean()), "median": r5(valid.median()),
            "p10": r5(valid.quantile(0.1)), "p90": r5(valid.quantile(0.9)),
            "forward_share": forward_share, "reverse_share": reverse_share,
        },
        "season": season,
        "term": {"date": last.strftime("%Y-%m-%d"), "contracts": term},
        "carry": {"summary": carry_summary, "years": years,
                  "curve": {"dates": [d.strftime("%Y-%m-%d") for d in weekly.index], "excess": [r5(v) for v in weekly]}},
        "arb": {"summary": arb_summary, "trades": trades,
                "curve": {"dates": [d.strftime("%Y-%m-%d") for d in curve_w.index], "excess": [r5(v) for v in curve_w]}},
    }


def etf_check(nav: pd.Series, index: pd.Series, tr: pd.Series | None, start: str) -> dict:
    """自检（与研究样本同一区间）：ETF 日收益对价格指数的 beta 应接近 1；ETF 年化应接近全收益指数，略低的部分约为费率。"""
    start = pd.Timestamp(start)
    dates = nav.index.intersection(index.index)
    dates = dates[dates >= start]
    r_e, r_i = nav[dates].pct_change().dropna(), index[dates].pct_change().dropna()
    beta = float(r_e.cov(r_i) / r_i.var())
    # ETF 年化与「差」用同一时间段：有全收益指数时取两者共同的区间
    window = dates
    if tr is not None and len(dates.intersection(tr.dropna().index)) > 250:
        window = dates.intersection(tr.dropna().index)
    years = (window[-1] - window[0]).days / 365.25
    etf_ann = float((nav[window[-1]] / nav[window[0]]) ** (1 / years) - 1)
    tr_ann = gap = None
    if window is not dates:
        tr_ann = float((tr[window[-1]] / tr[window[0]]) ** (1 / years) - 1)
        gap = etf_ann - tr_ann
    return {"beta": r5(beta), "etf_ann": r5(etf_ann), "tr_ann": r5(tr_ann), "gap": r5(gap)}


def build(market: dict) -> dict:
    out = {
        "generated": dt.date.today().isoformat(),
        "assumptions": ASSUMPTIONS,
        "round_trip_cost": r5(2 * (ASSUMPTIONS["etf_commission"] + ASSUMPTIONS["etf_slippage"])
                              + 2 * (ASSUMPTIONS["fut_fee"] + ASSUMPTIONS["fut_slippage"])),
        "sources": ["中金所每日行情", "新浪财经指数日线", "东方财富 ETF 日线（未复权与后复权）", "东方财富 Shibor 3 个月"],
        "varieties": [],
        "results": {},
    }
    # 四个品种统一截到共同的最后一天：各数据源更新时间不同，否则快照里各品种会不同期
    fut = market["futures"]
    ends = []
    for code in VARIETIES:
        f = fut[fut["variety"] == code]
        if f.empty:
            continue
        ends.append(min(f["date"].max(), market["index"][code].dropna().index.max(), market["etf"][code].dropna().index.max()))
    end = min(ends)
    print(f"  共同的最后一天：{end:%Y-%m-%d}", flush=True)
    fut = fut[fut["date"] <= end]
    out["end"] = end.strftime("%Y-%m-%d")
    for code, (name, index_code, etf_code, etf_name) in VARIETIES.items():
        res = analyse_variety(code, fut, market["index"][code][:end], market["etf"][code][:end], market["rate"])
        if res is None:
            continue
        check = etf_check(market["etf"][code], market["index"][code], market.get("tr_index", {}).get(code), res["start"])
        splits = [d for d in market.get("splits", {}).get(code, []) if d >= res["start"]]
        out["varieties"].append({"code": code, "index": name, "etf": etf_name, "etf_code": etf_code,
                                 "check": check, "splits": splits})
        print(f"  {code} 自检：ETF 对指数 beta {check['beta']}，ETF 年化 {check['etf_ann']}，"
              f"全收益指数年化 {check['tr_ann']}，差 {check['gap']}；样本内份额折算日 {splits or '无'}")
        out["results"][code] = res
        s = res["arb"]["summary"]
        print(f"  {code}: {res['start']}—{res['end']}，择机套利 {s['trades']} 笔，"
              f"相对现金年化 {s['excess_ann']:.4f}；一直持有相对现金年化 {res['carry']['summary']['excess_ann']:.4f}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--offline", action="store_true", help="只用本机缓存")
    args = ap.parse_args()
    print("取数…")
    market = fetch_market(args.offline)
    print("计算…")
    result = build(market)
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"写出 {OUT.relative_to(ROOT)}（{OUT.stat().st_size // 1024} KB）")


if __name__ == "__main__":
    main()
