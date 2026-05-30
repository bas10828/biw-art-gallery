"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { io, Socket } from "socket.io-client";

declare global { interface Window { __biwSocket?: Socket } }

interface RoomSummary {
  code: string;
  roomName: string;
  hostName: string;
  playerCount: number;
  humanCount: number;
  botCount: number;
  locked: boolean;
  phase: string;
}

function getSocket() {
  if (!window.__biwSocket || window.__biwSocket.disconnected) {
    window.__biwSocket = io({ transports: ["websocket", "polling"] });
  }
  return window.__biwSocket;
}

export default function BombermanLobby() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("biw_user");
    if (stored) {
      const u = JSON.parse(stored);
      setUser(u.username ?? null);
      setName(u.username ?? "");
    }
    // auto-fill join code from URL
    const joinParam = new URLSearchParams(window.location.search).get("join");
    if (joinParam) setJoinCode(joinParam.toUpperCase());
  }, []);

  useEffect(() => {
    const s = getSocket();
    s.emit("listRooms");
    s.on("roomList", (list: RoomSummary[]) => setRooms(list));
    s.on("roomListUpdate", (list: RoomSummary[]) => setRooms(list));
    return () => { s.off("roomList"); s.off("roomListUpdate"); };
  }, []);

  function handleCreate() {
    if (!name.trim()) return setError("ใส่ชื่อก่อน");
    setLoading(true);
    const s = getSocket();
    s.emit("createRoom", { name: name.trim(), roomName: roomName.trim() || `ห้องของ ${name.trim()}` });
    s.once("roomCreated", (room: any) => {
      setLoading(false);
      router.push(`/bomberman/room/${room.code}?name=${encodeURIComponent(name.trim())}`);
    });
  }

  function handleJoin(code: string) {
    if (!name.trim()) return setError("ใส่ชื่อก่อน");
    setLoading(true);
    const s = getSocket();
    s.emit("joinRoom", { code: code.toUpperCase(), name: name.trim() });
    s.once("roomJoined", (room: any) => {
      setLoading(false);
      router.push(`/bomberman/room/${room.code}?name=${encodeURIComponent(name.trim())}`);
    });
    s.once("joinedAsSpectator", (room: any) => {
      setLoading(false);
      router.push(`/bomberman/room/${room.code}?name=${encodeURIComponent(name.trim())}&spectator=1`);
    });
    s.once("joinError", (msg: string) => { setLoading(false); setError(msg); });
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pt-28 pb-16">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="inline-block text-gold text-xs tracking-[.2em] uppercase border rounded-full px-4 py-1.5 mb-4"
              style={{ borderColor: "rgba(212,168,67,.2)" }}>Mini Game</span>
            <h1 className="font-bold leading-tight mb-1"
              style={{
                fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem,5vw,2.8rem)",
                background: "linear-gradient(135deg,#ffffff 30%,var(--color-gold-light) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>ระเบิดโคตรเสียว</h1>
            <p className="text-ink2 text-sm">4 ผู้เล่น · ออนไลน์ · มีบอท</p>
          </div>

          {/* Name input */}
          <div
            className="rounded-2xl p-5 border mb-4"
            style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.15)" }}
          >
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

          {/* Create room */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 mb-4"
              style={{ background: "rgba(212,168,67,.12)", border: "1px solid rgba(212,168,67,.3)", color: "var(--color-gold-light)" }}
            >
              + สร้างห้องใหม่
            </button>
          ) : (
            <div className="rounded-2xl border p-4 mb-4 flex flex-col gap-3"
              style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.2)" }}>
              <p className="text-gold text-xs tracking-widest uppercase">สร้างห้อง</p>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={24}
                placeholder={`ห้องของ ${name || "..."}`}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-ink border outline-none focus:border-gold transition-colors"
                style={{ borderColor: "rgba(212,168,67,.25)", background: "rgba(0,0,0,.2)" }}
              />
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,rgba(212,168,67,.25),rgba(212,168,67,.1))", border: "1px solid rgba(212,168,67,.4)", color: "var(--color-gold-light)" }}>
                  สร้าง
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "var(--color-ink2)" }}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Join by code */}
          <div className="flex gap-2 mb-6">
            <input
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
              maxLength={4}
              placeholder="CODE"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-ink text-center font-mono tracking-[.3em] border outline-none focus:border-gold transition-colors"
              style={{ borderColor: "rgba(212,168,67,.25)", background: "rgba(0,0,0,.2)" }}
            />
            <button onClick={() => handleJoin(joinCode)} disabled={loading || !joinCode.trim()}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ background: "rgba(96,165,250,.12)", border: "1px solid rgba(96,165,250,.3)", color: "#93c5fd" }}>
              เข้าห้อง
            </button>
          </div>

          {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

          {/* Room list */}
          <div>
            <p className="text-ink3 text-xs uppercase tracking-widest mb-3">ห้องที่เปิดอยู่</p>
            {rooms.length === 0 ? (
              <p className="text-ink3 text-sm text-center py-6">ยังไม่มีห้อง — สร้างห้องแรกเลย</p>
            ) : (
              <div className="flex flex-col gap-2">
                {rooms.map((r) => (
                  <div key={r.code}
                    className="rounded-xl border p-3 flex items-center justify-between gap-3"
                    style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.12)" }}>
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-semibold truncate">{r.roomName}</p>
                      <p className="text-ink3 text-xs mt-0.5">
                        โดย {r.hostName} ·{" "}
                        <span style={{ color: "#60a5fa" }}>{r.humanCount} คน</span>
                        {r.botCount > 0 && <span style={{ color: "#c084fc" }}> + {r.botCount} บอท</span>}
                        {" "}/ 4
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-gold text-xs tracking-widest">{r.code}</span>
                      <button
                        onClick={() => handleJoin(r.code)}
                        disabled={loading || r.playerCount >= 4}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40"
                        style={{ background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.3)", color: "#4ade80" }}
                      >
                        {r.playerCount >= 4 ? "เต็ม" : "เข้าร่วม"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-ink3 text-xs mt-8">
            <a href="/game" className="hover:text-gold transition-colors">← กลับ</a>
          </p>
        </div>
      </main>
    </>
  );
}
