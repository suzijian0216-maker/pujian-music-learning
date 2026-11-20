import type { Domain } from './lib/storage';

export type View = 'home' | 'sight' | 'piano' | 'tools' | 'progress' | 'theory' | 'ear' | 'live';

export interface SessionInput {
  domain: Domain;
  mode: string;
  total: number;
  correct: number;
  startedAt: number;
  endedAt: number;
  meta?: Record<string, string | number>;
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  'sight-reading': '识谱速认',
  piano: '钢琴',
  'ear-training': '听音练习',
  metronome: '节拍器',
};
