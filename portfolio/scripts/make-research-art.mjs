// Draws the three transparent line backgrounds for the research cards (02) into
// public/media/research. Decorative, not data: see ASSETS.md.
// Run: npm i --no-save world-atlas topojson-client d3-geo && node scripts/make-research-art.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { geoContains, geoGraticule, geoOrthographic, geoPath, geoRotation } from 'd3-geo';
import { feature } from 'topojson-client';
import { chartLayout, makeCandles, mulberry32, MARKET_COLORS } from '../src/market-hero/market-data.js';

const WIDTH = 1200, HEIGHT = 820, SILVER = '#dbe4ed';
// Each card's colours, seen on hover; the cards' grayscale filter shows them as silver at rest.
const MACRO = { land: '#79b2ff', arc: '#ffc861', grid: '#9cc4ff' };
const AI = { mesh: '#ad93ff', trace: '#6fecff' };
const out = new URL('../public/media/research/', import.meta.url);
mkdirSync(out, { recursive: true });
const n = value => Number(value.toFixed(1));
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;

// Macro: the world as one system. Land from Natural Earth (public domain) as dots on a globe
// centred on China, with hairline arcs from Shanghai to the main financial centres.
function macro() {
  const world = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)));
  const land = feature(world, world.objects.land);
  const radius = 470, cx = 690, cy = 350, centre = [-98, -22];
  const globe = geoOrthographic().rotate(centre).scale(radius).translate([cx, cy]).clipAngle(90).precision(.4);
  const path = geoPath(globe);
  const turn = geoRotation(centre);
  // A Fibonacci lattice spaces the dots evenly over the sphere.
  const bins = ['', '', ''];
  const total = 15000, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const z = 1 - (2 * i + 1) / total;
    const point = [(((golden * i) * 180 / Math.PI + 180) % 360) - 180, Math.asin(z) * 180 / Math.PI];
    const [lon, lat] = turn(point);
    const facing = Math.cos(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180);
    if (facing < .05 || !geoContains(land, point)) continue;
    const [x, y] = globe(point);
    if (y < -8 || y > HEIGHT + 8 || x > WIDTH + 8) continue;
    bins[facing > .62 ? 0 : facing > .3 ? 1 : 2] += `M${n(x)} ${n(y)}h0`;
  }
  const opacity = [.92, .62, .34];
  let body = `<path d="${path(geoGraticule().step([20, 20])())}" stroke="${MACRO.grid}" stroke-opacity=".15" stroke-width="1.2"/>`;
  body += `<path d="${path({ type: 'Sphere' })}" stroke="${MACRO.grid}" stroke-opacity=".5" stroke-width="1.6"/>`;
  bins.forEach((dots, i) => { body += `<path d="${dots}" stroke="${MACRO.land}" stroke-opacity="${opacity[i]}" stroke-width="3.4"/>`; });
  const shanghai = globe([121.47, 31.23]);
  const centres = [[139.69, 35.69], [103.82, 1.35], [72.88, 19.08], [55.27, 25.2], [8.68, 50.11], [151.21, -33.87], [37.62, 55.75]];
  for (const place of centres) {
    const [x, y] = globe(place);
    const midX = (x + shanghai[0]) / 2, midY = (y + shanghai[1]) / 2;
    const lift = Math.hypot(x - shanghai[0], y - shanghai[1]) * .3;
    const out = Math.hypot(midX - cx, midY - cy) || 1;
    body += `<path d="M${n(shanghai[0])} ${n(shanghai[1])}Q${n(midX + (midX - cx) / out * lift)} ${n(midY + (midY - cy) / out * lift)} ${n(x)} ${n(y)}" stroke="${MACRO.arc}" stroke-opacity=".8" stroke-width="1.7"/>`;
    body += `<circle cx="${n(x)}" cy="${n(y)}" r="4.6" fill="${MACRO.arc}" stroke="none"/>`;
  }
  body += `<circle cx="${n(shanghai[0])}" cy="${n(shanghai[1])}" r="14" stroke="${MACRO.arc}" stroke-opacity=".55" stroke-width="1.5"/><circle cx="${n(shanghai[0])}" cy="${n(shanghai[1])}" r="6.5" fill="#fff" stroke="none"/>`;
  return svg(body);
}

// Quant: the opening's own candles, drawn as outlines over a quiet grid (red up, green down).
function quant() {
  const chart = chartLayout(makeCandles());
  const low = Math.min(...chart.map(c => c.low)), high = Math.max(...chart.map(c => c.high));
  const lastX = chart.at(-1).x;
  const xOf = x => 44 + (WIDTH - 88) * x / lastX;
  const yOf = y => 610 - 520 * (y - low) / (high - low);
  const halfBody = (WIDTH - 88) / chart.length * .3;
  let body = '';
  for (let k = 0; k <= 5; k++) body += `<path d="M0 ${70 + k * 118}H${WIDTH}" stroke="${SILVER}" stroke-opacity=".08"/>`;
  chart.forEach((c, i) => {
    const color = c.up ? MARKET_COLORS.up : MARKET_COLORS.down, x = n(xOf(c.x));
    body += `<path d="M${x} ${n(yOf(c.high))}V${n(yOf(c.bodyTop))}M${x} ${n(yOf(c.bodyBottom))}V${n(yOf(c.low))}" stroke="${color}" stroke-opacity=".8" stroke-width="1.6"/>`;
    body += `<rect x="${n(x - halfBody)}" y="${n(yOf(c.bodyTop))}" width="${n(halfBody * 2)}" height="${n(Math.max(3, yOf(c.bodyBottom) - yOf(c.bodyTop)))}" stroke="${color}" stroke-opacity=".85" stroke-width="1.6" fill="${color}" fill-opacity="${c.up ? .28 : .1}"/>`;
  });
  let ma = '';
  chart.forEach((c, i) => {
    const near = chart.slice(Math.max(0, i - 8), i + 1);
    ma += `${i ? 'L' : 'M'}${n(xOf(c.x))} ${n(yOf(near.reduce((sum, item) => sum + item.close, 0) / near.length))}`;
  });
  return svg(`${body}<path d="${ma}" stroke="${SILVER}" stroke-width="2.2" stroke-opacity=".8"/>`);
}

// AI: the site's flowing surface as a neural mesh: an orderly wave of nodes receding to the top,
// with one smooth traced path of reasoning across it.
function ai() {
  const random = mulberry32(20261102);
  const columns = 34, rows = 19;
  const nodes = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const u = c / (columns - 1), near = Math.pow(r / (rows - 1), 1.25);
    const wave = Math.sin(u * 6.1 + r * .34 + .5) * 54 + Math.sin(u * 13 - r * .21) * 13;
    const spread = .5 + 1 * near;
    nodes.push({
      x: WIDTH / 2 + (u - .5) * WIDTH * spread + (random() - .5) * 3,
      y: 26 + near * 700 + wave * (.3 + .95 * near) + (random() - .5) * 3,
      near, r, c,
    });
  }
  const at = (r, c) => nodes[r * columns + c];
  const lineBins = ['', '', ''], dotBins = ['', '', ''];
  for (const node of nodes) {
    const bin = node.near > .55 ? 0 : node.near > .22 ? 1 : 2;
    dotBins[bin] += `M${n(node.x)} ${n(node.y)}h0`;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, (node.r + node.c) % 2 ? 1 : -1]]) {
      const r = node.r + dr, c = node.c + dc;
      if (r >= rows || c < 0 || c >= columns || random() < .1) continue;
      const other = at(r, c);
      lineBins[bin] += `M${n(node.x)} ${n(node.y)}L${n(other.x)} ${n(other.y)}`;
    }
  }
  let body = '';
  [.26, .2, .13].forEach((opacity, i) => { body += `<path d="${lineBins[i]}" stroke="${AI.mesh}" stroke-opacity="${opacity}" stroke-width="1.15"/>`; });
  [[.85, 5], [.68, 4], [.45, 3]].forEach(([opacity, size], i) => { body += `<path d="${dotBins[i]}" stroke="${AI.mesh}" stroke-opacity="${opacity}" stroke-width="${size}"/>`; });
  // A smooth path over the mesh (Catmull-Rom through a few nodes), with three lit stops.
  const trace = [[2, 1], [4, 7], [6, 13], [7, 19], [9, 25], [11, 32]].map(([r, c]) => at(r, c));
  let path = `M${n(trace[0].x)} ${n(trace[0].y)}`;
  for (let i = 0; i < trace.length - 1; i++) {
    const a = trace[Math.max(0, i - 1)], b = trace[i], c = trace[i + 1], d = trace[Math.min(trace.length - 1, i + 2)];
    path += `C${n(b.x + (c.x - a.x) / 6)} ${n(b.y + (c.y - a.y) / 6)} ${n(c.x - (d.x - b.x) / 6)} ${n(c.y - (d.y - b.y) / 6)} ${n(c.x)} ${n(c.y)}`;
  }
  body += `<path d="${path}" stroke="${AI.trace}" stroke-opacity=".95" stroke-width="2"/>`;
  for (const node of [trace[1], trace[3], trace[5]]) body += `<circle cx="${n(node.x)}" cy="${n(node.y)}" r="14" stroke="${AI.trace}" stroke-opacity=".45" stroke-width="1.3"/><circle cx="${n(node.x)}" cy="${n(node.y)}" r="5.8" fill="#fff" stroke="none"/>`;
  return svg(body);
}

for (const [name, art] of [['macro-lines', macro()], ['quant-lines', quant()], ['ai-lines', ai()]]) {
  writeFileSync(new URL(`${name}.svg`, out), art);
  console.log(name, `${(art.length / 1024).toFixed(1)} KB`);
}
