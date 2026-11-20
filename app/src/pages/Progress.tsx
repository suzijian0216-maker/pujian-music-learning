import { useRef, type ChangeEvent } from 'react';
import { dayKey, formatMinutes, lastDays, minutesOf, streakDays, accuracyOf, totalMinutes } from '../lib/stats';
import { defaultData, exportJson, parseImport, type AppData, type Settings } from '../lib/storage';
import { DOMAIN_LABEL } from '../types';

interface ProgressProps {
  data: AppData;
  onSettings: (patch: Partial<Settings>) => void;
  onReplace: (data: AppData) => void;
  onToast: (message: string) => void;
}

function timeLabel(ts: number): string {
  const date = new Date(ts);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}

export function Progress({ data, onSettings, onReplace, onToast }: ProgressProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const now = Date.now();
  const days = lastDays(data.sessions, 14, now);
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));
  const totalMins = totalMinutes(data.sessions);
  const recent = [...data.sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);

  function handleExport() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pujian-${dayKey(now)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onToast('已导出 JSON 备份');
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = parseImport(String(reader.result));
        onReplace(next);
        onToast(`已导入 ${next.sessions.length} 条记录`);
      } catch (error) {
        onToast(`导入失败：${(error as Error).message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function handleReset() {
    if (!window.confirm('确定清空所有练习记录？建议先导出备份。')) return;
    onReplace(defaultData());
    onToast('已清空练习记录');
  }

  return (
    <>
      <div className="topline">
        <div>
          <h1>进度</h1>
          <div className="sub">练习记录只保存在这台电脑；建议每周导出一次备份</div>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={handleExport}>
            导出 JSON
          </button>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            导入
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card stat">
          <div className="k">累计练习</div>
          <div className="v">
            {formatMinutes(totalMins)}
            <small>分钟</small>
          </div>
          <div className="d">{data.sessions.length} 次练习</div>
        </div>
        <div className="card stat">
          <div className="k">连续天数</div>
          <div className="v">
            {streakDays(data.sessions, now)}
            <small>天</small>
          </div>
          <div className="d">断掉也会从今天重算</div>
        </div>
        <div className="card stat">
          <div className="k">识谱正确率</div>
          <div className="v">
            {accuracyOf(data.sessions, 'sight-reading')}
            <small>%</small>
          </div>
          <div className="d">累计答题</div>
        </div>
        <div className="card stat">
          <div className="k">本周练习</div>
          <div className="v">
            {formatMinutes(days.slice(-7).reduce((sum, day) => sum + day.minutes, 0))}
            <small>分钟</small>
          </div>
          <div className="d">最近 7 天</div>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h2>最近 14 天</h2>
          <span className="pill">分钟 / 天</span>
        </div>
        <div className="bar-chart">
          {days.map((day) => (
            <div key={day.key} className="bar-col">
              <div className="bar-value">{day.minutes > 0 ? (day.minutes < 1 ? '<1' : String(Math.round(day.minutes))) : ''}</div>
              <div className="bar-track">
                {day.minutes > 0 ? (
                  <div
                    className="bar-fill"
                    style={{ height: `${Math.round((day.minutes / maxMinutes) * 100)}%` }}
                    title={`${day.label} · ${day.minutes} 分钟`}
                  />
                ) : (
                  <div className="bar-empty" />
                )}
              </div>
              <div className="bar-label">{day.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h2>练习记录</h2>
          <span className="pill">最近 20 条</span>
        </div>
        {recent.length === 0 ? (
          <div className="empty">还没有记录。做完一组识谱速认就会自动出现在这里。</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>结果</th>
                  <th>时长</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((session) => (
                  <tr key={session.id}>
                    <td>{timeLabel(session.startedAt)}</td>
                    <td>{DOMAIN_LABEL[session.domain]}</td>
                    <td>
                      {session.total > 0
                        ? `${session.correct}/${session.total} · ${Math.round((session.correct / session.total) * 100)}%`
                        : '—'}
                    </td>
                    <td>{session.durationMs < 60000 ? '<1 分钟' : `${Math.round(minutesOf(session))} 分钟`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid cols-2 mt">
        <div className="card">
          <div className="card-head">
            <h2>设置</h2>
            <span className="pill">本地生效</span>
          </div>
          <div className="setting-row">
            <div>
              <div className="t">标准音 A4</div>
              <div className="s">影响键盘与小提琴音准的基准音高</div>
            </div>
            <div className="seg">
              {[440, 442].map((value) => (
                <button
                  key={value}
                  className={data.settings.a4 === value ? 'on' : ''}
                  onClick={() => onSettings({ a4: value })}
                >
                  {value} Hz
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row">
            <div>
              <div className="t">音名显示</div>
              <div className="s">固定唱名法用 do/re/mi 显示</div>
            </div>
            <div className="seg">
              <button
                className={data.settings.naming === 'letter' ? 'on' : ''}
                onClick={() => onSettings({ naming: 'letter' })}
              >
                C D E
              </button>
              <button
                className={data.settings.naming === 'solfege' ? 'on' : ''}
                onClick={() => onSettings({ naming: 'solfege' })}
              >
                do re mi
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>数据</h2>
            <span className="pill">本地存储</span>
          </div>
          <div className="setting-row">
            <div>
              <div className="t">导出备份</div>
              <div className="s">下载一份 JSON，换电脑或清缓存前先导出</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>
              导出
            </button>
          </div>
          <div className="setting-row">
            <div>
              <div className="t">导入备份</div>
              <div className="s">会覆盖当前记录</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              选择文件
            </button>
          </div>
          <div className="setting-row">
            <div>
              <div className="t">清空记录</div>
              <div className="s">删除所有练习数据，不可撤销</div>
            </div>
            <button className="btn btn-ghost btn-sm danger" onClick={handleReset}>
              清空
            </button>
          </div>
          <div className="hint">音频与练习数据都只在浏览器本地处理，不会上传到任何服务器。</div>
        </div>
      </div>
    </>
  );
}
