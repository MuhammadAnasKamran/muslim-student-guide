// Renders content.json as an app: a home menu, one screen per content.md
// section, and rows that open on tap. Every node is built with createElement
// and textContent, never innerHTML (CLAUDE.md rule 5).

import {
  STATUS_LABELS,
  entryContexts,
  foldsGroups,
  formatDate,
  groupSummary,
  isInfoCard,
  menuItems,
  normalize,
  parseRoute,
  routeFor,
  rowParts,
  searchText,
  sharedFacts,
  splitTags,
  statusOf,
} from './guide.js';

const SEARCH_DELAY_MS = 150;
const COPY_MESSAGE_MS = 2500;

const app = document.getElementById('app');
const title = document.getElementById('screen-title');
const backButton = document.getElementById('back');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const view = {
  meta: null,
  home: null,
  screens: new Map(), // screen id -> { section, node, rows: Map(entry id -> <details>) }
  contexts: [],
  current: { screen: undefined, entry: null },
  entryPushed: false, // true when opening a row added a history step
  cameFromHome: false, // true when the open screen was reached from the home menu
  homeScroll: 0,
  timer: 0,
};

start();

async function start() {
  let doc;
  try {
    const response = await fetch('content.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`content.json returned HTTP ${response.status}`);
    doc = await response.json();
  } catch (error) {
    app.replaceChildren(h('p', { class: 'load-error' }, 'The guide could not be loaded. Check your connection and refresh the page.'));
    throw error;
  }

  view.meta = doc.meta;
  view.contexts = entryContexts(doc).map((context) => ({ ...context, text: searchText(context) }));
  renderFooter(doc.meta);

  const fragment = document.createDocumentFragment();
  fragment.append(renderHome(doc));
  for (const section of doc.sections) {
    if (section.published) fragment.append(renderScreen(section));
  }
  app.replaceChildren(fragment);

  // A shadow under the bar once the screen scrolls, so it reads as fixed.
  const appbar = document.querySelector('.appbar');
  const onScroll = () => appbar.classList.toggle('appbar-raised', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  history.scrollRestoration = 'manual';
  backButton.addEventListener('click', goBack);
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  route();
}

// h('p', { class: 'x' }, 'text', childNode) — strings become text nodes, never markup.
function h(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null && value !== false) node.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

function renderFooter(meta) {
  const details = [];
  if (meta.version) details.push(`Version ${meta.version}`);
  if (meta.updated) details.push(h('span', {}, 'Updated ', h('time', { datetime: meta.updated }, formatDate(meta.updated))));
  document.getElementById('site-footer').replaceChildren(
    meta.org ? h('p', {}, meta.org) : '',
    details.length ? h('p', {}, ...details.flatMap((d, i) => (i ? [' · ', d] : [d]))) : '',
  );
}

// ——— Home: search and the menu ———

function renderHome(doc) {
  const input = h('input', {
    class: 'search-input',
    id: 'search',
    type: 'search',
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    enterkeyhint: 'search',
    placeholder: 'Room, food, shop or area',
    'aria-describedby': 'result-count',
  });
  const clear = h('button', { class: 'clear-button', type: 'button', hidden: true }, 'Clear', h('span', { class: 'visually-hidden' }, ' search'));
  const count = h('p', { class: 'result-count', id: 'result-count', 'aria-live': 'polite' });
  const form = h(
    'form',
    { class: 'search', role: 'search' },
    h('label', { class: 'search-label', for: 'search' }, 'Search the guide'),
    h('div', { class: 'search-row' }, input, clear),
    count,
  );

  const menu = h('nav', { class: 'menu', 'aria-label': 'Guide sections' });
  for (const item of menuItems(doc)) {
    menu.append(
      h(
        'a',
        { class: 'menu-link', href: routeFor(item.id) },
        menuIcon(item.title),
        h('span', { class: 'menu-title' }, item.title),
        item.detail ? h('span', { class: 'menu-detail' }, item.detail) : null,
      ),
    );
  }

  const results = h('div', { class: 'results', hidden: true });
  const emptyTitle = h('p', { class: 'empty-title' });
  const reset = h('button', { class: 'button', type: 'button' }, 'Clear search');
  const empty = h('div', { class: 'empty-state', hidden: true }, emptyTitle, h('p', {}, 'Check the spelling or try a shorter word.'), reset);

  const node = h(
    'div',
    { class: 'view', 'data-screen': 'home', hidden: true },
    doc.meta.subtitle ? h('p', { class: 'home-subtitle' }, doc.meta.subtitle) : null,
    form,
    menu,
    results,
    empty,
  );
  view.home = { node, input, clear, count, menu, results, empty, emptyTitle };

  input.addEventListener('input', () => {
    clear.hidden = input.value === '';
    clearTimeout(view.timer);
    view.timer = setTimeout(runSearch, SEARCH_DELAY_MS);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value) {
      event.preventDefault();
      clearSearch();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(view.timer);
    runSearch();
    input.blur();
  });
  clear.addEventListener('click', clearSearch);
  reset.addEventListener('click', clearSearch);
  return node;
}

function runSearch() {
  const { input, count, menu, results, empty, emptyTitle } = view.home;
  const query = normalize(input.value);
  if (!query) {
    menu.hidden = false;
    results.hidden = true;
    results.replaceChildren();
    empty.hidden = true;
    count.textContent = '';
    return;
  }

  const groups = new Map();
  for (const context of view.contexts) {
    if (!context.text.includes(query)) continue;
    if (!groups.has(context.section)) groups.set(context.section, []);
    groups.get(context.section).push(context);
  }
  const total = [...groups.values()].reduce((n, list) => n + list.length, 0);

  results.replaceChildren(
    ...[...groups].map(([section, list]) =>
      h(
        'section',
        { class: 'group' },
        h('h2', { class: 'group-title' }, section.title),
        ...list.map(({ entry, subsection }) => renderEntry(entry, { context: subsection?.title })),
      ),
    ),
  );
  menu.hidden = true;
  results.hidden = total === 0;
  empty.hidden = total > 0;
  count.textContent = total === 0 ? 'No results' : `${total} ${total === 1 ? 'result' : 'results'}`;
  emptyTitle.textContent = `Nothing matches “${input.value.trim()}”.`;
}

function clearSearch() {
  const { input, clear } = view.home;
  input.value = '';
  clear.hidden = true;
  clearTimeout(view.timer);
  runSearch();
  input.focus();
}

// ——— Screens ———

function renderScreen(section) {
  const node = h('div', { class: 'view', 'data-screen': section.id, hidden: true });
  const rows = new Map();
  const legend = renderLegend(section);
  if (legend) node.append(legend);
  if (section.blocks.length) node.append(renderGroup(section, null, rows));
  for (const subsection of section.subsections) node.append(renderGroup(section, subsection, rows));
  view.screens.set(section.id, { section, node, rows });
  return node;
}

function renderGroup(section, subsection, rows) {
  const blocks = (subsection ?? section).blocks;
  const shared = sharedFacts(blocks.filter((b) => b.type === 'entry'));
  const group = h('section', { class: 'group' });
  let body = group;
  const folded = Boolean(subsection) && foldsGroups(section);
  if (subsection) {
    const id = `group-${subsection.id}`;
    group.setAttribute('aria-labelledby', id);
    const title = h('h2', { class: 'group-title', id }, subsection.title);
    if (folded) {
      body = h('div', { class: 'group-body' });
      group.append(h('details', { class: 'group-fold' }, renderFoldSummary(title, blocks), body));
    } else {
      group.append(title);
    }
  }

  let sharedShown = false;
  for (const block of blocks) {
    if (block.type === 'prose') {
      // A closed block already shows its warnings in the header.
      if (!(folded && block.kind === 'blockquote')) body.append(renderProse(block));
      continue;
    }
    if (!isInfoCard(block) && shared.length && !sharedShown) {
      body.append(renderShared(shared));
      sharedShown = true;
    }
    const node = renderEntry(block, { shared, routable: true });
    if (node.tagName === 'DETAILS') {
      rows.set(block.id, node);
      wireRow(node, section.id, block.id);
    }
    body.append(node);
  }
  return group;
}

// A closed block's header: the title, how many listings, each halal status with a
// count, and any warning. Nothing a student needs to decide is hidden inside.
function renderFoldSummary(title, blocks) {
  const { total, statuses } = groupSummary(blocks.filter((b) => b.type === 'entry'));
  const summary = h(
    'summary',
    { class: 'group-summary' },
    title,
    h('span', { class: 'group-count' }, `${total} ${total === 1 ? 'listing' : 'listings'}`),
  );
  if (statuses.length) summary.append(h('span', { class: 'group-statuses' }, ...statuses.map((status) => renderStatus(status, status.count))));
  for (const block of blocks) {
    if (block.type === 'prose' && block.kind === 'blockquote') {
      summary.append(h('span', { class: 'alert group-alert' }, ...renderRuns(block.runs)));
    }
  }
  return summary;
}

function renderProse(block) {
  if (block.kind === 'paragraph') return h('p', { class: 'intro' }, ...renderRuns(block.runs));
  if (block.kind === 'blockquote') return h('p', { class: 'alert' }, ...renderRuns(block.runs));
  throw new Error(`Cannot render a "${block.kind}" block (content.md line ${block.line})`);
}

function renderRuns(runs) {
  return runs.map((run) => {
    if (run.strong) return h('strong', {}, run.text);
    if (run.code) return h('code', {}, run.text);
    return run.text;
  });
}

// A row in a screen (routable, with shared facts hidden) or in search results
// (self-contained, labelled with its heading).
function renderEntry(entry, { shared = [], routable = false, context = null } = {}) {
  const id = routable ? `entry-${entry.id}` : null;
  if (isInfoCard(entry)) return renderInfoCard(entry, id, context);

  const parts = rowParts(entry, shared);
  // Status first, then the name, then tags: the name stays easy to find on rows
  // carrying several chips.
  const head = [
    context ? h('span', { class: 'row-context' }, context) : null,
    parts.status ? h('span', { class: 'row-badges' }, renderStatus(parts.status)) : null,
    h('h3', { class: 'row-name' }, entry.name),
    parts.summary ? h('span', { class: 'row-summary' }, parts.summary) : null,
    parts.chips.length ? h('span', { class: 'row-chips' }, ...parts.chips.map(renderChip)) : null,
    ...parts.warnings.map((text) => h('span', { class: 'row-warning' }, text)),
  ];

  if (!parts.expandable) {
    return h('div', { class: 'row row-flat', id, 'data-entry-id': entry.id }, h('div', { class: 'row-head' }, ...head));
  }

  const body = h('div', { class: 'row-body' });
  if (parts.facts.length) {
    body.append(h('dl', { class: 'facts' }, ...parts.facts.map((f) => h('div', { class: 'fact' }, h('dt', {}, f.label), h('dd', {}, f.value)))));
  }
  if (parts.link) body.append(renderLink(parts.link));
  if (parts.copyAddress) body.append(renderCopyButton(parts.copyAddress));
  return h('details', { class: 'row', id, 'data-entry-id': entry.id }, h('summary', { class: 'row-head' }, ...head), body);
}

function renderInfoCard(entry, id, context) {
  const { link } = rowParts(entry);
  const note = entry.fields.find((f) => f.key === 'note')?.value;
  return h(
    'div',
    { class: 'info-card', id, 'data-entry-id': entry.id },
    context ? h('span', { class: 'row-context' }, context) : null,
    h('h3', { class: 'info-title' }, entry.name),
    note ? h('p', { class: 'info-note' }, note) : null,
    link ? renderLink(link) : null,
  );
}

// Facts every row in this group shares, shown once above them as chips. A status
// they all share keeps its badge, so the halal word is still on screen.
function renderShared(shared) {
  const node = h('p', { class: 'shared' }, h('span', { class: 'visually-hidden' }, 'All of these: '));
  for (const { key, value } of shared) {
    if (key === 'status') node.append(renderStatus({ key: value, ...STATUS_LABELS[value] }));
    else for (const text of splitTags(value)) node.append(renderChip({ text, muted: false }));
  }
  return node;
}

function renderStatus(status, count) {
  return h(
    'span',
    { class: `status status-${status.key}` },
    h('span', { class: 'visually-hidden' }, 'Halal status: '),
    status.label,
    count ? h('span', { class: 'status-count' }, h('span', { class: 'visually-hidden' }, ', '), String(count)) : null,
  );
}

function renderChip(chip) {
  return h('span', { class: chip.muted ? 'chip chip-muted' : 'chip' }, chip.text);
}

function renderLink({ href, text, host }) {
  const isMap = host === 'maps.app.goo.gl' || host.endsWith('google.com');
  return h(
    'a',
    { class: 'entry-link', href, rel: 'noopener', target: '_blank' },
    isMap ? mapPin() : null,
    h('span', { class: 'link-lines' }, h('span', { class: 'link-text' }, text), h('span', { class: 'link-host' }, host)),
    h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'),
  );
}

// Icons are drawn here rather than loaded from an icon service: no third-party
// requests, and no URL that isn't in content.md (CLAUDE.md rules 1 and 4).
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgIcon(className, paths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function mapPin() {
  const svg = svgIcon('link-icon', ['M12 2.75a6.75 6.75 0 0 0-6.75 6.75c0 4.75 6.75 11.75 6.75 11.75s6.75-7 6.75-11.75A6.75 6.75 0 0 0 12 2.75Z']);
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', '12');
  dot.setAttribute('cy', '9.5');
  dot.setAttribute('r', '2.25');
  dot.setAttribute('fill', 'currentColor');
  dot.setAttribute('stroke', 'none');
  svg.append(dot);
  return svg;
}

// Matched on the heading's own words, so renaming a section keeps its icon.
const MENU_ICONS = [
  [/prayer|salah|jummah/i, ['M4.5 20v-7.5a7.5 7.5 0 0 1 15 0V20', 'M2.5 20h19']],
  [/washroom|wudu|toilet|bidet/i, ['M12 3.25s5.75 6.1 5.75 9.75a5.75 5.75 0 1 1-11.5 0C6.25 9.35 12 3.25 12 3.25Z']],
  [/mosque|masjid|musolla/i, ['M5.5 20v-4.5a6.5 6.5 0 0 1 13 0V20', 'M3 20h18', 'M12 9V6.25', 'M9.5 20v-3.5a2.5 2.5 0 0 1 5 0V20']],
  [/food|eat|canteen|restaurant|meal/i, ['M3.5 12h17a8.5 8.5 0 0 1-17 0Z', 'M2.5 20h19', 'M9 4.5v3', 'M12 3.5v4', 'M15 4.5v3']],
  [/grocer|shop|market|store/i, ['M6.5 8.5h11l1 11h-13Z', 'M9.5 8.5a2.5 2.5 0 0 1 5 0']],
];
const FALLBACK_ICON = ['M5 6.5h14', 'M5 12h14', 'M5 17.5h9'];

function menuIcon(title) {
  const match = MENU_ICONS.find(([pattern]) => pattern.test(title));
  return svgIcon('menu-icon', match ? match[1] : FALLBACK_ICON);
}

function renderCopyButton(address) {
  const button = h('button', { class: 'copy-button', type: 'button' }, 'Copy address');
  let timer = 0;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address);
      button.textContent = 'Address copied';
    } catch {
      button.textContent = 'Copy failed. Press and hold the address to copy it.';
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.textContent = 'Copy address';
    }, COPY_MESSAGE_MS);
  });
  return button;
}

function renderLegend(section) {
  const entries = [...section.blocks, ...section.subsections.flatMap((sub) => sub.blocks)].filter((b) => b.type === 'entry');
  const used = new Map();
  for (const entry of entries) {
    const status = statusOf(entry);
    if (status) used.set(status.key, status);
  }
  if (!used.size) return null;

  const list = h('dl', { class: 'legend-list' });
  for (const key of [...Object.keys(STATUS_LABELS), 'none']) {
    const status = used.get(key);
    if (status) list.append(h('div', { class: 'legend-item' }, h('dt', {}, renderStatus(status)), h('dd', {}, status.meaning)));
  }
  return h('details', { class: 'legend' }, h('summary', {}, 'What the halal labels mean'), list);
}

// ——— Routing: screens, opened rows and the Back button ———

// Opening a row gives it its own address, so the phone's Back button closes it.
function wireRow(row, screenId, entryId) {
  row.addEventListener('toggle', () => {
    const inAddress = view.current.screen === screenId && view.current.entry === entryId;
    if (row.open && !inAddress) {
      const address = routeFor(screenId, entryId);
      if (view.current.entry) {
        history.replaceState(null, '', address);
      } else {
        history.pushState(null, '', address);
        view.entryPushed = true;
      }
      view.current.entry = entryId;
    } else if (!row.open && inAddress) {
      view.current.entry = null;
      if (view.entryPushed) {
        view.entryPushed = false;
        history.back();
      } else {
        history.replaceState(null, '', routeFor(screenId));
      }
    }
  });
}

function route() {
  const parsed = parseRoute(location.hash);
  if (!parsed) return;
  let { screen, entry } = parsed;
  if (screen && !view.screens.has(screen)) {
    history.replaceState(null, '', routeFor(null));
    screen = null;
    entry = null;
  }

  const first = view.current.screen === undefined;
  const changedScreen = first || screen !== view.current.screen;
  if (changedScreen) showScreen(screen, first);

  const target = screen ? view.screens.get(screen) : null;
  if (entry && !target?.rows.has(entry)) {
    history.replaceState(null, '', routeFor(screen));
    entry = null;
  }

  const previous = changedScreen ? null : view.current.entry;
  view.current = { screen, entry };
  if (previous && previous !== entry) target.rows.get(previous).open = false;
  if (!entry) view.entryPushed = false;
  if (entry) {
    const row = target.rows.get(entry);
    const fold = row.closest('details.group-fold');
    if (fold && !fold.open) fold.open = true;
    if (!row.open) {
      row.open = true;
      row.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  }
}

function showScreen(screenId, first) {
  const leaving = view.current.screen;
  if (!first) {
    const old = leaving ? view.screens.get(leaving) : null;
    if (!old) view.homeScroll = window.scrollY;
    view.cameFromHome = !old && Boolean(screenId);
    view.current = { screen: screenId, entry: null };
    if (old) for (const row of old.rows.values()) row.open = false;
    (old?.node ?? view.home.node).hidden = true;
  }

  const next = screenId ? view.screens.get(screenId) : null;
  (next?.node ?? view.home.node).hidden = false;
  backButton.hidden = !next;
  title.textContent = next ? next.section.title : view.meta.title;
  document.title = next ? `${next.section.title} · ${view.meta.title}` : view.meta.title;
  window.scrollTo(0, next ? 0 : view.homeScroll);
  if (!first) title.focus({ preventScroll: true });
}

function goBack() {
  if (view.cameFromHome) {
    history.go(view.entryPushed ? -2 : -1);
  } else {
    history.replaceState(null, '', routeFor(null));
    route();
  }
}
