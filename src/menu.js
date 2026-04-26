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
  gameStarted = true;
  setStartScreenVisible(false);
  reset();
  last = 0;
}

function startRandomSeed() {
  startGameWithSeed(randomSeedValue());
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

function setupStartControls() {
  if (startSeedInputEl && !startSeedInputEl.placeholder) {
    startSeedInputEl.placeholder = seedTextFromValue(randomSeedValue());
  }
  setStartScreenVisible(!gameStarted);
  bindStartButton(startRandomEl, startRandomSeed);
  bindStartButton(startSeedSubmitEl, startSpecificSeed);

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
  setCrashActionsVisible(false);
  setStartScreenVisible(true);
  setStartSeedError('');
  resetJoystickInput();
  stopGameOverSound();
  last = 0;
}
