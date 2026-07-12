import { getDB } from "./db";
import { queueMutation } from "./sync";
import { MenuItem } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const db = await getDB();
  return db.getAll("menuItems");
}

export async function getMenuItemsByDate(date: string): Promise<MenuItem[]> {
  const db = await getDB();
  return db.getAllFromIndex("menuItems", "by-date", date);
}

export async function getMenuItem(id: string): Promise<MenuItem | undefined> {
  const db = await getDB();
  return db.get("menuItems", id);
}

export async function createMenuItem(
  data: Omit<MenuItem, "id">
): Promise<MenuItem> {
  const db = await getDB();
  const item: MenuItem = { ...data, id: generateId() };
  await db.add("menuItems", item);
  queueMutation({ entityType: "menuItem", entityId: item.id, action: "create", payload: item });
  return item;
}

export async function updateMenuItem(
  id: string,
  data: Partial<Omit<MenuItem, "id">>
): Promise<MenuItem> {
  const db = await getDB();
  const existing = await db.get("menuItems", id);
  if (!existing) throw new Error(`MenuItem ${id} not found`);
  const updated = { ...existing, ...data };
  await db.put("menuItems", updated);
  queueMutation({ entityType: "menuItem", entityId: id, action: "update", payload: updated });
  return updated;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("menuItems", id);
  queueMutation({ entityType: "menuItem", entityId: id, action: "delete", payload: {} });
}
