// Shared constants used by both main and preload. Single source of truth
// for IPC channel names, tuning values, and UI strings — so main.ts and
// preload.ts can never drift.

export const APP_NAME = 'Instagram Messenger';
export const APP_ID = 'badwolf.ro.instagram-messenger';
export const APP_SLUG = 'instagram-messenger';

export const START_URL = 'https://www.instagram.com/direct/inbox/';
export const SESSION_PARTITION = 'persist:instagram';

// Real Chrome desktop UA so Instagram serves the full web experience.
export const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Safari/537.36';

export const GLOBAL_HOTKEY = 'CommandOrControl+Shift+M';

export const IPC_DM_ACTIVITY = 'dm-activity';

export const ZOOM_MIN = -3;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.5;

// Preload tuning
export const DEBOUNCE_MS = 500;
export const ATTACH_RETRY_MS = 1500;
export const REATTACH_CHECK_MS = 10_000;
export const BANNER_INITIAL_DELAY_MS = 3_000;
export const BANNER_RESCAN_MS = 30_000;
export const BANNER_EMPTY_SCANS_BEFORE_STOP = 5;
export const THREAD_LIST_MAX_PARENT_WALK = 8;

// IPC payload contract shared by main + preload.
export interface DMActivityPayload {
  ts: number;
}
