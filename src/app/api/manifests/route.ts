import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

interface ManifestRow {
  id: string;
  date: string;
  stops_json: string;
  sections_json: string;
}

export async function GET() {
  const db = getDb();
  const result = await db.execute("SELECT * FROM manifests ORDER BY date DESC");
  const rows = result.rows as unknown as ManifestRow[];

  const manifests = rows.map((r) => ({
    id: r.id,
    date: r.date,
    stops: JSON.parse(r.stops_json),
    sections: JSON.parse(r.sections_json || "[]"),
  }));

  return NextResponse.json(manifests);
}

export async function POST(request: Request) {
  const body = await request.json();
  const db = getDb();

  await db.execute(
    `INSERT INTO manifests (id, date, stops_json, sections_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [
      body.id,
      body.date,
      JSON.stringify(body.stops ?? []),
      JSON.stringify(body.sections ?? []),
    ]
  );

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const db = getDb();

  await db.execute(
    `UPDATE manifests
     SET date = ?, stops_json = ?, sections_json = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      body.date,
      JSON.stringify(body.stops ?? []),
      JSON.stringify(body.sections ?? []),
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
  await db.execute("DELETE FROM manifests WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
