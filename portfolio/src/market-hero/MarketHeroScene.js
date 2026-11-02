import { AdditiveBlending, NormalBlending, BufferAttribute, BufferGeometry, DoubleSide, LineSegments, Mesh, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderer } from 'three';
import { buildField, MARKET_COLORS, LAYOUT, PARTICLE_SIZE } from './market-data.js';
import { framedPose } from './camera-path.js';
import { buildFractureGeometry, bindParticlesToShards } from './fracture-geometry.js';
import { TIMING, openingTime, narrative, INTRO, sceneTime } from './timeline.js';
import { shardVertex, shardFragment, chartFragment, chartVertex, dustFragment, dustVertex, lineFragment, lineVertex, pointFragment, pointVertex, gridVertex, gridFragment } from './shaders.js';

// Colours are written straight through as sRGB (no colour-space chunk in the shaders).
export const PALETTE = MARKET_COLORS;
const rgb = hex => new Vector3(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

function geometryOf(attributes, index) {
  const geometry = new BufferGeometry();
  for (const [name, [array, size]] of Object.entries(attributes)) geometry.setAttribute(name, new BufferAttribute(array, size));
  if (index) geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

export class MarketHeroScene {
  constructor(canvas, { quality = 'low', candles } = {}) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(PALETTE.background, 1);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(36, 16 / 9, 0.1, 400);
    this.pose = { pos: [0, 0, 0], tgt: [0, 0, 0], fov: 36 };
    this.aspect = 16 / 9;
    this.uniforms = {
      uTime: { value: 0 },
      uRevealTime: { value: 0 },
      uFlow: { value: 0 },
      uSurfaceHighlightGain: { value: 1 },
      uCandleSpacing: { value: LAYOUT.spacing },
      uRevealStart: { value: TIMING.revealStart },
      uRevealSlowDur: { value: TIMING.revealSlowDur },
      uRevealFastDur: { value: TIMING.revealFastDur },
      uFlyStart: { value: TIMING.flyStart },
      uFlyDur: { value: TIMING.flyDur },
      uDesatStart: { value: TIMING.desatStart },
      uDesatDur: { value: TIMING.desatDur },
      uDecoStart: { value: TIMING.decoStart },
      uFractureHold: { value: TIMING.fractureHold },
      uShardDuration: { value: TIMING.shardDuration },
      uMorphDuration: { value: TIMING.morphDuration },
      uDecoSweep: { value: TIMING.decoSweep },
      uDecoJitter: { value: TIMING.decoJitter },
      uSweepX: { value: new Vector2(...TIMING.sweep) },
      uUpColor: { value: rgb(PALETTE.up) },
      uDownColor: { value: rgb(PALETTE.down) },
      uSilver: { value: rgb(PALETTE.silver) },
      uBackground: { value: rgb(PALETTE.background) },
      uFogNear: { value: 22 },
      uFogFar: { value: 120 },
      uConvStart: { value: TIMING.convStart },
      uConvSweep: { value: TIMING.convSweep },
      uConvDur: { value: TIMING.convDur },
      uPixelRatio: { value: 1 },
      uPointSize: { value: PARTICLE_SIZE },
      uPointOpacity: { value: 0.65 },
      uLineAlpha: { value: 0.5 },
      uSpread: { value: 1 },
      uCloudCenter: { value: new Vector3(33, 7.425, 0) },
      uApproachAxis: { value: new Vector3(0, 0, 1) },
      uClusterStrength: { value: 1 },
      uGather: { value: 0 },
      uThread: { value: new Vector4(-1, 0, 1, 0) },
      uThreadPx: { value: new Vector2(0.002, 0.002) },
      uThreadRise: { value: 0.3 },
      uThreadBloom: { value: 0 },
      uThreadFlow: { value: 0 },
      uPulse: { value: -1 },
      uRibbonOn: { value: 0 },
      uLineFade: { value: 0 },
      uJourney: { value: new Vector4(-1, -1, 2, 1) },
      uOnJourney: { value: 0 },
      uRibbonFrame: { value: new Vector4(0, 0, 1, 1) },
      uRibbonShape: { value: new Vector4(0, 1, 0.1, 0) },
      uRibbonTurn: { value: new Vector4(0, 0, 0, 2) },
      uRibbonAngle: { value: new Vector2(1, 0) },
    };
    this.threadFlow = 0;
    this.lastElapsed = 0;
    this.objects = [];
    this.candles = candles;
    this.build(quality);
  }

  build(quality) {
    this.clear();
    const field = buildField({ candles: this.candles });
    this.field = field;
    this.uniforms.uSweepX.value.set(...field.sweep);
    this.uniforms.uCloudCenter.value.set(...field.cloudCenter);
    const { position, local, size, tone, kind, index } = field.mesh;
    const chartGeometry = geometryOf({ position: [position, 3], aLocal: [local, 2], aSize: [size, 2], aTone: [tone, 1], aKind: [kind, 1] }, index);
    this.chart = this.add(new Mesh(chartGeometry, new ShaderMaterial({ vertexShader: chartVertex, fragmentShader: chartFragment, uniforms: this.uniforms, side: DoubleSide })));

    const shards = buildFractureGeometry(field.mesh);
    this.shards = this.add(new Mesh(geometryOf({ position: [shards.position, 3], aShardSeed: [shards.seed, 1], aShardCenter: [shards.center, 3], aTone: [shards.tone, 1] }), new ShaderMaterial({ vertexShader: shardVertex, fragmentShader: shardFragment, uniforms: this.uniforms, side: DoubleSide })));
    this.shards.visible = false;

    const grid = field.backgroundGrid;
    this.grid = this.add(new LineSegments(geometryOf({ position: [grid.position, 3], aGridUv: [grid.uv, 2] }), new ShaderMaterial({
      vertexShader: gridVertex, fragmentShader: gridFragment, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: NormalBlending,
    })), 0);

    const p = field.particles;
    const sourceShards = bindParticlesToShards(p, shards);
    // Denser fields get fainter lines so the overall light stays the same at every quality.
    this.uniforms.uLineAlpha.value = 0.5 * Math.sqrt(54 / field.quality.lines);
    const shared = { aShardCenter: [sourceShards.center, 3], aShardSeed: [sourceShards.seed, 1], position: [p.origin, 3], originPosition: [p.origin, 3], flightOffset: [p.flightOffset, 3], targetPosition: [p.rest, 3], originalColor: [p.originalColor, 3], randomPhase: [p.randomPhase, 1], aNormal: [p.normal, 3], aClusterCenter: [p.clusterCenter, 3], aClusterSpin: [p.clusterSpin, 4], aSlot: [p.slot, 2], aTone: [p.tone, 1], aSeed: [p.seeds, 4] };
    const pointGeometry = geometryOf(shared);
    // Densify only the landed surface topology, using the same V4 wave as points.
    const surface = field.surfaceLines;
    const lineGeometry = geometryOf({ position: [surface.rest, 3], aSlot: [surface.slot, 2] }, surface.segments);
    const additive = { uniforms: this.uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending };
    const dustGeometry = geometryOf({ position: [field.dust.position, 3], aSeed: [field.dust.seed, 1] });
    this.dust = this.add(new Points(dustGeometry, new ShaderMaterial({ vertexShader: dustVertex, fragmentShader: dustFragment, ...additive })), 1);
    this.dust.visible = false;
    this.lines = this.add(new LineSegments(lineGeometry, new ShaderMaterial({ vertexShader: lineVertex, fragmentShader: lineFragment, ...additive })), 2);
    this.points = this.add(new Points(pointGeometry, new ShaderMaterial({ vertexShader: pointVertex, fragmentShader: pointFragment, ...additive, blending: NormalBlending })), 3);
  }

  add(object, order = 0) {
    object.frustumCulled = false;
    object.renderOrder = order;
    this.scene.add(object);
    this.objects.push(object);
    return object;
  }

  clear() {
    const geometries = new Set();
    for (const object of this.objects) {
      geometries.add(object.geometry);
      object.material.dispose();
      this.scene.remove(object);
    }
    geometries.forEach(geometry => geometry.dispose());
    this.objects = [];
  }

  resize(width, height, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.aspect = width / Math.max(1, height);
    this.camera.aspect = this.aspect;
    this.uniforms.uPixelRatio.value = dpr;
    this.camera.updateProjectionMatrix();
  }

  render(time, view = {}) {
    const elapsed = time;
    time = sceneTime(elapsed);
    const u = this.uniforms;
    u.uTime.value = time;
    // Seed a few existing bars in the distance. They remain the same bars when
    // the market clock starts, rather than vanishing at the handoff.
    const seedReveal = (INTRO.candles - 1) / (this.field.chart.length - 1)
      * (TIMING.revealSlowDur + TIMING.revealFastDur) + 0.00001;
    u.uRevealTime.value = Math.max(seedReveal, openingTime(time));
    u.uFlow.value = time;
    u.uSurfaceHighlightGain.value = 1 - 0.3 * narrative(elapsed).first;
    u.uSpread.value = view.spread ?? 1;
    u.uPointSize.value = PARTICLE_SIZE;
    u.uPointOpacity.value = Math.max(0.1, Math.min(0.85, view.pointOpacity ?? 0.65));
    u.uFogFar.value = 120;
    // The closing line (see closingThread.js). Sparks start running only once it exists.
    const gather = view.gather ?? 0;
    u.uGather.value = gather;
    if (view.thread) u.uThread.value.set(...view.thread);
    if (view.threadPx) u.uThreadPx.value.set(...view.threadPx);
    u.uThreadRise.value = view.threadRise ?? 0.3;
    u.uThreadBloom.value = view.threadBloom ?? 0;
    u.uPulse.value = view.pulse ?? -1;
    const ribbon = view.ribbon;
    u.uRibbonOn.value = ribbon?.on ?? 0;
    u.uLineFade.value = view.lineFade ?? 0;
    u.uOnJourney.value = view.onJourney ?? 0;
    if (view.journey) u.uJourney.value.set(...view.journey);
    if (ribbon?.frame) {
      u.uRibbonFrame.value.set(...ribbon.frame);
      u.uRibbonShape.value.set(...ribbon.shape);
      u.uRibbonTurn.value.set(...ribbon.turn);
      u.uRibbonAngle.value.set(...ribbon.angle);
    }
    this.threadFlow = gather > 0 ? this.threadFlow + Math.max(0, elapsed - this.lastElapsed) * 0.035 * gather ** 3 : 0;
    this.lastElapsed = elapsed;
    u.uThreadFlow.value = this.threadFlow;
    const pose = view.cameraPose ?? framedPose(time, this.aspect, view, this.pose);
    if (!view.cameraPose && elapsed < INTRO.duration) {
      const p = Math.max(0, Math.min(1, (elapsed - INTRO.hold) / (INTRO.approachEnd - INTRO.hold)));
      const eased = p * p * p * (p * (p * 6 - 15) + 10);
      // Ease perceived scale along the existing viewing ray; yaw, pitch, target
      // and field of view stay fixed throughout the approach.
      const distance = Math.exp(Math.log(INTRO.distance) * (1 - eased));
      // Keep the small distant bars discernible against the black background.
      u.uFogFar.value = 120 + 80 * (1 - eased);
      for (let d = 0; d < 3; d++) pose.pos[d] = pose.tgt[d] + (pose.pos[d] - pose.tgt[d]) * distance;
    }
    this.camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    this.camera.lookAt(pose.tgt[0], pose.tgt[1], pose.tgt[2]);
    // The depth arc follows the actual viewing direction, including the user's
    // orbit preset, so "near" stays near after yaw/pitch adjustments.
    u.uApproachAxis.value.set(pose.pos[0] - pose.tgt[0], pose.pos[1] - pose.tgt[1], pose.pos[2] - pose.tgt[2]).normalize();
    if (Math.abs(pose.fov - this.camera.fov) > 1e-4) { this.camera.fov = pose.fov; this.camera.updateProjectionMatrix(); }
    const shardStart = TIMING.decoStart + TIMING.fractureHold;
    const particleStart = shardStart + TIMING.shardDuration + TIMING.morphDuration;
    this.chart.visible = time < shardStart;
    this.shards.visible = time >= shardStart && time < particleStart;
    this.points.visible = time >= TIMING.decoStart - 0.05;
    this.lines.visible = time >= TIMING.convStart && u.uLineFade.value < 1;
    this.renderer.render(this.scene, this.camera);
  }

  stats() {
    const { particles, quality } = this.field;
    const { memory, render } = this.renderer.info;
    return { particles: particles.count, lines: quality.lines, quality: quality.label, calls: render.calls, geometries: memory.geometries, programs: this.renderer.info.programs?.length ?? 0 };
  }

  dispose() {
    this.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
