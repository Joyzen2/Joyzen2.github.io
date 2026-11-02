import{i as e}from"./jsx-runtime-BsLBqpyP.js";import{a as t,c as n,d as r,i,l as a,n as o,o as s,r as c,s as l,t as u,u as d}from"./home-B3jl53xv.js";import{_ as f,b as p,c as m,f as h,g,m as _,n as v,r as y,t as b,u as x,x as S,y as C}from"./three.module-r4AQOhIb.js";var w=(e,t)=>(e%t+t)%t,T=(e,t,n)=>w(w(e*127+t*311+n*73,4093)*109+1021,4093)/4093,E=(e,t)=>[e+.2+T(e,t,1)*.6,t+.2+T(e,t,2)*.6];function D(e,t,n,r){let i=[];for(let a=0;a<e.length;a++){let o=e[a],s=e[(a+1)%e.length],c=o[0]*t+o[1]*n-r,l=s[0]*t+s[1]*n-r;if(c<=1e-10&&i.push(o),c<0&&l>0||c>0&&l<0){let e=c/(c-l);i.push([o[0]+(s[0]-o[0])*e,o[1]+(s[1]-o[1])*e])}}return i}function O(e){let t=[],n=[],r=[],i=[],a=[],o=0;for(let s=0;s<e.tone.length;s+=4){if(e.kind[s]===2)continue;let c=Array.from({length:4},(t,n)=>[e.position[(s+n)*3]*3,e.position[(s+n)*3+1]*2.6]),l=Math.floor(Math.min(...c.map(e=>e[0])))-1,u=Math.floor(Math.max(...c.map(e=>e[0])))+1,d=Math.floor(Math.min(...c.map(e=>e[1])))-1,f=Math.floor(Math.max(...c.map(e=>e[1])))+1;for(let p=d;p<=f;p++)for(let d=l;d<=u;d++){let l=E(d,p),u=c;for(let e=-2;e<=2&&u.length;e++)for(let t=-2;t<=2&&u.length;t++){if(!t&&!e)continue;let n=E(d+t,p+e),r=n[0]-l[0],i=n[1]-l[1],a=(n[0]**2+n[1]**2-l[0]**2-l[1]**2)/2;u=D(u,r,i,a)}if(u.length<3)continue;let f=u.reduce((e,t)=>[e[0]+t[0]/u.length,e[1]+t[1]/u.length],[0,0]),m=u.map(e=>[f[0]+(e[0]-f[0])*.965,f[1]+(e[1]-f[1])*.965]),h=T(d,p,3),g=[f[0]/3,f[1]/2.6,e.position[s*3+2]];a.push({center:g,seed:h,tone:e.tone[s]});for(let a=1;a<m.length-1;a++)for(let o of[m[0],m[a],m[a+1]])t.push(o[0]/3,o[1]/2.6,e.position[s*3+2]),n.push(h),r.push(e.tone[s]),i.push(...g);o++}}return{position:new Float32Array(t),center:new Float32Array(i),seed:new Float32Array(n),tone:new Float32Array(r),cells:a,count:o}}function k(e,t){let n=new Float32Array(e.count*3),r=new Float32Array(e.count);for(let i=0;i<e.count;i++){let a=e.origin[i*3],o=e.origin[i*3+1],s=e.origin[i*3+2],c=a*3,l=o*2.6,u=1/0,d=0;for(let e=-1;e<=1;e++)for(let t=-1;t<=1;t++){let n=Math.floor(c)+t,r=Math.floor(l)+e,i=E(n,r),a=(i[0]-c)**2+(i[1]-l)**2;a<u&&(u=a,d=T(n,r,3))}let f,p=1/0;for(let n of t.cells){if(Math.abs(n.center[2]-s)>1e-5||n.tone!==e.tone[i])continue;let t=(n.center[0]-a)**2+(n.center[1]-o)**2+(n.seed===d?0:1e5);t<p&&(p=t,f=n)}if(!f)throw Error(`Particle has no source shard`);n.set(f.center,i*3),r[i]=f.seed}return{center:n,seed:r}}var A=e({ribbonPoint:()=>j}),j=`
  vec2 ribbonPoint(float along, float strand) {
    float x = mix(-uRibbonTurn.w, uRibbonTurn.w, along);
    float t = uRibbonTurn.z;
    float f = uRibbonShape.y;
    float u = strand * 2.0 - 1.0;
    float spine = uRibbonShape.x * (0.62 * sin(x * f + t * 0.33 + 0.4)
      + 0.26 * sin(x * f * 1.93 - t * 0.21 + 2.1)
      + 0.12 * sin(x * f * 3.07 + t * 0.47 + 4.2));
    float halfWidth = uRibbonShape.z * (1.0 + 0.22 * sin(x * 0.61 - t * 0.19 + 1.3));
    float theta = uRibbonTurn.x * x + uRibbonTurn.y;
    float zeta = uRibbonShape.w * (u * u - 1.0 / 3.0);
    float y = spine + halfWidth * (u * cos(theta) - zeta * sin(theta));
    return uRibbonFrame.xy + vec2(uRibbonAngle.x * x - uRibbonAngle.y * y, uRibbonAngle.y * x + uRibbonAngle.x * y) * uRibbonFrame.zw;
  }
`,M=`
  uniform float uTime;
  uniform float uDecoStart;
  uniform float uFractureHold;
  uniform float uShardDuration;
  uniform float uMorphDuration;
  uniform float uSurfaceHighlightGain;
  uniform float uDecoSweep;
  uniform float uDecoJitter;
  uniform vec2 uSweepX;

  float hash13(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0)), f.x), f.y),
      f.z);
  }
  float shardHash(vec2 id, float seed) {
    return mod(mod(id.x * 127.0 + id.y * 311.0 + seed * 73.0, 4093.0) * 109.0 + 1021.0, 4093.0) / 4093.0;
  }
  vec3 shardMotion(float seed, float age) {
    float angle = seed * 47.1239;
    float speed = 1.2 + fract(seed * 7.13) * 1.6;
    return vec3(cos(angle) * speed * age,
                sin(angle) * speed * age - 0.48 * age * age,
                sin(angle * 1.73) * 1.6 * age);
  }
  // Stable irregular shards shared by the chart and its particle samples.
  // No candle index or sweep direction affects the fracture schedule.
  vec2 fracturePattern(vec3 p) {
    vec2 q = p.xy * vec2(3.0, 2.6);
    vec2 cell = floor(q);
    vec2 f = fract(q);
    float nearest = 100.0, second = 100.0, shard = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y));
        vec2 id = cell + offset;
        vec2 site = vec2(shardHash(id, 1.0), shardHash(id, 2.0));
        vec2 delta = offset + 0.2 + site * 0.6 - f;
        float d = dot(delta, delta);
        if (d < nearest) {
          second = nearest; nearest = d;
          shard = shardHash(id, 3.0);
        } else { second = min(second, d); }
      }
    }
    return vec2(shard, max(0.0, sqrt(second) - sqrt(nearest)));
  }
  float releaseTime(vec3 p) {
    // Every shard breaks together; briefly expose the broken silhouette, then
    // transfer all pieces to their particles on the same frame.
    return uDecoStart + uFractureHold + uShardDuration + uMorphDuration;
  }

`,N=`
  ${M}
  attribute float aShardSeed;
  attribute vec3 aShardCenter;
  attribute float aTone;
  varying float vShardTone;
  varying float vShardDepth;
  uniform float uSpread;
  void main() {
    float age = max(0.0, uTime - uDecoStart - uFractureHold);
    // The moving polygon physically contracts to the center that births its dots.
    float collapse = smoothstep(uShardDuration, uShardDuration + uMorphDuration, age);
    // Retain a tiny visible core until its point takes over; avoid a blank frame.
    vec3 p = mix(position, aShardCenter, collapse * 0.97)
           + shardMotion(aShardSeed, age) * uSpread;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vShardTone = aTone;
    vShardDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`,P=`
  uniform vec3 uUpColor;
  uniform vec3 uDownColor;
  uniform vec3 uSilver;
  uniform vec3 uBackground;
  uniform float uFogNear;
  uniform float uFogFar;
  varying float vShardTone;
  varying float vShardDepth;
  void main() {
    vec3 color = vShardTone > 1.5 ? uSilver * 0.48 : mix(uDownColor, uUpColor, vShardTone) * 0.9;
    float fog = smoothstep(uFogNear, uFogFar, vShardDepth) * 0.88;
    gl_FragColor = vec4(mix(color, uBackground, fog), 1.0);
  }
`,F=`
  attribute vec2 aLocal;
  attribute vec2 aSize;
  attribute float aTone;
  attribute float aKind;
  varying vec3 vWorld;
  varying vec2 vLocal;
  varying vec2 vSize;
  varying float vTone;
  varying float vKind;
  varying float vDepth;
  void main() {
    vWorld = position;
    vLocal = aLocal;
    vSize = aSize;
    vTone = aTone;
    vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`,I=`
  ${M}
  uniform float uCandleSpacing;
  uniform float uRevealTime;
  uniform float uRevealStart;
  uniform float uRevealSlowDur;
  uniform float uRevealFastDur;
  uniform vec3 uUpColor;
  uniform vec3 uDownColor;
  uniform vec3 uSilver;
  uniform vec3 uBackground;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorld;
  varying vec2 vLocal;
  varying vec2 vSize;
  varying float vTone;
  varying float vKind;
  varying float vDepth;
  void main() {
    // Keep the existing geometry and camera; reveal candle time from left to right.
    if (vKind < 1.5 || vKind > 2.5) {
      float candleX = floor(vWorld.x / uCandleSpacing + 0.5) * uCandleSpacing;
      float order = clamp((candleX - uSweepX.x) / (uSweepX.y - uSweepX.x), 0.0, 1.0);
      float reveal = min(order * 2.0, 1.0) * uRevealSlowDur
                   + max(order * 2.0 - 1.0, 0.0) * uRevealFastDur;
      if (uRevealTime < uRevealStart + reveal) discard;
    }
    vec2 shard = uTime >= uDecoStart ? fracturePattern(vWorld) : vec2(0.0, 1.0);
    float crack = step(uDecoStart, uTime);
    // All fissures open at once; there is no per-shard erosion or stagger.
    float fissure = 1.0 - smoothstep(0.006, 0.025, shard.y);
    if (crack > 0.0 && shard.y < 0.012 * crack) discard;
    float k = uTime - releaseTime(vWorld);
    if (uTime >= uDecoStart + uFractureHold) discard;
    vec3 base = vTone > 1.5 ? uSilver : mix(uDownColor, uUpColor, vTone);
    vec3 col;
    if (vKind < 0.5) {
      // Body: a flat display fill with a faint top light and a crisp rim.
      vec2 d = (0.5 - abs(vLocal)) * vSize;
      float rim = 1.0 - smoothstep(0.0, 0.02, min(d.x, d.y));
      col = base * (0.8 + 0.2 * (vLocal.y + 0.5)) + base * rim * 0.35;
    } else if (vKind < 1.5) {
      col = base * 0.92;
    } else if (vKind < 2.5) {
      col = base * 0.09;
    } else {
      col = base * 0.48;
    }
    col *= 1.0 - fissure * crack * 0.85;
    // The seam glows just before a fragment becomes a particle (the grid only faintly).
    float seam = smoothstep(-0.3, 0.0, k);
    float seamGain = vKind > 1.5 && vKind < 2.5 ? 0.22 : 1.0;
    col = mix(col, base * 1.12 * seamGain, seam * seam * 0.35);
    float fog = smoothstep(uFogNear, uFogFar, vDepth) * 0.88;
    gl_FragColor = vec4(mix(col, uBackground, fog), 1.0);
  }
`,L=`
  float surfaceHeight(vec2 uv, float t) {
    float u = uv.x, v = uv.y;
    float wave = sin(u * 13.0 + t * 0.17) * 0.65
      + sin(u * 26.0 - t * 0.2) * 0.25
      + sin(u * 10.0 + v * 5.0 + t * 0.16) * 0.12;
    return 0.2 + 3.3 * (${d.waveAmp.toFixed(2)} * wave + (v - 0.5) * 2.5);
  }
`,R=`
  uniform float uGather;
  uniform vec4 uThread;
  uniform vec2 uThreadPx;
  uniform float uThreadRise;
  uniform float uThreadBloom;
  uniform float uThreadFlow;
  uniform float uPulse;
  uniform float uRibbonOn;
  uniform float uLineFade;
  uniform vec4 uRibbonFrame;
  uniform vec4 uRibbonShape;
  uniform vec4 uRibbonTurn;
  uniform vec2 uRibbonAngle;
  uniform vec4 uJourney;
  uniform float uOnJourney;
  ${Object.values([A])[0]?.ribbonPoint??`vec2 ribbonPoint(float along, float strand) { return vec2(0.0); }`}

  // 05's rising line across the page (rise() in ExperienceJourney.jsx). uJourney is its band
  // in clip space. Strands bunch just below it, and fan out towards the line's left end.
  vec2 journeyPoint(float along, float strand) {
    float s = along * along * (3.0 - 2.0 * along);
    return vec2(uJourney.x + along * uJourney.z,
                uJourney.y + (0.17 + 0.82 * s) * uJourney.w - strand * (1.0 + 6.0 * (1.0 - along)) * uThreadPx.y);
  }

  float gatherAmount(vec2 slot) {
    // Left to right along the line; the far lines lead the near ones.
    float start = slot.x * 0.5 + (1.0 - slot.y) * 0.2;
    float k = clamp((uGather - start) / 0.3, 0.0, 1.0);
    return k * k * k * (k * (k * 6.0 - 15.0) + 10.0);
  }
  float pulseAt(float along) {
    float d = (along - uPulse) / 0.05;
    return uPulse < 0.0 ? 0.0 : exp(-d * d);
  }
  // How far past the heading the line has run, 0..1.
  float threadPast(float along) { return clamp((along - uThreadRise) / (1.0 - uThreadRise), 0.0, 1.0); }
  // Once there is open space the band swells, then narrows again as it leaves the page.
  float threadSwell(float along) { return sin(3.14159 * pow(threadPast(along), 0.8)); }
  // The band turns over along its length, so its strands cross in knots and open into loops.
  float threadTurn(float along, float strand, float t) { return along * 13.0 - t * 0.22 + (strand - 0.5) * 0.9; }
  // Strands on the far side of a turn read fainter; an open band needs more light per strand.
  float threadShade(float along, float strand, float t) {
    float openBand = threadSwell(along) * min(1.0, uThreadBloom / 40.0);
    float facing = (strand - 0.5) * 2.0 * sin(threadTurn(along, strand, t));
    return mix(0.34, 1.1 * (0.6 + 0.4 * facing), openBand);
  }
  // A point on the closing line in clip-space x/y: a band of strands narrowing to one,
  // level beneath the heading, then lifting as it runs off the page.
  // uThread holds both ends; sway and fan are CSS pixels, converted through uThreadPx.
  vec2 threadPoint(float along, float strand, float t) {
    float open = 1.0 - along;
    float sway = (sin(along * 7.0 - t * 0.3) * 4.5 + sin(along * 17.0 + t * 0.21) * 1.8) * smoothstep(0.0, 0.3, open);
    float width = 1.0 + 24.0 * pow(open, 1.6) + 2.0 * uThreadBloom * threadSwell(along);
    float fan = (strand - 0.5) * width * cos(threadTurn(along, strand, t))
              * (1.0 + 0.3 * sin(along * 23.0 + strand * 37.0 + t * 0.4))
              * (1.0 + 2.0 * pulseAt(along));
    return vec2(mix(uThread.x, uThread.z, along),
                mix(uThread.y, uThread.w, pow(threadPast(along), 2.6)) + (sway + fan) * uThreadPx.y);
  }
  vec4 gatherClip(vec4 clip, vec2 slot, float along, float t) {
    float g = gatherAmount(slot);
    if (g <= 0.0) return clip;
    float w = max(clip.w, 0.001);
    vec2 target = threadPoint(along, slot.y, t);
    if (uRibbonOn > 0.0) target = mix(target, ribbonPoint(along, slot.y), uRibbonOn);
    if (uOnJourney > 0.0) target = mix(target, journeyPoint(along, slot.y), uOnJourney);
    return vec4(mix(clip.xy / w, target, g) * w, clip.z, clip.w);
  }
`,z=`
  ${`
  ${M}
  ${L}
  ${R}
  attribute vec3 aShardCenter;
  attribute float aShardSeed;
  attribute vec3 originPosition;
  attribute vec3 flightOffset;
  attribute vec3 targetPosition;
  attribute vec3 originalColor;
  attribute float randomPhase;
  attribute vec3 aNormal;
  attribute vec3 aClusterCenter;
  attribute vec4 aClusterSpin;
  attribute vec2 aSlot;
  attribute float aTone;
  attribute vec4 aSeed;
  uniform float uFlow;
  uniform float uSpread;
  uniform vec3 uCloudCenter;
  uniform vec3 uApproachAxis;
  uniform float uClusterStrength;
  uniform float uFlyStart;
  uniform float uFlyDur;
  uniform float uDesatStart;
  uniform float uDesatDur;
  uniform float uConvStart;
  uniform float uConvSweep;
  uniform float uConvDur;

  vec3 rotateAroundAxis(vec3 value, vec3 axis, float angle) {
    float c = cos(angle), s = sin(angle);
    return value * c + cross(axis, value) * s + axis * dot(axis, value) * (1.0 - c);
  }

  vec3 flight(vec3 origin, float tau, float gather) {
    float fly = smoothstep(uFlyStart, uFlyStart + uFlyDur, uTime);
    // Each fragment starts exactly on its candle, even if it is released late.
    float detach = smoothstep(0.0, 1.0, tau);
    float amplitude = fly * (1.0 - gather) * detach;
    vec3 oscillation = vec3(
      sin(uTime * 0.76 + randomPhase) * 1.56,
      sin(uTime * 0.9 + randomPhase) * 4.2,
      cos(uTime * 0.65 + randomPhase) * 2.4
    );
    // A small initial fracture remains visible before the full flight swells.
    vec3 fracture = aNormal * (0.16 + 0.3 * aSeed.x) * detach * (1.0 - gather);
    // Continue the shard trajectory at handover; no particle waits at its origin.
    float shardAge = max(0.0, uTime - uDecoStart - uFractureHold);
    vec3 departing = shardMotion(aShardSeed, shardAge) * (1.0 - fly) * (1.0 - gather);
    vec3 p = origin + uSpread * (departing + fracture + amplitude * (flightOffset * 0.62 + oscillation * 0.7));
    // Local, independent rotations: softly tilted, thick orbital bands with a
    // scattered core. Opposite directions and differential speeds prevent the
    // groups from reading as a single rigid object turned by the camera.
    float age = max(0.0, uTime - uFlyStart);
    float spinEnvelope = smoothstep(0.08, 0.75, fly) * detach
                       * clamp(uSpread, 0.0, 1.0) * uClusterStrength;
    float cluster = spinEnvelope * (1.0 - smoothstep(0.45, 0.98, gather));
    vec3 axis = normalize(aClusterSpin.xyz);
    vec3 relative = p - aClusterCenter;
    float angle = age * aClusterSpin.w * (0.85 + 0.3 * aSeed.z) * spinEnvelope;
    relative = rotateAroundAxis(relative, axis, angle);
    float axial = dot(relative, axis);
    vec3 planar = relative - axis * axial;
    float radial = length(planar);
    vec3 basis = normalize(cross(axis, vec3(1.0, 0.0, 0.0)));
    vec3 direction = radial > 0.0001 ? planar / radial : basis;
    float ring = step(0.24, aSeed.x);
    float orbitRadius = 2.15 + 1.45 * aSeed.w + 0.18 * sin(age * 0.7 + randomPhase);
    float radius = mix(radial, orbitRadius, cluster * ring * 0.68);
    float thickness = mix(1.0, 0.36 + 0.18 * aSeed.y, cluster);
    vec3 orbital = direction * radius + axis * axial * thickness;
    float groupPhase = dot(axis, vec3(2.3, 3.7, 5.1));
    vec3 wander = vec3(sin(age * 0.45 + groupPhase), sin(age * 0.5 + groupPhase * 1.3), cos(age * 0.4 + groupPhase)) * 0.45 * cluster;
    p = aClusterCenter + orbital + wander;
    // Keep the collection bounded while each cluster continues its own orbit.
    float cloud = smoothstep(0.0, 0.85, fly) * detach * clamp(uSpread, 0.0, 1.0);
    vec3 local = p - uCloudCenter;
    local.x *= mix(1.0, 0.52, cloud);
    local.y *= mix(1.0, 0.72, cloud);
    float yaw = cloud * (0.34 + 0.22 * sin(age * 0.5));
    float cy = cos(yaw), sy = sin(yaw);
    local.xz = vec2(local.x * cy + local.z * sy, local.z * cy - local.x * sy);
    float roll = cloud * 0.12 * sin(age * 0.65);
    float cr = cos(roll), sr = sin(roll);
    local.xy = vec2(local.x * cr - local.y * sr, local.x * sr + local.y * cr);
    return uCloudCenter + local + vec3(0.0, 0.0, -6.0) * cloud;
  }

  float convergence() { return uConvStart; }

  void particle(out vec3 pos, out float released, out float tau, out float settle, out float start) {
    float release = releaseTime(originPosition);
    released = step(release, uTime);
    tau = max(uTime - release, 0.0);
    start = convergence();
    settle = smoothstep(start, start + uConvDur, uTime);
    vec3 surface = targetPosition;
    surface.y += surfaceHeight(aSlot, uFlow) - surfaceHeight(aSlot, 0.0);
    if (settle >= 1.0) { pos = surface; return; }
    // Start at the exact collapsed polygon center, then gently separate its
    // constituent dots. Source geometry and final surface slots never resample.
    float unbundle = smoothstep(0.0, 0.55, tau);
    vec3 source = mix(aShardCenter, originPosition, unbundle);
    vec3 free = flight(source, tau, settle);
    pos = mix(free, surface, settle);
    // A coherent depth arc, not a particle-size pulse: the released cloud is
    // initially far away, approaches the viewer, then returns to its own slots.
    // Both ends have zero displacement and zero velocity, including on seek.
    float progress = clamp((uTime - start) / uConvDur, 0.0, 1.0);
    float approach = smoothstep(0.0, 0.48, progress)
                   * (1.0 - smoothstep(0.48, 1.0, progress));
    pos += uApproachAxis * (6.0 * approach) * uSpread;

  }
`}
  uniform vec3 uUpColor;
  uniform vec3 uDownColor;
  uniform vec3 uSilver;
  uniform float uPixelRatio;
  uniform float uPointSize;
  uniform float uPointOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 pos;
    float released;
    float tau;
    float settle;
    float start;
    particle(pos, released, tau, settle, start);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float depth = max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
    vec3 base = originalColor;

    vec3 col = base;
    // Colour drains to silver as the field takes hold of each particle.
    float nearness = 1.0 - smoothstep(16.0, 80.0, depth) * 0.7;
    float desat = smoothstep(uDesatStart, uDesatStart + uDesatDur, uTime);
    float luminance = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(luminance), desat);
    col = mix(col, uSilver * nearness, desat * desat);
    float landed = smoothstep(0.85, 1.0, settle);
    float edge = smoothstep(0.0, 0.1, aSlot.x) * smoothstep(0.0, 0.1, 1.0 - aSlot.x);
    float shimmer = pow(max(0.0, sin(aSlot.x * 37.0 - uFlow * 0.9 + aSlot.y * 11.0)), 16.0) * landed;

    // Visible at release: a fragment hands over directly to its coloured particle.
    float emerge = mix(0.65, 1.0, smoothstep(0.0, 0.45, tau));
    float depthAlpha = mix(1.0, 0.72, smoothstep(16.0, 85.0, depth));
    vAlpha = released * emerge * uPointOpacity * (0.55 + 0.7 * aSeed.x) * depthAlpha
           * mix(1.0, 0.65 * edge * nearness, landed) * (1.0 + 2.0 * shimmer * uSurfaceHighlightGain);
    vColor = col;
    // Size is expressed in CSS pixels; convert to drawing-buffer pixels exactly
    // once. Gentle perspective attenuation keeps near fragments fine, never orbs.
    float perspective = sqrt(28.0 / depth);
    float cssSize = clamp(uPointSize * (0.85 + 0.3 * aSeed.y) * perspective,
                          0.5, uPointSize * 1.25);
    gl_PointSize = cssSize * uPixelRatio * released;
    float gathered = gatherAmount(aSlot);
    if (gathered > 0.0) {
      // A few points stay as sparks that keep running along the closing line.
      float along = fract(aSlot.x + uThreadFlow * (0.7 + 0.6 * aSeed.z));
      gl_Position = gatherClip(gl_Position, aSlot, along, uFlow);
      float ends = smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.96, 1.0, along));
      vAlpha = mix(vAlpha, step(aSeed.y, 0.12) * ends * (0.45 + 0.55 * aSeed.x), gathered);
      vColor = mix(vColor, vec3(1.0), gathered);
      gl_PointSize *= 1.0 - 0.45 * gathered;
    }
  }
`,B=`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    float a = 1.0 - smoothstep(0.45, 1.0, d);
    gl_FragColor = vec4(vColor, vAlpha * a);
  }
`,V=`
  ${L}
  ${R}
  attribute vec2 aSlot;
  uniform float uTime;
  uniform float uFlow;
  uniform float uConvStart;
  uniform float uConvDur;
  uniform vec3 uSilver;
  uniform float uLineAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vSurfaceSlot;
  void main() {
    vec3 pos = position;
    pos.y += surfaceHeight(aSlot, uFlow) - surfaceHeight(aSlot, 0.0);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = gatherClip(projectionMatrix * mv, aSlot, aSlot.x, uFlow);
    // Reveal fine connecting lines only when the persistent particles approach
    // this very surface. Points remain visible; no replacement surface crossfade.
    float structure = smoothstep(uConvStart + uConvDur * 0.8, uConvStart + uConvDur + 1.2, uTime);
    float edge = smoothstep(0.0, 0.08, aSlot.x) * smoothstep(0.0, 0.08, 1.0 - aSlot.x);
    float nearness = 1.0 - smoothstep(18.0, 80.0, -mv.z) * 0.6;
    // On the closing line every strand reads at full length; a pulse brightens as it passes.
    // Once the ribbon has taken over, these lines bow out.
    float gathered = gatherAmount(aSlot);
    float shade = mix(mix(threadShade(aSlot.x, aSlot.y, uFlow), 0.7, uRibbonOn), 0.3, uOnJourney);
    vAlpha = structure * mix(edge * nearness, 1.0, gathered) * uLineAlpha * (0.16 + 0.72 * (1.0 - aSlot.y))
           * mix(1.0, shade * (1.0 + 4.0 * pulseAt(aSlot.x)), gathered) * (1.0 - uLineFade);
    vColor = uSilver;
    vSurfaceSlot = aSlot;
  }
`,H=`
  uniform float uFlow;
  uniform float uSurfaceHighlightGain;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vSurfaceSlot;
  void main() {
    // Original silver-glint formula, evaluated per fragment so the low-density
    // topology still carries a smooth travelling highlight rather than dots.
    float shimmer = pow(max(0.0, sin(vSurfaceSlot.x * 37.0 - uFlow * 0.9 + vSurfaceSlot.y * 11.0)), 16.0);
    gl_FragColor = vec4(vColor * (1.0 + 0.25 * shimmer * uSurfaceHighlightGain), vAlpha * (1.0 + 1.2 * shimmer * uSurfaceHighlightGain));
  }
`,U=`
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.11 + aSeed * 40.0), sin(uTime * 0.07 + aSeed * 23.0), cos(uTime * 0.09 + aSeed * 31.0)) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = (0.1 + 0.16 * fract(aSeed * 7.3)) * (1.0 - smoothstep(20.0, 110.0, -mv.z));
    gl_PointSize = (0.55 + 0.55 * fract(aSeed * 3.7)) * uPixelRatio;
  }
`,W=`
  uniform vec3 uSilver;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(uSilver, vAlpha * (1.0 - smoothstep(0.1, 0.5, length(c))));
  }
`,G=`
  attribute vec2 aGridUv;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = aGridUv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`,K=`
  uniform float uTime;
  uniform float uConvStart;
  uniform float uConvDur;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    float surface = smoothstep(uConvStart + uConvDur * 0.8, uConvStart + uConvDur + 2.0, uTime);
    float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(0.0, 0.1, 1.0-vUv.x)
               * smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.08, 1.0-vUv.y);
    float depth = 1.0 - smoothstep(45.0, 120.0, vDepth) * 0.65;
    gl_FragColor = vec4(vec3(0.478, 0.584, 0.686), mix(0.075, 0.012, surface) * edge * depth);
  }
`,q=n,J=e=>new p(parseInt(e.slice(1,3),16)/255,parseInt(e.slice(3,5),16)/255,parseInt(e.slice(5,7),16)/255);function Y(e,t){let n=new y;for(let[t,[r,i]]of Object.entries(e))n.setAttribute(t,new v(r,i));return t&&n.setIndex(new v(t,1)),n}var X=class{constructor(e,{quality:t=`low`,candles:n}={}){this.renderer=new b({canvas:e,antialias:!0,alpha:!1,powerPreference:`high-performance`}),this.renderer.setClearColor(q.background,1),this.scene=new g,this.camera=new h(36,16/9,.1,400),this.pose={pos:[0,0,0],tgt:[0,0,0],fov:36},this.aspect=16/9,this.uniforms={uTime:{value:0},uRevealTime:{value:0},uFlow:{value:0},uSurfaceHighlightGain:{value:1},uCandleSpacing:{value:l.spacing},uRevealStart:{value:c.revealStart},uRevealSlowDur:{value:c.revealSlowDur},uRevealFastDur:{value:c.revealFastDur},uFlyStart:{value:c.flyStart},uFlyDur:{value:c.flyDur},uDesatStart:{value:c.desatStart},uDesatDur:{value:c.desatDur},uDecoStart:{value:c.decoStart},uFractureHold:{value:c.fractureHold},uShardDuration:{value:c.shardDuration},uMorphDuration:{value:c.morphDuration},uDecoSweep:{value:c.decoSweep},uDecoJitter:{value:c.decoJitter},uSweepX:{value:new C(...c.sweep)},uUpColor:{value:J(q.up)},uDownColor:{value:J(q.down)},uSilver:{value:J(q.silver)},uBackground:{value:J(q.background)},uFogNear:{value:22},uFogFar:{value:120},uConvStart:{value:c.convStart},uConvSweep:{value:c.convSweep},uConvDur:{value:c.convDur},uPixelRatio:{value:1},uPointSize:{value:a},uPointOpacity:{value:.65},uLineAlpha:{value:.5},uSpread:{value:1},uCloudCenter:{value:new p(33,7.425,0)},uApproachAxis:{value:new p(0,0,1)},uClusterStrength:{value:1},uGather:{value:0},uThread:{value:new S(-1,0,1,0)},uThreadPx:{value:new C(.002,.002)},uThreadRise:{value:.3},uThreadBloom:{value:0},uThreadFlow:{value:0},uPulse:{value:-1},uRibbonOn:{value:0},uLineFade:{value:0},uJourney:{value:new S(-1,-1,2,1)},uOnJourney:{value:0},uRibbonFrame:{value:new S(0,0,1,1)},uRibbonShape:{value:new S(0,1,.1,0)},uRibbonTurn:{value:new S(0,0,0,2)},uRibbonAngle:{value:new C(1,0)}},this.threadFlow=0,this.lastElapsed=0,this.objects=[],this.candles=n,this.build(t)}build(e){this.clear();let t=r({candles:this.candles});this.field=t,this.uniforms.uSweepX.value.set(...t.sweep),this.uniforms.uCloudCenter.value.set(...t.cloudCenter);let{position:n,local:i,size:a,tone:o,kind:s,index:c}=t.mesh,l=Y({position:[n,3],aLocal:[i,2],aSize:[a,2],aTone:[o,1],aKind:[s,1]},c);this.chart=this.add(new x(l,new f({vertexShader:F,fragmentShader:I,uniforms:this.uniforms,side:2})));let u=O(t.mesh);this.shards=this.add(new x(Y({position:[u.position,3],aShardSeed:[u.seed,1],aShardCenter:[u.center,3],aTone:[u.tone,1]}),new f({vertexShader:N,fragmentShader:P,uniforms:this.uniforms,side:2}))),this.shards.visible=!1;let d=t.backgroundGrid;this.grid=this.add(new m(Y({position:[d.position,3],aGridUv:[d.uv,2]}),new f({vertexShader:G,fragmentShader:K,uniforms:this.uniforms,transparent:!0,depthWrite:!1,blending:1})),0);let p=t.particles,h=k(p,u);this.uniforms.uLineAlpha.value=.5*Math.sqrt(54/t.quality.lines);let g=Y({aShardCenter:[h.center,3],aShardSeed:[h.seed,1],position:[p.origin,3],originPosition:[p.origin,3],flightOffset:[p.flightOffset,3],targetPosition:[p.rest,3],originalColor:[p.originalColor,3],randomPhase:[p.randomPhase,1],aNormal:[p.normal,3],aClusterCenter:[p.clusterCenter,3],aClusterSpin:[p.clusterSpin,4],aSlot:[p.slot,2],aTone:[p.tone,1],aSeed:[p.seeds,4]}),v=t.surfaceLines,y=Y({position:[v.rest,3],aSlot:[v.slot,2]},v.segments),b={uniforms:this.uniforms,transparent:!0,depthWrite:!1,blending:2},S=Y({position:[t.dust.position,3],aSeed:[t.dust.seed,1]});this.dust=this.add(new _(S,new f({vertexShader:U,fragmentShader:W,...b})),1),this.dust.visible=!1,this.lines=this.add(new m(y,new f({vertexShader:V,fragmentShader:H,...b})),2),this.points=this.add(new _(g,new f({vertexShader:z,fragmentShader:B,...b,blending:1})),3)}add(e,t=0){return e.frustumCulled=!1,e.renderOrder=t,this.scene.add(e),this.objects.push(e),e}clear(){let e=new Set;for(let t of this.objects)e.add(t.geometry),t.material.dispose(),this.scene.remove(t);e.forEach(e=>e.dispose()),this.objects=[]}resize(e,t,n){this.renderer.setPixelRatio(n),this.renderer.setSize(e,t,!1),this.aspect=e/Math.max(1,t),this.camera.aspect=this.aspect,this.uniforms.uPixelRatio.value=n,this.camera.updateProjectionMatrix()}render(e,n={}){let r=e;e=s(r);let l=this.uniforms;l.uTime.value=e;let d=(o.candles-1)/(this.field.chart.length-1)*(c.revealSlowDur+c.revealFastDur)+1e-5;l.uRevealTime.value=Math.max(d,t(e)),l.uFlow.value=e,l.uSurfaceHighlightGain.value=1-.3*i(r).first,l.uSpread.value=n.spread??1,l.uPointSize.value=a,l.uPointOpacity.value=Math.max(.1,Math.min(.85,n.pointOpacity??.65)),l.uFogFar.value=120;let f=n.gather??0;l.uGather.value=f,n.thread&&l.uThread.value.set(...n.thread),n.threadPx&&l.uThreadPx.value.set(...n.threadPx),l.uThreadRise.value=n.threadRise??.3,l.uThreadBloom.value=n.threadBloom??0,l.uPulse.value=n.pulse??-1;let p=n.ribbon;l.uRibbonOn.value=p?.on??0,l.uLineFade.value=n.lineFade??0,l.uOnJourney.value=n.onJourney??0,n.journey&&l.uJourney.value.set(...n.journey),p?.frame&&(l.uRibbonFrame.value.set(...p.frame),l.uRibbonShape.value.set(...p.shape),l.uRibbonTurn.value.set(...p.turn),l.uRibbonAngle.value.set(...p.angle)),this.threadFlow=f>0?this.threadFlow+Math.max(0,r-this.lastElapsed)*.035*f**3:0,this.lastElapsed=r,l.uThreadFlow.value=this.threadFlow;let m=n.cameraPose??u(e,this.aspect,n,this.pose);if(!n.cameraPose&&r<o.duration){let e=Math.max(0,Math.min(1,(r-o.hold)/(o.approachEnd-o.hold))),t=e*e*e*(e*(e*6-15)+10),n=Math.exp(Math.log(o.distance)*(1-t));l.uFogFar.value=120+80*(1-t);for(let e=0;e<3;e++)m.pos[e]=m.tgt[e]+(m.pos[e]-m.tgt[e])*n}this.camera.position.set(m.pos[0],m.pos[1],m.pos[2]),this.camera.lookAt(m.tgt[0],m.tgt[1],m.tgt[2]),l.uApproachAxis.value.set(m.pos[0]-m.tgt[0],m.pos[1]-m.tgt[1],m.pos[2]-m.tgt[2]).normalize(),Math.abs(m.fov-this.camera.fov)>1e-4&&(this.camera.fov=m.fov,this.camera.updateProjectionMatrix());let h=c.decoStart+c.fractureHold,g=h+c.shardDuration+c.morphDuration;this.chart.visible=e<h,this.shards.visible=e>=h&&e<g,this.points.visible=e>=c.decoStart-.05,this.lines.visible=e>=c.convStart&&l.uLineFade.value<1,this.renderer.render(this.scene,this.camera)}stats(){let{particles:e,quality:t}=this.field,{memory:n,render:r}=this.renderer.info;return{particles:e.count,lines:t.lines,quality:t.label,calls:r.calls,geometries:n.geometries,programs:this.renderer.info.programs?.length??0}}dispose(){this.clear(),this.renderer.dispose(),this.renderer.forceContextLoss()}};export{X as MarketHeroScene};