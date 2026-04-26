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
}

function startGameWithSeed(seedValue) {
  primeGameAudio();
  setStartSeedError('');
  setGameSeed(seedValue);
  setCustomizationMenuVisible(false, { restoreFocus: false });
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
  bindStartButton(button, () => selectHat(hatId));
  return button;
}

function renderHatChoices() {
  if (!startHatGridEl || typeof CHARACTER_HATS === 'undefined') return;
  const hats = typeof CHARACTER_HAT_ORDER !== 'undefined' ? CHARACTER_HAT_ORDER : Object.keys(CHARACTER_HATS);
  startHatGridEl.replaceChildren(makeHatChoice(null), ...hats.map(makeHatChoice));
  syncCustomizationUi();
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
  setupCustomizationControls();

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
  setStartScreenVisible(true);
  setStartSeedError('');
  resetJoystickInput();
  stopGameOverSound();
  last = 0;
}
