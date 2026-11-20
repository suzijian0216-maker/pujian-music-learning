export type LayoutId = 'split' | 'rows';

export interface WhiteKey {
  note: string;
  code: string;
}

export interface BlackKey extends WhiteKey {
  after: number;
}

export interface KeyLayout {
  id: LayoutId;
  name: string;
  hint: string;
  whites: WhiteKey[];
  blacks: BlackKey[];
  first: string;
  last: string;
}

export const LAYOUT_NAMES: Record<LayoutId, string> = {
  split: '双手分区',
  rows: '双排两八度',
};

const LABELS: Record<string, string> = {
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
};

export function keyLabel(code: string): string {
  if (LABELS[code]) return LABELS[code];
  return code.replace('Key', '').replace('Digit', '');
}

const SPLIT_WHITE: Array<[string, number, string]> = [
  ['C', 0, 'KeyA'],
  ['D', 0, 'KeyS'],
  ['E', 0, 'KeyD'],
  ['F', 0, 'KeyF'],
  ['G', 0, 'KeyG'],
  ['A', 0, 'KeyH'],
  ['B', 0, 'KeyJ'],
  ['C', 1, 'KeyK'],
  ['D', 1, 'KeyL'],
  ['E', 1, 'Semicolon'],
];

const SPLIT_BLACK: Array<[string, number, string, number]> = [
  ['C#', 0, 'KeyW', 0],
  ['D#', 0, 'KeyE', 1],
  ['F#', 0, 'KeyT', 3],
  ['G#', 0, 'KeyY', 4],
  ['A#', 0, 'KeyU', 5],
  ['C#', 1, 'KeyO', 7],
  ['D#', 1, 'KeyP', 8],
];

const ROWS_CODES = [
  ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM'],
  ['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU'],
];

const SEMIS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE_SEMI = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMI = [1, 3, 6, 8, 10];
const BLACK_AFTER = [0, 1, 3, 4, 5];

export function buildLayout(id: LayoutId, baseOctave: number): KeyLayout {
  if (id === 'split') {
    const whites = SPLIT_WHITE.map(([letter, offset, code]) => ({
      note: `${letter}${baseOctave + offset}`,
      code,
    }));
    const blacks = SPLIT_BLACK.map(([letter, offset, code, after]) => ({
      note: `${letter}${baseOctave + offset}`,
      code,
      after,
    }));
    return {
      id,
      name: LAYOUT_NAMES[id],
      hint: '左手 A–G 弹低音、右手 H–; 弹高音；黑键在上一排 W E T Y U O P',
      whites,
      blacks,
      first: whites[0].note,
      last: whites[whites.length - 1].note,
    };
  }

  const whites: WhiteKey[] = [];
  const blacks: BlackKey[] = [];
  for (let octave = 0; octave < 2; octave += 1) {
    WHITE_SEMI.forEach((semi) => {
      whites.push({ note: `${SEMIS[semi]}${baseOctave + octave}`, code: ROWS_CODES[octave][semi] });
    });
    BLACK_SEMI.forEach((semi, index) => {
      blacks.push({
        note: `${SEMIS[semi]}${baseOctave + octave}`,
        code: ROWS_CODES[octave][semi],
        after: octave * 7 + BLACK_AFTER[index],
      });
    });
  }
  return {
    id,
    name: LAYOUT_NAMES[id],
    hint: '下排 Z–M 弹 C5–B5、上排 Q–U 弹 C6–B6；黑键在 S D G H J 与 2 3 5 6 7',
    whites,
    blacks,
    first: whites[0].note,
    last: whites[whites.length - 1].note,
  };
}
