import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username?.trim() || !password)
    return NextResponse.json({ error: "กรุณากรอกชื่อและรหัสผ่าน" }, { status: 400 });

  try {
    const r = await pool.query("SELECT * FROM users WHERE username=$1", [username.trim()]);
    if (!r.rows.length)
      return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    const ok = await bcrypt.compare(password, r.rows[0].password);
    if (!ok)
      return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    const token = signToken(username.trim());
    return NextResponse.json({ token, username: username.trim() });
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
