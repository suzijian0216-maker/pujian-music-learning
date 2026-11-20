import { keyLabel, type KeyLayout } from '../lib/layouts';

interface PianoKeyboardProps {
  layout: KeyLayout;
  active: Set<string>;
  target?: string;
  onDown: (note: string, code: string) => void;
  onUp: (note: string, code: string) => void;
}

export function PianoKeyboard({ layout, active, target, onDown, onUp }: PianoKeyboardProps) {
  const whiteWidth = 100 / layout.whites.length;

  return (
    <div className="piano-wrap">
      <div className="piano">
        {layout.whites.map((key) => {
          const classes = ['wkey'];
          if (active.has(key.note)) classes.push('active');
          if (target === key.note) classes.push('target');
          return (
            <button
              key={key.note}
              type="button"
              className={classes.join(' ')}
              style={{ width: `${whiteWidth}%` }}
              aria-label={`${key.note}（键盘 ${keyLabel(key.code)}）`}
              onPointerDown={(event) => {
                event.preventDefault();
                onDown(key.note, key.code);
              }}
              onPointerUp={() => onUp(key.note, key.code)}
              onPointerLeave={() => onUp(key.note, key.code)}
              onPointerCancel={() => onUp(key.note, key.code)}
            >
              <span className="klabel">{keyLabel(key.code)}</span>
              <span className="knote">{key.note}</span>
            </button>
          );
        })}

        {layout.blacks.map((key) => {
          const classes = ['bkey'];
          if (active.has(key.note)) classes.push('active');
          if (target === key.note) classes.push('target');
          return (
            <button
              key={key.note}
              type="button"
              className={classes.join(' ')}
              style={{
                width: `${whiteWidth * 0.62}%`,
                left: `${(key.after + 1) * whiteWidth - whiteWidth * 0.31}%`,
              }}
              aria-label={`${key.note}（键盘 ${keyLabel(key.code)}）`}
              onPointerDown={(event) => {
                event.preventDefault();
                onDown(key.note, key.code);
              }}
              onPointerUp={() => onUp(key.note, key.code)}
              onPointerLeave={() => onUp(key.note, key.code)}
              onPointerCancel={() => onUp(key.note, key.code)}
            >
              <span className="klabel">{keyLabel(key.code)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
