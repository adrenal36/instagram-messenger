// main.js — Instagram Messenger (Electron cross-platform wrapper)
//
// Surgical upgrade of the original 60-line webview wrapper.
// Preserved behavior: desktop UA, persistent session partition, external-link
// handoff to system browser. Everything new is added in try/catch so one
// failing feature can't take down the app.

const {
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
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Constants ────────────────────────────────────────────────────────

// Real Chrome desktop UA so Instagram serves the full web experience
const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Safari/537.36';

const START_URL = 'https://www.instagram.com/direct/inbox/';
const APP_NAME = 'Instagram Messenger';
const APP_ID = 'badwolf.ro.instagram-messenger';
const GLOBAL_HOTKEY = 'CommandOrControl+Shift+M';
const SESSION_PARTITION = 'persist:instagram';
const IPC_DM_ACTIVITY = 'dm-activity';

const ZOOM_MIN = -3;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

const ICON_PATH = path.join(__dirname, 'build', 'icon.png');
const TRAY_PLAIN_PATH = path.join(__dirname, 'build', 'tray-plain.png');
const TRAY_DOT_PATH = path.join(__dirname, 'build', 'tray-dot.png');

const zoomStateFile = () =>
  path.join(app.getPath('userData'), 'zoom.json');

// ─── Logging ─────────────────────────────────────────────────────────

const LOG_PREFIX = '[instagram-messenger]';
const log = (...args) => console.log(LOG_PREFIX, ...args);
const warn = (...args) => console.warn(LOG_PREFIX, ...args);

// ─── Early config (must run before `ready`) ─────────────────────────

// Wayland global-shortcut support via xdg-desktop-portal (Linux only)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');
}

app.setName(APP_NAME);

// Windows: set AppUserModelID so notifications attribute to our app
if (process.platform === 'win32') {
  try { app.setAppUserModelId(APP_ID); } catch (_) { /* noop */ }
}

// ─── State ───────────────────────────────────────────────────────────

let mainWindow = null;
let tray = null;
let hasUnread = false;
let isQuitting = false;
const startHidden = process.argv.includes('--hidden');

// Cached nativeImage instances for the tray — avoid re-reading PNGs from disk
// on every badge state change.
let trayImgPlain = null;
let trayImgDot = null;

// ─── Window helpers (used by tray, hotkey, notification, IPC) ───────

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow() {
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

// ─── Zoom persistence ────────────────────────────────────────────────

function loadZoom() {
  try {
    const raw = fs.readFileSync(zoomStateFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed.zoom === 'number' ? parsed.zoom : 0;
  } catch (_) {
    return 0;
  }
}

function saveZoom(zoom) {
  try {
    fs.mkdirSync(path.dirname(zoomStateFile()), { recursive: true });
    fs.writeFileSync(zoomStateFile(), JSON.stringify({ zoom }));
  } catch (e) {
    warn('failed to persist zoom:', e.message);
  }
}

// ─── Autostart (cross-platform) ─────────────────────────────────────

function autostartDesktopFilePath() {
  return path.join(
    os.homedir(),
    '.config',
    'autostart',
    'instagram-messenger.desktop'
  );
}

function isAutostartEnabled() {
  try {
    if (process.platform === 'linux') {
      return fs.existsSync(autostartDesktopFilePath());
    }
    return app.getLoginItemSettings().openAtLogin === true;
  } catch (_) {
    return false;
  }
}

function setAutostart(enabled) {
  try {
    if (process.platform === 'linux') {
      const file = autostartDesktopFilePath();
      if (enabled) {
        const execPath = process.env.APPIMAGE || process.execPath;
        const content =
          '[Desktop Entry]\n' +
          'Type=Application\n' +
          'Version=1.0\n' +
          `Name=${APP_NAME}\n` +
          'Comment=Desktop wrapper for Instagram Direct\n' +
          `Exec=${execPath} --hidden\n` +
          `Icon=${ICON_PATH}\n` +
          'Terminal=false\n' +
          'Categories=Network;InstantMessaging;Chat;\n' +
          'X-GNOME-Autostart-enabled=true\n' +
          'StartupWMClass=instagram-messenger\n';
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
        log('autostart enabled →', file);
      } else if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        log('autostart disabled');
      }
    } else {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        args: ['--hidden'],
      });
      log(`autostart ${enabled ? 'enabled' : 'disabled'} (native)`);
    }
    return true;
  } catch (e) {
    warn('autostart toggle failed:', e.message);
    return false;
  }
}

// ─── Badge state (tray + platform overlays) ─────────────────────────

function setBadgeState(unread) {
  if (unread === hasUnread) return; // avoid redundant native calls
  hasUnread = unread;

  try {
    if (tray) {
      tray.setImage(unread ? trayImgDot : trayImgPlain);
    }
  } catch (e) {
    warn('tray image swap failed:', e.message);
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
    warn('setOverlayIcon failed:', e.message);
  }

  try {
    if (process.platform === 'darwin') {
      app.setBadgeCount(unread ? 1 : 0);
    }
  } catch (e) {
    warn('setBadgeCount failed:', e.message);
  }
}

// ─── Window ──────────────────────────────────────────────────────────

function createWindow() {
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      // sandbox: false is required so the preload can use require('electron').ipcRenderer.
      // This is an IPC-only preload that does not expose anything to the page.
      sandbox: false,
      spellcheck: true,
    },
  });

  try {
    win.webContents.session.setSpellCheckerLanguages(['en-US']);
  } catch (e) {
    warn('spell-checker language set failed:', e.message);
  }

  // Preserve original UA behavior on the full session (incl. subresources)
  win.webContents.setUserAgent(DESKTOP_UA);
  win.loadURL(START_URL, { userAgent: DESKTOP_UA });

  // Restore persisted zoom after the page finishes loading
  win.webContents.on('did-finish-load', () => {
    const z = loadZoom();
    if (z !== 0) {
      try { win.webContents.setZoomLevel(z); } catch (_) {}
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
    saveZoom(next);
  });

  // Keep the window title stable — don't let Instagram overwrite it.
  // (Initial title is set via BrowserWindow `title:` option above.)
  win.on('page-title-updated', (e) => e.preventDefault());

  // CSS injection on dom-ready (robust under contextIsolation)
  win.webContents.on('dom-ready', () => {
    try {
      win.webContents.insertCSS(
        '[data-testid="install-app-banner"]{display:none !important;}'
      );
    } catch (e) {
      warn('insertCSS failed:', e.message);
    }
  });

  // External links → system browser (PRESERVED from original)
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const host = new URL(url).hostname;
      if (host.endsWith('instagram.com')) return { action: 'allow' };
    } catch (_) { /* malformed URL → fall through */ }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const host = new URL(url).hostname;
      if (!host.endsWith('instagram.com')) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch (_) { /* ignore */ }
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

function createTray() {
  try {
    trayImgPlain = nativeImage.createFromPath(TRAY_PLAIN_PATH);
    trayImgDot = nativeImage.createFromPath(TRAY_DOT_PATH);
    tray = new Tray(trayImgPlain);
    tray.setToolTip(APP_NAME);

    const template = [
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
    warn('tray creation failed:', e.message);
  }
}

// ─── Global hotkey ───────────────────────────────────────────────────

function registerShortcuts() {
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
    warn('globalShortcut exception:', e.message);
  }
}

// ─── Hidden app menu (for keyboard accelerators) ────────────────────

function setupAcceleratorsMenu(win) {
  const applyZoom = (z) => {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    win.webContents.setZoomLevel(clamped);
    saveZoom(clamped);
  };
  const zoomIn = () => applyZoom(win.webContents.getZoomLevel() + ZOOM_STEP);
  const zoomOut = () => applyZoom(win.webContents.getZoomLevel() - ZOOM_STEP);
  const zoomReset = () => applyZoom(0);

  const template = [
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

// Notification icon cached — avoid re-reading the PNG on every activity event
let notificationIcon = null;

function setupIpc() {
  ipcMain.on(IPC_DM_ACTIVITY, () => {
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
      warn('notification failed:', e.message);
    }
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────

app.whenReady().then(() => {
  setupIpc();
  mainWindow = createWindow();
  setupAcceleratorsMenu(mainWindow);
  createTray();
  registerShortcuts();
}).catch((e) => {
  warn('startup failed:', e && e.stack || e);
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch (_) {}
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
