// preload.js — runs in the Instagram page context with contextIsolation: true.
//
// Purpose:
//   1. Detect new Direct activity by observing the thread-list container.
//   2. Hide Instagram's "install the app" banner if it appears.
//
// Constraints:
//   - Class names on instagram.com are hashed and rotate, so we use href-based
//     selectors and text-content matching instead of class selectors.
//   - sandbox: false in main.js lets us require('electron') here directly.
//     Nothing is exposed to the page's JS world via contextBridge.

const { ipcRenderer } = require('electron');

const LOG = '[preload]';
const log = (...args) => console.log(LOG, ...args);
const warn = (...args) => console.warn(LOG, ...args);

// ─── Constants ───────────────────────────────────────────────────────

const IPC_DM_ACTIVITY = 'dm-activity';

const DEBOUNCE_MS = 500;
const ATTACH_RETRY_MS = 1500;
const REATTACH_CHECK_MS = 10_000;
const BANNER_INITIAL_DELAY_MS = 3_000;
const BANNER_RESCAN_MS = 30_000;
// After this many consecutive empty banner scans, stop rescanning — Instagram
// doesn't re-inject banners at runtime so this gets us to zero cost after load.
const BANNER_EMPTY_SCANS_BEFORE_STOP = 5;
// How many parents to walk up from the first thread link to locate the
// thread-list container. Instagram's DOM is deeply nested but the list is
// always within the first 8 ancestors of a thread link.
const THREAD_LIST_MAX_PARENT_WALK = 8;

// ─── Debounced activity signal ───────────────────────────────────────

let debounceTimer = null;

function signalActivity() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    try {
      ipcRenderer.send(IPC_DM_ACTIVITY, { ts: Date.now() });
    } catch (e) {
      warn('ipc send failed:', e.message);
    }
  }, DEBOUNCE_MS);
}

// ─── Thread-list observer (stable href-based targeting) ─────────────

// Walk up from the first DM thread link to find the common list container,
// so we observe a narrow subtree (not the whole body — that would saturate
// CPU given Instagram's React churn).
function findThreadListContainer() {
  const firstLink = document.querySelector('a[href^="/direct/t/"]');
  if (!firstLink) return null;

  let el = firstLink.parentElement;
  for (let i = 0; i < THREAD_LIST_MAX_PARENT_WALK && el; i++) {
    // Look for a container that has several thread links as direct/nested
    // descendants — that's the list wrapper.
    if (el.querySelectorAll('a[href^="/direct/t/"]').length >= 2) {
      return el;
    }
    el = el.parentElement;
  }
  return firstLink.parentElement;
}

let observer = null;
let attachTimer = null;

function attachObserver() {
  const target = findThreadListContainer();
  if (!target) {
    // Thread list not rendered yet — retry with backoff.
    attachTimer = setTimeout(attachObserver, ATTACH_RETRY_MS);
    return;
  }

  if (observer) {
    try { observer.disconnect(); } catch (_) {}
  }

  log('thread list located — attaching observer');

  observer = new MutationObserver((mutations) => {
    // Trigger on structural changes to the list's direct/nested children.
    // Genuine thread reorders (new message bumps a thread to top) surface
    // as childList mutations on the list wrapper. Ignore characterData
    // mutations (typing indicators, timestamps, presence) — noise we don't
    // want to signal on.
    const structural = mutations.some(
      (m) =>
        m.type === 'childList' &&
        (m.addedNodes.length > 0 || m.removedNodes.length > 0)
    );
    if (structural) signalActivity();
  });

  // childList only on the list wrapper — NOT subtree. React re-renders
  // inside thread rows (avatars, presence dots) would otherwise fire
  // continuously and saturate the callback even with debounce.
  observer.observe(target, { childList: true });
}

// ─── "Install the app" banner hider (text-match, not class-match) ───

const BANNER_PHRASES = [
  'install the instagram app',
  'open instagram in app',
  'get the app',
];

// Pre-filter: only scan elements that LOOK like banners/dialogs. Scanning the
// whole document tree was the single hottest recurring operation; this scopes
// it to ~dozens of elements instead of thousands.
const BANNER_SELECTORS =
  '[role="dialog"], [role="alert"], [role="banner"], ' +
  '[data-testid*="install"], [aria-label*="install" i]';

let bannerEmptyScans = 0;
let bannerInterval = null;

function hideInstallBanner() {
  let hits = 0;
  try {
    const candidates = document.querySelectorAll(BANNER_SELECTORS);
    for (const el of candidates) {
      // textContent is layout-free (unlike innerText which forces reflow).
      const text = (el.textContent || '').trim().toLowerCase();
      if (!text || text.length > 400) continue;
      if (BANNER_PHRASES.some((p) => text.includes(p))) {
        el.style.display = 'none';
        hits++;
      }
    }
  } catch (_) {
    // banner isn't critical — swallow
  }

  if (hits > 0) {
    bannerEmptyScans = 0;
  } else {
    bannerEmptyScans++;
    if (bannerEmptyScans >= BANNER_EMPTY_SCANS_BEFORE_STOP && bannerInterval) {
      clearInterval(bannerInterval);
      bannerInterval = null;
      log('banner scanner idle — stopping (no hits after several scans)');
    }
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  log('DOM ready — bootstrapping observer + banner hider');
  attachObserver();
  // Give Instagram a few seconds to render before the first scan
  setTimeout(hideInstallBanner, BANNER_INITIAL_DELAY_MS);
  // Re-scan periodically until we're confident there are no banners
  bannerInterval = setInterval(hideInstallBanner, BANNER_RESCAN_MS);
  // Re-attach the observer after SPA navigations that replace the thread
  // list container wholesale.
  setInterval(() => {
    const target = findThreadListContainer();
    if (!observer || !target || !document.contains(target)) {
      attachObserver();
    }
  }, REATTACH_CHECK_MS);
});
