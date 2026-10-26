import { useCallback, useEffect, useState } from 'react';
import MarketCanvas from './MarketCanvas.jsx';
import './hero-lab.css';

const versions = [
  {id:'shock',name:'信息冲击',short:'A',title:<>信息变化，<br />市场<span>重定价。</span></>,description:<>观察信息如何进入价格，<br />用数据与检验，理解市场的变化。</>,note:'一个信息节点，如何改变整个结构。'},
  {id:'paths',name:'价格路径',short:'B',title:<>在变化中，<br />寻找<span>结构。</span></>,description:<>研究宏观与市场定价，探索量化策略，<br />也把研究流程做成 AI 投研工具。</>,note:'宏观信息 · 市场预期 · 价格反应'},
  {id:'constraint',name:'约束结构',short:'C',title:<>把信息，<br />变成<span>判断。</span></>,description:<>研究信号，也研究约束。<br />在风险、证据与方法之间，构建投资判断。</>,note:'在约束之内，探索新的可能。'},
];
function Arrow({straight=false}){return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={straight?'M4 12h16m-6-6 6 6-6 6':'M5 19 19 5M5 5h14v14'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;}
function initialVersion(){const v=new URLSearchParams(location.search).get('hero');return versions.some(x=>x.id===v)?v:'paths';}

export default function HeroLab(){
  const [variant,setVariant]=useState(initialVersion);
  const [paused,setPaused]=useState(false);
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [fallback,setFallback]=useState(false);
  const [menu,setMenu]=useState(false);
  const [marketStage,setMarketStage]=useState('before');
  const fail=useCallback(()=>setFallback(true),[]);
  const updateStage=useCallback((stage)=>setMarketStage(stage),[]);
  const current=versions.find(x=>x.id===variant);
  useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const f=()=>setReduced(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);
  useEffect(()=>{const pop=()=>setVariant(initialVersion());window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  function choose(id){setVariant(id);const u=new URL(location.href);u.searchParams.set('hero',id);history.replaceState({},'',u);}
  return <section className={`hero hero-lab hero-${variant}`} id="top" aria-labelledby="hero-title">
    <div className="lab-art" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}media/current-poster.jpg`} alt="" className="lab-fallback" />{!fallback&&<MarketCanvas variant={variant} paused={paused} onFallback={fail} onStageChange={updateStage}/>}</div>
    <div className="lab-shade" />
    <header className="header shell"><a className="brand" href="#top" aria-label="金正，返回首页"><span className="brand-zh">金正<span className="brand-dot" /></span><span className="brand-en">ZHENG JIN</span></a><button className="menu-toggle" aria-expanded={menu} aria-controls="main-navigation" onClick={()=>setMenu(!menu)}>{menu?'关闭导航':'菜单'}</button><nav id="main-navigation" className={menu?'nav is-open':'nav'} aria-label="主导航" onClick={()=>setMenu(false)}><a href="#work">精选研究</a><a href="#about">关于我</a><a href="#experience">经历</a><a href="#notes">研究笔记</a></nav><a className="header-contact" href="#contact">聊一聊 <Arrow /></a></header>
    <div className="lab-main shell"><div className="lab-copy"><h1 id="hero-title">{current.title}</h1><p className="lab-description">{current.description}</p><a className="light-button" href="#work">探索我的研究 <Arrow straight /></a></div><div className="lab-identity"><span>金正 / Zheng Jin</span><p>宏观与量化研究<br />AI 投研工具开发</p></div></div>
    {variant==='paths'&&<div className="market-annotations" data-stage={marketStage}><div className="market-event"><span>经济数据发布</span><small>{marketStage==='before'?'市场等待新信息':marketStage==='release'?'实际值与预期的差异':'新信息进入价格'}</small></div><div className="market-timeline" aria-label="示意时间轴：发布前、数据发布、发布后"><span className={marketStage==='before'?'stage-active':''}>发布前<small>市场预期</small></span><span className={marketStage==='release'?'stage-active':''}>数据发布<small>信息到来</small></span><span className={marketStage==='after'?'stage-active':''}>发布后<small>价格调整</small></span></div></div>}
    <div className="lab-caption shell"><span className="lab-concept">{current.note}</span><span>原创交互视觉 · 非行情数据</span></div>
    <div className="lab-bottom shell"><a href="#about" className="scroll-cue"><span className="scroll-line" />向下探索</a><div className="variant-picker" role="group" aria-label="比较首页视觉方案">{versions.map(v=><button key={v.id} onClick={()=>choose(v.id)} aria-pressed={variant===v.id}><span>{v.short}</span>{v.name}</button>)}</div><button className="lab-pause" onClick={()=>setPaused(!paused)} disabled={fallback||reduced} aria-label={fallback?'静态封面':reduced?'已按系统设置减少动态效果':paused?'播放动态':'暂停动态'}>{!paused&&!reduced&&!fallback?<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.6" /></svg>:<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5z" fill="currentColor" /></svg>}<span>{fallback||reduced?'静态画面':paused?'播放':'暂停'}</span></button></div>
  </section>;
}
