// Pure logic shared by the page (app.js) and the tests. No DOM access here.
// How each key appears on screen is described in CLAUDE.md, "How entries render".

// Words for each status. Meanings mirror the table in CLAUDE.md and content.md.
// Each status keeps its own word: never collapse certified-section into certified.
export const STATUS_LABELS = {
  certified: { label: 'Halal certified', meaning: 'Holds halal certification.' },
  'certified-section': { label: 'Certified section only', meaning: 'Only part of the shop or menu is certified.' },
  'check-packaging': { label: 'Check packaging', meaning: 'Some products are certified. Look for the halal logo.' },
  unverified: { label: 'Unverified', meaning: 'Community-known. Not checked by MUSA.' },
};

// Shown on food listings that have no status in content.md (see FOOD_KEYS in
// scripts/schema.mjs). It describes the data, not the place.
export const STATUS_NOT_RECORDED = { label: 'Status not recorded', meaning: 'MUSA has no halal status on record.' };

// The grey line under a row's name, visible without tapping, in this order.
export const SUMMARY_KEYS = ['tag', 'location', 'where', 'walk', 'district', 'what', 'sells', 'price'];

// Highlighted tags, visible without tapping.
// `tags` holds several chips separated by ' · '.
export const CHIP_KEYS = ['jummah', 'prayers', 'tags', 'perk', 'delivery'];

// Rendered in their own way: the status badge and the link button.
// `warning` is a caveat that must be read before acting, like "only these meals
// are halal": it shows on the row in amber and is never folded away.
export const SPECIAL_KEYS = ['status', 'link', 'link-label', 'warning'];

// Everything else is a labelled fact inside the opened row. A key with no home
// in any of these lists fails loudly when rendered.
export const FIELD_LABELS = {
  access: 'Access',
  arrangement: 'Layout',
  wudu: 'Wudu',
  'jummah-note': 'Jummah',
  floors: 'Floors',
  feature: 'Feature',
  address: 'Address',
  menu: 'Menu',
  note: 'Note',
  notes: 'Notes',
};

// An entry made only of these renders as an always-open card (tips, apps, lists).
const INFO_KEYS = ['note', 'link', 'link-label'];

// Chips belong to their own row; a status shared by every row in a group is
// shown once above them instead.
const NEVER_SHARED = new Set(['link', 'link-label', 'jummah', 'jummah-note', 'prayers', 'tags', 'perk', 'delivery', 'warning']);

// A `tags` value is several chips: "South Asian meals · Several options daily".
export function splitTags(value) {
  return value.split(' · ').map((part) => part.trim()).filter(Boolean);
}

export function fieldMap(entry) {
  return Object.fromEntries(entry.fields.map((f) => [f.key, f.value]));
}

export function statusOf(entry) {
  const status = fieldMap(entry).status;
  if (status) {
    if (!STATUS_LABELS[status]) throw new Error(`Unknown status "${status}" on "${entry.name}"`);
    return { key: status, ...STATUS_LABELS[status] };
  }
  return entry.statusMissing ? { key: 'none', ...STATUS_NOT_RECORDED } : null;
}

// Screens whose groups each open as their own page, matched on the screen title so a
// rename that keeps the word keeps the behaviour. Only long lists need it.
const GROUP_PAGE_SCREENS = [/\bfood\b/i];

export function hasGroupPages(section) {
  return section.subsections.length > 1 && GROUP_PAGE_SCREENS.some((pattern) => pattern.test(section.title));
}

// A group page's screen id sits under its section's: "halal-food-near-you/campus".
export function groupScreenId(section, subsection) {
  return `${section.id}/${subsection.id}`;
}

// The screen Back leads to: a group page's section, or home (null).
export function parentScreen(screenId) {
  return screenId?.includes('/') ? screenId.slice(0, screenId.indexOf('/')) : null;
}

// What a group's card shows about the rows on its page: how many there are, and how
// many carry each halal status, so every status is readable before opening it.
export function groupSummary(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const status = isInfoCard(entry) ? null : statusOf(entry);
    if (status) counts.set(status.key, { ...status, count: (counts.get(status.key)?.count ?? 0) + 1 });
  }
  const order = [...Object.keys(STATUS_LABELS), 'none'];
  return { total: entries.length, statuses: order.filter((key) => counts.has(key)).map((key) => counts.get(key)) };
}

export function isInfoCard(entry) {
  return entry.fields.length > 0 && entry.fields.every((f) => INFO_KEYS.includes(f.key));
}

// Facts that every row in a group has with the same value, so the screen can
// say them once above the rows instead of on each one.
export function sharedFacts(entries) {
  const rows = entries.filter((entry) => !isInfoCard(entry));
  if (rows.length < 2) return [];
  const [first, ...rest] = rows;
  return first.fields
    .filter((f) => !NEVER_SHARED.has(f.key))
    .filter((f) => rest.every((entry) => entry.fields.some((g) => g.key === f.key && g.value === f.value)))
    .map(({ key, value }) => ({ key, value }));
}

// Splits an entry into what a closed row shows and what opening it reveals.
export function rowParts(entry, shared = []) {
  const hidden = new Set(shared.map((f) => f.key));
  const fields = entry.fields.filter((f) => !hidden.has(f.key));
  for (const { key } of fields) {
    const placed = SUMMARY_KEYS.includes(key) || CHIP_KEYS.includes(key) || SPECIAL_KEYS.includes(key) || FIELD_LABELS[key];
    if (!placed) throw new Error(`No place to show "${key}" on "${entry.name}" (content.md line ${entry.line})`);
  }

  const summary = SUMMARY_KEYS.flatMap((key) => fields.filter((f) => f.key === key).map((f) => f.value)).join(' · ');
  const chips = fields
    .filter((f) => CHIP_KEYS.includes(f.key))
    .flatMap(({ key, value }) => {
      if (key === 'jummah') return [{ key, text: value === 'yes' ? 'Jummah' : 'No Jummah', muted: value !== 'yes' }];
      return splitTags(value).map((text) => ({ key, text, muted: false }));
    });
  const facts = fields.filter((f) => FIELD_LABELS[f.key]).map((f) => ({ key: f.key, label: FIELD_LABELS[f.key], value: f.value }));
  const map = fieldMap(entry);
  const link = map.link ? { href: map.link, ...linkText(map.link, map['link-label']) } : null;
  const copyAddress = !link && map.address && !hidden.has('address') ? map.address : null;

  return {
    status: hidden.has('status') ? null : statusOf(entry),
    chips,
    warnings: fields.filter((f) => f.key === 'warning').map((f) => f.value),
    summary,
    facts,
    link,
    copyAddress,
    expandable: facts.length > 0 || Boolean(link) || Boolean(copyAddress),
  };
}

// The visible text of a link describes where it goes, judged from the URL
// itself. `link-label` from content.md always wins.
export function linkText(href, label) {
  const { hostname, pathname } = new URL(href);
  const host = hostname.replace(/^www\./, '');
  if (label) return { text: label, host };
  if (host === 'maps.app.goo.gl' || (host.endsWith('google.com') && pathname.startsWith('/maps'))) {
    return { text: 'Open in Google Maps', host };
  }
  if (host === 'chat.whatsapp.com') return { text: 'Join the WhatsApp group', host };
  if (host === 'play.google.com') return { text: 'Open in Google Play', host };
  if (pathname.toLowerCase().endsWith('.pdf')) return { text: 'Open the PDF', host };
  return { text: 'Visit the website', host };
}

// One home-menu button per published `#` section, in content.md order.
export function menuItems(doc) {
  return doc.sections
    .filter((s) => s.published)
    .map((s) => ({ id: s.id, title: s.title }));
}

// Every published entry with the section and subsection it sits in.
export function entryContexts(doc) {
  const out = [];
  for (const section of doc.sections) {
    if (!section.published) continue;
    for (const block of section.blocks) {
      if (block.type === 'entry') out.push({ entry: block, section, subsection: null });
    }
    for (const subsection of section.subsections) {
      for (const block of subsection.blocks) {
        if (block.type === 'entry') out.push({ entry: block, section, subsection });
      }
    }
  }
  return out;
}

// Page addresses: #/ is home, #/<screen> a screen, #/<screen>/<entry> an opened row.
// "#/section/entry", or "#/section/group/entry" when isScreen says "section/group" is
// a group page.
export function parseRoute(hash, isScreen = () => false) {
  const path = (hash ?? '').replace(/^#/, '');
  if (path === '' || path === '/') return { screen: null, entry: null };
  if (!path.startsWith('/')) return null;
  const parts = path.slice(1).split('/').filter(Boolean);
  const depth = parts.length > 1 && isScreen(`${parts[0]}/${parts[1]}`) ? 2 : 1;
  return { screen: parts.slice(0, depth).join('/'), entry: parts[depth] ?? null };
}

export function routeFor(screen, entry) {
  if (!screen) return '#/';
  return entry ? `#/${screen}/${entry}` : `#/${screen}`;
}

// Search matches what a student can read: headings, the name, field values and
// the status word. URLs and link text generated from URLs are left out.
export function searchText({ entry, section, subsection }) {
  const parts = [section.title, subsection?.title, entry.name, statusOf(entry)?.label];
  for (const { key, value } of entry.fields) {
    if (key === 'link' || key === 'status') continue;
    // The row reads "Jummah", so a search for "jummah" should find it.
    if (key === 'jummah') parts.push(value === 'yes' ? 'Jummah' : '');
    else parts.push(value);
  }
  return parts.filter(Boolean).map(normalize).join('\n');
}

// Case-insensitive, and forgiving about the dashes and quotes phones don't type:
// "Shop 729-733" finds "Shop 729–733".
export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
