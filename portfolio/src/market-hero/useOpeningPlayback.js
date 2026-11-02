import { useCallback, useEffect, useRef, useState } from 'react';
import { OPENING, readPreference, writePreference } from './opening-config.js';

export default function useOpeningPlayback({ section, onTime }) {
  const video = useRef(null);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [portrait] = useState(() => matchMedia('(max-aspect-ratio: 1/1)').matches);
  const [mode, setMode] = useState(() => {
    const deep = location.hash && location.hash !== '#top';
    const force = new URLSearchParams(location.search).get('intro') === '1';
    return reduced || deep || (!force && readPreference(OPENING.seenKey) === '1') ? 'ready' : 'opening';
  });
  const modeRef = useRef(mode); modeRef.current = mode;
  const [hasVideo, setHasVideo] = useState(mode === 'opening');
  const [siteVisible, setSiteVisible] = useState(mode === 'ready');
  const [liveMounted, setLiveMounted] = useState(mode === 'ready');
  const [muted, setMuted] = useState(() => readPreference(OPENING.soundKey) === 'off');
  const [videoPaused, setVideoPaused] = useState(false);
  const [soundHint, setSoundHint] = useState(mode === 'opening');
  const userPaused = useRef(false);
  const volumeFrame = useRef(0);
  const releaseTimer = useRef(0);
  const source = portrait ? OPENING.portrait : OPENING.desktop;

  const rampVolume = useCallback((target, duration, done) => {
    cancelAnimationFrame(volumeFrame.current);
    const media = video.current;
    if (!media) { done?.(); return; }
    const from = media.volume, start = performance.now();
    const frame = now => {
      // A frame timestamp can precede `start`; an unclamped p pushes the volume above 1.
      const p = Math.max(0, Math.min(1, (now - start) / duration));
      media.volume = from + (target - from) * p;
      if (p < 1) volumeFrame.current = requestAnimationFrame(frame); else done?.();
    };
    volumeFrame.current = requestAnimationFrame(frame);
  }, []);

  const finish = useCallback((reason = 'skip') => {
    if (modeRef.current !== 'opening') return;
    modeRef.current = 'ready';
    if (['skip', 'ended', 'scroll', 'navigate'].includes(reason)) writePreference(OPENING.seenKey, '1');
    if (reason === 'skip') requestAnimationFrame(() => section.current?.querySelector('.home-introduction a')?.focus({ preventScroll: true }));
    setLiveMounted(true);
    setMode('ready');
    setSiteVisible(true);
    setSoundHint(false);
    onTime(OPENING.duration, true);
    rampVolume(0, 220, () => { if (modeRef.current === 'ready') video.current?.pause(); });
    clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => {
      if (modeRef.current !== 'ready') return;
      const media = video.current;
      media?.pause();
      media?.removeAttribute('src');
      media?.load();
      setHasVideo(false);
    }, 750);
  }, [onTime, rampVolume, section]);

  const toggleSound = useCallback(() => {
    const media = video.current;
    if (!media || modeRef.current !== 'opening') return;
    setSoundHint(false);
    if (muted) {
      media.volume = 0; media.muted = false; setMuted(false);
      writePreference(OPENING.soundKey, 'on');
      rampVolume(1, 180);
    } else {
      setMuted(true); writePreference(OPENING.soundKey, 'off');
      rampVolume(0, 150, () => { media.muted = true; });
    }
  }, [rampVolume, muted]);

  const toggleVideo = useCallback(() => {
    const media = video.current;
    if (!media || modeRef.current !== 'opening') return;
    if (media.paused) {
      userPaused.current = false;
      media.play().catch(() => finish('blocked'));
    } else { userPaused.current = true; media.pause(); }
  }, [finish]);

  const replay = useCallback(() => {
    if (reduced) return;
    clearTimeout(releaseTimer.current);
    cancelAnimationFrame(volumeFrame.current);
    userPaused.current = false;
    modeRef.current = 'opening';
    setHasVideo(true); setMode('opening'); setSiteVisible(false); setVideoPaused(false); setSoundHint(false);
    const media = video.current;
    if (media) {
      media.muted = readPreference(OPENING.soundKey) === 'off';
      media.volume = media.muted ? 0 : 1;
      setMuted(media.muted);
      if (media.readyState) media.currentTime = 0;
    }
    onTime(0, false);
    section.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [onTime, reduced, section]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(preference.matches); if (preference.matches) finish('reduced'); };
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, [finish]);

  useEffect(() => {
    if (mode !== 'opening') return;
    const media = video.current;
    if (!media) return;
    // The audio master is already attenuated in both MP4s (also works on iOS).
    media.muted = readPreference(OPENING.soundKey) === 'off';
    media.volume = media.muted ? 0 : 1;
    setMuted(media.muted);
    let active = true, frame = 0, stallTimer = 0;
    const clearStall = () => clearTimeout(stallTimer);
    const stalled = () => {
      clearStall();
      stallTimer = setTimeout(() => { if (active && !userPaused.current && !document.hidden) finish('timeout'); }, 8000);
    };
    const playing = () => { clearStall(); setVideoPaused(false); };
    const pause = () => setVideoPaused(true);
    const ended = () => finish('ended');
    const error = () => finish('error');
    const paint = () => {
      if (!active) return;
      onTime(media.currentTime, false);
      setSiteVisible(media.currentTime >= OPENING.siteAt);
      if (media.currentTime >= OPENING.warmAt) setLiveMounted(true);
    };
    const hasFrameCallback = typeof media.requestVideoFrameCallback === 'function';
    const tick = () => {
      if (!active) return;
      paint();
      frame = hasFrameCallback ? media.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
    };
    const play = () => {
      media.play().catch(() => {
        if (!active) return;
        // Some browsers reject remembered audible playback. Muted autoplay is the fallback.
        media.muted = true; setMuted(true);
        media.play().catch(() => { if (active) finish('blocked'); });
      });
    };
    const visibility = () => {
      if (document.hidden) media.pause();
      else if (!userPaused.current) play();
    };
    const navigate = () => { if (location.hash && location.hash !== '#top') finish('navigate'); };
    const keys = event => {
      if (event.key === 'Escape') finish('skip');
      if (event.code === 'Space' && !event.target.closest('button,a,input,textarea,select')) { event.preventDefault(); toggleVideo(); }
    };
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) finish('scroll'); }, { threshold: 0 });
    if (section.current) observer.observe(section.current);
    media.addEventListener('ended', ended); media.addEventListener('error', error);
    media.addEventListener('playing', playing); media.addEventListener('pause', pause);
    media.addEventListener('waiting', stalled); media.addEventListener('stalled', stalled);
    media.addEventListener('seeked', paint); media.addEventListener('timeupdate', paint);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('hashchange', navigate); window.addEventListener('keydown', keys);
    const startup = setTimeout(() => { if (active && media.currentTime < .05 && !userPaused.current && !document.hidden) finish('timeout'); }, 6500);
    tick(); play();
    return () => {
      active = false; clearTimeout(startup); clearStall(); observer.disconnect();
      if (hasFrameCallback) media.cancelVideoFrameCallback(frame); else cancelAnimationFrame(frame);
      media.removeEventListener('ended', ended); media.removeEventListener('error', error);
      media.removeEventListener('playing', playing); media.removeEventListener('pause', pause);
      media.removeEventListener('waiting', stalled); media.removeEventListener('stalled', stalled);
      media.removeEventListener('seeked', paint); media.removeEventListener('timeupdate', paint);
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('hashchange', navigate); window.removeEventListener('keydown', keys);
    };
  }, [mode, source, hasVideo, finish, onTime, section, toggleVideo]);

  useEffect(() => {
    if (!soundHint) return;
    const timer = setTimeout(() => setSoundHint(false), 5500);
    return () => clearTimeout(timer);
  }, [soundHint]);
  useEffect(() => () => {
    clearTimeout(releaseTimer.current); cancelAnimationFrame(volumeFrame.current);
    video.current?.pause();
  }, []);

  return { video, mode, siteVisible, hasVideo, liveMounted, portrait, source, muted, videoPaused, soundHint, reduced, finish, replay, toggleSound, toggleVideo };
}
