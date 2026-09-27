// Geometry of the 3D room and the camera path through it. Pure math, no React.
//
// The room is a rectangle, W wide (x) by D deep (z), with a glowing tree in the
// middle. The featured painting hangs in the centre of the far wall (z = -D/2),
// and the rest follow clockwise seen from above: right wall, near wall, left
// wall, then back along the far wall.
//
// Yaw convention: yaw 0 looks toward -z, yaw π/2 toward +x; a camera with yaw ψ
// looks along (sin ψ, 0, -cos ψ).

import type { Artwork } from "@/lib/artworks";

export const WALL_HEIGHT = 6.5;
export const PAINTING_Y = 2.05;
/** Wall space either side of a painting, summed. */
const PADDING = 2.3;
/** Bare wall kept free at each corner. */
const CORNER = 1.2;
/** Room proportions, width : depth. */
const ASPECT = 1.3;

export interface Slot {
  art: Artwork;
  /** Painting size in world units (≈ metres). */
  w: number;
  h: number;
  /** Centre of the painting on the wall surface. */
  x: number;
  z: number;
  /** Yaw of a viewer facing the painting (the wall's outward direction). */
  angle: number;
}

export interface Room {
  slots: Slot[];
  width: number;
  depth: number;
}

export function paintingSize(art: Artwork) {
  const long = art.featured ? 3.0 : 2.3;
  return art.ratio >= 1
    ? { w: long, h: long / art.ratio }
    : { w: long * art.ratio, h: long };
}

/** A straight run of wall that paintings are hung along, in walking order. */
interface Run {
  start: [number, number];
  dir: [number, number];
  length: number;
  angle: number;
}

function wallRuns(W: number, D: number, featuredSpan: number): Run[] {
  const hw = W / 2;
  const hd = D / 2;
  const half = hw - CORNER - featuredSpan / 2;
  return [
    { start: [featuredSpan / 2, -hd], dir: [1, 0], length: half, angle: 0 }, // far wall, right half
    { start: [hw, -hd + CORNER], dir: [0, 1], length: D - 2 * CORNER, angle: Math.PI / 2 }, // right
    { start: [hw - CORNER, hd], dir: [-1, 0], length: W - 2 * CORNER, angle: Math.PI }, // near
    { start: [-hw, hd - CORNER], dir: [0, -1], length: D - 2 * CORNER, angle: (3 * Math.PI) / 2 }, // left
    { start: [-hw + CORNER, -hd], dir: [1, 0], length: half, angle: 2 * Math.PI }, // far wall, left half
  ];
}

/** Hang paintings into runs in order; null if they don't all fit. */
function hang(runs: Run[], widths: number[]) {
  const groups: number[][] = runs.map(() => []);
  let run = 0;
  let used = 0;
  for (let i = 0; i < widths.length; i++) {
    while (run < runs.length && used + widths[i] > runs[run].length) {
      run++;
      used = 0;
    }
    if (run >= runs.length) return null;
    groups[run].push(i);
    used += widths[i];
  }
  return groups;
}

export function buildRoom(tour: Artwork[]): Room {
  const sizes = tour.map(paintingSize);
  const widths = sizes.map((s) => s.w + PADDING);
  const featuredSpan = widths[0];
  const rest = widths.slice(1);

  // Smallest room (in 3% steps) whose walls hold every painting.
  let perimeter = widths.reduce((a, b) => a + b, 0) + 8 * CORNER;
  for (;;) {
    const D = perimeter / (2 * (1 + ASPECT));
    const W = D * ASPECT;
    const runs = wallRuns(W, D, featuredSpan);
    const groups = hang(runs, rest);
    if (groups) {
      const slots: Slot[] = [
        { art: tour[0], ...sizes[0], x: 0, z: -D / 2 + 0.02, angle: 0 },
      ];
      groups.forEach((group, r) => {
        const { start, dir, length, angle } = runs[r];
        const used = group.reduce((a, i) => a + rest[i], 0);
        const extra = group.length ? (length - used) / group.length : 0;
        let s = 0;
        for (const i of group) {
          const span = rest[i] + extra;
          const at = s + span / 2;
          s += span;
          // Nudge off the wall surface toward the room.
          const inX = -Math.sin(angle) * 0.02;
          const inZ = Math.cos(angle) * 0.02;
          slots.push({
            art: tour[i + 1],
            ...sizes[i + 1],
            x: start[0] + dir[0] * at + inX,
            z: start[1] + dir[1] * at + inZ,
            angle,
          });
        }
      });
      return { slots, width: W, depth: D };
    }
    perimeter *= 1.03;
  }
}

/** One camera pose, interpolated field by field. */
export interface Pose {
  x: number;
  z: number;
  y: number;
  yaw: number;
  pitch: number;
  /** Lens shift in NDC units, so the painting sits beside/above the text card. */
  shiftX: number;
  shiftY: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Side-by-side layout (card left, painting right) vs stacked (card below). */
export const isWideLayout = ({ width, height }: Viewport) =>
  width >= 768 && width > height;

export const cameraFov = (vp: Viewport) => (isWideLayout(vp) ? 42 : 58);

/**
 * Screen region the painting should fill, as fractions of the viewport, plus
 * where its centre goes (NDC). Mirrors the card layout in HomePage.
 */
function frameRegion(vp: Viewport) {
  if (isWideLayout(vp)) {
    // Card: max-w 26rem + 7vw margin (see .tour-card in globals.css).
    const cardRight = Math.min(0.5, (416 + 0.07 * vp.width + 32) / vp.width);
    const left = cardRight + 0.02;
    const right = 0.9; // clear of the progress rail
    return {
      fx: right - left,
      fy: vp.height < 560 ? 0.66 : 0.7,
      cx: left + right - 1,
      cy: 0,
    };
  }
  // Leaves room for the card and the step controls below the painting.
  return { fx: 0.9, fy: 0.42, cx: 0, cy: 0.4 };
}

const TAU = Math.PI * 2;
/** `a` shifted by whole turns to lie within ±π of `ref`. */
export const near = (a: number, ref: number) => a + TAU * Math.round((ref - a) / TAU);
/** Yaw of a camera at (x, z) looking toward (tx, tz). */
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, -(tz - z));

export interface Path {
  poses: Pose[];
  /** Bend the entrance → first-painting walk around the tree. */
  via: { x: number; z: number };
}

export function buildPath(room: Room, vp: Viewport): Path {
  const aspect = vp.width / vp.height;
  const t = Math.tan(((cameraFov(vp) / 2) * Math.PI) / 180);
  const { fx, fy, cx, cy } = frameRegion(vp);
  const { width: W, depth: D, slots } = room;

  const paintings = slots.map<Pose>((s) => {
    const across = s.angle % Math.PI === 0 ? D : W; // room size facing this wall
    const d = Math.min(across - 2, Math.max(s.h / (2 * t * fy), s.w / (2 * t * aspect * fx)));
    return {
      x: s.x - Math.sin(s.angle) * d,
      z: s.z + Math.cos(s.angle) * d,
      y: PAINTING_Y,
      yaw: s.angle,
      pitch: 0,
      shiftX: cx,
      shiftY: cy,
    };
  });

  // Entrance: just inside the near wall, looking past the tree to the far wall.
  const ix = W * 0.2;
  const iz = D / 2 - 2.2;
  const intro: Pose = {
    x: ix,
    z: iz,
    y: 2.4,
    yaw: near(yawTo(ix, iz, 0, -D * 0.15), paintings[0].yaw),
    pitch: 0.12,
    shiftX: 0,
    shiftY: 0.28, // lift the tree above the title
  };

  // Exit: rise in the far-left corner and look back down at the tree.
  const last = paintings[paintings.length - 1];
  const ox = -W * 0.28;
  const oz = -D * 0.12;
  const outro: Pose = {
    x: ox,
    z: oz,
    y: 6.2,
    yaw: near(yawTo(ox, oz, 0, 0), last.yaw + Math.PI / 2),
    pitch: -0.32,
    shiftX: 0,
    shiftY: 0,
  };

  return { poses: [intro, ...paintings, outro], via: { x: W * 0.32, z: -D * 0.05 } };
}

/** Hold still around each stop, move in between. */
export function plateau(f: number) {
  const x = Math.min(1, Math.max(0, (f - 0.18) / 0.64));
  return x * x * (3 - 2 * x);
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** How much of the way a visitor turns toward where they're walking. */
const LOOK_AHEAD = 0.3;

/**
 * Pose at a point along the tour. Between two paintings it plays like a walk:
 * turn away from the wall, walk (round corners too), turn to face the next piece.
 */
export function samplePose({ poses, via }: Path, progress: number, out: Pose): Pose {
  const p = Math.min(poses.length - 1, Math.max(0, progress));
  const i = Math.min(poses.length - 2, Math.floor(p));
  const f = p - i;
  const a = poses[i];
  const b = poses[i + 1];
  const betweenPaintings = i >= 1 && i + 1 <= poses.length - 2;

  if (!betweenPaintings) {
    const e = plateau(f);
    for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = a[k] + (b[k] - a[k]) * e;
    if (i === 0) {
      // Quadratic curve through `via` so the walk in skirts the tree.
      const u = 1 - e;
      out.x = u * u * a.x + 2 * u * e * via.x + e * e * b.x;
      out.z = u * u * a.z + 2 * u * e * via.z + e * e * b.z;
    }
    return out;
  }

  const e = smooth((f - 0.2) / 0.6); // position: move in the middle of the step
  const turn = Math.min(smooth(f / 0.3), 1 - smooth((f - 0.7) / 0.3)); // look ahead while walking
  for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = a[k] + (b[k] - a[k]) * e;
  const travel = near(yawTo(a.x, a.z, b.x, b.z), out.yaw);
  out.yaw += (travel - out.yaw) * LOOK_AHEAD * turn;
  out.shiftX *= 1 - turn;
  out.shiftY *= 1 - turn;
  return out;
}

/** Shortcut walks keep at least this far from the tree at the room's centre. */
const TREE_CLEARANCE = 3.5;
/** Walking pace across the room, m/s. */
const WALK_SPEED = 1.4;
/** Longest a shortcut walk may take, seconds; longer crossings speed up. */
const MAX_WALK = 4.5;
/** Turning pace, rad/s. */
const TURN_SPEED = 1.8;

/**
 * A direct walk across the room for long jumps (index, rail, last → first):
 * turn toward the destination, walk there, turn to face it. Replaces running
 * the whole wall path past every painting in between.
 */
export interface Shortcut {
  from: Pose;
  to: Pose;
  /** Quadratic control point; bends the line around the tree when needed. */
  ctrl: { x: number; z: number };
  /** Yaw walking off, walking in, and facing the destination. */
  headOut: number;
  headIn: number;
  toYaw: number;
  turnOut: number;
  walk: number;
  turnIn: number;
  length: number;
}

const clampAbs = (v: number, limit: number) => Math.min(limit, Math.max(-limit, v));

const bezier = (a: number, c: number, b: number, e: number) =>
  (1 - e) * (1 - e) * a + 2 * (1 - e) * e * c + e * e * b;

export function planShortcut(room: Room, from: Pose, to: Pose): Shortcut {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len2 = dx * dx + dz * dz;

  // Closest approach of the straight line to the tree; detour through a side
  // point if it gets too close.
  const t = len2 > 1e-6 ? Math.min(1, Math.max(0, -(from.x * dx + from.z * dz) / len2)) : 0;
  const px = from.x + dx * t;
  const pz = from.z + dz * t;
  const dist = Math.hypot(px, pz);
  let ctrl = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 };
  if (len2 > 1e-6 && dist < TREE_CLEARANCE) {
    let nx = px;
    let nz = pz;
    if (dist < 1e-3) {
      // Straight through the trunk: go round on the side perpendicular to travel.
      nx = -dz;
      nz = dx;
    }
    const n = Math.hypot(nx, nz);
    const vx = clampAbs((nx / n) * TREE_CLEARANCE, room.width / 2 - 1);
    const vz = clampAbs((nz / n) * TREE_CLEARANCE, room.depth / 2 - 1);
    // Control point that puts the curve's midpoint on the side point.
    ctrl = { x: 2 * vx - (from.x + to.x) / 2, z: 2 * vz - (from.z + to.z) / 2 };
  }

  let length = 0;
  for (let i = 1, x0 = from.x, z0 = from.z; i <= 16; i++) {
    const x1 = bezier(from.x, ctrl.x, to.x, i / 16);
    const z1 = bezier(from.z, ctrl.z, to.z, i / 16);
    length += Math.hypot(x1 - x0, z1 - z0);
    x0 = x1;
    z0 = z1;
  }

  const moving = length > 0.3;
  const headOut = moving ? near(yawTo(from.x, from.z, ctrl.x, ctrl.z), from.yaw) : from.yaw;
  const headIn = moving ? near(yawTo(ctrl.x, ctrl.z, to.x, to.z), headOut) : headOut;
  const toYaw = near(to.yaw, headIn);
  const turn = (a: number, b: number) => Math.min(1.4, Math.abs(b - a) / TURN_SPEED);

  return {
    from: { ...from },
    to: { ...to },
    ctrl,
    headOut,
    headIn,
    toYaw,
    turnOut: turn(from.yaw, headOut),
    walk: moving ? Math.min(MAX_WALK, Math.max(0.6, length / WALK_SPEED)) : 0,
    turnIn: turn(headIn, toYaw),
    length,
  };
}

export const shortcutDuration = (s: Shortcut) => s.turnOut + s.walk + s.turnIn;

/**
 * Pose `time` seconds into a shortcut. Returns walking speed in m/s (for head
 * bob) and how far through the walk leg it is (0..1).
 */
export function sampleShortcut(s: Shortcut, time: number, out: Pose) {
  const { from, to } = s;
  Object.assign(out, from);

  if (time < s.turnOut) {
    const e = smooth(time / s.turnOut);
    out.yaw = from.yaw + (s.headOut - from.yaw) * e;
    out.shiftX = from.shiftX * (1 - e);
    out.shiftY = from.shiftY * (1 - e);
    return { speed: 0, walked: 0 };
  }

  const w = time - s.turnOut;
  if (w < s.walk) {
    const u = w / s.walk;
    const e = smooth(u);
    out.x = bezier(from.x, s.ctrl.x, to.x, e);
    out.z = bezier(from.z, s.ctrl.z, to.z, e);
    out.y = from.y + (to.y - from.y) * e;
    out.pitch = from.pitch + (to.pitch - from.pitch) * e;
    out.yaw = s.headOut + (s.headIn - s.headOut) * e;
    out.shiftX = 0;
    out.shiftY = 0;
    return { speed: (s.length / s.walk) * 6 * u * (1 - u), walked: e };
  }

  const e = s.turnIn > 0 ? smooth((w - s.walk) / s.turnIn) : 1;
  Object.assign(out, to);
  out.yaw = s.headIn + (s.toYaw - s.headIn) * e;
  out.shiftX = to.shiftX * e;
  out.shiftY = to.shiftY * e;
  return { speed: 0, walked: 1 };
}
