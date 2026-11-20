import { useEffect, useRef, useState } from 'react';
import { startVoice, type Voice } from '../lib/audio';
import { freqOf, labelOf } from '../lib/notes';
import type { Settings } from '../lib/storage';
import type { SessionInput } from '../types';

type Mode = 'note' | 'interval';
const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
const INTERVALS = [{ name: '大二度', steps: 2 }, { name: '小三度', steps: 3 }, { name: '大三度', steps: 4 }, { name: '纯四度', steps: 5 }, { name: '纯五度', steps: 7 }, { name: '纯八度', steps: 12 }];
const COUNT = 10;
function randomTarget(mode: Mode) { return Math.floor(Math.random() * (mode === 'note' ? NOTES.length : INTERVALS.length)); }

export function EarTraining({ settings, onSession }: { settings: Settings; onSession: (input: SessionInput) => void }) {
  const [mode, setMode] = useState<Mode>('note');
  const [started, setStarted] = useState(false);
  const [target, setTarget] = useState(0);
  const [root, setRoot] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [played, setPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const timers = useRef<number[]>([]);
  const voices = useRef<Voice[]>([]);
  const done = answers.length === COUNT;
  const options = mode === 'note' ? NOTES.map((note) => labelOf(note, settings.naming)) : INTERVALS.map((item) => item.name);

  function stopAudio() {
    timers.current.forEach(window.clearTimeout); timers.current = [];
    voices.current.forEach((voice) => voice.release(true)); voices.current = [];
  }
  useEffect(() => () => stopAudio(), []);

  function play(reference = false, nextTarget = target, nextRoot = root) {
    stopAudio(); setError('');
    try {
      const frequencies = reference ? [freqOf('C4', settings.a4)] : mode === 'note' ? [freqOf(NOTES[nextTarget], settings.a4)] : [freqOf(NOTES[nextRoot], settings.a4), freqOf(NOTES[nextRoot], settings.a4) * 2 ** (INTERVALS[nextTarget].steps / 12)];
      const first = startVoice(frequencies[0], 0.12); voices.current.push(first); setPlaying(true);
      timers.current.push(window.setTimeout(() => first.release(), 550));
      if (frequencies.length > 1) timers.current.push(window.setTimeout(() => {
        const second = startVoice(frequencies[1], 0.12); voices.current.push(second);
        timers.current.push(window.setTimeout(() => second.release(), 550));
      }, 750));
      timers.current.push(window.setTimeout(() => setPlaying(false), frequencies.length > 1 ? 1700 : 950));
      if (!reference) setPlayed(true);
    } catch { setPlaying(false); setError('声音播放失败，请确认浏览器支持音频后重试。'); }
  }
  function begin() {
    const next = randomTarget(mode); const base = Math.floor(Math.random() * 4);
    setTarget(next); setRoot(base); setAnswers([]); setChoice(null); setStarted(true);
    recorded.current = false; startedAt.current = Date.now(); play(false, next, base);
  }
  function answer(index: number) {
    if (choice !== null || done || !played || playing) return;
    const next = [...answers, index === target]; setAnswers(next); setChoice(index);
    if (next.length === COUNT && !recorded.current) {
      recorded.current = true;
      onSession({ domain: 'ear-training', mode, total: COUNT, correct: next.filter(Boolean).length, startedAt: startedAt.current, endedAt: Date.now(), meta: { a4: settings.a4 } });
    }
  }
  function nextQuestion() {
    const next = randomTarget(mode); const base = Math.floor(Math.random() * 4);
    setTarget(next); setRoot(base); setChoice(null); setPlayed(false); play(false, next, base);
  }
  return <>
    <div className="topline"><div><h1>听音练习</h1><div className="sub">先听、试着唱出来，再选答案 · 每组 {COUNT} 题</div></div><span className="pill">A4 = {settings.a4} Hz</span></div>
    <div className="seg"><button className={mode === 'note' ? 'on' : ''} onClick={() => { stopAudio(); setMode('note'); setStarted(false); setPlaying(false); }}>单音辨认</button><button className={mode === 'interval' ? 'on' : ''} onClick={() => { stopAudio(); setMode('interval'); setStarted(false); setPlaying(false); }}>音程辨认</button></div>
    <section className="card mt ear-card">
      {!started ? <><div className="ear-symbol">♫</div><h2>{mode === 'note' ? '听一个音，找到它的名字' : '听两个音，判断它们的距离'}</h2><p className="sub">{mode === 'note' ? '范围 C4–B4 的七个自然音；可随时试听 C4 参考音，练习相对音高与音高记忆。' : '两个音先后向上演奏；练习大二度、小三度、大三度、纯四度、纯五度和纯八度。'}</p><button className="btn btn-primary" onClick={begin}>开始练习并播放</button></> : done ? <><h2>本组完成</h2><div className="ear-score">{answers.filter(Boolean).length}<small> / {COUNT}</small></div><p role="status">最后一题：{choice === target ? '答对了！' : `正确答案是 ${options[target]}`}。</p><p>练习成绩已记录，可在「进度」查看。</p><button className="btn btn-primary" onClick={begin}>再练一组</button></> : <>
        <div className="card-head"><h2>第 {Math.min(answers.length + (choice === null ? 1 : 0), COUNT)} / {COUNT} 题</h2><span className="pill">已答对 {answers.filter(Boolean).length} 题</span></div>
        <div className="ear-symbol">♪</div><p>{mode === 'note' ? '刚才听到了哪个音？' : '第二个音比第一个音高多少？'}</p>
        <div className="row ear-controls"><button className="btn btn-primary" onClick={() => play()}>{playing ? '正在播放 · 重新听' : '▶ 重听题目'}</button>{mode === 'note' && <button className="btn btn-ghost" onClick={() => play(true)}>试听参考音 C4</button>}</div>
        <div className="ear-options">{options.map((option, i) => <button key={option} disabled={choice !== null || !played || playing} className={`btn btn-ghost ${choice !== null && i === target ? 'ear-correct' : ''} ${choice === i && i !== target ? 'ear-wrong' : ''}`} onClick={() => answer(i)}>{option}</button>)}</div>
        {choice !== null && <div className="ear-feedback" role="status"><strong>{choice === target ? '答对了！' : `正确答案：${options[target]}`}</strong><p>{mode === 'note' ? '把参考音和目标音都唱一遍，再比较高低。' : `${INTERVALS[target].name}相距 ${INTERVALS[target].steps} 个半音。先唱出两个音，再在琴上验证。`}</p><button className="btn btn-primary" onClick={nextQuestion}>下一题并播放</button></div>}
      </>}
      {error && <p role="alert">{error}</p>}
    </section><div className="hint">使用本地合成音色；听音辨认不等同于乐器音色辨认。建议保持舒适音量，单音辨认可借助参考音练习，无需先具备绝对音高。</div>
  </>;
}
