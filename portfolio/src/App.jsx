import { useEffect, useRef, useState } from 'react';
import ParticleHero from './ParticleHero.jsx';
import { whenOpeningSettled } from './market-hero/opening-config.js';
import HoverLabel from './HoverLabel.jsx';
import usePortfolioMotion from './usePortfolioMotion.js';
import './agency.css';
import CircularGallery from './CircularGallery.jsx';
import './recognition.css';
import ProfileCard from './ProfileCard.jsx';
import ExperienceJourney from './ExperienceJourney.jsx';
import './profile-journey.css';
import './monochrome.css';
import ResearchAreas from './ResearchAreas.jsx';
import NarrativeHead from './NarrativeHead.jsx';
import SplitText from './SplitText.jsx';
import ClosingRibbon from './ClosingRibbon.jsx';
import './narrative.css';

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

// 03 answers "why these questions": the path between fields, then only the essentials.
function About() {
  return <section className="narrative-section about-section" id="about" aria-labelledby="about-title" data-narrative><div className="shell">
    <div className="about-layout">
      <div className="about-text">
        <NarrativeHead id="about-title" index="03 / ABOUT" title="在不同领域之间，寻找连接。" />
        <div className="about-body" data-reveal>
          <p>从计算机科学出发，走向计算金融，再将 AI 与工程方法融入金融研究。</p>
          <p>我关心的不只是如何从复杂数据中发现规律，也关心如何将这些发现转化为可以验证、复用和持续改进的工具。</p>
        </div>
        <dl className="about-facts" data-reveal>
          <div><dt>硕士在读</dt><dd>金融计算<small>利物浦大学硕士项目，西交利物浦大学就读</small></dd></div>
          <div><dt>本科</dt><dd>计算机科学与技术<small>西交利物浦大学</small></dd></div>
          <div><dt>所在地</dt><dd>苏州，中国</dd></div>
          <div><dt>邮箱</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div>
        </dl>
        <div className="about-actions" data-reveal><External href={GITHUB} className="profile-action profile-action-secondary"><HoverLabel alternate="查看研究代码">GitHub</HoverLabel><Arrow /></External></div>
      </div>
      <figure className="life-frame about-photo" data-reveal-photo><ProfileCard avatarUrl={media('suzhou-life.jpg')} name="" title="" handle="Joyzen2" status="宏观 · 量化 · AI" statusColor="#a9bbcd" contactText="联系我" onContactClick={() => { location.hash = 'contact'; }} holo={0.55} glare={0.28} tiltStrength={8} parallax={5} radius={14} intro={false} /><figcaption><span>SUZHOU, CHINA</span><span>在苏州，研究之外。</span></figcaption></figure>
    </div>
  </div></section>;
}

function Experience() {
  return <section className="narrative-section experience-section" id="experience" aria-labelledby="experience-title" data-narrative><div className="shell">
    <NarrativeHead id="experience-title" index="05 / EXPERIENCE" title="从工程实践，走向金融研究。" lede="两段实习、一项科研，以及仍在继续的独立研究。" />
    <ExperienceJourney />
  </div></section>;
}

const recognitionItems = [
  { image: media('recognition/worldquant-gold.webp'), cover: media('recognition/worldquant-gold-light.webp'), emblem: media('recognition/worldquant-gold-medal.webp'), text: 'WorldQuant 金牌', alt: 'WorldQuant BRAIN 金牌徽章，置于深蓝色光线背景上', title: '量化竞赛 · 金牌', description: 'WorldQuant BRAIN Challenge 全球因子挖掘竞赛', detail: 'Gold Level · 证书由 WorldQuant 颁发', href: media('recognition/worldquant-gold-certificate.webp'), linkText: '查看证书', cardTitle: '金牌', cardSummary: 'WorldQuant BRAIN Challenge 全球因子挖掘竞赛', cardPoints: '在 WorldQuant BRAIN 平台构建、回测并提交 alpha 因子，达到 Gold 级别。', cardDetail: '量化研究 / Gold Level', art: 'medal', tone: '#101c2a' },
  { image: media('recognition/sanya-background-v2.webp'), text: '国际论文发表', alt: '根据三亚会议横幅去字重建的海岸城市背景', title: '国际论文发表', description: 'A Digital Traditional Chinese Medicine Splint for Treatment of Distal Radius Fracture', detail: 'IEEE 国际会议论文 · 核心作者 Zheng Jin', href: 'https://doi.org/10.1109/TrustCom63139.2024.00372', linkText: '阅读论文', cardTitle: '国际论文发表', cardSummary: '数字中医骨科夹板：用多传感器实时监测骨折部位的压力、温度与湿度。', cardPoints: '2024 IEEE TrustCom · 中国三亚', cardDetail: '国际会议论文 / 核心作者', art: 'conference', tone: '#002a30', imageTitle: '', imageMeta: '人工智能与数字医疗' },
  { image: media('recognition/competition-background-v2.webp'), text: '二等奖', alt: '根据竞赛横幅去字重建的蓝色背景', title: '创新设计 · 二等奖', description: '第六届江苏省大学生生物医学工程创新设计竞赛', detail: '跨学科创新 · 数字骨科夹板研究', cardTitle: '二等奖', cardSummary: '第六届江苏省大学生生物医学工程创新设计竞赛', cardPoints: '围绕数字骨科夹板，连接传感技术与医疗应用。', cardDetail: '生物医学工程 / 创新设计', art: 'competition', tone: '#0b2244', emblem: media('recognition/competition-emblem-alpha.webp'), imageTitle: '第六届江苏省大学生\n生物医学工程\n创新设计竞赛', imageMeta: '' },
  { image: media('recognition/xjtlu-symposium.webp'), text: '三等奖', alt: '西浦研究导向型学习峰会官网活动配图，并非本人领奖照', title: '研究峰会 · 三等奖', description: '西浦（太仓）研究峰会 · 创新类', detail: '前 10% · 图片为峰会官网活动配图', cardTitle: '三等奖', cardSummary: '西浦（太仓）研究峰会 · 创新类。让研究走出实验，走向公开交流。', cardPoints: '研究汇报、跨学科创新与公开展示。图片为西浦峰会官网活动配图。', cardDetail: '研究展示 / 创新类前 10%', art: 'photo', tone: '#2f1e19' },
  { image: media('recognition/xjtlu-central-building.webp'), text: '研究生入学奖学金', alt: '西交利物浦大学官网中心楼照片，奖学金主题配图', title: '研究生入学奖学金', description: '从计算机科学走向金融计算，继续探索数据、市场与人工智能。', detail: '金融计算硕士项目 · 研究生入学奖学金', cardTitle: '研究生入学奖学金', cardSummary: '从计算机科学到金融计算，在新的研究阶段继续探索。', cardPoints: '金融计算硕士项目，西交利物浦大学就读。', cardDetail: 'Postgraduate Entry Scholarship', art: 'campus', tone: '#172430' },
  { image: media('recognition/patent-publication.webp'), text: '发明专利申请', alt: 'CN119606312A 发明专利申请公开文本首页', title: '数字骨科夹板 · 发明专利申请', description: '一种骨折用骨科夹板监测方法、装置、系统及存储介质', detail: 'CN119606312A · 2025.03.14 申请公开', href: 'https://patents.google.com/patent/CN119606312A/zh', linkText: '查看专利记录', cardTitle: '发明专利申请', cardSummary: '融合多维传感信息，监测夹板松紧、肢体姿态与温湿度。', cardPoints: '申请日 2024.11.12；公开日 2025.03.14。', cardDetail: 'CN119606312A / 申请公开', art: 'document', tone: '#394148' }
];

function Awards() {
  const [active, setActive] = useState(0);
  const [navigation, setNavigation] = useState(null);
  const [paused, setPaused] = useState(false);
  const stage = useRef(null);
  const [galleryMounted, setGalleryMounted] = useState(false);
  function navigate(index) { setActive(index); setNavigation({ index, time: performance.now() }); }
  // Mounting loads about 2.7MB of images, which would otherwise hold up the opening video's first frame.
  useEffect(() => {
    const mount = () => setGalleryMounted(true);
    const near = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) mount(); }, { rootMargin: '150% 0px' });
    near.observe(stage.current);
    let timer = 0;
    const stopWaiting = whenOpeningSettled(() => { timer = setTimeout(mount, 1200); });
    return () => { near.disconnect(); stopWaiting(); clearTimeout(timer); };
  }, []);
  return <section className="narrative-section awards recognition-section" id="awards" aria-labelledby="awards-title" data-narrative>
    <div className="shell"><NarrativeHead id="awards-title" index="04 / RECOGNITION" title="探索留下的印记。" lede="论文、专利、竞赛与奖学金，记录每一段研究走到的地方。" />
      <div className="recognition-toolbar"><p>拖动浏览，点击展开卡片。</p><button className="gallery-pause" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? '继续缓慢流动' : '暂停自动流动'}</button></div>
    </div>
    <div className="recognition-stage" ref={stage}>{galleryMounted && <CircularGallery items={recognitionItems} navigation={navigation} bend={2.6} itemSize={1.15} itemAspect={0.8} gap={0.16} wave={0.3} borderRadius={0.025} fadeEdges={0.06} shadow={0.12} font='400 25px Manrope, "PingFang SC", sans-serif' autoScroll={paused ? 0 : 0.35} scrollEase={0.065} dpr={1.5} onActiveChange={setActive} />}</div>
    <div className="shell recognition-bottom">
      <div className="recognition-index" aria-label="选择成果">{recognitionItems.map((entry, index) => <button key={entry.text} onClick={() => navigate(index)} aria-pressed={index === active}><span>{String(index + 1).padStart(2, '0')}</span>{entry.text}</button>)}</div>

    </div>
  </section>;
}

function Contact() {
  const [copyState, setCopyState] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(EMAIL); setCopyState('邮箱已复制'); }
    catch { setCopyState('复制未成功，请使用下方邮箱链接'); }
  }
  return <footer className="contact" id="contact" data-motion-section><ClosingRibbon /><div className="shell contact-inner"><div className="contact-intro"><span>金融研究 · 数据 · AI</span><a href="#top" className="back-top">回到顶部 <Arrow /></a></div><div className="contact-main"><h2 className="closing-title"><SplitText tag="span" text="LET’S TALK." className="contact-split-title" effect="skew" splitType="chars" delay={65} duration={1.2} staggerFrom="start" mask hoverEffect="lift" sweep={3.2} textAlign="left" threshold={0.18} rootMargin="-30px" /></h2></div><div className="contact-links"><div><p>欢迎交流研究，也期待新的工作机会。</p><a href={`mailto:${EMAIL}`} className="email">{EMAIL}</a><button className="copy-email" onClick={copy}>复制邮箱</button><span className="copy-status" role="status">{copyState}</span></div></div></div></footer>;
}

export default function App() {
  const root = useRef(null);
  usePortfolioMotion(root);
  return <div ref={root} className="creative-page"><a className="skip-link" href="#main">跳至主要内容</a><Hero /><main id="main"><ResearchAreas /><About /><Awards /><Experience /></main><Contact /></div>;
}
