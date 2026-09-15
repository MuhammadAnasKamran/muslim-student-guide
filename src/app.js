// Renders content.json. Every node is built with createElement and textContent:
// never innerHTML (CLAUDE.md rule 5).

import { FIELD_LABELS, SPECIAL_KEYS, STATUS_LABELS, STATUS_NOT_RECORDED, entryContexts, fieldMap, formatDate, linkText, statusOf } from './guide.js';

const main = document.getElementById('guide');

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

function renderGuide(doc) {
  const contexts = entryContexts(doc);
  const legendBefore = contexts.find((c) => statusOf(c.entry))?.section.id;
  const showNotRecorded = contexts.some((c) => c.entry.statusMissing);
  const fragment = document.createDocumentFragment();

  for (const section of doc.sections) {
    if (!section.published) continue;
    if (section.id === legendBefore) fragment.append(renderLegend(showNotRecorded));
    fragment.append(renderSection(section));
  }
  main.replaceChildren(fragment);
}

function renderSection(section) {
  const node = h(
    'section',
    { class: 'section', id: section.id, 'aria-labelledby': `${section.id}-title` },
    h('h2', { class: 'section-title', id: `${section.id}-title` }, section.heading),
    ...section.blocks.map(renderBlock),
  );
  for (const sub of section.subsections) {
    node.append(
      h(
        'section',
        { class: 'subsection', id: sub.id, 'aria-labelledby': `${sub.id}-title` },
        h('h2', { class: 'subsection-title', id: `${sub.id}-title` }, sub.heading),
        ...sub.blocks.map(renderBlock),
      ),
    );
  }
  return node;
}

function renderBlock(block) {
  if (block.type === 'entry') return renderEntry(block);
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
