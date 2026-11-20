import { useEffect, useRef, useState } from 'react';
import { Formatter, GhostNote, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { parseNote } from '../lib/notes';

interface StaffProps {
  notes: string[];
  clef?: 'treble' | 'bass';
  highlight?: number;
  height?: number;
}

const HIGHLIGHT = { fillStyle: '#b0522f', strokeStyle: '#b0522f' };

export function Staff({ notes, clef = 'treble', highlight = -1, height = 150 }: StaffProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? host.clientWidth;
      setWidth(Math.floor(next));
    });
    observer.observe(host);
    setWidth(Math.floor(host.clientWidth));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || width < 220) return;

    host.innerHTML = '';
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const stave = new Stave(8, 14, width - 16);
    stave.addClef(clef);
    stave.setContext(context).draw();

    const vexNotes = notes.map((name, index) => {
      const parsed = parseNote(name);
      const note = new StaveNote({
        keys: [`${parsed.letter.toLowerCase()}${parsed.accidental}/${parsed.octave}`],
        duration: 'q',
        auto_stem: true,
      });
      if (index === highlight) note.setStyle(HIGHLIGHT);
      return note;
    });

    const beats = notes.length === 1 ? 4 : Math.max(notes.length, 1);
    const voice = new Voice({ num_beats: beats, beat_value: 4 }).setStrict(false);
    if (vexNotes.length === 1) {
      voice.addTickables([
        new GhostNote({ duration: 'h' }),
        vexNotes[0],
        new GhostNote({ duration: 'q' }),
      ]);
    } else {
      voice.addTickables(vexNotes);
    }

    const formatWidth = Math.max(120, width - 40 - stave.getNoteStartX());
    new Formatter().joinVoices([voice]).format([voice], formatWidth);
    voice.draw(context, stave);
  }, [notes, clef, highlight, width, height]);

  return <div className="staff" ref={hostRef} aria-hidden="true" />;
}
