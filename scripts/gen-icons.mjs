// Renderuje ikony aplikacji (web/PWA + Android) z SVG przy pomocy Playwright (Chromium).
// Uruchom: node scripts/gen-icons.mjs
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop stop-color="#6D8BFF"/><stop offset="0.55" stop-color="#4F6BF5"/><stop offset="1" stop-color="#7A4FE0"/></linearGradient>`;
const MARK = (s = 1, dx = 0, dy = 0) => `<g transform="translate(${dx} ${dy}) scale(${s})">
  <circle cx="22" cy="12" r="2.6" fill="#fff" opacity="0.85"/>
  <circle cx="42" cy="12" r="2.6" fill="#fff" opacity="0.85"/>
  <path d="M19 38.5l8.2 8.2L46 28" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;

const svgs = {
  rounded: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRAD}</defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#g)"/>
    <path d="M2 20 Q2 2 20 2 H44 Q62 2 62 20 V22 H2 Z" fill="#fff" opacity="0.14"/>${MARK()}</svg>`,
  square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRAD}</defs>
    <rect width="64" height="64" fill="url(#g)"/>
    <rect width="64" height="20" fill="#fff" opacity="0.14"/>${MARK(0.8, 6.4, 7.4)}</svg>`,
  maskable: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRAD}</defs>
    <rect width="64" height="64" fill="url(#g)"/>${MARK(0.62, 12.2, 12.6)}</svg>`,
  circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRAD}</defs>
    <circle cx="32" cy="32" r="31" fill="url(#g)"/>${MARK(0.72, 9, 9.8)}</svg>`,
  // Pierwszy plan ikony adaptacyjnej Androida (108dp, bezpieczna strefa 66dp w środku)
  foreground: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${MARK(0.92, 24.6, 25.6)}</svg>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log('✓', out.replace(root + '/', ''));
}

await render(svgs.rounded, 192, join(root, 'public/icons/icon-192.png'));
await render(svgs.rounded, 512, join(root, 'public/icons/icon-512.png'));
await render(svgs.maskable, 512, join(root, 'public/icons/maskable-512.png'));
await render(svgs.square, 180, join(root, 'public/icons/apple-touch-icon.png'));
await render(svgs.rounded, 1024, join(root, 'docs/icon-1024.png'));

const res = join(root, 'android/app/src/main/res');
if (existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    await render(svgs.rounded, 48 * k, join(res, `mipmap-${d}/ic_launcher.png`));
    await render(svgs.circle, 48 * k, join(res, `mipmap-${d}/ic_launcher_round.png`));
    await render(svgs.foreground, 108 * k, join(res, `mipmap-${d}/ic_launcher_foreground.png`));
  }

  // Ekrany startowe (Android < 12) – te same rozmiary co w szablonie Capacitora
  for (const dir of readdirSync(res).filter((d) => d.startsWith('drawable'))) {
    const file = join(res, dir, 'splash.png');
    if (!existsSync(file)) continue;
    const head = readFileSync(file).subarray(16, 24);
    const w = head.readUInt32BE(0);
    const h = head.readUInt32BE(4);
    const s = Math.round(Math.min(w, h) * 0.26);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#F4F5F8"/>
      <g transform="translate(${(w - s) / 2} ${(h - s) / 2}) scale(${s / 64})">${svgs.rounded.replace(/^<svg[^>]*>/, '').replace('</svg>', '')}</g></svg>`;
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
    writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));
    console.log('✓', file.replace(root + '/', ''));
  }
}

await browser.close();
