// Renders content.json. Every node is built with createElement and textContent:
// never innerHTML (CLAUDE.md rule 5).

import {
  FIELD_LABELS,
  FILTERS,
  SPECIAL_KEYS,
  STATUS_LABELS,
  STATUS_NOT_RECORDED,
  entryContexts,
  fieldMap,
  formatDate,
  linkText,
  normalize,
  searchText,
  statusOf,
} from './guide.js';

const SEARCH_DELAY_MS = 150;

const main = document.getElementById('guide');
const controls = document.getElementById('controls');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search');
const clearButton = document.getElementById('clear-search');
const filterGroup = document.getElementById('filters');
const resultCount = document.getElementById('result-count');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Rendered nodes, kept so filtering only toggles `hidden`.
const view = {
  items: [],
  groups: [],
  chips: [],
  active: new Set(),
  legend: null,
  empty: null,
  emptyTitle: null,
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
    main.replaceChildren(h('p', { class: 'load-error' }, 'The guide could not be loaded. Check your connection and refresh the page.'));
    throw error;
  }
  renderHeader(doc.meta);
  renderGuide(doc);
  renderFilters();
  wireSearch();
  update({ scroll: false });
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

function renderHeader(meta) {
  document.title = meta.title;
  setText('site-title', meta.title);
  setText('site-org', meta.org);
  setText('site-subtitle', meta.subtitle);

  const footer = document.getElementById('site-footer');
  const details = [];
  if (meta.version) details.push(`Version ${meta.version}`);
  if (meta.updated) details.push(h('span', {}, 'Updated ', h('time', { datetime: meta.updated }, formatDate(meta.updated))));
  footer.replaceChildren(
    meta.org ? h('p', { class: 'footer-org' }, meta.org) : null,
    details.length ? h('p', { class: 'footer-details' }, ...details.flatMap((d, i) => (i ? [' · ', d] : [d]))) : null,
  );
}

function setText(id, text) {
  const node = document.getElementById(id);
  node.textContent = text ?? '';
  node.hidden = !text;
}

// ——— Rendering ———

function renderGuide(doc) {
  const contexts = entryContexts(doc);
  const legendBefore = contexts.find((c) => statusOf(c.entry))?.section;
  const showNotRecorded = contexts.some((c) => c.entry.statusMissing);
  const items = new Map(
    contexts.map((c) => [
      c.entry,
      {
        ...c,
        node: null,
        text: searchText(c),
        filters: new Set(FILTERS.filter((filter) => filter.test(c)).map((filter) => filter.id)),
        hasStatus: Boolean(statusOf(c.entry)),
      },
    ]),
  );
  const fragment = document.createDocumentFragment();

  for (const section of doc.sections) {
    if (!section.published) continue;
    if (section === legendBefore) {
      view.legend = renderLegend(showNotRecorded);
      fragment.append(view.legend);
    }
    fragment.append(renderSection(section, items));
  }

  view.items = [...items.values()];
  view.empty = renderEmptyState();
  fragment.append(view.empty);
  main.replaceChildren(fragment);
}

function renderSection(section, items) {
  const id = `section-${section.id}`;
  const node = h(
    'section',
    { class: 'section', id, 'data-section-id': section.id, 'aria-labelledby': `${id}-title` },
    h('h2', { class: 'section-title', id: `${id}-title` }, section.heading),
    ...section.blocks.map((block) => renderBlock(block, items)),
  );
  view.groups.push({ node, items: [...items.values()].filter((item) => item.section === section) });

  for (const sub of section.subsections) {
    const subId = `section-${sub.id}`;
    const subNode = h(
      'section',
      { class: 'subsection', id: subId, 'data-section-id': sub.id, 'aria-labelledby': `${subId}-title` },
      h('h2', { class: 'subsection-title', id: `${subId}-title` }, sub.heading),
      ...sub.blocks.map((block) => renderBlock(block, items)),
    );
    view.groups.push({ node: subNode, items: [...items.values()].filter((item) => item.subsection === sub) });
    node.append(subNode);
  }
  return node;
}

function renderBlock(block, items) {
  if (block.type === 'entry') {
    const node = renderEntry(block);
    items.get(block).node = node;
    return node;
  }
  if (block.kind === 'paragraph') return h('p', { class: 'prose' }, ...renderRuns(block.runs));
  if (block.kind === 'blockquote') return h('blockquote', { class: 'callout' }, h('p', {}, ...renderRuns(block.runs)));
  throw new Error(`Cannot render a "${block.kind}" block (content.md line ${block.line})`);
}

function renderRuns(runs) {
  return runs.map((run) => {
    if (run.strong) return h('strong', {}, run.text);
    if (run.code) return h('code', {}, run.text);
    return run.text;
  });
}

function renderEntry(entry) {
  const fields = fieldMap(entry);
  const id = `entry-${entry.id}`;
  const article = h('article', { class: 'entry', id, 'data-entry-id': entry.id, 'aria-labelledby': `${id}-name` });
  article.append(h('h3', { class: 'entry-name', id: `${id}-name` }, entry.name));
  if (fields.tag) article.append(h('p', { class: 'entry-tag' }, fields.tag));

  const status = statusOf(entry);
  if (status) article.append(renderStatus(status));

  const rows = entry.fields.filter((f) => !SPECIAL_KEYS.includes(f.key));
  if (rows.length) {
    const list = h('dl', { class: 'facts' });
    for (const { key, value } of rows) {
      const label = FIELD_LABELS[key];
      if (!label) throw new Error(`No label for key "${key}" on "${entry.name}" (content.md line ${entry.line})`);
      const detail = h('dd', {}, key === 'jummah' ? (value === 'yes' ? 'Yes' : 'No') : value);
      if (key === 'jummah' && fields['jummah-note']) detail.append(h('span', { class: 'jummah-note' }, fields['jummah-note']));
      list.append(h('div', { class: 'fact' }, h('dt', {}, label), detail));
    }
    article.append(list);
  }

  if (fields.link) {
    const { text, host } = linkText(fields.link, fields['link-label']);
    article.append(
      h(
        'a',
        { class: 'entry-link', href: fields.link, rel: 'noopener', target: '_blank' },
        h('span', { class: 'link-text' }, text),
        h('span', { class: 'link-host' }, host),
        h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'),
      ),
    );
  }
  return article;
}

function renderStatus(status) {
  return h(
    'p',
    { class: `status status-${status.key}` },
    h('span', { class: 'visually-hidden' }, 'Halal status: '),
    status.label,
  );
}

function renderLegend(showNotRecorded) {
  const list = h('dl', { class: 'legend-list' });
  const items = Object.entries(STATUS_LABELS).map(([key, value]) => ({ key, ...value }));
  if (showNotRecorded) items.push({ key: 'none', ...STATUS_NOT_RECORDED });
  for (const item of items) {
    list.append(
      h('div', { class: 'legend-item' }, h('dt', {}, h('span', { class: `status status-${item.key}` }, item.label)), h('dd', {}, item.meaning)),
    );
  }
  return h(
    'aside',
    { class: 'legend', 'aria-labelledby': 'legend-title' },
    h('h2', { class: 'legend-title', id: 'legend-title' }, 'What the halal labels mean'),
    list,
  );
}

function renderEmptyState() {
  view.emptyTitle = h('p', { class: 'empty-title' });
  const reset = h('button', { class: 'button', type: 'button' }, 'Clear search and filters');
  reset.addEventListener('click', resetAll);
  return h(
    'div',
    { class: 'empty-state', id: 'empty-state', hidden: true },
    view.emptyTitle,
    h('p', {}, 'Check the spelling, try a shorter word, or turn off a filter.'),
    reset,
  );
}

function renderFilters() {
  for (const filter of [{ id: 'all', label: 'All' }, ...FILTERS]) {
    const chip = h('button', { class: 'chip', type: 'button', 'data-filter': filter.id, 'aria-pressed': 'false' }, filter.label);
    chip.addEventListener('click', () => toggleFilter(filter.id));
    view.chips.push(chip);
  }
  filterGroup.replaceChildren(...view.chips);
}

// ——— Search and filters ———

function wireSearch() {
  searchInput.addEventListener('input', () => {
    clearButton.hidden = searchInput.value === '';
    clearTimeout(view.timer);
    view.timer = setTimeout(update, SEARCH_DELAY_MS);
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && searchInput.value) {
      event.preventDefault();
      clearSearch();
    }
  });
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(view.timer);
    update();
    searchInput.blur();
  });
  clearButton.addEventListener('click', clearSearch);
}

// "All" clears every other chip. Other chips toggle and combine with AND.
function toggleFilter(id) {
  if (id === 'all') view.active.clear();
  else if (view.active.has(id)) view.active.delete(id);
  else view.active.add(id);
  update();
}

function clearSearch() {
  searchInput.value = '';
  clearButton.hidden = true;
  clearTimeout(view.timer);
  update();
  searchInput.focus();
}

function resetAll() {
  view.active.clear();
  clearSearch();
}

function update({ scroll = true } = {}) {
  const query = normalize(searchInput.value);
  const active = [...view.active];
  const filtering = query !== '' || active.length > 0;
  let shown = 0;

  for (const item of view.items) {
    const visible = (!query || item.text.includes(query)) && active.every((id) => item.filters.has(id));
    item.node.hidden = !visible;
    if (visible) shown += 1;
  }
  for (const group of view.groups) {
    group.node.hidden = filtering && !group.items.some((item) => !item.node.hidden);
  }
  if (view.legend) {
    view.legend.hidden = filtering && !view.items.some((item) => item.hasStatus && !item.node.hidden);
  }
  for (const chip of view.chips) {
    const id = chip.dataset.filter;
    chip.setAttribute('aria-pressed', String(id === 'all' ? active.length === 0 : view.active.has(id)));
  }

  const total = view.items.length;
  if (!filtering) resultCount.textContent = `Showing all ${total} listings`;
  else if (shown === 0) resultCount.textContent = 'No listings match';
  else resultCount.textContent = `Showing ${shown} of ${total} listings`;

  const typed = searchInput.value.trim();
  if (!typed) view.emptyTitle.textContent = 'Nothing matches these filters together.';
  else if (active.length) view.emptyTitle.textContent = `Nothing matches “${typed}” with these filters.`;
  else view.emptyTitle.textContent = `Nothing matches “${typed}”.`;
  view.empty.hidden = shown > 0;

  if (scroll) scrollToResults();
}

// If the reader has scrolled past the top of the results, bring them back so a
// new search doesn't leave them looking at empty space.
function scrollToResults() {
  const top = main.getBoundingClientRect().top + window.scrollY - controls.offsetHeight;
  if (window.scrollY > top) window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}
