"use client";
import { useState } from "react";

interface Props {
  onSuccess: (username: string) => void;
  onClose: () => void;
}

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "เกิดข้อผิดพลาด"); return; }
      localStorage.setItem("biw_user", JSON.stringify({ username: data.username, token: data.token }));
      document.cookie = `token=${data.token}; path=/; max-age=${7 * 86400}`;
      onSuccess(data.username);
    } catch {
      setError("เชื่อมต่อไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-10 text-center"
        style={{
          background: "var(--color-bg3)",
          border: "1px solid rgba(212,168,67,.3)",
          boxShadow: "0 32px 80px rgba(0,0,0,.8)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-ink2 hover:text-ink text-sm"
          style={{ border: "1px solid rgba(212,168,67,.15)" }}
        >
          ✕
        </button>

        <div className="text-4xl mb-4">🎮</div>
        <h2 className="text-xl font-bold mb-2 text-ink" style={{ fontFamily: "var(--font-serif)" }}>
          {tab === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </h2>

        {/* tabs */}
        <div className="flex rounded-lg overflow-hidden mb-6 text-sm" style={{ border: "1px solid rgba(212,168,67,.15)" }}>
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className="flex-1 py-2 font-medium transition-colors"
              style={{
                background: tab === t ? "rgba(212,168,67,.15)" : "transparent",
                color: tab === t ? "var(--color-gold)" : "var(--color-ink2)",
              }}
            >
              {t === "login" ? "เข้าสู่ระบบ" : "สมัครใหม่"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ชื่อผู้ใช้"
            maxLength={20}
            required
            className="w-full rounded-lg px-4 py-3 text-center text-sm text-ink placeholder-ink3 focus:outline-none"
            style={{
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(212,168,67,.2)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.7)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.2)")}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน (≥4 ตัวอักษร)"
            minLength={4}
            required
            className="w-full rounded-lg px-4 py-3 text-center text-sm text-ink placeholder-ink3 focus:outline-none"
            style={{
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(212,168,67,.2)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.7)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(212,168,67,.2)")}
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#d4a843 0%,#b88a28 100%)", color: "#1a1000" }}
          >
            {loading ? "กำลังโหลด..." : tab === "login" ? "เข้าสู่ระบบ ✦" : "สมัครสมาชิก ✦"}
          </button>
        </form>
      </div>
    </div>
  );
}
