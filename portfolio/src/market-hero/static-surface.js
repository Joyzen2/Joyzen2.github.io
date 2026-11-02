import { chartLayout, makeCandles, surfaceRest, surfaceHeight, QUALITY } from './market-data.js';
import { framedPose } from './camera-path.js';
import { DURATION } from './timeline.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * The resting surface drawn with Canvas 2D: used when WebGL is missing or motion is
 * reduced, so the page never loads the GPU module just to show a still image.
 */
export function drawStaticSurface(canvas, width, height, dpr = Math.min(devicePixelRatio || 1, 2)) {
  const lines = QUALITY.low.lines;
  const columns = QUALITY.low.columns;
  const { rest, slot } = surfaceRest(chartLayout(makeCandles()), lines, columns);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext('2d');
  if (!context) return false;
  const aspect = width / Math.max(1, height);
  const time = DURATION;
  const pose = framedPose(time, aspect);
  const forward = unit(sub(pose.tgt, pose.pos));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const focal = 1 / Math.tan((pose.fov * Math.PI) / 360);
  context.fillStyle = '#020407';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'lighter';
  context.lineWidth = Math.max(1, dpr * 0.75);
  for (let j = 0; j < lines; j++) {
    context.beginPath();
    let depth = 0;
    for (let c = 0; c < columns; c++) {
      const k = j * columns + c;
      const point = [rest[k * 3], surfaceHeight(slot[k * 2], slot[k * 2 + 1], time), rest[k * 3 + 2]];
      const d = sub(point, pose.pos);
      const z = dot(d, forward);
      depth += z / columns;
      const x = (0.5 + (dot(d, right) * focal) / (z * aspect) / 2) * canvas.width;
      const y = (0.5 - (dot(d, up) * focal) / z / 2) * canvas.height;
      if (c) context.lineTo(x, y); else context.moveTo(x, y);
    }
    const nearness = 1 - Math.min(1, Math.max(0, (depth - 14) / 54)) * 0.9;
    context.strokeStyle = `rgba(219, 228, 237, ${(0.5 * nearness * (1 - 0.5 * Math.max(0, (j / lines - 0.7) / 0.3))).toFixed(3)})`;
    context.stroke();
  }
  // Fade the sides into the background, as the GPU version does.
  context.globalCompositeOperation = 'destination-in';
  const fade = context.createLinearGradient(0, 0, canvas.width, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.12, '#000');
  fade.addColorStop(0.88, '#000');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = fade;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#020407';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return true;
}
