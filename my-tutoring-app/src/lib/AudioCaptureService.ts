// lib/AudioCaptureService.ts

interface AudioCaptureCallbacks {
    onStateChange?: (state: { isCapturing: boolean }) => void;
    onError?: (error: AudioCaptureError) => void;
    onAudioData?: (data: Float32Array) => void;
}

interface AudioCaptureError {
    message: string;
    error: string;
    timestamp: string;
}

interface AudioCaptureConfig {
    targetSampleRate?: number;
    channelCount?: number;
    bufferSize?: number;
}

class AudioCaptureService {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private ws: WebSocket | null = null;
    private isCapturing: boolean = false;
    private onStateChange: ((state: { isCapturing: boolean }) => void) | null = null;
    private onError: ((error: AudioCaptureError) => void) | null = null;

    // Audio configuration
    private readonly TARGET_SAMPLE_RATE: number = 16000; // Required 16kHz for speech
    private readonly BUFFER_SIZE: number = 4096;
    private readonly CHANNEL_COUNT: number = 1;

    constructor(config: AudioCaptureConfig = {}) {
        // Allow overriding defaults but ensure valid values
        this.TARGET_SAMPLE_RATE = config.targetSampleRate || 16000;
        this.BUFFER_SIZE = config.bufferSize || 4096;
        this.CHANNEL_COUNT = config.channelCount || 1;
    }

    setCallbacks(callbacks: AudioCaptureCallbacks = {}): void {
        this.onStateChange = callbacks.onStateChange || null;
        this.onError = callbacks.onError || null;
    }

    setWebSocket(ws: WebSocket): void {
        this.ws = ws;
    }

    private async setupAudioContext(): Promise<void> {
        try {
            console.log('Setting up audio context...');
            // Get media stream
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: this.CHANNEL_COUNT,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            console.log('Media stream obtained successfully');
    
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log(`Audio context created. Source sample rate: ${this.audioContext.sampleRate}Hz`);
    
            // Create source node
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            console.log('Source node created');
    
            // Create processor node
            this.processorNode = this.audioContext.createScriptProcessor(
                this.BUFFER_SIZE,
                this.CHANNEL_COUNT,
                this.CHANNEL_COUNT
            );
            console.log(`Processor node created with buffer size: ${this.BUFFER_SIZE}`);
    
            // Set up audio processing handler
            this.processorNode.onaudioprocess = this.handleAudioProcess.bind(this);
    
            // Connect nodes
            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);
            console.log('Audio nodes connected successfully');
    
        } catch (err) {
            console.error('Setup audio context failed:', err);
            this.handleError('Failed to setup audio context', err);
            throw err;
        }
    }

    private handleAudioProcess(event: AudioProcessingEvent): void {
        if (!this.isCapturing || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('Early return - not capturing or ws not open');
            return;
        }
    
        try {
            // Get input data
            const inputData = event.inputBuffer.getChannelData(0);
            console.log('Input buffer size:', inputData.length);
            
            const sourceSampleRate = this.audioContext!.sampleRate;
            console.log('Source sample rate:', sourceSampleRate);
    
            // Downsample to target rate (16kHz)
            const downsampledData = this.downsampleAudio(
                inputData,
                sourceSampleRate,
                this.TARGET_SAMPLE_RATE
            );
            console.log('Downsampled size:', downsampledData.length);
    
            // Convert to 16-bit PCM
            const pcmData = this.convertToPCM(downsampledData);
            console.log('PCM data size:', pcmData.length);
    
            // Convert to base64
            const base64Data = this.convertToBase64(pcmData);
            console.log('Base64 data length:', base64Data.length);
    
            // Send to WebSocket with the correct message structure
            const message = {
                type: "realtime_input",
                media_chunks: [{
                    mime_type: 'audio/pcm;rate=16000',
                    data: base64Data
                }]
            };
    
            console.log('Message structure:', JSON.stringify({
                type: message.type,
                media_chunks: message.media_chunks ? 
                    message.media_chunks.map(chunk => ({
                        mime_type: chunk.mime_type,
                        data_length: chunk.data.length
                    })) : 'no chunks'
            }));
    
            this.ws.send(JSON.stringify(message));
    
        } catch (error) {
            console.error('Error in handleAudioProcess:', error);
            this.handleError('Error processing audio', error);
        }
    }
    
    private downsampleAudio(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
        if (fromRate === toRate) return audioData;

        const ratio = fromRate / toRate;
        const newLength = Math.round(audioData.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const start = Math.floor(i * ratio);
            const end = Math.floor((i + 1) * ratio);
            let sum = 0;
            let count = 0;

            for (let j = start; j < end && j < audioData.length; j++) {
                sum += audioData[j];
                count++;
            }

            result[i] = count > 0 ? sum / count : 0;
        }

        return result;
    }

    private convertToPCM(floatData: Float32Array): Int16Array {
        const pcmData = new Int16Array(floatData.length);
        
        for (let i = 0; i < floatData.length; i++) {
            // Clamp the float value to [-1, 1]
            const sample = Math.max(-1, Math.min(1, floatData[i]));
            // Convert to 16-bit PCM
            pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        return pcmData;
    }

    private convertToBase64(pcmData: Int16Array): string {
        // Create Uint8Array view of the Int16Array's buffer
        const uint8Array = new Uint8Array(pcmData.buffer);
        
        // Convert to binary string
        let binary = '';
        uint8Array.forEach(byte => {
            binary += String.fromCharCode(byte);
        });
        
        // Convert to base64
        return btoa(binary);
    }

    private handleError(message: string, error: unknown): void {
        const errorDetails: AudioCaptureError = {
            message,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        };

        if (this.onError) {
            this.onError(errorDetails);
        }
        console.error('AudioCaptureService Error:', errorDetails);
    }

    async startCapture(): Promise<void> {
        if (this.isCapturing) return;
    
        try {
            await this.setupAudioContext();
            this.isCapturing = true;
            
            if (this.onStateChange) {
                this.onStateChange({ isCapturing: true });
            }
        } catch (err) {  // Changed from 'error' to 'err'
            this.handleError('Failed to start capture', err);
            throw err;
        }
    }

    stopCapture(): void {
        this.isCapturing = false;

        // Clean up processor node
        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }

        // Clean up source node
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        // Stop media stream tracks
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // Close audio context
        if (this.audioContext?.state !== 'closed') {
            this.audioContext?.close();
            this.audioContext = null;
        }

        if (this.onStateChange) {
            this.onStateChange({ isCapturing: false });
        }
    }

    destroy(): void {
        this.stopCapture();
        this.ws = null;
        this.onStateChange = null;
        this.onError = null;
    }

    getStatus(): { isCapturing: boolean } {
        return { isCapturing: this.isCapturing };
    }

    static checkSupport(): boolean {
        return !!(
            (window.AudioContext || window.webkitAudioContext) &&
            navigator.mediaDevices?.getUserMedia
        );
    }
}

export default AudioCaptureService;