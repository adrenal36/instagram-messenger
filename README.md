<div align="center">

![Instagram Messenger — Desktop wrapper for Instagram Direct](./.github/hero.jpg)

# Instagram Messenger

**A polished Electron desktop wrapper for Instagram Direct — tray, notifications, global hotkey, autostart.**

[![License: MIT](https://img.shields.io/github/license/adrenal36/instagram-messenger?color=f0b840&labelColor=152332&style=for-the-badge&cacheSeconds=300)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-00505f?labelColor=152332&style=for-the-badge)](#install)
[![Release](https://img.shields.io/github/v/release/adrenal36/instagram-messenger?include_prereleases&color=f0b840&labelColor=152332&style=for-the-badge&cacheSeconds=300)](https://github.com/adrenal36/instagram-messenger/releases)
[![Downloads](https://img.shields.io/github/downloads/adrenal36/instagram-messenger/total?color=00505f&labelColor=152332&style=for-the-badge&cacheSeconds=300)](https://github.com/adrenal36/instagram-messenger/releases)

</div>

---

> [!WARNING]
> **Unofficial.** Not affiliated with, endorsed by, or related to Meta / Instagram. This is a personal convenience wrapper that loads `instagram.com/direct/inbox/` in a dedicated Electron window.

## What is this

Instagram Direct, but as a real desktop app. It runs the regular web UI inside an Electron window with proper OS integration on top — system tray, global hotkey, notifications, autostart, zoom persistence, single-instance lock. No reverse-engineered APIs, no ban risk, no fiddling.

## Install

Grab the file that matches your system from the [**Releases page**](https://github.com/adrenal36/instagram-messenger/releases/latest), then follow the steps below for your OS.

### 🐧 Linux — Debian / Ubuntu / Mint / Pop!_OS (`.deb`)

Best choice if you're on a Debian-family distro: registers in your app menu, handles dependencies automatically, one command to install.

1. Download **`instagram-messenger_0.3.0_amd64.deb`** from [Releases](https://github.com/adrenal36/instagram-messenger/releases/latest).
2. Install it with `apt`:
   ```bash
   sudo apt install ./instagram-messenger_0.3.0_amd64.deb
   ```
3. Launch it from your application menu, or from a terminal:
   ```bash
   instagram-messenger
   ```

To uninstall later: `sudo apt remove instagram-messenger`.

### 🐧 Linux — any other distro (AppImage)

Works on Arch, Fedora, openSUSE, NixOS, and any distro. One portable file, no install.

1. Install FUSE (one-time, if you don't already have it):
   - **Ubuntu 22.04+ / Mint:** `sudo apt install -y libfuse2`
   - **Arch:** `sudo pacman -S fuse2`
   - **Fedora:** `sudo dnf install fuse`
2. Download **`Instagram-Messenger-0.3.0.AppImage`** from [Releases](https://github.com/adrenal36/instagram-messenger/releases/latest).
3. Make it executable and run it:
   ```bash
   chmod +x Instagram-Messenger-0.3.0.AppImage
   ./Instagram-Messenger-0.3.0.AppImage
   ```

Move the AppImage wherever you want — `~/Applications/` is the conventional per-user location. To register it in your app menu automatically, install [`AppImageLauncher`](https://github.com/TheAssassin/AppImageLauncher) once.

### 🪟 Windows 10 / 11 — installer (recommended)

1. Download **`Instagram-Messenger-Setup-0.3.0.exe`** from [Releases](https://github.com/adrenal36/instagram-messenger/releases/latest).
2. Double-click the installer.
3. **Windows SmartScreen will warn you** that it doesn't recognize the app. This is expected — the build is unsigned (code-signing certs cost ~$100/year and aren't worth it for a personal wrapper). Click **More info** → **Run anyway**.
4. Follow the installer wizard. Instagram Messenger will be added to your Start menu.
5. Launch it from the Start menu.

To uninstall later: Settings → Apps → Installed apps → Instagram Messenger → Uninstall.

### 🪟 Windows — portable (no install)

Use this if you don't want anything touching the registry.

1. Download **`Instagram-Messenger-0.3.0.exe`** (the one **without** "Setup" in the name).
2. Copy it wherever you want it to live — Desktop, `Downloads/`, a USB stick, anywhere.
3. Double-click to run. Same SmartScreen step as above on the first launch: **More info** → **Run anyway**.

No registry changes, no Start menu entry. Delete the `.exe` to uninstall.

### 🍎 macOS

Not yet available — see [limitations](#known-limitations). PRs welcome from anyone with a Mac and an Apple Developer certificate.

### 🤖 Prefer to hand this to an AI assistant?

Paste this into Claude, ChatGPT, Gemini, or any capable coding AI:

> Please install Instagram Messenger for me. The structured install spec is at `https://github.com/adrenal36/instagram-messenger/blob/master/docs/INSTALL-FOR-AGENTS.md` — read it and follow the commands for my operating system.

The AI will detect your OS, pick the right asset, download it, install it, and launch the app. You'll just need to log into Instagram once when the window opens.

## First launch

1. The window opens to Instagram's cookie consent banner. Click **Allow all** (or "Only essential" — both work).
2. **Log in** via the normal web login flow.
3. Your session persists to `~/.config/Instagram Messenger/` on Linux, `%APPDATA%\Instagram Messenger\` on Windows.
4. Close the window — the app stays running in the **system tray**. Click the tray icon to bring it back.

## Features

- 🪟 **System tray** — closes to tray instead of quitting. Left-click to toggle, right-click for menu.
- ⌨️ **Global hotkey** — <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> summons or hides from anywhere.
- 🔔 **Desktop notifications** — fires on new Direct activity when the window isn't focused. Click to jump to the app.
- 🔴 **Tray badge + Windows taskbar overlay** — unread state surfaces via a red-dot tray variant and a native overlay icon on Windows.
- 🚀 **Autostart toggle** — tray-menu checkbox. XDG `.desktop` on Linux, native login-item on Windows.
- 🔍 **Zoom persistence** — <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>0</kbd> and <kbd>Ctrl</kbd>+<kbd>Scroll</kbd>, remembered across launches.
- 🔒 **Single-instance lock** — second launch focuses the existing window instead of spawning a duplicate.
- ✍️ **Spell check** — en-US by default.
- 🌑 **Dark first paint** — no white flash before Instagram loads.
- 🚫 **Install-banner hider** — auto-hides "Install the Instagram app" overlays.

## Keyboard shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Toggle window | **Global** |
| <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>+</kbd> | Zoom in (persisted) | Window |
| <kbd>Ctrl</kbd>+<kbd>-</kbd> | Zoom out (persisted) | Window |
| <kbd>Ctrl</kbd>+<kbd>0</kbd> | Reset zoom | Window |
| <kbd>Ctrl</kbd>+<kbd>Scroll</kbd> | Smooth zoom (persisted) | Window |
| <kbd>Ctrl</kbd>+<kbd>R</kbd> | Reload | Window |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> | Toggle DevTools | Window |

Plus standard text-editing shortcuts (<kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd>/<kbd>X</kbd>/<kbd>Z</kbd>/<kbd>A</kbd>).

## Known limitations

> [!IMPORTANT]
> **Notifications are best-effort, not a precise unread count.** Instagram's web client suppresses the unread badge when you're on the inbox URL, so the preload signals on any structural change to the thread list (a new message bumps a thread to the top). You'll get notified reliably — you won't get exact counts. Refining further would mean reverse-engineering Instagram's React internals, which breaks whenever Meta ships a change.

> [!NOTE]
> **Wayland global shortcut** requires `xdg-desktop-portal-gnome` (or equivalent) and GNOME 45+. Without the portal, `globalShortcut.register()` silently fails and the hotkey becomes a no-op — use the tray icon instead. X11 and Windows are unaffected.

> [!NOTE]
> **No macOS build.** The code is macOS-ready but cross-compiling a signed `.dmg` from Linux isn't viable. PRs welcome from anyone with a Mac and a dev certificate.

> [!NOTE]
> **No telemetry, no private APIs.** Everything is the normal Instagram web flow in an Electron window. The only outbound traffic is Instagram itself.

## License

[MIT](./LICENSE) — do whatever you want with this, just keep the copyright notice.

## Contributing / development docs

Development, architecture, and release docs live alongside the code:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev setup, tests, pull requests
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — how the pieces fit together
- [`docs/RELEASING.md`](./docs/RELEASING.md) — the CI/CD pipeline and how to cut a release
- [`docs/INSTALL-FOR-AGENTS.md`](./docs/INSTALL-FOR-AGENTS.md) — structured install spec for AI assistants

<div align="center">

**© 2026 badwolf**

</div>
