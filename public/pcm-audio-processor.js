const PCM_SAMPLE_RATE = 24000;
const PCM_FRAME_SAMPLES = 480; // 20ms at 24 kHz

class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._ratio = sampleRate / PCM_SAMPLE_RATE;
    this._neededInput = Math.round(PCM_FRAME_SAMPLES * this._ratio);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (!channelData) {
      return true;
    }

    for (let i = 0; i < channelData.length; i += 1) {
      this._buffer.push(channelData[i]);
    }

    while (this._buffer.length >= this._neededInput) {
      const segment = this._buffer.splice(0, this._neededInput);
      const downsampled = this._downsample(segment, this._ratio, PCM_FRAME_SAMPLES);
      const pcm = new Int16Array(downsampled.length);
      for (let i = 0; i < downsampled.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, downsampled[i] ?? 0));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      this.port.postMessage({ pcm: pcm.buffer }, [pcm.buffer]);
    }

    return true;
  }

  _downsample(segment, ratio, outputLength) {
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const start = Math.floor(i * ratio);
      const rawEnd = Math.floor((i + 1) * ratio);
      const end = rawEnd > start ? rawEnd : start + 1;
      let acc = 0;
      let count = 0;
      for (let j = start; j < end && j < segment.length; j += 1) {
        acc += segment[j] ?? 0;
        count += 1;
      }
      output[i] = count > 0 ? acc / count : segment[Math.min(start, segment.length - 1)] ?? 0;
    }
    return output;
  }
}

registerProcessor("pcm-audio-processor", PCMRecorderProcessor);