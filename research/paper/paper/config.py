"""模拟实盘的全部参数。改动任何一项，都应在页面和提交说明里写明生效日期。"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # research/paper
REPO = ROOT.parents[1]                              # 仓库根目录
CACHE = ROOT / ".cache"                             # 原始行情，只在本机
STATE = ROOT / "state"                              # 公开记录：持仓、成交、净值、信号
SITE_JSON = REPO / "portfolio" / "public" / "research-data" / "paper.json"

# ── 账户 ──
CAPITAL = 10_000_000              # 虚拟初始资金（元）
FIRST_SIGNAL = "2026-11-30"       # 第一次正式信号日；第一次成交为下一个交易日开盘
BENCHMARK = "H00905"              # 中证500 全收益指数
INDEX = "000905"                  # 中证500 价格指数（成分股来源）

# ── 成本（与研究口径一致）──
BUY_COST = 0.0010                 # 买入，含佣金与滑点
SELL_COST = 0.0010                # 卖出，含佣金与滑点
STAMP_DUTY = 0.0005               # 卖出印花税
CASH_BUFFER = 0.005               # 调仓后保留的现金比例，用来付成本与整手取整的余数

# ── 组合约束 ──
TARGET_HOLDINGS = 80              # 目标持仓只数（近似：候选池 + 小权重剔除）
CANDIDATES = 160                  # 候选池：分数最高的前 N 只，加上现有持仓
MIN_WEIGHT = 0.003                # 优化后低于此权重的剔除再归一
STOCK_CAP = 0.02                  # 个股权重上限
INDUSTRY_BAND = 0.03              # 申万一级行业主动暴露
SIZE_BAND = 0.10                  # 规模、非线性规模主动暴露（沿用研究）
STYLE_BAND = 0.50                 # 其余风格主动暴露（沿用研究）
TE_CAP = 0.05                     # 年化跟踪误差上限（沿用研究，含滚动偏差校准）
TURNOVER_CAP = 0.30               # 单月单边换手上限

# ── 信号 ──
SIGNAL = "icir"                   # 月频 ICIR 合成，37 个因子
IC_LOOKBACK_MONTHS = 36
HISTORY_DAYS = 300                # 取数回看的交易日数（满足 240 日窗口并留余量）

# ── 股指期货对冲（口径与期现套利页一致）──
HEDGE_VARIETY = "IC"
HEDGE_MULTIPLIER = 200            # IC 合约乘数（元/点）
HEDGE_RATIO = 1.0                 # 空头名义金额 / 多头市值
MARGIN = 0.15                     # 保证金占用，按合约面值
FUT_FEE = 0.000023                # 股指期货手续费，单边
FUT_SLIPPAGE = 0.0001             # 股指期货滑点，单边
ROLL_MIN_DAYS = 20                # 持有剩余天数大于此值的最近合约
HEDGE_BAND = 0.08                 # 实际对冲比例偏离目标超过此值才调整手数（1000 万约 8 手，每手约占 12%）
