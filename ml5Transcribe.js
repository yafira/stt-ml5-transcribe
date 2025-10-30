import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

// ml5-style transcribe wrapper for whisper
class ml5Transcribe {
  constructor(modelName = "whisper-tiny", onReady) {
    this.transcriber = null;
    this.recorder = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.chunks = [];
    this.callback = null;
    this.isRecording = false;
    this.streamInterval = null;

    this.init(onReady);
  }

  // load model once
  async init(onReady) {
    try {
      console.log('loading model...');
      // load whisper tiny for speed (can switch to base/small/medium later)
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en'
      );
      console.log('model loaded!');
      onReady && onReady();
    } catch (err) {
      console.error('failed to load model:', err);
    }
  }

  // start listening (continuous or single-shot)
  async startListening(callback, { continuous = false, chunkDuration = 3000 } = {}) {
    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recorder = new MediaRecorder(this.mediaStream);
      this.callback = callback;
      this.chunks = [];
      this.isRecording = true;

      // collect chunks
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) this.chunks.push(e.data);
      };

      if (continuous) {
        // real-time style: periodically request data, process, then clear buffer
        this.recorder.start();
        this.streamInterval = setInterval(() => {
          if (this.recorder.state !== 'recording') return;
          this.recorder.requestData();
          if (!this.chunks.length) return;
          const blob = new Blob(this.chunks, { type: 'audio/webm' });
          this.chunks = [];
          this.processAudio(blob, true);
        }, chunkDuration);
      } else {
        // single-shot: process once on stop
        this.recorder.onstop = async () => {
          const blob = new Blob(this.chunks, { type: 'audio/webm' });
          await this.processAudio(blob, false);
        };
        this.recorder.start();
      }

      console.log('recording started...');
    } catch (err) {
      console.error('microphone access denied:', err);
      callback && callback(err, null);
    }
  }

  // stop listening
  stopListening() {
    if (!this.isRecording) return;

    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }

    this.recorder && this.recorder.state !== 'inactive' && this.recorder.stop();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    this.isRecording = false;
    console.log('recording stopped');
  }

  // process a blob through whisper
  async processAudio(audioBlob, isInterim) {
    // ignore tiny/empty blobs or if model not ready
    if (!this.transcriber || !audioBlob || audioBlob.size < 1000) return;

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();

      // lazy-create audio context
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      let audioData = audioBuffer.getChannelData(0);

      // whisper expects 16khz mono
      if (audioBuffer.sampleRate !== 16000) {
        audioData = this.resample(audioData, audioBuffer.sampleRate, 16000);
      }

      const result = await this.transcriber(audioData);
      this.callback && this.callback(null, { text: result.text, isFinal: !isInterim });
    } catch (err) {
      console.error('transcription error:', err);
      this.callback && this.callback(err, null);
    }
  }

  // simple linear interpolation resampling to 16khz
  resample(input, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const outLen = Math.round(input.length / ratio);
    const out = new Float32Array(outLen);

    for (let i = 0; i < outLen; i++) {
      const src = i * ratio;
      const i0 = Math.floor(src);
      const t = src - i0;
      const a = input[i0] || 0;
      const b = input[i0 + 1] || 0;
      out[i] = a + (b - a) * t;
    }
    return out;
  }
}

window.ml5Transcribe = ml5Transcribe;
