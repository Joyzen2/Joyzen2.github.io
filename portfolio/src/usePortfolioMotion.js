import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
        if (!opened.current && !deepLink && scrollY < hero.offsetHeight * .3) {
          opening = gsap.timeline({ defaults: { ease: 'power4.out' }, onComplete: () => { opened.current = true; } });
          opening.fromTo(curtain, { display: 'flex', scaleY: 1 }, { scaleY: 0, transformOrigin: 'top', duration: 1.3, ease: 'power4.inOut' }, .1)
            .to('.opening-curtain > span', { y: -18, opacity: 0, duration: .28 }, .12)
            .fromTo('.particle-scene', { scale: 1.14 }, { scale: 1, duration: 2.2 }, .2)
            .fromTo('.hero-title-line', { yPercent: 125, scaleY: 1.3, rotation: 3 }, { yPercent: 0, scaleY: 1, rotation: 0, duration: 1.35, stagger: .18, clearProps: 'transform' }, .65)
            .fromTo('.particle-header', { y: -80, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.1, clearProps: 'transform,clipPath' }, .65)
            .fromTo(['.particle-role', '.particle-description'], { y: 28, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1, stagger: .12, clearProps: 'transform,clipPath' }, 1.1)
            .fromTo('.particle-actions > a', { y: 42, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1, stagger: .12, clearProps: 'transform,clipPath' }, 1.4)
            .fromTo('.particle-field', { y: 35, skewY: 4, clipPath: 'inset(0 0 100% 0)' }, { y: 0, skewY: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.05, stagger: .14, clearProps: 'transform,clipPath' }, 1.6)
            .set(curtain, { display: 'none' }, 1.45);
        }

        element.querySelectorAll('[data-motion-section]').forEach((section) => {
          const title = section.querySelectorAll('[data-motion-title]');
          const subtitle = section.querySelectorAll('[data-motion-subtitle]');
          const timeline = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 82%', once: true }, defaults: { ease: 'power4.out' } });
          sections.push(timeline);
          if (title.length) timeline.fromTo(title, { xPercent: -8, yPercent: 116, rotation: 3, scaleY: 1.18 }, { xPercent: 0, yPercent: 0, rotation: 0, scaleY: 1, duration: 1.4, stagger: .12, clearProps: 'transform' }, 0);
          if (subtitle.length) timeline.fromTo(subtitle, { y: 24, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: .95, clearProps: 'transform,clipPath' }, .25);

          if (section.id === 'about') {
            const profile = gsap.timeline({ scrollTrigger: { trigger: '.profile-layout', start: 'top 87%', once: true }, defaults: { ease: 'power4.out' } });
            sections.push(profile);
            profile.fromTo('.life-frame', { clipPath: 'inset(0 100% 0 0)', y: 55 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.5, clearProps: 'transform,clipPath' }, 0)
              .fromTo('.profile-info > *', { y: 40, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.1, stagger: .11, clearProps: 'transform,clipPath' }, .5);
          }
          const cards = section.querySelectorAll('.project-featured, .note-row, .award');
          if (cards.length) timeline.fromTo(cards, { y: 85, rotation: 1.4, clipPath: 'inset(8% 0 24% 0)' }, { y: 0, rotation: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.4, stagger: .17, clearProps: 'transform,clipPath' }, .4);
          const pair = section.querySelector('.project-pair');
          if (pair) {
            const projectPair = gsap.timeline({ scrollTrigger: { trigger: pair, start: 'top 88%', once: true } });
            sections.push(projectPair);
            projectPair.fromTo(pair.children, { y: 85, rotation: 1.4, clipPath: 'inset(8% 0 24% 0)' }, { y: 0, rotation: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.4, stagger: .2, ease: 'power4.out', clearProps: 'transform,clipPath' });
          }
          if (section.id === 'contact') timeline.fromTo('.contact-links, .contact-circle, .footer-bottom', { y: 55, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0% 0 0% 0)', duration: 1.25, stagger: .15, clearProps: 'transform,clipPath' }, .45);
        });


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
