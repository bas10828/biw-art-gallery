export interface BombermanPlayer {
  id: string;
  name: string;
  slot: number;
  ready: boolean;
  isBot: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  locked: boolean;
  phase: 'lobby' | 'countdown' | 'playing' | 'ended';
  players: BombermanPlayer[];
}

export interface GamePlayer {
  id: string;
  name: string;
  slot: number;
  isBot: boolean;
  x: number;
  y: number;
  alive: boolean;
  speed: number;
  maxBombs: number;
  range: number;
  activeBombs: number;
}

export interface Bomb {
  id: number;
  x: number;
  y: number;
  ownerId: string;
  timer: number;
  range: number;
}

export interface Powerup {
  x: number;
  y: number;
  type: 'range' | 'bombs' | 'speed';
}

export interface GameState {
  map: number[][];
  players: Record<string, GamePlayer>;
  bombs: Bomb[];
  powerups: Powerup[];
  tick: number;
}
