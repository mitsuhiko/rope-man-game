// Core game loop, player physics, input actions, and bootstrap.

function reset(options = {}) {
  const countAttempt = options.countAttempt ?? (gameStarted && !replayMode);
  const recordRun = options.recordRun ?? (gameStarted && !replayMode);

  if (countAttempt && typeof resetJoystickInput === 'function') resetJoystickInput();
  resetRandomStreams();
  cameraX = 0;
  cameraY = 0;
  cameraVX = 0;
  cameraVY = 0;
  time = 0;
  gameOver = false;
  gamePaused = false;
  resetCrashPlayerFade();
  setCrashActionsVisible(false);
  stopGameOverSound();
  furthestX = 0;
  scoreStartX = 0;
  scoreMeters = 0;
  runFinalScore = 0;
  anchors = [];
  obstacles = [];
  bgShapes = [];
  resetTerrain();
  nextAnchorX = 120;
  nextObstacleX = 950;
  generatedWorldX = 0;
  spawnIndex = 0;
  focusedAnchor = null;
  lockedAnchor = null;
  recentReleasedAnchor = null;
  recentReleasedAnchorAt = -Infinity;
  recentReleasedAnchorX = 0;
  recentReleasedAnchorY = 0;
  ropeShot = null;
  ragdoll.initialized = false;
  ragdoll.joints = {};
  ragdoll.visualSide = 1;
  hookArm.initialized = false;
  hookArm.ox = 0;
  hookArm.oy = 0;

  player.x = 150;
  player.y = Math.min(270, H * 0.45);
  player.vx = 0;
  player.vy = 0;
  player.attached = true;
  player.alive = true;
  player.runPhase = 0;

  seedBackground();
  generateUntil(INITIAL_WORLD_GENERATION_X);
  player.anchor = anchors[0];
  player.ropeLength = clamp(INITIAL_SPAWN_ROPE_LENGTH, MIN_ROPE, MAX_ROPE);
  player.angle = INITIAL_SPAWN_ANGLE;
  player.angularVelocity = 0;
  syncAttachedKinematics();
  scoreStartX = player.x;
  furthestX = player.x;
  hookArm.x = player.x;
  hookArm.y = player.y;
  cameraX = player.x - cameraViewW() * 0.42;
  cameraY = player.y - cameraViewH() * 0.52;
  resetEscapeWave();
  if (countAttempt) {
    beginSeedAttempt();
  } else {
    syncCurrentSeedStats();
    updateScoreHud();
  }

  if (recordRun) {
    startReplayRecording();
  } else {
    activeReplayRecording = null;
  }
}

const REPLAY_END_HOLD = 0.65;
const CRASH_PLAYER_FADE_MS = 450;

function resetEscapeWave() {
  if (gameMode === 'escapeWave') {
    const hiddenEdgeX = cameraX - cameraViewW() * 0.45;
    escapeWaveFrontX = hiddenEdgeX - ESCAPE_WAVE_BASE_SPEED * ESCAPE_WAVE_APPEAR_DELAY;
  } else {
    escapeWaveFrontX = -Infinity;
  }
  escapeWaveSpeed = ESCAPE_WAVE_BASE_SPEED;
}

function escapeWaveSurfaceY(x) {
  const t = time * 2.2 + x * 0.008;
  return cameraY + cameraViewH() * 0.18 + Math.sin(t) * 26 + Math.sin(t * 0.47 + 1.7) * 42;
}

function escapeWaveCrestX() {
  return escapeWaveFrontX + Math.sin(time * 1.8) * 18;
}

function escapeWaveHitbox() {
  const wave = typeof escapeWaveGeometry === 'function' ? escapeWaveGeometry() : null;
  if (!wave || !wave.fillPoints || wave.fillPoints.length < 3) return null;
  return {
    shape: 'polygon',
    kind: 'escape-wave',
    points: wave.fillPoints,
  };
}

function updateEscapeWave(dt) {
  if (gameMode !== 'escapeWave' || replayMode) return;
  escapeWaveSpeed = Math.min(ESCAPE_WAVE_MAX_SPEED, escapeWaveSpeed + ESCAPE_WAVE_ACCEL * dt);
  const targetBehindPlayer = player.x - (760 - clamp(scoreMeters / 3, 0, 360));
  const catchupT = smoothstep01((time - ESCAPE_WAVE_APPEAR_DELAY) / ESCAPE_WAVE_CATCHUP_RAMP);
  const catchupSpeed = Math.max(0, targetBehindPlayer - escapeWaveFrontX) * (0.68 + catchupT * 0.68) * catchupT;
  escapeWaveFrontX += (escapeWaveSpeed + catchupSpeed) * dt;
}

function hitsEscapeWave() {
  const hitbox = escapeWaveHitbox();
  if (!hitbox) return false;
  return playerHitboxes().some((box) => hitboxHitsPlayer(hitbox, box));
}
let crashPlayerFadeStartedAt = 0;

// Keep all crash replays for the current seed.  Besides the input stream, we
// capture the render state for each frame so replay playback can draw every
// run through the normal rope/player renderer instead of an approximate ghost.
function clearReplayHistory() {
  seedCrashReplays = storedReplaysForSeed(gameSeedText).slice();
  lastCrashReplay = seedCrashReplays[seedCrashReplays.length - 1] || null;
  activeReplayPlayback = null;
  activeReplayRecording = null;
  replayInputOverride = null;
}

function currentSeedReplays() {
  return seedCrashReplays.filter((replay) => (
    replay &&
    normalizeGameMode(replay.gameMode || DEFAULT_GAME_MODE) === gameMode &&
    replay.seedValue === gameSeedValue &&
    replay.frames &&
    replay.frames.length
  ));
}

function currentSeedReplayCount() {
  return currentSeedReplays().length;
}

function cloneReplayAnchor(anchor) {
  if (!anchor) return null;
  return {
    id: anchor.id || 0,
    x: Number(anchor.x) || 0,
    y: Number(anchor.y) || 0,
    r: Number(anchor.r) || 8,
  };
}

function cloneReplayJoints(joints) {
  const cloned = {};
  if (!joints || typeof joints !== 'object') return cloned;
  for (const [name, joint] of Object.entries(joints)) {
    if (!joint) continue;
    cloned[name] = {
      x: Number(joint.x) || 0,
      y: Number(joint.y) || 0,
      oldX: Number(joint.oldX) || 0,
      oldY: Number(joint.oldY) || 0,
      pinned: Boolean(joint.pinned),
    };
  }
  return cloned;
}

function cloneReplayPlayer(source = player) {
  return {
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    vx: Number(source.vx) || 0,
    vy: Number(source.vy) || 0,
    attached: Boolean(source.attached),
    anchor: cloneReplayAnchor(source.anchor),
    ropeLength: Number(source.ropeLength) || 0,
    angle: Number(source.angle) || 0,
    angularVelocity: Number(source.angularVelocity) || 0,
    alive: source.alive !== false,
    runPhase: Number(source.runPhase) || 0,
  };
}

function cloneReplayRagdoll(source = ragdoll) {
  return {
    initialized: Boolean(source.initialized),
    visualSide: Number.isFinite(source.visualSide) ? source.visualSide : 1,
    joints: cloneReplayJoints(source.joints),
  };
}

function cloneReplayHookArm(source = hookArm) {
  return {
    initialized: Boolean(source.initialized),
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    ox: Number(source.ox) || 0,
    oy: Number(source.oy) || 0,
  };
}

function cloneReplayRopeShot(source = ropeShot) {
  if (!source) return null;
  return {
    anchor: cloneReplayAnchor(source.anchor),
    t: Number(source.t) || 0,
    duration: Number(source.duration) || 0,
  };
}

function captureReplayState() {
  return {
    time,
    cameraX,
    cameraY,
    cameraZoom,
    scoreMeters,
    furthestX,
    escapeWaveFrontX,
    escapeWaveSpeed,
    player: cloneReplayPlayer(),
    ragdoll: cloneReplayRagdoll(),
    hookArm: cloneReplayHookArm(),
    ropeShot: cloneReplayRopeShot(),
  };
}

function startReplayRecording() {
  activeReplayRecording = {
    version: REPLAY_FORMAT_VERSION,
    gameMode,
    seedValue: gameSeedValue,
    seedText: gameSeedText,
    frames: [],
    actionCounts: Object.create(null),
    duration: 0,
    maxX: player.x,
    initialState: captureReplayState(),
    characterAppearance: { ...characterAppearance },
  };
}

function recordReplayAction() {
  if (replayMode || gameOver || !activeReplayRecording) return;
  const frameIndex = activeReplayRecording.frames.length;
  activeReplayRecording.actionCounts[frameIndex] =
    (activeReplayRecording.actionCounts[frameIndex] || 0) + 1;
}

function recordReplayFrame(dt) {
  if (replayMode || gameOver || !activeReplayRecording) return null;
  const frameIndex = activeReplayRecording.frames.length;
  const frameDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const actions = activeReplayRecording.actionCounts[frameIndex] || 0;
  const frame = {
    t: activeReplayRecording.duration + frameDt,
    dt: frameDt,
    x: inputAxisX(),
    y: inputAxisY(),
    a: actions,
  };
  activeReplayRecording.frames.push(frame);
  activeReplayRecording.duration += frameDt;
  delete activeReplayRecording.actionCounts[frameIndex];
  return frame;
}

function captureReplayFrameState(frame) {
  if (!frame) return;
  const state = captureReplayState();
  frame.s = state;
  if (activeReplayRecording) {
    activeReplayRecording.maxX = Math.max(activeReplayRecording.maxX, state.player.x, furthestX);
  }
}

function finalizeReplayRecording() {
  if (!activeReplayRecording) return;
  const replay = activeReplayRecording;
  activeReplayRecording = null;
  delete replay.actionCounts;
  replay.finalScore = runFinalScore || scoreMeters;
  replay.deathFrame = Math.max(0, replay.frames.length - 1);
  replay.maxX = Math.max(replay.maxX || 0, furthestX, player.x);
  replay.crash = {
    scoreMeters,
    runFinalScore: runFinalScore || scoreMeters,
    seedAttempts,
    runHadOverallRecord,
    runHadSeedRecord,
    gameMode,
    seedValue: gameSeedValue,
    seedText: gameSeedText,
  };
  if (replay.frames.length) {
    seedCrashReplays.push(replay);
    lastCrashReplay = replay;
    saveCurrentSeedReplayHistory();
  }
}

function canWatchCrashReplay() {
  return Boolean(gameOver && !replayMode && currentSeedReplayCount() > 0);
}

function restoreCrashSummaryFromReplay(replay) {
  if (!replay || !replay.crash) return;
  const crash = replay.crash;
  if (crash.seedValue && crash.seedValue !== gameSeedValue) setGameSeed(crash.seedValue, { writeUrl: false });
  scoreMeters = Math.max(0, Math.floor(Number(crash.scoreMeters) || 0));
  runFinalScore = Math.max(0, Math.floor(Number(crash.runFinalScore) || scoreMeters));
  seedAttempts = Math.max(0, Math.floor(Number(crash.seedAttempts) || seedAttempts));
  runHadOverallRecord = Boolean(crash.runHadOverallRecord);
  runHadSeedRecord = Boolean(crash.runHadSeedRecord);
  updateScoreHud();
}

function crashReplayScore(replay) {
  if (!replay) return 0;
  const scores = [
    replay.finalScore,
    replay.crash && replay.crash.runFinalScore,
    replay.crash && replay.crash.scoreMeters,
  ].map(value => Number(value)).filter(Number.isFinite);
  return Math.max(0, ...scores);
}

function selectCrashReplayLeaderIndex(replays) {
  let leaderIndex = 0;
  let bestScore = -Infinity;
  let bestMaxX = -Infinity;

  for (let i = 0; i < replays.length; i += 1) {
    const replay = replays[i];
    const score = crashReplayScore(replay);
    const maxX = Number(replay && replay.maxX) || 0;
    if (score > bestScore || (score === bestScore && maxX >= bestMaxX)) {
      leaderIndex = i;
      bestScore = score;
      bestMaxX = maxX;
    }
  }

  return leaderIndex;
}

function startCrashReplay() {
  const replays = currentSeedReplays();
  if (!canWatchCrashReplay() || !replays.length) return;

  const leaderIndex = selectCrashReplayLeaderIndex(replays);
  const replayDuration = Number(replays[leaderIndex].duration) || 0;
  let maxX = 0;
  for (const replay of replays) {
    maxX = Math.max(maxX, Number(replay.maxX) || 0);
  }

  replayMode = true;
  activeReplayPlayback = null;
  replayInputOverride = null;
  activeReplayRecording = null;
  keys.left = false;
  keys.right = false;
  keys.up = false;
  keys.down = false;
  resetJoystickInput();
  stopGameOverSound();
  setCrashActionsVisible(false);
  setGameSeed(replays[0].seedValue, { writeUrl: false });
  gameStarted = true;
  reset({ countAttempt: false, recordRun: false });
  activeReplayPlayback = {
    replays,
    elapsed: 0,
    duration: replayDuration,
    maxX,
    leaderIndex,
    cursors: new Array(replays.length).fill(-1),
  };
  generateUntil(maxX + cameraViewW() * 2.8);
  updateReplayPlayback(0);
  last = 0;
}

function finishCrashReplay() {
  const replay = lastCrashReplay;
  activeReplayPlayback = null;
  replayInputOverride = null;
  replayMode = false;
  activeReplayRecording = null;
  gamePaused = false;
  gameOver = true;
  keys.left = false;
  keys.right = false;
  keys.up = false;
  keys.down = false;
  resetJoystickInput();
  stopGameOverSound();
  beginCrashPlayerFade(true);
  restoreCrashSummaryFromReplay(replay);
  updateCrashSummary();
  setCrashActionsVisible(true);
  last = 0;
}

function replaySampleAt(playback, replayIndex, elapsed) {
  const replay = playback && playback.replays ? playback.replays[replayIndex] : null;
  if (!replay || !replay.frames || !replay.frames.length) return null;
  if (elapsed > replay.duration + REPLAY_END_HOLD) return null;

  let cursor = playback.cursors[replayIndex] ?? -1;
  while (cursor + 1 < replay.frames.length && replay.frames[cursor + 1].t <= elapsed) {
    cursor += 1;
  }
  while (cursor >= 0 && replay.frames[cursor].t > elapsed) {
    cursor -= 1;
  }
  playback.cursors[replayIndex] = cursor;

  let state = cursor >= 0 ? replay.frames[cursor].s : replay.initialState;
  for (let i = cursor - 1; !state && i >= 0; i -= 1) {
    state = replay.frames[i].s;
  }
  if (!state) state = replay.initialState;
  if (!state) return null;

  const endedT = clamp((elapsed - replay.duration) / REPLAY_END_HOLD, 0, 1);
  return { ...state, replayAlpha: 1 - smoothstep01(endedT) };
}

function updateReplayPlayback(realDt) {
  const playback = activeReplayPlayback;
  if (!playback || !playback.replays || !playback.replays.length) return;

  playback.elapsed += Number.isFinite(realDt) && realDt > 0 ? realDt : 0;
  const leader = replaySampleAt(playback, playback.leaderIndex, playback.elapsed);

  if (leader) {
    const leaderPlayer = leader.player || leader;
    const nextPlayerX = Number.isFinite(leaderPlayer.x) ? leaderPlayer.x : player.x;
    const nextPlayerY = Number.isFinite(leaderPlayer.y) ? leaderPlayer.y : player.y;
    const recordedZoom = Number.isFinite(leader.cameraZoom) && leader.cameraZoom > 0 ? leader.cameraZoom : 1;
    time = Number.isFinite(leader.time) ? leader.time : playback.elapsed;
    if (Number.isFinite(leader.cameraX)) {
      const recordedScreenX = (nextPlayerX - leader.cameraX) * recordedZoom;
      cameraX = nextPlayerX - recordedScreenX / cameraZoom;
    }
    if (Number.isFinite(leader.cameraY)) {
      const recordedScreenY = (nextPlayerY - leader.cameraY) * recordedZoom;
      cameraY = nextPlayerY - recordedScreenY / cameraZoom;
    }
    player.x = nextPlayerX;
    player.y = nextPlayerY;
    scoreMeters = Math.max(0, Math.floor(Number(leader.scoreMeters) || 0));
    furthestX = Math.max(furthestX, Number(leader.furthestX) || player.x, player.x);
    escapeWaveFrontX = Number.isFinite(Number(leader.escapeWaveFrontX)) ? Number(leader.escapeWaveFrontX) : escapeWaveFrontX;
    escapeWaveSpeed = Number.isFinite(Number(leader.escapeWaveSpeed)) ? Number(leader.escapeWaveSpeed) : escapeWaveSpeed;
    generateUntil(Math.max(cameraX + cameraViewW() * 2.8, player.x + cameraViewW() * 2.8));
    updateScoreHud();
  }

  if (playback.elapsed >= playback.duration + REPLAY_END_HOLD) {
    finishCrashReplay();
  }
}

function retryCurrentSeed() {
  replayMode = false;
  activeReplayPlayback = null;
  replayInputOverride = null;
  gamePaused = false;
  reset();
}

function resumeGame() {
  if (!gameStarted || gameOver) return;
  gamePaused = false;
  setCrashActionsVisible(false);
  last = 0;
}

function pauseGame() {
  if (!gameStarted || gameOver || gamePaused) return;
  gamePaused = true;
  keys.left = false;
  keys.right = false;
  keys.up = false;
  keys.down = false;
  resetJoystickInput();
  showPauseMenu();
}

function togglePause() {
  if (gamePaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function updateFocus() {
  if (ropeShot) {
    focusedAnchor = ropeShot.anchor;
    return;
  }

  const previousFocus = focusedAnchor;
  const speed = hypot(player.vx, player.vy);
  const speedT = clamp(
    (speed - FOCUS_MIN_MOMENTUM_SPEED) / (FOCUS_FULL_BIAS_SPEED - FOCUS_MIN_MOMENTUM_SPEED),
    0,
    1
  );
  const directionBias = FOCUS_DIRECTION_BIAS * smoothstep01(speedT);
  const aimX = speed > 0.0001 ? player.vx / speed : 0;
  const aimY = speed > 0.0001 ? player.vy / speed : 0;

  const candidates = anchors.filter(a => a !== player.anchor);
  let bestAnchor = null;
  let bestCost = Infinity;

  for (const a of candidates) {
    const dx = a.x - player.x;
    const dy = a.y - player.y;
    const d = Math.max(1, hypot(dx, dy));
    const alignment = directionBias ? (dx / d) * aimX + (dy / d) * aimY : 0;

    // Pick the nearest anchor by default. Momentum only acts like a small
    // damped distance discount/penalty, so a far anchor cannot win just
    // because it happens to line up with a brief swing direction.
    let cost = d - alignment * directionBias;
    if (d > HOOK_RANGE) cost += (d - HOOK_RANGE) * FOCUS_OUT_OF_RANGE_WEIGHT;
    if (a === recentReleasedAnchor) {
      const ageT = clamp((time - recentReleasedAnchorAt) / FOCUS_RECENT_ANCHOR_DURATION, 0, 1);
      const releaseDistance = hypot(player.x - recentReleasedAnchorX, player.y - recentReleasedAnchorY);
      const distanceT = clamp(releaseDistance / FOCUS_RECENT_ANCHOR_DISTANCE, 0, 1);
      const penaltyT = (1 - smoothstep01(ageT)) * (1 - smoothstep01(distanceT));
      cost += FOCUS_RECENT_ANCHOR_PENALTY * penaltyT;
    }
    if (a === previousFocus) cost -= FOCUS_STICKY_DISTANCE;
    if (a === lockedAnchor) cost -= FOCUS_RELEASE_DISTANCE;
    if (cost < bestCost) {
      bestCost = cost;
      bestAnchor = a;
    }
  }
  focusedAnchor = bestAnchor || null;
  if (!player.attached && lockedAnchor && lockedAnchor !== focusedAnchor) {
    lockedAnchor = null;
  }
}

function inputAction(options = {}) {
  const {
    record = true,
    audio = true,
    retryOnGameOver = true,
  } = options;
  if (!gameStarted || gamePaused) return;
  if (replayMode && record) return;
  if (audio) primeGameAudio();
  if (gameOver) {
    if (retryOnGameOver) retryCurrentSeed();
    return;
  }
  if (record) recordReplayAction();
  if (player.attached) {
    updateFocus();
    lockedAnchor = focusedAnchor;
    recentReleasedAnchor = player.anchor;
    recentReleasedAnchorAt = time;
    recentReleasedAnchorX = player.x;
    recentReleasedAnchorY = player.y;
    player.attached = false;
    player.anchor = null;
    ropeShot = null;
    if (audio) playHookReleaseSound();
    return;
  }
  if (ropeShot) return;
  updateFocus();
  const target = focusedAnchor;
  if (target) {
    const d = hypot(target.x - player.x, target.y - player.y);
    if (d <= HOOK_RANGE) {
      ropeShot = {
        anchor: target,
        t: 0,
        duration: clamp(d / ROPE_SHOT_SPEED, ROPE_SHOT_MIN_DURATION, ROPE_SHOT_MAX_DURATION),
      };
      if (audio) playHookSound();
    }
  }
}

function isCameraZoomKey(e) {
  return e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd';
}

window.addEventListener('keydown', (e) => {
  if (!gameStarted) return;
  if (replayMode) {
    e.preventDefault();
    if (e.code === 'Escape') finishCrashReplay();
    return;
  }
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!gameOver) togglePause();
    return;
  }
  if (isCameraZoomKey(e)) {
    e.preventDefault();
    if (!e.repeat) cycleCameraZoom();
    return;
  }
  primeGameAudio();
  if (gamePaused && e.code === 'KeyR') {
    e.preventDefault();
    retryCurrentSeed();
  } else if (gamePaused && e.code === 'KeyH') {
    e.preventDefault();
    returnToMainMenu();
  } else if (gamePaused) {
    e.preventDefault();
  } else if (gameOver && (e.code === 'Space' || e.code === 'KeyR')) {
    e.preventDefault();
    retryCurrentSeed();
  } else if (gameOver && e.code === 'KeyP') {
    e.preventDefault();
    startCrashReplay();
  } else if (gameOver && e.code === 'KeyH') {
    e.preventDefault();
    returnToMainMenu();
  } else if (e.code === 'Space') {
    e.preventDefault();
    inputAction();
  } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    keys.left = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    keys.right = true;
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    keys.up = true;
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    keys.down = true;
  } else if (e.code === 'KeyR') {
    retryCurrentSeed();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    keys.left = false;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    keys.right = false;
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    keys.up = false;
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    keys.down = false;
  }
});
window.addEventListener('pointerdown', (e) => {
  if (!gameStarted || gamePaused) return;
  if (replayMode) {
    if (typeof stopReplayFromMobileTap === 'function' && stopReplayFromMobileTap(e)) return;
    e.preventDefault();
    return;
  }
  if (e.target.closest && e.target.closest('.touch-controls')) return;
  e.preventDefault();
  primeGameAudio();
  if (e.pointerType === 'touch' && touchControlsVisible()) return;
  inputAction();
}, { passive: false });

function update(dt) {
  time += dt;
  const viewW = cameraViewW();
  const viewH = cameraViewH();
  generateUntil(Math.max(cameraX + viewW * 2.8, player.x + viewW * 2.8));
  updateFocus();

  if (!gameOver) {
    const control = inputAxisX();
    const reel = inputAxisY();

    if (ropeShot) {
      ropeShot.t += dt;
    }

    if (player.attached && player.anchor) {
      updateAttachedPhysics(dt, control, reel);
    } else {
      if (control) {
        player.vx += control * AIR_ACCEL * dt;
      }

      const speed = hypot(player.vx, player.vy);
      const nonlinearDrag = 0.018 + Math.pow(speed / 2100, 2.2) * 1.9;
      const drag = Math.exp(-nonlinearDrag * dt);
      player.vx *= drag;
      player.vy *= drag;

      player.vy += GRAVITY * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
    }

    if (ropeShot && ropeShot.t >= ropeShot.duration) {
      const shot = ropeShot;
      ropeShot = null;
      if (!player.attached && shot.anchor && hypot(shot.anchor.x - player.x, shot.anchor.y - player.y) <= HOOK_RANGE + ROPE_ATTACH_GRACE) {
        attachToAnchor(shot.anchor);
      }
    }

    player.runPhase += dt * clamp(hypot(player.vx, player.vy) / 80, 3, 18);

    const targetCameraX = player.x + clamp(player.vx * 0.18, -300, 420) - viewW * 0.44;
    const targetCameraY = player.y + clamp(player.vy * 0.10, -220, 220) - viewH * 0.52;
    const stiffness = 44;
    const damping = 13;
    cameraVX += (targetCameraX - cameraX) * stiffness * dt;
    cameraVY += (targetCameraY - cameraY) * stiffness * dt;
    cameraVX *= Math.exp(-damping * dt);
    cameraVY *= Math.exp(-damping * dt);
    cameraX += cameraVX * dt;
    cameraY += cameraVY * dt;

    updateRagdoll(dt);
    updateHookArmAim(dt);
    updateEscapeWave(dt);

    if (isUnrecoverablyLost() || hitsObstacle() || hitsEscapeWave()) {
      die();
    }
  }

  anchors = anchors.filter(a => a === lockedAnchor || a === player.anchor || (ropeShot && a === ropeShot.anchor) || a.x > cameraX - 1800);
  obstacles = obstacles.filter(o => (o.x + (o.w || o.r || 0)) > cameraX - 1800);
  pruneTerrain();
  for (const s of bgShapes) {
    const sx = s.x - cameraX * s.layer;
    if (sx < -180) {
      Object.assign(s, makeBgShape(cameraX * s.layer + viewW + backgroundRand(100, 900)));
    }
  }

  refreshScoreAndRecords();
}

function adjustedRopeLength(oldLength, delta) {
  const next = oldLength + delta;
  if (oldLength < MIN_ROPE) {
    return delta > 0 ? Math.min(next, MIN_ROPE) : oldLength;
  }
  if (oldLength > MAX_ROPE) {
    return delta < 0 ? Math.max(next, MAX_ROPE) : oldLength;
  }
  return clamp(next, MIN_ROPE, MAX_ROPE);
}

function updateAttachedPhysics(dt, control, reel) {
  // Hybrid arcade/physics solver: this is the older projection-based rope
  // feel, with real gravity and a taut rope constraint. It is less
  // mathematically pure than polar coordinates, but it gives the expected
  // Worms-like flight path when releasing.
  const speed = hypot(player.vx, player.vy);
  const nonlinearDrag = 0.018 + Math.pow(speed / 2100, 2.2) * 1.9;
  const drag = Math.exp(-nonlinearDrag * dt);
  player.vx *= drag;
  player.vy *= drag;

  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const dx = player.x - player.anchor.x;
  const dy = player.y - player.anchor.y;
  const d = Math.max(0.0001, hypot(dx, dy));
  const nx = dx / d;
  const ny = dy / d;

  if (control) {
    // Rope input is a world-horizontal push, projected onto the taut-rope
    // tangent. That means holding right is not a permanent angular motor:
    // it helps on one half of the circle and fights you on the other, so
    // loops require swapping left/right with timing.
    const ax = control * SWING_ACCEL;
    const radialAccel = ax * nx;
    player.vx += (ax - radialAccel * nx) * dt;
    player.vy += (-radialAccel * ny) * dt;
  }

  if (Math.abs(reel) > 0.0001) {
    const oldLength = player.ropeLength;
    player.ropeLength = adjustedRopeLength(oldLength, reel * ROPE_REEL_SPEED * dt);
    if (player.ropeLength !== oldLength) {
      const tx = -ny;
      const ty = nx;
      const tangentSpeed = player.vx * tx + player.vy * ty;
      const radialSpeed = player.vx * nx + player.vy * ny;
      const energyScale = clamp(oldLength / player.ropeLength, 0.985, 1.018);
      player.vx = tx * tangentSpeed * energyScale + nx * radialSpeed;
      player.vy = ty * tangentSpeed * energyScale + ny * radialSpeed;
    }
  }

  player.x = player.anchor.x + nx * player.ropeLength;
  player.y = player.anchor.y + ny * player.ropeLength;
  const radial = player.vx * nx + player.vy * ny;
  player.vx -= radial * nx;
  player.vy -= radial * ny;

  player.angle = Math.atan2(player.x - player.anchor.x, player.y - player.anchor.y);
  player.angularVelocity = ((player.vx * ny) - (player.vy * nx)) / Math.max(1, player.ropeLength);
}

function syncAttachedKinematics() {
  if (!player.anchor) return;
  const sin = Math.sin(player.angle);
  const cos = Math.cos(player.angle);
  player.x = player.anchor.x + sin * player.ropeLength;
  player.y = player.anchor.y + cos * player.ropeLength;
  player.vx = cos * player.angularVelocity * player.ropeLength;
  player.vy = -sin * player.angularVelocity * player.ropeLength;
}

function attachToAnchor(anchor) {
  const d = Math.max(0.0001, hypot(anchor.x - player.x, anchor.y - player.y));
  player.attached = true;
  player.anchor = anchor;
  lockedAnchor = null;
  recentReleasedAnchor = null;
  recentReleasedAnchorAt = -Infinity;
  player.ropeLength = clamp(d, MIN_ROPE, MAX_ROPE);
  player.angle = Math.atan2(player.x - anchor.x, player.y - anchor.y);

  // Catching a rope mostly keeps linear momentum, but a taut rope cannot
  // keep outward radial velocity forever. Softly remove that component so
  // the catch feels like the old version instead of a harsh snap.
  const nx = (player.x - anchor.x) / d;
  const ny = (player.y - anchor.y) / d;
  const radial = player.vx * nx + player.vy * ny;
  if (radial > 0) {
    player.vx -= radial * nx * 0.35;
    player.vy -= radial * ny * 0.35;
  }
  player.angularVelocity = ((player.vx * ny) - (player.vy * nx)) / Math.max(1, player.ropeLength);
}

function die() {
  if (gameOver) return;
  gamePaused = false;
  runFinalScore = refreshScoreAndRecords();
  if (!replayMode) finalizeReplayRecording();
  gameOver = true;
  beginCrashPlayerFade(replayMode);
  if (!replayMode) {
    updateCrashSummary();
    setCrashActionsVisible(true);
    playGameOverSound();
  } else {
    setCrashActionsVisible(false);
  }
  player.attached = false;
  player.anchor = null;
  lockedAnchor = null;
  recentReleasedAnchor = null;
  recentReleasedAnchorAt = -Infinity;
  ropeShot = null;
}

function isUnrecoverablyLost() {
  if (player.attached) return false;
  if (player.y < LOST_BELOW_Y) return false;
  return !anchors.some(a => a.x > player.x - 260 && hypot(a.x - player.x, a.y - player.y) <= HOOK_RANGE);
}


function sx(x) { return x - cameraX; }
function sy(y) { return y - cameraY; }

function setViewportTransform() {
  ctx.setTransform(DPR * viewportScale, 0, 0, DPR * viewportScale, DPR * viewportX, DPR * viewportY);
}

function setWorldTransform() {
  ctx.setTransform(DPR * viewportScale * cameraZoom, 0, 0, DPR * viewportScale * cameraZoom, DPR * viewportX, DPR * viewportY);
}

function draw() {
  if (gameShellEl) gameShellEl.classList.toggle('is-replaying', replayMode);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, screenW, screenH);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, screenW, screenH);

  setViewportTransform();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  setWorldTransform();
  drawBackground();
  drawTerrain();
  drawEscapeWave();
  drawObstacles();
  drawAnchors();
  if (replayMode && activeReplayPlayback) {
    drawReplayGhosts();
  } else {
    drawGameplayPlayer();
  }
  if (DEBUG_HITBOXES) drawDebugHitboxes();

  setViewportTransform();
  if (replayMode) drawReplayBadge();
  if (gameOver || gamePaused) drawCrashCard();
}


function drawCrashCard() {
  // Crash controls are rendered as DOM so the retry/new-seed buttons are
  // real clickable/focusable controls on both desktop and mobile.
}

function resetCrashPlayerFade() {
  crashPlayerFadeStartedAt = 0;
}

function beginCrashPlayerFade(immediate = false) {
  crashPlayerFadeStartedAt = performance.now() - (immediate ? CRASH_PLAYER_FADE_MS : 0);
}

function crashPlayerAlpha() {
  if (!gameOver || replayMode) return 1;
  if (!crashPlayerFadeStartedAt) return 0;
  const age = performance.now() - crashPlayerFadeStartedAt;
  return clamp(1 - age / CRASH_PLAYER_FADE_MS, 0, 1);
}

function drawGameplayPlayer() {
  const alpha = crashPlayerAlpha();
  if (alpha <= 0.01) return;
  ctx.save();
  try {
    ctx.globalAlpha *= alpha;
    drawRopeAndPlayer();
  } finally {
    ctx.restore();
  }
}

function applyReplayRenderState(state) {
  if (!state || !state.player) return false;

  Object.assign(player, cloneReplayPlayer(state.player));
  const nextRagdoll = cloneReplayRagdoll(state.ragdoll || {});
  ragdoll.initialized = nextRagdoll.initialized;
  ragdoll.visualSide = nextRagdoll.visualSide;
  ragdoll.joints = nextRagdoll.joints;

  Object.assign(hookArm, cloneReplayHookArm(state.hookArm || {}));
  ropeShot = cloneReplayRopeShot(state.ropeShot || null);
  escapeWaveFrontX = Number.isFinite(Number(state.escapeWaveFrontX)) ? Number(state.escapeWaveFrontX) : escapeWaveFrontX;
  escapeWaveSpeed = Number.isFinite(Number(state.escapeWaveSpeed)) ? Number(state.escapeWaveSpeed) : escapeWaveSpeed;
  return true;
}

function saveReplayRenderGlobals() {
  return {
    player: cloneReplayPlayer(),
    ragdoll: cloneReplayRagdoll(),
    hookArm: cloneReplayHookArm(),
    ropeShot: cloneReplayRopeShot(),
    escapeWaveFrontX,
    escapeWaveSpeed,
    appearance: { ...characterAppearance },
  };
}

function restoreReplayRenderGlobals(saved) {
  Object.assign(player, cloneReplayPlayer(saved.player));
  const savedRagdoll = cloneReplayRagdoll(saved.ragdoll);
  ragdoll.initialized = savedRagdoll.initialized;
  ragdoll.visualSide = savedRagdoll.visualSide;
  ragdoll.joints = savedRagdoll.joints;
  Object.assign(hookArm, cloneReplayHookArm(saved.hookArm));
  ropeShot = cloneReplayRopeShot(saved.ropeShot);
  escapeWaveFrontX = saved.escapeWaveFrontX;
  escapeWaveSpeed = saved.escapeWaveSpeed;
  characterAppearance.hat = saved.appearance.hat || null;
  characterAppearance.color = normalizeCharacterColorId(saved.appearance.color);
  characterAppearance.hatColor = normalizeCharacterColorId(saved.appearance.hatColor);
  characterAppearance.hatUsesCustomColor = Boolean(saved.appearance.hatUsesCustomColor);
  characterAppearance.ropeColor = normalizeCharacterColorId(saved.appearance.ropeColor || DEFAULT_ROPE_COLOR);
  applyCustomRopeColor();
  characterAppearance.backpack = Boolean(saved.appearance.backpack);
}

function applyReplayAppearance(appearance = {}) {
  characterAppearance.hat = appearance.hat || null;
  characterAppearance.color = normalizeCharacterColorId(appearance.color);
  characterAppearance.hatColor = normalizeCharacterColorId(appearance.hatColor);
  characterAppearance.hatUsesCustomColor = Boolean(appearance.hatUsesCustomColor);
  characterAppearance.ropeColor = normalizeCharacterColorId(appearance.ropeColor || DEFAULT_ROPE_COLOR);
  applyCustomRopeColor();
  characterAppearance.backpack = Boolean(appearance.backpack);
  if (typeof preloadCharacterAppearance === 'function') preloadCharacterAppearance();
}

function drawReplayGhosts() {
  const playback = activeReplayPlayback;
  if (!playback || !playback.replays) return;

  const saved = saveReplayRenderGlobals();
  try {
    for (let i = 0; i < playback.replays.length; i += 1) {
      const replay = playback.replays[i];
      const sample = replaySampleAt(playback, i, playback.elapsed);
      if (!sample || !applyReplayRenderState(sample)) continue;

      const isLeader = i === playback.leaderIndex;
      const alpha = (sample.replayAlpha ?? 1) * (isLeader ? 0.82 : 0.5);
      if (alpha <= 0.01) continue;

      applyReplayAppearance(replay.characterAppearance);
      const savedRope = ROPE;
      const savedMutedLine = MUTED_LINE;
      ROPE = INK;
      MUTED_LINE = INK;
      ctx.save();
      try {
        ctx.globalAlpha *= alpha;
        drawRopeAndPlayer();
      } finally {
        ctx.restore();
        ROPE = savedRope;
        MUTED_LINE = savedMutedLine;
      }
    }
  } finally {
    restoreReplayRenderGlobals(saved);
  }
}

function drawReplayBadge() {
  const text = 'replay';
  ctx.save();
  ctx.font = '900 24px "Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive';
  ctx.textBaseline = 'middle';
  const paddingX = 16;
  const width = Math.ceil(ctx.measureText(text).width + paddingX * 2);
  const height = 44;
  const x = W - width - 24;
  const y = 22;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = INK;
  ctx.fillText(text, x + paddingX, y + height / 2 + 1);
  ctx.restore();
}

function frame(ts) {
  if (!last) last = ts;
  const dt = Math.min(0.033, (ts - last) / 1000);
  last = ts;
  if (gameStarted && !gamePaused && (!gameOver || replayMode)) {
    if (replayMode) {
      updateReplayPlayback(dt);
    } else {
      const replayFrame = recordReplayFrame(dt);
      update(dt);
      captureReplayFrameState(replayFrame);
    }
  }
  draw();
  requestAnimationFrame(frame);
}

function setupPerfLogging() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('perf') !== '1') return;

  const intervalMs = Math.max(1000, Number(params.get('perfInterval') || 5000));
  const perf = {
    startedAt: performance.now(),
    lastReportAt: performance.now(),
    calls: {},
    frameTimes: [],
    frameDeltas: [],
    lastFrameTs: 0,
  };
  window.__ropePerf = perf;

  const wrap = (name) => {
    const fn = window[name];
    if (typeof fn !== 'function') return;
    const wrapped = function(...args) {
      const t0 = performance.now();
      try {
        return fn.apply(this, args);
      } finally {
        const dt = performance.now() - t0;
        const stats = perf.calls[name] || (perf.calls[name] = { count: 0, total: 0, max: 0 });
        stats.count += 1;
        stats.total += dt;
        stats.max = Math.max(stats.max, dt);
        if (name === 'frame') {
          perf.frameTimes.push(dt);
          const ts = args[0];
          if (perf.lastFrameTs) perf.frameDeltas.push(ts - perf.lastFrameTs);
          perf.lastFrameTs = ts;
        }
      }
    };
    window[name] = wrapped;
    try {
      // Top-level function declarations in classic scripts have lexical
      // bindings as well as window properties; reassign both so calls from
      // other game functions go through the wrapper too.
      (0, eval)(`${name} = window.${name}`);
    } catch (_) {
      // Ignore if a browser ever refuses the reassignment.
    }
  };

  [
    'frame',
    'update',
    'draw',
    'updateFocus',
    'generateUntil',
    'refreshScoreAndRecords',
    'updateAttachedPhysics',
    'updateRagdoll',
    'solveRagdollConstraints',
    'updateHookArmAim',
    'hitsObstacle',
    'obstacleHitboxes',
    'playerHitboxes',
    'terrainSolidHitbox',
    'terrainLiquidHitboxes',
    'terrainPoolPolygons',
    'terrainPoints',
    'terrainYAt',
    'drawBackground',
    'drawTerrain',
    'drawTerrainPool',
    'drawEscapeWave',
    'drawObstacles',
    'drawGate',
    'drawSaw',
    'drawSpikes',
    'drawBar',
    'drawAnchors',
    'drawRopeAndPlayer',
    'drawStickman',
  ].forEach(wrap);

  const percentile = (values, p) => {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  };

  const resetWindow = () => {
    perf.calls = {};
    perf.frameTimes = [];
    perf.frameDeltas = [];
    perf.lastFrameTs = 0;
    perf.lastReportAt = performance.now();
  };

  setInterval(() => {
    const now = performance.now();
    const seconds = Math.max(0.001, (now - perf.lastReportAt) / 1000);
    const frames = perf.calls.frame ? perf.calls.frame.count : 0;
    const frameWorkTotal = perf.calls.frame ? perf.calls.frame.total : 0;
    const rows = Object.entries(perf.calls)
      .filter(([name]) => name !== 'frame')
      .map(([name, stats]) => ({
        name,
        calls: stats.count,
        totalMs: Number(stats.total.toFixed(2)),
        avgMs: Number((stats.total / stats.count).toFixed(4)),
        maxMs: Number(stats.max.toFixed(3)),
        msPerFrame: Number((stats.total / Math.max(1, frames)).toFixed(4)),
        pctFrameWork: Number((stats.total / Math.max(0.001, frameWorkTotal) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 18);

    const memory = performance.memory ? {
      usedMB: Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1)),
      totalMB: Number((performance.memory.totalJSHeapSize / 1048576).toFixed(1)),
    } : null;

    console.groupCollapsed(
      `[perf] ${gameStarted ? (gameOver ? 'game-over' : (gamePaused ? 'paused' : 'playing')) : 'menu'} ` +
      `${frames} frames/${seconds.toFixed(1)}s ` +
      `${(frames / seconds).toFixed(1)} fps ` +
      `frame ${percentile(perf.frameDeltas, 0.5).toFixed(1)}ms p50 / ${percentile(perf.frameDeltas, 0.95).toFixed(1)}ms p95 ` +
      `work ${(frameWorkTotal / Math.max(1, frames)).toFixed(3)}ms avg`
    );
    console.log({
      frames,
      seconds: Number(seconds.toFixed(2)),
      avgFps: Number((frames / seconds).toFixed(2)),
      frameDeltaP50Ms: Number(percentile(perf.frameDeltas, 0.5).toFixed(2)),
      frameDeltaP95Ms: Number(percentile(perf.frameDeltas, 0.95).toFixed(2)),
      frameWorkAvgMs: Number((frameWorkTotal / Math.max(1, frames)).toFixed(4)),
      frameWorkP95Ms: Number(percentile(perf.frameTimes, 0.95).toFixed(4)),
      memory,
      player: { x: Math.round(player.x), y: Math.round(player.y), vx: Math.round(player.vx), vy: Math.round(player.vy) },
      counts: { anchors: anchors.length, obstacles: obstacles.length, terrainKnots: terrainKnots.length, terrainPools: terrainPools.length },
    });
    console.table(rows);
    console.groupEnd();
    resetWindow();
  }, intervalMs);

  console.info(`[perf] enabled; reporting every ${intervalMs}ms. Open with ?perf=1 or ?perf=1&perfInterval=10000.`);
}

setupPerfLogging();
startGameAudioLoad();
setupMobileZoomGuard();
setupStartControls();
setupCrashControls();
setupTouchControls();
resize();
reset();
updateScoreHud();
requestAnimationFrame(frame);
