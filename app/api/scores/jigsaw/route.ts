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
  const mode = searchParams.get("mode");
  const artworkFile = searchParams.get("artwork") ?? undefined;
  const difficulty = searchParams.get("difficulty") ?? undefined;
  const rankFor = searchParams.get("rankFor") ?? undefined;

  try {
    // Rank query: return rank of a specific user for a specific artwork+difficulty
    if (rankFor && artworkFile && difficulty) {
      const { rows } = await pool.query(
        `SELECT (COUNT(*)::int + 1) AS rank
         FROM (
           SELECT username, MAX(score) AS best_score
           FROM jigsaw_scores
           WHERE artwork_file = $1 AND difficulty = $2
           GROUP BY username
         ) sub
         WHERE best_score > COALESCE(
           (SELECT MAX(score) FROM jigsaw_scores WHERE artwork_file = $1 AND difficulty = $2 AND username = $3),
           0
         )`,
        [artworkFile, parseInt(difficulty), rankFor]
      );
      return NextResponse.json({ rank: rows[0]?.rank ?? 1 });
    }

    // Overall: sum all scores per user across all artworks
    if (mode === "overall") {
      const { rows } = await pool.query(`
        SELECT username,
               SUM(score)::int AS total_score,
               COUNT(*)::int   AS plays
        FROM jigsaw_scores
        GROUP BY username
        ORDER BY total_score DESC
        LIMIT 100
      `);
      return NextResponse.json(rows.map((r) => ({
        username: r.username,
        totalScore: r.total_score,
        plays: r.plays,
      })));
    }

    // Per artwork / difficulty: best score per user per artwork+difficulty combo
    let query = `
      SELECT username, artwork_file, artwork_title, difficulty,
             MAX(score)::int    AS best_score,
             MIN(time_sec)::int AS best_time,
             COUNT(*)::int      AS plays
      FROM jigsaw_scores
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    if (artworkFile) { params.push(artworkFile); conditions.push(`artwork_file=$${params.length}`); }
    if (difficulty)  { params.push(parseInt(difficulty)); conditions.push(`difficulty=$${params.length}`); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " GROUP BY username, artwork_file, artwork_title, difficulty ORDER BY best_score DESC LIMIT 100";

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows.map((r) => ({
      username: r.username,
      artworkFile: r.artwork_file,
      artworkTitle: r.artwork_title,
      difficulty: r.difficulty,
      bestScore: r.best_score,
      bestTime: r.best_time,
      plays: r.plays,
    })));
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
