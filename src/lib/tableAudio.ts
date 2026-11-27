export type TableCue =
  | "enabled" | "deal" | "quickDeal" | "fold"
  | "chipOn" | "chipOff" | "clear" | "land" | "win" | "loss" | "tie" | "match"
  | { kind: "reveal"; hands: 1 | 2; instant: boolean }
  | { kind: "roll"; seconds: number };

// Offsets and lengths in seconds within public/table-sounds.mp3.
const clips = {
  dealNear: { offset: 0, length: 0.115 },
  dealFar: { offset: 0.25, length: 0.11 },
  flip: { offset: 0.5, length: 0.16 },
  gather: { offset: 0.75, length: 0.30 },
  chipOn: { offset: 1.15, length: 0.10 },
  chipOff: { offset: 1.35, length: 0.14 },
  clear: { offset: 1.60, length: 0.32 },
  land: { offset: 2.02, length: 0.18 },
  piano: { offset: 2.30, length: 0.94 },
  wheel: { offset: 3.40, length: 4.30 },
};

let samples: Promise<AudioBuffer | null> | undefined;

export function preloadTableSounds() {
  samples ??= fetch("/table-sounds.mp3")
    .then((response) => {
      if (!response.ok) throw new Error(`Table sound download returned ${response.status}`);
      return response.arrayBuffer();
    })
    .then((bytes) => new OfflineAudioContext(1, 1, 32000).decodeAudioData(bytes))
    .catch(() => {
      // Leave audio optional and allow the next interaction to retry loading.
      samples = undefined;
      return null;
    });
  return samples;
}

export function createTableAudio() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.58;
  master.connect(context.destination);
  let stopped = false;

  function play(cue: TableCue, delay = 0) {
    if (context.state !== "running") void context.resume().catch(() => {});
    const at = context.currentTime + 0.012 + delay;
    void preloadTableSounds().then((buffer) => {
      if (stopped || !buffer) return;

      function hit(name: keyof typeof clips, offset = 0, level = 1, rate = 1) {
        const clip = clips[name];
        const time = at + offset;
        // Skip elapsed audio when the first interaction beats the asset download.
        const skip = Math.max(0, context.currentTime - time) * rate;
        if (skip >= clip.length) return;

        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        gain.gain.value = level;
        source.connect(gain).connect(master);
        source.start(Math.max(time, context.currentTime), clip.offset + skip, clip.length - skip);
      }

      function notes(semitones: readonly number[], spacing: number, level: number) {
        semitones.forEach((note, index) => {
          hit("piano", index * spacing, level * (1 - index * 0.07), 2 ** (note / 12));
        });
      }

      if (typeof cue === "object") {
        if (cue.kind === "roll") {
          hit("wheel", 0, 0.94, clips.wheel.length / cue.seconds);
        } else {
          const firstFlip = cue.instant ? 0 : 0.16;
          const spacing = cue.instant ? 0.027 : 0.075;
          for (let index = 0; index < 3; index++) {
            const start = firstFlip + index * spacing;
            hit("flip", start, 0.74, 1 + index * 0.04);
            if (cue.hands === 2) hit("flip", start + 0.016, 0.5, 0.90 + index * 0.04);
          }
        }
        return;
      }

      switch (cue) {
        case "deal":
        case "quickDeal": {
          const spacing = cue === "deal" ? 0.075 : 0.026;
          for (let index = 0; index < 3; index++) {
            const start = index * spacing;
            hit("dealFar", start, 0.61, 0.92 + index * 0.05);
            hit("dealNear", start + 0.017, 0.82, 1.06 - index * 0.04);
          }
          break;
        }
        case "fold":
          hit("gather", 0, 0.81);
          break;
        case "chipOn":
        case "chipOff":
        case "clear":
        case "land":
          hit(cue, 0, 0.83);
          break;
        case "enabled":
          notes([7], 0, 0.52);
          break;
        case "win":
          notes([0, 4, 7, 12], 0.115, 0.88);
          break;
        case "loss":
          notes([3, 0, -5], 0.16, 0.64);
          break;
        case "tie":
          notes([0, 7], 0.14, 0.60);
          break;
        case "match":
          notes([7, 12], 0.12, 0.74);
          break;
      }
    });
  }

  return {
    play,
    stop() {
      stopped = true;
      master.disconnect();
      void context.close().catch(() => {});
    },
  };
}
