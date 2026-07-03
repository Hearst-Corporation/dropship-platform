/**
 * Preload script.
 *
 * Runs in an isolated world before the renderer loads. Exposes a minimal,
 * typed API to the renderer via contextBridge — no full ipcRenderer access,
 * no Node globals. The web app is browser-first; this is purely opt-in:
 *
 *   if (typeof window !== 'undefined' && window.electron) {
 *     window.electron.notify({ title: 'Sale!', body: '...' });
 *   }
 */
import { contextBridge, ipcRenderer } from 'electron';

// NOTE: the Basic Auth header used to be read here via a synchronous IPC
// call (`config:get-auth`) and exposed on `window.__electronAuth` so the
// renderer's `apiFetch()` could attach it manually. That put the raw
// credential header directly in page JS scope — readable by any XSS or
// malicious sub-resource loaded by the admin UI. The header is now injected
// transparently by the main process via `session.webRequest.onBeforeSendHeaders`
// (see apps/desktop/src/main.ts `installAuthHeader()`), scoped to the app's
// own origin only. Nothing needs to be exposed to the renderer anymore.

export interface ElectronApi {
  /** Open a named window. Returns once the IPC has been dispatched. */
  openWindow(opts: { kind: string; storeId?: string }): Promise<void>;
  /** Trigger a native macOS notification. */
  notify(opts: {
    title: string;
    body: string;
    urgency?: 'normal' | 'critical';
  }): Promise<void>;
  /** Tell the main process that this renderer just opened a given store. */
  pushRecentStore(opts: { id: string; name?: string }): Promise<void>;
  /** Window controls — close/minimize/maximize current window. */
  windowControl(action: 'close' | 'minimize' | 'maximize'): Promise<void>;
  /** Synchronous helper to read the running app version. */
  appVersion(): string;
  /** Always true when running inside Electron — handy for feature-detection. */
  readonly isElectron: true;
}

const api: ElectronApi = {
  openWindow: async (opts) => {
    await ipcRenderer.invoke('window:open', opts);
  },
  notify: async (opts) => {
    await ipcRenderer.invoke('notify:show', opts);
  },
  pushRecentStore: async (opts) => {
    await ipcRenderer.invoke('recent-store:push', opts);
  },
  windowControl: async (action) => {
    await ipcRenderer.invoke('window:control', action);
  },
  appVersion: () => ipcRenderer.sendSync('app:version-sync') as string,
  isElectron: true,
};

contextBridge.exposeInMainWorld('electron', api);
