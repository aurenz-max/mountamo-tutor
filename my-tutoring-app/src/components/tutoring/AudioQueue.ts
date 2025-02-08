class AudioQueue {
  private queue: AudioBuffer[] = [];
  private audioContext: AudioContext;
  private isPlaying = false;
  private onStateChange: (isPlaying: boolean) => void;
  private currentSource: AudioBufferSourceNode | null = null;
  private nextStartTime: number = 0;

  constructor(audioContext: AudioContext, onStateChange: (isPlaying: boolean) => void) {
    this.audioContext = audioContext;
    this.onStateChange = onStateChange;
  }

  async add(buffer: AudioBuffer) {
    console.log('Adding buffer, duration:', buffer.duration);
    this.queue.push(buffer);
    
    if (!this.isPlaying) {
      console.log('Starting playback');
      this.nextStartTime = this.audioContext.currentTime;
      this.play();
    }
  }

  private play() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentSource = null;
      this.onStateChange(false);
      return;
    }

    this.isPlaying = true;
    this.onStateChange(true);

    const buffer = this.queue.shift()!;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    this.currentSource = source;
    
    // Schedule the next buffer
    source.onended = () => {
      this.nextStartTime += buffer.duration;
      this.play();
    };

    // Start at the scheduled time
    source.start(this.nextStartTime);
    console.log(`Playing buffer at time ${this.nextStartTime}, duration: ${buffer.duration}`);
  }

  clear() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        console.warn('Error stopping current source:', e);
      }
    }
    this.queue = [];
    this.isPlaying = false;
    this.currentSource = null;
    this.nextStartTime = 0;
    this.onStateChange(false);
  }
}

export default AudioQueue;