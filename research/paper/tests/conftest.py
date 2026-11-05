import datetime as dt
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from paper import clock  # noqa: E402


@pytest.fixture(autouse=True)
def after_close(monkeypatch):
    """测试里的交易日可能晚于真实的今天：把"现在"放到很远的将来，这些日子都算已收盘。
    需要测收盘前行为的测试自己再覆盖。"""
    monkeypatch.setattr(clock, "now", lambda: dt.datetime(2030, 1, 1, 12, tzinfo=clock.TZ))
