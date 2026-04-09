// Zoom persistence — pure fs I/O, no Electron imports.
// main.ts wires `app.getPath('userData')` as the directory.

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Read the persisted zoom level from `filePath`.
 * Returns 0 if the file is missing, unreadable, malformed, or has the wrong shape.
 */
export function loadZoom(filePath: string): number {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const zoom = (parsed as Record<string, unknown>).zoom;
      if (typeof zoom === 'number') return zoom;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Write the given zoom level to `filePath`, creating the parent directory
 * if it doesn't exist. Returns true on success, false on failure.
 */
export function saveZoom(filePath: string, zoom: number): boolean {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ zoom }));
    return true;
  } catch {
    return false;
  }
}
