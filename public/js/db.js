// IndexedDB wrapper for offline-first storage
const DB_NAME = 'mindcare_db';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
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
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function tx(storeName, mode, fn) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; }).catch(reject);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

const LocalDB = {
  async put(storeName, data) {
    return tx(storeName, 'readwrite', (store) => store.put(data));
  },

  async get(storeName, key) {
    return tx(storeName, 'readonly', (store) => store.get(key));
  },

  async getAll(storeName) {
    return tx(storeName, 'readonly', (store) => store.getAll());
  },

  async getAllByIndex(storeName, indexName, value) {
    return tx(storeName, 'readonly', (store) => store.index(indexName).getAll(value));
  },

  async delete(storeName, key) {
    return tx(storeName, 'readwrite', (store) => store.delete(key));
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

  // Seed demo data
  async seedDemo() {
    const existing = await this.getAll('patients');
    if (existing.length > 0) return;

    const patientId = crypto.randomUUID();
    await this.put('patients', {
      id: patientId,
      caregiverId: 'demo-caregiver',
      fullName: 'Anjali Devi',
      preferredName: 'Anjali',
      age: 72,
      hometown: 'Imphal',
      languageCode: 'en-IN',
      dementiaNotes: 'Early-stage dementia. Responds well to familiar faces.',
    });

    const demoMemories = [
      { id: crypto.randomUUID(), patientId, caption: 'This is your daughter, Meera', shortLabel: 'Meera', aliases: ['beti', 'daughter'], relation: 'daughter', category: 'person', sortOrder: 0 },
      { id: crypto.randomUUID(), patientId, caption: 'This is your son, Rajesh', shortLabel: 'Rajesh', aliases: ['beta', 'son'], relation: 'son', category: 'person', sortOrder: 1 },
      { id: crypto.randomUUID(), patientId, caption: 'Your home in Imphal', shortLabel: 'Home', aliases: ['ghar', 'house'], relation: 'home', category: 'place', sortOrder: 2 },
      { id: crypto.randomUUID(), patientId, caption: 'Your husband, Late R.K. Sharma', shortLabel: 'R.K. Sharma', aliases: ['sharma ji', 'husband'], relation: 'spouse', category: 'person', sortOrder: 3 },
    ];

    for (const mem of demoMemories) {
      await this.put('memories', mem);
    }

    // Seed some historical sessions for analytics
    const now = new Date();
    for (let i = 10; i >= 1; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const accuracy = 0.5 + Math.random() * 0.4;
      const sessionId = crypto.randomUUID();
      await this.put('sessions', {
        id: sessionId,
        patientId,
        sessionType: i % 2 === 0 ? 'morning' : 'evening',
        status: 'completed',
        startedAt: date.toISOString(),
        endedAt: new Date(date.getTime() + 5 * 60000).toISOString(),
        accuracy,
        avgResponseMs: 5000 + Math.floor(Math.random() * 10000),
        hintsUsed: Math.floor(Math.random() * 5),
        repetitions: Math.floor(Math.random() * 3),
        compositeScore: Math.round((accuracy * 70 + 20 + Math.random() * 10) * 10) / 10,
      });
    }

    await this.setMeta('demoSeeded', 'true');
  },
};
