import { chartLayout, makeCandles } from './market-data.js';
import { cameraTime, MARKET_RALLY_END, MARKET_DURATION, DISSOLVE_END } from './timeline.js';

// Original later shots are retained verbatim; the opening uses its own local track.
// Continuous multi-shot camera: one spline through timed keys, no cuts.
// Close left-to-right price tracking → reverse and pull back to the whole chart →
// rejoin the original rise over the swarm and final surface shot.
const KEYS = [
  { t: 0, pos: [59.9, 10.8, 19], tgt: [29.9, 4.9, -7.8], fov: 35 },
  { t: 3, pos: [56.5, 10.6, 18.4], tgt: [26.5, 4.8, -8], fov: 35 },
  { t: 5, pos: [50.5, 11.4, 17.4], tgt: [21, 4.7, -8.5], fov: 35.5 },
  { t: 8, pos: [44, 15.5, 22], tgt: [26, 3.2, -10], fov: 38 },
  { t: 11, pos: [34, 11, 26], tgt: [33, 1.6, -10], fov: 40 },
  { t: 13.5, pos: [33, 9.6, 27], tgt: [33, 1.2, -10], fov: 40 },
];
const LAST = KEYS.length - 1;
const TIMES = KEYS.map(key => key.t);

/**
 * Clamped cubic spline per channel: velocity and acceleration stay continuous
 * through every key. The opening already drifts; the final shot comes to rest.
 */
function spline(values) {
  const n = values.length - 1;
  const h = TIMES.slice(1).map((t, i) => t - TIMES[i]);
  const slope = i => (values[i + 1] - values[i]) / h[i];
  const start = slope(0) * 0.5;
  const end = 0;
  const lower = new Float64Array(n + 1);
  const diag = new Float64Array(n + 1);
  const upper = new Float64Array(n + 1);
  const rhs = new Float64Array(n + 1);
  diag[0] = 2 * h[0]; upper[0] = h[0]; rhs[0] = 6 * (slope(0) - start);
  for (let i = 1; i < n; i++) { lower[i] = h[i - 1]; diag[i] = 2 * (h[i - 1] + h[i]); upper[i] = h[i]; rhs[i] = 6 * (slope(i) - slope(i - 1)); }
  lower[n] = h[n - 1]; diag[n] = 2 * h[n - 1]; rhs[n] = 6 * (end - slope(n - 1));
  for (let i = 1; i <= n; i++) { const w = lower[i] / diag[i - 1]; diag[i] -= w * upper[i - 1]; rhs[i] -= w * rhs[i - 1]; }
  const curvature = new Float64Array(n + 1);
  curvature[n] = rhs[n] / diag[n];
  for (let i = n - 1; i >= 0; i--) curvature[i] = (rhs[i] - upper[i] * curvature[i + 1]) / diag[i];
  return time => {
    let i = 0;
    while (i < n - 1 && time > TIMES[i + 1]) i++;
    const a = (TIMES[i + 1] - time) / h[i];
    const b = 1 - a;
    return a * values[i] + b * values[i + 1] + ((a ** 3 - a) * curvature[i] + (b ** 3 - b) * curvature[i + 1]) * h[i] ** 2 / 6;
  };
}
const CHANNELS = {
  pos: [0, 1, 2].map(d => spline(KEYS.map(key => key.pos[d]))),
  tgt: [0, 1, 2].map(d => spline(KEYS.map(key => key.tgt[d]))),
  fov: spline(KEYS.map(key => key.fov)),
};

// Follow the actual price height at the moving time cursor. Average nearby closes
// so the camera follows the trend without shaking on every individual wick.
const TRACK_CHART = chartLayout(makeCandles());
const TRACK_HEIGHT = TRACK_CHART.map((_, i) => {
  const neighbours = TRACK_CHART.slice(Math.max(0, i - 5), i + 6);
  return neighbours.reduce((sum, candle) => sum + candle.close, 0) / neighbours.length;
});
const easeShot = t => { const u = Math.max(0, Math.min(1, t)); return u * u * u * (u * (u * 6 - 15) + 10); };
function trackingHeight(x) {
  const index = x / (TRACK_CHART[1].x - TRACK_CHART[0].x);
  const i = Math.min(TRACK_HEIGHT.length - 2, Math.max(0, Math.floor(index)));
  const f = Math.max(0, Math.min(1, index - i));
  return TRACK_HEIGHT[i] + (TRACK_HEIGHT[i + 1] - TRACK_HEIGHT[i]) * f;
}

function openingPose(time, out) {
  // All three opening beats follow the reveal front; no wide shot or hold.
  const cursor = Math.max(0, Math.min(5, time)) / 5;
  const lastX = TRACK_CHART.at(-1).x;
  const travel = cursor * lastX;
  // Ease out of the initial tracking position without a hard stationary clamp.
  const x = travel - 1.2 * (1 - Math.exp(-travel / 1.2));
  const height = trackingHeight(x);
  const yaw = -30 * Math.PI / 180;
  const radius = Math.hypot(8, 2.8, 11.5) * 1.4;
  const closePos = [x + radius * Math.sin(yaw), height, radius * Math.cos(yaw)];
  const closeTarget = [x, height, 0];
  if (time <= 5) {
    for (let d = 0; d < 3; d++) {
      out.pos[d] = closePos[d];
      out.tgt[d] = closeTarget[d];
    }
    out.fov = 40;
  } else {
    // Rejoin the existing particle/camera choreography with zero blend velocity
    // and acceleration at both ends. All camera poses from 8s onward are unchanged.
    const rejoin = easeShot((time - 5) / 3);
    for (let d = 0; d < 3; d++) {
      out.pos[d] = closePos[d] + (out.pos[d] - closePos[d]) * rejoin;
      out.tgt[d] = closeTarget[d] + (out.tgt[d] - closeTarget[d]) * rejoin;
    }
    out.fov = 40 + (out.fov - 40) * rejoin;
  }
}

export function cameraPose(time, out = { pos: [0, 0, 0], tgt: [0, 0, 0], fov: 40 }) {
  time = cameraTime(time);
  const t = Math.min(Math.max(time, KEYS[0].t), KEYS[LAST].t);
  for (let d = 0; d < 3; d++) { out.pos[d] = CHANNELS.pos[d](t); out.tgt[d] = CHANNELS.tgt[d](t); }
  out.fov = CHANNELS.fov(t);
  if (time < 8) openingPose(Math.max(0, time), out);
  if (time > KEYS[LAST].t) {
    // A slow breathing drift keeps the resting shot alive without visible repetition.
    const d = time - KEYS[LAST].t;
    const ramp = Math.min(1, d / 5);
    out.pos[0] += Math.sin(d * 0.07) * 1.8 * ramp;
    out.pos[1] += Math.sin(d * 0.045 + 1.1) * 0.4 * ramp;
    out.tgt[0] += Math.sin(d * 0.07) * 0.9 * ramp;
  }
  return out;
}

/** Debug offsets: orbit around the target by yaw/pitch (degrees) and scale the distance. */
export function orbit(pose, yaw = 0, pitch = 0, dolly = 1) {
  if (!yaw && !pitch && dolly === 1) return pose;
  const [tx, ty, tz] = pose.tgt;
  let x = pose.pos[0] - tx;
  let y = pose.pos[1] - ty;
  let z = pose.pos[2] - tz;
  const radius = Math.hypot(x, y, z);
  let azimuth = Math.atan2(x, z) + (yaw * Math.PI) / 180;
  let elevation = Math.asin(y / radius) + (pitch * Math.PI) / 180;
  elevation = Math.max(-0.2, Math.min(1.45, elevation));
  const r = radius * dolly;
  x = r * Math.cos(elevation) * Math.sin(azimuth);
  y = r * Math.sin(elevation);
  z = r * Math.cos(elevation) * Math.cos(azimuth);
  pose.pos[0] = tx + x;
  pose.pos[1] = ty + y;
  pose.pos[2] = tz + z;
  return pose;
}

// Narrow screens widen the lens only a little and tilt up slightly; the sides are allowed
// to crop so the scene still fills a portrait screen instead of shrinking to a strip.
const DESIGN_ASPECT = 1.6;
export function framedPose(time, aspect, view = {}, out) {
  const deficit = Math.max(1, DESIGN_ASPECT / aspect);
  const pose = orbit(cameraPose(time, out), view.yaw, (view.pitch ?? 0) + 3 * Math.log(deficit), view.dolly ?? 1);
  pose.fov = (2 * Math.atan(Math.tan((pose.fov * Math.PI) / 360) * deficit ** 0.15) * 180) / Math.PI;
  // Ease the finishing candles toward 66% of the viewport, independent of fullscreen
  // width and debug orbit. Translate along camera-right, retaining yaw and distance.
  const composition = easeShot((time - MARKET_RALLY_END) / (MARKET_DURATION - MARKET_RALLY_END))
    * (1 - easeShot((time - DISSOLVE_END) / 3));
  const dx = pose.pos[0] - pose.tgt[0];
  const dz = pose.pos[2] - pose.tgt[2];
  const horizontal = Math.hypot(dx, dz);
  const distance = Math.hypot(dx, pose.pos[1] - pose.tgt[1], dz);
  const width = 2 * distance * Math.tan(pose.fov * Math.PI / 360) * aspect;
  const shift = -width * 0.16 * composition;
  if (horizontal > 1e-6) {
    const sx = shift * dz / horizontal;
    const sz = -shift * dx / horizontal;
    pose.pos[0] += sx; pose.tgt[0] += sx;
    pose.pos[2] += sz; pose.tgt[2] += sz;
  }

  return pose;
}
