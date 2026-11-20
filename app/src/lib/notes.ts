export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];
export type Accidental = '' | '#' | 'b';
export type Naming = 'letter' | 'solfege';

const SEMITONE: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SOLFEGE: Record<Letter, string> = { C: 'do', D: 're', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' };

export interface NoteParts {
  letter: Letter;
  accidental: Accidental;
  octave: number;
}

export function parseNote(name: string): NoteParts {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!match) throw new Error(`Invalid note: ${name}`);
  return {
    letter: match[1] as Letter,
    accidental: (match[2] || '') as Accidental,
    octave: Number(match[3]),
  };
}

export function midiOf(name: string): number {
  const note = parseNote(name);
  const accidental = note.accidental === '#' ? 1 : note.accidental === 'b' ? -1 : 0;
  return (note.octave + 1) * 12 + SEMITONE[note.letter] + accidental;
}

export function freqOf(name: string, a4 = 440): number {
  return a4 * Math.pow(2, (midiOf(name) - 69) / 12);
}

export function diatonicIndex(name: string): number {
  const note = parseNote(name);
  return note.octave * 7 + LETTERS.indexOf(note.letter);
}

export function nameFromDiatonic(index: number): string {
  const octave = Math.floor(index / 7);
  const letter = LETTERS[((index % 7) + 7) % 7];
  return `${letter}${octave}`;
}

export function labelOf(name: string, naming: Naming = 'letter'): string {
  if (naming === 'letter') return name;
  const note = parseNote(name);
  return `${SOLFEGE[note.letter]}${note.octave}`;
}

export function describePosition(name: string, clef: 'treble' | 'bass'): string {
  const bottom = clef === 'treble' ? 'E4' : 'G2';
  const delta = diatonicIndex(name) - diatonicIndex(bottom);
  if (delta < 0) {
    const n = Math.ceil(-delta / 2);
    return delta % 2 === 0 ? `下加${n}线` : `下加${n}间`;
  }
  if (delta > 8) {
    const above = delta - 8;
    const n = Math.ceil(above / 2);
    return above % 2 === 0 ? `上加${n}线` : `上加${n}间`;
  }
  return delta % 2 === 0 ? `第${delta / 2 + 1}线` : `第${(delta + 1) / 2}间`;
}
