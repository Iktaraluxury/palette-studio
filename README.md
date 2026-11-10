# Palette Studio

Convert colors, build palettes, check WCAG contrast and export design tokens - all in your browser. No uploads, no accounts, no build step.

Open `index.html` in a browser and it works. It is a plain HTML/CSS/JavaScript page with zero dependencies, so you can also host it anywhere static files are served (GitHub Pages, Netlify, any web server).

## What it does

- **Color converter** - type a color as HEX (`#e63946`), RGB (`rgb(230, 57, 70)`) or HSL (`355 78% 56%`) and get all three formats back, with one-click copy.
- **Shade scales** - every color gets a ten-step scale (50-900, Tailwind style) with the hue preserved. Click any shade to copy it.
- **Palette builder** - name and save colors, reorder them, remove them. The palette persists in your browser via `localStorage` and never leaves your device.
- **Import** - paste any text (a stylesheet, a brand guide, a Figma export) and Palette Studio pulls out every hex code.
- **Contrast checker** - pick a text and background color and see the exact WCAG 2.x contrast ratio plus pass/fail badges for AA and AAA, normal and large text. This measures the contrast ratio between two colors; it is not a full accessibility audit of a design.
- **Design-token export** - one click exports the whole palette, with each color expanded into its shade scale, as:
  - CSS custom properties (`tokens.css`)
  - SCSS variables (`tokens.scss`)
  - a Tailwind config color block (`tailwind.config.js`)
  - W3C Design Tokens Community Group draft JSON (`tokens.json`)
  - a plain `name: hex` list

## Run the tests

The color math and the exporters live in `color.js`, a pure module with no DOM access, so it runs under Node's built-in test runner:

```sh
node --test
```

No dependencies to install. Any Node version 18 or newer works.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | The page structure |
| `styles.css` | All styling, responsive down to phones |
| `app.js` | DOM wiring and browser state (localStorage) |
| `color.js` | Pure color math + export logic (shared by app and tests) |
| `test/color.test.js` | Test suite (`node --test`) |

## Contributing

Issues and pull requests are welcome. If you add or change behavior in `color.js`, add or update the matching test so `node --test` stays green.

## Licence

[MIT](LICENSE)
