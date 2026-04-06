export interface DbConnection {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  close(): Promise<void>;
}

let connection: DbConnection | null = null;

export function getConnection(): DbConnection {
  if (!connection) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return connection;
}

export async function initDb(connectionString: string): Promise<void> {
  // Simulated connection
  connection = {
    async query(sql: string, params?: unknown[]) {
      return [];
    },
    async close() {
      connection = null;
    },
  };
}
