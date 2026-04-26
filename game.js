(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const stateEl = document.getElementById('state');
  const touchControlsEl = document.querySelector('.touch-controls');
  const touchActionEl = document.getElementById('touch-action');
  const touchJoystickEl = document.getElementById('touch-joystick');
  const touchStickEl = document.getElementById('touch-stick');

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
  const BEST_SCORE_KEY = 'ropeDashBestMetersV2';

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
  let furthestX = 0;
  let scoreStartX = 0;
  const DEBUG_HITBOXES = new URLSearchParams(window.location.search).get('debug') === '1';
  let best = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);

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

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hypot = Math.hypot;

  function hookAimAnchor() {
    if (gameOver || player.attached) return null;
    if (ropeShot && ropeShot.anchor) return ropeShot.anchor;
    return focusedAnchor;
  }

  function desiredHookHandPosition() {
    const fallback = { x: player.x, y: player.y };
    const target = hookAimAnchor();
    if (!target || !ragdoll.initialized || !ragdoll.joints.shoulder) return fallback;

    const shoulder = ragdoll.joints.shoulder;
    const dx = target.x - shoulder.x;
    const dy = target.y - shoulder.y;
    const d = hypot(dx, dy);
    if (d <= 0.0001) return fallback;

    return {
      x: shoulder.x + dx / d * HOOK_ARM_REACH,
      y: shoulder.y + dy / d * HOOK_ARM_REACH,
    };
  }

  function hookHandPosition() {
    if (!hookArm.initialized || gameOver) return { x: player.x, y: player.y };
    return { x: hookArm.x, y: hookArm.y };
  }

  function updateHookArmAim(dt) {
    const desired = desiredHookHandPosition();
    if (!hookArm.initialized || gameOver || !ragdoll.initialized || !ragdoll.joints.shoulder) {
      hookArm.initialized = true;
      hookArm.x = player.x;
      hookArm.y = player.y;
      if (ragdoll.initialized && ragdoll.joints.shoulder) {
        hookArm.ox = player.x - ragdoll.joints.shoulder.x;
        hookArm.oy = player.y - ragdoll.joints.shoulder.y;
      } else {
        hookArm.ox = 0;
        hookArm.oy = 0;
      }
      return;
    }

    const shoulder = ragdoll.joints.shoulder;
    const desiredOx = desired.x - shoulder.x;
    const desiredOy = desired.y - shoulder.y;
    const t = smoothstep01(clamp(dt * 11, 0, 1));
    hookArm.ox += (desiredOx - hookArm.ox) * t;
    hookArm.oy += (desiredOy - hookArm.oy) * t;
    if (player.attached && hypot(desiredOx - hookArm.ox, desiredOy - hookArm.oy) < 0.5) {
      hookArm.ox = desiredOx;
      hookArm.oy = desiredOy;
    }
    hookArm.x = shoulder.x + hookArm.ox;
    hookArm.y = shoulder.y + hookArm.oy;
  }

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

    // Mobile Safari can still smart-zoom on double tap unless the tap's
    // default action is cancelled. The game uses pointer events for input,
    // so cancelling touchend here does not block controls.
    window.addEventListener('touchend', preventZoom, { passive: false, capture: true });

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

  function reset() {
    cameraX = 0;
    cameraY = 0;
    cameraVX = 0;
    cameraVY = 0;
    time = 0;
    gameOver = false;
    furthestX = 0;
    scoreStartX = 0;
    anchors = [];
    obstacles = [];
    bgShapes = [];
    resetTerrain();
    nextAnchorX = 120;
    nextObstacleX = 950;
    spawnIndex = 0;
    focusedAnchor = null;
    lockedAnchor = null;
    recentReleasedAnchor = null;
    recentReleasedAnchorAt = -Infinity;
    recentReleasedAnchorX = 0;
    recentReleasedAnchorY = 0;
    ropeShot = null;
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
    generateUntil(W * 2.6);
    player.anchor = anchors[0];
    player.ropeLength = clamp(INITIAL_SPAWN_ROPE_LENGTH, MIN_ROPE, MAX_ROPE);
    player.angle = INITIAL_SPAWN_ANGLE;
    player.angularVelocity = 0;
    syncAttachedKinematics();
    scoreStartX = player.x;
    furthestX = player.x;
    hookArm.x = player.x;
    hookArm.y = player.y;
    cameraX = player.x - W * 0.42;
    cameraY = player.y - H * 0.52;
  }

  function seedBackground() {
    for (let i = 0; i < 80; i++) {
      bgShapes.push(makeBgShape(rand(-300, W * 5)));
    }
  }

  function makeBgShape(x) {
    return {
      x,
      y: rand(80, Math.max(180, H - 120)),
      size: rand(18, 86),
      sides: Math.floor(rand(0, 4)),
      shade: Math.random() < 0.5 ? BG1 : BG2,
      layer: Math.random() < 0.55 ? 0.28 : 0.48,
      rot: rand(0, Math.PI),
    };
  }

  function addAnchor(x, y) {
    anchors.push({ id: anchors.length + 1, x, y, r: 8 });
  }

  function generateUntil(worldX) {
    generateTerrainUntil(worldX);

    while (nextAnchorX < worldX) {
      const difficulty = clamp(nextAnchorX / 5000, 0, 1);
      const gap = rand(260, 420 + difficulty * 90);
      const wave = Math.sin(nextAnchorX / 680) * 95;
      const maxAnchorY = terrainYAt(nextAnchorX) - ANCHOR_TERRAIN_CLEARANCE;
      const minAnchorY = ANCHOR_BASE_MIN_Y + wave;
      const preferredMaxAnchorY = ANCHOR_BASE_MAX_Y + wave + difficulty * 80;
      const y = clamp(rand(minAnchorY, preferredMaxAnchorY), ANCHOR_MIN_Y, maxAnchorY);
      addAnchor(nextAnchorX, y);
      nextAnchorX += gap;
    }

    while (nextObstacleX < worldX) {
      spawnObstacleCluster(nextObstacleX, spawnIndex++);
      nextObstacleX += rand(650, 980);
    }
  }

  function spawnObstacleCluster(x, i) {
    const difficulty = clamp(x / 5500, 0, 1);
    const roll = Math.random();
    const groundY = terrainYAt(x);

    if (i < 1) {
      obstacles.push({ type: 'gate', x, w: 26, gapY: H * 0.54, gap: 360, phase: rand(0, Math.PI * 2), speed: 0.65 });
      return;
    }

    if (roll < 0.23) {
      obstacles.push({
        type: 'gate',
        x,
        w: 28,
        gapY: rand(H * 0.38, H * 0.64),
        gap: rand(300 - difficulty * 45, 390 - difficulty * 40),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.55, 1.15 + difficulty * 0.25),
      });
    } else if (roll < 0.56) {
      obstacles.push({
        type: 'saw',
        x,
        y: rand(H * 0.30, clamp(groundY - 105, H * 0.42, H * 0.68)),
        r: rand(24, 38),
        spin: rand(-1, 1) < 0 ? -1 : 1,
        bob: rand(95, 180),
        phase: rand(0, Math.PI * 2),
      });
    } else {
      const ceiling = Math.random() < 0.30;
      const size = rand(22, 31);
      const count = Math.floor(rand(4, 9));
      const spikeX = x + (ceiling ? 0 : rand(-50, 95));
      obstacles.push({
        type: 'spikes',
        x: spikeX,
        y: ceiling ? 34 : 0,
        count,
        dir: ceiling ? 1 : -1,
        size,
        ground: !ceiling,
        height: ceiling ? size : size * rand(1.45, 1.95),
      });
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

  function inputAction() {
    if (gameOver) {
      reset();
      return;
    }
    if (player.attached) {
      updateFocus();
      lockedAnchor = focusedAnchor;
      recentReleasedAnchor = player.anchor;
      recentReleasedAnchorAt = time;
      recentReleasedAnchorX = player.x;
      recentReleasedAnchorY = player.y;
      player.attached = false;
      player.anchor = null;
      ropeShot = null;
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
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
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
      reset();
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
    if (e.target.closest && e.target.closest('.touch-controls')) return;
    e.preventDefault();
    if (e.pointerType === 'touch' && touchControlsVisible()) return;
    inputAction();
  }, { passive: false });

  function update(dt) {
    time += dt;
    generateUntil(Math.max(cameraX + W * 2.8, player.x + W * 2.8));
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

      const targetCameraX = player.x + clamp(player.vx * 0.18, -300, 420) - W * 0.44;
      const targetCameraY = player.y + clamp(player.vy * 0.10, -220, 220) - H * 0.52;
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

      if (isUnrecoverablyLost() || hitsObstacle()) {
        die();
      }
    }

    anchors = anchors.filter(a => a === lockedAnchor || a === player.anchor || (ropeShot && a === ropeShot.anchor) || a.x > cameraX - 1800);
    obstacles = obstacles.filter(o => (o.x + (o.w || o.r || 0)) > cameraX - 1800);
    pruneTerrain();
    for (const s of bgShapes) {
      const sx = s.x - cameraX * s.layer;
      if (sx < -180) {
        Object.assign(s, makeBgShape(cameraX * s.layer + W + rand(100, 900)));
      }
    }

    furthestX = Math.max(furthestX, player.x);
    const dist = Math.max(0, Math.floor((furthestX - scoreStartX) / WORLD_PX_PER_METER));
    if (dist > best) {
      best = dist;
      localStorage.setItem(BEST_SCORE_KEY, String(best));
    }
    scoreEl.textContent = dist;
    bestEl.textContent = best;
    stateEl.textContent = gameOver ? 'crashed - press to restart' : (player.attached ? 'attached' : (ropeShot ? 'hooking' : 'flying'));
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
  }

  function die() {
    gameOver = true;
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

  function playerHitboxes() {
    const pose = stickmanCorePose(false);
    const chest = {
      x: pose.shoulder.x + (pose.hip.x - pose.shoulder.x) * 0.32,
      y: pose.shoulder.y + (pose.hip.y - pose.shoulder.y) * 0.32,
    };
    return [
      { shape: 'circle', kind: 'player-head', x: pose.head.x, y: pose.head.y, r: 11 },
      { shape: 'circle', kind: 'player-chest', x: chest.x, y: chest.y, r: 9 },
      { shape: 'circle', kind: 'player-hip', x: pose.hip.x, y: pose.hip.y, r: 9 },
    ];
  }

  function smoothstep01(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function resetTerrain() {
    terrainKnots = [];
    terrainPools = [];
    terrainCursorX = -1150;
    terrainLastY = H - 128 + TERRAIN_DROP;
    nextTerrainPoolX = 1040;

    addTerrainKnot(-1150, H - 128 + TERRAIN_DROP);
    addTerrainKnot(-820, H - 210 + TERRAIN_DROP);
    addTerrainKnot(-460, H - 145 + TERRAIN_DROP);
    addTerrainKnot(-120, H - 118 + TERRAIN_DROP);
    addTerrainKnot(250, H - 155 + TERRAIN_DROP);
  }

  function addTerrainKnot(x, y) {
    const clampedY = clamp(y, TERRAIN_MIN_Y, TERRAIN_MAX_Y);
    terrainKnots.push({ x, y: clampedY });
    terrainCursorX = x;
    terrainLastY = clampedY;
  }

  function generateTerrainUntil(worldX) {
    while (terrainCursorX < worldX + TERRAIN_BUFFER + TERRAIN_POOL_MAX_W) {
      const gap = rand(TERRAIN_KNOT_MIN, TERRAIN_KNOT_MAX);
      const x = terrainCursorX + gap;
      const mid = (TERRAIN_MIN_Y + TERRAIN_MAX_Y) / 2;
      const lastWasHill = terrainLastY < mid;
      const makeValley = lastWasHill ? Math.random() < 0.78 : Math.random() < 0.34;
      let y = makeValley ? rand(mid + 42, TERRAIN_MAX_Y) : rand(TERRAIN_MIN_Y, mid - 24);

      // A low-frequency wobble keeps the silhouette from becoming a simple
      // alternating sine wave while still staying smooth and readable.
      y += Math.sin(x / 1180) * 28 + Math.sin(x / 570 + 1.7) * 18;
      if (Math.abs(y - terrainLastY) < 55) {
        y += (y >= terrainLastY ? 1 : -1) * rand(55, 110);
      }
      addTerrainKnot(x, y);
    }

    generateTerrainPoolsUntil(worldX + TERRAIN_BUFFER * 0.35);
  }

  function generateTerrainPoolsUntil(worldX) {
    while (nextTerrainPoolX < worldX) {
      const seedX = nextTerrainPoolX + rand(0, 260);
      const searchW = rand(TERRAIN_POOL_MIN_W, TERRAIN_POOL_MAX_W);
      const valley = terrainValleyInRange(seedX, seedX + searchW);
      const stats = terrainRangeStats(seedX, seedX + searchW, 42);
      const depth = valley.y - stats.minY;

      if (depth > 56) {
        const waterDepth = rand(42, Math.max(54, Math.min(130, depth * 0.72)));
        const levelY = clamp(valley.y - waterDepth, stats.minY + 20, valley.y - 24);
        const leftEdge = terrainLevelCrossing(valley.x, levelY, -1, TERRAIN_POOL_MAX_W * 0.9);
        const rightEdge = terrainLevelCrossing(valley.x, levelY, 1, TERRAIN_POOL_MAX_W * 0.9);

        if (leftEdge != null && rightEdge != null && rightEdge - leftEdge >= TERRAIN_POOL_MIN_W * 0.45) {
          terrainPools.push({
            type: Math.random() < 0.62 ? 'water' : 'lava',
            x: leftEdge,
            w: rightEdge - leftEdge,
            levelY,
            waveAmp: rand(3.5, 6.5),
            waveOffset: rand(0, Math.PI * 2),
          });
          nextTerrainPoolX = rightEdge + rand(620, 1280);
          continue;
        }
      }

      nextTerrainPoolX = seedX + searchW + rand(620, 1280);
    }
  }

  function terrainValleyInRange(left, right, step = TERRAIN_POOL_SCAN_STEP) {
    let valleyX = left;
    let valleyY = terrainYAt(left);
    for (let x = left + step; x <= right; x += step) {
      const y = terrainYAt(x);
      if (y > valleyY) {
        valleyX = x;
        valleyY = y;
      }
    }
    const endY = terrainYAt(right);
    if (endY > valleyY) {
      valleyX = right;
      valleyY = endY;
    }
    return { x: valleyX, y: valleyY };
  }

  function terrainLevelCrossing(startX, levelY, dir, maxDistance) {
    let prevX = startX;
    let prevD = terrainYAt(prevX) - levelY;
    if (prevD <= 0) return null;

    for (let distance = TERRAIN_POOL_SCAN_STEP; distance <= maxDistance; distance += TERRAIN_POOL_SCAN_STEP) {
      const x = startX + dir * distance;
      const d = terrainYAt(x) - levelY;
      if (d <= 0) {
        const t = clamp(prevD / (prevD - d), 0, 1);
        return prevX + (x - prevX) * t;
      }
      prevX = x;
      prevD = d;
    }

    return null;
  }

  function terrainRangeStats(left, right, step = 48) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let x = left; x <= right; x += step) {
      const y = terrainYAt(x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const endY = terrainYAt(right);
    return { minY: Math.min(minY, endY), maxY: Math.max(maxY, endY) };
  }

  function terrainYAt(worldX) {
    if (!terrainKnots.length) return H - 120;
    if (worldX <= terrainKnots[0].x) return terrainKnots[0].y;

    for (let i = 0; i < terrainKnots.length - 1; i++) {
      const a = terrainKnots[i];
      const b = terrainKnots[i + 1];
      if (worldX <= b.x) {
        const p0 = terrainKnots[Math.max(0, i - 1)];
        const p3 = terrainKnots[Math.min(terrainKnots.length - 1, i + 2)];
        const t = smoothstep01((worldX - a.x) / Math.max(1, b.x - a.x));
        const t2 = t * t;
        const t3 = t2 * t;
        const y = 0.5 * (
          2 * a.y +
          (-p0.y + b.y) * t +
          (2 * p0.y - 5 * a.y + 4 * b.y - p3.y) * t2 +
          (-p0.y + 3 * a.y - 3 * b.y + p3.y) * t3
        );
        return clamp(y, TERRAIN_MIN_Y - 20, TERRAIN_MAX_Y + 20);
      }
    }

    return terrainKnots[terrainKnots.length - 1].y;
  }

  function terrainPoints(left, right, step = TERRAIN_STEP) {
    const points = [];
    points.push({ x: left, y: terrainYAt(left) });
    for (let x = Math.ceil(left / step) * step; x < right; x += step) {
      if (x > left) points.push({ x, y: terrainYAt(x) });
    }
    if (right > left) points.push({ x: right, y: terrainYAt(right) });
    return points;
  }

  function terrainLiquidSurfaceY(pool, worldX) {
    const localX = worldX - pool.x;
    return pool.levelY +
      Math.sin(time * 3.2 + pool.waveOffset + localX * 0.055) * pool.waveAmp +
      Math.sin(time * 1.15 + pool.waveOffset * 1.7 + localX * 0.018) * 1.8;
  }

  function terrainPoolPolygons(pool, left = pool.x, right = pool.x + pool.w) {
    const start = Math.max(pool.x, left);
    const end = Math.min(pool.x + pool.w, right);
    if (end - start < 2) return [];

    const terrain = terrainPoints(start, end, TERRAIN_POOL_STEP);
    const polys = [];
    let surface = [];
    let ground = [];
    const wetThreshold = 1;
    const wetness = (p) => p.y - pool.levelY;
    const surfaceY = (p) => Math.min(terrainLiquidSurfaceY(pool, p.x), p.y - wetThreshold);
    const addPoint = (p) => {
      surface.push({ x: p.x, y: surfaceY(p) });
      ground.push({ x: p.x, y: p.y });
    };
    const addCrossing = (a, b, da, db) => {
      const denom = db - da;
      const t = Math.abs(denom) < 0.0001 ? 0.5 : clamp((wetThreshold - da) / denom, 0, 1);
      const x = a.x + (b.x - a.x) * t;
      addPoint({ x, y: terrainYAt(x) });
    };
    const finish = () => {
      if (surface.length >= 2) {
        polys.push({
          surface,
          ground,
          points: surface.concat([...ground].reverse()),
        });
      }
      surface = [];
      ground = [];
    };

    let prev = null;
    let prevWetness = 0;
    for (const p of terrain) {
      const d = wetness(p);
      if (d > wetThreshold) {
        if (prev && prevWetness <= wetThreshold) {
          addCrossing(prev, p, prevWetness, d);
        }
        addPoint(p);
      } else {
        if (prev && prevWetness > wetThreshold) {
          addCrossing(prev, p, prevWetness, d);
        }
        finish();
      }
      prev = p;
      prevWetness = d;
    }
    finish();
    return polys;
  }

  function terrainLiquidHitboxes(left = cameraX - 320, right = cameraX + W + 320) {
    const hitboxes = [];
    for (const pool of terrainPools) {
      if (pool.x > right || pool.x + pool.w < left) continue;
      for (const poly of terrainPoolPolygons(pool, left, right)) {
        hitboxes.push({ shape: 'polygon', kind: pool.type, points: poly.points });
      }
    }
    return hitboxes;
  }

  function terrainSolidHitbox(left = cameraX - 320, right = cameraX + W + 320) {
    const surface = terrainPoints(left, right, TERRAIN_STEP);
    const bottom = Math.max(LOST_BELOW_Y + 1000, cameraY + H + 1600);
    return {
      shape: 'polygon',
      kind: 'terrain',
      points: surface.concat([{ x: right, y: bottom }, { x: left, y: bottom }]),
    };
  }

  function pruneTerrain() {
    const cutoff = cameraX - TERRAIN_BUFFER * 2;
    while (terrainKnots.length > 8 && terrainKnots[3].x < cutoff) {
      terrainKnots.shift();
    }
    terrainPools = terrainPools.filter(pool => pool.x + pool.w > cutoff);
  }

  function obstacleHitboxes() {
    const hitboxes = [terrainSolidHitbox()];
    hitboxes.push(...terrainLiquidHitboxes());

    for (const o of obstacles) {
      if (o.type === 'saw') {
        hitboxes.push({
          shape: 'circle',
          kind: 'saw',
          x: o.x,
          y: o.y + Math.sin(time * 1.8 + o.phase) * o.bob,
          r: o.r * 0.86,
        });
      } else if (o.type === 'gate') {
        const open = 0.5 + 0.5 * Math.sin(time * o.speed + o.phase);
        const gap = o.gap * (0.75 + open * 0.40);
        const top = o.gapY - gap / 2;
        const bottom = o.gapY + gap / 2;
        hitboxes.push({ shape: 'rect', kind: 'gate', x: o.x, y: -GATE_EXTENT, w: o.w, h: top + GATE_EXTENT });
        hitboxes.push({ shape: 'rect', kind: 'gate', x: o.x, y: bottom, w: o.w, h: GATE_EXTENT });
      } else if (o.type === 'spikes') {
        for (let i = 0; i < o.count; i++) {
          hitboxes.push({ shape: 'polygon', kind: 'spikes', points: spikePolygon(o, i) });
        }
      }
    }
    return hitboxes;
  }

  function hitboxHitsPlayer(hitbox, playerBox) {
    if (hitbox.shape === 'circle') {
      return hypot(playerBox.x - hitbox.x, playerBox.y - hitbox.y) < playerBox.r + hitbox.r;
    }
    if (hitbox.shape === 'rect') {
      return circleRect(playerBox.x, playerBox.y, playerBox.r, hitbox.x, hitbox.y, hitbox.w, hitbox.h);
    }
    if (hitbox.shape === 'polygon') {
      return circlePolygon(playerBox.x, playerBox.y, playerBox.r, hitbox.points);
    }
    return false;
  }

  function hitsObstacle() {
    const playerBoxes = playerHitboxes();
    return obstacleHitboxes().some(hitbox => playerBoxes.some(p => hitboxHitsPlayer(hitbox, p)));
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    if (rw <= 0 || rh <= 0) return false;
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    return hypot(cx - nx, cy - ny) < cr;
  }

  function spikeTri(x, y, size, dir, height = size) {
    if (dir < 0) {
      return [{ x, y }, { x: x + size, y }, { x: x + size / 2, y: y - height }];
    }
    return [{ x, y }, { x: x + size, y }, { x: x + size / 2, y: y + height }];
  }

  function groundSpikeTri(x, size, height) {
    const midX = x + size / 2;
    const sample = Math.max(6, size * 0.35);
    const slope = (terrainYAt(midX + sample) - terrainYAt(midX - sample)) / (sample * 2);
    const inv = 1 / Math.hypot(slope, 1);
    const nx = slope * inv;
    const ny = -inv;
    return [
      { x, y: terrainYAt(x) + SPIKE_GROUND_INSET },
      { x: x + size, y: terrainYAt(x + size) + SPIKE_GROUND_INSET },
      { x: midX + nx * height * 0.18, y: terrainYAt(midX) + ny * height },
    ];
  }

  function spikePolygon(o, i) {
    const x = o.x + i * o.size;
    if (o.ground) {
      return groundSpikeTri(x, o.size, o.height || o.size * 1.6);
    }
    return spikeTri(x, o.y, o.size, o.dir, o.height || o.size);
  }

  function circlePolygon(cx, cy, r, points) {
    if (pointInPolygon({ x: cx, y: cy }, points)) return true;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (distToSegment(cx, cy, a.x, a.y, b.x, b.y) < r) return true;
    }
    return false;
  }

  function pointInPolygon(p, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      const crosses = (a.y > p.y) !== (b.y > p.y);
      if (crosses) {
        const x = (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x;
        if (p.x < x) inside = !inside;
      }
    }
    return inside;
  }

  function distToSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const c = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
    return hypot(px - (ax + vx * c), py - (ay + vy * c));
  }

  function sx(x) { return x - cameraX; }
  function sy(y) { return y - cameraY; }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, screenW, screenH);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, screenW, screenH);

    ctx.setTransform(DPR * viewportScale, 0, 0, DPR * viewportScale, DPR * viewportX, DPR * viewportY);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    drawBackground();
    drawTerrain();
    drawObstacles();
    drawAnchors();
    drawRopeAndPlayer();
    if (DEBUG_HITBOXES) drawDebugHitboxes();

    if (gameOver) drawCrashCard();
  }

  function drawDebugHitboxes() {
    const drawPath = (hitbox) => {
      ctx.beginPath();
      if (hitbox.shape === 'circle') {
        ctx.arc(sx(hitbox.x), sy(hitbox.y), hitbox.r, 0, Math.PI * 2);
      } else if (hitbox.shape === 'rect') {
        ctx.rect(sx(hitbox.x), sy(hitbox.y), hitbox.w, hitbox.h);
      } else if (hitbox.shape === 'polygon') {
        const [first, ...rest] = hitbox.points;
        ctx.moveTo(sx(first.x), sy(first.y));
        for (const p of rest) ctx.lineTo(sx(p.x), sy(p.y));
        ctx.closePath();
      }
    };

    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);

    const playerBoxes = playerHitboxes();
    for (const playerBox of playerBoxes) {
      drawPath(playerBox);
      ctx.fillStyle = 'rgba(0, 95, 255, 0.14)';
      ctx.strokeStyle = '#005fff';
      ctx.fill();
      ctx.stroke();
    }

    for (const hitbox of obstacleHitboxes()) {
      const hit = playerBoxes.some(playerBox => hitboxHitsPlayer(hitbox, playerBox));
      drawPath(hitbox);
      ctx.fillStyle = hit ? 'rgba(255, 0, 0, 0.28)' : 'rgba(255, 0, 160, 0.10)';
      ctx.strokeStyle = hit ? '#ff0000' : '#ff0099';
      ctx.fill();
      ctx.stroke();
    }

    // Lost-state threshold is not a collision hitbox, but it is useful in
    // debug mode because it explains the below-world death condition.
    ctx.strokeStyle = '#ff8a00';
    ctx.setLineDash([14, 9]);
    ctx.beginPath();
    ctx.moveTo(0, sy(LOST_BELOW_Y));
    ctx.lineTo(W, sy(LOST_BELOW_Y));
    ctx.stroke();

    ctx.restore();
  }

  function drawBackground() {
    ctx.save();
    for (const s of bgShapes) {
      const x = s.x - cameraX * s.layer;
      const y = s.y - cameraY * s.layer * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.rot + time * 0.02 * (s.layer + 0.3));
      ctx.strokeStyle = s.shade;
      ctx.fillStyle = 'transparent';
      ctx.lineWidth = 2;
      if (s.sides === 0) {
        ctx.strokeRect(-s.size / 2, -s.size / 2, s.size, s.size);
      } else if (s.sides === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, s.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.sides === 2) {
        ctx.beginPath();
        ctx.moveTo(0, -s.size / 2);
        ctx.lineTo(s.size / 2, s.size / 2);
        ctx.lineTo(-s.size / 2, s.size / 2);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-s.size / 2, 0);
        ctx.lineTo(s.size / 2, 0);
        ctx.moveTo(0, -s.size / 2);
        ctx.lineTo(0, s.size / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawTerrain() {
    const left = cameraX - 260;
    const right = cameraX + W + 260;
    const surface = terrainPoints(left, right, TERRAIN_STEP);

    ctx.save();

    for (const pool of terrainPools) {
      if (pool.x > right || pool.x + pool.w < left) continue;
      drawTerrainPool(pool, left, right);
    }

    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < surface.length; i++) {
      const p = surface[i];
      if (i === 0) ctx.moveTo(sx(p.x), sy(p.y));
      else ctx.lineTo(sx(p.x), sy(p.y));
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawTerrainPool(pool, left, right) {
    const isLava = pool.type === 'lava';
    const fill = isLava ? LAVA : WATER;
    const line = isLava ? LAVA_LINE : WATER_LINE;
    const bodies = terrainPoolPolygons(pool, left, right);

    ctx.save();
    for (const body of bodies) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = line;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      for (let i = 0; i < body.points.length; i++) {
        const p = body.points[i];
        if (i === 0) ctx.moveTo(sx(p.x), sy(p.y));
        else ctx.lineTo(sx(p.x), sy(p.y));
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();

      ctx.strokeStyle = line;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < body.surface.length; i++) {
        const p = body.surface[i];
        if (i === 0) ctx.moveTo(sx(p.x), sy(p.y));
        else ctx.lineTo(sx(p.x), sy(p.y));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAnchors() {
    for (const a of anchors) {
      const x = sx(a.x);
      if (x < -50 || x > W + 80) continue;
      const isFocus = a === focusedAnchor;
      const isLocked = a === lockedAnchor;
      ctx.save();
      ctx.translate(x, sy(a.y));
      ctx.lineWidth = isLocked ? 5 : 2;
      ctx.strokeStyle = (isLocked || isFocus) ? ROPE : INK;
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, isLocked ? 15 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-15, -15);
      ctx.lineTo(15, 15);
      ctx.moveTo(15, -15);
      ctx.lineTo(-15, 15);
      ctx.stroke();
      ctx.restore();
    }

    if (!player.attached && focusedAnchor && !ropeShot) {
      const hookHand = hookHandPosition();
      const d = hypot(focusedAnchor.x - player.x, focusedAnchor.y - player.y);
      ctx.save();
      ctx.strokeStyle = d <= HOOK_RANGE ? ROPE : '#bbbbbb';
      ctx.globalAlpha = d <= HOOK_RANGE ? 0.85 : 0.35;
      const isLockedTarget = focusedAnchor === lockedAnchor;
      ctx.lineWidth = isLockedTarget ? 3 : 2;
      ctx.setLineDash(d <= HOOK_RANGE ? [9, 7] : [4, 10]);
      ctx.beginPath();
      ctx.moveTo(sx(hookHand.x), sy(hookHand.y));
      ctx.lineTo(sx(focusedAnchor.x), sy(focusedAnchor.y));
      ctx.stroke();
      ctx.setLineDash([]);
      if (isLockedTarget) {
        ctx.fillStyle = d <= HOOK_RANGE ? ROPE : '#bbbbbb';
        ctx.beginPath();
        ctx.arc(sx(focusedAnchor.x), sy(focusedAnchor.y), 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === 'gate') drawGate(o);
      else if (o.type === 'saw') drawSaw(o);
      else if (o.type === 'spikes') drawSpikes(o);
    }
  }

  function drawGate(o) {
    const x = sx(o.x);
    const open = 0.5 + 0.5 * Math.sin(time * o.speed + o.phase);
    const gap = o.gap * (0.75 + open * 0.40);
    const top = o.gapY - gap / 2;
    const bottom = o.gapY + gap / 2;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.fillStyle = PAPER;
    drawBar(x, -GATE_EXTENT, o.w, top + GATE_EXTENT);
    drawBar(x, bottom, o.w, GATE_EXTENT);
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 14, sy(top));
    ctx.lineTo(x + o.w + 14, sy(top));
    ctx.moveTo(x - 14, sy(bottom));
    ctx.lineTo(x + o.w + 14, sy(bottom));
    ctx.stroke();
    ctx.restore();
  }

  function drawBar(x, y, w, h) {
    if (h <= 0) return;
    ctx.fillRect(x, sy(y), w, h);
    ctx.strokeRect(x, sy(y), w, h);
    for (let yy = y + 14; yy < y + h; yy += 22) {
      ctx.beginPath();
      ctx.moveTo(x, sy(yy));
      ctx.lineTo(x + w, sy(yy - 12));
      ctx.stroke();
    }
  }

  function drawSaw(o) {
    const x = sx(o.x);
    const y = sy(o.y + Math.sin(time * 1.8 + o.phase) * o.bob);
    const rot = time * 8 * o.spin;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = SAW;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const teeth = 14;
    for (let i = 0; i < teeth * 2; i++) {
      const a = i / (teeth * 2) * Math.PI * 2;
      const r = i % 2 === 0 ? o.r : o.r * 0.72;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, o.r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSpikes(o) {
    ctx.save();
    ctx.fillStyle = SPIKE;
    ctx.strokeStyle = SPIKE;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < o.count; i++) {
      const tri = spikePolygon(o, i);
      ctx.beginPath();
      ctx.moveTo(sx(tri[0].x), sy(tri[0].y));
      ctx.lineTo(sx(tri[1].x), sy(tri[1].y));
      ctx.lineTo(sx(tri[2].x), sy(tri[2].y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRopeAndPlayer() {
    if (player.attached && player.anchor) {
      const ropeEnd = hookHandPosition();
      ctx.save();
      ctx.strokeStyle = ROPE;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx(player.anchor.x), sy(player.anchor.y));
      ctx.lineTo(sx(ropeEnd.x), sy(ropeEnd.y));
      ctx.stroke();

      if (ropeShot && ropeShot.anchor === player.anchor) {
        const p = clamp(ropeShot.t / ropeShot.duration, 0, 1);
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 8 - p * 4;
        ctx.beginPath();
        ctx.moveTo(sx(player.anchor.x), sy(player.anchor.y));
        ctx.lineTo(sx(ropeEnd.x), sy(ropeEnd.y));
        ctx.stroke();
        ctx.globalAlpha = 0.8 - p * 0.5;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx(player.anchor.x), sy(player.anchor.y), 13 + p * 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    } else if (ropeShot && ropeShot.anchor) {
      const p = clamp(ropeShot.t / ropeShot.duration, 0, 1);
      const hookHand = hookHandPosition();
      const tipX = hookHand.x + (ropeShot.anchor.x - hookHand.x) * p;
      const tipY = hookHand.y + (ropeShot.anchor.y - hookHand.y) * p;
      ctx.save();
      const dx = ropeShot.anchor.x - hookHand.x;
      const dy = ropeShot.anchor.y - hookHand.y;
      const len = Math.max(1, hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const noseX = tipX;
      const noseY = tipY;
      const notchX = tipX - ux * 14;
      const notchY = tipY - uy * 14;
      const baseX = tipX - ux * 23;
      const baseY = tipY - uy * 23;
      const halfW = 6.5;

      ctx.strokeStyle = ROPE;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx(hookHand.x), sy(hookHand.y));
      ctx.lineTo(sx(notchX), sy(notchY));
      ctx.stroke();

      ctx.fillStyle = '#777777';
      ctx.strokeStyle = '#777777';
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(sx(noseX), sy(noseY));
      ctx.lineTo(sx(baseX + px * halfW), sy(baseY + py * halfW));
      ctx.lineTo(sx(notchX), sy(notchY));
      ctx.lineTo(sx(baseX - px * halfW), sy(baseY - py * halfW));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    drawStickman();
  }

  function makeRagdollJoint(x, y) {
    return { x, y, oldX: x - player.vx / 60, oldY: y - player.vy / 60, pinned: false };
  }

  function ragdollBasis() {
    let ux = 0;
    let uy = 1;

    if (player.attached && player.anchor) {
      const dx = player.x - player.anchor.x;
      const dy = player.y - player.anchor.y;
      const d = Math.max(1, hypot(dx, dy));
      ux = dx / d;
      uy = dy / d;
    } else if (ragdoll.initialized && ragdoll.joints.shoulder) {
      const dx = ragdoll.joints.shoulder.x - player.x;
      const dy = ragdoll.joints.shoulder.y - player.y;
      const d = Math.max(1, hypot(dx, dy));
      ux = dx / d;
      uy = dy / d;
    }

    return { ux, uy, tx: -uy, ty: ux };
  }

  function initializeRagdoll() {
    const { ux, uy, tx, ty } = ragdollBasis();
    const p = (along, side) => makeRagdollJoint(player.x + ux * along + tx * side, player.y + uy * along + ty * side);
    ragdoll.joints = {
      handL: p(0, 0),
      handR: p(58, 28),
      elbowL: p(15, -12),
      elbowR: p(45, 15),
      shoulder: p(32, 0),
      neck: p(29, 10),
      head: p(28, 23),
      hip: p(75, 0),
      kneeL: p(101, -17),
      footL: p(129, -22),
      kneeR: p(101, 17),
      footR: p(129, 22),
    };
    ragdoll.initialized = true;
    pinRagdollHands(1 / 60);
  }

  function pinJoint(j, x, y, dt) {
    j.pinned = true;
    j.x = x;
    j.y = y;
    j.oldX = x - player.vx * dt;
    j.oldY = y - player.vy * dt;
  }

  function pinRagdollHands(dt) {
    const j = ragdoll.joints;
    // Keep the body tethered to the physics point. When free-flying, the
    // rendered hook hand can aim independently toward the focused anchor.
    pinJoint(j.handL, player.x, player.y, dt);
  }

  function solveRagdollDistance(a, b, target, stiffness = 1) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.max(0.0001, hypot(dx, dy));
    const imA = a.pinned ? 0 : 1;
    const imB = b.pinned ? 0 : 1;
    const im = imA + imB;
    if (!im) return;
    const correction = (d - target) / d * stiffness;
    const ox = dx * correction;
    const oy = dy * correction;
    a.x += ox * (imA / im);
    a.y += oy * (imA / im);
    b.x -= ox * (imB / im);
    b.y -= oy * (imB / im);
  }

  function solveRagdollConstraints() {
    const j = ragdoll.joints;
    solveRagdollDistance(j.handL, j.elbowL, 19, 1);
    solveRagdollDistance(j.elbowL, j.shoulder, 19, 1);
    solveRagdollDistance(j.handR, j.elbowR, 19, 0.95);
    solveRagdollDistance(j.elbowR, j.shoulder, 19, 0.95);

    // Cross-braces keep the gripping side readable. The off arm is left
    // unpinned so it can trail like a real loose ragdoll limb.
    solveRagdollDistance(j.handL, j.shoulder, 38, 0.65);
    solveRagdollDistance(j.handL, j.hip, 75, 0.18);

    solveRagdollDistance(j.shoulder, j.hip, 43, 1);

    // Neck/head attachment: the head is still a separate mass, but it is
    // strongly tied to a neck joint on the shoulder line so it cannot drift
    // away and become a trailing limb.
    solveRagdollDistance(j.shoulder, j.neck, 10, 1);
    solveRagdollDistance(j.neck, j.head, 13, 1);
    solveRagdollDistance(j.shoulder, j.head, 23, 0.95);
    solveRagdollDistance(j.hip, j.head, 58, 0.45);

    solveRagdollDistance(j.hip, j.kneeL, 29, 1);
    solveRagdollDistance(j.kneeL, j.footL, 30, 1);
    solveRagdollDistance(j.hip, j.kneeR, 29, 1);
    solveRagdollDistance(j.kneeR, j.footR, 30, 1);
    solveRagdollDistance(j.hip, j.footL, 58, 0.22);
    solveRagdollDistance(j.hip, j.footR, 58, 0.22);
    solveRagdollDistance(j.kneeL, j.kneeR, 30, 0.35);
    solveRagdollDistance(j.footL, j.footR, 46, 0.12);
  }

  function updateRagdoll(dt) {
    if (!ragdoll.initialized) initializeRagdoll();

    let j = ragdoll.joints;
    if (!Number.isFinite(j.shoulder.x) || hypot(j.shoulder.x - player.x, j.shoulder.y - player.y) > 260) {
      initializeRagdoll();
      j = ragdoll.joints;
    }

    dt = clamp(dt, 0, 1 / 30);
    const gravityStep = GRAVITY * 0.55 * dt * dt;
    const damping = Math.exp(-3.1 * dt);

    for (const joint of Object.values(ragdoll.joints)) {
      joint.pinned = false;
      if (joint === j.handL) continue;
      const vx = (joint.x - joint.oldX) * damping;
      const vy = (joint.y - joint.oldY) * damping;
      joint.oldX = joint.x;
      joint.oldY = joint.y;
      joint.x += vx;
      joint.y += vy + gravityStep;
    }

    for (let i = 0; i < 14; i++) {
      pinRagdollHands(dt);
      solveRagdollConstraints();
    }
    pinRagdollHands(dt);
    stickmanCorePose(true);
  }

  function stickmanCorePose(updateVisualSide = false) {
    if (!ragdoll.initialized) initializeRagdoll();
    const j = ragdoll.joints;
    const headR = 13;
    const grip = hookHandPosition();
    const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
    const mul = (v, s) => ({ x: v.x * s, y: v.y * s });
    const norm = (v, fallback = { x: 0, y: 1 }) => {
      const d = hypot(v.x, v.y);
      return d > 0.0001 ? { x: v.x / d, y: v.y / d } : fallback;
    };

    const shoulder = j.shoulder;
    const hip = j.hip;
    const body = norm({ x: hip.x - shoulder.x, y: hip.y - shoulder.y });
    const sideBase = { x: -body.y, y: body.x };
    const gripSide = (grip.x - shoulder.x) * sideBase.x + (grip.y - shoulder.y) * sideBase.y;
    const desiredSide = gripSide > 0 ? -1 : 1;
    if (ragdoll.visualSide == null) {
      ragdoll.visualSide = desiredSide;
    } else if (updateVisualSide) {
      ragdoll.visualSide += (desiredSide - ragdoll.visualSide) * 0.18;
    }
    const side = mul(sideBase, clamp(ragdoll.visualSide, -1, 1));
    const head = add(add(shoulder, mul(body, -5)), mul(side, headR + 4));
    const headDir = norm({ x: head.x - shoulder.x, y: head.y - shoulder.y }, side);
    const neckEnd = add(head, mul(headDir, -headR));
    return { body, side, shoulder, hip, head, neckEnd, headR, grip };
  }

  function drawStickman() {
    if (!ragdoll.initialized) initializeRagdoll();
    const j = ragdoll.joints;
    const headR = 13;
    const speed = hypot(player.vx, player.vy);
    const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
    const mul = (v, s) => ({ x: v.x * s, y: v.y * s });
    const norm = (v, fallback = { x: 0, y: 1 }) => {
      const d = hypot(v.x, v.y);
      return d > 0.0001 ? { x: v.x / d, y: v.y / d } : fallback;
    };
    const line = (a, b) => {
      ctx.moveTo(sx(a.x), sy(a.y));
      ctx.lineTo(sx(b.x), sy(b.y));
    };

    // Render a side-profile stickman. The ragdoll supplies inertia, but the
    // silhouette is art-directed: both arms are upper/lower line segments,
    // the gripping arm is kept nearly straight, and legs stay readable.
    const core = stickmanCorePose(false);
    const { body, side, shoulder, hip, head, neckEnd, grip } = core;

    const trail = norm({ x: -player.vx * 0.045, y: -player.vy * 0.045 + 16 }, body);
    const speedT = clamp(speed / 1200, 0, 1);
    const upsideT = player.attached && player.anchor ? clamp(-(player.y - player.anchor.y) / Math.max(1, player.ropeLength), 0, 1) : 0;
    const tuck = clamp(speedT * 0.35 + upsideT * 0.55, 0, 1);

    const kneePoseA = add(add(add(hip, mul(body, 22 - tuck * 8)), mul(side, -15 - tuck * 6)), mul(trail, 8 + speedT * 8));
    const footPoseA = add(add(add(kneePoseA, mul(body, 25 - tuck * 12)), mul(side, -13 + tuck * 20)), mul(trail, 10 + speedT * 13));
    const kneePoseB = add(add(add(hip, mul(body, 20 - tuck * 6)), mul(side, 13 - tuck * 4)), mul(trail, 6 + speedT * 6));
    const footPoseB = add(add(add(kneePoseB, mul(body, 24 - tuck * 10)), mul(side, 13 - tuck * 19)), mul(trail, 9 + speedT * 10));
    const kneeA = mix(j.kneeL, kneePoseA, 0.62);
    const footA = mix(j.footL, footPoseA, 0.62);
    const kneeB = mix(j.kneeR, kneePoseB, 0.62);
    const footB = mix(j.footR, footPoseB, 0.62);
    // Draw both arms with the same apparent length. The gripping arm is
    // locked straight under rope tension, with its elbow exactly halfway
    // between shoulder and hand. The free arm uses the same shoulder-hand
    // reach and the same half-way elbow so neither arm reads longer.
    const armReach = Math.max(2, hypot(grip.x - shoulder.x, grip.y - shoulder.y));
    const freeArmDir = norm(
      { x: j.handR.x - shoulder.x, y: j.handR.y - shoulder.y },
      norm({ x: body.x * 0.65 - side.x * 0.8, y: body.y * 0.65 - side.y * 0.8 }, body)
    );
    const gripElbow = mix(shoulder, grip, 0.5);
    const freeHand = add(shoulder, mul(freeArmDir, armReach));
    const freeElbow = mix(shoulder, freeHand, 0.5);

    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = PAPER;
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    line(shoulder, freeElbow);
    line(freeElbow, freeHand);
    line(shoulder, gripElbow);
    line(gripElbow, grip);
    line(shoulder, neckEnd);
    line(shoulder, hip);
    line(hip, kneeA);
    line(kneeA, footA);
    line(hip, kneeB);
    line(kneeB, footB);
    ctx.stroke();

    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(sx(head.x), sy(head.y), headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(sx(grip.x), sy(grip.y), 4, 0, Math.PI * 2);
    ctx.arc(sx(freeHand.x), sy(freeHand.y), 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawCrashCard() {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = 'rgba(255, 253, 247, 0.94)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillRect(-190, -72, 380, 144);
    ctx.strokeRect(-190, -72, 380, 144);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = '900 30px "Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive';
    ctx.fillText('CRASH', 0, -20);
    ctx.font = '14px "Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive';
    ctx.fillText('press space / click / tap to restart', 0, 18);
    ctx.fillText('timing hint: release low, hook high', 0, 44);
    ctx.restore();
  }

  function frame(ts) {
    if (!last) last = ts;
    const dt = Math.min(0.033, (ts - last) / 1000);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  setupMobileZoomGuard();
  setupTouchControls();
  resize();
  reset();
  bestEl.textContent = best;
  requestAnimationFrame(frame);
})();
