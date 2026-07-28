import { getSite } from '../../scripts/site.js';

/*
 * hero — one block NAME, a different PRESENTATION per site.
 *
 * ⚠️ PoC: the per-site branching below is the *cost* of sharing a single block
 * across brands that look nothing alike. Every new brand adds another branch
 * here, its own CSS (hero.css), AND its own component-model
 * (models/sites/<site>/_hero.json). With a repo per site, this file would just
 * be that one site's hero — no branching, no registry.
 *
 * See docs/POC-per-site-block-collection.md
 */

/**
 * Plum's component-model (models/sites/plum/_hero.json) exposes extra fields
 * (eyebrow + CTA) that MLC's hero does not have. Tag them so Plum's CSS can
 * lay out a hero that MLC's model could never produce.
 */
function decoratePlum(block) {
  const paragraphs = block.querySelectorAll('p');
  if (paragraphs.length) paragraphs[0].classList.add('hero-eyebrow');
  const cta = block.querySelector('a');
  if (cta) cta.classList.add('button', 'hero-cta');
}

export default function decorate(block) {
  const site = getSite();
  block.dataset.heroSite = site;
  if (site === 'plum') {
    decoratePlum(block);
  }
  // MLC keeps the default markup — its divergence is theme + model only.
}
