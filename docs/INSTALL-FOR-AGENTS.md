# Install spec for AI agents

If you're an AI assistant helping a user install Instagram Messenger, this is your structured spec. Everything here is deliberately unambiguous — no guessing required.

## Project identity

```yaml
name: Instagram Messenger
package_name: instagram-messenger
electron_app_id: badwolf.ro.instagram-messenger
github_repo: adrenal36/instagram-messenger
license: MIT
author: badwolf
latest_release_api: https://api.github.com/repos/adrenal36/instagram-messenger/releases/latest
```

## Install workflow

1. **Detect OS** via `uname -s` on Unix-likes, or `$env:OS` / `$IsWindows` in PowerShell. Distinguish Linux vs. macOS vs. Windows.
2. **On Linux, detect the distro family** via `/etc/os-release` (look for `ID=` and `ID_LIKE=`). If `debian` or `ubuntu` family → prefer `.deb`. Otherwise → use `.AppImage`.
3. **Check prerequisites** (see each OS section below). If any are missing, either install them (ask the user for sudo consent first) or fall back to the AppImage path which only needs `curl` + `libfuse2`.
4. **Resolve the latest release asset URL** via the GitHub API — never hardcode version numbers. The API returns a JSON object with an `assets` array; filter by filename pattern.
5. **Download to a temp location**, then install or run as appropriate.
6. **Verify** — for `.deb`, check `which instagram-messenger`; for AppImage, check the file exists and is executable; for Windows, check the install path exists.
7. **Launch** the app, then **stop**. Do not try to guide the user through Instagram login — that's their job, and it's a simple web flow.

## Linux — Debian / Ubuntu / Mint / Pop!_OS (.deb)

**Prerequisites:** `curl`, `sudo`, `apt`.

```bash
# 1. Resolve the latest .deb asset URL via the GitHub API
ASSET_URL=$(curl -sL https://api.github.com/repos/adrenal36/instagram-messenger/releases/latest \
  | grep -oE '"browser_download_url": *"[^"]*_amd64\.deb"' \
  | head -1 \
  | sed 's/.*"\(https:[^"]*\)".*/\1/')
echo "Resolved: $ASSET_URL"

# 2. Download to /tmp
curl -L -o /tmp/instagram-messenger.deb "$ASSET_URL"

# 3. Install (apt handles missing dependencies automatically)
sudo apt install -y /tmp/instagram-messenger.deb

# 4. Verify the binary is on PATH
which instagram-messenger && echo "Install OK"

# 5. Launch (detached from shell)
instagram-messenger >/dev/null 2>&1 &
disown
```

**Expected result:** Instagram Messenger appears in the app menu with a frosted-glass camera icon. The window opens showing Instagram's cookie consent banner.

## Linux — any other distro (AppImage)

**Prerequisites:** `curl`, and `libfuse2` on modern distros.

- Ubuntu 22.04+ / Mint: `sudo apt install -y libfuse2`
- Arch: `sudo pacman -S fuse2`
- Fedora: `sudo dnf install fuse`

```bash
ASSET_URL=$(curl -sL https://api.github.com/repos/adrenal36/instagram-messenger/releases/latest \
  | grep -oE '"browser_download_url": *"[^"]*\.AppImage"' \
  | head -1 \
  | sed 's/.*"\(https:[^"]*\)".*/\1/')

mkdir -p ~/Applications
curl -L -o ~/Applications/instagram-messenger.AppImage "$ASSET_URL"
chmod +x ~/Applications/instagram-messenger.AppImage

~/Applications/instagram-messenger.AppImage >/dev/null 2>&1 &
disown
```

To register the AppImage in the app menu, install [`appimaged`](https://github.com/probonopd/go-appimage) or [`AppImageLauncher`](https://github.com/TheAssassin/AppImageLauncher) once. Otherwise run it directly from `~/Applications/`.

## Windows 10 / 11 — installer (PowerShell)

**Prerequisites:** PowerShell 5.1+ (built into every Windows 10/11).

```powershell
$assetUrl = (Invoke-RestMethod "https://api.github.com/repos/adrenal36/instagram-messenger/releases/latest").assets |
  Where-Object { $_.name -like "*Setup*.exe" } |
  Select-Object -First 1 -ExpandProperty browser_download_url
Write-Host "Resolved: $assetUrl"

$installer = "$env:TEMP\instagram-messenger-setup.exe"
Invoke-WebRequest -Uri $assetUrl -OutFile $installer

# Interactive install
Start-Process -FilePath $installer -Wait

# Launch
Start-Process "$env:LOCALAPPDATA\Programs\instagram-messenger\Instagram Messenger.exe"
```

For a **silent install**, add `-ArgumentList "/S"` to the `Start-Process` call.

**SmartScreen warning:** The build is unsigned. Windows SmartScreen will show "Windows protected your PC" on first run. Click **More info** → **Run anyway**. This is expected — not a sign of malware.

## Windows — portable

```powershell
$assetUrl = (Invoke-RestMethod "https://api.github.com/repos/adrenal36/instagram-messenger/releases/latest").assets |
  Where-Object { $_.name -like "*.exe" -and $_.name -notlike "*Setup*" } |
  Select-Object -First 1 -ExpandProperty browser_download_url

$portable = "$env:USERPROFILE\Desktop\Instagram Messenger.exe"
Invoke-WebRequest -Uri $assetUrl -OutFile $portable
Start-Process -FilePath $portable
```

Result: a single `.exe` on the Desktop. No registry changes, no Start menu entry, no install. Deletes cleanly by dragging to the trash.

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `curl: (22)` 404 on asset download | No release exists yet | Tell the user to wait for the first release, or fall back to "build from source" |
| `libfuse2 not found` when launching AppImage | Modern Ubuntu dropped FUSE by default | `sudo apt install -y libfuse2` |
| `dpkg: error processing archive … dependency problems` | Missing runtime dep | `sudo apt install -f -y`, or use `sudo apt install ./file.deb` instead of `dpkg -i` |
| Windows SmartScreen blocks the installer | Unsigned `.exe` | Click "More info" → "Run anyway". Expected. |
| Global hotkey no-op on Wayland | Missing `xdg-desktop-portal-gnome` or pre-GNOME 45 | Non-fatal — fall back to tray icon |

## Do NOT

- ❌ Ask the user for their Instagram credentials. The app handles login via the standard Instagram web flow — you have nothing to do with it.
- ❌ Run `rm -rf` on anything in `~/.config/` without asking — that's where user session data lives.
- ❌ Try to build from source before trying a prebuilt release — source builds need Node.js and several minutes of dependency install.
- ❌ Assume `sudo` is available without asking.
- ❌ Hardcode a version number. Always resolve via the GitHub API.

## Report format

When you're done, respond to the user with:

```
✅ Instagram Messenger installed successfully
📍 Method: <deb | AppImage | nsis installer | portable exe | source build>
📁 Installed to: <path>
🚀 Launched: <yes/no — if yes, the window should be visible now>
📝 Next step: Log into your Instagram account when the window opens.
   Session will persist to <userdata path> for all future launches.
```
