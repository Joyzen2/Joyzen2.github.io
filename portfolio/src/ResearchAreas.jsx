import { useEffect, useState } from 'react';
import AccordionGallery from './AccordionGallery.jsx';
import NarrativeHead from './NarrativeHead.jsx';

const media = file => `${import.meta.env.BASE_URL}media/${file}`;
const MACRO = 'https://joyzen2.github.io/macro/';
const AI_SITE = 'https://joyzen2.github.io/ai-research/';

// Research notes live with the area they belong to: [type, title, href].
const AREAS = [
  {
    key: 'macro', en: 'MACRO RESEARCH', title: '宏观研究',
    statement: '从经济变化中，理解市场的运行逻辑。',
    scope: ['经济周期', '利率', '资产配置', '宏观观察'],
    image: media('research/macro-lines.svg'), alt: '以亚洲为中心的地球线稿，连着几个主要金融中心，主题配图',
    links: [
      ['研究站', '宏观信息与市场定价', MACRO],
      ['资金面跟踪', '从资金价格与公开市场操作，观察流动性', '/notes/2026-10-24-funding/'],
      ['政策专题', '同样是降息，为什么市场反应不同？', '/reviews/lpr-follow-cuts/'],
      ['研究工具', '从久期到骑乘，把债券分析变成可复算的工具', '/tools/bond-analytics/'],
    ],
    more: ['全部研究笔记', '/notes/'],
  },
  {
    key: 'quant', en: 'QUANTITATIVE STRATEGY', title: '量化策略',
    statement: '从市场信息中提取信号，并以数据检验。',
    scope: ['中证500', '因子研究', '回测', '风险管理'],
    image: media('research/quant-lines.svg'), alt: '红绿 K 线的线稿，主题配图，非策略收益曲线',
    links: [
      ['指数增强', '中证500多因子指数增强', '/csi500/'],
      ['文本因子', '大模型文本因子与前视偏差', '/text-factors/'],
    ],
  },
  {
    key: 'ai', en: 'AI FOR RESEARCH', title: 'AI 投研',
    statement: '将研究方法转化为可执行、可复用的智能系统。',
    scope: ['Agent', '工具调用', '研究工作流', '评估'],
    image: media('research/ai-lines.svg'), alt: '神经网络线稿，一条路径被点亮，主题配图',
    links: [
      ['工程开发', 'AI 投研工程开发', AI_SITE],
      ['Agent 评测', 'InvestorBench 金融 Agent 复现与评测', '/investorbench/'],
    ],
  },
];

const number = index => String(index + 1).padStart(2, '0');

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AreaHead({ area, index }) {
  return <>
    <p className="area-index"><span>{number(index)}</span>{area.en}</p>
    <h3 className="area-title">{area.title}</h3>
    <p className="area-statement">{area.statement}</p>
  </>;
}

function AreaCopy({ area, index }) {
  return <div className="area-copy">
    <AreaHead area={area} index={index} />
    <ul className="area-scope" aria-label="涵盖内容">{area.scope.map(item => <li key={item}>{item}</li>)}</ul>
    <ul className="area-links" aria-label={`${area.title}：研究与笔记`}>
      {area.links.map(([type, title, href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer"><span className="area-link-type">{type}</span><span className="area-link-title">{title}</span><Arrow /></a></li>)}
    </ul>
    {area.more && <a className="area-more" href={area.more[1]} target="_blank" rel="noreferrer">{area.more[0]}<Arrow /></a>}
  </div>;
}

function useCompact(query) {
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setCompact(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return compact;
}

// Tall enough for the open panel's links, short enough that heading and panels share one screen.
const galleryHeight = () => Math.round(Math.min(560, Math.max(450, window.innerHeight * 0.58)));

export default function ResearchAreas() {
  const compact = useCompact('(max-width: 760px)');
  const [height, setHeight] = useState(galleryHeight);
  useEffect(() => {
    const update = () => setHeight(galleryHeight());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => { window.dispatchEvent(new Event('portfolio:layout')); }, [compact]);

  return <section className="narrative-section research-areas" id="research" aria-labelledby="research-title" data-narrative>
    <div className="shell">
      <NarrativeHead id="research-title" index="02 / RESEARCH" title="三个方向，同一种追问。" lede="理解宏观环境，检验市场信号，再把研究方法做成可以复用的工具。" hint={compact ? null : '悬停或点击，展开相关研究与笔记'} />
      {compact
        ? <ol className="area-stack">{AREAS.map((area, index) => <li key={area.key} className="area-card" data-reveal-panel>
          <img src={area.image} alt={area.alt} loading="lazy" decoding="async" />
          <AreaCopy area={area} index={index} />
        </li>)}</ol>
        : <AccordionGallery
          className="research-accordion"
          ariaLabel="研究方向"
          items={AREAS.map((area, index) => ({
            image: area.image, alt: area.alt, label: area.title,
            peek: <div className="area-peek"><AreaHead area={area} index={index} /></div>,
            content: <AreaCopy area={area} index={index} />,
          }))}
          defaultIndex={0}
          expandRatio={0.5}
          trigger="hover"
          colorOnHover
          showLabels={false}
          height={height}
          gap={14}
          radius={14}
          tilt={4}
          parallax={0.4}
          duration={0.75}
          accentColor="#dbe4ed"
          overlayColor="#020407"
          textColor="#eef2f6"
        />}
    </div>
  </section>;
}
