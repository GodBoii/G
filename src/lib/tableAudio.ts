export type TableCue =
  | "enabled" | "deal" | "quickDeal" | "reveal" | "fold"
  | "chipOn" | "chipOff" | "clear" | "land" | "win" | "loss" | "tie"
  | { rollSeconds: number };

const silence = 0.0001;

export function createTableAudio() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.28;
  master.connect(context.destination);

  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.18), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let index = 0; index < samples.length; index++) {
    samples[index] = Math.random() * 2 - 1;
  }

  function strike(source: AudioScheduledSourceNode, at: number, length: number, level: number, input: AudioNode = source) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(silence, at);
    envelope.gain.exponentialRampToValueAtTime(level, at + Math.min(0.008, length / 4));
    envelope.gain.exponentialRampToValueAtTime(silence, at + length);
    input.connect(envelope).connect(master);
    source.start(at);
    source.stop(at + length);
  }

  function tone(at: number, length: number, from: number, to: number, level: number, shape: OscillatorType = "sine") {
    const oscillator = context.createOscillator();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(to, at + length);
    strike(oscillator, at, length, level);
  }

  function brush(at: number, length: number, from: number, to: number, level: number) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + length);
    source.connect(filter);
    strike(source, at, length, level, filter);
  }

  function chip(at: number, pitch: number, level = 0.17) {
    tone(at, 0.056, pitch, pitch * 0.84, level, "triangle");
    brush(at, 0.024, pitch * 2.6, pitch * 1.7, level * 0.65);
  }

  function chime(at: number, notes: readonly number[]) {
    notes.forEach((pitch, index) => {
      const start = at + index * 0.095;
      tone(start, 0.38, pitch, pitch, 0.19);
      tone(start, 0.15, pitch * 2, pitch * 2, 0.038);
    });
  }

  function play(cue: TableCue, delay = 0) {
    if (context.state !== "running") void context.resume().catch(() => {});
    const at = context.currentTime + 0.012 + delay;

    if (typeof cue === "object") {
      // The ball moves quickly at first and hits the pocket dividers less often as it slows.
      const { rollSeconds } = cue;
      for (let elapsed = 0.035; elapsed < rollSeconds - 0.09;) {
        const progress = elapsed / rollSeconds;
        const pitch = 1390 - progress * 640 + Math.sin(elapsed * 41) * 160;
        chip(at + elapsed, pitch, 0.075 + progress * 0.06);
        elapsed += 0.053 + 0.28 * progress ** 2;
      }
      return;
    }

    switch (cue) {
      case "deal":
      case "quickDeal": {
        const spacing = cue === "deal" ? 0.075 : 0.024;
        for (let index = 0; index < 3; index++) {
          const start = at + index * spacing;
          brush(start, 0.1, 2900 - index * 310, 540, 0.31);
          tone(start + 0.032, 0.08, 205 - index * 19, 97, 0.12);
        }
        break;
      }
      case "reveal":
        brush(at, 0.135, 720, 3000, 0.34);
        brush(at + 0.081, 0.06, 2300, 650, 0.25);
        break;
      case "fold":
        brush(at, 0.16, 2050, 400, 0.33);
        tone(at + 0.055, 0.13, 175, 72, 0.17);
        break;
      case "chipOn":
        chip(at, 1150);
        chip(at + 0.032, 780, 0.08);
        break;
      case "chipOff":
        chip(at, 640, 0.13);
        break;
      case "clear":
        brush(at, 0.13, 1350, 530, 0.26);
        chip(at + 0.035, 920, 0.10);
        chip(at + 0.070, 630, 0.10);
        break;
      case "land":
        chip(at, 920, 0.21);
        tone(at + 0.02, 0.14, 310, 126, 0.17);
        break;
      case "enabled":
        chime(at, [523.25, 659.25]);
        break;
      case "win":
        chime(at, [523.25, 659.25, 783.99, 1046.5]);
        break;
      case "loss":
        chime(at, [329.63, 246.94]);
        break;
      case "tie":
        chime(at, [392, 523.25]);
        break;
    }
  }

  return {
    play,
    stop() {
      master.disconnect();
      void context.close().catch(() => {});
    },
  };
}
