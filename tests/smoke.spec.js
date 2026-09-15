// Smoke tests against the real content.json. Run with `npm test`, which builds first.

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const STATUS_WORDS = {
  certified: 'Certified',
  'certified-section': 'Certified section only',
  'check-packaging': 'Check packaging',
  unverified: 'Unverified',
};

function published() {
  const doc = JSON.parse(readFileSync(new URL('../content.json', import.meta.url), 'utf8'));
  const entries = doc.sections
    .filter((s) => s.published)
    .flatMap((s) => [...s.blocks, ...s.subsections.flatMap((sub) => sub.blocks)])
    .filter((b) => b.type === 'entry');
  const links = new Set(entries.flatMap((e) => e.fields.filter((f) => f.key === 'link').map((f) => f.value)));
  return { doc, entries, links };
}

const cards = (page) => page.locator('[data-entry-id]:visible');

async function open(page) {
  await page.goto('/');
  await expect(page.locator('#result-count')).toHaveText(/^Showing all \d+ listings$/);
}

test('page loads with no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  await open(page);
  await expect(page).toHaveTitle(published().doc.meta.title);
  expect(errors).toEqual([]);
});

test('every entry in content.json is in the DOM with its name, fields and status', async ({ page }) => {
  const { entries } = published();
  await open(page);
  await expect(page.locator('[data-entry-id]')).toHaveCount(entries.length);
  await expect(cards(page)).toHaveCount(entries.length);

  const rendered = await page.$$eval('[data-entry-id]', (els) =>
    Object.fromEntries(
      els.map((el) => [
        el.dataset.entryId,
        {
          name: el.querySelector('h3').textContent,
          text: el.textContent.replace(/\s+/g, ' '),
          status: el.querySelector('.status')?.textContent.replace('Halal status: ', '') ?? null,
        },
      ]),
    ),
  );

  const problems = [];
  for (const entry of entries) {
    const card = rendered[entry.id];
    if (!card) {
      problems.push(`missing: ${entry.name}`);
      continue;
    }
    if (card.name !== entry.name) problems.push(`name "${card.name}" should be "${entry.name}"`);
    for (const { key, value } of entry.fields) {
      if (['link', 'status', 'jummah'].includes(key)) continue;
      if (!card.text.includes(value.replace(/\s+/g, ' '))) problems.push(`${entry.name}: ${key} not shown`);
    }
    const status = entry.fields.find((f) => f.key === 'status')?.value;
    const expected = status ? STATUS_WORDS[status] : entry.statusMissing ? 'Halal status not recorded' : null;
    if (card.status !== expected) problems.push(`${entry.name}: status shows "${card.status}", expected "${expected}"`);
  }
  expect(problems).toEqual([]);
});

test('search narrows the list and clearing restores it', async ({ page }) => {
  const { entries } = published();
  const target = entries[0].name;
  await open(page);

  const search = page.getByLabel('Search the guide');
  await expect(search).toHaveAttribute('type', 'search');
  await search.fill(target.toUpperCase());
  await expect(page.locator(`[data-entry-id="${entries[0].id}"]`)).toBeVisible();
  await expect.poll(() => cards(page).count()).toBeLessThan(entries.length);
  const narrowed = await cards(page).count();
  expect(narrowed).toBeGreaterThan(0);
  await expect(page.locator('#result-count')).toHaveText(`Showing ${narrowed} of ${entries.length} listings`);

  await search.fill('qqqzzzxxx');
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('section.section:visible')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(cards(page)).toHaveCount(entries.length);
  await expect(page.locator('#empty-state')).toBeHidden();
});

test('each filter chip changes the count', async ({ page }) => {
  const { entries } = published();
  await open(page);
  const chips = page.locator('#filters .chip');
  await expect(chips).toHaveCount(7);
  const all = page.locator('.chip[data-filter="all"]');
  await expect(all).toHaveAttribute('aria-pressed', 'true');

  for (const chip of await chips.all()) {
    if ((await chip.getAttribute('data-filter')) === 'all') continue;
    const label = await chip.textContent();
    await all.click();
    await chip.click();
    await expect(chip, label).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    const count = await cards(page).count();
    expect(count, `${label} should show some listings`).toBeGreaterThan(0);
    expect(count, `${label} should hide some listings`).toBeLessThan(entries.length);
    await expect(page.locator('#result-count')).toHaveText(`Showing ${count} of ${entries.length} listings`);
  }

  await all.click();
  await expect(cards(page)).toHaveCount(entries.length);
  await expect(page.locator('.chip[aria-pressed="true"]')).toHaveCount(1);
});

test('every link on the page comes from content.json, and every content link is on the page', async ({ page }) => {
  const { links } = published();
  await open(page);
  const anchors = await page.$$eval('a[href]', (els) => els.map((a) => ({ href: a.getAttribute('href'), rel: a.rel })));
  // The skip link points inside the page; every other href must be a content.md link.
  const external = anchors.filter((a) => !a.href.startsWith('#'));
  expect(external.filter((a) => !links.has(a.href)).map((a) => a.href)).toEqual([]);
  expect([...links].filter((href) => !external.some((a) => a.href === href))).toEqual([]);
  expect(external.filter((a) => a.rel !== 'noopener').map((a) => a.href)).toEqual([]);
});

test('no tap target is smaller than 44px', async ({ page }) => {
  await open(page);
  await page.getByLabel('Search the guide').fill('a');
  await expect(page.getByRole('button', { name: 'Clear search', exact: true })).toBeVisible();

  const small = await page.$$eval('a[href], button, input, select, textarea, [role="button"]', (els) =>
    els
      .filter((el) => el.checkVisibility())
      .map((el) => {
        const box = el.getBoundingClientRect();
        return { what: el.id || el.textContent.trim().slice(0, 40), width: Math.round(box.width), height: Math.round(box.height) };
      })
      .filter((box) => box.width < 44 || box.height < 44),
  );
  expect(small).toEqual([]);
});
