// Shared game state, constants, seeded RNG, and viewport setup.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const coinBalanceEl = document.getElementById('coin-balance');
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
const startModeSelectWrapEl = document.getElementById('start-mode-select-wrap');
const startCustomizeOpenEl = document.getElementById('start-customize-open');
const startCustomizeCloseEl = document.getElementById('start-customize-close');
const startSoundToggleEl = document.getElementById('start-sound-toggle');
const startThemeToggleEl = document.getElementById('start-theme-toggle');
const startAssistToggleEl = document.getElementById('start-assist-toggle');
const startScoresOpenEl = document.getElementById('start-scores-open');
const startScoresMenuEl = document.getElementById('start-scores-menu');
const startScoresCloseEl = document.getElementById('start-scores-close');
const startScoresByScoreEl = document.getElementById('start-scores-by-score');
const startScoresByAttemptsEl = document.getElementById('start-scores-by-attempts');
const startScoresListEl = document.getElementById('start-scores-list');
const startScoresModeSelectWrapEl = document.getElementById('start-scores-mode-select-wrap');
const startCustomizationMenuEl = document.getElementById('start-customization-menu');
const startHatGridEl = document.getElementById('start-hat-grid');
const startColorGridEl = document.getElementById('start-color-grid');
const startColorTargetBodyEl = document.getElementById('start-color-target-body');
const startColorTargetHatEl = document.getElementById('start-color-target-hat');
const startColorTargetRopeEl = document.getElementById('start-color-target-rope');
const startCharacterSelectionEl = document.getElementById('start-character-selection');
const startWalletBalanceEl = document.getElementById('start-wallet-balance');
const startPurchasePopoverEl = document.getElementById('start-purchase-popover');
const startPurchasePreviewEl = document.getElementById('start-purchase-preview');
const startPurchaseTitleEl = document.getElementById('start-purchase-title');
const startPurchaseCopyEl = document.getElementById('start-purchase-copy');
const startPurchaseConfirmEl = document.getElementById('start-purchase-confirm');
const startPurchaseCancelEl = document.getElementById('start-purchase-cancel');
const touchControlsEl = document.querySelector('.touch-controls');
const touchPauseEl = document.getElementById('touch-pause');
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
  gameOver: { url: 'assets/game-over.mp3', volume: 0.4 },
  hook: { url: 'assets/hook-swoosh.wav', volume: 0.25 },
  hookRelease: { url: 'assets/hook-release.wav', volume: 0.25 },
  coin: { url: 'assets/coin.wav', volume: 0.7 },
  bing: { url: 'assets/bing.wav', volume: 0.3 },
  saw: { url: 'assets/saw.wav', volume: 0.5 },
  swingA: { url: 'assets/swing-a.wav', volume: 0.5 },
  swingB: { url: 'assets/swing-b.wav', volume: 0.5 },
  swingC: { url: 'assets/swing-c.wav', volume: 0.5 },
};
const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

const CHARACTER_COLOR_PALETTES = {
  black: { label: 'black', light: '#111111', dark: '#fff3df' },
  red: { label: 'red', light: '#d82424', dark: '#ff5f6d' },
  green: { label: 'green', light: '#168a3a', dark: '#54d57b' },
  blue: { label: 'blue', light: '#1769d1', dark: '#62b5ff' },
  purple: { label: 'purple', light: '#7c3fcf', dark: '#c18cff' },
  orange: { label: 'orange', light: '#e46d12', dark: '#ff9a3d' },
  pink: { label: 'pink', light: '#d53d8c', dark: '#ff86c0' },
  teal: { label: 'teal', light: '#008b8b', dark: '#48d6cf' },
  yellow: { label: 'yellow', light: '#b98300', dark: '#ffd45a' },
  brown: { label: 'brown', light: '#8b5a2b', dark: '#df9f56' },
  gray: { label: 'gray', light: '#5f6670', dark: '#b8c0cc' },
  lime: { label: 'lime', light: '#6f9f00', dark: '#b9ef4b' },
  cyan: { label: 'cyan', light: '#007aa3', dark: '#5ee6ff' },
  magenta: { label: 'magenta', light: '#b529c8', dark: '#f08cff' },
};
const CHARACTER_COLOR_ORDER = Object.keys(CHARACTER_COLOR_PALETTES);
const DEFAULT_CHARACTER_COLOR = 'black';
const DEFAULT_ROPE_COLOR = 'brown';

const THEME_PALETTES = {
  light: {
    INK: '#111111',
    PAPER: '#fffdf7',
    ROPE: '#8b5a2b',
    SPIKE: '#6f737a',
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
    SPIKE: '#a7adb6',
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
const SEED_REPLAYS_KEY = 'ropeManSeedReplaysV1';
const LEGACY_SESSION_SEED_REPLAYS_KEY = 'ropeManSeedSessionReplaysV1';
const GAME_MODE_KEY = 'ropeManGameModeV1';
const CHARACTER_APPEARANCE_KEY = 'ropeManCharacterAppearanceV1';
const SOUND_ENABLED_KEY = 'ropeManSoundEnabledV1';
const COLOR_THEME_KEY = 'ropeManColorThemeV1';
const ASSIST_ENABLED_KEY = 'ropeManAssistEnabledV1';
const CAMERA_ZOOM_LEVEL_KEY = 'ropeManCameraZoomLevelV1';
const COIN_BALANCE_KEY = 'ropeManCoinBalanceV1';
const OWNED_HATS_KEY = 'ropeManOwnedHatsV1';
const SEED_PARAM = 'seed';
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_SEED_TEXT_LENGTH = 6;
const MAX_SEED_VALUE = 0xffffffff;
const DEFAULT_RNG_SEED = 0x6d2b79f5;
const REPLAY_FORMAT_VERSION = 1;
const GAME_MODES = {
  freeRoam: { label: 'free roam' },
  practice: { label: 'practice' },
  escapeWave: { label: 'escape the wave' },
};
const GAME_MODE_ORDER = Object.keys(GAME_MODES);
const DEFAULT_GAME_MODE = 'freeRoam';
const COIN_VALUE = 10;
const HAT_COST = 100;
const RECORD_SEED_BONUS = 50;
const RECORD_OVERALL_BONUS = 100;
const RECORD_BONUS_MIN_METERS = 60;
const DISTANCE_BONUS_METERS = 100;
const DISTANCE_BONUS_VALUE = 50;
const ESCAPE_WAVE_APPEAR_DELAY = 1.45;
const ESCAPE_WAVE_CATCHUP_RAMP = 1.8;
const ESCAPE_WAVE_BASE_SPEED = 132;
const ESCAPE_WAVE_ACCEL = 4.64;
const ESCAPE_WAVE_MAX_SPEED = 448;

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

function normalizeOwnedHatIds(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return new Set(list.filter(hatId => typeof hatId === 'string' && /^[a-z0-9-]+$/.test(hatId)));
}

function readOwnedHatIds() {
  return normalizeOwnedHatIds(readStorageJson(OWNED_HATS_KEY, []));
}

function writeOwnedHatIds() {
  writeStorageJson(OWNED_HATS_KEY, Array.from(ownedHatIds).sort());
}

function hatExists(hatId) {
  return Boolean(hatId && typeof CHARACTER_HATS !== 'undefined' && CHARACTER_HATS[hatId]);
}

function hatIsOwned(hatId) {
  return !hatId || ownedHatIds.has(hatId);
}

function canAffordHat(hatId) {
  return Boolean(hatExists(hatId) && !hatIsOwned(hatId) && coinBalance >= HAT_COST);
}

function updateWalletUi() {
  if (coinBalanceEl) coinBalanceEl.textContent = coinBalance;
  if (startWalletBalanceEl) startWalletBalanceEl.textContent = coinBalance;
  if (typeof syncCustomizationUi === 'function') syncCustomizationUi();
}

function addCoinBalance(amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return;
  coinBalance += value;
  writeStorageNumber(COIN_BALANCE_KEY, coinBalance);
  updateWalletUi();
}

function tryPurchaseHat(hatId) {
  if (!canAffordHat(hatId)) return false;
  coinBalance = Math.max(0, coinBalance - HAT_COST);
  ownedHatIds.add(hatId);
  writeStorageNumber(COIN_BALANCE_KEY, coinBalance);
  writeOwnedHatIds();
  updateWalletUi();
  return true;
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
  if (!soundEnabled && typeof stopSawSound === 'function') stopSawSound(true);
  if (typeof updateStartSettingsUi === 'function') updateStartSettingsUi();
}

function setColorTheme(theme) {
  colorTheme = theme === 'dark' ? 'dark' : 'light';
  applyVisualTheme(colorTheme);
  applyCustomRopeColor();
  writeColorThemePreference(colorTheme);
  if (typeof updateStartSettingsUi === 'function') updateStartSettingsUi();
}

function setAssistEnabled(enabled) {
  assistEnabled = Boolean(enabled);
  writeStorageBoolean(ASSIST_ENABLED_KEY, assistEnabled);
  if (!assistEnabled && typeof assistCue !== 'undefined') assistCue = null;
  if (!assistEnabled && typeof assistReelCue !== 'undefined') assistReelCue = null;
  if (typeof updateStartSettingsUi === 'function') updateStartSettingsUi();
  if (typeof syncAssistCueUi === 'function') syncAssistCueUi();
}

function loadOverallBestMeters() {
  return Math.max(readStorageNumber(BEST_SCORE_KEY), readStorageNumber(LEGACY_BEST_SCORE_KEY));
}

function normalizeGameMode(mode) {
  return mode && GAME_MODES[mode] ? mode : DEFAULT_GAME_MODE;
}

function gameModeLabel(mode = gameMode) {
  const spec = GAME_MODES[normalizeGameMode(mode)];
  return spec && spec.label ? spec.label : normalizeGameMode(mode);
}

function gameModeTracksStats(mode = gameMode) {
  return normalizeGameMode(mode) !== 'practice';
}

function currentRunTracksHighScores() {
  return gameModeTracksStats() && !assistEnabled;
}

function readGameModePreference() {
  try {
    return normalizeGameMode(localStorage.getItem(GAME_MODE_KEY));
  } catch (_) {
    return DEFAULT_GAME_MODE;
  }
}

function writeGameModePreference(mode) {
  try {
    localStorage.setItem(GAME_MODE_KEY, normalizeGameMode(mode));
  } catch (_) {
    // Ignore private-mode/quota storage failures.
  }
}

function emptySeedStatsByMode() {
  const stats = {};
  for (const mode of GAME_MODE_ORDER) stats[mode] = {};
  return stats;
}

function normalizeSeedStatsRecord(rawStats) {
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

function rankedSeedStatEntries(mode = gameMode, sortMode = 'score', limit = 20) {
  if (!gameModeTracksStats(mode)) return [];
  const statsForMode = seedStatsByMode[normalizeGameMode(mode)] || {};
  return Object.entries(statsForMode)
    .map(([seed, raw]) => ({
      seed,
      best: Math.max(0, Math.floor(Number(raw && raw.best) || 0)),
      attempts: Math.max(0, Math.floor(Number(raw && raw.attempts) || 0)),
    }))
    .filter((entry) => entry.best > 0 || entry.attempts > 0)
    .sort((a, b) => {
      if (sortMode === 'attempts') {
        return (b.attempts - a.attempts) || (b.best - a.best) || a.seed.localeCompare(b.seed);
      }
      return (b.best - a.best) || (b.attempts - a.attempts) || a.seed.localeCompare(b.seed);
    })
    .slice(0, limit);
}

function highScoreBoardSeedSet() {
  const seeds = new Set();
  for (const mode of GAME_MODE_ORDER) {
    if (!gameModeTracksStats(mode)) continue;
    for (const entry of rankedSeedStatEntries(mode, 'score')) seeds.add(`${mode}:${entry.seed}`);
    for (const entry of rankedSeedStatEntries(mode, 'attempts')) seeds.add(`${mode}:${entry.seed}`);
  }
  return seeds;
}

function loadSeedStatsByMode() {
  const rawStats = readStorageJson(SEED_STATS_KEY, {});
  const statsByMode = emptySeedStatsByMode();
  if (!rawStats || typeof rawStats !== 'object') return statsByMode;

  const looksModeScoped = GAME_MODE_ORDER.some((mode) => rawStats[mode] && typeof rawStats[mode] === 'object');
  if (looksModeScoped) {
    for (const mode of GAME_MODE_ORDER) statsByMode[mode] = normalizeSeedStatsRecord(rawStats[mode]);
  } else {
    // Migration: all existing high scores were from the original free-roam mode.
    statsByMode.freeRoam = normalizeSeedStatsRecord(rawStats);
  }
  return statsByMode;
}

function overallBestForMode(mode = gameMode) {
  if (!gameModeTracksStats(mode)) return 0;
  const stats = seedStatsByMode && seedStatsByMode[normalizeGameMode(mode)] ? seedStatsByMode[normalizeGameMode(mode)] : {};
  const seedBest = Math.max(0, ...Object.values(stats).map((raw) => Math.max(0, Math.floor(Number(raw && raw.best) || 0))));
  if (normalizeGameMode(mode) === 'freeRoam') return Math.max(seedBest, loadOverallBestMeters());
  return seedBest;
}

function normalizeCharacterColorId(colorId) {
  return colorId && CHARACTER_COLOR_PALETTES[colorId] ? colorId : DEFAULT_CHARACTER_COLOR;
}

function characterColorSpec(colorId = characterAppearance.color) {
  return CHARACTER_COLOR_PALETTES[normalizeCharacterColorId(colorId)] || CHARACTER_COLOR_PALETTES[DEFAULT_CHARACTER_COLOR];
}

function characterColorForTheme(colorId = characterAppearance.color, theme = colorTheme) {
  const spec = characterColorSpec(colorId);
  return spec[theme === 'dark' ? 'dark' : 'light'] || spec.light;
}

function ropeColorForTheme(colorId = DEFAULT_ROPE_COLOR, theme = colorTheme) {
  return characterColorForTheme(normalizeCharacterColorId(colorId || DEFAULT_ROPE_COLOR), theme);
}

function applyCustomRopeColor() {
  ROPE = ropeColorForTheme(characterAppearance.ropeColor);
}

function loadCharacterAppearance() {
  const raw = readStorageJson(CHARACTER_APPEARANCE_KEY, {});
  return {
    hat: raw && typeof raw.hat === 'string' ? raw.hat : null,
    color: normalizeCharacterColorId(raw && typeof raw.color === 'string' ? raw.color : null),
    hatColor: normalizeCharacterColorId(raw && typeof raw.hatColor === 'string' ? raw.hatColor : null),
    hatUsesCustomColor: Boolean(raw && raw.hatUsesCustomColor),
    ropeColor: normalizeCharacterColorId(raw && typeof raw.ropeColor === 'string' ? raw.ropeColor : DEFAULT_ROPE_COLOR),
    backpack: Boolean(raw && raw.backpack),
  };
}

function filterReplayList(seed, replays) {
  if (!Array.isArray(replays)) return [];
  return replays.filter((replay) => (
    replay &&
    replay.version === REPLAY_FORMAT_VERSION &&
    replay.seedText === seed &&
    Array.isArray(replay.frames) &&
    replay.frames.length > 0
  ));
}

function emptySeedReplayStore() {
  const store = {};
  for (const mode of GAME_MODE_ORDER) store[mode] = {};
  return store;
}

function replayPersistScore(replay) {
  if (!replay) return 0;
  const scores = [
    replay.finalScore,
    replay.crash && replay.crash.runFinalScore,
    replay.crash && replay.crash.scoreMeters,
  ].map(value => Number(value)).filter(Number.isFinite);
  return Math.max(0, ...scores);
}

function replayPersistMaxX(replay) {
  return Math.max(0, Number(replay && replay.maxX) || 0);
}

function bestReplayFromList(replays) {
  let bestReplay = null;
  let bestScore = -Infinity;
  let bestMaxX = -Infinity;
  for (const replay of Array.isArray(replays) ? replays : []) {
    const score = replayPersistScore(replay);
    const maxX = replayPersistMaxX(replay);
    if (!bestReplay || score > bestScore || (score === bestScore && maxX >= bestMaxX)) {
      bestReplay = replay;
      bestScore = score;
      bestMaxX = maxX;
    }
  }
  return bestReplay;
}

function assignReplayList(store, mode, seed, replays, options = {}) {
  if (!GAME_MODES[mode] || !/^[0-9A-Za-z]{1,6}$/.test(seed)) return;
  const filtered = filterReplayList(seed, replays);
  if (!filtered.length) return;

  if (options.bestOnly) {
    const bestReplay = bestReplayFromList(filtered);
    if (bestReplay) store[mode][seed] = [bestReplay];
    return;
  }

  store[mode][seed] = filtered;
}

function loadReplayStoreFromRaw(raw, options = {}) {
  const store = emptySeedReplayStore();
  if (!raw || typeof raw !== 'object') return store;

  const looksModeScoped = GAME_MODE_ORDER.some((mode) => raw[mode] && typeof raw[mode] === 'object' && !Array.isArray(raw[mode]));
  if (looksModeScoped) {
    for (const mode of GAME_MODE_ORDER) {
      for (const [seed, replays] of Object.entries(raw[mode] || {})) {
        assignReplayList(store, mode, seed, replays, options);
      }
    }
  } else {
    // Migration: all existing replays were recorded in the original free-roam mode.
    for (const [seed, replays] of Object.entries(raw)) {
      assignReplayList(store, 'freeRoam', seed, replays, options);
    }
  }
  return store;
}

function loadSeedReplayStore() {
  return loadReplayStoreFromRaw(readStorageJson(SEED_REPLAYS_KEY, {}), { bestOnly: true });
}

function clearLegacySessionReplayStore() {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_SEED_REPLAYS_KEY);
  } catch (_) {
    // Ignore private-mode/session storage failures.
  }
}

function replayStoreIsEmpty(store) {
  for (const mode of GAME_MODE_ORDER) {
    if (store && Object.keys(store[mode] || {}).length) return false;
  }
  return true;
}

function bestOnlyReplayStore(store) {
  const bestOnly = emptySeedReplayStore();
  for (const mode of GAME_MODE_ORDER) {
    for (const [seed, replays] of Object.entries((store && store[mode]) || {})) {
      assignReplayList(bestOnly, mode, seed, replays, { bestOnly: true });
    }
  }
  return bestOnly;
}

function pruneSeedReplayStore(store) {
  if (!store) return;
  const retainedSeeds = highScoreBoardSeedSet();
  for (const mode of Object.keys(store)) {
    for (const seed of Object.keys(store[mode] || {})) {
      if (!retainedSeeds.has(`${mode}:${seed}`)) delete store[mode][seed];
    }
  }
}

function writeSeedReplayStore(options = {}) {
  const { warn = true } = options;
  pruneSeedReplayStore(seedReplayStore);
  seedReplayStore = bestOnlyReplayStore(seedReplayStore);
  try {
    if (replayStoreIsEmpty(seedReplayStore)) {
      localStorage.removeItem(SEED_REPLAYS_KEY);
      return true;
    }

    const serialized = JSON.stringify(seedReplayStore);
    try {
      localStorage.setItem(SEED_REPLAYS_KEY, serialized);
    } catch (_) {
      // If the old all-replays value filled localStorage, remove it and retry
      // with the best-only replacement.
      localStorage.removeItem(SEED_REPLAYS_KEY);
      localStorage.setItem(SEED_REPLAYS_KEY, serialized);
    }
    return true;
  } catch (err) {
    try { localStorage.removeItem(SEED_REPLAYS_KEY); } catch (_) {}
    if (warn) console.warn('[replay] could not persist best replay', err);
    return false;
  }
}

function storedReplayListForSeed(store, seedText) {
  const replays = store && store[gameMode] && store[gameMode][seedText];
  return Array.isArray(replays) ? replays : [];
}

function storedReplaysForSeed(seedText) {
  return storedReplayListForSeed(seedReplayStore, seedText)
    .concat(storedReplayListForSeed(memorySeedReplayStore, seedText));
}

function saveCurrentSeedReplayHistory() {
  if (!currentRunTracksHighScores()) return;
  if (!seedReplayStore[gameMode]) seedReplayStore[gameMode] = {};
  if (!memorySeedReplayStore[gameMode]) memorySeedReplayStore[gameMode] = {};

  const validReplays = filterReplayList(gameSeedText, seedCrashReplays)
    .filter((replay) => normalizeGameMode(replay.gameMode || DEFAULT_GAME_MODE) === gameMode);
  const bestReplay = bestReplayFromList(validReplays);
  if (bestReplay) {
    seedReplayStore[gameMode][gameSeedText] = [bestReplay];
  } else {
    delete seedReplayStore[gameMode][gameSeedText];
  }

  const wroteLocalBest = writeSeedReplayStore();
  if (!wroteLocalBest) delete seedReplayStore[gameMode][gameSeedText];

  // Everything that is not safely persisted stays in memory only.  If the
  // best replay cannot fit in localStorage, keep it in memory too until reload.
  const localBest = wroteLocalBest ? storedReplayListForSeed(seedReplayStore, gameSeedText)[0] || null : null;
  const memoryReplays = bestReplay && localBest === bestReplay
    ? validReplays.filter((replay) => replay !== bestReplay)
    : validReplays;
  if (memoryReplays.length) {
    memorySeedReplayStore[gameMode][gameSeedText] = memoryReplays;
  } else {
    delete memorySeedReplayStore[gameMode][gameSeedText];
  }
}

function saveCharacterAppearance() {
  writeStorageJson(CHARACTER_APPEARANCE_KEY, characterAppearance);
}

let coinBalance = readStorageNumber(COIN_BALANCE_KEY);
let ownedHatIds = readOwnedHatIds();
let soundEnabled = readStorageBoolean(SOUND_ENABLED_KEY, true);
let colorTheme = readColorThemePreference();
let assistEnabled = readStorageBoolean(ASSIST_ENABLED_KEY, false);
applyVisualTheme(colorTheme);

const initialSearchParams = new URLSearchParams(window.location.search);
const requestedSeedValue = seedValueFromText(initialSearchParams.get(SEED_PARAM));
const hasRequestedSeed = requestedSeedValue !== null;
let gameSeedValue = requestedSeedValue ?? randomSeedValue();
let gameSeedText = seedTextFromValue(gameSeedValue);
let rngState = gameSeedValue;
let backgroundRngState = gameSeedValue;
let coinRngState = normalizeSeedValue(gameSeedValue ^ 0xc2b2ae35);
let gameMode = readGameModePreference();
let gameStarted = false;
let scoreMeters = 0;
let seedStatsByMode = loadSeedStatsByMode();
let seedStats = seedStatsByMode[gameMode] || (seedStatsByMode[gameMode] = {});
let best = overallBestForMode(gameMode);
let seedReplayStore = loadSeedReplayStore();
let memorySeedReplayStore = emptySeedReplayStore();
clearLegacySessionReplayStore();
// One startup compaction for old builds that stored every replay in localStorage.
writeSeedReplayStore({ warn: false });
let seedBest = 0;
let seedAttempts = 0;
let runStartBest = best;
let runStartSeedBest = 0;
let runHadOverallRecord = false;
let runHadSeedRecord = false;
let runFinalScore = 0;

function currentSeedStats() {
  if (!gameModeTracksStats()) return { best: 0, attempts: 0 };
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
  if (!currentRunTracksHighScores()) return;
  seedStats[gameSeedText] = { best: seedBest, attempts: seedAttempts };
  seedStatsByMode[gameMode] = seedStats;
  writeStorageJson(SEED_STATS_KEY, seedStatsByMode);
}

function setGameMode(mode, options = {}) {
  const { persist = true } = options;
  const nextMode = normalizeGameMode(mode);
  if (nextMode === gameMode) return;
  gameMode = nextMode;
  seedStats = seedStatsByMode[gameMode] || (seedStatsByMode[gameMode] = {});
  best = overallBestForMode(gameMode);
  syncCurrentSeedStats();
  if (typeof clearReplayHistory === 'function') clearReplayHistory();
  if (persist) writeGameModePreference(gameMode);
  if (typeof syncGameModeSelectors === 'function') syncGameModeSelectors();
  if (typeof renderHighScoreList === 'function') renderHighScoreList();
  updateScoreHud();
}

function updateScoreHud() {
  const tracksStats = gameModeTracksStats();
  if (scoreEl) scoreEl.textContent = scoreMeters;
  updateWalletUi();
  if (bestEl) {
    bestEl.textContent = best;
    if (bestEl.parentElement) bestEl.parentElement.hidden = !tracksStats;
  }
  if (seedBestEl) {
    seedBestEl.textContent = seedBest;
    if (seedBestEl.parentElement) seedBestEl.parentElement.hidden = !tracksStats;
  }
  if (attemptsEl) {
    attemptsEl.textContent = seedAttempts;
    if (attemptsEl.parentElement) attemptsEl.parentElement.hidden = !tracksStats;
  }
  if (seedEl) seedEl.textContent = gameSeedText;
}

function beginSeedAttempt() {
  syncCurrentSeedStats();
  runStartBest = best;
  runStartSeedBest = seedBest;
  runHadOverallRecord = false;
  runHadSeedRecord = false;
  runFinalScore = 0;
  if (!currentRunTracksHighScores()) {
    updateScoreHud();
    return;
  }
  seedAttempts += 1;
  persistCurrentSeedStats();
  updateScoreHud();
}

function updateRecordsForScore(meters) {
  if (!currentRunTracksHighScores()) return;
  const score = Math.max(0, Math.floor(meters));
  if (score > best) {
    best = score;
    runHadOverallRecord = score > runStartBest;
    if (gameMode === 'freeRoam') writeStorageNumber(BEST_SCORE_KEY, best);
  }
  if (score > seedBest) {
    seedBest = score;
    runHadSeedRecord = score > runStartSeedBest;
    persistCurrentSeedStats();
  }
}

function awardDistanceMilestoneBonuses(meters) {
  if (replayMode || !gameModeTracksStats()) return;
  const milestone = Math.floor(Math.max(0, Math.floor(meters)) / DISTANCE_BONUS_METERS);
  if (milestone <= currentRunDistanceBonusMilestone) return;
  const bonus = (milestone - currentRunDistanceBonusMilestone) * DISTANCE_BONUS_VALUE;
  currentRunDistanceBonusMilestone = milestone;
  currentRunDistanceBonus += bonus;
  currentRunCoinsEarned += bonus;
  addCoinBalance(bonus);
  playCoinSound();
}

function refreshScoreAndRecords() {
  furthestX = Math.max(furthestX, player.x);
  scoreMeters = Math.max(0, Math.floor((furthestX - scoreStartX) / WORLD_PX_PER_METER));
  if (!replayMode) {
    updateRecordsForScore(scoreMeters);
    awardDistanceMilestoneBonuses(scoreMeters);
  }
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
  coinRngState = normalizeSeedValue(gameSeedValue ^ 0xc2b2ae35);
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
let replayMode = false;
let activeReplayRecording = null;
let activeReplayPlayback = null;
let replayInputOverride = null;
let seedCrashReplays = storedReplaysForSeed(gameSeedText).slice();
let lastCrashReplay = seedCrashReplays[seedCrashReplays.length - 1] || null;
let escapeWaveFrontX = -Infinity;
let escapeWaveSpeed = 0;
let gameAudioPrimed = false;
let audioContext = null;
let audioLoadStarted = false;
let currentGameOverSource = null;
const sawSoundLoops = new Map();
let nextSwingSoundAt = 0;
let lastSwingAngle = null;
let lastSwingAnchorId = null;
let lastSwingSpeed = 0;
let lastSwingSpeedTrend = 0;
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
const COIN_RADIUS = 13;
const COIN_MIN_START_METERS = 40;
const COIN_MIN_START_DISTANCE = COIN_MIN_START_METERS * WORLD_PX_PER_METER;
const COIN_SPAWN_CHANCE = 1;
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
applyCustomRopeColor();

let anchors = [];
let obstacles = [];
let coins = [];
let collectedCoinIds = new Set();
let currentRunCoinsEarned = 0;
let currentRunRecordBonus = 0;
let currentRunDistanceBonus = 0;
let currentRunDistanceBonusMilestone = 0;
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

function coinRandom() {
  coinRngState = nextRandomState(coinRngState);
  return coinRngState / 0x100000000;
}

function skipWorldRandomCalls(count) {
  for (let i = 0; i < count; i += 1) {
    rngState = nextRandomState(rngState);
  }
}

function resetRandomStreams() {
  rngState = gameSeedValue;
  backgroundRngState = gameSeedValue;
  coinRngState = normalizeSeedValue(gameSeedValue ^ 0xc2b2ae35);
  // Background seeding used to consume the shared world RNG before terrain,
  // obstacles, and anchors were generated. Keep that initial offset so the
  // existing seed maps stay aligned, then keep scrolling background cosmetics
  // on their own stream so camera/input timing cannot perturb the world map.
  skipWorldRandomCalls(LEGACY_INITIAL_BACKGROUND_RANDOM_CALLS);
}

const rand = (a, b) => a + random() * (b - a);
const backgroundRand = (a, b) => a + backgroundRandom() * (b - a);
const coinRand = (a, b) => a + coinRandom() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hypot = Math.hypot;
