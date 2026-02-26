export class AudioPlayer {
  private context: AudioContext | null = null;
  private queue: AudioBuffer[] = [];
  private playing = false;
  private currentSource: AudioBufferSourceNode | null = null;

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: 24000 });
    }
    return this.context;
  }

  async enqueue(pcm16Data: ArrayBuffer) {
    const ctx = this.getContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Convert PCM16 to Float32
    const int16 = new Int16Array(pcm16Data);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    this.queue.push(buffer);

    if (!this.playing) {
      this.playNext();
    }
  }

  private playNext() {
    const ctx = this.context;
    if (!ctx || this.queue.length === 0) {
      this.playing = false;
      return;
    }

    this.playing = true;
    const buffer = this.queue.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      this.currentSource = null;
      this.playNext();
    };
    this.currentSource = source;
    source.start();
  }

  stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
    this.queue = [];
    this.playing = false;
  }

  async close() {
    this.stop();
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}
