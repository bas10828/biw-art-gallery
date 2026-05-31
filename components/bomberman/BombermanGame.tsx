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

function calcCellSize(hasControls: boolean) {
  if (typeof window === "undefined") return 36;
  const HUD = 36;
  // controls (DPad+BombBtn) are side-by-side with canvas, reserve ~220px width total
  const maxW = window.innerWidth - (hasControls ? 220 : 0);
  const maxH = window.innerHeight - HUD;
  return Math.max(20, Math.floor(Math.min(maxW / GRID_W, maxH / GRID_H)));
}
const PLAYER_COLORS = ["#60a5fa", "#f87171", "#4ade80", "#c084fc"];
const POWERUP_ART = ARTWORKS.slice(0, 4); // 4 artworks for 4 powerup types

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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wallbreakLabels = useRef<Set<string>>(new Set()); // playerIds who collected wallbreak
  const [suddenDeathCells, setSuddenDeathCells] = useState<{ x: number; y: number }[]>([]);
  const [cellSize, setCellSize] = useState(36);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const lastMoveRef = useRef<number>(0);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const code = room.code;

  // ── Preload artwork images for powerups ──
  useEffect(() => {
    POWERUP_ART.forEach((art) => {
      if (imgCache.current.has(art.file)) return;
      const img = new Image();
      img.src = `/images/${art.file}`;
      imgCache.current.set(art.file, img);
    });
  }, []);

  // ── Auto fullscreen on mount ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.requestFullscreen?.().then(() => {
      (screen.orientation as any)?.lock?.("landscape").catch(() => {});
    }).catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      (screen.orientation as any)?.unlock?.();
    };
  }, []);

  // ── Responsive resize + fullscreen + orientation ──
  useEffect(() => {
    function updateSize() {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      if (!portrait) setCellSize(calcCellSize(!isSpectator && !dead));
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", () => setTimeout(updateSize, 150));
    document.addEventListener("fullscreenchange", () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(updateSize, 150);
    });
    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
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
    socket.on("wallbreakUsed", ({ name, cleared, playerId }: { name: string; cleared: number; playerId: string }) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(`💥 ${name} WALLBREAK! (${cleared} กำแพง)`);
      toastTimer.current = setTimeout(() => setToast(null), 2500);
      wallbreakLabels.current.add(playerId);
    });
    socket.on("suddenDeath", ({ cells, map }: any) => {
      stateRef.current.map = map;
      setSuddenDeathCells(cells);
      setTimeout(() => setSuddenDeathCells([]), 800);
    });
    return () => {
      socket.off("gameState"); socket.off("playerMoved"); socket.off("bombPlaced");
      socket.off("explosion"); socket.off("mapUpdate"); socket.off("powerupsUpdate");
      socket.off("playerDied"); socket.off("gameOver"); socket.off("suddenDeath");
      socket.off("wallbreakUsed");
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

      // powerups — artwork thumbnail circle
      gs.powerups?.forEach((pu) => {
        const px = pu.x * CS + CS / 2, py = pu.y * CS + CS / 2;
        const color = pu.type === "range" ? "#f87171" : pu.type === "bombs" ? "#c084fc" : pu.type === "wallbreak" ? "#d4a843" : "#4ade80";
        const artIdx = pu.type === "range" ? 0 : pu.type === "bombs" ? 1 : pu.type === "wallbreak" ? 3 : 2;
        const artFile = POWERUP_ART[artIdx]?.file;
        const r = CS * 0.36;
        // outer glow
        const glow = ctx.createRadialGradient(px, py, r * 0.5, px, py, r * 1.6);
        glow.addColorStop(0, color + "44"); glow.addColorStop(1, color + "00");
        ctx.beginPath(); ctx.arc(px, py, r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = glow; ctx.fill();
        // artwork image (centered-square crop)
        const img = artFile ? imgCache.current.get(artFile) : null;
        ctx.save();
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.clip();
        if (img && img.complete && img.naturalWidth > 0) {
          const sSize = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - sSize) / 2;
          const sy = (img.naturalHeight - sSize) / 2;
          ctx.drawImage(img, sx, sy, sSize, sSize, px - r, py - r, r * 2, r * 2);
          // subtle dark tint overlay for readability
          ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(px - r, py - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = color + "33"; ctx.fill();
        }
        ctx.restore();
        // ring border
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
        // type icon badge (small circle bottom-right)
        const bx = px + r * 0.6, by = py + r * 0.6, br = r * 0.32;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = "#0a0a0f"; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(9, CS * 0.22)}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(pu.type === "range" ? "↔" : pu.type === "bombs" ? "+" : pu.type === "wallbreak" ? "✦" : "⚡", bx, by);
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

      // players — chibi character (head + body)
      Object.values(gs.players).forEach((p) => {
        if (!p.alive) return;
        const cx = p.x * CS + CS / 2, cy = p.y * CS + CS / 2;
        const color = PLAYER_COLORS[p.slot];
        const isMe = p.id === myId;
        const headR = CS * 0.27;
        const headY = cy - CS * 0.12;
        const bodyW = CS * 0.32, bodyH = CS * 0.22;
        const bodyY = cy + CS * 0.16;

        // ground shadow
        ctx.beginPath();
        ctx.ellipse(cx, cy + CS * 0.38, CS * 0.22, CS * 0.06, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();

        // ambient glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, CS * 0.65);
        glow.addColorStop(0, color + (isMe ? "55" : "33"));
        glow.addColorStop(1, color + "00");
        ctx.beginPath(); ctx.arc(cx, cy, CS * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = glow; ctx.fill();

        // body
        ctx.beginPath();
        ctx.ellipse(cx, bodyY, bodyW, bodyH, 0, 0, Math.PI * 2);
        ctx.fillStyle = color + "55"; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = isMe ? 2 : 1.5; ctx.stroke();

        // head
        ctx.beginPath();
        ctx.arc(cx, headY, headR, 0, Math.PI * 2);
        ctx.fillStyle = color + "33"; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = isMe ? 2.5 : 2; ctx.stroke();

        // head shine
        ctx.beginPath();
        ctx.arc(cx - headR * 0.28, headY - headR * 0.28, headR * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fill();

        // eyes
        const eyeY = headY + headR * 0.1;
        const eyeOff = headR * 0.3;
        [cx - eyeOff, cx + eyeOff].forEach((ex) => {
          ctx.beginPath(); ctx.arc(ex, eyeY, headR * 0.13, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
        });

        // crown for "me" — gold ✦ above head
        if (isMe) {
          ctx.fillStyle = "#d4a843";
          ctx.font = `bold ${Math.max(10, CS * 0.26)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("✦", cx, headY - headR - CS * 0.14);
        }

        // "โคตรเสียว" wallbreak label
        const showWb = wallbreakLabels.current.has(p.id);
        const nameBaseY = headY - headR - (isMe ? CS * 0.28 : CS * 0.06);
        const nameY = showWb ? nameBaseY - CS * 0.22 : nameBaseY;
        if (showWb) {
          ctx.font = `bold ${Math.max(7, CS * 0.2)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          const wbLabel = "โคตรเสียว";
          const wbW = ctx.measureText(wbLabel).width + CS * 0.16;
          ctx.beginPath();
          ctx.roundRect(cx - wbW / 2, nameY - CS * 0.4, wbW, CS * 0.2, 3);
          ctx.fillStyle = "#d4a843"; ctx.fill();
          ctx.fillStyle = "#000";
          ctx.fillText(wbLabel, cx, nameY - CS * 0.2);
        }
        // name tag
        ctx.font = `${Math.max(8, CS * 0.22)}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        // name background pill
        const nameW = ctx.measureText(p.name).width + CS * 0.14;
        ctx.beginPath();
        ctx.roundRect(cx - nameW / 2, nameY - CS * 0.19, nameW, CS * 0.19, 3);
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fill();
        ctx.fillStyle = isMe ? "#d4a843" : "#fff";
        ctx.fillText(p.name, cx, nameY);
      });

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [myId, suddenDeathCells, cellSize]);

  const W = GRID_W * cellSize;
  const H = GRID_H * cellSize;
  const showControls = !isSpectator && !dead;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "#0a0a0f" }}
    >
      {/* Wallbreak toast */}
      {toast && (
        <div className="absolute top-12 left-1/2 z-40 -translate-x-1/2 px-5 py-2 rounded-full text-sm font-bold pointer-events-none"
          style={{ background: "rgba(212,168,67,.95)", color: "#000", boxShadow: "0 4px 20px rgba(212,168,67,.5)", animation: "merch-slidein .25s ease both" }}>
          {toast}
        </div>
      )}

      {/* Portrait overlay — rotate prompt */}
      {isPortrait && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4"
          style={{ background: "#0a0a0f" }}>
          <div style={{ fontSize: "3rem", animation: "spin90 1.2s ease-in-out infinite alternate" }}>📱</div>
          <p className="text-ink text-sm">หมุนโทรศัพท์เป็นแนวนอน</p>
          <button onClick={onLeave} className="text-xs text-ink3 hover:text-gold mt-4">ออกจากเกม</button>
          <style>{`@keyframes spin90{from{transform:rotate(0deg)}to{transform:rotate(90deg)}}`}</style>
        </div>
      )}

      {/* HUD */}
      <div className="flex items-center justify-between w-full px-3 py-1 mb-1 shrink-0" style={{ maxWidth: W + (showControls ? 220 : 0) }}>
        <div className="flex gap-2 flex-wrap">
          {Object.values(stateRef.current.players).map((p) => (
            <div key={p.id} className="flex items-center gap-1 text-xs" style={{ color: PLAYER_COLORS[p.slot] }}>
              <span style={{ opacity: p.alive ? 1 : 0.3 }}>✦</span>
              <span style={{ opacity: p.alive ? 1 : 0.3 }}>{p.name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleFullscreen} className="text-xs px-2 py-1 rounded"
            style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>
            {isFullscreen ? "ออกเต็มจอ" : "เต็มจอ"}
          </button>
          <button onClick={onLeave} className="text-xs text-ink3 hover:text-ink transition-colors">
            {dead ? "ออก" : isSpectator ? "ออก" : "ยอมแพ้"}
          </button>
        </div>
      </div>

      {/* Game area: D-pad | Canvas | Bomb */}
      <div className="flex items-center justify-center gap-3">
        {/* Left D-pad */}
        {showControls && (
          <DPad onMove={(dir) => socket.emit("move", { code, dir })} />
        )}

        {/* Canvas */}
        <div className="relative shrink-0">
          <canvas ref={canvasRef}
            style={{ display: "block", borderRadius: "6px", border: "1px solid rgba(96,165,250,.1)" }} />
          {dead && winner === undefined && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg" style={{ background: "rgba(0,0,0,.65)" }}>
              <div className="text-center">
                <p className="text-red-400 font-bold text-lg mb-2">ตายแล้ว</p>
                <p className="text-ink2 text-xs mb-3">กำลัง spectate...</p>
                <button onClick={onLeave} className="text-xs text-gold hover:underline">ออก</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Bomb button */}
        {showControls && (
          <BombButton onBomb={() => socket.emit("placeBomb", { code })} />
        )}
      </div>
    </div>
  );
}

// ── D-pad (left side) ──
function DPad({ onMove }: { onMove: (dir: string) => void }) {
  const S = 52;
  const btn = (dir: string, label: string) => (
    <button
      style={{ width: S, height: S, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, color: "#fff", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", userSelect: "none" }}
      onPointerDown={(e) => { e.preventDefault(); onMove(dir); }}
    >{label}</button>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(3,${S}px)`, gap: 4 }}>
      <div />{btn("up", "▲")}<div />
      {btn("left", "◀")}<div style={{ width: S, height: S, background: "rgba(0,0,0,.2)", borderRadius: 10 }} />{btn("right", "▶")}
      <div />{btn("down", "▼")}<div />
    </div>
  );
}

// ── Bomb button (right side) ──
function BombButton({ onBomb }: { onBomb: () => void }) {
  return (
    <button
      style={{ width: 70, height: 70, borderRadius: "50%", background: "rgba(248,113,113,.25)", border: "2px solid rgba(248,113,113,.6)", fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", userSelect: "none" }}
      onPointerDown={(e) => { e.preventDefault(); onBomb(); }}
    >💣</button>
  );
}
