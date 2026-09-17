# MUSA Muslim Guide — Project Rules

A static website that renders a guide for Muslim students at the Hong Kong Polytechnic
University, generated from a single markdown data file. Built and maintained by MUSA
(PolyU Muslim Association).

Read this file fully before doing anything.

---

## What this project is

`content.md` in the repo root holds every fact the guide contains: prayer rooms, halal
food outlets, grocery shops, mosques, links. A build script parses it into
`content.json`. The website renders that JSON. Nothing else is a source of truth.

The audience is students, many of them new to Hong Kong, reading on a phone, often
while standing somewhere trying to decide where to eat or pray.

---

## The rules

### 1. Never invent content

Every restaurant, prayer room, address, opening detail, halal status and link must come
from `content.md`. If data looks missing or incomplete, say so and stop. Do not fill the
gap with something plausible.

This is the most important rule in the project. A hallucinated halal certification means
a student eats something they believe is permissible and it isn't. That is a real harm to
a real person, and it is not recoverable by editing a file afterwards. Plausible-looking
invented data is the specific failure mode to guard against, because invented entries
look exactly like real ones.

The same applies to links. Never construct a URL that isn't in `content.md`, even if the
pattern seems obvious.

### 2. Never edit `content.md` unless explicitly told to

It is maintained by hand by the committee. If validation fails on a real entry, report
the problem — do not edit the data to make the validator pass. The validator serves the
data, not the other way round.

### 3. No runtime dependencies

Build-time `devDependencies` only, pinned to exact versions with no `^` or `~`. The
website ships zero JavaScript libraries to the browser.

Reason: this is maintained by student volunteers who graduate and hand it over. A
dependency tree is a security-advisory treadmill that nobody will be left to walk. Plain
JS will still build in five years.

### 4. Don't add a package for what 20 lines of JS solves

No search library — the dataset is around 40 entries and `.toLowerCase().includes()` is
instant. No markdown library in the browser — parse at build time. No date library. No
CSS framework. No CDN links of any kind.

### 5. Never use `innerHTML` with content data

Use `textContent` and `createElement`. Entry text contains en dashes, middle dots,
Arabic transliterations and other non-ASCII characters that must survive intact, and
`innerHTML` is also an injection risk.

### 6. Parse failures must fail loudly

If `content.md` has a malformed entry, the build exits non-zero with the line number.
Never skip a bad entry silently. A prayer room that quietly vanishes from the site is
invisible until a student can't find it.

### 7. No browser storage for content

`localStorage` and `sessionStorage` are for user preferences only, never for caching
guide data. Stale halal information is worse than no information.

### 8. Prove it works

Run `npm run check` and show the output before saying something works. When rendering
changes, assert that every entry in `content.json` still appears in the DOM. Don't
assert success — demonstrate it.

---

## Data format

`content.md` uses a strict convention:

- `#` — section
- `##` — subsection
- `###` — entry name
- `- key: value` — a field on that entry. Values may contain colons; split on the first one only.
- `TODO:` — a known gap. Collected and reported, never rendered as a field.
- Paragraphs and `>` blockquotes between entries are prose belonging to the enclosing section, in document order.

The `HELD BACK FOR v2` section is parsed but marked `published: false` and never rendered.
The repo is public, so unpublished notes belong in the gitignored `held-back.md`, not here.

### Allowed `status` values

Only these four, exactly:

| Value | Meaning |
|---|---|
| `certified` | Holds halal certification |
| `certified-section` | Only part of the shop or menu is certified |
| `check-packaging` | Some products are certified; the student must look for the logo |
| `unverified` | Community-known. MUSA has not confirmed anything. |

Anything else fails validation. These distinctions carry real weight — collapsing
`certified-section` into `certified` in the UI is a serious bug, not a cosmetic one.

### How entries render

The logic lives in `src/guide.js`.

- Each `#` section is a button on the home menu and its own screen, in file order.
- Each `##` subsection is a heading on that screen.
- Each `###` entry is a row. Without tapping, a row shows:
  - the name and the halal status;
  - `prayers` (which prayers are held, "Dhuhr · Asr · Maghrib · Isha") as a light line under the chips;
  - `jummah`, `tags`, `perk` and `delivery` as highlighted chips. A `tags`
    value holds several chips separated by ` · `, so facts read as tags, not sentences;
  - a one-line summary from `tag`, `location`, `where`, `walk`, `district`, `what`, `sells`
    and `price`.
- `warning` is a caveat that must be read before acting ("Only these 3 meals are halal.
  Other dishes are not."). It shows on the row in amber, never folded away, never shared.
- Tapping a row shows its other fields, its link, and a Copy address button when there is
  an address but no link. A row with nothing more to show does not open.
- An entry made only of `note` and `link` is an always-open card: tips, apps, lists.
- When every row under a heading has the same value for a field, that value shows once
  above the rows as chips instead of on each one. This includes `status`: where a whole
  group shares one, the badge sits above the group, still visible without tapping.
- Map links carry a pin icon drawn in the page. Never load map images from a third party,
  and never build a map URL that isn't in `content.md`.
- `>` blockquotes render as highlighted notes. Use them for warnings.
- On long screens (the Halal Food screen, matched on the word "food" in its title) each
  `##` group is its own page, opened from a card on that screen, the same way Prayer
  Facilities leads to Z302a. The card shows only the group's name, so the screen reads at a
  glance; statuses and warnings show on the page's rows. A group that is only one note and
  link (the IUHK list) opens that link straight from its card. Back goes one level up.

---

## Structure

```
content.md              the only file most people touch
CLAUDE.md               this file
scripts/
  parse.mjs             content.md → content.json
  validate.mjs          schema, status vocabulary, TODO report
  schema.mjs            allowed keys and statuses
  check-links.mjs       every URL still resolves
  dev.mjs               local server
  measure-background.mjs  brightness of the background photo, for the contrast test
src/
  index.html
  background.jpg        background photograph
  app.js                home menu, screens, rows, search, Back button
  guide.js              how entries render; shared with the tests
  styles.css
tests/
  smoke.spec.js         Playwright
  unit/                 node:test
.github/workflows/      validate, test, deploy, weekly link check
```

## Commands

| Command | Does |
|---|---|
| `npm run build` | Parse `content.md` into `content.json` |
| `npm run check` | Validate the data and report TODO gaps |
| `npm run dev` | Serve `src/` locally |
| `npm test` | Playwright suite |
| `npm run test:unit` | Parser, validator, rendering logic, contrast and guardrails |
| `npm run links` | Check every link in `content.md` |

---

## UI principles

- Mobile-first, single column. Assume a 375px screen and one thumb.
- Prayer comes before food. It's what a new student can't find by searching online.
- Status shown as a word plus colour, never colour alone — for colourblind readers and grayscale printing.
- Minimum 48px tap targets. People tap these while walking.
- No modals or carousels. Rows may open on tap, but the name, where it is, and the halal
  status word must be visible without tapping — on the row, once above a group where every
  row shares it. A card that only opens a group's page may show just the group's name. Halal status, prayer times, access limits and warnings are never folded away.
- Short, plain words, as tags rather than sentences. Say a fact once, as briefly as it stays exact.
- One theme, dark, for now: the light palette was removed on 2026-09-16 because the
  background photograph only reads on a dark ground. Bringing light mode back means a
  second palette plus its own figures in `tests/unit/contrast.test.mjs`.
- Respect `prefers-reduced-motion`. Visible focus rings. WCAG AA contrast throughout.
- System font stack. No webfonts, no Google Fonts.
- The background photograph is `src/background.jpg`, by Muhsin ck from Unsplash (photo
  8BcNsqDJy2I), used under the Unsplash Licence. The scrim over it is set so text keeps
  AA contrast over the photo's brightest and darkest pixels; `npm run test:unit` checks
  this, and `node scripts/measure-background.mjs` regenerates the figures if the image
  changes. Any replacement image needs a licence that allows commercial use.

### Colours

The dark palette in use:

| Token | Value |
|---|---|
| Accent | `#6FCDB8` |
| Ink | `#E6EEEA` |
| Muted | `#A3B3AB` |
| Background | `#111916` |
| Header | `#0F2A24` |
| Certified | green tint |
| Check packaging / certified section | amber tint |
| Unverified | neutral grey |

MUSA's brand green `#12695A` is the accent for light mode, which returns with it.

---

## Working style

Do one thing per session. Show the plan before writing code and wait for approval.
Commit after each working step.

Deliberately out of scope for v1: service workers and offline caching (the leading cause
of users seeing corrected information that is still wrong), PWA install prompts, and
any FAQ or religious ruling content.

---

## For committee members

To update the guide:

1. Edit `content.md`. Follow the format at the top of that file.
2. Run `npm run check`. Fix anything it reports.
3. Commit and push to `main`.

The site rebuilds and redeploys automatically. If validation fails, the deploy is
blocked and the old site stays up — a broken build never replaces a working guide.
