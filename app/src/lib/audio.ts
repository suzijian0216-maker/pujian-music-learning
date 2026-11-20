let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export interface Voice {
  release(fast?: boolean): void;
}

/** 按住发声：起音 + 缓慢衰减，松开走释放包络 */
export function startVoice(freq: number, volume = 0.2): Voice {
  const context = audioCtx();
  const now = context.currentTime;

  const out = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(5200, now);
  filter.frequency.exponentialRampToValueAtTime(1500, now + 2.6);
  out.connect(filter).connect(context.destination);

  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  out.gain.exponentialRampToValueAtTime(volume * 0.28, now + 2);

  const oscillators: OscillatorNode[] = [];
  [1, 2, 3, 4].forEach((harmonic, index) => {
    const osc = context.createOscillator();
    osc.type = index === 0 ? 'triangle' : 'sine';
    osc.frequency.value = freq * harmonic;
    osc.detune.value = index === 1 ? 3 : index === 2 ? -4 : 0;
    const gain = context.createGain();
    gain.gain.value = index === 0 ? 1 : 0.32 / (index + 1);
    osc.connect(gain).connect(out);
    osc.start(now);
    oscillators.push(osc);
  });

  let released = false;
  return {
    release(fast = false) {
      if (released) return;
      released = true;
      const t = context.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0.0001, t, fast ? 0.03 : 0.09);
      oscillators.forEach((osc) => {
        try {
          osc.stop(t + (fast ? 0.14 : 0.55));
        } catch {
          /* already stopped */
        }
      });
    },
  };
}

/** 固定时长的单音，用于示范 / 试听 */
export function playTone(freq: number, duration = 0.6, volume = 0.16): void {
  const context = audioCtx();
  const now = context.currentTime;
  const out = context.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  out.connect(context.destination);

  [1, 2, 3].forEach((harmonic, index) => {
    const osc = context.createOscillator();
    osc.type = index === 0 ? 'triangle' : 'sine';
    osc.frequency.value = freq * harmonic;
    const gain = context.createGain();
    gain.gain.value = index === 0 ? 1 : 0.25 / (index + 1);
    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  });
}

/** 在指定时间点安排一个节拍器 click（用于 lookahead 调度） */
export function scheduleClick(time: number, accent: boolean): void {
  const context = audioCtx();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1680 : 1180;
  gain.gain.setValueAtTime(accent ? 0.1 : 0.055, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
  osc.connect(gain).connect(context.destination);
  osc.start(time);
  osc.stop(time + 0.05);
}
