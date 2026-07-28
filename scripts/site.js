/*
 * site.js — BESPOKE per-site registry + runtime site detection.
 *
 * ⚠️ PoC / demonstration only.
 * Everything in this file exists ONLY because we are trying to serve multiple
 * brand sites from ONE shared codebase (repoless, single repo). With a repo per
 * site this file would not exist — each site simply *is* itself.
 *
 * See docs/POC-per-site-block-collection.md
 */

// Hand-maintained mapping of delivery hostname fragment -> site key.
// This table grows by one entry per brand, forever, and every block that
// diverges has to be taught about these keys.
const SITE_BY_HOST = {
  'eds-ue-demos': 'mlc', // main--eds-ue-demos--shady-cansultant.aem.page
  'eds-ue-demo-plum': 'plum', // main--eds-ue-demo-plum--shady-cansultant.aem.page
};

export const DEFAULT_SITE = 'mlc';

let cachedSite;

/**
 * Resolve the current site key from the hostname
 * (or a ?site= override for local dev / Universal Editor previews).
 * @returns {string} site key e.g. 'mlc' | 'plum'
 */
export function getSite() {
  if (cachedSite) return cachedSite;
  let site = DEFAULT_SITE;
  const override = new URLSearchParams(window.location.search).get('site');
  const known = Object.values(SITE_BY_HOST);
  if (override && known.includes(override)) {
    site = override;
  } else {
    const host = window.location.hostname;
    const match = Object.keys(SITE_BY_HOST).find((fragment) => host.includes(fragment));
    if (match) site = SITE_BY_HOST[match];
  }
  cachedSite = site;
  return site;
}

/**
 * Stamp the current site onto <html> so shared CSS can branch:
 *   html[data-site="plum"] .hero { ... }
 */
export function decorateSite() {
  document.documentElement.dataset.site = getSite();
}
