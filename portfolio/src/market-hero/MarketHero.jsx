import { useEffect, useRef } from 'react';
import { QUALITY, PARTICLE_SIZE } from './market-data.js';
import { drawStaticSurface } from './static-surface.js';
import { DURATION, narrative } from './timeline.js';
import './market-hero.css';

const PLAYBACK_FPS = 60;
const DPR_STEPS = [2, 1.75, 1.5, 1.25, 1];

export function pickQuality() { return 'low'; }

/**
 * Mounts the WebGL scene behind HTML copy. One clock drives the camera, the shaders
 * and (through onFrame) the titles; the scene module loads only after first paint.
 * Reduced motion, a missing GPU or a slow load all fall back to a still surface and
 * fully visible titles.
 */
export default function MarketHero({ paused = false, reduced = false, initialPaused = false, quality = 'auto', startTime = 0, titleGrace = 2500, onFrame, onUnavailable, apiRef, className = '' }) {
  const host = useRef(null);
  const live = useRef({});
  const syncRef = useRef(() => {});
  live.current = { paused, onFrame, onUnavailable };

  useEffect(() => { syncRef.current(); }, [paused]);

  useEffect(() => {
    const element = host.current;
    const state = { time: startTime, speed: 1, loop: null, playing: !initialPaused, view: { yaw: -15.5, pitch: 0, dolly: 0.8, spread: 1.5, pointSize: PARTICLE_SIZE, pointOpacity: 0.65 }, quality: 'low', fps: 0, dpr: 1 };
    let scene = null;
    let canvas = null;
    let frame = 0;
    let last = null;
    let nextDraw = null;
    let visible = true;
    let disposed = false;
    let dprCap = QUALITY[state.quality]?.dpr ?? 1.5;
    let samples = [];
    let resizeObserver;
    let intersection;
    let stillObserver;
    let forced = false;
    // Titles normally follow the narrative; once forced they stay fully visible.
    const report = (time, view) => live.current.onFrame?.(time, forced ? { ...view, first: 1, second: 1 } : view);

    function showStill(reason) {
      forced = true;
      element.dataset.fallback = reason;
      const still = document.createElement('canvas');
      still.className = 'market-hero-canvas';
      element.appendChild(still);
      const paint = () => { const { width, height } = element.getBoundingClientRect(); drawStaticSurface(still, Math.max(1, width), Math.max(1, height)); };
      paint();
      stillObserver = new ResizeObserver(paint);
      stillObserver.observe(element);
      element.dataset.ready = 'still';
      report(DURATION, { stage: 'still', first: 1, second: 1 });
    }

    const cap = () => state.view.fps || PLAYBACK_FPS;
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };
    const running = () => Boolean(scene) && visible && !document.hidden && state.playing && !live.current.paused;

    function fail(reason) {
      if (disposed) return;
      stop();
      scene?.dispose();
      scene = null;
      canvas?.remove();
      showStill(reason);
      live.current.onUnavailable?.(reason);
    }
    function draw() {
      if (!scene) return;
      try { scene.render(state.time, state.view); } catch (error) { console.error(error); fail('render'); return; }
      report(state.time, narrative(state.time));
    }
    function resize() {
      if (!scene) return;
      const { width, height } = element.getBoundingClientRect();
      state.dpr = Math.min(devicePixelRatio || 1, dprCap);
      scene.resize(Math.max(1, width), Math.max(1, height), state.dpr);
      if (!frame) draw();
    }
    function adapt(gap) {
      // Throttled or background frames (> 250 ms) say nothing about the GPU.
      if (gap > 250) return;
      samples.push(gap);
      if (samples.length < 90) return;
      const mean = samples.reduce((sum, g) => sum + g, 0) / samples.length;
      samples = [];
      state.fps = Math.round(1000 / mean);
      if (mean > (1000 / cap()) * 1.45 && dprCap > 1) {
        dprCap = DPR_STEPS.find(step => step < dprCap) ?? 1;
        resize();
      }
    }
    function tick(now) {
      frame = requestAnimationFrame(tick);
      const interval = 1000 / cap();
      if (nextDraw !== null && now < nextDraw - 0.1) return;
      // Advance a fixed deadline, retaining the remainder across display refreshes.
      // Rendering cadence stays independent from the animation clock.
      if (nextDraw === null) nextDraw = now + interval;
      else nextDraw += Math.max(1, Math.floor((now - nextDraw + 0.1) / interval) + 1) * interval;
      const gap = last === null ? 0 : now - last;
      last = now;
      if (gap) adapt(gap);
      state.time += (Math.min(gap, 100) / 1000) * state.speed;
      if (state.loop && state.time >= state.loop[1]) state.time = state.loop[0];
      draw();
    }
    function sync() {
      if (!running()) { stop(); return; }
      if (!frame) { last = null; nextDraw = null; frame = requestAnimationFrame(tick); }
    }
    function lost(event) { event.preventDefault(); fail('context-lost'); }
    syncRef.current = sync;

    const api = {
      play() { state.playing = true; sync(); },
      pause() { state.playing = false; sync(); draw(); },
      toggle() { if (state.playing) api.pause(); else api.play(); },
      replay() { state.loop = null; state.time = 0; state.playing = true; draw(); sync(); },
      seek(time) { state.time = Math.max(0, time); draw(); },
      setLoop(range) { state.loop = range; if (range) state.time = range[0]; state.playing = true; draw(); sync(); },
      setSpeed(speed) { state.speed = speed; },
      setView(patch) { Object.assign(state.view, patch, { pointSize: PARTICLE_SIZE }); if (!frame) draw(); },
      // Kept for existing lab callers; the approved surface density is fixed.
      setQuality() {},
      getState() { return { ...state, view: { ...state.view }, running: Boolean(frame), ...(scene ? scene.stats() : {}) }; },
    };
    if (apiRef) apiRef.current = api;

    if (reduced) {
      showStill('reduced-motion');
      return () => { disposed = true; stillObserver?.disconnect(); element.replaceChildren(); element.dataset.ready = 'false'; delete element.dataset.fallback; };
    }
    // Never let a slow GPU download hold the titles back.
    const grace = setTimeout(() => { if (!scene && !forced) { forced = true; report(state.time, narrative(state.time)); } }, titleGrace);

    import('./MarketHeroScene.js').then(({ MarketHeroScene }) => {
      if (disposed) return;
      canvas = document.createElement('canvas');
      canvas.className = 'market-hero-canvas';
      canvas.addEventListener('webglcontextlost', lost);
      element.appendChild(canvas);
      try { scene = new MarketHeroScene(canvas, { quality: state.quality }); } catch (error) { console.error(error); fail('webgl-unavailable'); return; }
      resize();
      element.dataset.ready = 'true';
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
      intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
      intersection.observe(element);
      document.addEventListener('visibilitychange', sync);
      draw();
      sync();
    }).catch(error => { console.error(error); fail('renderer-load'); });

    return () => {
      disposed = true;
      stop();
      clearTimeout(grace);
      stillObserver?.disconnect();
      resizeObserver?.disconnect();
      intersection?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      canvas?.removeEventListener('webglcontextlost', lost);
      scene?.dispose();
      element.replaceChildren();
      element.dataset.ready = 'false';
      delete element.dataset.fallback;
      if (apiRef?.current === api) apiRef.current = null;
    };
  }, [quality, startTime, initialPaused, reduced, titleGrace, apiRef]);

  return <div ref={host} className={`market-hero${className ? ` ${className}` : ''}`} aria-hidden="true" data-ready="false" />;
}
