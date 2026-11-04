import { useState } from 'react';
import { pct, num, arrow, Segments, Section, Note, DataTable, Sources, LineChart, Bars } from './ui.jsx';

const bp = n => n == null ? '—' : `${(n * 10000).toFixed(2).replace(/\.?0+$/, '')}‱`;
const signed = (n, digits = 2) => n == null ? '—' : `${n > 0 ? '+' : ''}${pct(n, digits)}`;
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// Only the valid points of a series, with their dates, so a chart never draws through gaps.
function points(dates, values) {
  const d = [], v = [];
  values.forEach((x, i) => { if (Number.isFinite(x)) { d.push(dates[i]); v.push(x); } });
  return { dates: d, values: v };
}

function latest(series) {
  for (let i = series.ann.length - 1; i >= 0; i--) if (Number.isFinite(series.ann[i])) return [series.dates[i], series.ann[i]];
  return [null, null];
}

const STEPS = {
  pricing: ['先扣掉利率和分红，再谈偏离。', '持有成本模型给出期货的理论价格：F = S × (1 + (r − q) × t)。期货相对指数的偏离，只有在扣掉资金成本 r、预期分红 q 与交易成本之后，才构成可以讨论的机会。高股息指数在年中集中分红，原始基差会因此被系统性压低。'],
  forward: ['期货升水：买入 ETF，卖出期货。', '升水幅度超过成本时，买入跟踪同一指数的 ETF、卖出等名义金额的期货，持有到合约最后交易日，锁定基差收敛。资金占用是 ETF 全额加期货保证金，收益必须与同期资金成本比较，而不是与零比较。'],
  reverse: ['期货贴水：理论上反过来做。', '贴水时应卖出现货、买入期货。在 A 股，这需要融券卖出 ETF；券源能否借到、费率多少，都不稳定，也没有公开的历史数据。本页只统计这种机会出现的频率，不计算它的收益。'],
  hedge: ['同一个基差，两边结论相反。', '持有股票组合、用期货空头对冲市场风险的中性策略，持续承担贴水收敛带来的损失；用期货多头替代现货的指数增强，则把同一笔贴水变成收益。期现套利、对冲成本与期货替代，读的是同一组数。'],
};

export default function Arbitrage({ data }) {
  const codes = data.varieties.map(v => v.code);
  const meta = Object.fromEntries(data.varieties.map(v => [v.code, v]));
  const [code, setCode] = useState(codes.includes('IC') ? 'IC' : codes[0]);
  const [step, setStep] = useState('pricing');
  const [carryCode, setCarryCode] = useState(code);
  const [arbCode, setArbCode] = useState(codes.includes('IF') ? 'IF' : codes[0]);
  const a = data.assumptions;
  const res = data.results[code];
  const mon = points(res.monitor.dates, res.monitor.ann);
  const dist = res.distribution;
  const options = codes.map(c => [c, c]);

  const carry = data.results[carryCode].carry;
  const carryCurve = points(carry.curve.dates, carry.curve.excess);
  const cs = carry.summary;

  const arb = data.results[arbCode].arb;
  const arbCurve = points(arb.curve.dates, arb.curve.excess);
  const closed = arb.trades.filter(t => !t.open);
  const splitList = data.varieties.flatMap(v => (v.splits || []).map(d => `${v.etf} ${d}`));
  const splitText = splitList.length ? `（样本内：${splitList.join('、')}）` : '';
  const checkText = data.varieties.filter(v => v.check).map(v => `${v.etf}日收益对指数的 beta 为 ${num(v.check.beta)}${v.check.gap == null ? '' : `，年化较全收益指数 ${signed(v.check.gap)}`}`).join('；');
  const share = key => codes.reduce((sum, c) => sum + (data.results[c].distribution[key] ?? 0), 0);
  const reverseMore = share('reverse_share') > share('forward_share');

  return <>
    <div className="csi-intro">
      <div className="intro-copy">
        <h1>基差，<br />留给了谁？</h1>
        <p>ETF 与股指期货的期现关系研究。从年化基差、无套利区间到可执行性，检查在 A 股的交易约束下，基差最终留给了谁。</p>
        <a className="jump-link" href="#arbitrage">查看择机套利的结果 {arrow}</a>
      </div>
      <div className="hero-evidence">
        <h2>四个品种，一条零线。</h2>
        <Segments label="选择期货品种" value={code} onChange={setCode} options={options} />
        <LineChart key={code} dates={mon.dates} series={[{ name: `${code} 年化基差`, values: mon.values, color: 'var(--accent)' }]} label={`${meta[code].index}股指期货连续合约年化基差`} />
        <Note>{res.start}—{res.end} · 连续合约取剩余天数大于 {a.roll_min_days} 天的最近合约 · 年化基差 =（期货收盘 / 指数收盘 − 1）× 365 / 剩余天数，未扣分红。</Note>
      </div>
    </div>
    <div className="result-strip">
      {codes.map(c => { const [d, v] = latest(data.results[c].monitor); return <span key={c}>{c} · {meta[c].index}<b>{pct(v)}</b></span>; })}
      <span>截至 {latest(data.results[codes[0]].monitor)[0]}</span>
    </div>

    <Section id="method" title="三个价格，一个等式。" aside="期货、指数与 ETF 之间，隔着利率、分红和交易成本。">
      <div className="method-workbench">
        <Segments label="查看定价与交易方向" value={step} onChange={setStep} options={[['pricing', '持有成本'], ['forward', '正向套利'], ['reverse', '反向套利'], ['hedge', '对冲与替代']]} />
        <div className="method-detail" key={step}><h3>{STEPS[step][0]}</h3><p>{STEPS[step][1]}</p></div>
      </div>
      <div className="constraint-line">
        ETF 佣金单边 {bp(a.etf_commission)} <span>／</span> ETF 滑点单边 {bp(a.etf_slippage)} <span>／</span> 期货手续费单边 {bp(a.fut_fee)} <span>／</span> 期货滑点单边 {bp(a.fut_slippage)} <span>／</span> 保证金 {pct(a.margin, 0)} <span>／</span> 资金成本 Shibor 3M
      </div>
      <Note>一次完整往返（两腿各开平一次）合计 {bp(data.round_trip_cost)}。期货手续费取交易所标准，不含期货公司加收；ETF 佣金因券商而异。以上均为透明假设，可在脚本中修改后重算。</Note>
    </Section>

    <Section id="shape" title="基差的形状。" aside="按月份看季节，按合约看期限。">
      <Segments label="选择期货品种" value={code} onChange={setCode} options={options} />
      <div className="reading-split arbitrage-shape">
        <div>
          <Bars label={`${code} 各月份平均年化基差`} rows={res.season.map((value, i) => ({ name: MONTHS[i], value: value ?? 0 }))} />
          <Note>连续合约年化基差的月度均值，未扣分红。</Note>
        </div>
        <div>
          <DataTable caption={`${code} 期限结构 · ${res.term.date}`} headers={['合约', '剩余天数', '基差', '年化']} rows={res.term.contracts.map(t => [t.symbol, t.dte, signed(t.basis), signed(t.ann)])} />
          <p className="arbitrage-reading">样本期内，{meta[code].index}的年化基差为正的交易日占 {pct(dist.positive, 1)}，中位数 {signed(dist.median)}，10% 至 90% 分位在 {signed(dist.p10)} 与 {signed(dist.p90)} 之间。</p>
        </div>
      </div>
    </Section>

    <Section id="carry" title="一直持有，付出多少？" aside="多 ETF（含分红的总收益）、空连续期货，按日保持等名义本金。">
      <div className="control-row"><Segments label="选择期货品种" value={carryCode} onChange={setCarryCode} options={options} /><span>收益均按资金占用（ETF 全额加保证金）计</span></div>
      <LineChart key={carryCode} dates={carryCurve.dates} series={[{ name: '相对现金的累计超额', values: carryCurve.values, color: 'var(--accent)' }]} label={`${carryCode} 期现组合相对现金的累计超额`} />
      <DataTable caption={`${carryCode} 期现组合逐年拆解，均为当年合计`} headers={['年份', '基差收敛', '跟踪与分红', '换月成本', '合计', '资金成本', '相对现金']} rows={carry.years.map(y => [y.year, signed(y.basis), signed(y.tracking), signed(y.cost), signed(y.net), signed(y.funding), signed(y.excess)])} />
      <div className="research-verdict">
        <h3>{cs.basis_ann < 0 ? '对中性策略，这是一笔持续的对冲成本。' : '基差收敛为这个组合贡献了正收益。'}</h3>
        <p>{meta[carryCode].index}期现组合在样本期内年化合计 {signed(cs.net_ann)}，其中基差收敛 {signed(cs.basis_ann)}、ETF 跟踪与分红 {signed(cs.tracking_ann)}；扣除年化 {pct(cs.funding_ann)} 的资金成本后，相对现金 {signed(cs.excess_ann)}。{cs.basis_ann < 0 ? '反过来，以期货多头替代现货的组合，同期获得的正是这部分贴水。' : ''}</p>
      </div>
    </Section>

    <Section id="arbitrage" title="只在值得时开仓。" aside="正向套利：扣除成本、按资金占用年化后的基差高于同期 Shibor，才开仓。">
      <DataTable caption="择机正向套利，T 日收盘出信号、T+1 日收盘成交" headers={['品种', '完成交易', '跑赢现金', '平均持有天数', '持仓时间占比', '平均开仓年化基差', '相对现金年化']} rows={codes.map(c => { const s = data.results[c].arb.summary; return [`${c} · ${meta[c].etf}`, s.trades, s.trades ? `${s.wins} / ${s.trades}` : '—', s.avg_days == null ? '—' : num(s.avg_days, 1), pct(s.in_position, 1), signed(s.avg_entry_ann), signed(s.excess_ann)]; })} />
      <div className="control-row arbitrage-control"><Segments label="选择期货品种" value={arbCode} onChange={setArbCode} options={options} /><span>持有到合约最后交易日；基差转负时次日提前平仓</span></div>
      {closed.length
        ? <LineChart key={arbCode} dates={arbCurve.dates} series={[{ name: '相对现金的累计超额', values: arbCurve.values, color: 'var(--accent)' }]} label={`${arbCode} 择机正向套利相对现金的累计超额`} />
        : <p className="arbitrage-empty">样本期内，{meta[arbCode].index}没有一天的升水在扣除成本与资金占用后高于同期 Shibor，因此没有开仓。</p>}
      {arb.trades.length > 0 && <details><summary>展开 {arbCode} 逐笔交易</summary><DataTable caption={`${arbCode} 逐笔交易，收益按资金占用计`} headers={['合约', '开仓', '平仓', '天数', '开仓年化基差', '基差收敛', '跟踪与分红', '成本', '资金成本', '相对现金']} rows={arb.trades.map(t => [`${t.symbol}${t.open ? '（持有中）' : ''}`, t.entry, t.exit, t.days, signed(t.entry_ann), signed(t.basis, 3), signed(t.tracking, 3), signed(t.cost, 3), signed(t.funding, 3), signed(t.excess, 3)])} /></details>}
      <Note>每笔开仓时两腿名义本金相等，之后数量固定，不复投；年化 = 全部交易的超额之和 / 样本年数，空仓期间按持有现金计。</Note>
    </Section>

    <Section id="reverse" title="反向的机会，为什么不做？" aside={reverseMore ? '贴水超过一次往返成本的交易日，多于升水。' : '把升水与贴水的频率放在一起看。'}>
      <div className="reading-split">
        <div>
          <DataTable caption={`连续合约基差超过一次往返成本（${bp(data.round_trip_cost)}）的交易日占比`} headers={['品种', '升水超过成本', '贴水超过成本']} rows={codes.map(c => [`${c} · ${meta[c].index}`, pct(data.results[c].distribution.forward_share, 1), pct(data.results[c].distribution.reverse_share, 1)])} />
          <Note>只比较基差与交易成本，未计资金与融券费用；正向套利实际开仓还要求跑赢资金成本，所以开仓天数少于这里的升水天数。</Note>
        </div>
        <div>
          <p>{reverseMore ? '贴水出现得更频繁，但' : ''}反向套利要先融券卖出 ETF。券源是否充足、费率多高，取决于券商与时点，事前无法保证，历史上也没有公开记录。把它当作可执行的策略来回测，等于假设了一个并不存在的条件。</p>
          <p>所以这里只给出频率。它真正的含义在上一节：这些贴水，被对冲的一方支付，被替代的一方获得。</p>
        </div>
      </div>
    </Section>

    <Sources files={[['arbitrage.json', '下载研究快照 JSON']]} manifest={false} statement={`本页结果由仓库中的脚本 research/basis/arbitrage.py 从公开数据重新计算，快照日期 ${data.generated}。均为历史回测，不构成投资建议。`}>
      <p>数据：中金所每日行情（逐合约收盘价），新浪财经指数日线，东方财富 ETF 日线（未复权与后复权）与 Shibor 3 个月利率；中证指数官网的全收益指数只用于自检。原始行情只在本机缓存，仓库中只保存聚合结果。</p>
      <p>ETF 收益含分红。东方财富的后复权价是在未复权价上累加分红，不是按比例复权，直接相除会压低涨跌幅；这里以份额折算日为界分段，用后复权的日变动除以前一日未复权价（乘以该段的尺度倍数）得到总收益，份额折算当天以指数收益代替{splitText}。自检：{checkText}。</p>
      <p>未模拟整数手、逐日追加保证金与期货公司加收手续费；ETF 按二级市场收盘价成交，未考虑与净值的折溢价。期货在最后交易日按收盘价平仓，近似交割结算价（标的指数最后两小时的算术平均价）。开仓信号只用原始基差、不预估分红，对高股息品种偏保守；分红通过 ETF 的总收益计入实际收益。</p>
    </Sources>
  </>;
}
