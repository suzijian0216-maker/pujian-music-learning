/** Normalized autocorrelation, voiced single notes only; no polyphonic scoring. */
export interface Pitch { frequency: number; clarity: number }
export function detectPitch(samples: Float32Array, sampleRate: number): Pitch | null {
  // Downsample to about 24 kHz to bound work per analysis frame.
  const stride = Math.max(1, Math.round(sampleRate / 24000));
  const length = Math.floor(samples.length / stride);
  const signal = new Float32Array(length);
  let mean = 0;
  for (let i = 0; i < length; i++) mean += samples[i * stride];
  mean /= length;
  let energy = 0;
  for (let i = 0; i < length; i++) { signal[i] = samples[i * stride] - mean; energy += signal[i] ** 2; }
  if (Math.sqrt(energy / length) < 0.004) return null;
  const rate = sampleRate / stride;
  const minLag = Math.max(2, Math.floor(rate / 2100));
  const maxLag = Math.min(Math.ceil(rate / 65), Math.floor(length / 2));
  const correlations = new Float32Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let cross = 0; let a = 0; let b = 0;
    for (let i = 0; i < length - lag; i++) { const x = signal[i]; const y = signal[i + lag]; cross += x * y; a += x * x; b += y * y; }
    correlations[lag] = 2 * cross / Math.max(a + b, 1e-12);
  }
  let best = 0;
  const peaks: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (correlations[lag] > correlations[lag - 1] && correlations[lag] >= correlations[lag + 1]) {
      peaks.push(lag); best = Math.max(best, correlations[lag]);
    }
  }
  if (best < 0.85) return null;
  // Earliest sufficiently strong periodic peak avoids most octave-down errors.
  const lag = peaks.find((value) => correlations[value] >= Math.max(0.85, best * 0.96));
  if (lag === undefined) return null;
  const left = correlations[lag - 1], center = correlations[lag], right = correlations[lag + 1];
  const denominator = left - 2 * center + right;
  const shift = Math.abs(denominator) < 1e-10 ? 0 : 0.5 * (left - right) / denominator;
  const frequency = rate / (lag + Math.max(-0.5, Math.min(0.5, shift)));
  return frequency >= 65 && frequency <= 2000 ? { frequency, clarity: center } : null;
}
export function pitchName(frequency: number, a4: number) {
  const midiFloat = 69 + 12 * Math.log2(frequency / a4);
  const midi = Math.round(midiFloat);
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  return { name: `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`, midi, cents: (midiFloat - midi) * 100, midiFloat };
}
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}
