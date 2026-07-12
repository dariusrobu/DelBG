import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

interface SyncMutation {
  entityType: "client" | "menuItem" | "manifest";
  entityId: string;
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  timestamp: string;
}

export async function POST(request: Request) {
  const { mutations, lastSyncTimestamp } = await request.json();
  const db = getDb();

  for (const m of mutations as SyncMutation[]) {
    const ts = m.timestamp;

    if (m.entityType === "client") {
      if (m.action === "delete") {
        await db.execute("DELETE FROM clients WHERE id = ?", [m.entityId]);
      } else {
        await db.execute(
          `INSERT INTO clients (id, name, street, number, bloc, apartment, lat, lng, phone, notes, tags_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, street = excluded.street, number = excluded.number,
             bloc = excluded.bloc, apartment = excluded.apartment, lat = excluded.lat,
             lng = excluded.lng, phone = excluded.phone, notes = excluded.notes,
             tags_json = excluded.tags_json, updated_at = excluded.updated_at`,
          [
            m.entityId,
            (m.payload.name as string) ?? null,
            m.payload.street as string,
            m.payload.number as string,
            (m.payload.bloc as string) ?? null,
            (m.payload.apartment as string) ?? null,
            m.payload.lat as number,
            m.payload.lng as number,
            (m.payload.phone as string) ?? null,
            (m.payload.notes as string) ?? null,
            JSON.stringify(m.payload.tags ?? []),
            ts,
          ]
        );
      }
    } else if (m.entityType === "menuItem") {
      if (m.action === "delete") {
        await db.execute("DELETE FROM menu_items WHERE id = ?", [m.entityId]);
      } else {
        await db.execute(
          `INSERT INTO menu_items (id, name, description, date, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, description = excluded.description,
             date = excluded.date, updated_at = excluded.updated_at`,
          [m.entityId, m.payload.name as string, (m.payload.description as string) ?? null, m.payload.date as string, ts]
        );
      }
    } else if (m.entityType === "manifest") {
      if (m.action === "delete") {
        await db.execute("DELETE FROM manifests WHERE id = ?", [m.entityId]);
      } else {
        await db.execute(
          `INSERT INTO manifests (id, date, stops_json, sections_json, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             date = excluded.date, stops_json = excluded.stops_json,
             sections_json = excluded.sections_json, updated_at = excluded.updated_at`,
          [
            m.entityId,
            m.payload.date as string,
            JSON.stringify(m.payload.stops ?? []),
            JSON.stringify(m.payload.sections ?? []),
            ts,
          ]
        );
      }
    }
  }

  const since = lastSyncTimestamp || "1970-01-01T00:00:00.000Z";

  const clientsResult = await db.execute(
    "SELECT * FROM clients WHERE updated_at > ?",
    [since]
  );
  const clients = clientsResult.rows.map((r) => ({
    id: r.id,
    name: r.name ?? undefined,
    street: r.street,
    number: r.number,
    bloc: r.bloc ?? undefined,
    apartment: r.apartment ?? undefined,
    lat: r.lat,
    lng: r.lng,
    phone: r.phone ?? undefined,
    notes: r.notes ?? undefined,
    tags: JSON.parse((r.tags_json as string) || "[]"),
  }));

  const menuResult = await db.execute(
    "SELECT * FROM menu_items WHERE updated_at > ?",
    [since]
  );
  const menuItems = menuResult.rows;

  const manifestsResult = await db.execute(
    "SELECT * FROM manifests WHERE updated_at > ?",
    [since]
  );
  const manifests = manifestsResult.rows.map((r) => ({
    id: r.id,
    date: r.date,
    stops: JSON.parse(r.stops_json as string),
    sections: JSON.parse((r.sections_json as string) || "[]"),
  }));

  const serverTimestamp = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    serverTimestamp,
    changes: { clients, menuItems, manifests },
  });
}
