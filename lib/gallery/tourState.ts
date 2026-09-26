// Shared mutable state between the scroll-driven DOM and the WebGL scene.
// Written on scroll/pointer events, read every frame — no React re-renders.

export const tourState = {
  /** 0 = entrance, 1..N = paintings, N+1 = exit. Fractional in between. */
  progress: 0,
  /** Pointer position in NDC, for subtle parallax on desktop. */
  pointerX: 0,
  pointerY: 0,
};
