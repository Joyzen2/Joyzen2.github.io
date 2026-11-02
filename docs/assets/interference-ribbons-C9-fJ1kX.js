import{a as e,r as t,t as n}from"./jsx-runtime-BsLBqpyP.js";import{S as r,_ as i,a,b as o,d as s,g as c,h as l,i as u,l as d,n as f,o as p,p as m,r as h,s as g,t as ee,u as _,v,x as te,y}from"./three.module-r4AQOhIb.js";var b=e(t(),1),x=n(),S=16,C=360,w=e=>{let t=window.matchMedia(`(prefers-reduced-motion: reduce)`);return t.addEventListener(`change`,e),()=>t.removeEventListener(`change`,e)},T=()=>typeof window<`u`&&window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,E=(e,t,n)=>Math.min(n,Math.max(t,e)),D=null,O=(e,t)=>{if(D||=document.createElement(`canvas`).getContext(`2d`),!D)return t;D.fillStyle=`#010203`,D.fillStyle=e;let n=String(D.fillStyle);if(n===`#010203`&&e.trim().toLowerCase()!==`#010203`)return t;if(n.startsWith(`#`)){let e=n.slice(1);return[parseInt(e.slice(0,2),16)/255,parseInt(e.slice(2,4),16)/255,parseInt(e.slice(4,6),16)/255]}let r=n.match(/[\d.]+/g);return!r||r.length<3?t:[Number(r[0])/255,Number(r[1])/255,Number(r[2])/255]},k=e=>e<=.04045?e/12.92:((e+.055)/1.055)**2.4,A=([e,t,n])=>{let r=k(e),i=k(t),a=k(n),o=Math.cbrt(.4122214708*r+.5363325363*i+.0514459929*a),s=Math.cbrt(.2119034982*r+.6806995451*i+.1073969566*a),c=Math.cbrt(.0883024619*r+.2817188376*i+.6299787005*a);return[.2104542553*o+.793617785*s-.0040720468*c,1.9779984951*o-2.428592205*s+.4505937099*c,.0259040371*o+.7827717662*s-.808675766*c]},ne=(e,t,n,r)=>n*(.62*Math.sin(e*r+t*.33+.4)+.26*Math.sin(e*r*1.93-t*.21+2.1)+.12*Math.sin(e*r*3.07+t*.47+4.2)),re=`
in vec2 aWire;
in vec2 aSample;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uTime;
uniform float uPulseTime;
uniform float uAngle;
uniform float uExtent;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uHalf;
uniform float uCurl;
uniform float uTwist;
uniform float uSpin;
uniform float uLineWidth;
uniform float uBack;
uniform float uStripes;
uniform float uFlow;
uniform float uEnergy;
uniform float uPulseSpeed;
uniform float uPulseStrength;
uniform float uInk;
uniform vec3 uLabDeep;
uniform vec3 uLabA;
uniform vec3 uLabB;
uniform vec4 uPulses[${S}];
out float vDist;
out float vHalfPx;
out vec3 vColor;
out float vGain;

vec3 labToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return max(vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ), 0.0);
}

vec3 palette(float s) {
  s = fract(s) * 3.0;
  vec3 lab = s < 1.0 ? mix(uLabDeep, uLabA, smoothstep(0.0, 1.0, s))
    : s < 2.0 ? mix(uLabA, uLabB, smoothstep(0.0, 1.0, s - 1.0))
    : mix(uLabB, uLabDeep, smoothstep(0.0, 1.0, s - 2.0));
  return labToLinear(lab);
}

float spine(float x) {
  float t = uTime;
  return uAmplitude * (0.62 * sin(x * uFrequency + t * 0.33 + 0.4)
    + 0.26 * sin(x * uFrequency * 1.93 - t * 0.21 + 2.1)
    + 0.12 * sin(x * uFrequency * 3.07 + t * 0.47 + 4.2));
}

vec3 wire(float x, float u, float seed, out float facing) {
  float t = uTime;
  float halfWidth = uHalf * (1.0 + 0.22 * sin(x * 0.61 - t * 0.19 + 1.3));
  float theta = uTwist * x + uSpin;
  float wobble = 0.4 * (sin(x * 2.3 + seed * 6.2831853 + t * 0.7) * 0.6 + sin(x * 3.9 - seed * 11.3 - t * 0.5) * 0.4);
  float xi = u + wobble * 0.05;
  float zeta = uCurl * (u * u - 1.0 / 3.0) + wobble * 0.07;
  float c = cos(theta);
  float s = sin(theta);
  float y = spine(x) + halfWidth * (xi * c - zeta * s);
  float z = xi * s + zeta * c;
  facing = clamp(0.5 + 0.5 * z, 0.0, 1.0);
  return vec3(x, y, z);
}

vec2 toScreen(vec2 p) {
  float unit = 0.5 * uResolution.y;
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  return vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y) * unit + 0.5 * uResolution;
}

void main() {
  float u = aWire.x;
  float seed = aWire.y;
  float x = mix(-uExtent, uExtent, aSample.x);
  float delta = 2.0 * uExtent / ${C}.0;
  float f0;
  float f1;
  float f2;
  vec3 p0 = wire(x - delta, u, seed, f0);
  vec3 p1 = wire(x, u, seed, f1);
  vec3 p2 = wire(x + delta, u, seed, f2);
  vec2 s0 = toScreen(p0.xy);
  vec2 s1 = toScreen(p1.xy);
  vec2 s2 = toScreen(p2.xy);
  vec2 tangent = normalize(s2 - s0 + vec2(1e-6, 0.0));
  vec2 normal = vec2(-tangent.y, tangent.x);
  float halfPx = uLineWidth * uPixelRatio * mix(0.3, 1.0, f1 * f1 * f1) * 0.5;
  float reach = halfPx * 2.2 + 1.5;
  vec2 position2 = s1 + normal * aSample.y * reach;
  vDist = aSample.y * reach;
  vHalfPx = halfPx;
  float light = 0.0;
  for (int k = 0; k < ${S}; k++) {
    vec4 pulse = uPulses[k];
    if (pulse.w <= 0.0) continue;
    float age = uPulseTime - pulse.y;
    if (age < 0.0 || age > 4.0) continue;
    float travel = age * uPulseSpeed;
    float front = abs(x - pulse.x) - travel + 0.05 * sin(u * 7.0 + pulse.y * 3.7) + (seed - 0.5) * 0.025;
    bool wave = pulse.w > 1.5;
    float along = front > 0.0 ? exp(-front * front / 0.0025) : exp(front / (wave ? 0.32 : 0.13));
    along += wave ? 0.0 : 0.45 * exp(-front * front / 0.0012);
    along *= smoothstep(0.0, 0.12, travel);
    float gap = (u - pulse.z) * 13.0;
    float across = wave ? 1.0 : 1.25 * exp(-gap * gap);
    light += along * across * exp(-age * 1.1);
  }
  light = min(light * uPulseStrength, 1.4);
  float tone = u * uStripes * 0.5 + x * 0.09 - uFlow;
  vec3 base = palette(tone);
  float lit = clamp(light, 0.0, 1.0);
  vec3 glowTint = mix(base, vec3(1.0, 0.95, 1.0), lit * 0.45);
  vec3 inkTint = mix(base, labToLinear(uLabDeep), lit * 0.7);
  vColor = mix(glowTint, inkTint, uInk);
  vGain = mix(uBack, 1.0, pow(f1, 1.5)) * (1.0 + light * mix(0.9, 2.2, uInk)) * (1.0 + uEnergy * 0.18);
  gl_Position = vec4(position2 / uResolution * 2.0 - 1.0, 0.0, 1.0);
}
`,j=`
precision highp float;
uniform float uCore;
in float vDist;
in float vHalfPx;
in vec3 vColor;
in float vGain;
out vec4 fragColor;

void main() {
  float sigma = max(vHalfPx, 0.55);
  float d = vDist / sigma;
  float energy = exp(-d * d) * min(vHalfPx / 0.55, 1.0) * vGain * uCore;
  fragColor = vec4(vColor * energy, energy);
}
`,ie=`
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,M=`
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 a = texture(uSource, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture(uSource, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture(uSource, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  fragColor = (a + b + c + d) * 0.125 + texture(uSource, vUv) * 0.5;
}
`,ae=`
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uBase;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 sum = texture(uSource, vUv) * 4.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 0.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 0.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, -1.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, 1.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, -1.0));
  sum += texture(uSource, vUv + uTexel * vec2(1.0, -1.0));
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 1.0));
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  fragColor = texture(uBase, vUv) + sum / 16.0;
}
`,oe=`
precision highp float;
uniform sampler2D uLines;
uniform sampler2D uBloom;
uniform vec3 uBackground;
uniform vec2 uResolution;
uniform float uGlow;
uniform float uExposure;
uniform float uMode;
uniform float uGrain;
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec4 lines = texture(uLines, vUv);
  vec4 bloom = texture(uBloom, vUv);
  vec3 color;
  if (uMode < 0.5) {
    vec3 light = (lines.rgb + bloom.rgb * uGlow) * uExposure;
    vec3 exposed = 1.0 - exp(-light);
    float peak = max(exposed.r, max(exposed.g, exposed.b));
    exposed = mix(exposed, vec3(peak), smoothstep(0.75, 1.0, peak) * 0.35);
    vec2 q = vUv - 0.5;
    q.x *= uResolution.x / uResolution.y;
    exposed *= 1.0 - 0.18 * smoothstep(0.35, 1.1, length(q));
    color = uBackground + (1.0 - uBackground) * exposed;
  } else {
    float energy = lines.a + bloom.a * uGlow * 0.2;
    vec3 hue = (lines.rgb + bloom.rgb * uGlow * 0.2) / max(energy, 1e-4);
    float cover = clamp(1.0 - exp(-energy * uExposure * 1.4), 0.0, 0.94);
    color = mix(uBackground, clamp(hue * 0.8, 0.0, 1.0), cover);
  }
  float grain = hash(gl_FragCoord.xy + uGrain * 311.0) - 0.5;
  fragColor = vec4(encode(color) + grain * (1.2 / 255.0), 1.0);
}
`,se=e=>{let t=new Float32Array(e*361*2*4),n=new Uint32Array(e*C*6),r=0,i=0,a=1,o=()=>(a=a*16807%2147483647,a/2147483647);for(let a=0;a<e;a++){let s=(a+.5)/e*2-1,c=o(),l=r/4;for(let e=0;e<=C;e++){let n=e/C;t.set([s,c,n,-1,s,c,n,1],r),r+=8}for(let e=0;e<C;e++){let t=l+e*2;n.set([t,t+1,t+2,t+1,t+3,t+2],i),i+=6}}let s=new h,c=new p(t,4);return s.setAttribute(`aWire`,new g(c,2,0)),s.setAttribute(`aSample`,new g(c,2,2)),s.setAttribute(`position`,new g(c,3,0)),s.setIndex(new f(n,1)),s},N=(e,t)=>{let n=document.createElement(`canvas`);n.setAttribute(`aria-hidden`,`true`),n.style.position=`absolute`,n.style.inset=`0`,n.style.width=`100%`,n.style.height=`100%`,n.style.display=`block`,n.style.pointerEvents=`none`,e.prepend(n);let f;try{f=new ee({canvas:n,alpha:!1,antialias:!1,powerPreference:`high-performance`})}catch{return n.remove(),null}if(!f.capabilities.isWebGL2)return f.dispose(),n.remove(),null;f.autoClear=!1;let p=f.extensions.has(`EXT_color_buffer_float`)||f.extensions.has(`EXT_color_buffer_half_float`)?a:v,g=new s(-1,1,1,-1,0,1),b=new m(2,2),x=Array.from({length:S},()=>new te(0,-100,0,0)),C=new i({glslVersion:u,uniforms:{uResolution:{value:new y(1,1)},uPixelRatio:{value:1},uTime:{value:0},uPulseTime:{value:0},uAngle:{value:0},uExtent:{value:2},uAmplitude:{value:.6},uFrequency:{value:1.55},uHalf:{value:.24},uCurl:{value:.25},uTwist:{value:1.6},uSpin:{value:0},uLineWidth:{value:1.6},uBack:{value:.35},uStripes:{value:2.2},uFlow:{value:0},uEnergy:{value:0},uPulseSpeed:{value:1.1},uPulseStrength:{value:1},uInk:{value:0},uLabDeep:{value:new o},uLabA:{value:new o},uLabB:{value:new o},uPulses:{value:x},uCore:{value:.85}},vertexShader:re,fragmentShader:j,depthTest:!1,depthWrite:!1,transparent:!0,side:2,blending:5,blendEquation:100,blendSrc:201,blendDst:201,blendSrcAlpha:201,blendDstAlpha:201}),w=(e,t)=>new i({glslVersion:u,uniforms:t,vertexShader:ie,fragmentShader:e,depthTest:!1,depthWrite:!1,blending:0}),T=w(M,{uSource:{value:null},uTexel:{value:new y}}),D=w(ae,{uSource:{value:null},uBase:{value:null},uTexel:{value:new y}}),N=w(oe,{uLines:{value:null},uBloom:{value:null},uBackground:{value:new o},uResolution:{value:new y(1,1)},uGlow:{value:.45},uExposure:{value:1.6},uMode:{value:0},uGrain:{value:0}}),P=0,F=new _(new h,C);F.frustumCulled=!1;let ce=new c;ce.add(F);let le=new _(b,N);le.frustumCulled=!1;let ue=new c;ue.add(le);let de=(e,t)=>new r(Math.max(1,e),Math.max(1,t),{type:p,format:l,minFilter:d,magFilter:d,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1}),I=null,L=[],R=[],fe=!1,z=0,B=0,V=!0,H=6,U=0,W=0,pe=0,G=0,K=!1,me=0,q=1,J=1,Y=1,he=0,X={x:-1e9,y:-1e9},ge=()=>{I?.dispose(),L.forEach(e=>e.dispose()),R.forEach(e=>e.dispose()),I=null,L=[],R=[]},_e=(e,t)=>{le.material=e,f.setRenderTarget(t),f.render(ue,g)},ve=()=>{let e=Math.round(E(t.current.wires,4,160));e!==P&&(P=e,F.geometry.dispose(),F.geometry=se(e))},Z=()=>{let e=t.current,n=E(e.angle,-180,180)*Math.PI/180,r=q/Math.max(J,1);return{angle:n,extent:(Math.abs(Math.cos(n))*r+Math.abs(Math.sin(n)))*1.08,frequency:1.55/E(e.waveLength,.2,5)}},ye=()=>{let e=t.current,n=C.uniforms,r=q*Y,i=J*Y,{angle:a,extent:o,frequency:s}=Z(),c=A(O(e.colors[0],[.42,.24,1])),l=A(O(e.colors[1],[.83,.42,1]));n.uResolution.value.set(r,i),n.uPixelRatio.value=Y,n.uTime.value=H,n.uPulseTime.value=U,n.uAngle.value=a,n.uExtent.value=o,n.uAmplitude.value=E(e.amplitude,0,1.5),n.uFrequency.value=s,n.uHalf.value=E(e.ribbonWidth,.02,.8),n.uCurl.value=E(e.curl,0,1.2),n.uTwist.value=E(e.twist,0,8),n.uSpin.value=W,n.uLineWidth.value=E(e.lineWidth,.4,6),n.uBack.value=1-E(e.depth,0,1),n.uStripes.value=E(e.stripes,0,12),n.uFlow.value=pe,n.uEnergy.value=G,n.uPulseSpeed.value=E(e.pulseSpeed,.1,5),n.uPulseStrength.value=E(e.pulseStrength,0,3);let u=O(e.backgroundColor,[.04,.04,.04]),d=.2126*u[0]+.7152*u[1]+.0722*u[2],f=e.mode===`ink`||e.mode===`auto`&&d>.5,p=f?.6:.42,m=f?1.15:.85;n.uInk.value=+!!f,n.uLabDeep.value.set(c[0]*p,c[1]*m,c[2]*m),n.uLabA.value.set(c[0],c[1],c[2]),n.uLabB.value.set(l[0],l[1],l[2]);let h=N.uniforms;h.uBackground.value.set(k(u[0]),k(u[1]),k(u[2])),h.uResolution.value.set(r,i),h.uGlow.value=E(e.glow,0,3),h.uExposure.value=1.6*E(e.intensity,0,4),h.uMode.value=+!!f,h.uGrain.value=he},be=()=>{if(!I||!L.length)return;ve(),ye(),f.setRenderTarget(I),f.setClearColor(0,0),f.clear(),f.render(ce,g);let e=I;for(let t of L)T.uniforms.uSource.value=e.texture,T.uniforms.uTexel.value.set(1/e.width,1/e.height),_e(T,t),e=t;let t=L[L.length-1];for(let e=L.length-2;e>=0;e--)D.uniforms.uSource.value=t.texture,D.uniforms.uBase.value=L[e].texture,D.uniforms.uTexel.value.set(1/t.width,1/t.height),_e(D,R[e]),t=R[e];N.uniforms.uLines.value=I.texture,N.uniforms.uBloom.value=t.texture,_e(N,null)},xe=e=>{let n=t.current,r=K&&n.interactive&&!n.reduced?E(n.hoverBoost,0,2):0;if(G+=(r-G)*(1-Math.exp(-e/.4)),U+=e,n.paused||n.reduced)return;let i=E(n.speed,-4,4)*(1+G*.35);H+=e*i,W+=e*i*E(n.spin,-4,4),pe+=e*i*E(n.colorFlow,-2,2),he=(he+.618034)%1},Se=()=>x.some(e=>e.w>0&&U-e.y<4),Ce=e=>{if(z=0,fe)return;let n=Math.min(.05,Math.max(0,(e-B)/1e3));B=e,xe(n),be();let r=t.current,i=!r.paused&&!r.reduced,a=K&&r.interactive&&!r.reduced?r.hoverBoost:0,o=Math.abs(G-a)>.002||Se();V&&!document.hidden&&(i||o)&&(z=requestAnimationFrame(Ce))},Q=()=>{fe||z||!V||(B=performance.now(),z=requestAnimationFrame(Ce))},we=()=>{let n=e.getBoundingClientRect();q=Math.max(1,n.width),J=Math.max(1,n.height),Y=Math.min(window.devicePixelRatio||1,2)*E(t.current.quality,.25,1),f.setPixelRatio(Y),f.setSize(q,J,!1);let r=Math.round(q*Y),i=Math.round(J*Y);ge(),I=de(r,i);let a=E(Math.floor(Math.log2(Math.min(r,i)/8)),3,7);for(let e=1;e<=a;e++)L.push(de(Math.max(1,r>>e),Math.max(1,i>>e))),R.push(de(Math.max(1,r>>e),Math.max(1,i>>e)));be(),Q()},Te=(e,t,n)=>{x[me].set(e,U,t,n),me=(me+1)%S,Q()},Ee=(t,n)=>{let r=e.getBoundingClientRect(),{angle:i}=Z(),a=.5*r.height,o=(t-r.left-r.width/2)/a,s=-(n-r.top-r.height/2)/a,c=Math.cos(i),l=Math.sin(i);return{x:c*o+l*s,y:-l*o+c*s}},De=e=>{let n=t.current;if(e.pointerType===`touch`||!n.interactive||(K||(K=!0,Q()),!n.hoverPulses||n.reduced)||Math.hypot(e.clientX-X.x,e.clientY-X.y)<50)return;let{frequency:r}=Z(),i=Ee(e.clientX,e.clientY),a=E(n.ribbonWidth,.02,.8)*(1+.22*Math.sin(i.x*.61-H*.19+1.3)),o=E(n.twist,0,8)*i.x+W,s=i.y-ne(i.x,H,E(n.amplitude,0,1.5),r),c=a*Math.max(Math.abs(Math.cos(o)),.12);if(Math.abs(s)>c+.03)return;X.x=e.clientX,X.y=e.clientY;let l=E(s/(a*Math.cos(o)||.001),-1,1);Te(i.x,l,1)},$=()=>{K=!1,X.x=-1e9,Q()},Oe=e=>{let n=t.current;if(e.button!==0||!n.interactive||!n.clickPulse||n.reduced)return;let r=Ee(e.clientX,e.clientY);Te(r.x,0,2)};e.addEventListener(`pointermove`,De),e.addEventListener(`pointerleave`,$),e.addEventListener(`pointercancel`,$),e.addEventListener(`pointerdown`,Oe);let ke=new ResizeObserver(we);ke.observe(e);let Ae=new IntersectionObserver(e=>{V=e.some(e=>e.isIntersecting),V&&Q()},{rootMargin:`80px`});Ae.observe(e);let je=()=>{document.hidden||Q()};document.addEventListener(`visibilitychange`,je);let Me=e=>e.preventDefault();return n.addEventListener(`webglcontextlost`,Me),we(),{sync:()=>{let e=Math.min(window.devicePixelRatio||1,2)*E(t.current.quality,.25,1);Math.abs(e-Y)>.001?we():be(),Q()},destroy:()=>{fe=!0,cancelAnimationFrame(z),e.removeEventListener(`pointermove`,De),e.removeEventListener(`pointerleave`,$),e.removeEventListener(`pointercancel`,$),e.removeEventListener(`pointerdown`,Oe),document.removeEventListener(`visibilitychange`,je),n.removeEventListener(`webglcontextlost`,Me),ke.disconnect(),Ae.disconnect(),ge(),F.geometry.dispose(),b.dispose(),[C,T,D,N].forEach(e=>e.dispose()),f.dispose(),f.forceContextLoss(),n.remove()},pulse:n=>{if(t.current.reduced)return;let r=e.getBoundingClientRect(),i=Ee(r.left+E(n,0,1)*r.width,r.top+r.height/2);Te(i.x,0,2)},state:()=>({clock:H,spin:W})}},P=(0,b.forwardRef)(function({colors:e=[`#6B3CFF`,`#D46BFF`],backgroundColor:t=`#0A0A0A`,mode:n=`auto`,wires:r=64,lineWidth:i=1.6,ribbonWidth:a=.24,amplitude:o=.6,waveLength:s=1,angle:c=42,twist:l=1.6,curl:u=.25,depth:d=.65,stripes:f=2.2,colorFlow:p=.04,glow:m=.45,intensity:h=1,speed:g=.7,spin:ee=.35,interactive:_=!0,hoverPulses:v=!0,clickPulse:te=!0,pulseSpeed:y=1.1,pulseStrength:S=1,hoverBoost:C=1,paused:E=!1,quality:D=1,className:O,style:k,children:A},ne){let re=(0,b.useRef)(null),j=(0,b.useRef)(null),ie=(0,b.useSyncExternalStore)(w,T,()=>!1),M=(0,b.useRef)({colors:e,backgroundColor:t,mode:n,wires:r,lineWidth:i,ribbonWidth:a,amplitude:o,waveLength:s,angle:c,twist:l,curl:u,depth:d,stripes:f,colorFlow:p,glow:m,intensity:h,speed:g,spin:ee,interactive:_,hoverPulses:v,clickPulse:te,pulseSpeed:y,pulseStrength:S,hoverBoost:C,paused:E,quality:D,reduced:ie});return(0,b.useEffect)(()=>{M.current={colors:e,backgroundColor:t,mode:n,wires:r,lineWidth:i,ribbonWidth:a,amplitude:o,waveLength:s,angle:c,twist:l,curl:u,depth:d,stripes:f,colorFlow:p,glow:m,intensity:h,speed:g,spin:ee,interactive:_,hoverPulses:v,clickPulse:te,pulseSpeed:y,pulseStrength:S,hoverBoost:C,paused:E,quality:D,reduced:ie},j.current?.sync()}),(0,b.useEffect)(()=>{let e=re.current;if(!e)return;let t=N(e,M);return j.current=t,()=>{t?.destroy(),j.current=null}},[]),(0,b.useImperativeHandle)(ne,()=>({pulse:(e=.5)=>j.current?.pulse(e),state:()=>j.current?.state()??null}),[]),(0,x.jsx)(`div`,{ref:re,className:O,style:{position:`relative`,isolation:`isolate`,height:`100%`,minHeight:240,width:`100%`,overflow:`hidden`,backgroundColor:t,...k},children:A&&(0,x.jsx)(`div`,{style:{position:`relative`,zIndex:10,height:`100%`,width:`100%`},children:A})})});P.displayName=`InterferenceRibbons`;export{P as InterferenceRibbons,P as default};