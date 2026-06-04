'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server: IOServer } = require('socket.io');
const sharp = require('./node_modules/sharp');

// ── Static file serving ────────────────────────────────────────────────────
const MIME = {
  '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json',
  '.txt': 'text/plain',
};

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', filePath.includes('/_next/static/') ? 'public,max-age=31536000,immutable' : 'public,max-age=3600');
    res.end(data);
  });
}

// ── Next.js standalone bootstrap ──────────────────────────────────────────
process.env.NODE_ENV = 'production';
const NextServer = require('./node_modules/next/dist/server/next-server').default;
const requiredFiles = require('./.next/required-server-files.json');

const nextApp = new NextServer({
  hostname: process.env.HOSTNAME || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  dir: __dirname,
  dev: false,
  customServer: true,
  conf: requiredFiles.config,
});

const handle = nextApp.getRequestHandler();

// ── Room Manager ───────────────────────────────────────────────────────────
const { nanoid } = require('nanoid');

/** @type {Map<string, Room>} */
const rooms = new Map();

const GRID_W = 13;
const GRID_H = 11;
const PLAYER_COLORS = ['#60a5fa', '#f87171', '#4ade80', '#c084fc'];
const BOT_NAMES = ['ShadowBot', 'GhostBot', 'CurseBot', 'PhantomBot'];
const RECONNECT_TIMEOUT = 30000; // 30s

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? makeCode() : code;
}

function makeRoom(hostId, hostName, roomName) {
  const code = makeCode();
  const room = {
    code,
    roomName: roomName || `ห้องของ ${hostName}`,
    hostId,
    hostName,
    locked: false,
    phase: 'lobby',
    players: [
      { id: hostId, name: hostName, slot: 0, ready: true, isBot: false, connected: true, reconnectTimer: null },
    ],
    spectators: [],
    gameState: null,
  };
  rooms.set(code, room);
  return room;
}

function roomSummary(room) {
  const bots = room.players.filter(p => p.isBot).length;
  const humans = room.players.filter(p => !p.isBot).length;
  return {
    code: room.code,
    roomName: room.roomName,
    hostName: room.hostName,
    playerCount: room.players.length,
    humanCount: humans,
    botCount: bots,
    locked: room.locked,
    phase: room.phase,
  };
}

function roomInfo(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    locked: room.locked,
    phase: room.phase,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      ready: p.ready,
      isBot: p.isBot,
      connected: p.connected,
    })),
  };
}

function freeSlots(room) {
  const taken = new Set(room.players.map((p) => p.slot));
  return [0, 1, 2, 3].filter((s) => !taken.has(s));
}

function addBot(room) {
  const free = freeSlots(room);
  if (!free.length) return;
  const slot = free[0];
  room.players.push({
    id: `bot-${slot}-${room.code}`,
    name: BOT_NAMES[slot],
    slot,
    ready: true,
    isBot: true,
    connected: true,
    reconnectTimer: null,
  });
}

function removeBot(room) {
  const idx = room.players.findIndex((p) => p.isBot);
  if (idx !== -1) room.players.splice(idx, 1);
}

function allReady(room) {
  return room.players.length >= 2 && room.players.every((p) => p.ready || p.isBot);
}

// ── Game Engine ────────────────────────────────────────────────────────────
const CELL = { EMPTY: 0, HARD: 1, SOFT: 2 };
const BASE_SPEED = 3.8; // cells/sec
const PLAYER_R = 0.32;  // collision half-size

function playerCell(p) { return { x: Math.floor(p.x), y: Math.floor(p.y) }; }

function isSolid(gs, cx, cy, playerId) {
  if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true;
  if (gs.map[cy][cx] !== CELL.EMPTY) return true;
  if (gs.bombs.some(b => b.x === cx && b.y === cy && b.passFor !== playerId)) return true;
  return false;
}

function physicsMove(gs, p, dt, playerId) {
  if (!p.dx && !p.dy) return;
  const spd = BASE_SPEED * (p.speed || 1) * dt / 1000;
  const R = PLAYER_R;
  let nx = p.x + p.dx * spd;
  let ny = p.y + p.dy * spd;
  // X collision + corner correction
  if (p.dx) {
    const ex = nx + (p.dx > 0 ? R : -R);
    const cy1 = Math.floor(p.y - R + 0.01), cy2 = Math.floor(p.y + R - 0.01);
    const cx = Math.floor(ex);
    const b1 = isSolid(gs, cx, cy1, playerId), b2 = isSolid(gs, cx, cy2, playerId);
    if (b1 || b2) {
      nx = p.dx > 0 ? cx - R - 0.001 : cx + 1 + R + 0.001;
      if (b1 !== b2) {
        const openCY = b1 ? cy2 : cy1;
        const targetY = openCY + 0.5;
        const diff = targetY - p.y;
        ny += Math.sign(diff) * Math.min(Math.abs(diff), spd * 2);
      }
    }
  }
  // Y collision + corner correction
  if (p.dy) {
    const ey = ny + (p.dy > 0 ? R : -R);
    const cx1 = Math.floor(nx - R + 0.01), cx2 = Math.floor(nx + R - 0.01);
    const cy = Math.floor(ey);
    const b1 = isSolid(gs, cx1, cy, playerId), b2 = isSolid(gs, cx2, cy, playerId);
    if (b1 || b2) {
      ny = p.dy > 0 ? cy - R - 0.001 : cy + 1 + R + 0.001;
      if (b1 !== b2) {
        const openCX = b1 ? cx2 : cx1;
        const targetX = openCX + 0.5;
        const diff = targetX - nx;
        nx += Math.sign(diff) * Math.min(Math.abs(diff), spd * 2);
      }
    }
  }
  p.x = Math.max(R, Math.min(GRID_W - R, nx));
  p.y = Math.max(R, Math.min(GRID_H - R, ny));

  // Safety net: corner-correction can occasionally shove the body into a solid
  // cell (notably the border), leaving a unit stuck inside a wall. Push it back
  // out so players/bots can never end up — or place bombs — inside a wall.
  for (let iter = 0; iter < 2; iter++) {
    let fixed = false;
    const cxL = Math.floor(p.x - R + 0.001), cxR = Math.floor(p.x + R - 0.001), row = Math.floor(p.y);
    if (isSolid(gs, cxL, row, playerId)) { p.x = cxL + 1 + R + 0.001; fixed = true; }
    else if (isSolid(gs, cxR, row, playerId)) { p.x = cxR - R - 0.001; fixed = true; }
    const cyT = Math.floor(p.y - R + 0.001), cyB = Math.floor(p.y + R - 0.001), col = Math.floor(p.x);
    if (isSolid(gs, col, cyT, playerId)) { p.y = cyT + 1 + R + 0.001; fixed = true; }
    else if (isSolid(gs, col, cyB, playerId)) { p.y = cyB - R - 0.001; fixed = true; }
    if (!fixed) break;
  }
}

function checkPowerups(gs, p) {
  const pIdx = gs.powerups.findIndex(pu =>
    Math.abs(p.x - (pu.x + 0.5)) < 0.55 && Math.abs(p.y - (pu.y + 0.5)) < 0.55
  );
  if (pIdx === -1) return null;
  const pu = gs.powerups[pIdx];
  let wallbreakUser = null;
  if (pu.type === 'range') p.range = Math.min(p.range + 1, 8);
  if (pu.type === 'bombs') p.maxBombs = Math.min(p.maxBombs + 1, 5);
  if (pu.type === 'speed') p.speed = Math.min(p.speed + 0.5, 3);
  if (pu.type === 'wallbreak') { p.hasWallbreak = true; wallbreakUser = { name: p.name, cleared: 0 }; }
  gs.powerups.splice(pIdx, 1);
  return { wallbreakUser, collected: { x: pu.x + 0.5, y: pu.y + 0.5, type: pu.type } };
}

function dirToDxDy(dir) {
  return dir==='right'?{dx:1,dy:0}:dir==='left'?{dx:-1,dy:0}:dir==='down'?{dx:0,dy:1}:{dx:0,dy:-1};
}
const POWERUPS = ['range', 'bombs', 'speed', 'wallbreak'];

function buildMap() {
  const map = [];
  for (let y = 0; y < GRID_H; y++) {
    map.push([]);
    for (let x = 0; x < GRID_W; x++) {
      // hard blocks on even grid positions (classic bomberman)
      if (x % 2 === 0 && y % 2 === 0) { map[y].push(CELL.HARD); continue; }
      // corners free for players
      const corner =
        (x <= 2 && y <= 2) || (x >= GRID_W - 3 && y <= 2) ||
        (x <= 2 && y >= GRID_H - 3) || (x >= GRID_W - 3 && y >= GRID_H - 3);
      if (corner) { map[y].push(CELL.EMPTY); continue; }
      map[y].push(Math.random() < 0.6 ? CELL.SOFT : CELL.EMPTY);
    }
  }
  return map;
}

const SPAWN_POSITIONS = [
  { x: 1, y: 1 }, { x: GRID_W - 2, y: 1 },
  { x: 1, y: GRID_H - 2 }, { x: GRID_W - 2, y: GRID_H - 2 },
];

function initGameState(room) {
  const map = buildMap();
  const playerStates = {};
  room.players.forEach((p) => {
    const pos = SPAWN_POSITIONS[p.slot];
    playerStates[p.id] = {
      id: p.id, name: p.name, slot: p.slot, isBot: p.isBot,
      x: pos.x + 0.5, y: pos.y + 0.5, dx: 0, dy: 0,
      alive: true, speed: 1, maxBombs: 1, range: 1, kills: 0, selfKill: false, hasWallbreak: false, fleeUntil: 0,
      activeBombs: 0,
    };
  });
  return {
    map,
    players: playerStates,
    bombs: [],        // { id, x, y, ownerId, timer, range }
    explosions: [],   // { cells: [{x,y}], timer }
    powerups: [],     // { x, y, type }
    wallbreakSpawned: false,
    tick: 0,
    startedAt: Date.now(),
    suddenDeathAt: Date.now() + 3 * 60 * 1000, // 3 min
    suddenDeathWave: 0,
  };
}

let bombIdCounter = 0;

function placeBomb(gs, playerId) {
  const p = gs.players[playerId];
  if (!p || !p.alive) return null;
  if (p.activeBombs >= p.maxBombs) return null;
  const { x: bx, y: by } = playerCell(p);
  if (gs.bombs.find((b) => b.x === bx && b.y === by)) return null;
  const bomb = { id: ++bombIdCounter, x: bx, y: by, ownerId: playerId, timer: 3000, range: p.range, passFor: playerId };
  gs.bombs.push(bomb);
  p.activeBombs++;
  return bomb;
}

function explodeBomb(gs, bomb, io, roomCode) {
  gs.bombs = gs.bombs.filter((b) => b.id !== bomb.id);
  const owner = gs.players[bomb.ownerId];
  if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

  const cells = [{ x: bomb.x, y: bomb.y }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  dirs.forEach(([dx, dy]) => {
    for (let i = 1; i <= bomb.range; i++) {
      const nx = bomb.x + dx * i, ny = bomb.y + dy * i;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) break;
      if (gs.map[ny][nx] === CELL.HARD) break;
      cells.push({ x: nx, y: ny });
      if (gs.map[ny][nx] === CELL.SOFT) {
        gs.map[ny][nx] = CELL.EMPTY;
        // maybe drop powerup
        if (Math.random() < 0.35) {
          const pool = gs.wallbreakSpawned ? POWERUPS.filter(t => t !== 'wallbreak') : POWERUPS;
          const type = pool[Math.floor(Math.random() * pool.length)];
          if (type === 'wallbreak') gs.wallbreakSpawned = true;
          gs.powerups.push({ x: nx, y: ny, type });
        }
        // wallbreak buff: pierce through soft blocks (don't stop)
        if (!owner?.hasWallbreak) break;
      }
      // chain bomb?
      const chainBomb = gs.bombs.find((b) => b.x === nx && b.y === ny);
      if (chainBomb) { chainBomb.timer = 0; }
    }
  });

  // damage players
  cells.forEach(({ x, y }) => {
    Object.values(gs.players).forEach((p) => {
      if (p.alive && Math.floor(p.x) === x && Math.floor(p.y) === y) {
        p.alive = false;
        if (owner && owner.id === p.id) p.selfKill = true;
        else if (owner) owner.kills++;
        io.to(roomCode).emit('playerDied', { playerId: p.id });
      }
    });
  });

  gs.explosions.push({ cells, timer: 500 });
  io.to(roomCode).emit('explosion', { cells, bombId: bomb.id, ownerId: bomb.ownerId });
  io.to(roomCode).emit('mapUpdate', { map: gs.map, powerups: gs.powerups });
}


function alivePlayers(gs) {
  return Object.values(gs.players).filter((p) => p.alive);
}

// ── Bot AI ─────────────────────────────────────────────────────────────────
const BOT_TICK_MS = 100;
const botTimers = new Map(); // roomCode -> intervalId

/** Check if cell (cx,cy) is in any active bomb's blast path */
function isInBlastZone(gs, cx, cy) {
  for (const b of gs.bombs) {
    if (b.x === cx && b.y === cy) return true;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx,dy] of dirs) {
      for (let i = 1; i <= b.range; i++) {
        const nx = b.x + dx*i, ny = b.y + dy*i;
        if (nx < 0||ny < 0||nx >= GRID_W||ny >= GRID_H) break;
        if (gs.map[ny][nx] === CELL.HARD) break;
        if (nx === cx && ny === cy) return true;
        const bOwner = gs.players[b.ownerId];
        if (gs.map[ny][nx] === CELL.SOFT && !bOwner?.hasWallbreak) break;
      }
    }
  }
  return false;
}

// BFS: find first step toward nearest safe cell; returns dir string or null
function bfsEscape(gs, sx, sy, botId) {
  const queue = [[sx, sy, null]]; // [x, y, firstDir]
  const visited = new Set([`${sx},${sy}`]);
  const DIRS4 = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
  while (queue.length) {
    const [cx, cy, firstDir] = queue.shift();
    if (!isInBlastZone(gs, cx, cy) && !(cx === sx && cy === sy)) return firstDir;
    for (const [d, dx, dy] of DIRS4) {
      const nx = cx+dx, ny = cy+dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx<0||ny<0||nx>=GRID_W||ny>=GRID_H) continue;
      if (gs.map[ny][nx] !== CELL.EMPTY) continue;
      if (gs.bombs.some(b => b.x === nx && b.y === ny)) continue; // bombs are solid to everyone
      visited.add(key);
      queue.push([nx, ny, firstDir ?? d]);
    }
  }
  return null;
}

// BFS: find first step toward target (tx,ty), avoiding blast zones
function bfsChase(gs, sx, sy, tx, ty, botId) {
  const queue = [[sx, sy, null]];
  const visited = new Set([`${sx},${sy}`]);
  const DIRS4 = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
  while (queue.length) {
    const [cx, cy, firstDir] = queue.shift();
    if (cx === tx && cy === ty) return firstDir;
    for (const [d, dx, dy] of DIRS4) {
      const nx = cx+dx, ny = cy+dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx<0||ny<0||nx>=GRID_W||ny>=GRID_H) continue;
      if (gs.map[ny][nx] !== CELL.EMPTY) continue;
      if (gs.bombs.some(b => b.x === nx && b.y === ny)) continue; // bombs are solid
      if (isInBlastZone(gs, nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny, firstDir ?? d]);
    }
  }
  return null;
}

// BFS treating soft walls as passable — returns first step toward target (for wall-busting)
function bfsThruSoft(gs, sx, sy, tx, ty, botId) {
  const queue = [[sx, sy, null]];
  const visited = new Set([`${sx},${sy}`]);
  const DIRS4 = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
  while (queue.length) {
    const [cx, cy, firstDir] = queue.shift();
    if (cx === tx && cy === ty) return firstDir;
    for (const [d, dx, dy] of DIRS4) {
      const nx = cx+dx, ny = cy+dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx<0||ny<0||nx>=GRID_W||ny>=GRID_H) continue;
      if (gs.map[ny][nx] === CELL.HARD) continue;
      if (gs.bombs.some(b => b.x === nx && b.y === ny)) continue; // bombs are solid
      if (isInBlastZone(gs, nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny, firstDir ?? d]);
    }
  }
  return null;
}

// Returns escape direction after placing hypothetical bomb, or null if trapped
function canEscapeAfterBomb(gs, bx, by, range, ownerId) {
  const fakeBomb = { x: bx, y: by, range, ownerId };
  const fakeGs = { ...gs, bombs: [...gs.bombs, fakeBomb] };
  return bfsEscape(fakeGs, bx, by, ownerId); // direction string or null
}

function startBotAI(room, io) {
  if (botTimers.has(room.code)) return;
  const timer = setInterval(() => {
    const r = rooms.get(room.code);
    if (!r || r.phase !== 'playing') { clearInterval(timer); botTimers.delete(r?.code); return; }
    const gs = r.gameState;
    Object.values(gs.players).forEach((p) => {
      if (!p.isBot || !p.alive) return;
      const { x: px, y: py } = playerCell(p);
      const now = Date.now();
      const inDanger = isInBlastZone(gs, px, py) || now < p.fleeUntil;

      // ── FLEE ──
      if (inDanger) {
        // Already standing on a safe cell? Hold still and wait the bomb out.
        // While fleeUntil is active the bot stays in this branch; if it keeps
        // wandering it drifts back into a blast — the main cause of bots dying
        // next to their own bombs. Only move while the current cell is unsafe.
        if (!isInBlastZone(gs, px, py)) {
          p.dx = 0; p.dy = 0;
          return;
        }
        const escDir = bfsEscape(gs, px, py, p.id);
        // Pick the next cell on the escape path and steer toward ITS CENTER, rather
        // than holding a raw axis direction. Center-seeking makes the bot actually
        // arrive at each cell (no drift/overshoot/wall-pinning), so the next tick
        // re-plans from a clean cell and progress stays deterministic. This is the
        // fix for bots dying one cell from their own bomb.
        let next = null;
        if (escDir) {
          const d = dirToDxDy(escDir);
          next = { x: px + d.dx, y: py + d.dy };
        } else {
          // trapped: prefer an EMPTY, bomb-free neighbour OUTSIDE the blast,
          // then any such neighbour, else hold position
          const opts = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]
            .filter(([,ddx,ddy]) => {
              const nx=px+ddx, ny=py+ddy;
              return nx>=0&&ny>=0&&nx<GRID_W&&ny<GRID_H && gs.map[ny][nx]===CELL.EMPTY
                && !gs.bombs.some(b=>b.x===nx&&b.y===ny);
            });
          const pick = opts.find(([,ddx,ddy]) => !isInBlastZone(gs, px+ddx, py+ddy)) || opts[0];
          if (pick) { const d = dirToDxDy(pick[0]); next = { x: px + d.dx, y: py + d.dy }; }
        }
        if (next) {
          const tcx = next.x + 0.5, tcy = next.y + 0.5;
          p.dx = Math.abs(tcx - p.x) > 0.08 ? Math.sign(tcx - p.x) : 0;
          p.dy = Math.abs(tcy - p.y) > 0.08 ? Math.sign(tcy - p.y) : 0;
        } else { p.dx = 0; p.dy = 0; }
        return;
      }

      // ── PLACE BOMB ──
      // only bomb when near cell center — ensures physics can follow the BFS escape path
      const offCenter = Math.abs(p.x - (px + 0.5)) > 0.28 || Math.abs(p.y - (py + 0.5)) > 0.28;
      // Anti-sandwich: never drop a bomb when another bomb is already close enough
      // that the two blasts could overlap the escape corridor.
      const bombNearby = gs.bombs.some(b => Math.abs(b.x - px) + Math.abs(b.y - py) <= p.range + 2);
      if (!offCenter && !bombNearby && p.activeBombs < p.maxBombs && Math.random() < 0.3) {
        const humans = Object.values(gs.players).filter(q => q.alive && !q.isBot);
        const nearTarget = (() => {
          for (const [ddx,ddy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
            for (let i=1; i<=p.range; i++) {
              const nx=px+ddx*i, ny=py+ddy*i;
              if (nx<0||ny<0||nx>=GRID_W||ny>=GRID_H) break;
              if (gs.map[ny][nx]===CELL.HARD) break;
              if (gs.map[ny][nx]===CELL.SOFT) return true;
              if (humans.some(q => Math.hypot(q.x-(nx+0.5), q.y-(ny+0.5)) < 0.8)) return true;
            }
          }
          return false;
        })();
        const escDir = canEscapeAfterBomb(gs, px, py, p.range, p.id);
        if (nearTarget && escDir) {
          const bomb = placeBomb(gs, p.id);
          if (bomb) {
            io.to(r.code).emit('bombPlaced', { bomb, playerId: p.id });
            p.fleeUntil = Date.now() + 3300; // bomb timer 3000ms + 300ms buffer
            const d = dirToDxDy(escDir);
            p.dx = d.dx; p.dy = d.dy;
            return;
          }
        }
      }

      // ── CHASE nearest human ──
      const humans2 = Object.values(gs.players).filter(q => q.alive && !q.isBot);
      let chased = false;
      if (humans2.length) {
        const target = humans2.reduce((a, b) =>
          Math.hypot(a.x-p.x, a.y-p.y) < Math.hypot(b.x-p.x, b.y-p.y) ? a : b);
        const tx = Math.floor(target.x), ty = Math.floor(target.y);
        const chaseDir = bfsChase(gs, px, py, tx, ty, p.id)
          ?? bfsThruSoft(gs, px, py, tx, ty, p.id); // fallback: navigate through soft walls
        if (chaseDir) { const d = dirToDxDy(chaseDir); p.dx = d.dx; p.dy = d.dy; chased = true; }
      }

      // ── WANDER ──
      if (!chased) {
        const DIRS4 = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
        const safe = DIRS4.filter(([,ddx,ddy]) => {
          const nx=px+ddx, ny=py+ddy;
          return nx>=0&&ny>=0&&nx<GRID_W&&ny<GRID_H && gs.map[ny][nx]===CELL.EMPTY &&
            !gs.bombs.find(b=>b.x===nx&&b.y===ny) && !isInBlastZone(gs,nx,ny);
        });
        if (safe.length) { const d = dirToDxDy(safe[Math.floor(Math.random()*safe.length)][0]); p.dx = d.dx; p.dy = d.dy; }
        else { p.dx = 0; p.dy = 0; }
      }
    });
  }, BOT_TICK_MS);
  botTimers.set(room.code, timer);
}

// ── Game loop (bomb timers, sudden death) ──────────────────────────────────
const gameLoops = new Map(); // roomCode -> intervalId

function startGameLoop(room, io) {
  let last = Date.now();
  let posAcc = 0;
  const timer = setInterval(() => {
    const r = rooms.get(room.code);
    if (!r || r.phase !== 'playing') { clearInterval(timer); gameLoops.delete(r?.code); return; }
    const gs = r.gameState;
    const now = Date.now();
    const dt = Math.min(now - last, 50);
    last = now;
    gs.tick++;

    // ── physics ──
    Object.values(gs.players).forEach(p => {
      if (!p.alive) return;
      // clear bomb pass-through once player exits that cell
      gs.bombs.forEach(b => {
        if (b.passFor === p.id && (Math.floor(p.x) !== b.x || Math.floor(p.y) !== b.y))
          delete b.passFor;
      });
      physicsMove(gs, p, dt, p.id);
      const result = checkPowerups(gs, p);
      if (result) {
        io.to(r.code).emit('powerupsUpdate', { powerups: gs.powerups });
        io.to(r.code).emit('powerupCollected', { ...result.collected, playerId: p.id });
        if (result.wallbreakUser) io.to(r.code).emit('wallbreakUsed', { ...result.wallbreakUser, playerId: p.id });
      }
    });

    // ── bombs ──
    const toExplode = [];
    gs.bombs.forEach((b) => { b.timer -= dt; if (b.timer <= 0) toExplode.push(b); });
    toExplode.forEach((b) => explodeBomb(gs, b, io, r.code));

    // ── explosions ──
    gs.explosions.forEach((e) => { e.timer -= dt; });
    gs.explosions = gs.explosions.filter((e) => e.timer > 0);

    // ── sudden death ──
    if (now > gs.suddenDeathAt) {
      const wave = Math.floor((now - gs.suddenDeathAt) / 2000);
      if (wave > gs.suddenDeathWave) { gs.suddenDeathWave = wave; applySuddenDeath(gs, wave, io, r.code); }
    }

    // ── win check ──
    // When the game is decided, lock the winner but keep the loop running for a
    // short delay so the final explosion + death effect are visible and players
    // can see who was last standing. gameOver is emitted once, after the delay.
    if (!r.endingAt) {
      const alive = alivePlayers(gs);
      if (alive.length <= 1) {
        r.endingAt = now + 1500;
        const w = alive[0] || null;
        r.endWinner = w ? { id: w.id, name: w.name, isBot: w.isBot } : null;
      }
    }
    if (r.endingAt && now >= r.endingAt) {
      r.phase = 'ended';
      const winner = r.endWinner;
      const stats = Object.values(gs.players).map((p) => ({
        id: p.id, name: p.name, slot: p.slot, isBot: p.isBot, alive: p.alive, kills: p.kills, selfKill: p.selfKill,
      }));
      io.to(r.code).emit('gameOver', { winner: winner ? { id: winner.id, name: winner.name } : null, stats });
      clearInterval(timer); gameLoops.delete(r.code);
      const bt = botTimers.get(r.code);
      if (bt) { clearInterval(bt); botTimers.delete(r.code); }
      if (winner && !winner.isBot) saveWin(winner.id, winner.name, r.code);
    }

    // ── broadcast positions at ~30Hz ──
    posAcc += dt;
    if (posAcc >= 16) {
      posAcc = 0;
      const pos = {};
      Object.values(gs.players).forEach(p => {
        pos[p.id] = { x: p.x, y: p.y, dx: p.dx, dy: p.dy, range: p.range, maxBombs: p.maxBombs, speed: p.speed, hasWallbreak: p.hasWallbreak, alive: p.alive };
      });
      io.to(r.code).emit('posUpdate', { players: pos, bombs: gs.bombs });
    }
  }, 16);
  gameLoops.set(room.code, timer);
}

function applySuddenDeath(gs, wave, io, roomCode) {
  // collapse walls inward
  const cells = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (x === wave || y === wave || x === GRID_W - 1 - wave || y === GRID_H - 1 - wave) {
        if (gs.map[y][x] !== CELL.HARD) {
          gs.map[y][x] = CELL.HARD;
          cells.push({ x, y });
          // kill players on these cells
          Object.values(gs.players).forEach((p) => {
            if (p.alive && Math.floor(p.x) === x && Math.floor(p.y) === y) {
              p.alive = false;
              io.to(roomCode).emit('playerDied', { playerId: p.id });
            }
          });
        }
      }
    }
  }
  if (cells.length) io.to(roomCode).emit('suddenDeath', { cells, map: gs.map });
}

// ── Score saving ───────────────────────────────────────────────────────────
let pgPool = null;
function getPool() {
  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({ connectionString: process.env.POSTGRES_URI });
  }
  return pgPool;
}

async function saveWin(playerId, playerName, roomCode) {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO bomberman_scores (username, room_code, won, played_at)
       VALUES ($1, $2, true, NOW())
       ON CONFLICT DO NOTHING`,
      [playerName, roomCode]
    );
  } catch (e) {
    console.error('saveWin error:', e.message);
  }
}

// ── Socket.io handlers ─────────────────────────────────────────────────────
function broadcastRoomList(socket) {
  const list = [...rooms.values()]
    .filter(r => !r.locked && r.phase === 'lobby')
    .map(roomSummary);
  socket.broadcast.emit('roomListUpdate', list);
  socket.emit('roomListUpdate', list);
}

function setupSocket(io) {
  io.on('connection', (socket) => {
    // LIST ROOMS
    socket.on('listRooms', () => {
      const list = [...rooms.values()]
        .filter(r => !r.locked && r.phase === 'lobby')
        .map(roomSummary);
      socket.emit('roomList', list);
    });

    // CREATE ROOM
    socket.on('createRoom', ({ name, roomName }) => {
      if (!name) return;
      const room = makeRoom(socket.id, name, roomName);
      socket.join(room.code);
      socket.emit('roomCreated', roomInfo(room));
      broadcastRoomList(socket);
    });

    // JOIN ROOM
    socket.on('joinRoom', ({ code, name }) => {
      const room = rooms.get(code?.toUpperCase());
      if (!room) return socket.emit('joinError', 'ไม่พบห้องนี้');
      if (room.locked) return socket.emit('joinError', 'ห้องถูกล็อคแล้ว');
      if (room.phase !== 'lobby') {
        // join as spectator
        room.spectators.push({ id: socket.id, name });
        socket.join(room.code);
        socket.emit('joinedAsSpectator', roomInfo(room));
        return;
      }
      const free = freeSlots(room);
      if (!free.length) return socket.emit('joinError', 'ห้องเต็มแล้ว');
      room.players.push({ id: socket.id, name, slot: free[0], ready: false, isBot: false, connected: true, reconnectTimer: null });
      socket.join(room.code);
      socket.emit('roomJoined', roomInfo(room));
      io.to(room.code).emit('roomUpdated', roomInfo(room));
      broadcastRoomList(socket);
    });

    // REJOIN (reconnect)
    socket.on('rejoinRoom', ({ code, name }) => {
      const room = rooms.get(code);
      if (!room) return socket.emit('joinError', 'ไม่พบห้องนี้');
      const player = room.players.find((p) => p.name === name && !p.isBot);
      if (!player) return socket.emit('joinError', 'ไม่พบผู้เล่นนี้ในห้อง');
      if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
      const oldId = player.id;
      player.id = socket.id;
      player.connected = true;
      player.isBot = false;
      // update game state
      if (room.gameState && room.gameState.players[oldId]) {
        room.gameState.players[socket.id] = { ...room.gameState.players[oldId], id: socket.id };
        delete room.gameState.players[oldId];
      }
      socket.join(room.code);
      if (room.phase === 'playing') {
        socket.emit('gameStarted', { gameState: room.gameState, roomInfo: roomInfo(room), yourId: socket.id });
      } else {
        socket.emit('roomJoined', roomInfo(room));
      }
      io.to(room.code).emit('roomUpdated', roomInfo(room));
    });

    // LOCK / UNLOCK
    socket.on('toggleLock', ({ code }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;
      room.locked = !room.locked;
      io.to(room.code).emit('roomUpdated', roomInfo(room));
    });

    // ADD / REMOVE BOT
    socket.on('addBot', ({ code }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
      addBot(room);
      io.to(room.code).emit('roomUpdated', roomInfo(room));
    });
    socket.on('removeBot', ({ code }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
      removeBot(room);
      io.to(room.code).emit('roomUpdated', roomInfo(room));
    });

    // READY
    socket.on('setReady', ({ code, ready }) => {
      const room = rooms.get(code);
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (player) player.ready = ready;
      io.to(room.code).emit('roomUpdated', roomInfo(room));
    });

    // START GAME
    socket.on('startGame', ({ code }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;
      if (!allReady(room)) return socket.emit('startError', 'ผู้เล่นยังไม่พร้อมทุกคน');
      if (room.players.length < 2) return socket.emit('startError', 'ต้องมีผู้เล่นอย่างน้อย 2 คน');
      // countdown
      room.phase = 'countdown';
      io.to(room.code).emit('countdown', { seconds: 3 });
      let count = 3;
      const cd = setInterval(() => {
        count--;
        if (count > 0) { io.to(room.code).emit('countdown', { seconds: count }); return; }
        clearInterval(cd);
        room.phase = 'playing';
        room.endingAt = null; room.endWinner = null;
        room.gameState = initGameState(room);
        io.to(room.code).emit('gameStarted', { gameState: room.gameState, roomInfo: roomInfo(room) });
        startGameLoop(room, io);
        startBotAI(room, io);
      }, 1000);
    });

    // SET DIRECTION (free movement)
    socket.on('setDir', ({ code, dx, dy }) => {
      const room = rooms.get(code);
      if (!room || room.phase !== 'playing') return;
      const p = room.gameState.players[socket.id];
      if (!p?.alive) return;
      p.dx = Math.sign(dx || 0);
      p.dy = Math.sign(dy || 0);
    });

    // PLACE BOMB
    socket.on('placeBomb', ({ code }) => {
      const room = rooms.get(code);
      if (!room || room.phase !== 'playing') return;
      const bomb = placeBomb(room.gameState, socket.id);
      if (bomb) io.to(room.code).emit('bombPlaced', { bomb, playerId: socket.id });
    });

    // GET ROOM STATE (for page navigation without reconnect)
    socket.on('getRoom', ({ code }) => {
      const room = rooms.get(code);
      if (!room) return socket.emit('joinError', 'ไม่พบห้องนี้');
      const player = room.players.find((p) => p.id === socket.id);
      const spectator = room.spectators.find((s) => s.id === socket.id);
      if (player) {
        if (room.phase === 'playing') {
          socket.emit('gameStarted', { gameState: room.gameState, roomInfo: roomInfo(room), yourId: socket.id });
        } else {
          socket.emit('roomJoined', roomInfo(room));
        }
      } else if (spectator) {
        socket.emit('joinedAsSpectator', roomInfo(room));
      } else {
        socket.emit('joinError', 'ไม่พบห้องนี้');
      }
    });

    // LEAVE ROOM / BACK TO LOBBY
    socket.on('leaveRoom', ({ code }) => {
      handleLeave(socket, code, io);
    });

    // REMATCH
    socket.on('requestRematch', ({ code }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;
      room.phase = 'lobby';
      room.gameState = null;
      room.players.forEach((p) => { p.ready = p.id === room.hostId || p.isBot; });
      io.to(room.code).emit('rematch', roomInfo(room));
    });

    // DISCONNECT
    socket.on('disconnect', () => {
      rooms.forEach((room) => {
        const player = room.players.find((p) => p.id === socket.id);
        if (player && !player.isBot) {
          player.connected = false;
          if (room.phase === 'playing') {
            // bot takeover
            player.isBot = true;
            io.to(room.code).emit('playerDisconnected', { playerId: socket.id, name: player.name });
            player.reconnectTimer = setTimeout(() => {
              player.reconnectTimer = null;
              // stays as bot permanently
            }, RECONNECT_TIMEOUT);
          } else {
            handleLeave(socket, room.code, io);
          }
        }
        // remove spectator
        const si = room.spectators.findIndex((s) => s.id === socket.id);
        if (si !== -1) room.spectators.splice(si, 1);
      });
    });
  });
}

function handleLeave(socket, code, io) {
  const room = rooms.get(code);
  if (!room) return;
  const idx = room.players.findIndex((p) => p.id === socket.id);
  if (idx !== -1) {
    room.players.splice(idx, 1);
    socket.leave(code);
    if (room.players.filter((p) => !p.isBot).length === 0) {
      rooms.delete(code);
      const lt = gameLoops.get(code); if (lt) { clearInterval(lt); gameLoops.delete(code); }
      const bt = botTimers.get(code); if (bt) { clearInterval(bt); botTimers.delete(code); }
      broadcastRoomList(socket);
      return;
    }
    if (room.hostId === socket.id) {
      const nextHuman = room.players.find((p) => !p.isBot);
      if (nextHuman) { room.hostId = nextHuman.id; room.hostName = nextHuman.name; }
    }
    io.to(code).emit('roomUpdated', roomInfo(room));
    broadcastRoomList(socket);
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
nextApp.prepare().then(() => {
  const httpServer = http.createServer(async (req, res) => {
    const url = req.url || '/';
    try {
      // serve /_next/static/ manually (standalone doesn't auto-serve these)
      if (url.startsWith('/_next/static/')) {
        const rel = decodeURIComponent(url.replace('/_next/static/', '').split('?')[0]);
        const fp = path.join(__dirname, '.next', 'static', rel);
        return serveFile(fp, res);
      }
      // serve /_next/image — optimize via sharp (NextServer standalone customServer doesn't run the optimizer)
      if (url.startsWith('/_next/image')) {
        try {
          const qs = url.split('?')[1] || '';
          const params = new URLSearchParams(qs);
          const imgUrl = decodeURIComponent(params.get('url') || '');
          const w = parseInt(params.get('w') || '0', 10);
          const q = parseInt(params.get('q') || '75', 10);
          if (imgUrl.startsWith('/')) {
            const fp = path.join(__dirname, 'public', imgUrl.split('?')[0]);
            if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
              const accepts = String(req.headers['accept'] || '');
              const useWebp = accepts.includes('image/webp');
              const input = fs.readFileSync(fp);
              let pipeline = sharp(input).rotate();
              if (w > 0) pipeline = pipeline.resize(w, null, { withoutEnlargement: true });
              pipeline = useWebp ? pipeline.webp({ quality: q }) : pipeline.jpeg({ quality: q, mozjpeg: true });
              const out = await pipeline.toBuffer();
              res.statusCode = 200;
              res.setHeader('Content-Type', useWebp ? 'image/webp' : 'image/jpeg');
              res.setHeader('Cache-Control', 'public,max-age=31536000,immutable');
              return res.end(out);
            }
          }
        } catch (e) { /* fall through to NextServer */ }
        res.statusCode = 404; res.end('Not found'); return;
      }
      // serve public/ files
      const publicRel = url.split('?')[0];
      if (!url.startsWith('/_next/') && !url.startsWith('/api/') && !url.startsWith('/socket.io')) {
        const fp = path.join(__dirname, 'public', publicRel);
        if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return serveFile(fp, res);
      }
      await handle(req, res);
    }
    catch (err) { console.error(err); res.statusCode = 500; res.end('Internal Server Error'); }
  });

  const io = new IOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  setupSocket(io);

  const port = parseInt(process.env.PORT || '3000', 10);
  const hostname = process.env.HOSTNAME || '0.0.0.0';
  httpServer.listen(port, hostname, () => {
    console.log(`> ระเบิดโคตรเสียว ready on http://${hostname}:${port}`);
  });
});
