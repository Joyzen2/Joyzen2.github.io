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

from . import clock
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
    """临时去掉代理直连。申万官网的问题其实是只发叶子证书、证书链不完整，直连也不一定成功，取不到时沿用本机副本。"""
    saved = {k: os.environ.pop(k) for k in list(os.environ) if k.lower() in ("http_proxy", "https_proxy", "all_proxy")}
    try:
        yield
    finally:
        os.environ.update(saved)


def _cache(name: str) -> "os.PathLike":
    path = C.CACHE / name
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


NO_FACTOR = "sina hfq factor not available"   # akshare 在新浪没有这只股票的因子时抛出的消息


def sina_symbol(code: str) -> str:
    return ("sh" if code.startswith(("6", "9")) else "sz") + code


class AkshareData:
    """模拟实盘用到的全部公开数据。"""

    def __init__(self, offline: bool = False):
        self.offline = offline
        self._index: dict[str, pd.Series] = {}
        self._factor_memo: dict[str, pd.Series] = {}
        self._asked: set = set()
        import akshare as ak  # 延迟导入，测试时不需要
        self.ak = ak

    # ── 日历、成分、指数 ──
    def calendar(self) -> list[dt.date]:
        if getattr(self, "_cal", None):
            return self._cal
        path = _cache("calendar.csv")
        if not self.offline or not path.exists():
            df = _retry(self.ak.tool_trade_date_hist_sina, "交易日历")
            df.to_csv(path, index=False)
        self._cal = [d.date() for d in pd.to_datetime(pd.read_csv(path)["trade_date"])]
        return self._cal

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

    def _csindex(self, symbol: str, start: dt.date, end: dt.date) -> pd.DataFrame:
        try:
            return _retry(lambda: self.ak.stock_zh_index_hist_csindex(
                symbol=symbol, start_date=f"{start:%Y%m%d}", end_date=f"{end:%Y%m%d}"), f"指数 {symbol}", tries=3)
        except RuntimeError as exc:
            raise RuntimeError(f"{exc}。如果是 JSONDecodeError 或 HTTP 403，多半是被中证官网限流，"
                               "请过一段时间再跑，不要连续重试") from exc

    def index_close(self, symbol: str, start: dt.date, end: dt.date) -> pd.Series:
        """中证官网指数收盘，按代码缓存在本机，只补取缺的日期；同一次运行里不重复请求（官网对高频请求会封）。"""
        path = _cache(f"index/{symbol}.csv")
        if symbol not in self._index:
            self._index[symbol] = (pd.read_csv(path, parse_dates=["date"]).set_index("date")["close"]
                                   if path.exists() else pd.Series(dtype="float64"))
        have = self._index[symbol]
        if have.empty or have.index.min().date() > start:
            need_from, wanted = start, True
        else:
            last = have.index.max().date()
            # 缺日期，或最后一行是收盘前写入的（可能是盘中值），才请求。请求总是从缓存最后一天起：
            # 范围里一定有已发布的行，当天还没发布时返回的就是"缺当天"，而不是空表（akshare 在空表上会报错）
            need_from, wanted = last, last < end or not clock.written_after_close(path, last)
        if not self.offline and wanted and (symbol, end) not in self._asked:
            self._asked.add((symbol, end))
            df = self._csindex(symbol, need_from, end)
            if df is not None and len(df):
                got = pd.Series(pd.to_numeric(df["收盘"], errors="coerce").values, index=pd.to_datetime(df["日期"])).dropna()
                have = pd.concat([have, got]).groupby(level=0).last().sort_index()
                self._index[symbol] = have
                have.rename("close").rename_axis("date").to_csv(path)
        out = have[(have.index.date >= start) & (have.index.date <= end)]
        return pd.Series(out.values, index=out.index.date, name=symbol)

    def index_open(self, symbol: str, day: dt.date) -> float:
        df = self._csindex(symbol, day - dt.timedelta(days=10), day)   # 范围里带上前几天，避免空表
        df = df[pd.to_datetime(df["日期"]).dt.date == day]
        if df.empty:
            from .book import StaleData
            raise StaleData(f"{symbol} 的 {day} 行情还没有发布，请稍后再跑")
        return float(pd.to_numeric(df["开盘"], errors="coerce").iloc[-1])

    # ── 个股 ──
    def bars(self, code: str, start: dt.date, end: dt.date) -> pd.DataFrame:
        """不复权日线，按股票增量缓存。列：date open high low close volume amount turnover。"""
        path = _cache(f"bars/{code}.csv")
        old = pd.read_csv(path, parse_dates=["date"]) if path.exists() else pd.DataFrame()
        short = old.empty or old["date"].min().date() > start + dt.timedelta(days=10)
        last = None if old.empty else old["date"].max().date()
        # 缓存到了 end 还不够：end 那一行必须是收盘后取的，盘中取到的是半截日线
        covered = not short and (last > end or (last == end and clock.written_after_close(path, end)))
        if not self.offline and not covered:
            since = start if short else max(start, (old["date"].max() - pd.Timedelta(days=10)).date())
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
        if code in self._factor_memo:
            return self._factor_memo[code]
        fresh = clock.written_after_close(path, clock.today())   # 今天收盘后取过就不再取
        if refresh and not self.offline and not fresh:
            try:
                df = _retry(lambda: self.ak.stock_zh_a_daily(symbol=sina_symbol(code), adjust="hfq-factor"),
                            f"{code} 复权因子")
            except RuntimeError as exc:
                # 只有新浪明确说没有（如 689009）才当作没有因子；限流、网络失败必须报错，
                # 否则除权日会静默用旧因子，当天净值记错
                if NO_FACTOR not in str(exc.__cause__ or ""):
                    raise
                print(f"  {code} 新浪不提供复权因子", flush=True)
                df = pd.DataFrame({"date": [], "hfq_factor": []})
            df.to_csv(path, index=False)
            time.sleep(0.3)
        df = pd.read_csv(path) if path.exists() else pd.DataFrame({"date": [], "hfq_factor": []})
        out = pd.Series(pd.to_numeric(df["hfq_factor"]).values, index=pd.to_datetime(df["date"]).dt.date).sort_index()
        self._factor_memo[code] = out
        return out

    def last_session(self) -> dt.date:
        """今天及以前最近的一个交易日。"""
        return max(d for d in self.calendar() if d <= clock.today())

    def value_history(self, code: str) -> pd.DataFrame:
        """日频总市值、流通市值（元）、总股本（股），东财，2018 年起。信号日才用，当天只取一次。"""
        path = _cache(f"value/{code}.csv")
        # 今天收盘后取过、而且已经有最近一个交易日的行，才不再取（东财估值表当天那一行可能晚于收盘发布）
        fresh = clock.written_after_close(path, clock.today()) and \
            pd.read_csv(path, usecols=["date"])["date"].max() >= self.last_session().isoformat()
        if not self.offline and not fresh:
            df = _retry(lambda: self.ak.stock_value_em(symbol=code), f"{code} 估值")
            out = pd.DataFrame({"date": pd.to_datetime(df["数据日期"]), "total_mcap": pd.to_numeric(df["总市值"], errors="coerce"),
                                "float_mcap": pd.to_numeric(df["流通市值"], errors="coerce"),
                                "total_shares": pd.to_numeric(df["总股本"], errors="coerce")})
            out.to_csv(path, index=False)
            time.sleep(0.3)
        if not path.exists():
            return pd.DataFrame()
        return pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()

    def fin_period(self, report: str, period: str) -> pd.DataFrame:
        """一个报告期的全市场财报（enhance/fetch.py 直接请求东财数据中心，带 NOTICE_DATE）。

        最近四个报告期每天最多重取一次（财报陆续披露），更早的只取一次。
        """
        import fetch  # enhance/ 由 signal.icir_target 加入 sys.path
        path = _cache(f"fin/{report}/{period}.csv")
        recent = dt.date.fromisoformat(period) >= dt.date.today() - dt.timedelta(days=400)
        stale = recent and path.exists() and dt.date.fromtimestamp(path.stat().st_mtime) != dt.date.today()
        if not self.offline and (not path.exists() or stale):
            if not hasattr(self, "_fin_session"):
                self._fin_session, self._fin_throttle = fetch.session(), fetch.Throttle()
            fetch.fetch_period(self._fin_session, self._fin_throttle, report, period).to_csv(path, index=False)
        return pd.read_csv(path, dtype={"SECURITY_CODE": str})

    def dividends(self, period: str) -> pd.DataFrame:
        """一个报告期的分红方案（东财）：code、cash_per_10（每 10 股派现，元）、ex_date。period 形如 20251231。"""
        path = _cache(f"dividends/{period}.csv")
        recent = dt.datetime.strptime(period, "%Y%m%d").date() >= dt.date.today() - dt.timedelta(days=400)
        stale = recent and path.exists() and dt.date.fromtimestamp(path.stat().st_mtime) != dt.date.today()
        if not self.offline and (not path.exists() or stale):
            try:
                df = _retry(lambda: self.ak.stock_fhps_em(date=period), f"{period} 分红", tries=2)
                out = pd.DataFrame({"code": df["代码"].astype(str).str.zfill(6),
                                    "cash_per_10": pd.to_numeric(df["现金分红-现金分红比例"], errors="coerce"),
                                    "ex_date": pd.to_datetime(df["除权除息日"], errors="coerce")})
            except RuntimeError:              # 季报期经常没有分红方案，接口直接报错
                out = pd.DataFrame(columns=["code", "cash_per_10", "ex_date"])
            out.to_csv(path, index=False)
        if not path.exists():
            return pd.DataFrame({"code": pd.Series(dtype=str), "cash_per_10": pd.Series(dtype=float), "ex_date": pd.Series(dtype="datetime64[ns]")})
        return pd.read_csv(path, dtype={"code": str}, parse_dates=["ex_date"])

    def st_codes(self) -> set[str]:
        df = _retry(self.ak.stock_zh_a_st_em, "ST 名单")
        return set(df["代码"].astype(str).str.zfill(6))

    def industry(self) -> pd.DataFrame:
        """申万行业分类历史（对申万官网直连）。"""
        path = _cache("sw_industry.csv")
        if not self.offline or not path.exists():
            try:
                with _direct():
                    df = _retry(self.ak.stock_industry_clf_hist_sw, "申万行业", tries=2)
                df.to_csv(path, index=False)
            except RuntimeError as exc:
                # 官网只发叶子证书，还时常返回 508，与是否走代理无关；分类变动很少，沿用上一次取到的副本
                if not path.exists():
                    raise
                saved = dt.date.fromtimestamp(path.stat().st_mtime)
                print(f"  申万行业取不到，沿用 {saved} 的本机副本（{type(exc.__cause__).__name__}）", flush=True)
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
        url = f"http://www.cffex.com.cn/sj/hqsj/rtj/{d[:6]}/{d[6:]}/{d}_1.csv"

        def get():
            r = basis._http_get(url)
            if r is None or r.status_code >= 500:
                raise ConnectionError(f"HTTP {getattr(r, 'status_code', '无响应')}")
            return r

        r = _retry(get, f"中金所 {d} 行情")      # 网络失败重试；下面才是真的还没发布
        if r.status_code == 404 or not r.content or b"<html" in r.content[:200].lower():
            from .book import StaleData
            raise StaleData(f"中金所 {d} 的行情还没有发布，请稍后再跑")
        df = basis._parse_cffex_csv(r.content, d)
        df = df[df["variety"] == C.HEDGE_VARIETY].dropna(subset=["close"])
        return dict(zip(df["symbol"], df["close"].astype(float)))
