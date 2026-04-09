// preload.ts — runs in the Instagram page context with contextIsolation: true.
//
// Purpose:
//   1. Detect new Direct activity by observing the thread-list container.
//   2. Hide Instagram's "install the app" banner if it appears.
//
// Constraints:
//   - Class names on instagram.com are hashed and rotate, so we use href-based
//     selectors and text-content matching instead of class selectors.
//   - sandbox: false in main.ts lets us require('electron') here directly.
//     Nothing is exposed to the page's JS world via contextBridge.

import { ipcRenderer } from 'electron';
import {
  IPC_DM_ACTIVITY,
  DEBOUNCE_MS,
  ATTACH_RETRY_MS,
  REATTACH_CHECK_MS,
  BANNER_INITIAL_DELAY_MS,
  BANNER_RESCAN_MS,
  BANNER_EMPTY_SCANS_BEFORE_STOP,
  type DMActivityPayload,
} from './shared/constants.js';
import { createDebouncer } from './preload/debounce.js';
import {
  findThreadListContainer,
  hasStructuralMutation,
} from './preload/thread-list.js';
import { hideInstallBanner } from './preload/banner.js';

const LOG = '[preload]';
const log = (...args: unknown[]): void => { console.log(LOG, ...args); };
const warn = (...args: unknown[]): void => { console.warn(LOG, ...args); };

// ─── Debounced activity signal ───────────────────────────────────────

const signalActivity = createDebouncer(DEBOUNCE_MS, () => {
  try {
    const payload: DMActivityPayload = { ts: Date.now() };
    ipcRenderer.send(IPC_DM_ACTIVITY, payload);
  } catch (e) {
    warn('ipc send failed:', (e as Error).message);
  }
});

// ─── Thread-list observer (stable href-based targeting) ─────────────

let observer: MutationObserver | null = null;
let attachTimer: ReturnType<typeof setTimeout> | null = null;

function attachObserver(): void {
  const target = findThreadListContainer();
  if (!target) {
    // Thread list not rendered yet — retry with backoff.
    attachTimer = setTimeout(attachObserver, ATTACH_RETRY_MS);
    return;
  }

  if (observer) {
    try { observer.disconnect(); } catch { /* ignore */ }
  }

  log('thread list located — attaching observer');

  observer = new MutationObserver((mutations) => {
    // Trigger on structural changes to the list's direct children.
    // Genuine thread reorders (new message bumps a thread to top) surface
    // as childList mutations. characterData-only churn (typing indicators,
    // timestamps) is filtered out by hasStructuralMutation.
    if (hasStructuralMutation(mutations)) signalActivity();
  });

  // childList only on the list wrapper — NOT subtree. React re-renders
  // inside thread rows (avatars, presence dots) would otherwise fire
  // continuously and saturate the callback even with debounce.
  observer.observe(target, { childList: true });
}

// ─── "Install the app" banner hider (text-match, not class-match) ───

let bannerEmptyScans = 0;
let bannerInterval: ReturnType<typeof setInterval> | null = null;

function runBannerScan(): void {
  const hits = hideInstallBanner();
  if (hits > 0) {
    bannerEmptyScans = 0;
    return;
  }
  bannerEmptyScans++;
  if (bannerEmptyScans >= BANNER_EMPTY_SCANS_BEFORE_STOP && bannerInterval) {
    clearInterval(bannerInterval);
    bannerInterval = null;
    log('banner scanner idle — stopping (no hits after several scans)');
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  log('DOM ready — bootstrapping observer + banner hider');
  attachObserver();
  // Give Instagram a few seconds to render before the first scan
  setTimeout(runBannerScan, BANNER_INITIAL_DELAY_MS);
  // Re-scan periodically until we're confident there are no banners
  bannerInterval = setInterval(runBannerScan, BANNER_RESCAN_MS);
  // Re-attach the observer after SPA navigations that replace the thread
  // list container wholesale.
  setInterval(() => {
    const target = findThreadListContainer();
    if (!observer || !target || !document.contains(target)) {
      if (attachTimer) {
        clearTimeout(attachTimer);
        attachTimer = null;
      }
      attachObserver();
    }
  }, REATTACH_CHECK_MS);
});
