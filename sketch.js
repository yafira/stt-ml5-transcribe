// app state
let transcriber;
let modelReady = false;
let transcripts = [];
let interimText = "";
let currentStatus = "Model loading...";
let isRecording = false;
let continuousMode = false;

function setup() {
  const c = createCanvas(720, 360);
  c.parent("sketch-holder");
  textFont("Poppins, sans-serif");
  textAlign(LEFT, TOP);

  transcriber = new ml5Transcribe("whisper-tiny", modelLoaded);
  
  setupButtons();
}

function modelLoaded() {
  modelReady = true;
  updateStatus("Ready! Press 'S' to start recording");
}

function setupButtons() {
  document.getElementById('recordBtn').onclick = () => {
    isRecording ? stopRecording() : startRecording();
  };
  
  document.getElementById('clearBtn').onclick = clearTranscripts;
  document.getElementById('continuousBtn').onclick = toggleContinuousMode;
}

function draw() {
   background('#fdfaff');
  drawPanel();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    if (!isRecording) startRecording();
  } else if (key === 'd' || key === 'D') {
    if (isRecording) stopRecording();
  } else if (key === 'c' || key === 'C') {
    clearTranscripts();
  } else if (key === ' ') {
    toggleContinuousMode();
  }
}

function startRecording() {
  if (!modelReady) {
    updateStatus("Model still loading, please wait...");
    return;
  }

  isRecording = true;
  const msg = continuousMode 
    ? "🎤 Continuous transcription... (press D to stop)"
    : "🎤 Recording... (press D to stop)";
  updateStatus(msg);
  
  document.getElementById('recordBtn').textContent = "Stop Recording (D)";
  document.getElementById('recordBtn').classList.add('recording');

  // start listening with options
  transcriber.startListening(gotResult, { 
    continuous: continuousMode,
    chunkDuration: 3000  // process every 3 seconds
  });
}

function stopRecording() {
  isRecording = false;
  updateStatus("Processing audio...", 'loading');
  
  document.getElementById('recordBtn').textContent = "Start Recording (S)";
  document.getElementById('recordBtn').classList.remove('recording');

  transcriber.stopListening();
}

function gotResult(err, result) {
  if (err) {
    console.error(err);
    updateStatus("Error: " + err.message);
    return;
  }

  if (result?.text) {
    const text = result.text.trim();
    if (!text) return;

    if (result.isFinal) {
      // final transcript - add to permanent list
      transcripts.push(text);
      if (transcripts.length > 10) transcripts.shift();
      interimText = "";
    } else {
      // interim result - temporary text while speaking
      interimText = text;
    }
    
    updateTranscriptDisplay();
  }

  if (!continuousMode) {
    updateStatus("Ready! Press 'S' to record again");
  }
}

function updateTranscriptDisplay() {
  const finalHTML = transcripts.map(t => `<div style="margin: 8px 0;">✿ ${t}</div>`).join('');
  const interimHTML = interimText 
    ? `<div style="margin: 8px 0; color: #9b8fc6; font-style: italic;">~ ${interimText}</div>`
    : '';
  
  document.getElementById('transcript').innerHTML = finalHTML + interimHTML || 'Transcripts will appear here...';
}

function clearTranscripts() {
  transcripts = [];
  interimText = "";
  updateTranscriptDisplay();
  updateStatus(modelReady ? "Ready! Press 'S' to start recording" : "Model loading...");
  console.log('Transcripts cleared');
}

function toggleContinuousMode() {
  if (isRecording) {
    updateStatus("Stop recording before changing mode");
    return;
  }
  
  continuousMode = !continuousMode;
  const btn = document.getElementById('continuousBtn');
  
  btn.textContent = `Continuous Mode: ${continuousMode ? 'ON' : 'OFF'}`;
  btn.classList.toggle('active', continuousMode);
  
  const msg = continuousMode
    ? "Continuous mode enabled - will transcribe in real-time"
    : "Single recording mode - press S to record, D to transcribe";
  updateStatus(msg);
}

function updateStatus(msg, className = 'status') {
  currentStatus = msg;
  const statusEl = document.getElementById('status');
  statusEl.textContent = msg;
  statusEl.className = className;
}

function drawPanel() {
  const w = width - 40, h = height - 40, x = 20, y = 20;

  // soft pastel panel with shadow
  noStroke();
  fill(255, 250, 255, 240);
  rect(x + 2, y + 2, w, h, 16); // subtle shadow
  
  fill(255);
  rect(x, y, w, h, 16);
  
  // pastel border
  noFill();
  stroke(233, 213, 255);
  strokeWeight(3);
  rect(x, y, w, h, 16);

  // header with cute icon
  noStroke();
  fill(167, 139, 250);
  textSize(13);
  text("speech bloom (whisper + transformer.js)", x + 16, y + 14);

  // main text
  fill(156, 133, 196, 255); 

  textStyle(NORMAL);
  textLeading(26);
  text(getCanvasText(), x + 16, y + 42, w - 32, h - 32);
}

function getCanvasText() {
  if (!modelReady) return "⏳ Loading speech recognition model...";
  
  if (isRecording) {
    if (continuousMode) {
      // show real-time transcription
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