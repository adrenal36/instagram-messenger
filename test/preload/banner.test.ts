import { describe, it, expect, beforeEach } from 'vitest';
import {
  hideInstallBanner,
  BANNER_PHRASES,
  BANNER_TEXT_MAX_LEN,
} from '../../src/preload/banner.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('hideInstallBanner (TSC-A23..A25)', () => {
  it('hides a matching banner inside a [role="dialog"] (TSC-A23)', () => {
    document.body.innerHTML =
      '<div role="dialog">Install the Instagram app for the best experience.</div>';
    const hits = hideInstallBanner(document);
    expect(hits).toBe(1);
    const el = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(el?.style.display).toBe('none');
  });

  it('matches case-insensitively (TSC-A23)', () => {
    document.body.innerHTML =
      '<div role="alert">INSTALL THE INSTAGRAM APP</div>';
    expect(hideInstallBanner(document)).toBe(1);
  });

  it('matches every banner phrase in BANNER_PHRASES', () => {
    for (const phrase of BANNER_PHRASES) {
      document.body.innerHTML = `<div role="banner">Please ${phrase} now</div>`;
      expect(hideInstallBanner(document)).toBe(1);
    }
  });

  it('skips elements whose text is longer than BANNER_TEXT_MAX_LEN (TSC-A24)', () => {
    const filler = 'x'.repeat(BANNER_TEXT_MAX_LEN + 100);
    document.body.innerHTML = `<div role="dialog">install the instagram app ${filler}</div>`;
    expect(hideInstallBanner(document)).toBe(0);
    const el = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(el?.style.display).not.toBe('none');
  });

  it('only scans scoped selectors — never the whole document', () => {
    // A div with banner text that is NOT inside any banner-like container
    // should be ignored, because the selector scan is scoped.
    document.body.innerHTML =
      '<div><p>install the instagram app right here</p></div>';
    expect(hideInstallBanner(document)).toBe(0);
  });

  it('uses textContent, not innerText (TSC-A25)', () => {
    // Tamper: replace innerText getter to throw. Since hideInstallBanner
    // uses textContent, the scan must still succeed. If it were using
    // innerText, this would bubble up as an exception or miss the match.
    const root = document.createElement('div');
    root.setAttribute('role', 'alert');
    root.textContent = 'install the instagram app';
    Object.defineProperty(root, 'innerText', {
      get: () => {
        throw new Error('innerText access is forbidden — use textContent');
      },
    });
    document.body.appendChild(root);

    expect(() => hideInstallBanner(document)).not.toThrow();
    expect(root.style.display).toBe('none');
  });

  it('matches via [aria-label*="install" i]', () => {
    document.body.innerHTML =
      '<div aria-label="Install the app prompt">install the instagram app</div>';
    expect(hideInstallBanner(document)).toBe(1);
  });

  it('matches via [data-testid*="install"]', () => {
    document.body.innerHTML =
      '<div data-testid="install-app-banner">get the app</div>';
    expect(hideInstallBanner(document)).toBe(1);
  });

  it('returns 0 on a page with no banners', () => {
    document.body.innerHTML =
      '<main><h1>Messages</h1><p>Your direct messages</p></main>';
    expect(hideInstallBanner(document)).toBe(0);
  });

  it('counts multiple hits in a single pass', () => {
    document.body.innerHTML = `
      <div role="dialog">install the instagram app</div>
      <div role="alert">open instagram in app</div>
      <div role="banner">Get the app</div>
    `;
    expect(hideInstallBanner(document)).toBe(3);
  });
});

describe('banner scanner self-termination policy (TSC-A26)', () => {
  // The policy itself (clearInterval after N empty scans) lives in the
  // bootstrap code. This test models the policy using the return value
  // of hideInstallBanner, which is the signal the bootstrap reads.
  it('hideInstallBanner returns 0 when there is nothing to hide — bootstrap uses this to stop after N empty scans', () => {
    document.body.innerHTML = '<main>Nothing banner-like here</main>';
    for (let i = 0; i < 5; i++) {
      expect(hideInstallBanner(document)).toBe(0);
    }
  });
});
