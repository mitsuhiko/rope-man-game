// Character figure presets (full-body skins) and rendering configuration.

const CHARACTER_FIGURES = {
  classic: {
    label: 'classic',
    premium: false,
    allowHats: true,
    allowBodyColor: true,
    allowHatColor: true,
    allowRopeColor: true,
  },
  'spider-man': {
    label: 'spider man',
    premium: true,
    allowHats: true,
    allowBodyColor: false,
    allowHatColor: false,
    allowRopeColor: true,
    ropeColor: { light: '#e2e8f0', dark: '#f1f5f9' },
    ropeStyle: 'web',
    hookColor: { light: '#2a67ff', dark: '#7fb0ff' },
    style: {
      armColor: { light: '#1d4ed8', dark: '#60a5fa' },
      legColor: { light: '#1d4ed8', dark: '#60a5fa' },
      torsoColor: { light: '#d62839', dark: '#ff5c70' },
      handColor: { light: '#d62839', dark: '#ff5c70' },
      outlineColor: { light: '#0f172a', dark: '#f8fafc' },
      armWidth: 4.4,
      legWidth: 4.4,
      torsoWidth: 4.4,
      gripHandRadius: 4.2,
      freeHandRadius: 3.2,
      head: {
        src: 'assets/skins/spider-man-mask.png',
        width: 34,
        height: 35,
        up: 3,
        side: 0,
        preserveColors: true,
      },
    },
  },
};

const CHARACTER_FIGURE_ORDER = Object.keys(CHARACTER_FIGURES);
const DEFAULT_CHARACTER_FIGURE = 'classic';
const characterFigureImages = {};

function normalizeCharacterFigureId(figureId) {
  return figureId && CHARACTER_FIGURES[figureId] ? figureId : DEFAULT_CHARACTER_FIGURE;
}

function selectedCharacterSkinHatSpec() {
  const hatId = characterAppearance && characterAppearance.hat;
  const spec = hatId && typeof CHARACTER_HATS !== 'undefined' ? CHARACTER_HATS[hatId] : null;
  if (!spec || !spec.skinFigure || !hatIsOwned(hatId)) return null;
  return spec;
}

function selectedCharacterSkinFigureId() {
  const skinHat = selectedCharacterSkinHatSpec();
  return skinHat ? normalizeCharacterFigureId(skinHat.skinFigure) : null;
}

function selectedCharacterFigureId() {
  return selectedCharacterSkinFigureId() || DEFAULT_CHARACTER_FIGURE;
}

function selectedCharacterFigureSpec() {
  return CHARACTER_FIGURES[selectedCharacterFigureId()] || CHARACTER_FIGURES[DEFAULT_CHARACTER_FIGURE];
}

function characterFigureLabel(figureId) {
  const spec = CHARACTER_FIGURES[normalizeCharacterFigureId(figureId)];
  return spec && spec.label ? spec.label : DEFAULT_CHARACTER_FIGURE;
}

function characterFigureAllowsHats(figureId = selectedCharacterFigureId()) {
  const spec = CHARACTER_FIGURES[normalizeCharacterFigureId(figureId)];
  return !spec || spec.allowHats !== false;
}

function characterFigureAllowsBodyColor(figureId = selectedCharacterFigureId()) {
  const spec = CHARACTER_FIGURES[normalizeCharacterFigureId(figureId)];
  return !spec || spec.allowBodyColor !== false;
}

function characterFigureAllowsHatColor(figureId = selectedCharacterFigureId()) {
  const spec = CHARACTER_FIGURES[normalizeCharacterFigureId(figureId)];
  return !spec || spec.allowHatColor !== false;
}

function characterFigureAllowsRopeColor(figureId = selectedCharacterFigureId()) {
  const spec = CHARACTER_FIGURES[normalizeCharacterFigureId(figureId)];
  return !spec || spec.allowRopeColor !== false;
}

function characterFigureThemeColor(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const themed = value[colorTheme === 'dark' ? 'dark' : 'light'] || value.light || value.dark;
    if (typeof themed === 'string') return themed;
  }
  return fallback;
}

function characterFigureHeadImage(figureId = selectedCharacterFigureId()) {
  const spec = CHARACTER_FIGURES[normalizeCharacterFigureId(figureId)];
  const head = spec && spec.style && spec.style.head;
  if (!head || !head.src) return null;
  if (characterFigureImages[head.src]) return characterFigureImages[head.src];
  const img = new Image();
  img.src = head.src;
  characterFigureImages[head.src] = img;
  return img;
}

function preloadCharacterFigureAssets() {
  characterFigureHeadImage();
}

function characterRenderStyle(figureId = selectedCharacterFigureId()) {
  const figureSpec = CHARACTER_FIGURES[normalizeCharacterFigureId(figureId)] || CHARACTER_FIGURES[DEFAULT_CHARACTER_FIGURE];
  const style = (figureSpec && figureSpec.style) || {};
  const bodyColor = characterColorForTheme(characterAppearance.color);
  const torsoColor = characterFigureThemeColor(style.torsoColor, bodyColor);
  const armColor = characterFigureThemeColor(style.armColor, bodyColor);
  const legColor = characterFigureThemeColor(style.legColor, armColor);
  const handColor = characterFigureThemeColor(style.handColor, armColor);
  const outlineColor = characterFigureThemeColor(style.outlineColor, null);
  const head = style.head || null;

  return {
    id: normalizeCharacterFigureId(figureId),
    spec: figureSpec,
    armColor,
    legColor,
    torsoColor,
    handColor,
    outlineColor,
    armWidth: Number(style.armWidth) || 3.8,
    legWidth: Number(style.legWidth) || 3.8,
    torsoWidth: Number(style.torsoWidth) || 3.8,
    gripHandRadius: Number(style.gripHandRadius) || 4,
    freeHandRadius: Number(style.freeHandRadius) || 3,
    head,
    hookColor: characterFigureThemeColor(figureSpec && figureSpec.hookColor, MUTED_LINE),
    ropeColor: characterFigureThemeColor(figureSpec && figureSpec.ropeColor, null),
    ropeStyle: figureSpec && figureSpec.ropeStyle ? figureSpec.ropeStyle : 'line',
  };
}

if (typeof characterAppearance !== 'undefined') {
  characterAppearance.figure = normalizeCharacterFigureId(characterAppearance.figure);
  if (typeof applyCustomRopeColor === 'function') applyCustomRopeColor();
}

preloadCharacterFigureAssets();
