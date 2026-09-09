import { createJSONStorage } from "zustand/middleware";

type UseStore = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>,
) => Promise<T>;

function promisifyRequest<T = undefined>(
  request: IDBRequest<T> | IDBTransaction,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // @ts-expect-error
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    // @ts-expect-error
    request.onabort = request.onerror = () => reject(request.error);
  });
}

function createStore(dbName: string, storeName: string): UseStore {
  let DBP: Promise<IDBDatabase> | undefined;
  const getDB = () => {
    if (DBP) return DBP;
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    DBP = promisifyRequest(request);

    DBP.then(
      (db) => {
        // It seems like Safari sometimes likes to just close the connection.
        // It's supposed to fire this event when that happens. Let's hope it does!
        db.onclose = () => (DBP = undefined);
      },
      () => {},
    );
    return DBP;
  };

  return (txMode, callback) =>
    getDB().then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName)),
    );
}

/**
 * Get a value by its key.
 *
 * @param key
 * @param store Method to get a custom store. Use with caution (see the docs).
 */
export function get<T = any>(
  key: IDBValidKey,
  store: UseStore,
): Promise<T | undefined> {
  return store("readonly", (store) => promisifyRequest(store.get(key)));
}

/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param store Method to get a custom store. Use with caution (see the docs).
 */
export function set(key: IDBValidKey, value: any, store: UseStore): Promise<void> {
  return store("readwrite", (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction);
  });
}

/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param store Method to get a custom store. Use with caution (see the docs).
 */
export function del(key: IDBValidKey, store: UseStore): Promise<void> {
  return store("readwrite", (store) => {
    store.delete(key);
    return promisifyRequest(store.transaction);
  });
}

/**
 * Create a persist storage using `IndexedDB`.
 *
 * @example
 * createStore(
 *   persist(initialState, {
 *     version: 0.1,
 *     name: 'row-key',
 *     storage: createIndexedDBStorage()
 *   })
 * )
 */
export function createIndexedDBStorage() {
  return createJSONStorage(() => {
    const store = createStore("OpenBB", "workspace");
    return {
      async getItem(key: IDBValidKey) {
        return await get(key, store).then((value) => value || null);
      },
      async setItem(key: IDBValidKey, value: any) {
        await set(key, value, store);
      },
      async removeItem(key: IDBValidKey) {
        await del(key, store);
      },
    };
  });
}

export async function getStorage(key: IDBValidKey) {
  const store = createStore("OpenBB", "workspace");
  return await get(key, store).then((value) => value || null);
}
