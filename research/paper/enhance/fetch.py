"""东方财富数据中心的财报请求，移植自中证500 研究。

AkShare 的财报接口不返回首次披露日 NOTICE_DATE，所以直接请求数据中心：
  业绩报表 CPD 的 NOTICE_DATE 是该期首次披露日；
  三张报表 DMSK 的 NOTICE_DATE 是「最近一次包含该期数据的报告」的日期，会晚一年以上，只取数值不取日期。
"""
from __future__ import annotations

import random
import time

import pandas as pd
import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
EM_URL = "https://datacenter-web.eastmoney.com/api/data/v1/get"

REPORTS = {
    "cpd": dict(
        name="RPT_LICO_FN_CPD", date_col="REPORTDATE",
        extra='(SECURITY_TYPE_CODE="058001001")',      # 只要 A 股，去掉新三板和 B 股
        columns=["SECURITY_CODE", "SECURITY_NAME_ABBR", "TRADE_MARKET", "REPORTDATE",
                 "NOTICE_DATE", "UPDATE_DATE", "EITIME", "BASIC_EPS", "DEDUCT_BASIC_EPS",
                 "TOTAL_OPERATE_INCOME", "PARENT_NETPROFIT", "WEIGHTAVG_ROE", "YSTZ",
                 "SJLTZ", "BPS", "MGJYXJJE", "XSMLL", "YSHZ", "SJLHZ", "DATATYPE"],
    ),
    "balance": dict(
        name="RPT_DMSK_FN_BALANCE", date_col="REPORT_DATE", extra="",
        columns=["SECURITY_CODE", "REPORT_DATE", "NOTICE_DATE", "TOTAL_ASSETS",
                 "TOTAL_LIABILITIES", "TOTAL_EQUITY", "MONETARYFUNDS", "ACCOUNTS_RECE",
                 "INVENTORY", "FIXED_ASSET", "CURRENT_RATIO", "DEBT_ASSET_RATIO"],
    ),
    "cashflow": dict(
        name="RPT_DMSK_FN_CASHFLOW", date_col="REPORT_DATE", extra="",
        columns=["SECURITY_CODE", "REPORT_DATE", "NOTICE_DATE", "NETCASH_OPERATE",
                 "NETCASH_INVEST", "NETCASH_FINANCE", "CONSTRUCT_LONG_ASSET"],
    ),
    "income": dict(
        name="RPT_DMSK_FN_INCOME", date_col="REPORT_DATE", extra="",
        columns=["SECURITY_CODE", "REPORT_DATE", "NOTICE_DATE", "TOTAL_OPERATE_INCOME",
                 "TOTAL_OPERATE_COST", "OPERATE_COST", "OPERATE_PROFIT", "TOTAL_PROFIT",
                 "INCOME_TAX", "PARENT_NETPROFIT", "DEDUCT_PARENT_NETPROFIT"],
    ),
}


def session() -> requests.Session:
    # 国内源直连：本机 shell 可能带 HTTPS_PROXY，东财走代理可能被拦
    s = requests.Session()
    s.trust_env = False
    s.headers.update({"User-Agent": UA, "Referer": "https://data.eastmoney.com/"})
    return s


class Throttle:
    """东财风控：串行，两次请求至少间隔 min_gap 秒再加随机抖动。"""

    def __init__(self, min_gap: float = 0.7):
        self.min_gap = min_gap
        self.last = 0.0

    def wait(self):
        gap = self.min_gap + random.uniform(0.1, 0.4) - (time.time() - self.last)
        if gap > 0:
            time.sleep(gap)
        self.last = time.time()


def _page(s, thr, report, period, page):
    spec = REPORTS[report]
    params = {
        "reportName": spec["name"], "columns": ",".join(spec["columns"]),
        "filter": f"({spec['date_col']}='{period}'){spec['extra']}",
        "pageNumber": page, "pageSize": 500,
        "sortColumns": "SECURITY_CODE", "sortTypes": "1",   # 固定排序，分页才不会漏行重行
        "source": "WEB", "client": "WEB",
    }
    for attempt in range(5):
        thr.wait()
        try:
            r = s.get(EM_URL, params=params, timeout=30)
            r.raise_for_status()
            d = r.json()
            res = d.get("result")
            if res is None:
                if d.get("code") == 9201:      # "返回数据为空"：该期确实没有数据
                    return [], 0
                raise RuntimeError(f"东财返回异常 code={d.get('code')} msg={d.get('message')}")
            return res.get("data") or [], int(res.get("pages") or 0)
        except Exception:                      # noqa: BLE001  网络抖动重试
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"{report} {period} 第 {page} 页连续 5 次失败")


def fetch_period(s, thr, report: str, period: str) -> pd.DataFrame:
    """一个报告期的全市场数据。period 形如 2026-06-30；代码补零，列名和日期统一。"""
    rows, pages = _page(s, thr, report, period, 1)
    for p in range(2, pages + 1):
        more, _ = _page(s, thr, report, period, p)
        rows += more
    df = pd.DataFrame(rows, columns=REPORTS[report]["columns"]).drop_duplicates()
    df = df.rename(columns={REPORTS[report]["date_col"]: "report_date"})
    df["SECURITY_CODE"] = df["SECURITY_CODE"].astype(str).str.zfill(6)
    return df.sort_values(["SECURITY_CODE", "NOTICE_DATE"]).drop_duplicates(["SECURITY_CODE", "report_date"], keep="first")
