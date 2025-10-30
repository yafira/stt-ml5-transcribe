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

  async init(onReady) {
    try {
      console.log('Loading model...');
      // load whisper tiny for speed - can change to base/small/medium
      this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      console.log('Model loaded!');
      if (onReady) onReady();
    } catch (err) {
      console.error('Failed to load model:', err);
    }
  }

  async startListening(callback, { continuous = false, chunkDuration = 3000 } = {}) {
    if (this.isRecording) return;
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recorder = new MediaRecorder(this.mediaStream);
      this.callback = callback;
      this.chunks = [];

      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      if (continuous) {
        this.startContinuousMode(chunkDuration);
      } else {
        this.startSingleMode();
      }

      this.isRecording = true;
      console.log('Recording started...');
    } catch (err) {
      console.error('Microphone access denied:', err);
      if (callback) callback(err, null);
    }
  }

  startContinuousMode(chunkDuration) {
    // process audio chunks every N seconds for real-time transcription
    this.recorder.start();
    this.streamInterval = setInterval(() => {
      if (this.recorder.state === 'recording') {
        this.recorder.requestData();
        if (this.chunks.length > 0) {
          const audioBlob = new Blob(this.chunks, { type: 'audio/webm' });
          this.chunks = [];
          this.processAudio(audioBlob, true);
        }
      }
    }, chunkDuration);
  }

  startSingleMode() {
    // wait for stop, then transcribe entire recording
    this.recorder.onstop = async () => {
      const audioBlob = new Blob(this.chunks, { type: 'audio/webm' });
      await this.processAudio(audioBlob, false);
    };
    this.recorder.start();
  }

  stopListening() {
    if (!this.isRecording) return;

    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
    
    if (this.recorder) this.recorder.stop();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    this.isRecording = false;
    console.log('Recording stopped');
  }

  async processAudio(audioBlob, isInterim) {
    // skip tiny chunks
    if (!this.transcriber || audioBlob.size < 1000) return;

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      let audioData = audioBuffer.getChannelData(0);
      
      // whisper expects 16kHz mono audio
      if (audioBuffer.sampleRate !== 16000) {
        audioData = this.resample(audioData, audioBuffer.sampleRate, 16000);
      }

      const result = await this.transcriber(audioData);
      
      if (this.callback) {
        this.callback(null, { text: result.text, isFinal: !isInterim });
      }
    } catch (err) {
      console.error('Transcription error:', err);
      if (this.callback) this.callback(err, null);
    }
  }

  resample(audioData, fromRate, toRate) {
    // simple linear interpolation resampling
    const ratio = fromRate / toRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const floor = Math.floor(srcIndex);
      const t = srcIndex - floor;
      const s1 = audioData[floor] || 0;
      const s2 = audioData[floor + 1] || 0;
      result[i] = s1 + (s2 - s1) * t;
    }
    
    return result;
  }
}

window.ml5Transcribe = ml5Transcribe;