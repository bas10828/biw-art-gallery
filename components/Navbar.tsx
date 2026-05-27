"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("biw_user");
    if (u) setUser(JSON.parse(u).username);
  }, []);

  function logout() {
    localStorage.removeItem("biw_user");
    document.cookie = "token=; max-age=0; path=/";
    setUser(null);
    window.location.reload();
  }

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 sm:px-8 py-3"
      style={{
        background: "linear-gradient(180deg,rgba(8,8,8,.97) 0%,rgba(8,8,8,.8) 100%)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(212,168,67,.12)",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
        <Image
          src="/images/logo-khodseaw.jfif"
          alt="Biw Art Gallery"
          width={40}
          height={40}
          className="rounded-full object-cover"
          style={{ border: "1.5px solid rgba(212,168,67,.4)" }}
        />
        <span
          className="hidden sm:block text-gold font-bold tracking-widest text-base"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Biw <span className="text-ink">Art</span>
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-3">
        {user && (
          <>
            {/* Username — desktop only */}
            <span className="hidden sm:inline text-gold text-sm truncate max-w-[120px]">
              ✦ {user}
            </span>
            {/* Logout — icon on mobile, text on desktop */}
            <button
              onClick={logout}
              title="ออกจากระบบ"
              className="flex items-center justify-center rounded-full transition-colors text-ink2 hover:text-ink"
              style={{
                border: "1px solid rgba(212,168,67,.2)",
                width: 32,
                height: 32,
                fontSize: 13,
              }}
            >
              ✕
            </button>
          </>
        )}

        {/* Mini Games — icon only on mobile, full on desktop */}
        <Link
          href="/game"
          className="flex items-center gap-1.5 rounded-full font-bold transition-all hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg,#d4a843 0%,#b88a28 100%)",
            color: "#1a1000",
            padding: "7px 14px",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(212,168,67,.4)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.boxShadow = "none")
          }
        >
          <span className="text-base leading-none">🎮</span>
          <span className="hidden sm:inline text-sm">Mini Games</span>
        </Link>
      </div>
    </nav>
  );
}
