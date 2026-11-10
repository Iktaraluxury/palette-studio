/**
 * color.js - pure color math and export logic for Palette Studio.
 * No DOM access here, so the same module runs in the browser and in Node
 * for the test suite (node --test).
 */

/** Parse a hex string (#rgb, rgb, #rrggbb or rrggbb) into {r, g, b} or null. */
export function parseHex(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (s.startsWith('#')) s = s.slice(1);
  if (/^[0-9a-f]{3}$/.test(s)) {
    s = s.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-f]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** {r,g,b} (0-255) -> "#rrggbb". */
export function rgbToHex({ r, g, b }) {
  const p = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return '#' + p(r) + p(g) + p(b);
}

/** {r,g,b} (0-255) -> {h: 0-360, s: 0-100, l: 0-100}. */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: round1(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: round1(h * 60), s: round1(s * 100), l: round1(l * 100) };
}

/** {h: 0-360, s: 0-100, l: 0-100} -> {r,g,b} (0-255, rounded). */
export function hslToRgb({ h, s, l }) {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const chan = (t) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn <= 1 / 2) return q; // <= keeps the exact t=0.5 boundary on the q plateau
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return {
    r: Math.round(chan(hn + 1 / 3) * 255),
    g: Math.round(chan(hn) * 255),
    b: Math.round(chan(hn - 1 / 3) * 255),
  };
}

export function hexToHsl(hex) {
  const rgb = parseHex(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

export function hslToHex(hsl) {
  return rgbToHex(hslToRgb(hsl));
}

/** Parse "rgb(r, g, b)" or "r, g, b" into {r,g,b} or null. */
export function parseRgb(input) {
  if (typeof input !== 'string') return null;
  const m = input.trim().match(/^(?:rgb\s*\()?\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/i);
  if (!m) return null;
  const rgb = { r: +m[1], g: +m[2], b: +m[3] };
  if (rgb.r > 255 || rgb.g > 255 || rgb.b > 255) return null;
  return rgb;
}

/**
 * Parse any supported color input: hex (#rgb/#rrggbb), "rgb(r,g,b)",
 * "r,g,b", or "h s% l%" / "hsl(h, s%, l%)". Returns "#rrggbb" or null.
 */
export function parseColor(input) {
  const asHex = parseHex(input);
  if (asHex) return rgbToHex(asHex);
  const asRgb = parseRgb(input);
  if (asRgb) return rgbToHex(asRgb);
  if (typeof input === 'string') {
    const m = input.trim().match(/^(?:hsl\s*\()?\s*(\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%?\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%?\s*\)?$/i);
    if (m) {
      const h = +m[1], s = +m[2], l = +m[3];
      if (h <= 360 && s <= 100 && l <= 100) return hslToHex({ h, s, l });
    }
  }
  return null;
}

/** WCAG relative luminance (0-1) of an sRGB color. */
export function relativeLuminance({ r, g, b }) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two colors, 1-21. Accepts hex or {r,g,b}. */
export function contrastRatio(a, b) {
  const ca = typeof a === 'string' ? parseHex(a) : a;
  const cb = typeof b === 'string' ? parseHex(b) : b;
  if (!ca || !cb) return null;
  const l1 = relativeLuminance(ca);
  const l2 = relativeLuminance(cb);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return round2((hi + 0.05) / (lo + 0.05));
}

/**
 * WCAG 2.x thresholds: AA normal 4.5, AA large / AAA normal 3/4.5? No:
 * large text AA = 3.0, normal AAA = 7.0, large AAA = 4.5.
 */
export function wcagRating(ratio) {
  if (ratio == null) return null;
  return {
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
  };
}

/**
 * Ten-step shade scale for a base hex, lightest first (50 ... 900),
 * matching the steps Tailwind-style palettes use. Hue and saturation come
 * from the base color; lightness follows a fixed ramp. Returns
 * [{step, hex}], plus .baseIndex = index closest to the input color.
 */
export function shadeScale(hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  const lights = [96, 90, 80, 68, 56, 46, 37, 28, 19, 11];
  const scale = steps.map((step, i) => ({
    step,
    hex: hslToHex({ h: hsl.h, s: hsl.s, l: lights[i] }),
  }));
  let baseIndex = 0, best = Infinity;
  lights.forEach((l, i) => {
    const d = Math.abs(l - hsl.l);
    if (d < best) { best = d; baseIndex = i; }
  });
  scale.baseIndex = baseIndex;
  return scale;
}

/** Pull every unique hex code out of free text, normalized to #rrggbb. */
export function extractHexes(text) {
  if (typeof text !== 'string') return [];
  const out = [];
  const seen = new Set();
  const re = /#?[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const rgb = parseHex(m[0]);
    if (!rgb) continue;
    const hex = rgbToHex(rgb);
    if (!seen.has(hex)) {
      seen.add(hex);
      out.push(hex);
    }
  }
  return out;
}

/** "My Brand Blue!" -> "my-brand-blue". Falls back to a numbered name. */
export function slugify(name, fallback) {
  const s = String(name || '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback || 'color';
}

/** Make every slug in a palette unique by appending -2, -3, ... */
export function uniqueSlugs(palette) {
  const used = new Map();
  return palette.map((c, i) => {
    const base = slugify(c.name, 'color-' + (i + 1));
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    return n === 1 ? base : base + '-' + n;
  });
}

/**
 * palette: [{name, hex}]. Every exporter also expands each color into its
 * ten-step shade scale, so the output is usable as a full token set.
 */

export function exportCssVars(palette) {
  const slugs = uniqueSlugs(palette);
  const lines = [':root {'];
  palette.forEach((c, i) => {
    const slug = slugs[i];
    lines.push(`  --${slug}: ${normalizeHex(c.hex)};`);
    shadeScale(c.hex).forEach(({ step, hex }) => {
      lines.push(`  --${slug}-${step}: ${hex};`);
    });
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

export function exportScssVars(palette) {
  const slugs = uniqueSlugs(palette);
  const lines = [];
  palette.forEach((c, i) => {
    const slug = slugs[i];
    lines.push(`$${slug}: ${normalizeHex(c.hex)};`);
    shadeScale(c.hex).forEach(({ step, hex }) => {
      lines.push(`$${slug}-${step}: ${hex};`);
    });
  });
  return lines.join('\n') + '\n';
}

export function exportTailwindConfig(palette) {
  const slugs = uniqueSlugs(palette);
  const entries = palette.map((c, i) => {
    const slug = slugs[i];
    const scale = shadeScale(c.hex);
    const shades = scale.map(({ step, hex }) => `          ${step}: '${hex}'`).join(',\n');
    return `        '${slug}': {\n${shades},\n          DEFAULT: '${normalizeHex(c.hex)}',\n        }`;
  });
  return [
    '/** @type {import(\'tailwindcss\').Config} */',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    '      colors: {',
    entries.join(',\n'),
    '      },',
    '    },',
    '  },',
    '};',
    '',
  ].join('\n');
}

/** W3C Design Tokens Community Group draft format. */
export function exportTokensJson(palette) {
  const slugs = uniqueSlugs(palette);
  const root = {};
  palette.forEach((c, i) => {
    const slug = slugs[i];
    const group = {};
    shadeScale(c.hex).forEach(({ step, hex }) => {
      group[String(step)] = { $value: hex, $type: 'color' };
    });
    group.DEFAULT = { $value: normalizeHex(c.hex), $type: 'color' };
    root[slug] = group;
  });
  return JSON.stringify(root, null, 2) + '\n';
}

export function exportPlainList(palette) {
  return palette.map((c) => `${c.name || 'color'}: ${normalizeHex(c.hex)}`).join('\n') + '\n';
}

/** Normalize to lowercase #rrggbb, or null if invalid. */
export function normalizeHex(hex) {
  const rgb = parseHex(hex);
  return rgb ? rgbToHex(rgb) : null;
}

/** Pick readable text color (#111827 dark or #ffffff) for a background. */
export function readableTextOn(hex) {
  const onDark = contrastRatio(hex, '#111827');
  const onWhite = contrastRatio(hex, '#ffffff');
  return onDark >= onWhite ? '#111827' : '#ffffff';
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
