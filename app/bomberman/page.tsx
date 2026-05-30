"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { io, Socket } from "socket.io-client";

declare global { interface Window { __biwSocket?: Socket } }

export default function BombermanLobby() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("biw_user");
    if (stored) {
      const u = JSON.parse(stored);
      setUser(u.username ?? null);
      setName(u.username ?? "");
    }
    return () => {}; // keep socket alive for room page
  }, []);

  function getSocket() {
    if (!window.__biwSocket || window.__biwSocket.disconnected) {
      window.__biwSocket = io({ transports: ["websocket", "polling"] });
    }
    return window.__biwSocket;
  }

  function handleCreate() {
    if (!name.trim()) return setError("ใส่ชื่อก่อน");
    setLoading(true);
    const s = getSocket();
    s.emit("createRoom", { name: name.trim() });
    s.once("roomCreated", (room) => {
      setLoading(false);
      router.push(`/bomberman/room/${room.code}?name=${encodeURIComponent(name.trim())}`);
    });
  }

  function handleJoin() {
    if (!name.trim()) return setError("ใส่ชื่อก่อน");
    if (!joinCode.trim()) return setError("ใส่ code ห้อง");
    setLoading(true);
    const s = getSocket();
    s.emit("joinRoom", { code: joinCode.trim().toUpperCase(), name: name.trim() });
    s.once("roomJoined", (room) => {
      setLoading(false);
      router.push(`/bomberman/room/${room.code}?name=${encodeURIComponent(name.trim())}`);
    });
    s.once("joinedAsSpectator", (room) => {
      setLoading(false);
      router.push(`/bomberman/room/${room.code}?name=${encodeURIComponent(name.trim())}&spectator=1`);
    });
    s.once("joinError", (msg) => {
      setLoading(false);
      setError(msg);
    });
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-6 pt-24 pb-16">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-10">
            <span
              className="inline-block text-gold text-xs tracking-[.2em] uppercase border rounded-full px-4 py-1.5 mb-4"
              style={{ borderColor: "rgba(212,168,67,.2)" }}
            >
              Mini Game
            </span>
            <h1
              className="font-bold leading-tight mb-2"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(2rem,6vw,3rem)",
                background: "linear-gradient(135deg,#ffffff 30%,var(--color-gold-light) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ระเบิดโคตรเสียว
            </h1>
            <p className="text-ink2 text-sm">4 ผู้เล่น · ออนไลน์ · มีบอท</p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8 border flex flex-col gap-6"
            style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.15)" }}
          >
            {/* Name input */}
            <div>
              <label className="text-ink2 text-xs mb-2 block tracking-wide uppercase">ชื่อผู้เล่น</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                maxLength={16}
                placeholder="ใส่ชื่อ..."
                className="w-full px-4 py-2.5 rounded-xl text-sm text-ink bg-transparent border outline-none focus:border-gold transition-colors"
                style={{ borderColor: "rgba(212,168,67,.25)", background: "rgba(0,0,0,.2)" }}
              />
            </div>

            <div
              className="w-full h-px"
              style={{ background: "linear-gradient(90deg,transparent,rgba(212,168,67,.2),transparent)" }}
            />

            {/* Create */}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg,rgba(212,168,67,.2),rgba(212,168,67,.08))",
                border: "1px solid rgba(212,168,67,.3)",
                color: "var(--color-gold-light)",
              }}
            >
              + สร้างห้องใหม่
            </button>

            {/* Join */}
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
                maxLength={4}
                placeholder="CODE"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-ink text-center font-mono tracking-[.3em] border outline-none focus:border-gold transition-colors"
                style={{ borderColor: "rgba(212,168,67,.25)", background: "rgba(0,0,0,.2)" }}
              />
              <button
                onClick={handleJoin}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#60a5fa22,#60a5fa11)",
                  border: "1px solid rgba(96,165,250,.3)",
                  color: "#93c5fd",
                }}
              >
                เข้าห้อง
              </button>
            </div>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>

          <p className="text-center text-ink3 text-xs mt-6">
            <a href="/game" className="hover:text-gold transition-colors">← กลับ</a>
          </p>
        </div>
      </main>
    </>
  );
}
