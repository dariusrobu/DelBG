import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let initialized = false;

async function migrateSchema(db: Client): Promise<void> {
  // Check if old clients table has wrong schema (has 'address' instead of 'street')
  const tableInfo = await db.execute("PRAGMA table_info(clients)");
  const columns = tableInfo.rows.map((r) => r.name as string);
  const hasOldSchema = columns.includes("address") && !columns.includes("street");

  if (!hasOldSchema) return;

  // Drop old tables from the previous project
  await db.executeMultiple(`
    DROP TABLE IF EXISTS manifest_stops;
    DROP TABLE IF EXISTS daily_manifests;
    DROP TABLE IF EXISTS route_templates;
  `);

  // Recreate clients with correct schema
  await db.execute("DROP TABLE IF EXISTS clients");
  await db.execute(`
    CREATE TABLE clients (
      id TEXT PRIMARY KEY,
      name TEXT,
      street TEXT NOT NULL DEFAULT '',
      number TEXT NOT NULL DEFAULT '',
      bloc TEXT,
      apartment TEXT,
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      phone TEXT,
      notes TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)");

  // Recreate menu_items with correct schema (drop is_recurring, make date NOT NULL)
  await db.execute("DROP TABLE IF EXISTS menu_items");
  await db.execute(`
    CREATE TABLE menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_menu_items_date ON menu_items(date)");

  // Ensure manifests table exists with correct schema
  await db.execute(`
    CREATE TABLE IF NOT EXISTS manifests (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      stops_json TEXT NOT NULL DEFAULT '[]',
      sections_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_manifests_date ON manifests(date)");
}

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
    await migrateSchema(client);
    initialized = true;
  }

  return client;
}
