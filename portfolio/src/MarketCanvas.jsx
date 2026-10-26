import { useEffect, useRef } from 'react';

// All geometry is conceptual. No trajectory represents market observations.
export default function MarketCanvas({ variant, paused, onFallback, onStageChange }) {
  const canvasRef = useRef(null);
  const clock = useRef(2.5);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { onFallback?.(); return; }
    const host = canvas.closest('section');
    let w = 1, h = 1, frame, last = 0, onscreen = true, lastStage = '';
    const pointer = { x: .7, y: .48, tx: .7, ty: .48, active: false };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const tau = Math.PI * 2;
    function background() {
      ctx.fillStyle = '#0a1b30';ctx.fillRect(0, 0, w, h);
      const wash = ctx.createRadialGradient(w*.72,h*.5,0,w*.72,h*.5,w*.64);
      wash.addColorStop(0, '#122f4b');wash.addColorStop(1, '#0a1b30');
      ctx.fillStyle=wash;ctx.fillRect(0,0,w,h);
    }
    function stroke(points, color, width=1) {
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
    }
    function node(x,y, radius=4) {
      ctx.beginPath();ctx.arc(x,y,radius+8,0,tau);ctx.strokeStyle='rgba(232,115,86,.35)';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,radius,0,tau);ctx.fillStyle='#f18c70';ctx.fill();
    }
    function surface(t) {
      const mobile=w<700;
      const cx=w*(mobile?.63:.76),cy=h*.51;
      const scale=Math.min(w*(mobile?.29:.255),h*.46);
      const cycle=(t%10)/10;
      const radius=.18+cycle*4.5;
      const envelope=Math.sin(Math.PI*cycle)**1.3;
      const angle=-.43;
      function project(u,v) {
        const r=Math.hypot(u-.35,v+.15);
        const pulse=Math.exp(-((r-radius)**2)/.19)*envelope;
        const local=pointer.active?Math.exp(-((u-(pointer.x-.65)*4)**2+(v-(pointer.y-.5)*4)**2)*2)*.17:0;
        const z=.13*Math.sin(u*1.1+t*.18)*Math.cos(v*.8)+pulse*.57+local;
        const xx=u*Math.cos(angle)-v*Math.sin(angle);
        const yy=u*Math.sin(angle)+v*Math.cos(angle);
        return [cx+xx*scale*.88,cy+yy*scale*.36-z*scale*.93];
      }
      const rows=mobile?47:77, cols=mobile?110:160;
      for(let j=0;j<rows;j++) {
        const v=-2.15+4.3*j/(rows-1),points=[];
        for(let i=0;i<cols;i++)points.push(project(-2.6+5.2*i/(cols-1),v));
        const a=.24+.32*Math.sin(Math.PI*j/(rows-1));
        stroke(points,`rgba(152,189,216,${a})`,.65);
      }
      for(let j=0;j<34;j++) {
        const u=-2.6+5.2*j/33,points=[];
        for(let i=0;i<85;i++)points.push(project(u,-2.15+4.3*i/84));
        stroke(points,'rgba(102,148,185,.2)',.55);
      }
      const seam=[];
      for(let i=0;i<180;i++)seam.push(project(-2.6+5.2*i/179,-.15));
      stroke(seam,'rgba(236,120,92,.85)',1.25);
      const point=project(.35,-.15);node(...point,3.7);
      if(cycle<.82) {
        const ring=[];
        for(let i=0;i<=180;i++){const a=i/180*tau;ring.push(project(.35+radius*Math.cos(a),-.15+radius*Math.sin(a)));}
        stroke(ring,`rgba(236,120,92,${envelope*.6})`,1);
      }
    }
    function paths(t) {
      const mobile=w<700, ymid=h*(mobile?.65:.66), span=h*(mobile?.14:.17);
      const eventX=w*.5;
      const phase=t%14;
      const stage=phase<3?'before':phase<5?'release':phase<12?'after':'before';
      if(stage!==lastStage){lastStage=stage;onStageChange?.(stage);}
      const emergence=Math.min(Math.max((phase-3)/2.7,0),1);
      const fadeBack=phase>12?(1+Math.cos((phase-12)/2*Math.PI))/2:1;
      const reaction=(1-Math.pow(1-emergence,3))*fadeBack;
      const left=-w*.08, right=w*1.08;
      const n=mobile?29:43;
      const highlight=Math.floor(n*.55);
      function pathY(x,f){
        const d=(x-eventX)/w;
        const spread=1/(1+Math.exp(-d*19));
        return ymid+(f-.5)*span*(.45+spread*(.65+reaction*2.0))
          +Math.sin(x/w*5.3+t*.16+f*2.4)*span*.13
          +Math.exp(-((d-.09)**2)/.026)*Math.sin(f*9+t*.24)*span*.15*reaction;
      }
      for(let j=0;j<n;j++) {
        const f=j/(n-1),points=[];
        for(let i=0;i<190;i++) {
          const x=left+(right-left)*i/189;
          points.push([x,pathY(x,f)]);
        }
        stroke(points,j===highlight?'#ed876b':`rgba(151,187,214,${.23+.3*Math.sin(f*Math.PI)})`,j===highlight?1.8:.8);
      }
      const y=pathY(eventX,highlight/(n-1));
      ctx.setLineDash([3,6]);
      stroke([[eventX,h*(mobile?.59:.615)],[eventX,y-15]],'rgba(203,169,153,.48)',.8);
      stroke([[eventX,y+16],[eventX,h*(mobile?.77:.803)]],'rgba(203,169,153,.4)',.8);
      ctx.setLineDash([]);
      node(eventX,y,4);
      if(phase>=3&&phase<6){
        const pulse=(phase-3)/3;
        ctx.beginPath();ctx.ellipse(eventX,y,15+pulse*70,15+pulse*70,0,0,tau);
        ctx.strokeStyle=`rgba(235,126,98,${(1-pulse)*.65})`;ctx.lineWidth=1;ctx.stroke();
      }
      if(phase<3){
        const x=w*(.18+phase/3*.32);
        ctx.beginPath();ctx.arc(x,pathY(x,highlight/(n-1)),2.7,0,tau);ctx.fillStyle='#f2c4b1';ctx.fill();
      }
    }
    function constraints(t) {
      const mobile=w<700,cx=w*(mobile?.53:.36),cy=h*(mobile?.63:.52);
      const radius=Math.min(w*(mobile?.59:.3),h*.43);
      const turn=t*.055;
      const ca=Math.cos(-.45),sa=Math.sin(-.45);
      function p(a,r) {
        const distortion=1+.095*Math.sin(a*3+turn)+.05*Math.sin(a*5-turn);
        const x=Math.cos(a)*r*distortion,y=Math.sin(a)*r*.64*distortion;
        return [cx+(x*ca-y*sa)*radius,cy+(x*sa+y*ca)*radius];
      }
      for(let j=0;j<50;j++) {
        const r=.12+j/49*1.13,points=[];
        for(let i=0;i<=200;i++) points.push(p(i/200*tau,r));
        stroke(points,j===32?'rgba(232,129,99,.8)':`rgba(141,180,210,${.18+.36*j/49})`,j===32?1.25:.7);
      }
      for(let k=0;k<3;k++) {
        const phase=turn*(k%2?-1:1)+k*tau/3;
        const [x,y]=p(phase,.12+32/49*1.13);
        node(x,y,k===0?4:2.3);
      }
      const axis=[p(turn,.07),p(turn+Math.PI,1.25)];
      stroke(axis,'rgba(163,193,216,.3)',.6);
    }
    function draw(t) {
      background();
      pointer.x+=(pointer.tx-pointer.x)*.065;pointer.y+=(pointer.ty-pointer.y)*.065;
      if(variant==='paths') paths(t);
      else if(variant==='constraint') constraints(t);
      else surface(t);
    }
    function resize() {
      const bounds=host.getBoundingClientRect();w=bounds.width;h=bounds.height;
      const dpr=Math.min(devicePixelRatio||1,1.5);
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);draw(clock.current||2.5);
    }
    function loop(now) {
      frame=requestAnimationFrame(loop);
      if(now-last<33)return;
      const dt=Math.min((now-last)/1000,.05);last=now;
      if(paused||reduce.matches||document.hidden||!onscreen)return;
      clock.current+=dt;draw(clock.current);
    }
    function move(e) {const r=host.getBoundingClientRect();pointer.tx=(e.clientX-r.left)/r.width;pointer.ty=(e.clientY-r.top)/r.height;pointer.active=true;}
    function leave(){pointer.active=false;}
    const size=new ResizeObserver(resize);size.observe(host);
    const visibility=new IntersectionObserver(([entry])=>{onscreen=entry.isIntersecting;});visibility.observe(host);
    const change=()=>draw(clock.current||2.5);reduce.addEventListener('change',change);
    host.addEventListener('pointermove',move);host.addEventListener('pointerleave',leave);
    resize();frame=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(frame);size.disconnect();visibility.disconnect();reduce.removeEventListener('change',change);host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',leave);};
  },[variant,paused,onFallback,onStageChange]);
  return <canvas ref={canvasRef} className="market-canvas" aria-hidden="true" />;
}
