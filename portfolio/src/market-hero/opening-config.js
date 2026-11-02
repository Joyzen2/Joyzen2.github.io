// The media is exported from the exact same scene/view, at 60 frames per second.
export const OPENING = Object.freeze({
  duration: 26,
  warmAt: 23.8,
  siteAt: 24.1,
  // How long the film may sit without a new frame: a hint after the first, and it gives way to
  // the homepage after no data at all for the second, or thin data for the third.
  waitHintAfter: 2500,
  quietLimit: 12000,
  stuckLimit: 30000,
  seenKey: 'jin.portfolio.opening.v1',
  soundKey: 'jin.portfolio.sound.v2',
  desktop: '/media/opening/market-desktop.mp4',
  portrait: '/media/opening/market-portrait.mp4',
  poster: '/media/opening/surface-desktop.jpg',
  portraitPoster: '/media/opening/surface-portrait.jpg',
});
export function readPreference(key) { try { return localStorage.getItem(key); } catch { return null; } }
export function writePreference(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing still gets a usable homepage. */ } }

// Heavy sections below the fold wait for this, so the opening video gets the connection first.
let settled = false;
const settleListeners = new Set();
export function markOpeningSettled() { settled = true; settleListeners.forEach(listener => listener()); settleListeners.clear(); }
export function whenOpeningSettled(listener) {
  if (settled) listener(); else settleListeners.add(listener);
  return () => settleListeners.delete(listener);
}
