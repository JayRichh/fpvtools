// src/core/render/picking.ts — Pure TS, zero DOM, zero framework
//
// Analytic hit-testing (strategy B from the design doc). Chosen over the
// pick-buffer because the core must stay DOM-free/headless (no offscreen
// canvas, no getImageData) and the scene vocabulary is a small closed set of
// primitives — circle, segment, ellipse, polyline — for which exact
// point-distance tests are cheap and deterministic. Occlusion is handled by
// resolving the topmost (largest-depth) hit.

import type { HitRegion, SceneNode } from './scene.js'

function distToSegmentSq(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return (px - cx) * (px - cx) + (py - cy) * (py - cy)
}

/** Point-in-region test in screen space. `slop` pads pick targets (px). */
export function hitTest(region: HitRegion, x: number, y: number, slop = 3): boolean {
  switch (region.type) {
    case 'circle': {
      const r = region.r + slop
      const dx = x - region.x
      const dy = y - region.y
      return dx * dx + dy * dy <= r * r
    }
    case 'segment': {
      const half = region.width / 2 + slop
      return distToSegmentSq(x, y, region.x1, region.y1, region.x2, region.y2) <= half * half
    }
    case 'ellipse': {
      const rot = region.rotation ?? 0
      const c = Math.cos(-rot), s = Math.sin(-rot)
      const dx0 = x - region.x
      const dy0 = y - region.y
      const dx = dx0 * c - dy0 * s
      const dy = dx0 * s + dy0 * c
      const rx = region.rx + slop
      const ry = region.ry + slop
      if (rx <= 0 || ry <= 0) return false
      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
    }
    case 'polyline': {
      const half = region.width / 2 + slop
      const halfSq = half * half
      const pts = region.points
      for (let i = 0; i < pts.length - 1; i++) {
        if (distToSegmentSq(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= halfSq) {
          return true
        }
      }
      return false
    }
  }
}

/**
 * Resolve the node under the pointer: among nodes whose hit region contains
 * the point, the topmost (largest depth) wins — so a force vector overlapping
 * the quad body picks correctly.
 */
export function pickNode(
  nodes: readonly SceneNode[],
  x: number,
  y: number,
  slop = 3,
): SceneNode | null {
  let best: SceneNode | null = null
  for (const n of nodes) {
    if (!n.hit) continue
    if (best && n.depth < best.depth) continue
    if (hitTest(n.hit, x, y, slop)) best = n
  }
  return best
}

/** Stroke a hit region's outline — used to highlight the hovered entity. */
export function traceHitRegion(ctx: CanvasRenderingContext2D, region: HitRegion): void {
  ctx.beginPath()
  switch (region.type) {
    case 'circle':
      ctx.arc(region.x, region.y, region.r + 2, 0, Math.PI * 2)
      break
    case 'segment':
      ctx.moveTo(region.x1, region.y1)
      ctx.lineTo(region.x2, region.y2)
      break
    case 'ellipse':
      ctx.ellipse(region.x, region.y, region.rx + 2, region.ry + 2, region.rotation ?? 0, 0, Math.PI * 2)
      break
    case 'polyline': {
      const pts = region.points
      if (!pts.length) return
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      break
    }
  }
  ctx.stroke()
}
