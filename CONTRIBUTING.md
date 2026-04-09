# Contributing

Thanks for considering a contribution. This is a personal project, so expectations are light — but PRs, bug reports, and ideas are all welcome.

## Dev setup

**Prerequisites:** Node.js 20+, `npm`, and `git`. Nothing else.

```bash
git clone https://github.com/adrenal36/instagram-messenger.git
cd instagram-messenger
npm install
```

## Running the app

```bash
npm start          # tsc && electron .
```

The `start` script compiles TypeScript to `dist-ts/` and launches Electron against the compiled output. Source lives in `src/`.

## Running the tests

```bash
npm test           # vitest run
npm run test:watch # vitest in watch mode
npm run test:ui    # vitest UI at localhost:51204
npm run type-check # tsc -p tsconfig.test.json
```

Test layout:
- `test/main/**/*.test.ts` — Node-env tests for main-process helpers (`zoom`, `autostart`). Use real tmp dirs via `fs.mkdtempSync`.
- `test/preload/**/*.test.ts` — jsdom-env tests for preload helpers (`debounce`, `thread-list`, `banner`). Use `vi.useFakeTimers()` for debounce.

CI runs type-check + test on every push and PR via `.github/workflows/ci.yml`. The release workflow in `release.yml` gates on the same steps before building artifacts.

## Building distributable artifacts

```bash
npm run dist:linux   # AppImage + .deb into dist/
npm run dist:win     # Windows zip into dist/ (native .exe requires Wine or Windows)
```

For Windows installers (`nsis`, `portable`) from Linux, install Wine first — otherwise `winCodeSign` fails on the rcedit step. The official release pipeline builds Windows natively on `windows-latest` so releases always have proper metadata.

## Code style

- **TypeScript, strict mode, zero `any`.** Non-negotiable. The tsconfig enables `noUncheckedIndexedAccess` and `noImplicitReturns`.
- **Pure logic stays importable.** Anything that doesn't require the Electron runtime (fs work, string building, DOM helpers) lives in `src/main/`, `src/preload/`, or `src/shared/` and ships with tests.
- **No mocks of the database or filesystem in tests.** Use real tmp dirs.
- **Atomic commits, one logical change each.** Keep diffs reviewable.

## Pull requests

1. Fork, branch, and make your changes on a topic branch.
2. Make sure `npm test` and `npm run type-check` are green.
3. Open a PR against `master` describing *why* the change matters (the *what* is already in the diff).
4. If the change touches `src/main/` or `src/preload/` helpers, add or update tests in `test/`.

See `docs/ARCHITECTURE.md` for a map of the codebase.
