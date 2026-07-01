// Web Audio API Retro Sound Effects Synthesizer

class AudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private activeGainNodes: Set<GainNode> = new Set();

  constructor() {
    // Lazy initialized on first user interaction to satisfy browser policies
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      // Immediately adjust all running oscillator volumes to zero
      this.activeGainNodes.forEach((node) => {
        try {
          node.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
        } catch (e) {
          // ignore
        }
      });
    } else if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  getMuted() {
    return this.isMuted;
  }

  private createOscillator(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    gainStart: number,
    gainEnd: number = 0.001
  ) {
    this.init();
    if (!this.ctx || this.isMuted) return null;

    // Resume context if suspended (common in browsers)
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
    }

    gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(gainEnd, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // Track active gain node for instant muting
    this.activeGainNodes.add(gainNode);
    setTimeout(() => {
      this.activeGainNodes.delete(gainNode);
    }, duration * 1000 + 100);

    return { osc, gainNode };
  }

  playPing() {
    const sound = this.createOscillator("sine", 880, 800, 1.2, 0.1, 0.0001);
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 1.2);
    }
  }

  playBubble() {
    const sound = this.createOscillator("sine", 150, 450, 0.15, 0.15, 0.01);
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 0.15);
    }
  }

  playPickup() {
    // Double chime for crystal collection
    const now = this.ctx ? this.ctx.currentTime : 0;
    const sound1 = this.createOscillator("triangle", 523.25, 1046.5, 0.3, 0.15, 0.01); // C5 to C6
    if (sound1) {
      sound1.osc.start();
      sound1.osc.stop(now + 0.3);
    }

    setTimeout(() => {
      const sound2 = this.createOscillator("sine", 783.99, 1568.0, 0.4, 0.1, 0.001); // G5 to G6
      if (sound2) {
        sound2.osc.start();
        sound2.osc.stop(this.ctx!.currentTime + 0.4);
      }
    }, 80);
  }

  playUpgrade() {
    // Fast arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, index) => {
      setTimeout(() => {
        const sound = this.createOscillator("triangle", freq, freq * 1.05, 0.25, 0.12, 0.01);
        if (sound) {
          sound.osc.start();
          sound.osc.stop(this.ctx!.currentTime + 0.25);
        }
      }, index * 70);
    });
  }

  playError() {
    // Low-pitched error buzzer
    const sound = this.createOscillator("sawtooth", 130, 80, 0.25, 0.15, 0.01);
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 0.25);
    }
  }

  playAlarm() {
    // High-pitched warning chirp
    const sound = this.createOscillator("sawtooth", 987.77, 987.77, 0.12, 0.08, 0.001); // B5
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 0.12);
    }
  }

  playHit() {
    // Thump noise when hitting sea mines/jellyfish
    const sound = this.createOscillator("triangle", 150, 40, 0.4, 0.3, 0.01);
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 0.4);
    }
  }

  playGameOver() {
    // Sad descending slide
    const sound = this.createOscillator("sawtooth", 220, 55, 1.2, 0.25, 0.001); // A3 to A1
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 1.2);
    }
  }

  playSplash() {
    // Gentle white noise simulation with standard oscillator sweep
    const sound = this.createOscillator("sine", 120, 30, 0.5, 0.25, 0.01);
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 0.5);
    }
  }

  playHarpoon() {
    // High-pitched laser/zip sound
    const sound = this.createOscillator("triangle", 600, 150, 0.18, 0.18, 0.001);
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 0.18);
    }
  }

  playLaser() {
    // Futuristic high-pitched plasma laser sound
    const sound = this.createOscillator("sawtooth", 900, 300, 0.12, 0.14, 0.001);
    if (sound) {
      sound.osc.start();
      sound.osc.stop(this.ctx!.currentTime + 0.12);
    }
  }
}

export const audioSynth = new AudioSynth();
