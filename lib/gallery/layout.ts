// Geometry of the 3D hall and the camera path through it. Pure math, no React.
//
// The hall is a polygon whose facets each hold one painting, arranged around a
// glowing tree in the middle. Angles run clockwise seen from above:
// angle 0 faces -z, and a point at angle θ, radius r is (r·sinθ, y, -r·cosθ).

import type { Artwork } from "@/lib/artworks";

export const WALL_HEIGHT = 6.5;
export const PAINTING_Y = 2.05;
/** Wall space either side of a painting, summed. */
const FACET_PADDING = 2.3;

export interface Slot {
  art: Artwork;
  /** Painting size in world units (≈ metres). */
  w: number;
  h: number;
  /** Facet centre angle and angular width. */
  angle: number;
  span: number;
  /** Distance from the hall centre to the facet's wall plane. */
  apothem: number;
  /** Facet width along the wall. */
  chord: number;
}

export interface Hall {
  slots: Slot[];
  radius: number;
}

export function paintingSize(art: Artwork) {
  const long = art.featured ? 3.0 : 2.3;
  return art.ratio >= 1
    ? { w: long, h: long / art.ratio }
    : { w: long * art.ratio, h: long };
}

export function buildHall(tour: Artwork[]): Hall {
  const sizes = tour.map(paintingSize);
  const widths = sizes.map((s) => s.w + FACET_PADDING);
  const perimeter = widths.reduce((a, b) => a + b, 0);
  const radius = perimeter / (2 * Math.PI);

  let start = -((widths[0] / perimeter) * Math.PI); // centre the first facet on angle 0
  const slots = tour.map((art, i) => {
    const span = (widths[i] / perimeter) * 2 * Math.PI;
    const angle = start + span / 2;
    start += span;
    return {
      art,
      ...sizes[i],
      angle,
      span,
      apothem: radius * Math.cos(span / 2),
      chord: 2 * radius * Math.sin(span / 2),
    };
  });
  return { slots, radius };
}

export const polar = (angle: number, r: number) =>
  [r * Math.sin(angle), -r * Math.cos(angle)] as const;

/** One camera pose. Interpolating these field-by-field gives orbital motion. */
export interface Pose {
  angle: number; // where the camera stands
  r: number;
  y: number;
  yaw: number; // which way it looks (same convention as angle)
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
  return { fx: 0.9, fy: 0.46, cx: 0, cy: 0.36 };
}

export function buildPoses(hall: Hall, vp: Viewport): Pose[] {
  const aspect = vp.width / vp.height;
  const t = Math.tan(((cameraFov(vp) / 2) * Math.PI) / 180);
  const { fx, fy, cx, cy } = frameRegion(vp);
  const R = hall.radius;
  const first = hall.slots[0];
  const last = hall.slots[hall.slots.length - 1];

  // Entrance: standing behind the tree, looking across it into the hall.
  const introAngle = first.angle - 2.2;
  const intro: Pose = {
    angle: introAngle,
    r: R * 0.9,
    y: 2.4,
    yaw: introAngle + Math.PI,
    pitch: 0.12,
    shiftX: 0,
    shiftY: 0.28, // lift the tree above the title
  };

  const paintings = hall.slots.map<Pose>((s) => {
    const d = Math.max(s.h / (2 * t * fy), s.w / (2 * t * aspect * fx));
    return {
      angle: s.angle,
      r: Math.max(0.8, s.apothem - d),
      y: PAINTING_Y,
      yaw: s.angle,
      pitch: 0,
      shiftX: cx,
      shiftY: cy,
    };
  });

  // Exit: rise above the hall and look back down at the tree.
  const outroAngle = last.angle + 0.7;
  const outro: Pose = {
    angle: outroAngle,
    r: R * 0.58,
    y: 6.2,
    yaw: outroAngle + Math.PI,
    pitch: -0.32,
    shiftX: 0,
    shiftY: 0,
  };

  return [intro, ...paintings, outro];
}

/** Hold still around each stop, move in between. */
export function plateau(f: number) {
  const x = Math.min(1, Math.max(0, (f - 0.18) / 0.64));
  return x * x * (3 - 2 * x);
}

export function samplePose(poses: Pose[], progress: number, out: Pose): Pose {
  const p = Math.min(poses.length - 1, Math.max(0, progress));
  const i = Math.min(poses.length - 2, Math.floor(p));
  const e = plateau(p - i);
  const a = poses[i];
  const b = poses[i + 1];
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    out[k] = a[k] + (b[k] - a[k]) * e;
  }
  return out;
}
