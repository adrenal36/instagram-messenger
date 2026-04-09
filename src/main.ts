// main.ts — Instagram Messenger (Electron cross-platform wrapper)
//
// Phase B TypeScript port of the original main.js. All pure logic lives in
// src/main/ and src/shared/ (unit-tested); this file is the Electron glue.

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  Notification,
  ipcMain,
  nativeTheme,
  shell,
  type NativeImage,
  type IpcMainEvent,
  type MenuItemConstructorOptions,
  type HandlerDetails,
} from 'electron';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  APP_NAME,
  APP_ID,
  START_URL,
  DESKTOP_UA,
  SESSION_PARTITION,
  GLOBAL_HOTKEY,
  IPC_DM_ACTIVITY,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
} from './shared/constants.js';
import { loadZoom, saveZoom } from './main/zoom.js';
import {
  isAutostartEnabledLinux,
  setAutostartLinux,
  type AutostartContext,
} from './main/autostart.js';

// ─── Paths ───────────────────────────────────────────────────────────
// __dirname at runtime is `<app>/dist-ts/`. Assets live one level up in
// `<app>/build/` and `<app>/dist-ts/preload.js`.
const ASSET_DIR = path.join(__dirname, '..', 'build');
const ICON_PATH = path.join(ASSET_DIR, 'icon.png');
const TRAY_PLAIN_PATH = path.join(ASSET_DIR, 'tray-plain.png');
const TRAY_DOT_PATH = path.join(ASSET_DIR, 'tray-dot.png');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');

const zoomStateFile = (): string =>
  path.join(app.getPath('userData'), 'zoom.json');

// ─── Logging ─────────────────────────────────────────────────────────

const LOG_PREFIX = '[instagram-messenger]';
const log = (...args: unknown[]): void => { console.log(LOG_PREFIX, ...args); };
const warn = (...args: unknown[]): void => { console.warn(LOG_PREFIX, ...args); };

// ─── Early config (must run before `ready`) ─────────────────────────

// Wayland global-shortcut support via xdg-desktop-portal (Linux only)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');
}

app.setName(APP_NAME);

// Windows: set AppUserModelID so notifications attribute to our app
if (process.platform === 'win32') {
  try { app.setAppUserModelId(APP_ID); } catch { /* noop */ }
}

// ─── State ───────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let hasUnread = false;
let isQuitting = false;
const startHidden = process.argv.includes('--hidden');

// Cached nativeImage instances for the tray — avoid re-reading PNGs from disk
// on every badge state change.
let trayImgPlain: NativeImage | null = null;
let trayImgDot: NativeImage | null = null;
let notificationIcon: NativeImage | null = null;

// ─── Window helpers (used by tray, hotkey, notification, IPC) ───────

function showMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
}

// ─── Single-instance lock (packaged only) ───────────────────────────

if (app.isPackaged) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    log('another instance is already running — quitting');
    app.quit();
  } else {
    app.on('second-instance', showMainWindow);
  }
} else {
  log('dev mode — skipping single-instance lock');
}

// ─── Autostart wiring ────────────────────────────────────────────────

function autostartContext(): AutostartContext {
  return {
    homeDir: os.homedir(),
    iconPath: ICON_PATH,
    execPath: process.env['APPIMAGE'] ?? process.execPath,
  };
}

function isAutostartEnabled(): boolean {
  try {
    if (process.platform === 'linux') {
      return isAutostartEnabledLinux(os.homedir());
    }
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

function setAutostart(enabled: boolean): boolean {
  try {
    if (process.platform === 'linux') {
      const ok = setAutostartLinux(enabled, autostartContext());
      log(`autostart ${enabled ? 'enabled' : 'disabled'} (xdg)`);
      return ok;
    }
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
    log(`autostart ${enabled ? 'enabled' : 'disabled'} (native)`);
    return true;
  } catch (e) {
    warn('autostart toggle failed:', (e as Error).message);
    return false;
  }
}

// ─── Badge state (tray + platform overlays) ─────────────────────────

function setBadgeState(unread: boolean): void {
  if (unread === hasUnread) return; // avoid redundant native calls
  hasUnread = unread;

  try {
    if (tray) {
      tray.setImage((unread ? trayImgDot : trayImgPlain) ?? trayImgPlain!);
    }
  } catch (e) {
    warn('tray image swap failed:', (e as Error).message);
  }

  try {
    if (process.platform === 'win32' && mainWindow) {
      if (unread) {
        const overlay = nativeImage.createFromPath(TRAY_DOT_PATH);
        mainWindow.setOverlayIcon(overlay, 'Unread');
      } else {
        mainWindow.setOverlayIcon(null, '');
      }
    }
  } catch (e) {
    warn('setOverlayIcon failed:', (e as Error).message);
  }

  try {
    if (process.platform === 'darwin') {
      app.setBadgeCount(unread ? 1 : 0);
    }
  } catch (e) {
    warn('setBadgeCount failed:', (e as Error).message);
  }
}

// ─── Window ──────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff',
    autoHideMenuBar: true,
    icon: ICON_PATH,
    show: !startHidden,
    webPreferences: {
      partition: SESSION_PARTITION,
      preload: PRELOAD_PATH,
      contextIsolation: true,
      // sandbox:false is required so the preload can use require('electron').ipcRenderer.
      // This is an IPC-only preload that does not expose anything to the page.
      sandbox: false,
      spellcheck: true,
    },
  });

  try {
    win.webContents.session.setSpellCheckerLanguages(['en-US']);
  } catch (e) {
    warn('spell-checker language set failed:', (e as Error).message);
  }

  // Preserve original UA behavior on the full session (incl. subresources)
  win.webContents.setUserAgent(DESKTOP_UA);
  void win.loadURL(START_URL, { userAgent: DESKTOP_UA });

  // Restore persisted zoom after the page finishes loading
  win.webContents.on('did-finish-load', () => {
    const z = loadZoom(zoomStateFile());
    if (z !== 0) {
      try { win.webContents.setZoomLevel(z); } catch { /* ignore */ }
    }
  });

  // Persist any zoom change (Ctrl+scroll too, not just menu accelerators)
  win.webContents.on('zoom-changed', (_e, direction) => {
    const current = win.webContents.getZoomLevel();
    const next =
      direction === 'in'
        ? Math.min(ZOOM_MAX, current + ZOOM_STEP)
        : Math.max(ZOOM_MIN, current - ZOOM_STEP);
    win.webContents.setZoomLevel(next);
    saveZoom(zoomStateFile(), next);
  });

  // Keep the window title stable — don't let Instagram overwrite it.
  win.on('page-title-updated', (e) => e.preventDefault());

  // CSS injection on dom-ready (robust under contextIsolation)
  win.webContents.on('dom-ready', () => {
    void win.webContents
      .insertCSS('[data-testid="install-app-banner"]{display:none !important;}')
      .catch((e: Error) => warn('insertCSS failed:', e.message));
  });

  // External links → system browser (PRESERVED from original)
  win.webContents.setWindowOpenHandler((details: HandlerDetails) => {
    try {
      const host = new URL(details.url).hostname;
      if (host.endsWith('instagram.com')) return { action: 'allow' };
    } catch { /* malformed URL → fall through */ }
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const host = new URL(url).hostname;
      if (!host.endsWith('instagram.com')) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch { /* ignore */ }
  });

  win.webContents.on('did-fail-load', (_e, code, desc, failedURL) => {
    warn(`load failed ${code} ${desc} ${failedURL}`);
  });

  // Focus → clear badge
  win.on('focus', () => {
    if (hasUnread) setBadgeState(false);
  });

  // Close → hide to tray instead of quit
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  return win;
}

// ─── Tray ────────────────────────────────────────────────────────────

function createTray(): void {
  try {
    trayImgPlain = nativeImage.createFromPath(TRAY_PLAIN_PATH);
    trayImgDot = nativeImage.createFromPath(TRAY_DOT_PATH);
    tray = new Tray(trayImgPlain);
    tray.setToolTip(APP_NAME);

    const template: MenuItemConstructorOptions[] = [
      { label: 'Show / Hide', click: toggleMainWindow },
    ];

    if (app.isPackaged) {
      template.push({
        label: 'Launch at login',
        type: 'checkbox',
        checked: isAutostartEnabled(),
        click: (item) => {
          const ok = setAutostart(item.checked);
          if (!ok) item.checked = !item.checked; // revert on failure
        },
      });
    }

    template.push({ type: 'separator' });
    template.push({
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    });

    tray.setContextMenu(Menu.buildFromTemplate(template));
    tray.on('click', toggleMainWindow);

    log('tray created');
  } catch (e) {
    warn('tray creation failed:', (e as Error).message);
  }
}

// ─── Global hotkey ───────────────────────────────────────────────────

function registerShortcuts(): void {
  try {
    const ok = globalShortcut.register(GLOBAL_HOTKEY, () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    if (ok) log(`global hotkey registered: ${GLOBAL_HOTKEY}`);
    else warn(`global hotkey ${GLOBAL_HOTKEY} failed to register (Wayland without portal?)`);
  } catch (e) {
    warn('globalShortcut exception:', (e as Error).message);
  }
}

// ─── Hidden app menu (for keyboard accelerators) ────────────────────

function setupAcceleratorsMenu(win: BrowserWindow): void {
  const applyZoom = (z: number): void => {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    win.webContents.setZoomLevel(clamped);
    saveZoom(zoomStateFile(), clamped);
  };
  const zoomIn = (): void => applyZoom(win.webContents.getZoomLevel() + ZOOM_STEP);
  const zoomOut = (): void => applyZoom(win.webContents.getZoomLevel() - ZOOM_STEP);
  const zoomReset = (): void => applyZoom(0);

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CommandOrControl+=', click: zoomIn },
        { label: 'Zoom In', accelerator: 'CommandOrControl+Plus', click: zoomIn },
        { label: 'Zoom Out', accelerator: 'CommandOrControl+-', click: zoomOut },
        { label: 'Reset Zoom', accelerator: 'CommandOrControl+0', click: zoomReset },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC from preload ────────────────────────────────────────────────

function setupIpc(): void {
  ipcMain.on(IPC_DM_ACTIVITY, (_event: IpcMainEvent) => {
    if (!mainWindow) return;
    const focused = mainWindow.isFocused() && mainWindow.isVisible();
    if (focused) return; // no badge/notification when user is already looking

    setBadgeState(true);

    try {
      if (!notificationIcon) {
        notificationIcon = nativeImage.createFromPath(ICON_PATH);
      }
      const n = new Notification({
        title: APP_NAME,
        body: 'New Instagram Direct activity',
        icon: notificationIcon,
        silent: false,
      });
      n.on('click', showMainWindow);
      n.show();
    } catch (e) {
      warn('notification failed:', (e as Error).message);
    }
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────

app
  .whenReady()
  .then(() => {
    setupIpc();
    mainWindow = createWindow();
    setupAcceleratorsMenu(mainWindow);
    createTray();
    registerShortcuts();
  })
  .catch((e: unknown) => {
    warn('startup failed:', e instanceof Error ? e.stack ?? e.message : String(e));
  });

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch { /* ignore */ }
});

// Stay alive in the tray when the window is closed.
// On macOS we follow the platform convention and let Cmd+Q quit normally.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
    setupAcceleratorsMenu(mainWindow);
  } else {
    showMainWindow();
  }
});
