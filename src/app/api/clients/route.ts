import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

interface ClientRow {
  id: string;
  name: string | null;
  street: string;
  number: string;
  bloc: string | null;
  apartment: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  notes: string | null;
  tags_json: string;
}

export async function GET() {
  const db = getDb();
  const result = await db.execute("SELECT * FROM clients ORDER BY name");
  const rows = result.rows as unknown as ClientRow[];

  const clients = rows.map((r) => ({
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
    tags: JSON.parse(r.tags_json || "[]"),
  }));

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const body = await request.json();
  const db = getDb();

  await db.execute(
    `INSERT INTO clients (id, name, street, number, bloc, apartment, lat, lng, phone, notes, tags_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      body.id,
      body.name ?? null,
      body.street,
      body.number,
      body.bloc ?? null,
      body.apartment ?? null,
      body.lat,
      body.lng,
      body.phone ?? null,
      body.notes ?? null,
      JSON.stringify(body.tags ?? []),
    ]
  );

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const db = getDb();

  await db.execute(
    `UPDATE clients
     SET name = ?, street = ?, number = ?, bloc = ?, apartment = ?,
         lat = ?, lng = ?, phone = ?, notes = ?, tags_json = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      body.name ?? null,
      body.street,
      body.number,
      body.bloc ?? null,
      body.apartment ?? null,
      body.lat,
      body.lng,
      body.phone ?? null,
      body.notes ?? null,
      JSON.stringify(body.tags ?? []),
      body.id,
    ]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getDb();
  await db.execute("DELETE FROM clients WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
