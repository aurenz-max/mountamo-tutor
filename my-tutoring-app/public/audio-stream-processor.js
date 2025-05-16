// public/audio-stream-processor.js
class AudioStreamProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(0);
        
        // Add message port handling
        this.port.onmessage = (event) => {
            if (event.data.data) {
                this.addData(event.data.data);
            }
        };
    }

    process(inputs, outputs) {
        const output = outputs[0][0];
        if (this.buffer.length >= output.length) {
            output.set(this.buffer.subarray(0, output.length));
            this.buffer = this.buffer.subarray(output.length);
            return true;
        }
        return true;
    }

    addData(data) {
        const newBuffer = new Float32Array(this.buffer.length + data.length);
        newBuffer.set(this.buffer);
        newBuffer.set(data, this.buffer.length);
        this.buffer = newBuffer;
    }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);