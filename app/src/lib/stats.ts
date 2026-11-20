import type { Domain, Session } from './storage';

const DAY = 86400000;

export function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dayKey(ts: number): string {
  const date = new Date(ts);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function minutesOf(session: Session): number {
  return session.durationMs / 60000;
}

export function totalMinutes(sessions: Session[]): number {
  return sessions.reduce((sum, session) => sum + session.durationMs, 0) / 60000;
}

export function formatMinutes(value: number): string {
  if (value <= 0) return '0';
  if (value < 1) return '<1';
  return String(Math.round(value));
}

export function minutesToday(sessions: Session[], now = Date.now()): number {
  const today = dayKey(now);
  return totalMinutes(sessions.filter((session) => dayKey(session.startedAt) === today));
}

export function minutesThisWeek(sessions: Session[], now = Date.now()): number {
  const start = startOfDay(now) - 6 * DAY;
  return totalMinutes(sessions.filter((session) => session.startedAt >= start));
}

export function streakDays(sessions: Session[], now = Date.now()): number {
  const days = new Set(sessions.map((session) => dayKey(session.startedAt)));
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor -= DAY;
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

export function accuracyOf(sessions: Session[], domain?: Domain): number {
  const pool = domain ? sessions.filter((session) => session.domain === domain) : sessions;
  const total = pool.reduce((sum, session) => sum + session.total, 0);
  const correct = pool.reduce((sum, session) => sum + session.correct, 0);
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export interface DayBucket {
  key: string;
  label: string;
  minutes: number;
}

export function lastDays(sessions: Session[], count: number, now = Date.now()): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const ts = startOfDay(now) - i * DAY;
    const key = dayKey(ts);
    const date = new Date(ts);
    buckets.push({
      key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      minutes: totalMinutes(sessions.filter((session) => dayKey(session.startedAt) === key)),
    });
  }
  return buckets;
}
