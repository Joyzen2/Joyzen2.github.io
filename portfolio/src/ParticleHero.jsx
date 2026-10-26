import { useEffect, useRef, useState } from 'react';
import './particle-hero.css';
import HoverLabel from './HoverLabel.jsx';

const asset = (name) => `${import.meta.env.BASE_URL}media/${name}`;
const MACRO = 'https://joyzen2.github.io/macro/';

function Arrow({ straight = false }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={straight ? 'M4 12h16m-6-6 6 6-6 6' : 'M5 19 19 5M5 5h14v14'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function ParticleHero() {
  const section = useRef(null);
  const video = useRef(null);
  const [menu, setMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v || failed) return;
    const bounds = section.current.getBoundingClientRect();
    let visible = bounds.bottom > 0 && bounds.top < innerHeight;
    const sync = () => {
      if (paused || reduced || document.hidden || !visible) v.pause();
      else v.play().catch(() => setPlaying(false));
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .05 });
    observer.observe(section.current);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); v.pause(); };
  }, [paused, reduced, failed]);

  useEffect(() => {
    const escape = (event) => { if (event.key === 'Escape') setMenu(false); };
    const wide = matchMedia('(min-width: 901px)');
    const close = () => { if (wide.matches) setMenu(false); };
    window.addEventListener('keydown', escape);
    wide.addEventListener('change', close);
    return () => { window.removeEventListener('keydown', escape); wide.removeEventListener('change', close); };
  }, []);

  function togglePlayback() {
    if (playing) setPaused(true);
    else {
      setPaused(false);
      video.current?.play().catch(() => setPlaying(false));
    }
  }

  function mediaFailed() { setFailed(true); setPlaying(false); }

  return <section ref={section} className="particle-hero" id="top" aria-labelledby="particle-title" data-reduced={reduced}>
    <div className="opening-curtain" aria-hidden="true"><span>ZHENG JIN</span><span>RESEARCH & SYSTEMS</span></div>
    <div className="particle-scene" aria-hidden="true">
      <img src={asset('silver-particles-poster.jpg')} alt="" className="particle-poster" fetchPriority="high" />
      {!failed && <video ref={video} muted loop playsInline preload="metadata" poster={asset('silver-particles-poster.jpg')} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={mediaFailed}><source src={asset('silver-particles.mp4')} type="video/mp4" onError={mediaFailed} /></video>}
    </div>
    <div className="particle-shade" aria-hidden="true" />
    <header className="particle-header">
      <a className="particle-brand" href="#top" aria-label="金正，返回首页"><span>金正</span><span>ZHENG JIN</span></a>
      <nav id="particle-navigation" className={`particle-nav${menu ? ' is-open' : ''}`} aria-label="主导航" onClick={() => setMenu(false)}>
        <a href="#work">精选研究</a><a href={MACRO} target="_blank" rel="noreferrer">宏观研究站</a><a href="#about">关于我</a><a href="#notes">研究笔记</a>
      </nav>
      <div className="particle-header-actions"><a href="#contact" className="particle-contact"><HoverLabel alternate="聊一聊">联系我</HoverLabel><Arrow /></a><button className="particle-menu" aria-expanded={menu} aria-controls="particle-navigation" onClick={() => setMenu(!menu)}>{menu ? '关闭' : '菜单'}</button></div>
    </header>
    <div className="particle-main">
      <div className="particle-copy">
        <h1 id="particle-title"><span className="hero-title-mask"><span className="hero-title-line">在变化中，</span></span><span className="hero-title-mask"><span className="hero-title-line">寻找结构。</span></span></h1>
        <p className="particle-role">宏观与量化研究 <span>·</span> AI 投研工具开发</p>
        <p className="particle-description">研究信息如何进入价格，<br className="particle-mobile-break" />也把研究方法做成工具。</p>
        <div className="particle-actions"><a className="particle-button particle-button-light" href="#work"><HoverLabel alternate="探索研究成果">查看精选研究</HoverLabel><Arrow straight /></a><a className="particle-button particle-button-dark" href={MACRO} target="_blank" rel="noreferrer"><HoverLabel alternate="阅读完整研究">进入宏观研究站</HoverLabel><Arrow /></a></div>
      </div>
    </div>
    <div className="particle-bottom">
      <a href={MACRO} target="_blank" rel="noreferrer" className="particle-field"><span>宏观利率</span><span>MACRO & RATES</span><Arrow /></a>
      <a href="#work" className="particle-field"><span>量化策略</span><span>QUANTITATIVE RESEARCH</span><Arrow /></a>
      <a href="https://joyzen2.github.io/ai-research/" target="_blank" rel="noreferrer" className="particle-field"><span>AI 投研工具</span><span>RESEARCH AGENTS</span><Arrow /></a>
      <button className="particle-playback" onClick={togglePlayback} disabled={failed || reduced} aria-label={failed ? '背景使用静态封面' : reduced ? '已按系统设置减少动态效果' : playing ? '暂停背景动画' : '播放背景动画'}>
        {playing && !reduced ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.5" /></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5z" fill="currentColor" /></svg>}
        <span>{failed || reduced ? '静态' : playing ? '暂停' : '播放'}</span>
      </button>
    </div>
  </section>;
}
