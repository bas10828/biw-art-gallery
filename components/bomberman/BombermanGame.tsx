"use client";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { RoomInfo, GameState, GamePlayer, Bomb, Powerup } from "@/lib/bomberman/types";
import { ARTWORKS } from "@/lib/artworks";

interface Props {
  initialState: GameState;
  room: RoomInfo;
  myId: string;
  isSpectator: boolean;
  socket: Socket;
  onLeave: () => void;
}

const GRID_W = 13;
const GRID_H = 11;

function calcCellSize(withControls: boolean) {
  if (typeof window === "undefined") return 36;
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - (withControls ? 130 : 48); // reserve HUD + controls
  return Math.floor(Math.min(maxW / GRID_W, maxH / GRID_H));
}
const PLAYER_COLORS = ["#60a5fa", "#f87171", "#4ade80", "#c084fc"];
const POWERUP_ART = ARTWORKS.slice(0, 3); // 3 artworks for 3 powerup types

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
};

export default function BombermanGame({ initialState, room, myId, isSpectator, socket, onLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(initialState);
  const explosionsRef = useRef<{ cells: { x: number; y: number }[]; timer: number }[]>([]);
  const [dead, setDead] = useState(false);
  const [winner, setWinner] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [suddenDeathCells, setSuddenDeathCells] = useState<{ x: number; y: number }[]>([]);
  const [cellSize, setCellSize] = useState(36);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const lastMoveRef = useRef<number>(0);
  const code = room.code;

  // ── Responsive resize + fullscreen ──
  useEffect(() => {
    function updateSize() {
      setCellSize(calcCellSize(!isSpectator && !dead));
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    document.addEventListener("fullscreenchange", () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(updateSize, 100);
    });
    return () => window.removeEventListener("resize", updateSize);
  }, [isSpectator, dead]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      (screen.orientation as any)?.lock?.("landscape").catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  // ── Socket events ──
  useEffect(() => {
    socket.on("gameState", ({ players, bombs }: any) => {
      stateRef.current = { ...stateRef.current, players, bombs };
    });
    socket.on("playerMoved", ({ playerId, x, y }: any) => {
      if (stateRef.current.players[playerId]) {
        stateRef.current.players[playerId].x = x;
        stateRef.current.players[playerId].y = y;
      }
    });
    socket.on("bombPlaced", ({ bomb }: any) => {
      stateRef.current.bombs = [...stateRef.current.bombs, bomb];
    });
    socket.on("explosion", ({ cells, bombId }: any) => {
      stateRef.current.bombs = stateRef.current.bombs.filter((b) => b.id !== bombId);
      explosionsRef.current.push({ cells, timer: 500 });
    });
    socket.on("mapUpdate", ({ map, powerups }: any) => {
      stateRef.current.map = map;
      stateRef.current.powerups = powerups;
    });
    socket.on("powerupsUpdate", ({ powerups }: any) => {
      stateRef.current.powerups = powerups;
    });
    socket.on("playerDied", ({ playerId }: any) => {
      if (stateRef.current.players[playerId]) stateRef.current.players[playerId].alive = false;
      if (playerId === myId) setDead(true);
    });
    socket.on("gameOver", ({ winner: w }: any) => setWinner(w ?? null));
    socket.on("suddenDeath", ({ cells, map }: any) => {
      stateRef.current.map = map;
      setSuddenDeathCells(cells);
      setTimeout(() => setSuddenDeathCells([]), 800);
    });
    return () => {
      socket.off("gameState"); socket.off("playerMoved"); socket.off("bombPlaced");
      socket.off("explosion"); socket.off("mapUpdate"); socket.off("powerupsUpdate");
      socket.off("playerDied"); socket.off("gameOver"); socket.off("suddenDeath");
    };
  }, [socket, myId]);

  // ── Keyboard input ──
  useEffect(() => {
    if (isSpectator || dead) return;
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === "Space" || e.code === "KeyZ") {
        e.preventDefault();
        socket.emit("placeBomb", { code });
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [isSpectator, dead, code, socket]);

  // ── Move loop ──
  useEffect(() => {
    if (isSpectator || dead) return;
    const MOVE_INTERVAL = 160;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastMoveRef.current < MOVE_INTERVAL) return;
      for (const [key, [dx, dy]] of Object.entries(DIRS)) {
        if (keysRef.current.has(key)) {
          const dir = dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
          socket.emit("move", { code, dir });
          lastMoveRef.current = now;
          break;
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isSpectator, dead, code, socket]);

  // ── Canvas render ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const CS = cellSize;
    const W = GRID_W * CS;
    const H = GRID_H * CS;
    canvas.width = W;
    canvas.height = H;

    function draw() {
      const gs = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // background
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);

      // grid
      gs.map.forEach((row, y) => {
        row.forEach((cell, x) => {
          const px = x * CS, py = y * CS;
          if (cell === 1) {
            // hard block
            const g = ctx.createLinearGradient(px, py, px + CS, py + CS);
            g.addColorStop(0, "#1a1a2e"); g.addColorStop(1, "#0d0d1a");
            ctx.fillStyle = g;
            ctx.fillRect(px, py, CS, CS);
            ctx.strokeStyle = "rgba(96,165,250,.15)";
            ctx.strokeRect(px + 1, py + 1, CS - 2, CS - 2);
          } else if (cell === 2) {
            // soft block
            const g = ctx.createLinearGradient(px, py, px + CS, py + CS);
            g.addColorStop(0, "#2d1a0e"); g.addColorStop(1, "#1a0e07");
            ctx.fillStyle = g;
            ctx.fillRect(px, py, CS, CS);
            ctx.strokeStyle = "rgba(212,168,67,.2)";
            ctx.strokeRect(px + 2, py + 2, CS - 4, CS - 4);
          } else {
            // empty floor
            ctx.fillStyle = (x + y) % 2 === 0 ? "#12121e" : "#0f0f1a";
            ctx.fillRect(px, py, CS, CS);
          }
        });
      });

      // sudden death flash
      suddenDeathCells.forEach(({ x, y }) => {
        ctx.fillStyle = "rgba(248,113,113,.5)";
        ctx.fillRect(x * CS, y * CS, CS, CS);
      });

      // powerups (use artwork thumbnails as colored circles)
      gs.powerups?.forEach((pu) => {
        const px = pu.x * CS + CS / 2, py = pu.y * CS + CS / 2;
        const color = pu.type === "range" ? "#f87171" : pu.type === "bombs" ? "#c084fc" : "#4ade80";
        ctx.beginPath();
        ctx.arc(px, py, CS * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = color + "33";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pu.type === "range" ? "↔" : pu.type === "bombs" ? "💣" : "⚡", px, py);
      });

      // bombs
      gs.bombs.forEach((bomb) => {
        const px = bomb.x * CS + CS / 2, py = bomb.y * CS + CS / 2;
        const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 150);
        ctx.beginPath();
        ctx.arc(px, py, CS * 0.36 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = "#1a0a0a";
        ctx.fill();
        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // fuse
        ctx.beginPath();
        ctx.moveTo(px + 4, py - CS * 0.3);
        ctx.quadraticCurveTo(px + 10, py - CS * 0.45, px + 6, py - CS * 0.5);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // explosions
      const now = Date.now();
      explosionsRef.current = explosionsRef.current.filter((e) => {
        e.timer -= 16;
        return e.timer > 0;
      });
      explosionsRef.current.forEach((exp) => {
        const alpha = exp.timer / 500;
        exp.cells.forEach(({ x, y }) => {
          const px = x * CS, py = y * CS;
          const g = ctx.createRadialGradient(
            px + CS / 2, py + CS / 2, 0,
            px + CS / 2, py + CS / 2, CS * 0.7
          );
          g.addColorStop(0, `rgba(255,220,100,${alpha})`);
          g.addColorStop(0.5, `rgba(255,100,30,${alpha * 0.8})`);
          g.addColorStop(1, `rgba(200,50,10,0)`);
          ctx.fillStyle = g;
          ctx.fillRect(px, py, CS, CS);
        });
      });

      // players
      Object.values(gs.players).forEach((p) => {
        if (!p.alive) return;
        const px = p.x * CS + CS / 2, py = p.y * CS + CS / 2;
        const color = PLAYER_COLORS[p.slot];
        const isMe = p.id === myId;
        // glow
        const glow = ctx.createRadialGradient(px, py, 0, px, py, CS * 0.6);
        glow.addColorStop(0, color + "44");
        glow.addColorStop(1, color + "00");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(px, py, CS * 0.6, 0, Math.PI * 2); ctx.fill();
        // body
        ctx.beginPath();
        ctx.arc(px, py, CS * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = color + "22"; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = isMe ? 3 : 2; ctx.stroke();
        // spirit symbol
        ctx.fillStyle = color;
        ctx.font = `bold ${isMe ? 16 : 14}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("✦", px, py);
        // name tag
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.name, px, py - CS * 0.55);
      });

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [myId, suddenDeathCells, cellSize]);

  const W = GRID_W * cellSize;
  const H = GRID_H * cellSize;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "#0a0a0f" }}
    >
      {/* HUD */}
      <div className="flex items-center justify-between w-full px-3 py-1 mb-1" style={{ maxWidth: W }}>
        <div className="flex gap-2 flex-wrap">
          {Object.values(stateRef.current.players).map((p) => (
            <div key={p.id} className="flex items-center gap-1 text-xs" style={{ color: PLAYER_COLORS[p.slot] }}>
              <span style={{ opacity: p.alive ? 1 : 0.3 }}>✦</span>
              <span style={{ opacity: p.alive ? 1 : 0.3 }}>{p.name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="text-xs text-ink3 hover:text-ink transition-colors px-2 py-1 rounded"
            style={{ background: "rgba(255,255,255,.06)" }}
          >
            {isFullscreen ? "⤓" : "⤢"}
          </button>
          <button onClick={onLeave} className="text-xs text-ink3 hover:text-ink transition-colors">
            {dead ? "ออก" : isSpectator ? "ออก" : "ยอมแพ้"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ display: "block", borderRadius: "6px", border: "1px solid rgba(96,165,250,.1)" }}
        />
        {/* Dead overlay */}
        {dead && winner === undefined && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg" style={{ background: "rgba(0,0,0,.6)" }}>
            <div className="text-center">
              <p className="text-red-400 font-bold text-xl mb-2">ตายแล้ว</p>
              <p className="text-ink2 text-xs mb-4">กำลัง spectate...</p>
              <button onClick={onLeave} className="text-xs text-gold hover:underline">ออก lobby</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      {!isSpectator && !dead && (
        <MobileControls
          onMove={(dir) => socket.emit("move", { code, dir })}
          onBomb={() => socket.emit("placeBomb", { code })}
        />
      )}
    </div>
  );
}

// ── Mobile D-pad ──
function MobileControls({ onMove, onBomb }: { onMove: (dir: string) => void; onBomb: () => void }) {
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startMove(dir: string) {
    onMove(dir);
    holdRef.current = setInterval(() => onMove(dir), 160);
  }
  function stopMove() {
    if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; }
  }

  const btnClass = "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold select-none active:scale-90 transition-transform";
  const btnStyle = { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "white", touchAction: "none" as const };

  return (
    <div className="flex items-center gap-10 mt-3 px-4">
      {/* D-pad */}
      <div className="grid grid-cols-3 gap-1" style={{ width: 160 }}>
        <div />
        <button className={btnClass} style={btnStyle}
          onTouchStart={() => startMove("up")} onTouchEnd={stopMove} onMouseDown={() => startMove("up")} onMouseUp={stopMove}>▲</button>
        <div />
        <button className={btnClass} style={btnStyle}
          onTouchStart={() => startMove("left")} onTouchEnd={stopMove} onMouseDown={() => startMove("left")} onMouseUp={stopMove}>◀</button>
        <div className="w-12 h-12 rounded-xl" style={{ background: "rgba(0,0,0,.3)" }} />
        <button className={btnClass} style={btnStyle}
          onTouchStart={() => startMove("right")} onTouchEnd={stopMove} onMouseDown={() => startMove("right")} onMouseUp={stopMove}>▶</button>
        <div />
        <button className={btnClass} style={btnStyle}
          onTouchStart={() => startMove("down")} onTouchEnd={stopMove} onMouseDown={() => startMove("down")} onMouseUp={stopMove}>▼</button>
        <div />
      </div>
      {/* Bomb */}
      <button
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl select-none active:scale-90 transition-transform"
        style={{ background: "rgba(248,113,113,.2)", border: "2px solid rgba(248,113,113,.5)", touchAction: "none" }}
        onTouchStart={(e) => { e.preventDefault(); onBomb(); }}
        onClick={onBomb}
      >
        💣
      </button>
    </div>
  );
}
