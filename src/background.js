// Background style selection, seeding, parallax updates, and rendering.

const BACKGROUND_CLOUD_COUNT = 78;
const BACKGROUND_MOUNTAIN_COUNT = 48;
const BACKGROUND_CITY_COUNT = 66;
const BACKGROUND_FOREST_COUNT = 86;
const BACKGROUND_BUBBLE_COUNT = 130;
const BACKGROUND_RAIN_COUNT = 230;
const BACKGROUND_CRYSTAL_COUNT = 92;

function backgroundShapeCountForStyle(styleId = backgroundStyleId) {
  if (styleId === BACKGROUND_STYLE_STARS) return BACKGROUND_STAR_COUNT;
  if (styleId === BACKGROUND_STYLE_CLOUDS) return BACKGROUND_CLOUD_COUNT;
  if (styleId === BACKGROUND_STYLE_MOUNTAINS) return BACKGROUND_MOUNTAIN_COUNT;
  if (styleId === BACKGROUND_STYLE_CITY) return BACKGROUND_CITY_COUNT;
  if (styleId === BACKGROUND_STYLE_FOREST) return BACKGROUND_FOREST_COUNT;
  if (styleId === BACKGROUND_STYLE_BUBBLES) return BACKGROUND_BUBBLE_COUNT;
  if (styleId === BACKGROUND_STYLE_RAIN) return BACKGROUND_RAIN_COUNT;
  if (styleId === BACKGROUND_STYLE_CRYSTALS) return BACKGROUND_CRYSTAL_COUNT;
  return BACKGROUND_SHAPE_COUNT;
}

function backgroundSpawnGapForStyle(styleId = backgroundStyleId) {
  if (styleId === BACKGROUND_STYLE_STARS || styleId === BACKGROUND_STYLE_BUBBLES || styleId === BACKGROUND_STYLE_RAIN) {
    return { min: 40, max: 520 };
  }
  if (styleId === BACKGROUND_STYLE_MOUNTAINS) {
    return { min: -180, max: 220 };
  }
  if (styleId === BACKGROUND_STYLE_CITY) {
    return { min: 35, max: 460 };
  }
  if (styleId === BACKGROUND_STYLE_CLOUDS || styleId === BACKGROUND_STYLE_FOREST || styleId === BACKGROUND_STYLE_CRYSTALS) {
    return { min: 70, max: 760 };
  }
  return { min: 100, max: 900 };
}

function backgroundRecyclePadding(s) {
  return Math.max(180, Number(s && s.recyclePadding) || 0);
}

function seedBackground() {
  if (backgroundStyleId === BACKGROUND_STYLE_MOUNTAINS) {
    seedMountainBackground();
    return;
  }

  const count = backgroundShapeCountForStyle(backgroundStyleId);
  const viewW = Math.max(W, cameraViewW());
  for (let i = 0; i < count; i++) {
    bgShapes.push(makeBgShape(backgroundRand(-300, viewW * 5)));
  }
}

function seedMountainBackground() {
  const viewW = Math.max(W, cameraViewW());
  const endX = viewW * 5 + 900;
  for (let band = 0; band < 3; band += 1) {
    let x = -900 + band * 120 + backgroundRand(-180, 180);
    while (x < endX) {
      const shape = makeMountainBgShape(x, band);
      bgShapes.push(shape);
      x += (shape.width || 900) * backgroundRand(0.58, 0.78);
    }
  }
}

function resetBackgroundShapesForStyle(styleId = backgroundStyleId) {
  backgroundStyleId = styleId || BACKGROUND_STYLE_GEOMETRIC;
  backgroundRngState = gameSeedValue;
  bgShapes = [];
  seedBackground();
}

function cycleBackgroundStyle() {
  const currentIndex = BACKGROUND_STYLE_IDS.indexOf(backgroundStyleId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % BACKGROUND_STYLE_IDS.length;
  resetBackgroundShapesForStyle(BACKGROUND_STYLE_IDS[nextIndex]);
  return backgroundStyleId;
}

function makeBgShape(x, options = {}) {
  if (backgroundStyleId === BACKGROUND_STYLE_STARS) return makeStarBgShape(x);
  if (backgroundStyleId === BACKGROUND_STYLE_CLOUDS) return makeCloudBgShape(x);
  if (backgroundStyleId === BACKGROUND_STYLE_MOUNTAINS) return makeMountainBgShape(x, options.mountainBand);
  if (backgroundStyleId === BACKGROUND_STYLE_CITY) return makeCityBgShape(x);
  if (backgroundStyleId === BACKGROUND_STYLE_FOREST) return makeForestBgShape(x);
  if (backgroundStyleId === BACKGROUND_STYLE_BUBBLES) return makeBubbleBgShape(x);
  if (backgroundStyleId === BACKGROUND_STYLE_RAIN) return makeRainBgShape(x);
  if (backgroundStyleId === BACKGROUND_STYLE_CRYSTALS) return makeCrystalBgShape(x);
  return makeGeometricBgShape(x);
}

function updateBackgroundShapes(viewW = cameraViewW()) {
  for (const s of bgShapes) {
    const screenX = s.x - cameraX * s.layer;
    if (screenX < -backgroundRecyclePadding(s)) {
      const gap = backgroundSpawnGapForStyle(s.type || backgroundStyleId);
      Object.assign(s, makeBgShape(cameraX * s.layer + viewW + backgroundRand(gap.min, gap.max), {
        mountainBand: s.mountainBand,
      }));
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

function makeCloudBgShape(x) {
  const wind = backgroundRandom() < 0.32;
  const size = wind ? backgroundRand(32, 92) : backgroundRand(58, 165);
  const yMax = wind ? Math.max(200, cameraViewH() * 0.58) : Math.max(190, cameraViewH() * 0.42);
  return {
    type: BACKGROUND_STYLE_CLOUDS,
    cloudKind: wind ? 'wind' : 'cloud',
    x,
    y: backgroundRand(34, yMax),
    size,
    stretch: backgroundRand(0.88, 1.48),
    shadeIndex: Math.floor(backgroundRand(0, 3)),
    layer: wind ? backgroundRand(0.22, 0.50) : backgroundRand(0.12, 0.34),
    rot: backgroundRand(-0.08, 0.08),
    alpha: backgroundRand(0.36, 0.74),
    phase: backgroundRand(0, Math.PI * 2),
    curl: backgroundRand(0.75, 1.35),
    recyclePadding: size * 2.4,
  };
}

function mountainBandSpec(band = 1) {
  if (band <= 0) {
    return { band: 0, layer: 0.08, baseY: H * 0.60, minW: 980, maxW: 1680, minH: 105, maxH: 210, shadeIndex: 0, smoothChance: 0.18 };
  }
  if (band >= 2) {
    return { band: 2, layer: 0.24, baseY: H * 0.78, minW: 760, maxW: 1360, minH: 115, maxH: 230, shadeIndex: 1, smoothChance: 0.72 };
  }
  return { band: 1, layer: 0.15, baseY: H * 0.69, minW: 860, maxW: 1480, minH: 130, maxH: 260, shadeIndex: 1, smoothChance: 0.42 };
}

function makeMountainPeaks(count, smooth = false) {
  const peaks = [];
  for (let i = 0; i < count; i += 1) {
    const endpoint = i === 0 || i === count - 1;
    const baseT = count <= 1 ? 0 : i / (count - 1);
    const jitter = endpoint ? 0 : backgroundRand(-0.055, 0.055);
    const high = smooth ? backgroundRand(0.26, 0.68) : backgroundRand(0.34, 1.0);
    peaks.push({
      t: clamp(baseT + jitter, 0, 1),
      h: endpoint ? backgroundRand(0.12, 0.36) : high,
      cap: backgroundRand(0.12, 0.24),
    });
  }
  peaks.sort((a, b) => a.t - b.t);
  peaks[0].t = 0;
  peaks[peaks.length - 1].t = 1;
  return peaks;
}

function makeMountainBgShape(x, band) {
  const bandIndex = Number.isFinite(Number(band)) ? Math.max(0, Math.min(2, Math.floor(Number(band)))) : Math.floor(backgroundRand(0, 3));
  const spec = mountainBandSpec(bandIndex);
  const width = backgroundRand(spec.minW, spec.maxW);
  const height = backgroundRand(spec.minH, spec.maxH);
  const smooth = backgroundRandom() < spec.smoothChance;
  const pointCount = smooth ? 6 + Math.floor(backgroundRand(0, 4)) : 5 + Math.floor(backgroundRand(0, 4));
  return {
    type: BACKGROUND_STYLE_MOUNTAINS,
    mountainBand: spec.band,
    mountainKind: smooth ? 'hills' : 'peaks',
    x,
    y: spec.baseY + backgroundRand(-18, 18),
    width,
    height,
    peaks: makeMountainPeaks(pointCount, smooth),
    shadeIndex: spec.shadeIndex,
    layer: spec.layer,
    snow: !smooth && backgroundRandom() < (spec.band === 0 ? 0.52 : 0.34),
    ridge: backgroundRand(0.16, 0.34),
    recyclePadding: width * 0.82,
  };
}

function makeCityBgShape(x) {
  const width = backgroundRand(48, 125);
  const height = backgroundRand(78, 235);
  return {
    type: BACKGROUND_STYLE_CITY,
    x,
    y: 0,
    width,
    height,
    cols: 2 + Math.floor(backgroundRand(0, 4)),
    floors: 3 + Math.floor(backgroundRand(0, 8)),
    roofKind: Math.floor(backgroundRand(0, 5)),
    windowPhase: Math.floor(backgroundRand(0, 97)),
    shadeIndex: Math.floor(backgroundRand(0, 3)),
    layer: 1,
    lean: backgroundRand(-0.018, 0.018),
    recyclePadding: width * 1.7 + 60,
  };
}

function makeForestBgShape(x) {
  const roll = backgroundRandom();
  if (roll < 0.12) {
    const size = backgroundRand(16, 36);
    return {
      type: BACKGROUND_STYLE_FOREST,
      forestKind: 'bird',
      forestDepth: 'sky',
      x,
      y: backgroundRand(70, Math.max(185, cameraViewH() * 0.36)),
      size,
      shadeIndex: Math.floor(backgroundRand(0, 3)),
      layer: backgroundRand(0.20, 0.45),
      alpha: backgroundRand(0.36, 0.70),
      rot: backgroundRand(-0.14, 0.14),
      recyclePadding: size * 3,
    };
  }

  const isBackTree = roll < 0.44;
  const size = isBackTree ? backgroundRand(36, 105) : backgroundRand(72, 190);
  return {
    type: BACKGROUND_STYLE_FOREST,
    forestKind: ['round', 'pine', 'bare'][Math.floor(backgroundRand(0, 3))],
    forestDepth: isBackTree ? 'back' : 'ground',
    x,
    y: isBackTree ? backgroundRand(H * 0.50, H * 0.68) : 0,
    size,
    shadeIndex: Math.floor(backgroundRand(0, 3)),
    layer: isBackTree ? backgroundRand(0.14, 0.34) : 1,
    alpha: isBackTree ? backgroundRand(0.24, 0.48) : backgroundRand(0.46, 0.78),
    lean: backgroundRand(-0.16, 0.16),
    branchPhase: backgroundRand(0, Math.PI * 2),
    recyclePadding: size * 1.35,
  };
}

function makeBubbleBgShape(x) {
  const fish = backgroundRandom() < 0.14;
  const size = fish ? backgroundRand(24, 62) : backgroundRand(8, 58);
  return {
    type: BACKGROUND_STYLE_BUBBLES,
    bubbleKind: fish ? 'fish' : 'bubble',
    x,
    y: backgroundRand(46, Math.max(170, cameraViewH() - 68)),
    size,
    shadeIndex: Math.floor(backgroundRand(0, 3)),
    layer: backgroundRand(0.14, 0.58),
    alpha: backgroundRand(0.28, 0.74),
    phase: backgroundRand(0, Math.PI * 2),
    floatSpeed: backgroundRand(0.18, 0.72),
    drift: backgroundRand(4, 18),
    dir: backgroundRandom() < 0.5 ? -1 : 1,
    recyclePadding: size * 2.2,
  };
}

function makeRainBgShape(x) {
  const cloud = backgroundRandom() < 0.07;
  if (cloud) {
    const size = backgroundRand(64, 170);
    return {
      type: BACKGROUND_STYLE_RAIN,
      rainKind: 'cloud',
      x,
      y: backgroundRand(18, Math.max(145, cameraViewH() * 0.28)),
      size,
      stretch: backgroundRand(0.95, 1.55),
      shadeIndex: Math.floor(backgroundRand(0, 3)),
      layer: backgroundRand(0.10, 0.24),
      rot: backgroundRand(-0.04, 0.04),
      alpha: backgroundRand(0.32, 0.64),
      phase: backgroundRand(0, Math.PI * 2),
      recyclePadding: size * 2.4,
    };
  }

  const viewH = Math.max(H, cameraViewH());
  const len = backgroundRand(18, 72);
  return {
    type: BACKGROUND_STYLE_RAIN,
    rainKind: 'streak',
    x,
    y: backgroundRand(-140, viewH + 180),
    len,
    slant: backgroundRand(5, 20),
    shadeIndex: Math.floor(backgroundRand(0, 3)),
    layer: backgroundRand(0.22, 0.72),
    alpha: backgroundRand(0.20, 0.62),
    fallSpeed: backgroundRand(165, 420),
    phase: backgroundRand(0, viewH + 260),
    windDrift: backgroundRand(4, 18),
    lineWidth: backgroundRand(1, 2.6),
    recyclePadding: 120,
  };
}

function makeCrystalBgShape(x) {
  const crack = backgroundRandom() < 0.18;
  const size = crack ? backgroundRand(28, 110) : backgroundRand(34, 125);
  if (crack) {
    return {
      type: BACKGROUND_STYLE_CRYSTALS,
      crystalKind: 'crack',
      x,
      y: backgroundRand(80, H * 0.72),
      size,
      shadeIndex: Math.floor(backgroundRand(0, 3)),
      layer: backgroundRand(0.18, 0.48),
      alpha: backgroundRand(0.34, 0.70),
      rot: backgroundRand(-0.75, 0.75),
      kinkA: backgroundRand(-0.38, 0.38),
      kinkB: backgroundRand(-0.38, 0.38),
      recyclePadding: size * 1.7,
    };
  }

  const edgeRoll = backgroundRandom();
  let y;
  let dir;
  if (edgeRoll < 0.32) {
    y = backgroundRand(24, 175);
    dir = 1;
  } else if (edgeRoll < 0.66) {
    y = backgroundRand(H * 0.52, H * 0.84);
    dir = -1;
  } else {
    y = backgroundRand(105, H * 0.58);
    dir = backgroundRandom() < 0.5 ? -1 : 1;
  }

  return {
    type: BACKGROUND_STYLE_CRYSTALS,
    crystalKind: 'cluster',
    x,
    y,
    size,
    shardCount: 2 + Math.floor(backgroundRand(0, 4)),
    shadeIndex: Math.floor(backgroundRand(0, 3)),
    layer: backgroundRand(0.16, 0.48),
    alpha: backgroundRand(0.30, 0.66),
    rot: backgroundRand(-0.18, 0.18),
    crystalDir: dir,
    spread: backgroundRand(0.18, 0.34),
    phase: backgroundRand(0, Math.PI * 2),
    recyclePadding: size * 2.1,
  };
}

function drawBackground() {
  ctx.save();
  const viewW = cameraViewW();
  const shapes = backgroundStyleId === BACKGROUND_STYLE_MOUNTAINS
    ? bgShapes.slice().sort((a, b) => ((a.mountainBand || 0) - (b.mountainBand || 0)) || ((a.x || 0) - (b.x || 0)))
    : bgShapes;
  for (const s of shapes) {
    const x = s.x - cameraX * s.layer;
    const pad = backgroundRecyclePadding(s);
    if (x < -pad || x > viewW + pad) continue;
    drawBackgroundShape(s);
  }
  ctx.restore();
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function backgroundShadeColor(s, offset = 0) {
  const shade = (((Number(s && s.shadeIndex) || 0) + offset) % 3 + 3) % 3;
  if (shade === 0) return BG1;
  if (shade === 1) return BG2;
  return FAINT_LINE;
}

function drawBackgroundShape(s) {
  const layer = s.layer || 0.3;
  let x = s.x - cameraX * layer;
  let y = s.y - cameraY * layer * 0.35;

  if (s.type === BACKGROUND_STYLE_RAIN && s.rainKind !== 'cloud') {
    const wrapH = cameraViewH() + 260;
    y = positiveModulo(s.y - cameraY * layer * 0.08 + time * (s.fallSpeed || 220) + (s.phase || 0), wrapH) - 130;
    x += Math.sin(time * 0.55 + (s.phase || 0)) * (s.windDrift || 8);
  } else if (s.type === BACKGROUND_STYLE_BUBBLES) {
    const bob = Math.sin(time * (s.floatSpeed || 0.35) + (s.phase || 0));
    x += bob * (s.drift || 8);
    y += Math.cos(time * (s.floatSpeed || 0.35) * 0.7 + (s.phase || 0)) * (s.drift || 8) * 0.35;
  } else if (s.type === BACKGROUND_STYLE_CLOUDS) {
    x += Math.sin(time * (s.cloudKind === 'wind' ? 0.35 : 0.14) + (s.phase || 0)) * (s.cloudKind === 'wind' ? 8 : 3);
  } else if (s.type === BACKGROUND_STYLE_MOUNTAINS) {
    y = s.y - cameraY * 0.04;
  } else if (s.type === BACKGROUND_STYLE_CITY) {
    const halfW = (s.width || 70) * 0.5;
    y = Math.max(
      terrainYAt(cameraX + x - halfW),
      terrainYAt(cameraX + x),
      terrainYAt(cameraX + x + halfW),
    ) - cameraY + 4;
  } else if (s.type === BACKGROUND_STYLE_FOREST && s.forestDepth === 'ground') {
    const footprint = Math.max(14, (s.size || 76) * 0.28);
    y = Math.max(
      terrainYAt(cameraX + x - footprint),
      terrainYAt(cameraX + x),
      terrainYAt(cameraX + x + footprint),
    ) - cameraY + 5;
  }

  ctx.save();
  ctx.translate(x, y);
  if (s.type === BACKGROUND_STYLE_STARS) {
    drawStarBackgroundShape(s);
  } else if (s.type === BACKGROUND_STYLE_CLOUDS) {
    drawCloudBackgroundShape(s);
  } else if (s.type === BACKGROUND_STYLE_MOUNTAINS) {
    drawMountainBackgroundShape(s);
  } else if (s.type === BACKGROUND_STYLE_CITY) {
    drawCityBackgroundShape(s);
  } else if (s.type === BACKGROUND_STYLE_FOREST) {
    drawForestBackgroundShape(s);
  } else if (s.type === BACKGROUND_STYLE_BUBBLES) {
    drawBubbleBackgroundShape(s);
  } else if (s.type === BACKGROUND_STYLE_RAIN) {
    drawRainBackgroundShape(s);
  } else if (s.type === BACKGROUND_STYLE_CRYSTALS) {
    drawCrystalBackgroundShape(s);
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

function traceCloudPath(w, h) {
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, h * 0.16);
  ctx.bezierCurveTo(-w * 0.48, -h * 0.14, -w * 0.24, -h * 0.24, -w * 0.16, -h * 0.06);
  ctx.bezierCurveTo(-w * 0.07, -h * 0.50, w * 0.22, -h * 0.50, w * 0.30, -h * 0.12);
  ctx.bezierCurveTo(w * 0.50, -h * 0.15, w * 0.58, h * 0.15, w * 0.38, h * 0.24);
  ctx.lineTo(-w * 0.40, h * 0.24);
  ctx.bezierCurveTo(-w * 0.57, h * 0.24, -w * 0.59, h * 0.17, -w * 0.46, h * 0.16);
}

function drawWindBackgroundShape(s) {
  const size = Math.max(20, s.size || 48);
  const w = size * (s.stretch || 1.25);
  const curl = s.curl || 1;
  ctx.beginPath();
  ctx.moveTo(-w * 0.62, -size * 0.06);
  ctx.bezierCurveTo(-w * 0.24, -size * 0.20 * curl, w * 0.30, -size * 0.18, w * 0.38, size * 0.02);
  ctx.bezierCurveTo(w * 0.46, size * 0.24, w * 0.10, size * 0.26, w * 0.12, size * 0.05);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-w * 0.42, size * 0.26);
  ctx.quadraticCurveTo(-w * 0.02, size * 0.38, w * 0.46, size * 0.20);
  ctx.stroke();

  if (size > 58) {
    ctx.globalAlpha *= 0.68;
    ctx.beginPath();
    ctx.moveTo(-w * 0.30, -size * 0.34);
    ctx.quadraticCurveTo(w * 0.04, -size * 0.45, w * 0.34, -size * 0.34);
    ctx.stroke();
  }
}

function drawCloudBackgroundShape(s) {
  const size = Math.max(24, s.size || 70);
  ctx.globalAlpha *= s.alpha || 0.55;
  ctx.rotate(s.rot || 0);
  ctx.strokeStyle = backgroundShadeColor(s);
  ctx.lineWidth = Math.max(1.5, size * 0.028);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.cloudKind === 'wind') {
    drawWindBackgroundShape(s);
    return;
  }

  const w = size * (s.stretch || 1.18);
  const h = size * 0.46;
  traceCloudPath(w, h);
  ctx.stroke();

  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  ctx.moveTo(-w * 0.23, h * 0.22);
  ctx.quadraticCurveTo(-w * 0.05, h * 0.32, w * 0.16, h * 0.21);
  ctx.moveTo(w * 0.25, h * 0.21);
  ctx.quadraticCurveTo(w * 0.34, h * 0.27, w * 0.43, h * 0.18);
  ctx.stroke();
}

function mountainRidgePoints(s) {
  const w = s.width || 900;
  const h = s.height || 160;
  const peaks = Array.isArray(s.peaks) && s.peaks.length
    ? s.peaks
    : [{ t: 0, h: 0.22 }, { t: 0.35, h: 0.88 }, { t: 0.7, h: 0.48 }, { t: 1, h: 0.24 }];
  return peaks.map(peak => ({
    x: -w / 2 + clamp(peak.t, 0, 1) * w,
    y: -h * clamp(peak.h, 0.08, 1.08),
    peak,
  }));
}

function traceMountainRidge(points, smooth = false, move = true) {
  if (!points.length) return;
  if (move) ctx.moveTo(points[0].x, points[0].y);
  else ctx.lineTo(points[0].x, points[0].y);
  if (!smooth || points.length < 3) {
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    return;
  }

  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const next = points[i + 1];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function traceMountainFillPath(s, points) {
  const w = s.width || 900;
  const bottom = Math.max(H, cameraViewH()) + 320;
  const smooth = s.mountainKind === 'hills';
  ctx.beginPath();
  ctx.moveTo(-w / 2, bottom);
  traceMountainRidge(points, smooth, false);
  ctx.lineTo(w / 2, bottom);
  ctx.closePath();
}

function traceMountainRidgePath(s, points) {
  ctx.beginPath();
  traceMountainRidge(points, s.mountainKind === 'hills');
}

function drawMountainBackgroundShape(s) {
  const w = s.width || 900;
  const h = s.height || 160;
  const points = mountainRidgePoints(s);
  const fill = backgroundShadeColor(s);
  const stroke = backgroundShadeColor(s, 1);
  const detail = backgroundShadeColor(s, 2);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(2.2, Math.min(5.2, w * 0.0045));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  traceMountainFillPath(s, points);
  ctx.fill();

  traceMountainRidgePath(s, points);
  ctx.stroke();

  ctx.strokeStyle = detail;
  ctx.lineWidth = Math.max(1.5, Math.min(3.4, w * 0.0032));
  const ridgeY = -h * (s.ridge || 0.22);
  ctx.beginPath();
  ctx.moveTo(-w * 0.40, ridgeY);
  ctx.quadraticCurveTo(-w * 0.12, ridgeY + h * 0.10, w * 0.18, ridgeY - h * 0.02);
  ctx.quadraticCurveTo(w * 0.32, ridgeY - h * 0.08, w * 0.46, ridgeY + h * 0.03);
  ctx.stroke();

  if (s.snow) {
    ctx.strokeStyle = detail;
    ctx.lineWidth = Math.max(1.5, Math.min(3, w * 0.0028));
    for (let i = 1; i < points.length - 1; i += 1) {
      const point = points[i];
      const prev = points[i - 1];
      const next = points[i + 1];
      if (point.y > prev.y || point.y > next.y) continue;
      const capW = w * ((point.peak && point.peak.cap) || 0.16) * 0.16;
      const capH = h * ((point.peak && point.peak.cap) || 0.16);
      ctx.beginPath();
      ctx.moveTo(point.x - capW, point.y + capH);
      ctx.lineTo(point.x, point.y);
      ctx.lineTo(point.x + capW, point.y + capH * 1.05);
      ctx.stroke();
    }
  }
}

function drawCityBackgroundShape(s) {
  const w = s.width || 70;
  const h = s.height || 130;
  const fill = backgroundShadeColor(s);
  const stroke = backgroundShadeColor(s, 1);
  const windowFill = backgroundShadeColor(s, 2);
  ctx.rotate(s.lean || 0);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(1.5, Math.min(3, w * 0.032));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillRect(-w / 2, -h, w, h);
  ctx.strokeRect(-w / 2, -h, w, h);

  if (s.roofKind === 0) {
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(0, -h - Math.min(34, h * 0.22));
    ctx.moveTo(-w * 0.12, -h - Math.min(18, h * 0.12));
    ctx.lineTo(w * 0.12, -h - Math.min(18, h * 0.12));
    ctx.stroke();
  } else if (s.roofKind === 1) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h);
    ctx.lineTo(0, -h - h * 0.16);
    ctx.lineTo(w / 2, -h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (s.roofKind === 2) {
    const tankW = w * 0.40;
    ctx.fillRect(-tankW / 2, -h - h * 0.12, tankW, h * 0.10);
    ctx.strokeRect(-tankW / 2, -h - h * 0.12, tankW, h * 0.10);
    ctx.beginPath();
    ctx.moveTo(-tankW * 0.30, -h);
    ctx.lineTo(-tankW * 0.18, -h - h * 0.12);
    ctx.moveTo(tankW * 0.30, -h);
    ctx.lineTo(tankW * 0.18, -h - h * 0.12);
    ctx.stroke();
  } else if (s.roofKind === 3) {
    ctx.fillRect(w * 0.16, -h - h * 0.16, w * 0.20, h * 0.16);
    ctx.strokeRect(w * 0.16, -h - h * 0.16, w * 0.20, h * 0.16);
  }

  const cols = Math.max(1, s.cols || 3);
  const floors = Math.max(2, s.floors || 5);
  const padX = w * 0.20;
  const padTop = h * 0.18;
  const usableW = Math.max(1, w - padX * 2);
  const usableH = Math.max(1, h - padTop - h * 0.12);
  const ww = Math.max(2.3, usableW / cols * 0.34);
  const wh = Math.max(2.3, usableH / floors * 0.23);
  ctx.fillStyle = windowFill;
  for (let row = 0; row < floors; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if ((row * 7 + col * 11 + (s.windowPhase || 0)) % 4 === 0) continue;
      const wx = -w / 2 + padX + (col + 0.5) * usableW / cols;
      const wy = -h + padTop + (row + 0.5) * usableH / floors;
      ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
    }
  }
}

function drawBirdBackgroundShape(s) {
  const size = Math.max(10, s.size || 20);
  ctx.rotate(s.rot || 0);
  ctx.beginPath();
  ctx.moveTo(-size * 0.62, 0);
  ctx.quadraticCurveTo(-size * 0.28, -size * 0.34, 0, 0);
  ctx.quadraticCurveTo(size * 0.28, -size * 0.34, size * 0.62, 0);
  ctx.stroke();
}

function drawForestBackgroundShape(s) {
  const size = Math.max(20, s.size || 76);
  ctx.globalAlpha *= s.alpha || 0.55;
  ctx.strokeStyle = backgroundShadeColor(s);
  ctx.lineWidth = Math.max(1.5, Math.min(3.2, size * 0.035));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.forestKind === 'bird') {
    drawBirdBackgroundShape(s);
    return;
  }

  ctx.rotate(s.lean || 0);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -size * 0.62);
  ctx.stroke();

  if (s.forestKind === 'pine') {
    for (let i = 0; i < 3; i += 1) {
      const yy = -size * (0.32 + i * 0.18);
      const half = size * (0.33 - i * 0.055);
      ctx.beginPath();
      ctx.moveTo(-half, yy + size * 0.10);
      ctx.lineTo(0, yy - size * 0.25);
      ctx.lineTo(half, yy + size * 0.10);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (s.forestKind === 'bare') {
    const phase = s.branchPhase || 0;
    for (let i = 0; i < 5; i += 1) {
      const yy = -size * (0.22 + i * 0.10);
      const side = i % 2 === 0 ? -1 : 1;
      const len = size * (0.23 + 0.08 * Math.sin(phase + i));
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(side * len, yy - size * (0.12 + i * 0.012));
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(-size * 0.18, -size * 0.70, size * 0.28, size * 0.23, -0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(size * 0.14, -size * 0.76, size * 0.31, size * 0.25, 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.56, size * 0.37, size * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBubbleBackgroundShape(s) {
  const size = Math.max(4, s.size || 18);
  ctx.globalAlpha *= s.alpha || 0.5;
  ctx.strokeStyle = backgroundShadeColor(s);
  ctx.fillStyle = backgroundShadeColor(s, 2);
  ctx.lineWidth = Math.max(1.2, size * 0.055);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.bubbleKind === 'fish') {
    ctx.scale(s.dir || 1, 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.48, size * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.48, 0);
    ctx.lineTo(-size * 0.78, -size * 0.22);
    ctx.lineTo(-size * 0.78, size * 0.22);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.25, -size * 0.05, Math.max(1.1, size * 0.035), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const r = size * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha *= 0.66;
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.28, Math.max(2, r * 0.24), Math.PI * 1.08, Math.PI * 1.70);
  ctx.stroke();
}

function drawRainBackgroundShape(s) {
  if (s.rainKind === 'cloud') {
    drawCloudBackgroundShape(s);
    ctx.globalAlpha *= 0.62;
    ctx.strokeStyle = backgroundShadeColor(s, 1);
    ctx.lineWidth = Math.max(1.2, (s.size || 80) * 0.018);
    ctx.lineCap = 'round';
    const size = s.size || 80;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * size * 0.18 - size * 0.05, size * 0.18);
      ctx.lineTo(i * size * 0.18 + size * 0.04, size * 0.34);
      ctx.stroke();
    }
    return;
  }

  ctx.globalAlpha *= s.alpha || 0.42;
  ctx.strokeStyle = backgroundShadeColor(s);
  ctx.lineWidth = s.lineWidth || 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s.slant, -s.len * 0.5);
  ctx.lineTo(s.slant, s.len * 0.5);
  ctx.stroke();
}

function drawCrystalCrackBackgroundShape(s) {
  const size = Math.max(20, s.size || 60);
  const a = s.kinkA || 0;
  const b = s.kinkB || 0;
  ctx.rotate(s.rot || 0);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.50);
  ctx.lineTo(size * a * 0.30, -size * 0.18);
  ctx.lineTo(size * b * 0.26, size * 0.14);
  ctx.lineTo(size * (a - b) * 0.18, size * 0.50);
  ctx.stroke();
  ctx.globalAlpha *= 0.66;
  ctx.beginPath();
  ctx.moveTo(size * a * 0.30, -size * 0.18);
  ctx.lineTo(size * (0.22 + b * 0.10), -size * 0.28);
  ctx.moveTo(size * b * 0.26, size * 0.14);
  ctx.lineTo(-size * (0.20 + a * 0.10), size * 0.25);
  ctx.stroke();
}

function drawCrystalShard(offsetX, baseY, shardW, shardH, dir) {
  ctx.beginPath();
  ctx.moveTo(offsetX - shardW, baseY);
  ctx.lineTo(offsetX - shardW * 0.20, baseY + dir * shardH * 0.18);
  ctx.lineTo(offsetX, baseY + dir * shardH);
  ctx.lineTo(offsetX + shardW * 0.24, baseY + dir * shardH * 0.22);
  ctx.lineTo(offsetX + shardW, baseY);
  ctx.closePath();
}

function drawCrystalBackgroundShape(s) {
  const size = Math.max(22, s.size || 70);
  ctx.globalAlpha *= s.alpha || 0.48;
  ctx.strokeStyle = backgroundShadeColor(s);
  ctx.fillStyle = backgroundShadeColor(s);
  ctx.lineWidth = Math.max(1.4, Math.min(3, size * 0.028));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.crystalKind === 'crack') {
    drawCrystalCrackBackgroundShape(s);
    return;
  }

  ctx.rotate(s.rot || 0);
  const count = Math.max(2, s.shardCount || 3);
  const dir = s.crystalDir || -1;
  const spread = s.spread || 0.24;
  for (let i = 0; i < count; i += 1) {
    const center = (i - (count - 1) / 2) * size * spread;
    const wave = 0.78 + 0.22 * Math.sin((s.phase || 0) + i * 1.7);
    const shardH = size * (0.48 + i / count * 0.28) * wave;
    const shardW = size * (0.08 + (i % 2) * 0.035);
    drawCrystalShard(center, 0, shardW, shardH, dir);
    ctx.save();
    ctx.globalAlpha *= 0.10;
    ctx.fill();
    ctx.restore();
    ctx.stroke();

    ctx.globalAlpha *= 0.94;
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, dir * shardH * 0.72);
    ctx.stroke();
  }
}
