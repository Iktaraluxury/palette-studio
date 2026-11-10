import {
  parseColor, parseHex, rgbToHex, rgbToHsl, contrastRatio, wcagRating,
  shadeScale, extractHexes, exportCssVars, exportScssVars,
  exportTailwindConfig, exportTokensJson, exportPlainList, readableTextOn,
} from './color.js';

const STORAGE_KEY = 'palette-studio.palette.v1';

const $ = (id) => document.getElementById(id);

const els = {
  convInput: $('conv-input'),
  convPicker: $('conv-picker'),
  convSwatch: $('conv-swatch'),
  convError: $('conv-error'),
  convValues: $('conv-values'),
  shadeStrip: $('shade-strip'),
  paletteName: $('palette-name'),
  addColor: $('add-color'),
  importText: $('import-text'),
  importBtn: $('import-btn'),
  paletteList: $('palette-list'),
  paletteEmpty: $('palette-empty'),
  fgInput: $('fg-input'),
  fgPicker: $('fg-picker'),
  bgInput: $('bg-input'),
  bgPicker: $('bg-picker'),
  fgPicks: $('fg-picks'),
  bgPicks: $('bg-picks'),
  contrastPreview: $('contrast-preview'),
  ratioValue: $('ratio-value'),
  badges: $('badges'),
  exportCode: $('export-code'),
  copyExport: $('copy-export'),
  downloadExport: $('download-export'),
  exportEmpty: $('export-empty'),
  toast: $('toast'),
};

const state = {
  current: '#6d5ef0',
  palette: loadPalette(),
  fg: '#111827',
  bg: '#ffffff',
  format: 'css',
};

function loadPalette() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && parseHex(c.hex))
      .map((c) => ({ name: String(c.name || ''), hex: rgbToHex(parseHex(c.hex)) }));
  } catch {
    return [];
  }
}

function savePalette() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.palette));
  } catch {
    // Private browsing or full storage: the palette simply won't persist.
  }
}

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(label || 'Copied');
  } catch {
    toast('Copy failed - select and copy manually');
  }
}

/* ---- Converter ---- */

function setCurrentColor(hex, { fromPicker = false } = {}) {
  state.current = hex;
  if (!fromPicker) els.convPicker.value = hex;
  els.convSwatch.style.background = hex;
  els.convError.hidden = true;

  const rgb = parseHex(hex);
  const hsl = rgbToHsl(rgb);
  els.convValues.innerHTML = '';
  const rows = [
    ['HEX', hex],
    ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
    ['HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    const btn = document.createElement('button');
    btn.className = 'copy-mini';
    btn.type = 'button';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => copyText(value, label + ' copied'));
    const dtWrap = dt, ddWrap = dd, btnWrap = btn;
    els.convValues.append(dtWrap, ddWrap, btnWrap);
  }

  renderShades();
}

function renderShades() {
  const scale = shadeScale(state.current);
  els.shadeStrip.innerHTML = '';
  scale.forEach(({ step, hex }, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'shade-cell';
    cell.style.background = hex;
    cell.style.color = readableTextOn(hex);
    cell.setAttribute('aria-label', `Copy shade ${step}, ${hex}`);
    if (i === scale.baseIndex) cell.style.boxShadow = 'inset 0 0 0 2px currentColor';
    const stepEl = document.createElement('span');
    stepEl.textContent = step;
    const hexEl = document.createElement('span');
    hexEl.className = 'hex';
    hexEl.textContent = hex;
    cell.append(stepEl, hexEl);
    cell.addEventListener('click', () => copyText(hex, `${hex} copied`));
    els.shadeStrip.append(cell);
  });
}

els.convInput.addEventListener('input', () => {
  const hex = parseColor(els.convInput.value);
  if (hex) {
    setCurrentColor(hex);
  } else {
    els.convError.hidden = els.convInput.value.trim() === '';
  }
});

els.convPicker.addEventListener('input', () => {
  els.convInput.value = els.convPicker.value;
  setCurrentColor(els.convPicker.value, { fromPicker: true });
});

/* ---- Palette ---- */

function renderPalette() {
  els.paletteList.innerHTML = '';
  els.paletteEmpty.hidden = state.palette.length > 0;
  state.palette.forEach((color, i) => {
    const li = document.createElement('li');

    const sw = document.createElement('span');
    sw.className = 'palette-swatch';
    sw.style.background = color.hex;

    const meta = document.createElement('div');
    meta.className = 'palette-meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = color.name || 'Untitled';
    const hex = document.createElement('div');
    hex.className = 'hex';
    hex.textContent = color.hex;
    meta.append(name, hex);

    const actions = document.createElement('div');
    actions.className = 'palette-actions';

    const mkBtn = (label, title, fn, disabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      if (disabled) b.disabled = true;
      b.addEventListener('click', fn);
      return b;
    };

    actions.append(
      mkBtn('↑', 'Move up', () => moveColor(i, -1), i === 0),
      mkBtn('↓', 'Move down', () => moveColor(i, 1), i === state.palette.length - 1),
      mkBtn('⧉', 'Copy hex', () => copyText(color.hex, `${color.hex} copied`)),
      mkBtn('✕', 'Remove', () => {
        state.palette.splice(i, 1);
        savePalette();
        renderAll();
      }),
    );

    li.append(sw, meta, actions);
    els.paletteList.append(li);
  });
  renderPicks();
  renderExport();
}

function moveColor(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= state.palette.length) return;
  [state.palette[i], state.palette[j]] = [state.palette[j], state.palette[i]];
  savePalette();
  renderAll();
}

els.addColor.addEventListener('click', () => {
  const name = els.paletteName.value.trim();
  state.palette.push({ name, hex: state.current });
  els.paletteName.value = '';
  savePalette();
  renderAll();
  toast(`Added ${name || state.current}`);
});

els.importBtn.addEventListener('click', () => {
  const hexes = extractHexes(els.importText.value);
  if (hexes.length === 0) {
    toast('No hex codes found');
    return;
  }
  const existing = new Set(state.palette.map((c) => c.hex));
  let added = 0;
  hexes.forEach((hex) => {
    if (!existing.has(hex)) {
      state.palette.push({ name: '', hex });
      existing.add(hex);
      added += 1;
    }
  });
  els.importText.value = '';
  savePalette();
  renderAll();
  toast(added === 0 ? 'All found colors are already in the palette' : `Imported ${added} color${added === 1 ? '' : 's'}`);
});

/* ---- Contrast checker ---- */

function renderPicks() {
  for (const [container, key] of [[els.fgPicks, 'fg'], [els.bgPicks, 'bg']]) {
    container.innerHTML = '';
    state.palette.forEach((color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = color.hex;
      b.title = `${color.name || 'Color'} ${color.hex}`;
      b.setAttribute('aria-label', `Use ${color.name || color.hex} as ${key === 'fg' ? 'text' : 'background'}`);
      b.addEventListener('click', () => {
        state[key] = color.hex;
        renderContrast();
      });
      container.append(b);
    });
  }
}

function syncContrastInputs() {
  els.fgInput.value = state.fg;
  els.bgInput.value = state.bg;
  if (parseHex(state.fg)) els.fgPicker.value = state.fg;
  if (parseHex(state.bg)) els.bgPicker.value = state.bg;
}

function renderContrast() {
  syncContrastInputs();
  const fg = parseColor(state.fg);
  const bg = parseColor(state.bg);
  if (!fg || !bg) {
    els.ratioValue.textContent = '-';
    els.badges.innerHTML = '';
    return;
  }
  const ratio = contrastRatio(fg, bg);
  const rating = wcagRating(ratio);
  els.ratioValue.textContent = `${ratio}:1`;
  els.contrastPreview.style.background = bg;
  els.contrastPreview.querySelectorAll('span').forEach((s) => { s.style.color = fg; });
  els.badges.innerHTML = '';
  const badges = [
    ['AA normal', rating.aaNormal],
    ['AAA normal', rating.aaaNormal],
    ['AA large', rating.aaLarge],
    ['AAA large', rating.aaaLarge],
  ];
  for (const [label, pass] of badges) {
    const el = document.createElement('span');
    el.className = 'badge ' + (pass ? 'pass' : 'fail');
    el.textContent = `${label} ${pass ? '✓' : '✕'}`;
    els.badges.append(el);
  }
}

for (const [input, picker, key] of [
  [els.fgInput, els.fgPicker, 'fg'],
  [els.bgInput, els.bgPicker, 'bg'],
]) {
  input.addEventListener('input', () => {
    state[key] = input.value;
    renderContrast();
  });
  picker.addEventListener('input', () => {
    state[key] = picker.value;
    renderContrast();
  });
}

/* ---- Export ---- */

const exporters = {
  css: { fn: exportCssVars, filename: 'tokens.css' },
  scss: { fn: exportScssVars, filename: 'tokens.scss' },
  tailwind: { fn: exportTailwindConfig, filename: 'tailwind.config.js' },
  json: { fn: exportTokensJson, filename: 'tokens.json' },
  list: { fn: exportPlainList, filename: 'palette.txt' },
};

function renderExport() {
  const empty = state.palette.length === 0;
  els.exportEmpty.hidden = !empty;
  els.exportCode.textContent = empty ? '' : exporters[state.format].fn(state.palette);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    state.format = tab.dataset.format;
    renderExport();
  });
});

els.copyExport.addEventListener('click', () => {
  if (state.palette.length === 0) return;
  copyText(exporters[state.format].fn(state.palette), 'Export copied');
});

els.downloadExport.addEventListener('click', () => {
  if (state.palette.length === 0) return;
  const { fn, filename } = exporters[state.format];
  const blob = new Blob([fn(state.palette)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
});

/* ---- Boot ---- */

function renderAll() {
  renderPalette();
  renderContrast();
  renderExport();
}

els.convInput.value = state.current;
setCurrentColor(state.current);
renderAll();
