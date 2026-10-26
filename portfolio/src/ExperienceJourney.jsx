import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
import FlipCard from './FlipCard.jsx';
import './journey-flip.css';

const stages = [
  { title: '思必驰', type: '项目助理 · 实习', date: '2023.03 — 2023.07', summary: '从需求到工程交付', description: '参与语音数据分析、测试方案和自动化测试工作，在客户需求与工程实现之间建立连接。', tags: ['数据分析', '测试自动化'], href: null },
  { title: '数字骨科夹板研究', type: '科研项目', date: '2024 · 国际会议发表', summary: '把问题做成研究', description: '围绕桡骨远端骨折治疗开展数字化中医骨科夹板研究。作为核心作者参与 TrustCom 2024 论文，并形成创新竞赛与专利成果。', tags: ['跨学科研究', '论文与专利'], href: 'https://doi.org/10.1109/TrustCom63139.2024.00372', link: '阅读论文' },
  { title: '中诚信托', type: '量化研究员助理 · 实习', date: '2025.07 — 2025.12', summary: '走进宏观与资产配置', description: '参与宏观数据流水线、经济状态识别与风险预算配置框架搭建。实习后以公开数据按实时口径重建，进一步研究宏观信息与市场定价。', tags: ['宏观研究', '风险预算'], href: 'https://joyzen2.github.io/macro/', link: '进入宏观研究站' },
  { title: '中证500指数增强', type: '独立量化研究', date: '研究项目', summary: '从因子到组合', description: '构建基本面与量价因子，按时点对齐数据，进行滚动训练、风险约束与组合优化；拆解超额来源，记录策略失效阶段。', tags: ['53 项因子', '组合优化'], href: '/csi500/', link: '进入指数增强研究站' },
  { title: 'AI 投研工程开发', type: 'AI 投研工程', date: '当前项目', summary: '让研究方法成为工具', description: '围绕时点可查的研究资料与工具取证构建投研流程，以 12 项上线闸门检查组织工程交付，持续完善研究输出的可靠性。', tags: ['上线闸门', '工具取证'], href: 'https://joyzen2.github.io/ai-research/', link: '进入项目网站' },
  { title: '大模型文本因子与前视偏差', type: '独立量化研究', date: '2026.10', summary: '检验信息，也检验模型', description: '基于公告与研报标题构建文本信号，对照规则、学习基准和三个开源大模型，检验增量信息、噪音以及大模型前视偏差。', tags: ['另类数据', '前视偏差'], href: '/text-factors/', link: '进入文本因子研究站' }
];

export default function ExperienceJourney() {
  const [expanded, setExpanded] = useState(null);
  const journeyRef = useRef(null);
  useLayoutEffect(() => {
    const root = journeyRef.current;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const curve = root.querySelector('.journey-curve path');
      const length = curve.getTotalLength();
      const entrance = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top 80%', once: true },
        defaults: { ease: 'power4.out' }
      });
      entrance
        .fromTo(root.querySelector('.journey-heading h3'),
          { yPercent: 85, skewY: 5, clipPath: 'inset(0 0 100% 0)' },
          { yPercent: 0, skewY: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.2, clearProps: 'transform,clipPath' }, 0)
        .fromTo(root.querySelector('.journey-heading p'),
          { y: 24, clipPath: 'inset(0 0 100% 0)' },
          { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1, clearProps: 'transform,clipPath' }, .2)
        .fromTo(curve, { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, duration: 1.7, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' }, .2)
        .fromTo(root.querySelectorAll('.journey-dot'), { scale: 0 },
          { scale: 1, duration: .65, stagger: .12, clearProps: 'transform' }, .45)
        .fromTo(root.querySelectorAll('.journey-flip-wrap'),
          { y: 75, rotation: 3, clipPath: 'inset(0 0 100% 0)' },
          { y: 0, rotation: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.25, stagger: .12, clearProps: 'transform,clipPath' }, .45);
    }, root);
    return () => media.revert();
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('portfolio:layout')));
    return () => cancelAnimationFrame(frame);
  }, [expanded]);
  return <div ref={journeyRef} className="experience-journey" id="experience">
    <div className="journey-heading"><h3>工作、科研与项目经历</h3><p>从工程实践，到金融研究与 AI 工具。<span>点击卡片翻面，查看经历阐述。</span></p></div>
    <div className="journey-scroll" tabIndex={0} role="region" aria-label="从左到右的六段经历">
      <div className="journey-landscape">
        <svg className="journey-curve" viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden="true"><path d="M100 150 C200 150 200 144 300 144 S400 120 500 120 S600 80 700 80 S800 42 900 42 S1000 20 1100 20" /></svg>
        <ol className="journey-grid">{stages.map((stage, index) => {
          const open = expanded === index;
          return <li key={stage.title} style={{ '--node-y': `${[150,144,120,80,42,20][index]}px` }} className={open ? 'journey-entry is-open' : 'journey-entry'}>
            <span className="journey-dot" aria-hidden="true" />
            <article className="journey-flip-wrap">
              <FlipCard flipped={open} onFlipChange={next => setExpanded(next ? index : null)} draggable={false} tiltMax={5} hoverScale={1.025} glareOpacity={0.12} damping={32} stiffness={150} shadow={false} height={360} radius={12} background="#111111" color="#edf3fa" ariaLabel={`${stage.title}，${open ? '背面说明，再次点击返回' : '点击翻转查看详情'}`}
                front={<div className="journey-face-content"><span className="journey-date">{stage.date}</span><div className={`journey-wordmark journey-wordmark-${index}`} aria-hidden="true">{['AISPEECH', 'SPLINT', 'MACRO', '500', 'AGENT', 'LLM'][index]}<small>{['Speech & Engineering', 'Digital Healthcare', 'Research & Allocation', 'Index Enhancement', 'Evidence & Tools', 'Text & Information'][index]}</small></div><h4>{stage.title}</h4><p className="journey-type">{stage.type}</p><div className="journey-face-foot"><span>{stage.summary}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9a8 8 0 1 1-1 7M5 3v6h6"/></svg></div></div>}
                back={<div className="journey-face-content journey-back"><span className="journey-date">{stage.type}</span><h4>{stage.title}</h4><p className="journey-back-description">{stage.description}</p><div className="journey-chips">{stage.tags.map(tag => <span key={tag}>{tag}</span>)}</div><span className="journey-return">再次点击，返回正面</span></div>}
              />
              {open && stage.href && <a className="journey-outlink" href={stage.href} target={stage.href.startsWith('https') ? '_blank' : undefined} rel={stage.href.startsWith('https') ? 'noreferrer' : undefined}>{stage.link}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M4 4h12v12"/></svg></a>}
            </article>
          </li>;
        })}</ol>
      </div>
    </div>
  </div>;
}
