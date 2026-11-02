import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import closingThread from './closingThread.js';

gsap.registerPlugin(ScrollTrigger);

export default function usePortfolioMotion(root) {
  const opened = useRef(false);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    const sections = [];
    let opening;
    let alive = true;
    const context = gsap.context(() => {
      media.add({ desktop: '(min-width: 901px)', mobile: '(max-width: 900px)', reduced: '(prefers-reduced-motion: reduce)' }, (match) => {
        const { desktop, reduced } = match.conditions;
        sections.length = 0;
        opening = undefined;
        element.dataset.motion = reduced ? 'reduced' : 'full';
        if (reduced) return;
        const hero = element.querySelector('.particle-hero');
        const curtain = element.querySelector('.opening-curtain');
        const deepLink = location.hash && location.hash !== '#top';
        if (curtain && !opened.current && !deepLink && scrollY < hero.offsetHeight * .3) {
          opening = gsap.timeline({ defaults: { ease: 'power4.out' }, onComplete: () => { opened.current = true; } });
          // HeroBackground owns the narrative clock and HTML title opacity.
          // Keep identity, navigation, and actions available from the first frame.
          opening.set(curtain, { display: 'none' });
        }

        element.querySelectorAll('[data-motion-section]').forEach((section) => {
          const title = section.querySelectorAll('[data-motion-title]');
          const subtitle = section.querySelectorAll('[data-motion-subtitle]');
          const timeline = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 82%', once: true }, defaults: { ease: 'power4.out' } });
          sections.push(timeline);
          if (title.length) timeline.fromTo(title, { xPercent: -8, yPercent: 116, rotation: 3, scaleY: 1.18 }, { xPercent: 0, yPercent: 0, rotation: 0, scaleY: 1, duration: 1.4, stagger: .12, clearProps: 'transform' }, 0);
          if (subtitle.length) timeline.fromTo(subtitle, { y: 24, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: .95, clearProps: 'transform,clipPath' }, .25);

          const cards = section.querySelectorAll('.project-featured, .note-row, .award');
          if (cards.length) timeline.fromTo(cards, { y: 85, rotation: 1.4, clipPath: 'inset(8% 0 24% 0)' }, { y: 0, rotation: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.4, stagger: .17, clearProps: 'transform,clipPath' }, .4);
          const pair = section.querySelector('.project-pair');
          if (pair) {
            const projectPair = gsap.timeline({ scrollTrigger: { trigger: pair, start: 'top 88%', once: true } });
            sections.push(projectPair);
            projectPair.fromTo(pair.children, { y: 85, rotation: 1.4, clipPath: 'inset(8% 0 24% 0)' }, { y: 0, rotation: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.4, stagger: .2, ease: 'power4.out', clearProps: 'transform,clipPath' });
          }
          if (section.id === 'contact') timeline.fromTo('.contact-links', { y: 55, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.25, stagger: .15, clearProps: 'transform,clipPath' }, .45);
        });

        // 01→02 share one surface: it stays behind while the opening's copy leaves and 02's
        // heading rises over it, then recedes behind the research panels and stops drawing.
        const scene = hero?.querySelector('.particle-scene');
        const research = element.querySelector('#research');
        const contact = element.querySelector('#contact');
        let endThread;
        if (scene && research && contact) {
          // Between the two screens that show it, the scene is parked and stops drawing.
          let leaving, closing;
          const syncPark = () => { if (leaving && closing) scene.classList.toggle('is-parked', leaving.progress >= 1 && closing.progress <= 0); };
          const handoff = gsap.timeline({ scrollTrigger: { trigger: research, start: 'top bottom', end: 'center top', scrub: .6, onUpdate: syncPark, onToggle: syncPark, onRefresh: syncPark } });
          handoff.fromTo(scene, { '--scene-out': 1 }, { '--scene-out': 0, ease: 'power1.in', duration: 1 }, 0);
          // The hero's shade and its bottom fold darken its own lower edge; once that edge moves,
          // they would read as a seam across the surface, so they clear first.
          const shade = hero.querySelector('.particle-shade');
          if (shade) handoff.to(shade, { opacity: 0, ease: 'none', duration: .2 }, 0);
          handoff.to(hero, { '--hero-fold': 0, ease: 'none', duration: .2 }, 0);
          const copy = hero.querySelector('.home-copy');
          if (copy) handoff.to(copy, { opacity: 0, yPercent: -14, ease: 'none', duration: .45 }, 0);
          leaving = handoff.scrollTrigger;
          const thread = closingThread({ scene, contact, wide: desktop, onChange: syncPark });
          closing = thread.trigger;
          endThread = thread.cleanup;
          syncPark();
        }

        // Screens 02–05 enter the same way: label, title, text, then their own content.
        element.querySelectorAll('[data-narrative]').forEach((section) => {
          const timeline = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 78%', once: true }, defaults: { ease: 'power3.out' } });
          sections.push(timeline);
          const index = section.querySelector('.narrative-index');
          const title = section.querySelectorAll('[data-reveal-title]');
          const lines = section.querySelectorAll('[data-reveal]:not(.narrative-index)');
          if (index) timeline.fromTo(index, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: .9, clearProps: 'transform,opacity,visibility' }, 0);
          if (title.length) timeline.fromTo(title, { yPercent: 105 }, { yPercent: 0, duration: 1.15, clearProps: 'transform' }, .08);
          if (lines.length) timeline.fromTo(lines, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1, stagger: .1, clearProps: 'transform,opacity,visibility' }, .3);
          // Research panels open from a thin band, the way the surface lines settle.
          const panels = section.querySelectorAll('.research-accordion .ag-panel, [data-reveal-panel]');
          if (panels.length) timeline.fromTo(panels, { clipPath: 'inset(46% 0% 46% 0% round 14px)', autoAlpha: 0 }, { clipPath: 'inset(0% 0% 0% 0% round 14px)', autoAlpha: 1, duration: 1.25, stagger: .12, ease: 'power3.inOut', clearProps: 'clipPath,opacity,visibility' }, .35);
          const copy = section.querySelectorAll('.research-accordion .area-copy > *, .research-accordion .area-peek > *');
          if (copy.length) timeline.fromTo(copy, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .035, clearProps: 'transform,opacity,visibility' }, 1.05);
          const photo = section.querySelector('[data-reveal-photo]');
          if (photo) timeline.fromTo(photo, { clipPath: 'inset(0 0 100% 0)', y: 40 }, { clipPath: 'inset(0% 0 0% 0)', y: 0, duration: 1.4, ease: 'power3.inOut', clearProps: 'transform,clipPath' }, .2);
        });
        return () => endThread?.();


      }, element);
    }, element);

    const refresh = () => { if (alive) ScrollTrigger.refresh(); };
    document.fonts.ready.then(refresh);
    element.querySelectorAll('img').forEach((image) => image.decode().then(refresh).catch(() => {}));
    window.addEventListener('load', refresh, { once: true });
    window.addEventListener('portfolio:layout', refresh);
    const probe = { finishOpening: () => opening?.progress(1), openingTime: (time) => opening?.pause(time), finishSections: () => sections.forEach((t) => t.progress(1)), get opening() { return opening; }, sections };
    if (import.meta.env.DEV) window.__portfolioMotion = probe;
    return () => {
      alive = false;
      window.removeEventListener('load', refresh);
      window.removeEventListener('portfolio:layout', refresh);
      media.revert();
      context.revert();
      if (window.__portfolioMotion === probe) delete window.__portfolioMotion;
      delete element.dataset.motion;
    };
  }, [root]);
}
