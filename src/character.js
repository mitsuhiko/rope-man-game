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

    ctx.fillStyle = MUTED_LINE;
    ctx.strokeStyle = MUTED_LINE;
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

