export type Domain = 'sight-reading' | 'piano' | 'metronome' | 'ear-training';

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number;
  domain: Domain;
  mode: string;
  total: number;
  correct: number;
  durationMs: number;
  meta?: Record<string, string | number>;
}

export interface Settings {
  a4: number;
  naming: 'letter' | 'solfege';
}

export interface AppData {
  version: 1;
  sessions: Session[];
  settings: Settings;
}

const STORAGE_KEY = 'pujian:data:v1';

export function defaultData(): AppData {
  return {
    version: 1,
    sessions: [],
    settings: { a4: 440, naming: 'letter' },
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!parsed || !Array.isArray(parsed.sessions)) return defaultData();
    return {
      version: 1,
      sessions: parsed.sessions.filter(isSession),
      settings: {
        a4: parsed.settings?.a4 === 442 ? 442 : 440,
        naming: parsed.settings?.naming === 'solfege' ? 'solfege' : 'letter',
      },
    };
  } catch {
    return defaultData();
  }
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<Session>;
  return (
    typeof session.id === 'string' &&
    typeof session.startedAt === 'number' &&
    typeof session.endedAt === 'number' &&
    typeof session.durationMs === 'number' &&
    typeof session.total === 'number' &&
    typeof session.correct === 'number'
  );
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or private mode */
  }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function parseImport(text: string): AppData {
  const parsed = JSON.parse(text) as Partial<AppData>;
  if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('文件格式不对：缺少 sessions');
  return {
    version: 1,
    sessions: parsed.sessions.filter(isSession),
    settings: {
      a4: parsed.settings?.a4 === 442 ? 442 : 440,
      naming: parsed.settings?.naming === 'solfege' ? 'solfege' : 'letter',
    },
  };
}

let counter = 0;
export function uid(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
