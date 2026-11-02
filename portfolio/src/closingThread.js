import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { heroApi, ribbonLink } from './market-hero/hero-link.js';

// The surface never spreads out fully here: it first shows as a net already this far gathered,
// opens to WIDEST as it leaves 05's line, then closes into the footer's line.
const NET = .74;
const WIDEST = .69;
// However fast the wheel turns, the story plays at most this share of itself per second.
const MAX_PACE = .32;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// A layout box without the reveal offset GSAP may still be animating on the element.
function settledBox(element) {
  const box = element.getBoundingClientRect();
  const y = Number(gsap.getProperty(element, 'y')) || 0;
  return { left: box.left, right: box.right, top: box.top - y, bottom: box.bottom - y };
}

/**
 * The page ends where its story ends. The opening's surface returns under 05's rising line and
 * its lines start to land on that line from the left, fanning out towards the page's edge. As
 * the footer arrives they leave for the ribbon's wires (see ClosingRibbon) and it takes over,
 * sparks still running along it; without a ribbon they become one line of their own that runs
 * off the page. Everything is measured from the live layout, so the lines stay attached while
 * scrolling. Narrow screens have no rising line, and go straight to the footer's line.
 */
export default function closingThread({ scene, contact, wide, onChange }) {
  const heading = contact.querySelector('.closing-title');
  const links = contact.querySelector('.contact-links');
  const curve = wide ? document.querySelector('.journey-curve') : null;
  const state = { gather: NET, onLine: curve ? 1 : 0, handover: 0, pulse: -1 };
  let sent = '';
  let sentGather = 0;
  let ribbonMix = 0;
  let pulsing;
  let shown = 0;
  let pace = 0;
  let glideY = window.scrollY;

  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  timeline.fromTo(scene, { '--scene-back': 0 }, { '--scene-back': 1, duration: .18 }, 0);
  if (curve) timeline.fromTo(state, { onLine: 1 }, { onLine: 0, duration: .2 }, .46);
  timeline
    .fromTo(state, { gather: NET }, { gather: WIDEST, duration: .18 }, .46)
    .to(state, { gather: 1, duration: .22 }, .64)
    .fromTo(contact, { '--ribbon-in': 0 }, { '--ribbon-in': 1, duration: .16 }, .78)
    .fromTo(state, { handover: 0 }, { handover: 1, duration: .12 }, .88);
  const trigger = ScrollTrigger.create({ ...(curve ? { trigger: curve, start: 'top bottom' } : { trigger: contact, start: 'top bottom+=200' }), end: 'max', onUpdate: onChange, onToggle: onChange, onRefresh: onChange });

  // Scroll sets where the story should be, not how fast it gets there: it speeds up, cruises
  // and settles on its own, so a hard flick of the wheel reads the same as a slow scroll.
  function advance(deltaMs) {
    const dt = Math.min(deltaMs, 64) / 1000;
    const goal = trigger.progress;
    if (goal <= 0 && window.scrollY < trigger.start - window.innerHeight) {
      // Jumped far away ("back to top"): nothing on screen needs unwinding.
      shown = 0;
      pace = 0;
    } else {
      pace += (clamp((goal - shown) * 2.6, -MAX_PACE, MAX_PACE) - pace) * (1 - Math.exp(-dt * 6));
      shown = clamp(shown + pace * dt, 0, 1);
      if (Math.abs(goal - shown) < .0005 && Math.abs(pace) < .003) { shown = goal; pace = 0; }
    }
    if (shown !== timeline.progress()) timeline.progress(shown);
    glideY += (window.scrollY - glideY) * (1 - Math.exp(-dt * 10));
  }

  function sync(time, deltaMs) {
    advance(deltaMs);
    const link = ribbonLink.current;
    if (shown <= 0 && sentGather <= 0) { link?.setActive(false); return; }
    const canvas = scene.querySelector('.market-hero-canvas');
    const frame = canvas?.getBoundingClientRect();
    if (!heroApi.current || !frame?.width) return;
    const clip = (x, y) => [((x - frame.left) / frame.width) * 2 - 1, 1 - ((y - frame.top) / frame.height) * 2];
    // The footer's lines are placed where the page will finally put them and stay there, so
    // nothing here is dragged along by the scroll; the text simply rises to meet them.
    const box = contact.getBoundingClientRect();
    const settle = window.innerHeight - box.height - box.top;
    const text = settledBox(heading), below = settledBox(links);
    const gap = below.top - text.bottom;
    const start = [-24, text.bottom + settle + gap / 2];
    // Past the heading the line lifts and runs off the page to the right.
    const end = [box.right + 24, (text.top + text.bottom) / 2 + settle];
    const patch = {
      thread: [...clip(...start), ...clip(...end)],
      threadPx: [2 / frame.width, (2 / frame.height) * Math.min(1, gap / 55)],
      // Stay level beneath the heading; rise only past its right edge.
      threadRise: Math.min(.9, Math.max(0, (text.right + 16 - start[0]) / (end[0] - start[0]))),
      // The band opens up only where the heading has left room for it.
      threadBloom: Math.min(60, Math.max(0, (end[0] - text.right) * .11)),
      // Nothing shown yet means the hero may be on screen: leave its surface untouched.
      gather: shown > 0 ? state.gather : 0,
      pulse: state.pulse,
    };
    const live = link?.handle.current?.state();
    const root = live && link.root();
    // Ease over if the ribbon finishes loading while the lines are already gathering.
    ribbonMix = root ? Math.min(1, ribbonMix + .04) : Math.max(0, ribbonMix - .04);
    patch.lineFade = ribbonMix * state.handover;
    // Once only sparks remain on this canvas, half the frame rate is plenty.
    patch.fps = patch.lineFade >= 1 ? 30 : 0;
    patch.onJourney = state.onLine;
    if (curve) {
      // 05's line does move with the page: glide after it instead of jumping with each notch.
      const band = curve.getBoundingClientRect(), lag = window.scrollY - glideY;
      const [x, y] = clip(band.left, band.bottom + lag), [right, top] = clip(band.right, band.top + lag);
      patch.journey = [x, y, right - x, top - y];
    }
    if (root) {
      const box = root.getBoundingClientRect(), p = link.params, angle = p.angle * Math.PI / 180;
      const unit = box.height / 2;
      patch.ribbon = {
        on: ribbonMix,
        frame: [...clip(box.left + box.width / 2, box.top + unit), unit * 2 / frame.width, unit * 2 / frame.height],
        shape: [p.amplitude, 1.55 / p.waveLength, p.ribbonWidth, p.curl],
        turn: [p.twist, live.spin, live.clock, (Math.abs(Math.cos(angle)) * box.width / box.height + Math.abs(Math.sin(angle))) * 1.08],
        angle: [Math.cos(angle), Math.sin(angle)],
      };
    } else patch.ribbon = { on: ribbonMix };
    link?.setActive(shown > .62);
    // A full-page blend layer is not free: keep it out of rendering until it is needed.
    const layer = link?.layer();
    if (layer) layer.style.visibility = shown > .77 ? 'visible' : 'hidden';
    const key = JSON.stringify(patch);
    if (key === sent) return;
    sent = key;
    sentGather = patch.gather;
    heroApi.current.setView(patch);
  }
  gsap.ticker.add(sync);

  // Copying the address sends a signal down the line. The ribbon has its own, through the
  // pointer events ClosingRibbon forwards to it.
  function onClick(event) {
    if (!event.target.closest('.copy-email') || state.gather < .98 || ribbonMix > 0 || pulsing?.isActive()) return;
    pulsing = gsap.fromTo(state, { pulse: 0 }, { pulse: 1.04, duration: 1.6, ease: 'power1.in', onComplete: () => { state.pulse = -1; } });
  }
  contact.addEventListener('click', onClick);

  return {
    trigger,
    cleanup() {
      gsap.ticker.remove(sync);
      pulsing?.kill();
      contact.removeEventListener('click', onClick);
      heroApi.current?.setView({ gather: 0, pulse: -1, lineFade: 0, onJourney: 0, fps: 0, ribbon: { on: 0 } });
    },
  };
}
