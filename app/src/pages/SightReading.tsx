import { useCallback, useEffect, useRef, useState } from 'react';
import { Staff } from '../components/Staff';
import { describePosition, diatonicIndex, labelOf, nameFromDiatonic } from '../lib/notes';
import type { Settings } from '../lib/storage';
import type { SessionInput } from '../types';

type Clef = 'treble' | 'bass';
type Level = 1 | 2 | 3;

const ROUND_SIZE = 20;

const RANGES: Record<Clef, Record<Level, [string, string]>> = {
  treble: { 1: ['C4', 'C5'], 2: ['C4', 'C6'], 3: ['G3', 'A5'] },
  bass: { 1: ['C3', 'C4'], 2: ['C3', 'C5'], 3: ['E2', 'C4'] },
};

interface Question {
  note: string;
  options: string[];
}

interface RoundState {
  phase: 'answer' | 'feedback' | 'done';
  question: Question;
  picked: string | null;
  total: number;
  correct: number;
  streak: number;
  best: number;
  rtSum: number;
  startedAt: number;
  shownAt: number;
}

function poolFor(clef: Clef, level: Level): string[] {
  const [from, to] = RANGES[clef][level];
  const start = diatonicIndex(from);
  const end = diatonicIndex(to);
  const pool: string[] = [];
  for (let index = start; index <= end; index += 1) pool.push(nameFromDiatonic(index));
  return pool;
}

function makeQuestion(clef: Clef, level: Level): Question {
  const pool = poolFor(clef, level);
  const note = pool[Math.floor(Math.random() * pool.length)];
  const options = [note];
  let guard = 0;
  while (options.length < 4 && guard < 500) {
    guard += 1;
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (!options.includes(candidate)) options.push(candidate);
  }
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { note, options };
}

function newRound(clef: Clef, level: Level): RoundState {
  const now = Date.now();
  return {
    phase: 'answer',
    question: makeQuestion(clef, level),
    picked: null,
    total: 0,
    correct: 0,
    streak: 0,
    best: 0,
    rtSum: 0,
    startedAt: now,
    shownAt: now,
  };
}

interface SightReadingProps {
  settings: Settings;
  onSession: (session: SessionInput) => void;
}

export function SightReading({ settings, onSession }: SightReadingProps) {
  const [clef, setClef] = useState<Clef>('treble');
  const [level, setLevel] = useState<Level>(1);
  const [round, setRound] = useState<RoundState>(() => newRound('treble', 1));
  const [elapsed, setElapsed] = useState(0);
  const recorded = useRef(false);

  const restart = useCallback((nextClef: Clef, nextLevel: Level) => {
    recorded.current = false;
    setRound(newRound(nextClef, nextLevel));
    setElapsed(0);
  }, []);

  const answer = useCallback((note: string) => {
    setRound((prev) => {
      if (prev.phase !== 'answer') return prev;
      const ok = note === prev.question.note;
      const rt = Date.now() - prev.shownAt;
      const streak = ok ? prev.streak + 1 : 0;
      return {
        ...prev,
        phase: 'feedback',
        picked: note,
        total: prev.total + 1,
        correct: prev.correct + (ok ? 1 : 0),
        streak,
        best: Math.max(prev.best, streak),
        rtSum: prev.rtSum + rt,
      };
    });
  }, []);

  useEffect(() => {
    if (round.phase !== 'feedback') return;
    const timer = window.setTimeout(() => {
      setRound((prev) => {
        if (prev.phase !== 'feedback') return prev;
        if (prev.total >= ROUND_SIZE) return { ...prev, phase: 'done' };
        return { ...prev, phase: 'answer', question: makeQuestion(clef, level), picked: null, shownAt: Date.now() };
      });
    }, 820);
    return () => window.clearTimeout(timer);
  }, [round.phase, clef, level]);

  useEffect(() => {
    if (round.phase === 'done' || round.total === 0) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - round.startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [round.phase, round.startedAt, round.total]);

  useEffect(() => {
    if (round.phase !== 'done' || recorded.current) return;
    recorded.current = true;
    onSession({
      domain: 'sight-reading',
      mode: `${clef}-L${level}`,
      total: round.total,
      correct: round.correct,
      startedAt: round.startedAt,
      endedAt: Date.now(),
      meta: { clef, level },
    });
  }, [round.phase, clef, level, round.total, round.correct, round.startedAt, onSession]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (round.phase !== 'answer') return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < 4) {
        const option = round.question.options[index];
        if (option) answer(option);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [round.phase, round.question.options, answer]);

  const accuracy = round.total > 0 ? Math.round((round.correct / round.total) * 100) : 0;
  const avgRt = round.total > 0 ? round.rtSum / round.total / 1000 : 0;
  const target = round.question.note;
  const naming = settings.naming;

  let feedback = { text: '准备好了吗？点击音名或按 1–4 作答', kind: '' };
  if (round.phase === 'feedback' && round.picked) {
    const ok = round.picked === round.question.note;
    const rt = (Date.now() - round.shownAt) / 1000;
    feedback = ok
      ? { text: `✓ ${labelOf(target, naming)} · ${rt.toFixed(1)}s`, kind: 'ok' }
      : {
          text: `✗ 是 ${labelOf(target, naming)}（${describePosition(target, clef)}），你选了 ${labelOf(round.picked, naming)}`,
          kind: 'bad',
        };
  }

  return (
    <>
      <div className="topline">
        <div>
          <h1>识谱训练</h1>
          <div className="sub">看到音符，选出正确的音名</div>
        </div>
        <div className="row">
          <div className="seg">
            <button
              className={clef === 'treble' ? 'on' : ''}
              onClick={() => {
                setClef('treble');
                restart('treble', level);
              }}
            >
              高音谱号
            </button>
            <button
              className={clef === 'bass' ? 'on' : ''}
              onClick={() => {
                setClef('bass');
                restart('bass', level);
              }}
            >
              低音谱号
            </button>
          </div>
          <div className="seg">
            {([1, 2, 3] as Level[]).map((item) => (
              <button
                key={item}
                className={level === item ? 'on' : ''}
                onClick={() => {
                  setLevel(item);
                  restart(clef, item);
                }}
              >
                L{item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {round.phase === 'done' ? (
        <div className="card">
          <div className="done-title">本组完成</div>
          <div className="done-grid">
            <div>
              <div className="k">正确率</div>
              <div className="v">{accuracy}%</div>
            </div>
            <div>
              <div className="k">平均反应</div>
              <div className="v">{avgRt.toFixed(1)}s</div>
            </div>
            <div>
              <div className="k">最长连对</div>
              <div className="v">{round.best}</div>
            </div>
            <div>
              <div className="k">用时</div>
              <div className="v">{Math.max(1, Math.round((Date.now() - round.startedAt) / 60000))} 分</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => restart(clef, level)}>
              再来一组
            </button>
            <span className="hint" style={{ margin: 0 }}>
              已记录到练习日志，明天可以回看趋势
            </span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-head">
            <span className="pill">本组 {ROUND_SIZE} 题 · 进度 {round.total}/{ROUND_SIZE}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => restart(clef, level)}>
              重新开始
            </button>
          </div>

          <Staff notes={[target]} clef={clef} />

          <div className={`feedback ${feedback.kind}`}>{feedback.text}</div>

          <div className="opts">
            {round.question.options.map((option) => {
              const classes = ['opt'];
              if (round.phase === 'feedback' && option === target) classes.push('ok');
              if (round.phase === 'feedback' && option === round.picked && option !== target) classes.push('bad');
              return (
                <button
                  key={option}
                  className={classes.join(' ')}
                  disabled={round.phase !== 'answer'}
                  onClick={() => answer(option)}
                >
                  {labelOf(option, naming)}
                </button>
              );
            })}
          </div>

          <div className="stats-row">
            <span>
              正确率 <b>{round.total ? `${accuracy}%` : '—'}</b>
            </span>
            <span>
              已答 <b>{round.total}</b>
            </span>
            <span>
              连对 <b>{round.streak}</b>
            </span>
            <span>
              用时 <b>{formatElapsed(elapsed)}</b>
            </span>
            <span className="shortcut-hint">
              快捷键 <kbd>1</kbd>–<kbd>4</kbd> 作答
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
