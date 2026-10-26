import { lazy, Suspense, useEffect, useState } from 'react';
import './research-carousel.css';
const FlexCarousel = lazy(() => import('./FlexCarousel.jsx'));
const media = file => `${import.meta.env.BASE_URL}media/work/${file}`;
const items = [
  { kind: 'equity', src: media('equity-candles-up.webp'), alt: '整体上行的红绿 K 线主题配图，非策略收益曲线', title: '中证500指数增强', coverTitle: '500', subtitle: '多因子 / 风险约束 / 收益归因' },
  { kind: 'text', src: media('text.jpg'), alt: '报刊文字，文本因子研究主题配图', title: '大模型文本因子与前视偏差', coverTitle: 'TEXT / SIGNAL', subtitle: '公告研报 / 文本因子 / 前视偏差' },
  { kind: 'benchmark', src: media('benchmark.jpg'), alt: '数据分析屏幕，Agent 评测研究主题配图', title: 'InvestorBench', coverTitle: 'INVESTORBENCH', subtitle: '金融 Agent / 近似复现 / 可靠性审计' },
  { kind: 'development', src: media('ai-engineering-code.webp'), alt: '真实代码开发场景，AI 投研工程主题配图', title: 'AI 投研工程开发', coverTitle: 'RESEARCH / BUILD', subtitle: '时点资料 / 工具取证 / 上线闸门' },
  { kind: 'splint', src: media('hand-xray.webp'), imageFit: 'contain', imagePositionX: 1, alt: '正常手腕与手部 X 光影像，骨科研究主题配图，并非本项目患者影像', title: '医用智能骨科夹板 Smart Splint', coverTitle: 'SMART SPLINT', subtitle: '多传感监测 / 数字医疗 / 科研转化' }
];
export default function ResearchCarousel({ onSelect }) {
  const [active, setActive] = useState(0);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => { const query = window.matchMedia('(max-width: 760px)'); const update = () => setCompact(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const [navigation, setNavigation] = useState(null);
  function choose(index) { setActive(index); setNavigation({ index, tick: performance.now() }); onSelect(items[index].kind); }
  return <div className="research-carousel">
    <div className="research-carousel-intro"><h3>量化 AI 研究与开发</h3><p>拖动切换，点击卡片聚焦并查看研究。</p></div>
    <div className="research-carousel-stage"><Suspense fallback={<div className="work-loading" role="status">研究作品载入中…</div>}><FlexCarousel items={items} navigation={navigation} preset="liquid" intro="rise" fit="landscape" cardHeight={compact ? 0.52 : 0.6} gap={22} radius={12} bend={0.22} dispersion={0.16} squeeze={0.1} captureWheel={false} captions focusOnClick onChange={setActive} onSelect={index => onSelect(items[index].kind)} /></Suspense></div>
    <div className="research-project-tabs" aria-label="选择精选项目">{items.map((item, index) => <button key={item.kind} onClick={() => choose(index)} aria-pressed={active === index} aria-controls={`detail-${item.kind}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong></button>)}</div>
  </div>;
}
