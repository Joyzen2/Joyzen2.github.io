import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const stages = [
  { title: '思必驰', type: '项目助理 · 实习', date: '2023.03 — 2023.07', description: '参与语音数据分析、测试方案和自动化测试工作，在客户需求与工程实现之间建立连接。', tags: ['数据分析', '测试自动化'] },
  { title: '数字骨科夹板研究', type: '科研项目', date: '2024 · 国际会议发表', description: '围绕桡骨远端骨折治疗开展数字化中医骨科夹板研究。作为核心作者参与 TrustCom 2024 论文，并形成创新竞赛与专利成果。', tags: ['跨学科研究', '论文与专利'], links: [['阅读论文', 'https://doi.org/10.1109/TrustCom63139.2024.00372']] },
  { title: '中诚信托', type: '量化研究员助理 · 实习', date: '2025.07 — 2025.12', description: '参与宏观数据流水线、经济状态识别与风险预算配置框架搭建。实习后以公开数据按实时口径重建，进一步研究宏观信息与市场定价。', tags: ['宏观研究', '风险预算'], links: [['进入宏观研究站', 'https://joyzen2.github.io/macro/']] },
  { title: '个人独立研究项目', type: '独立研究与工程', date: '持续进行', description: '实习之外独立完成的研究与工程，从因子与组合，到文本信号和 AI 投研工具。',
    links: [
      ['中证500多因子指数增强', '/csi500/'],
      ['AI 投研工程开发', 'https://joyzen2.github.io/ai-research/'],
      ['大模型文本因子与前视偏差', '/text-factors/'],
      ['InvestorBench 复现与评测', '/investorbench/'],
    ] },
];
const external = href => href.startsWith('https') ? { target: '_blank', rel: 'noreferrer' } : {};
// Height of the rising line across the page, 0..1 of its band. journeyRise in shaders.js is
// the same curve, so the surface's lines can land exactly on it.
const rise = t => { const s = t * t * (3 - 2 * t); return .17 + .82 * s; };

function OutArrow() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M4 4h12v12"/></svg>;
}

export default function ExperienceJourney() {
  const journeyRef = useRef(null), curveRef = useRef(null);
  useLayoutEffect(() => {
    const root = journeyRef.current, curve = curveRef.current;
    const line = curve.querySelector('.journey-line'), roof = curve.querySelector('.journey-roof');
    const entries = [...root.querySelectorAll('.journey-entry')], dots = root.querySelectorAll('.journey-dot');
    // Draw the line at the page's real size and stand each stage on it. The roof covers
    // everything above the line, so the surface behind only ever shows below it.
    const layout = () => {
      const box = curve.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const y = x => box.height * (1 - rise(x / box.width));
      let path = '';
      for (let i = 0; i <= 80; i++) { const x = box.width * i / 80; path += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y(x).toFixed(1)}`; }
      curve.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      line.setAttribute('d', path);
      roof.setAttribute('d', `${path}V0H0Z`);
      entries.forEach(entry => entry.style.setProperty('--node-rise', `${(box.height - y(entry.getBoundingClientRect().left - box.left)).toFixed(1)}px`));
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(curve);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const drawn = curve.getBoundingClientRect().width > 0;
      const stagesIn = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 80%', once: true }, defaults: { ease: 'power3.out' } })
        .fromTo(root.querySelectorAll('.journey-body'), { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: .2, clearProps: 'transform,opacity,visibility' }, 0);
      if (!drawn) { stagesIn.fromTo(dots, { scale: 0 }, { scale: 1, duration: .6, stagger: .2, clearProps: 'transform' }, 0); return; }
      const length = line.getTotalLength();
      gsap.timeline({ scrollTrigger: { trigger: curve, start: 'top 96%', once: true } })
        .fromTo(line, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' }, 0)
        .fromTo(dots, { scale: 0 }, { scale: 1, duration: .6, stagger: .25, ease: 'power3.out', clearProps: 'transform' }, .2);
    }, root);
    return () => { observer.disconnect(); media.revert(); };
  }, []);
  return <>
    <svg ref={curveRef} className="journey-curve" aria-hidden="true">
      <defs><linearGradient id="journey-stroke"><stop offset="0" stopColor="#7d8a98" stopOpacity="0" /><stop offset=".05" stopColor="#7d8a98" /><stop offset="1" stopColor="#b9c4cf" /></linearGradient></defs>
      <path className="journey-roof" style={{ fill: 'var(--page)', stroke: 'none' }} />
      <path className="journey-line" style={{ stroke: 'url(#journey-stroke)' }} />
    </svg>
    <div ref={journeyRef} className="experience-journey">
      <ol className="journey-grid">{stages.map(stage => <li key={stage.title} className="journey-entry">
        <span className="journey-dot" aria-hidden="true" />
        <article className="journey-body">
          <p className="journey-date">{stage.date}</p>
          <h3 className="journey-name">{stage.title}</h3>
          <p className="journey-type">{stage.type}</p>
          <p className="journey-text">{stage.description}</p>
          {stage.tags && <p className="journey-tags">{stage.tags.join(' · ')}</p>}
          {stage.links && <ul className="journey-links">{stage.links.map(([label, href]) => <li key={href}><a href={href} {...external(href)}>{label}<OutArrow /></a></li>)}</ul>}
        </article>
      </li>)}</ol>
    </div>
  </>;
}
