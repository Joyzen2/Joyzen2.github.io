// Fixed-seed synthetic OHLC (a visual model, not a quote feed) and the particle
// field derived from it. Every particle is born on a candle and owns exactly one
// slot on the final surface, so the surface is rebuilt from the chart itself.

export const MARKET_COLORS = { background: '#020407', up: '#EF535B', down: '#36C785', silver: '#dbe4ed' };

export const SEED = 20261028;
export const MARKET_SEED = 321718;
export const CANDLE_COUNT = 54;
export const PARTICLES_PER_CANDLE = 24;
export const PARTICLE_SIZE = 2.35;
export const LAYOUT = { spacing: 66 / (64 - 1), bodyWidth: 0.42, wickWidth: 0.045, chartHeight: 11 * 1.35, minBody: 0.03, gridLevels: 5 };
export const KIND = { body: 0, wick: 1, grid: 2, ma: 3 };
export const SURFACE = { xMin: 0, xMax: 66, zNear: 7, zFar: -17.42, baseY: 0.2, waveAmp: 1.5 };
export const QUALITY = {
  low: { label: '低', lines: 32, columns: 96, dust: 30, dpr: 1.25 },
  medium: { label: '中', lines: 54, columns: 126, dust: 45, dpr: 1.5 },
  high: { label: '高', lines: 64, columns: 160, dust: 60, dpr: 1.75 },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function v4Random(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

/** Exact V4 additive OHLC model. Aggregate its 88 bars to preserve the whole price
 * silhouette with fewer visible candles, rather than inventing another rally. */
export function makeV4Candles(count = CANDLE_COUNT, seed = MARKET_SEED) {
  const rand = v4Random(seed);
  const sourceCount = Math.max(88, count);
  const source = [];
  let price = 100;
  for (let i = 0; i < sourceCount; i++) {
    const open = price + (rand() - 0.5) * 0.13;
    const regime = i > 23 && i < 39 ? 1.7 : i > 60 && i < 74 ? 1.4 : 1;
    const close = open + (rand() + rand() + rand() - 1.48) * 1.55 * regime + Math.sin(i * 0.13) * 0.22;
    const high = Math.max(open, close) + (0.15 + rand() * 0.88) * regime;
    const low = Math.min(open, close) - (0.15 + rand() * 0.88) * regime;
    source.push({ open, close, high, low });
    price = close;
  }
  return Array.from({ length: count }, (_, i) => {
    const group = source.slice(Math.floor(i * sourceCount / count), Math.floor((i + 1) * sourceCount / count));
    return { open: group[0].open, close: group.at(-1).close,
      high: Math.max(...group.map(c => c.high)), low: Math.min(...group.map(c => c.low)) };
  });
}

/** Approved A3 sample: shorten ten long shadows, remove fourteen remaining long
 * shadows, then amplify prices around the reference centre by 35%. */
export function makeA3Candles(count = CANDLE_COUNT, seed = MARKET_SEED) {
  const baseline = makeV4Candles(count, seed);
  const shadowLength = bar => bar.high - Math.max(bar.open, bar.close) + Math.min(bar.open, bar.close) - bar.low;
  const longest = bars => bars.map((bar, i) => ({ i, length: shadowLength(bar) })).sort((a, b) => b.length - a.length);
  const shortenedIndices = new Set(longest(baseline).slice(0, 10).map(item => item.i));
  const shortened = baseline.map((bar, i) => {
    if (!shortenedIndices.has(i)) return { ...bar };
    const top = Math.max(bar.open, bar.close), bottom = Math.min(bar.open, bar.close);
    return { ...bar, high: top + (bar.high - top) * 0.55, low: bottom - (bottom - bar.low) * 0.55 };
  });
  const removed = new Set(longest(shortened).slice(0, 14).map(item => item.i));
  const center = (Math.max(...baseline.map(b => b.high)) + Math.min(...baseline.map(b => b.low))) / 2;
  return shortened.map((bar, i) => {
    const b = { ...bar };
    if (removed.has(i)) { b.high = Math.max(b.open, b.close); b.low = Math.min(b.open, b.close); }
    return Object.fromEntries(Object.entries(b).map(([key, value]) => [key, center + (value - center) * 1.35]));
  });
}

/** Approved A3 price silhouette, including the eight extra wick removals
 * beyond the original sample's six (fourteen wickless candles in total). */
export function makeCandles(count = CANDLE_COUNT, seed = MARKET_SEED) {
  return makeA3Candles(count, seed);
}

/** World layout: time runs along +x, price along +y, candles are centred on z = 0. */
export function chartLayout(candles) {
  // Use the sample's original price scale: normalising the new extrema would
  // otherwise undo A3's approved +35% amplitude.
  const reference = makeV4Candles(candles.length);
  const min = Math.min(...reference.map(c => c.low));
  const max = Math.max(...reference.map(c => c.high));
  const center = (min + max) / 2;
  const scale = 11 / (max - min);
  const y = value => LAYOUT.chartHeight / 2 + (value - center) * scale;
  return candles.map((c, i) => {
    const top = Math.max(y(c.open), y(c.close));
    const bottom = Math.min(y(c.open), y(c.close));
    const body = Math.max(top - bottom, LAYOUT.minBody);
    const mid = (top + bottom) / 2;
    return { x: i * LAYOUT.spacing, up: c.close >= c.open, bodyBottom: mid - body / 2, bodyTop: mid + body / 2, low: Math.min(y(c.low), mid - body / 2), high: Math.max(y(c.high), mid + body / 2), close: y(c.close) };
  });
}

function movingAverage(values, window) {
  const out = new Float64Array(values.length);
  let sum = 0;
  values.forEach((value, i) => {
    sum += value;
    if (i >= window) sum -= values[i - window];
    out[i] = sum / Math.min(i + 1, window);
  });
  return out;
}

/** The chart stays a flat 2-D candlestick drawing in the z = 0 plane; tiny z lifts keep layers apart. */
export function chartPieces(chart, { grid = false } = {}) {
  const { bodyWidth, wickWidth, chartHeight, gridLevels } = LAYOUT;
  const pieces = [];
  const left = chart[0].x - 1.4;
  const right = chart[chart.length - 1].x + 1.4;
  if (grid) {
  for (let k = 1; k <= gridLevels; k++) {
    const y = (k / (gridLevels + 1)) * chartHeight;
    pieces.push({ kind: KIND.grid, a: [left, y], b: [right, y], width: 0.02, z: 0, tone: 2 });
  }
  for (let i = 12; i < chart.length; i += 24) pieces.push({ kind: KIND.grid, a: [chart[i].x, -0.3], b: [chart[i].x, chartHeight + 0.3], width: 0.02, z: 0, tone: 2 });
  }
  const ma = movingAverage(chart.map(c => c.close), 9);
  pieces.push({ kind: KIND.ma, a: [chart[0].x - bodyWidth / 2, ma[0]], b: [chart[0].x, ma[0]], width: 0.04, z: 0.004, tone: 2 });
  for (let i = 1; i < chart.length; i++) pieces.push({ kind: KIND.ma, a: [chart[i - 1].x, ma[i - 1]], b: [chart[i].x, ma[i]], width: 0.04, z: 0.004, tone: 2 });
  for (const c of chart) pieces.push({ kind: KIND.wick, a: [c.x, c.low], b: [c.x, c.high], width: wickWidth, z: 0.008, tone: c.up ? 1 : 0 });
  for (const c of chart) pieces.push({ kind: KIND.body, a: [c.x, c.bodyBottom], b: [c.x, c.bodyTop], width: bodyWidth, z: 0.012, tone: c.up ? 1 : 0 });
  return pieces;
}

function frameOf(piece) {
  const dx = piece.b[0] - piece.a[0];
  const dy = piece.b[1] - piece.a[1];
  const length = Math.hypot(dx, dy) || 1e-6;
  const t = [dx / length, dy / length];
  return { length, t, n: [-t[1], t[0]] };
}

/** One merged flat mesh (grid, moving average, wicks, bodies): a single draw call. */
export function chartMesh(pieces) {
  const vertices = pieces.length * 4;
  const position = new Float32Array(vertices * 3);
  const local = new Float32Array(vertices * 2);
  const size = new Float32Array(vertices * 2);
  const tone = new Float32Array(vertices);
  const kind = new Float32Array(vertices);
  const index = new Uint32Array(pieces.length * 6);
  pieces.forEach((piece, p) => {
    const { length, t, n } = frameOf(piece);
    [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(([across, along], c) => {
      const v = p * 4 + c;
      const s = along + 0.5;
      position[v * 3] = piece.a[0] + t[0] * s * length + n[0] * across * piece.width;
      position[v * 3 + 1] = piece.a[1] + t[1] * s * length + n[1] * across * piece.width;
      position[v * 3 + 2] = piece.z;
      local[v * 2] = across;
      local[v * 2 + 1] = along;
      size[v * 2] = piece.width;
      size[v * 2 + 1] = length;
      tone[v] = piece.tone;
      kind[v] = piece.kind;
    });
    index.set([p * 4, p * 4 + 1, p * 4 + 2, p * 4, p * 4 + 2, p * 4 + 3], p * 6);
  });
  return { position, local, size, tone, kind, index };
}

/** V4's exact wave, scaled into the existing Three.js world. Shared by the
 * particle targets, denser line topology and reduced-motion fallback. */
export function surfaceHeight(u, v, time = 0) {
  const wave = Math.sin(u * 13 + time * 0.17) * 0.65
    + Math.sin(u * 26 - time * 0.2) * 0.25
    + Math.sin(u * 10 + v * 5 + time * 0.16) * 0.12;
  return SURFACE.baseY + 3.3 * (SURFACE.waveAmp * wave + (v - 0.5) * 2.5);
}

/** V4's subtle grid is a persistent plane behind the market, not a fragment
 * source. It remains visible during flight and fades as the surface takes over. */
function backgroundGrid(chart) {
  const position = [], uv = [];
  const left = -4, right = 70;
  const center = chart.reduce((sum, c) => sum + c.close, 0) / chart.length;
  const bottom = center - 11.5, top = center + 11.5;
  const point = (x, y) => { position.push(x, y, -9.2); uv.push((x-left)/(right-left),(y-bottom)/(top-bottom)); };
  for (let j = 0; j <= 8; j++) { const y = bottom + (top-bottom)*j/8; point(left,y); point(right,y); }
  for (let i = 0; i <= 24; i++) { const x = left + (right-left)*i/24; point(x,bottom); point(x,top); }
  return { position: new Float32Array(position), uv: new Float32Array(uv) };
}

export function surfaceRest(chart, lines, columns) {
  const rest = new Float32Array(lines * columns * 3);
  const slot = new Float32Array(lines * columns * 2);
  for (let j = 0; j < lines; j++) for (let i = 0; i < columns; i++) {
    const u = i / Math.max(1, columns - 1), v = j / Math.max(1, lines - 1), k = j * columns + i;
    rest.set([SURFACE.xMin + u * (SURFACE.xMax - SURFACE.xMin), surfaceHeight(u, v), SURFACE.zNear + v * (SURFACE.zFar - SURFACE.zNear)], k * 3);
    slot.set([u, v], k * 2);
  }
  return { rest, slot };
}

function lineIndices(lines, columns) {
  const segments = new Uint32Array(lines * (columns - 1) * 2);
  let k = 0;
  for (let j = 0; j < lines; j++) for (let i = 0; i < columns - 1; i++) {
    segments[k++] = j * columns + i; segments[k++] = j * columns + i + 1;
  }
  return segments;
}

// Surface density is approved at the low setting, independently of device.
export function buildField(options = {}) {
  const quality = QUALITY.low;
  const chart = chartLayout(options?.candles ?? makeCandles());
  const rows = PARTICLES_PER_CANDLE, columns = chart.length, count = rows * columns;
  const rand = v4Random(SEED);
  const origin = new Float32Array(count * 3), normal = new Float32Array(count * 3);
  const tone = new Float32Array(count), seeds = new Float32Array(count * 4);
  const flightOffset = new Float32Array(count * 3), originalColor = new Float32Array(count * 3), randomPhase = new Float32Array(count);
  const color = hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
  const up = color(MARKET_COLORS.up), down = color(MARKET_COLORS.down);
  // Direct, stable mapping: candle i / fragment j → surface u=i/(N-1), v=j/23.
  // Five wick samples plus nineteen body samples, exactly as in V4. Width samples
  // stay within the existing candle geometry. No random nearest-slot assignment.
  for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
    const c = chart[i], k = j * columns + i, wick = j < 5;
    const fraction = wick ? (j + 0.5) / 5 : (j - 5 + rand()) / 19;
    const y = wick ? c.low + (c.high - c.low) * fraction : c.bodyBottom + (c.bodyTop - c.bodyBottom) * fraction;
    origin.set([c.x + (rand() - 0.5) * (wick ? LAYOUT.wickWidth : LAYOUT.bodyWidth), y, wick ? 0.008 : 0.012], k * 3);
    tone[k] = c.up ? 1 : 0;
    originalColor.set(c.up ? up : down, k * 3);
    randomPhase[k] = rand() * Math.PI * 2;
    // Same drift/depth/spin proportions as V4; no global directional shove.
    flightOffset.set([(rand() - 0.5) * 2 * 1.1 * 3.3, (rand() - 0.5) * 2 * 0.8 * 3.3, (rand() - 0.5) * 2.8 * 3.3], k * 3);
    normal.set([0, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5], k * 3);
    for (let d = 0; d < 4; d++) seeds[k * 4 + d] = rand();
  }
  // Persistent local nebulae: eight adjacent candles per group. Each particle
  // keeps its own origin/target; only the free-flight orbit is grouped.
  const clusterCount = Math.ceil(columns / 8);
  const centers = Array.from({ length: clusterCount }, () => [0, 0, 0]);
  const members = new Uint32Array(clusterCount);
  for (let k = 0; k < count; k++) {
    const group = Math.floor((k % columns) / 8);
    for (let d = 0; d < 3; d++) centers[group][d] += origin[k * 3 + d];
    members[group]++;
  }
  centers.forEach((center, group) => center.forEach((value, d) => { center[d] = value / members[group]; }));
  const clusterCenter = new Float32Array(count * 3);
  const clusterSpin = new Float32Array(count * 4);
  for (let k = 0; k < count; k++) {
    const group = Math.floor((k % columns) / 8), phase = group * 2.399963229728653;
    const axis = [Math.sin(phase) * 0.55, 0.5 + 0.25 * Math.cos(phase), 0.6 + 0.2 * Math.sin(phase * 0.7)];
    const length = Math.hypot(...axis);
    clusterCenter.set(centers[group], k * 3);
    clusterSpin.set([...axis.map(value => value / length), (group % 2 ? -1 : 1) * (0.75 + (group % 3) * 0.18)], k * 4);
  }
  const { rest, slot } = surfaceRest(chart, rows, columns);
  // Line tessellation is independent of particle density. It samples exactly the
  // same analytical surface; it never spawns another cloud of flying particles.
  const surfaceLines = { ...surfaceRest(chart, quality.lines, quality.columns), segments: lineIndices(quality.lines, quality.columns) };
  const dustPosition = new Float32Array(quality.dust * 3), dustSeed = new Float32Array(quality.dust);
  for (let i = 0; i < quality.dust; i++) {
    dustPosition.set([-10 + rand() * 86, -3 + rand() * 24, -30 + rand() * 50], i * 3); dustSeed[i] = rand();
  }
  return { quality, chart, mesh: chartMesh(chartPieces(chart)),
    particles: { count, lines: rows, columns, origin, normal, tone, seeds, rest, slot, flightOffset, originalColor, randomPhase, clusterCount, clusterCenter, clusterSpin },
    backgroundGrid: backgroundGrid(chart), cloudCenter: [chart.at(-1).x / 2, chart.reduce((sum, c) => sum + c.close, 0) / chart.length, 0],
    surfaceLines, dust: { position: dustPosition, seed: dustSeed }, sweep: [0, chart.at(-1).x] };
}
