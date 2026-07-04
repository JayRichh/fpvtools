// src/core/render/engine2d.ts — Pure TS, zero DOM, zero framework
//
// Headless orchestration: takes a scene, produces the ordered draw list,
// renders it into any CanvasRenderingContext2D-shaped sink, and resolves
// picking. The DOM/rAF/pointer glue lives in the fpv-canvas Lit base.

import type { SceneNode } from './scene.js'
import { sortBackToFront } from './scene.js'
import { pickNode, traceHitRegion } from './picking.js'

export { sortBackToFront } from './scene.js'
export { pickNode, hitTest, traceHitRegion } from './picking.js'
export type { SceneNode, HitRegion, NodeKind, DrawState } from './scene.js'
export type { OrbitCamera, Projected, Vec3 } from './camera.js'
export {
  createOrbitCamera, projectPoint, applyOrbit, rotX, rotY, rotZ,
} from './camera.js'

export interface RenderOptions {
  /** id of the hovered node; its draw() receives { hovered: true } */
  hoveredId?: string | null
  /** stroke style for the hover outline; omit to skip the outline pass */
  outlineStyle?: string
  outlineWidth?: number
}

/**
 * Draw a scene back-to-front. Hover state is re-applied on every frame from
 * `options.hoveredId`, so imperative drivers (renderFrame fast-paths) never
 * clobber pointer highlights.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  nodes: readonly SceneNode[],
  options?: RenderOptions,
): void {
  const ordered = sortBackToFront(nodes)
  const hoveredId = options?.hoveredId ?? null
  let hoveredNode: SceneNode | null = null
  for (const node of ordered) {
    const hovered = node.id === hoveredId
    if (hovered) hoveredNode = node
    node.draw(ctx, { hovered })
  }
  // Generic highlight: outline the hovered node's hit region on top
  if (hoveredNode?.hit && options?.outlineStyle) {
    ctx.save()
    ctx.strokeStyle = options.outlineStyle
    ctx.lineWidth = options.outlineWidth ?? 2
    ctx.globalAlpha = 0.9
    traceHitRegion(ctx, hoveredNode.hit)
    ctx.restore()
  }
}

/** Resolve the hovered node for a pointer position (topmost hit wins). */
export function resolveHover(
  nodes: readonly SceneNode[],
  x: number,
  y: number,
  slop = 3,
): SceneNode | null {
  return pickNode(nodes, x, y, slop)
}
