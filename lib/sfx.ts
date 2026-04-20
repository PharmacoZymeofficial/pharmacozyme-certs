let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  type: OscillatorType,
  duration: number,
  volume = 0.18,
  delay = 0
) {
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
  gain.gain.setValueAtTime(volume, ac.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ac.currentTime + delay + duration
  );
  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration + 0.01);
}

export const sfx = {
  /** Ascending chime — create / generate success */
  success() {
    tone(523, "sine", 0.12, 0.18);
    tone(659, "sine", 0.14, 0.14, 0.09);
    tone(784, "sine", 0.18, 0.10, 0.18);
  },

  /** Low buzz — error / fail */
  error() {
    tone(180, "square", 0.12, 0.14);
    tone(140, "square", 0.18, 0.10, 0.10);
  },

  /** Descending whoosh — delete */
  delete() {
    tone(440, "sine", 0.06, 0.12);
    tone(330, "sine", 0.08, 0.09, 0.06);
    tone(220, "sine", 0.12, 0.06, 0.12);
  },

  /** Soft tick — generic button */
  click() {
    tone(900, "sine", 0.04, 0.06);
  },

  /** Double ding — notification / info */
  notify() {
    tone(659, "sine", 0.08, 0.12);
    tone(880, "sine", 0.10, 0.08, 0.10);
  },

  /** Rising cascade — import complete */
  import() {
    tone(440, "sine", 0.07, 0.10);
    tone(523, "sine", 0.07, 0.10, 0.08);
    tone(659, "sine", 0.07, 0.10, 0.16);
    tone(784, "sine", 0.10, 0.08, 0.24);
    tone(1046, "sine", 0.14, 0.06, 0.32);
  },

  /** Gentle pop — modal open */
  pop() {
    tone(700, "sine", 0.06, 0.08);
    tone(900, "sine", 0.08, 0.05, 0.05);
  },

  /** Email swoosh */
  send() {
    tone(523, "sine", 0.06, 0.10);
    tone(784, "sine", 0.08, 0.10, 0.06);
    tone(1046, "sine", 0.12, 0.08, 0.12);
  },

  /** Quick upward whoosh — gift box lid popping off */
  unwrap() {
    tone(392, "sine", 0.06, 0.10);
    tone(523, "sine", 0.06, 0.10, 0.05);
    tone(659, "sine", 0.06, 0.10, 0.10);
    tone(880, "triangle", 0.10, 0.08, 0.15);
  },

  /** Big triumphant fanfare — certificate reveal */
  fanfare() {
    tone(523, "triangle", 0.14, 0.14);
    tone(659, "triangle", 0.14, 0.14, 0.10);
    tone(784, "triangle", 0.14, 0.14, 0.20);
    tone(1046, "triangle", 0.28, 0.16, 0.32);
    tone(1318, "sine", 0.30, 0.10, 0.36);
    tone(784, "sine", 0.20, 0.08, 0.60);
    tone(1046, "sine", 0.32, 0.10, 0.70);
  },

  /** Sparkle twinkle — confetti / magic accent */
  sparkle() {
    tone(1500, "sine", 0.05, 0.06);
    tone(1800, "sine", 0.05, 0.06, 0.05);
    tone(2200, "sine", 0.07, 0.05, 0.10);
    tone(1800, "sine", 0.05, 0.04, 0.16);
  },

  /** Gentle chime — card hover / minor interaction */
  tick() {
    tone(1200, "sine", 0.03, 0.05);
  },

  /** Soft swoosh — share action */
  share() {
    tone(660, "sine", 0.06, 0.08);
    tone(990, "sine", 0.08, 0.07, 0.05);
  },
};
