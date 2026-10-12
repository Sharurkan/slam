interface Tone {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  /** Seconds after "now". */
  delay?: number;
}

const MASTER_VOLUME = 0.7;
const DEFAULT_VOLUME = 0.3;
const SILENT = 0.0001;

export interface Sound {
  /** Must be called from a user gesture (remote OK button), or browsers keep audio muted. */
  unlock(): Promise<boolean>;
  isUnlocked(): boolean;
  beep(): void;
  buzz(): void;
}

/** Returns null when Web Audio is not available. */
export function createSound(): Sound | null {
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(context.destination);

  function envelope(volume: number, start: number, duration: number): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(SILENT, start + duration);
    gain.connect(master);
    return gain;
  }

  function play(tone: Tone): void {
    if (context.state !== 'running') return;
    const start = context.currentTime + (tone.delay ?? 0);
    const oscillator = context.createOscillator();
    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    oscillator.connect(envelope(tone.volume ?? DEFAULT_VOLUME, start, tone.duration));
    oscillator.start(start);
    oscillator.stop(start + tone.duration);
  }

  const beep = (): void => {
    play({ frequency: 880, duration: 0.15 });
  };

  return {
    unlock: async () => {
      try {
        await context.resume();
      } catch {
        return false;
      }
      beep();
      return context.state === 'running';
    },
    isUnlocked: () => context.state === 'running',
    beep,
    buzz: () => {
      [0, 0.16].forEach((delay) => {
        play({ frequency: 740, duration: 0.12, type: 'square', volume: 0.12, delay });
      });
    },
  };
}
