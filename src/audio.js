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

function playCoinSound() {
  playBufferedSound('coin');
}

function playBingSound() {
  playBufferedSound('bing');
}

function playSwingSound() {
  const active = soundEnabled && gameStarted && !gameOver && !gamePaused && !replayMode;
  if (!active) {
    lastSwingAngle = null;
    lastSwingAnchorId = null;
    lastSwingSpeed = 0;
    lastSwingSpeedTrend = 0;
    return;
  }

  const linearSpeed = hypot(player.vx, player.vy);
  const tangentSpeed = player.attached ? Math.abs(player.angularVelocity * player.ropeLength) : 0;
  const swingSpeed = Math.max(linearSpeed, tangentSpeed);
  const speedDelta = swingSpeed - lastSwingSpeed;
  const previousTrend = lastSwingSpeedTrend;
  const currentTrend = speedDelta > 8 ? 1 : (speedDelta < -8 ? -1 : previousTrend);

  let bottomTrigger = false;
  if (player.attached && player.anchor) {
    const anchorId = player.anchor.id || `${Math.round(player.anchor.x)}:${Math.round(player.anchor.y)}`;
    const angle = player.angle;
    if (lastSwingAnchorId === anchorId && lastSwingAngle !== null) {
      const movingTowardBottom = Math.abs(angle) < Math.abs(lastSwingAngle) - 0.002;
      const enteringWhooshZone = Math.abs(angle) < 0.26 && Math.abs(lastSwingAngle) >= 0.26;
      const crossedBottom = (lastSwingAngle < 0 && angle >= 0) || (lastSwingAngle > 0 && angle <= 0);
      bottomTrigger = (enteringWhooshZone && movingTowardBottom) || crossedBottom;
    }
    lastSwingAnchorId = anchorId;
    lastSwingAngle = angle;
  } else {
    lastSwingAnchorId = null;
    lastSwingAngle = null;
  }

  // Also catch fast airborne/whip motion just before the peak: when airspeed is
  // already high and the positive acceleration starts flattening out.
  const speedFlatteningTrigger = previousTrend > 0 && speedDelta > -8 && speedDelta < 18 && swingSpeed > 420;
  const speedPeakTrigger = speedFlatteningTrigger || (previousTrend > 0 && currentTrend < 0 && lastSwingSpeed > 360);
  lastSwingSpeed = swingSpeed;
  lastSwingSpeedTrend = currentTrend;

  const context = startGameAudioLoad();
  if (!context || context.currentTime < nextSwingSoundAt) return;
  if (!bottomTrigger && !speedPeakTrigger) return;

  const intensity = smoothstep01((swingSpeed - 190) / 860);
  if (intensity <= 0.025) return;

  const names = ['swingA', 'swingB', 'swingC'];
  const name = names[Math.floor(Math.random() * names.length)];
  const buffer = audioBuffers[name];
  if (!buffer) return;

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = clamp(0.74 + swingSpeed / 980, 0.74, 1.95);
  gain.gain.value = AUDIO_FILES[name].volume * (0.16 + intensity * 0.84);
  source.connect(gain);
  gain.connect(context.destination);
  try {
    source.start(0);
    nextSwingSoundAt = context.currentTime + clamp(0.34 + (1 - intensity) * 0.28, 0.34, 0.62);
  } catch (_) {
    // Ignore transient audio start failures.
  }
}

function sawSoundKey(saw) {
  return `${Math.round(saw.x)}:${Math.round(saw.y)}:${Math.round((saw.phase || 0) * 1000)}:${Math.round(saw.r || 0)}`;
}

function sawDistance(saw) {
  const sawY = saw.y + Math.sin(time * 1.8 + saw.phase) * saw.bob;
  return hypot(player.x - saw.x, player.y - sawY) - (saw.r || 0);
}

function ensureSawSound(key) {
  const existing = sawSoundLoops.get(key);
  if (existing || !soundEnabled) return existing || null;
  const context = startGameAudioLoad();
  const buffer = audioBuffers.saw;
  if (!context || !buffer) return null;

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = 0.0001;
  source.connect(gain);
  gain.connect(context.destination);
  const loop = { source, gain, volume: 0, target: 0, seen: true };
  try {
    source.start(0);
  } catch (_) {
    return null;
  }
  source.onended = () => {
    const current = sawSoundLoops.get(key);
    if (current && current.source === source) sawSoundLoops.delete(key);
  };
  sawSoundLoops.set(key, loop);
  return loop;
}

function stopSawLoop(key, loop, immediate = false) {
  if (!loop) return;
  sawSoundLoops.delete(key);
  try {
    if (loop.gain && audioContext) {
      const now = audioContext.currentTime;
      loop.gain.gain.cancelScheduledValues(now);
      loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
      loop.gain.gain.linearRampToValueAtTime(0.0001, now + (immediate ? 0.01 : 0.22));
    }
    loop.source.stop(audioContext ? audioContext.currentTime + (immediate ? 0.015 : 0.24) : 0);
  } catch (_) {
    // Ignore already-stopped loop sources.
  }
}

function stopSawSound(immediate = false) {
  for (const [key, loop] of Array.from(sawSoundLoops.entries())) {
    stopSawLoop(key, loop, immediate);
  }
}

function updateSawSound(dt) {
  const active = soundEnabled && gameStarted && !gamePaused && !gameOver && !replayMode;
  const maxVolume = AUDIO_FILES.saw.volume;
  const near = 80;
  const far = 560;
  const step = Math.max(0, dt || 0);

  for (const loop of sawSoundLoops.values()) {
    loop.target = 0;
    loop.seen = false;
  }

  if (active && Array.isArray(obstacles)) {
    for (const saw of obstacles) {
      if (!saw || saw.type !== 'saw') continue;
      const distance = sawDistance(saw);
      const t = clamp(1 - (distance - near) / (far - near), 0, 1);
      const target = maxVolume * smoothstep01(t);
      const key = sawSoundKey(saw);
      let loop = sawSoundLoops.get(key);
      if (target > 0.002) loop = ensureSawSound(key);
      if (!loop) continue;
      loop.target = target;
      loop.seen = true;
    }
  }

  for (const [key, loop] of Array.from(sawSoundLoops.entries())) {
    const smoothing = loop.target > loop.volume ? 8 : 4;
    loop.volume += (loop.target - loop.volume) * (1 - Math.exp(-smoothing * step));
    if ((!active || !loop.seen) && loop.volume < 0.004) {
      stopSawLoop(key, loop);
      continue;
    }
    if (loop.gain && audioContext) {
      const now = audioContext.currentTime;
      loop.gain.gain.cancelScheduledValues(now);
      loop.gain.gain.setTargetAtTime(Math.max(0.0001, loop.volume), now, 0.035);
    }
  }
}

function playGameOverSound() {
  stopGameOverSound();
  stopSawSound();
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
