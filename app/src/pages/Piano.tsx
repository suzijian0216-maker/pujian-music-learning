import { useEffect, useMemo, useRef, useState } from 'react';
import { PianoKeyboard } from '../components/PianoKeyboard';
import { Staff } from '../components/Staff';
import { playTone, startVoice, type Voice } from '../lib/audio';
import { buildLayout, LAYOUT_NAMES, type LayoutId } from '../lib/layouts';
import { freqOf } from '../lib/notes';
import type { Settings } from '../lib/storage';
import type { SessionInput } from '../types';

const PHRASE = ['C5', 'C5', 'G5', 'G5', 'A5', 'A5', 'G5'];

type Mode = 'follow' | 'free';
type FeedbackKind = 'idle' | 'ok' | 'bad';

interface Feedback {
  text: string;
  kind: FeedbackKind;
}

interface PianoProps {
  settings: Settings;
  onSession: (session: SessionInput) => void;
}

export function Piano({ settings, onSession }: PianoProps) {
  const [layoutId, setLayoutId] = useState<LayoutId>('split');
  const [baseOct, setBaseOct] = useState(5);
  const [mode, setMode] = useState<Mode>('follow');
  const [idx, setIdx] = useState(0);
  const [ok, setOk] = useState(0);
  const [bad, setBad] = useState(0);
  const [done, setDone] = useState(false);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [demoIdx, setDemoIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({
    text: '按住键发声、松开止音；跟弹模式弹出高亮的音',
    kind: 'idle',
  });

  const layout = useMemo(() => buildLayout(layoutId, baseOct), [layoutId, baseOct]);
  const voices = useRef(new Map<string, Voice>());
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const demoing = useRef(false);
  const demoTimers = useRef<number[]>([]);

  const stateRef = useRef({ mode, idx, done, layoutId, baseOct });

  function resetExercise(nextMode: Mode = mode) {
    setIdx(0);
    setOk(0);
    setBad(0);
    setDone(false);
    setDemoIdx(null);
    startedAt.current = 0;
    recorded.current = false;
    setFeedback({
      text:
        nextMode === 'follow'
          ? '跟弹：弹出高亮的音，弹对自动下一音'
          : '自由弹奏：按住键发声、松开止音，不会判对错',
      kind: 'idle',
    });
  }

  function releaseAll() {
    voices.current.forEach((voice) => voice.release(true));
    voices.current.clear();
    setActive(new Set());
  }

  function judge(note: string) {
    const { idx: currentIdx, done: finished, mode: currentMode } = stateRef.current;
    if (currentMode !== 'follow' || finished) return;
    const target = PHRASE[currentIdx];
    if (!target) return;

    if (startedAt.current === 0) startedAt.current = Date.now();

    if (note === target) {
      const nextIdx = currentIdx + 1;
      const nextOk = ok + 1;
      setOk(nextOk);
      setIdx(nextIdx);
      if (nextIdx >= PHRASE.length) {
        setDone(true);
        setFeedback({ text: `完成！${nextOk} / ${PHRASE.length} 个音全对`, kind: 'ok' });
        if (!recorded.current) {
          recorded.current = true;
          onSession({
            domain: 'piano',
            mode: `${stateRef.current.layoutId}-follow`,
            total: PHRASE.length,
            correct: nextOk,
            startedAt: startedAt.current,
            endedAt: Date.now(),
            meta: { layout: stateRef.current.layoutId, octave: stateRef.current.baseOct },
          });
        }
      } else {
        setFeedback({ text: `✓ ${target}`, kind: 'ok' });
      }
    } else {
      setBad((value) => value + 1);
      setFeedback({ text: `✗ 目标是 ${target}，你弹了 ${note}`, kind: 'bad' });
    }
  }

  function noteOn(note: string, code: string) {
    if (voices.current.has(code)) return;
    voices.current.set(code, startVoice(freqOf(note, settings.a4)));
    setActive((prev) => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });
    if (!demoing.current) judge(note);
  }

  function noteOff(note: string, code: string) {
    const voice = voices.current.get(code);
    if (!voice) return;
    voice.release();
    voices.current.delete(code);
    setActive((prev) => {
      if (!prev.has(note)) return prev;
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }

  const handlers = useRef({ noteOn, noteOff });

  useEffect(() => {
    stateRef.current = { mode, idx, done, layoutId, baseOct };
    handlers.current = { noteOn, noteOff };
  });

  useEffect(() => {
    function findKey(code: string) {
      return layout.whites.find((key) => key.code === code) ?? layout.blacks.find((key) => key.code === code);
    }

    function shiftOctave(delta: number) {
      setBaseOct((prev) => Math.max(3, Math.min(6, prev + delta)));
    }

    function onDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === 'BracketLeft') {
        event.preventDefault();
        shiftOctave(-1);
        return;
      }
      if (event.code === 'BracketRight') {
        event.preventDefault();
        shiftOctave(1);
        return;
      }
      if (event.repeat) return;
      const key = findKey(event.code);
      if (!key) return;
      event.preventDefault();
      handlers.current.noteOn(key.note, event.code);
    }

    function onUp(event: KeyboardEvent) {
      const key = findKey(event.code);
      if (!key) return;
      handlers.current.noteOff(key.note, event.code);
    }

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [layout]);

  useEffect(() => {
    return () => {
      demoTimers.current.forEach((timer) => window.clearTimeout(timer));
      demoTimers.current = [];
    };
  }, []);

  function runDemo() {
    if (demoing.current) return;
    demoing.current = true;
    let index = 0;
    const step = () => {
      if (index >= PHRASE.length) {
        demoing.current = false;
        setDemoIdx(null);
        return;
      }
      const note = PHRASE[index];
      setDemoIdx(index);
      playTone(freqOf(note, settings.a4), 0.5);
      index += 1;
      demoTimers.current.push(window.setTimeout(step, 520));
    };
    step();
  }

  function changeLayout(next: LayoutId) {
    if (next === layoutId) return;
    releaseAll();
    setLayoutId(next);
    setBaseOct(5);
    resetExercise();
  }

  function changeMode(next: Mode) {
    if (next === mode) return;
    releaseAll();
    setMode(next);
    resetExercise(next);
  }

  function shiftOctave(delta: number) {
    releaseAll();
    setBaseOct((prev) => Math.max(3, Math.min(6, prev + delta)));
  }

  const target = demoIdx !== null ? PHRASE[demoIdx] : mode === 'follow' && !done ? PHRASE[idx] : undefined;
  const highlight = demoIdx !== null ? demoIdx : mode === 'follow' && !done ? idx : -1;
  const reachable = !target || [...layout.whites, ...layout.blacks].some((key) => key.note === target);

  return (
    <>
      <div className="topline">
        <div>
          <h1>钢琴 · 单音跟弹</h1>
          <div className="sub">谱面高亮当前音 → 在键盘上弹出 → 即时判断</div>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={runDemo}>
            ▶ 示范
          </button>
          <button className="btn btn-primary" onClick={() => resetExercise()}>
            重新开始
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>《小星星》片段 · 右手</h2>
          <span className="pill">{PHRASE.length} 个音 · 单音</span>
        </div>

        <Staff notes={PHRASE} clef="treble" highlight={highlight} />

        <div className={`feedback ${feedback.kind}`}>{feedback.text}</div>

        <div className="kbar">
          <span className="pill hot">电脑键盘</span>
          <div className="seg">
            {(Object.keys(LAYOUT_NAMES) as LayoutId[]).map((id) => (
              <button key={id} className={layoutId === id ? 'on' : ''} onClick={() => changeLayout(id)}>
                {LAYOUT_NAMES[id]}
              </button>
            ))}
          </div>
          <span>
            音域 <b>{`${layout.first}–${layout.last}`}</b>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => shiftOctave(-1)}>
            − 八度
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => shiftOctave(1)}>
            + 八度
          </button>
          <span style={{ flex: 1 }} />
          <div className="seg">
            <button className={mode === 'follow' ? 'on' : ''} onClick={() => changeMode('follow')}>
              跟弹
            </button>
            <button className={mode === 'free' ? 'on' : ''} onClick={() => changeMode('free')}>
              自由弹奏
            </button>
          </div>
        </div>

        <PianoKeyboard layout={layout} active={active} target={target} onDown={noteOn} onUp={noteOff} />

        <div className="stats-row">
          <span>
            进度 <b>{done ? '完成' : mode === 'free' ? '自由' : `${idx} / ${PHRASE.length}`}</b>
          </span>
          <span>
            正确 <b>{ok}</b>
          </span>
          <span>
            错误 <b>{bad}</b>
          </span>
          {!reachable && <span className="warn-text">目标音不在当前音域，按 [ / ] 移回来</span>}
        </div>

        <div className="hint">
          按住键发声、松开止音。{layout.hint}。<kbd>[</kbd> <kbd>]</kbd> 整体移八度；音频由浏览器实时合成。
        </div>
      </div>
    </>
  );
}
