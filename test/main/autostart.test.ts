import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  autostartDesktopFilePath,
  buildDesktopFile,
  isAutostartEnabledLinux,
  setAutostartLinux,
  type AutostartContext,
} from '../../src/main/autostart.js';

// Pure-string tests don't need a tmp dir — use a frozen context.
const STATIC_CTX: AutostartContext = {
  homeDir: '/home/testuser',
  iconPath: '/opt/instagram-messenger/build/icon.png',
  execPath: '/opt/instagram-messenger/instagram-messenger',
};

describe('autostartDesktopFilePath', () => {
  it('returns the XDG autostart path ending with the app slug (TSC-A13)', () => {
    const p = autostartDesktopFilePath(STATIC_CTX.homeDir);
    expect(p.endsWith('/.config/autostart/instagram-messenger.desktop')).toBe(true);
    expect(p.startsWith(STATIC_CTX.homeDir)).toBe(true);
  });
});

describe('buildDesktopFile', () => {
  it('includes X-GNOME-Autostart-enabled=true and StartupWMClass (TSC-A17)', () => {
    const text = buildDesktopFile(STATIC_CTX);
    expect(text).toContain('X-GNOME-Autostart-enabled=true');
    expect(text).toContain('StartupWMClass=instagram-messenger');
  });

  it('sets Exec= to the provided execPath with --hidden flag (TSC-A18)', () => {
    const text = buildDesktopFile(STATIC_CTX);
    expect(text).toContain(`Exec=${STATIC_CTX.execPath} --hidden`);
  });

  it('honors a different execPath (APPIMAGE vs binary)', () => {
    const appImageCtx: AutostartContext = { ...STATIC_CTX, execPath: '/tmp/IG.AppImage' };
    expect(buildDesktopFile(appImageCtx)).toContain('Exec=/tmp/IG.AppImage --hidden');
  });

  it('has the [Desktop Entry] header and Type=Application', () => {
    const text = buildDesktopFile(STATIC_CTX);
    expect(text.startsWith('[Desktop Entry]\n')).toBe(true);
    expect(text).toContain('Type=Application');
  });

  it('declares proper categories for a chat/IM app', () => {
    expect(buildDesktopFile(STATIC_CTX)).toContain(
      'Categories=Network;InstantMessaging;Chat;',
    );
  });

  it('embeds the icon path verbatim', () => {
    expect(buildDesktopFile(STATIC_CTX)).toContain(`Icon=${STATIC_CTX.iconPath}`);
  });
});

// Filesystem-touching tests get a fresh tmp home per test.
describe('filesystem operations', () => {
  let fakeHome: string;
  let ctx: AutostartContext;

  beforeEach(() => {
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'igm-home-'));
    ctx = {
      homeDir: fakeHome,
      iconPath: '/opt/instagram-messenger/build/icon.png',
      execPath: '/opt/instagram-messenger/instagram-messenger',
    };
  });

  afterEach(() => {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  describe('setAutostartLinux', () => {
    it('writes a valid XDG .desktop with Exec= containing the binary path (TSC-A14)', () => {
      expect(setAutostartLinux(true, ctx)).toBe(true);
      const file = autostartDesktopFilePath(fakeHome);
      expect(fs.existsSync(file)).toBe(true);
      const contents = fs.readFileSync(file, 'utf8');
      expect(contents).toContain(`Exec=${ctx.execPath} --hidden`);
    });

    it('creates the parent autostart dir if missing', () => {
      const autostartDir = path.join(fakeHome, '.config', 'autostart');
      expect(fs.existsSync(autostartDir)).toBe(false);
      setAutostartLinux(true, ctx);
      expect(fs.existsSync(autostartDir)).toBe(true);
    });

    it('removes the file if present when disabling (TSC-A15)', () => {
      setAutostartLinux(true, ctx);
      expect(isAutostartEnabledLinux(fakeHome)).toBe(true);
      expect(setAutostartLinux(false, ctx)).toBe(true);
      expect(isAutostartEnabledLinux(fakeHome)).toBe(false);
    });

    it('is a no-op success if disabling an already-absent file (TSC-A15)', () => {
      expect(isAutostartEnabledLinux(fakeHome)).toBe(false);
      expect(setAutostartLinux(false, ctx)).toBe(true);
    });

    it('overwrites an existing .desktop file on re-enable', () => {
      setAutostartLinux(true, ctx);
      const newCtx: AutostartContext = { ...ctx, execPath: '/new/path/binary' };
      setAutostartLinux(true, newCtx);
      const contents = fs.readFileSync(autostartDesktopFilePath(fakeHome), 'utf8');
      expect(contents).toContain('Exec=/new/path/binary --hidden');
      expect(contents).not.toContain(ctx.execPath);
    });
  });

  describe('isAutostartEnabledLinux', () => {
    it('reflects the file existence on linux (TSC-A16)', () => {
      expect(isAutostartEnabledLinux(fakeHome)).toBe(false);
      setAutostartLinux(true, ctx);
      expect(isAutostartEnabledLinux(fakeHome)).toBe(true);
      setAutostartLinux(false, ctx);
      expect(isAutostartEnabledLinux(fakeHome)).toBe(false);
    });
  });
});
