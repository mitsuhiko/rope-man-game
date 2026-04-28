// Crash overlay, touch controls, and mobile browser guards.

function inputAxisX() {
  if (replayInputOverride) return clamp(Number(replayInputOverride.x) || 0, -1, 1);
  const keyboard = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return clamp(keyboard + touchInput.x, -1, 1);
}

function inputAxisY() {
  if (replayInputOverride) return clamp(Number(replayInputOverride.y) || 0, -1, 1);
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

function mobileViewActive() {
  if (touchControlsVisible()) return true;
  if (!window.matchMedia) return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches ||
    window.matchMedia('(max-width: 700px)').matches ||
    window.matchMedia('(max-height: 480px)').matches
  );
}

function shouldPointerStopReplay(e) {
  return Boolean(e && (e.pointerType === 'touch' || e.pointerType === 'pen' || mobileViewActive()));
}

function stopReplayFromMobileTap(e) {
  if (!replayMode || !shouldPointerStopReplay(e)) return false;
  if (e.cancelable) e.preventDefault();
  e.stopPropagation();
  if (typeof finishCrashReplay === 'function') finishCrashReplay();
  return true;
}

function resetJoystickInput() {
  const pointerId = touchInput.joystickPointerId;
  if (touchJoystickEl && pointerId !== null && touchJoystickEl.hasPointerCapture && touchJoystickEl.hasPointerCapture(pointerId)) {
    try {
      touchJoystickEl.releasePointerCapture(pointerId);
    } catch (_) {
      // Ignore stale pointer capture ids from browsers that already released it.
    }
  }
  touchInput.joystickPointerId = null;
  touchInput.x = 0;
  touchInput.y = 0;
  setJoystickVisual(0, 0);
  if (touchJoystickEl) touchJoystickEl.classList.remove('is-active');
}

function mobileControlPointerAllowed(e) {
  return !e || e.pointerType !== 'mouse';
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

function setRunMenuVisible(visible) {
  if (gameShellEl) gameShellEl.classList.toggle('is-crashed', visible);
  if (crashActionsEl) crashActionsEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function setCrashActionsVisible(visible) {
  setRunMenuVisible(visible);
}

function setButtonVisible(button, visible) {
  if (!button) return;
  button.hidden = !visible;
}

function setRunMenuContent(options) {
  const {
    title,
    record = '',
    stats = '',
    help = [],
    continueVisible = false,
    replayVisible = false,
    retryLabel = 'retry',
    replayLabel = 'watch replay',
    mainMenuLabel = 'main menu',
  } = options;

  if (crashTitleEl) crashTitleEl.textContent = title;
  if (crashRecordEl) crashRecordEl.textContent = record;
  if (crashStatsEl) crashStatsEl.textContent = stats;
  if (crashHelpEl) {
    crashHelpEl.replaceChildren(...help.map((line) => {
      const div = document.createElement('div');
      div.textContent = line;
      return div;
    }));
  }
  setButtonVisible(crashContinueEl, continueVisible);
  setButtonVisible(crashReplayEl, replayVisible);
  if (crashRetryEl) crashRetryEl.textContent = retryLabel;
  if (crashReplayEl) crashReplayEl.textContent = replayLabel;
  if (crashMainMenuEl) crashMainMenuEl.textContent = mainMenuLabel;
}

function showPauseMenu() {
  setRunMenuContent({
    title: 'PAUSED',
    stats: `seed ${gameSeedText} · score ${scoreMeters}m`,
    help: mobileViewActive()
      ? ['tap continue to resume', 'tap replay to restart this seed', 'tap main menu to choose a seed']
      : ['esc: continue', 'R: replay current seed', 'H: main menu'],
    continueVisible: true,
    retryLabel: 'replay',
    mainMenuLabel: 'main menu',
  });
  setRunMenuVisible(true);
}

function updateCrashSummary() {
  const attemptLabel = seedAttempts === 1 ? 'attempt 1' : `attempt ${seedAttempts}`;
  const replayCount = typeof currentSeedReplayCount === 'function' ? currentSeedReplayCount() : 0;
  const canReplay = typeof canWatchCrashReplay === 'function' && canWatchCrashReplay();
  const isMobile = mobileViewActive();
  const help = [isMobile ? 'tap retry to play this seed again' : 'space / R: retry current seed'];
  if (canReplay) {
    help.push(isMobile
      ? (replayCount > 1 ? `tap watch replays to see ${replayCount} runs` : 'tap watch replay to see the run')
      : (replayCount > 1 ? `P: watch ${replayCount} replays` : 'P: watch replay'));
  }
  help.push(isMobile ? 'tap main menu to choose a seed' : 'H: main menu');

  let message = '';
  if (runHadOverallRecord) {
    message = runHadSeedRecord ? 'new overall + seed record!' : 'new overall record!';
  } else if (runHadSeedRecord) {
    message = 'new seed record!';
  }
  const coinText = currentRunCoinsEarned > 0 ? ` · +${currentRunCoinsEarned}¢` : '';
  if (currentRunDistanceBonus > 0) {
    help.unshift(`distance bonus: +${currentRunDistanceBonus}¢`);
  }
  if (currentRunRecordBonus > 0) {
    help.unshift(`record bonus: +${currentRunRecordBonus}¢`);
  }
  setRunMenuContent({
    title: 'CRASH',
    record: message,
    stats: `score ${scoreMeters}m · ${attemptLabel} on seed ${gameSeedText}${coinText}`,
    help,
    continueVisible: false,
    replayVisible: canReplay,
    retryLabel: 'retry',
    replayLabel: replayCount > 1 ? 'watch replays' : 'watch replay',
    mainMenuLabel: 'main menu',
  });
}

function setupCrashControls() {
  const bind = (button, action) => {
    if (!button) return;
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      primeGameAudio();
      playBingSound();
      action();
    }, { passive: false });
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.detail === 0) {
        primeGameAudio();
        playBingSound();
        action();
      }
    });
  };

  bind(crashContinueEl, resumeGame);
  bind(crashRetryEl, retryCurrentSeed);
  bind(crashReplayEl, () => {
    if (typeof startCrashReplay === 'function') startCrashReplay();
  });
  bind(crashMainMenuEl, returnToMainMenu);
}

function setupTouchControls() {
  if (touchPauseEl) {
    touchPauseEl.addEventListener('pointerdown', (e) => {
      if (!mobileControlPointerAllowed(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!gameStarted || gameOver || gamePaused || replayMode) return;
      primeGameAudio();
      playBingSound();
      pauseGame();
    }, { passive: false });
    touchPauseEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  if (touchActionEl) {
    touchActionEl.addEventListener('pointerdown', (e) => {
      if (!mobileControlPointerAllowed(e)) return;
      if (stopReplayFromMobileTap(e)) return;
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
        try {
          touchJoystickEl.releasePointerCapture(e.pointerId);
        } catch (_) {
          // Ignore stale pointer capture ids from browsers that already released it.
        }
      }
      resetJoystickInput();
    };

    touchJoystickEl.addEventListener('pointerdown', (e) => {
      if (!mobileControlPointerAllowed(e)) return;
      if (stopReplayFromMobileTap(e)) return;
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
