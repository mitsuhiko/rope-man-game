// Stickman drawing and character customization slots.

const CHARACTER_HATS = {
  'backward-cap': { src: 'assets/hats/backward-cap.png', label: 'backward cap', width: 32, height: 22, up: 13, side: 0 },
  balaclava: { src: 'assets/hats/balaclava.png', label: 'balaclava', width: 38, height: 52, up: 1, side: 0 },
  bandana: { src: 'assets/hats/bandana.png', label: 'bandana', width: 44, height: 31, up: 6, side: 4 },
  'baseball-cap-side': { src: 'assets/hats/baseball-cap-side.png', label: 'side cap', width: 48, height: 32, up: 11, side: -5 },
  'baseball-cap': { src: 'assets/hats/baseball-cap.png', label: 'baseball cap', width: 43, height: 28, up: 12, side: -1 },
  'beaded-necklace': { src: 'assets/hats/beaded-necklace.png', label: 'beaded necklace', width: 27, height: 20, up: -2, side: 0 },
  'bird-mask': { src: 'assets/hats/bird-mask.png', label: 'bird mask', width: 20, height: 14, up: -6, side: 0 },
  bonnet: { src: 'assets/hats/bonnet.png', label: 'bonnet', width: 42, height: 60, up: 8, side: 0 },
  'bucket-hat': { src: 'assets/hats/bucket-hat.png', label: 'bucket hat', width: 44, height: 30, up: 20, side: 0 },
  'bushy-mustache': { src: 'assets/hats/bushy-mustache.png', label: 'bushy mustache', width: 40, height: 17, up: -7, side: 0 },
  'cowboy-hat': { src: 'assets/hats/cowboy-hat.png', label: 'cowboy hat', width: 50, height: 31, up: 20, side: 0 },
  crown: { src: 'assets/hats/crown.png', label: 'crown', width: 40, height: 30, up: 18, side: 0 },
  'curled-mustache': { src: 'assets/hats/curled-mustache.png', label: 'curled mustache', width: 42, height: 16, up: -7, side: 0 },
  'curly-hair': { src: 'assets/hats/curly-hair.png', label: 'curly hair', width: 48, height: 38, up: 12, side: 0 },
  'darth-vader-mask': { src: 'assets/hats/darth-vader-mask.png', label: 'vader mask', width: 54, height: 48, up: 0, side: 0 },
  dreadlocks: { src: 'assets/hats/dreadlocks.png', label: 'dreadlocks', width: 38, height: 46, up: 0, side: 0 },
  'feather-headband': { src: 'assets/hats/feather-headband.png', label: 'feather headband', width: 35, height: 34, up: 8, side: 0 },
  flame: { src: 'assets/hats/flame.png', label: 'flame', width: 32, height: 45, up: 32, side: 0 },
  'flame-hair': { src: 'assets/hats/flame-hair.png', label: 'flame hair', width: 42, height: 50, up: 25, side: 0 },
  'frog-face': { src: 'assets/hats/frog-face.png', label: 'frog face', width: 43, height: 27, up: 0, side: 0 },
  'full-beard': { src: 'assets/hats/full-beard.png', label: 'full beard', width: 42, height: 38, up: -22, side: 0 },
  'gentleman-mustache': { src: 'assets/hats/gentleman-mustache.png', label: 'gentleman mustache', width: 42, height: 23, up: -12, side: 0 },
  goatee: { src: 'assets/hats/goatee.png', label: 'goatee', width: 22, height: 31, up: -18, side: 0 },
  halo: { src: 'assets/hats/halo.png', label: 'halo', width: 42, height: 18, up: 31, side: 0 },
  'handlebar-mustache': { src: 'assets/hats/handlebar-mustache.png', label: 'handlebar mustache', width: 44, height: 20, up: -8, side: 0 },
  headset: { src: 'assets/hats/headset.png', label: 'headset', width: 45, height: 43, up: 2, side: 0 },
  helmet: { src: 'assets/hats/helmet.png', label: 'helmet', width: 42, height: 42, up: 8, side: 0 },
  'horned-headband': { src: 'assets/hats/horned-headband.png', label: 'horned headband', width: 37, height: 25, up: 10, side: 0 },
  'horseshoe-mustache': { src: 'assets/hats/horseshoe-mustache.png', label: 'horseshoe mustache', width: 34, height: 25, up: -9, side: 0 },
  'jagged-beard': { src: 'assets/hats/jagged-beard.png', label: 'jagged beard', width: 32, height: 26, up: -10, side: 0 },
  'jester-hat': { src: 'assets/hats/jester-hat.png', label: 'jester hat', width: 50, height: 35, up: 18, side: 0 },
  'long-beard': { src: 'assets/hats/long-beard.png', label: 'long beard', width: 32, height: 44, up: -25, side: 0 },
  'long-hair': { src: 'assets/hats/long-hair.png', label: 'long hair', width: 39, height: 45, up: 0, side: 0 },
  'messy-hair': { src: 'assets/hats/messy-hair.png', label: 'messy hair', width: 48, height: 44, up: 12, side: 0 },
  'ninja-mask': { src: 'assets/hats/ninja-mask.png', label: 'ninja mask', width: 43, height: 43, up: 2, side: 5 },
  'parrot-mask': { src: 'assets/hats/parrot-mask.png', label: 'parrot mask', width: 25, height: 18, up: -3, side: 12 },
  'party-hat': { src: 'assets/hats/party-hat.png', label: 'party hat', width: 38, height: 52, up: 33, side: 0 },
  'pirate-hat': { src: 'assets/hats/pirate-hat.png', label: 'pirate hat', width: 50, height: 40, up: 14, side: 0 },
  'poop-hat': { src: 'assets/hats/poop-hat.png', label: 'poop hat', width: 50, height: 48, up: 3, side: 0 },
  'pointed-beard': { src: 'assets/hats/pointed-beard.png', label: 'pointed beard', width: 32, height: 40, up: -15, side: 0 },
  'pom-beanie': { src: 'assets/hats/pom-beanie.png', label: 'pom beanie', width: 38, height: 41, up: 22, side: 0 },
  'ram-horns': { src: 'assets/hats/ram-horns.png', label: 'ram horns', width: 50, height: 29, up: 16, side: 0 },
  'samurai-helmet': { src: 'assets/hats/samurai-helmet.png', label: 'samurai', width: 48, height: 42, up: 14, side: 0 },
  'silly-face': { src: 'assets/hats/silly-face.png', label: 'silly face', width: 40, height: 42, up: 0, side: 0 },
  skull: { src: 'assets/hats/skull.png', label: 'skull', width: 37, height: 42, up: 2, side: 0 },
  'sombrero': { src: 'assets/hats/sombrero.png', label: 'sombrero', width: 50, height: 33, up: 17, side: 0 },
  'spiky-hair': { src: 'assets/hats/spiky-hair.png', label: 'spiky hair', width: 45, height: 40, up: 12, side: 1 },
  sunglasses: { src: 'assets/hats/sunglasses.png', label: 'sunglasses', width: 41, height: 14, up: 0, side: 1 },
  'swoop-hair': { src: 'assets/hats/swoop-hair.png', label: 'swoop hair', width: 48, height: 34, up: 11, side: -2 },
  teeth: { src: 'assets/hats/teeth.png', label: 'teeth', width: 40, height: 54, up: 4, side: 0 },
  'top-hat': { src: 'assets/hats/top-hat.png', label: 'top hat', width: 42, height: 39, up: 20, side: 0 },
  'tv-head': { src: 'assets/hats/tv-head.png', label: 'tv head', width: 42, height: 47, up: 3, side: 0 },
  'viking-beard': { src: 'assets/hats/viking-beard.png', label: 'viking beard', width: 35, height: 49, up: -8, side: 0 },
  'viking-helmet': { src: 'assets/hats/viking-helmet.png', label: 'viking', width: 48, height: 35, up: 21, side: 0 },
  'walrus-mustache': { src: 'assets/hats/walrus-mustache.png', label: 'walrus mustache', width: 43, height: 20, up: -5, side: 0 },
  'wizard-hat': { src: 'assets/hats/wizard-hat.png', label: 'wizard hat', width: 50, height: 46, up: 23, side: 1 },
};
const CHARACTER_HAT_ORDER = Object.keys(CHARACTER_HATS);
const characterAccessoryImages = {};
const characterAccessoryPaperCanvases = {};

function selectedHatId() {
  return characterAppearance.hat && CHARACTER_HATS[characterAppearance.hat] ? characterAppearance.hat : null;
}

function setCharacterAppearance(nextAppearance = {}) {
  if (Object.prototype.hasOwnProperty.call(nextAppearance, 'hat')) {
    characterAppearance.hat = nextAppearance.hat && CHARACTER_HATS[nextAppearance.hat] ? nextAppearance.hat : null;
  }
  if (Object.prototype.hasOwnProperty.call(nextAppearance, 'color')) {
    characterAppearance.color = normalizeCharacterColorId(nextAppearance.color);
  }
  if (Object.prototype.hasOwnProperty.call(nextAppearance, 'hatColor')) {
    characterAppearance.hatColor = normalizeCharacterColorId(nextAppearance.hatColor);
  }
  if (Object.prototype.hasOwnProperty.call(nextAppearance, 'hatUsesCustomColor')) {
    characterAppearance.hatUsesCustomColor = Boolean(nextAppearance.hatUsesCustomColor);
  }
  if (Object.prototype.hasOwnProperty.call(nextAppearance, 'ropeColor')) {
    characterAppearance.ropeColor = normalizeCharacterColorId(nextAppearance.ropeColor || DEFAULT_ROPE_COLOR);
    applyCustomRopeColor();
  }
  if (Object.prototype.hasOwnProperty.call(nextAppearance, 'backpack')) {
    characterAppearance.backpack = Boolean(nextAppearance.backpack);
  }
  saveCharacterAppearance();
  preloadCharacterAppearance();
}

function characterInkColor() {
  return characterColorForTheme(characterAppearance.color);
}

function hatInkColor() {
  const colorId = characterAppearance.hatUsesCustomColor ? characterAppearance.hatColor : DEFAULT_CHARACTER_COLOR;
  return characterColorForTheme(colorId);
}

function accessoryImageForHat(hatId) {
  const hat = hatId && CHARACTER_HATS[hatId];
  if (!hat) return null;
  if (characterAccessoryImages[hatId]) return characterAccessoryImages[hatId];
  const img = new Image();
  img.src = hat.src;
  characterAccessoryImages[hatId] = img;
  return img;
}

function preloadCharacterAppearance() {
  accessoryImageForHat(selectedHatId());
}

function rgbFromHexColor(color) {
  const match = /^#?([0-9a-f]{6})$/i.exec(color || '');
  if (!match) return { r: 255, g: 253, b: 247 };
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function paperTintedAccessoryCanvas(hatId, img) {
  const ink = rgbFromHexColor(hatInkColor());
  const paper = rgbFromHexColor(PAPER);
  const key = `${hatId}:${img.naturalWidth}x${img.naturalHeight}:${ink.r},${ink.g},${ink.b}:${paper.r},${paper.g},${paper.b}`;
  if (characterAccessoryPaperCanvases[key]) return characterAccessoryPaperCanvases[key];

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const tintCtx = canvas.getContext('2d');
  tintCtx.drawImage(img, 0, 0);

  const imageData = tintCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const shade = (data[i] + data[i + 1] + data[i + 2]) / (255 * 3);
    const inverseShade = 1 - shade;
    data[i] = Math.round(ink.r * inverseShade + paper.r * shade);
    data[i + 1] = Math.round(ink.g * inverseShade + paper.g * shade);
    data[i + 2] = Math.round(ink.b * inverseShade + paper.b * shade);
  }
  tintCtx.putImageData(imageData, 0, 0);

  characterAccessoryPaperCanvases[key] = canvas;
  return canvas;
}

function drawPaperTintedAccessoryToCanvas(canvas, hatId, img) {
  const spec = CHARACTER_HATS[hatId];
  const source = spec && spec.preserveColors ? img : paperTintedAccessoryCanvas(hatId, img);
  canvas.width = source.naturalWidth || source.width;
  canvas.height = source.naturalHeight || source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
}

function createPaperTintedAccessoryElement(hatId) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  canvas.setAttribute('aria-hidden', 'true');
  const img = accessoryImageForHat(hatId);
  if (!img) return canvas;

  const update = () => {
    if (img.complete && img.naturalWidth > 0) drawPaperTintedAccessoryToCanvas(canvas, hatId, img);
  };
  if (img.complete && img.naturalWidth > 0) {
    update();
  } else {
    img.addEventListener('load', update, { once: true });
  }
  return canvas;
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
    ctx.strokeStyle = characterInkColor();
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
    ctx.fillStyle = hatInkColor();
    ctx.strokeStyle = hatInkColor();
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
  const hatId = selectedHatId();
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
  const img = accessoryImageForHat(hatId);
  if (img && img.complete && img.naturalWidth > 0) {
    drawOrientedImage(spec.preserveColors ? img : paperTintedAccessoryCanvas(hatId, img), center, side, body, spec.width, spec.height);
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
  const characterInk = characterInkColor();
  ctx.strokeStyle = characterInk;
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

  ctx.fillStyle = characterInk;
  ctx.beginPath();
  ctx.arc(sx(grip.x), sy(grip.y), 4, 0, Math.PI * 2);
  ctx.arc(sx(freeHand.x), sy(freeHand.y), 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

preloadCharacterAppearance();
