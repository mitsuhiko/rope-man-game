// Stickman drawing and character customization slots.

const CHARACTER_HATS = {
  'top-hat': { src: 'hats/top-hat.png', width: 42, height: 39, up: 28, side: 0 },
  crown: { src: 'hats/crown.png', width: 40, height: 30, up: 27, side: 0 },
  helmet: { src: 'hats/helmet.png', width: 42, height: 42, up: 14, side: 0 },
  'party-hat': { src: 'hats/party-hat.png', width: 38, height: 52, up: 33, side: 0 },
  'wizard-hat': { src: 'hats/wizard-hat.png', width: 50, height: 46, up: 33, side: 1 },
};
const characterAccessoryImages = {};

function setCharacterAppearance(nextAppearance = {}) {
  Object.assign(characterAppearance, nextAppearance);
  preloadCharacterAppearance();
}

function preloadCharacterAppearance() {
  const hat = characterAppearance.hat && CHARACTER_HATS[characterAppearance.hat];
  if (!hat || characterAccessoryImages[characterAppearance.hat]) return;
  const img = new Image();
  img.src = hat.src;
  characterAccessoryImages[characterAppearance.hat] = img;
}

function drawOrientedImage(img, center, xAxis, yAxis, width, height) {
  ctx.save();
  ctx.transform(
    xAxis.x * width,
    xAxis.y * width,
    yAxis.x * height,
    yAxis.y * height,
    sx(center.x),
    sy(center.y),
  );
  ctx.drawImage(img, -0.5, -0.5, 1, 1);
  ctx.restore();
}

function roundedRectPath(x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function withCharacterTransform(origin, xAxis, yAxis, drawPart) {
  ctx.save();
  ctx.transform(xAxis.x, xAxis.y, yAxis.x, yAxis.y, sx(origin.x), sy(origin.y));
  drawPart();
  ctx.restore();
}

function drawCharacterBackpack(core) {
  if (!characterAppearance.backpack) return;
  const { body, side, shoulder, hip } = core;
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (v, s) => ({ x: v.x * s, y: v.y * s });
  const center = add(mix(shoulder, hip, 0.48), mul(side, -15));

  withCharacterTransform(center, side, body, () => {
    ctx.fillStyle = '#8f6339';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    roundedRectPath(-10, -20, 21, 40, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6f4a2c';
    roundedRectPath(-7, -14, 15, 12, 4);
    ctx.fill();
    ctx.stroke();
  });
}

function drawPrimitiveHat(core) {
  const { body, side, head, headR } = core;
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (v, s) => ({ x: v.x * s, y: v.y * s });
  const top = add(head, mul(body, -headR * 0.95));

  withCharacterTransform(top, side, body, () => {
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    roundedRectPath(-15, -19, 30, 18, 3);
    ctx.fill();
    ctx.stroke();
    roundedRectPath(-23, -3, 46, 8, 4);
    ctx.fill();
    ctx.stroke();
  });
}

function drawCharacterHat(core) {
  const hatId = characterAppearance.hat;
  if (!hatId) return;
  const spec = CHARACTER_HATS[hatId];
  if (!spec) {
    drawPrimitiveHat(core);
    return;
  }

  const { body, side, head } = core;
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (v, s) => ({ x: v.x * s, y: v.y * s });
  const center = add(add(head, mul(body, -spec.up)), mul(side, spec.side || 0));
  const img = characterAccessoryImages[hatId];
  if (img && img.complete && img.naturalWidth > 0) {
    drawOrientedImage(img, center, side, body, spec.width, spec.height);
  } else {
    preloadCharacterAppearance();
    drawPrimitiveHat(core);
  }
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

  drawCharacterBackpack(core);

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

  drawCharacterHat(core);

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(sx(grip.x), sy(grip.y), 4, 0, Math.PI * 2);
  ctx.arc(sx(freeHand.x), sy(freeHand.y), 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

preloadCharacterAppearance();
