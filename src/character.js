// Hook arm, ragdoll simulation, and player hitboxes.

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

function characterRopeRenderStyle() {
  const renderStyle = typeof characterRenderStyle === 'function' ? characterRenderStyle() : null;
  return renderStyle && renderStyle.ropeStyle ? renderStyle.ropeStyle : 'line';
}

function drawWebRopeLine(a, b, width = 4, options = {}) {
  const x0 = sx(a.x);
  const y0 = sy(a.y);
  const x1 = sx(b.x);
  const y1 = sy(b.y);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const amp = clamp(width * 2.05, 5.5, 10.5);
  const wavelength = 56;
  const connectorSpacing = 46;
  const phase = Number.isFinite(Number(options.phase)) ? Number(options.phase) : 0;
  const steps = Math.max(14, Math.min(90, Math.ceil(len / 11)));

  // Keep the web phase anchored to distance from the start of the rope.
  // This makes the pattern extend/clip as the rope length changes instead of
  // re-fitting the whole wave to the new endpoint every frame.
  const webPointAtDistance = (distance, offsetPhase = 0, scale = 1) => {
    const s = clamp(distance, 0, len);
    const wave = Math.sin((s / wavelength) * Math.PI * 2 + phase + offsetPhase) * amp * scale;
    return {
      x: x0 + ux * s + px * wave,
      y: y0 + uy * s + py * wave,
    };
  };

  const strokeWave = (offsetPhase, lineWidth, alpha, scale = 1) => {
    const savedAlpha = ctx.globalAlpha;
    ctx.globalAlpha = savedAlpha * alpha;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const p = webPointAtDistance((len * i) / steps, offsetPhase, scale);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalAlpha = savedAlpha;
  };

  ctx.save();
  ctx.strokeStyle = ROPE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (options.alpha !== undefined) ctx.globalAlpha *= options.alpha;

  strokeWave(0, width + 1.8, 0.95, 0.92);
  strokeWave(Math.PI, Math.max(2.8, width), 0.86, 0.84);

  const savedConnectorAlpha = ctx.globalAlpha;
  ctx.globalAlpha = savedConnectorAlpha * 0.9;
  ctx.lineWidth = Math.max(2.4, width - 0.8);
  ctx.beginPath();
  let connectorIndex = 0;
  for (let s0 = connectorSpacing * 0.18; s0 < len - connectorSpacing * 0.18; s0 += connectorSpacing) {
    const s1 = Math.min(len, s0 + connectorSpacing * 0.56);
    const side = connectorIndex % 2 === 0 ? 1 : -1;
    const p0 = webPointAtDistance(s0, side > 0 ? 0 : Math.PI, 0.9);
    const p1 = webPointAtDistance(s1, side > 0 ? Math.PI : 0, 0.9);
    const sc = (s0 + s1) * 0.5;
    const cx = x0 + ux * sc + px * amp * 1.28 * side;
    const cy = y0 + uy * sc + py * amp * 1.28 * side;
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(cx, cy, p1.x, p1.y);
    connectorIndex += 1;
  }
  ctx.stroke();
  ctx.globalAlpha = savedConnectorAlpha;

  if (options.knotStart || options.knotEnd) {
    ctx.globalAlpha *= 0.82;
    ctx.lineWidth = Math.max(2.6, width - 0.5);
    const drawKnot = (x, y, dir) => {
      const r = Math.max(7, amp * 0.75);
      ctx.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const side = i % 2 === 0 ? 1 : -1;
        ctx.moveTo(x + ux * r * 0.25 * dir, y + uy * r * 0.25 * dir);
        ctx.quadraticCurveTo(
          x + px * r * side + ux * r * (0.55 + i * 0.08) * dir,
          y + py * r * side + uy * r * (0.55 + i * 0.08) * dir,
          x + px * r * -side * 0.55 + ux * r * (1.05 + i * 0.1) * dir,
          y + py * r * -side * 0.55 + uy * r * (1.05 + i * 0.1) * dir,
        );
      }
      ctx.stroke();
    };
    if (options.knotStart) drawKnot(x0, y0, 1);
    if (options.knotEnd) drawKnot(x1, y1, -1);
  }

  ctx.restore();
}

function drawCharacterRopeLine(a, b, width = 4, options = {}) {
  if (characterRopeRenderStyle() === 'web') {
    drawWebRopeLine(a, b, width, options);
    return;
  }
  ctx.strokeStyle = ROPE;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx(a.x), sy(a.y));
  ctx.lineTo(sx(b.x), sy(b.y));
  ctx.stroke();
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


function drawRopeAndPlayer() {
  if (player.attached && player.anchor) {
    const ropeEnd = hookHandPosition();
    ctx.save();
    drawCharacterRopeLine(player.anchor, ropeEnd, 4, { knotStart: true });

    if (ropeShot && ropeShot.anchor === player.anchor) {
      const p = clamp(ropeShot.t / ropeShot.duration, 0, 1);
      ctx.globalAlpha = 1 - p;
      drawCharacterRopeLine(player.anchor, ropeEnd, 8 - p * 4, { knotStart: true });
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

    ctx.globalAlpha = 0.9;
    drawCharacterRopeLine(hookHand, { x: notchX, y: notchY }, 3, { knotEnd: true });

    const hookColor = typeof characterHookColor === 'function' ? characterHookColor() : MUTED_LINE;
    ctx.fillStyle = hookColor;
    ctx.strokeStyle = hookColor;
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

