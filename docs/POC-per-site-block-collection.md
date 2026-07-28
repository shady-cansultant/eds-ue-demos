# PoC — Per-site block collections in ONE codebase (the cost)

**Question this answers:** *"How heavy is it to give each brand its own block collection —
different component models/definitions per site — inside a single shared (repoless) codebase?"*

**Answer:** achievable — but only by building and owning bespoke plumbing. We built it for **one
block (`hero`)** so the cost is concrete. Every number below multiplies by *(blocks × brands)*.

> TL;DR — In Edge Delivery a block couples **Availability + Content Model + Presentation (JS/CSS)**.
> The canonical `/component-definition.json` (and `-models`, `-filters`) served at a site's origin
> is a single **code file**, shared by every site on that codebase. But the Universal Editor injects
> those configs as `<script>` tags, and **`editor-support.js` can swap them at edit time** to a
> per-site variant (`component-*.<site>.json`) shipped in the same repo. So per-site block
> collections in one codebase **are possible** — via per-site config files + a runtime registry +
> an editor-support swap — no branch/repo per site required. The question is whether owning that
> plumbing beats a repo per site (which gets all of it natively).

## The scenario

Two brands on one codebase:

| | **MLC** (`mlc`) | **Plum** (`plum`) |
|---|---|---|
| `hero` content model | `image, imageAlt, text` | `image, imageAlt, eyebrow, text, ctaText, ctaLink` |
| `hero` presentation | default | full rewrite (purple, eyebrow, pill CTA) |
| `cards` in palette | ✅ available | ❌ removed |

All three axes of divergence from the customer's requirements, on a single block.

## What it took (the moving parts)

Everything here exists **only** because the brands share one repo. With a **repo per site**, every
row below is the platform default — zero custom code.

| # | Part | File(s) added/changed | Why |
|---|---|---|---|
| 1 | Per-site `hero` **model** | `models/sites/mlc/_hero.json`, `models/sites/plum/_hero.json` | Content model can't be inherited/extended — each site needs its own full copy |
| 2 | Per-site **aggregators** (×3 each) | `models/sites/<site>/_component-{definition,models,filters}.json` | The convenient `blocks/*/_*.json` glob is lost; each site hand-lists every block |
| 3 | Hand-forked **section filter** | `models/sites/plum/_component-filters.json` | To drop `cards` from *one* site you fork the whole section palette (can't reuse the shared one) |
| 4 | Bespoke **build script** | `scripts/build-site-config.mjs` | Emits `component-*.<site>.json` per site, then copies ONE to the served files |
| 5 | Runtime **site detection** | `scripts/site.js` | Shared JS must detect which brand it's running as. Primary signal: the `components` page metadata (`<meta name="components">`), authored per site — stable in delivery AND the Universal Editor (hostname isn't: in UE it's the author origin, so it always looked like the default site) |
| 6 | Hook into **shared entry point** | `scripts/scripts.js` (`decorateSite()`) | Core, every-page code now carries multi-brand concerns |
| 7 | Per-site **block JS branch** | `blocks/hero/hero.js` | One block, `if (site === 'plum')` … grows per brand |
| 8 | Per-site **block CSS block** | `blocks/hero/hero.css` (`html[data-site="plum"]`) | Requirement #3 (completely different UI) can't be a CSS-var swap |
| 9 | **UE config swap** | `scripts/editor-support.js` (`loadPerSiteEditorConfig`) | Detects the edited brand + repoints the injected config `<script>`s to `component-*.<site>.json` — the bridge that makes per-site authoring work |

**For ONE block and TWO brands:** ~9 new files + 4 shared-file intrusions.
Scale that by your real block count and brand count.

## How it actually works (the editor-support.js swap)

Steps 1–4 build a **correct** per-site authoring config — inspect `component-definition.plum.json`
and see Plum's 6-field hero and no `cards`. The canonical `/component-definition.json` served at a
site's origin is a single **code file**, so by default *every* site on this codebase gets the same
one (see the live check below).

The bridge is step 9. The Universal Editor injects the config as `<script>` tags, and
`editor-support.js` runs where it can reach them. It detects which brand is being edited (from the
injected script's own origin host) and swaps each `<script>` to that brand's variant:

```
edit a page on   main--eds-ue-demo-plum--…    (Plum origin)
  editor-support.js sees script src …/component-filters.json
  → detects site = plum
  → replaces it with …/component-filters.plum.json  (ships in this same repo)
  → UE now offers Plum's palette + Plum's hero model
```

No branch or repo per site — just per-site config files, a registry, and this swap, all owned by you.

> **Verified vs. assumed:** swapping the *filters* script is a proven technique. Swapping
> *definition* and *models* follows the identical pattern and is implemented here; confirm in a
> live UE session, since the editor may read those at a different moment than filters.

### Live check — the default served file is shared
`eds-ue-demos` (MLC) and `eds-ue-demo-plum` (Plum) share this **one** repo. The canonical config is
byte-identical at both origins — which is exactly why the step-9 swap (not the default file) is what
delivers per-site divergence:

```bash
curl -s https://main--eds-ue-demos--shady-cansultant.aem.live/component-models.json     | shasum
curl -s https://main--eds-ue-demo-plum--shady-cansultant.aem.live/component-models.json | shasum
# → same hash (48472f81…). Per-site divergence comes from loading component-models.<site>.json instead.
```

## Contrast: a repo per site

| | One codebase (this PoC) | Repo per site |
|---|---|---|
| Per-site model | Duplicate + custom build | Native — it's that repo's `_hero.json` |
| Per-site palette | Hand-forked filters | Native — that repo's filters |
| Serve per-site config | Per-site files + **editor-support swap** | Native — it's that repo's config |
| Per-site JS/CSS | Registry + branching in shared files | Native — that repo's files |
| Blast radius | Global (all brands) | Contained |
| Fragility | Unsupported editor hook you own | None — supported defaults |
| Custom framework code | All of the above | **None** |

## Run it

```bash
npm install
npm run build:json           # builds component-*.<site>.json, serves SERVED (default: mlc)
SITE=plum npm run build:json # serve Plum's config instead (proves only one can be served)
npm run lint
```

Preview presentation divergence locally with the override:
`?site=plum` on any page forces the Plum skin (e.g. `http://localhost:3000/?site=plum`).

---
*This is a deliberately faithful implementation of the "block collection per site in one repo"
idea, built to measure it — not an endorsement. See the MLC-Wiki for the architecture write-up.*
