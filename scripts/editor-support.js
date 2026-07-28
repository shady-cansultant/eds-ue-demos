import {
  decorateBlock,
  decorateBlocks,
  decorateIcons,
  decorateSections,
  loadBlock,
  loadScript,
  loadSections,
} from './aem.js';
import { decorateRichtext } from './editor-support-rte.js';
import { decorateButtons, decorateMain } from './scripts.js';
import { siteFromHost, DEFAULT_SITE } from './site.js';

let promiseChanges$ = Promise.resolve();

async function applyChanges(event) {
  await promiseChanges$;

  // redecorate default content and blocks on patches (in the properties rail)
  const { detail } = event;

  const resource = detail?.request?.target?.resource // update, patch components
    || detail?.request?.target?.container?.resource // update, patch, add to sections
    || detail?.request?.to?.container?.resource; // move in sections
  if (!resource) return false;
  const updates = detail?.response?.updates;
  if (!updates.length) return false;
  const { content } = updates[0];
  if (!content) return false;

  // load dompurify
  await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);

  const sanitizedContent = window.DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
  const parsedUpdate = new DOMParser().parseFromString(sanitizedContent, 'text/html');
  const element = document.querySelector(`[data-aue-resource="${resource}"]`);

  if (element) {
    if (element.matches('main')) {
      const newMain = parsedUpdate.querySelector(`[data-aue-resource="${resource}"]`);
      if (!newMain) return false;
      newMain.style.display = 'none';
      element.insertAdjacentElement('afterend', newMain);
      decorateMain(newMain);
      decorateRichtext(newMain);
      await loadSections(newMain);
      element.remove();
      newMain.style.display = null;
      // eslint-disable-next-line no-use-before-define
      attachEventListeners(newMain);
      return true;
    }

    const block = element.parentElement?.closest('.block[data-aue-resource]') || element?.closest('.block[data-aue-resource]');
    if (block) {
      const blockResource = block.getAttribute('data-aue-resource');
      const newBlock = parsedUpdate.querySelector(`[data-aue-resource="${blockResource}"]`);
      if (newBlock) {
        newBlock.style.display = 'none';
        block.insertAdjacentElement('afterend', newBlock);
        decorateButtons(newBlock);
        decorateIcons(newBlock);
        decorateBlock(newBlock);
        decorateRichtext(newBlock);
        await loadBlock(newBlock);
        block.remove();
        newBlock.style.display = null;
        return true;
      }
    } else {
      // sections and default content, may be multiple in the case of richtext
      const newElements = parsedUpdate.querySelectorAll(`[data-aue-resource="${resource}"],[data-richtext-resource="${resource}"]`);
      if (newElements.length) {
        const { parentElement } = element;
        if (element.matches('.section')) {
          const [newSection] = newElements;
          newSection.style.display = 'none';
          element.insertAdjacentElement('afterend', newSection);
          decorateButtons(newSection);
          decorateIcons(newSection);
          decorateRichtext(newSection);
          decorateSections(parentElement);
          decorateBlocks(parentElement);
          await loadSections(parentElement);
          element.remove();
          newSection.style.display = null;
        } else {
          element.replaceWith(...newElements);
          decorateButtons(parentElement);
          decorateIcons(parentElement);
          decorateRichtext(parentElement);
        }
        return true;
      }
    }
  }

  return false;
}

function attachEventListeners(main) {
  [
    'aue:content-patch',
    'aue:content-update',
    'aue:content-add',
    'aue:content-move',
    'aue:content-remove',
    'aue:content-copy',
  ].forEach((eventType) => main?.addEventListener(eventType, async (event) => {
    event.stopPropagation();
    promiseChanges$ = applyChanges(event);
    const applied = await promiseChanges$;
    if (!applied) window.location.reload();
  }));
}

/*
 * PoC: per-site block collections in ONE codebase — the bridge that makes it work.
 *
 * The Universal Editor injects <script src=".../component-{definition,models,filters}.json">
 * into this document. Here we detect which brand is being edited (from the injected
 * script's OWN origin, which carries the site host) and repoint each script to that
 * brand's variant — component-*.<site>.json — which ships in this same shared codebase.
 *
 * This is what makes "different models/palette per site" possible without a branch or
 * repo per site. It is also the bespoke, unsupported plumbing you then own forever:
 * a per-brand registry (scripts/site.js) + N config files + this swap. With a repo per
 * site none of it exists.
 *
 * Verified: swapping the filters script is a known-working technique. Swapping the
 * definition and models scripts follows the identical pattern; confirm in a live UE session.
 */
function loadPerSiteEditorConfig() {
  const probe = document.querySelector('script[src*="/component-filters"]');
  if (!probe) return;
  let site = DEFAULT_SITE;
  try {
    site = siteFromHost(new URL(probe.src).hostname);
  } catch (e) {
    // keep default
  }
  // The default site's config is already served as the canonical component-*.json.
  if (site === DEFAULT_SITE) return;
  ['definition', 'models', 'filters'].forEach((kind) => {
    const script = document.querySelector(`script[src*="/component-${kind}"]`);
    if (!script) return;
    const src = script.src.replace(`component-${kind}.json`, `component-${kind}.${site}.json`);
    if (src === script.src) return;
    const replacement = document.createElement('script');
    replacement.src = src;
    replacement.type = script.type;
    script.parentNode.replaceChild(replacement, script);
  });
}

attachEventListeners(document.querySelector('main'));
loadPerSiteEditorConfig();

// decorate rich text
// this has to happen after decorateMain(), and everythime decorateBlocks() is called
decorateRichtext();
// in cases where the block decoration is not done in one synchronous iteration we need to listen
// for new richtext-instrumented elements. this happens for example when using experimentation.
const observer = new MutationObserver(() => decorateRichtext());
observer.observe(document, { attributeFilter: ['data-richtext-prop'], subtree: true });
