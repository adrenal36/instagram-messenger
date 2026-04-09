// "Install the app" banner hider.
//
// Instagram occasionally injects an overlay nagging the user to install the
// mobile app. We hide it by matching the banner's accessible text rather
// than its (rotating) class names.
//
// Design notes:
//   - Uses textContent, NOT innerText. innerText forces a layout/reflow; on
//     a heavy React page this shows up as a visible stutter.
//   - Scopes the scan via role/testid/aria selectors — scanning the whole
//     document tree was the single hottest recurring operation before.
//   - Self-terminates after N consecutive empty scans so we stop paying
//     CPU cost forever once Instagram has settled.

export const BANNER_PHRASES: readonly string[] = [
  'install the instagram app',
  'open instagram in app',
  'get the app',
];

export const BANNER_SELECTORS =
  '[role="dialog"], [role="alert"], [role="banner"], ' +
  '[data-testid*="install"], [aria-label*="install" i]';

// Longer text than this is not a banner — usually a feed modal or similar.
// Keeps the matcher cheap and prevents false positives.
export const BANNER_TEXT_MAX_LEN = 400;

/**
 * Run one sweep of banner-matching elements in `root` and hide any that match.
 * Returns the number of elements hidden by this call (0 if none).
 *
 * Callers should track consecutive zero-hit results themselves and stop
 * rescanning after a threshold — that policy lives in the bootstrap code.
 */
export function hideInstallBanner(root: Document | Element = document): number {
  let hits = 0;
  const candidates = root.querySelectorAll<HTMLElement>(BANNER_SELECTORS);
  for (const el of candidates) {
    // textContent is layout-free (unlike innerText which forces reflow).
    const raw = el.textContent ?? '';
    const text = raw.trim().toLowerCase();
    if (!text || text.length > BANNER_TEXT_MAX_LEN) continue;
    if (BANNER_PHRASES.some((p) => text.includes(p))) {
      el.style.display = 'none';
      hits++;
    }
  }
  return hits;
}
