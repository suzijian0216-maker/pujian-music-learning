import type { AppData } from '../lib/storage';
import { accuracyOf, formatMinutes, lastDays, minutesThisWeek, minutesToday, streakDays } from '../lib/stats';
import { DOMAIN_LABEL, type View } from '../types';

interface HomeProps {
  data: AppData;
  onNavigate: (view: View) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return '夜深了，轻一点练';
  if (hour < 11) return '早上好，先来 5 分钟识谱';
  if (hour < 14) return '中午好，练一小会儿';
  if (hour < 18) return '下午好，练一会儿吧';
  return '晚上好，练一会儿吧';
}

function timeLabel(ts: number): string {
  const date = new Date(ts);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}

export function Home({ data, onNavigate }: HomeProps) {
  const now = Date.now();
  const today = new Date(now);
  const streak = streakDays(data.sessions, now);
  const todayMinutes = minutesToday(data.sessions, now);
  const weekMinutes = minutesThisWeek(data.sessions, now);
  const accuracy = accuracyOf(data.sessions, 'sight-reading');
  const days = lastDays(data.sessions, 7, now);
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));
  const recent = [...data.sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);

  return (
    <>
      <div className="topline">
        <div>
          <h1>{greeting()}</h1>
          <div className="sub">
            {today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}日 · 星期{WEEKDAYS[today.getDay()]} · 今日已练{' '}
            {formatMinutes(todayMinutes)} 分钟
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('sight')}>
          开始今日任务
        </button>
      </div>

      <div className="grid cols-4">
        <div className="card stat">
          <div className="k">连续练习</div>
          <div className="v">
            {streak}
            <small>天</small>
          </div>
          <div className="d">{streak >= 3 ? '保持住' : '今天练一次就续上'}</div>
        </div>
        <div className="card stat">
          <div className="k">今日练习</div>
          <div className="v">
            {formatMinutes(todayMinutes)}
            <small>分钟</small>
          </div>
          <div className="d">本周 {formatMinutes(weekMinutes)} 分钟</div>
        </div>
        <div className="card stat">
          <div className="k">识谱正确率</div>
          <div className="v">
            {accuracy}
            <small>%</small>
          </div>
          <div className="d">全部练习累计</div>
        </div>
        <div className="card stat">
          <div className="k">练习场次</div>
          <div className="v">
            {data.sessions.length}
            <small>次</small>
          </div>
          <div className="d">数据只存在这台电脑</div>
        </div>
      </div>

      <div className="grid cols-2 mt">
        <div className="card">
          <div className="card-head">
            <h2>今日建议</h2>
            <span className="pill">约 15 分钟</span>
          </div>
          <div className="task">
            <div className="task-body">
              <div className="t">识谱速认 · 20 题</div>
              <div className="s">高音谱号 L1 / L2，5 分钟</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('sight')}>
              开始
            </button>
          </div>
          <div className="task">
            <div className="task-body">
              <div className="t">电脑键盘 · 跟弹</div>
              <div className="s">《小星星》片段，右手 7 个音</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('piano')}>
              开始
            </button>
          </div>
          <div className="task">
            <div className="task-body">
              <div className="t">节拍器 · 慢速</div>
              <div className="s">72 BPM，4/4，找稳定感</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('tools')}>
              开始
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>最近 7 天</h2>
            <span className="pill">分钟 / 天</span>
          </div>
          <div className="mini-chart">
            {days.map((day) => (
              <div key={day.key} className="mini-col">
                {day.minutes > 0 ? (
                  <div
                    className="mini-bar"
                    style={{ height: `${Math.round((day.minutes / maxMinutes) * 100)}%` }}
                    title={`${day.label} · ${day.minutes} 分钟`}
                  />
                ) : (
                  <div className="mini-bar empty-bar" title={`${day.label} · 没有练习`} />
                )}
                <div className="mini-label">{day.label}</div>
              </div>
            ))}
          </div>
          <div className="hint">每天练一点比周末突击更有效；连续天数断掉也没关系，从今天重新开始。</div>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head"><h2>边学边练</h2><span className="pill">新增</span></div>
        <div className="new-feature-grid">
          <button className="feature-entry" onClick={() => onNavigate('theory')}><strong>乐理大全 ↗</strong><span>查术语、看解释，把不懂的知识连起来。</span></button>
          <button className="feature-entry" onClick={() => onNavigate('ear')}><strong>听音练习 ↗</strong><span>单音与音程辨认，听完就能核对答案。</span></button>
          <button className="feature-entry" onClick={() => onNavigate('live')}><strong>拉奏分析 ↗</strong><span>看音名、音准、波形与频谱，观察长音控制。</span></button>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h2>最近练习</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('progress')}>
            查看全部
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="empty">
            还没有记录。先来一组识谱速认——完成后会自动写进练习日志。
          </div>
        ) : (
          recent.map((session) => (
            <div key={session.id} className="list-row">
              <div className="l">
                <i className="dot" />
                {DOMAIN_LABEL[session.domain]}
                {session.total > 0 && <span className="muted"> · {session.correct}/{session.total}</span>}
              </div>
              <div className="r">
                {timeLabel(session.startedAt)} · {Math.round(session.durationMs / 60000)} 分钟
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
