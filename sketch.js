// app state
let transcriber;
let modelReady = false;
let transcripts = [];
let interimText = "";
let currentStatus = "Model loading...";
let isRecording = false;
let continuousMode = false;

// cache dom refs once
const $ = (id) => document.getElementById(id);
let $recordBtn, $clearBtn, $continuousBtn, $status, $transcript;

function setup() {
  const c = createCanvas(720, 360);
  c.parent("sketch-holder");
  textFont("Poppins, sans-serif");
  textAlign(LEFT, TOP);

  // cache
  $recordBtn = $('recordBtn');
  $clearBtn = $('clearBtn');
  $continuousBtn = $('continuousBtn');
  $status = $('status');
  $transcript = $('transcript');

  transcriber = new ml5Transcribe("whisper-tiny", modelLoaded);
  setupButtons();
}

function modelLoaded() {
  modelReady = true;
  setStatus("Ready! Press 'S' to start recording");
}

function setupButtons() {
  $recordBtn.onclick = () => (isRecording ? stopRecording() : startRecording());
  $clearBtn.onclick = clearTranscripts;
  $continuousBtn.onclick = toggleContinuousMode;
}

function draw() {
  background('#fdfaff');
  drawPanel();
}

function keyPressed() {
  const k = key.toLowerCase();
  if (k === 's' && !isRecording) startRecording();
  else if (k === 'd' && isRecording) stopRecording();
  else if (k === 'c') clearTranscripts();
  else if (k === ' ') toggleContinuousMode();
}

function startRecording() {
  if (!modelReady) return setStatus("Model still loading, please wait...");
  isRecording = true;

  setStatus(continuousMode
    ? "🎤 Continuous transcription... (press D to stop)"
    : "🎤 Recording... (press D to stop)"
  );
  setRecordingUI(true);

  transcriber.startListening(gotResult, {
    continuous: continuousMode,
    chunkDuration: 3000 // process every 3 seconds
  });
}

function stopRecording() {
  isRecording = false;
  setStatus("Processing audio...", 'loading');
  setRecordingUI(false);
  transcriber.stopListening();
}

function gotResult(err, result) {
  if (err) {
    console.error(err);
    setStatus("Error: " + err.message);
    return;
  }
  if (result?.text) {
    const text = result.text.trim();
    if (!text) return;

    if (result.isFinal) {
      transcripts.push(text);
      if (transcripts.length > 10) transcripts.shift();
      interimText = "";
    } else {
      interimText = text; // interim while speaking
    }
    renderTranscript();
  }

  if (!continuousMode) setStatus("Ready! Press 'S' to record again");
}

// --- ui helpers ---

function renderTranscript() {
  const finals = transcripts.map(t => `<div class="t-line">✿ ${escapeHTML(t)}</div>`).join('');
  const interim = interimText
    ? `<div class="t-line t-interim">~ ${escapeHTML(interimText)}</div>`
    : '';
  $transcript.innerHTML = finals + interim || 'Transcripts will appear here...';
}

function clearTranscripts() {
  transcripts = [];
  interimText = "";
  renderTranscript();
  setStatus(modelReady ? "Ready! Press 'S' to start recording" : "Model loading...");
  console.log('Transcripts cleared');
}

function toggleContinuousMode() {
  if (isRecording) return setStatus("Stop recording before changing mode");
  continuousMode = !continuousMode;

  $continuousBtn.textContent = `Continuous Mode: ${continuousMode ? 'ON' : 'OFF'}`;
  $continuousBtn.classList.toggle('active', continuousMode);

  setStatus(
    continuousMode
      ? "Continuous mode enabled - will transcribe in real-time"
      : "Single recording mode - press S to record, D to transcribe"
  );
}

function setStatus(msg, className = 'status') {
  currentStatus = msg;
  $status.textContent = msg;
  $status.className = className;
}

function setRecordingUI(on) {
  $recordBtn.textContent = on ? "Stop Recording (D)" : "Start Recording (S)";
  $recordBtn.classList.toggle('recording', on);
}

// avoid injecting raw text into html
function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

// --- canvas panel ---

function drawPanel() {
  const w = width - 40, h = height - 40, x = 20, y = 20;

  noStroke();
  fill(255, 250, 255, 240);
  rect(x + 2, y + 2, w, h, 16); // subtle shadow

  fill(255);
  rect(x, y, w, h, 16);

  noFill();
  stroke(233, 213, 255);
  strokeWeight(3);
  rect(x, y, w, h, 16);

  noStroke();
  fill(167, 139, 250);
  textSize(13);
  text("speech bloom (whisper + transformer.js)", x + 16, y + 14);

  fill(156, 133, 196, 255);
  textStyle(NORMAL);
  textLeading(26);
  text(getCanvasText(), x + 16, y + 42, w - 32, h - 32);
}

function getCanvasText() {
  if (!modelReady) return "⏳ Loading speech recognition model...";

  if (isRecording) {
    if (continuousMode) {
      const finals = transcripts.join(" ✿ ");
      return interimText
        ? (finals ? finals + " ✿ " + interimText : interimText)
        : (finals || "🎤 Listening continuously... speak now!");
    }
    return "🎤 Recording... speak now! (press D to stop)";
  }

  if (transcripts.length === 0) {
    return continuousMode
      ? "Ready ✿ press S for continuous transcription"
      : "Ready ✿ press S to start recording";
  }

  return transcripts.join(" ✿ ");
}