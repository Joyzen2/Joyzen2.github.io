import { useEffect, useState } from 'react';
import { QUALITY, CANDLE_COUNT, PARTICLES_PER_CANDLE, PARTICLE_SIZE } from './market-data.js';
import { DURATION, STAGES, stageAt } from './timeline.js';
import './debug-panel.css';

const VIEW = { yaw: -15.5, pitch: 0, dolly: 0.8, spread: 1.5, pointSize: PARTICLE_SIZE, pointOpacity: 0.65 };

/** Development-only controls; the production homepage never renders this. */
export default function DebugPanel({ api, initialOpen = false }) {
  const [snap, setSnap] = useState(null);
  const [open, setOpen] = useState(initialOpen);
  const [view, setView] = useState(VIEW);
  const [loop, setLoop] = useState(null);

  useEffect(() => {
    const id = setInterval(() => { const state = api.current?.getState(); if (state) setSnap(state); }, 100);
    return () => clearInterval(id);
  }, [api]);

  function loopStage(stage) {
    setLoop(stage?.id ?? null);
    if (stage) api.current?.setLoop([stage.start, stage.end]);
    else { api.current?.setLoop(null); api.current?.replay(); }
  }
  function updateView(patch) {
    setView(current => ({ ...current, ...patch }));
    api.current?.setView(patch);
  }

  useEffect(() => {
    function key(event) {
      if (event.target.closest?.('input:not([type=range]), select, textarea, [contenteditable=true]')) return;
      if (event.code === 'Space') { event.preventDefault(); api.current?.toggle(); }
      else if (event.key === 'r' || event.key === 'R') { setLoop(null); api.current?.replay(); }
      else if (event.key === 'd' || event.key === 'D') setOpen(value => !value);
      else if (/^[1-9]$/.test(event.key)) STAGES[Number(event.key) - 1] && loopStage(STAGES[Number(event.key) - 1]);
      else if (event.key === '0') loopStage(null);
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!open) return <button className="debug-toggle" onClick={() => setOpen(true)}>调试 D</button>;
  const time = snap?.time ?? 0;
  const stage = stageAt(time);
  return <aside className="debug-panel" aria-label="调试面板">
    <div className="debug-head"><strong>调试面板</strong><button onClick={() => setOpen(false)}>收起 D</button></div>

    <div className="debug-row">
      <button onClick={() => { setLoop(null); api.current?.replay(); }}>重播 R</button>
      <button onClick={() => api.current?.toggle()}>{snap?.playing ? '暂停' : '继续'} 空格</button>
      <select value={snap?.speed ?? 1} onChange={event => api.current?.setSpeed(Number(event.target.value))} aria-label="播放速度">
        {[0.25, 0.5, 1, 2].map(speed => <option key={speed} value={speed}>{speed}×</option>)}
      </select>
    </div>

    <label className="debug-field">
      <span>时间轴 <b>{time.toFixed(2)} s · {stage.label}</b></span>
      <input type="range" min="0" max={DURATION + 5} step="0.01" value={Math.min(time, DURATION + 5)} onChange={event => { api.current?.pause(); api.current?.seek(Number(event.target.value)); }} />
    </label>

    <div className="debug-field"><span>单独查看阶段（循环）</span>
      <div className="debug-stages">
        {STAGES.map((s, i) => <button key={s.id} className={loop === s.id ? 'is-active' : ''} onClick={() => loopStage(s)}>{i + 1} {s.label}</button>)}
        <button className={loop === null ? 'is-active' : ''} onClick={() => loopStage(null)}>0 全程</button>
      </div>
    </div>

    <div className="debug-field"><span>镜头 · 叠加调节</span>
      <span>01 基准：水平 −30° · 俯仰 0° · 距离 1.4×</span>
      <Slider label="水平角" min={-45} max={45} step={0.5} value={view.yaw} unit="°" onChange={yaw => updateView({ yaw })} />
      <Slider label="俯仰" min={-20} max={25} step={0.5} value={view.pitch} unit="°" onChange={pitch => updateView({ pitch })} />
      <Slider label="距离" min={0.6} max={1.6} step={0.01} value={view.dolly} unit="×" onChange={dolly => updateView({ dolly })} />
    </div>

    <div className="debug-field"><span>星尘质感</span>
      <span>粒子大小：{PARTICLE_SIZE} CSS px（固定）</span>
      <Slider label="粒子透明度" min={0.1} max={0.85} step={0.01} value={view.pointOpacity} unit="" onChange={pointOpacity => updateView({ pointOpacity })} />
    </div>

    <Slider label="粒子扩散幅度" min={0} max={2} step={0.01} value={view.spread} unit="×" onChange={spread => updateView({ spread })} />

    <div className="debug-field"><span>曲面精细度：低 · {QUALITY.low.lines} 条曲线（固定）</span>
      <span>粒子 {CANDLE_COUNT * PARTICLES_PER_CANDLE} 颗</span>
    </div>

    <div className="debug-row"><button onClick={() => { setView(VIEW); api.current?.setView(VIEW); }}>镜头与粒子复位</button></div>
    <p className="debug-stats">{snap ? `${snap.fps || '—'} fps · DPR ${snap.dpr} · 粒子 ${snap.particles?.toLocaleString?.() ?? '—'} · 曲线 ${snap.lines ?? '—'} 条 · draw ${snap.calls ?? '—'}` : '载入中…'}</p>
  </aside>;
}

function Slider({ label, min, max, step, value, unit, onChange }) {
  return <label className="debug-slider">
    <span>{label} <b>{Number(value).toFixed(step < 0.1 ? 2 : 1)}{unit}</b></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
  </label>;
}
