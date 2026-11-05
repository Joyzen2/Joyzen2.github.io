"""收盘判断。东方财富盘中就会返回当天那一行（价格、成交额都是半截的），
所以"缓存里有当天的行"不等于"取到了收盘数据"：只有在当天 SETTLED_AFTER 之后写入的缓存才算数。"""
from __future__ import annotations

import datetime as dt
import os
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Shanghai")
SETTLED_AFTER = dt.time(15, 30)       # 收盘 15:00，留半小时让各数据源写完


def now() -> dt.datetime:
    """北京时间的现在。测试里替换这个函数。"""
    return dt.datetime.now(TZ)


def today() -> dt.date:
    return now().date()


def settle_time(day: dt.date) -> dt.datetime:
    return dt.datetime.combine(day, SETTLED_AFTER, tzinfo=TZ)


def closed(day: dt.date) -> bool:
    """这一天的收盘数据是否应当已经发布。"""
    return now() >= settle_time(day)


def written_after_close(path: "os.PathLike", day: dt.date) -> bool:
    """缓存文件是否在 day 收盘之后写入（用文件修改时间判断）。"""
    if not os.path.exists(path):
        return False
    mtime = dt.datetime.fromtimestamp(os.path.getmtime(path), TZ)
    return mtime >= settle_time(day)
