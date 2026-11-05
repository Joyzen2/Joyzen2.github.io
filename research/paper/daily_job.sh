#!/bin/zsh
# 每个交易日收盘后由 launchd 调用：把试运行账本补到今天。没有要补的日子时只查一次交易日历。
# 用法：daily_job.sh [run.py 的其他参数]；日志写到 research/paper/logs/。
set -u
cd "$(dirname "$0")/../.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export NO_PROXY=localhost,127.0.0.1,::1,.local
if nc -z -G 2 127.0.0.1 1078 >/dev/null 2>&1; then       # 本机代理开着就走代理，和手动运行一样；没开就直连
  export HTTP_PROXY=http://127.0.0.1:1078 HTTPS_PROXY=http://127.0.0.1:1078
fi
LOG=research/paper/logs/dryrun.log
mkdir -p research/paper/logs
{
  print "===== $(date '+%F %T')"
  uv run research/paper/run.py daily --catch-up --dry-run --signal benchmark "$@"
  code=$?
  print "===== exit $code"
} >>"$LOG" 2>&1
[ "$code" -eq 0 ] && exit 0
# 当天最后一次尝试还是失败才弹通知，下午那次因为指数没发布而失败是正常的
if [ "$(date +%H)" -ge 23 ]; then
  osascript -e 'display notification "今天的账没有记上，明天晚上会自动补。详情见 ~/paper-trading/research/paper/logs/dryrun.log" with title "模拟实盘试运行"' >/dev/null 2>&1
fi
exit 1
