// Shared game state, constants, seeded RNG, and viewport setup.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const seedBestEl = document.getElementById('seed-best');
const attemptsEl = document.getElementById('attempts');
const seedEl = document.getElementById('seed');
const gameShellEl = document.querySelector('.game-shell');
const startScreenEl = document.getElementById('start-screen');
const startMainPanelEl = document.getElementById('start-main-panel');
const startRandomEl = document.getElementById('start-random');
const startSeedFormEl = document.getElementById('start-seed-form');
const startSeedInputEl = document.getElementById('start-seed-input');
const startSeedSubmitEl = document.getElementById('start-seed-submit');
const startSeedErrorEl = document.getElementById('start-seed-error');
const startCustomizeOpenEl = document.getElementById('start-customize-open');
const startCustomizeCloseEl = document.getElementById('start-customize-close');
const startSoundToggleEl = document.getElementById('start-sound-toggle');
const startThemeToggleEl = document.getElementById('start-theme-toggle');
const startScoresOpenEl = document.getElementById('start-scores-open');
const startScoresMenuEl = document.getElementById('start-scores-menu');
const startScoresCloseEl = document.getElementById('start-scores-close');
const startScoresByScoreEl = document.getElementById('start-scores-by-score');
const startScoresByAttemptsEl = document.getElementById('start-scores-by-attempts');
const startScoresListEl = document.getElementById('start-scores-list');
const startCustomizationMenuEl = document.getElementById('start-customization-menu');
const startHatGridEl = document.getElementById('start-hat-grid');
const startCharacterSelectionEl = document.getElementById('start-character-selection');
const touchControlsEl = document.querySelector('.touch-controls');
const touchActionEl = document.getElementById('touch-action');
const touchJoystickEl = document.getElementById('touch-joystick');
const touchStickEl = document.getElementById('touch-stick');
const crashActionsEl = document.getElementById('crash-actions');
const crashTitleEl = document.getElementById('crash-title');
const crashContinueEl = document.getElementById('crash-continue');
const crashRetryEl = document.getElementById('crash-retry');
const crashReplayEl = document.getElementById('crash-replay');
const crashMainMenuEl = document.getElementById('crash-main-menu');
const crashRecordEl = document.getElementById('crash-record');
const crashStatsEl = document.getElementById('crash-stats');
const crashHelpEl = document.getElementById('crash-help');
const AUDIO_FILES = {
  gameOver: { url: 'assets/game-over.mp3', volume: 0.72 },
  hook: { url: 'assets/hook-swoosh.wav', volume: 1 },
  hookRelease: { url: 'assets/hook-release.wav', volume: 1 },
};
const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

const THEME_PALETTES = {
  light: {
    INK: '#111111',
    PAPER: '#fffdf7',
    ROPE: '#8b5a2b',
    SPIKE: '#d82424',
    LAVA: '#ff6a21',
    LAVA_LINE: '#b83d12',
    WATER: '#2f9bff',
    WATER_LINE: '#1668ad',
    SAW: '#b9b9b9',
    BG1: '#eeeeee',
    BG2: '#dddddd',
    MUTED_LINE: '#777777',
    FAINT_LINE: '#bbbbbb',
  },
  dark: {
    INK: '#fff3df',
    PAPER: '#111116',
    ROPE: '#df9f56',
    SPIKE: '#ff526a',
    LAVA: '#ff8738',
    LAVA_LINE: '#b84b20',
    WATER: '#59c9ff',
    WATER_LINE: '#1b7aa8',
    SAW: '#8f939b',
    BG1: '#2a2831',
    BG2: '#383541',
    MUTED_LINE: '#8f877b',
    FAINT_LINE: '#5e5965',
  },
};
let INK = THEME_PALETTES.light.INK;
let PAPER = THEME_PALETTES.light.PAPER;
let ROPE = THEME_PALETTES.light.ROPE;
let SPIKE = THEME_PALETTES.light.SPIKE;
let LAVA = THEME_PALETTES.light.LAVA;
let LAVA_LINE = THEME_PALETTES.light.LAVA_LINE;
let WATER = THEME_PALETTES.light.WATER;
let WATER_LINE = THEME_PALETTES.light.WATER_LINE;
let SAW = THEME_PALETTES.light.SAW;
let BG1 = THEME_PALETTES.light.BG1;
let BG2 = THEME_PALETTES.light.BG2;
let MUTED_LINE = THEME_PALETTES.light.MUTED_LINE;
let FAINT_LINE = THEME_PALETTES.light.FAINT_LINE;
const BEST_SCORE_KEY = 'ropeManOverallBestMetersV1';
const LEGACY_BEST_SCORE_KEY = 'ropeDashBestMetersV2';
const SEED_STATS_KEY = 'ropeManSeedStatsV1';
const CHARACTER_APPEARANCE_KEY = 'ropeManCharacterAppearanceV1';
const SOUND_ENABLED_KEY = 'ropeManSoundEnabledV1';
const COLOR_THEME_KEY = 'ropeManColorThemeV1';
const CAMERA_ZOOM_LEVEL_KEY = 'ropeManCameraZoomLevelV1';
const SEED_PARAM = 'seed';
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_SEED_TEXT_LENGTH = 6;
const MAX_SEED_VALUE = 0xffffffff;
const DEFAULT_RNG_SEED = 0x6d2b79f5;

function normalizeSeedValue(value) {
  value >>>= 0;
  return value || DEFAULT_RNG_SEED;
}

function parseSeedText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { value: null, text: '', error: 'enter a seed first' };
  }
  if (trimmed.length > MAX_SEED_TEXT_LENGTH) {
    return { value: null, text: trimmed, error: `use ${MAX_SEED_TEXT_LENGTH} letters/numbers or fewer` };
  }

  let value = 0;
  for (const ch of trimmed) {
    const digit = BASE62_ALPHABET.indexOf(ch);
    if (digit < 0) {
      return { value: null, text: trimmed, error: 'use only letters and numbers' };
    }
    value = value * 62 + digit;
    if (value > MAX_SEED_VALUE) {
      return { value: null, text: trimmed, error: 'that seed is too large' };
    }
  }
  if (value === 0) {
    return { value: null, text: trimmed, error: 'seed cannot be all zeroes' };
  }

  value = normalizeSeedValue(value);
  return { value, text: seedTextFromValue(value), error: '' };
}

function seedValueFromText(text) {
  return parseSeedText(text).value;
}

function validateSeedText(text) {
  return parseSeedText(text);
}

function seedTextFromValue(value) {
  value = normalizeSeedValue(value);
  let text = '';
  do {
    text = BASE62_ALPHABET[value % 62] + text;
    value = Math.floor(value / 62);
  } while (value > 0);
  return text;
}

function randomSeedValue() {
  const values = new Uint32Array(1);
  if (window.crypto && window.crypto.getRandomValues) {
    do {
      window.crypto.getRandomValues(values);
    } while (values[0] === 0);
    return values[0] >>> 0;
  }
  return normalizeSeedValue((Date.now() ^ Math.floor(performance.now() * 1000000)) >>> 0);
}

function writeSeedToUrl(seedText) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(SEED_PARAM) === seedText) return;
    url.searchParams.set(SEED_PARAM, seedText);
    window.history.replaceState(null, '', url.toString());
  } catch (_) {
    // Ignore URL/history failures, e.g. unusual embedded browser contexts.
  }
}

function readStorageNumber(key) {
  try {
    const value = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch (_) {
    return 0;
  }
}

function writeStorageNumber(key, value) {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
  } catch (_) {
    // Ignore private-mode/quota storage failures.
  }
}

function readStorageJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Ignore private-mode/quota storage failures.
  }
}

function readStorageBoolean(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch (_) {
    return fallback;
  }
}

function writeStorageBoolean(key, value) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false');
  } catch (_) {
    // Ignore private-mode/quota storage failures.
  }
}

function readColorThemePreference() {
  try {
    return localStorage.getItem(COLOR_THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (_) {
    return 'light';
  }
}

function writeColorThemePreference(theme) {
  try {
    localStorage.setItem(COLOR_THEME_KEY, theme);
  } catch (_) {
    // Ignore private-mode/quota storage failures.
  }
}

function applyVisualTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  const palette = THEME_PALETTES[nextTheme];
  INK = palette.INK;
  PAPER = palette.PAPER;
  ROPE = palette.ROPE;
  SPIKE = palette.SPIKE;
  LAVA = palette.LAVA;
  LAVA_LINE = palette.LAVA_LINE;
  WATER = palette.WATER;
  WATER_LINE = palette.WATER_LINE;
  SAW = palette.SAW;
  BG1 = palette.BG1;
  BG2 = palette.BG2;
  MUTED_LINE = palette.MUTED_LINE;
  FAINT_LINE = palette.FAINT_LINE;
  document.documentElement.dataset.theme = nextTheme;
  if (document.body) document.body.dataset.theme = nextTheme;
}

function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  writeStorageBoolean(SOUND_ENABLED_KEY, soundEnabled);
  if (!soundEnabled && typeof stopGameOverSound === 'function') stopGameOverSound();
  if (typeof updateStartSettingsUi === 'function') updateStartSettingsUi();
}

function setColorTheme(theme) {
  colorTheme = theme === 'dark' ? 'dark' : 'light';
  applyVisualTheme(colorTheme);
  writeColorThemePreference(colorTheme);
  if (typeof updateStartSettingsUi === 'function') updateStartSettingsUi();
}

function loadOverallBestMeters() {
  return Math.max(readStorageNumber(BEST_SCORE_KEY), readStorageNumber(LEGACY_BEST_SCORE_KEY));
}

function loadSeedStats() {
  const rawStats = readStorageJson(SEED_STATS_KEY, {});
  const stats = {};
  if (!rawStats || typeof rawStats !== 'object') return stats;

  for (const [seed, raw] of Object.entries(rawStats)) {
    if (!/^[0-9A-Za-z]{1,6}$/.test(seed)) continue;
    const bestValue = typeof raw === 'number' ? raw : raw && raw.best;
    const attemptsValue = raw && typeof raw === 'object' ? raw.attempts : 0;
    const bestMeters = Number(bestValue);
    const attempts = Number(attemptsValue);
    stats[seed] = {
      best: Number.isFinite(bestMeters) && bestMeters > 0 ? Math.floor(bestMeters) : 0,
      attempts: Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 0,
    };
  }
  return stats;
}

function loadCharacterAppearance() {
  const raw = readStorageJson(CHARACTER_APPEARANCE_KEY, {});
  return {
    hat: raw && typeof raw.hat === 'string' ? raw.hat : null,
    backpack: Boolean(raw && raw.backpack),
  };
}

function saveCharacterAppearance() {
  writeStorageJson(CHARACTER_APPEARANCE_KEY, characterAppearance);
}

let soundEnabled = readStorageBoolean(SOUND_ENABLED_KEY, true);
let colorTheme = readColorThemePreference();
applyVisualTheme(colorTheme);

const initialSearchParams = new URLSearchParams(window.location.search);
const requestedSeedValue = seedValueFromText(initialSearchParams.get(SEED_PARAM));
const hasRequestedSeed = requestedSeedValue !== null;
let gameSeedValue = requestedSeedValue ?? randomSeedValue();
let gameSeedText = seedTextFromValue(gameSeedValue);
let rngState = gameSeedValue;
let backgroundRngState = gameSeedValue;
let gameStarted = false;
let scoreMeters = 0;
let best = loadOverallBestMeters();
let seedStats = loadSeedStats();
let seedBest = 0;
let seedAttempts = 0;
let runStartBest = best;
let runStartSeedBest = 0;
let runHadOverallRecord = false;
let runHadSeedRecord = false;
let runFinalScore = 0;

function currentSeedStats() {
  const raw = seedStats[gameSeedText];
  if (!raw || typeof raw !== 'object') return { best: 0, attempts: 0 };
  return {
    best: Number.isFinite(Number(raw.best)) && Number(raw.best) > 0 ? Math.floor(Number(raw.best)) : 0,
    attempts: Number.isFinite(Number(raw.attempts)) && Number(raw.attempts) > 0 ? Math.floor(Number(raw.attempts)) : 0,
  };
}

function syncCurrentSeedStats() {
  const stats = currentSeedStats();
  seedBest = stats.best;
  seedAttempts = stats.attempts;
}

function persistCurrentSeedStats() {
  seedStats[gameSeedText] = { best: seedBest, attempts: seedAttempts };
  writeStorageJson(SEED_STATS_KEY, seedStats);
}

function updateScoreHud() {
  if (scoreEl) scoreEl.textContent = scoreMeters;
  if (bestEl) bestEl.textContent = best;
  if (seedBestEl) seedBestEl.textContent = seedBest;
  if (attemptsEl) attemptsEl.textContent = seedAttempts;
  if (seedEl) seedEl.textContent = gameSeedText;
}

function beginSeedAttempt() {
  syncCurrentSeedStats();
  seedAttempts += 1;
  runStartBest = best;
  runStartSeedBest = seedBest;
  runHadOverallRecord = false;
  runHadSeedRecord = false;
  runFinalScore = 0;
  persistCurrentSeedStats();
  updateScoreHud();
}

function updateRecordsForScore(meters) {
  const score = Math.max(0, Math.floor(meters));
  if (score > best) {
    best = score;
    runHadOverallRecord = score > runStartBest;
    writeStorageNumber(BEST_SCORE_KEY, best);
  }
  if (score > seedBest) {
    seedBest = score;
    runHadSeedRecord = score > runStartSeedBest;
    persistCurrentSeedStats();
  }
}

function refreshScoreAndRecords() {
  furthestX = Math.max(furthestX, player.x);
  scoreMeters = Math.max(0, Math.floor((furthestX - scoreStartX) / WORLD_PX_PER_METER));
  if (!replayMode) updateRecordsForScore(scoreMeters);
  updateScoreHud();
  return scoreMeters;
}

function setGameSeed(seedValue, options = {}) {
  const { writeUrl = true } = options;
  const previousSeedValue = gameSeedValue;
  gameSeedValue = normalizeSeedValue(seedValue);
  gameSeedText = seedTextFromValue(gameSeedValue);
  rngState = gameSeedValue;
  backgroundRngState = gameSeedValue;
  syncCurrentSeedStats();
  if (previousSeedValue !== gameSeedValue && typeof clearReplayHistory === 'function') {
    clearReplayHistory();
  }
  if (writeUrl) writeSeedToUrl(gameSeedText);
  updateScoreHud();
}

setGameSeed(gameSeedValue, { writeUrl: hasRequestedSeed });
if (startSeedInputEl) {
  startSeedInputEl.placeholder = gameSeedText;
  startSeedInputEl.value = gameSeedText;
}

const W = 1280;
const H = 720;
const CAMERA_ZOOM_LEVELS = [1, 0.75, 0.55];
let cameraZoomLevel = normalizeCameraZoomLevel(readStorageNumber(CAMERA_ZOOM_LEVEL_KEY));
let cameraZoom = CAMERA_ZOOM_LEVELS[cameraZoomLevel];
const BACKGROUND_SHAPE_COUNT = 80;

function normalizeCameraZoomLevel(level) {
  const count = CAMERA_ZOOM_LEVELS.length;
  const value = Number(level);
  const index = Number.isFinite(value) ? Math.floor(value) : 0;
  return ((index % count) + count) % count;
}

function cameraViewW() {
  return W / cameraZoom;
}

function cameraViewH() {
  return H / cameraZoom;
}

function setCameraZoomLevel(level) {
  const nextLevel = normalizeCameraZoomLevel(level);
  const nextZoom = CAMERA_ZOOM_LEVELS[nextLevel] || 1;
  if (nextLevel === cameraZoomLevel && nextZoom === cameraZoom) return;

  const previousZoom = cameraZoom;
  cameraZoomLevel = nextLevel;
  cameraZoom = nextZoom;
  writeStorageNumber(CAMERA_ZOOM_LEVEL_KEY, cameraZoomLevel);

  if (gameStarted) {
    const playerScreenX = (player.x - cameraX) * previousZoom;
    const playerScreenY = (player.y - cameraY) * previousZoom;
    cameraX = player.x - playerScreenX / cameraZoom;
    cameraY = player.y - playerScreenY / cameraZoom;
    cameraVX = 0;
    cameraVY = 0;
    if (typeof generateUntil === 'function') {
      generateUntil(Math.max(cameraX + cameraViewW() * 2.8, player.x + cameraViewW() * 2.8));
    }
  }
}

function cycleCameraZoom() {
  setCameraZoomLevel(cameraZoomLevel + 1);
}

// Legacy shared-RNG background seeding used one random x plus six cosmetic
// properties per shape before any terrain/anchor generation happened.
const BACKGROUND_RANDOMS_PER_SHAPE = 7;
const LEGACY_INITIAL_BACKGROUND_RANDOM_CALLS = BACKGROUND_SHAPE_COUNT * BACKGROUND_RANDOMS_PER_SHAPE;
const INITIAL_WORLD_GENERATION_X = W * 2.6;
const WORLD_GENERATION_CHUNK = 256;
let screenW = 0;
let screenH = 0;
let viewportScale = 1;
let viewportX = 0;
let viewportY = 0;
let DPR = 1;
let last = 0;
let time = 0;
let cameraX = 0;
let cameraY = 0;
let cameraVX = 0;
let cameraVY = 0;
let gameOver = false;
let gamePaused = false;
const REPLAY_FORMAT_VERSION = 1;
let replayMode = false;
let activeReplayRecording = null;
let activeReplayPlayback = null;
let replayInputOverride = null;
let seedCrashReplays = [];
let lastCrashReplay = null;
let gameAudioPrimed = false;
let audioContext = null;
let audioLoadStarted = false;
let currentGameOverSource = null;
const audioBuffers = {};
let furthestX = 0;
let scoreStartX = 0;
const DEBUG_HITBOXES = initialSearchParams.get('debug') === '1';

const GRAVITY = 1500;
const HOOK_RANGE = 720;
const FOCUS_MIN_MOMENTUM_SPEED = 80;
const FOCUS_FULL_BIAS_SPEED = 950;
const FOCUS_DIRECTION_BIAS = 120;
const FOCUS_STICKY_DISTANCE = 35;
const FOCUS_RELEASE_DISTANCE = 45;
const FOCUS_RECENT_ANCHOR_PENALTY = 360;
const FOCUS_RECENT_ANCHOR_DURATION = 1.4;
const FOCUS_RECENT_ANCHOR_DISTANCE = 520;
const FOCUS_OUT_OF_RANGE_WEIGHT = 0.7;
const LOST_BELOW_Y = 1500;
const ROPE_SHOT_SPEED = 1200;
const ROPE_SHOT_MIN_DURATION = 0.14;
const ROPE_SHOT_MAX_DURATION = 0.42;
const ROPE_ATTACH_GRACE = 70;
const SWING_ACCEL = 1050;
const AIR_ACCEL = 620;
const ROPE_REEL_SPEED = 230;
const PLAYER_RADIUS = 15;
// Score is shown in meters. Calibrate world pixels from the stickman's
// approximate head-to-foot height instead of treating 10px as 1m.
const PLAYER_HEIGHT_METERS = 1.7;
const PLAYER_VISUAL_HEIGHT_PX = 124;
const WORLD_PX_PER_METER = PLAYER_VISUAL_HEIGHT_PX / PLAYER_HEIGHT_METERS;
const ANCHOR_TERRAIN_CLEARANCE_METERS = 3.6;
const ANCHOR_TERRAIN_CLEARANCE = ANCHOR_TERRAIN_CLEARANCE_METERS * WORLD_PX_PER_METER;
const ANCHOR_GATE_HORIZONTAL_CLEARANCE = 220;
const ANCHOR_GATE_BOTTOM_CLEARANCE = 190;
const ANCHOR_LIQUID_HORIZONTAL_CLEARANCE = 160;
const ANCHOR_LIQUID_VERTICAL_CLEARANCE = 205;
const ANCHOR_MIN_Y = -240;
const ANCHOR_BASE_MIN_Y = -30;
const ANCHOR_BASE_MAX_Y = 315;
const HOOK_ARM_REACH = 38;
const INITIAL_SPAWN_ROPE_LENGTH = 150;
const INITIAL_SPAWN_ANGLE = 0.10;
const MIN_ROPE = 55;
const MAX_ROPE = 780;
const GATE_EXTENT = 2400;
const TERRAIN_STEP = 18;
const TERRAIN_KNOT_MIN = 280;
const TERRAIN_KNOT_MAX = 540;
const TERRAIN_BUFFER = 1600;
const TERRAIN_DROP = 100;
const TERRAIN_MIN_Y = H * 0.55 + TERRAIN_DROP;
const TERRAIN_MAX_Y = H - 48 + TERRAIN_DROP;
const TERRAIN_POOL_MIN_W = 420;
const TERRAIN_POOL_MAX_W = 980;
const TERRAIN_POOL_STEP = 18;
const TERRAIN_POOL_SCAN_STEP = 28;
const SPIKE_GROUND_INSET = 4;
const JOYSTICK_DEAD_ZONE = 0.26;

const player = {
  x: 150,
  y: 260,
  vx: 0,
  vy: 0,
  attached: true,
  anchor: null,
  ropeLength: 190,
  angle: 0,
  angularVelocity: 0,
  alive: true,
  runPhase: 0,
};

const ragdoll = {
  initialized: false,
  joints: {},
  visualSide: 1,
};

const hookArm = {
  initialized: false,
  x: 0,
  y: 0,
  ox: 0,
  oy: 0,
};

const characterAppearance = loadCharacterAppearance();

let anchors = [];
let obstacles = [];
let bgShapes = [];
let terrainKnots = [];
let terrainPools = [];
let terrainCursorX = 0;
let terrainLastY = 0;
let nextTerrainPoolX = 0;
let nextAnchorX = 120;
let nextObstacleX = 950;
let generatedWorldX = 0;
let spawnIndex = 0;
let focusedAnchor = null;
let lockedAnchor = null;
let recentReleasedAnchor = null;
let recentReleasedAnchorAt = -Infinity;
let recentReleasedAnchorX = 0;
let recentReleasedAnchorY = 0;
let ropeShot = null;
const keys = { left: false, right: false, up: false, down: false };
const touchInput = { joystickPointerId: null, x: 0, y: 0 };

function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  screenW = Math.max(1, Math.floor(rect.width));
  screenH = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(screenW * DPR);
  canvas.height = Math.floor(screenH * DPR);

  // Fixed logical game viewport: resizing the browser changes only the
  // pixel scale, not the amount of world visible or the level geometry.
  viewportScale = Math.min(screenW / W, screenH / H);
  viewportX = (screenW - W * viewportScale) / 2;
  viewportY = (screenH - H * viewportScale) / 2;
}
window.addEventListener('resize', resize);
if ('ResizeObserver' in window) {
  new ResizeObserver(resize).observe(canvas);
}

function nextRandomState(state) {
  let x = state;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return normalizeSeedValue(x);
}

function random() {
  rngState = nextRandomState(rngState);
  return rngState / 0x100000000;
}

function backgroundRandom() {
  backgroundRngState = nextRandomState(backgroundRngState);
  return backgroundRngState / 0x100000000;
}

function skipWorldRandomCalls(count) {
  for (let i = 0; i < count; i += 1) {
    rngState = nextRandomState(rngState);
  }
}

function resetRandomStreams() {
  rngState = gameSeedValue;
  backgroundRngState = gameSeedValue;
  // Background seeding used to consume the shared world RNG before terrain,
  // obstacles, and anchors were generated. Keep that initial offset so the
  // existing seed maps stay aligned, then keep scrolling background cosmetics
  // on their own stream so camera/input timing cannot perturb the world map.
  skipWorldRandomCalls(LEGACY_INITIAL_BACKGROUND_RANDOM_CALLS);
}

const rand = (a, b) => a + random() * (b - a);
const backgroundRand = (a, b) => a + backgroundRandom() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hypot = Math.hypot;
