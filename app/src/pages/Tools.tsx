import { useEffect, useRef, useState } from 'react';
import { Metronome } from '../lib/metronome';
import type { SessionInput } from '../types';

interface ToolsProps {
  onSession: (session: SessionInput) => void;
}

export function Tools({ onSession }: ToolsProps) {
  const [bpm, setBpm] = useState(72);
  const [beats, setBeats] = useState(4);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);

  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  const engine = useRef<Metronome | null>(null);
  const startedAt = useRef(0);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
    beatsRef.current = beats;
  }, [bpm, beats]);

  useEffect(() => {
    return () => {
      engine.current?.stop();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      event.preventDefault();
      if (running) stop();
      else start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function start() {
    const metronome = new Metronome(
      () => bpmRef.current,
      () => beatsRef.current,
      (value) => setBeat(value),
    );
    engine.current = metronome;
    metronome.start();
    startedAt.current = Date.now();
    setRunning(true);
    setBeat(0);
  }

  function stop() {
    engine.current?.stop();
    engine.current = null;
    setRunning(false);
    setBeat(-1);
    const duration = Date.now() - startedAt.current;
    if (duration >= 10000) {
      onSession({
        domain: 'metronome',
        mode: `${beats}/4`,
        total: 0,
        correct: 0,
        startedAt: startedAt.current,
        endedAt: Date.now(),
        meta: { bpm },
      });
    }
  }

  function tap() {
    const now = Date.now();
    if (taps.current.length > 0 && now - taps.current[taps.current.length - 1] > 2000) taps.current = [];
    taps.current.push(now);
    if (taps.current.length > 6) taps.current.shift();
    if (taps.current.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.current.length; i += 1) sum += taps.current[i] - taps.current[i - 1];
      const next = Math.round(60000 / (sum / (taps.current.length - 1)));
      setBpm(Math.max(40, Math.min(208, next)));
    }
  }

  return (
    <>
      <div className="topline">
        <div>
          <h1>节拍器</h1>
          <div className="sub">练琴前先定速度；重音落在每小节第一拍</div>
        </div>
        <span className="pill">{beats}/4 拍</span>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h2>速度</h2>
            <span className="pill">{running ? '运行中' : '已停止'}</span>
          </div>

          <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div className="bpm-big">
              {bpm}
              <small>BPM</small>
            </div>
            <button className={running ? 'btn btn-ghost' : 'btn btn-primary'} onClick={running ? stop : start}>
              {running ? '■ 停止' : '▶ 开始'}
            </button>
          </div>

          <input
            type="range"
            min={40}
            max={208}
            value={bpm}
            aria-label="BPM"
            onChange={(event) => setBpm(Number(event.target.value))}
          />

          <div className="beats">
            {Array.from({ length: beats }).map((_, index) => (
              <i key={index} className={running && beat === index ? 'on' : ''} />
            ))}
          </div>

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="seg">
              {[2, 3, 4, 6].map((value) => (
                <button key={value} className={beats === value ? 'on' : ''} onClick={() => setBeats(value)}>
                  {value}/4
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={tap}>
              Tap tempo
            </button>
          </div>

          <div className="hint">
            按 <kbd>空格</kbd> 开始/停止。连续点击 Tap tempo 可测出速度；音频带 150ms 前瞻调度，节拍不会越走越偏。
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>其他工具</h2>
            <span className="pill">排期中</span>
          </div>
          <div className="todo-row">
            <div>
              <div className="t">调音器</div>
              <div className="s">空弦 G/D/A/E，实时音分偏差 · M3</div>
            </div>
            <span className="status soon">M3</span>
          </div>
          <div className="todo-row">
            <div>
              <div className="t">录音机</div>
              <div className="s">本地录音、AB 循环、变速 · M4</div>
            </div>
            <span className="status soon">M4</span>
          </div>
          <div className="todo-row">
            <div>
              <div className="t">视奏计时</div>
              <div className="s">随机片段 + 每分钟正确音数 · M2</div>
            </div>
            <span className="status soon">M2</span>
          </div>
          <div className="hint">M1 先交付「能每天用」的最小闭环：识谱、键盘、节拍器、本地记录。</div>
        </div>
      </div>
    </>
  );
}
