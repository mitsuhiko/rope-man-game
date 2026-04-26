// Main menu, crash overlay, touch controls, and mobile browser guards.

function inputAxisX() {
  const keyboard = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return clamp(keyboard + touchInput.x, -1, 1);
}

function inputAxisY() {
  const keyboard = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  return clamp(keyboard + touchInput.y, -1, 1);
}

function setJoystickVisual(x, y) {
  if (!touchStickEl) return;
  touchStickEl.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
}

function touchControlsVisible() {
  return touchControlsEl && getComputedStyle(touchControlsEl).display !== 'none';
}

function resetJoystickInput() {
  touchInput.joystickPointerId = null;
  touchInput.x = 0;
  touchInput.y = 0;
  setJoystickVisual(0, 0);
  if (touchJoystickEl) touchJoystickEl.classList.remove('is-active');
}

function updateJoystickInput(e) {
  if (!touchJoystickEl) return;
  const rect = touchJoystickEl.getBoundingClientRect();
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  const distance = hypot(dx, dy);
  const ux = distance > 0.0001 ? dx / distance : 0;
  const uy = distance > 0.0001 ? dy / distance : 0;
  const normalizedDistance = Math.min(distance, radius) / radius;

  if (normalizedDistance <= JOYSTICK_DEAD_ZONE) {
    touchInput.x = 0;
    touchInput.y = 0;
  } else {
    const scaled = (normalizedDistance - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
    touchInput.x = ux * scaled;
    touchInput.y = uy * scaled;
  }

  const visualRadius = radius * 0.52;
  const visualDistance = Math.min(distance, visualRadius);
  setJoystickVisual(ux * visualDistance, uy * visualDistance);
}


function setupMobileZoomGuard() {
  const preventZoom = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  const isTextEntryTarget = (target) => (
    target && target.closest && target.closest('input, textarea, select, [contenteditable="true"]')
  );
  let lastTouchEndAt = 0;
  let lastTouchEndX = 0;
  let lastTouchEndY = 0;

  // Mobile Safari can still smart-zoom on double tap. Most game controls are
  // handled through pointer events, so cancel their touchend. Text inputs get
  // the first tap so they can focus, but a quick second tap is still blocked.
  window.addEventListener('touchend', (e) => {
    const touch = e.changedTouches && e.changedTouches[0];
    const now = Date.now();
    const x = touch ? touch.clientX : 0;
    const y = touch ? touch.clientY : 0;
    const isDoubleTap = now - lastTouchEndAt < 520 && Math.hypot(x - lastTouchEndX, y - lastTouchEndY) < 34;

    if (!isTextEntryTarget(e.target) || isDoubleTap) preventZoom(e);

    lastTouchEndAt = now;
    lastTouchEndX = x;
    lastTouchEndY = y;
  }, { passive: false, capture: true });
  window.addEventListener('dblclick', (e) => {
    if (!isTextEntryTarget(e.target)) preventZoom(e);
  }, { passive: false, capture: true });

  // Pinch zoom / Safari gesture zoom paths.
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) preventZoom(e);
  }, { passive: false, capture: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) preventZoom(e);
  }, { passive: false, capture: true });
  for (const eventName of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(eventName, preventZoom, { passive: false, capture: true });
  }
}

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

function setCrashActionsVisible(visible) {
  if (gameShellEl) gameShellEl.classList.toggle('is-crashed', visible);
  if (crashActionsEl) crashActionsEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function setupCrashControls() {
  const bind = (button, action) => {
    if (!button) return;
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      primeGameAudio();
      action();
    }, { passive: false });
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.detail === 0) {
        primeGameAudio();
        action();
      }
    });
  };

  bind(crashRetryEl, retryCurrentSeed);
  bind(crashMainMenuEl, returnToMainMenu);
}

function setupTouchControls() {
  if (touchActionEl) {
    touchActionEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      inputAction();
    }, { passive: false });
    touchActionEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  if (touchJoystickEl) {
    const finishJoystickPointer = (e) => {
      if (touchInput.joystickPointerId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      if (touchJoystickEl.hasPointerCapture && touchJoystickEl.hasPointerCapture(e.pointerId)) {
        touchJoystickEl.releasePointerCapture(e.pointerId);
      }
      resetJoystickInput();
    };

    touchJoystickEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      primeGameAudio();
      if (touchInput.joystickPointerId !== null) return;
      touchInput.joystickPointerId = e.pointerId;
      if (touchJoystickEl.setPointerCapture) touchJoystickEl.setPointerCapture(e.pointerId);
      touchJoystickEl.classList.add('is-active');
      updateJoystickInput(e);
    }, { passive: false });
    touchJoystickEl.addEventListener('pointermove', (e) => {
      if (touchInput.joystickPointerId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      updateJoystickInput(e);
    }, { passive: false });
    touchJoystickEl.addEventListener('pointerup', finishJoystickPointer, { passive: false });
    touchJoystickEl.addEventListener('pointercancel', finishJoystickPointer, { passive: false });
    touchJoystickEl.addEventListener('lostpointercapture', finishJoystickPointer, { passive: false });
  }

  window.addEventListener('blur', resetJoystickInput);
}
