import { getDB } from "./db";
import { queueMutation } from "./sync";
import { DailyManifest, Stop, ManifestSection } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAllManifests(): Promise<DailyManifest[]> {
  const db = await getDB();
  const manifests = await db.getAll("manifests");
  return manifests.map((m) => ({
    ...m,
    sections: m.sections ?? [],
  })).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getManifest(id: string): Promise<DailyManifest | undefined> {
  const db = await getDB();
  const manifest = await db.get("manifests", id);
  if (!manifest) return undefined;
  return { ...manifest, sections: manifest.sections ?? [] };
}

export async function getManifestByDate(date: string): Promise<DailyManifest | undefined> {
  const db = await getDB();
  const results = await db.getAllFromIndex("manifests", "by-date", date);
  if (results.length === 0) return undefined;
  return { ...results[0], sections: results[0].sections ?? [] };
}

export async function getMostRecentManifest(): Promise<DailyManifest | undefined> {
  const db = await getDB();
  const all = await db.getAll("manifests");
  if (all.length === 0) return undefined;
  all.sort((a, b) => b.date.localeCompare(a.date));
  const m = all[0];
  return { ...m, sections: m.sections ?? [] };
}

export async function createManifest(data: {
  date: string;
  stops: Omit<Stop, "id">[];
  sections?: ManifestSection[];
}): Promise<DailyManifest> {
  const db = await getDB();
  const manifest: DailyManifest = {
    id: generateId(),
    date: data.date,
    stops: data.stops.map((s) => ({ ...s, id: generateId() })),
    sections: data.sections ?? [],
  };
  await db.add("manifests", manifest);
  queueMutation({ entityType: "manifest", entityId: manifest.id, action: "create", payload: manifest });
  return manifest;
}

export async function updateManifest(
  id: string,
  data: Partial<Pick<DailyManifest, "date" | "stops" | "sections">>
): Promise<DailyManifest> {
  const db = await getDB();
  const existing = await db.get("manifests", id);
  if (!existing) throw new Error(`Manifest ${id} not found`);

  const updated = { ...existing, ...data };

  // Ensure all stops have IDs
  if (updated.stops) {
    updated.stops = updated.stops.map((s) => ({
      ...s,
      id: s.id || generateId(),
    }));
  }

  // Default sections to empty array
  updated.sections = updated.sections ?? [];

  await db.put("manifests", updated);
  queueMutation({ entityType: "manifest", entityId: id, action: "update", payload: updated });
  return updated;
}

export async function deleteManifest(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("manifests", id);
  queueMutation({ entityType: "manifest", entityId: id, action: "delete", payload: {} });
}

export async function cloneMostRecentManifest(
  newDate: string
): Promise<DailyManifest> {
  const recent = await getMostRecentManifest();
  if (!recent) {
    return createManifest({ date: newDate, stops: [] });
  }

  // Clone sections
  const clonedSections: ManifestSection[] = recent.sections.map((s) => ({
    ...s,
    id: generateId(),
  }));

  // Map old section IDs to new section IDs
  const sectionIdMap = new Map<string, string>();
  recent.sections.forEach((oldSec, i) => {
    sectionIdMap.set(oldSec.id, clonedSections[i].id);
  });

  return createManifest({
    date: newDate,
    stops: recent.stops.map((s) => ({
      clientId: s.clientId,
      menuItemId: s.menuItemId,
      position: s.position,
      status: "pending" as const,
      notes: s.notes,
      isWalkIn: false,
      sectionId: s.sectionId ? sectionIdMap.get(s.sectionId) ?? undefined : undefined,
    })),
    sections: clonedSections,
  });
}
