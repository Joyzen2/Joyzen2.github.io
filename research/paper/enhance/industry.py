"""申万一级行业（时点）。每个日期取当时生效的归属，不拿今天的分类往回套。移植自中证500 研究。"""
from __future__ import annotations

import pandas as pd

# 申万官方分类码的前两位 + 0000 就是一级行业码，官方文件只发代码不发中文名
L1_NAMES = {
    "110000": "农林牧渔", "220000": "基础化工", "230000": "钢铁", "240000": "有色金属", "270000": "电子",
    "280000": "汽车", "330000": "家用电器", "340000": "食品饮料", "350000": "纺织服饰", "360000": "轻工制造",
    "370000": "医药生物", "410000": "公用事业", "420000": "交通运输", "430000": "房地产", "450000": "商贸零售",
    "460000": "社会服务", "480000": "银行", "490000": "非银金融", "510000": "综合", "610000": "建筑材料",
    "620000": "建筑装饰", "630000": "电力设备", "640000": "机械设备", "650000": "国防军工", "710000": "计算机",
    "720000": "传媒", "730000": "通信", "740000": "煤炭", "750000": "石油石化", "760000": "环保", "770000": "美容护理",
}


def history(data) -> pd.DataFrame:
    sw = data.industry()
    sw = sw.assign(code=sw["symbol"].astype(str).str.zfill(6), start_date=pd.to_datetime(sw["start_date"]),
                   l1_code=sw["industry_code"].astype(str).str.zfill(6).str[:2] + "0000")
    return sw.sort_values(["code", "start_date"])[["code", "start_date", "l1_code"]].reset_index(drop=True)


def at(hist: pd.DataFrame, date: pd.Timestamp) -> pd.Series:
    """code -> 申万一级行业代码（date 当天生效的归属）。"""
    cur = hist[hist.start_date <= date].groupby("code").tail(1)
    return cur.set_index("code")["l1_code"]
