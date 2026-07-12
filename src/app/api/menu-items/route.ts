import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export async function GET() {
  const db = await getDb();
  const result = await db.execute("SELECT * FROM menu_items ORDER BY date DESC");
  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const db = await getDb();

  await db.execute(
    `INSERT INTO menu_items (id, name, description, date, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [body.id, body.name, body.description ?? null, body.date]
  );

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const db = await getDb();

  await db.execute(
    `UPDATE menu_items
     SET name = ?, description = ?, date = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [body.name, body.description ?? null, body.date, body.id]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = await getDb();
  await db.execute("DELETE FROM menu_items WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
