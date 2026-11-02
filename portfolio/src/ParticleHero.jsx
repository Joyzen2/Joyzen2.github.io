import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import './particle-hero.css';
import HoverLabel from './HoverLabel.jsx';
import MarketHero from './market-hero/MarketHero.jsx';
import { heroApi } from './market-hero/hero-link.js';
import { narrative } from './market-hero/timeline.js';
import { OPENING } from './market-hero/opening-config.js';
import useOpeningPlayback from './market-hero/useOpeningPlayback.js';
import './market-hero/hero-home.css';
const MACRO = 'https://joyzen2.github.io/macro/';
const DebugPanel = import.meta.env.DEV ? lazy(() => import('./market-hero/DebugPanel.jsx')) : null;
const COPY = ['在无序中，看见可能', 'Possibility in disorder'];

function Arrow({ straight = false }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={straight ? 'M4 12h16m-6-6 6 6-6 6' : 'M5 19 19 5M5 5h14v14'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function SoundIcon({ muted }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" />{muted ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}</svg>;
}
function PlaybackIcon({ paused }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{paused ? <path d="m9 5 11 7-11 7V5Z" /> : <path d="M8 5v14M16 5v14" />}</svg>;
}

export default function ParticleHero() {
  const section = useRef(null), modeRef = useRef('opening');
  const [menu, setMenu] = useState(false), [backgroundPaused, setBackgroundPaused] = useState(false);
  const [failed, setFailed] = useState(false), [liveReady, setLiveReady] = useState(false);
  const firstLiveFrame = useRef(false);
  const [debug] = useState(() => Boolean(DebugPanel) && new URLSearchParams(location.search).has('debug'));
  const paintTime = useCallback((time, settled = false) => {
    const element = section.current;
    if (!element) return;
    const state = settled ? { first: 1, second: 1, shine: 1, glint: 0 } : narrative(time);
    element.style.setProperty('--hero-t1', state.first.toFixed(4));
    element.style.setProperty('--hero-t2', state.second.toFixed(4));
    element.style.setProperty('--hero-shine', state.shine.toFixed(4));
    element.style.setProperty('--hero-glint', state.glint.toFixed(4));
  }, []);
  const opening = useOpeningPlayback({ section, onTime: paintTime });
  const ready = opening.mode === 'ready';
  const showSite = ready || opening.siteVisible;
  modeRef.current = opening.mode;
  const onLiveFrame = useCallback(time => {
    if (!firstLiveFrame.current) { firstLiveFrame.current = true; setLiveReady(true); }
    if (modeRef.current === 'ready') paintTime(time, true);
  }, [paintTime]);

  useEffect(() => { if (ready) paintTime(OPENING.duration, true); }, [ready, paintTime]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') setMenu(false); };
    const wide = matchMedia('(min-width: 901px)');
    const close = () => { if (wide.matches) setMenu(false); };
    window.addEventListener('keydown', escape); wide.addEventListener('change', close);
    return () => { window.removeEventListener('keydown', escape); wide.removeEventListener('change', close); };
  }, []);
  if (import.meta.env.DEV) {
    window.__marketHero = heroApi;
    window.__homeOpening = { replay: opening.replay, skip: () => opening.finish('skip'), getState: () => ({ mode: opening.mode, siteVisible: showSite, liveReady, muted: opening.muted, reduced: opening.reduced, hasVideo: opening.hasVideo, portrait: opening.portrait, currentTime: opening.video.current?.currentTime ?? 0 }) };
  }

  return <section ref={section} className={`particle-hero${opening.portrait ? ' is-portrait' : ''}`} id="top" aria-labelledby="particle-title" data-mode={opening.mode} data-site-visible={showSite} data-reduced={opening.reduced}>
    <div className="particle-scene" aria-hidden="true">
      <img className="opening-poster" src={opening.portrait ? OPENING.portraitPoster : OPENING.poster} alt="" fetchPriority="high" />
      {opening.liveMounted && <div className={`opening-live${liveReady ? ' is-ready' : ''}`}>
        <div className="opening-live-frame">
          <MarketHero apiRef={heroApi} paused={!ready || backgroundPaused} reduced={opening.reduced} startTime={OPENING.duration} onFrame={onLiveFrame} onUnavailable={() => setFailed(true)} />
        </div>
      </div>}
      <div className={`opening-video-layer${ready ? ' is-finished' : ''}`}>
        <video ref={opening.video} className="opening-video" src={opening.hasVideo ? opening.source : undefined} muted playsInline preload={opening.hasVideo ? 'auto' : 'none'} disablePictureInPicture tabIndex={-1} />
      </div>
    </div>
    <div className="market-hero-shade" aria-hidden="true" />
    <div className="particle-shade" aria-hidden="true" />

    {!ready && <div className="opening-controls" role="group" aria-label="开场播放控制">
      <div className="opening-sound-wrap">
        {opening.soundHint && <span className="opening-sound-hint" aria-hidden="true">配乐</span>}
        <button type="button" className="opening-icon" onClick={opening.toggleSound} aria-label={opening.muted ? '开启声音' : '静音'} aria-pressed={!opening.muted} title={opening.muted ? '开启声音' : '静音'}><SoundIcon muted={opening.muted} /></button>
      </div>
      <button type="button" className="opening-icon" onClick={opening.toggleVideo} aria-label={opening.videoPaused ? '继续开场' : '暂停开场'} title={opening.videoPaused ? '继续开场' : '暂停开场'}><PlaybackIcon paused={opening.videoPaused} /></button>
      <button type="button" className="opening-skip" onClick={() => opening.finish('skip')}>跳过开场<Arrow straight /></button>
    </div>}

    <header className="particle-header" inert={!showSite} aria-hidden={!showSite}>
      <a className="particle-brand" href="#top" aria-label="金正，返回首页"><span>金正</span><span>ZHENG JIN / PERSONAL LAB</span></a>
      <nav id="particle-navigation" className={`particle-nav${menu ? ' is-open' : ''}`} aria-label="主导航" onClick={() => setMenu(false)}>
        <a href="#research">研究方向</a><a href={MACRO} target="_blank" rel="noreferrer">宏观研究站</a><a href="#about">关于我</a><a href="#experience">经历</a>
      </nav>
      <div className="particle-header-actions">
        {!opening.reduced && <button type="button" className="opening-replay" onClick={opening.replay}>重播开场</button>}
        <a href="#contact" className="particle-contact"><HoverLabel alternate="聊一聊">联系我</HoverLabel><Arrow /></a>
        <button type="button" className="particle-menu" aria-expanded={menu} aria-controls="particle-navigation" onClick={() => setMenu(!menu)}>{menu ? '关闭' : '菜单'}</button>
      </div>
    </header>

    <div className="home-copy">
      <h1 id="particle-title" className="home-title" aria-label={`${COPY[0]}。${COPY[1]}`}>
        <span className="home-title-cn"><span>{COPY[0]}</span><span className="home-title-gleam" aria-hidden="true">{COPY[0]}</span></span>
        <span className="home-title-en" lang="en"><span>{COPY[1]}</span><span className="home-title-gleam" aria-hidden="true">{COPY[1]}</span></span>
      </h1>
    </div>
    <div className="home-introduction" inert={!showSite} aria-hidden={!showSite}>
      <p className="home-name">金正 <span>/ ZHENG JIN</span></p>
      <p className="particle-role">宏观与量化研究 <span>·</span> AI 投研工具开发</p>
      <div className="particle-actions">
        <a className="particle-button particle-button-light" href="#research">查看研究<Arrow straight /></a>
        <a className="particle-button particle-button-dark" href="#about">关于我<Arrow straight /></a>
      </div>
    </div>
    <div className="particle-bottom" inert={!showSite} aria-hidden={!showSite}>
      <a href={MACRO} target="_blank" rel="noreferrer" className="particle-field"><span>宏观利率</span><span>MACRO & RATES</span><Arrow /></a>
      <a href="/csi500/" className="particle-field"><span>量化策略</span><span>QUANTITATIVE RESEARCH</span><Arrow /></a>
      <a href="https://joyzen2.github.io/ai-research/" target="_blank" rel="noreferrer" className="particle-field"><span>AI 投研工具</span><span>RESEARCH AGENTS</span><Arrow /></a>
      <button type="button" className="particle-playback" onClick={() => setBackgroundPaused(value => !value)} disabled={!ready || failed || opening.reduced} aria-pressed={backgroundPaused} aria-label={failed || opening.reduced ? '背景使用静态曲面' : backgroundPaused ? '播放背景动画' : '暂停背景动画'}>
        <PlaybackIcon paused={backgroundPaused || failed || opening.reduced} /><span>{failed || opening.reduced ? '静态' : backgroundPaused ? '播放' : '暂停'}</span>
      </button>
    </div>
    {debug && ready && <Suspense fallback={null}><DebugPanel api={heroApi} /></Suspense>}
  </section>;
}
