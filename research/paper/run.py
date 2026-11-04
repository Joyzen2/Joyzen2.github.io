# /// script
# requires-python = ">=3.12"
# dependencies = ["akshare>=1.17", "pandas>=2.2", "requests>=2.31"]
# ///
"""中证500 指数增强模拟实盘：每个交易日收盘后运行一次。

    uv run research/paper/run.py daily                         正式记录，写入 research/paper/state/
    uv run research/paper/run.py daily --dry-run --signal benchmark --force-signal
                                                               试运行，写入 research/paper/state-dryrun/（不进仓库）
    uv run research/paper/run.py export                        只导出网站数据

正式信号（--signal icir，默认）需要先把原研究项目的模块移植到 research/paper/enhance/。
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from paper import config as C  # noqa: E402
from paper.book import Book, run_day  # noqa: E402


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def export(state: Path, out: Path) -> None:
    """把公开记录整理成网站读取的 JSON。"""
    acct = json.loads((state / "account.json").read_text(encoding="utf-8")) if (state / "account.json").exists() else {}
    nav = _read_csv(state / "nav.csv")
    signals = sorted(p.stem for p in (state / "signals").glob("*.json"))
    latest = json.loads((state / "signals" / f"{signals[-1]}.json").read_text(encoding="utf-8")) if signals else None
    data = {
        "generated": dt.date.today().isoformat(),
        "started": acct.get("started"),
        "capital": C.CAPITAL,
        "settings": {k: getattr(C, k) for k in [
            "BENCHMARK", "BUY_COST", "SELL_COST", "STAMP_DUTY", "TARGET_HOLDINGS", "STOCK_CAP", "INDUSTRY_BAND",
            "SIZE_BAND", "STYLE_BAND", "TE_CAP", "TURNOVER_CAP", "SIGNAL", "HEDGE_VARIETY", "HEDGE_RATIO", "MARGIN"]},
        "nav": [{k: row[k] for k in ("date", "nav_long", "nav_bench", "nav_hedged", "hedge_ratio", "holdings")} for row in nav],
        "holdings": {c: round(s, 4) for c, s in sorted(acct.get("holdings", {}).items())},
        "cash": acct.get("cash"),
        "hedge": acct.get("hedge"),
        "signals": signals,
        "latest_signal": latest,
        "trades": _read_csv(state / "trades.csv")[-400:],
        "hedge_events": _read_csv(state / "hedge.csv"),
    }
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"写出 {out.relative_to(C.REPO)}")


def main() -> None:
    ap = argparse.ArgumentParser(description="中证500 指数增强模拟实盘")
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("daily", help="记一个交易日的账")
    d.add_argument("--date", help="交易日 YYYY-MM-DD，默认今天")
    d.add_argument("--signal", choices=["icir", "benchmark"], default="icir")
    d.add_argument("--dry-run", action="store_true", help="写入 state-dryrun/，不影响正式记录")
    d.add_argument("--force-signal", action="store_true", help="试运行时把这一天当作月末信号日")
    d.add_argument("--offline", action="store_true", help="只用本机缓存")
    sub.add_parser("export", help="只导出网站数据")
    args = ap.parse_args()

    if args.cmd == "export":
        export(C.STATE, C.SITE_JSON)
        return
    if (args.signal == "benchmark" or args.force_signal) and not args.dry_run:
        sys.exit("占位信号和强制信号日只能用于试运行（加 --dry-run）")
    from paper.data import AkshareData
    state = C.ROOT / "state-dryrun" if args.dry_run else C.STATE
    day = dt.date.fromisoformat(args.date) if args.date else dt.date.today()
    res = run_day(Book(state), AkshareData(offline=args.offline), day, strategy=args.signal,
                  force_signal=args.force_signal, dry_run=args.dry_run)
    print(json.dumps(res, ensure_ascii=False, indent=1, default=str))
    if not args.dry_run:
        export(C.STATE, C.SITE_JSON)


if __name__ == "__main__":
    main()
