// Synthesizes the soundtrack: 128 BPM, 32 bars = exactly 60 s. Writes music.wav.
import { writeFileSync } from "node:fs";

const SR = 44100, BEAT = 0.46875, BAR = BEAT * 4, S16 = BEAT / 4, BARS = 32;
const N = Math.round(BARS * BAR * SR);
const track = () => new Float32Array(N);
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 1;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1;
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

function voice(buf, start, dur, fn) {
  const a = Math.max(0, Math.round(start * SR)), b = Math.min(N, a + Math.round(dur * SR));
  for (let i = a; i < b; i++) buf[i] += fn((i - a) / SR);
}
function lowpass(buf, cutoff) {
  let y = 0;
  for (let i = 0; i < N; i++) { const fc = typeof cutoff === "function" ? cutoff(i / SR) : cutoff; y += (1 - Math.exp(-2 * Math.PI * fc / SR)) * (buf[i] - y); buf[i] = y; }
  return buf;
}
function highpass(buf, fc) { const low = lowpass(Float32Array.from(buf), fc); for (let i = 0; i < N; i++) buf[i] -= low[i]; return buf; }

// vi-IV-I-V, ending on the tonic.
const CH = {
  Am: { bass: 33, tones: [57, 60, 64], lead: [76, null, 74, 72, null, 76, null, 72] },
  F: { bass: 29, tones: [53, 57, 60], lead: [72, null, 69, 72, null, 77, null, 76] },
  C: { bass: 36, tones: [55, 60, 64], lead: [79, null, 76, 72, null, 76, null, 79] },
  G: { bass: 31, tones: [55, 59, 62], lead: [74, null, 71, 74, null, 79, null, 74] },
};
const prog = Array.from({ length: BARS }, (_, b) => ["Am", "F", "C", "G"][b % 4]);
prog[28] = "F"; prog[29] = "G"; prog[30] = "C"; prog[31] = "C";

const has = {
  kick: (b) => (b >= 2 && b < 31 && b !== 20),
  clap: (b) => b >= 4 && b < 31,
  hats: (b) => b >= 2 && b < 31,
  bass: (b) => b >= 4 && b < 31 && b !== 20,
  lead: (b) => (b >= 12 && b < 20) || (b >= 21 && b < 28) || b === 30,
};
const CRASH = [0, 4, 8, 12, 16, 21, 24, 28, 30, 31];

const kick = track(), clap = track(), hat = track(), bass = track(), arp = track(), pad = track(), lead = track(), fx = track(), sfx = track();
const kickTimes = [];

for (let b = 0; b < BARS; b++) {
  const t0 = b * BAR, ch = CH[prog[b]];
  const last = b === 31;

  for (let q = 0; q < 4; q++) {
    const t = t0 + q * BEAT;
    if (has.kick(b) || (q === 0 && (b === 0 || last))) {
      kickTimes.push(t);
      voice(kick, t, 0.32, (x) => Math.sin(2 * Math.PI * (48 * x + (110 / 28) * (1 - Math.exp(-28 * x)))) * Math.exp(-x * 9) + (x < 0.004 ? 0.5 : 0));
    }
    if (has.clap(b) && (q === 1 || q === 3)) voice(clap, t, 0.2, (x) => noise() * (Math.exp(-x * 26) + 0.5 * Math.exp(-Math.abs(x - 0.012) * 300)));
    if (has.bass(b)) voice(bass, t + BEAT / 2, 0.21, (x) => (saw(hz(ch.bass + 12) * x) * 0.6 + Math.sin(2 * Math.PI * hz(ch.bass + 12) * x)) * Math.min(1, x * 200) * Math.exp(-x * 5) * (x > 0.18 ? (0.21 - x) / 0.03 : 1));
  }
  // Snare roll into each drop.
  if (b === 3 || b === 20) for (let s = 8; s < 16; s++) voice(clap, t0 + s * S16, 0.1, (x) => noise() * Math.exp(-x * 40) * (0.35 + 0.65 * (s - 8) / 8));

  if (has.hats(b)) for (let s = 0; s < 16; s++) {
    const open = s % 4 === 2;
    voice(hat, t0 + s * S16, open ? 0.12 : 0.04, (x) => noise() * Math.exp(-x * (open ? 22 : 90)) * (open ? 1 : s % 2 ? 0.35 : 0.55));
  }

  // Plucked arpeggio, 16th notes.
  if (!last) for (let s = 0; s < 16; s++) {
    const tn = ch.tones, seq = [tn[0], tn[1], tn[2], tn[0] + 12, tn[2], tn[1], tn[0] + 12, tn[2]];
    const f = hz(seq[s % 8] + 12);
    voice(arp, t0 + s * S16, 0.22, (x) => (saw(f * x) * 0.5 + (saw(f * x) > 0 ? 0.35 : -0.35)) * Math.exp(-x * 17) * Math.min(1, x * 400));
  }

  // Sustained chord, later pumped by the kick.
  const len = last ? BAR * 0.98 : BAR;
  for (const m of ch.tones) for (const det of [-0.07, 0.07]) {
    const f = hz(m + det);
    voice(pad, t0, len, (x) => saw(f * x) * 0.17 * Math.min(1, x * 30) * Math.min(1, (len - x) * 30));
  }

  if (has.lead(b)) ch.lead.forEach((m, e) => {
    if (m === null) return;
    const f = hz(m);
    voice(lead, t0 + e * BEAT / 2, 0.3, (x) => (Math.sin(2 * Math.PI * f * x + 0.25 * Math.sin(2 * Math.PI * 5.5 * x)) * 0.7 + saw(f * x) * 0.3) * Math.min(1, x * 300) * Math.exp(-x * 7));
  });
}

for (const b of CRASH) voice(fx, b * BAR, 1.4, (x) => noise() * Math.exp(-x * 3.2) * 0.8);
// Noise risers into bar 5 and bar 22.
for (const [from, len] of [[2 * BAR, 2 * BAR], [20 * BAR, BAR]]) voice(fx, from, len, (x) => noise() * (x / len) ** 2 * 0.55);

// Interface sounds, timed to the picture.
const blip = (t, f0, f1, vol = 0.5) => voice(sfx, t, 0.09, (x) => Math.sin(2 * Math.PI * (f0 * x + (f1 - f0) * x * x / 0.18)) * Math.exp(-x * 30) * vol);
const bell = (t, m, vol = 0.5, decay = 5) => voice(sfx, t, 0.9, (x) => (Math.sin(2 * Math.PI * hz(m) * x) + 0.4 * Math.sin(2 * Math.PI * hz(m) * 2.01 * x)) * Math.exp(-x * decay) * vol);
[22.5 + 0.94, 22.5 + 3.75, 22.5 + 5.625, 30 + 1.4, 45 + 4.69].forEach((t) => blip(t, 700, 1200));            // diner messages
[22.5 + 0.3, 22.5 + 2.1, 22.5 + 4.69, 30 + 0.47, 45 + 0.47, 45 + 1.4, 45 + 5.85].forEach((t) => blip(t, 1100, 800, 0.4)); // agent messages
blip(15 + 1.875, 1760, 1760, 0.6);                                                                           // QR scanned
[84, 88, 91].forEach((m, i) => bell(7.5 + 5.625 + i * 0.07, m, 0.3, 7));                                     // QR ready
[84, 88, 91, 96].forEach((m, i) => bell(30 + 3.75 + i * 0.08, m, 0.4));                                      // order placed
bell(37.5 + 1.875, 88, 0.6); bell(37.5 + 1.875 + 0.16, 93, 0.6, 4);                                          // order reaches the kitchen
bell(37.5 + 5.625, 91, 0.35, 8);                                                                             // marked served

// Tone shaping.
highpass(clap, 900); highpass(hat, 6500); highpass(fx, 3500);
lowpass(bass, 700);
lowpass(arp, (t) => (t < 2 * BAR ? 700 + 3300 * (t / (2 * BAR)) : 4000));
lowpass(pad, (t) => (t < 4 * BAR ? 350 + 1850 * (t / (4 * BAR)) ** 2 : 2200));
lowpass(lead, 5000);

// Sidechain: everything melodic ducks under each kick.
const duck = new Float32Array(N).fill(1);
for (const t of kickTimes) { const a = Math.round(t * SR); for (let i = a; i < Math.min(N, a + SR * 0.4); i++) duck[i] = Math.min(duck[i], 1 - 0.75 * Math.exp(-((i - a) / SR) * 9)); }

const L = new Float32Array(N), R = new Float32Array(N);
const mix = (buf, gain, pan = 0, ducked = false) => { for (let i = 0; i < N; i++) { const v = buf[i] * gain * (ducked ? duck[i] : 1); L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); } };
// Ping-pong echo for the arp and lead.
function echo(buf, gain, time, feedback) {
  const d = Math.round(time * SR), wetL = new Float32Array(N), wetR = new Float32Array(N);
  for (let i = d; i < N; i++) { wetL[i] = (buf[i - d] + wetR[i - d]) * feedback; wetR[i] = wetL[i - d] * 0.9; }
  for (let i = 0; i < N; i++) { L[i] += wetL[i] * gain * duck[i]; R[i] += wetR[i] * gain * duck[i]; }
}
mix(kick, 1.0); mix(clap, 0.42); mix(hat, 0.2, 0.15); mix(bass, 0.5, 0, true);
mix(arp, 0.3, -0.25, true); echo(arp, 0.3, S16 * 3, 0.4);
mix(pad, 0.42, 0, true); mix(lead, 0.3, 0.2, true); echo(lead, 0.3, BEAT * 0.75, 0.35);
mix(fx, 0.3); mix(sfx, 0.55);

// Soft clip, fade the last bar out, normalise.
let peak = 0, sum = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t > 58.6 ? Math.max(0, (60 - t) / 1.4) ** 1.5 : 1;
  L[i] = Math.tanh(L[i] * 0.9) * fade; R[i] = Math.tanh(R[i] * 0.9) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sum += L[i] * L[i] + R[i] * R[i];
}
const g = 0.94 / peak, out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVEfmt ", 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
writeFileSync(new URL("music.wav", import.meta.url), out);
console.log(`music.wav: ${(N / SR).toFixed(2)} s, peak before normalise ${peak.toFixed(3)}, RMS ${(Math.sqrt(sum / (2 * N)) * g).toFixed(3)}, NaN: ${Number.isNaN(sum)}`);
