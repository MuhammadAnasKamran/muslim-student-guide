// Smoke tests against the real content.json. Run with `npm test`, which builds first.

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { STATUS_LABELS, STATUS_NOT_RECORDED } from '../src/guide.js';

function load() {
  const doc = JSON.parse(readFileSync(new URL('../content.json', import.meta.url), 'utf8'));
  const screens = doc.sections
    .filter((s) => s.published)
    .map((section) => {
      const blocks = [...section.blocks, ...section.subsections.flatMap((sub) => sub.blocks)];
      return {
        section,
        entries: blocks.filter((b) => b.type === 'entry'),
        quotes: blocks.filter((b) => b.kind === 'blockquote'),
      };
    });
  const entries = screens.flatMap((s) => s.entries);
  const links = new Set(entries.flatMap((e) => e.fields.filter((f) => f.key === 'link').map((f) => f.value)));
  return { doc, screens, entries, links };
}

const screenView = (page, id) => page.locator(`[data-screen="${id}"]`);
const clean = (text) => text.replace('Halal status: ', '').replace(/\s+/g, ' ').trim();

async function openHome(page) {
  await page.goto('/');
  await expect(page.locator('.menu-link').first()).toBeVisible();
}

test('home loads with a menu in content.md order and no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  const { doc, screens } = load();
  await openHome(page);
  await expect(page).toHaveTitle(doc.meta.title);
  await expect(page.locator('.menu-link .menu-title')).toHaveText(screens.map((s) => s.section.title));
  expect(screens[0].section.title, 'prayer comes before food').toMatch(/prayer/i);
  expect(errors).toEqual([]);
});

test('every entry in content.json is on its screen with its name, facts and link', async ({ page }) => {
  const { screens, entries } = load();
  await openHome(page);
  await expect(page.locator('[data-entry-id]')).toHaveCount(entries.length);

  const problems = [];
  for (const { section, entries: list } of screens) {
    const view = screenView(page, section.id);
    const text = clean(await view.textContent());
    const hrefs = await view.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const entry of list) {
      const card = view.locator(`[data-entry-id="${entry.id}"]`);
      if ((await card.count()) !== 1) {
        problems.push(`${entry.name} is not on ${section.title}`);
        continue;
      }
      const name = await card.locator('h3').textContent();
      if (name !== entry.name) problems.push(`name "${name}" should be "${entry.name}"`);
      for (const { key, value } of entry.fields) {
        if (key === 'status' || key === 'jummah') continue;
        if (key === 'link') {
          if (!hrefs.includes(value)) problems.push(`${entry.name}: link not on screen`);
        } else if (key === 'tags') {
          for (const tag of value.split(' · ')) {
            if (!text.includes(clean(tag))) problems.push(`${entry.name}: tag "${tag}" not on screen`);
          }
        } else if (!text.includes(clean(value))) {
          problems.push(`${entry.name}: ${key} "${value}" not on screen`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});

test('halal status, Jummah and warnings are visible without tapping anything', async ({ page }) => {
  const { screens } = load();
  const problems = [];
  for (const { section, entries, quotes } of screens) {
    await page.goto('about:blank');
    await page.goto(`/#/${section.id}`);
    const view = screenView(page, section.id);
    await expect(view).toBeVisible();

    for (const entry of entries) {
      const fields = Object.fromEntries(entry.fields.map((f) => [f.key, f.value]));
      const card = view.locator(`[data-entry-id="${entry.id}"]`);
      const expected = fields.status ? STATUS_LABELS[fields.status].label : entry.statusMissing ? STATUS_NOT_RECORDED.label : null;
      if (expected) {
        // Visible on the row, or once above a group where every row shares it.
        const shown = await card.evaluate((el, label) => {
          const read = (node) => node && node.checkVisibility() && node.textContent.replace('Halal status: ', '').trim() === label;
          return read(el.querySelector('.row-head .status')) || read(el.closest('.group')?.querySelector('.shared .status'));
        }, expected);
        if (!shown) problems.push(`${entry.name}: status "${expected}" not visible on the row or above its group`);
      }
      if (fields.jummah) {
        const chip = card.locator('.row-head .chip', { hasText: fields.jummah === 'yes' ? /^Jummah$/ : /^No Jummah$/ });
        if (!(await chip.isVisible())) problems.push(`${entry.name}: Jummah chip hidden`);
      }
    }
    for (const quote of quotes) {
      const words = quote.runs.map((r) => r.text).join('').slice(0, 30);
      if (!(await view.locator('.alert', { hasText: words }).isVisible())) problems.push(`${section.title}: warning "${words}" hidden`);
    }
  }
  expect(problems).toEqual([]);
});

test('prayer times, access limits and shared facts show without tapping', async ({ page }) => {
  await page.goto('/#/prayer-facilities');
  const view = screenView(page, 'prayer-facilities');
  await expect(view.locator('.chip', { hasText: 'Daily prayers + Jummah' })).toBeVisible();
  await expect(view.locator('.chip', { hasText: /^Daily prayers$/ })).toBeVisible();
  await expect(view.locator('.shared .chip', { hasText: 'Residents only' })).toBeVisible();
  await expect(view.locator('.shared .chip', { hasText: 'Student card entry' })).toBeVisible();
});

test('map links carry a pin icon drawn in the page', async ({ page }) => {
  await page.goto('/#/halal-groceries');
  const mapLink = screenView(page, 'halal-groceries').locator('a[href*="maps.app.goo.gl"]').first();
  await expect(mapLink.locator('svg.link-icon')).toHaveCount(1);
  const external = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).host).filter((h) => h !== location.host));
  expect(external, 'the page must not load anything from a third party').toEqual([]);
});

test('tapping a row opens it, and Back closes it, then returns home', async ({ page }) => {
  const { screens } = load();
  const { id: screenId, title } = screens[0].section;
  await openHome(page);

  await page.locator('.menu-link').first().click();
  await expect(page).toHaveURL(new RegExp(`#/${screenId}$`));
  await expect(page.locator('#screen-title')).toHaveText(title);

  const row = screenView(page, screenId).locator('details.row').first();
  const entryId = await row.getAttribute('data-entry-id');
  await row.locator('summary').click();
  await expect(row).toHaveAttribute('open', '');
  await expect(page).toHaveURL(new RegExp(`#/${screenId}/${entryId}$`));

  await page.goBack();
  await expect(row).not.toHaveAttribute('open');
  await expect(page).toHaveURL(new RegExp(`#/${screenId}$`));
  await page.goBack();
  await expect(page.locator('.menu')).toBeVisible();

  await page.goto('about:blank');
  await page.goto(`/#/${screenId}/${entryId}`);
  await expect(screenView(page, screenId).locator(`details[data-entry-id="${entryId}"]`)).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.menu')).toBeVisible();
});

test('search narrows results and clearing restores the menu', async ({ page }) => {
  const { entries } = load();
  await openHome(page);
  const search = page.getByLabel('Search the guide');
  const results = page.locator('.results');

  await search.fill(entries[0].name.toUpperCase());
  await expect(results.locator(`[data-entry-id="${entries[0].id}"]`)).toBeVisible();
  await expect(page.locator('.menu')).toBeHidden();
  const count = await results.locator('[data-entry-id]').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(entries.length);
  await expect(page.locator('#result-count')).toHaveText(`${count} ${count === 1 ? 'result' : 'results'}`);

  await search.fill('qqqzzzxxx');
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('No results');

  await page.locator('.clear-button').click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(page.locator('.menu')).toBeVisible();
});

test('every link on the page comes from content.json, and every content link is on the page', async ({ page }) => {
  const { links } = load();
  await openHome(page);
  const anchors = await page.$$eval('a[href]', (els) => els.map((a) => ({ href: a.getAttribute('href'), rel: a.rel })));
  // Menu links are in-app page addresses (#/...); every other href must be a content.md link.
  const external = anchors.filter((a) => !a.href.startsWith('#'));
  expect(external.filter((a) => !links.has(a.href)).map((a) => a.href)).toEqual([]);
  expect([...links].filter((href) => !external.some((a) => a.href === href))).toEqual([]);
  expect(external.filter((a) => a.rel !== 'noopener').map((a) => a.href)).toEqual([]);
});

test('no tap target is smaller than 44px on any screen', async ({ page }) => {
  const { screens } = load();
  const measure = () =>
    page.$$eval('a[href], button, input, summary', (els) =>
      els
        .filter((el) => el.checkVisibility())
        .map((el) => {
          const box = el.getBoundingClientRect();
          return { what: el.id || el.textContent.trim().slice(0, 40), width: Math.round(box.width), height: Math.round(box.height) };
        })
        .filter((box) => box.width < 44 || box.height < 44),
    );

  await openHome(page);
  await page.getByLabel('Search the guide').fill('a');
  await expect(page.locator('.clear-button')).toBeVisible();
  const small = await measure();

  for (const { section } of screens) {
    await page.goto('about:blank');
    await page.goto(`/#/${section.id}`);
    await screenView(page, section.id).locator('details').evaluateAll((all) => all.forEach((d) => d.setAttribute('open', '')));
    small.push(...(await measure()).map((box) => ({ ...box, screen: section.title })));
  }
  expect(small).toEqual([]);
});

test.describe('copy address', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copies the exact address from content.json', async ({ page }) => {
    const { screens } = load();
    const withCopy = screens
      .flatMap(({ section, entries }) => entries.map((entry) => ({ section, entry })))
      .find(({ entry }) => entry.fields.some((f) => f.key === 'address') && !entry.fields.some((f) => f.key === 'link'));
    test.skip(!withCopy, 'no entry has an address without a link');

    const address = withCopy.entry.fields.find((f) => f.key === 'address').value;
    await page.goto(`/#/${withCopy.section.id}/${withCopy.entry.id}`);
    const button = screenView(page, withCopy.section.id).locator(`[data-entry-id="${withCopy.entry.id}"] .copy-button`);
    await button.click();
    await expect(button).toHaveText('Address copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  });
});
