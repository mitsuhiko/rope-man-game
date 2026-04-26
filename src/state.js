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
const crashMainMenuEl = document.getElementById('crash-main-menu');
const crashRecordEl = document.getElementById('crash-record');
const crashStatsEl = document.getElementById('crash-stats');
const crashHelpEl = document.getElementById('crash-help');
const AUDIO_FILES = {
  gameOver: { url: 'game-over.wav', volume: 0.72 },
  hook: { url: 'hook-swoosh.wav', volume: 1 },
  hookRelease: { url: 'hook-release.wav', volume: 1 },
};
const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

const INK = '#111111';
const PAPER = '#fffdf7';
const ROPE = '#8b5a2b';
const SPIKE = '#d82424';
const LAVA = '#ff6a21';
const LAVA_LINE = '#b83d12';
const WATER = '#2f9bff';
const WATER_LINE = '#1668ad';
const SAW = '#b9b9b9';
const BG1 = '#eeeeee';
const BG2 = '#dddddd';
const BEST_SCORE_KEY = 'ropeManOverallBestMetersV1';
const LEGACY_BEST_SCORE_KEY = 'ropeDashBestMetersV2';
const SEED_STATS_KEY = 'ropeManSeedStatsV1';
const CHARACTER_APPEARANCE_KEY = 'ropeManCharacterAppearanceV1';
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

const initialSearchParams = new URLSearchParams(window.location.search);
const requestedSeedValue = seedValueFromText(initialSearchParams.get(SEED_PARAM));
const hasRequestedSeed = requestedSeedValue !== null;
let gameSeedValue = requestedSeedValue ?? randomSeedValue();
let gameSeedText = seedTextFromValue(gameSeedValue);
let rngState = gameSeedValue;
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
  updateRecordsForScore(scoreMeters);
  updateScoreHud();
  return scoreMeters;
}

function setGameSeed(seedValue, options = {}) {
  const { writeUrl = true } = options;
  gameSeedValue = normalizeSeedValue(seedValue);
  gameSeedText = seedTextFromValue(gameSeedValue);
  rngState = gameSeedValue;
  syncCurrentSeedStats();
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

function random() {
  let x = rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rngState = normalizeSeedValue(x);
  return rngState / 0x100000000;
}

const rand = (a, b) => a + random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hypot = Math.hypot;
