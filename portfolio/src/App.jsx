import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ParticleHero from './ParticleHero.jsx';
import HoverLabel from './HoverLabel.jsx';
import usePortfolioMotion from './usePortfolioMotion.js';
import './agency.css';
import CircularGallery from './CircularGallery.jsx';
import './recognition.css';
import ProfileCard from './ProfileCard.jsx';
const ExperienceJourney = lazy(() => import('./ExperienceJourney.jsx'));
import './profile-journey.css';
import './monochrome.css';
import ResearchCarousel from './ResearchCarousel.jsx';
import SplitText from './SplitText.jsx';
import ReflectiveCard from './ReflectiveCard.jsx';
import './macro-reflective.css';
import DitherVeil from './DitherVeil.jsx';

const MACRO = 'https://joyzen2.github.io/macro/';
const AI_SITE = 'https://joyzen2.github.io/ai-research/';
const GITHUB = 'https://github.com/Joyzen2';
const EMAIL = 'zheng.jin20@student.xjtlu.edu.cn';
const media = (file) => `${import.meta.env.BASE_URL}media/${file}`;

function Arrow({ diagonal = true, className = '', ...props }) {
  return <svg className={`arrow ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d={diagonal ? 'M5 19 19 5M5 5h14v14' : 'M4 12h16m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function External({ href, children, className = '', ...props }) {
  return <a href={href} target="_blank" rel="noreferrer" className={className} {...props}>{children}</a>;
}

function Hero() { return <ParticleHero />; }

function SectionHeading({ id, english, children }) {
  return <div className="section-title-block"><h2 id={id} className="section-title-en"><span className="heading-mask"><span className="motion-heading-line" data-motion-title>{english}</span></span></h2><p className="section-title-cn" data-motion-subtitle>{children}</p></div>;
}

function About() {
  return <section className="profile-section section-space" id="about" aria-labelledby="about-title" data-motion-section><div className="shell">
    <SectionHeading id="about-title" english="PROFILE">个人经历</SectionHeading>
    <div className="profile-layout">
      <figure className="life-frame"><ProfileCard avatarUrl={media('suzhou-life.jpg')} name="" title="" handle="Joyzen2" status="宏观 · 量化 · AI" statusColor="#a9bbcd" contactText="联系我" onContactClick={() => { location.hash = 'contact'; }} holo={0.55} glare={0.28} tiltStrength={8} parallax={5} radius={14} intro={false} /><figcaption><span>SUZHOU, CHINA</span><span>在苏州，研究之外。</span></figcaption></figure>
      <div className="profile-info">
        <h3>Hi, I’m <span>金正.</span></h3>
        <p className="profile-intro">从计算机科学出发，在金融研究中寻找可验证的答案。关注宏观信息与市场定价，也研究量化组合，开发 AI 投研工具。</p>
        <dl className="profile-facts"><div><dt>研究方向</dt><dd>宏观 / 量化 / AI 投研</dd></div><div><dt>教育背景</dt><dd>金融计算硕士在读</dd></div><div><dt>所在地</dt><dd>苏州，中国</dd></div><div><dt>邮箱</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div></dl>
        <div className="profile-numbers"><div><strong>30<span>项</span></strong><p>实时面板核心宏观指标</p></div><div><strong>53<span>项</span></strong><p>基本面与量价因子</p></div><div><strong>12<span>项</span></strong><p>上线闸门检查</p></div></div>
        <p className="profile-education">利物浦大学金融计算硕士项目（西交利物浦大学就读）；本科为西交利物浦大学计算机科学与技术。</p>
        <div className="profile-actions"><External href={GITHUB} className="profile-action profile-action-secondary"><HoverLabel alternate="查看研究代码">GitHub</HoverLabel><Arrow /></External></div>
        <div className="profile-current"><span>持续研究</span><div><a href={MACRO} target="_blank" rel="noreferrer">宏观信息与市场定价</a><a href="#work">中证500指数增强</a><a href={AI_SITE} target="_blank" rel="noreferrer">AI 投研工程开发</a></div></div>
      </div>
    </div>
    <Suspense fallback={<div className="journey-loading" role="status">经历加载中…</div>}><ExperienceJourney /></Suspense>
  </div></section>;
}

function MacroArt() {
  return <div className="macro-art"><div className="art-heading"><span>MACRO<br />& EXPECTATIONS</span><span className="art-description">从宏观信息<br />到市场定价</span></div><img src={media('macro-curve-dark.svg')} alt="2022年8月15日政策公告前后国债收益率曲线，来源于现有宏观研究站" loading="lazy" /><div className="art-caption"><span>政策事件 · 收益率曲线</span><span>原研究图表</span></div></div>;
}

const detailContent = {
  equity: {
    title: '中证500多因子指数增强',
    intro: '从时点股票池和财务公告对齐，到因子合成、风险模型与约束优化。以沪深300作对照，检验超额来自哪里，也记录模型失效的时期。',
    facts: [['53', '基本面与量价因子'], ['8.05%', '回测年化超额'], ['1.69', '回测信息比']],
    methods: 'PIT 数据 · LightGBM 滚动训练 · 风格与行业风险模型 · cvxpy 组合优化',
    boundary: '历史回测：2013-02—2026-08，695 周，以官方全收益指数为基准，计入佣金、滑点与印花税。保守财报口径年化超额 6.06%；2025 年及 2026 年前 8 个月超额为负。历史结果不代表未来表现。',
    link: null,
  },
  benchmark: {
    title: 'InvestorBench · 金融 Agent 复现与评测',
    intro: '对 InvestorBench 开展近似复现，将适配、实验和统计分析与原仓库隔离，检验金融 Agent 的收益来自何处、评测结论是否可靠。',
    facts: [['62', '实验运行记录'], ['2 × 2', '析因消融设计'], ['2026', '硕士研究项目']],
    methods: '分层记忆 · 结构化决策 · 零模型 · 置换检验 · 实验账本',
    boundary: '硕士毕业项目进行中。复现与消融用于检验实验可靠性，结果受模型、资产、区间和实现细节影响。',
    link: null,
  },
  text: {
    title: '大模型文本因子与前视偏差',
    intro: '以公告和研报标题作为另类数据，对照规则、滚动学习基准和三个开源大模型，检验文本信号是否带来信息增量，并识别模型记忆可能造成的前视偏差。',
    facts: [['3', '开源大模型'], ['约 113 万', '批量打分'], ['年度滚动', '学习基准验证']],
    methods: '文本时点对齐 · 遮名打分 · 事件研究 · 安慰剂特征 · 知识边界对照',
    boundary: '多数提升与噪音难以区分，不能据此宣称形成了稳定有效的文本 Alpha。展示重点是实验设计与偏差检验。',
    link: null,
  },
  development: {
    title: 'AI 投研工程开发',
    intro: '将研究资料与工具取证接入可追踪的投研流程，并以 12 项上线闸门检查组织工程交付，让研究输出的可靠性成为开发目标。',
    facts: [['12 项', '上线闸门检查'], ['5.7 万篇', '时点可查的研报'], ['0 次', '时点陷阱泄漏']],
    methods: 'AI 投研工程 · 时点资料 · 工具接口 · 上线检查',
    boundary: '当前展示围绕时点资料、工具取证与上线检查的工程流程，持续迭代研究输出的可追踪性。',
    link: AI_SITE,
    linkLabel: '进入 AI 投研工程开发网站',
  },
  splint: {
    title: '医用智能骨科夹板 Smart Splint',
    intro: '面向桡骨远端骨折治疗，将多传感监测引入中医骨科夹板，实时采集压力、温度与湿度，辅助观察夹板松紧及皮肤状态。',
    facts: [['3 类', '传感监测信息'], ['TrustCom 2024', '国际会议论文'], ['CN119606312A', '专利申请公开']],
    methods: '压力感知 · 温湿度监测 · 数字医疗 · 跨学科研究',
    boundary: '项目重点是夹板状态的实时感知及数据采集；研究成果包括国际会议论文与专利申请公开文本。',
    link: 'https://doi.org/10.1109/TrustCom63139.2024.00372',
    linkLabel: '阅读研究论文',
  },
};

function ProjectDetail({ kind, close }) {
  const d = detailContent[kind];
  return <div className="project-detail" id={`detail-${kind}`} tabIndex="-1"><div className="detail-top"><h4>{d.title}</h4><button onClick={close} className="close-detail">收起 <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" /></svg></button></div><p>{d.intro}</p><dl className="detail-facts">{d.facts.map(([n, label]) => <div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}</dl><p className="detail-methods">{d.methods}</p><p className="detail-boundary">{d.boundary}</p>{d.link ? <External href={d.link} className="text-link">{d.linkLabel || '查看项目代码'} <Arrow /></External> : <a className="text-link" href={`mailto:${EMAIL}?subject=${encodeURIComponent(`想了解${d.title}`)}`}>联系我了解研究 <Arrow /></a>}</div>;
}

function Work() {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (open) document.getElementById(`detail-${open}`)?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('portfolio:layout')));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const toggle = (kind) => {
    const next = open === kind ? null : kind;
    setOpen(next);
  };
  return <section className="work section-space" id="work" aria-labelledby="work-title" data-motion-section><div className="shell"><SectionHeading id="work-title" english="SELECTED WORK">把问题，做成研究。</SectionHeading><p className="section-intro">以宏观为主线，沿着组合、文本与 AI 工具继续探索。</p>
    <External className="project-featured" href={MACRO} aria-label="进入宏观信息与市场预期研究站（新窗口）"><ReflectiveCard className="macro-reflective" width="100%" height="auto" theme="dark" webcam={false} intro={false} tint="#ffffff" metalness={0.72} roughness={0.5} blurStrength={6} shine={0.55} glare={0.18} tiltStrength={2.3} radius={16}><MacroArt /></ReflectiveCard><div className="project-description"><div><span className="project-category">宏观量化 · 利率研究</span><h3>宏观信息，何时能带来增量？</h3><p>从实时状态识别，到政策与数据意外。研究宏观判断与市场定价之间的距离。</p></div><span className="project-action">进入研究站 <Arrow /></span></div></External>
    <ResearchCarousel onSelect={kind => setOpen(kind)} />
    {open && <ProjectDetail kind={open} close={() => { setOpen(null); document.querySelector(`[aria-controls="detail-${open}"]`)?.focus(); }} />}
    <div className="work-bottom"><span>研究结论、方法与边界，都值得被看见。</span><External href={GITHUB} className="text-link">更多代码与研究 <Arrow /></External></div>
  </div></section>;
}

function Notes() {
  return <section className="notes section-space" id="notes" aria-labelledby="notes-title" data-motion-section><div className="shell"><SectionHeading id="notes-title" english="RESEARCH NOTES">研究之外，持续记录。</SectionHeading><p className="section-intro">把每一次追问，留成下一次研究的起点。</p><div className="note-list"><External href={`${MACRO}notes/2026-10-24-funding/`} className="note-row"><span className="note-type">资金面跟踪</span><h3>从资金价格与公开市场操作，观察流动性。</h3><span className="note-date">2026.10.24</span><Arrow /></External><External href={`${MACRO}reviews/lpr-follow-cuts/`} className="note-row"><span className="note-type">政策专题</span><h3>同样是降息，为什么市场反应不同？</h3><span className="note-date">专题复盘</span><Arrow /></External><External href={`${MACRO}tools/bond-analytics/`} className="note-row"><span className="note-type">研究工具</span><h3>从久期到骑乘，把债券分析变成可复算的工具。</h3><span className="note-date">Python</span><Arrow /></External></div><div className="notes-end"><p>公开笔记持续整理，完整研究可在宏观研究站阅读。</p><External href={`${MACRO}notes/`} className="text-link">查看研究笔记 <Arrow /></External></div></div></section>;
}

const recognitionItems = [
  { image: media('recognition/sanya-background-v2.webp'), text: '国际会议论文', alt: '根据三亚会议横幅去字重建的海岸城市背景', title: 'TrustCom 2024 · 国际会议论文', description: 'A Digital Traditional Chinese Medicine Splint for Treatment of Distal Radius Fracture', detail: 'IEEE 国际会议论文 · 核心作者 Zheng Jin', href: 'https://doi.org/10.1109/TrustCom63139.2024.00372', cardTitle: 'TrustCom 2024', cardSummary: '数字中医骨科夹板：用多传感器实时监测骨折部位的压力、温度与湿度。', cardPoints: '2024 IEEE TrustCom · 中国三亚', cardDetail: '国际会议论文 / 核心作者', art: 'conference', imageTitle: '人工智能\n与数字医疗', imageMeta: 'IEEE TRUSTCOM · 2024 · 三亚' },
  { image: media('recognition/competition-background-v2.webp'), text: '二等奖', alt: '根据竞赛横幅去字重建的蓝色背景', title: '创新设计 · 二等奖', description: '第六届江苏省大学生生物医学工程创新设计竞赛', detail: '跨学科创新 · 数字骨科夹板研究', cardTitle: '二等奖', cardSummary: '第六届江苏省大学生生物医学工程创新设计竞赛', cardPoints: '围绕数字骨科夹板，连接传感技术与医疗应用。', cardDetail: '生物医学工程 / 创新设计', art: 'competition', emblem: media('recognition/competition-emblem-alpha.png'), imageTitle: '第六届江苏省大学生\n生物医学工程\n创新设计竞赛', imageMeta: '' },
  { image: media('recognition/xjtlu-symposium.png'), text: '三等奖', alt: '西浦研究导向型学习峰会官网活动配图，并非本人领奖照', title: '研究峰会 · 三等奖', description: '西浦（太仓）研究峰会 · 创新类', detail: '前 10% · 图片为峰会官网活动配图', cardTitle: '三等奖', cardSummary: '西浦（太仓）研究峰会 · 创新类。让研究走出实验，走向公开交流。', cardPoints: '研究汇报、跨学科创新与公开展示。图片为西浦峰会官网活动配图。', cardDetail: '研究展示 / 创新类前 10%', art: 'photo' },
  { image: media('recognition/xjtlu-central-building.webp'), text: '研究生入学奖学金', alt: '西交利物浦大学官网中心楼照片，奖学金主题配图', title: '研究生入学奖学金', description: '从计算机科学走向金融计算，继续探索数据、市场与人工智能。', detail: '金融计算硕士项目 · 研究生入学奖学金', cardTitle: '研究生入学奖学金', cardSummary: '从计算机科学到金融计算，在新的研究阶段继续探索。', cardPoints: '金融计算硕士项目，西交利物浦大学就读。', cardDetail: 'Postgraduate Entry Scholarship', art: 'campus' },
  { image: media('recognition/patent-publication.png'), text: '发明专利申请', alt: 'CN119606312A 发明专利申请公开文本首页', title: '数字骨科夹板 · 发明专利申请', description: '一种骨折用骨科夹板监测方法、装置、系统及存储介质', detail: 'CN119606312A · 2025.03.14 申请公开', href: 'https://patents.google.com/patent/CN119606312A/zh', cardTitle: '发明专利申请', cardSummary: '融合多维传感信息，监测夹板松紧、肢体姿态与温湿度。', cardPoints: '申请日 2024.11.12；公开日 2025.03.14。', cardDetail: 'CN119606312A / 申请公开', art: 'document' }
];

function Awards() {
  const [active, setActive] = useState(0);
  const [navigation, setNavigation] = useState(null);
  const [paused, setPaused] = useState(false);
  const item = recognitionItems[active];
  function navigate(index) { setActive(index); setNavigation({ index, time: performance.now() }); }
  return <section className="awards recognition-section section-space" id="awards" aria-labelledby="awards-title" data-motion-section>
    <div className="shell"><SectionHeading id="awards-title" english="RECOGNITION">探索留下的印记。</SectionHeading>
      <div className="recognition-toolbar"><p>拖动浏览，点击展开卡片。</p><button className="gallery-pause" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? '继续缓慢流动' : '暂停自动流动'}</button></div>
    </div>
    <div className="recognition-stage"><CircularGallery items={recognitionItems} navigation={navigation} bend={2.6} itemSize={1.05} itemAspect={0.8} gap={0.16} wave={0.3} borderRadius={0.025} fadeEdges={0.06} shadow={0.12} font='400 25px Manrope, "PingFang SC", sans-serif' autoScroll={paused ? 0 : 0.35} scrollEase={0.065} dpr={1.5} onActiveChange={setActive} /></div>
    <div className="shell recognition-bottom">
      <div className="recognition-index" aria-label="选择成果">{recognitionItems.map((entry, index) => <button key={entry.text} onClick={() => navigate(index)} aria-pressed={index === active}><span>{String(index + 1).padStart(2, '0')}</span>{entry.text}</button>)}</div>
      <div className="recognition-detail" aria-live="polite" aria-atomic="true"><div><h3>{item.title}</h3><p>{item.description}</p></div><div className="recognition-evidence"><span>{item.detail}</span>{item.href && <External href={item.href} className="text-link">{active === 4 ? '查看专利记录' : '阅读论文'} <Arrow /></External>}</div></div>

    </div>
  </section>;
}

function Contact() {
  const contactRef = useRef(null);
  const [copyState, setCopyState] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(EMAIL); setCopyState('邮箱已复制'); }
    catch { setCopyState('复制未成功，请使用下方邮箱链接'); }
  }
  return <footer ref={contactRef} className="contact" id="contact" data-motion-section><DitherVeil className="contact-veil" interactionRef={contactRef} src={media('silver-particles-poster.jpg')} fit="cover" pattern="floyd" pixelSize={3} inkColor="#000000" paperColor="#999d9f" revealRadius={210} softness={0.65} linger={1.4} rimColor="#e4e7e8" rim={0.06} wander clickBurst /><div className="shell contact-inner"><div className="contact-intro"><span>金融研究 · 数据 · AI</span><a href="#top" className="back-top">回到顶部 <Arrow /></a></div><div className="contact-main"><h2 className="closing-title"><SplitText tag="span" text="LET’S TALK." className="contact-split-title" effect="skew" splitType="chars" delay={65} duration={1.2} staggerFrom="start" mask hoverEffect="lift" textAlign="left" threshold={0.18} rootMargin="-30px" /><small data-motion-subtitle>让下一个问题，成为一次对话。</small></h2><a className="contact-circle" href={`mailto:${EMAIL}`} aria-label="发送邮件联系金正"><Arrow /></a></div><div className="contact-links"><div><p>欢迎交流研究，也期待新的工作机会。</p><a href={`mailto:${EMAIL}`} className="email">{EMAIL}</a><button className="copy-email" onClick={copy}>复制邮箱</button><span className="copy-status" role="status">{copyState}</span></div><div className="footer-links"><External href={GITHUB}>GitHub <Arrow /></External><External href={MACRO}>宏观研究站 <Arrow /></External></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} 金正 · Zheng Jin</span><span>保持好奇，让证据说话。</span><span>宏观 · 量化 · AI</span></div></div></footer>;
}

export default function App() {
  const root = useRef(null);
  usePortfolioMotion(root);
  return <div ref={root} className="creative-page"><a className="skip-link" href="#main">跳至主要内容</a><Hero /><main id="main"><About /><Awards /><Work /><Notes /></main><Contact /></div>;
}
