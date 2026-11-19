// Generuje dźwięk alarmu (WAV, PCM 16-bit mono) – używany w przeglądarce
// (public/sounds/alarm.wav) i jako dźwięk kanału powiadomień na Androidzie
// (android/app/src/main/res/raw/alarm.wav).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 44100;
const DURATION = 3.6;
const N = Math.floor(RATE * DURATION);
const buf = new Float32Array(N);

// Dzwonek: ton podstawowy + harmoniczne + lekko „metaliczny” alikwot
function bell(t0, freq, len = 0.55, gain = 1) {
  const start = Math.floor(t0 * RATE);
  const n = Math.floor(len * RATE);
  for (let i = 0; i < n && start + i < N; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004);
    const env = attack * Math.exp(-t * 7.5);
    const s =
      Math.sin(2 * Math.PI * freq * t) * 0.62 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.22 * Math.exp(-t * 5) +
      Math.sin(2 * Math.PI * freq * 3.01 * t) * 0.1 * Math.exp(-t * 9) +
      Math.sin(2 * Math.PI * freq * 4.2 * t) * 0.06 * Math.exp(-t * 14);
    buf[start + i] += s * env * gain;
  }
}

const E6 = 1318.51;
const Gs6 = 1661.22;
const B6 = 1975.53;
const E7 = 2637.02;

for (const base of [0, 0.95, 1.9]) {
  bell(base + 0.0, E6);
  bell(base + 0.13, Gs6);
  bell(base + 0.26, B6, 0.7);
}
bell(2.85, E7, 0.75, 0.8);
bell(2.85, B6, 0.75, 0.5);

// Normalizacja do -1 dBFS + delikatna saturacja (głośniej, ale bez przesterów)
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
const target = 0.89;
const pcm = Buffer.alloc(44 + N * 2);
for (let i = 0; i < N; i++) {
  const x = (buf[i] / peak) * 1.25;
  const y = Math.tanh(x) / Math.tanh(1.25);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, y * target)) * 32767), 44 + i * 2);
}

// Nagłówek WAV
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + N * 2, 4);
pcm.write('WAVE', 8);
pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(N * 2, 40);

const targets = [join(root, 'public/sounds/alarm.wav')];
if (existsSync(join(root, 'android/app/src/main/res'))) targets.push(join(root, 'android/app/src/main/res/raw/alarm.wav'));
for (const t of targets) {
  mkdirSync(dirname(t), { recursive: true });
  writeFileSync(t, pcm);
  console.log('✓', t.replace(root + '/', ''), `${(pcm.length / 1024).toFixed(0)} KB`);
}
