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
}

let highScoreSortMode = 'score';

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

function currentSelectedHat() {
  if (typeof selectedHatId === 'function') return selectedHatId();
  return characterAppearance.hat || null;
}

function syncCustomizationUi() {
  const selected = currentSelectedHat();
  if (startCharacterSelectionEl) {
    startCharacterSelectionEl.textContent = selected ? `hat: ${hatLabel(selected)}` : 'hat: none';
  }
  if (!startHatGridEl) return;
  for (const button of startHatGridEl.querySelectorAll('.hat-choice')) {
    const hatId = button.dataset.hat || null;
    const isSelected = hatId === selected;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  }
}

function selectHat(hatId) {
  setCharacterAppearance({ hat: hatId || null });
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

function renderHatChoices() {
  if (!startHatGridEl || typeof CHARACTER_HATS === 'undefined') return;
  const hats = typeof CHARACTER_HAT_ORDER !== 'undefined' ? CHARACTER_HAT_ORDER : Object.keys(CHARACTER_HATS);
  startHatGridEl.replaceChildren(makeHatChoice(null), ...hats.map(makeHatChoice));
  syncCustomizationUi();
}

function rankedSeedStats(mode) {
  return Object.entries(seedStats)
    .map(([seed, raw]) => ({
      seed,
      best: Math.max(0, Math.floor(Number(raw && raw.best) || 0)),
      attempts: Math.max(0, Math.floor(Number(raw && raw.attempts) || 0)),
    }))
    .filter((entry) => entry.best > 0 || entry.attempts > 0)
    .sort((a, b) => {
      if (mode === 'attempts') {
        return (b.attempts - a.attempts) || (b.best - a.best) || a.seed.localeCompare(b.seed);
      }
      return (b.best - a.best) || (b.attempts - a.attempts) || a.seed.localeCompare(b.seed);
    })
    .slice(0, 20);
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
  bindHatChoiceButton(button, () => startGameWithSeed(seedValueFromText(entry.seed)));
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
    const selected = startHatGridEl && startHatGridEl.querySelector('.hat-choice.is-selected');
    focusWithoutScroll(selected || startCustomizeCloseEl);
  } else if (restoreFocus) {
    focusWithoutScroll(startCustomizeOpenEl);
  }
}

function setupCustomizationControls() {
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
  updateStartSettingsUi();
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
  setCrashActionsVisible(false);
  setCustomizationMenuVisible(false, { restoreFocus: false });
  setHighScoreMenuVisible(false, { restoreFocus: false });
  setStartScreenVisible(true);
  setStartSeedError('');
  resetJoystickInput();
  stopGameOverSound();
  last = 0;
}
