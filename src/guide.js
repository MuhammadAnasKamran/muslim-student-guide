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

export function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
