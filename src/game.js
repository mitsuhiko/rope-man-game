// Core game loop, player physics, input actions, and bootstrap.

const ASSIST_SIM_STEP = 1 / 30;
const ASSIST_RELEASE_LOOKAHEAD = 1.55;
const ASSIST_HOOK_LOOKAHEAD_PAD = 0.12;
const ASSIST_POST_HOOK_LOOKAHEAD = 0.85;
const ASSIST_RELEASE_MIN_LEAD = 0.16;
const ASSIST_RELEASE_RANGE = HOOK_RANGE * 0.92;
const ASSIST_ATTACH_MARGIN = 18;
const ASSIST_SAFE_RADIUS = 34;
const ASSIST_FORWARD_MIN_X = 70;
const ASSIST_BACKWARD_ALLOWANCE = 180;
const ASSIST_REEL_LOOKAHEAD = 1.45;
const ASSIST_REEL_CRITICAL_WINDOW = 1.05;
const ASSIST_REEL_MIN_SURVIVAL_GAIN = 0.26;
const ASSIST_REEL_SAFE_BONUS = 0.48;
const ASSIST_REEL_MIN_LENGTH_CHANGE = 14;
const ASSIST_REEL_INPUT_DEAD_ZONE = 0.35;
const ASSIST_ROPE_MOTION_LOOKAHEAD = 1.65;
const ASSIST_ROPE_WARNING_LOOKAHEAD = ASSIST_ROPE_MOTION_LOOKAHEAD;
const ASSIST_ROPE_WARNING_RADIUS = 31;
const PRACTICE_BACK_ANCHOR_COUNT = 0;
const PRACTICE_BACK_ANCHOR_START_GAP = 260;
const PRACTICE_BACK_ANCHOR_SPACING = 320;
const PRACTICE_BACK_ANCHOR_NEAR_X = 110;
const PRACTICE_BACK_ANCHOR_NEAR_Y = 150;
let assistCue = null;
let assistReelCue = null;
let practiceCheckpoint = null;
let practiceCheckpointHistory = [];
let practiceCheckpointIndex = 0;
let practiceRestoredFromCheckpoint = false;

function reset(options = {}) {
  const tracksStats = gameModeTracksStats(gameMode);
  const countAttempt = (options.countAttempt ?? (gameStarted && !replayMode)) && tracksStats;
  const recordRun = (options.recordRun ?? (gameStarted && !replayMode)) && tracksStats;

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
  coins = [];
  collectedCoinIds = new Set();
  currentRunCoinsEarned = 0;
  currentRunRecordBonus = 0;
  currentRunDistanceBonus = 0;
  currentRunDistanceBonusMilestone = 0;
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
  assistCue = null;
  assistReelCue = null;
  if (typeof syncAssistCueUi === 'function') syncAssistCueUi();
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
  nextSwingSoundAt = 0;
  lastSwingAngle = null;
  lastSwingAnchorId = null;
  lastSwingSpeed = 0;
  lastSwingSpeedTrend = 0;
  cameraX = player.x - cameraViewW() * 0.42;
  cameraY = player.y - cameraViewH() * 0.52;
  resetEscapeWave();
  resetPracticeCheckpoints();
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

function gameModeUsesPracticeCheckpoints() {
  return normalizeGameMode(gameMode) === 'practice';
}

function clonePracticeList(items) {
  return (Array.isArray(items) ? items : []).map(item => ({ ...item }));
}

function practiceAnchorYBehind(reference, x, index) {
  const referenceY = Number(reference && reference.y) || player.y;
  const maxY = Math.min(terrainYAt(x) - ANCHOR_TERRAIN_CLEARANCE, anchorHazardMaxY(x));
  const stagger = index % 2 === 0 ? 34 : -42;
  return clamp(referenceY + stagger, ANCHOR_MIN_Y, maxY);
}

function practiceHasAnchorNear(x, y) {
  return anchors.some(anchor => (
    Math.abs(anchor.x - x) <= PRACTICE_BACK_ANCHOR_NEAR_X &&
    Math.abs(anchor.y - y) <= PRACTICE_BACK_ANCHOR_NEAR_Y
  ));
}

function ensurePracticeBackAnchors(reference = player.anchor || player) {
  if (!gameModeUsesPracticeCheckpoints() || replayMode || !reference) return;

  for (let i = 0; i < PRACTICE_BACK_ANCHOR_COUNT; i += 1) {
    const x = reference.x - PRACTICE_BACK_ANCHOR_START_GAP - i * PRACTICE_BACK_ANCHOR_SPACING;
    const y = practiceAnchorYBehind(reference, x, i);
    if (practiceHasAnchorNear(x, y)) continue;
    addAnchor(x, y);
    anchors[anchors.length - 1].practice = true;
  }
}

function capturePracticeState() {
  return {
    time,
    cameraX,
    cameraY,
    cameraVX,
    cameraVY,
    scoreMeters,
    scoreStartX,
    furthestX,
    runFinalScore,
    escapeWaveFrontX,
    escapeWaveSpeed,
    rngState,
    backgroundRngState,
    coinRngState,
    nextAnchorX,
    nextObstacleX,
    generatedWorldX,
    spawnIndex,
    terrainCursorX,
    terrainLastY,
    nextTerrainPoolX,
    player: cloneReplayPlayer(),
    ragdoll: cloneReplayRagdoll(),
    hookArm: cloneReplayHookArm(),
    ropeShot: cloneReplayRopeShot(),
    focusedAnchor: cloneReplayAnchor(focusedAnchor),
    lockedAnchor: cloneReplayAnchor(lockedAnchor),
    recentReleasedAnchor: cloneReplayAnchor(recentReleasedAnchor),
    recentReleasedAnchorAt,
    recentReleasedAnchorX,
    recentReleasedAnchorY,
    anchors: clonePracticeList(anchors),
    obstacles: clonePracticeList(obstacles),
    bgShapes: clonePracticeList(bgShapes),
    terrainKnots: clonePracticeList(terrainKnots),
    terrainPools: clonePracticeList(terrainPools),
  };
}

function resetPracticeCheckpoints() {
  practiceCheckpoint = null;
  practiceCheckpointHistory = [];
  practiceCheckpointIndex = 0;
  practiceRestoredFromCheckpoint = false;
  if (!gameModeUsesPracticeCheckpoints()) return;

  ensurePracticeBackAnchors(player.anchor);
  practiceCheckpoint = capturePracticeState();
  practiceCheckpointHistory = [practiceCheckpoint];
}

function samePracticeAnchor(a, b) {
  if (!a || !b) return false;
  const aid = Number(a.id) || 0;
  const bid = Number(b.id) || 0;
  if (aid && bid && aid === bid) return true;
  return Math.abs((Number(a.x) || 0) - (Number(b.x) || 0)) < 0.001 &&
    Math.abs((Number(a.y) || 0) - (Number(b.y) || 0)) < 0.001;
}

function practiceSnapshotAnchor(snapshot) {
  return snapshot && snapshot.player ? snapshot.player.anchor : null;
}

function setPracticeCheckpointIndex(index) {
  if (!practiceCheckpointHistory.length) {
    practiceCheckpointIndex = 0;
    practiceCheckpoint = null;
    return;
  }
  practiceCheckpointIndex = Math.max(0, Math.min(practiceCheckpointHistory.length - 1, Math.floor(Number(index) || 0)));
  practiceCheckpoint = practiceCheckpointHistory[practiceCheckpointIndex] || null;
}

function pushPracticeCheckpoint(snapshot) {
  if (!snapshot) return practiceCheckpointHistory.length - 1;
  const lastIndex = practiceCheckpointHistory.length - 1;
  const last = practiceCheckpointHistory[lastIndex];
  if (last && samePracticeAnchor(practiceSnapshotAnchor(last), practiceSnapshotAnchor(snapshot))) {
    practiceCheckpointHistory[lastIndex] = snapshot;
    return lastIndex;
  }

  practiceCheckpointHistory.push(snapshot);
  if (practiceCheckpointHistory.length > 12) practiceCheckpointHistory.shift();
  return practiceCheckpointHistory.length - 1;
}

function rememberPracticeReleaseCheckpoint() {
  if (!gameModeUsesPracticeCheckpoints() || replayMode) return;
  ensurePracticeBackAnchors(player.anchor);
}

function markPracticeHook(anchor = player.anchor) {
  if (!gameModeUsesPracticeCheckpoints() || replayMode) return;
  ensurePracticeBackAnchors(anchor);

  // Practice respawns at the hook state one anchor before the latest hook, not
  // at the moment you let go.  Release-time snapshots can already be doomed by
  // terrain or obstacles, which is what caused unrecoverable respawn loops.
  if (practiceRestoredFromCheckpoint) {
    practiceCheckpointHistory = practiceCheckpointHistory.slice(0, practiceCheckpointIndex + 1);
  }
  const hookIndex = pushPracticeCheckpoint(capturePracticeState());
  setPracticeCheckpointIndex(Math.max(0, hookIndex - 1));
  practiceRestoredFromCheckpoint = false;
}

function practiceAnchorFromSnapshot(anchor) {
  if (!anchor) return null;
  const id = Number(anchor.id) || 0;
  const x = Number(anchor.x) || 0;
  const y = Number(anchor.y) || 0;
  let found = anchors.find(a => a && a.id === id && Math.abs(a.x - x) < 0.001 && Math.abs(a.y - y) < 0.001);
  if (!found && id) found = anchors.find(a => a && a.id === id);
  if (!found) found = anchors.find(a => a && Math.abs(a.x - x) < 0.001 && Math.abs(a.y - y) < 0.001);
  if (found) return found;

  const restored = cloneReplayAnchor(anchor);
  anchors.push(restored);
  return restored;
}

function restorePracticeCheckpoint(snapshot) {
  if (!snapshot) return false;

  time = Number.isFinite(Number(snapshot.time)) ? Number(snapshot.time) : time;
  cameraX = Number.isFinite(Number(snapshot.cameraX)) ? Number(snapshot.cameraX) : cameraX;
  cameraY = Number.isFinite(Number(snapshot.cameraY)) ? Number(snapshot.cameraY) : cameraY;
  cameraVX = Number.isFinite(Number(snapshot.cameraVX)) ? Number(snapshot.cameraVX) : 0;
  cameraVY = Number.isFinite(Number(snapshot.cameraVY)) ? Number(snapshot.cameraVY) : 0;
  scoreMeters = Math.max(0, Math.floor(Number(snapshot.scoreMeters) || 0));
  scoreStartX = Number.isFinite(Number(snapshot.scoreStartX)) ? Number(snapshot.scoreStartX) : scoreStartX;
  furthestX = Number.isFinite(Number(snapshot.furthestX)) ? Number(snapshot.furthestX) : furthestX;
  runFinalScore = Math.max(0, Math.floor(Number(snapshot.runFinalScore) || 0));
  escapeWaveFrontX = Number.isFinite(Number(snapshot.escapeWaveFrontX)) ? Number(snapshot.escapeWaveFrontX) : escapeWaveFrontX;
  escapeWaveSpeed = Number.isFinite(Number(snapshot.escapeWaveSpeed)) ? Number(snapshot.escapeWaveSpeed) : escapeWaveSpeed;
  rngState = Number.isFinite(Number(snapshot.rngState)) ? normalizeSeedValue(Number(snapshot.rngState)) : rngState;
  backgroundRngState = Number.isFinite(Number(snapshot.backgroundRngState)) ? normalizeSeedValue(Number(snapshot.backgroundRngState)) : backgroundRngState;
  coinRngState = Number.isFinite(Number(snapshot.coinRngState)) ? normalizeSeedValue(Number(snapshot.coinRngState)) : coinRngState;
  nextAnchorX = Number.isFinite(Number(snapshot.nextAnchorX)) ? Number(snapshot.nextAnchorX) : nextAnchorX;
  nextObstacleX = Number.isFinite(Number(snapshot.nextObstacleX)) ? Number(snapshot.nextObstacleX) : nextObstacleX;
  generatedWorldX = Number.isFinite(Number(snapshot.generatedWorldX)) ? Number(snapshot.generatedWorldX) : generatedWorldX;
  spawnIndex = Number.isFinite(Number(snapshot.spawnIndex)) ? Math.floor(Number(snapshot.spawnIndex)) : spawnIndex;
  terrainCursorX = Number.isFinite(Number(snapshot.terrainCursorX)) ? Number(snapshot.terrainCursorX) : terrainCursorX;
  terrainLastY = Number.isFinite(Number(snapshot.terrainLastY)) ? Number(snapshot.terrainLastY) : terrainLastY;
  nextTerrainPoolX = Number.isFinite(Number(snapshot.nextTerrainPoolX)) ? Number(snapshot.nextTerrainPoolX) : nextTerrainPoolX;

  anchors = clonePracticeList(snapshot.anchors);
  obstacles = clonePracticeList(snapshot.obstacles);
  bgShapes = clonePracticeList(snapshot.bgShapes);
  terrainKnots = clonePracticeList(snapshot.terrainKnots);
  terrainPools = clonePracticeList(snapshot.terrainPools);

  const restoredPlayer = cloneReplayPlayer(snapshot.player || {});
  Object.assign(player, restoredPlayer);
  player.anchor = practiceAnchorFromSnapshot(restoredPlayer.anchor);
  player.attached = Boolean(restoredPlayer.attached && player.anchor);
  player.alive = true;

  const restoredRagdoll = cloneReplayRagdoll(snapshot.ragdoll || {});
  ragdoll.initialized = restoredRagdoll.initialized;
  ragdoll.visualSide = restoredRagdoll.visualSide;
  ragdoll.joints = restoredRagdoll.joints;

  Object.assign(hookArm, cloneReplayHookArm(snapshot.hookArm || {}));
  ropeShot = cloneReplayRopeShot(snapshot.ropeShot || null);
  if (ropeShot) ropeShot.anchor = practiceAnchorFromSnapshot(ropeShot.anchor);
  focusedAnchor = practiceAnchorFromSnapshot(snapshot.focusedAnchor);
  lockedAnchor = practiceAnchorFromSnapshot(snapshot.lockedAnchor);
  recentReleasedAnchor = practiceAnchorFromSnapshot(snapshot.recentReleasedAnchor);
  recentReleasedAnchorAt = Number.isFinite(Number(snapshot.recentReleasedAnchorAt)) ? Number(snapshot.recentReleasedAnchorAt) : -Infinity;
  recentReleasedAnchorX = Number.isFinite(Number(snapshot.recentReleasedAnchorX)) ? Number(snapshot.recentReleasedAnchorX) : 0;
  recentReleasedAnchorY = Number.isFinite(Number(snapshot.recentReleasedAnchorY)) ? Number(snapshot.recentReleasedAnchorY) : 0;
  ensurePracticeBackAnchors(player.anchor);

  gameOver = false;
  gamePaused = false;
  assistCue = null;
  assistReelCue = null;
  resetCrashPlayerFade();
  setCrashActionsVisible(false);
  stopGameOverSound();
  if (typeof resetJoystickInput === 'function') resetJoystickInput();
  if (typeof syncAssistCueUi === 'function') syncAssistCueUi();
  updateScoreHud();
  return true;
}

function resetPracticeAfterDeath() {
  if (!gameModeUsesPracticeCheckpoints() || replayMode) return false;
  if (!practiceCheckpoint) {
    reset({ countAttempt: false, recordRun: false });
    return true;
  }

  // If the restored checkpoint itself leads to another death before a new hook
  // is reached, do not trap the player there forever. Back up through the hook
  // history one anchor at a time until recovery is possible.
  if (practiceRestoredFromCheckpoint && practiceCheckpointIndex > 0) {
    practiceCheckpointHistory = practiceCheckpointHistory.slice(0, practiceCheckpointIndex);
    setPracticeCheckpointIndex(practiceCheckpointHistory.length - 1);
  }

  const restored = restorePracticeCheckpoint(practiceCheckpoint);
  practiceRestoredFromCheckpoint = restored;
  return restored;
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

function currentAssistCueKind() {
  if (!assistEnabled || !assistCue || !gameStarted || gameOver || gamePaused || replayMode) return '';
  return assistCue.kind || '';
}

function currentAssistReelCueKind() {
  if (!assistEnabled || !assistReelCue || !gameStarted || gameOver || gamePaused || replayMode) return '';
  return assistReelCue.kind || '';
}

function assistHexToRgba(hex, alpha = 1) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(0, 168, 107, ${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function assistPaletteForStyle(style = 'default') {
  const palettes = colorTheme === 'dark'
    ? {
      default: '#82ffb4',
      quick: '#82ffb4',
      short: '#82ffb4',
      reel: '#7cc7ff',
      long: '#ffd166',
      jump: '#ffd166',
      drop: '#ffd166',
      glide: '#ffd166',
    }
    : {
      default: '#00a86b',
      quick: '#00a86b',
      short: '#00a86b',
      reel: '#2f80ed',
      long: '#f59e0b',
      jump: '#f59e0b',
      drop: '#f59e0b',
      glide: '#f59e0b',
    };
  const color = palettes[style] || palettes.default;
  return {
    color,
    soft: assistHexToRgba(color, colorTheme === 'dark' ? 0.15 : 0.17),
    glow: assistHexToRgba(color, 0.36),
  };
}

function assistPaletteForCue(cue) {
  return assistPaletteForStyle(cue && cue.assistStyle ? cue.assistStyle : 'default');
}

function setAssistElementPalette(element, cue) {
  if (!element) return;
  const palette = assistPaletteForCue(cue);
  element.style.setProperty('--assist-current', palette.color);
  element.style.setProperty('--assist-current-soft', palette.soft);
  element.style.setProperty('--assist-current-glow', palette.glow);
}

function clearAssistElementPalette(element) {
  if (!element) return;
  element.style.removeProperty('--assist-current');
  element.style.removeProperty('--assist-current-soft');
  element.style.removeProperty('--assist-current-glow');
}

function syncAssistCueUi() {
  const cueKind = currentAssistCueKind();
  if (touchActionEl) {
    touchActionEl.classList.toggle('is-assist-cue', Boolean(cueKind));
    if (cueKind) {
      const label = cueKind === 'release' ? (assistCue.controlLabel || 'LET GO!') : 'HOOK!';
      touchActionEl.dataset.assistLabel = label;
      touchActionEl.setAttribute('aria-label', `Assist: ${(assistCue.ariaLabel || label).replace(/\s+/g, ' ').toLowerCase()}`);
      setAssistElementPalette(touchActionEl, assistCue);
    } else {
      touchActionEl.removeAttribute('data-assist-label');
      touchActionEl.setAttribute('aria-label', 'Hook or unhook');
      clearAssistElementPalette(touchActionEl);
    }
  }

  const reelKind = currentAssistReelCueKind();
  if (touchJoystickEl) {
    touchJoystickEl.classList.toggle('is-assist-cue', Boolean(reelKind));
    touchJoystickEl.classList.toggle('is-assist-retract', reelKind === 'retract');
    touchJoystickEl.classList.toggle('is-assist-extend', reelKind === 'extend');
    if (reelKind) {
      const label = assistReelCue.controlLabel || (reelKind === 'retract' ? 'RETRACT ↑' : 'EXTEND ↓');
      touchJoystickEl.dataset.assistLabel = label;
      touchJoystickEl.setAttribute('aria-label', `Assist: ${assistReelCue.ariaLabel || label.toLowerCase()}`);
      setAssistElementPalette(touchJoystickEl, assistReelCue);
      if (touchStickEl) touchStickEl.dataset.assistLabel = label;
    } else {
      touchJoystickEl.removeAttribute('data-assist-label');
      touchJoystickEl.setAttribute('aria-label', 'Move and reel joystick');
      clearAssistElementPalette(touchJoystickEl);
      if (touchStickEl) touchStickEl.removeAttribute('data-assist-label');
    }
  }
}

function assistNextForwardAnchor() {
  const minX = Math.max(
    player.x + ASSIST_FORWARD_MIN_X,
    player.anchor ? player.anchor.x + ASSIST_FORWARD_MIN_X : -Infinity,
  );
  let next = null;
  for (const anchor of anchors) {
    if (anchor === player.anchor) continue;
    if (anchor.x < minX) continue;
    if (!next || anchor.x < next.x) next = anchor;
  }
  return next;
}

function assistFreeFlightPoints(duration, source = player, control = inputAxisX()) {
  const total = Math.max(0, Number(duration) || 0);
  const points = [];
  let x = Number(source.x) || 0;
  let y = Number(source.y) || 0;
  let vx = Number(source.vx) || 0;
  let vy = Number(source.vy) || 0;
  let t = 0;
  points.push({ x, y, vx, vy, t });

  while (t < total - 0.0001) {
    const dt = Math.min(ASSIST_SIM_STEP, total - t);
    if (control) vx += control * AIR_ACCEL * dt;

    const speed = hypot(vx, vy);
    const nonlinearDrag = 0.018 + Math.pow(speed / 2100, 2.2) * 1.9;
    const drag = Math.exp(-nonlinearDrag * dt);
    vx *= drag;
    vy *= drag;

    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    points.push({ x, y, vx, vy, t });
  }

  return points;
}

function assistPointAtTime(points, targetT) {
  if (!points || !points.length) return null;
  if (targetT <= points[0].t) return points[0];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (next.t >= targetT) {
      const span = Math.max(0.0001, next.t - prev.t);
      const u = clamp((targetT - prev.t) / span, 0, 1);
      return {
        x: prev.x + (next.x - prev.x) * u,
        y: prev.y + (next.y - prev.y) * u,
        vx: prev.vx + (next.vx - prev.vx) * u,
        vy: prev.vy + (next.vy - prev.vy) * u,
        t: targetT,
      };
    }
  }
  return points[points.length - 1];
}

function assistPointHazardAt(point, futureT = point ? point.t : 0, radius = ASSIST_SAFE_RADIUS) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { kind: 'lost', point, hitbox: null };
  }

  const t = Math.max(0, Number(futureT) || 0);
  if (point.y > LOST_BELOW_Y - radius) {
    return { kind: 'lost', point, hitbox: null, t };
  }

  // Moving hazards (saws, gates, water) are sampled at the same future
  // timestamp as the predicted player point so warnings line up with where the
  // obstacle will actually be on impact.
  const hitboxes = obstacleHitboxes(point.x - 460, point.x + 460, time + t);
  const waveHitbox = typeof escapeWaveHitbox === 'function' ? escapeWaveHitbox() : null;
  if (waveHitbox) hitboxes.push(waveHitbox);

  const probe = { shape: 'circle', kind: 'assist-player', x: point.x, y: point.y, r: radius };
  const hitbox = hitboxes.find(candidate => hitboxHitsPlayer(candidate, probe));
  return hitbox ? { kind: hitbox.kind || 'hazard', point, hitbox, t } : null;
}

function assistPointHitsHazardAt(point, futureT = point ? point.t : 0, radius = ASSIST_SAFE_RADIUS) {
  return Boolean(assistPointHazardAt(point, futureT, radius));
}

function assistFirstHazardHit(points, radius = ASSIST_SAFE_RADIUS, maxLookahead = Infinity) {
  if (!points || !points.length) return null;
  const startT = Number(points[0].t) || 0;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    const relativeT = Math.max(0, (Number(point.t) || 0) - startT);
    if (relativeT > maxLookahead) break;
    const hazard = assistPointHazardAt(point, point.t, radius);
    if (hazard) return { index: i, point, hazard, t: point.t };
  }
  return null;
}

function assistFirstHazardIndex(points) {
  const hit = assistFirstHazardHit(points);
  return hit ? hit.index : Infinity;
}

function assistAttachedSwingPoints(anchor, source, duration, control = inputAxisX(), reel = inputAxisY()) {
  const total = Math.max(0, Number(duration) || 0);
  let x = Number(source.x) || 0;
  let y = Number(source.y) || 0;
  let vx = Number(source.vx) || 0;
  let vy = Number(source.vy) || 0;
  let t = 0;

  const dx0 = x - anchor.x;
  const dy0 = y - anchor.y;
  const d0 = Math.max(0.0001, hypot(dx0, dy0));
  let ropeLength = clamp(d0, MIN_ROPE, MAX_ROPE);
  const nx0 = dx0 / d0;
  const ny0 = dy0 / d0;
  const radial0 = vx * nx0 + vy * ny0;
  if (radial0 > 0) {
    vx -= radial0 * nx0 * 0.35;
    vy -= radial0 * ny0 * 0.35;
  }

  const baseT = Number(source.t) || 0;
  const points = [{ x, y, vx, vy, t: baseT, ropeLength }];

  while (t < total - 0.0001) {
    const dt = Math.min(ASSIST_SIM_STEP, total - t);
    const speed = hypot(vx, vy);
    const nonlinearDrag = 0.018 + Math.pow(speed / 2100, 2.2) * 1.9;
    const drag = Math.exp(-nonlinearDrag * dt);
    vx *= drag;
    vy *= drag;

    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;

    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const d = Math.max(0.0001, hypot(dx, dy));
    const nx = dx / d;
    const ny = dy / d;

    if (control) {
      const ax = control * SWING_ACCEL;
      const radialAccel = ax * nx;
      vx += (ax - radialAccel * nx) * dt;
      vy += (-radialAccel * ny) * dt;
    }

    if (Math.abs(reel) > 0.0001) {
      const oldLength = ropeLength;
      ropeLength = adjustedRopeLength(oldLength, reel * ROPE_REEL_SPEED * dt);
      if (ropeLength !== oldLength) {
        const tx = -ny;
        const ty = nx;
        const tangentSpeed = vx * tx + vy * ty;
        const radialSpeed = vx * nx + vy * ny;
        const energyScale = clamp(oldLength / ropeLength, 0.985, 1.018);
        vx = tx * tangentSpeed * energyScale + nx * radialSpeed;
        vy = ty * tangentSpeed * energyScale + ny * radialSpeed;
      }
    }

    x = anchor.x + nx * ropeLength;
    y = anchor.y + ny * ropeLength;
    const radial = vx * nx + vy * ny;
    vx -= radial * nx;
    vy -= radial * ny;

    t += dt;
    points.push({ x, y, vx, vy, t: baseT + t, ropeLength });
  }

  return points;
}

function assistPostHookIsSafe(anchor, catchPoint) {
  const points = assistAttachedSwingPoints(anchor, catchPoint, ASSIST_POST_HOOK_LOOKAHEAD);
  return {
    safe: !assistPointHitsHazardAt(points[0], points[0].t) && assistFirstHazardIndex(points) === Infinity,
    points,
  };
}

function assistSafeDuration(points) {
  if (!points || !points.length) return 0;
  const hazardIndex = assistFirstHazardIndex(points);
  if (hazardIndex === Infinity) return Infinity;
  return Math.max(0, points[hazardIndex].t - points[0].t);
}

function assistReleasePlan(points, best, anchor) {
  const path = points.slice(0, best.index + 1);
  const hookDelay = Math.max(0, best.point.t || 0);
  let apexY = player.y;
  for (const point of path) apexY = Math.min(apexY, point.y);

  const hookDx = best.point.x - player.x;
  const anchorDx = anchor.x - player.x;
  const hookDrop = best.point.y - player.y;
  const rise = player.y - apexY;
  const long = anchorDx > 520 || hookDx > 430 || hookDelay > 0.78;
  const short = anchorDx < 330 || hookDelay < 0.50;
  const jump = rise > 105 && best.point.y < player.y - 45;
  const drop = hookDrop > 105 && rise < 75;

  let detail;
  let assistStyle;
  if (hookDelay < 0.34) {
    detail = 'quick hook';
    assistStyle = 'quick';
  } else if (jump) {
    detail = long ? 'long jump' : (short ? 'short jump' : 'jump');
    assistStyle = 'jump';
  } else if (drop) {
    detail = long ? 'long drop' : 'drop';
    assistStyle = 'drop';
  } else if (long) {
    detail = 'long glide';
    assistStyle = 'long';
  } else if (short) {
    detail = 'short hop';
    assistStyle = 'short';
  } else {
    detail = 'glide';
    assistStyle = 'glide';
  }

  const showDetailText = assistStyle === 'jump' || assistStyle === 'drop' || assistStyle === 'long' || assistStyle === 'glide';

  return {
    detail,
    assistStyle,
    showDetailText,
    path,
    hookDelay,
  };
}

function assistReelCandidate(reel, control) {
  const points = assistAttachedSwingPoints(player.anchor, player, ASSIST_REEL_LOOKAHEAD, control, reel);
  const start = points[0] || { ropeLength: player.ropeLength, t: 0 };
  const end = points[points.length - 1] || start;
  const safeDuration = assistSafeDuration(points);
  const cappedSafeDuration = safeDuration === Infinity
    ? ASSIST_REEL_LOOKAHEAD + ASSIST_REEL_SAFE_BONUS
    : Math.min(safeDuration, ASSIST_REEL_LOOKAHEAD);
  const lengthChange = Math.abs((end.ropeLength ?? player.ropeLength) - (start.ropeLength ?? player.ropeLength));
  const forwardProgress = (end.x || player.x) - (start.x || player.x);
  return {
    reel,
    kind: reel < 0 ? 'retract' : 'extend',
    points,
    safeDuration,
    cappedSafeDuration,
    lengthChange,
    forwardProgress,
  };
}

function evaluateReelAssistCue() {
  if (!player.attached || !player.anchor || ropeShot) return null;
  if (hypot(player.vx, player.vy) < 70) return null;

  const control = inputAxisX();
  const currentReel = inputAxisY();
  const base = assistReelCandidate(currentReel, control);
  if (base.safeDuration === Infinity) return null;

  let best = null;
  for (const reel of [-1, 1]) {
    const candidate = assistReelCandidate(reel, control);
    const improvement = candidate.cappedSafeDuration - base.cappedSafeDuration;
    const effectiveChange = candidate.lengthChange >= ASSIST_REEL_MIN_LENGTH_CHANGE;
    if (!effectiveChange && improvement < ASSIST_REEL_MIN_SURVIVAL_GAIN) continue;
    if (improvement < ASSIST_REEL_MIN_SURVIVAL_GAIN) continue;
    if (candidate.safeDuration < Math.min(ASSIST_REEL_LOOKAHEAD, base.safeDuration + ASSIST_REEL_MIN_SURVIVAL_GAIN)) continue;
    if (!best || improvement > best.improvement || (improvement === best.improvement && candidate.forwardProgress > best.forwardProgress)) {
      best = { ...candidate, improvement };
    }
  }

  if (!best) return null;
  const currentDirection = Math.abs(currentReel) >= ASSIST_REEL_INPUT_DEAD_ZONE ? Math.sign(currentReel) : 0;
  if (currentDirection === Math.sign(best.reel) && Math.abs(currentReel) > 0.78) return null;

  const urgent = base.safeDuration <= ASSIST_REEL_CRITICAL_WINDOW;
  const decisiveRescue = best.safeDuration === Infinity || best.improvement >= ASSIST_REEL_CRITICAL_WINDOW * 0.55;
  if (!urgent && !decisiveRescue) return null;

  const urgencyScore = 1 - clamp(base.safeDuration / ASSIST_REEL_CRITICAL_WINDOW, 0, 1);
  const rescueScore = clamp(best.improvement / ASSIST_REEL_LOOKAHEAD, 0, 1);
  const confidence = clamp(0.38 + urgencyScore * 0.36 + rescueScore * 0.28, 0, 1);
  const retract = best.kind === 'retract';
  return {
    kind: best.kind,
    label: retract ? 'retract ↑' : 'extend ↓',
    controlLabel: retract ? 'RETRACT ↑' : 'EXTEND ↓',
    ariaLabel: retract ? 'retract rope' : 'extend rope',
    assistStyle: 'reel',
    anchor: player.anchor,
    path: best.points,
    confidence,
    hazardIn: base.safeDuration,
    improvement: best.improvement,
  };
}

function evaluateReleaseAssistCue() {
  if (!player.attached || !player.anchor || hypot(player.vx, player.vy) < 110) return null;

  const anchor = assistNextForwardAnchor();
  if (!anchor) return null;

  const currentDx = anchor.x - player.x;
  const currentDy = anchor.y - player.y;
  const currentDistance = Math.max(1, hypot(currentDx, currentDy));
  const currentClosingSpeed = (currentDx * player.vx + currentDy * player.vy) / currentDistance;
  if (player.vx < 40 && currentClosingSpeed < 80) return null;

  const points = assistFreeFlightPoints(ASSIST_RELEASE_LOOKAHEAD);
  const firstHazardIndex = assistFirstHazardIndex(points);
  let best = null;

  for (let i = 1; i < points.length && i < firstHazardIndex; i += 1) {
    const point = points[i];
    if (point.t < ASSIST_RELEASE_MIN_LEAD) continue;

    const dx = anchor.x - point.x;
    const dy = anchor.y - point.y;
    const d = Math.max(1, hypot(dx, dy));
    if (d > ASSIST_RELEASE_RANGE) continue;

    const shotDuration = clamp(d / ROPE_SHOT_SPEED, ROPE_SHOT_MIN_DURATION, ROPE_SHOT_MAX_DURATION);
    const catchT = point.t + shotDuration;
    const catchIndexRaw = points.findIndex(pathPoint => pathPoint.t >= catchT);
    const catchIndex = catchIndexRaw >= 0 ? Math.max(i, catchIndexRaw) : points.length - 1;
    if (catchIndex >= firstHazardIndex) continue;

    const afterShot = assistPointAtTime(points, catchT) || point;
    const attachDistance = hypot(anchor.x - afterShot.x, anchor.y - afterShot.y);
    if (attachDistance > HOOK_RANGE + ROPE_ATTACH_GRACE - ASSIST_ATTACH_MARGIN) continue;
    if (point.vx < -160 && point.x > anchor.x - ASSIST_BACKWARD_ALLOWANCE) continue;

    const closingSpeed = (dx * point.vx + dy * point.vy) / d;
    const distanceScore = 1 - d / ASSIST_RELEASE_RANGE;
    const attachScore = 1 - attachDistance / (HOOK_RANGE + ROPE_ATTACH_GRACE);
    const forwardScore = clamp((point.vx + 220) / 840, 0, 1);
    const closingScore = clamp((closingSpeed + 380) / 1120, 0, 1);
    const timeScore = 1 - Math.abs(point.t - 0.58) / 0.82;
    const score = distanceScore * 0.34 + attachScore * 0.24 + forwardScore * 0.17 + closingScore * 0.13 + clamp(timeScore, 0, 1) * 0.06 + 0.06;
    if (score < 0.32 || (best && score <= best.score)) continue;

    const postHook = assistPostHookIsSafe(anchor, afterShot);
    if (!postHook.safe) continue;

    if (!best || score > best.score) {
      best = { score, index: catchIndex, point, catchPoint: afterShot, catchT, shotDuration, attachDistance };
    }
  }

  if (!best || best.score < 0.32) return null;
  const plan = assistReleasePlan(points, best, anchor);
  return {
    kind: 'release',
    label: 'let go!',
    controlLabel: plan.showDetailText ? `LET GO\n${plan.detail.toUpperCase()}` : 'LET GO!',
    ariaLabel: `let go: ${plan.detail}`,
    assistStyle: plan.assistStyle,
    planDetail: plan.detail,
    showDetailText: plan.showDetailText,
    anchor,
    point: best.point,
    catchPoint: best.catchPoint,
    hookDelay: plan.hookDelay,
    path: plan.path,
    confidence: clamp(best.score, 0, 1),
  };
}

function evaluateHookAssistCue() {
  if (player.attached || ropeShot) return null;
  const anchor = lockedAnchor || focusedAnchor;
  if (!anchor) return null;
  if (anchor !== lockedAnchor && anchor.x < player.x - ASSIST_BACKWARD_ALLOWANCE) return null;

  const d = hypot(anchor.x - player.x, anchor.y - player.y);
  if (d > HOOK_RANGE) return null;

  const shotDuration = clamp(d / ROPE_SHOT_SPEED, ROPE_SHOT_MIN_DURATION, ROPE_SHOT_MAX_DURATION);
  const points = assistFreeFlightPoints(shotDuration + ASSIST_HOOK_LOOKAHEAD_PAD);
  const catchIndexRaw = points.findIndex(point => point.t >= shotDuration);
  const catchIndex = catchIndexRaw >= 0 ? Math.max(1, catchIndexRaw) : points.length - 1;
  if (catchIndex >= assistFirstHazardIndex(points)) return null;

  const catchPoint = assistPointAtTime(points, shotDuration) || points[points.length - 1];
  const attachDistance = hypot(anchor.x - catchPoint.x, anchor.y - catchPoint.y);
  if (attachDistance > HOOK_RANGE + ROPE_ATTACH_GRACE - ASSIST_ATTACH_MARGIN) return null;

  const postHook = assistPostHookIsSafe(anchor, catchPoint);
  if (!postHook.safe) return null;

  const dx = anchor.x - player.x;
  const dy = anchor.y - player.y;
  const currentDistance = Math.max(1, d);
  const closingSpeed = (dx * player.vx + dy * player.vy) / currentDistance;
  const rangeScore = 1 - d / HOOK_RANGE;
  const attachScore = 1 - attachDistance / (HOOK_RANGE + ROPE_ATTACH_GRACE);
  const closingScore = clamp((closingSpeed + 520) / 1360, 0, 1);
  const confidence = rangeScore * 0.42 + attachScore * 0.36 + closingScore * 0.22;
  if (confidence < 0.24) return null;

  return {
    kind: 'hook',
    label: 'hook!',
    anchor,
    point: catchPoint,
    path: points.slice(0, catchIndex + 1),
    confidence: clamp(confidence, 0, 1),
  };
}

function assistCurrentRopePrediction() {
  if (!assistEnabled || !gameStarted || replayMode || gamePaused || gameOver) return null;
  if (!player.attached || !player.anchor) return null;

  const anchor = player.anchor;
  const control = inputAxisX();
  const reel = inputAxisY();
  const points = assistAttachedSwingPoints(anchor, player, ASSIST_ROPE_MOTION_LOOKAHEAD, control, reel);

  return {
    anchor,
    points,
    hazard: assistFirstHazardHit(points, ASSIST_ROPE_WARNING_RADIUS, ASSIST_ROPE_WARNING_LOOKAHEAD),
  };
}

function updateAssistCue() {
  if (!assistEnabled || !gameStarted || replayMode || gamePaused || gameOver) {
    assistCue = null;
    assistReelCue = null;
    syncAssistCueUi();
    return;
  }

  assistCue = player.attached ? evaluateReleaseAssistCue() : evaluateHookAssistCue();
  assistReelCue = player.attached && !assistCue ? evaluateReelAssistCue() : null;
  syncAssistCueUi();
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
    rememberPracticeReleaseCheckpoint();
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
    if (!gameOver) {
      primeGameAudio();
      playBingSound();
      togglePause();
    }
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
    playBingSound();
    retryCurrentSeed();
  } else if (gamePaused && e.code === 'KeyH') {
    e.preventDefault();
    playBingSound();
    returnToMainMenu();
  } else if (gamePaused) {
    e.preventDefault();
  } else if (gameOver && (e.code === 'Space' || e.code === 'KeyR')) {
    e.preventDefault();
    playBingSound();
    retryCurrentSeed();
  } else if (gameOver && e.code === 'KeyP') {
    e.preventDefault();
    playBingSound();
    startCrashReplay();
  } else if (gameOver && e.code === 'KeyH') {
    e.preventDefault();
    playBingSound();
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
    playSwingSound();
    collectRunCoins();

    if (isUnrecoverablyLost() || hitsObstacle() || hitsEscapeWave()) {
      die();
    }
    updateAssistCue();
  }

  anchors = anchors.filter(a => a === lockedAnchor || a === player.anchor || (ropeShot && a === ropeShot.anchor) || a.x > cameraX - 1800);
  obstacles = obstacles.filter(o => (o.x + (o.w || o.r || 0)) > cameraX - 1800);
  pruneCoins();
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
  markPracticeHook();
}

function awardRunRecordBonus() {
  if (replayMode || currentRunRecordBonus > 0 || !gameModeTracksStats()) return 0;
  if (runFinalScore < RECORD_BONUS_MIN_METERS) return 0;

  const bonus = runHadOverallRecord
    ? RECORD_OVERALL_BONUS
    : (runHadSeedRecord ? RECORD_SEED_BONUS : 0);
  if (!bonus) return 0;

  currentRunRecordBonus = bonus;
  currentRunCoinsEarned += bonus;
  addCoinBalance(bonus);
  return bonus;
}

function die() {
  if (gameOver) return;
  if (resetPracticeAfterDeath()) return;
  gamePaused = false;
  runFinalScore = refreshScoreAndRecords();
  if (!replayMode) finalizeReplayRecording();
  awardRunRecordBonus();
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

function assistCanvasColor(alpha = 1, cue = null) {
  return assistHexToRgba(assistPaletteForCue(cue).color, alpha);
}

function assistNeutralCanvasColor(alpha = 1) {
  return assistHexToRgba(colorTheme === 'dark' ? '#9aa4b2' : '#8b96a3', alpha);
}

function assistWarningCanvasColor(alpha = 1) {
  return assistHexToRgba(colorTheme === 'dark' ? '#ff6b6b' : '#dc2626', alpha);
}

function drawAssistPath(points, alpha = 0.32, cue = null) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = assistCanvasColor(alpha, cue);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([9, 10]);
  ctx.beginPath();
  ctx.moveTo(sx(points[0].x), sy(points[0].y));
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(sx(points[i].x), sy(points[i].y));
  }
  ctx.stroke();
  ctx.restore();
}

function drawAssistPulse(x, y, radius, confidence = 0.6, dashed = false, cue = null) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 10.5);
  ctx.save();
  ctx.strokeStyle = assistCanvasColor(0.42 + confidence * 0.34, cue);
  ctx.lineWidth = 3 + confidence * 2;
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(sx(x), sy(y), radius + pulse * 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.58;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 9]);
  ctx.beginPath();
  ctx.arc(sx(x), sy(y), radius + 16 + pulse * 13, -time * 1.6, Math.PI * 2 - time * 1.6);
  ctx.stroke();
  ctx.restore();
}

function drawAssistLabel(text, x, y, align = 'left', size = 25, cue = null) {
  ctx.save();
  ctx.translate(sx(x), sy(y));
  ctx.rotate(Math.sin(time * 3.1) * 0.025 - 0.06);
  ctx.font = `900 ${size}px "Comic Sans MS", "Comic Sans", "Chalkboard SE", "Comic Neue", cursive`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = PAPER;
  ctx.strokeText(text, 0, 0);
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = assistCanvasColor(1, cue);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawAssistShotLine(from, anchor, confidence = 0.6, cue = null) {
  if (!from || !anchor) return;
  ctx.save();
  ctx.strokeStyle = assistCanvasColor(0.52 + confidence * 0.22, cue);
  ctx.lineWidth = 3 + confidence * 1.5;
  ctx.lineCap = 'round';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(sx(from.x), sy(from.y));
  ctx.lineTo(sx(anchor.x), sy(anchor.y));
  ctx.stroke();
  ctx.restore();
}

function drawAssistArrow(fromX, fromY, toX, toY, confidence = 0.6, cue = null) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.max(1, hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const head = 16 + confidence * 7;
  const wing = 9 + confidence * 4;

  ctx.save();
  ctx.strokeStyle = assistCanvasColor(0.70 + confidence * 0.22, cue);
  ctx.fillStyle = assistCanvasColor(0.72 + confidence * 0.18, cue);
  ctx.lineWidth = 5 + confidence * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx(fromX), sy(fromY));
  ctx.lineTo(sx(toX), sy(toY));
  ctx.stroke();

  const leftX = toX - ux * head - uy * wing;
  const leftY = toY - uy * head + ux * wing;
  const rightX = toX - ux * head + uy * wing;
  const rightY = toY - uy * head - ux * wing;
  ctx.beginPath();
  ctx.moveTo(sx(toX), sy(toY));
  ctx.lineTo(sx(leftX), sy(leftY));
  ctx.lineTo(sx(rightX), sy(rightY));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawAssistPredictionPolyline(points, color, lineWidth, dash, startIndex = 0, endIndex = points ? points.length - 1 : -1) {
  if (!points || points.length < 2 || endIndex <= startIndex) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dash && dash.length) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(sx(points[startIndex].x), sy(points[startIndex].y));
  for (let i = startIndex + 1; i <= endIndex && i < points.length; i += 1) {
    ctx.lineTo(sx(points[i].x), sy(points[i].y));
  }
  ctx.stroke();
  ctx.restore();
}

function drawAssistRopeMotionPath(preview) {
  const points = preview && preview.points;
  if (!points || points.length < 2) return;

  const hazardIndex = preview.hazard ? preview.hazard.index : points.length - 1;
  drawAssistPredictionPolyline(
    points,
    assistNeutralCanvasColor(colorTheme === 'dark' ? 0.50 : 0.58),
    4,
    [10, 12],
    0,
    Math.max(1, hazardIndex),
  );

  if (preview.hazard) {
    const start = Math.max(0, hazardIndex - 5);
    drawAssistPredictionPolyline(
      points,
      assistWarningCanvasColor(0.86),
      5.5,
      [5, 7],
      start,
      hazardIndex,
    );
  }
}

function assistWarningTrianglePosition(hit) {
  const point = hit && hit.point;
  const hazard = hit && hit.hazard;
  if (!point) return null;

  let x = point.x;
  let y = point.y - ASSIST_ROPE_WARNING_RADIUS - 34;
  const hitbox = hazard && hazard.hitbox;
  if (hitbox && hitbox.shape === 'circle') {
    x = hitbox.x;
    y = hitbox.y - hitbox.r - 34;
  } else if (hitbox && hitbox.kind === 'terrain' && typeof terrainYAt === 'function') {
    y = Math.min(y, terrainYAt(point.x) - 42);
  }
  return { x, y };
}

function drawAssistWarningTriangle(hit) {
  const pos = assistWarningTrianglePosition(hit);
  if (!pos) return;

  const pulse = 0.5 + 0.5 * Math.sin(time * 11.5);
  const size = 24 + pulse * 4;
  ctx.save();
  ctx.translate(sx(pos.x), sy(pos.y));
  ctx.rotate(Math.sin(time * 8.2) * 0.035);

  ctx.fillStyle = assistWarningCanvasColor(0.16 + pulse * 0.08);
  ctx.strokeStyle = assistWarningCanvasColor(0.95);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.78);
  ctx.lineTo(size * 0.86, size * 0.70);
  ctx.lineTo(-size * 0.86, size * 0.70);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 5.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.28);
  ctx.lineTo(0, size * 0.18);
  ctx.stroke();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(0, size * 0.43, 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = assistWarningCanvasColor(0.98);
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.28);
  ctx.lineTo(0, size * 0.18);
  ctx.stroke();
  ctx.fillStyle = assistWarningCanvasColor(0.98);
  ctx.beginPath();
  ctx.arc(0, size * 0.43, 3.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAssistRopePrediction() {
  const preview = assistCurrentRopePrediction();
  if (!preview) return;
  drawAssistRopeMotionPath(preview);
  if (preview.hazard) drawAssistWarningTriangle(preview.hazard);
}

function drawAssistReelCue() {
  if (!currentAssistReelCueKind()) return;
  const cue = assistReelCue;
  const anchor = cue.anchor || player.anchor;
  if (!anchor) return;

  const confidence = cue.confidence ?? 0.5;
  drawAssistPath(cue.path, 0.14 + confidence * 0.12, cue);
  drawAssistPulse(player.x, player.y, 25, confidence, true, cue);

  const dx = player.x - anchor.x;
  const dy = player.y - anchor.y;
  const d = Math.max(1, hypot(dx, dy));
  const outwardX = dx / d;
  const outwardY = dy / d;
  const direction = cue.kind === 'retract' ? -1 : 1;
  const dirX = outwardX * direction;
  const dirY = outwardY * direction;
  const pulse = 0.5 + 0.5 * Math.sin(time * 9.5);
  const startX = player.x + dirX * 8;
  const startY = player.y + dirY * 8;
  const endX = player.x + dirX * (70 + confidence * 24 + pulse * 10);
  const endY = player.y + dirY * (70 + confidence * 24 + pulse * 10);
  drawAssistArrow(startX, startY, endX, endY, confidence, cue);

  const labelAlign = dirX < -0.2 ? 'right' : 'left';
  const labelPad = labelAlign === 'left' ? 18 : -18;
  drawAssistLabel(cue.label, endX + labelPad, endY - 18, labelAlign, 25, cue);
}

function drawAssistCue() {
  drawAssistRopePrediction();
  drawAssistReelCue();
  if (!currentAssistCueKind()) return;
  const cue = assistCue;
  const anchor = cue.anchor;
  const confidence = cue.confidence ?? 0.5;
  if (!anchor) return;

  ctx.save();
  if (cue.kind === 'release') {
    drawAssistPath(cue.path, 0.24 + confidence * 0.2, cue);
    drawAssistPulse(player.x, player.y, 29, confidence, true, cue);
    drawAssistPulse(anchor.x, anchor.y, 23, confidence, true, cue);
    if (cue.point) {
      drawAssistShotLine(cue.point, anchor, confidence, cue);
      drawAssistPulse(cue.point.x, cue.point.y, 15, confidence * 0.8, false, cue);
    }
    drawAssistLabel(cue.label, player.x + 36, player.y - 42, 'left', 25, cue);
    if (cue.showDetailText && cue.planDetail) {
      drawAssistLabel(cue.planDetail, player.x + 42, player.y - 14, 'left', 18, cue);
    }
  } else if (cue.kind === 'hook') {
    const hand = hookHandPosition();
    ctx.strokeStyle = assistCanvasColor(0.74 + confidence * 0.22, cue);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.setLineDash([15, 8]);
    ctx.beginPath();
    ctx.moveTo(sx(hand.x), sy(hand.y));
    ctx.lineTo(sx(anchor.x), sy(anchor.y));
    ctx.stroke();
    ctx.setLineDash([]);
    drawAssistPath(cue.path, 0.16 + confidence * 0.12);
    drawAssistPulse(anchor.x, anchor.y, 25, confidence, false);
    drawAssistLabel(cue.label, anchor.x + 28, anchor.y - 40);
  }
  ctx.restore();
}

function setViewportTransform() {
  ctx.setTransform(DPR * viewportScale, 0, 0, DPR * viewportScale, DPR * viewportX, DPR * viewportY);
}

function setWorldTransform() {
  ctx.setTransform(DPR * viewportScale * cameraZoom, 0, 0, DPR * viewportScale * cameraZoom, DPR * viewportX, DPR * viewportY);
}

function draw() {
  if (gameShellEl) gameShellEl.classList.toggle('is-replaying', replayMode);
  syncAssistCueUi();

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
  drawCoins();
  drawAnchors();
  drawAssistCue();
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
  updateSawSound(dt);
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
    'drawCoins',
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
      counts: { anchors: anchors.length, obstacles: obstacles.length, coins: coins.length, collectedCoins: collectedCoinIds.size, terrainKnots: terrainKnots.length, terrainPools: terrainPools.length },
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
