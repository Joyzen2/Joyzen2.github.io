"""公开数据接口。原始数据只缓存在 research/paper/.cache/，不进仓库。

所有请求都带超时与重试；取不到的不写缓存，下次运行会再试。
行情口径：复权价 = 东方财富不复权价 × 新浪后复权因子（东财自带的后复权是加法复权，不能直接相除）。
"""
from __future__ import annotations

import datetime as dt
import os
import sys
import time
from contextlib import contextmanager

import pandas as pd

from . import config as C

sys.path.insert(0, str(C.REPO / "research" / "basis"))


def _retry(fn, what: str, tries: int = 4):
    for attempt in range(tries):
        try:
            return fn()
        except Exception as exc:  # 公开接口的报错种类很多，统一重试
            if attempt == tries - 1:
                raise RuntimeError(f"{what} 取数失败：{type(exc).__name__}: {exc}") from exc
            time.sleep(2 ** attempt)


@contextmanager
def _direct():
    """申万官网走本机代理时证书校验失败，这类请求临时去掉代理直连。"""
    saved = {k: os.environ.pop(k) for k in list(os.environ) if k.lower() in ("http_proxy", "https_proxy", "all_proxy")}
    try:
        yield
    finally:
        os.environ.update(saved)


def _cache(name: str) -> "os.PathLike":
    path = C.CACHE / name
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def sina_symbol(code: str) -> str:
    return ("sh" if code.startswith(("6", "9")) else "sz") + code


class AkshareData:
    """模拟实盘用到的全部公开数据。"""

    def __init__(self, offline: bool = False):
        self.offline = offline
        import akshare as ak  # 延迟导入，测试时不需要
        self.ak = ak

    # ── 日历、成分、指数 ──
    def calendar(self) -> list[dt.date]:
        path = _cache("calendar.csv")
        if not self.offline or not path.exists():
            df = _retry(self.ak.tool_trade_date_hist_sina, "交易日历")
            df.to_csv(path, index=False)
        return [d.date() for d in pd.to_datetime(pd.read_csv(path)["trade_date"])]

    def members(self, day: dt.date) -> pd.DataFrame:
        """中证500 最新成分与权重（中证官网只给最新一期）。每天存一份快照，以后可以攒出历史序列。"""
        path = _cache(f"members/{day:%Y%m%d}.csv")
        if path.exists():
            return pd.read_csv(path, dtype={"code": str})
        df = _retry(lambda: self.ak.index_stock_cons_weight_csindex(symbol=C.INDEX), "中证500 成分")
        out = pd.DataFrame({"code": df["成分券代码"].astype(str).str.zfill(6), "name": df["成分券名称"],
                            "weight": pd.to_numeric(df["权重"], errors="coerce") / 100,
                            "as_of": pd.to_datetime(df["日期"]).dt.date})
        out.to_csv(path, index=False)
        return out

    def index_close(self, symbol: str, start: dt.date, end: dt.date) -> pd.Series:
        df = _retry(lambda: self.ak.stock_zh_index_hist_csindex(
            symbol=symbol, start_date=f"{start:%Y%m%d}", end_date=f"{end:%Y%m%d}"), f"指数 {symbol}")
        return pd.Series(pd.to_numeric(df["收盘"], errors="coerce").values,
                         index=pd.to_datetime(df["日期"]).dt.date, name=symbol).dropna()

    def index_open(self, symbol: str, day: dt.date) -> float:
        df = _retry(lambda: self.ak.stock_zh_index_hist_csindex(
            symbol=symbol, start_date=f"{day:%Y%m%d}", end_date=f"{day:%Y%m%d}"), f"指数 {symbol} 开盘")
        return float(pd.to_numeric(df["开盘"], errors="coerce").iloc[-1])

    # ── 个股 ──
    def bars(self, code: str, start: dt.date, end: dt.date) -> pd.DataFrame:
        """不复权日线，按股票增量缓存。列：date open high low close volume amount turnover。"""
        path = _cache(f"bars/{code}.csv")
        old = pd.read_csv(path, parse_dates=["date"]) if path.exists() else pd.DataFrame()
        if not self.offline:
            since = start if old.empty else max(start, (old["date"].max() - pd.Timedelta(days=10)).date())
            df = _retry(lambda: self.ak.stock_zh_a_hist(symbol=code, period="daily", start_date=f"{since:%Y%m%d}",
                                                        end_date=f"{end:%Y%m%d}", adjust=""), f"{code} 日线")
            if df is not None and len(df):
                new = pd.DataFrame({"date": pd.to_datetime(df["日期"]), "open": df["开盘"], "high": df["最高"],
                                    "low": df["最低"], "close": df["收盘"], "volume": df["成交量"],
                                    "amount": df["成交额"], "turnover": df["换手率"]})
                old = pd.concat([old, new]).drop_duplicates("date", keep="last").sort_values("date")
                old.to_csv(path, index=False)
            time.sleep(0.3)
        if old.empty:
            return old
        return old[(old["date"].dt.date >= start) & (old["date"].dt.date <= end)].reset_index(drop=True)

    def hfq_factor(self, code: str, refresh: bool = True) -> pd.Series:
        """新浪后复权因子（只在除权除息日变化），按日期升序。"""
        path = _cache(f"factors/{code}.csv")
        if refresh and not self.offline:
            df = _retry(lambda: self.ak.stock_zh_a_daily(symbol=sina_symbol(code), adjust="hfq-factor"), f"{code} 复权因子")
            df.to_csv(path, index=False)
            time.sleep(0.3)
        df = pd.read_csv(path)
        return pd.Series(pd.to_numeric(df["hfq_factor"]).values, index=pd.to_datetime(df["date"]).dt.date).sort_index()

    def st_codes(self) -> set[str]:
        df = _retry(self.ak.stock_zh_a_st_em, "ST 名单")
        return set(df["代码"].astype(str).str.zfill(6))

    def industry(self) -> pd.DataFrame:
        """申万行业分类历史（对申万官网直连）。"""
        path = _cache("sw_industry.csv")
        if not self.offline or not path.exists():
            with _direct():
                df = _retry(self.ak.stock_industry_clf_hist_sw, "申万行业")
            df.to_csv(path, index=False)
        return pd.read_csv(path, dtype={"symbol": str, "industry_code": str})

    # ── 利率与期货 ──
    def shibor_3m(self) -> pd.Series:
        df = _retry(lambda: self.ak.rate_interbank(market="上海银行同业拆借市场", symbol="Shibor人民币", indicator="3月"),
                    "Shibor 3M")
        return pd.Series(pd.to_numeric(df["利率"], errors="coerce").values / 100,
                         index=pd.to_datetime(df["报告日"]).dt.date).sort_index().dropna()

    def ic_closes(self, day: dt.date) -> dict[str, float]:
        """当日 IC 各合约收盘价，取自中金所每日行情（复用期现套利脚本的解析）。"""
        import arbitrage as basis
        d = f"{day:%Y%m%d}"
        r = basis._http_get(f"http://www.cffex.com.cn/sj/hqsj/rtj/{d[:6]}/{d[6:]}/{d}_1.csv")
        if r is None or not r.ok or not r.content or b"<html" in r.content[:200].lower():
            raise RuntimeError(f"中金所 {d} 行情尚未发布")
        df = basis._parse_cffex_csv(r.content, d)
        df = df[df["variety"] == C.HEDGE_VARIETY].dropna(subset=["close"])
        return dict(zip(df["symbol"], df["close"].astype(float)))
