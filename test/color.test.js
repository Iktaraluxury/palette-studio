import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHex, rgbToHex, rgbToHsl, hslToRgb, hexToHsl, hslToHex,
  parseRgb, parseColor, relativeLuminance, contrastRatio, wcagRating,
  shadeScale, extractHexes, slugify, uniqueSlugs,
  exportCssVars, exportScssVars, exportTailwindConfig, exportTokensJson,
  exportPlainList, normalizeHex, readableTextOn,
} from '../color.js';

test('parseHex accepts #rgb, rgb, #rrggbb, rrggbb', () => {
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('#1a2b3c'), { r: 26, g: 43, b: 60 });
  assert.deepEqual(parseHex('1A2B3C'), { r: 26, g: 43, b: 60 });
});

test('parseHex rejects bad input', () => {
  assert.equal(parseHex('#ff'), null);
  assert.equal(parseHex('#ffff'), null);
  assert.equal(parseHex('#gggggg'), null);
  assert.equal(parseHex(''), null);
  assert.equal(parseHex(null), null);
  assert.equal(parseHex(123), null);
});

test('rgbToHex round-trips with parseHex', () => {
  const rgb = { r: 7, g: 129, b: 250 };
  assert.deepEqual(parseHex(rgbToHex(rgb)), rgb);
  assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }), '#000000');
  assert.equal(rgbToHex({ r: 255, g: 255, b: 255 }), '#ffffff');
});

test('rgbToHex clamps out-of-range channels', () => {
  assert.equal(rgbToHex({ r: 300, g: -5, b: 12.4 }), '#ff000c');
});

test('rgbToHsl known values', () => {
  assert.deepEqual(rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
  assert.deepEqual(rgbToHsl({ r: 255, g: 255, b: 255 }), { h: 0, s: 0, l: 100 });
  assert.deepEqual(rgbToHsl({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, l: 0 });
  const teal = rgbToHsl({ r: 0, g: 128, b: 128 });
  assert.equal(teal.h, 180);
  assert.equal(teal.s, 100);
  assert.equal(teal.l, 25.1);
});

test('hsl <-> rgb round-trip', () => {
  const cases = ['#e63946', '#1d3557', '#a8dadc', '#06d6a0', '#8338ec'];
  for (const hex of cases) {
    assert.equal(hslToHex(hexToHsl(hex)), hex);
  }
});

test('hslToRgb wraps hue and clamps s/l', () => {
  assert.deepEqual(hslToRgb({ h: 360, s: 100, l: 50 }), { r: 255, g: 0, b: 0 });
  assert.deepEqual(hslToRgb({ h: -180, s: 100, l: 25 }), { r: 0, g: 128, b: 128 }); // exact plateau boundary
  assert.deepEqual(hslToRgb({ h: -120, s: 100, l: 25 }), { r: 0, g: 0, b: 128 });
  assert.deepEqual(hslToRgb({ h: 0, s: 0, l: 50 }), { r: 128, g: 128, b: 128 });
});

test('parseRgb accepts rgb() and bare triplets', () => {
  assert.deepEqual(parseRgb('rgb(12, 34, 56)'), { r: 12, g: 34, b: 56 });
  assert.deepEqual(parseRgb('12,34,56'), { r: 12, g: 34, b: 56 });
  assert.equal(parseRgb('rgb(256, 0, 0)'), null);
  assert.equal(parseRgb('red'), null);
});

test('parseColor handles hex, rgb and hsl input', () => {
  assert.equal(parseColor('#e63946'), '#e63946');
  assert.equal(parseColor('rgb(230, 57, 70)'), '#e63946');
  assert.equal(parseColor('355 78% 56%'), '#e63746');
  assert.equal(parseColor('hsl(355, 78%, 56%)'), '#e63746');
  assert.equal(parseColor('not a color'), null);
});

test('relativeLuminance of black and white', () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.ok(Math.abs(relativeLuminance({ r: 255, g: 255, b: 255 }) - 1) < 1e-9);
});

test('contrastRatio black vs white is 21, same color is 1', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.equal(contrastRatio('#336699', '#336699'), 1);
  assert.equal(contrastRatio('#zzzzzz', '#fff'), null);
});

test('wcagRating thresholds', () => {
  assert.deepEqual(wcagRating(21), { aaNormal: true, aaaNormal: true, aaLarge: true, aaaLarge: true });
  assert.deepEqual(wcagRating(4.5), { aaNormal: true, aaaNormal: false, aaLarge: true, aaaLarge: true });
  assert.deepEqual(wcagRating(3), { aaNormal: false, aaaNormal: false, aaLarge: true, aaaLarge: false });
  assert.deepEqual(wcagRating(2.9), { aaNormal: false, aaaNormal: false, aaLarge: false, aaaLarge: false });
  assert.equal(wcagRating(null), null);
});

test('shadeScale returns ten steps, lightest first, with baseIndex', () => {
  const scale = shadeScale('#3b82f6');
  assert.equal(scale.length, 10);
  assert.deepEqual(scale.map((s) => s.step), [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
  const lights = scale.map((s) => hexToHsl(s.hex).l);
  for (let i = 1; i < lights.length; i++) {
    assert.ok(lights[i] < lights[i - 1], 'lightness must decrease along the scale');
  }
  // Hue is preserved across the whole scale.
  const baseHue = hexToHsl('#3b82f6').h;
  scale.forEach((s) => {
    const h = hexToHsl(s.hex).h;
    // 8-bit rounding can shift the measured hue a few degrees at very high lightness.
    assert.ok(Math.abs(h - baseHue) < 4, `hue drifted at step ${s.step}`);
  });
  assert.ok(scale.baseIndex >= 0 && scale.baseIndex < 10);
  assert.equal(shadeScale('#nope'), null);
});

test('shadeScale baseIndex sits near the input lightness', () => {
  const scale = shadeScale('#3b82f6'); // l ~= 60 -> closest ramp stop 56 at index 4
  assert.equal(scale.baseIndex, 4);
});

test('extractHexes finds and normalizes unique hexes', () => {
  const text = 'brand: #E63946, accent e63946 again, #1d3557; short #abc and #AABBCC';
  assert.deepEqual(extractHexes(text), ['#e63946', '#1d3557', '#aabbcc']);
  assert.deepEqual(extractHexes('nothing here'), []);
  assert.deepEqual(extractHexes(null), []);
});

test('slugify cleans names and falls back', () => {
  assert.equal(slugify('My Brand Blue!'), 'my-brand-blue');
  assert.equal(slugify('  Spaces  Everywhere  '), 'spaces-everywhere');
  assert.equal(slugify('!!!', 'color-3'), 'color-3');
  assert.equal(slugify(''), 'color');
});

test('uniqueSlugs de-duplicates repeated names', () => {
  const slugs = uniqueSlugs([{ name: 'Blue' }, { name: 'blue' }, { name: '' }]);
  assert.deepEqual(slugs, ['blue', 'blue-2', 'color-3']);
});

const palette = [
  { name: 'Ocean', hex: '#1d3557' },
  { name: 'Coral', hex: '#e63946' },
];

test('exportCssVars emits root block with base and ten shades per color', () => {
  const css = exportCssVars(palette);
  assert.ok(css.startsWith(':root {'));
  assert.ok(css.includes('--ocean: #1d3557;'));
  assert.ok(css.includes('--ocean-50:'));
  assert.ok(css.includes('--ocean-900:'));
  assert.ok(css.includes('--coral-500:'));
  assert.equal((css.match(/--ocean-/g) || []).length, 10);
  assert.ok(css.endsWith('}\n'));
});

test('exportScssVars uses $ variables', () => {
  const scss = exportScssVars(palette);
  assert.ok(scss.includes('$ocean: #1d3557;'));
  assert.ok(scss.includes('$coral-700:'));
  assert.equal((scss.match(/\$/g) || []).length, 22); // 2 bases + 20 shades
});

test('exportTailwindConfig emits valid module with DEFAULT', () => {
  const tw = exportTailwindConfig(palette);
  assert.ok(tw.includes('module.exports = {'));
  assert.ok(tw.includes("'ocean': {"));
  assert.ok(tw.includes("DEFAULT: '#1d3557'"));
  assert.ok(tw.includes("50: '#"));
});

test('exportTokensJson is W3C-shaped and parses', () => {
  const json = JSON.parse(exportTokensJson(palette));
  assert.equal(json.ocean.DEFAULT.$value, '#1d3557');
  assert.equal(json.ocean.DEFAULT.$type, 'color');
  assert.equal(json.coral['500'].$type, 'color');
  assert.equal(Object.keys(json.ocean).length, 11); // 10 steps + DEFAULT
});

test('exportPlainList lists name: hex lines', () => {
  assert.equal(exportPlainList(palette), 'Ocean: #1d3557\nCoral: #e63946\n');
});

test('normalizeHex and readableTextOn', () => {
  assert.equal(normalizeHex('#FFF'), '#ffffff');
  assert.equal(normalizeHex('nope'), null);
  assert.equal(normalizeHex('bad'), '#bbaadd'); // 'bad' is a valid 3-digit hex
  assert.equal(readableTextOn('#000000'), '#ffffff');
  assert.equal(readableTextOn('#ffffff'), '#111827');
});
