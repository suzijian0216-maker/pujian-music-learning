import { useEffect, useRef, useState } from 'react';
import { detectPitch, pitchName, standardDeviation } from '../lib/pitch';
import { freqOf } from '../lib/notes';
import type { Settings } from '../lib/storage';

interface Reading { frequency: number; name: string; cents: number; clarity: number; db: number; clipped: boolean; pitchSpread: number | null; volumeSpread: number | null }
interface Point { time: number; midi: number | null }
interface Capture { context: AudioContext; stream: MediaStream; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; frame: number }
const STRINGS = ['G3', 'D4', 'A4', 'E5'];
function prepare(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null;
  const scale = window.devicePixelRatio || 1;
  const width = canvas.clientWidth; const height = canvas.clientHeight;
  if (!width || !height) return null;
  if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) { canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale); }
  const pen = canvas.getContext('2d'); if (!pen) return null;
  pen.setTransform(scale, 0, 0, scale, 0, 0); pen.clearRect(0, 0, width, height);
  return { pen, width, height };
}

export function LiveSound({ settings }: { settings: Settings }) {
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('点击开始，允许麦克风后，一次拉一个音。');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState('');
  const [target, setTarget] = useState('auto');
  const [reading, setReading] = useState<Reading | null>(null);
  const [level, setLevel] = useState(-80);
  const [sampleRate, setSampleRate] = useState(0);
  const capture = useRef<Capture | null>(null);
  const generation = useRef(0);
  const opening = useRef<AudioContext | null>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  const spectrum = useRef<HTMLCanvasElement>(null);
  const trace = useRef<HTMLCanvasElement>(null);
  const currentSettings = useRef({ a4: settings.a4, target });
  currentSettings.current = { a4: settings.a4, target };

  function stop() {
    generation.current++;
    const waiting = opening.current; opening.current = null;
    if (waiting && waiting.state !== 'closed') void waiting.close().catch(() => {});
    const active = capture.current; capture.current = null;
    if (active) { cancelAnimationFrame(active.frame); active.stream.getTracks().forEach((track) => track.stop()); active.source.disconnect(); active.analyser.disconnect(); void active.context.close().catch(() => {}); }
  }
  useEffect(() => () => stop(), []);

  async function start() {
    stop(); const token = generation.current;
    setPending(true); setReading(null); setMessage('等待麦克风授权…');
    let localContext: AudioContext | null = null; let localStream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('此浏览器无法使用麦克风，请通过 localhost 或 HTTPS 在新版浏览器中打开。');
      const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      localContext = new Constructor(); opening.current = localContext; await localContext.resume();
      if (token !== generation.current) { if (localContext.state !== 'closed') await localContext.close(); return; }
      localStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: device ? { exact: device } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (token !== generation.current) { localStream.getTracks().forEach((track) => track.stop()); if (localContext.state !== 'closed') await localContext.close(); return; }
      const context = localContext, stream = localStream;
      const analyser = context.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0.65;
      const source = context.createMediaStreamSource(stream); source.connect(analyser);
      const active: Capture = { context, stream, source, analyser, frame: 0 }; capture.current = active; opening.current = null;
      setPending(false); setRunning(true); setSampleRate(context.sampleRate); setMessage('正在聆听 · 不播放麦克风声音，避免啸叫');
      void navigator.mediaDevices.enumerateDevices().then((items) => { if (token === generation.current) setDevices(items.filter((item) => item.kind === 'audioinput')); }).catch(() => {});
      stream.getAudioTracks()[0]?.addEventListener('ended', () => { if (token === generation.current) { stop(); setRunning(false); setReading(null); setMessage('麦克风已断开，请重新选择设备并开始。'); } });
      context.onstatechange = () => { if (token === generation.current && context.state !== 'running') { stop(); setRunning(false); setReading(null); setMessage('音频采集已暂停，请回到页面重新开始。'); } };
      const samples = new Float32Array(analyser.fftSize); const frequencies = new Float32Array(analyser.frequencyBinCount);
      let lastAnalysis = 0; let smooth: number[] = []; let history: Point[] = [];
      let stable: Array<{ time: number; pitch: number; db: number }> = []; let lastMidi: number | null = null;
      let center = 69; let referenceKey = '';
      const draw = (now: number) => {
        if (token !== generation.current) return;
        analyser.getFloatTimeDomainData(samples);
        const nextKey = `${currentSettings.current.a4}/${currentSettings.current.target}`;
        if (nextKey !== referenceKey) { stable = []; smooth = []; history = []; lastMidi = null; referenceKey = nextKey; }
        if (now - lastAnalysis >= 90) {
          lastAnalysis = now;
          let energy = 0, clipped = 0; for (const value of samples) { energy += value * value; if (Math.abs(value) >= 0.98) clipped++; }
          const db = Math.max(-80, 20 * Math.log10(Math.max(1e-8, Math.sqrt(energy / samples.length)))); setLevel(db);
          const pitch = detectPitch(samples, context.sampleRate);
          if (pitch) {
            smooth.push(pitch.frequency); if (smooth.length > 5) smooth.shift();
            const median = [...smooth].sort((a, b) => a - b)[Math.floor(smooth.length / 2)];
            const note = pitchName(median, currentSettings.current.a4);
            const fixed = currentSettings.current.target;
            const cents = fixed === 'auto' ? note.cents : 1200 * Math.log2(median / freqOf(fixed, currentSettings.current.a4));
            if (lastMidi !== note.midi) stable = [];
            lastMidi = note.midi;
            // Statistics use unsmoothed detections to avoid hiding real fluctuations.
            const rawMidi = 69 + 12 * Math.log2(pitch.frequency / currentSettings.current.a4);
            stable.push({ time: now, pitch: rawMidi * 100, db }); stable = stable.filter((item) => now - item.time <= 2000);
            const enough = stable.length >= 12 && now - stable[0].time >= 1200;
            center = fixed === 'auto' ? note.midi : pitchName(freqOf(fixed, currentSettings.current.a4), currentSettings.current.a4).midi;
            setReading({ frequency: median, name: note.name, cents, clarity: pitch.clarity, db, clipped: clipped > 2, pitchSpread: enough ? standardDeviation(stable.map((item) => item.pitch)) : null, volumeSpread: enough ? standardDeviation(stable.map((item) => item.db)) : null });
            history.push({ time: now, midi: note.midiFloat });
          } else { setReading(null); smooth = []; stable = []; lastMidi = null; history.push({ time: now, midi: null }); }
          history = history.filter((item) => now - item.time <= 8000);
        }
        const w = prepare(wave.current);
        if (w) {
          const { pen, width, height } = w; pen.strokeStyle = '#ddd4c3'; pen.beginPath(); pen.moveTo(0, height / 2); pen.lineTo(width, height / 2); pen.stroke();
          pen.strokeStyle = '#b0522f'; pen.lineWidth = 1.5; pen.beginPath();
          // Fixed scale; no auto gain, so amplitude changes stay visible.
          for (let x = 0; x < width; x++) { const y = height / 2 - samples[Math.floor(x / width * samples.length)] * height * 0.45; if (x === 0) pen.moveTo(x, y); else pen.lineTo(x, y); } pen.stroke();
        }
        const s = prepare(spectrum.current);
        if (s) {
          analyser.getFloatFrequencyData(frequencies);
          const { pen, width, height } = s; pen.fillStyle = '#3c7455';
          const maxHz = Math.min(8000, context.sampleRate / 2); const bins = 100;
          for (let i = 0; i < bins; i++) {
            const low = 65 * (maxHz / 65) ** (i / bins), high = 65 * (maxHz / 65) ** ((i + 1) / bins);
            let peak = -100;
            for (let b = Math.max(1, Math.floor(low * analyser.fftSize / context.sampleRate)); b <= Math.min(frequencies.length - 1, Math.ceil(high * analyser.fftSize / context.sampleRate)); b++) peak = Math.max(peak, frequencies[b]);
            const size = Math.max(0, Math.min(1, (peak + 90) / 90)) * (height - 22); pen.fillRect(i * width / bins, height - 22 - size, Math.max(1, width / bins - 1), size);
          }
          pen.fillStyle = '#8b8578'; pen.font = '11px sans-serif';
          [100, 440, 1000, 4000].forEach((hz) => pen.fillText(`${hz} Hz`, Math.log(hz / 65) / Math.log(maxHz / 65) * (width - 40), height - 4));
        }
        const t = prepare(trace.current);
        if (t) {
          const { pen, width, height } = t;
          const yFor = (midi: number) => height / 2 - (midi - center) / 2 * (height - 32) / 2;
          pen.font = '11px sans-serif';
          [-100, -50, 0, 50, 100].forEach((cents) => { const y = yFor(center + cents / 100); pen.strokeStyle = cents === 0 ? '#3c7455' : '#ddd4c3'; pen.beginPath(); pen.moveTo(0, y); pen.lineTo(width, y); pen.stroke(); pen.fillStyle = '#8b8578'; pen.fillText(`${cents > 0 ? '+' : ''}${cents} 音分`, 4, y - 3); });
          pen.strokeStyle = '#b0522f'; pen.lineWidth = 2; pen.beginPath(); let connected = false;
          for (const point of history) {
            if (point.midi === null || Math.abs(point.midi - center) > 2) { connected = false; continue; }
            const x = width * (1 - (now - point.time) / 8000), y = yFor(point.midi);
            if (!connected) pen.moveTo(x, y); else pen.lineTo(x, y); connected = true;
          } pen.stroke();
        }
        active.frame = requestAnimationFrame(draw);
      };
      active.frame = requestAnimationFrame(draw);
    } catch (error) {
      localStream?.getTracks().forEach((track) => track.stop());
      if (localContext && localContext.state !== 'closed') void localContext.close().catch(() => {});
      if (token !== generation.current) return;
      stop(); setPending(false); setRunning(false);
      const name = (error as Error).name;
      setMessage(name === 'NotAllowedError' ? '麦克风权限被拒绝。可在地址栏网站设置中允许麦克风后重试；也可继续使用听音练习和电脑键盘。' : name === 'NotFoundError' ? '没有找到麦克风，请连接设备后重试。' : name === 'NotReadableError' ? '无法打开麦克风，请检查设备连接，以及是否被其他程序占用。' : name === 'OverconstrainedError' ? '所选麦克风不可用，请选择默认设备后重试。' : `无法开始：${(error as Error).message}`);
    }
  }
  const good = reading && Math.abs(reading.cents) <= 10;
  return <>
    <div className="topline"><div><h1>拉奏分析</h1><div className="sub">听见你拉的音，也看见声音的变化 · 单音分析</div></div><span className="pill">A4 = {settings.a4} Hz</span></div>
    <section className="card"><div className="capture-controls"><label>麦克风<select aria-label="麦克风" value={device} disabled={running || pending} onChange={(e) => setDevice(e.target.value)}><option value="">系统默认设备</option>{devices.map((item, i) => <option key={item.deviceId || i} value={item.deviceId}>{item.label || `麦克风 ${i + 1}`}</option>)}</select></label><label>音准参照<select aria-label="音准参照" value={target} onChange={(e) => { setTarget(e.target.value); setReading(null); }}><option value="auto">自动识别最近音</option>{STRINGS.map((note) => <option key={note} value={note}>{note} 空弦</option>)}</select></label><button className="btn btn-primary" onClick={() => { if (running || pending) { stop(); setRunning(false); setPending(false); setReading(null); setLevel(-80); setMessage('已停止，麦克风已释放。'); } else void start(); }}>{pending ? '取消等待' : running ? '■ 停止聆听' : '开始麦克风'}</button></div><p className="hint" role="status">{message}</p><div className="level-track" aria-label={`输入电平 ${Math.round(level)} dBFS`}><i style={{ width: `${Math.max(0, (level + 80) / 80 * 100)}%` }} /></div><div className="sub">输入电平 {running ? `${Math.round(level)} dBFS` : '—'}{sampleRate ? ` · 采样率 ${sampleRate} Hz` : ''} · 音频仅在本机分析，不录音、不上传</div></section>
    <div className="grid cols-2 mt"><section className="card pitch-card"><h2>正在拉什么音</h2><div className="live-note">{reading?.name ?? '—'}</div><div>{reading ? `${reading.frequency.toFixed(1)} Hz · 周期相关度 ${reading.clarity.toFixed(2)}` : running ? level < -48 ? '声音较轻，请靠近麦克风或开始拉奏' : '未识别到稳定单音，请一次拉一根弦' : '等待开始聆听'}</div><div className={`live-cents ${good ? 'in-tune' : ''}`}>{reading ? `${reading.cents >= 0 ? '+' : ''}${reading.cents.toFixed(1)} 音分 · ${good ? '接近参照音' : reading.cents > 0 ? '偏高' : '偏低'}` : '— 音分'}</div><div className="tuner-scale"><span>偏低</span><span>准</span><span>偏高</span>{reading && <i style={{ left: `${50 + Math.max(-50, Math.min(50, reading.cents))}%` }} />}</div><p className="hint">参照：{target === 'auto' ? '最近的十二平均律音高' : target}。自动模式下 ±50 音分是最近音的范围，不是合格标准；揉弦时读数会摆动。</p>{reading?.clipped && <p role="alert" className="danger">输入出现削波，请降低输入增益或稍微远离麦克风。</p>}</section>
    <section className="card"><h2>长音控制参考</h2><p className="sub">持续同一音约 1.2 秒后，统计最近 2 秒的原始检测值。</p><div className="sound-metric"><span>音高波动（标准差）</span><strong>{reading?.pitchSpread != null ? `${reading.pitchSpread.toFixed(1)} 音分` : '等待长音'}</strong></div><div className="sound-metric"><span>电平波动（标准差）</span><strong>{reading?.volumeSpread != null ? `${reading.volumeSpread.toFixed(1)} dB` : '等待长音'}</strong></div><p className="hint">适用于不揉弦、等力度长音。数值较小只表示更稳定；揉弦、换弓与渐强弱会改变指标。麦克风与房间也会影响结果。</p><div className="theory-example"><strong>能判断音色好不好听吗？</strong><p>目前提供音准、稳定性、波形和频谱作为观察依据，不给“好听分”。音色还取决于起音、泛音、杂音、乐句和个人审美。先保持录音距离一致，一次只调整弓速、弓压或触弦点中的一个因素，再结合自己的耳朵和老师反馈比较。</p></div></section></div>
    <div className="grid cols-2 mt"><section className="card"><h2>实时波形</h2><p className="sub">横轴为当前约 {sampleRate ? Math.round(4096 / sampleRate * 1000) : '85'} ms 的时间，纵轴为振幅；固定比例。</p><canvas ref={wave} className="sound-canvas" role="img" aria-label="麦克风实时振幅波形" /></section><section className="card"><h2>频谱</h2><p className="sub">横轴为频率（对数刻度），柱高为频谱电平；帮助观察基音与泛音。</p><canvas ref={spectrum} className="sound-canvas" role="img" aria-label="65 至 8000 Hz 麦克风实时频谱" /></section></div>
    <section className="card mt"><h2>最近 8 秒的音高轨迹</h2><p className="sub">中心线跟随当前参照音，纵轴范围 ±200 音分；超出范围或没听清时断线。</p><canvas ref={trace} className="sound-canvas pitch-trace" role="img" aria-label="最近八秒音高变化轨迹" /></section>
    <p className="hint">请在安静环境下一次拉一个音。泛音突出、双音、伴奏和环境噪声可能导致漏检或八度误判；未听清时不判错。调音参考采用十二平均律。</p>
  </>;
}
