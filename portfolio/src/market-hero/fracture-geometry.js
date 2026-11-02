// Voronoi shards clipped to the existing chart quads. Sites and seeds use the
// same small-integer hash as GLSL, so each particle follows its original shard.
const mod = (n, d) => ((n % d) + d) % d;
export const shardHash = (x, y, seed) => mod(mod(x * 127 + y * 311 + seed * 73, 4093) * 109 + 1021, 4093) / 4093;
const siteAt = (x, y) => [x + 0.2 + shardHash(x, y, 1) * 0.6, y + 0.2 + shardHash(x, y, 2) * 0.6];

function clip(poly, nx, ny, limit) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = a[0] * nx + a[1] * ny - limit;
    const db = b[0] * nx + b[1] * ny - limit;
    if (da <= 1e-10) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

export function buildFractureGeometry(mesh) {
  const position = [], seed = [], tone = [], centers = [], cells = [];
  let count = 0;
  for (let base = 0; base < mesh.tone.length; base += 4) {
    if (mesh.kind[base] === 2) continue;
    const quad = Array.from({ length: 4 }, (_, i) => [mesh.position[(base + i) * 3] * 3, mesh.position[(base + i) * 3 + 1] * 2.6]);
    const xmin = Math.floor(Math.min(...quad.map(p => p[0]))) - 1;
    const xmax = Math.floor(Math.max(...quad.map(p => p[0]))) + 1;
    const ymin = Math.floor(Math.min(...quad.map(p => p[1]))) - 1;
    const ymax = Math.floor(Math.max(...quad.map(p => p[1]))) + 1;
    for (let y = ymin; y <= ymax; y++) for (let x = xmin; x <= xmax; x++) {
      const site = siteAt(x, y);
      let poly = quad;
      for (let dy = -2; dy <= 2 && poly.length; dy++) for (let dx = -2; dx <= 2 && poly.length; dx++) {
        if (!dx && !dy) continue;
        const other = siteAt(x + dx, y + dy);
        const nx = other[0] - site[0], ny = other[1] - site[1];
        const limit = (other[0] ** 2 + other[1] ** 2 - site[0] ** 2 - site[1] ** 2) / 2;
        poly = clip(poly, nx, ny, limit);
      }
      if (poly.length < 3) continue;
      const center = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
      const inset = poly.map(p => [center[0] + (p[0] - center[0]) * 0.965, center[1] + (p[1] - center[1]) * 0.965]);
      const shardSeed = shardHash(x, y, 3);
      const worldCenter = [center[0] / 3, center[1] / 2.6, mesh.position[base * 3 + 2]];
      cells.push({ center: worldCenter, seed: shardSeed, tone: mesh.tone[base] });
      for (let i = 1; i < inset.length - 1; i++) {
        for (const p of [inset[0], inset[i], inset[i + 1]]) {
          position.push(p[0] / 3, p[1] / 2.6, mesh.position[base * 3 + 2]);
          seed.push(shardSeed); tone.push(mesh.tone[base]);
          centers.push(...worldCenter);
        }
      }
      count++;
    }
  }
  return { position: new Float32Array(position), center: new Float32Array(centers), seed: new Float32Array(seed), tone: new Float32Array(tone), cells, count };
}

// Keep the approved particle count and surface slots. Bind each original sample
// to the polygon that contains it; the polygon center is the handover position.
export function bindParticlesToShards(particles, shards) {
  const center = new Float32Array(particles.count * 3);
  const seed = new Float32Array(particles.count);
  for (let k = 0; k < particles.count; k++) {
    const px = particles.origin[k * 3], py = particles.origin[k * 3 + 1], pz = particles.origin[k * 3 + 2];
    const qx = px * 3, qy = py * 2.6;
    let nearest = Infinity, idSeed = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = Math.floor(qx) + dx, y = Math.floor(qy) + dy;
      const site = siteAt(x, y), distance = (site[0] - qx) ** 2 + (site[1] - qy) ** 2;
      if (distance < nearest) { nearest = distance; idSeed = shardHash(x, y, 3); }
    }
    let best, score = Infinity;
    for (const cell of shards.cells) {
      if (Math.abs(cell.center[2] - pz) > 1e-5 || cell.tone !== particles.tone[k]) continue;
      const distance = (cell.center[0] - px) ** 2 + (cell.center[1] - py) ** 2;
      const candidate = distance + (cell.seed === idSeed ? 0 : 1e5);
      if (candidate < score) { score = candidate; best = cell; }
    }
    if (!best) throw new Error('Particle has no source shard');
    center.set(best.center, k * 3); seed[k] = best.seed;
  }
  return { center, seed };
}
