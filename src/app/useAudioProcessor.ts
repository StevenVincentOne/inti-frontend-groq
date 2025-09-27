import { useRef, useCallback } from "react";

const PCM_SAMPLE_RATE = 24000;
const PCM_FRAME_SAMPLES = 480; // 20ms at 24 kHz

const getAudioWorkletNode = async (
  audioContext: AudioContext,
  name: string
) => {
  try {
    return new AudioWorkletNode(audioContext, name);
  } catch {
    await audioContext.audioWorklet.addModule(`/${name}.js`);
    return new AudioWorkletNode(audioContext, name, {});
  }
};

export interface AudioProcessor {
  audioContext: AudioContext;
  decoder: Worker;
  outputWorklet: AudioWorkletNode;
  inputAnalyser: AnalyserNode;
  outputAnalyser: AnalyserNode;
  mediaStreamDestination: MediaStreamAudioDestinationNode;
  captureNode: AudioWorkletNode | ScriptProcessorNode;
  cleanupCapture: () => void;
}

const floatChunkToInt16 = (chunk: number[] | Float32Array) => {
  const pcm = new Int16Array(chunk.length);
  for (let i = 0; i < chunk.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, chunk[i] ?? 0));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return new Uint8Array(pcm.buffer);
};

const downsample = (
  input: number[] | Float32Array,
  ratio: number,
  outputLength: number
) => {
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const rawEnd = Math.floor((i + 1) * ratio);
    const end = rawEnd > start ? rawEnd : start + 1;
    let acc = 0;
    let count = 0;
    for (let j = start; j < end && j < input.length; j += 1) {
      acc += input[j] ?? 0;
      count += 1;
    }
    output[i] = count > 0 ? acc / count : input[Math.min(start, input.length - 1)] ?? 0;
  }
  return output;
};

export const useAudioProcessor = (
  onPcmRecorded: (chunk: Uint8Array) => void
) => {
  const audioProcessorRef = useRef<AudioProcessor | null>(null);

  const setupAudio = useCallback(
    async (mediaStream: MediaStream) => {
      if (audioProcessorRef.current) return audioProcessorRef.current;

      let audioContext: AudioContext;
      try {
        audioContext = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
      } catch {
        audioContext = new AudioContext();
      }

      if (audioContext.sampleRate !== PCM_SAMPLE_RATE) {
        console.warn(
          `[AudioProcessor] Requested sampleRate ${PCM_SAMPLE_RATE}Hz, actual AudioContext rate: ${audioContext.sampleRate}Hz`
        );
      }
      const outputWorklet = await getAudioWorkletNode(
        audioContext,
        "audio-output-processor"
      );

      const source = audioContext.createMediaStreamSource(mediaStream);
      const inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 2048;
      source.connect(inputAnalyser);

      const mediaStreamDestination =
        audioContext.createMediaStreamDestination();
      outputWorklet.connect(mediaStreamDestination);
      source.connect(mediaStreamDestination);

      outputWorklet.connect(audioContext.destination);
      const outputAnalyser = audioContext.createAnalyser();
      outputWorklet.connect(outputAnalyser);

      const decoder = new Worker("/decoderWorker.min.js");
      let micDuration = 0;

      decoder.onmessage = (event: MessageEvent) => {
        if (!event.data) {
          return;
        }
        const frame = (event.data as ArrayLike<number>)[0];
        outputWorklet.port.postMessage({
          frame,
          type: "audio",
          micDuration,
        });
      };

      decoder.postMessage({
        command: "init",
        bufferLength: (960 * audioContext.sampleRate) / PCM_SAMPLE_RATE,
        decoderSampleRate: PCM_SAMPLE_RATE,
        outputBufferSampleRate: audioContext.sampleRate,
        resampleQuality: 0,
      });

      const sampleRateRatio = audioContext.sampleRate / PCM_SAMPLE_RATE;
      const requiredInputSamples = PCM_FRAME_SAMPLES * sampleRateRatio;
      let scriptBuffer: number[] = [];

      if (audioContext.audioWorklet) {
        await audioContext.audioWorklet.addModule("/pcm-audio-processor.js");
      }

      let captureNode: AudioWorkletNode | ScriptProcessorNode;
      let cleanupCapture = () => {};

      if (audioContext.audioWorklet) {
        const workletNode = new AudioWorkletNode(
          audioContext,
          "pcm-audio-processor",
          {
            numberOfInputs: 1,
            numberOfOutputs: 0,
          }
        );
        workletNode.port.onmessage = (event: MessageEvent) => {
          const { pcm } = event.data as { pcm?: ArrayBuffer };
          if (pcm) {
            micDuration += PCM_FRAME_SAMPLES / PCM_SAMPLE_RATE;
            onPcmRecorded(new Uint8Array(pcm));
          }
        };
        source.connect(workletNode);
        captureNode = workletNode;
        cleanupCapture = () => {
          try {
            workletNode.disconnect();
          } catch {
            /* no-op */
          }
          try {
            workletNode.port.close();
          } catch {
            /* no-op */
          }
        };
      } else {
        const processorNode = audioContext.createScriptProcessor(2048, 1, 1);
        processorNode.onaudioprocess = (event) => {
          const channelData = event.inputBuffer.getChannelData(0);
          scriptBuffer = scriptBuffer.concat(Array.from(channelData));
          while (scriptBuffer.length >= requiredInputSamples) {
            const segment = scriptBuffer.splice(0, requiredInputSamples);
            const downsampled = downsample(
              segment,
              sampleRateRatio,
              PCM_FRAME_SAMPLES
            );
            micDuration += PCM_FRAME_SAMPLES / PCM_SAMPLE_RATE;
            onPcmRecorded(floatChunkToInt16(downsampled));
          }
        };
        source.connect(processorNode);
        captureNode = processorNode;
        cleanupCapture = () => {
          try {
            processorNode.disconnect();
          } catch {
            /* no-op */
          }
        };
      }

      audioProcessorRef.current = {
        audioContext,
        decoder,
        outputWorklet,
        inputAnalyser,
        outputAnalyser,
        mediaStreamDestination,
        captureNode,
        cleanupCapture,
      };

      await audioContext.resume();
      return audioProcessorRef.current;
    },
    [onPcmRecorded]
  );

  const shutdownAudio = useCallback(() => {
    const processor = audioProcessorRef.current;
    if (!processor) return;

    const {
      audioContext,
      decoder,
      outputWorklet,
      captureNode,
      cleanupCapture,
    } = processor;

    try {
      cleanupCapture();
    } catch {
      /* no-op */
    }

    try {
      captureNode.disconnect();
    } catch {
      /* no-op */
    }

    try {
      outputWorklet.disconnect();
    } catch {
      /* no-op */
    }

    try {
      decoder.terminate();
    } catch {
      /* no-op */
    }

    try {
      audioContext.close();
    } catch {
      /* no-op */
    }

    audioProcessorRef.current = null;
  }, []);

  return {
    setupAudio,
    shutdownAudio,
    audioProcessor: audioProcessorRef,
  };
};
