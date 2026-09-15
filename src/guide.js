// Pure logic shared by the page (app.js) and the tests. No DOM access here.

// Words for each status. Meanings mirror the table in CLAUDE.md and content.md.
// Each status keeps its own word: never collapse certified-section into certified.
export const STATUS_LABELS = {
  certified: { label: 'Certified', meaning: 'Holds halal certification.' },
  'certified-section': { label: 'Certified section only', meaning: 'Only part of the shop or menu is certified.' },
  'check-packaging': { label: 'Check packaging', meaning: 'Some products are certified. Look for the halal logo yourself.' },
  unverified: { label: 'Unverified', meaning: 'Community-known. MUSA has not confirmed anything.' },
};

// Shown on food listings that have no status in content.md (see FOOD_KEYS in
// scripts/schema.mjs). It describes the data, not the place.
export const STATUS_NOT_RECORDED = {
  label: 'Halal status not recorded',
  meaning: 'MUSA has not recorded a halal status for this place.',
};

// Label for every key shown as a row. Keys missing here fail loudly when rendered.
export const FIELD_LABELS = {
  location: 'Location',
  access: 'Access',
  arrangement: 'Arrangement',
  wudu: 'Wudu',
  jummah: 'Jummah',
  floors: 'Floors',
  feature: 'Feature',
  where: 'Where',
  address: 'Address',
  district: 'District',
  walk: 'Walk',
  menu: 'Menu',
  price: 'Price',
  sells: 'Sells',
  what: 'What',
  delivery: 'Delivery',
  perk: 'Perk',
  note: 'Note',
  notes: 'Notes',
};

// Keys rendered in their own way rather than as a label/value row.
export const SPECIAL_KEYS = ['tag', 'status', 'link', 'link-label', 'jummah-note'];

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

// Filter chips. Each rule reads only what content.md already says: headings,
// names, and a few fields. `rule` is the plain-English version, printed by
// the checks so a committee member can see why a listing appears under a chip.
const mentions = (pattern, ...texts) => texts.some((text) => pattern.test(text ?? ''));

function isNearHalls({ entry, section, subsection }) {
  const f = fieldMap(entry);
  return mentions(/\bhalls?\b/i, section.title, subsection?.title, entry.name, f.where, f.location, f.walk);
}

export const FILTERS = [
  {
    id: 'certified',
    label: 'Fully certified',
    rule: 'status is exactly "certified". certified-section, check-packaging and unverified are left out.',
    test: ({ entry }) => fieldMap(entry).status === 'certified',
  },
  {
    id: 'near-campus',
    label: 'Near campus',
    rule: 'section heading says "on campus", subsection says "Closest to PolyU", or the name says "near campus" — minus anything that matches Near halls.',
    test: (ctx) =>
      !isNearHalls(ctx) &&
      (mentions(/\bon campus\b/i, ctx.section.title) ||
        mentions(/\bclosest to polyu\b/i, ctx.subsection?.title) ||
        mentions(/\bnear campus\b/i, ctx.entry.name)),
  },
  {
    id: 'near-halls',
    label: 'Near halls',
    rule: 'section heading, subsection heading, name, "where", "location" or "walk" mentions "hall" or "halls".',
    test: isNearHalls,
  },
  {
    id: 'delivery',
    label: 'Delivery',
    rule: 'section or subsection heading says "delivery", or the entry has a "delivery" field.',
    test: ({ entry, section, subsection }) =>
      mentions(/\bdelivery\b/i, section.title, subsection?.title) || entry.fields.some((f) => f.key === 'delivery'),
  },
  {
    id: 'prayer',
    label: 'Prayer',
    rule: 'section heading, subsection heading or name says "prayer", and the section heading does not say "mosque".',
    test: ({ entry, section, subsection }) =>
      mentions(/\bprayer\b/i, section.title, subsection?.title, entry.name) && !mentions(/\bmosques?\b/i, section.title),
  },
  {
    id: 'mosques',
    label: 'Mosques',
    rule: 'section heading says "mosque" or "mosques".',
    test: ({ section }) => mentions(/\bmosques?\b/i, section.title),
  },
];

// Search matches what a student can read on the card: section and subsection
// headings, the name, field values and the status word. URLs and link text
// generated from URLs are left out, so "google" doesn't match every map link.
export function searchText({ entry, section, subsection }) {
  const parts = [section.title, subsection?.title, entry.name, statusOf(entry)?.label];
  for (const { key, value } of entry.fields) {
    if (key === 'link' || key === 'status') continue;
    // The card reads "Jummah: Yes", so a search for "jummah" should find it.
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
