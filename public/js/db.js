// IndexedDB wrapper for offline-first storage
const DB_NAME = 'mindcare_db';
const DB_VERSION = 2;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db && db.version >= DB_VERSION && db.objectStoreNames.contains('meta')) {
      resolve(db);
      return;
    }
    if (db) {
      try {
        db.close();
      } catch (_) {}
      db = null;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('patients')) {
        database.createObjectStore('patients', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('memories')) {
        const store = database.createObjectStore('memories', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId', { unique: false });
      }
      if (!database.objectStoreNames.contains('sessions')) {
        const store = database.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId', { unique: false });
      }
      if (!database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('caregiverCheckins')) {
        const store = database.createObjectStore('caregiverCheckins', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('completedAt', 'completedAt', { unique: false });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      db.onversionchange = () => {
        try {
          db.close();
        } catch (_) {}
        db = null;
      };
      resolve(db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

/** Run one IDB request inside a transaction; wait for tx complete + return request.result */
function withStore(storeName, mode, run) {
  return openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        let req;
        try {
          const transaction = database.transaction(storeName, mode);
          const store = transaction.objectStore(storeName);
          req = run(store);
          transaction.oncomplete = () => resolve(req ? req.result : undefined);
          transaction.onerror = () => reject(transaction.error || req?.error);
          transaction.onabort = () => reject(transaction.error || new Error('aborted'));
        } catch (err) {
          reject(err);
        }
      })
  );
}

const LocalDB = {
  async put(storeName, data) {
    return withStore(storeName, 'readwrite', (store) => store.put(data));
  },

  async get(storeName, key) {
    return withStore(storeName, 'readonly', (store) => store.get(key));
  },

  async getAll(storeName) {
    const rows = await withStore(storeName, 'readonly', (store) => store.getAll());
    return Array.isArray(rows) ? rows : [];
  },

  async getAllByIndex(storeName, indexName, value) {
    const rows = await withStore(storeName, 'readonly', (store) =>
      store.index(indexName).getAll(value)
    );
    return Array.isArray(rows) ? rows : [];
  },

  async delete(storeName, key) {
    return withStore(storeName, 'readwrite', (store) => store.delete(key));
  },

  async addSyncItem(entityType, entityId, payload, operation = 'upsert') {
    const item = {
      id: crypto.randomUUID(),
      entityType,
      entityId,
      operation,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await this.put('syncQueue', item);
    return item;
  },

  async getSyncQueue() {
    return this.getAll('syncQueue');
  },

  async removeSyncItem(id) {
    await this.delete('syncQueue', id);
  },

  async setMeta(key, value) {
    await this.put('meta', { key, value });
  },

  async getMeta(key) {
    const row = await this.get('meta', key);
    return row?.value;
  },

  // Seed ONLY empty patient stub for first-run demos — never invent sessions
  async seedDemo() {
    const existing = await this.getAll('patients');
    if (existing.length > 0) return;

    // Prefer server patients when online; don't invent "Anjali"
    if (typeof navigator !== 'undefined' && navigator.onLine) return;

    const patientId = crypto.randomUUID();
    await this.put('patients', {
      id: patientId,
      caregiverId: 'demo-caregiver',
      fullName: 'Demo Patient',
      preferredName: 'Friend',
      age: 72,
      hometown: 'Guwahati',
      languageCode: 'en-IN',
      dementiaNotes: '',
    });
    await this.setMeta('demoSeeded', 'patient-only');
  },
};
