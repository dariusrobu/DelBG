import { getDB } from "./db";
import type { Client, MenuItem, DailyManifest, Stop, ManifestSection } from "@/types";

interface SyncMutation {
  entityType: "client" | "menuItem" | "manifest";
  entityId: string;
  action: "create" | "update" | "delete";
  payload: Client | MenuItem | DailyManifest | Record<string, unknown>;
  timestamp: string;
}

const SYNC_KEY = "delbg_sync_queue";
const LAST_SYNC_KEY = "delbg_last_sync";

function getSyncQueue(): SyncMutation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) || "[]");
  } catch {
    return [];
  }
}

function setSyncQueue(queue: SyncMutation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_KEY, JSON.stringify(queue));
}

export function getLastSyncTimestamp(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function setLastSyncTimestamp(ts: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SYNC_KEY, ts);
}

export function queueMutation(mutation: Omit<SyncMutation, "timestamp">): void {
  const queue = getSyncQueue();
  queue.push({
    ...mutation,
    timestamp: new Date().toISOString(),
  });
  setSyncQueue(queue);
}

export function getPendingCount(): number {
  return getSyncQueue().length;
}

export async function pushSync(): Promise<boolean> {
  try {
    const queue = getSyncQueue();
    const lastSync = getLastSyncTimestamp();
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mutations: queue,
        lastSyncTimestamp: lastSync,
      }),
    });

    if (!res.ok) return false;

    const data = await res.json();

    // Apply server changes to local IndexedDB
    await applyServerChanges(data.changes, !lastSync);

    // Update last sync timestamp
    setLastSyncTimestamp(data.serverTimestamp);

    // Clear the queue
    setSyncQueue([]);

    return true;
  } catch {
    // Network error — queue stays, will retry
    return false;
  }
}

async function applyServerChanges(changes: {
  clients: Record<string, unknown>[];
  menuItems: Record<string, unknown>[];
  manifests: Record<string, unknown>[];
}, isFullSync: boolean): Promise<void> {
  const db = await getDB();
  const serverClientIds = new Set(changes.clients.map((c) => c.id as string));
  const serverMenuIds = new Set(changes.menuItems.map((m) => m.id as string));
  const serverManifestIds = new Set(changes.manifests.map((m) => m.id as string));

  // Apply client changes
  for (const c of changes.clients) {
    const client = {
      id: c.id as string,
      name: (c.name as string) || undefined,
      street: (c.street as string) ?? "",
      number: (c.number as string) ?? "",
      bloc: (c.bloc as string) || undefined,
      apartment: (c.apartment as string) || undefined,
      lat: (c.lat as number) ?? 0,
      lng: (c.lng as number) ?? 0,
      phone: (c.phone as string) || undefined,
      notes: (c.notes as string) || undefined,
      tags: (c.tags as string[]) ?? [],
    };
    await db.put("clients", client);
  }

  // Apply menu item changes
  for (const m of changes.menuItems) {
    const item = {
      id: m.id as string,
      name: m.name as string,
      description: (m.description as string) || undefined,
      date: m.date as string,
    };
    await db.put("menuItems", item);
  }

  // Apply manifest changes
  for (const m of changes.manifests) {
    const manifest: DailyManifest = {
      id: m.id as string,
      date: m.date as string,
      stops: m.stops as Stop[],
      sections: (m.sections as ManifestSection[]) ?? [],
    };
    await db.put("manifests", manifest);
  }

  // Full-sync cleanup: only on first sync when server returns ALL data
  if (isFullSync) {
    const allClients = await db.getAll("clients");
    for (const local of allClients) {
      if (!serverClientIds.has(local.id)) {
        await db.delete("clients", local.id);
      }
    }
    const allMenus = await db.getAll("menuItems");
    for (const local of allMenus) {
      if (!serverMenuIds.has(local.id)) {
        await db.delete("menuItems", local.id);
      }
    }
    const allManifests = await db.getAll("manifests");
    for (const local of allManifests) {
      if (!serverManifestIds.has(local.id)) {
        await db.delete("manifests", local.id);
      }
    }
  }
}

// Auto-sync when coming online
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMs = 30000): void {
  if (typeof window === "undefined") return;
  if (syncInterval) return;

  // Listen for online events
  window.addEventListener("online", () => {
    pushSync();
  });

  // Periodic sync attempt
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      pushSync();
    }
  }, intervalMs);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
