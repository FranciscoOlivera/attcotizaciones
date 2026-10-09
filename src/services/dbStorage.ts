/**
 * Ultra-resilient client database storage using IndexedDB.
 * Completely avoids the 5MB quota limit of localStorage (QuotaExceededError).
 */

const DB_NAME = 'att_sync_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn(`IndexedDB get error for key "${key}":`, err);
    // Safe fallback to localStorage
    try {
      const fallback = localStorage.getItem(key);
      return fallback ? JSON.parse(fallback) : null;
    } catch {
      return null;
    }
  }
}

export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn(`IndexedDB set error for key "${key}":`, err);
    // Safe fallback to localStorage without throwing
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (lsErr) {
      console.warn(`localStorage quota also full for "${key}". Data kept in memory.`, lsErr);
      return false;
    }
  }
}

export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn(`IndexedDB remove error for key "${key}":`, err);
  }
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Clean up old high-volume items from localStorage to reclaim space immediately
 */
export function purgeHighVolumeLocalStorage(): void {
  try {
    const keysToRemove = [
      'att_central_records_v3',
      'att_central_records_v2',
      'att_central_records',
      'att_sync_reports_v3',
      'att_sync_reports_v2',
      'att_sync_reports',
    ];
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (e) {
    console.warn('Failed to clear old localStorage keys:', e);
  }
}
