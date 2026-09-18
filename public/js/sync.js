// Sync manager — handles offline queue and background sync
const SyncManager = {
  isOnline: navigator.onLine,
  syncing: false,

  init() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flush();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  },

  async queue(entityType, entityId, payload, operation = 'upsert') {
    await LocalDB.addSyncItem(entityType, entityId, payload, operation);
    if (this.isOnline) {
      this.flush();
    }
  },

  async flush() {
    if (!this.isOnline || this.syncing) return;
    this.syncing = true;

    try {
      const queue = await LocalDB.getSyncQueue();
      if (queue.length === 0) { this.syncing = false; return; }

      const items = queue.map((q) => ({
        entityType: q.entityType,
        entityId: q.entityId,
        operation: q.operation,
        payload: JSON.parse(q.payload),
      }));

      const result = await API.sync(items);

      // Remove successfully synced items
      for (const r of result.results) {
        if (r.status === 'synced') {
          const queueItem = queue.find((q) => q.entityId === r.id);
          if (queueItem) await LocalDB.removeSyncItem(queueItem.id);
        }
      }

      // Update local data from server
      await this.pullFromServer();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      this.syncing = false;
    }
  },

  async pullFromServer() {
    try {
      const patients = await API.getPatients();
      for (const p of patients) {
        await LocalDB.put('patients', p);
        const memories = await API.getMemories(p.id);
        for (const m of memories) {
          await LocalDB.put('memories', m);
        }
      }
    } catch (err) {
      console.error('Pull failed:', err);
    }
  },

  getSyncStatus() {
    return this.isOnline ? 'online' : 'offline';
  },
};
