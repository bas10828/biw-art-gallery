import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

function calcScore(difficulty: number, timeSec: number, moves: number) {
  const base: Record<number, number> = { 3: 1000, 4: 3000, 5: 6000 };
  return Math.max(50, (base[difficulty] ?? 1000) - timeSec * 3 - moves * 5);
}

// POST — save score
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.split(" ")[1];
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { username } = verifyToken(token);
    const { artworkFile, artworkTitle, difficulty, timeSec, moves } = await req.json();
    if (!artworkFile || ![3, 4, 5].includes(difficulty) || !Number.isInteger(timeSec) || timeSec < 1)
      return NextResponse.json({ error: "invalid" }, { status: 400 });

    const score = calcScore(difficulty, timeSec, moves ?? 0);
    await pool.query(
      "INSERT INTO jigsaw_scores (username,artwork_file,artwork_title,difficulty,time_sec,moves,score) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [username, artworkFile, artworkTitle ?? artworkFile, difficulty, timeSec, moves ?? 0, score]
    );
    return NextResponse.json({ ok: true, score });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

// GET — leaderboard
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artworkFile = searchParams.get("artwork") ?? undefined;
  const difficulty = searchParams.get("difficulty") ?? undefined;

  try {
    let query = `
      SELECT username, artwork_file, artwork_title, difficulty,
             MAX(score) AS best_score, MIN(time_sec) AS best_time, COUNT(*) AS plays
      FROM jigsaw_scores
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    if (artworkFile) { params.push(artworkFile); conditions.push(`artwork_file=$${params.length}`); }
    if (difficulty) { params.push(parseInt(difficulty)); conditions.push(`difficulty=$${params.length}`); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " GROUP BY username, artwork_file, artwork_title, difficulty ORDER BY best_score DESC LIMIT 50";

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows.map((r) => ({
      username: r.username,
      artworkFile: r.artwork_file,
      artworkTitle: r.artwork_title,
      difficulty: r.difficulty,
      bestScore: parseInt(r.best_score),
      bestTime: parseInt(r.best_time),
      plays: parseInt(r.plays),
    })));
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
