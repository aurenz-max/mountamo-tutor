// src/lib/AudioSyncManager.ts
// A lightweight utility to help synchronize audio playback with visemes

/**
 * Timing information for audio-viseme synchronization
 */
export interface AudioTimingInfo {
    serverTimestamp: number;   // Server timestamp (in ms)
    clientTimestamp: number;   // Client-side timestamp when audio was scheduled
    scheduledPlaybackTime: number; // When the audio is scheduled to play
    duration: number;          // Duration of the audio chunk in ms
    visemeLeadTime?: number;   // How much to lead visemes before audio (ms)
  }
  
  /**
   * Singleton manager for audio-viseme synchronization
   */
  class AudioSyncManager {
    private timingListeners: Array<(info: AudioTimingInfo) => void> = [];
    private serverClientTimeDiff: number = 0;
    private visemeLeadTime: number = 50; // Default 50ms lead time
    private isPlaying: boolean = false;
    
    /**
     * Register a listener for audio timing events
     */
    addTimingListener(listener: (info: AudioTimingInfo) => void): void {
      this.timingListeners.push(listener);
    }
    
    /**
     * Remove a previously registered listener
     */
    removeTimingListener(listener: (info: AudioTimingInfo) => void): void {
      this.timingListeners = this.timingListeners.filter(l => l !== listener);
    }
    
    /**
     * Set the lead time for visemes (how many ms before audio they should appear)
     */
    setVisemeLeadTime(ms: number): void {
      this.visemeLeadTime = ms;
    }
    
    /**
     * Call this when audio is scheduled to play
     */
    notifyAudioScheduled(
      serverTimestamp: number,
      scheduledPlaybackTime: number,
      duration: number
    ): void {
      const clientTimestamp = Date.now();
      
      // Calculate time difference between server and client
      this.serverClientTimeDiff = serverTimestamp - clientTimestamp;
      this.isPlaying = true;
      
      const timingInfo: AudioTimingInfo = {
        serverTimestamp,
        clientTimestamp,
        scheduledPlaybackTime,
        duration,
        visemeLeadTime: this.visemeLeadTime
      };
      
      // Notify all listeners
      this.timingListeners.forEach(listener => {
        try {
          listener(timingInfo);
        } catch (error) {
          console.error('Error in audio timing listener:', error);
        }
      });
      
      // Also dispatch as an event for components that prefer that approach
      window.dispatchEvent(new CustomEvent('audio-playback-scheduled', {
        detail: timingInfo
      }));
    }
    
    /**
     * Call this when audio playback ends
     */
    notifyAudioEnded(): void {
      this.isPlaying = false;
      
      // Dispatch event for audio ended
      window.dispatchEvent(new CustomEvent('audio-playback-ended'));
      
      // Notify listeners
      this.timingListeners.forEach(listener => {
        try {
          listener({
            serverTimestamp: Date.now() + this.serverClientTimeDiff,
            clientTimestamp: Date.now(),
            scheduledPlaybackTime: 0,
            duration: 0,
            visemeLeadTime: 0
          });
        } catch (error) {
          console.error('Error in audio timing listener:', error);
        }
      });
    }
    
    /**
     * Get the current playback state
     */
    isAudioPlaying(): boolean {
      return this.isPlaying;
    }
    
    /**
     * Calculate when a viseme with the given offset should be displayed
     * relative to the current audio playback time
     */
    calculateVisemePlaybackTime(audioOffset: number): number {
      // Convert from server time to client time
      const clientTime = audioOffset - this.serverClientTimeDiff;
      return clientTime - this.visemeLeadTime; // Apply lead time adjustment
    }
  }
  
  // Export a singleton instance
  export const audioSyncManager = new AudioSyncManager();