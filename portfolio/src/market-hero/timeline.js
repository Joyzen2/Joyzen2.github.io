// A separate lead-in leaves the approved market/particle clock unchanged.
export const INTRO = Object.freeze({ duration: 3.8, marketStart: 2.6, hold: 0, approachEnd: 3.8, distance: 6.5, candles: 3 });
export const sceneTime = elapsed => Math.max(0, elapsed - INTRO.marketStart);

// Opening speed parameters, in seconds. The camera and candle reveal share this clock.
const OPENING_STRETCH = 1.12;
export const OPENING_PACE = Object.freeze({
  accelerateAt: 3.0 * OPENING_STRETCH,
  normalAt: 5.0 * OPENING_STRETCH + 0.5,
  end: 7.2 * OPENING_STRETCH + 0.5,
  transition: 0.35 * OPENING_STRETCH,
  openingSpeed: 0.65 / OPENING_STRETCH,
  beatInterval: 0.6 * OPENING_STRETCH,
  beatStrength: 0.3,
  normalSpeed: 0.65 / OPENING_STRETCH,
});
const LEGACY_MARKET_END = 6.4;
const rampArea = (time, start, duration) => {
  const x = Math.max(0, Math.min(1, (time - start) / duration));
  // Integral of smoothstep: the speed, rather than the position, eases.
  return duration * (x ** 3 - 0.5 * x ** 4) + Math.max(0, time - start - duration);
};
const fastArea = OPENING_PACE.normalAt - OPENING_PACE.accelerateAt - OPENING_PACE.transition;
const openingArea = OPENING_PACE.accelerateAt + OPENING_PACE.transition / 2;
// The final shot eases from normalSpeed to rest; its average speed is half.
const normalArea = (OPENING_PACE.end - OPENING_PACE.normalAt) / 2 + OPENING_PACE.transition / 2;
export const OPENING_FAST_SPEED = (LEGACY_MARKET_END
  - openingArea * OPENING_PACE.openingSpeed
  - normalArea * OPENING_PACE.normalSpeed) / fastArea;
export function openingTime(time) {
  const t = Math.max(0, Math.min(OPENING_PACE.end, time));
  const acceleration = rampArea(t, OPENING_PACE.accelerateAt, OPENING_PACE.transition);
  const deceleration = rampArea(t, OPENING_PACE.normalAt - OPENING_PACE.transition, OPENING_PACE.transition);
  // A restrained rhythmic drift, tapered to zero at both ends of the slow shot.
  // Its integral is zero over the shot, so later phase timings remain exact.
  const rhythmicDrift = (start, end) => {
    const local = Math.max(0, Math.min(end - start, t - start));
    const envelope = Math.sin(Math.PI * local / (end - start)) ** 2;
    const omega = 2 * Math.PI / OPENING_PACE.beatInterval;
    return OPENING_PACE.openingSpeed * OPENING_PACE.beatStrength / omega
      * Math.sin(omega * local) * envelope;
  };
  // Keep the opening pulse; the final shot slows monotonically with no new pulses.
  const beat = rhythmicDrift(0, OPENING_PACE.accelerateAt);
  const stop = rampArea(t, OPENING_PACE.normalAt, OPENING_PACE.end - OPENING_PACE.normalAt);
  return beat + t * OPENING_PACE.openingSpeed
    + (OPENING_FAST_SPEED - OPENING_PACE.openingSpeed) * acceleration
    + (OPENING_PACE.normalSpeed - OPENING_FAST_SPEED) * deceleration
    - OPENING_PACE.normalSpeed * stop;
}
export const MARKET_DURATION = OPENING_PACE.end;
export const MARKET_FIRST_END = OPENING_PACE.accelerateAt;
export const MARKET_RALLY_END = OPENING_PACE.normalAt;
const DISSOLVE_SWEEP = 2.0;
const DISSOLVE_JITTER = 0.9;
const DISSOLVE_GUARD = 0.05;
const EXTRA_PRE_FRACTURE_PAUSE = 0.3;
// releaseTime <= decoStart + sweep + jitter for every candle fragment. Resume
// only after that bound, including the same guard used to retire the chart mesh.
export const CAMERA_DISSOLVE_HOLD = DISSOLVE_SWEEP + DISSOLVE_JITTER + DISSOLVE_GUARD + EXTRA_PRE_FRACTURE_PAUSE;
export const DISSOLVE_END = MARKET_DURATION + CAMERA_DISSOLVE_HOLD;
export const FLIGHT_START = DISSOLVE_END;
export const FLIGHT_DURATION = 2.8;
export const CONVERGENCE_START = FLIGHT_START + FLIGHT_DURATION;
export const CONVERGENCE_DURATION = 3.0;
export const SURFACE_START = CONVERGENCE_START + CONVERGENCE_DURATION;
export const cameraTime = time => {
  if (time <= MARKET_DURATION) return Math.min(5, openingTime(time) / LEGACY_MARKET_END * 5);
  return 5 + Math.max(0, time - MARKET_DURATION - CAMERA_DISSOLVE_HOLD);
};
export const COPY_TIMING = Object.freeze({
  first: [SURFACE_START + 1.3, SURFACE_START + 2.1],
  second: [SURFACE_START + 2.9, SURFACE_START + 3.7],
  shine: [SURFACE_START + 3.8, SURFACE_START + 5.2],
});
export const DURATION = INTRO.marketStart + SURFACE_START + 6.4;

const SCENE_STAGES = [
  { id: 'market', label: '真实市场 · 慢节拍', start: 0, end: MARKET_FIRST_END },
  { id: 'rally', label: '行情加速', start: MARKET_FIRST_END, end: MARKET_RALLY_END },
  { id: 'push', label: '减速凝住', start: MARKET_RALLY_END, end: MARKET_DURATION },
  { id: 'dissolve', label: 'K 线分解', start: MARKET_DURATION, end: DISSOLVE_END },
  { id: 'flight', label: '粒子飞舞', start: FLIGHT_START, end: CONVERGENCE_START },
  { id: 'converge', label: '脱色汇聚', start: CONVERGENCE_START, end: SURFACE_START },
  { id: 'surface', label: '流动曲面', start: SURFACE_START, end: DURATION - INTRO.marketStart },
];

export const STAGES = [
  { id: 'intro', label: '远处靠近', start: 0, end: INTRO.marketStart },
  ...SCENE_STAGES.map(stage => ({ ...stage, start: stage.start + INTRO.marketStart, end: stage.end + INTRO.marketStart })),
];

export const TIMING = {
  revealStart: 0.0,
  revealSlowDur: LEGACY_MARKET_END / 2,
  revealFastDur: LEGACY_MARKET_END / 2,
  // Let the final candle read before cracks open across every candle together.
  decoStart: MARKET_DURATION + 0.5 + EXTRA_PRE_FRACTURE_PAUSE,
  fractureHold: 0.75,
  shardDuration: 0.55,
  morphDuration: 0.6,
  decoSweep: DISSOLVE_SWEEP,
  decoJitter: DISSOLVE_JITTER,
  decoEnd: DISSOLVE_END,
  // Both the opening reveal and dissolution follow increasing market time (+x).
  sweep: [0, 66],
  flyStart: FLIGHT_START,
  flyDur: FLIGHT_DURATION,
  convStart: CONVERGENCE_START,
  convSweep: 0.6,
  convDur: CONVERGENCE_DURATION,
  desatStart: CONVERGENCE_START - 0.6,
  desatDur: 3.6,
  titles: [COPY_TIMING.first, COPY_TIMING.second],
};

export function smooth(start, end, time) {
  const t = Math.min(1, Math.max(0, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function stageAt(time) {
  let stage = STAGES[0];
  for (const s of STAGES) if (time >= s.start) stage = s;
  return stage;
}

export function narrative(elapsed) {
  const time = sceneTime(elapsed);
  const shine = Math.max(0, Math.min(1, (time - COPY_TIMING.shine[0]) / (COPY_TIMING.shine[1] - COPY_TIMING.shine[0])));
  return { stage: stageAt(elapsed).id, first: smooth(...TIMING.titles[0], time), second: smooth(...TIMING.titles[1], time), shine, glint: Math.sin(Math.PI * shine) ** 2 };
}
