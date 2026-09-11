/** Web stub — repos use localStorage via webStore. */
export function getDb(): Promise<never> {
  return Promise.reject(new Error('SQLite unavailable on web'));
}

export async function resetDbConnection(): Promise<void> {}
