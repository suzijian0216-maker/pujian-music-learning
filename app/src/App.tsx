import { useEffect, useRef, useState } from 'react';
import { Home } from './pages/Home';
import { Piano } from './pages/Piano';
import { Progress } from './pages/Progress';
import { SightReading } from './pages/SightReading';
import { Tools } from './pages/Tools';
import { Theory } from './pages/Theory';
import { EarTraining } from './pages/EarTraining';
import { LiveSound } from './pages/LiveSound';
import { loadData, saveData, uid, type AppData, type Session, type Settings } from './lib/storage';
import { DOMAIN_LABEL, type SessionInput, type View } from './types';

const NAV: Array<{ id: View; label: string; icon: string }> = [
  { id: 'home', label: '首页', icon: '◈' },
  { id: 'sight', label: '识谱训练', icon: '♩' },
  { id: 'piano', label: '钢琴', icon: '▤' },
  { id: 'theory', label: '乐理大全', icon: '♮' },
  { id: 'ear', label: '听音练习', icon: '♫' },
  { id: 'live', label: '拉奏分析', icon: '∿' },
  { id: 'tools', label: '节拍器', icon: '◷' },
  { id: 'progress', label: '进度', icon: '▦' },
];

function readHash(): View {
  const value = window.location.hash.replace('#', '');
  return NAV.some((item) => item.id === value) ? (value as View) : 'home';
}

export function App() {
  const [view, setView] = useState<View>(readHash);
  const [data, setData] = useState<AppData>(loadData);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(next: View) {
    window.location.hash = next;
    setView(next);
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  function addSession(input: SessionInput) {
    const session: Session = {
      id: uid(),
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: Math.max(0, input.endedAt - input.startedAt),
      domain: input.domain,
      mode: input.mode,
      total: input.total,
      correct: input.correct,
      meta: input.meta,
    };
    setData((prev) => {
      const next: AppData = { ...prev, sessions: [...prev.sessions, session] };
      saveData(next);
      return next;
    });
    showToast(`已记录：${DOMAIN_LABEL[input.domain]}`);
  }

  function updateSettings(patch: Partial<Settings>) {
    setData((prev) => {
      const next: AppData = { ...prev, settings: { ...prev.settings, ...patch } };
      saveData(next);
      return next;
    });
  }

  function replaceData(next: AppData) {
    setData(next);
    saveData(next);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">♪</div>
          <div>
            <div className="bname">谱间</div>
            <div className="bsub">练习室</div>
          </div>
        </div>

        <nav className="nav" aria-label="主导航">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <span className="ico">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div>本地优先 · 零后端</div>
          <p>v0.2 · 练习 / 乐理 / 听音 / 拉奏</p>
        </div>
      </aside>

      <main className="main">
        {view === 'home' && <Home data={data} onNavigate={navigate} />}
        {view === 'sight' && <SightReading settings={data.settings} onSession={addSession} />}
        {view === 'piano' && <Piano settings={data.settings} onSession={addSession} />}
        {view === 'theory' && <Theory />}
        {view === 'ear' && <EarTraining settings={data.settings} onSession={addSession} />}
        {view === 'live' && <LiveSound settings={data.settings} />}
        {view === 'tools' && <Tools onSession={addSession} />}
        {view === 'progress' && (
          <Progress data={data} onSettings={updateSettings} onReplace={replaceData} onToast={showToast} />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
