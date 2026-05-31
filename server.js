'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server: IOServer } = require('socket.io');

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
      x: pos.x, y: pos.y,
      alive: true, speed: 1, maxBombs: 1, range: 1, kills: 0,
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
  // check no bomb already there
  if (gs.bombs.find((b) => b.x === p.x && b.y === p.y)) return null;
  const bomb = { id: ++bombIdCounter, x: p.x, y: p.y, ownerId: playerId, timer: 3000, range: p.range };
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
        break;
      }
      // chain bomb?
      const chainBomb = gs.bombs.find((b) => b.x === nx && b.y === ny);
      if (chainBomb) { chainBomb.timer = 0; }
    }
  });

  // damage players
  cells.forEach(({ x, y }) => {
    Object.values(gs.players).forEach((p) => {
      if (p.alive && p.x === x && p.y === y) {
        p.alive = false;
        if (owner && owner.id !== p.id) owner.kills++;
        io.to(roomCode).emit('playerDied', { playerId: p.id });
      }
    });
  });

  gs.explosions.push({ cells, timer: 500 });
  io.to(roomCode).emit('explosion', { cells, bombId: bomb.id });
  io.to(roomCode).emit('mapUpdate', { map: gs.map, powerups: gs.powerups });
}

function movePlayer(gs, playerId, dir) {
  const p = gs.players[playerId];
  if (!p || !p.alive) return false;
  const dx = dir === 'right' ? 1 : dir === 'left' ? -1 : 0;
  const dy = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
  const nx = p.x + dx, ny = p.y + dy;
  if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) return { moved: false, mapChanged: false };
  if (gs.map[ny][nx] !== CELL.EMPTY) return { moved: false, mapChanged: false };
  if (gs.bombs.find((b) => b.x === nx && b.y === ny)) return { moved: false, mapChanged: false };
  p.x = nx; p.y = ny;
  // collect powerup
  let mapChanged = false;
  let wallbreakUser = null;
  const pIdx = gs.powerups.findIndex((pu) => pu.x === nx && pu.y === ny);
  if (pIdx !== -1) {
    const pu = gs.powerups[pIdx];
    if (pu.type === 'range') p.range = Math.min(p.range + 1, 8);
    if (pu.type === 'bombs') p.maxBombs = Math.min(p.maxBombs + 1, 5);
    if (pu.type === 'speed') p.speed = Math.min(p.speed + 0.5, 3);
    if (pu.type === 'wallbreak') {
      let cleared = 0;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([ddx, ddy]) => {
        for (let i = 1; i <= p.range; i++) {
          const bx = p.x + ddx * i, by = p.y + ddy * i;
          if (bx < 0 || bx >= GRID_W || by < 0 || by >= GRID_H) break;
          if (gs.map[by][bx] === CELL.HARD) break;
          if (gs.map[by][bx] === CELL.SOFT) {
            gs.map[by][bx] = CELL.EMPTY;
            mapChanged = true;
            cleared++;
            if (Math.random() < 0.3) {
              const pool = gs.wallbreakSpawned ? POWERUPS.filter(t => t !== 'wallbreak') : POWERUPS;
              const type = pool[Math.floor(Math.random() * pool.length)];
              if (type === 'wallbreak') gs.wallbreakSpawned = true;
              gs.powerups.push({ x: bx, y: by, type });
            }
          }
        }
      });
      if (cleared > 0) wallbreakUser = { name: p.name, cleared };
    }
    gs.powerups.splice(pIdx, 1);
  }
  return { moved: true, mapChanged, wallbreakUser };
}

function alivePlayers(gs) {
  return Object.values(gs.players).filter((p) => p.alive);
}

// ── Bot AI ─────────────────────────────────────────────────────────────────
const BOT_TICK_MS = 500;
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
        if (gs.map[ny][nx] === CELL.SOFT) break;
      }
    }
  }
  return false;
}

// BFS: find first step toward nearest safe cell; returns dir string or null
function bfsEscape(gs, sx, sy) {
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
      if (gs.bombs.find(b=>b.x===nx&&b.y===ny)) continue;
      visited.add(key);
      queue.push([nx, ny, firstDir ?? d]);
    }
  }
  return null;
}

// BFS: find first step toward target (tx,ty), avoiding blast zones
function bfsChase(gs, sx, sy, tx, ty) {
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
      if (gs.bombs.find(b=>b.x===nx&&b.y===ny)) continue;
      if (isInBlastZone(gs, nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny, firstDir ?? d]);
    }
  }
  return null;
}

// Check if bot can reach a safe cell after placing a hypothetical bomb
function canEscapeAfterBomb(gs, bx, by, range) {
  const fakeBomb = { x: bx, y: by, range };
  const fakeGs = { ...gs, bombs: [...gs.bombs, fakeBomb] };
  return bfsEscape(fakeGs, bx, by) !== null;
}

function startBotAI(room, io) {
  if (botTimers.has(room.code)) return;
  const timer = setInterval(() => {
    const r = rooms.get(room.code);
    if (!r || r.phase !== 'playing') { clearInterval(timer); botTimers.delete(r?.code); return; }
    const gs = r.gameState;
    Object.values(gs.players).forEach((p) => {
      if (!p.isBot || !p.alive) return;

      const inDanger = isInBlastZone(gs, p.x, p.y);

      // ── FLEE: escape blast zone using BFS ──
      if (inDanger) {
        const escDir = bfsEscape(gs, p.x, p.y);
        if (escDir) movePlayer(gs, p.id, escDir);
        io.to(r.code).emit('playerMoved', { playerId: p.id, x: p.x, y: p.y });
        return; // flee first, do nothing else
      }

      // ── PLACE BOMB: only if BFS confirms escape after bomb ──
      if (p.activeBombs < p.maxBombs && Math.random() < 0.12) {
        // check adjacent soft blocks or players nearby — worth bombing?
        const nearTarget = (() => {
          const DIRS4 = [[0,-1],[0,1],[-1,0],[1,0]];
          for (const [dx,dy] of DIRS4) {
            for (let i=1; i<=p.range; i++) {
              const nx=p.x+dx*i, ny=p.y+dy*i;
              if (nx<0||ny<0||nx>=GRID_W||ny>=GRID_H) break;
              if (gs.map[ny][nx]===CELL.HARD) break;
              if (gs.map[ny][nx]===CELL.SOFT) return true;
              // player in range?
              if (Object.values(gs.players).some(q=>q.alive&&!q.isBot&&q.x===nx&&q.y===ny)) return true;
            }
          }
          return false;
        })();

        if (nearTarget && canEscapeAfterBomb(gs, p.x, p.y, p.range)) {
          const bomb = placeBomb(gs, p.id);
          if (bomb) {
            io.to(r.code).emit('bombPlaced', { bomb, playerId: p.id });
            // immediately start fleeing
            const escDir = bfsEscape(gs, p.x, p.y);
            if (escDir) movePlayer(gs, p.id, escDir);
            io.to(r.code).emit('playerMoved', { playerId: p.id, x: p.x, y: p.y });
            return;
          }
        }
      }

      // ── CHASE nearest human player ──
      const humans = Object.values(gs.players).filter(q => q.alive && !q.isBot);
      let chased = false;
      if (humans.length) {
        // pick closest
        const target = humans.reduce((a, b) =>
          Math.abs(a.x-p.x)+Math.abs(a.y-p.y) < Math.abs(b.x-p.x)+Math.abs(b.y-p.y) ? a : b
        );
        const chaseDir = bfsChase(gs, p.x, p.y, target.x, target.y);
        if (chaseDir) { movePlayer(gs, p.id, chaseDir); chased = true; }
      }

      // ── WANDER if can't chase ──
      if (!chased) {
        const DIRS4 = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
        const safe = DIRS4.filter(([,dx,dy]) => {
          const nx=p.x+dx, ny=p.y+dy;
          return nx>=0&&ny>=0&&nx<GRID_W&&ny<GRID_H && gs.map[ny][nx]===CELL.EMPTY &&
            !gs.bombs.find(b=>b.x===nx&&b.y===ny) && !isInBlastZone(gs,nx,ny);
        });
        if (safe.length) movePlayer(gs, p.id, safe[Math.floor(Math.random()*safe.length)][0]);
      }

      io.to(r.code).emit('playerMoved', { playerId: p.id, x: p.x, y: p.y });
    });
  }, BOT_TICK_MS);
  botTimers.set(room.code, timer);
}

// ── Game loop (bomb timers, sudden death) ──────────────────────────────────
const gameLoops = new Map(); // roomCode -> intervalId

function startGameLoop(room, io) {
  let last = Date.now();
  const timer = setInterval(() => {
    const r = rooms.get(room.code);
    if (!r || r.phase !== 'playing') { clearInterval(timer); gameLoops.delete(r?.code); return; }
    const gs = r.gameState;
    const now = Date.now();
    const dt = now - last;
    last = now;
    gs.tick++;

    // tick bombs
    const toExplode = [];
    gs.bombs.forEach((b) => { b.timer -= dt; if (b.timer <= 0) toExplode.push(b); });
    toExplode.forEach((b) => explodeBomb(gs, b, io, r.code));

    // tick explosions
    gs.explosions.forEach((e) => { e.timer -= dt; });
    gs.explosions = gs.explosions.filter((e) => e.timer > 0);

    // sudden death
    if (now > gs.suddenDeathAt) {
      const wave = Math.floor((now - gs.suddenDeathAt) / 2000);
      if (wave > gs.suddenDeathWave) {
        gs.suddenDeathWave = wave;
        applySuddenDeath(gs, wave, io, r.code);
      }
    }

    // check win
    const alive = alivePlayers(gs);
    if (alive.length <= 1) {
      r.phase = 'ended';
      const winner = alive[0] || null;
      const stats = Object.values(gs.players).map((p) => ({
        id: p.id, name: p.name, slot: p.slot, isBot: p.isBot, alive: p.alive, kills: p.kills,
      }));
      io.to(r.code).emit('gameOver', { winner: winner ? { id: winner.id, name: winner.name } : null, stats });
      clearInterval(timer); gameLoops.delete(r.code);
      const bt = botTimers.get(r.code);
      if (bt) { clearInterval(bt); botTimers.delete(r.code); }
      // save score if winner is a real player
      if (winner && !winner.isBot) saveWin(winner.id, winner.name, r.code);
    }

    io.to(r.code).emit('gameState', { players: gs.players, bombs: gs.bombs });
  }, 100);
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
            if (p.alive && p.x === x && p.y === y) {
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
        room.gameState = initGameState(room);
        io.to(room.code).emit('gameStarted', { gameState: room.gameState, roomInfo: roomInfo(room) });
        startGameLoop(room, io);
        startBotAI(room, io);
      }, 1000);
    });

    // PLAYER MOVE
    socket.on('move', ({ code, dir }) => {
      const room = rooms.get(code);
      if (!room || room.phase !== 'playing') return;
      const { moved, mapChanged, wallbreakUser } = movePlayer(room.gameState, socket.id, dir);
      if (moved) {
        const p = room.gameState.players[socket.id];
        io.to(room.code).emit('playerMoved', { playerId: socket.id, x: p.x, y: p.y });
        if (mapChanged) {
          io.to(room.code).emit('mapUpdate', { map: room.gameState.map, powerups: room.gameState.powerups });
          if (wallbreakUser) io.to(room.code).emit('wallbreakUsed', { ...wallbreakUser, playerId: socket.id });
        } else {
          io.to(room.code).emit('powerupsUpdate', { powerups: room.gameState.powerups });
        }
      }
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
      // serve /_next/image — NextServer doesn't handle image optimization in customServer mode
      if (url.startsWith('/_next/image')) {
        try {
          const qs = url.split('?')[1] || '';
          const imgUrl = decodeURIComponent(new URLSearchParams(qs).get('url') || '');
          if (imgUrl.startsWith('/')) {
            const fp = path.join(__dirname, 'public', imgUrl.split('?')[0]);
            if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return serveFile(fp, res);
          }
        } catch {}
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
