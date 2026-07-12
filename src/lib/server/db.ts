import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let initialized = false;

export async function getDb(): Promise<Client> {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) throw new Error("TURSO_DATABASE_URL is not set");

  client = createClient({
    url,
    authToken,
  });

  if (!initialized) {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT,
        street TEXT NOT NULL,
        number TEXT NOT NULL,
        bloc TEXT,
        apartment TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        phone TEXT,
        notes TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS manifests (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        stops_json TEXT NOT NULL DEFAULT '[]',
        sections_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    try {
      await client.execute("CREATE INDEX IF NOT EXISTS idx_manifests_date ON manifests(date)");
      await client.execute("CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)");
      await client.execute("CREATE INDEX IF NOT EXISTS idx_menu_items_date ON menu_items(date)");
    } catch {
      // Indexes may already exist
    }

    initialized = true;
  }

  return client;
}
