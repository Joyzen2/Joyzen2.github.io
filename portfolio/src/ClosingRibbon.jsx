import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ribbonLink } from './market-hero/hero-link.js';

// The licensed component lives in src/vendor, which is not in the public repo. Without that
// folder the glob is empty, this renders nothing and the footer keeps its own closing line.
const load = import.meta.glob('./vendor/interference-ribbons.tsx')['./vendor/interference-ribbons.tsx'];
const InterferenceRibbons = load ? lazy(load) : null;

// Silver on black, so `screen` blending leaves everything except the light untouched.
export const RIBBON = {
  colors: ['#7f8b9a', '#e8edf3'], backgroundColor: '#000000', mode: 'glow',
  lineWidth: .9, ribbonWidth: .095, amplitude: .09, waveLength: 1.4, angle: 28,
  twist: 2, curl: .25, depth: .65, stripes: 1, colorFlow: .02, glow: .16, intensity: .62,
  speed: .4, spin: .2, pulseStrength: .9,
};
// Pixel density and wires by tier: 0 full, 1 lighter; tier 2 drops the ribbon altogether.
const TIERS = [{ density: 1.25, wires: 48 }, { density: .9, wires: 32 }];
const quality = density => Math.min(1, density / Math.min(devicePixelRatio || 1, 2));
// Modest machines start with the light closing line instead of a second WebGL canvas.
const modest = () => (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || Boolean(navigator.connection?.saveData) || matchMedia('(prefers-reduced-motion: reduce)').matches;
// Development only: the preview pane throttles frames when hidden, which looks like a slow GPU.
const keepTier = import.meta.env.DEV && new URLSearchParams(location.search).has('keepribbon');

// Phones keep the lighter closing line: they have no open space beside the text for a ribbon.
function useWide() {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 901px)').matches);
  useEffect(() => {
    const list = matchMedia('(min-width: 901px)');
    const update = () => setWide(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return wide;
}

export default function ClosingRibbon() {
  const frame = useRef(null), layer = useRef(null), handle = useRef(null);
  const wide = useWide();
  const [near, setNear] = useState(false), [active, setActive] = useState(false);
  const [tier, setTier] = useState(() => (modest() ? 2 : 0));
  const enabled = Boolean(InterferenceRibbons) && wide && tier < 2;

  // Watch the real frame rate while the ribbon runs and step down if it can't keep up.
  useEffect(() => {
    if (!enabled || !active) return undefined;
    let raf, last, gaps = [];
    const frame = now => {
      raf = requestAnimationFrame(frame);
      // Gaps over 250 ms mean a hidden or throttled page, which says nothing about the GPU.
      if (last !== undefined && now - last < 250) gaps.push(now - last);
      last = now;
      if (gaps.length < 60) return;
      const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      gaps = [];
      if (mean > 30 && !keepTier) setTier(value => value + 1);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [enabled, active, tier]);

  // Load ahead of arrival, so the lines already have wires to land on.
  useEffect(() => {
    if (!enabled || near) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { rootMargin: '200% 0px' });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [enabled, near]);

  useEffect(() => {
    if (!enabled) return undefined;
    const contact = frame.current.closest('.contact');
    const heading = contact.querySelector('.closing-title');
    // The ribbon stays fixed on screen and is centred on its layer. Set the layer so its spine
    // crosses the open space right of the heading, as the page will finally stand, level with
    // the heading and clear of the text on the left.
    const place = () => {
      const box = contact.getBoundingClientRect(), mark = heading.getBoundingClientRect();
      const anchorY = innerHeight - box.height + mark.top + mark.height / 2 - box.top;
      const centerY = anchorY + innerWidth * .35 * Math.tan(RIBBON.angle * Math.PI / 180);
      const height = 2 * Math.max(centerY, innerHeight - centerY);
      layer.current.style.top = `${centerY - height / 2}px`;
      layer.current.style.height = `${height}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(contact);
    addEventListener('resize', place);
    // The text sits above the ribbon, so hand it the pointer for its hover and click light.
    const forward = event => layer.current?.firstElementChild?.dispatchEvent(new PointerEvent(event.type, { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType, button: event.button }));
    const kinds = ['pointermove', 'pointerleave', 'pointerdown'];
    kinds.forEach(kind => contact.addEventListener(kind, forward));
    ribbonLink.current = { handle, root: () => layer.current?.firstElementChild, layer: () => frame.current, params: RIBBON, setActive };
    return () => {
      observer.disconnect();
      removeEventListener('resize', place);
      kinds.forEach(kind => contact.removeEventListener(kind, forward));
      ribbonLink.current = null;
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={frame} className="closing-ribbon" aria-hidden="true">
    <div ref={layer} className="closing-ribbon-layer">
      {near && <Suspense fallback={null}><InterferenceRibbons ref={handle} {...RIBBON} wires={TIERS[tier].wires} quality={quality(TIERS[tier].density)} paused={!active} /></Suspense>}
    </div>
  </div>;
}
