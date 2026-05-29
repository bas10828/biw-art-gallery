"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";
import JigsawGame from "@/components/games/JigsawGame";
import { ARTWORKS, type Artwork } from "@/lib/artworks";

type Phase = "select-art" | "select-diff" | "playing" | "result";

interface Result {
  timeSec: number;
  moves: number;
  score: number;
  saved: boolean;
}

interface MiniBoard {
  top3: { username: string; bestScore: number; bestTime: number }[];
  myRank: number | null;
}

const DIFFICULTIES = [
  { n: 3, label: "3×3", desc: "9 ชิ้น · ง่าย" },
  { n: 4, label: "4×4", desc: "16 ชิ้น · ปานกลาง" },
  { n: 5, label: "5×5", desc: "25 ชิ้น · ยาก" },
];

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function JigsawPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("select-art");
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [n, setN] = useState(3);
  const [result, setResult] = useState<Result | null>(null);
  const [miniboard, setMiniboard] = useState<MiniBoard | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("biw_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed.username ?? null);
      setToken(parsed.token ?? null);
    }
  }, []);

  function handleLogin(username: string) {
    setUser(username);
    const stored = localStorage.getItem("biw_user");
    if (stored) setToken(JSON.parse(stored).token ?? null);
    setShowAuth(false);
  }

  const handleComplete = useCallback(
    async (timeSec: number, moves: number, score: number) => {
      let saved = false;
      const stored = localStorage.getItem("biw_user");
      const currentToken = stored ? JSON.parse(stored).token : null;
      if (currentToken && artwork) {
        try {
          const res = await fetch("/api/scores/jigsaw", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentToken}`,
            },
            body: JSON.stringify({
              artworkFile: artwork.file,
              artworkTitle: artwork.title,
              difficulty: n,
              timeSec,
              moves,
            }),
          });
          saved = res.ok;
        } catch {}
      }
      setResult({ timeSec, moves, score, saved });
      setPhase("result");

      // Fetch top 3 + player rank for this artwork + difficulty
      if (artwork) {
        try {
          const params = new URLSearchParams({ artwork: artwork.file, difficulty: String(n) });
          const boardRes = await fetch(`/api/scores/jigsaw?${params}`);
          const board = boardRes.ok ? await boardRes.json() : [];
          const top3 = board.slice(0, 3);

          let myRank: number | null = null;
          const stored2 = localStorage.getItem("biw_user");
          const uname = stored2 ? JSON.parse(stored2).username : null;
          if (uname) {
            const rankRes = await fetch(`/api/scores/jigsaw?artwork=${artwork.file}&difficulty=${n}&rankFor=${uname}`);
            if (rankRes.ok) { const d = await rankRes.json(); myRank = d.rank ?? null; }
          }
          setMiniboard({ top3, myRank });
        } catch {}
      }
    },
    [artwork, n]
  );

  function restart() {
    setPhase("select-art");
    setArtwork(null);
    setResult(null);
    setMiniboard(null);
  }

  function playAgain() {
    setResult(null);
    setPhase("playing");
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-28 pb-24 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Back button */}
          <button
            onClick={() => phase === "playing" ? restart() : router.push("/game")}
            className="mb-8 flex items-center gap-1.5 text-sm text-ink3 hover:text-gold transition-colors"
          >
            ← {phase === "playing" ? "เลือกใหม่" : "กลับ"}
          </button>

          {/* === SELECT ARTWORK === */}
          {phase === "select-art" && (
            <div>
              <div className="text-center mb-10">
                <h1
                  className="font-bold text-3xl text-ink mb-2"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  เลือกภาพ
                </h1>
                <p className="text-ink2 text-sm">เลือกผลงานที่ต้องการเล่น Jigsaw</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {ARTWORKS.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => { setArtwork(art); setPhase("select-diff"); }}
                    className="group cursor-pointer rounded-xl overflow-hidden border transition-all duration-200 hover:-translate-y-1"
                    style={{
                      background: "var(--color-bg3)",
                      borderColor: "rgba(212,168,67,.12)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.4)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(0,0,0,.5)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.12)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={`/images/${art.file}`}
                        alt={art.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width:640px) 50vw,33vw"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold text-ink truncate" style={{ fontFamily: "var(--font-serif)" }}>
                        {art.title}
                      </p>
                      <p className="text-[10px] text-ink3">{art.year}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === SELECT DIFFICULTY === */}
          {phase === "select-diff" && artwork && (
            <div>
              <div className="text-center mb-10">
                <h1 className="font-bold text-3xl text-ink mb-2" style={{ fontFamily: "var(--font-serif)" }}>
                  เลือกความยาก
                </h1>
                <p className="text-ink2 text-sm">{artwork.title}</p>
              </div>
              <div className="flex justify-center mb-10">
                <div
                  className="relative w-48 h-36 rounded-xl overflow-hidden border"
                  style={{ borderColor: "rgba(212,168,67,.3)" }}
                >
                  <Image
                    src={`/images/${artwork.file}`}
                    alt={artwork.title}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.n}
                    onClick={() => { setN(d.n); setPhase("playing"); }}
                    className="rounded-xl p-4 text-center border transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background: "var(--color-bg3)",
                      borderColor: "rgba(212,168,67,.2)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.5)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(212,168,67,.15)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.2)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div className="font-bold text-xl text-gold-light mb-1" style={{ fontFamily: "var(--font-serif)" }}>
                      {d.label}
                    </div>
                    <div className="text-[10px] text-ink3">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === PLAYING === */}
          {phase === "playing" && artwork && (
            <JigsawGame artwork={artwork} n={n} onComplete={handleComplete} />
          )}

          {/* === RESULT === */}
          {phase === "result" && result && artwork && (
            <div className="text-center">
              <div className="mb-8">
                <div
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5 text-3xl"
                  style={{ background: "rgba(212,168,67,.08)", border: "2px solid rgba(212,168,67,.3)" }}
                >
                  ✦
                </div>
                <h1 className="font-bold text-3xl text-ink mb-1" style={{ fontFamily: "var(--font-serif)" }}>
                  สำเร็จ!
                </h1>
                <p className="text-ink2 text-sm">{artwork.title} · {n}×{n}</p>
              </div>

              {/* Score card */}
              <div
                className="inline-grid grid-cols-3 gap-8 rounded-2xl px-10 py-7 mb-6"
                style={{ background: "var(--color-bg3)", border: "1px solid rgba(212,168,67,.2)" }}
              >
                {[
                  { label: "คะแนน", val: result.score.toLocaleString(), big: true },
                  { label: "เวลา", val: fmt(result.timeSec) },
                  { label: "การเคลื่อน", val: result.moves },
                ].map(({ label, val, big }) => (
                  <div key={label}>
                    <div className="text-[10px] tracking-[.15em] uppercase text-ink3 mb-1">{label}</div>
                    <div
                      className={`font-bold ${big ? "text-3xl text-gold-light" : "text-xl text-ink"}`}
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini leaderboard */}
              {miniboard && miniboard.top3.length > 0 && (
                <div className="w-full max-w-xs mx-auto mb-6">
                  <p className="text-[10px] tracking-[.2em] uppercase text-ink3 mb-3 text-center">
                    อันดับ — {artwork.title} · {n}×{n}
                  </p>
                  <div
                    className="rounded-xl overflow-hidden border"
                    style={{ borderColor: "rgba(212,168,67,.15)" }}
                  >
                    {miniboard.top3.map((r, i) => {
                      const isMe = r.username === user;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-2.5 text-sm"
                          style={{
                            borderBottom: i < miniboard.top3.length - 1 ? "1px solid rgba(212,168,67,.07)" : "none",
                            background: isMe ? "rgba(212,168,67,.08)" : i < 3 ? `rgba(212,168,67,${0.03 - i * 0.008})` : "transparent",
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-5 text-center">{["🥇","🥈","🥉"][i]}</span>
                            <span className={`font-semibold truncate max-w-[100px] ${isMe ? "text-gold-light" : "text-ink"}`} style={{ fontFamily: "var(--font-serif)" }}>
                              {r.username}{isMe ? " ★" : ""}
                            </span>
                          </span>
                          <span className="font-bold tabular-nums" style={{ color: i === 0 ? "var(--color-gold-light)" : "var(--color-ink2)" }}>
                            {r.bestScore.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {miniboard.myRank !== null && miniboard.myRank > 3 && (
                    <p className="text-center text-xs text-gold mt-2">
                      คุณอยู่อันดับที่ {miniboard.myRank}
                    </p>
                  )}
                </div>
              )}

              {/* Save status */}
              {!user ? (
                <div className="mb-5 text-sm text-ink3">
                  <button onClick={() => setShowAuth(true)} className="text-gold hover:text-gold-light underline underline-offset-2">
                    ล็อคอิน
                  </button>{" "}
                  เพื่อบันทึกคะแนน
                </div>
              ) : result.saved ? (
                <div className="mb-5 text-sm text-green-400/70">✓ บันทึกคะแนนแล้ว</div>
              ) : (
                <div className="mb-5 text-sm text-ink3/60">ไม่สามารถบันทึกคะแนนได้</div>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={playAgain}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200"
                  style={{ background: "rgba(212,168,67,.15)", color: "var(--color-gold-light)", border: "1px solid rgba(212,168,67,.3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,168,67,.25)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(212,168,67,.15)")}
                >
                  เล่นอีกครั้ง
                </button>
                <button
                  onClick={restart}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 text-ink2 border"
                  style={{ borderColor: "rgba(212,168,67,.15)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.15)")}
                >
                  เลือกภาพใหม่
                </button>
                <a
                  href="/leaderboard"
                  className="px-6 py-2.5 rounded-full text-sm font-semibold text-ink3 border transition-all duration-200"
                  style={{ borderColor: "rgba(212,168,67,.1)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.1)")}
                >
                  ลีดเดอร์บอร์ด
                </a>
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onSuccess={handleLogin} />
      )}
    </>
  );
}
