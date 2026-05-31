"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import type { RoomInfo, BombermanPlayer } from "@/lib/bomberman/types";
import BombermanGame from "@/components/bomberman/BombermanGame";

const PLAYER_COLORS = ["#60a5fa", "#f87171", "#4ade80", "#c084fc"];
const SLOT_LABELS = ["มุมซ้ายบน", "มุมขวาบน", "มุมซ้ายล่าง", "มุมขวาล่าง"];

declare global { interface Window { __biwSocket?: Socket } }

function getSocket() {
  if (typeof window === 'undefined') return null as any;
  if (!window.__biwSocket || window.__biwSocket.disconnected) {
    window.__biwSocket = io({ transports: ["websocket", "polling"] });
  }
  return window.__biwSocket;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params.code as string).toUpperCase();
  const name = searchParams.get("name") || "Player";
  const isSpectator = searchParams.get("spectator") === "1";

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [phase, setPhase] = useState<"lobby" | "countdown" | "playing" | "ended">("lobby");
  const [countdown, setCountdown] = useState(0);
  const [myId, setMyId] = useState("");
  const [error, setError] = useState("");
  const [gameData, setGameData] = useState<any>(null);
  const [winner, setWinner] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [gameStats, setGameStats] = useState<{ id: string; name: string; slot: number; isBot: boolean; alive: boolean; kills: number }[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    setMyId(s.id || "");

    s.on("connect", () => {
      setMyId(s.id || "");
      // reconnected after disconnect — try to rejoin
      if (!isSpectator) s.emit("rejoinRoom", { code, name });
    });

    // Try to get current room state (socket still connected from lobby)
    if (isSpectator) {
      // already joined as spectator upstream, just listen
    } else if (s.connected) {
      s.emit("getRoom", { code });
    } else {
      s.emit("rejoinRoom", { code, name });
    }

    s.on("roomJoined", (r: RoomInfo) => { setRoom(r); setPhase("lobby"); });
    s.on("roomUpdated", (r: RoomInfo) => { setRoom(r); });
    s.on("joinError", (msg: string) => setError(msg));

    s.on("countdown", ({ seconds }: { seconds: number }) => {
      setPhase("countdown");
      setCountdown(seconds);
    });

    s.on("gameStarted", ({ gameState, roomInfo }: any) => {
      setRoom(roomInfo);
      setGameData(gameState);
      setPhase("playing");
    });

    s.on("gameOver", ({ winner: w, stats }: any) => {
      setWinner(w);
      if (stats) setGameStats(stats);
      setPhase("ended");
    });

    s.on("rematch", (r: RoomInfo) => {
      setRoom(r);
      setGameData(null);
      setWinner(undefined);
      setPhase("lobby");
    });

    s.on("playerDisconnected", ({ name: dName }: any) => {
      // just visual — room update handles slots
    });

    return () => {
      s.off("roomJoined"); s.off("roomUpdated"); s.off("joinError");
      s.off("countdown"); s.off("gameStarted"); s.off("gameOver");
      s.off("rematch"); s.off("playerDisconnected"); s.off("connect");
    };
  }, [code, name, isSpectator]);

  function isHost() { return room?.hostId === myId; }
  function myPlayer() { return room?.players.find((p) => p.id === myId); }
  function amReady() { return myPlayer()?.ready ?? false; }

  function toggleReady() {
    socketRef.current?.emit("setReady", { code, ready: !amReady() });
  }
  function toggleLock() {
    socketRef.current?.emit("toggleLock", { code });
  }
  function addBot() {
    socketRef.current?.emit("addBot", { code });
  }
  function removeBot() {
    socketRef.current?.emit("removeBot", { code });
  }
  function startGame() {
    socketRef.current?.emit("startGame", { code });
  }
  function leaveRoom() {
    socketRef.current?.emit("leaveRoom", { code });
    router.push("/bomberman");
  }
  function rematch() {
    socketRef.current?.emit("requestRematch", { code });
  }

  function copyLink() {
    const url = `${window.location.origin}/bomberman?join=${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  // ── Render ──
  if (error) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <a href="/bomberman" className="text-gold text-sm hover:underline">← กลับ</a>
      </div>
    </main>
  );

  if (phase === "playing" && gameData) {
    return (
      <BombermanGame
        initialState={gameData}
        room={room!}
        myId={myId}
        isSpectator={isSpectator}
        socket={socketRef.current!}
        onLeave={leaveRoom}
      />
    );
  }

  if (phase === "ended") {
    const sorted = [...gameStats].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.kills - a.kills;
    });
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.2)" }}>
            {/* Header */}
            <div className="px-6 pt-7 pb-4 text-center border-b" style={{ borderColor: "rgba(212,168,67,.1)" }}>
              <p className="text-gold text-[10px] tracking-[.22em] uppercase mb-2">จบเกม</p>
              {winner ? (
                <>
                  <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-xl border-2"
                    style={{
                      background: PLAYER_COLORS[gameStats.find(p => p.id === winner.id)?.slot ?? 0] + "22",
                      borderColor: PLAYER_COLORS[gameStats.find(p => p.id === winner.id)?.slot ?? 0],
                      color: PLAYER_COLORS[gameStats.find(p => p.id === winner.id)?.slot ?? 0],
                    }}>✦</div>
                  <h2 className="font-bold text-xl mb-0.5" style={{ fontFamily: "var(--font-serif)", color: "var(--color-gold-light)" }}>
                    {winner.name}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--color-gold)" }}>ชนะ!</p>
                </>
              ) : (
                <p className="text-ink2 text-lg font-bold">เสมอ!</p>
              )}
            </div>

            {/* Stats table */}
            {sorted.length > 0 && (
              <div className="px-4 py-3">
                <div className="grid text-xs mb-1 px-2" style={{ gridTemplateColumns: "1.5rem 1fr 3rem 4rem", color: "var(--color-ink3)", gap: "0 8px" }}>
                  <span>#</span><span>ผู้เล่น</span><span className="text-center">Kill</span><span className="text-center">สถานะ</span>
                </div>
                {sorted.map((p, i) => {
                  const color = PLAYER_COLORS[p.slot];
                  const isWinner = winner?.id === p.id;
                  return (
                    <div key={p.id}
                      className="grid items-center px-2 py-2 rounded-lg mb-1 text-sm"
                      style={{
                        gridTemplateColumns: "1.5rem 1fr 3rem 4rem",
                        gap: "0 8px",
                        background: isWinner ? "rgba(212,168,67,.08)" : "rgba(255,255,255,.03)",
                        border: `1px solid ${isWinner ? "rgba(212,168,67,.25)" : "rgba(255,255,255,.05)"}`,
                      }}
                    >
                      <span className="font-bold text-xs" style={{ color: i === 0 ? "#d4a843" : "var(--color-ink3)" }}>
                        {i + 1}
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border"
                          style={{ background: color + "22", borderColor: color, color }}>
                          {p.isBot ? "🤖" : p.name[0]?.toUpperCase()}
                        </div>
                        <span className="truncate" style={{ color: "var(--color-ink)" }}>{p.name}</span>
                        {p.id === myId && <span className="text-[10px] shrink-0" style={{ color: "var(--color-gold)" }}>คุณ</span>}
                      </div>
                      <span className="text-center font-bold" style={{ color: p.kills > 0 ? "#f87171" : "var(--color-ink3)" }}>
                        {p.kills}
                      </span>
                      <span className="text-center text-[11px]" style={{ color: p.alive ? "#4ade80" : "var(--color-ink3)" }}>
                        {p.alive ? "รอด ✓" : "ออก"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 justify-center px-6 pb-6 pt-2">
              {isHost() && (
                <button onClick={rematch} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(212,168,67,.15)", border: "1px solid rgba(212,168,67,.3)", color: "var(--color-gold-light)" }}>
                  เล่นอีก
                </button>
              )}
              <button onClick={leaveRoom} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "var(--color-ink2)" }}>
                ออก lobby
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Lobby / countdown
  const slots = [0, 1, 2, 3].map((s) => room?.players.find((p) => p.slot === s) ?? null);
  const botCount = room?.players.filter((p) => p.isBot).length ?? 0;
  const canStart = isHost() && (room?.players.length ?? 0) >= 2 && room?.players.every((p) => p.ready || p.isBot);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <span
            className="inline-block font-mono text-gold tracking-[.3em] text-lg border rounded-full px-6 py-2 mb-3"
            style={{ borderColor: "rgba(212,168,67,.3)", background: "rgba(212,168,67,.05)" }}
          >
            {code}
          </span>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button onClick={copyLink} className="text-xs text-ink3 hover:text-gold transition-colors flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              คัดลอก link
            </button>
            {isHost() && (
              <button
                onClick={toggleLock}
                className="text-xs transition-colors flex items-center gap-1"
                style={{ color: room?.locked ? "#f87171" : "var(--color-ink3)" }}
              >
                {room?.locked ? "🔒 ล็อคอยู่" : "🔓 ปลดล็อค"}
              </button>
            )}
          </div>
        </div>

        {/* Player slots */}
        <div
          className="rounded-2xl border p-5 mb-4 grid grid-cols-2 gap-3"
          style={{ background: "var(--color-bg3)", borderColor: "rgba(212,168,67,.15)" }}
        >
          {slots.map((player, slot) => (
            <div
              key={slot}
              className="rounded-xl p-3 flex items-center gap-3 border"
              style={{
                borderColor: player ? PLAYER_COLORS[slot] + "40" : "rgba(255,255,255,.06)",
                background: player ? PLAYER_COLORS[slot] + "0d" : "rgba(0,0,0,.2)",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: player ? PLAYER_COLORS[slot] + "22" : "rgba(255,255,255,.04)",
                  border: `2px solid ${player ? PLAYER_COLORS[slot] : "rgba(255,255,255,.1)"}`,
                  color: player ? PLAYER_COLORS[slot] : "var(--color-ink3)",
                }}
              >
                {player ? (player.isBot ? "🤖" : player.name[0]?.toUpperCase()) : "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: player ? "var(--color-ink)" : "var(--color-ink3)" }}>
                  {player ? player.name : SLOT_LABELS[slot]}
                </p>
                {player && (
                  <p className="text-[10px]" style={{ color: PLAYER_COLORS[slot] + "cc" }}>
                    {player.isBot ? "บอท" : player.ready ? "✓ พร้อม" : "รออยู่..."}
                    {!player.connected && !player.isBot ? " (หลุด)" : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {phase === "countdown" ? (
          <div className="text-center py-6">
            <p className="text-gold text-xs tracking-widest uppercase mb-2">เกมเริ่มใน</p>
            <p className="font-bold" style={{ fontSize: "5rem", fontFamily: "var(--font-serif)", color: "var(--color-gold-light)", lineHeight: 1 }}>
              {countdown}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!isSpectator && (
              <div className="flex gap-3">
                {!isHost() && (
                  <button
                    onClick={toggleReady}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                    style={{
                      background: amReady() ? "rgba(74,222,128,.15)" : "rgba(255,255,255,.05)",
                      border: `1px solid ${amReady() ? "rgba(74,222,128,.4)" : "rgba(255,255,255,.1)"}`,
                      color: amReady() ? "#4ade80" : "var(--color-ink2)",
                    }}
                  >
                    {amReady() ? "✓ พร้อมแล้ว" : "พร้อม"}
                  </button>
                )}
                {isHost() && (
                  <>
                    <button
                      onClick={addBot}
                      disabled={(room?.players.length ?? 0) >= 4}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40"
                      style={{
                        background: "rgba(192,132,252,.1)",
                        border: "1px solid rgba(192,132,252,.25)",
                        color: "#c084fc",
                      }}
                    >
                      + บอท
                    </button>
                    {botCount > 0 && (
                      <button
                        onClick={removeBot}
                        className="px-4 py-2.5 rounded-xl text-sm transition-all hover:-translate-y-0.5"
                        style={{
                          background: "rgba(248,113,113,.08)",
                          border: "1px solid rgba(248,113,113,.2)",
                          color: "#f87171",
                        }}
                      >
                        − บอท
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {isHost() && (
              <button
                onClick={startGame}
                disabled={!canStart}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: canStart ? "linear-gradient(135deg,rgba(212,168,67,.3),rgba(212,168,67,.15))" : "rgba(255,255,255,.04)",
                  border: `1px solid ${canStart ? "rgba(212,168,67,.5)" : "rgba(255,255,255,.08)"}`,
                  color: canStart ? "var(--color-gold-light)" : "var(--color-ink3)",
                }}
              >
                {canStart ? "▶ เริ่มเกม" : "รอผู้เล่นพร้อม..."}
              </button>
            )}

            <button onClick={leaveRoom} className="text-xs text-ink3 hover:text-ink transition-colors text-center py-1">
              ออกจากห้อง
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
