# Portfolio motion · 2026-10-25

## Goal and scope

User authorized an expressive creative-portfolio motion pass, a new work-experience/about module, and replacing the ID photo with the supplied Suzhou lifestyle photograph. Keep the silver-particle opening and real project facts. Existing Vite + React stack; add GSAP + ScrollTrigger, no 3D framework or wheel hijack.

## Static design

Continuous charcoal/ink background, silver and cool-blue text. Large English section titles with smaller Chinese explanations. About combines a full-height lifestyle image, personal facts, verified research counts and a two-entry internship timeline. Other sections retain their real content and varied project proportions.

## Choreography

- Opening: full-screen dark curtain scales upward1.3s, particle scene settles from1.14 to1 over2.2s. Two headline lines rise out of masks, compress vertically and return to their natural proportions over1.35s with0.18s stagger. Header, description, buttons and research directions follow in overlapping beats. Entire opening about2.93s; links remain live; deep-link arrivals skip it.
- Sections: English headings enter from below their masks with substantial displacement and slight rotation; Chinese subtitles follow. Profile/photo, project panels, note rows and award groups use distinct directions and0.11–0.23s stagger. Typical section reveal1.3–1.7s, once per section.
- Image: lifestyle photograph reveals horizontally, settles its scale, and receives a small desktop-only scroll parallax on a separate wrapper. No deformation of research chart data.
- Timeline: connecting line draws before the two internship entries arrive.
- Hover/focus: button labels roll to alternate wording while arrows move diagonally.0.6s exponential ease; touch keeps the original visible label and direct activation.

## Constraints

Use power4.out / power3.out and power4.inOut. No elastic or bounce. Native scrolling. One GSAP context and matchMedia scope with cleanup under React StrictMode. Avoid CSS transform transitions on GSAP-owned elements. Reserve image dimensions and refresh ScrollTrigger after fonts/images settle. Reduced motion returns every element to the static layout, disables parallax/opening and uses the existing video poster. No permanent will-change promotion.

## Acceptance

- Native build succeeds.
- Verify opening at intermediate and end states; no curtain or masked text remains stuck.
- Drive at least one real scroll gesture and verify section-heading/card intermediate transforms.
- Check lifestyle photo, timeline, keyboard/hover, mobile fit and reduced-motion visibility.
- Do not claim a measured FPS target without collecting timing evidence.

## Verification result

Native build, real-wheel heading transition, opening completion, hover label replacement, keyboard focus, responsive overflow sweep and reduced-motion restoration passed. Independent visual review: ship for local delivery. The browser automation rAF clock produced approximately1-second intervals even while idle; this timing sample does not establish real user FPS, so no60FPS certification is claimed. Effects are bounded to GSAP transforms/clip-path and one desktop image-parallax wrapper; video retains offscreen/reduced-motion control.


### Contact · DitherVeil
The closing section reuses the approved silver-particles poster with React Bits DitherVeil (Floyd diffusion). Footer-level passive pointer events drive reveal trails and click rings without intercepting links or scrolling. Black/silver palette; rendering caps at 1.6M pixels and DPR 1.5. Rendering pauses offscreen and on hidden documents; reduced motion uses a static dithered frame. WebGL2 failure retains a CSS poster fallback.

### Experience journey entrance
Local GSAP matchMedia lifecycle supports the lazy-mounted experience section. First entry at top 80% reveals heading, draws the timeline, then reveals six cards with 120ms stagger and 1.25s power4 easing. Animate wrapper only; hover lift and rotor flip remain independent. Reduced motion and cleanup restore all content directly.
