// Background style selection, seeding, parallax updates, and rendering.

function seedBackground() {
  const count = backgroundStyleId === BACKGROUND_STYLE_STARS ? BACKGROUND_STAR_COUNT : BACKGROUND_SHAPE_COUNT;
  for (let i = 0; i < count; i++) {
    bgShapes.push(makeBgShape(backgroundRand(-300, Math.max(W, cameraViewW()) * 5)));
  }
}

function makeBgShape(x) {
  if (backgroundStyleId === BACKGROUND_STYLE_STARS) return makeStarBgShape(x);
  return makeGeometricBgShape(x);
}

function updateBackgroundShapes(viewW = cameraViewW()) {
  for (const s of bgShapes) {
    const screenX = s.x - cameraX * s.layer;
    if (screenX < -180) {
      Object.assign(s, makeBgShape(cameraX * s.layer + viewW + backgroundRand(100, 900)));
    }
  }
}

function makeGeometricBgShape(x) {
  return {
    type: BACKGROUND_STYLE_GEOMETRIC,
    x,
    y: backgroundRand(80, Math.max(180, H - 120)),
    size: backgroundRand(18, 86),
    sides: Math.floor(backgroundRand(0, 4)),
    shadeIndex: backgroundRandom() < 0.5 ? 0 : 1,
    layer: backgroundRandom() < 0.55 ? 0.28 : 0.48,
    rot: backgroundRand(0, Math.PI),
  };
}

function makeStarBgShape(x) {
  const sizeRoll = backgroundRandom();
  return {
    type: BACKGROUND_STYLE_STARS,
    x,
    y: backgroundRand(24, Math.max(160, cameraViewH() - 48)),
    size: sizeRoll < 0.70 ? backgroundRand(3, 10) : (sizeRoll < 0.94 ? backgroundRand(10, 22) : backgroundRand(22, 38)),
    starKind: Math.floor(backgroundRand(0, 4)),
    shadeIndex: Math.floor(backgroundRand(0, 3)),
    layer: backgroundRand(0.16, 0.62),
    rot: backgroundRand(0, Math.PI * 2),
    spin: backgroundRand(-0.09, 0.09),
    twinkle: backgroundRand(0, Math.PI * 2),
    alpha: backgroundRand(0.38, 0.92),
  };
}

function drawBackground() {
  ctx.save();
  for (const s of bgShapes) drawBackgroundShape(s);
  ctx.restore();
}

function drawBackgroundShape(s) {
  const x = s.x - cameraX * s.layer;
  const y = s.y - cameraY * s.layer * 0.35;
  ctx.save();
  ctx.translate(x, y);
  if (s.type === BACKGROUND_STYLE_STARS) {
    drawStarBackgroundShape(s);
  } else {
    drawGeometricBackgroundShape(s);
  }
  ctx.restore();
}

function drawGeometricBackgroundShape(s) {
  ctx.rotate(s.rot + time * 0.02 * (s.layer + 0.3));
  ctx.strokeStyle = s.shadeIndex === 0 ? BG1 : BG2;
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
}

function backgroundStarColor(s) {
  if (s.shadeIndex === 0) return BG1;
  if (s.shadeIndex === 1) return BG2;
  return FAINT_LINE;
}

function tracePointStar(outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawFourPointSpark(size) {
  const outer = size * 0.62;
  const inner = Math.max(1.3, size * 0.16);
  ctx.beginPath();
  ctx.moveTo(0, -outer);
  ctx.lineTo(inner, -inner);
  ctx.lineTo(outer, 0);
  ctx.lineTo(inner, inner);
  ctx.lineTo(0, outer);
  ctx.lineTo(-inner, inner);
  ctx.lineTo(-outer, 0);
  ctx.lineTo(-inner, -inner);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawStarBackgroundShape(s) {
  const size = Math.max(2, s.size || 4);
  const pulse = 0.78 + Math.sin(time * 1.8 + (s.twinkle || 0)) * 0.22;
  ctx.globalAlpha *= (s.alpha || 0.6) * pulse;
  ctx.rotate((s.rot || 0) + time * (s.spin || 0));
  ctx.strokeStyle = backgroundStarColor(s);
  ctx.fillStyle = backgroundStarColor(s);
  ctx.lineWidth = Math.max(1, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.starKind === 0) {
    drawFourPointSpark(size);
  } else if (s.starKind === 1) {
    tracePointStar(size * 0.55, size * 0.24, 5);
    ctx.fill();
  } else if (s.starKind === 2) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, 0);
    ctx.lineTo(size * 0.5, 0);
    ctx.moveTo(0, -size * 0.5);
    ctx.lineTo(0, size * 0.5);
    ctx.moveTo(-size * 0.28, -size * 0.28);
    ctx.lineTo(size * 0.28, size * 0.28);
    ctx.moveTo(size * 0.28, -size * 0.28);
    ctx.lineTo(-size * 0.28, size * 0.28);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.2, size * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
}
