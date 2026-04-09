# Architecture

A short tour of what's in the repo and why. Target audience: anyone reading the code for the first time, or an AI auditor reviewing a PR.

## Runtime shape

Instagram Messenger is an Electron app. Electron runs two processes that matter:

- **Main process** (`src/main.ts`) — Node.js context. Owns the `BrowserWindow`, `Tray`, `globalShortcut`, IPC, notifications, autostart, single-instance lock, and lifecycle.
- **Preload script** (`src/preload.ts`) — runs in the Instagram page's renderer context with `contextIsolation: true` and `sandbox: false`. Detects new DM activity and hides the "install the app" banner.

Nothing is exposed to the page's JS world via `contextBridge` — the preload is IPC-only. The page sees a stock Chrome browser (courtesy of the UA spoof) and our preload quietly observes it.

## Source layout

```
src/
├── main.ts               # Electron main-process entry (thin glue)
├── preload.ts            # Runs in the Instagram page context (IPC-only)
├── main/
│   ├── zoom.ts           # load/save zoom level → JSON in userData
│   └── autostart.ts      # XDG .desktop file path, content, write/remove
├── preload/
│   ├── debounce.ts       # trailing-edge debouncer w/ cancel()
│   ├── thread-list.ts    # findThreadListContainer + hasStructuralMutation
│   └── banner.ts         # scoped install-banner hider (textContent, not innerText)
└── shared/
    └── constants.ts      # app ids, URLs, IPC channels, tuning constants

test/
├── main/*.test.ts        # node env (Vitest)
└── preload/*.test.ts     # jsdom env (Vitest)
```

Everything under `src/main/`, `src/preload/`, and `src/shared/` is pure — no Electron imports — and unit-tested. `src/main.ts` and `src/preload.ts` are thin glue that wires these helpers into Electron APIs.

## Why pure helpers + thin entry points

The split exists so regression tests could be written before the JS→TS migration. Pure helpers are testable with Vitest + jsdom; the Electron entry points can't be unit-tested cheaply but are now small enough to reason about by reading.

## Why `sandbox: false` in the preload

The preload uses `require('electron').ipcRenderer` directly to send activity signals to the main process. That requires `sandbox: false`. Nothing is exposed to the page — there's no `contextBridge.exposeInMainWorld` — so the attack surface is the same as a stock Electron app: a compromised Instagram page still can't escape the renderer sandbox Chromium provides.

## Why a `MutationObserver` instead of polling

Instagram's web client suppresses the inbox unread badge when you're on the inbox URL, so we can't read a DOM counter. Instead, the preload watches the thread-list container for `childList` mutations — a new message bumps a thread to the top, which surfaces as an `addedNodes`/`removedNodes` mutation. The observer is scoped to the immediate children (NOT subtree) because React re-renders inside thread rows (avatars, presence dots) would otherwise fire continuously and saturate the callback even with debounce.

Everything the observer catches is debounced through `src/preload/debounce.ts` and sent to the main process as a single `dm-activity` IPC event.

## Why `textContent` (not `innerText`) in the banner hider

`innerText` forces a layout/reflow. On a heavy React page this shows up as a visible stutter. `textContent` reads the raw string without touching the render tree. There's a regression test (`test/preload/banner.test.ts`) that tampers with `innerText` to throw if accessed — if anyone ever "fixes" this to `innerText`, that test blows up loudly.

## Icons (`build/`)

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 512×512 | Frosted-glass Instagram-evoking camera (Lucide MIT outline over a barycentric gradient — **not** the official Instagram logo) |
| `tray-plain.png` | 24×24 | Monochrome camera — tray idle state |
| `tray-dot.png` | 24×24 | Same + red notification dot — tray unread state |

The tray-dot swap is how we signal "unread" across platforms where `setBadgeCount` is broken (GNOME). On Windows we also call `setOverlayIcon` for the taskbar. On macOS we additionally call `setBadgeCount` for the dock. All three live in `setBadgeState()` in `src/main.ts`.

## `package.json` `build` block

electron-builder config. Key fields:

- `appId: badwolf.ro.instagram-messenger` — matches `APP_ID` in `src/shared/constants.ts`.
- `files`: `dist-ts/**` + static assets. The TypeScript sources (`src/**`) are **not** shipped.
- `asarUnpack: build/*.png` — so `nativeImage.createFromPath` can read the PNGs at runtime (asar-packed binary assets can't be read directly).
- `publish.provider: github` with `releaseType: draft` — every release starts as a draft for manual review before publishing.

See [`docs/RELEASING.md`](./RELEASING.md) for the actual release pipeline.

## Preserved behaviors from the original 60-line prototype

These are load-bearing and covered by the tests:

- **Desktop Chrome UA** — set on the whole session so subresources match.
- **`persist:instagram` session partition** — your login survives restarts.
- **External-link handoff to the system browser** — anything not `*.instagram.com` opens in your default browser, not in the app.
- **Window defaults**: 1200×820, minWidth 800, minHeight 600, `autoHideMenuBar: true`, dark background via `nativeTheme.shouldUseDarkColors`.

If you're refactoring, make sure these still hold.
