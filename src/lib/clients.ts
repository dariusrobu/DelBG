import { getDB } from "./db";
import { queueMutation } from "./sync";
import { Client } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAllClients(): Promise<Client[]> {
  const db = await getDB();
  return db.getAll("clients");
}

export async function getClient(id: string): Promise<Client | undefined> {
  const db = await getDB();
  return db.get("clients", id);
}

export async function createClient(
  data: Omit<Client, "id">
): Promise<Client> {
  const db = await getDB();
  const client: Client = { ...data, id: generateId(), tags: data.tags ?? [] };
  await db.add("clients", client);
  queueMutation({ entityType: "client", entityId: client.id, action: "create", payload: client });
  return client;
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, "id">>
): Promise<Client> {
  const db = await getDB();
  const existing = await db.get("clients", id);
  if (!existing) throw new Error(`Client ${id} not found`);
  const updated = { ...existing, ...data };
  await db.put("clients", updated);
  queueMutation({ entityType: "client", entityId: id, action: "update", payload: updated });
  return updated;
}

export async function deleteClient(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("clients", id);
  queueMutation({ entityType: "client", entityId: id, action: "delete", payload: {} });
}

export async function searchClients(query: string): Promise<Client[]> {
  const db = await getDB();
  const all = await db.getAll("clients");
  const q = query.toLowerCase();
  return all.filter(
    (c) =>
      c.name?.toLowerCase().includes(q) ||
      c.street.toLowerCase().includes(q) ||
      c.number.includes(q)
  );
}

export async function getAllTags(): Promise<string[]> {
  const db = await getDB();
  const all = await db.getAll("clients");
  const tagSet = new Set<string>();
  for (const c of all) {
    if (c.tags) {
      for (const t of c.tags) {
        tagSet.add(t);
      }
    }
  }
  return [...tagSet].sort();
}
