// Main menu seed selection and navigation back from the crash screen.

function setStartSeedError(message) {
  if (!startSeedErrorEl || !startSeedInputEl) return;
  startSeedErrorEl.textContent = message || '';
  startSeedInputEl.classList.toggle('is-invalid', Boolean(message));
  startSeedInputEl.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function setStartScreenVisible(visible) {
  if (gameShellEl) gameShellEl.classList.toggle('is-starting', visible);
  if (startScreenEl) startScreenEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (visible && typeof checkForAppUpdate === 'function') {
    checkForAppUpdate({ reloadWhenReady: true });
  }
}

function updateStartSettingsUi() {
  if (startSoundToggleEl) {
    startSoundToggleEl.textContent = soundEnabled ? 'sound on' : 'sound off';
    startSoundToggleEl.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
  }
  if (startThemeToggleEl) {
    const isDark = colorTheme === 'dark';
    startThemeToggleEl.textContent = isDark ? 'dark mode' : 'light mode';
    startThemeToggleEl.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }
}

function toggleSoundSetting() {
  const nextEnabled = !soundEnabled;
  setSoundEnabled(nextEnabled);
  if (nextEnabled) primeGameAudio();
}

function toggleThemeSetting() {
  setColorTheme(colorTheme === 'dark' ? 'light' : 'dark');
  if (startHatGridEl && startHatGridEl.children.length) renderHatChoices();
  if (startColorGridEl && startColorGridEl.children.length) renderColorChoices();
}

let highScoreSortMode = 'score';
let highScoreGameMode = gameMode;
let colorEditTarget = 'body';

function startGameWithSeed(seedValue) {
  primeGameAudio();
  setStartSeedError('');
  setGameSeed(seedValue);
  if (startSeedInputEl) startSeedInputEl.value = gameSeedText;
  setCustomizationMenuVisible(false, { restoreFocus: false });
  setHighScoreMenuVisible(false, { restoreFocus: false });
  gameStarted = true;
  setStartScreenVisible(false);
  reset();
  last = 0;
}

function randomizeStartSeed() {
  setStartSeedError('');
  const seedValue = randomSeedValue();
  setGameSeed(seedValue, { writeUrl: false });
  if (startSeedInputEl) startSeedInputEl.value = gameSeedText;
}

function startSpecificSeed() {
  const seedText = startSeedInputEl ? (startSeedInputEl.value.trim() || startSeedInputEl.placeholder) : '';
  const result = validateSeedText(seedText);
  if (result.error) {
    setStartSeedError(result.error);
    if (startSeedInputEl) startSeedInputEl.focus();
    return;
  }
  if (startSeedInputEl) startSeedInputEl.value = result.text;
  startGameWithSeed(result.value);
}

function bindStartButton(button, action) {
  if (!button) return;
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  }, { passive: false });
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.detail === 0) action();
  });
}

function hatLabel(hatId) {
  if (!hatId) return 'no hat';
  const spec = typeof CHARACTER_HATS !== 'undefined' ? CHARACTER_HATS[hatId] : null;
  return spec && spec.label ? spec.label : hatId.replace(/-/g, ' ');
}

function characterColorLabel(colorId) {
  const spec = typeof CHARACTER_COLOR_PALETTES !== 'undefined' ? CHARACTER_COLOR_PALETTES[colorId] : null;
  return spec && spec.label ? spec.label : (colorId || DEFAULT_CHARACTER_COLOR).replace(/-/g, ' ');
}

function currentSelectedColor() {
  return normalizeCharacterColorId(characterAppearance.color);
}

function currentSelectedHatColor() {
  return characterAppearance.hatUsesCustomColor
    ? normalizeCharacterColorId(characterAppearance.hatColor)
    : DEFAULT_CHARACTER_COLOR;
}

function currentSelectedRopeColor() {
  return normalizeCharacterColorId(characterAppearance.ropeColor || DEFAULT_ROPE_COLOR);
}

function currentColorForEditTarget() {
  if (colorEditTarget === 'hat') return currentSelectedHatColor();
  if (colorEditTarget === 'rope') return currentSelectedRopeColor();
  return currentSelectedColor();
}

function currentSelectedHat() {
  if (typeof selectedHatId === 'function') return selectedHatId();
  return characterAppearance.hat || null;
}

function syncCustomizationUi() {
  const selectedHat = currentSelectedHat();
  const selectedColor = currentSelectedColor();
  const selectedHatColor = currentSelectedHatColor();
  const selectedRopeColor = currentSelectedRopeColor();
  if (startCharacterSelectionEl) {
    const hatText = selectedHat ? hatLabel(selectedHat) : 'none';
    const hatColorText = characterAppearance.hatUsesCustomColor ? characterColorLabel(selectedHatColor) : 'black';
    startCharacterSelectionEl.textContent = `hat: ${hatText} · body: ${characterColorLabel(selectedColor)} · hat: ${hatColorText} · rope: ${characterColorLabel(selectedRopeColor)}`;
  }
  if (startColorTargetBodyEl) {
    const selected = colorEditTarget === 'body';
    startColorTargetBodyEl.classList.toggle('is-selected', selected);
    startColorTargetBodyEl.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  if (startColorTargetHatEl) {
    const selected = colorEditTarget === 'hat';
    startColorTargetHatEl.classList.toggle('is-selected', selected);
    startColorTargetHatEl.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  if (startColorTargetRopeEl) {
    const selected = colorEditTarget === 'rope';
    startColorTargetRopeEl.classList.toggle('is-selected', selected);
    startColorTargetRopeEl.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  if (startHatGridEl) {
    for (const button of startHatGridEl.querySelectorAll('.hat-choice')) {
      const hatId = button.dataset.hat || null;
      const isSelected = hatId === selectedHat;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    }
  }
  if (startColorGridEl) {
    const selectedEditColor = currentColorForEditTarget();
    for (const button of startColorGridEl.querySelectorAll('.color-choice')) {
      const isSelected = button.dataset.color === selectedEditColor;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    }
  }
}

function selectHat(hatId) {
  setCharacterAppearance({ hat: hatId || null });
  syncCustomizationUi();
}

function selectCharacterColor(colorId) {
  if (colorEditTarget === 'hat') {
    const normalizedColor = normalizeCharacterColorId(colorId);
    setCharacterAppearance({
      hatColor: normalizedColor,
      hatUsesCustomColor: normalizedColor !== DEFAULT_CHARACTER_COLOR,
    });
    if (startHatGridEl && startHatGridEl.children.length) renderHatChoices();
  } else if (colorEditTarget === 'rope') {
    setCharacterAppearance({ ropeColor: colorId });
  } else {
    setCharacterAppearance({ color: colorId });
  }
  syncCustomizationUi();
}

function setColorEditTarget(target) {
  colorEditTarget = target === 'hat' || target === 'rope' ? target : 'body';
  syncCustomizationUi();
}

function bindHatChoiceButton(button, action) {
  let startX = 0;
  let startY = 0;
  let pointerId = null;

  button.addEventListener('pointerdown', (e) => {
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
  });
  button.addEventListener('pointerup', (e) => {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) return;
    e.preventDefault();
    e.stopPropagation();
    action();
  });
  button.addEventListener('pointercancel', () => {
    pointerId = null;
  });
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.detail === 0) action();
  });
}

function makeHatChoice(hatId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `hat-choice${hatId ? '' : ' hat-choice--none'}`;
  button.dataset.hat = hatId || '';
  button.setAttribute('role', 'radio');

  const preview = document.createElement('span');
  preview.className = 'hat-choice-preview';
  if (hatId) {
    if (typeof createPaperTintedAccessoryElement === 'function') {
      preview.appendChild(createPaperTintedAccessoryElement(hatId));
    } else {
      const spec = CHARACTER_HATS[hatId];
      const img = document.createElement('img');
      img.src = spec.src;
      img.alt = '';
      preview.appendChild(img);
    }
  }

  const label = document.createElement('span');
  label.className = 'hat-choice-name';
  label.textContent = hatLabel(hatId);

  button.append(preview, label);
  button.setAttribute('aria-label', hatLabel(hatId));
  bindHatChoiceButton(button, () => selectHat(hatId));
  return button;
}

function makeColorChoice(colorId) {
  const spec = CHARACTER_COLOR_PALETTES[colorId];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'color-choice';
  button.dataset.color = colorId;
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-label', characterColorLabel(colorId));
  button.style.setProperty('--character-swatch', characterColorForTheme(colorId));

  const swatch = document.createElement('span');
  swatch.className = 'color-choice-swatch';
  swatch.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'color-choice-name';
  label.textContent = spec.label;

  button.append(swatch, label);
  bindHatChoiceButton(button, () => selectCharacterColor(colorId));
  return button;
}

function renderColorChoices() {
  if (!startColorGridEl || typeof CHARACTER_COLOR_PALETTES === 'undefined') return;
  const colors = typeof CHARACTER_COLOR_ORDER !== 'undefined' ? CHARACTER_COLOR_ORDER : Object.keys(CHARACTER_COLOR_PALETTES);
  startColorGridEl.replaceChildren(...colors.map(makeColorChoice));
  syncCustomizationUi();
}

function renderHatChoices() {
  if (!startHatGridEl || typeof CHARACTER_HATS === 'undefined') return;
  const hats = typeof CHARACTER_HAT_ORDER !== 'undefined' ? CHARACTER_HAT_ORDER : Object.keys(CHARACTER_HATS);
  startHatGridEl.replaceChildren(makeHatChoice(null), ...hats.map(makeHatChoice));
  syncCustomizationUi();
}

function makeGameModeSelect(id, selectedMode = gameMode) {
  const select = document.createElement('select');
  select.id = id;
  select.className = 'start-mode-select';
  for (const mode of GAME_MODE_ORDER) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = gameModeLabel(mode);
    select.appendChild(option);
  }
  select.value = normalizeGameMode(selectedMode);
  return select;
}

function syncGameModeSelectors() {
  const mainSelect = document.getElementById('start-mode-select');
  if (mainSelect) mainSelect.value = gameMode;
  const scoreSelect = document.getElementById('start-scores-mode-select');
  if (scoreSelect) scoreSelect.value = highScoreGameMode;
}

function setupGameModeSelects() {
  if (startModeSelectWrapEl && !document.getElementById('start-mode-select')) {
    const select = makeGameModeSelect('start-mode-select', gameMode);
    select.addEventListener('change', () => {
      setGameMode(select.value);
      highScoreGameMode = gameMode;
      syncGameModeSelectors();
    });
    startModeSelectWrapEl.replaceChildren(select);
  }
  if (startScoresModeSelectWrapEl && !document.getElementById('start-scores-mode-select')) {
    const select = makeGameModeSelect('start-scores-mode-select', highScoreGameMode);
    select.addEventListener('change', () => {
      highScoreGameMode = normalizeGameMode(select.value);
      syncGameModeSelectors();
      renderHighScoreList();
    });
    startScoresModeSelectWrapEl.replaceChildren(select);
  }
  syncGameModeSelectors();
}

function rankedSeedStats(mode) {
  return rankedSeedStatEntries(highScoreGameMode, mode);
}

function setHighScoreSortMode(mode) {
  highScoreSortMode = mode === 'attempts' ? 'attempts' : 'score';
  if (startScoresByScoreEl) {
    const selected = highScoreSortMode === 'score';
    startScoresByScoreEl.classList.toggle('is-selected', selected);
    startScoresByScoreEl.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  if (startScoresByAttemptsEl) {
    const selected = highScoreSortMode === 'attempts';
    startScoresByAttemptsEl.classList.toggle('is-selected', selected);
    startScoresByAttemptsEl.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  renderHighScoreList();
}

function makeHighScoreItem(entry, index) {
  const attemptText = entry.attempts === 1 ? '1 attempt' : `${entry.attempts} attempts`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'high-score-item';
  button.dataset.seed = entry.seed;
  button.setAttribute('aria-label', `play seed ${entry.seed}, best ${entry.best} meters, ${attemptText}`);

  const rank = document.createElement('span');
  rank.className = 'high-score-rank';
  rank.textContent = `#${index + 1}`;

  const seedWrap = document.createElement('span');
  const seedLabel = document.createElement('span');
  seedLabel.className = 'high-score-seed-label';
  seedLabel.textContent = 'seed';
  const seedText = document.createElement('span');
  seedText.className = 'high-score-seed';
  seedText.textContent = entry.seed;
  seedWrap.append(seedLabel, seedText);

  const metrics = document.createElement('span');
  metrics.className = 'high-score-metrics';
  const best = document.createElement('span');
  best.textContent = `${entry.best}m best`;
  const attempts = document.createElement('span');
  attempts.textContent = attemptText;
  metrics.append(best, attempts);

  button.append(rank, seedWrap, metrics);
  bindHatChoiceButton(button, () => {
    setGameMode(highScoreGameMode);
    startGameWithSeed(seedValueFromText(entry.seed));
  });
  return button;
}

function renderHighScoreList() {
  if (!startScoresListEl) return;
  const entries = rankedSeedStats(highScoreSortMode);
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'high-score-empty';
    empty.textContent = 'No saved maps yet. Crash heroically, then come back.';
    startScoresListEl.replaceChildren(empty);
    return;
  }
  startScoresListEl.replaceChildren(...entries.map(makeHighScoreItem));
}

function setHighScoreMenuVisible(visible, options = {}) {
  const { restoreFocus = true, showMain = true } = options;
  if (!startScoresMenuEl) return;

  if (visible) {
    setupGameModeSelects();
    if (startCustomizationMenuEl) {
      startCustomizationMenuEl.hidden = true;
      startCustomizationMenuEl.setAttribute('aria-hidden', 'true');
    }
    if (startCustomizeOpenEl) startCustomizeOpenEl.setAttribute('aria-expanded', 'false');
    setHighScoreSortMode(highScoreSortMode);
  }

  if (startMainPanelEl && (visible || showMain)) startMainPanelEl.hidden = visible;
  startScoresMenuEl.hidden = !visible;
  startScoresMenuEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (startScreenEl) startScreenEl.scrollTop = 0;
  if (startScoresOpenEl) startScoresOpenEl.setAttribute('aria-expanded', visible ? 'true' : 'false');

  if (visible) {
    focusWithoutScroll(highScoreSortMode === 'attempts' ? startScoresByAttemptsEl : startScoresByScoreEl);
  } else if (restoreFocus) {
    focusWithoutScroll(startScoresOpenEl);
  }
}

function setupHighScoreControls() {
  bindStartButton(startScoresOpenEl, () => setHighScoreMenuVisible(true));
  bindStartButton(startScoresCloseEl, () => setHighScoreMenuVisible(false));
  bindStartButton(startScoresByScoreEl, () => setHighScoreSortMode('score'));
  bindStartButton(startScoresByAttemptsEl, () => setHighScoreSortMode('attempts'));
}

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch (_) {
    element.focus();
  }
}

function setCustomizationMenuVisible(visible, options = {}) {
  const { restoreFocus = true } = options;
  if (!startCustomizationMenuEl) return;
  if (visible) setHighScoreMenuVisible(false, { restoreFocus: false, showMain: false });
  if (visible && startHatGridEl && !startHatGridEl.children.length) renderHatChoices();
  if (startMainPanelEl) startMainPanelEl.hidden = visible;
  startCustomizationMenuEl.hidden = !visible;
  startCustomizationMenuEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (startScreenEl) startScreenEl.scrollTop = 0;
  if (startCustomizeOpenEl) startCustomizeOpenEl.setAttribute('aria-expanded', visible ? 'true' : 'false');
  syncCustomizationUi();
  if (visible) {
    const selected = (startColorGridEl && startColorGridEl.querySelector('.color-choice.is-selected'))
      || (startHatGridEl && startHatGridEl.querySelector('.hat-choice.is-selected'));
    focusWithoutScroll(selected || startCustomizeCloseEl);
  } else if (restoreFocus) {
    focusWithoutScroll(startCustomizeOpenEl);
  }
}

function setupCustomizationControls() {
  renderColorChoices();
  renderHatChoices();
  syncCustomizationUi();
  bindStartButton(startCustomizeOpenEl, () => setCustomizationMenuVisible(!startCustomizationMenuEl || startCustomizationMenuEl.hidden));
  bindStartButton(startCustomizeCloseEl, () => setCustomizationMenuVisible(false));
}

function setupStartControls() {
  if (startSeedInputEl && !startSeedInputEl.placeholder) {
    startSeedInputEl.placeholder = seedTextFromValue(randomSeedValue());
  }
  setStartScreenVisible(!gameStarted);
  bindStartButton(startRandomEl, startSpecificSeed);
  bindStartButton(startSeedSubmitEl, randomizeStartSeed);
  bindStartButton(startSoundToggleEl, toggleSoundSetting);
  bindStartButton(startThemeToggleEl, toggleThemeSetting);
  bindStartButton(startColorTargetBodyEl, () => setColorEditTarget('body'));
  bindStartButton(startColorTargetHatEl, () => setColorEditTarget('hat'));
  bindStartButton(startColorTargetRopeEl, () => setColorEditTarget('rope'));
  updateStartSettingsUi();
  setupGameModeSelects();
  setupCustomizationControls();
  setupHighScoreControls();

  if (startSeedFormEl) {
    startSeedFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      startSpecificSeed();
    });
  }
  if (startSeedInputEl) {
    startSeedInputEl.addEventListener('input', () => setStartSeedError(''));
  }
}

function returnToMainMenu() {
  gameStarted = false;
  gameOver = false;
  gamePaused = false;
  replayMode = false;
  activeReplayPlayback = null;
  replayInputOverride = null;
  activeReplayRecording = null;
  setCrashActionsVisible(false);
  setCustomizationMenuVisible(false, { restoreFocus: false });
  setHighScoreMenuVisible(false, { restoreFocus: false });
  setStartScreenVisible(true);
  setStartSeedError('');
  resetJoystickInput();
  stopGameOverSound();
  last = 0;
}
