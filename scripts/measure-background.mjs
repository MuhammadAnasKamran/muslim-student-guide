#!/usr/bin/env node
// Reports the brightest and darkest pixels of src/background.jpg, the figures
// tests/unit/contrast.test.mjs uses to check text over the photograph.
// Run it after replacing the image, and paste the numbers into that test.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT } from './parse.mjs';

const file = process.argv[2] ?? path.join(ROOT, 'src/background.jpg');
const browser = await chromium.launch();
const page = await browser.newPage();
const stats = await page.evaluate(async (dataUrl) => {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = Math.round((image.height / image.width) * 160);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  let darkest = [255, 255, 255];
  let brightest = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    const pixel = [data[i], data[i + 1], data[i + 2]];
    if (luminance(pixel) < luminance(darkest)) darkest = pixel;
    if (luminance(pixel) > luminance(brightest)) brightest = pixel;
  }
  return { brightest, darkest };
}, `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`);
await browser.close();

console.log(`${path.relative(process.cwd(), file)}`);
console.log(`const PHOTO = { brightest: [${stats.brightest}], darkest: [${stats.darkest}] };`);
