import { useCallback, useEffect, useRef, useState } from 'react';
import { OPENING, markOpeningSettled, readPreference, readVisit, writePreference, writeVisit } from './opening-config.js';

export default function useOpeningPlayback({ section, onTime }) {
  const video = useRef(null);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [portrait] = useState(() => matchMedia('(max-aspect-ratio: 1/1)').matches);
  const [mode, setMode] = useState(() => {
    const deep = location.hash && location.hash !== '#top';
    const force = new URLSearchParams(location.search).get('intro') === '1';
    return reduced || deep || (!force && readVisit(OPENING.seenKey) === '1') ? 'ready' : 'opening';
  });
  // A restored scroll position would read as the visitor scrolling past the film.
  const [startsWithFilm] = useState(mode === 'opening');
  if (startsWithFilm && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  useEffect(() => { if (startsWithFilm) scrollTo(0, 0); }, [startsWithFilm]);
  const modeRef = useRef(mode); modeRef.current = mode;
  const [hasVideo, setHasVideo] = useState(mode === 'opening');
  const [siteVisible, setSiteVisible] = useState(mode === 'ready');
  const [liveMounted, setLiveMounted] = useState(mode === 'ready');
  const [muted, setMuted] = useState(() => readPreference(OPENING.soundKey) === 'off');
  const [videoPaused, setVideoPaused] = useState(false);
  const [soundHint, setSoundHint] = useState(mode === 'opening');
  // The browser refused audible autoplay, so the opening runs silent until the visitor acts.
  const [soundBlocked, setSoundBlocked] = useState(false);
  // The browser refused even silent autoplay, so the film waits for a tap.
  const [playBlocked, setPlayBlocked] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [skipNudged, setSkipNudged] = useState(false);
  const userPaused = useRef(false);
  const volumeFrame = useRef(0);
  const releaseTimer = useRef(0);
  const source = portrait ? OPENING.portrait : OPENING.desktop;

  useEffect(() => { if (mode === 'ready') markOpeningSettled(); }, [mode]);

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
    if (['skip', 'ended', 'scroll', 'navigate'].includes(reason)) writeVisit(OPENING.seenKey, '1');
    if (reason === 'skip') requestAnimationFrame(() => section.current?.querySelector('.home-introduction a')?.focus({ preventScroll: true }));
    setLiveMounted(true);
    setMode('ready');
    setSiteVisible(true);
    setSoundHint(false); setSoundBlocked(false); setPlayBlocked(false); setWaiting(false);
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
    setSoundHint(false); setSoundBlocked(false);
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
    setHasVideo(true); setMode('opening'); setSiteVisible(false); setVideoPaused(false); setSoundHint(false); setSoundBlocked(false); setPlayBlocked(false);
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
    let active = true, frame = 0;
    const playing = () => { setVideoPaused(false); setPlayBlocked(false); };
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
      media.play().catch(error => {
        // A pause during the attempt (leaving the tab) says nothing about sound.
        if (!active || error.name === 'AbortError') return;
        // Browsers refuse audible autoplay on a first visit. Muted autoplay is the fallback,
        // and sound comes on with the visitor's first click or key, unless they turned it off.
        setSoundBlocked(!media.muted);
        media.muted = true; setMuted(true);
        // A few browsers refuse silent autoplay too (iOS in Low Power Mode). A tap still starts it.
        media.play().catch(refusal => { if (active && refusal.name !== 'AbortError') setPlayBlocked(true); });
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
    // The homepage takes over only once the film has really stopped: frames ahead in the buffer
    // count as running however long the network pauses, and waiting for a person never counts.
    let lastTime = media.currentTime, stuckSince = performance.now(), lastData = stuckSince;
    const arrived = () => { lastData = performance.now(); };
    const watchdog = setInterval(() => {
      const now = performance.now();
      if (media.paused || document.hidden || media.currentTime !== lastTime) {
        lastTime = media.currentTime; stuckSince = lastData = now;
        setWaiting(false);
        return;
      }
      setWaiting(now - stuckSince > OPENING.waitHintAfter);
      if (now - lastData > OPENING.quietLimit || now - stuckSince > OPENING.stuckLimit) finish('timeout');
    }, 250);
    media.addEventListener('ended', ended); media.addEventListener('error', error);
    media.addEventListener('playing', playing); media.addEventListener('pause', pause);
    media.addEventListener('progress', arrived);
    media.addEventListener('seeked', paint); media.addEventListener('timeupdate', paint);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('hashchange', navigate); window.addEventListener('keydown', keys);
    // A tab opened in the background keeps the film for when the visitor comes to it.
    tick(); if (!document.hidden) play();
    return () => {
      active = false; clearInterval(watchdog); observer.disconnect();
      if (hasFrameCallback) media.cancelVideoFrameCallback(frame); else cancelAnimationFrame(frame);
      media.removeEventListener('ended', ended); media.removeEventListener('error', error);
      media.removeEventListener('playing', playing); media.removeEventListener('pause', pause);
      media.removeEventListener('progress', arrived);
      media.removeEventListener('seeked', paint); media.removeEventListener('timeupdate', paint);
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('hashchange', navigate); window.removeEventListener('keydown', keys);
    };
  }, [mode, source, hasVideo, finish, onTime, section, toggleVideo]);

  useEffect(() => {
    if (!soundBlocked && !playBlocked) return;
    const enable = event => {
      // The opening's own controls act for themselves; Escape and Tab don't count as asking for sound.
      if (event.target.closest?.('.opening-controls') || event.key === 'Escape' || event.key === 'Tab') return;
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      const media = video.current;
      setSoundBlocked(false); setPlayBlocked(false);
      if (!media) return;
      if (soundBlocked) {
        media.volume = 0; media.muted = false; setMuted(false);
        rampVolume(1, 400);
      }
      if (media.paused && !userPaused.current) media.play().catch(() => { if (modeRef.current === 'opening') finish('blocked'); });
    };
    window.addEventListener('click', enable, true); window.addEventListener('keydown', enable, true);
    return () => { window.removeEventListener('click', enable, true); window.removeEventListener('keydown', enable, true); };
  }, [soundBlocked, playBlocked, rampVolume, finish]);

  // While the film runs the page stays put, so a reflex scroll doesn't carry a first-time visitor
  // past it. Skipping stays one click away, and the button answers the attempt.
  useEffect(() => {
    if (mode !== 'opening' || siteVisible) return;
    let timer = 0;
    const nudge = event => {
      if (event.cancelable) event.preventDefault();
      setSkipNudged(true);
      clearTimeout(timer);
      timer = setTimeout(() => setSkipNudged(false), 1400);
    };
    // Pinch and ctrl-wheel are zoom, which belongs to the visitor.
    const wheel = event => { if (!event.ctrlKey) nudge(event); };
    const touch = event => { if (event.touches.length === 1) nudge(event); };
    const keys = event => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'End', 'Home'].includes(event.key)) nudge(event); };
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('touchmove', touch, { passive: false });
    window.addEventListener('keydown', keys);
    return () => {
      clearTimeout(timer); setSkipNudged(false);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('touchmove', touch);
      window.removeEventListener('keydown', keys);
    };
  }, [mode, siteVisible]);

  useEffect(() => {
    if (!soundHint) return;
    const timer = setTimeout(() => setSoundHint(false), 5500);
    return () => clearTimeout(timer);
  }, [soundHint]);
  useEffect(() => () => {
    clearTimeout(releaseTimer.current); cancelAnimationFrame(volumeFrame.current);
    video.current?.pause();
  }, []);

  return { video, mode, siteVisible, hasVideo, liveMounted, portrait, source, muted, videoPaused, soundHint, soundBlocked, playBlocked, waiting, skipNudged, reduced, finish, replay, toggleSound, toggleVideo };
}
