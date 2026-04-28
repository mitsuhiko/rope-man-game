// Level generation, terrain, obstacles, collisions, and world rendering.

function seedBackground() {
  for (let i = 0; i < BACKGROUND_SHAPE_COUNT; i++) {
    bgShapes.push(makeBgShape(backgroundRand(-300, Math.max(W, cameraViewW()) * 5)));
  }
}

function makeBgShape(x) {
  return {
    x,
    y: backgroundRand(80, Math.max(180, H - 120)),
    size: backgroundRand(18, 86),
    sides: Math.floor(backgroundRand(0, 4)),
    shadeIndex: backgroundRandom() < 0.5 ? 0 : 1,
    layer: backgroundRandom() < 0.55 ? 0.28 : 0.48,
    rot: backgroundRand(0, Math.PI),
  };
}

function addAnchor(x, y) {
  anchors.push({ id: anchors.length + 1, x, y, r: 8 });
}

function coinSpawnMinimumX() {
  return 150 + COIN_MIN_START_DISTANCE;
}

function baseCoinValueForMode(mode = gameMode) {
  return normalizeGameMode(mode) === 'escapeWave' ? 20 : COIN_VALUE;
}

function coinValueForObstacle(obstacle) {
  return obstacle && obstacle.type === 'saw' ? 50 : baseCoinValueForMode();
}

function coinVisualSpec(value) {
  if (value >= 50) return { fill: '#1fb6b2', stroke: '#075b5b', shine: 'rgba(190, 255, 252, 0.78)' };
  if (value >= 20) return { fill: '#37c871', stroke: '#116b36', shine: 'rgba(210, 255, 225, 0.78)' };
  return { fill: '#f7c948', stroke: '#8a5a00', shine: 'rgba(255, 255, 255, 0.7)' };
}

function addCoin(x, y, obstacleType, clusterIndex, value = COIN_VALUE) {
  const id = `${gameSeedText}:${clusterIndex}:${Math.round(x)}:${Math.round(y)}`;
  if (collectedCoinIds.has(id) || coins.some(coin => coin && coin.id === id)) return;
  coins.push({
    id,
    x,
    y,
    r: COIN_RADIUS,
    value,
    obstacleType,
    collected: false,
  });
}

function spawnCoinNearObstacle(obstacle, clusterIndex) {
  if (!obstacle || obstacle.x < coinSpawnMinimumX()) return;
  if (coinRandom() > COIN_SPAWN_CHANCE) return;

  let x = obstacle.x;
  let y = obstacle.y || H * 0.48;
  if (obstacle.type === 'gate') {
    x = obstacle.x + obstacle.w / 2;
    y = obstacle.gapY + coinRand(-obstacle.gap * 0.19, obstacle.gap * 0.19);
  } else if (obstacle.type === 'saw') {
    const side = coinRandom() < 0.5 ? -1 : 1;
    x = obstacle.x + side * coinRand(obstacle.r + 54, obstacle.r + 76);
    y = obstacle.y + coinRand(-35, 35);
  } else if (obstacle.type === 'spikes') {
    x = obstacle.x + obstacle.count * obstacle.size * coinRand(0.36, 0.64);
    if (obstacle.ground) {
      y = terrainYAt(x) - (obstacle.height || obstacle.size * 1.6) - coinRand(58, 104);
    } else {
      y = obstacle.y + (obstacle.height || obstacle.size) + coinRand(58, 100);
    }
  }

  if (x < coinSpawnMinimumX()) return;
  const terrainLimit = terrainYAt(x) - COIN_RADIUS * 3.2;
  y = clamp(y, ANCHOR_MIN_Y + 40, terrainLimit);
  addCoin(x, y, obstacle.type, clusterIndex, coinValueForObstacle(obstacle));
}

function generateUntil(worldX) {
  const targetX = Math.max(0, Number(worldX) || 0);
  // Advance in fixed world-space slices, not caller-provided distances.  That
  // makes generateUntil(a); generateUntil(b) produce the same map as a single
  // generateUntil(b), which is important when crash replays generate the whole
  // visible world up front from recorded snapshots.
  while (generatedWorldX < targetX) {
    const nextWorldX = generatedWorldX < INITIAL_WORLD_GENERATION_X
      ? INITIAL_WORLD_GENERATION_X
      : generatedWorldX + WORLD_GENERATION_CHUNK;
    generateWorldSlice(nextWorldX);
    generatedWorldX = nextWorldX;
  }
}

function generateWorldSlice(worldX) {
  generateTerrainUntil(worldX);

  // Obstacles and pools define unsafe hanging zones below anchors, so place
  // them before anchors.  This lets anchor generation keep a conservative
  // vertical buffer above lower gate lips and liquid surfaces.
  while (nextObstacleX < worldX + ANCHOR_GATE_HORIZONTAL_CLEARANCE) {
    spawnObstacleCluster(nextObstacleX, spawnIndex++);
    nextObstacleX += rand(650, 980);
  }

  while (nextAnchorX < worldX) {
    const difficulty = clamp(nextAnchorX / 5000, 0, 1);
    const gap = rand(260, 420 + difficulty * 90);
    const wave = Math.sin(nextAnchorX / 680) * 95;
    const maxAnchorY = Math.min(
      terrainYAt(nextAnchorX) - ANCHOR_TERRAIN_CLEARANCE,
      anchorHazardMaxY(nextAnchorX),
    );
    const minAnchorY = ANCHOR_BASE_MIN_Y + wave;
    const preferredMaxAnchorY = Math.min(ANCHOR_BASE_MAX_Y + wave + difficulty * 80, maxAnchorY);
    const y = clamp(rand(minAnchorY, preferredMaxAnchorY), ANCHOR_MIN_Y, maxAnchorY);
    addAnchor(nextAnchorX, y);
    nextAnchorX += gap;
  }
}

function anchorHazardMaxY(x) {
  let maxY = Infinity;

  for (const o of obstacles) {
    if (o.type !== 'gate') continue;
    if (x < o.x - ANCHOR_GATE_HORIZONTAL_CLEARANCE || x > o.x + o.w + ANCHOR_GATE_HORIZONTAL_CLEARANCE) continue;

    // Gate gaps animate wider/narrower. The lower bar is most dangerous when
    // the gap is narrowest, because its top edge is closest to the anchor.
    const minGap = o.gap * 0.75;
    const lowerBarTop = o.gapY + minGap / 2;
    maxY = Math.min(maxY, lowerBarTop - ANCHOR_GATE_BOTTOM_CLEARANCE);
  }

  for (const pool of terrainPools) {
    if (x < pool.x - ANCHOR_LIQUID_HORIZONTAL_CLEARANCE || x > pool.x + pool.w + ANCHOR_LIQUID_HORIZONTAL_CLEARANCE) continue;
    maxY = Math.min(maxY, pool.levelY - ANCHOR_LIQUID_VERTICAL_CLEARANCE);
  }

  return maxY;
}

function spawnObstacleCluster(x, i) {
  const difficulty = clamp(x / 5500, 0, 1);
  const roll = random();
  const groundY = terrainYAt(x);
  let obstacle = null;

  if (i < 1) {
    obstacle = { type: 'gate', x, w: 26, gapY: H * 0.54, gap: 360, phase: rand(0, Math.PI * 2), speed: 0.65 };
  } else if (roll < 0.23) {
    obstacle = {
      type: 'gate',
      x,
      w: 28,
      gapY: rand(H * 0.38, H * 0.64),
      gap: rand(300 - difficulty * 45, 390 - difficulty * 40),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.55, 1.15 + difficulty * 0.25),
    };
  } else if (roll < 0.56) {
    obstacle = {
      type: 'saw',
      x,
      y: rand(H * 0.30, clamp(groundY - 105, H * 0.42, H * 0.68)),
      r: rand(24, 38),
      spin: rand(-1, 1) < 0 ? -1 : 1,
      bob: rand(95, 180),
      phase: rand(0, Math.PI * 2),
    };
  } else {
    const ceiling = random() < 0.30;
    const size = rand(22, 31);
    const count = Math.floor(rand(4, 9));
    const spikeX = x + (ceiling ? 0 : rand(-50, 95));
    obstacle = {
      type: 'spikes',
      x: spikeX,
      y: ceiling ? 34 : 0,
      count,
      dir: ceiling ? 1 : -1,
      size,
      ground: !ceiling,
      height: ceiling ? size : size * rand(1.45, 1.95),
    };
  }

  if (obstacle) {
    obstacles.push(obstacle);
    spawnCoinNearObstacle(obstacle, i);
  }
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
    const makeValley = lastWasHill ? random() < 0.78 : random() < 0.34;
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
          type: random() < 0.62 ? 'water' : 'lava',
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

function terrainLiquidSurfaceY(pool, worldX, atTime = time) {
  const localX = worldX - pool.x;
  return pool.levelY +
    Math.sin(atTime * 3.2 + pool.waveOffset + localX * 0.055) * pool.waveAmp +
    Math.sin(atTime * 1.15 + pool.waveOffset * 1.7 + localX * 0.018) * 1.8;
}

function terrainPoolPolygons(pool, left = pool.x, right = pool.x + pool.w, atTime = time) {
  const start = Math.max(pool.x, left);
  const end = Math.min(pool.x + pool.w, right);
  if (end - start < 2) return [];

  const terrain = terrainPoints(start, end, TERRAIN_POOL_STEP);
  const polys = [];
  let surface = [];
  let ground = [];
  const wetThreshold = 1;
  const wetness = (p) => p.y - pool.levelY;
  const surfaceY = (p) => Math.min(terrainLiquidSurfaceY(pool, p.x, atTime), p.y - wetThreshold);
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

function terrainLiquidHitboxes(left = cameraX - 320, right = cameraX + cameraViewW() + 320, atTime = time) {
  const hitboxes = [];
  for (const pool of terrainPools) {
    if (pool.x > right || pool.x + pool.w < left) continue;
    for (const poly of terrainPoolPolygons(pool, left, right, atTime)) {
      hitboxes.push({ shape: 'polygon', kind: pool.type, points: poly.points });
    }
  }
  return hitboxes;
}

function terrainSolidHitbox(left = cameraX - 320, right = cameraX + cameraViewW() + 320) {
  const surface = terrainPoints(left, right, TERRAIN_STEP);
  const bottom = Math.max(LOST_BELOW_Y + 1000, cameraY + cameraViewH() + 1600);
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

function obstacleHitboxes(left = cameraX - 320, right = cameraX + cameraViewW() + 320, atTime = time) {
  const hitboxes = [terrainSolidHitbox(left, right)];
  hitboxes.push(...terrainLiquidHitboxes(left, right, atTime));

  for (const o of obstacles) {
    if (o.type === 'saw') {
      hitboxes.push({
        shape: 'circle',
        kind: 'saw',
        x: o.x,
        y: o.y + Math.sin(atTime * 1.8 + o.phase) * o.bob,
        r: o.r * 0.86,
      });
    } else if (o.type === 'gate') {
      const open = 0.5 + 0.5 * Math.sin(atTime * o.speed + o.phase);
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

function collectRunCoins() {
  if (replayMode) return;
  const playerBoxes = playerHitboxes();
  for (const coin of coins) {
    if (!coin || coin.collected) continue;
    const hit = playerBoxes.some(box => hypot(box.x - coin.x, box.y - coin.y) <= box.r + coin.r);
    if (!hit) continue;
    coin.collected = true;
    coin.collectedAt = time;
    collectedCoinIds.add(coin.id);
    playCoinSound();
    if (gameModeTracksStats()) {
      currentRunCoinsEarned += coin.value || COIN_VALUE;
      addCoinBalance(coin.value || COIN_VALUE);
    }
  }
}

function pruneCoins() {
  const cutoff = cameraX - 1800;
  coins = coins.filter(coin => coin && (!coin.collected || time - (coin.collectedAt || time) < 0.45) && coin.x > cutoff);
}

function drawCoins() {
  if (replayMode) return;
  const left = cameraX - 80;
  const right = cameraX + cameraViewW() + 80;
  for (const coin of coins) {
    if (!coin || coin.collected || coin.x < left || coin.x > right) continue;
    const pulse = 1 + Math.sin(time * 5.2 + coin.x * 0.02) * 0.08;
    const y = coin.y + Math.sin(time * 2.8 + coin.x * 0.01) * 4;
    ctx.save();
    ctx.translate(sx(coin.x), sy(y));
    const visual = coinVisualSpec(coin.value || COIN_VALUE);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = visual.fill;
    ctx.strokeStyle = visual.stroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = visual.shine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-3, -4, coin.r * 0.45, Math.PI * 1.05, Math.PI * 1.65);
    ctx.stroke();
    ctx.fillStyle = visual.stroke;
    ctx.font = '900 10px "Comic Sans MS", "Comic Sans", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(coin.value || COIN_VALUE), 0, 1);
    ctx.restore();
  }
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

  const waveHitbox = typeof escapeWaveHitbox === 'function' ? escapeWaveHitbox() : null;
  if (waveHitbox) {
    const hit = playerBoxes.some(playerBox => hitboxHitsPlayer(waveHitbox, playerBox));
    drawPath(waveHitbox);
    ctx.fillStyle = hit ? 'rgba(0, 120, 255, 0.28)' : 'rgba(0, 120, 255, 0.10)';
    ctx.strokeStyle = hit ? '#006fff' : '#3a9dff';
    ctx.fill();
    ctx.stroke();
  }

  // Lost-state threshold is not a collision hitbox, but it is useful in
  // debug mode because it explains the below-world death condition.
  ctx.strokeStyle = '#ff8a00';
  ctx.setLineDash([14, 9]);
  ctx.beginPath();
  ctx.moveTo(0, sy(LOST_BELOW_Y));
  ctx.lineTo(cameraViewW(), sy(LOST_BELOW_Y));
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
    ctx.restore();
  }
  ctx.restore();
}

function drawTerrain() {
  const left = cameraX - 260;
  const right = cameraX + cameraViewW() + 260;
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
  const viewW = cameraViewW();
  for (const a of anchors) {
    const x = sx(a.x);
    if (x < -50 || x > viewW + 80) continue;
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
    ctx.strokeStyle = d <= HOOK_RANGE ? ROPE : FAINT_LINE;
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
      ctx.fillStyle = d <= HOOK_RANGE ? ROPE : FAINT_LINE;
      ctx.beginPath();
      ctx.arc(sx(focusedAnchor.x), sy(focusedAnchor.y), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

const ESCAPE_WAVE_HITBOX_CURVE_STEPS = 12;

function escapeWaveCubicPoint(a, b, c, d, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * a.x + 3 * mt2 * t * b.x + 3 * mt * t2 * c.x + t2 * t * d.x,
    y: mt2 * mt * a.y + 3 * mt2 * t * b.y + 3 * mt * t2 * c.y + t2 * t * d.y,
  };
}

function appendEscapeWaveCurvePoints(points, start, c1, c2, end, steps = ESCAPE_WAVE_HITBOX_CURVE_STEPS) {
  for (let i = 1; i <= steps; i += 1) {
    points.push(escapeWaveCubicPoint(start, c1, c2, end, i / steps));
  }
}

function escapeWaveGeometry() {
  if (gameMode !== 'escapeWave' || !Number.isFinite(escapeWaveFrontX)) return null;
  const viewW = cameraViewW();
  const crestX = escapeWaveCrestX();
  if (crestX < cameraX - viewW * 0.45) return null;

  const left = cameraX - viewW * 0.55;
  const waveBob = Math.sin(time * 1.25) * 52 + Math.sin(time * 0.47 + 1.8) * 34;
  const top = -170 + waveBob * 0.25;
  const bottom = H + 220 + waveBob * 0.18;
  const lipY = H * 0.16 + waveBob;
  const shoulderY = H * 0.34 + waveBob * 0.72;
  const fillStart = { x: left, y: bottom };
  const fillLineTo = { x: left, y: top };
  const fillCurves = [
    [
      { x: crestX - 740, y: lipY - 150 },
      { x: crestX - 430, y: lipY + 125 },
      { x: crestX - 145, y: lipY - 52 },
    ],
    [
      { x: crestX - 20, y: lipY - 126 },
      { x: crestX + 122, y: lipY - 84 },
      { x: crestX + 142, y: lipY - 14 },
    ],
    [
      { x: crestX + 188, y: shoulderY + 135 },
      { x: crestX - 118, y: shoulderY + 166 },
      { x: crestX - 62, y: shoulderY + 38 },
    ],
    [
      { x: crestX - 190, y: shoulderY + 170 },
      { x: crestX - 250, y: bottom - 150 },
      { x: crestX - 230, y: bottom },
    ],
  ];
  const fillPoints = [fillStart, fillLineTo];
  let cursor = fillLineTo;
  for (const [c1, c2, end] of fillCurves) {
    appendEscapeWaveCurvePoints(fillPoints, cursor, c1, c2, end);
    cursor = end;
  }

  return { left, crestX, bottom, lipY, shoulderY, fillStart, fillLineTo, fillCurves, fillPoints };
}

function drawEscapeWave() {
  const wave = escapeWaveGeometry();
  if (!wave) return;
  const { left, crestX, bottom, lipY, shoulderY, fillStart, fillLineTo, fillCurves } = wave;
  const water = WATER;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // The water mass is a single soft shape behind the curling face.  Keep the
  // advancing edge curved; a straight rectangular wall reads like a debug fill.
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.moveTo(sx(fillStart.x), sy(fillStart.y));
  ctx.lineTo(sx(fillLineTo.x), sy(fillLineTo.y));
  for (const [c1, c2, end] of fillCurves) {
    ctx.bezierCurveTo(sx(c1.x), sy(c1.y), sx(c2.x), sy(c2.y), sx(end.x), sy(end.y));
  }
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.94;
  ctx.strokeStyle = water;
  ctx.lineWidth = 5;

  // Back/top ridge of the swell.
  ctx.beginPath();
  ctx.moveTo(sx(left + 70), sy(lipY - 64));
  ctx.bezierCurveTo(sx(crestX - 690), sy(lipY - 190), sx(crestX - 420), sy(lipY + 122), sx(crestX - 152), sy(lipY - 52));
  ctx.bezierCurveTo(sx(crestX - 62), sy(lipY - 112), sx(crestX + 78), sy(lipY - 98), sx(crestX + 135), sy(lipY - 20));
  ctx.stroke();

  // Breaking lip and rolling curl.
  ctx.beginPath();
  ctx.moveTo(sx(crestX - 150), sy(lipY - 52));
  ctx.bezierCurveTo(sx(crestX - 10), sy(lipY - 145), sx(crestX + 205), sy(lipY - 92), sx(crestX + 150), sy(lipY + 45));
  ctx.bezierCurveTo(sx(crestX + 110), sy(lipY + 145), sx(crestX - 98), sy(lipY + 116), sx(crestX - 18), sy(lipY + 34));
  ctx.stroke();

  // Curved front face down toward the floor.
  ctx.beginPath();
  ctx.moveTo(sx(crestX - 24), sy(lipY + 35));
  ctx.bezierCurveTo(sx(crestX - 172), sy(lipY + 170), sx(crestX - 280), sy(bottom - 310), sx(crestX - 225), sy(bottom));
  ctx.stroke();

  // Foam lines live inside the curl only, not across the whole screen.
  ctx.globalAlpha = 0.78;
  ctx.lineWidth = 3.5;
  for (let i = 0; i < 3; i++) {
    const dy = i * 44;
    ctx.beginPath();
    ctx.moveTo(sx(crestX - 170 + i * 20), sy(lipY + 28 + dy));
    ctx.bezierCurveTo(sx(crestX - 58), sy(lipY - 16 + dy), sx(crestX + 88), sy(lipY + 8 + dy), sx(crestX + 66), sy(lipY + 70 + dy));
    ctx.bezierCurveTo(sx(crestX + 35), sy(lipY + 125 + dy), sx(crestX - 128), sy(lipY + 105 + dy), sx(crestX - 76), sy(lipY + 52 + dy));
    ctx.stroke();
  }

  ctx.globalAlpha = 0.62;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx(left + 120), sy(shoulderY + 160));
  ctx.bezierCurveTo(sx(crestX - 520), sy(shoulderY + 40), sx(crestX - 330), sy(shoulderY + 230), sx(crestX - 115), sy(shoulderY + 105));
  ctx.stroke();

  ctx.restore();
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
  ctx.strokeStyle = MUTED_LINE;
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
