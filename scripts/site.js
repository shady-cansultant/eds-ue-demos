/*
 * site.js — per-site identity for the shared (repoless) codebase.
 *
 * ⚠️ PoC / demonstration only. This file exists ONLY because we serve multiple
 * brand sites from ONE shared codebase. With a repo per site it wouldn't exist.
 *
 * Primary signal: the `components` page metadata (<meta name="components">),
 * authored per site via the metadata sheet. It is stable across BOTH delivery
 * and the Universal Editor — unlike the hostname, which in UE is the author
 * origin and always looked like the default site.
 *
 * See docs/POC-per-site-block-collection.md
 */

export const SITES = ['mlc', 'plum'];
export const DEFAULT_SITE = 'mlc';

// Legacy fallback only: delivery hostname fragment -> site key.
const SITE_BY_HOST = {
  'eds-ue-demos': 'mlc', // main--eds-ue-demos--shady-cansultant.aem.page
  'eds-ue-demo-plum': 'plum', // main--eds-ue-demo-plum--shady-cansultant.aem.page
};

let cachedSite;

/**
 * Read the site key from the `components` page metadata, if present and known.
 * @param {Document} doc
 * @returns {string|undefined} site key or undefined
 */
export function siteFromMeta(doc = document) {
  const meta = doc.querySelector('meta[name="components"]');
  const value = meta && meta.content && meta.content.trim().toLowerCase();
  return SITES.includes(value) ? value : undefined;
}

/**
 * Map a hostname to a site key (legacy fallback).
 * @param {string} host e.g. 'main--eds-ue-demo-plum--org.aem.page'
 * @returns {string|undefined} site key or undefined
 */
export function siteFromHost(host = '') {
  const fragment = Object.keys(SITE_BY_HOST).find((f) => host.includes(f));
  return fragment ? SITE_BY_HOST[fragment] : undefined;
}

/**
 * Resolve the current site: ?site= override, then `components` meta, then
 * hostname, then default.
 * @returns {string} site key e.g. 'mlc' | 'plum'
 */
export function getSite() {
  if (cachedSite) return cachedSite;
  const override = new URLSearchParams(window.location.search).get('site');
  cachedSite = (SITES.includes(override) ? override : undefined)
    || siteFromMeta()
    || siteFromHost(window.location.hostname)
    || DEFAULT_SITE;
  return cachedSite;
}

/**
 * Stamp the current site onto <html> so shared CSS can branch:
 *   html[data-site="plum"] .hero { ... }
 */
export function decorateSite() {
  document.documentElement.dataset.site = getSite();
}
