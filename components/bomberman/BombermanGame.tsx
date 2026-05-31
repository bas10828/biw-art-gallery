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

  // ── Smooth movement: per-player tween data ──
  type Tween = { srcX: number; srcY: number; dstX: number; dstY: number; startMs: number; dur: number };
  const tweens = useRef<Map<string, Tween>>(new Map());

  // ── Particle system ──
  type Particle = { cx: number; cy: number; vcx: number; vcy: number; life: number; maxLife: number; r: number; color: string };
  const particles = useRef<Particle[]>([]);

  // ── Screen shake ──
  const shakeRef = useRef({ until: 0 });
  const lastFrameMs = useRef(0);

  // ── Client-side prediction for local player ──
  const myPredPos = useRef({ x: 0, y: 0, init: false });

  // ── Speed trail: last N display positions per player ──
  type TrailPt = { x: number; y: number; t: number };
  const trailHistory = useRef<Map<string, TrailPt[]>>(new Map());

  // ── Explosion owner tracking for colored effects ──
  const explosionOwners = useRef<Map<number, string>>(new Map()); // bombId → ownerId, cleared after explosion

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
    socket.on("posUpdate", ({ players, bombs }: any) => {
      if (bombs) stateRef.current.bombs = bombs;
      Object.entries(players).forEach(([pid, pos]: any) => {
        const p = stateRef.current.players[pid];
        if (!p) return;
        const prev = tweens.current.get(pid);
        const t = prev ? Math.min(1, (Date.now() - prev.startMs) / (prev.dur ?? 100)) : 1;
        const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
        const curX = prev ? prev.srcX + (prev.dstX - prev.srcX) * e : p.x;
        const curY = prev ? prev.srcY + (prev.dstY - prev.srcY) * e : p.y;
        // dead reckoning: predict 80ms ahead using server velocity
        const BASE_SPEED = 3.8;
        const spd = pos.speed || 1;
        const pred = 0.08; // seconds
        const predX = pos.x + (pos.dx || 0) * BASE_SPEED * spd * pred;
        const predY = pos.y + (pos.dy || 0) * BASE_SPEED * spd * pred;
        tweens.current.set(pid, { srcX: curX, srcY: curY, dstX: predX, dstY: predY, startMs: Date.now(), dur: 80 });
        Object.assign(p, pos);
        // reconcile local prediction
        if (pid === myId) {
          const mp = myPredPos.current;
          if (!mp.init) { mp.x = pos.x; mp.y = pos.y; mp.init = true; }
          else if (Math.hypot(mp.x - pos.x, mp.y - pos.y) > 1.2) { mp.x = pos.x; mp.y = pos.y; }
        }
      });
    });
    socket.on("bombPlaced", ({ bomb }: any) => {
      stateRef.current.bombs = [...stateRef.current.bombs, bomb];
    });
    socket.on("explosion", ({ cells, bombId, ownerId }: any) => {
      stateRef.current.bombs = stateRef.current.bombs.filter((b) => b.id !== bombId);
      explosionsRef.current.push({ cells, timer: 500 });

      const owner = ownerId ? stateRef.current.players[ownerId] : null;
      const ownerRange = owner?.range ?? 1;
      const ownerBombs = owner?.maxBombs ?? 1;
      const ownerWallbreak = ownerId ? wallbreakLabels.current.has(ownerId) : false;
      const ownerColor = owner ? PLAYER_COLORS[owner.slot] : "#ff6418";

      const MAX_P = 80;
      const basePerCell = Math.min(4, Math.floor(MAX_P / Math.max(1, cells.length)));

      cells.forEach(({ x, y }: { x: number; y: number }) => {
        const cx = x + 0.5, cy = y + 0.5;
        // base fire particles
        const baseColors = ["#ffdc64", "#ff6418", "#ff3300", "#ffaa33"];
        for (let i = 0; i < basePerCell && particles.current.length < MAX_P; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.003 + Math.random() * 0.005;
          particles.current.push({ cx, cy, vcx: Math.cos(angle)*spd, vcy: Math.sin(angle)*spd,
            life: 300+Math.random()*250, maxLife: 550, r: 0.05+Math.random()*0.06,
            color: baseColors[Math.floor(Math.random()*baseColors.length)] });
        }
        // range ≥ 3: red wave particles
        if (ownerRange >= 3 && particles.current.length < MAX_P) {
          for (let i = 0; i < 2; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.current.push({ cx, cy, vcx: Math.cos(angle)*0.007, vcy: Math.sin(angle)*0.007,
              life: 200+Math.random()*150, maxLife: 350, r: 0.09+Math.random()*0.05, color: "#f87171" });
          }
        }
        // maxBombs > 1: purple sparks
        if (ownerBombs > 1 && particles.current.length < MAX_P) {
          for (let i = 0; i < ownerBombs - 1 && i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.current.push({ cx, cy, vcx: Math.cos(angle)*0.006, vcy: Math.sin(angle)*0.006,
              life: 250+Math.random()*200, maxLife: 450, r: 0.07+Math.random()*0.04, color: "#c084fc" });
          }
        }
        // wallbreak: gold star burst
        if (ownerWallbreak && particles.current.length < MAX_P) {
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
            particles.current.push({ cx, cy, vcx: Math.cos(angle)*0.009, vcy: Math.sin(angle)*0.009,
              life: 400+Math.random()*200, maxLife: 600, r: 0.1, color: "#d4a843" });
          }
        }
      });

      // screen shake near my player
      const myP = stateRef.current.players[myId];
      if (myP?.alive && cells.some((c: { x: number; y: number }) => Math.abs(c.x - myP.x) + Math.abs(c.y - myP.y) < 4)) {
        shakeRef.current.until = Date.now() + 220;
      }
      void ownerColor;
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
    socket.on("powerupCollected", ({ x, y, type }: { x: number; y: number; type: string }) => {
      const color = type === "range" ? "#f87171" : type === "bombs" ? "#c084fc" : type === "wallbreak" ? "#d4a843" : "#4ade80";
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const spd = 0.005 + Math.random() * 0.008;
        particles.current.push({ cx: x, cy: y, vcx: Math.cos(angle)*spd, vcy: Math.sin(angle)*spd,
          life: 350+Math.random()*200, maxLife: 550, r: 0.07+Math.random()*0.06, color });
      }
    });
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
      socket.off("posUpdate"); socket.off("bombPlaced"); socket.off("powerupCollected");
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

  const joystickDirRef = useRef<string | null>(null);
  const prevJoystickDir = useRef<string | null>(null);
  const currentMoveInterval = useRef(50);
  const lastDirRef = useRef<string | null>(null);

  // ── Direction loop — send setDir on change ──
  useEffect(() => {
    if (isSpectator || dead) return;
    const interval = setInterval(() => {
      const dir = joystickDirRef.current
        ?? (() => {
          for (const [key, [dx, dy]] of Object.entries(DIRS)) {
            if (keysRef.current.has(key))
              return dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
          }
          return null;
        })();
      if (dir !== lastDirRef.current) {
        lastDirRef.current = dir;
        const dx = dir === "right" ? 1 : dir === "left" ? -1 : 0;
        const dy = dir === "down" ? 1 : dir === "up" ? -1 : 0;
        socket.emit("setDir", { code, dx, dy });
      }
    }, 16);
    return () => { clearInterval(interval); socket.emit("setDir", { code, dx: 0, dy: 0 }); };
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

    function getDispPos(p: { id: string; x: number; y: number }) {
      const tw = tweens.current.get(p.id);
      if (!tw) return { x: p.x, y: p.y };
      const dur = tw.dur ?? 130;
      const t = Math.min(1, (Date.now() - tw.startMs) / dur);
      const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      return { x: tw.srcX + (tw.dstX - tw.srcX) * e, y: tw.srcY + (tw.dstY - tw.srcY) * e };
    }

    function draw() {
      const now = Date.now();
      const dt = lastFrameMs.current ? Math.min(now - lastFrameMs.current, 50) : 16;
      lastFrameMs.current = now;
      const gs = stateRef.current;

      // screen shake
      const shaking = now < shakeRef.current.until;
      ctx.save();
      if (shaking) {
        const intensity = (1 - (now - (shakeRef.current.until - 220)) / 220) * 3.5;
        ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
      }

      ctx.clearRect(0, 0, W, H);

      // ── background — dark radial vignette ──
      const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.75);
      bgGrad.addColorStop(0, "#13121f"); bgGrad.addColorStop(1, "#080810");
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

      // ── grid ──
      gs.map.forEach((row, y) => {
        row.forEach((cell, x) => {
          const px = x * CS, py = y * CS;

          if (cell === 1) {
            // hard block — dark marble + gold trim
            const g = ctx.createLinearGradient(px, py, px+CS, py+CS);
            g.addColorStop(0, "#18182a"); g.addColorStop(1, "#0c0c18");
            ctx.fillStyle = g; ctx.fillRect(px, py, CS, CS);
            // top/left highlight bevel
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.fillRect(px, py, CS, CS*0.08);
            ctx.fillRect(px, py, CS*0.07, CS);
            // bottom/right shadow
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillRect(px, py+CS*0.92, CS, CS*0.08);
            ctx.fillRect(px+CS*0.93, py, CS*0.07, CS);
            // gold outer border
            ctx.strokeStyle = "rgba(212,168,67,0.3)"; ctx.lineWidth = 1.5;
            ctx.strokeRect(px+0.75, py+0.75, CS-1.5, CS-1.5);
            // etched X pattern
            ctx.beginPath();
            ctx.moveTo(px+CS*0.28, py+CS*0.28); ctx.lineTo(px+CS*0.72, py+CS*0.72);
            ctx.moveTo(px+CS*0.72, py+CS*0.28); ctx.lineTo(px+CS*0.28, py+CS*0.72);
            ctx.strokeStyle = "rgba(212,168,67,0.12)"; ctx.lineWidth = 0.8; ctx.stroke();

          } else if (cell === 2) {
            // soft block — dark crate, gold rope X
            const g = ctx.createLinearGradient(px, py, px+CS, py+CS);
            g.addColorStop(0, "#221508"); g.addColorStop(1, "#140d04");
            ctx.fillStyle = g; ctx.fillRect(px, py, CS, CS);
            // plank lines
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(px, py+CS/3-0.5, CS, 1);
            ctx.fillRect(px, py+CS*2/3-0.5, CS, 1);
            // vertical center seam
            ctx.fillRect(px+CS/2-0.5, py, 1, CS);
            // gold rope X
            ctx.beginPath();
            ctx.moveTo(px+CS*0.15, py+CS*0.15); ctx.lineTo(px+CS*0.85, py+CS*0.85);
            ctx.moveTo(px+CS*0.85, py+CS*0.15); ctx.lineTo(px+CS*0.15, py+CS*0.85);
            ctx.strokeStyle = "rgba(212,168,67,0.4)"; ctx.lineWidth = 1.2; ctx.stroke();
            // corner nails
            [[0.12,0.12],[0.88,0.12],[0.12,0.88],[0.88,0.88]].forEach(([nx,ny]) => {
              ctx.beginPath(); ctx.arc(px+nx*CS, py+ny*CS, CS*0.04, 0, Math.PI*2);
              ctx.fillStyle = "rgba(212,168,67,0.55)"; ctx.fill();
            });
            // outer border
            ctx.strokeStyle = "rgba(212,168,67,0.25)"; ctx.lineWidth = 1;
            ctx.strokeRect(px+1, py+1, CS-2, CS-2);

          } else {
            // floor — dark tile with subtle gold grid
            ctx.fillStyle = (x+y)%2===0 ? "#0f0f1c" : "#0d0d18";
            ctx.fillRect(px, py, CS, CS);
            // subtle gold tile lines
            ctx.strokeStyle = "rgba(212,168,67,0.05)"; ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, CS, CS);
            // occasional ✦ accent
            if ((x*3 + y*7) % 17 === 0) {
              ctx.fillStyle = "rgba(212,168,67,0.07)";
              ctx.font = `${CS*0.28}px sans-serif`;
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText("✦", px+CS/2, py+CS/2);
            }
          }
        });
      });

      // ── canvas gold border frame ──
      ctx.strokeStyle = "rgba(212,168,67,0.35)"; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W-2, H-2);
      // corner ornaments
      [[0,0],[W,0],[0,H],[W,H]].forEach(([ox,oy]) => {
        const sx = ox===0?1:W-1, sy = oy===0?1:H-1;
        const dx = ox===0?1:-1, dy = oy===0?1:-1;
        ctx.beginPath();
        ctx.moveTo(sx+dx*CS*0.4, sy); ctx.lineTo(sx, sy); ctx.lineTo(sx, sy+dy*CS*0.4);
        ctx.strokeStyle = "rgba(212,168,67,0.6)"; ctx.lineWidth = 2.5; ctx.stroke();
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

      // bombs — visuals stack based on owner powerups
      gs.bombs.forEach((bomb) => {
        const px = bomb.x * CS + CS / 2, py = bomb.y * CS + CS / 2;
        const owner = gs.players[bomb.ownerId];
        const bRange = owner?.range ?? 1;
        const bBombs = owner?.maxBombs ?? 1;
        const bWallbreak = bomb.ownerId ? wallbreakLabels.current.has(bomb.ownerId) : false;
        const pulse = 0.85 + 0.15 * Math.sin(now / 150);

        // range ≥ 2: red outer glow (scales with range)
        if (bRange >= 2) {
          const glowR = CS * 0.55 * (1 + (bRange - 2) * 0.1);
          const g = ctx.createRadialGradient(px, py, CS * 0.2, px, py, glowR);
          g.addColorStop(0, `rgba(248,113,113,${0.15 + (bRange-2)*0.05})`);
          g.addColorStop(1, "rgba(248,113,113,0)");
          ctx.beginPath(); ctx.arc(px, py, glowR, 0, Math.PI * 2);
          ctx.fillStyle = g; ctx.fill();
        }
        // maxBombs > 1: purple glow
        if (bBombs > 1) {
          const g = ctx.createRadialGradient(px, py, CS*0.1, px, py, CS*0.5);
          g.addColorStop(0, `rgba(192,132,252,${0.1*(bBombs-1)})`);
          g.addColorStop(1, "rgba(192,132,252,0)");
          ctx.beginPath(); ctx.arc(px, py, CS*0.5, 0, Math.PI*2);
          ctx.fillStyle = g; ctx.fill();
        }
        // wallbreak: gold shimmer ring
        if (bWallbreak) {
          ctx.beginPath(); ctx.arc(px, py, CS*0.46*pulse, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(212,168,67,0.5)`; ctx.lineWidth = 1.5; ctx.stroke();
        }

        // range preview dots — only owner sees
        if (bRange >= 2 && bomb.ownerId === myId) {
          [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
            for (let i = 1; i <= bRange; i++) {
              const nx = bomb.x+dx*i, ny = bomb.y+dy*i;
              if (nx<0||ny<0||nx>=GRID_W||ny>=GRID_H) break;
              if (gs.map[ny][nx] === 1) break;
              ctx.beginPath();
              ctx.arc(nx*CS+CS/2, ny*CS+CS/2, CS*0.07, 0, Math.PI*2);
              ctx.fillStyle = `rgba(248,113,113,${0.55 - i*0.05})`; ctx.fill();
              if (gs.map[ny][nx] === 2) break;
            }
          });
        }

        // bomb body
        ctx.beginPath(); ctx.arc(px, py, CS*0.36*pulse, 0, Math.PI*2);
        ctx.fillStyle = "#1a0a0a"; ctx.fill();

        // interior buff colors — colored arc segments (everyone sees, no level info)
        const buffColors: string[] = [];
        if (bRange > 1) buffColors.push("#f87171");   // red = range
        if (bBombs > 1) buffColors.push("#c084fc");   // purple = bombs
        if (bWallbreak) buffColors.push("#d4a843");   // gold = wallbreak
        if (buffColors.length > 0) {
          const innerR = CS * 0.24 * pulse;
          const sliceAngle = (Math.PI * 2) / buffColors.length;
          buffColors.forEach((col, i) => {
            const start = -Math.PI / 2 + i * sliceAngle;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.arc(px, py, innerR, start, start + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = col + "bb"; ctx.fill();
          });
          // center shine
          ctx.beginPath(); ctx.arc(px, py, innerR * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fill();
        }

        // outline — color reflects dominant buff
        ctx.beginPath(); ctx.arc(px, py, CS*0.36*pulse, 0, Math.PI*2);
        ctx.strokeStyle = bWallbreak ? "#d4a843" : bBombs > 1 ? "#c084fc" : bRange > 1 ? "#f87171" : "#f87171";
        ctx.lineWidth = 2.5; ctx.stroke();
        // fuse
        ctx.beginPath();
        ctx.moveTo(px+4, py-CS*0.3);
        ctx.quadraticCurveTo(px+10, py-CS*0.45, px+6, py-CS*0.5);
        ctx.strokeStyle = bWallbreak ? "#d4a843" : "#fbbf24";
        ctx.lineWidth = 2; ctx.stroke();
      });

      // explosions
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


      // players — chibi character (head + body), smooth interpolated position
      Object.values(gs.players).forEach((p) => {
        if (!p.alive) return;
        const dp = getDispPos(p);
        const cx = dp.x * CS, cy = dp.y * CS;
        const color = PLAYER_COLORS[p.slot];
        const isMe = p.id === myId;
        const pRange = p.range ?? 1;
        const pBombs = p.maxBombs ?? 1;
        const pSpeed = p.speed ?? 1;
        const pWallbreak = wallbreakLabels.current.has(p.id);

        // speed trail (green ghosts) — update history
        if (pSpeed > 1) {
          const hist = trailHistory.current.get(p.id) ?? [];
          hist.push({ x: cx, y: cy, t: now });
          const cutoff = now - 220;
          const trimmed = hist.filter(h => h.t > cutoff).slice(-4);
          trailHistory.current.set(p.id, trimmed);
          trimmed.forEach((h, i) => {
            const age = (now - h.t) / 220;
            ctx.beginPath(); ctx.arc(h.x, h.y, CS * 0.27 * (1 - age * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(74,222,128,${0.18 * (1 - age)})`; ctx.fill();
          });
        }

        // range ≥ 3: red outer aura ring
        if (pRange >= 3) {
          ctx.beginPath(); ctx.arc(cx, cy, CS * (0.55 + (pRange-3)*0.04), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(248,113,113,${0.25 + (pRange-3)*0.05})`;
          ctx.lineWidth = 1.5; ctx.stroke();
        }

        const hR = CS * 0.28;
        const hY = cy - CS * 0.15;
        const bW = CS * 0.36, bH = CS * 0.25;
        const bY = cy + CS * 0.18;
        const HAIR = ["#1d4ed8","#b91c1c","#15803d","#7e22ce"];
        const hairColor = HAIR[p.slot] ?? "#333";
        const SKIN = "#ffd5a8";

        // ground shadow
        ctx.beginPath();
        ctx.ellipse(cx, cy + CS * 0.4, CS * 0.2, CS * 0.05, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();

        // ambient glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, CS * 0.6);
        glow.addColorStop(0, color + (isMe ? "44" : "22"));
        glow.addColorStop(1, color + "00");
        ctx.beginPath(); ctx.arc(cx, cy, CS * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = glow; ctx.fill();

        // ── BODY (suit/outfit) ──
        ctx.beginPath();
        ctx.roundRect(cx - bW/2, bY - bH/2, bW, bH, bH * 0.35);
        ctx.fillStyle = color + "dd"; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = isMe ? 2 : 1.5; ctx.stroke();
        // suit center line
        ctx.beginPath(); ctx.moveTo(cx, bY - bH*0.45); ctx.lineTo(cx, bY + bH*0.4);
        ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1; ctx.stroke();
        // collar
        ctx.beginPath();
        ctx.moveTo(cx - bW*0.18, bY - bH*0.45);
        ctx.lineTo(cx, bY - bH*0.2);
        ctx.lineTo(cx + bW*0.18, bY - bH*0.45);
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();

        // ── ARMS ──
        [-1, 1].forEach(s => {
          ctx.beginPath();
          ctx.ellipse(cx + s*(bW/2 + CS*0.055), bY - CS*0.02, CS*0.075, CS*0.05, s*0.25, 0, Math.PI*2);
          ctx.fillStyle = color + "dd"; ctx.fill();
          ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
        });

        // ── HAIR (drawn behind head) ──
        ctx.save();
        if (p.slot === 0) {
          // Spiky hero — 3 spikes up
          const spikes = [[-0.35, -1.15], [0, -1.3], [0.35, -1.1]];
          spikes.forEach(([ox, oy]) => {
            ctx.beginPath();
            ctx.moveTo(cx + ox*hR - hR*0.12, hY + hR*0.1);
            ctx.lineTo(cx + ox*hR, hY + oy*hR);
            ctx.lineTo(cx + ox*hR + hR*0.12, hY + hR*0.1);
            ctx.closePath(); ctx.fillStyle = hairColor; ctx.fill();
          });
          ctx.beginPath(); ctx.arc(cx, hY, hR, Math.PI, 0);
          ctx.fillStyle = hairColor; ctx.fill();
        } else if (p.slot === 1) {
          // Fierce swept right — angular
          ctx.beginPath();
          ctx.moveTo(cx - hR*0.9, hY + hR*0.3);
          ctx.bezierCurveTo(cx - hR*1.1, hY - hR*0.7, cx - hR*0.2, hY - hR*1.3, cx + hR*0.6, hY - hR*1.0);
          ctx.bezierCurveTo(cx + hR*1.2, hY - hR*0.7, cx + hR*0.9, hY - hR*0.1, cx + hR*0.6, hY + hR*0.1);
          ctx.bezierCurveTo(cx + hR*0.1, hY - hR*0.2, cx - hR*0.3, hY + hR*0.0, cx - hR*0.6, hY + hR*0.2);
          ctx.closePath(); ctx.fillStyle = hairColor; ctx.fill();
          // ahoge
          ctx.beginPath();
          ctx.moveTo(cx + hR*0.1, hY - hR*0.85);
          ctx.bezierCurveTo(cx + hR*0.5, hY - hR*1.6, cx + hR*0.9, hY - hR*1.3, cx + hR*0.7, hY - hR*0.6);
          ctx.strokeStyle = hairColor; ctx.lineWidth = hR*0.28; ctx.lineCap = "round"; ctx.stroke();
        } else if (p.slot === 2) {
          // Cute fluffy twin puffs
          ctx.beginPath(); ctx.arc(cx, hY, hR, Math.PI, 0);
          ctx.fillStyle = hairColor; ctx.fill();
          [-0.52, 0.52].forEach(ox => {
            ctx.beginPath(); ctx.arc(cx + ox*hR, hY - hR*0.62, hR*0.48, 0, Math.PI*2);
            ctx.fillStyle = hairColor; ctx.fill();
          });
          // top puff
          ctx.beginPath(); ctx.arc(cx, hY - hR*0.82, hR*0.36, 0, Math.PI*2);
          ctx.fillStyle = hairColor; ctx.fill();
        } else {
          // Mysterious long side-swept left
          ctx.beginPath();
          ctx.arc(cx, hY, hR, Math.PI, 0);
          ctx.fillStyle = hairColor; ctx.fill();
          // long sweep left
          ctx.beginPath();
          ctx.moveTo(cx + hR*0.4, hY - hR*0.85);
          ctx.bezierCurveTo(cx - hR*0.3, hY - hR*1.1, cx - hR*1.1, hY - hR*0.6, cx - hR*1.05, hY + hR*0.45);
          ctx.bezierCurveTo(cx - hR*0.85, hY + hR*0.7, cx - hR*0.3, hY + hR*0.2, cx, hY + hR*0.05);
          ctx.fillStyle = hairColor; ctx.fill();
          // hair strand over eye
          ctx.beginPath();
          ctx.moveTo(cx - hR*0.1, hY - hR*0.9);
          ctx.bezierCurveTo(cx - hR*0.6, hY - hR*0.5, cx - hR*0.7, hY + hR*0.1, cx - hR*0.55, hY + hR*0.35);
          ctx.strokeStyle = hairColor; ctx.lineWidth = hR*0.32; ctx.lineCap = "round"; ctx.stroke();
        }
        ctx.restore();

        // ── HEAD ──
        ctx.beginPath(); ctx.arc(cx, hY, hR, 0, Math.PI*2);
        ctx.fillStyle = SKIN; ctx.fill();
        ctx.strokeStyle = isMe ? color : "rgba(0,0,0,0.2)";
        ctx.lineWidth = isMe ? 2 : 1; ctx.stroke();

        // ── EYES ──
        const eyeY = hY + hR * 0.02;
        const eyeOff = hR * 0.33;
        // slot 3: left eye covered by hair — only draw right
        const eyeSlots = p.slot === 3 ? [cx + eyeOff] : [cx - eyeOff, cx + eyeOff];
        eyeSlots.forEach((ex) => {
          ctx.beginPath(); ctx.ellipse(ex, eyeY, hR*0.2, hR*0.23, 0, 0, Math.PI*2);
          ctx.fillStyle = "#fff"; ctx.fill();
          ctx.beginPath(); ctx.arc(ex, eyeY + hR*0.04, hR*0.13, 0, Math.PI*2);
          ctx.fillStyle = color; ctx.fill();
          ctx.beginPath(); ctx.arc(ex, eyeY + hR*0.04, hR*0.07, 0, Math.PI*2);
          ctx.fillStyle = "#111"; ctx.fill();
          ctx.beginPath(); ctx.arc(ex - hR*0.06, eyeY - hR*0.04, hR*0.04, 0, Math.PI*2);
          ctx.fillStyle = "#fff"; ctx.fill();
        });

        // blush
        [cx - hR*0.44, cx + hR*0.44].forEach(bx => {
          ctx.beginPath(); ctx.ellipse(bx, eyeY + hR*0.32, hR*0.17, hR*0.09, 0, 0, Math.PI*2);
          ctx.fillStyle = "rgba(255,140,140,0.35)"; ctx.fill();
        });

        // nose
        ctx.beginPath(); ctx.arc(cx, hY + hR*0.22, hR*0.045, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fill();

        // mouth per slot
        ctx.lineWidth = hR * 0.12; ctx.lineCap = "round";
        if (p.slot === 0) {
          ctx.beginPath(); ctx.arc(cx, hY + hR*0.38, hR*0.2, 0.2, Math.PI-0.2);
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
        } else if (p.slot === 1) {
          ctx.beginPath(); ctx.moveTo(cx - hR*0.22, hY + hR*0.4); ctx.lineTo(cx + hR*0.22, hY + hR*0.4);
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
        } else if (p.slot === 2) {
          ctx.beginPath(); ctx.arc(cx, hY + hR*0.3, hR*0.22, 0.1, Math.PI-0.1);
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
          // ω dots
          [cx - hR*0.2, cx + hR*0.2].forEach(mx => {
            ctx.beginPath(); ctx.arc(mx, hY + hR*0.44, hR*0.04, 0, Math.PI*2);
            ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();
          });
        } else {
          ctx.beginPath();
          ctx.moveTo(cx - hR*0.12, hY + hR*0.42);
          ctx.bezierCurveTo(cx, hY + hR*0.36, cx + hR*0.18, hY + hR*0.4, cx + hR*0.22, hY + hR*0.36);
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
        }

        // crown for "me" — gold ✦ above head
        if (isMe) {
          ctx.fillStyle = "#d4a843";
          ctx.font = `bold ${Math.max(10, CS * 0.26)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("✦", cx, hY - hR - CS * 0.14);
        }

        // maxBombs > 1: purple ×N badge (bottom-right of body)
        if (pBombs > 1) {
          const badgeX = cx + bW*0.5 + CS*0.08, badgeY = bY + bH*0.2;
          const br = CS * 0.15;
          ctx.beginPath(); ctx.arc(badgeX, badgeY, br, 0, Math.PI * 2);
          ctx.fillStyle = "#c084fc"; ctx.fill();
          ctx.font = `bold ${Math.max(7, CS * 0.17)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = "#fff"; ctx.fillText(`×${pBombs}`, badgeX, badgeY);
        }
        // speed > 1: green speed lines on right side of body
        if (pSpeed > 1) {
          const lines = Math.min(Math.floor(pSpeed), 3);
          for (let i = 0; i < lines; i++) {
            const ly = bY - bH*0.2 + i * bH*0.25;
            ctx.beginPath();
            ctx.moveTo(cx + bW*0.55, ly);
            ctx.lineTo(cx + bW*0.95, ly - CS*0.04);
            ctx.strokeStyle = `rgba(74,222,128,0.75)`; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.stroke();
          }
        }

        // "โคตรเสียว" wallbreak label
        const showWb = wallbreakLabels.current.has(p.id);
        const nameBaseY = hY - hR - (isMe ? CS * 0.28 : CS * 0.06);
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

      // particles
      particles.current = particles.current.filter((p) => { p.life -= dt; p.cx += p.vcx * dt; p.cy += p.vcy * dt; return p.life > 0; });
      particles.current.forEach((p) => {
        const alpha = p.life / p.maxLife;
        const hex = Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx.beginPath();
        ctx.arc(p.cx * CS, p.cy * CS, p.r * CS, 0, Math.PI * 2);
        ctx.fillStyle = p.color + hex;
        ctx.fill();
      });

      ctx.restore(); // end shake transform
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
        {/* Left — Virtual Joystick */}
        {showControls && (
          <VirtualJoystick
            dirRef={joystickDirRef}
            onDirChange={(dir) => {
              if (!dead && !isSpectator) {
                const dx = dir === "right" ? 1 : dir === "left" ? -1 : 0;
                const dy = dir === "down" ? 1 : dir === "up" ? -1 : 0;
                socket.emit("setDir", { code, dx, dy });
                lastDirRef.current = dir;
              }
            }}
          />
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

// ── Virtual Joystick ──
function VirtualJoystick({ dirRef, onDirChange }: { dirRef: React.MutableRefObject<string | null>; onDirChange?: (dir: string | null) => void }) {
  const OUTER = 72; // outer radius px
  const KNOB = 26;  // knob radius px
  const DEAD = 0.25; // deadzone fraction
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activePtr = useRef<number | null>(null);
  const baseRef = useRef<{ x: number; y: number } | null>(null);
  const prevDirRef = useRef<string | null>(null);

  function getDir(dx: number, dy: number): string | null {
    if (Math.sqrt(dx * dx + dy * dy) < OUTER * DEAD) return null;
    const a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (a >= -45 && a < 45) return "right";
    if (a >= 45 && a < 135) return "down";
    if (a >= 135 || a < -135) return "left";
    return "up";
  }

  function onDown(e: React.PointerEvent) {
    e.preventDefault();
    if (activePtr.current !== null) return;
    activePtr.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    baseRef.current = { x: e.clientX, y: e.clientY };
    setKnob({ x: 0, y: 0 });
  }
  function onMove(e: React.PointerEvent) {
    if (e.pointerId !== activePtr.current || !baseRef.current) return;
    e.preventDefault();
    const dx = e.clientX - baseRef.current.x;
    const dy = e.clientY - baseRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, OUTER);
    const kx = dist > 0 ? (dx / dist) * clamped : 0;
    const ky = dist > 0 ? (dy / dist) * clamped : 0;
    setKnob({ x: kx, y: ky });
    const newDir = getDir(kx, ky);
    dirRef.current = newDir;
    if (newDir !== prevDirRef.current) { prevDirRef.current = newDir; onDirChange?.(newDir); }
  }
  function onUp(e: React.PointerEvent) {
    if (e.pointerId !== activePtr.current) return;
    activePtr.current = null;
    baseRef.current = null;
    dirRef.current = null;
    prevDirRef.current = null;
    onDirChange?.(null);
    setKnob({ x: 0, y: 0 });
  }

  const SIZE = OUTER * 2;
  return (
    <div
      style={{ width: SIZE, height: SIZE, flexShrink: 0, touchAction: "none", userSelect: "none", position: "relative" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    >
      {/* outer ring */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "rgba(255,255,255,0.07)",
        border: "2px solid rgba(255,255,255,0.18)",
      }} />
      {/* crosshair lines */}
      <div style={{ position: "absolute", left: "50%", top: "18%", bottom: "18%", width: 1, background: "rgba(255,255,255,0.1)", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: "18%", right: "18%", height: 1, background: "rgba(255,255,255,0.1)", transform: "translateY(-50%)" }} />
      {/* knob */}
      <div style={{
        position: "absolute",
        width: KNOB * 2, height: KNOB * 2,
        borderRadius: "50%",
        left: OUTER - KNOB + knob.x,
        top: OUTER - KNOB + knob.y,
        background: knob.x === 0 && knob.y === 0
          ? "rgba(255,255,255,0.25)"
          : "rgba(212,168,67,0.85)",
        border: "2px solid rgba(255,255,255,0.5)",
        boxShadow: knob.x === 0 && knob.y === 0 ? "none" : "0 0 12px rgba(212,168,67,0.6)",
        transition: "background 0.1s, box-shadow 0.1s",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Bomb button (right side) ──
function BombButton({ onBomb }: { onBomb: () => void }) {
  return (
    <button
      style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(248,113,113,.25)", border: "2px solid rgba(248,113,113,.6)", fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", userSelect: "none", boxShadow: "0 4px 20px rgba(248,113,113,.3)" }}
      onPointerDown={(e) => { e.preventDefault(); onBomb(); }}
    >💣</button>
  );
}
