// The vocabulary content.md is allowed to use. See CLAUDE.md, "Data format".
// To add a key: add it here, give it a label in src/guide.js, then use it.

export const STATUSES = ['certified', 'certified-section', 'check-packaging', 'unverified'];

export const ENTRY_KEYS = [
  'tag',
  'location',
  'access',
  'arrangement',
  'wudu',
  'jummah',
  'jummah-note',
  'prayers',
  'tags',
  'warning',
  'floors',
  'feature',
  'where',
  'address',
  'district',
  'walk',
  'status',
  'menu',
  'price',
  'sells',
  'what',
  'delivery',
  'perk',
  'note',
  'notes',
  'link',
  'link-label',
];

export const META_KEYS = [
  'title',
  'subtitle',
  'org',
  'version',
  'updated',
  'site',
  'contact',
  'instagram',
  'whatsapp',
];

// Keys that describe somewhere you get food. An entry with any of these and no
// `status` is reported as a warning, and the site says the halal status is not
// recorded rather than leaving students to guess.
export const FOOD_KEYS = ['where', 'walk', 'menu', 'price', 'sells', 'what', 'delivery', 'perk'];

// content.md rule 4: leave a key out rather than writing a placeholder.
export const PLACEHOLDER = /^(tbc|tbd|tba|n\/?a|unknown|\?+|-+)$/i;

// A `#` section whose title starts with this is parsed but never published.
export const HELD_BACK = /^HELD BACK\b/i;
