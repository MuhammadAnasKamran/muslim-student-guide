// Smoke tests against the real content.json. Run with `npm test`, which builds first.

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { STATUS_LABELS, STATUS_NOT_RECORDED, directLinkEntry, groupScreenId, hasGroupPages } from '../src/guide.js';

// Every screen the app renders: one per section, and on sections with group pages,
// one per group as well. `id` is the screen's address and data-screen value.
function load() {
  const doc = JSON.parse(readFileSync(new URL('../content.json', import.meta.url), 'utf8'));
  const screen = (id, title, blockLists) => {
    const blocks = blockLists.flat();
    return { id, title, entries: blocks.filter((b) => b.type === 'entry'), quotes: blocks.filter((b) => b.kind === 'blockquote') };
  };
  const sections = doc.sections.filter((s) => s.published);
  const screens = sections.flatMap((section) => {
    if (!hasGroupPages(section)) return [screen(section.id, section.title, [section.blocks, ...section.subsections.map((sub) => sub.blocks)])];
    // A group that is only a link sits on the section screen, not on a page of its own.
    const direct = section.subsections.filter((sub) => directLinkEntry(sub));
    return [
      { ...screen(section.id, section.title, [section.blocks, ...direct.map((sub) => sub.blocks)]), direct: direct.map((sub) => directLinkEntry(sub)) },
      ...section.subsections
        .filter((sub) => !directLinkEntry(sub))
        .map((sub) => ({ ...screen(groupScreenId(section, sub), sub.title, [sub.blocks]), parent: section.id })),
    ];
  });
  const entries = screens.flatMap((s) => s.entries);
  const links = new Set(entries.flatMap((e) => e.fields.filter((f) => f.key === 'link').map((f) => f.value)));
  return { doc, sections, screens, entries, links };
}

// Every entry object in the parsed document, however deeply nested.
function* walk(node) {
  if (Array.isArray(node)) for (const item of node) yield* walk(item);
  else if (node && typeof node === 'object') {
    if (node.type === 'entry') yield node;
    for (const value of Object.values(node)) yield* walk(value);
  }
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

  const { doc, sections } = load();
  await openHome(page);
  await expect(page).toHaveTitle(doc.meta.title);
  await expect(page.locator('.menu-link .menu-title')).toHaveText(sections.map((s) => s.title));
  await expect(page.locator('.menu-link'), 'the menu shows headings only, no group names under them').toHaveText(sections.map((s) => s.title));
  expect(sections[0].title, 'prayer comes before food').toMatch(/prayer/i);
  expect(errors).toEqual([]);
});

test('every entry in content.json is on its screen with its name, facts and link', async ({ page }) => {
  const { screens, entries } = load();
  await openHome(page);
  await expect(page.locator('[data-entry-id]')).toHaveCount(entries.length);

  const problems = [];
  for (const { id, title, entries: list } of screens) {
    const view = screenView(page, id);
    const text = clean(await view.textContent());
    const hrefs = await view.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const entry of list) {
      const card = view.locator(`[data-entry-id="${entry.id}"]`);
      if ((await card.count()) !== 1) {
        problems.push(`${entry.name} is not on ${title}`);
        continue;
      }
      const name = await card.locator('h3').textContent();
      if (name !== entry.name) problems.push(`name "${name}" should be "${entry.name}"`);
      for (const { key, value } of entry.fields) {
        if (key === 'status' || key === 'jummah' || key === 'prayers') continue;
        if (key === 'washrooms') {
          const floors = await card.locator('.row-head .washroom-floor').evaluateAll((rows) =>
            rows.map((row) => `${row.querySelector('.floor-label').lastChild.textContent}: ${[...row.querySelectorAll('.washroom')].map((w) => w.textContent.toLowerCase()).join(', ')}`),
          );
          if (floors.join(' · ') !== value) problems.push(`${entry.name}: washrooms show "${floors.join(' · ')}", not "${value}"`);
          continue;
        }
        if (key === 'photo') {
          const img = (await card.evaluate((el) => el.classList.contains('info-card')))
            ? card.locator('.info-head img.info-logo')
            : page.locator(`details[data-entry-id="${entry.id}"] > .row-body img.row-photo-large`);
          const src = await img.first().getAttribute('src', { timeout: 2000 });
          if (src !== `photos/${value}`) problems.push(`${entry.name}: photo ${value} not on its row`);
        } else if (key === 'link') {
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

test('halal status and Jummah are visible without tapping, and warnings are never missed', async ({ page }) => {
  const { screens } = load();
  const problems = [];
  for (const { id, title, entries, quotes } of screens) {
    await page.goto('about:blank');
    await page.goto(`/#/${id}`);
    const view = screenView(page, id);
    await expect(view).toBeVisible();

    // Statuses on the row or once above the group; every warning note readable.
    for (const entry of entries) {
      const fields = Object.fromEntries(entry.fields.map((f) => [f.key, f.value]));
      const expected = fields.status ? STATUS_LABELS[fields.status].label : entry.statusMissing ? STATUS_NOT_RECORDED.label : null;
      if (!expected) continue;
      const shown = await view.locator(`[data-entry-id="${entry.id}"]`).evaluate((el, label) => {
        const read = (node) =>
          Boolean(node) && node.checkVisibility() && node.textContent.replace('Halal status: ', '').replace(/,\s*\d+$/, '').trim() === label;
        const saidByNote = [...(el.closest('.group')?.querySelectorAll('.alert') ?? [])].some(
          (note) => note.checkVisibility() && note.textContent.toLowerCase().includes(label.toLowerCase()),
        );
        return read(el.querySelector('.row-head .status')) || read(el.closest('.group')?.querySelector('.shared .status')) || saidByNote;
      }, expected);
      if (!shown) problems.push(`${entry.name}: status "${expected}" not visible on the row or above its group`);
    }
    for (const quote of quotes) {
      const words = quote.runs.map((r) => r.text).join('').slice(0, 30);
      if (!(await view.locator('.alert', { hasText: words }).first().isVisible())) problems.push(`${title}: warning "${words}" hidden`);
    }

    // Chips show without opening the row. A warning shows on a row that doesn't open,
    // and first thing in the drop-down of one that does.
    for (const entry of entries) {
      const fields = Object.fromEntries(entry.fields.map((f) => [f.key, f.value]));
      const card = view.locator(`[data-entry-id="${entry.id}"]`);
      if (fields.warning) {
        const opens = await card.evaluate((el) => el.matches('details'));
        if (opens) {
          await card.evaluate((el) => (el.open = true));
          const first = card.locator('.row-body > :first-child');
          if (!(await first.isVisible()) || (await first.textContent()) !== fields.warning) problems.push(`${entry.name}: warning is not first in the drop-down`);
          await card.evaluate((el) => (el.open = false));
        } else if (!(await card.locator('.row-head .row-warning', { hasText: fields.warning }).isVisible())) {
          problems.push(`${entry.name}: warning "${fields.warning}" hidden`);
        }
      }
      if (fields.jummah) {
        const line = card.locator('.row-head .jummah', { hasText: fields.jummah === 'yes' ? /^Jummah held here$/ : /^No Jummah$/ });
        if (!(await line.isVisible())) problems.push(`${entry.name}: Jummah line hidden`);
      }
      if (fields.prayers) {
        const shown = await card.locator('.row-head .prayer').allTextContents();
        if (shown.join(' · ') !== fields.prayers) problems.push(`${entry.name}: prayers show "${shown.join(' · ')}", not "${fields.prayers}"`);
      }
    }
  }
  expect(problems).toEqual([]);
});

test('Halal Food cards show only their names, and a link-only group opens its link', async ({ page }) => {
  const { screens } = load();
  const groups = screens.filter((s) => s.parent);
  const parent = screens.find((s) => s.id === groups[0].parent);
  expect(groups.length, 'the food screen has group pages').toBeGreaterThan(1);

  await page.goto(`/#/${parent.id}`);
  const view = screenView(page, parent.id);
  for (const group of groups) {
    await expect(view.locator(`a.group-link[href="#/${group.id}"]`)).toHaveText(group.title);
  }
  await expect(view.locator('.status, .alert, .chip')).toHaveCount(0);

  expect(parent.direct.length, 'the IUHK list is a direct link').toBeGreaterThan(0);
  for (const entry of parent.direct) {
    const href = entry.fields.find((f) => f.key === 'link').value;
    const card = view.locator(`a.group-link[data-entry-id="${entry.id}"]`);
    await expect(card).toHaveAttribute('href', href);
    await expect(card).toHaveAttribute('rel', 'noopener');
    await expect(card.locator('h3')).toHaveText(entry.name);
  }
});

test('Halal Food drills down like Prayer Facilities: group page, open a row, Back up each level', async ({ page }) => {
  const { screens } = load();
  const group = screens.find((s) => s.parent && s.entries.some((e) => e.fields.some((f) => f.key === 'link')));
  const parent = screens.find((s) => s.id === group.parent);
  const entry = group.entries.find((e) => e.fields.some((f) => f.key === 'link'));
  const link = entry.fields.find((f) => f.key === 'link').value;
  await openHome(page);

  await page.locator('.menu-link', { hasText: parent.title }).click();
  await expect(page).toHaveURL(new RegExp(`#/${parent.id}$`));
  await expect(screenView(page, parent.id).locator('.row')).toHaveCount(0);

  await screenView(page, parent.id).locator(`a.group-link[href="#/${group.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#/${group.id}$`));
  await expect(page.locator('#screen-title')).toHaveText(group.title);
  const view = screenView(page, group.id);
  await expect(view).toBeVisible();
  await expect(screenView(page, parent.id)).toBeHidden();

  const row = view.locator(`details.row[data-entry-id="${entry.id}"]`);
  await row.locator('summary').click();
  await expect(row).toHaveAttribute('open', '');
  await expect(page).toHaveURL(new RegExp(`#/${group.id}/${entry.id}$`));
  await expect(row.locator(`a[href="${link}"]`)).toBeVisible();

  await page.goBack();
  await expect(row).not.toHaveAttribute('open');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/${parent.id}$`));
  await expect(page.locator('#screen-title')).toHaveText(parent.title);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.menu')).toBeVisible();

  // Opened straight from an address, Back still goes one level up, not home.
  await page.goto('about:blank');
  await page.goto(`/#/${group.id}/${entry.id}`);
  await expect(row).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText(parent.title);

  // An old address to the row on the section screen lands on its group page.
  await page.goto('about:blank');
  await page.goto(`/#/${parent.id}/${entry.id}`);
  await expect(page).toHaveURL(new RegExp(`#/${group.id}/${entry.id}$`));
  await expect(row).toHaveAttribute('open', '');
});

test('prayer times, access limits and shared facts show without tapping', async ({ page }) => {
  await page.goto('/#/prayer-facilities');
  const view = screenView(page, 'prayer-facilities');
  const z302a = view.locator('[data-entry-id="z302a"] .row-head');
  await expect(z302a.locator('.prayer')).toHaveText(['Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  await expect(z302a.locator('.jummah-yes')).toHaveText('Jummah held here');
  await expect(view.locator('[data-entry-id="pq502a"] .row-head .jummah-no')).toHaveText('No Jummah');
  await expect(view.locator('.shared .chip', { hasText: 'Residents only' })).toBeVisible();
  await expect(view.locator('.shared .chip', { hasText: 'Student card entry' })).toBeVisible();
});

test('map links carry a pin icon drawn in the page', async ({ page }) => {
  await page.goto('/#/halal-groceries');
  const mapLink = screenView(page, 'halal-groceries').locator('a[href*="maps.app.goo.gl"]').first();
  await expect(mapLink.locator('svg.link-icon')).toHaveCount(1);
  const pinned = await page.$$eval('.entry-link', (links) => links.filter((a) => a.querySelector('svg.link-icon')).map((a) => a.getAttribute('href')));
  expect(pinned.filter((href) => !/^https:\/\/(maps\.app\.goo\.gl|(www\.)?google\.com\/maps)\//.test(href)), 'only map links carry the pin').toEqual([]);
  const external = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).host).filter((h) => h !== location.host));
  expect(external, 'the page must not load anything from a third party').toEqual([]);
});

test('WhatsApp group links carry the WhatsApp glyph, and only they do', async ({ page }) => {
  const { links } = load();
  const groups = [...links].filter((href) => href.startsWith('https://chat.whatsapp.com/'));
  expect(groups.length).toBeGreaterThan(0);
  await openHome(page);
  const marked = await page.$$eval('.entry-link', (as) => as.filter((a) => a.querySelector('img.link-icon[src="icons/whatsapp.svg"]')).map((a) => a.getAttribute('href')));
  expect(marked.sort()).toEqual(groups.sort());
  const response = await page.request.get('/icons/whatsapp.svg');
  expect(response.ok()).toBe(true);
  expect(await response.text()).not.toMatch(/<script|href=/i);
});

test('halal status dots and labels line up in one column in every group', async ({ page }) => {
  const { screens } = load();
  const problems = [];
  for (const { id, title } of screens) {
    await page.goto('about:blank');
    await page.goto(`/#/${id}`);
    await expect(screenView(page, id)).toBeVisible();
    const groups = await screenView(page, id).locator('.group').evaluateAll((all) =>
      all.map((group) => [...group.querySelectorAll('.row-title > .status')].filter((l) => l.checkVisibility()).map((l) => Math.round(l.getBoundingClientRect().left))),
    );
    for (const lefts of groups) {
      if (new Set(lefts).size > 1) problems.push(`${title}: status labels start at ${[...new Set(lefts)].join(', ')}px`);
    }
  }
  expect(problems).toEqual([]);
});

test('washroom types line up in the same column on every floor, and fit on a phone', async ({ page }) => {
  await page.goto('/#/muslim-friendly-washrooms');
  const columns = await page.locator('[data-screen="muslim-friendly-washrooms"] .washroom').evaluateAll((items) => {
    const lefts = {};
    const overflow = [];
    for (const item of items) {
      const type = [...item.classList].find((c) => c.startsWith('washroom-')).slice('washroom-'.length);
      (lefts[type] ??= new Set()).add(Math.round(item.getBoundingClientRect().left));
      const card = item.closest('.row').getBoundingClientRect();
      if (item.getBoundingClientRect().right > card.right) overflow.push(item.textContent);
    }
    return { lefts: Object.fromEntries(Object.entries(lefts).map(([k, v]) => [k, v.size])), overflow };
  });
  expect(columns.lefts).toEqual({ male: 1, female: 1, accessible: 1 });
  expect(columns.overflow).toEqual([]);
});

test('a row name lines up with its arrow, and the background stays put while scrolling', async ({ page }) => {
  const { screens } = load();
  const kitchens = screens.find((s) => s.entries.some((e) => e.fields.some((f) => f.key === 'link')) && s.parent);
  await page.goto(`/#/${kitchens.id}`);
  const offsets = await screenView(page, kitchens.id).locator('details.row > .row-head').evaluateAll((heads) =>
    heads
      .filter((head) => head.children.length === 1)
      .map((head) => {
        const box = head.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(head.querySelector('h3'));
        const text = range.getBoundingClientRect();
        return Math.abs(text.top + text.height / 2 - (box.top + box.height / 2));
      }),
  );
  for (const offset of offsets) expect(offset, 'name text is centred on the row, like the arrow').toBeLessThanOrEqual(1.5);

  const before = await page.evaluate(() => getComputedStyle(document.body, '::before').position);
  expect(before).toBe('fixed');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('none');
});

test('pressing a card keeps its rounded corners, and buttons match the card shape', async ({ page }) => {
  await page.goto('/#/prayer-facilities/pq502a');
  const view = screenView(page, 'prayer-facilities');
  await expect(view.locator('details.row[open]').first()).toBeVisible();

  const shapes = await page.evaluate(() => {
    const radius = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius);
    const openRow = document.querySelector('[data-screen="prayer-facilities"] details.row[open]');
    const closedRow = document.querySelector('details.row:not([open])');
    const link = document.querySelector('[data-screen="prayer-facilities"] .entry-link');
    return {
      tapFlash: getComputedStyle(document.documentElement).webkitTapHighlightColor,
      row: radius(openRow),
      rowHead: radius(openRow.querySelector('.row-head')),
      rowHeadBottom: parseFloat(getComputedStyle(openRow.querySelector('.row-head')).borderBottomLeftRadius),
      closedHeadBottom: parseFloat(getComputedStyle(closedRow.querySelector('.row-head')).borderBottomLeftRadius),
      link: radius(link),
      menu: radius(document.querySelector('.menu-link')),
    };
  });

  expect(shapes.tapFlash, 'the browser tap flash is a rectangle, so it is switched off').toBe('rgba(0, 0, 0, 0)');
  expect(shapes.rowHead, 'the tap area carries the card corner').toBeGreaterThan(0);
  expect(shapes.rowHead).toBeLessThanOrEqual(shapes.row);
  expect(shapes.rowHeadBottom, 'an open row keeps square corners where it meets its details').toBe(0);
  expect(shapes.closedHeadBottom, 'a closed row is rounded on all four corners').toBeGreaterThan(0);
  expect(shapes.link, 'buttons are rounded rectangles, not pills').toBeLessThan(20);
  expect(shapes.menu).toBe(shapes.row);
});

test('tapping a row opens it, and Back closes it, then returns home', async ({ page }) => {
  const { screens } = load();
  const { id: screenId, title } = screens[0];
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

  for (const { id, title } of screens) {
    await page.goto('about:blank');
    await page.goto(`/#/${id}`);
    await screenView(page, id).locator('details').evaluateAll((all) => all.forEach((d) => d.setAttribute('open', '')));
    small.push(...(await measure()).map((box) => ({ ...box, screen: title })));
  }
  expect(small).toEqual([]);
});

test('a photo waits in the drop-down, not on the closed row, and loads from this site', async ({ page }) => {
  const { doc, screens } = load();
  let target = screens.flatMap(({ id, entries }) => entries.map((entry) => ({ screenId: id, entry }))).find(({ entry }) => entry.fields.some((f) => f.key === 'photo'));
  if (!target) {
    // No entry has a photo yet: serve a copy of content.json giving one row the
    // background photo, so the layout stays tested.
    target = screens.flatMap(({ id, entries }) => entries.map((entry) => ({ screenId: id, entry })))[0];
    for (const block of walk(doc)) if (block.id === target.entry.id) block.fields.push({ key: 'photo', value: '../background.jpg' });
    await page.route('**/content.json', (route) => route.fulfill({ json: doc }));
  }
  await page.goto(`/#/${target.screenId}`);
  const row = screenView(page, target.screenId).locator(`details[data-entry-id="${target.entry.id}"]`);
  await expect(row.locator('img')).toBeHidden();
  await row.locator('summary').click();
  const photo = row.locator('.row-body img.row-photo-large');
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute('alt', `Photo of ${target.entry.name}`);
  await expect.poll(() => photo.evaluate((img) => img.complete && img.naturalWidth > 0), { message: 'the photo file loads' }).toBe(true);
});

test('an app card shows its logo beside its name', async ({ page }) => {
  const { doc, screens } = load();
  const cards = screens.flatMap(({ id, entries }) => entries.map((entry) => ({ screenId: id, entry }))).filter(({ entry }) => entry.fields.every((f) => ['note', 'link', 'link-label', 'photo'].includes(f.key)));
  let target = cards.find(({ entry }) => entry.fields.some((f) => f.key === 'photo'));
  if (!target) {
    // No app card has its logo yet: give one the background photo in a served copy.
    target = cards.find(({ entry }) => entry.fields.some((f) => f.key === 'link'));
    for (const block of walk(doc)) if (block.id === target.entry.id) block.fields.push({ key: 'photo', value: '../background.jpg' });
    await page.route('**/content.json', (route) => route.fulfill({ json: doc }));
  }
  await page.goto(`/#/${target.screenId}`);
  const card = screenView(page, target.screenId).locator(`.info-card[data-entry-id="${target.entry.id}"]`);
  const logo = card.locator('.info-head img.info-logo');
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const [image, name] = await Promise.all([logo.boundingBox(), card.locator('h3').boundingBox()]);
  expect(image.x + image.width).toBeLessThanOrEqual(name.x);
});

test('a labelled link, like Live prayer times, shows on its card without tapping', async ({ page }) => {
  const { screens } = load();
  const labelled = screens.flatMap(({ id, entries }) => entries.filter((e) => e.fields.some((f) => f.key === 'link-label')).map((entry) => ({ id, entry })));
  expect(labelled.map(({ entry }) => entry.id)).toContain('z302a');
  for (const { id, entry } of labelled) {
    await page.goto('about:blank');
    await page.goto(`/#/${id}`);
    const href = entry.fields.find((f) => f.key === 'link').value;
    const card = page.locator(`.row-card:has(> [data-entry-id="${entry.id}"])`);
    await expect(card.locator(`:scope > .row-link a[href="${href}"]`)).toBeVisible();
  }
});

test('opening a row with a photo shows the photo full width', async ({ page }) => {
  const { screens } = load();
  const target = screens
    .flatMap(({ id, entries }) => entries.map((entry) => ({ screenId: id, entry })))
    .find(({ entry }) => entry.fields.some((f) => f.key === 'photo') && entry.fields.some((f) => f.key === 'link'));
  test.skip(!target, 'no row has both a photo and something to open');
  await page.goto(`/#/${target.screenId}/${target.entry.id}`);
  const large = screenView(page, target.screenId).locator(`[data-entry-id="${target.entry.id}"] .row-body img.row-photo-large`);
  await expect(large).toBeVisible();
  await expect.poll(() => large.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const [body, img] = await Promise.all([large.locator('..').boundingBox(), large.boundingBox()]);
  expect(img.width).toBeGreaterThan(body.width * 0.8);
});

test.describe('copy address', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copies the exact address from content.json', async ({ page }) => {
    const { doc, screens } = load();
    const withAddress = screens
      .flatMap(({ id, entries }) => entries.map((entry) => ({ screenId: id, entry })))
      .filter(({ entry }) => entry.fields.some((f) => f.key === 'address'));
    let withCopy = withAddress.find(({ entry }) => !entry.fields.some((f) => f.key === 'link'));
    if (!withCopy && withAddress.length) {
      // Every address has a map link today, so the button would never show. Serve a copy
      // of content.json with one link removed, so the button stays tested.
      withCopy = withAddress[0];
      const id = withCopy.entry.id;
      for (const block of walk(doc)) {
        if (block.id === id && block.fields) block.fields = block.fields.filter((f) => f.key !== 'link' && f.key !== 'link-label');
      }
      await page.route('**/content.json', (route) => route.fulfill({ json: doc }));
    }
    if (!withCopy) {
      // No entry has an address at all: give a row without a link one, in a served copy.
      withCopy = screens.flatMap(({ id, entries }) => entries.map((entry) => ({ screenId: id, entry }))).find(({ entry }) => !entry.fields.some((f) => ['link', 'note'].includes(f.key)));
      withCopy.entry = { ...withCopy.entry, fields: [...withCopy.entry.fields, { key: 'address', value: 'Shop 1–2, G/F, 1 Test Street, Hung Hom' }] };
      for (const block of walk(doc)) if (block.id === withCopy.entry.id) block.fields = withCopy.entry.fields;
      await page.route('**/content.json', (route) => route.fulfill({ json: doc }));
    }

    const address = withCopy.entry.fields.find((f) => f.key === 'address').value;
    await page.goto(`/#/${withCopy.screenId}/${withCopy.entry.id}`);
    const button = screenView(page, withCopy.screenId).locator(`[data-entry-id="${withCopy.entry.id}"] .copy-button`);
    await button.click();
    await expect(button).toHaveText('Address copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  });
});
