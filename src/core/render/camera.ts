// src/core/render/camera.ts — Pure TS, zero DOM, zero framework
//
// Orbit camera + perspective projection, extracted and generalized from the
// rotX/rotY/project math previously inline in fpv-quad-preview-3d.

export type Vec3 = [number, number, number]

export function rotX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}
export function rotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]
}
export function rotZ(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]
}

export interface OrbitCamera {
  /** Orbit angles in radians */
  yaw: number
  pitch: number
  /** Pixels per world unit */
  scale: number
  /** Focal length in world units (perspective strength) */
  focalLen: number
  /** Screen-space projection center */
  cx: number
  cy: number
}

export interface Projected {
  x: number
  y: number
  /**
   * Perspective factor focalLen / (z + focalLen): ~1 at scene center, smaller
   * when further from the camera. Doubles as the back-to-front sort key and
   * the on-screen size multiplier.
   */
  depth: number
}

export function createOrbitCamera(init?: Partial<OrbitCamera>): OrbitCamera {
  return {
    yaw: init?.yaw ?? 22 * (Math.PI / 180),
    pitch: init?.pitch ?? -28 * (Math.PI / 180),
    scale: init?.scale ?? 100,
    focalLen: init?.focalLen ?? 4,
    cx: init?.cx ?? 0,
    cy: init?.cy ?? 0,
  }
}

/** World point → screen point through the orbit + perspective pipeline. */
export function projectPoint(cam: OrbitCamera, v: Vec3): Projected {
  let p = rotX(v, cam.pitch)
  p = rotY(p, cam.yaw)
  const z = p[2] + cam.focalLen
  if (z < 1 / cam.scale) return { x: cam.cx, y: cam.cy, depth: 0 }
  const s = cam.focalLen / z
  return { x: cam.cx + p[0] * cam.scale * s, y: cam.cy - p[1] * cam.scale * s, depth: s }
}

export interface OrbitConstraints {
  sensitivity?: number
  pitchMin?: number
  pitchMax?: number
}

/** Apply a pointer drag (pixels) to the orbit angles. Returns new angles. */
export function applyOrbit(
  cam: Pick<OrbitCamera, 'yaw' | 'pitch'>,
  dxPx: number,
  dyPx: number,
  c?: OrbitConstraints,
): { yaw: number; pitch: number } {
  const sens = c?.sensitivity ?? 0.006
  const pitchMin = c?.pitchMin ?? -1.45
  const pitchMax = c?.pitchMax ?? -0.04
  return {
    yaw: cam.yaw + dxPx * sens,
    pitch: Math.max(pitchMin, Math.min(pitchMax, cam.pitch + dyPx * sens)),
  }
}
