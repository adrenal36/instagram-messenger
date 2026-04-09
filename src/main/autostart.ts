// Autostart helpers — pure fs I/O + string building.
//
// Linux uses XDG autostart spec (`.desktop` file in ~/.config/autostart/).
// Other platforms use Electron's `setLoginItemSettings`, which is wired by
// main.ts — this module only handles the Linux file path logic so it can
// be unit-tested without an Electron runtime.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_NAME, APP_SLUG } from '../shared/constants.js';

export interface AutostartContext {
  /** User home directory (from `os.homedir()`). */
  homeDir: string;
  /** Absolute path to the icon PNG shipped with the app. */
  iconPath: string;
  /** Path to the binary that should run at login. Pass `process.env.APPIMAGE || process.execPath`. */
  execPath: string;
}

/**
 * Return the absolute path to the XDG autostart `.desktop` file for this app.
 * Does not check whether the file exists.
 */
export function autostartDesktopFilePath(homeDir: string): string {
  return path.join(homeDir, '.config', 'autostart', `${APP_SLUG}.desktop`);
}

/**
 * Build the contents of the XDG autostart `.desktop` file.
 * Exported so tests can assert on the generated text without doing disk I/O.
 */
export function buildDesktopFile(ctx: AutostartContext): string {
  return (
    '[Desktop Entry]\n' +
    'Type=Application\n' +
    'Version=1.0\n' +
    `Name=${APP_NAME}\n` +
    'Comment=Desktop wrapper for Instagram Direct\n' +
    `Exec=${ctx.execPath} --hidden\n` +
    `Icon=${ctx.iconPath}\n` +
    'Terminal=false\n' +
    'Categories=Network;InstantMessaging;Chat;\n' +
    'X-GNOME-Autostart-enabled=true\n' +
    `StartupWMClass=${APP_SLUG}\n`
  );
}

/**
 * Write (enabled=true) or remove (enabled=false) the XDG autostart `.desktop` file.
 * Returns true on success, false on I/O failure. No-op success if disabling an
 * already-absent file.
 */
export function setAutostartLinux(enabled: boolean, ctx: AutostartContext): boolean {
  const file = autostartDesktopFilePath(ctx.homeDir);
  try {
    if (enabled) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buildDesktopFile(ctx));
      return true;
    }
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * True if the XDG autostart `.desktop` file for this app exists.
 */
export function isAutostartEnabledLinux(homeDir: string): boolean {
  return fs.existsSync(autostartDesktopFilePath(homeDir));
}
