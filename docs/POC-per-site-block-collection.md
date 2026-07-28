# PoC — Per-site block collections in ONE codebase (the cost)

**Question this answers:** *"How heavy is it to give each brand its own block collection —
different component models/definitions per site — inside a single shared (repoless) codebase?"*

**Answer:** heavy, and partly impossible without a branch per site. We built it for **one block
(`hero`)** so the cost is concrete. Every number below multiplies by *(blocks × brands)*.

> TL;DR — In Edge Delivery a block couples **Availability + Content Model + Presentation (JS/CSS)**,
> and a single deployed code ref serves exactly **one** `component-definition/models/filters`.
> There is **no per-site override** (see
> [aem.live/developer/repoless-multisite-manager](https://www.aem.live/developer/repoless-multisite-manager)).
> So "per-site block collections in one repo" is emulated with bespoke build + runtime plumbing,
> and the authoring config still can't diverge without a **branch per site**.

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
| 5 | Runtime **site registry** | `scripts/site.js` | Shared JS must detect which brand it's running as (hostname → site key), by hand |
| 6 | Hook into **shared entry point** | `scripts/scripts.js` (`decorateSite()`) | Core, every-page code now carries multi-brand concerns |
| 7 | Per-site **block JS branch** | `blocks/hero/hero.js` | One block, `if (site === 'plum')` … grows per brand |
| 8 | Per-site **block CSS block** | `blocks/hero/hero.css` (`html[data-site="plum"]`) | Requirement #3 (completely different UI) can't be a CSS-var swap |

**For ONE block and TWO brands:** ~8 new files + 3 shared-file intrusions.
Scale that by your real block count and brand count.

## The wall (this is the important part)

Steps 1–4 build a **correct** per-site authoring config — you can inspect
`component-definition.plum.json` and see Plum's 6-field hero and no `cards`. **But EDS serves a
single `component-definition.json` per code ref, shared by every site pointed at that code.**

So to actually *serve* Plum's authoring config you must put it on a **separate branch** and point the
Plum site's code ref at that branch:

```
main        →  component-*.json = MLC   →  site: eds-ue-demos       (MLC)
site/plum   →  component-*.json = Plum  →  site: eds-ue-demo-plum   (Plum)
```

At that point your "one repo, one codebase" is **one branch per brand** — i.e. N divergent
codebases wearing a single repo, which you now keep in sync by hand. That is strictly worse than
N repos, because it *looks* shared but isn't.

### Live proof
`eds-ue-demos` (MLC) and `eds-ue-demo-plum` (Plum) are two aem.live sites sharing this **one** code
repo. Fetch the served config from each delivery origin — they are **byte-identical**, because the
authoring config comes from the code, not the site:

```bash
curl -s https://main--eds-ue-demos--shady-cansultant.aem.page/component-models.json     | shasum
curl -s https://main--eds-ue-demo-plum--shady-cansultant.aem.page/component-models.json | shasum
# → same hash. The per-site divergence you see in component-models.plum.json is NOT served.
```

The **only** divergence you get "for free" on shared code is runtime JS/CSS
(`scripts/site.js` + `html[data-site]`) — and even that is the bespoke registry in step 5–8.

## Contrast: a repo per site

| | One codebase (this PoC) | Repo per site |
|---|---|---|
| Per-site model | Duplicate + custom build | Native — it's that repo's `_hero.json` |
| Per-site palette | Hand-forked filters | Native — that repo's filters |
| Serve per-site config | **Branch per site** | Native — separate deploys |
| Per-site JS/CSS | Registry + branching in shared files | Native — that repo's files |
| Blast radius | Global (all brands) | Contained |
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
