# Instagram Messenger

A minimal Electron desktop wrapper for Instagram Direct — because a browser tab isn't an app.

Cross-platform (Linux + Windows) with system tray, native notifications, global hotkey, single-instance lock, autostart, and zoom persistence. Built as a surgical upgrade on top of a 60-line webview wrapper — every bit of OS integration is added on top of the real Instagram web UI, not a reimplementation.

> ⚠️ **Unofficial.** Not affiliated with, endorsed by, or related to Meta / Instagram. This is a personal convenience tool that loads `instagram.com/direct/inbox/` in a dedicated Electron window.

## Features

- **System tray** — closes to tray instead of quitting; left-click to toggle, right-click for menu
- **Global hotkey** — `Ctrl+Shift+M` (or `Cmd+Shift+M`) summons and hides the window from anywhere
- **Desktop notifications** — fires when new Direct activity arrives while the window isn't focused
- **Tray dot badge** — tray icon swaps to a red-dot variant on new activity, clears on focus
- **Windows taskbar overlay** — native overlay icon on Windows for the taskbar badge
- **Single-instance lock** — second launch of the packaged app just focuses the existing window (dev mode is exempt so `npm start` keeps working)
- **Autostart toggle** — tray menu checkbox; writes an XDG `.desktop` file on Linux, uses `setLoginItemSettings` on Windows/macOS
- **Zoom persistence** — `Ctrl+=` / `Ctrl+-` / `Ctrl+0` and `Ctrl+scroll`, all remembered across launches
- **Spell check** — en-US default
- **Dark first paint** — hardcoded dark background so there's no white flash before Instagram loads
- **CSS + JS injection** — auto-hides the "install the Instagram app" banner when present
- **Packaged installers** — AppImage + `.deb` for Linux, `.zip` for Windows (via `electron-builder`)

## Install

### Linux

**AppImage** (portable, no install):

```bash
chmod +x "Instagram Messenger-0.2.0.AppImage"
./Instagram\ Messenger-0.2.0.AppImage
```

**Debian / Ubuntu** (`.deb`):

```bash
sudo dpkg -i instagram-messenger_0.2.0_amd64.deb
```

The `.deb` install registers it in your app menu with the icon, so you can launch it like any other desktop app.

### Windows

Download `instagram-messenger-win-x64.zip`, extract it, and run `Instagram Messenger.exe` from the extracted folder. No installer required.

> If Windows SmartScreen blocks it, click "More info" → "Run anyway". The build is unsigned — a proper code-signing certificate costs ~$100/yr and isn't worth it for a personal wrapper.

### Build from source

```bash
git clone https://github.com/adrenal36/instagram-messenger.git
cd instagram-messenger
npm install
npm start                 # dev mode
npm run dist:linux        # produces AppImage + .deb in dist/
npm run dist:win          # produces Windows zip in dist/ (see note below)
```

**Note on Windows cross-compile from Linux:** `electron-builder` runs `winCodeSign` (an rcedit step for icon metadata) through Wine. If you don't have Wine installed, the build fails at the signing step but `dist/win-unpacked/` still contains a fully functional Windows `.exe` — you can zip it manually, or `sudo apt install wine` and retry for an installer with proper icon metadata. **For official releases, CI handles this natively on a Windows runner** (see below), so this is only a concern for local builds.

## Releases (automated via GitHub Actions)

Official releases are built by `.github/workflows/release.yml` — parallel jobs on `ubuntu-latest` and `windows-latest` produce all platform artifacts natively (no Wine needed on the Windows runner, so the `.exe` gets proper icon metadata via rcedit) and upload them to a **draft** GitHub Release.

**To cut a new release:**

```bash
# 1. Bump version in package.json (e.g. 0.2.0 → 0.2.1)
# 2. Commit the bump
git add package.json
git commit -m "Bump to v0.2.1"
git push

# 3. Tag and push the tag — this triggers the release workflow
git tag v0.2.1
git push origin v0.2.1
```

Within ~5 minutes, a new draft release appears at [`/releases`](https://github.com/adrenal36/instagram-messenger/releases) with the AppImage, `.deb`, nsis installer, and portable `.exe` all attached. Review the draft in the GitHub UI, then click **Publish release** to make it public. The manual publish step is intentional — it's a safety net so a broken CI build can never silently ship to users.

You can also trigger the workflow manually from the **Actions** tab via "Run workflow" if you need to rebuild an existing tag.

## Usage

On first launch you'll see Instagram's cookie consent and login screen. Accept the cookies and log in — your session is persisted to the `persist:instagram` partition in `~/.config/Instagram Messenger/` (Linux) or the equivalent userData path on Windows, so every subsequent launch skips straight to your inbox.

Close the window and the app keeps running in the tray. Right-click the tray icon for:

- **Show / Hide** — toggle the window
- **Launch at login** — (packaged builds only) toggle autostart via XDG or native login items
- **Quit** — actually exit the app

## Known limitations

These are honest engineering tradeoffs, not bugs:

1. **Notification precision is best-effort.** Instagram's web client suppresses the nav unread badge when you're already on the inbox URL, so the preload observes the thread-list container and signals on any structural mutation (new message bumps a thread to the top of the list). You'll get notified when activity happens — you won't get a precise unread count. Refining this precisely would require reverse-engineering Instagram's React internals, which would break every time Meta changes their DOM.

2. **CSS selectors bit-rot.** Instagram's class names are hashed and rotate, so the install-banner hider uses text-content matching (`innerText.includes('install the instagram app')`) against semantically-scoped selectors (`[role="dialog"]`, `[role="alert"]`, etc.). This is as resilient as it gets without access to private APIs, but it may still miss future banner variants.

3. **Wayland global shortcut** requires `xdg-desktop-portal-gnome` + GNOME 45+ (or an equivalent portal backend). If the portal isn't available, `globalShortcut.register()` silently fails and the hotkey becomes a no-op — use the tray icon instead. X11 sessions are unaffected.

4. **No macOS build yet.** Everything in the code is macOS-ready (dock badge via `setBadgeCount`, native `setLoginItemSettings`, `Cmd+` accelerators) but `electron-builder` cross-compilation to a signed `.dmg` from Linux isn't viable — you'd need to build on a Mac with an Apple Developer certificate. PRs welcome.

5. **Single-instance lock + dev mode.** The lock is intentionally skipped when `!app.isPackaged` so you can run `npm start` while the installed AppImage is also in the tray — otherwise the dev workflow would break.

## Security / Privacy

- **No telemetry.** No analytics, no crash reporting, no remote logging. The only network traffic this app generates is Instagram itself loading in the webview.
- **No reverse-engineered APIs.** This is a pure webview wrapper. All authentication, all data, all session state is whatever Instagram's web client does — the wrapper adds zero attack surface of its own.
- **Session storage** lives in the standard Electron userData path (`~/.config/Instagram Messenger/` on Linux), keyed by `appId`. It's the same kind of persistence Chrome uses for instagram.com.
- **No credentials in the repo.** Log in through the normal Instagram web flow on first launch.

## Architecture

Two files do the heavy lifting:

- **`main.js`** — Electron main process. Creates the window (with original UA spoof, persistent partition, and external-link handoff all preserved from the 60-line original), the tray, the hidden app menu for keyboard accelerators, the single-instance lock, the autostart helpers, and the IPC handler that fires notifications + badge swaps in response to preload events.
- **`preload.js`** — runs in the Instagram page context with `contextIsolation: true` and `sandbox: false`. Attaches a narrow, debounced `MutationObserver` to the thread-list container (direct children only, not subtree — React churn would saturate the callback otherwise). Also runs a bounded text-content scan for install banners that self-terminates after 5 consecutive empty scans.

The original `main.js.bak` (60 lines) is not included in the repo — it's kept locally as a rollback safety net.

## Why not just `nativefier` or one of the existing Electron wrappers?

Tried that path first. [`igdmapps/igdm`](https://github.com/igdmapps/igdm) reimplements the UI via `instagram-private-api` which carries ban risk and has been stale since 2022. Generic wrappers like Nativefier give you a browser-chrome-less window but none of the OS integration that makes a desktop app feel like an app — tray, notifications, badges, single instance, global hotkey, autostart. This repo is the "OS integration on top of the real Instagram web" path, which is the tradeoff I wanted.

## License

[MIT](./LICENSE) — do whatever you want with this, just keep the copyright notice and don't sue me if it breaks.

© 2026 badwolf
