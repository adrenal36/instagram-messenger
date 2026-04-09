// Locate Instagram's DM thread-list container starting from any thread link.
//
// Instagram's class names are hashed and rotate, so we anchor on the stable
// href shape `/direct/t/<id>` and walk up a bounded number of parents until
// we find a wrapper that contains ≥2 thread links. That's the list.

import { THREAD_LIST_MAX_PARENT_WALK } from '../shared/constants.js';

const THREAD_LINK_SELECTOR = 'a[href^="/direct/t/"]';

/**
 * Find the DM thread-list container in the given document.
 * Returns null if no thread links exist at all.
 * Otherwise walks up at most {@link THREAD_LIST_MAX_PARENT_WALK} ancestors
 * looking for a container that holds ≥2 thread links; falls back to the
 * first link's parent element when no such ancestor is found within bounds.
 */
export function findThreadListContainer(root: Document | Element = document): Element | null {
  const firstLink = root.querySelector(THREAD_LINK_SELECTOR);
  if (!firstLink) return null;

  let el: Element | null = firstLink.parentElement;
  for (let i = 0; i < THREAD_LIST_MAX_PARENT_WALK && el; i++) {
    if (el.querySelectorAll(THREAD_LINK_SELECTOR).length >= 2) {
      return el;
    }
    el = el.parentElement;
  }
  return firstLink.parentElement;
}

/**
 * True if the given MutationRecord list contains a structural childList
 * change (added/removed nodes). Used to filter out characterData-only churn
 * (typing indicators, timestamps) that isn't actionable.
 */
export function hasStructuralMutation(mutations: MutationRecord[]): boolean {
  return mutations.some(
    (m) =>
      m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0),
  );
}
