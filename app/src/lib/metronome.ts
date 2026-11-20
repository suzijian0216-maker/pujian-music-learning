import { audioCtx, scheduleClick } from './audio';

type BeatHandler = (beat: number) => void;

/** 带 lookahead 的节拍器：音频用精确时间调度，UI 用对齐的 setTimeout 更新 */
export class Metronome {
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private running = false;

  constructor(
    private readonly getBpm: () => number,
    private readonly getBeats: () => number,
    private readonly onBeat: BeatHandler,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.beat = 0;
    this.nextTime = audioCtx().currentTime + 0.12;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const context = audioCtx();
    while (this.nextTime < context.currentTime + 0.15) {
      const beat = this.beat;
      scheduleClick(this.nextTime, beat === 0);
      const delay = Math.max(0, (this.nextTime - context.currentTime) * 1000);
      window.setTimeout(() => this.onBeat(beat), delay);
      this.nextTime += 60 / this.getBpm();
      this.beat = (this.beat + 1) % this.getBeats();
    }
  }
}
