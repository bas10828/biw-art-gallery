import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username?.trim() || !password)
    return NextResponse.json({ error: "กรุณากรอกชื่อและรหัสผ่าน" }, { status: 400 });
  if (username.trim().length > 20)
    return NextResponse.json({ error: "ชื่อยาวเกิน 20 ตัวอักษร" }, { status: 400 });
  if (password.length < 4)
    return NextResponse.json({ error: "รหัสผ่านสั้นเกิน 4 ตัวอักษร" }, { status: 400 });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2)",
      [username.trim(), hash]
    );
    const token = signToken(username.trim());
    return NextResponse.json({ token, username: username.trim() });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505")
      return NextResponse.json({ error: "ชื่อนี้ถูกใช้แล้ว" }, { status: 409 });
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
