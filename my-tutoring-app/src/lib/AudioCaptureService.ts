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
            // Get media stream
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: this.CHANNEL_COUNT,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log(`Source sample rate: ${this.audioContext.sampleRate}Hz`);

            // Create source node
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create processor node
            this.processorNode = this.audioContext.createScriptProcessor(
                this.BUFFER_SIZE,
                this.CHANNEL_COUNT,
                this.CHANNEL_COUNT
            );

            // Set up audio processing handler
            this.processorNode.onaudioprocess = this.handleAudioProcess.bind(this);

            // Connect nodes
            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);

        } catch (error) {
            this.handleError('Failed to setup audio context', error);
            throw error;
        }
    }

    private handleAudioProcess(event: AudioProcessingEvent): void {
        if (!this.isCapturing || this.ws?.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            // Get input data
            const inputData = event.inputBuffer.getChannelData(0);
            const sourceSampleRate = this.audioContext!.sampleRate;

            // Downsample to target rate (16kHz)
            const downsampledData = this.downsampleAudio(
                inputData,
                sourceSampleRate,
                this.TARGET_SAMPLE_RATE
            );

            // Convert to 16-bit PCM
            const pcmData = this.convertToPCM(downsampledData);

            // Convert to base64
            const base64Data = this.convertToBase64(pcmData);

            // Send to WebSocket with updated message structure
            // Matching API spec format
            const message = {
                type: "realtime_input",
                media_chunks: [{
                    data: base64Data
                }]
            };
            
            this.ws!.send(JSON.stringify(message));

        } catch (error) {
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
        } catch (error) {
            this.handleError('Failed to start capture', error);
            throw error;
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