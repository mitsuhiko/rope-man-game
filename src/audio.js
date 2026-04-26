// WebAudio loading and one-shot sound helpers.

function createAudioContext() {
  if (audioContext || !AudioContextCtor) return audioContext;
  try {
    audioContext = new AudioContextCtor();
  } catch (_) {
    audioContext = null;
  }
  return audioContext;
}

function decodeAudioBuffer(context, data) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (buffer) => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const promise = context.decodeAudioData(data, succeed, fail);
    if (promise && promise.then) promise.then(succeed, fail);
  });
}

function startGameAudioLoad() {
  if (!soundEnabled) return audioContext;
  const context = createAudioContext();
  if (!context || audioLoadStarted) return context;
  audioLoadStarted = true;

  for (const [name, config] of Object.entries(AUDIO_FILES)) {
    fetch(config.url)
      .then(response => {
        if (!response.ok) throw new Error(`failed to load ${config.url}`);
        return response.arrayBuffer();
      })
      .then(data => decodeAudioBuffer(context, data))
      .then(buffer => {
        audioBuffers[name] = buffer;
      })
      .catch(() => {
        // SFX are optional; never let audio loading affect gameplay.
      });
  }
  return context;
}

function primeGameAudio() {
  if (!soundEnabled || gameAudioPrimed) return;
  const context = startGameAudioLoad();
  if (!context) return;
  gameAudioPrimed = true;
  if (context.state === 'suspended') {
    const promise = context.resume();
    if (promise && promise.catch) {
      promise.catch(() => {
        gameAudioPrimed = false;
      });
    }
  }
}

function playBufferedSound(name) {
  if (!soundEnabled) return null;
  const context = startGameAudioLoad();
  const buffer = audioBuffers[name];
  if (!context || !buffer) return null;

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = AUDIO_FILES[name].volume;
  source.connect(gain);
  gain.connect(context.destination);
  try {
    source.start(0);
  } catch (_) {
    return null;
  }
  return source;
}

function playHookSound() {
  playBufferedSound('hook');
}

function playHookReleaseSound() {
  playBufferedSound('hookRelease');
}

function playGameOverSound() {
  stopGameOverSound();
  const source = playBufferedSound('gameOver');
  currentGameOverSource = source;
  if (source) {
    source.onended = () => {
      if (currentGameOverSource === source) currentGameOverSource = null;
    };
  }
}

function stopGameOverSound() {
  if (!currentGameOverSource) return;
  try {
    currentGameOverSource.stop();
  } catch (_) {
    // Ignore already-stopped sources.
  }
  currentGameOverSource = null;
}
