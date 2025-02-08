// useAudioPlayer.ts
import { useEffect, useRef, useState } from 'react';

interface ScheduledBuffer {
    source: AudioBufferSourceNode;
    endTime: number;
}

interface AudioPlayerHook {
    processAudioData: (audioData: Blob | string) => Promise<void>;
    stop: () => void;
    isPlaying: boolean;
}

type PlayingChangeCallback = (playing: boolean) => void;

export const useAudioPlayer = (onPlayingChange?: PlayingChangeCallback): AudioPlayerHook => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const scheduledBuffersRef = useRef<ScheduledBuffer[]>([]);
    const nextPlayTimeRef = useRef<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const updatePlayingState = (newState: boolean): void => {
        setIsPlaying(newState);
        onPlayingChange?.(newState);
    };

    const cleanupCompletedBuffers = (): void => {
        if (!audioContextRef.current) return;
        
        const currentTime = audioContextRef.current.currentTime;
        scheduledBuffersRef.current = scheduledBuffersRef.current.filter(buffer => {
            if (buffer.endTime <= currentTime) {
                return false;
            }
            return true;
        });
    };

    const processAudioData = async (audioData: Blob | string): Promise<void> => {
        try {
            if (!audioContextRef.current) return;

            // Convert incoming data to Int16Array
            let pcmData: Int16Array;
            if (audioData instanceof Blob) {
                const arrayBuffer = await audioData.arrayBuffer();
                pcmData = new Int16Array(arrayBuffer);
            } else {
                const binaryString = atob(audioData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                pcmData = new Int16Array(bytes.buffer);
            }

            // Convert to float32
            const floatData = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                floatData[i] = pcmData[i] / 32768.0;
            }

            const audioBuffer = audioContextRef.current.createBuffer(
                1,
                floatData.length,
                24000
            );
            audioBuffer.copyToChannel(floatData, 0);

            // Calculate when this buffer should start playing
            const currentTime = audioContextRef.current.currentTime;
            const startTime = Math.max(currentTime, nextPlayTimeRef.current);

            // Create and schedule the source
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start(startTime);

            // Update the next play time
            nextPlayTimeRef.current = startTime + audioBuffer.duration;

            // Track this buffer's end time
            scheduledBuffersRef.current.push({
                source,
                endTime: startTime + audioBuffer.duration
            });

            // Clean up completed buffers
            cleanupCompletedBuffers();

            // Update playing state
            updatePlayingState(true);

            // Schedule the end of this chunk
            setTimeout(() => {
                cleanupCompletedBuffers();
                if (scheduledBuffersRef.current.length === 0) {
                    updatePlayingState(false);
                }
            }, (nextPlayTimeRef.current - currentTime) * 1000);

        } catch (error) {
            console.error('Error processing audio:', error);
            updatePlayingState(false);
        }
    };

    const stop = (): void => {
        scheduledBuffersRef.current.forEach(({ source }) => {
            try {
                source.stop();
            } catch (e) {
                // Ignore errors from already stopped sources
            }
        });
        scheduledBuffersRef.current = [];
        nextPlayTimeRef.current = 0;
        updatePlayingState(false);
    };

    return {
        processAudioData,
        stop,
        isPlaying
    };
};