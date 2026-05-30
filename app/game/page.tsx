"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";

const GAMES = [
  {
    id: "jigsaw",
    title: "Jigsaw Puzzle",
    titleTh: "จิ๊กซอว์",
    desc: "ต่อภาพผลงานศิลปะให้สมบูรณ์ วัดความเร็วและความแม่นยำ",
    icon: "✦",
    href: "/game/jigsaw",
    difficulties: "3×3 · 4×4 · 5×5",
  },
  {
    id: "bomberman",
    title: "ระเบิดโคตรเสียว",
    titleTh: "ระเบิดโคตรเสียว",
    desc: "วางระเบิดทำลายศัตรู เอาชีวิตรอดให้นานที่สุด สู้กัน 4 คน online",
    icon: "💣",
    href: "/bomberman",
    difficulties: "2-4 ผู้เล่น · มีบอท · Online",
  },
];

export default function GameHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("biw_user");
    if (stored) setUser(JSON.parse(stored).username ?? null);
  }, []);

  function handleLogin(username: string) {
    setUser(username);
    setShowAuth(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  }

  function enterGame(href: string) {
    if (!user) {
      setPendingHref(href);
      setShowAuth(true);
    } else {
      router.push(href);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-14">
            <span
              className="inline-block text-gold text-xs tracking-[.2em] uppercase border rounded-full px-4 py-1.5 mb-5"
              style={{ borderColor: "rgba(212,168,67,.2)" }}
            >
              Mini Games
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
              เลือกเกม
            </h1>
            <p className="text-ink2 text-sm">
              {user ? (
                <>สวัสดี <span className="text-gold-light">{user}</span> · เลือกเกมที่ต้องการเล่น</>
              ) : (
                "ล็อคอินเพื่อบันทึกสถิติและขึ้นลีดเดอร์บอร์ด"
              )}
            </p>
          </div>

          {/* Game Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {GAMES.map((g) => (
              <div
                key={g.id}
                onClick={() => enterGame(g.href)}
                className="group cursor-pointer rounded-2xl p-7 border transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "var(--color-bg3)",
                  borderColor: "rgba(212,168,67,.15)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.45)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(0,0,0,.5)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.15)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div className="flex items-start gap-5">
                  <div
                    className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: "rgba(212,168,67,.08)", border: "1px solid rgba(212,168,67,.2)" }}
                  >
                    {g.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h2
                        className="font-bold text-xl text-ink"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {g.titleTh}
                      </h2>
                      <span className="text-xs text-ink3">{g.title}</span>
                    </div>
                    <p className="text-sm text-ink2 mb-3">{g.desc}</p>
                    <span
                      className="inline-block text-xs px-2.5 py-0.5 rounded-full"
                      style={{ background: "rgba(212,168,67,.1)", color: "var(--color-gold)" }}
                    >
                      {g.difficulties}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: "rgba(212,168,67,.1)" }}>
                  <span className="text-xs text-ink3">คลิกเพื่อเล่น</span>
                  <span className="text-gold-light group-hover:translate-x-1 transition-transform duration-200">→</span>
                </div>
              </div>
            ))}

            {/* Placeholder for future games */}
            <div
              className="rounded-2xl p-7 border flex flex-col items-center justify-center text-center gap-2 opacity-40"
              style={{
                background: "var(--color-bg3)",
                borderColor: "rgba(212,168,67,.1)",
                borderStyle: "dashed",
                minHeight: 180,
              }}
            >
              <span className="text-3xl text-ink3">+</span>
              <p className="text-sm text-ink3">เกมใหม่กำลังมา</p>
            </div>
          </div>

          {/* Leaderboard link */}
          <div className="mt-12 text-center">
            <a
              href="/leaderboard"
              className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-light transition-colors"
            >
              <span>ดูลีดเดอร์บอร์ด</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </main>

      <Footer />

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onSuccess={handleLogin} />
      )}
    </>
  );
}
