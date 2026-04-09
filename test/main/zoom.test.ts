import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadZoom, saveZoom } from '../../src/main/zoom.js';

let tmpDir: string;
let zoomFile: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'igm-zoom-'));
  zoomFile = path.join(tmpDir, 'nested', 'zoom.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadZoom', () => {
  it('returns 0 when file missing (TSC-A7)', () => {
    expect(loadZoom(zoomFile)).toBe(0);
  });

  it('returns parsed value when file exists with valid JSON (TSC-A8)', () => {
    fs.mkdirSync(path.dirname(zoomFile), { recursive: true });
    fs.writeFileSync(zoomFile, JSON.stringify({ zoom: 1.5 }));
    expect(loadZoom(zoomFile)).toBe(1.5);
  });

  it('returns 0 when file exists but is corrupt (TSC-A9)', () => {
    fs.mkdirSync(path.dirname(zoomFile), { recursive: true });
    fs.writeFileSync(zoomFile, 'not json at all {{{');
    expect(loadZoom(zoomFile)).toBe(0);
  });

  it('returns 0 when JSON has wrong shape', () => {
    fs.mkdirSync(path.dirname(zoomFile), { recursive: true });
    fs.writeFileSync(zoomFile, JSON.stringify({ zoom: 'not-a-number' }));
    expect(loadZoom(zoomFile)).toBe(0);
  });

  it('returns 0 when JSON is null', () => {
    fs.mkdirSync(path.dirname(zoomFile), { recursive: true });
    fs.writeFileSync(zoomFile, 'null');
    expect(loadZoom(zoomFile)).toBe(0);
  });

  it('handles negative zoom levels', () => {
    fs.mkdirSync(path.dirname(zoomFile), { recursive: true });
    fs.writeFileSync(zoomFile, JSON.stringify({ zoom: -2.5 }));
    expect(loadZoom(zoomFile)).toBe(-2.5);
  });
});

describe('saveZoom', () => {
  it('creates the parent directory if missing (TSC-A10)', () => {
    expect(fs.existsSync(path.dirname(zoomFile))).toBe(false);
    expect(saveZoom(zoomFile, 1)).toBe(true);
    expect(fs.existsSync(zoomFile)).toBe(true);
  });

  it('writes valid JSON parseable by loadZoom (TSC-A11)', () => {
    saveZoom(zoomFile, 2);
    expect(loadZoom(zoomFile)).toBe(2);
  });

  it('round-trip: save then load returns the same value (TSC-A12)', () => {
    for (const value of [-3, -1.5, 0, 0.5, 1, 2.5, 3]) {
      saveZoom(zoomFile, value);
      expect(loadZoom(zoomFile)).toBe(value);
    }
  });

  it('overwrites existing file on save', () => {
    saveZoom(zoomFile, 1);
    saveZoom(zoomFile, 2);
    expect(loadZoom(zoomFile)).toBe(2);
  });
});
