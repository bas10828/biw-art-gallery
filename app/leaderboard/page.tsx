"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ARTWORKS } from "@/lib/artworks";

interface OverallRow {
  username: string;
  totalScore: number;
  plays: number;
}

interface ArtworkRow {
  username: string;
  artworkFile: string;
  artworkTitle: string;
  difficulty: number;
  bestScore: number;
  bestTime: number;
  plays: number;
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [overallRows, setOverallRows] = useState<OverallRow[]>([]);
  const [artworkRows, setArtworkRows] = useState<ArtworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [artFilter, setArtFilter] = useState("");
  const [diffFilter, setDiffFilter] = useState("");

  const isOverall = artFilter === "";

  async function load() {
    setLoading(true);
    try {
      if (isOverall) {
        const res = await fetch("/api/scores/jigsaw?mode=overall");
        if (res.ok) setOverallRows(await res.json());
      } else {
        const params = new URLSearchParams({ artwork: artFilter });
        if (diffFilter) params.set("difficulty", diffFilter);
        const res = await fetch(`/api/scores/jigsaw?${params}`);
        if (res.ok) setArtworkRows(await res.json());
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [artFilter, diffFilter]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <span
              className="inline-block text-gold text-xs tracking-[.2em] uppercase border rounded-full px-4 py-1.5 mb-5"
              style={{ borderColor: "rgba(212,168,67,.2)" }}
            >
              Hall of Fame
            </span>
            <h1
              className="font-bold mb-3"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(2rem,5vw,3.5rem)",
                background: "linear-gradient(135deg,var(--color-ink) 30%,var(--color-gold-light) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ลีดเดอร์บอร์ด
            </h1>
            <p className="text-ink2 text-sm">
              {isOverall ? "คะแนนรวมทุกภาพ · 1 คน = 1 แถว" : "คะแนนสูงสุดต่อภาพ"}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8 justify-center">
            <select
              value={artFilter}
              onChange={(e) => { setArtFilter(e.target.value); setDiffFilter(""); }}
              className="text-sm rounded-full px-4 py-2 border outline-none cursor-pointer"
              style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.2)", color: "var(--color-ink2)" }}
            >
              <option value="">คะแนนรวม (ทุกภาพ)</option>
              {ARTWORKS.map((a) => (
                <option key={a.file} value={a.file}>{a.title}</option>
              ))}
            </select>

            {!isOverall && (
              <select
                value={diffFilter}
                onChange={(e) => setDiffFilter(e.target.value)}
                className="text-sm rounded-full px-4 py-2 border outline-none cursor-pointer"
                style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.2)", color: "var(--color-ink2)" }}
              >
                <option value="">ทุกความยาก</option>
                <option value="3">3×3</option>
                <option value="4">4×4</option>
                <option value="5">5×5</option>
              </select>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(212,168,67,.15)" }}>

            {/* Header row */}
            <div
              className="grid text-[10px] tracking-[.15em] uppercase text-ink3 px-5 py-3"
              style={{
                background: "rgba(212,168,67,.05)",
                borderBottom: "1px solid rgba(212,168,67,.1)",
                gridTemplateColumns: isOverall
                  ? "2rem 1fr auto auto"
                  : diffFilter
                    ? "2rem 1fr auto auto"
                    : "2rem 1fr auto auto auto",
                gap: "0.75rem",
              }}
            >
              <div>#</div>
              <div>ผู้เล่น</div>
              {isOverall ? (
                <>
                  <div className="text-right">จำนวนเกม</div>
                  <div className="text-right">คะแนนรวม</div>
                </>
              ) : diffFilter ? (
                <>
                  <div className="text-right">เวลาดีสุด</div>
                  <div className="text-right">คะแนนสูงสุด</div>
                </>
              ) : (
                <>
                  <div className="text-right">ความยาก</div>
                  <div className="text-right">เวลาดีสุด</div>
                  <div className="text-right">คะแนนสูงสุด</div>
                </>
              )}
            </div>

            {loading ? (
              <div className="py-16 text-center text-ink3 text-sm">กำลังโหลด...</div>
            ) : (isOverall ? overallRows.length === 0 : artworkRows.length === 0) ? (
              <div className="py-16 text-center text-ink3 text-sm">ยังไม่มีข้อมูล</div>
            ) : isOverall ? (
              overallRows.map((r, i) => (
                <div
                  key={r.username}
                  className="grid px-5 py-3.5 items-center transition-colors duration-100"
                  style={{
                    gridTemplateColumns: "2rem 1fr auto auto",
                    gap: "0.75rem",
                    borderBottom: i < overallRows.length - 1 ? "1px solid rgba(212,168,67,.06)" : "none",
                    background: i < 3 ? `rgba(212,168,67,${0.03 - i * 0.008})` : "transparent",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(212,168,67,.04)")}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i < 3 ? `rgba(212,168,67,${0.03 - i * 0.008})` : "transparent"; }}
                >
                  <div className="text-sm font-bold text-ink3">{i < 3 ? MEDAL[i] : i + 1}</div>
                  <div className="font-semibold text-sm text-ink truncate" style={{ fontFamily: "var(--font-serif)" }}>{r.username}</div>
                  <div className="text-right text-xs text-ink2">{r.plays.toLocaleString()} เกม</div>
                  <div className="text-right font-bold text-sm" style={{ color: i === 0 ? "var(--color-gold-light)" : "var(--color-ink)" }}>
                    {r.totalScore.toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              artworkRows.map((r, i) => (
                <div
                  key={`${r.username}-${r.artworkFile}-${r.difficulty}`}
                  className="grid px-5 py-3.5 items-center transition-colors duration-100"
                  style={{
                    gridTemplateColumns: diffFilter ? "2rem 1fr auto auto" : "2rem 1fr auto auto auto",
                    gap: "0.75rem",
                    borderBottom: i < artworkRows.length - 1 ? "1px solid rgba(212,168,67,.06)" : "none",
                    background: i < 3 ? `rgba(212,168,67,${0.03 - i * 0.008})` : "transparent",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(212,168,67,.04)")}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i < 3 ? `rgba(212,168,67,${0.03 - i * 0.008})` : "transparent"; }}
                >
                  <div className="text-sm font-bold text-ink3">{i < 3 ? MEDAL[i] : i + 1}</div>
                  <div className="font-semibold text-sm text-ink truncate" style={{ fontFamily: "var(--font-serif)" }}>{r.username}</div>
                  {!diffFilter && (
                    <div className="text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(212,168,67,.1)", color: "var(--color-gold)" }}>
                        {r.difficulty}×{r.difficulty}
                      </span>
                    </div>
                  )}
                  <div className="text-right text-xs text-ink2 tabular-nums">{fmt(r.bestTime)}</div>
                  <div className="text-right font-bold text-sm" style={{ color: i === 0 ? "var(--color-gold-light)" : "var(--color-ink)" }}>
                    {r.bestScore.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 text-center">
            <a href="/game/jigsaw" className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-light transition-colors">
              ← เล่น Jigsaw
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
